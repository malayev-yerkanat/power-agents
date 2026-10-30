import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiHandler } from '../src/server/http.ts';
import { FlowEngine } from '../src/server/flows/engine.ts';
import { Store } from '../src/server/store.ts';

async function app() {
  const root = mkdtempSync(join(tmpdir(), 'flow-media-api-')), store = new Store(':memory:'), flows = new FlowEngine({ root, store });
  const engine = { create() { throw Error('team'); }, approve() { throw Error('team'); }, control() { throw Error('team'); }, message() { throw Error('team'); } };
  const handler = createApiHandler({ store, flows, engine, connections: [] });
  async function request(path: string, method = 'GET', headers: Record<string, string> = {}, data = '') {
    const req = Object.assign(Readable.from([Buffer.from(data)]), { url: path, method, socket: { localPort: 43123 }, headers: { host: '127.0.0.1:43123', ...headers } }) as IncomingMessage;
    const chunks: Buffer[] = [], responseHeaders: Record<string, string> = {}; let status = 200;
    const res = Object.assign(new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } }), {
      setHeader(name: string, value: string) { responseHeaders[name.toLowerCase()] = value; },
      writeHead(code: number, values: Record<string, string>) { status = code; for (const [key, value] of Object.entries(values)) responseHeaders[key.toLowerCase()] = String(value); },
    });
    await handler(req, res as unknown as ServerResponse);
    return { status, headers: responseHeaders, body: Buffer.concat(chunks).toString() };
  }
  const bootstrap = await request('/api/bootstrap');
  const headers = { cookie: bootstrap.headers['set-cookie'].split(';')[0], 'x-csrf-token': JSON.parse(bootstrap.body).csrfToken, origin: 'http://127.0.0.1:43123' };
  const flow = flows.create({ title: 'media', mode: 'demo', template: 'roblox-reel' });
  return { root, store, flows, flow, headers, request, close: () => { flows.shutdown(); store.close(); rmSync(root, { recursive: true, force: true }); } };
}
test('raw flow upload bypasses JSON body size limit while retaining session, CSRF and origin checks', async () => {
  const a = await app(), url = `/api/flows/${a.flow.id}/nodes/capture/upload`;
  const upload = { ...a.headers, 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent('Тест take.mp4') };
  try {
    assert.equal((await a.request(url, 'POST', { ...upload, cookie: '' }, 'take')).status, 401);
    assert.equal((await a.request(url, 'POST', { ...upload, 'x-csrf-token': '' }, 'take')).status, 403);
    assert.equal((await a.request(url, 'POST', { ...upload, origin: 'https://evil.test' }, 'take')).status, 403);
    const response = await a.request(url, 'POST', upload, 'x'.repeat(70000)); assert.equal(response.status, 200);
    const flow = JSON.parse(response.body).flow; assert.equal(flow.nodes.find((n: { id: string }) => n.id === 'capture').upload.bytes, 70000);
    assert.equal((await a.request(url, 'POST', { ...upload, 'x-file-name': 'bad.txt' }, 'take')).status, 400);
    assert.equal((await a.request(url, 'POST', { ...upload, 'content-length': '2147483649' })).status, 413);
  } finally { a.close(); }
});
test('versioned flow media URL serves Range and rejects unknown versions and traversal', async () => {
  const a = await app(), url = `/api/flows/${a.flow.id}/files/preview/v1`;
  const dir = join(a.root, a.flow.id, 'preview/v1'); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'reel.mp4'), '0123456789');
  a.store.updateFlow(a.flow.id, flow => ({ ...flow, nodes: flow.nodes.map(n => n.id === 'preview' ? { ...n, version: 1 } : n) }), { type: 'flow.updated', message: 'fixture' });
  try {
    assert.equal((await a.request(`${url}/reel.mp4`)).status, 401);
    const response = await a.request(`${url}/reel.mp4`, 'GET', { ...a.headers, range: 'bytes=2-4' });
    assert.equal(response.status, 206); assert.equal(response.body, '234'); assert.equal(response.headers['content-type'], 'video/mp4');
    assert.equal((await a.request(`${url}/reel.mp4`, 'GET', { ...a.headers, range: 'bytes=90-' })).status, 416);
    for (const path of [`${url}/..%2F..%2Fprivate.mp4`, `${url.replace('/v1', '/v2')}/reel.mp4`, `${url}/missing.mp4`]) assert.equal((await a.request(path, 'GET', a.headers)).status, 404);
  } finally { a.close(); }
});
