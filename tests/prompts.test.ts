import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promptFor, type Context } from '../src/server/core/prompts.ts';
import type { Run } from '../src/shared/types.ts';
const run: Run = { id: 'r', title: 'Title', goal: 'Goal', members: [], leaderId: 'a', status: 'planning', tasks: [], messages: [], artifacts: [], sessions: { a: 'private-session-id' }, turnCount: 0, reviewRound: 0, phase: 'plan', mode: 'demo', createdAt: '', updatedAt: '', version: 1 };
test('shared prompts omit provider sessions and reject oversized context', () => {
  const context: Context = { run, memberId: 'a', purpose: 'plan' };
  assert.ok(!promptFor(context).includes('private-session-id'));
  assert.throws(() => promptFor({ ...context, run: { ...run, goal: 'x'.repeat(300001) } }), /Контекст превысил/);
});
