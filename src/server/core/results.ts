import { randomUUID } from 'node:crypto';
import type { AgentEnvelope, Artifact, Run, SharedFact, TeamMessage, TurnPurpose } from '../../shared/types.ts';
export interface Job { memberId: string; purpose: TurnPurpose; taskId?: string; requestId?: string }
/** Facts are matched by key regardless of case and surrounding spaces. */
export const findFact = (facts: SharedFact[] | undefined, key: string) => facts?.find(f => f.key.trim().toLowerCase() === key.trim().toLowerCase());
/** The first publisher owns a fact; only the owner's later values replace it, raising its version. */
function mergeFacts(facts: SharedFact[], published: AgentEnvelope['facts'], ownerId: string, updatedAt: string): SharedFact[] {
  return (published ?? []).reduce((board, { key, value }) => {
    const existing = findFact(board, key);
    if (!existing) return [...board, { key: key.trim(), value, ownerId, version: 1, updatedAt }];
    if (existing.ownerId !== ownerId || existing.value === value) return board;
    return board.map(f => f === existing ? { ...f, value, version: f.version + 1, updatedAt } : f);
  }, facts);
}
/** A newer version of a fact reopens finished tasks that relied on an older one, so their results follow the change. */
function reworkStaleTasks(run: Run, before: SharedFact[], job: Job, createdAt: string): Run {
  const changed = (run.facts ?? []).flatMap(fact => {
    const old = findFact(before, fact.key);
    return old && old.version < fact.version ? [{ fact, old }] : [];
  });
  if (!changed.length || run.phase !== 'tasks') return run;
  const notes: TeamMessage[] = [];
  const tasks = run.tasks.map(t => {
    if (t.status !== 'completed' || t.id === job.taskId || t.assigneeId === job.memberId) return t;
    const stale = changed.filter(({ fact }) => (t.usedFacts?.[fact.key] ?? fact.version) < fact.version);
    if (!stale.length) return t;
    notes.push({ id: randomUUID(), fromId: job.memberId, toId: t.assigneeId, taskId: t.id, request: false, status: 'queued', createdAt,
      body: `${stale.map(({ fact, old }) => `Факт «${fact.key}» изменён: «${old.value}» → «${fact.value}».`).join(' ')} Обнови результат задачи под новое значение.` });
    return { ...t, status: 'pending' as const };
  });
  return { ...run, tasks, messages: [...run.messages, ...notes] };
}
export function applyResult(run: Run, job: Job, answer: AgentEnvelope): Run {
  const createdAt = new Date().toISOString();
  const outgoing: TeamMessage[] = answer.messages.map(m => ({ ...m, replyTo: undefined, id: randomUUID(), fromId: job.memberId, taskId: job.taskId, status: 'queued', createdAt }));
  const request = run.messages.find(m => m.id === job.requestId);
  if (job.purpose === 'reply' && request) {
    outgoing.push({ id: randomUUID(), fromId: job.memberId, toId: request.fromId, body: answer.artifact?.body ?? answer.summary, replyTo: request.id, taskId: request.taskId, request: false, status: 'queued', createdAt });
  }
  const messages = [...run.messages.map(m => m.id === job.requestId ? { ...m, status: 'answered' as const } : m), ...outgoing];
  const openQuestion = (memberId: string, taskId: string) => messages.some(m => m.fromId === memberId && m.taskId === taskId && m.request && m.status !== 'answered');
  const tasks = run.tasks.map(t => {
    if (t.id === job.taskId && job.purpose === 'task') {
      // Waiting without a question is fine while a colleague is still working: their note or finished task wakes it.
      const colleagueWorking = run.tasks.some(o => o.id !== t.id && o.status !== 'completed' && o.status !== 'failed');
      const waiting = openQuestion(job.memberId, t.id) || (answer.status === 'waiting' && colleagueWorking);
      if (answer.status === 'waiting' && !waiting) throw new Error('Агент ждёт ответа, но не задал вопрос. Уточните задачу и продолжите.');
      return { ...t, status: waiting ? 'waiting' as const : answer.status === 'done' ? 'completed' as const : 'pending' as const, output: answer.artifact?.body ?? answer.summary };
    }
    const woken = outgoing.some(m => m.toId === t.assigneeId) || (job.purpose === 'task' && answer.status === 'done');
    if (t.status === 'waiting' && !openQuestion(t.assigneeId, t.id) && woken) return { ...t, status: 'pending' as const };
    return t;
  });
  const artifact: Artifact | undefined = answer.artifact ? { ...answer.artifact, id: randomUUID(), authorId: job.memberId, taskId: job.taskId, createdAt, kind: job.purpose === 'synthesize' ? 'final' : job.purpose === 'review' ? 'review' : 'work' } : undefined;
  const facts = mergeFacts(run.facts ?? [], answer.facts, job.memberId, createdAt);
  const used = job.purpose === 'task' && answer.usesFacts
    ? Object.fromEntries(answer.usesFacts.flatMap(key => { const fact = findFact(facts, key); return fact ? [[fact.key, fact.version]] : []; })) : undefined;
  const withUse = used ? tasks.map(t => t.id === job.taskId ? { ...t, usedFacts: used } : t) : tasks;
  let next: Run = reworkStaleTasks({ ...run, messages, tasks: withUse, facts, artifacts: artifact ? [...run.artifacts, artifact] : run.artifacts }, run.facts ?? [], job, createdAt);
  if (job.purpose === 'synthesize') {
    if (!artifact) throw new Error('Руководитель не приложил итоговый материал.');
    next = { ...next, phase: 'review' };
  }
  if (job.purpose === 'review') {
    if (!answer.verdict || !artifact) throw new Error('Проверяющий не вернул заключение и аргументы.');
    const reviewRound = run.reviewRound + 1;
    const revisions = answer.verdict === 'changes_requested' ? answer.revisions ?? [] : [];
    // Remarks on specific tasks go back to their owners; the leader re-synthesizes once those tasks are done again.
    if (revisions.length) next = { ...next,
      tasks: next.tasks.map(t => revisions.some(r => r.taskId === t.id) ? { ...t, status: 'pending' as const, error: undefined } : t),
      messages: [...next.messages, ...revisions.map(r => ({ id: randomUUID(), fromId: job.memberId, toId: run.tasks.find(t => t.id === r.taskId)!.assigneeId, body: `Замечание проверки, раунд ${reviewRound}: ${r.remark}`, taskId: r.taskId, request: false, status: 'queued' as const, createdAt }))] };
    next = answer.verdict === 'pass'
      ? { ...next, reviewRound, phase: 'done', status: 'completed' }
      : { ...next, reviewRound, phase: revisions.length ? 'tasks' : 'synthesize', ...(reviewRound >= 3 ? { status: 'paused' as const, error: 'После трёх проверок остались замечания. Уточните задачу перед продолжением.' } : {}) };
  }
  return next;
}
