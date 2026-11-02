import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Readable, Writable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { receiveUpload, serveMedia } from '../src/server/flows/media.ts';
import { FlowEngine } from '../src/server/flows/engine.ts';
import { Store } from '../src/server/store.ts';

const request = (data: Buffer, headers: Record<string, string> = {}) => Object.assign(Readable.from([data]), { headers }) as IncomingMessage;
function fixture() { const root = mkdtempSync(join(tmpdir(), 'flow-media-')); return { root, close: () => rmSync(root, { recursive: true, force: true }) }; }

test('upload streams an mp4 to a safe name and rejects bad extensions and oversized bodies', async () => {
  const f = fixture();
  try {
    const upload = await receiveUpload(request(Buffer.from('data'), { 'content-type': 'application/octet-stream', 'x-file-name': '../take.mp4' }), f.root, 10);
    assert.equal(upload.bytes, 4); assert.match(upload.name, /^[a-zA-Z0-9_.-]+\.mp4$/); assert.equal(readFileSync(join(f.root, upload.name), 'utf8'), 'data');
    await assert.rejects(receiveUpload(request(Buffer.from(''), { 'content-type': 'application/octet-stream', 'x-file-name': 'evil.py' }), f.root), { statusCode: 400 });
    await assert.rejects(receiveUpload(request(Buffer.from('123456'), { 'content-type': 'application/octet-stream', 'x-file-name': 'big.mov' }), f.root, 5), { statusCode: 413 });
    await assert.rejects(receiveUpload(request(Buffer.from(''), { 'content-type': 'application/octet-stream', 'content-length': '2147483649', 'x-file-name': 'big.mov' }), f.root), { statusCode: 413 });
    await assert.rejects(receiveUpload(request(Buffer.from(''), { 'content-type': 'application/json', 'x-file-name': 'take.mp4' }), f.root), { statusCode: 415 });
  } finally { f.close(); }
});
async function download(root: string, path: string, range?: string) {
  const headers: Record<string, string | number> = {}; let status = 0; const chunks: Buffer[] = [];
  const res = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
  Object.assign(res, { writeHead(code: number, values: Record<string, string | number>) { status = code; Object.assign(headers, values); } });
  await serveMedia(request(Buffer.alloc(0), range ? { range } : {}), res as unknown as ServerResponse, root, path);
  return { status, headers, body: Buffer.concat(chunks).toString() };
}
test('media returns full and partial content, suffix ranges and 416 for invalid ranges', async () => {
  const f = fixture(); writeFileSync(join(f.root, 'video.mp4'), '0123456789');
  try {
    const full = await download(f.root, 'video.mp4'); assert.equal(full.status, 200); assert.equal(full.headers['Content-Type'], 'video/mp4');
    const part = await download(f.root, 'video.mp4', 'bytes=2-5'); assert.equal(part.status, 206); assert.equal(part.body, '2345'); assert.equal(part.headers['Content-Range'], 'bytes 2-5/10');
    assert.equal((await download(f.root, 'video.mp4', 'bytes=-3')).body, '789');
    for (const range of ['bytes=20-30', 'bytes=5-2', 'nonsense', 'bytes=0-1,4-5', 'bytes=-0']) {
      assert.equal((await download(f.root, 'video.mp4', range)).status, 416);
    }
  } finally { f.close(); }
});
test('media rejects traversal and symlinked parent folders', async () => {
  const f = fixture(); mkdirSync(join(f.root, 'safe')); writeFileSync(join(f.root, 'private.mp3'), 'private'); symlinkSync(f.root, join(f.root, 'safe', 'escape'));
  try {
    for (const path of ['../private.mp3', 'escape/private.mp3']) await assert.rejects(download(join(f.root, 'safe'), path), { statusCode: 404 });
  } finally { f.close(); }
});
test('a Capture upload stores metadata and marks its descendants stale while preserving output', async () => {
  const f = fixture(), store = new Store(':memory:'), flows = new FlowEngine({ store, root: f.root });
  try {
    const created = flows.create({ title: 'upload', mode: 'demo', template: 'roblox-reel' });
    store.updateFlow(created.id, flow => ({ ...flow, nodes: flow.nodes.map(n => ({ ...n, status: 'approved', output: { [n.type === 'capture' ? 'video' : n.type]: { value: 'old' } } })) }), { type: 'flow.updated', message: 'fixture' });
    const next = await flows.upload(created.id, 'capture', request(Buffer.from('take'), { 'content-type': 'application/octet-stream', 'x-file-name': 'take.mov' }));
    assert.equal(next.nodes.find(n => n.id === 'capture')!.upload!.bytes, 4);
    for (const id of ['capture', 'edit', 'preview', 'qa', 'final']) { assert.equal(next.nodes.find(n => n.id === id)!.status, 'stale'); assert.ok(next.nodes.find(n => n.id === id)!.output); }
    assert.equal(next.nodes.find(n => n.id === 'voice')!.status, 'approved');
    await assert.rejects(flows.upload(created.id, 'voice', request(Buffer.from('take'))), { statusCode: 400 });
  } finally { flows.shutdown(); store.close(); f.close(); }
});

test('oversized streamed upload drains without destroying the request before HTTP 413', async () => {
  const f = fixture();
  const stream = Object.assign(new PassThrough({ autoDestroy: false }), { headers: {
    'content-type': 'application/octet-stream', 'x-file-name': 'large.mp4',
  } });
  const req = stream as unknown as IncomingMessage;
  try {
    const uploading = receiveUpload(req, f.root, 5);
    stream.write(Buffer.from('123456'));
    await assert.rejects(uploading, { statusCode: 413 });
    assert.equal(req.destroyed, false, 'request must remain open so the handler can send 413');
    assert.deepEqual(readdirSync(f.root), [], 'partial upload must be removed');
    stream.end();
  } finally { req.destroy(); f.close(); }
});
