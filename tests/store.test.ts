import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Store } from '../src/server/store.ts';
import type { Run } from '../src/shared/types.ts';

function run(id = 'run-1', createdAt = '2026-10-07T00:00:00.000Z'): Run {
  return {
    id, title: 'Research', goal: 'Find an answer', status: 'planning', members: [],
    leaderId: 'leader', tasks: [], messages: [], artifacts: [], sessions: {},
    turnCount: 0, reviewRound: 0, phase: 'plan', createdAt, updatedAt: createdAt,
    version: 1, mode: 'demo',
  };
}

const created = { type: 'created', message: 'Run created', actorId: 'leader' };

test('creates parent directories and persists aggregates and events across reopening', () => {
  const directory = mkdtempSync(join(tmpdir(), 'power-agents-store-'));
  const path = join(directory, 'nested', 'runs.sqlite');
  try {
    const first = new Store(path);
    const original = run();
    assert.deepEqual(first.createRun(original, created), original);
    first.close();
    const reopened = new Store(path);
    try {
      assert.deepEqual(reopened.getRun(original.id), original);
      assert.equal(reopened.events(original.id).length, 1);
      assert.equal(reopened.events(original.id)[0].actorId, 'leader');
      assert.equal(reopened.events(original.id)[0].message, created.message);
    } finally { reopened.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('duplicate creation and failed updates roll back without publishing events', () => {
  const store = new Store(':memory:');
  try {
    let notifications = 0;
    store.subscribe(() => { notifications += 1; });
    store.createRun(run(), created);
    assert.throws(() => store.createRun({ ...run(), title: 'Duplicate' }, created));
    assert.throws(() => store.updateRun('run-1', () => { throw new Error('abort'); }, created));
    assert.throws(() => store.updateRun('missing', value => value, created), /not found/i);
    assert.throws(() => store.updateRun('run-1', value => ({ ...value, id: 'changed' }), created));
    assert.deepEqual(store.getRun('run-1'), run());
    assert.equal(store.events('run-1').length, 1);
    assert.equal(notifications, 1);
    assert.equal(store.updateRun('run-1', value => ({ ...value, title: 'Retry' }), created).title, 'Retry');
  } finally { store.close(); }
});

test('an event insert failure rolls back its aggregate insert or update', () => {
  const store = new Store(':memory:');
  const invalidEvent = { type: undefined, message: 'Invalid' } as unknown as typeof created;
  try {
    assert.throws(() => store.createRun(run(), invalidEvent));
    assert.equal(store.getRun('run-1'), undefined);
    assert.deepEqual(store.events('run-1'), []);
    store.createRun(run(), created);
    assert.throws(() => store.updateRun('run-1', value => ({ ...value, title: 'Must roll back' }), invalidEvent));
    assert.deepEqual(store.getRun('run-1'), run());
    assert.equal(store.events('run-1').length, 1);
  } finally { store.close(); }
});

test('updates versions and timestamps while preserving caller and stored snapshots', () => {
  const store = new Store(':memory:');
  try {
    const original = run();
    const saved = store.createRun(original, created);
    saved.sessions.bad = 'saved';
    original.sessions.bad = 'original';
    const read = store.getRun(original.id)!;
    read.sessions.bad = 'read';
    store.listRuns()[0].sessions.bad = 'listed';
    assert.deepEqual(store.getRun(original.id)?.sessions, {});
    const updated = store.updateRun(original.id, value => ({
      ...value, version: 999, updatedAt: 'old', status: 'running',
      sessions: { agent: 'session' },
    }), { type: 'started', message: 'Started' });
    assert.equal(updated.version, 2);
    assert.ok(updated.updatedAt > original.updatedAt);
    updated.sessions.agent = 'changed';
    assert.equal(store.getRun(original.id)?.sessions.agent, 'session');
    const next = store.updateRun(original.id, value => value, created);
    assert.equal(next.version, 3);
    assert.ok(next.updatedAt > updated.updatedAt);
    assert.equal(store.getRun('missing'), undefined);
  } finally { store.close(); }
});

test('orders runs newest first and filters ascending event IDs exclusively per run', () => {
  const store = new Store(':memory:');
  try {
    store.createRun(run('old'), created);
    store.createRun(run('new', '2026-10-08T00:00:00.000Z'), created);
    store.updateRun('old', value => value, { type: 'changed', message: 'Changed' });
    assert.deepEqual(store.listRuns().map(value => value.id), ['new', 'old']);
    const events = store.events('old');
    assert.equal(events.length, 2);
    assert.ok(events[0].id < events[1].id);
    assert.deepEqual(store.events('old', events[0].id), [events[1]]);
    assert.deepEqual(store.events('old', events[1].id), []);
    assert.deepEqual(store.events('missing'), []);
  } finally { store.close(); }
});

test('notifies only after commit, isolates subscribers, and supports unsubscribe', context => {
  const store = new Store(':memory:');
  const errorLog = context.mock.method(console, 'error', () => {});
  try {
    const received: string[] = [];
    let committedBeforeNotification = false;
    const unsubscribe = store.subscribe(event => {
      committedBeforeNotification = !!store.getRun(event.runId)
        && store.events(event.runId).at(-1)?.id === event.id;
      event.message = 'subscriber mutation';
      throw new Error('listener failure');
    });
    store.subscribe(event => { received.push(event.message); });
    assert.doesNotThrow(() => store.createRun(run(), created));
    assert.ok(committedBeforeNotification);
    assert.equal(errorLog.mock.callCount(), 1);
    assert.deepEqual(received, ['Run created']);
    assert.equal(store.events('run-1')[0].message, 'Run created');
    unsubscribe();
    store.updateRun('run-1', value => value, { type: 'next', message: 'Next event' });
    assert.deepEqual(received, ['Run created', 'Next event']);
    assert.equal(errorLog.mock.callCount(), 1);
  } finally { store.close(); }
});
