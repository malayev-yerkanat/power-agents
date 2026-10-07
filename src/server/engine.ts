import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Connection, Run, TurnRunner } from '../shared/types.ts';
import { Store } from './store.ts';
import { runTurn } from './adapters/index.ts';
import { redactError } from './adapters/common.ts';
import { demoRunner } from './core/demo.ts';
import { validateInput, parseEnvelope, parsePlan } from './core/protocol.ts';
import { promptFor } from './core/prompts.ts';
import { applyResult, type Job } from './core/results.ts';
class InputError extends Error { readonly statusCode = 400; }
interface Options { store: Store; connections: Connection[]; workspaceRoot: string; runner?: TurnRunner; demoRunner?: TurnRunner }
export class Engine {
  private readonly options: Options;
  private readonly active = new Map<string, { runId: string; memberId: string; controller: AbortController }>();
  private scheduled = false;
  private stopped = false;
  constructor(options: Options) {
    this.options = options;
    for (const run of options.store.listRuns()) {
      if (run.status === 'planning' || run.status === 'running') this.change(run.id, r => ({ ...r, status: 'paused', error: 'Сервер перезапущен. Последний вызов мог завершиться у провайдера. Продолжение повторит незавершённую работу.', tasks: r.tasks.map(t => t.status === 'running' ? { ...t, status: 'pending' } : t), messages: r.messages.map(m => m.request && m.status === 'delivered' ? { ...m, status: 'queued' } : m) }), 'recovered', 'Работа приостановлена после перезапуска.');
    }
  }
  get(id: string): Run { const run = this.options.store.getRun(id); if (!run) throw new InputError('Команда не найдена.'); return run; }
  private change(id: string, update: (run: Run) => Run, type: string, message: string, actorId?: string): Run {
    return this.options.store.updateRun(id, update, { type, message, actorId });
  }
  create(value: unknown): Run {
    const input = validateInput(value);
    if (this.options.store.listRuns().some(r => ['planning', 'running'].includes(r.status))) throw new InputError('Сначала приостановите текущую команду.');
    if (input.mode === 'live') for (const member of input.members) {
      const connection = this.options.connections.find(c => c.id === member.connectionId);
      if (!connection?.available) throw new InputError(`Подключение ${member.name} недоступно.`);
      if (connection.kind.endsWith('-api') && !member.model.trim()) throw new InputError('Для API укажите модель.');
    }
    const now = new Date().toISOString();
    const run: Run = { ...input, id: randomUUID(), title: input.goal.slice(0, 90), status: 'planning', tasks: [], messages: [], artifacts: [], sessions: {}, turnCount: 0, reviewRound: 0, phase: 'plan', createdAt: now, updatedAt: now, version: 1 };
    mkdirSync(join(this.options.workspaceRoot, run.id), { recursive: true });
    this.options.store.createRun(run, { type: 'created', message: input.mode === 'demo' ? 'Создана демонстрационная команда.' : 'Команда создана. Руководитель готовит план.' });
    this.schedule();
    return run;
  }
  approve(id: string, version: number): Run {
    const run = this.get(id);
    if (run.status !== 'awaiting_approval' || !run.plan) throw new InputError('Нет плана для согласования.');
    if (run.version !== version) throw new InputError('План обновлён. Просмотрите актуальную версию.');
    this.ensureFree(id);
    const next = this.change(id, r => ({ ...r, status: 'running', phase: 'tasks', approvedAt: new Date().toISOString(), members: r.members.map(m => ({ ...m, role: r.plan!.roles.find(role => role.memberId === m.id)!.role })), tasks: r.plan!.tasks.map(t => ({ ...t, status: 'pending', turns: 0 })) }), 'approved', 'План и состав команды согласованы.');
    this.schedule(); return next;
  }
  control(id: string, action: 'pause' | 'resume' | 'cancel'): Run {
    const run = this.get(id);
    if (['completed', 'cancelled'].includes(run.status)) throw new InputError('Эта работа уже завершена.');
    if (action === 'resume') {
      if (run.status !== 'paused' && run.status !== 'failed') throw new InputError('Работа не приостановлена.');
      if ([...this.active.values()].some(a => a.runId === id)) throw new InputError('Ожидается остановка предыдущих вызовов. Повторите продолжение через несколько секунд.');
      this.ensureFree(id);
      if (run.turnCount >= 100) throw new InputError('Достигнут лимит 100 ходов. Создайте новую задачу с более узкой целью.');
      const next = this.change(id, r => ({ ...r, status: r.phase === 'plan' ? 'planning' : 'running', error: undefined, tasks: r.tasks.map(t => ['failed', 'running'].includes(t.status) ? { ...t, status: 'pending', error: undefined } : t), messages: r.messages.map(m => m.request && m.status === 'delivered' ? { ...m, status: 'queued' } : m) }), 'resumed', 'Работа продолжена.');
      this.schedule(); return next;
    }
    if (action !== 'pause' && action !== 'cancel') throw new InputError('Неизвестное действие.');
    const next = this.change(id, r => ({ ...r, status: action === 'cancel' ? 'cancelled' : 'paused' }), action, action === 'cancel' ? 'Работа отменена.' : 'Запрошена остановка текущих вызовов.');
    this.abort(id); return next;
  }
  message(id: string, body: string): Run {
    const run = this.get(id);
    if (typeof body !== 'string' || !body.trim() || body.length > 12000) throw new InputError('Сообщение должно содержать от 1 до 12000 символов.');
    if (['completed', 'cancelled'].includes(run.status)) throw new InputError('Работа уже завершена. Создайте новую задачу.');
    const replan = run.status === 'awaiting_approval';
    if (replan) this.ensureFree(id);
    const next = this.change(id, r => ({ ...r, ...(replan ? { status: 'planning' as const, phase: 'plan' as const, plan: undefined } : {}), messages: [...r.messages, { id: randomUUID(), fromId: 'user', toId: r.leaderId, body: body.trim(), request: false, status: 'queued', createdAt: new Date().toISOString() }] }), 'user_message', replan ? 'Замечания переданы руководителю. План пересматривается.' : 'Сообщение будет учтено в следующих ходах.');
    this.schedule(); return next;
  }
  shutdown(): void { this.stopped = true; for (const a of this.active.values()) a.controller.abort(); }
  private ensureFree(id: string): void {
    if (this.options.store.listRuns().some(r => r.id !== id && ['running', 'planning'].includes(r.status))) throw new InputError('Другая команда сейчас работает. Приостановите её.');
  }
  private abort(id: string): void { for (const a of this.active.values()) if (a.runId === id) a.controller.abort(); }
  private schedule(): void {
    if (this.scheduled || this.stopped) return;
    this.scheduled = true;
    setImmediate(() => { this.scheduled = false; if (!this.stopped) this.tick(); });
  }
  private tick(): void {
    for (const run of this.options.store.listRuns()) {
      if (!['planning', 'running'].includes(run.status)) continue;
      try {
        if (run.turnCount >= 100) {
          if ([...this.active.values()].some(a => a.runId === run.id)) continue;
          throw new Error('Достигнут лимит 100 ходов.');
        }
        this.dispatch(run);
      } catch (error) { this.fail(run.id, error); }
    }
  }
  private dispatch(run: Run): void {
    if (this.active.size >= 3) return;
    const busy = (memberId: string) => [...this.active.values()].some(a => a.runId === run.id && a.memberId === memberId);
    if (run.phase === 'plan') { if (!busy(run.leaderId)) this.launch(run, { memberId: run.leaderId, purpose: 'plan' }); return; }
    if (run.phase === 'tasks') {
      for (const request of run.messages.filter(m => m.request && m.status === 'queued')) {
        if (!busy(request.toId) && this.active.size < 3) this.launch(this.get(run.id), { memberId: request.toId, purpose: 'reply', requestId: request.id });
      }
      for (const task of this.get(run.id).tasks) {
        if (task.status !== 'pending' || busy(task.assigneeId) || this.active.size >= 3) continue;
        if (!task.dependsOn.every(dep => run.tasks.find(t => t.id === dep)?.status === 'completed')) continue;
        if (task.turns >= 20) throw new Error('Задача превысила лимит 20 ходов. Уточните цель.');
        this.launch(this.get(run.id), { memberId: task.assigneeId, purpose: 'task', taskId: task.id });
      }
      if ([...this.active.values()].some(a => a.runId === run.id)) return;
      const latest = this.get(run.id);
      if (latest.tasks.every(t => t.status === 'completed') && !latest.messages.some(m => m.request && m.status !== 'answered')) {
        const next = this.change(run.id, r => ({ ...r, phase: 'synthesize' }), 'synthesis', 'Руководитель собирает итог команды.');
        this.launch(next, { memberId: next.leaderId, purpose: 'synthesize' });
      } else throw new Error('Команда не может продолжить: остались заблокированные задачи.');
      return;
    }
    const memberId = run.phase === 'review' ? run.members.find(m => m.id !== run.leaderId)!.id : run.leaderId;
    if (!busy(memberId)) this.launch(run, { memberId, purpose: run.phase === 'review' ? 'review' : 'synthesize' });
  }
  private launch(run: Run, job: Job): void {
    if (this.get(run.id).turnCount >= 100) return;
    const key = `${run.id}:${job.memberId}`;
    const controller = new AbortController();
    this.active.set(key, { runId: run.id, memberId: job.memberId, controller });
    const snapshot = this.change(run.id, r => ({ ...r, turnCount: r.turnCount + 1, tasks: r.tasks.map(t => t.id === job.taskId ? { ...t, status: 'running', turns: t.turns + 1 } : t), messages: r.messages.map(m => m.id === job.requestId || (!m.request && m.toId === job.memberId && m.status === 'queued') ? { ...m, status: 'delivered' } : m) }), 'turn_started', `Начат ход: ${job.purpose}.`, job.memberId);
    void this.execute(snapshot, job, controller).catch(error => {
      if (!controller.signal.aborted && !this.stopped) this.fail(run.id, error);
    }).finally(() => { this.active.delete(key); this.schedule(); });
  }
  private async execute(snapshot: Run, job: Job, controller: AbortController): Promise<void> {
    const member = snapshot.members.find(m => m.id === job.memberId)!;
    const connection = this.options.connections.find(c => c.id === member.connectionId) ?? { id: 'demo', name: 'Демо', kind: 'demo' as const, available: true, detail: '' };
    const runner = snapshot.mode === 'demo' ? this.options.demoRunner ?? demoRunner : this.options.runner ?? runTurn;
    const result = await runner({ runId: snapshot.id, member, connection, purpose: job.purpose, prompt: promptFor({ run: snapshot, ...job }), cwd: join(this.options.workspaceRoot, snapshot.id), sessionId: snapshot.sessions[member.id], signal: controller.signal, onProgress: () => {} });
    if (controller.signal.aborted || this.stopped || !['planning', 'running'].includes(this.get(snapshot.id).status)) return;
    const current = this.get(snapshot.id);
    const userNotes = (run: Run) => run.messages.filter(m => m.fromId === 'user').length;
    if (['plan', 'synthesize', 'review'].includes(job.purpose) && userNotes(current) !== userNotes(snapshot)) {
      this.change(snapshot.id, run => ({ ...run, phase: job.purpose === 'plan' ? 'plan' : 'synthesize', sessions: result.sessionId ? { ...run.sessions, [member.id]: result.sessionId } : run.sessions }), 'superseded', 'Получены новые уточнения. Этап будет выполнен заново с актуальным контекстом.');
      return;
    }
    const plan = job.purpose === 'plan' ? parsePlan(result.text, snapshot.members.map(m => m.id)) : undefined;
    const answer = job.purpose !== 'plan' ? parseEnvelope(result.text, snapshot.members.map(m => m.id), member.id) : undefined;
    if (job.purpose === 'reply' && answer?.messages.length) throw new Error('Ответ на вопрос не должен создавать новые запросы.');
    if (['review', 'synthesize'].includes(job.purpose) && answer?.messages.length) throw new Error('На этапе итога и проверки верните результат без новых запросов.');
    this.change(snapshot.id, current => {
      const next = plan ? { ...current, plan, status: 'awaiting_approval' as const } : applyResult(current, job, answer!);
      return { ...next, sessions: result.sessionId ? { ...next.sessions, [member.id]: result.sessionId } : next.sessions };
    }, 'turn_completed', plan ? 'План готов к согласованию.' : answer!.summary.slice(0, 600), member.id);
  }
  private fail(id: string, error: unknown): void {
    this.change(id, r => ({ ...r, status: 'paused', error: redactError(error), tasks: r.tasks.map(t => t.status === 'running' ? { ...t, status: 'failed', error: 'Вызов прерван; потребуется повтор.' } : t) }), 'error', redactError(error));
    this.abort(id);
  }
}
