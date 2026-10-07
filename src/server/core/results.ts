import { randomUUID } from 'node:crypto';
import type { AgentEnvelope, Artifact, Run, TeamMessage, TurnPurpose } from '../../shared/types.ts';
export interface Job { memberId: string; purpose: TurnPurpose; taskId?: string; requestId?: string }
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
      const waiting = openQuestion(job.memberId, t.id);
      if (answer.status === 'waiting' && !waiting) throw new Error('Агент ждёт ответа, но не задал вопрос. Уточните задачу и продолжите.');
      return { ...t, status: waiting ? 'waiting' as const : answer.status === 'done' ? 'completed' as const : 'pending' as const, output: answer.artifact?.body ?? answer.summary };
    }
    if (t.status === 'waiting' && !openQuestion(t.assigneeId, t.id)) return { ...t, status: 'pending' as const };
    return t;
  });
  const artifact: Artifact | undefined = answer.artifact ? { ...answer.artifact, id: randomUUID(), authorId: job.memberId, taskId: job.taskId, createdAt, kind: job.purpose === 'synthesize' ? 'final' : job.purpose === 'review' ? 'review' : 'work' } : undefined;
  let next: Run = { ...run, messages, tasks, artifacts: artifact ? [...run.artifacts, artifact] : run.artifacts };
  if (job.purpose === 'synthesize') {
    if (!artifact) throw new Error('Руководитель не приложил итоговый материал.');
    next = { ...next, phase: 'review' };
  }
  if (job.purpose === 'review') {
    if (!answer.verdict || !artifact) throw new Error('Проверяющий не вернул заключение и аргументы.');
    const reviewRound = run.reviewRound + 1;
    next = answer.verdict === 'pass'
      ? { ...next, reviewRound, phase: 'done', status: 'completed' }
      : { ...next, reviewRound, phase: 'synthesize', ...(reviewRound >= 3 ? { status: 'paused' as const, error: 'После трёх проверок остались замечания. Уточните задачу перед продолжением.' } : {}) };
  }
  return next;
}
