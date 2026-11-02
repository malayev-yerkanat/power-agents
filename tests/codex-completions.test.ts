import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CodexCompletions } from '../src/server/codex/completions.ts';

const turn = (status = 'inProgress', turnId = 'turn') => ({ turnId, status, items: [] });
const state = (status = 'inProgress', turnId = 'turn') => ({ id: 'thread', turns: [turn(status, turnId)] });
const canonical = (status: string, overlays: unknown[] = []) => ({ id: 'thread', turns: overlays,
  turnHistory: { kind: 'canonical', history: { entitiesByKey: { key: turn(status) }, islands: [{ entries: [{ value: 'key' }] }] } } });
function fixture() {
  const sent: string[][] = [];
  const completions = new CodexCompletions({ queueCodexCompletion: (...args: string[]) => { sent.push(args); } });
  return { sent, completions, sync: (value: unknown) => completions.sync('thread', '/private/project', value) };
}

test('only observed active turns completing queue one privacy-safe notification', () => {
  const f = fixture();
  f.sync(state('completed', 'old')); assert.equal(f.sent.length, 0);
  f.sync(state()); f.sync({ ...state('completed'), title: 'secret title', response: 'secret output' });
  f.sync(state('completed'));
  assert.equal(f.sent.length, 1);
  assert.deepEqual(f.sent[0].slice(0, 2), ['thread', 'turn']);
  assert.match(f.sent[0][2], /project · done/);
  assert.match(f.sent[0][2], /finished/i);
  assert.ok(!f.sent[0][2].includes('secret'));
  assert.ok(!f.sent[0][2].includes('/private'));
  f.sync(state('inProgress', 'next')); f.sync(state('completed', 'next'));
  assert.equal(f.sent.length, 2);
});

test('canonical history completion and terminal overlay both trigger notifications', () => {
  for (const done of [canonical('completed'), canonical('inProgress', [turn('completed')])]) {
    const f = fixture(); f.sync(canonical('inProgress')); f.sync(done);
    assert.equal(f.sent.length, 1);
  }
});

test('failed, interrupted, unknown and conflicting terminal states never announce success', () => {
  for (const status of ['failed', 'interrupted', 'cancelled', 'unknown']) {
    const f = fixture(); f.sync(state()); f.sync(state(status)); f.sync(state('completed'));
    assert.equal(f.sent.length, 0);
  }
  for (const [base, overlay] of [['failed', 'completed'], ['completed', 'failed']]) {
    const f = fixture(); f.sync(state()); f.sync(canonical(base, [turn(overlay)]));
    assert.equal(f.sent.length, 0);
  }
});

test('invalid snapshots, missing identities and duplicate turns fail closed', () => {
  for (const value of [null, { ...state(), id: 'other' }, { ...state(), turns: [turn(), turn()] },
    { ...state(), turns: [{ status: 'completed' }] },
    { ...canonical('completed'), turnHistory: { kind: 'canonical' } }]) {
    const f = fixture(); f.sync(state()); f.sync(value); f.sync(state('completed'));
    assert.equal(f.sent.length, 0);
  }
});

test('cancel resets observed activity for only the chosen thread or all threads', () => {
  const f = fixture(); f.sync(state()); f.completions.cancel('other'); f.sync(state('completed'));
  assert.equal(f.sent.length, 1);
  for (const id of ['thread', undefined]) {
    f.sync(state()); f.completions.cancel(id); f.sync(state('completed'));
  }
  assert.equal(f.sent.length, 1);
});

test('queue failure retains transition for retry and does not silently drop completion', () => {
  let attempts = 0;
  const completions = new CodexCompletions({ queueCodexCompletion: () => {
    attempts++; if (attempts === 1) throw new Error('storage unavailable');
  } });
  completions.sync('thread', '/project', state());
  assert.throws(() => completions.sync('thread', '/project', state('completed')), /storage unavailable/);
  completions.sync('thread', '/project', state('completed'));
  assert.equal(attempts, 2);
});

const message = (text: string, phase: string | null = 'final_answer') => ({ type: 'agentMessage', id: 'assistant', text, phase });
const completedWith = (items: unknown[]) => ({ id: 'thread', turns: [{ ...turn('completed'), items }] });

test('done alert includes a readable final-answer excerpt in the requested format', () => {
  const f = fixture(); f.sync(state());
  f.sync(completedWith([
    { type: 'userMessage', text: 'private user input' },
    { type: 'commandExecution', text: 'private tool output' },
    message('I will change things.', 'commentary'),
    message('**Fixed** the [upload timeout](https://example.com).\n\nTests pass. `Nothing` pushed.'),
    message('Later commentary must not replace final.', 'commentary'),
  ]));
  assert.equal(f.sent[0][2], '✅ project · done\n\nFixed the upload timeout.\n\nTests pass. Nothing pushed.');
});

test('summary uses same-turn canonical final text and prefers terminal text over stale overlays', () => {
  for (const overlay of [[], [{ ...turn(), items: [message('Stale partial response')] }]]) {
    const f = fixture(); f.sync(state());
    const value = canonical('completed', overlay);
    f.sync({ ...value, turnHistory: { ...value.turnHistory, history: { ...value.turnHistory.history,
      entitiesByKey: { key: { ...turn('completed'), items: [message('Finished the actual task.')] } } } } });
    assert.match(f.sent[0][2], /Finished the actual task/);
    assert.ok(!f.sent[0][2].includes('Stale'));
  }
});

test('legacy unphased final text is supported but commentary-only turns use a fallback', () => {
  const f = fixture(); f.sync(state()); f.sync(completedWith([message('Legacy result.', null)]));
  assert.match(f.sent[0][2], /Legacy result/);
  const g = fixture(); g.sync(state()); g.sync(completedWith([message('Working...', 'commentary')]));
  assert.equal(g.sent[0][2], '✅ project · done\n\nFinished working. Open Codex Desktop to see the result.');
});

test('summary is bounded and does not split a Unicode character', () => {
  const f = fixture(); f.sync(state()); f.sync(completedWith([message('😀'.repeat(800))]));
  const excerpt = f.sent[0][2].split('\n\n')[1];
  assert.equal(Array.from(excerpt).length, 200);
  assert.ok(excerpt.endsWith('…'));
  assert.ok(!/[\uD800-\uDBFF]$/.test(excerpt.slice(0, -1)));
});
