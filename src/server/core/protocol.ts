import { z } from 'zod';
import type { AgentEnvelope, CreateRunInput, TeamPlan } from '../../shared/types.ts';
import { parseJsonObject } from '../adapters/index.ts';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const text = (max: number) => z.string().trim().min(1).max(max);
export const createSchema = z.object({
  goal: text(12000).min(10), mode: z.enum(['live', 'demo']), leaderId: id,
  members: z.array(z.object({ id, name: text(80), connectionId: id, model: z.string().max(120), role: z.string().max(500) })).min(2).max(5),
});
export function validateInput(value: unknown): CreateRunInput {
  const input = createSchema.parse(value);
  if (new Set(input.members.map(m => m.id)).size !== input.members.length) throw new Error('Участники должны иметь уникальные ID.');
  if (!input.members.some(m => m.id === input.leaderId)) throw new Error('Выберите руководителя команды.');
  return input;
}
const planSchema = z.object({
  summary: text(4000), successCriteria: z.array(text(1000)).min(1).max(12),
  roles: z.array(z.object({ memberId: id, role: text(500) })).min(2).max(5),
  tasks: z.array(z.object({ id, title: text(200), description: text(4000), assigneeId: id, dependsOn: z.array(id).max(12) })).min(1).max(12),
});
export function parsePlan(raw: string, members: string[]): TeamPlan {
  const plan = planSchema.parse(parseJsonObject(raw));
  const ids = plan.tasks.map(t => t.id);
  if (new Set(ids).size !== ids.length) throw new Error('План содержит повторяющиеся задачи.');
  if (new Set(plan.roles.map(r => r.memberId)).size !== members.length || plan.roles.length !== members.length || plan.roles.some(r => !members.includes(r.memberId))) throw new Error('План должен назначить роль каждому участнику.');
  for (const task of plan.tasks) {
    if (!members.includes(task.assigneeId) || task.dependsOn.some(dep => !ids.includes(dep))) throw new Error('План ссылается на неизвестного участника или задачу.');
  }
  const visit = (taskId: string, path: string[]): void => {
    if (path.includes(taskId)) throw new Error('План содержит цикл зависимостей.');
    plan.tasks.find(t => t.id === taskId)!.dependsOn.forEach(dep => visit(dep, [...path, taskId]));
  };
  ids.forEach(taskId => visit(taskId, []));
  return plan;
}
const envelopeSchema = z.object({
  summary: text(12000), status: z.enum(['done', 'working', 'waiting']),
  messages: z.array(z.object({ toId: id, body: text(12000), request: z.boolean(), replyTo: id.optional() })).max(8),
  artifact: z.object({ title: text(200), body: text(80000) }).optional(),
  verdict: z.enum(['pass', 'changes_requested']).optional(),
});
export function parseEnvelope(raw: string, memberIds: string[], senderId: string): AgentEnvelope {
  const result = envelopeSchema.parse(parseJsonObject(raw));
  if (result.messages.some(m => !memberIds.includes(m.toId) || m.toId === senderId)) throw new Error('Сообщение адресовано неизвестному участнику или самому себе.');
  return result;
}
