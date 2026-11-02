import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CodexAsyncQuestions } from '../src/server/codex/async-questions.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));
const questionId = JSON.stringify(['request_user_input_async', 'item', 0]);
const reply = (answer = 'One') => `<send_user_message_question_reply>\n${JSON.stringify([{ questionItemId: questionId, question: 'Which?', answer }])}\n</send_user_message_question_reply>`;
const item = { type: 'agentMessage', id: 'item', questions: [{ title: 'Which?', options: ['One', 'Two'] }] };
const state = (items: unknown[] = [item], overrides = {}) => ({ id: 't', turns: [{ turnId: 'turn', status: 'inProgress', items }], ...overrides });
function harness() {
  const prompts: { text: string; options: { label: string }[]; signal?: AbortSignal; resolve: (value?: string) => void }[] = [];
  const sent: unknown[][] = [];
  const bridge = new CodexAsyncQuestions({ telegram: { requestInput: (text, options, _timeout, signal) => new Promise(resolve => {
    prompts.push({ text, options, signal, resolve });
  }) }, send: async (...args) => { sent.push(args); } });
  return { bridge, prompts, sent };
}

test('async questions use exact desktop reply encoding and steer only', async () => {
  const h = harness(); h.bridge.sync('t', '/project', state());
  assert.deepEqual(h.prompts[0].options, [{ label: 'One' }, { label: 'Two' }]);
  h.prompts[0].resolve('One'); await tick();
  assert.equal(h.sent.length, 1);
  const [thread, method, params, turn] = h.sent[0] as [string, string, Record<string, any>, string];
  assert.equal(thread, 't'); assert.equal(turn, 'turn'); assert.equal(method, 'thread-follower-steer-turn');
  assert.deepEqual(params.input, [{ type: 'text', text: reply(), text_elements: [] }]);
  assert.equal(params.restoreMessage.text, reply());
  assert.equal(params.restoreMessage.id, params.clientUserMessageId);
  assert.equal(params.toolOutput, undefined);
  h.bridge.sync('t', '/project', state()); assert.equal(h.prompts.length, 1);
});

test('desktop accepted answer cancels Telegram and ignores late response', async () => {
  for (const answered of [
    { type: 'userMessage', id: 'answer', content: [{ type: 'text', text: reply() }] },
    { type: 'steeringUserMessage', id: 'answer', status: 'accepted', input: [{ type: 'text', text: reply() }] },
  ]) {
    const h = harness(); h.bridge.sync('t', '/project', state());
    h.bridge.sync('t', '/project', state([item, answered]));
    assert.equal(h.prompts[0].signal?.aborted, true);
    h.prompts[0].resolve('Two'); await tick(); assert.equal(h.sent.length, 0);
  }
});

test('pending desktop submission suspends remote answer until accepted or failed', async () => {
  const h = harness(); h.bridge.sync('t', '/project', state());
  h.bridge.sync('t', '/project', state([item, { type: 'steeringUserMessage', id: 'answer', status: 'pending', input: [{ type: 'text', text: reply() }] }]));
  assert.equal(h.prompts[0].signal?.aborted, true);
  h.prompts[0].resolve('Two'); await tick(); assert.equal(h.sent.length, 0);
});

test('completed, malformed, cross-thread, secret-like extra fields and oversized questions stay desktop-only', () => {
  const h = harness();
  for (const s of [state([], { id: 'other' }), state([], { turns: [{ turnId: 'turn', status: 'completed', items: [item] }] }),
    state([{ ...item, questions: [{ title: 'Password?', options: [], isSecret: true }] }]),
    state([{ ...item, questions: [{ title: 'x'.repeat(4000), options: [] }] }]),
    state([], { turns: [{ turnId: 'turn', status: 'inProgress', items: {} }] }),
    state([], { turns: [{ turnId: 'a', status: 'inProgress', items: [item] }, { turnId: 'b', status: 'inProgress', items: [item] }] })]) {
    h.bridge.sync('t', '/project', s);
  }
  assert.equal(h.prompts.length, 0);
});

test('changed questions, completed turns and explicit cancellation invalidate controls', async () => {
  for (const next of [state([], { turns: [] }), state([{ ...item, questions: [{ title: 'Different?', options: [] }] }])]) {
    const h = harness(); h.bridge.sync('t', '/project', state()); h.bridge.sync('t', '/project', next);
    assert.equal(h.prompts[0].signal?.aborted, true); h.prompts[0].resolve('One'); await tick(); assert.equal(h.sent.length, 0);
    h.bridge.cancel();
  }
  const h = harness(); h.bridge.sync('t', '/project', state()); h.bridge.cancel('other');
  assert.equal(h.prompts[0].signal?.aborted, false); h.bridge.cancel('t');
  assert.equal(h.prompts[0].signal?.aborted, true);
});

test('each question is independently answered, free text supported, failures and expiry deduplicated', async () => {
  const h = harness(); const s = state([{ ...item, questions: [...item.questions, { title: 'Details?', options: [] }] }]);
  h.bridge.sync('t', '/project', s); assert.equal(h.prompts.length, 2);
  h.prompts[1].resolve('Custom detail'); h.prompts[0].resolve(); await tick();
  assert.equal(h.sent.length, 1); assert.match(JSON.stringify(h.sent[0]), /Custom detail/);
  h.bridge.sync('t', '/project', s); assert.equal(h.prompts.length, 2);
  const failing = new CodexAsyncQuestions({ telegram: { requestInput: async () => { throw Error('offline'); } }, send: async () => assert.fail() });
  failing.sync('t', '/project', state()); await tick(); failing.cancel();
});

test('fresh snapshot send guard rejects answered, changed turn, unknown or changed question', async () => {
  const { canSendAsyncAnswer } = await import('../src/server/codex/async-questions.ts');
  const params = { conversationId: 't', input: [{ type: 'text', text: reply(), text_elements: [] }] };
  assert.equal(canSendAsyncAnswer('t', '/project', state(), 'turn', params), true);
  assert.equal(canSendAsyncAnswer('t', '/project', state(), 'new-turn', params), false);
  assert.equal(canSendAsyncAnswer('t', '/project', state([item, { type: 'userMessage', id: 'a', content: [{ type: 'text', text: reply() }] }]), 'turn', params), false);
  assert.equal(canSendAsyncAnswer('t', '/project', state([{ ...item, id: 'different' }]), 'turn', params), false);
  assert.equal(canSendAsyncAnswer('t', '/project', state([{ ...item, questions: [{ title: 'Changed?', options: [] }] }]), 'turn', params), false);
  assert.equal(canSendAsyncAnswer('t', '/project', state(), 'turn', { ...params, toolOutput: {} }), false);
  assert.equal(canSendAsyncAnswer('t', '/project', state(), 'turn', { ...params, conversationId: 'other' }), false);
  assert.equal(canSendAsyncAnswer('t', '/project', state(), 'turn', { ...params, input: [{ type: 'text', text: 'ordinary message' }] }), false);
});

test('nullable options work and desktop replies after context delimiter cancel controls', () => {
  const h = harness(); const s = state([{ ...item, questions: [{ title: 'Which?', options: null }] }]);
  h.bridge.sync('t', '/project', s); assert.equal(h.prompts.length, 1);
  h.bridge.sync('t', '/project', state([item, { type: 'userMessage', id: 'a', content: [{ type: 'text', text: `Context\n## My request:\n${reply()}` }] }]));
  assert.equal(h.prompts[0].signal?.aborted, true);
});

test('canonical Desktop turn history and accepted overlay replies are reconciled', async () => {
  const h = harness();
  const canonical = { id: 't', turns: [], turnHistory: { kind: 'canonical', history: {
    entitiesByKey: { 'turn:turn': state().turns[0] }, islands: [{ entries: [{ value: 'turn:turn' }] }], generation: 1, isComplete: true,
  } } };
  h.bridge.sync('t', '/project', canonical); assert.equal(h.prompts.length, 1);
  h.bridge.sync('t', '/project', { ...canonical, turns: [{ turnId: 'turn', status: 'inProgress', items: [
    { type: 'steeringUserMessage', id: 'answer', status: 'accepted', input: [{ type: 'text', text: reply() }] },
  ] }] });
  assert.equal(h.prompts[0].signal?.aborted, true);
  h.prompts[0].resolve('Two'); await tick(); assert.equal(h.sent.length, 0);
});

test('canonical missing entities and conflicting terminal overlays fail closed', () => {
  for (const overrides of [{ entitiesByKey: {} }, { entitiesByKey: { x: state().turns[0] } }]) {
    const h = harness();
    h.bridge.sync('t', '/project', { id: 't', turns: [], turnHistory: { kind: 'canonical', history: { ...overrides, islands: [{ entries: [{ value: 'turn:turn' }] }] } } });
    assert.equal(h.prompts.length, 0);
  }
  const h = harness(); h.bridge.sync('t', '/project', { id: 't', turns: [{ turnId: 'turn', status: 'completed', items: [] }],
    turnHistory: { kind: 'canonical', history: { entitiesByKey: { x: state().turns[0] }, islands: [{ entries: [{ value: 'x' }] }] } } });
  assert.equal(h.prompts.length, 0);
});
