import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Run, TeamMessage, TurnPurpose } from '../../shared/types.ts';
import { findFact, mergeFacts, reworkStaleTasks } from './results.ts';

/** What a turn token grants: acting as one member, in one run, for the duration of one call. */
export interface TeamGrant { runId: string; memberId: string; purpose: TurnPurpose; taskId?: string; callId: string }
export class TeamToolError extends Error {}

const text = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
/** Strict schemas: no tool takes a sender, so a smuggled `fromId` or similar is rejected, not ignored. */
export const teamTools = {
  team_status: { leader: false, description: 'Задачи команды, их владельцы и статусы, доска общих фактов, твоя задача и руководитель.', schema: z.object({}).strict() },
  read_inbox: { leader: false, description: 'Сообщения тебе; непрочитанные заметки отмечаются переданными.', schema: z.object({}).strict() },
  send_message: { leader: false, description: 'Отправить сообщение участнику от твоего имени. request=true — вопрос по текущей задаче, ответ придёт отдельным ходом.', schema: z.object({ toId: id, body: text(4000), request: z.boolean().optional() }).strict() },
  publish_fact: { leader: false, description: 'Опубликовать или обновить общий факт. Менять факт может только его владелец (первый опубликовавший).', schema: z.object({ key: text(80), value: text(1000) }).strict() },
  report_blocked: { leader: false, description: 'Сообщить руководителю, что работа заблокирована, и почему.', schema: z.object({ reason: text(2000) }).strict() },
  add_task: { leader: true, description: 'Руководитель: добавить задачу на этапе задач.', schema: z.object({ title: text(200), description: text(4000), assigneeId: id, dependsOn: z.array(id).max(12).optional() }).strict() },
  assign_task: { leader: true, description: 'Руководитель: передать ещё не начатую задачу другому участнику.', schema: z.object({ taskId: id, assigneeId: id }).strict() },
} as const;
export type TeamToolName = keyof typeof teamTools;

export function teamToolNames(run: Run, grant: TeamGrant): TeamToolName[] {
  return (Object.keys(teamTools) as TeamToolName[]).filter(name => !teamTools[name].leader || run.leaderId === grant.memberId);
}

const fail = (message: string): never => { throw new TeamToolError(message); };
const memberName = (run: Run, memberId: string) => run.members.find(m => m.id === memberId)?.name ?? memberId;

/** Applies one tool call as the grant's member; every rule is checked here, not left to the prompt. */
export function runTeamTool(run: Run, grant: TeamGrant, name: string, args: unknown): { run: Run; result: unknown } {
  const live = run.id === grant.runId && ['running', 'planning'].includes(run.status)
    && !!run.inFlight?.some(c => c.id === grant.callId && c.memberId === grant.memberId);
  if (!live) fail('Доступ недействителен: ход завершён или работа остановлена.');
  if (!Object.hasOwn(teamTools, name)) fail(`Неизвестный инструмент: ${name}.`);
  const tool = teamTools[name as TeamToolName];
  if (tool.leader && run.leaderId !== grant.memberId) fail('Этот инструмент доступен только руководителю.');
  const parsed = tool.schema.safeParse(args ?? {});
  if (!parsed.success) fail(`Неверные аргументы: ${parsed.error.issues.map(i => i.message).join('; ')}`);
  const input = parsed.data as Record<string, unknown>;
  const createdAt = new Date().toISOString();
  const note = (toId: string, body: string, request = false): TeamMessage =>
    ({ id: randomUUID(), fromId: grant.memberId, toId, body, request, taskId: grant.taskId, status: 'queued', createdAt });
  const isMember = (memberId: string) => run.members.some(m => m.id === memberId);

  switch (name as TeamToolName) {
    case 'team_status':
      return { run, result: {
        you: grant.memberId, leaderId: run.leaderId, yourTaskId: grant.taskId ?? null, phase: run.phase,
        tasks: run.tasks.map(t => ({ id: t.id, title: t.title, assigneeId: t.assigneeId, status: t.status, dependsOn: t.dependsOn })),
        facts: (run.facts ?? []).map(f => ({ key: f.key, value: f.value, ownerId: f.ownerId, version: f.version })),
      } };
    case 'read_inbox': {
      const mine = run.messages.filter(m => m.toId === grant.memberId);
      return {
        run: { ...run, messages: run.messages.map(m => m.toId === grant.memberId && !m.request && m.status === 'queued' ? { ...m, status: 'delivered' as const } : m) },
        result: { messages: mine.map(m => ({ id: m.id, fromId: m.fromId, body: m.body, request: m.request, taskId: m.taskId ?? null, status: m.status })) },
      };
    }
    case 'send_message': {
      const { toId, body, request = false } = input as { toId: string; body: string; request?: boolean };
      if (toId === grant.memberId) fail('Нельзя отправить сообщение самому себе.');
      if (!isMember(toId)) fail(`Получатель неизвестен: ${toId}.`);
      if (request && (grant.purpose !== 'task' || !grant.taskId)) fail('Задать вопрос можно только во время работы над своей задачей.');
      const message = note(toId, body, request);
      return { run: { ...run, messages: [...run.messages, message] }, result: { messageId: message.id, status: 'queued' } };
    }
    case 'publish_fact': {
      const { key, value } = input as { key: string; value: string };
      const owned = findFact(run.facts, key);
      if (owned && owned.ownerId !== grant.memberId) fail(`Факт «${owned.key}» принадлежит ${memberName(run, owned.ownerId)}; спроси владельца.`);
      const facts = mergeFacts(run.facts ?? [], [{ key, value }], grant.memberId, createdAt);
      const next = reworkStaleTasks({ ...run, facts }, run.facts ?? [], { memberId: grant.memberId, purpose: grant.purpose, taskId: grant.taskId }, createdAt);
      const fact = findFact(next.facts, key)!;
      return { run: next, result: { key: fact.key, value: fact.value, version: fact.version } };
    }
    case 'report_blocked': {
      const message = note(run.leaderId === grant.memberId ? 'user' : run.leaderId, `Блокировка: ${(input as { reason: string }).reason}`);
      return { run: { ...run, messages: [...run.messages, message] }, result: { reported: true } };
    }
    case 'add_task': {
      const { title, description, assigneeId, dependsOn = [] } = input as { title: string; description: string; assigneeId: string; dependsOn?: string[] };
      if (run.phase !== 'tasks') fail('Добавлять задачи можно только на этапе задач.');
      if (!isMember(assigneeId)) fail(`Исполнитель неизвестен: ${assigneeId}.`);
      const unknown = dependsOn.filter(dep => !run.tasks.some(t => t.id === dep));
      if (unknown.length) fail(`Зависимости неизвестны: ${unknown.join(', ')}.`);
      if (new Set(dependsOn).size !== dependsOn.length) fail('Зависимости повторяются.');
      // A new task has no dependents yet, so it cannot close a cycle.
      let n = run.tasks.length + 1;
      while (run.tasks.some(t => t.id === `task-${n}`)) n += 1;
      const task = { id: `task-${n}`, title, description, assigneeId, dependsOn, status: 'pending' as const, turns: 0 };
      return { run: { ...run, tasks: [...run.tasks, task] }, result: { taskId: task.id } };
    }
    case 'assign_task': {
      const { taskId, assigneeId } = input as { taskId: string; assigneeId: string };
      const task = run.tasks.find(t => t.id === taskId) ?? fail(`Задача неизвестна: ${taskId}.`);
      if (task.status !== 'pending' || task.turns > 0) fail('Передать можно только задачу, которая ещё не начата.');
      if (!isMember(assigneeId)) fail(`Исполнитель неизвестен: ${assigneeId}.`);
      return { run: { ...run, tasks: run.tasks.map(t => t.id === taskId ? { ...t, assigneeId } : t) }, result: { taskId, assigneeId } };
    }
  }
}
