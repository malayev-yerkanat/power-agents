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
  assert.equal(store.consumeTelegramPairing(hash('nonce'), '123', '123'), true);
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
    assert.equal(store.consumeTelegramPairing(hash('old'), '1', '1'), false);
    pair(store);
    assert.equal(store.consumeTelegramPairing(hash('nonce'), '456', '456'), false);
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
  let sendCalls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/getMe')) {
      getMeCalls += 1;
      if (getMeCalls === 1) throw new Error('temporary offline');
      return new Response(JSON.stringify({ ok: true, result: { id: 1234, username: 'test_bot' } }));
    }
    if (url.endsWith('/getUpdates')) return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
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
