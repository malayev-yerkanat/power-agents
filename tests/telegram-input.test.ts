import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Store } from '../src/server/store.ts';
import { TelegramService } from '../src/server/telegram.ts';

function fixture() {
  const store = new Store(':memory:');
  const hash = createHash('sha256').update('pair').digest('hex');
  store.createTelegramPairing(hash, new Date(Date.now() + 60_000).toISOString());
  store.processTelegramUpdate(undefined, hash, '123', '123');
  const calls: { method: string; body: Record<string, any> }[] = [];
  let updates: unknown[] = [];
  let nextMessage = 0;
  let acknowledgement: Promise<void> | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    const method = String(input).split('/').at(-1)!;
    const body = JSON.parse(String(init?.body ?? '{}'));
    calls.push({ method, body });
    if (method === 'sendMessage') return Response.json({ ok: true, result: { message_id: ++nextMessage } });
    if (method === 'getUpdates') return Response.json({ ok: true, result: updates });
    if (method === 'answerCallbackQuery') await acknowledgement;
    return Response.json({ ok: true, result: true });
  };
  const service = new TelegramService(store, 'test', { fetcher });
  return { service, calls, store,
    updates: (value: unknown[]) => { updates = value; },
    delayAcknowledgement: (value: Promise<void>) => { acknowledgement = value; },
    sent: async (count = 1) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        await new Promise(resolve => setImmediate(resolve));
        if (calls.filter(call => call.method === 'sendMessage').length >= count) return;
      }
      throw new Error('Message was not sent');
    },
    close: async () => { await service.stop(); store.close(); },
  };
}

function reply(update_id: number, text: string, changes: Record<string, unknown> = {}) {
  return { update_id, message: { message_id: update_id + 100, text, from: { id: 123 },
    chat: { id: 123, type: 'private' }, reply_to_message: { message_id: 1 }, ...changes } };
}

test('Codex input accepts only an explicit reply from the paired private user and chat', async () => {
  const f = fixture();
  try {
    const answer = f.service.requestInput('Which?', [], 60_000);
    await f.sent();
    f.updates([
      reply(1, 'wrong user', { from: { id: 999 } }),
      reply(2, 'wrong chat', { chat: { id: 999, type: 'private' } }),
      reply(3, 'group', { chat: { id: 123, type: 'group' } }),
      reply(4, 'not reply', { reply_to_message: undefined }),
      reply(5, 'wrong message', { reply_to_message: { message_id: 2 } }),
      reply(6, ' '.repeat(4)), reply(7, 'x'.repeat(4001)), reply(8, 'My own answer'),
    ]);
    await f.service.pollOnce(0);
    assert.equal(await answer, 'My own answer');
    assert.equal(f.calls.filter(call => call.method === 'editMessageText').length, 1);
  } finally { await f.close(); }
});

test('buttons-only input ignores typed replies and does not invite them', async () => {
  const f = fixture();
  try {
    const answer = f.service.requestInput('Approve?', [{ label: 'Approve once' }, { label: 'Decline' }], 60_000, undefined, false);
    await f.sent();
    const sent = f.calls.find(call => call.method === 'sendMessage')!.body;
    assert.equal(sent.text, 'Approve?');
    f.updates([reply(1, 'yes')]);
    await f.service.pollOnce(0);
    assert.equal(f.calls.filter(call => call.method === 'editMessageText').length, 0);
    f.updates([{ update_id: 2, callback_query: { id: '2', data: sent.reply_markup.inline_keyboard[0][1].callback_data,
      from: { id: 123 }, message: { message_id: 1, chat: { id: 123 } } } }]);
    await f.service.pollOnce(0);
    assert.equal(await answer, 'Decline');
  } finally { await f.close(); }
});

test('buttons return the full option label and duplicate callbacks cannot answer twice', async () => {
  const f = fixture();
  try {
    const label = 'A detailed option '.repeat(6);
    const answer = f.service.requestInput('Which?', [{ label }], 60_000);
    await f.sent();
    const button = f.calls.find(call => call.method === 'sendMessage')!.body.reply_markup.inline_keyboard[0][0];
    assert.ok(button.text.length <= 64);
    const callback = (update_id: number) => ({ update_id, callback_query: { id: `${update_id}`, data: button.callback_data,
      from: { id: 123 }, message: { message_id: 1, chat: { id: 123 } } } });
    f.updates([callback(1), callback(2)]);
    await f.service.pollOnce(0);
    assert.equal(await answer, label);
    assert.equal(f.calls.filter(call => call.method === 'editMessageText').length, 1);
  } finally { await f.close(); }
});

test('desktop cancellation removes a pending input before any late reply is processed', async () => {
  const f = fixture();
  try {
    const abort = new AbortController();
    const answer = f.service.requestInput('Which?', [], 60_000, abort.signal);
    await f.sent();
    abort.abort();
    f.updates([reply(1, 'late')]);
    await f.service.pollOnce(0);
    assert.equal(await answer, undefined);
    assert.ok(f.calls.filter(call => call.method === 'editMessageText').every(call => !call.body.text.includes('late')));
  } finally { await f.close(); }
});

test('a button decision settles before callback acknowledgement, preventing a desktop race', async () => {
  const f = fixture();
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  try {
    f.delayAcknowledgement(hold);
    const abort = new AbortController();
    const answer = f.service.requestApproval('Approve?', 60_000, abort.signal);
    await f.sent();
    const data = f.calls.find(call => call.method === 'sendMessage')!.body.reply_markup.inline_keyboard[0][0].callback_data;
    f.updates([{ update_id: 1, callback_query: { id: '1', data, from: { id: 123 }, message: { message_id: 1, chat: { id: 123 } } } }]);
    const poll = f.service.pollOnce(0);
    while (!f.calls.some(call => call.method === 'answerCallbackQuery')) await new Promise(resolve => setImmediate(resolve));
    abort.abort();
    release();
    await poll;
    assert.equal(await answer, true);
  } finally { release(); await f.close(); }
});

test('pre-aborted input sends nothing; stopping and disconnecting release outstanding inputs', async () => {
  for (const action of ['stop', 'disconnect'] as const) {
    const f = fixture();
    try {
      assert.equal(await f.service.requestInput('Skip', [], 60_000, AbortSignal.abort()), undefined);
      assert.equal(f.calls.length, 0);
      const answer = f.service.requestInput('Wait?', [], 60_000);
      await f.sent();
      await f.service[action]();
      assert.equal(await answer, undefined);
    } finally { await f.close(); }
  }
});

test('free text does not resolve existing approval buttons', async () => {
  const f = fixture();
  try {
    const abort = new AbortController();
    const answer = f.service.requestApproval('Approve?', 60_000, abort.signal);
    await f.sent();
    f.updates([reply(1, 'Approve')]);
    await f.service.pollOnce(0);
    abort.abort();
    assert.equal(await answer, undefined);
  } finally { await f.close(); }
});

test('pending inputs are bounded and empty or excessive option labels are rejected', async () => {
  const f = fixture();
  try {
    await assert.rejects(f.service.requestInput('Question', [{ label: '' }], 60_000));
    await assert.rejects(f.service.requestInput('Question', Array.from({ length: 11 }, () => ({ label: 'x' })), 60_000));
    const answers = Array.from({ length: 32 }, () => f.service.requestInput('Question', [], 60_000));
    await f.sent(32);
    await assert.rejects(f.service.requestInput('Overflow', [], 60_000), /pending/i);
    await f.service.stop();
    assert.deepEqual(await Promise.all(answers), Array(32).fill(undefined));
  } finally { await f.close(); }
});

test('expired replies cannot answer a later question, and requests are isolated by message ID', async () => {
  const f = fixture();
  try {
    const expired = f.service.requestInput('Expired?', [], 1);
    assert.equal(await expired, undefined);
    const later = f.service.requestInput('Later?', [], 60_000);
    const concurrent = f.service.requestInput('Concurrent?', [], 60_000);
    await f.sent(3);
    f.updates([reply(1, 'stale'), reply(2, 'concurrent', { reply_to_message: { message_id: 3 } }),
      reply(3, 'later', { reply_to_message: { message_id: 2 } })]);
    await f.service.pollOnce(0);
    assert.equal(await later, 'later');
    assert.equal(await concurrent, 'concurrent');
  } finally { await f.close(); }
});

test('cancellation while Telegram sends cannot resurrect a pending question', async () => {
  const store = new Store(':memory:');
  const hash = createHash('sha256').update('pair').digest('hex');
  store.createTelegramPairing(hash, new Date(Date.now() + 60_000).toISOString());
  store.processTelegramUpdate(undefined, hash, '123', '123');
  let release!: () => void;
  const sent = new Promise<void>(resolve => { release = resolve; });
  const service = new TelegramService(store, 'test', { fetcher: async input => {
    if (String(input).endsWith('/sendMessage')) {
      await sent;
      return Response.json({ ok: true, result: { message_id: 1 } });
    }
    if (String(input).endsWith('/getUpdates')) return Response.json({ ok: true, result: [reply(1, 'too late')] });
    return Response.json({ ok: true, result: true });
  } });
  try {
    const abort = new AbortController();
    const answer = service.requestInput('Question?', [], 60_000, abort.signal);
    abort.abort();
    release();
    await new Promise(resolve => setImmediate(resolve));
    await service.pollOnce(0);
    assert.equal(await answer, undefined);
  } finally { release(); await service.stop(); store.close(); }
});
