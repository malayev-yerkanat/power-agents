import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Connection, InFlightCall, Run, TeamTask, TurnPurpose, TurnRunner } from '../shared/types.ts';
import { Store } from './store.ts';
import { runTurn } from './adapters/index.ts';
import { redactError } from './adapters/common.ts';
import { demoRunner } from './core/demo.ts';
import { AnswerFormatError, InputError, validateInput, parseEnvelope, parsePlan } from './core/protocol.ts';
import { promptFor } from './core/prompts.ts';
import { applyResult, findFact, type Job } from './core/results.ts';
import { listFiles, taskFolder } from './files.ts';
const finished = (run: Run, callId: string): Run => ({ ...run, inFlight: run.inFlight?.filter(c => c.id !== callId) });
const callNames: Record<TurnPurpose, string> = { plan: 'план', task: 'задача', reply: 'ответ коллеге', synthesize: 'сборка итога', review: 'проверка' };
function callLabel(run: Run, call: InFlightCall): string {
  const task = run.tasks.find(t => t.id === call.taskId);
  return `${run.members.find(m => m.id === call.memberId)?.name ?? call.memberId} — ${callNames[call.purpose]}${task && call.purpose === 'task' ? ` «${task.title}»` : ''}`;
}
/** A task returning to work waits if its own question is still open. */
const retry = (run: Run, task: TeamTask): TeamTask => ({ ...task, status: run.messages.some(m => m.request && m.fromId === task.assigneeId && m.taskId === task.id && m.status !== 'answered') ? 'waiting' : 'pending', error: undefined });
/** Reads an agent's answer for its turn; every rejection is an AnswerFormatError so the turn can be retried. */
function read(job: Job, text: string, snapshot: Run, memberId: string) {
  const ids = snapshot.members.map(m => m.id);
  if (job.purpose === 'plan') return { plan: parsePlan(text, ids), answer: undefined };
  const parsed = parseEnvelope(text, ids, memberId);
  // A reply keeps its answer even if it also asks something; the extra questions travel as notes.
  const answer = job.purpose === 'reply' ? { ...parsed, messages: parsed.messages.map(m => ({ ...m, request: false })) } : parsed;
  if (['review', 'synthesize'].includes(job.purpose) && answer.messages.length) throw new AnswerFormatError('На этапе итога и проверки верните результат без новых запросов.');
  if (answer.revisions?.some(r => !snapshot.tasks.some(t => t.id === r.taskId))) throw new AnswerFormatError('Замечания проверки ссылаются на неизвестную задачу. Используй id задач из плана.');
  for (const fact of answer.facts ?? []) {
    const owned = findFact(snapshot.facts, fact.key);
    if (owned && owned.ownerId !== memberId) {
      throw new AnswerFormatError(`Факт «${fact.key.trim()}» принадлежит ${snapshot.members.find(m => m.id === owned.ownerId)?.name ?? owned.ownerId}; не меняй его, а спроси владельца.`);
    }
  }
  return { plan: undefined, answer };
}
interface Options { store: Store; connections: Connection[]; workspaceRoot: string; runner?: TurnRunner; demoRunner?: TurnRunner }
export class Engine {
  private readonly options: Options;
  private readonly active = new Map<string, { runId: string; memberId: string; controller: AbortController }>();
  private scheduled = false;
  private stopped = false;
  constructor(options: Options) {
    this.options = options;
    for (const run of options.store.listActiveRuns()) {
      if (run.status !== 'planning' && run.status !== 'running') continue;
      const interrupted = run.inFlight ?? [];
      const error = interrupted.length
        ? `Сервер перезапущен во время вызовов. Исход неизвестен: ${interrupted.map(c => callLabel(run, c)).join('; ')}. «Продолжить» повторит их только после подтверждения.`
        : 'Сервер перезапущен. Последний вызов мог завершиться у провайдера. Продолжение повторит незавершённую работу.';
      this.change(run.id, r => ({ ...r, status: 'paused', error, inFlight: [], ...(interrupted.length ? { interrupted } : {}),
        tasks: r.tasks.map(t => interrupted.some(c => c.taskId === t.id && c.purpose === 'task')
          ? { ...t, status: 'failed', error: 'Сервер перезапущен во время вызова: исход неизвестен.' } : t.status === 'running' ? retry(r, t) : t),
        messages: r.messages.map(m => m.request && m.status === 'delivered' ? { ...m, status: 'queued' } : m) }), 'recovered', 'Работа приостановлена после перезапуска.');
    }
  }
  get(id: string): Run { const run = this.options.store.getRun(id); if (!run) throw new InputError('Команда не найдена.'); return run; }
  private change(id: string, update: (run: Run) => Run, type: string, message: string, actorId?: string): Run {
    return this.options.store.updateRun(id, update, { type, message, actorId });
  }
  create(value: unknown): Run {
    const input = validateInput(value);
    if (this.options.store.hasActiveRun()) throw new InputError('Сначала приостановите текущую команду.');
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
  control(id: string, action: 'pause' | 'resume' | 'cancel', confirmRepeat = false): Run {
    const run = this.get(id);
    if (['completed', 'cancelled'].includes(run.status)) throw new InputError('Эта работа уже завершена.');
    if (action === 'resume') {
      if (run.status !== 'paused' && run.status !== 'failed') throw new InputError('Работа не приостановлена.');
      if ([...this.active.values()].some(a => a.runId === id)) throw new InputError('Ожидается остановка предыдущих вызовов. Повторите продолжение через несколько секунд.');
      this.ensureFree(id);
      if (run.turnCount >= 100) throw new InputError('Достигнут лимит 100 ходов. Создайте новую задачу с более узкой целью.');
      if (run.interrupted?.length && !confirmRepeat) throw new InputError(`Подтвердите повтор вызовов с неизвестным исходом: ${run.interrupted.map(c => callLabel(run, c)).join('; ')}.`);
      const next = this.change(id, r => ({ ...r, status: r.phase === 'plan' ? 'planning' : 'running', error: undefined, interrupted: undefined, tasks: r.tasks.map(t => ['failed', 'running'].includes(t.status) ? retry(r, t) : t), messages: r.messages.map(m => m.request && m.status === 'delivered' ? { ...m, status: 'queued' } : m) }), 'resumed', 'Работа продолжена.');
      this.schedule(); return next;
    }
    if (action !== 'pause' && action !== 'cancel') throw new InputError('Неизвестное действие.');
    const next = this.change(id, r => ({ ...r, status: action === 'cancel' ? 'cancelled' : 'paused', inFlight: [] }), action, action === 'cancel' ? 'Работа отменена.' : 'Запрошена остановка текущих вызовов.');
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
    if (this.options.store.hasActiveRun(id)) throw new InputError('Другая команда сейчас работает. Приостановите её.');
  }
  private abort(id: string): void { for (const a of this.active.values()) if (a.runId === id) a.controller.abort(); }
  private schedule(): void {
    if (this.scheduled || this.stopped) return;
    this.scheduled = true;
    setImmediate(() => { this.scheduled = false; if (!this.stopped) this.tick(); });
  }
  private tick(): void {
    for (const run of this.options.store.listActiveRuns()) {
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
      // An owner still waiting on its own answers would reply with guesses, so its replies wait too.
      const awaitingInputs = (memberId: string) => this.get(run.id).messages.some(m => m.request && m.fromId === memberId && m.status !== 'answered');
      for (const request of run.messages.filter(m => m.request && m.status === 'queued')) {
        if (!busy(request.toId) && this.active.size < 3 && !awaitingInputs(request.toId)) this.launch(this.get(run.id), { memberId: request.toId, purpose: 'reply', requestId: request.id });
      }
      for (const task of this.get(run.id).tasks) {
        if (task.status !== 'pending' || busy(task.assigneeId) || this.active.size >= 3) continue;
        if (!task.dependsOn.every(dep => run.tasks.find(t => t.id === dep)?.status === 'completed')) continue;
        if (task.turns >= 20) throw new Error('Задача превысила лимит 20 ходов. Уточните цель.');
        this.launch(this.get(run.id), { memberId: task.assigneeId, purpose: 'task', taskId: task.id });
      }
      if ([...this.active.values()].some(a => a.runId === run.id)) return;
      let latest = this.get(run.id);
      // A task waiting for colleagues who have all stopped would wait forever, so it fails and «Продолжить» retries it.
      const stranded = latest.tasks.filter(t => t.status === 'waiting' && !latest.messages.some(m => m.request && m.fromId === t.assigneeId && m.taskId === t.id && m.status !== 'answered'));
      if (stranded.length && !latest.messages.some(m => m.request && m.status === 'queued')) {
        latest = this.change(run.id, r => ({ ...r, tasks: r.tasks.map(t => stranded.some(s => s.id === t.id)
          ? { ...t, status: 'failed' as const, error: 'Агент ждёт ответа, но не задал вопрос, а коллеги уже закончили. Уточните задачу и продолжите.' } : t) }), 'error', 'Задача ждала коллег, которые уже закончили.');
      }
      // Owners asking each other would wait forever; with nothing else running or failed, the oldest held question goes through.
      const held = !latest.tasks.some(t => t.status === 'failed') && latest.messages.find(m => m.request && m.status === 'queued');
      if (held) { this.launch(latest, { memberId: held.toId, purpose: 'reply', requestId: held.id }); return; }
      if (latest.tasks.every(t => t.status === 'completed') && !latest.messages.some(m => m.request && m.status !== 'answered')) {
        const next = this.change(run.id, r => ({ ...r, phase: 'synthesize' }), 'synthesis', 'Руководитель собирает итог команды.');
        this.launch(next, { memberId: next.leaderId, purpose: 'synthesize' });
      } else {
        const failed = latest.tasks.filter(t => t.status === 'failed');
        throw new Error(failed.length
          ? `Не выполнены задачи: ${failed.map(t => `«${t.title}» — ${t.error?.replace(/\.$/, '')}`).join('; ')}. Готовые результаты сохранены; «Продолжить» повторит только эти задачи.`
          : 'Команда не может продолжить: остались заблокированные задачи.');
      }
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
    const call: InFlightCall = { id: randomUUID(), memberId: job.memberId, purpose: job.purpose, taskId: job.taskId, requestId: job.requestId, startedAt: new Date().toISOString() };
    const snapshot = this.change(run.id, r => ({ ...r, inFlight: [...(r.inFlight ?? []), call], turnCount: r.turnCount + 1, tasks: r.tasks.map(t => t.id === job.taskId ? { ...t, status: 'running', turns: t.turns + 1 } : t), messages: r.messages.map(m => m.id === job.requestId || (!m.request && m.toId === job.memberId && m.status === 'queued') ? { ...m, status: 'delivered' } : m) }), 'turn_started', `Начат ход: ${job.purpose}.`, job.memberId);
    void this.execute(snapshot, job, controller, call.id).catch(error => {
      if (!controller.signal.aborted && !this.stopped) this.failTurn(run.id, job, error, call.id);
    }).finally(() => { this.active.delete(key); this.schedule(); });
  }
  private async execute(snapshot: Run, job: Job, controller: AbortController, callId: string): Promise<void> {
    const member = snapshot.members.find(m => m.id === job.memberId)!;
    const connection = this.options.connections.find(c => c.id === member.connectionId) ?? { id: 'demo', name: 'Демо', kind: 'demo' as const, available: true, detail: '' };
    const runner = snapshot.mode === 'demo' ? this.options.demoRunner ?? demoRunner : this.options.runner ?? runTurn;
    const runDir = join(this.options.workspaceRoot, snapshot.id);
    const folders = this.folders(snapshot, job, runDir, connection.kind === 'demo' || connection.kind.endsWith('-cli'));
    // CLIs keep conversations per working folder, so a task folder has its own conversation.
    const sessionKey = folders.own && connection.kind.endsWith('-cli') ? `${member.id}#${job.taskId}` : member.id;
    const input = { runId: snapshot.id, member, connection, purpose: job.purpose, prompt: promptFor({ run: snapshot, ...job, folders }), cwd: folders.own ?? runDir, writable: !!folders.own, readDirs: folders.read, sessionId: Object.hasOwn(snapshot.sessions, sessionKey) ? snapshot.sessions[sessionKey] : undefined, signal: controller.signal, onProgress: () => {} };
    const stale = () => controller.signal.aborted || this.stopped || !['planning', 'running'].includes(this.get(snapshot.id).status);
    let result = await runner(input);
    if (stale()) return;
    const current = this.get(snapshot.id);
    const userNotes = (run: Run) => run.messages.filter(m => m.fromId === 'user').length;
    if (['plan', 'synthesize', 'review'].includes(job.purpose) && userNotes(current) !== userNotes(snapshot)) {
      this.change(snapshot.id, run => ({ ...finished(run, callId), phase: job.purpose === 'plan' ? 'plan' : 'synthesize', sessions: result.sessionId ? { ...run.sessions, [sessionKey]: result.sessionId } : run.sessions }), 'superseded', 'Получены новые уточнения. Этап будет выполнен заново с актуальным контекстом.');
      return;
    }
    let reading: ReturnType<typeof read>;
    try { reading = read(job, result.text, snapshot, member.id); }
    catch (error) {
      if (!(error instanceof AnswerFormatError)) throw error;
      // One retry in the same session, with the reason, fixes most malformed answers without pausing the team.
      const firstSession = result.sessionId;
      this.change(snapshot.id, r => ({ ...r, turnCount: r.turnCount + 1, sessions: firstSession ? { ...r.sessions, [sessionKey]: firstSession } : r.sessions }), 'format_retry', `Ответ не принят, запрошен повтор: ${error.message}`.slice(0, 600), member.id);
      result = await runner({ ...input, sessionId: firstSession ?? input.sessionId, prompt: input.prompt.replace('\nCONTEXT:\n', `\nТвой предыдущий ответ не принят: ${error.message} Верни заново полный ответ одним JSON-объектом строго по схеме, без текста до или после него.\nCONTEXT:\n`) });
      if (stale()) return;
      reading = read(job, result.text, snapshot, member.id);
    }
    const { plan, answer } = reading;
    this.change(snapshot.id, current => {
      const applied = plan ? { ...current, plan, status: 'awaiting_approval' as const } : applyResult(current, job, answer!);
      const added = applied.artifacts.length > current.artifacts.length ? applied.artifacts.at(-1) : undefined;
      const listing = folders.own && added?.taskId === job.taskId ? listFiles(folders.own) : undefined;
      const next = finished(listing && (listing.files.length || listing.omitted)
        ? { ...applied, artifacts: [...applied.artifacts.slice(0, -1), { ...added!, files: listing.files, ...(listing.omitted ? { omittedFiles: listing.omitted } : {}) }] } : applied, callId);
      return { ...next, sessions: result.sessionId ? { ...next.sessions, [sessionKey]: result.sessionId } : next.sessions };
    }, 'turn_completed', plan ? 'План готов к согласованию.' : answer!.summary.slice(0, 600), member.id);
  }
  /** A task writes only in its own folder; dependents, replies, the combine step and the review read the folders they need. */
  private folders(run: Run, job: Job, runDir: string, canWrite: boolean): { own?: string; read?: string[] } {
    const existing = (ids: string[]) => { const dirs = ids.map(id => taskFolder(runDir, id)).filter(dir => existsSync(dir)); return dirs.length ? dirs : undefined; };
    if (job.purpose === 'task' && job.taskId) {
      const task = run.tasks.find(t => t.id === job.taskId)!;
      const own = canWrite ? taskFolder(runDir, job.taskId) : undefined;
      if (own) mkdirSync(own, { recursive: true });
      return { own, read: existing(task.dependsOn) };
    }
    if (job.purpose === 'reply') return { read: existing(run.tasks.filter(t => t.assigneeId === job.memberId).map(t => t.id)) };
    if (job.purpose === 'synthesize' || job.purpose === 'review') return { read: existing(run.tasks.map(t => t.id)) };
    return {};
  }
  /** Task and reply failures stay with their task so other participants keep working. */
  private failTurn(id: string, job: Job, error: unknown, callId: string): void {
    const run = this.get(id);
    const taskId = job.purpose === 'task' ? job.taskId : job.purpose === 'reply' ? run.messages.find(m => m.id === job.requestId)?.taskId : undefined;
    if (!taskId || run.status !== 'running') { this.fail(id, error, job.memberId); return; }
    const message = this.named(run, job.memberId, error);
    this.change(id, r => ({ ...finished(r, callId), tasks: r.tasks.map(t => t.id === taskId ? { ...t, status: 'failed', error: message } : t) }), 'error', message, job.memberId);
  }
  private named(run: Run, memberId: string | undefined, error: unknown): string {
    const name = memberId && run.members.find(m => m.id === memberId)?.name;
    return name ? `${name}: ${redactError(error)}` : redactError(error);
  }
  private fail(id: string, error: unknown, memberId?: string): void {
    const message = this.named(this.get(id), memberId, error);
    this.change(id, r => ({ ...r, status: 'paused', error: message, inFlight: [], tasks: r.tasks.map(t => t.status === 'running' ? { ...t, status: 'failed', error: 'Вызов прерван; потребуется повтор.' } : t) }), 'error', message, memberId);
    this.abort(id);
  }
}
