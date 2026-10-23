import { z } from 'zod';
import type { AgentEnvelope, CreateRunInput, TeamPlan } from '../../shared/types.ts';
import { parseJsonObject } from '../adapters/index.ts';

export class InputError extends Error { readonly statusCode = 400; }
/** The agent's answer could not be read or validated; asking the agent again may fix it. */
export class AnswerFormatError extends Error {}
function asAnswerFormat<T>(read: () => T): T {
  try { return read(); }
  catch (error) { throw error instanceof AnswerFormatError ? error : new AnswerFormatError(error instanceof Error ? error.message : String(error)); }
}

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const text = (max: number) => z.string().trim().min(1).max(max);
export const createSchema = z.object({
  goal: text(12000).min(10), mode: z.enum(['live', 'demo']), leaderId: id,
  members: z.array(z.object({ id, name: text(80), connectionId: id, model: z.string().max(120), role: z.string().max(500) })).min(2).max(5),
});
export function validateInput(value: unknown): CreateRunInput {
  const input = createSchema.parse(value);
  if (input.members.some(m => ['user', 'team', 'all', '__proto__', 'constructor', 'prototype'].includes(m.id))) throw new InputError('Выберите другой ID участника: этот ID зарезервирован.');
  if (new Set(input.members.map(m => m.id)).size !== input.members.length) throw new InputError('Участники должны иметь уникальные ID.');
  if (!input.members.some(m => m.id === input.leaderId)) throw new InputError('Выберите руководителя команды.');
  return input;
}
const planSchema = z.object({
  summary: text(4000), successCriteria: z.array(text(1000)).min(1).max(12),
  roles: z.array(z.object({ memberId: id, role: text(500) })).min(2).max(5),
  tasks: z.array(z.object({ id, title: text(200), description: text(4000), assigneeId: id, dependsOn: z.array(id).max(12) })).min(1).max(12),
});
export function parsePlan(raw: string, members: string[]): TeamPlan {
  return asAnswerFormat(() => readPlan(raw, members));
}
function readPlan(raw: string, members: string[]): TeamPlan {
  const plan = shaped(planSchema, parseJsonObject(raw));
  const ids = plan.tasks.map(t => t.id);
  if (new Set(ids).size !== ids.length) throw new Error('План содержит повторяющиеся задачи.');
  if (new Set(plan.roles.map(r => r.memberId)).size !== members.length || plan.roles.length !== members.length || plan.roles.some(r => !members.includes(r.memberId))) throw new Error('План должен назначить роль каждому участнику.');
  for (const task of plan.tasks) {
    if (!members.includes(task.assigneeId) || task.dependsOn.some(dep => !ids.includes(dep))) throw new Error('План ссылается на неизвестного участника или задачу.');
  }
  const completed = new Set<string>();
  const visit = (taskId: string, path: string[]): void => {
    if (path.includes(taskId)) throw new Error('План содержит цикл зависимостей.');
    if (completed.has(taskId)) return;
    const task = plan.tasks.find(t => t.id === taskId)!;
    if (new Set(task.dependsOn).size !== task.dependsOn.length) throw new Error('План содержит повторяющиеся зависимости.');
    task.dependsOn.forEach(dep => visit(dep, [...path, taskId]));
    completed.add(taskId);
  };
  ids.forEach(taskId => visit(taskId, []));
  return plan;
}
/** Models often send null for an omitted optional field; treat it as absent. */
const optional = <T extends z.ZodType>(schema: T) => schema.nullish().transform(value => value ?? undefined);
const envelopeSchema = z.object({
  summary: text(12000), status: z.enum(['done', 'working', 'waiting']),
  messages: z.array(z.object({ toId: id, body: text(12000), request: z.boolean(), replyTo: optional(id) })).max(8),
  artifact: optional(z.object({ title: text(200), body: text(80000) })),
  verdict: optional(z.enum(['pass', 'changes_requested'])),
});
/** Schema failures become one readable line instead of raw validator JSON. */
function shaped<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new Error(`Ответ агента не соответствует формату: ${result.error.issues.slice(0, 3).map(issue => `${issue.path.join('.') || 'ответ'} — ${issue.message}`).join('; ')}.`);
}
/** Splits "{...} trailing prose" at the end of the first top-level object; undefined if raw does not start with one. */
function leadingObject(raw: string): { json: string; rest: string } | undefined {
  const text = raw.trim();
  if (!text.startsWith('{')) return undefined;
  let depth = 0, inString = false, escaped = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (inString) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') inString = false; continue; }
    if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return { json: text.slice(0, index + 1), rest: text.slice(index + 1).trim() };
  }
  return undefined;
}
export function parseEnvelope(raw: string, memberIds: string[], senderId: string): AgentEnvelope {
  return asAnswerFormat(() => readEnvelope(raw, memberIds, senderId));
}
function readEnvelope(raw: string, memberIds: string[], senderId: string): AgentEnvelope {
  let value: unknown;
  try { value = parseJsonObject(raw); }
  catch (error) {
    // Agents sometimes put the details after their JSON; keep them in the summary rather than lose the answer.
    const lead = leadingObject(raw);
    if (!lead?.rest || lead.rest.startsWith('{')) throw error;
    const parsed = parseJsonObject(lead.json) as Record<string, unknown>;
    value = typeof parsed.summary === 'string' ? { ...parsed, summary: `${parsed.summary}\n\n${lead.rest}`.slice(0, 12000) } : parsed;
  }
  const result = shaped(envelopeSchema, value);
  if (result.messages.some(m => !memberIds.includes(m.toId) || m.toId === senderId)) throw new Error('Сообщение адресовано неизвестному участнику или самому себе.');
  return result;
}
