import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CodexBridge } from '../src/server/codex/bridge.ts';

function fixture() {
  const follows: unknown[][] = [], cancelled: (string | undefined)[] = [], synced: unknown[][] = [];
  const ipc = { connect: async () => {}, close() {}, follow: (...args: unknown[]) => follows.push(args),
    request: async () => ({ owner: 'desktop' }) };
  const requests = { sync: (...args: unknown[]) => synced.push(args), cancel: (id?: string) => cancelled.push(id) };
  const bridge = new CodexBridge({ socketPath: '/unused', threadIds: () => ['thread'], ready: () => true,
    requests, createIpc: () => ipc });
  return { bridge, follows, cancelled, synced };
}
const snapshot = (overrides = {}) => ({ type: 'broadcast', sourceClientId: 'desktop', version: 11,
  method: 'thread-stream-state-changed', params: { hostId: 'local', conversationId: 'thread',
    change: { type: 'snapshot', revision: 1, conversationState: { id: 'thread', cwd: '/project', requests: [] } } }, ...overrides });

test('bridge follows known local owners and ignores foreign or incompatible snapshots', async () => {
  const f = fixture(); await f.bridge.tick();
  assert.deepEqual(f.follows, [['thread', 'desktop']]);
  f.bridge.receive(snapshot({ sourceClientId: 'stranger' }));
  assert.equal(f.synced.length, 0);
  f.bridge.receive(snapshot());
  assert.deepEqual(f.synced, [['thread', '/project', []]]);
  f.bridge.receive(snapshot({ version: 12 }));
  assert.ok(f.cancelled.includes('thread'));
  f.bridge.stop();
});

test('request patches expire Telegram choices before requesting a fresh snapshot', async () => {
  const f = fixture(); await f.bridge.tick(); f.bridge.receive(snapshot());
  f.bridge.receive({ ...snapshot(), params: { hostId: 'local', conversationId: 'thread', change: {
    type: 'patches', baseRevision: 1, revision: 2, patches: [{ op: 'remove', path: ['requests', 0] }],
  } } });
  assert.ok(f.cancelled.includes('thread'));
  assert.equal(f.follows.length, 2);
  f.bridge.disconnected();
  assert.equal(f.cancelled.at(-1), undefined);
  f.bridge.stop();
});

test('unrelated clients do not cancel prompts; only an owner disconnect does', async () => {
  const f = fixture(); await f.bridge.tick();
  for (const params of [{ clientId: 'other', status: 'disconnected' }, { clientId: 'desktop', status: 'connected' }]) {
    f.bridge.receive({ type: 'broadcast', method: 'client-status-changed', params });
  }
  assert.equal(f.cancelled.length, 0);
  f.bridge.receive({ type: 'broadcast', method: 'client-status-changed', params: { clientId: 'desktop', status: 'disconnected' } });
  assert.deepEqual(f.cancelled, ['thread']); f.bridge.stop();
});

test('canonical question patches refresh snapshots while text deltas do not', async () => {
  const f = fixture(); await f.bridge.tick(); f.bridge.receive(snapshot());
  const patch = (revision: number, path: string[]) => ({ ...snapshot(), params: { hostId: 'local', conversationId: 'thread',
    change: { type: 'patches', baseRevision: revision - 1, revision, patches: [{ op: 'replace', path }] } } });
  f.bridge.receive(patch(2, ['turnHistory', 'history', 'entitiesByKey', 'turn', 'items', '0', 'text']));
  assert.equal(f.follows.length, 1);
  f.bridge.receive(patch(3, ['turnHistory', 'history', 'entitiesByKey', 'turn', 'items', '0', 'questions']));
  await new Promise(resolve => setTimeout(resolve, 130));
  assert.equal(f.follows.length, 2);
  assert.equal(f.cancelled.length, 0); f.bridge.stop();
});
