import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Store } from '../src/server/store.ts';
import { createApiHandler } from '../src/server/http.ts';

test('dedicated Codex bot status and pairing require local session and CSRF', async () => {
  const store = new Store(':memory:');
  let ready = false, pairs = 0;
  const handler = createApiHandler({ store, connections: [], engine: {} as never,
    codexTelegram: { status: () => ({ enabled: true, configured: true, ready, connected: false, status: 'Waiting' }),
      beginPairing: () => { pairs++; return { url: 'https://t.me/codex_test_bot?start=test', expiresAt: 'later' }; } } });
  const server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Expected port');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${base}/api/telegram/codex`)).status, 401);
    const boot = await fetch(`${base}/api/bootstrap`);
    const { csrfToken } = await boot.json();
    const cookie = boot.headers.get('set-cookie')!.split(';')[0];
    const headers = { cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
    assert.equal((await fetch(`${base}/api/telegram/codex/pair`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await fetch(`${base}/api/telegram/codex/pair`, { method: 'POST', headers, body: '{}' })).status, 503);
    ready = true;
    assert.equal((await fetch(`${base}/api/telegram/codex/pair`, { method: 'POST', headers, body: '{}' })).status, 200);
    assert.equal(pairs, 1);
    const status = await (await fetch(`${base}/api/telegram/codex`, { headers })).json();
    assert.equal(status.ready, true);
    assert.equal(status.connected, false);
  } finally { server.closeAllConnections(); server.close(); store.close(); }
});
