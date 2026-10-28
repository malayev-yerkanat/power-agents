import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { Store } from '../src/server/store.ts';
import { TelegramService, isTelegramToken } from '../src/server/telegram.ts';
import { createApiHandler } from '../src/server/http.ts';
import type { Run } from '../src/shared/types.ts';

const initial = (): Run => ({
  id: 'run-1', title: 'Private goal', goal: 'A private goal', status: 'planning',
  members: [], leaderId: 'leader', tasks: [], messages: [], artifacts: [], sessions: {},
  turnCount: 0, reviewRound: 0, phase: 'plan', createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(), version: 1, mode: 'demo',
});
const event = { type: 'turn_completed', message: 'Done' };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function pair(store: Store): void {
  store.createTelegramPairing(hash('nonce'), new Date(Date.now() + 60_000).toISOString());
  assert.equal(store.processTelegramUpdate(undefined, hash('nonce'), '123', '123'), true);
}

test('outbox is transactionally created only on relevant transitions and survives restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'power-agents-telegram-'));
  const path = join(dir, 'state.sqlite');
  try {
    const store = new Store(path);
    pair(store);
    store.createRun(initial(), event);
    assert.equal(store.telegramDueMessages().length, 0);
    store.updateRun('run-1', run => ({ ...run, status: 'awaiting_approval' }), event);
    const approval = store.telegramDueMessages();
    assert.equal(approval.length, 1);
    assert.equal(approval[0].kind, 'approval');
    assert.equal(approval[0].runVersion, 2);
    assert.ok(!approval[0].text.includes('Private goal'));
    assert.throws(() => store.updateRun('run-1', () => { throw new Error('abort'); }, event));
    assert.equal(store.telegramDueMessages().length, 1);
    store.updateRun('run-1', run => ({ ...run, title: 'Updated' }), event);
    assert.equal(store.telegramDueMessages().length, 1);
    store.updateRun('run-1', run => ({ ...run, status: 'running' }), event);
    store.updateRun('run-1', run => ({ ...run, status: 'completed' }), event);
    assert.equal(store.telegramDueMessages().length, 2);
    store.close();
    const reopened = new Store(path);
    try { assert.deepEqual(reopened.telegramDueMessages().map(row => row.kind), ['approval', 'completed']); }
    finally { reopened.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pairing is one-use, private-chat bound by caller, and preferences suppress alerts', () => {
  const store = new Store(':memory:');
  try {
    store.createTelegramPairing(hash('old'), new Date(Date.now() - 1).toISOString());
    assert.equal(store.processTelegramUpdate(undefined, hash('old'), '1', '1'), false);
    pair(store);
    assert.equal(store.processTelegramUpdate(undefined, hash('nonce'), '456', '456'), false);
    store.setTelegramPreferences({ approval: false, completed: true });
    store.createRun(initial(), event);
    store.updateRun('run-1', run => ({ ...run, status: 'awaiting_approval' }), event);
    assert.equal(store.telegramDueMessages().length, 0);
    store.updateRun('run-1', run => ({ ...run, status: 'completed' }), event);
    assert.equal(store.telegramDueMessages().length, 1);
    store.disconnectTelegram();
    assert.equal(store.telegramDueMessages().length, 0);
  } finally { store.close(); }
});

test('service pairs only matching private /start and persists polling offset', async () => {
  const store = new Store(':memory:');
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push(url.split('/').at(-1)!);
    if (url.endsWith('/getMe')) return new Response(JSON.stringify({ ok: true, result: { id: 1234, username: 'test_bot' } }));
    if (url.endsWith('/getUpdates')) {
      const body = JSON.parse(String(init?.body)) as { offset: number };
      assert.equal(body.offset, 0);
      return new Response(JSON.stringify({ ok: true, result: [
        { update_id: 7, message: { text: '/start MATCH', from: { id: 1 }, chat: { id: -1, type: 'group' } } },
        { update_id: 8, message: { text: '/start MATCH', from: { id: 42 }, chat: { id: 42, type: 'private' } } },
      ] }));
    }
    throw new Error('unexpected request');
  };
  const service = new TelegramService(store, 'token', { fetcher });
  try {
    await service.initialize();
    const pairing = service.beginPairing('MATCH');
    assert.match(pairing.url, /test_bot\?start=MATCH/);
    await service.pollOnce();
    assert.equal(store.telegramRecipient(), '42');
    assert.equal(store.telegramOffset(), 9);
    assert.deepEqual(calls, ['getMe', 'getUpdates']);
  } finally { service.stop(); store.close(); }
});

test('invalid bot token or network error is sanitized and leaves pairing unavailable', async () => {
  const store = new Store(':memory:');
  const service = new TelegramService(store, 'SECRET', { fetcher: async () => {
    throw new Error('request https://api.telegram.org/botSECRET/getMe failed');
  } });
  try {
    await assert.rejects(service.initialize(), error => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes('SECRET'));
      return true;
    });
    assert.equal(service.status().ready, false);
    assert.ok(!service.status().error?.includes('SECRET'));
  } finally { await service.stop(); store.close(); }
});

test('BotFather token format is validated without exposing the supplied value', () => {
  assert.equal(isTelegramToken('123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi'), true);
  assert.equal(isTelegramToken('secret'), false);
  assert.equal(isTelegramToken('123456789:short'), false);
  assert.equal(isTelegramToken('123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi\n'), false);
});

test('background startup recovers after a transient getMe failure without restart', async () => {
  const store = new Store(':memory:');
  store.bindTelegramBot('1234');
  pair(store);
  store.queueTelegramTest();
  let getMeCalls = 0;
  let getUpdatesCalls = 0;
  let sendCalls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/getMe')) {
      getMeCalls += 1;
      if (getMeCalls === 1) throw new Error('temporary offline');
      return new Response(JSON.stringify({ ok: true, result: { id: 1234, username: 'test_bot' } }));
    }
    if (url.endsWith('/getUpdates')) {
      getUpdatesCalls += 1;
      if (getUpdatesCalls === 1) return new Response(JSON.stringify({ ok: true, result: [] }));
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    }
    if (url.endsWith('/sendMessage')) {
      sendCalls += 1;
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
    }
    throw new Error('unexpected method');
  };
  const service = new TelegramService(store, 'token', { fetcher, retryDelayMs: 5 });
  try {
    service.start();
    for (let count = 0; count < 50 && (!service.status().ready || sendCalls === 0); count += 1) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.equal(getMeCalls, 2);
    assert.equal(service.status().ready, true);
    assert.equal(service.status().error, undefined);
    assert.equal(sendCalls, 1);
    assert.equal(store.telegramDueMessages().length, 0);
  } finally { await service.stop(); store.close(); }
});

test('polling failure disables readiness and recovery restores it', async () => {
  const store = new Store(':memory:');
  let polls = 0;
  const pollTimeouts: number[] = [];
  let failPoll: (() => void) | undefined;
  let recoverPoll: (() => void) | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/getMe')) return new Response(JSON.stringify({ ok: true, result: { id: 1234, username: 'test_bot' } }));
    if (!url.endsWith('/getUpdates')) throw new Error('unexpected request');
    pollTimeouts.push((JSON.parse(String(init?.body)) as { timeout: number }).timeout);
    polls += 1;
    if (polls === 1) return new Response(JSON.stringify({ ok: true, result: [] }));
    if (polls === 2) return new Promise((_resolve, reject) => {
      failPoll = () => reject(new Error('offline'));
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    if (polls === 3) return new Promise((resolve, reject) => {
      recoverPoll = () => resolve(new Response(JSON.stringify({ ok: true, result: [] })));
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  };
  const service = new TelegramService(store, 'token', { fetcher, retryDelayMs: 5 });
  const until = async (condition: () => boolean): Promise<void> => {
    for (let count = 0; count < 100 && !condition(); count += 1) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(condition(), 'timed out waiting for Telegram state');
  };
  try {
    service.start();
    await until(() => service.status().ready && polls >= 2);
    assert.deepEqual(pollTimeouts, [0, 25]);
    failPoll!();
    await until(() => !service.status().ready);
    assert.match(service.status().error ?? '', /polling/);
    await until(() => polls >= 3);
    assert.deepEqual(pollTimeouts, [0, 25, 0]);
    recoverPoll!();
    await until(() => service.status().ready && polls >= 4);
    assert.deepEqual(pollTimeouts, [0, 25, 0, 25]);
    assert.equal(service.status().error, undefined);
  } finally { await service.stop(); store.close(); }
});

test('polling authentication failure leaves bot unavailable', async () => {
  const store = new Store(':memory:');
  let polls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/getMe')) return new Response(JSON.stringify({ ok: true, result: { id: 1234, username: 'test_bot' } }));
    if (!url.endsWith('/getUpdates')) throw new Error('unexpected request');
    polls += 1;
    if (polls === 1) return new Response(JSON.stringify({ ok: true, result: [] }));
    if (polls === 2) return new Response(JSON.stringify({ ok: false }), { status: 401 });
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  };
  const service = new TelegramService(store, 'token', { fetcher, retryDelayMs: 5 });
  try {
    service.start();
    for (let count = 0; count < 100 && polls < 3; count += 1) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(polls, 3);
    assert.equal(service.status().ready, false);
    assert.match(service.status().error ?? '', /authentication/);
  } finally { await service.stop(); store.close(); }
});

test('disconnect waits for an in-flight send to abort before completing', async () => {
  const store = new Store(':memory:');
  pair(store);
  store.queueTelegramTest();
  let signal: AbortSignal | undefined;
  let calls = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    calls += 1;
    signal = init?.signal ?? undefined;
    return new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  };
  const service = new TelegramService(store, 'token', { fetcher });
  try {
    const delivery = service.deliverOnce();
    assert.equal(calls, 1);
    await service.disconnect();
    await delivery;
    assert.equal(signal?.aborted, true);
    assert.equal(store.telegramRecipient(), undefined);
    assert.equal(store.telegramDueMessages().length, 0);
    await service.deliverOnce();
    assert.equal(calls, 1);
  } finally { await service.stop(); store.close(); }
});

test('pairing a new recipient aborts an in-flight send to the old chat', async () => {
  const store = new Store(':memory:');
  pair(store);
  store.queueTelegramTest();
  store.createTelegramPairing(hash('NEW'), new Date(Date.now() + 60_000).toISOString());
  let sends = 0;
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).endsWith('/getUpdates')) return new Response(JSON.stringify({ ok: true, result: [
      { update_id: 3, message: { text: '/start NEW', from: { id: 456 }, chat: { id: 456, type: 'private' } } },
    ] }));
    if (String(input).endsWith('/sendMessage')) {
      sends += 1;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    }
    throw new Error('unexpected method');
  };
  const service = new TelegramService(store, 'token', { fetcher });
  try {
    const delivery = service.deliverOnce();
    await service.pollOnce();
    await delivery;
    assert.equal(store.telegramRecipient(), '456');
    assert.equal(store.telegramDueMessages().length, 0);
    await service.deliverOnce();
    assert.equal(sends, 1);
  } finally { await service.stop(); store.close(); }
});

test('invalid /start code advances the cursor without aborting a legitimate delivery', async () => {
  const store = new Store(':memory:');
  pair(store);
  store.queueTelegramTest();
  store.createTelegramPairing(hash('REAL'), new Date(Date.now() + 60_000).toISOString());
  let finishSend: ((value: Response) => void) | undefined;
  let sendSignal: AbortSignal | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).endsWith('/getUpdates')) return new Response(JSON.stringify({ ok: true, result: [
      { update_id: 5, message: { text: '/start junk', from: { id: 999 }, chat: { id: 999, type: 'private' } } },
    ] }));
    if (String(input).endsWith('/sendMessage')) {
      sendSignal = init?.signal ?? undefined;
      return new Promise(resolve => { finishSend = resolve; });
    }
    throw new Error('unexpected method');
  };
  const service = new TelegramService(store, 'token', { fetcher });
  try {
    const delivery = service.deliverOnce();
    await service.pollOnce();
    assert.equal(sendSignal?.aborted, false);
    assert.equal(store.telegramRecipient(), '123');
    assert.equal(store.telegramOffset(), 6);
    finishSend!(new Response(JSON.stringify({ ok: true, result: { message_id: 1 } })));
    await delivery;
    assert.equal(store.telegramDueMessages().length, 0);
  } finally { await service.stop(); store.close(); }
});

test('Telegram settings API requires session and CSRF, and exposes an unconfigured state', async () => {
  const store = new Store(':memory:');
  const engine = { create: () => initial(), approve: () => initial(), control: () => initial(), message: () => initial() };
  const options = { store, engine, connections: [], telegram: undefined as TelegramService | undefined };
  const handler = createApiHandler(options);
  const server = createServer((req, res) => { void handler(req, res); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(`${base}/api/telegram/status`)).status, 401);
    const bootstrap = await fetch(`${base}/api/bootstrap`);
    const cookie = bootstrap.headers.get('set-cookie')!.split(';')[0];
    const { csrfToken } = await bootstrap.json() as { csrfToken: string };
    const headers = { Cookie: cookie, Origin: base, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
    const status = await fetch(`${base}/api/telegram/status`, { headers });
    assert.deepEqual(await status.json(), { configured: false, ready: false, connected: false,
      notifications: { approval: true, completed: true } });
    assert.equal((await fetch(`${base}/api/telegram/preferences`, { method: 'PATCH',
      headers: { ...headers, 'X-CSRF-Token': '' }, body: JSON.stringify({ approval: false }) })).status, 403);
    const preference = await fetch(`${base}/api/telegram/preferences`, { method: 'PATCH',
      headers, body: JSON.stringify({ approval: false }) });
    assert.deepEqual(await preference.json(), { notifications: { approval: false, completed: true } });
    assert.equal((await fetch(`${base}/api/telegram/pair`, { method: 'POST', headers, body: '{}' })).status, 503);
    pair(store);
    let ready = false;
    options.telegram = { status: () => ({ ready }), queueTest: () => store.queueTelegramTest() } as unknown as TelegramService;
    assert.equal((await fetch(`${base}/api/telegram/test`, { method: 'POST', headers, body: '{}' })).status, 503);
    assert.equal(store.telegramDueMessages().length, 0);
    ready = true;
    assert.equal((await fetch(`${base}/api/telegram/test`, { method: 'POST', headers, body: '{}' })).status, 200);
    assert.equal(store.telegramDueMessages().length, 1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    store.close();
  }
});

test('delivery respects retry_after, retries server errors, and disables blocked pairing without leaking token', async () => {
  const store = new Store(':memory:');
  pair(store);
  store.queueTelegramTest();
  let attempt = 0;
  const fetcher: typeof fetch = async input => {
    assert.match(String(input), /bottoken\/sendMessage$/);
    attempt += 1;
    if (attempt === 1) return new Response(JSON.stringify({ ok: false, error_code: 429, parameters: { retry_after: 2 } }), { status: 429 });
    if (attempt === 2) return new Response(JSON.stringify({ ok: false, error_code: 500 }), { status: 500 });
    return new Response(JSON.stringify({ ok: false, error_code: 403 }), { status: 403 });
  };
  const service = new TelegramService(store, 'token', { fetcher });
  try {
    await service.deliverOnce();
    assert.equal(store.telegramDueMessages().length, 0);
    const first = store.telegramAllMessages()[0];
    assert.equal(first.attempts, 1);
    assert.ok(Date.parse(first.nextAttemptAt) >= Date.now() + 1000);
    store.telegramReschedule(first.id, 1, new Date(0).toISOString());
    await service.deliverOnce();
    store.telegramReschedule(first.id, 2, new Date(0).toISOString());
    await service.deliverOnce();
    assert.equal(store.telegramRecipient(), undefined);
    assert.equal(store.telegramDueMessages().length, 0);
  } finally { service.stop(); store.close(); }
});

test('approval buttons accept only the paired user on the sent message, and abort releases the wait', async () => {
  const store = new Store(':memory:');
  pair(store);
  const calls: string[] = [];
  let data = '';
  let updates: unknown[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const method = String(input).split('/').at(-1)!;
    calls.push(method);
    const body = JSON.parse(String(init?.body ?? '{}')) as { reply_markup?: { inline_keyboard: { callback_data: string }[][] } };
    if (method === 'sendMessage') {
      data = body.reply_markup!.inline_keyboard[0][0].callback_data.slice(2);
      return new Response(JSON.stringify({ ok: true, result: { message_id: 5 } }));
    }
    if (method === 'getUpdates') return new Response(JSON.stringify({ ok: true, result: updates }));
    return new Response(JSON.stringify({ ok: true, result: true }));
  };
  const service = new TelegramService(store, 'token', { fetcher });
  const tap = (update_id: number, action: string, from: number, message_id = 5) => ({ update_id,
    callback_query: { id: `q${update_id}`, data: `${action}:${data}`, from: { id: from }, message: { message_id, chat: { id: 123 } } } });
  try {
    const pending = service.requestApproval('Run tests?', 60_000);
    while (!data) await new Promise(resolve => setImmediate(resolve));
    updates = [tap(1, '0', 999), tap(2, '0', 123, 6), tap(3, '1', 123)];
    await service.pollOnce(0);
    assert.equal(await pending, false);
    assert.equal(store.telegramOffset(), 4);
    assert.ok(calls.includes('editMessageText'));

    data = '';
    const aborted = new AbortController();
    const second = service.requestApproval('Again?', 60_000, aborted.signal);
    while (!data) await new Promise(resolve => setImmediate(resolve));
    aborted.abort();
    assert.equal(await second, undefined);
  } finally { await service.stop(); store.close(); }
});

test('question buttons show each option and resolve the tapped index', async () => {
  const store = new Store(':memory:');
  pair(store);
  let buttons: { text: string; callback_data: string }[] = [];
  let edited = '';
  let updates: unknown[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const method = String(input).split('/').at(-1)!;
    const body = JSON.parse(String(init?.body ?? '{}')) as { text?: string; reply_markup?: { inline_keyboard: { text: string; callback_data: string }[][] } };
    if (method === 'sendMessage') { buttons = body.reply_markup!.inline_keyboard[0]; return new Response(JSON.stringify({ ok: true, result: { message_id: 7 } })); }
    if (method === 'editMessageText') edited = body.text!;
    if (method === 'getUpdates') return new Response(JSON.stringify({ ok: true, result: updates }));
    return new Response(JSON.stringify({ ok: true, result: true }));
  };
  const service = new TelegramService(store, 'token', { fetcher });
  try {
    const pending = service.requestChoice('Which fix?', ['Fix 1', 'Fix 2', 'Not now'].map(label => ({ label, status: `Answered: ${label}` })), 60_000);
    while (!buttons.length) await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(buttons.map(button => button.text), ['Fix 1', 'Fix 2', 'Not now']);
    updates = [{ update_id: 1, callback_query: { id: 'q1', data: buttons[1].callback_data, from: { id: 123 }, message: { message_id: 7, chat: { id: 123 } } } }];
    await service.pollOnce(0);
    assert.equal(await pending, 1);
    assert.equal(edited, 'Which fix?\n\nAnswered: Fix 2');
  } finally { await service.stop(); store.close(); }
});
