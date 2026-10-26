import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApiHandler } from '../src/server/http.ts';
import { Store } from '../src/server/store.ts';
import { Engine } from '../src/server/engine.ts';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

async function setup(connections: Connection[] = [], models?: (connection: Connection) => Promise<ModelCatalog>, workspaceRoot?: string) {
  const store = new Store(':memory:');
  const calls: unknown[][] = [];
  const engine = {
    create(input: CreateRunInput) { calls.push(['create', input]); return fixture(); },
    approve(id: string, version: number) { calls.push(['approve', id, version]); return fixture(); },
    control(id: string, action: 'pause' | 'resume' | 'cancel', confirmRepeat?: boolean) { calls.push(['control', id, action, ...(confirmRepeat ? [confirmRepeat] : [])]); return fixture(); },
    message(id: string, body: string) { calls.push(['message', id, body]); return fixture(); },
  };
  store.createRun(fixture(), { type: 'created', message: 'Created' });
  const handler = createApiHandler({ store, engine, connections, models, workspaceRoot });
  const server = createServer((req, res) => {
    void handler(req, res).then(handled => { if (!handled) { res.writeHead(404); res.end(); } });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const bootstrap = await fetch(`${base}/api/bootstrap`);
  const cookie = bootstrap.headers.get('set-cookie')!.split(';')[0];
  const state = await bootstrap.json() as { csrfToken: string; runs: { id: string }[]; eventCursor: number };
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
    assert.deepEqual(app.state.runs, [{ id: 'run-1', title: 'Research', status: 'planning', mode: 'demo',
      createdAt: fixture().createdAt, updatedAt: fixture().updatedAt, version: 1 }]);
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

test('bootstrap and run history return bounded summary pages with validated cursors', async () => {
  const app = await setup();
  try {
    for (let i = 0; i < 62; i += 1) app.store.createRun({ ...fixture(), id: `extra-${i}`,
      createdAt: new Date(Date.UTC(2026, 9, 8, 0, 0, i)).toISOString(), artifacts: [] },
    { type: 'created', message: 'Created' });
    const first = await fetch(`${app.base}/api/bootstrap`);
    const state = await first.json() as { runs: { id: string }[]; nextCursor?: string; eventCursor: number };
    assert.equal(state.runs.length, 30);
    assert.equal(state.runs[0].id, 'extra-61');
    assert.equal(typeof state.nextCursor, 'string');
    assert.equal(state.eventCursor, 63);
    const second = await fetch(`${app.base}/api/runs?before=${state.nextCursor}`, { headers: app.headers });
    const page = await second.json() as { runs: { id: string }[]; nextCursor?: string };
    assert.equal(page.runs.length, 30);
    assert.equal(page.runs[0].id, 'extra-31');
    const third = await fetch(`${app.base}/api/runs?before=${page.nextCursor}`, { headers: app.headers });
    assert.equal((await third.json() as { runs: unknown[] }).runs.length, 3);
    assert.equal((await fetch(`${app.base}/api/runs?before=missing`, { headers: app.headers })).status, 400);
  } finally { await app.close(); }
});

test('SSE replay is capped and emits a resync marker for historical overflow', async () => {
  const app = await setup();
  const abort = new AbortController();
  try {
    for (let i = 0; i < 110; i += 1) app.store.updateRun('run-1', value => value, { type: 'changed', message: String(i) });
    const response = await fetch(`${app.base}/api/events?after=1`, { headers: app.headers, signal: abort.signal });
    const reader = response.body!.getReader();
    let output = '';
    while (!output.includes('event: resync')) output += new TextDecoder().decode((await reader.read()).value);
    assert.equal((output.match(/event: run/g) || []).length, 100);
    assert.match(output, /event: resync\ndata: \{"reason":"replay_limit"\}/);
    const detail = await fetch(`${app.base}/api/runs/run-1`, { headers: app.headers });
    const body = await detail.json() as { eventsBefore: number };
    assert.equal(typeof body.eventsBefore, 'number');
  } finally { abort.abort(); await app.close(); }
});

test('bootstrap event cursor replays changes made before SSE subscribes', async () => {
  const app = await setup();
  const abort = new AbortController();
  try {
    app.store.updateRun('run-1', value => value, { type: 'changed', message: 'Between snapshot and stream' });
    const response = await fetch(`${app.base}/api/events?after=${app.state.eventCursor}`,
      { headers: app.headers, signal: abort.signal });
    const reader = response.body!.getReader();
    let output = '';
    while (!output.includes('Between snapshot and stream')) output += new TextDecoder().decode((await reader.read()).value);
    assert.match(output, /event: run/);
  } finally { abort.abort(); await app.close(); }
});

test('run detail and older-event pages keep event responses bounded', async () => {
  const app = await setup();
  try {
    for (let i = 0; i < 205; i += 1) app.store.updateRun('run-1', value => value, { type: 'changed', message: String(i) });
    const response = await fetch(`${app.base}/api/runs/run-1`, { headers: app.headers });
    const recent = await response.json() as { run: Run; events: { id: number }[]; eventsBefore?: number };
    assert.equal(recent.events.length, 100);
    assert.equal(recent.events.at(-1)!.id, 206);
    assert.equal(typeof recent.eventsBefore, 'number');
    const olderResponse = await fetch(`${app.base}/api/runs/run-1/events/history?before=${recent.eventsBefore}`, { headers: app.headers });
    const older = await olderResponse.json() as { events: { id: number }[]; before?: number };
    assert.equal(older.events.length, 100);
    assert.equal(older.events.at(-1)!.id, 106);
    assert.equal((await fetch(`${app.base}/api/runs/run-1/events/history?before=nope`, { headers: app.headers })).status, 400);
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
      ['/api/runs/run-1/control', { action: 'pause' }], ['/api/runs/run-1/control', { action: 'resume', confirmRepeat: true }],
      ['/api/runs/run-1/messages', { body: 'Please revise' }],
    ] as const) {
      const response = await fetch(`${app.base}${path}`, { method: 'POST', headers: app.headers, body: JSON.stringify(body) });
      assert.ok(response.ok);
      assert.deepEqual(await response.json(), { run: fixture() });
    }
    assert.deepEqual(app.calls, [
      ['create', input], ['approve', 'run-1', 1], ['control', 'run-1', 'pause'], ['control', 'run-1', 'resume', true], ['message', 'run-1', 'Please revise'],
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

test('run creation rejects duplicate member IDs and an outside leader through the engine', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'power-http-engine-'));
  const store = new Store(':memory:');
  const engine = new Engine({ store, connections: [], workspaceRoot: workspace });
  const handler = createApiHandler({ store, engine, connections: [] });
  const server = createServer((req, res) => { void handler(req, res); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const bootstrap = await fetch(`${base}/api/bootstrap`);
    const { csrfToken } = await bootstrap.json() as { csrfToken: string };
    const headers = { Cookie: bootstrap.headers.get('set-cookie')!.split(';')[0], 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json', Origin: base };
    const member = (id: string) => ({ id, name: id, connectionId: 'demo', model: '', role: '' });
    const create = (body: object) => fetch(`${base}/api/runs`, { method: 'POST', headers, body: JSON.stringify({ goal: 'Подготовить короткий план', mode: 'demo', ...body }) });
    const duplicate = await create({ leaderId: 'a', members: [member('a'), member('a')] });
    assert.equal(duplicate.status, 400);
    assert.match((await duplicate.json() as { error: string }).error, /уникальные/);
    const outsider = await create({ leaderId: 'z', members: [member('a'), member('b')] });
    assert.equal(outsider.status, 400);
    assert.match((await outsider.json() as { error: string }).error, /руководителя/);
    assert.equal(store.runSummaries().totalRuns, 0);
  } finally {
    engine.shutdown(); server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    store.close(); rmSync(workspace, { recursive: true, force: true });
  }
});

test('task files download only when listed and inside the task folder', async () => {
  const root = mkdtempSync(join(tmpdir(), 'power-http-files-'));
  const app = await setup([], undefined, root);
  try {
    const runId = fixture().id;
    const dir = join(root, runId, 'tasks', 't1');
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(join(dir, 'docs', 'меню.md'), '# Menu');
    writeFileSync(join(dir, 'secret.txt'), 'no');
    app.store.updateRun(runId, r => ({ ...r, artifacts: [...r.artifacts, { id: 'w1', title: 'W', body: 'b', authorId: 'leader', taskId: 't1', kind: 'work',
      createdAt: '2026-10-07T00:00:00.000Z', files: [{ path: 'docs/меню.md', bytes: 6 }] }] }), { type: 'seed', message: 'files' });
    const url = (path: string) => `${app.base}/api/runs/${runId}/files/t1/${path}`;
    const ok = await fetch(url(`docs/${encodeURIComponent('меню.md')}`), { headers: app.headers });
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), '# Menu');
    assert.match(ok.headers.get('content-disposition')!, /attachment/);
    assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await fetch(url('secret.txt'), { headers: app.headers })).status, 404);
    assert.equal((await fetch(url('..%2F..%2Fsecret.txt'), { headers: app.headers })).status, 404);
    assert.equal((await fetch(url(`docs/${encodeURIComponent('меню.md')}`))).status, 401);
  } finally { await app.close(); rmSync(root, { recursive: true, force: true }); }
});

test('a code run must point at a git repository', async () => {
  const app = await setup();
  try {
    const members = [
      { id: 'leader', name: 'Leader', connectionId: 'demo', model: '', role: 'Lead' },
      { id: 'reviewer', name: 'Reviewer', connectionId: 'demo', model: '', role: 'Review' },
    ];
    const body = (repoPath: string) => JSON.stringify({ goal: 'Change the project code', mode: 'demo', leaderId: 'leader', members, repoPath, checkCommand: 'npm test' });
    const notRepo = mkdtempSync(join(tmpdir(), 'power-not-repo-'));
    for (const path of ['relative/path', notRepo]) {
      const response = await fetch(`${app.base}/api/runs`, { method: 'POST', headers: app.headers, body: body(path) });
      assert.equal(response.status, 400, path);
    }
    rmSync(notRepo, { recursive: true, force: true });
    const response = await fetch(`${app.base}/api/runs`, { method: 'POST', headers: app.headers, body: body(process.cwd()) });
    assert.equal(response.status, 201);
    const [, input] = app.calls.at(-1) as [string, CreateRunInput];
    assert.equal(input.checkCommand, 'npm test');
  } finally { await app.close(); }
});
