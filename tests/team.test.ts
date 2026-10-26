import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runTeamTool, teamToolNames, type TeamGrant } from '../src/server/core/team.ts';
import type { Run } from '../src/shared/types.ts';

const now = '2026-10-26T00:00:00.000Z';
function run(fields: Partial<Run> = {}): Run {
  return {
    id: 'run-1', title: 'Run', goal: 'Goal for the team', status: 'running', phase: 'tasks', mode: 'demo', leaderId: 'lead',
    members: [
      { id: 'lead', name: 'Lead', connectionId: 'c', model: '', role: 'Lead' },
      { id: 'dev', name: 'Dev', connectionId: 'c', model: '', role: 'Dev' },
    ],
    tasks: [
      { id: 't1', title: 'Price', description: 'Owns the price', assigneeId: 'lead', dependsOn: [], status: 'running', turns: 1 },
      { id: 't2', title: 'Promo', description: 'Uses the price', assigneeId: 'dev', dependsOn: [], status: 'completed', turns: 1, usedFacts: { Цена: 1 } },
      { id: 't3', title: 'Later', description: 'Not started', assigneeId: 'dev', dependsOn: [], status: 'pending', turns: 0 },
    ],
    messages: [
      { id: 'm1', fromId: 'lead', toId: 'dev', body: 'Note for dev', request: false, status: 'queued', createdAt: now },
      { id: 'm2', fromId: 'dev', toId: 'lead', body: 'Note for lead', request: false, status: 'queued', createdAt: now },
    ],
    facts: [{ key: 'Цена', value: '1 200 ₸', ownerId: 'lead', version: 1, updatedAt: now }],
    artifacts: [], sessions: {}, turnCount: 3, reviewRound: 0, createdAt: now, updatedAt: now, version: 1,
    inFlight: [{ id: 'call-lead', memberId: 'lead', purpose: 'task', taskId: 't1', startedAt: now }, { id: 'call-dev', memberId: 'dev', purpose: 'reply', startedAt: now }],
    ...fields,
  };
}
const lead: TeamGrant = { runId: 'run-1', memberId: 'lead', purpose: 'task', taskId: 't1', callId: 'call-lead' };
const dev: TeamGrant = { runId: 'run-1', memberId: 'dev', purpose: 'reply', callId: 'call-dev' };

test('only the leader sees and may use the leader tools', () => {
  assert.deepEqual(teamToolNames(run(), lead), ['team_status', 'read_inbox', 'send_message', 'publish_fact', 'report_blocked', 'add_task', 'assign_task']);
  assert.deepEqual(teamToolNames(run(), dev), ['team_status', 'read_inbox', 'send_message', 'publish_fact', 'report_blocked']);
  assert.throws(() => runTeamTool(run(), dev, 'add_task', { title: 'X', description: 'Y', assigneeId: 'dev' }), /только руководителю/);
  assert.throws(() => runTeamTool(run(), dev, 'assign_task', { taskId: 't3', assigneeId: 'lead' }), /только руководителю/);
});

test('status shows the board as the caller, and the inbox delivers only the caller\'s notes', () => {
  const status = runTeamTool(run(), dev, 'team_status', {}).result as { you: string; leaderId: string; tasks: unknown[]; facts: unknown[] };
  assert.equal(status.you, 'dev');
  assert.equal(status.leaderId, 'lead');
  assert.equal(status.tasks.length, 3);
  const { run: next, result } = runTeamTool(run(), dev, 'read_inbox', {});
  assert.deepEqual((result as { messages: { id: string }[] }).messages.map(m => m.id), ['m1']);
  assert.equal(next.messages.find(m => m.id === 'm1')!.status, 'delivered');
  assert.equal(next.messages.find(m => m.id === 'm2')!.status, 'queued', 'someone else\'s mail stays untouched');
});

test('messages are always sent as the token\'s member; a smuggled sender is rejected', () => {
  const { run: next } = runTeamTool(run(), dev, 'send_message', { toId: 'lead', body: 'Price final?', request: false });
  const sent = next.messages.at(-1)!;
  assert.deepEqual([sent.fromId, sent.toId, sent.status], ['dev', 'lead', 'queued']);
  assert.throws(() => runTeamTool(run(), dev, 'send_message', { toId: 'lead', body: 'Hi', fromId: 'lead' }), /fromId|Unrecognized/i);
  assert.throws(() => runTeamTool(run(), dev, 'send_message', { toId: 'dev', body: 'Self' }), /себе/);
  assert.throws(() => runTeamTool(run(), dev, 'send_message', { toId: 'ghost', body: 'Hi' }), /неизвест/);
  assert.throws(() => runTeamTool(run(), dev, 'send_message', { toId: 'lead', body: 'Q?', request: true }), /вопрос.*задач/);
  const asked = runTeamTool(run(), lead, 'send_message', { toId: 'dev', body: 'Q?', request: true }).run.messages.at(-1)!;
  assert.deepEqual([asked.request, asked.taskId], [true, 't1']);
});

test('facts keep their owner: others cannot change them; the owner\'s change reopens tasks that used it', () => {
  assert.throws(() => runTeamTool(run(), dev, 'publish_fact', { key: ' цена ', value: '999 ₸' }), /принадлежит Lead/);
  const { run: next } = runTeamTool(run(), lead, 'publish_fact', { key: 'Цена', value: '1 250 ₸' });
  assert.deepEqual([next.facts![0].value, next.facts![0].version], ['1 250 ₸', 2]);
  assert.equal(next.tasks.find(t => t.id === 't2')!.status, 'pending');
  assert.match(next.messages.at(-1)!.body, /«1 200 ₸» → «1 250 ₸»/);
  const added = runTeamTool(run(), dev, 'publish_fact', { key: 'Пост', value: '3 поста' }).run.facts!.at(-1)!;
  assert.deepEqual([added.ownerId, added.version], ['dev', 1]);
});

test('a blocked report reaches the leader from the caller', () => {
  const note = runTeamTool(run(), dev, 'report_blocked', { reason: 'Нет доступа к ценам' }).run.messages.at(-1)!;
  assert.deepEqual([note.fromId, note.toId, note.request], ['dev', 'lead', false]);
  assert.match(note.body, /Блокировка: Нет доступа к ценам/);
});

test('the leader adds and reassigns tasks within the rules', () => {
  const { run: added, result } = runTeamTool(run(), lead, 'add_task', { title: 'Docs', description: 'Write docs', assigneeId: 'dev', dependsOn: ['t1'] });
  const task = added.tasks.at(-1)!;
  assert.equal((result as { taskId: string }).taskId, task.id);
  assert.deepEqual([task.assigneeId, task.status, task.turns, task.dependsOn], ['dev', 'pending', 0, ['t1']]);
  assert.throws(() => runTeamTool(run(), lead, 'add_task', { title: 'X', description: 'Y', assigneeId: 'ghost' }), /неизвест/);
  assert.throws(() => runTeamTool(run(), lead, 'add_task', { title: 'X', description: 'Y', assigneeId: 'dev', dependsOn: ['nope'] }), /неизвест/);
  assert.throws(() => runTeamTool(run({ phase: 'review' }), lead, 'add_task', { title: 'X', description: 'Y', assigneeId: 'dev' }), /этапе задач/);
  assert.equal(runTeamTool(run(), lead, 'assign_task', { taskId: 't3', assigneeId: 'lead' }).run.tasks.find(t => t.id === 't3')!.assigneeId, 'lead');
  assert.throws(() => runTeamTool(run(), lead, 'assign_task', { taskId: 't2', assigneeId: 'lead' }), /не начата/);
});

test('a grant works only for its live turn in its own run', () => {
  assert.throws(() => runTeamTool(run({ inFlight: [] }), lead, 'team_status', {}), /ход завершён/);
  assert.throws(() => runTeamTool(run({ id: 'run-2' }), lead, 'team_status', {}), /ход завершён/);
  assert.throws(() => runTeamTool(run({ status: 'paused' }), lead, 'team_status', {}), /ход завершён/);
  assert.throws(() => runTeamTool(run(), { ...lead, memberId: 'dev' }, 'team_status', {}), /ход завершён/);
  assert.throws(() => runTeamTool(run(), lead, 'drop_tables', {}), /Неизвестный инструмент/);
});
