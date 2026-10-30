import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCodexTelegramService } from '../src/server/codex/service.ts';
import type { Store } from '../src/server/store.ts';
import type { TelegramService } from '../src/server/telegram.ts';

const token = `123456:${'a'.repeat(25)}`;
function fixture(options: { token?: string; existingToken?: string; enabled?: boolean } = {}) {
  const calls: string[] = [];
  let ready = false;
  const store = { close: () => calls.push('store.close') } as unknown as Store;
  const telegram = { start: () => calls.push('telegram.start'), stop: async () => { calls.push('telegram.stop'); },
    status: () => ({ configured: true, ready, connected: ready, username: 'codex_bot', notifications: { approval: true, completed: true } }),
    beginPairing: () => { calls.push('pair'); return { url: 'https://t.me/codex_bot?start=nonce', expiresAt: 'soon' }; },
  } as unknown as TelegramService;
  const bridge = { start: () => calls.push('bridge.start'), stop: () => calls.push('bridge.stop'), status: () => 'Connected to Codex desktop' };
  const service = createCodexTelegramService({ dataRoot: '/local/state', enabled: true, ...options, factories: {
    createStore: path => { calls.push(`store:${path}`); return store; },
    createTelegram: (actual, supplied) => { assert.equal(actual, store); assert.equal(supplied, token); calls.push('telegram.create'); return telegram; },
    createBridge: actual => { assert.equal(actual, telegram); calls.push('bridge.create'); return bridge; },
  } });
  return { service, calls, setReady: (value: boolean) => { ready = value; } };
}

test('dedicated Codex bot never falls back to Claude token or initializes without its own valid token', async () => {
  for (const config of [{ existingToken: token }, { token, enabled: false }, { token, existingToken: token },
    { token, existingToken: `123456:${'b'.repeat(25)}` }, { token: 'invalid-secret' }]) {
    const f = fixture(config); f.service.start();
    assert.deepEqual(f.calls, []);
    assert.equal(f.service.status().ready, false);
    assert.equal(f.service.status().connected, false);
    assert.ok(!JSON.stringify(f.service.status()).includes('invalid-secret'));
    assert.ok(!JSON.stringify(f.service.status()).includes(token));
    assert.throws(() => f.service.beginPairing(), /not ready/i);
    await f.service.stop(); assert.deepEqual(f.calls, []);
  }
});

test('initialization failures close the dedicated store and expose only a safe error', async () => {
  let closed = 0;
  const service = createCodexTelegramService({ dataRoot: '/local/state', token, enabled: true, factories: {
    createStore: () => ({ close: () => { closed++; } }) as unknown as Store,
    createTelegram: () => { throw new Error(token); }, createBridge: () => assert.fail(),
  } });
  assert.equal(closed, 1); assert.equal(service.status().status, 'Unavailable');
  assert.ok(!JSON.stringify(service.status()).includes(token));
  service.start(); await service.stop(); assert.equal(closed, 1);
});

test('dedicated bot uses separate store and starts/stops its poller and bridge exactly once', async () => {
  const f = fixture({ token });
  assert.deepEqual(f.calls, ['store:/local/state/codex-telegram.sqlite', 'telegram.create', 'bridge.create']);
  f.service.start(); f.service.start(); f.setReady(true);
  assert.deepEqual(f.calls.slice(3), ['telegram.start', 'bridge.start']);
  assert.deepEqual(f.service.status(), { enabled: true, configured: true, ready: true, connected: true,
    username: 'codex_bot', status: 'Connected to Codex desktop' });
  await Promise.all([f.service.stop(), f.service.stop()]);
  assert.deepEqual(f.calls.slice(5), ['bridge.stop', 'telegram.stop', 'store.close']);
  assert.equal(f.service.status().ready, false);
  f.service.start(); assert.equal(f.calls.filter(c => c === 'telegram.start').length, 1);
});

test('pairing is available only after the dedicated bot becomes ready', async () => {
  const f = fixture({ token });
  assert.throws(() => f.service.beginPairing(), /not ready/i);
  f.service.start(); assert.throws(() => f.service.beginPairing(), /not ready/i);
  f.setReady(true);
  assert.equal(f.service.beginPairing().url, 'https://t.me/codex_bot?start=nonce');
  assert.equal(f.calls.at(-1), 'pair'); await f.service.stop();
  assert.throws(() => f.service.beginPairing(), /not ready/i);
});
