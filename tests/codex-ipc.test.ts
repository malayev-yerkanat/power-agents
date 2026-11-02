import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DesktopIpc, FrameDecoder, encodeFrame } from '../src/server/codex/ipc.ts';

test('desktop IPC handles fragmented and coalesced UTF-8 frames', () => {
  const decoder = new FrameDecoder();
  const a = { type: 'broadcast', value: 'Choose ✓' };
  const b = { type: 'response', requestId: '2' };
  const bytes = Buffer.concat([encodeFrame(a), encodeFrame(b)]);
  assert.deepEqual(decoder.push(bytes.subarray(0, 2)), []);
  assert.deepEqual(decoder.push(bytes.subarray(2, 7)), []);
  assert.deepEqual(decoder.push(bytes.subarray(7)), [a, b]);
});

test('desktop IPC authenticates local socket ownership and routes requests without exposing errors', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'codex-ipc-'));
  const path = join(dir, 'ipc.sock');
  const received: Record<string, unknown>[] = [];
  const server = createServer(socket => {
    const decoder = new FrameDecoder();
    socket.on('data', chunk => {
      for (const request of decoder.push(chunk)) {
        received.push(request);
        socket.write(encodeFrame({ type: 'response', requestId: request.requestId,
          resultType: request.method === 'bad' ? 'error' : 'success',
          result: request.method === 'initialize' ? { clientId: 'client-1' } : { ok: true },
          error: 'private content must never escape' }));
      }
    });
  });
  const ipc = new DesktopIpc(path, () => {}, () => {});
  try {
    writeFileSync(path, 'not a socket');
    await assert.rejects(ipc.connect(), /private and owned/);
    rmSync(path);
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(path, resolve); });
    chmodSync(path, 0o600);
    await ipc.connect();
    assert.deepEqual(await ipc.request('probe', {}, 'leader'), { ok: true });
    assert.equal(received[1].sourceClientId, 'client-1');
    assert.equal(received[1].targetClientId, 'leader');
    await assert.rejects(ipc.request('bad', {}), /^Error: Codex desktop rejected the request$/);
  } finally { ipc.close(); server.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('desktop IPC rejects oversized, invalid JSON, and non-object messages', () => {
  const header = Buffer.alloc(4); header.writeUInt32LE(16 * 1024 * 1024 + 1);
  assert.throws(() => new FrameDecoder().push(header), /size/);
  assert.throws(() => new FrameDecoder().push(Buffer.from([1, 0, 0, 0, 123])), /JSON/);
  assert.throws(() => new FrameDecoder().push(encodeFrame(null)), /object/);
  assert.throws(() => new FrameDecoder().push(encodeFrame([])), /object/);
});
