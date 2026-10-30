import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Flow, FlowPatch, NodeRun } from '../src/shared/flow-types.ts';
import { createApiHandler } from '../src/server/http.ts';
import { FlowEngine } from '../src/server/flows/engine.ts';
import { Store } from '../src/server/store.ts';

async function setup() {
  const root = mkdtempSync(join(tmpdir(), 'power-flow-http-'));
  const store = new Store(':memory:');
  const flows = new FlowEngine({ store, root });
  const engine = {
    create() { throw new Error('Unexpected team run'); }, approve() { throw new Error('Unexpected team approval'); },
    control() { throw new Error('Unexpected team control'); }, message() { throw new Error('Unexpected team message'); },
  };
  const handler = createApiHandler({ store, engine, flows, connections: [] });
  const base = 'http://127.0.0.1:43123';
  async function rawRequest(path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
    const req = Readable.from(options.body === undefined ? [] : [Buffer.from(options.body)]) as IncomingMessage;
    Object.assign(req, { url: path, method: options.method ?? 'GET', socket: { localPort: 43123 },
      headers: { host: '127.0.0.1:43123', ...Object.fromEntries(Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])) } });
    const responseHeaders: Record<string, string> = {};
    let status = 200;
    let body = '';
    const res = { headersSent: false,
      setHeader(key: string, value: string) { responseHeaders[key] = value; },
      writeHead(code: number, headers: Record<string, string>) { status = code; Object.assign(responseHeaders, headers); },
      end(value: string) { body = value; },
    } as unknown as ServerResponse;
    await handler(req, res);
    return new Response(body, { status, headers: responseHeaders });
  }
  const bootstrap = await rawRequest('/api/bootstrap');
  const { csrfToken } = await bootstrap.json() as { csrfToken: string };
  const headers = { Cookie: bootstrap.headers.get('set-cookie')!.split(';')[0], 'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json', Origin: base };
  return {
    store, base, headers, rawRequest,
    async events() {
      const req = Readable.from([]) as IncomingMessage;
      Object.assign(req, { url: '/api/events', method: 'GET', socket: { localPort: 43123 },
        headers: { host: '127.0.0.1:43123', cookie: headers.Cookie } });
      let output = '';
      const res = Object.assign(new EventEmitter(), { destroyed: false, writableLength: 0,
        setHeader() {}, writeHead() {}, write(value: string) { output += value; },
        destroy() { res.destroyed = true; res.emit('close'); }, end() {},
      });
      await handler(req, res as unknown as ServerResponse);
      return { output: () => output, close: () => { res.emit('close'); } };
    },
    request(path: string, method = 'GET', body?: unknown) {
      return rawRequest(`/api/flows${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    },
    async close() {
      await flows.shutdown();
      store.close(); rmSync(root, { recursive: true, force: true });
    },
  };
}

type App = Awaited<ReturnType<typeof setup>>;
async function flowResponse(response: Response): Promise<Flow> {
  assert.ok(response.ok, await response.clone().text());
  return (await response.json() as { flow: Flow }).flow;
}
async function waitFor(app: App, flowId: string, nodeId: string, status: string): Promise<Flow> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const flow = app.store.getFlow(flowId)!;
    if (flow.nodes.find(node => node.id === nodeId)?.status === status) return flow;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail(`Node ${nodeId} did not reach ${status}`);
}
function graph(version: number): FlowPatch {
  const nodes = ['brand', 'idea', 'script', 'voice'].map((type, index) => ({ id: type, type, title: type,
    position: { x: index * 200, y: 0 }, config: {}, gate: type === 'idea' || type === 'script' }));
  const edge = (from: string, to: string) => ({ id: `${from}-${to}`, from: { node: from, port: from }, to: { node: to, port: from } });
  return { version, nodes, edges: [edge('brand', 'idea'), edge('brand', 'script'), edge('idea', 'script'), edge('script', 'voice')] };
}

test('flow registry exposes JSON port definitions and config defaults before flow ID lookup', async () => {
  const app = await setup();
  try {
    assert.equal((await app.rawRequest('/api/flows/registry')).status, 401);
    const response = await app.request('/registry');
    assert.equal(response.status, 200);
    const { types } = await response.json() as { types: { type: string; title: string; inputs: unknown[];
      outputs: unknown[]; gate: boolean; lane?: string; configDefaults: Record<string, unknown> }[] };
    assert.equal(types.length, 11);
    assert.deepEqual(types.find(value => value.type === 'brand'), {
      type: 'brand', title: 'Brand', inputs: [], outputs: [{ name: 'brand', type: 'brand' }], gate: false,
      configDefaults: { text: '', rules: [] },
    });
    assert.equal(types.find(value => value.type === 'script')!.configDefaults.words, 150);
    assert.equal(types.find(value => value.type === 'preview')!.lane, 'render');
    assert.ok(types.every(value => !('config' in value)));
  } finally { await app.close(); }
});

test('global SSE emits flow changes without run cursor IDs and unsubscribes on close', async () => {
  const app = await setup();
  const stream = await app.events();
  try {
    assert.match(stream.output(), /: connected/);
    const flow = await flowResponse(await app.request('', 'POST', { title: 'Поток', mode: 'demo' }));
    assert.match(stream.output(), /event: flow\ndata: /);
    const event = JSON.parse(stream.output().split('data: ')[1].split('\n')[0]) as { flowId: string; type: string };
    assert.equal(event.flowId, flow.id);
    assert.equal(event.type, 'flow.created');
    assert.doesNotMatch(stream.output(), /id: /);
    await flowResponse(await app.request(`/${flow.id}`, 'PATCH', { version: flow.version, title: 'Обновлено' }));
    assert.equal(stream.output().match(/event: flow/g)?.length, 2);
    stream.close();
    const output = stream.output();
    await app.request('', 'POST', { title: 'Другой поток', mode: 'demo' });
    assert.equal(stream.output(), output);
  } finally { stream.close(); await app.close(); }
});

test('flow API runs a four-node demo through two approvals and records recent executions', async () => {
  const app = await setup();
  try {
    const created = await app.request('', 'POST', { title: 'Demo reel', mode: 'demo' });
    assert.equal(created.status, 201);
    let flow = await flowResponse(created);
    const list = await app.request('');
    assert.deepEqual((await list.json() as { flows: { id: string }[] }).flows.map(value => value.id), [flow.id]);
    flow = await flowResponse(await app.request(`/${flow.id}`, 'PATCH', graph(flow.version)));
    await flowResponse(await app.request(`/${flow.id}/nodes/brand/run`, 'POST', {}));
    await waitFor(app, flow.id, 'brand', 'approved');
    await flowResponse(await app.request(`/${flow.id}/nodes/idea/run`, 'POST', {}));
    await waitFor(app, flow.id, 'idea', 'awaiting_approval');
    assert.equal((await app.request(`/${flow.id}/nodes/script/run`, 'POST', {})).status, 409);
    await flowResponse(await app.request(`/${flow.id}/nodes/idea/approve`, 'POST', {}));
    await flowResponse(await app.request(`/${flow.id}/nodes/script/run`, 'POST', {}));
    await waitFor(app, flow.id, 'script', 'awaiting_approval');
    await flowResponse(await app.request(`/${flow.id}/nodes/script/approve`, 'POST', {}));
    await flowResponse(await app.request(`/${flow.id}/nodes/voice/run`, 'POST', {}));
    await waitFor(app, flow.id, 'voice', 'approved');
    const detail = await app.request(`/${flow.id}`);
    const body = await detail.json() as { flow: Flow; nodeRuns: NodeRun[] };
    assert.ok(body.flow.nodes.every(node => node.status === 'approved'));
    assert.equal(body.nodeRuns.length, 4);
    assert.ok(body.nodeRuns.every(run => run.status === 'done'));
    assert.ok(body.flow.nodes.find(node => node.id === 'voice')!.output!.audio);
    assert.ok(body.flow.nodes.find(node => node.id === 'voice')!.output!.timings);
  } finally { await app.close(); }
});

test('flow API keeps session, CSRF and local origin protections on reads and mutations', async () => {
  const app = await setup();
  try {
    assert.equal((await app.rawRequest('/api/flows')).status, 401);
    for (const method of ['POST', 'PATCH']) {
      const response = await app.rawRequest('/api/flows', { method,
        headers: { ...app.headers, 'X-CSRF-Token': '' }, body: '{}' });
      assert.equal(response.status, 403);
    }
    assert.equal((await app.rawRequest('/api/flows', { method: 'POST',
      headers: { ...app.headers, Origin: 'https://attacker.example' }, body: '{}' })).status, 403);
    assert.equal(app.store.listFlows().length, 0);
  } finally { await app.close(); }
});

test('flow API validates bodies and returns not-found and transition conflicts', async () => {
  const app = await setup();
  try {
    assert.equal((await app.request('/missing')).status, 404);
    assert.equal((await app.request('/missing', 'PATCH', { version: 0 })).status, 404);
    for (const body of [null, { title: '', mode: 'demo' }, { mode: 'other' }, { extra: true }]) {
      assert.equal((await app.request('', 'POST', body)).status, 400);
    }
    const empty = await app.request('', 'POST', {});
    assert.equal(empty.status, 201);
    const template = await flowResponse(await app.request('', 'POST', { template: 'roblox-reel', mode: 'demo' }));
    assert.ok(template.nodes.length >= 10);
    let flow = await flowResponse(await empty.clone());
    flow = await flowResponse(await app.request(`/${flow.id}`, 'PATCH', graph(flow.version)));
    assert.equal((await app.request(`/${flow.id}`, 'PATCH', { version: flow.version - 1, title: 'stale' })).status, 409);
    assert.equal((await app.request(`/${flow.id}`, 'PATCH', { version: flow.version, nodes: [{ id: 'bad' }] })).status, 400);
    assert.equal((await app.request(`/${flow.id}/nodes/missing/run`, 'POST', {})).status, 404);
    assert.equal((await app.request(`/${flow.id}/nodes/idea/approve`, 'POST', {})).status, 409);
    assert.equal((await app.request(`/${flow.id}/nodes/idea/reject`, 'POST', { note: '   ' })).status, 400);
    await flowResponse(await app.request(`/${flow.id}/nodes/brand/run`, 'POST', {}));
    await waitFor(app, flow.id, 'brand', 'approved');
    await flowResponse(await app.request(`/${flow.id}/nodes/idea/run`, 'POST', {}));
    await waitFor(app, flow.id, 'idea', 'awaiting_approval');
    await flowResponse(await app.request(`/${flow.id}/nodes/idea/reject`, 'POST', { note: 'Use a clearer hook' }));
    flow = await waitFor(app, flow.id, 'idea', 'awaiting_approval');
    assert.equal(flow.nodes.find(node => node.id === 'idea')!.version, 2);
    assert.match(JSON.stringify(flow.nodes.find(node => node.id === 'idea')!.output), /Use a clearer hook/);
  } finally { await app.close(); }
});
