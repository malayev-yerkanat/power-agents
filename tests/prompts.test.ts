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
test('each turn receives only the documents and messages it needs, once', () => {
  const doc = (id: string, kind: 'work' | 'final' | 'review', taskId?: string) => ({ id, title: id, body: `body-${id}`, authorId: 'a', taskId, kind, createdAt: '' });
  const task = (id: string, dependsOn: string[], assigneeId = 'a') => ({ id, title: id, description: id, assigneeId, dependsOn, status: 'completed' as const, turns: 1, output: `body-${id}-v2` });
  const message = (id: string, fromId: string, toId: string) => ({ id, fromId, toId, body: `msg-${id}`, request: false, status: 'answered' as const, createdAt: '' });
  const full: Run = { ...run, phase: 'tasks', tasks: [task('t1', []), task('t2', ['t1']), { ...task('t3', [], 'b'), output: 'summary-only-t3' }],
    artifacts: [doc('t1-v1', 'work', 't1'), { ...doc('t1-v2', 'work', 't1') }, doc('t2-v2', 'work', 't2'), doc('final-1', 'final'), doc('review-1', 'review'), doc('final-2', 'final')],
    messages: [message('mine', 'a', 'b'), message('to-me', 'b', 'a'), message('user', 'user', 'a'), message('others', 'b', 'c')] };
  const seen = (context: Context) => promptFor({ ...context, run: full }).split('\nCONTEXT:\n')[1];
  const count = (text: string, part: string) => text.split(part).length - 1;

  const work = seen({ run: full, memberId: 'a', purpose: 'task', taskId: 't2' });
  assert.equal(count(work, 'body-t1-v2'), 1);
  assert.ok(!work.includes('body-t1-v1') && !work.includes('summary-only-t3') && !work.includes('final-'));
  assert.ok(work.includes('msg-mine') && work.includes('msg-to-me') && work.includes('msg-user') && !work.includes('msg-others'));

  const synthesis = seen({ run: full, memberId: 'a', purpose: 'synthesize' });
  assert.ok(['body-t1-v2', 'body-t2-v2', 'summary-only-t3', 'body-final-2', 'body-review-1'].every(part => count(synthesis, part) === 1));
  assert.ok(!synthesis.includes('body-final-1') && !synthesis.includes('body-t1-v1'));

  const review = seen({ run: full, memberId: 'b', purpose: 'review' });
  assert.ok(review.includes('body-final-2') && !review.includes('body-t1-v2') && !review.includes('summary-only-t3'));
});
test('the plan prompt tells the leader that synthesis and review are automatic', () => {
  const plan = promptFor({ run, memberId: 'a', purpose: 'plan' });
  assert.match(plan, /Не добавляй задачи на сборку итога, общую проверку или финальную доработку/);
  assert.match(plan, /платформа сама поручит руководителю synthesize, а другому участнику review/);
});
