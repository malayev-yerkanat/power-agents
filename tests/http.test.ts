import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApiHandler } from '../src/server/http.ts';
import { Store } from '../src/server/store.ts';
import type { Connection, CreateRunInput, ModelCatalog, Run } from '../src/shared/types.ts';

function fixture(): Run {
  return {
    id: 'run-1', title: 'Research', goal: 'An answer', status: 'planning', members: [],
    leaderId: 'leader', tasks: [], messages: [], sessions: {}, turnCount: 0, reviewRound: 0,
    phase: 'plan', createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-07T00:00:00.000Z',
    version: 1, mode: 'demo', artifacts: [{ id: 'art-1', title: 'Answer', body: '# Answer\n42',
      authorId: 'leader', kind: 'final', createdAt: '2026-10-07T00:00:00.000Z' }],
  };
}

async function setup(connections: Connection[] = [], models?: (connection: Connection) => Promise<ModelCatalog>) {
  const store = new Store(':memory:');
  const calls: unknown[][] = [];
  const engine = {
    create(input: CreateRunInput) { calls.push(['create', input]); return fixture(); },
    approve(id: string, version: number) { calls.push(['approve', id, version]); return fixture(); },
    control(id: string, action: 'pause' | 'resume' | 'cancel') { calls.push(['control', id, action]); return fixture(); },
    message(id: string, body: string) { calls.push(['message', id, body]); return fixture(); },
  };
  store.createRun(fixture(), { type: 'created', message: 'Created' });
  const handler = createApiHandler({ store, engine, connections, models });
  const server = createServer((req, res) => {
    void handler(req, res).then(handled => { if (!handled) { res.writeHead(404); res.end(); } });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const bootstrap = await fetch(`${base}/api/bootstrap`);
  const cookie = bootstrap.headers.get('set-cookie')!.split(';')[0];
  const state = await bootstrap.json() as { csrfToken: string; runs: Run[] };
  const headers = { Cookie: cookie, 'X-CSRF-Token': state.csrfToken, 'Content-Type': 'application/json', Origin: base };
  return {
    store, calls, base, headers, bootstrap, state, engine,
    async close() { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); store.close(); },
  };
}

test('model catalog requires a session and rejects unknown connections', async () => {
  const connection: Connection = { id: 'codex', name: 'Codex CLI', kind: 'codex-cli', available: true, detail: '' };
  const catalog: ModelCatalog = { connectionId: 'codex', models: [{ id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' }], status: 'ready', note: '' };
  const seen: string[] = [];
  const app = await setup([connection], async value => { seen.push(value.id); return catalog; });
  try {
    assert.equal((await fetch(`${app.base}/api/models/codex`)).status, 401);
    assert.equal((await fetch(`${app.base}/api/models/missing`, { headers: app.headers })).status, 404);
    const response = await fetch(`${app.base}/api/models/codex`, { headers: app.headers });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), catalog);
    assert.deepEqual(seen, ['codex']);
  } finally { await app.close(); }
});

test('bootstrap issues strict session cookie and protects all remaining API reads', async () => {
  const app = await setup();
  try {
    assert.match(app.bootstrap.headers.get('set-cookie')!, /HttpOnly/i);
    assert.match(app.bootstrap.headers.get('set-cookie')!, /SameSite=Strict/i);
    assert.deepEqual(app.state.runs, [fixture()]);
    assert.ok(app.state.csrfToken.length >= 32);
    assert.equal((await fetch(`${app.base}/api/health`)).status, 200);
    assert.equal((await fetch(`${app.base}/api/runs/run-1`)).status, 401);
    const detail = await fetch(`${app.base}/api/runs/run-1`, { headers: app.headers });
    const body = await detail.json() as { run: Run; events: unknown[] };
    assert.deepEqual(body.run, fixture());
    assert.equal(body.events.length, 1);
    assert.equal((await fetch(`${app.base}/api/runs/missing`, { headers: app.headers })).status, 404);
  } finally { await app.close(); }
});

test('rejects missing CSRF, hostile Origin, hostile Host, and cross-site fetch metadata', async () => {
  const app = await setup();
  try {
    for (const headers of [
      { ...app.headers, 'X-CSRF-Token': '' },
      { ...app.headers, Origin: 'https://attacker.example' },
      { ...app.headers, 'Sec-Fetch-Site': 'cross-site' },
    ]) {
      assert.equal((await fetch(`${app.base}/api/runs/run-1/control`, {
        method: 'POST', headers, body: JSON.stringify({ action: 'pause' }),
      })).status, 403);
    }
    const hostileHostStatus = await new Promise<number>(resolve => {
      const req = httpRequest(`${app.base}/api/bootstrap`, { headers: { Host: 'attacker.example' } }, res => {
        res.resume(); resolve(res.statusCode!);
      });
      req.end();
    });
    assert.equal(hostileHostStatus, 403);
    assert.deepEqual(app.calls, []);
  } finally { await app.close(); }
});

test('rejects malformed JSON, invalid bodies, wrong content type, and oversized input', async () => {
  const app = await setup();
  try {
    for (const [body, expected] of [
      ['{bad json', 400], ['null', 400], [JSON.stringify({ action: 'delete' }), 400],
      [JSON.stringify({ body: 'x'.repeat(70_000) }), 413],
    ] as const) {
      const response = await fetch(`${app.base}/api/runs/run-1/control`, { method: 'POST', headers: app.headers, body });
      assert.equal(response.status, expected);
      const error = await response.json() as { error: string };
      assert.equal(typeof error.error, 'string');
      assert.doesNotMatch(error.error, / at |node_modules/);
    }
    const response = await fetch(`${app.base}/api/runs/run-1/control`, {
      method: 'POST', headers: { ...app.headers, 'Content-Type': 'text/plain' }, body: '{}',
    });
    assert.equal(response.status, 415);
    assert.deepEqual(app.calls, []);
  } finally { await app.close(); }
});

test('routes validated mutations and streams Markdown artifact downloads', async () => {
  const app = await setup();
  try {
    const input: CreateRunInput = {
      goal: 'Build a report', leaderId: 'leader', mode: 'demo',
      members: [
        { id: 'leader', name: 'Leader', connectionId: 'demo', model: '', role: '' },
        { id: 'reviewer', name: 'Reviewer', connectionId: 'demo', model: '', role: 'Review' },
      ],
    };
    for (const [path, body] of [
      ['/api/runs', input], ['/api/runs/run-1/approve', { version: 1 }],
      ['/api/runs/run-1/control', { action: 'pause' }], ['/api/runs/run-1/messages', { body: 'Please revise' }],
    ] as const) {
      const response = await fetch(`${app.base}${path}`, { method: 'POST', headers: app.headers, body: JSON.stringify(body) });
      assert.ok(response.ok);
      assert.deepEqual(await response.json(), { run: fixture() });
    }
    assert.deepEqual(app.calls, [
      ['create', input], ['approve', 'run-1', 1], ['control', 'run-1', 'pause'], ['message', 'run-1', 'Please revise'],
    ]);
    const artifact = await fetch(`${app.base}/api/runs/run-1/artifacts/art-1`, { headers: app.headers });
    assert.match(artifact.headers.get('content-type')!, /text\/markdown/);
    assert.match(artifact.headers.get('content-disposition')!, /attachment/);
    assert.equal(await artifact.text(), '# Answer\n42');
  } finally { await app.close(); }
});

test('global SSE delivers run events and per-run SSE replays after a cursor', async () => {
  const app = await setup();
  const abort = new AbortController();
  try {
    const global = await fetch(`${app.base}/api/events`, { headers: app.headers, signal: abort.signal });
    assert.match(global.headers.get('content-type')!, /text\/event-stream/);
    const reader = global.body!.getReader();
    await reader.read();
    app.store.updateRun('run-1', value => value, { type: 'updated', message: 'Latest event' });
    const next = await reader.read();
    const streamed = new TextDecoder().decode(next.value);
    assert.match(streamed, /event: run/);
    assert.match(streamed, /Latest event/);
    const replay = await fetch(`${app.base}/api/runs/run-1/events?after=1`, { headers: app.headers, signal: abort.signal });
    const replayReader = replay.body!.getReader();
    const replayed = new TextDecoder().decode((await replayReader.read()).value);
    assert.match(replayed, /Latest event/);
    assert.doesNotMatch(replayed, /"message":"Created"/);
  } finally { abort.abort(); await app.close(); }
});

test('maps expected engine errors to 4xx and hides internal failure details', async context => {
  context.mock.method(console, 'error', () => {});
  const app = await setup();
  try {
    app.engine.control = () => { throw Object.assign(new Error('Already completed'), { statusCode: 409 }); };
    let response = await fetch(`${app.base}/api/runs/run-1/control`, {
      method: 'POST', headers: app.headers, body: '{"action":"pause"}',
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'Already completed' });
    app.engine.control = () => { throw new Error('secret internal token'); };
    response = await fetch(`${app.base}/api/runs/run-1/control`, {
      method: 'POST', headers: app.headers, body: '{"action":"pause"}',
    });
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /secret internal token/);
  } finally { await app.close(); }
});
