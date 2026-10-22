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
      assert.equal(reopened.eventBatch(original.id, 0).length, 1);
      assert.equal(reopened.eventBatch(original.id, 0)[0].actorId, 'leader');
      assert.equal(reopened.eventBatch(original.id, 0)[0].message, created.message);
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
    assert.equal(store.eventBatch('run-1', 0).length, 1);
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
    assert.deepEqual(store.eventBatch('run-1', 0), []);
    store.createRun(run(), created);
    assert.throws(() => store.updateRun('run-1', value => ({ ...value, title: 'Must roll back' }), invalidEvent));
    assert.deepEqual(store.getRun('run-1'), run());
    assert.equal(store.eventBatch('run-1', 0).length, 1);
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
    assert.deepEqual(store.runSummaries().runs.map(value => value.id), ['new', 'old']);
    const events = store.eventBatch('old', 0);
    assert.equal(events.length, 2);
    assert.ok(events[0].id < events[1].id);
    assert.deepEqual(store.eventBatch('old', events[0].id), [events[1]]);
    assert.deepEqual(store.eventBatch('old', events[1].id), []);
    assert.deepEqual(store.eventBatch('missing', 0), []);
  } finally { store.close(); }
});

test('pages run summaries without loading large aggregates and finds only active runs', () => {
  const store = new Store(':memory:');
  try {
    for (let i = 0; i < 5; i += 1) {
      const id = `run-${i}`;
      store.createRun({ ...run(id, `2026-10-0${i + 1}T00:00:00.000Z`),
        title: `Run ${i}`, artifacts: [{ id: 'big', title: 'Big', body: 'x'.repeat(2000), authorId: 'leader', kind: 'work', createdAt: '2026-10-01T00:00:00.000Z' }] }, created);
    }
    store.updateRun('run-1', value => ({ ...value, status: 'completed' }), created);
    const first = store.runSummaries(undefined, 2);
    assert.deepEqual(first.runs.map(value => value.id), ['run-4', 'run-3']);
    assert.equal(first.nextCursor, 'run-3');
    assert.equal(first.totalRuns, 5);
    assert.deepEqual(Object.keys(first.runs[0]).sort(), ['createdAt', 'id', 'mode', 'status', 'title', 'updatedAt', 'version']);
    const second = store.runSummaries(first.nextCursor, 2);
    assert.deepEqual(second.runs.map(value => value.id), ['run-2', 'run-1']);
    assert.equal(second.nextCursor, 'run-1');
    assert.deepEqual(store.runSummaries(second.nextCursor, 2).runs.map(value => value.id), ['run-0']);
    assert.deepEqual(store.listActiveRuns().map(value => value.id), ['run-4', 'run-3', 'run-2', 'run-0']);
    assert.equal(store.hasActiveRun(), true);
    assert.equal(store.hasActiveRun('run-4'), true);
    assert.throws(() => store.runSummaries('missing', 2), /cursor/i);
  } finally { store.close(); }
});

test('run history cursor stays deterministic when creation timestamps tie', () => {
  const store = new Store(':memory:');
  try {
    for (const id of ['a', 'c', 'b']) store.createRun(run(id), created);
    const first = store.runSummaries(undefined, 2);
    assert.deepEqual(first.runs.map(value => value.id), ['c', 'b']);
    assert.deepEqual(store.runSummaries(first.nextCursor, 2).runs.map(value => value.id), ['a']);
  } finally { store.close(); }
});

test('pages recent and older events and streams global event batches in ID order', () => {
  const store = new Store(':memory:');
  try {
    store.createRun(run('a'), created);
    store.createRun(run('b'), created);
    for (let i = 0; i < 5; i += 1) store.updateRun('a', value => value, { type: 'changed', message: String(i) });
    const recent = store.eventHistory('a', undefined, 2);
    assert.deepEqual(recent.events.map(value => value.message), ['3', '4']);
    assert.ok(recent.before);
    const older = store.eventHistory('a', recent.before, 2);
    assert.deepEqual(older.events.map(value => value.message), ['1', '2']);
    assert.deepEqual(store.eventHistory('a', older.before, 2).events.map(value => value.message), ['Run created', '0']);
    const global = store.eventBatch(undefined, 0, 3);
    assert.deepEqual(global.map(value => value.id), [1, 2, 3]);
    assert.deepEqual(store.eventBatch(undefined, global.at(-1)!.id, 3).map(value => value.id), [4, 5, 6]);
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
        && store.eventBatch(event.runId, 0).at(-1)?.id === event.id;
      event.message = 'subscriber mutation';
      throw new Error('listener failure');
    });
    store.subscribe(event => { received.push(event.message); });
    assert.doesNotThrow(() => store.createRun(run(), created));
    assert.ok(committedBeforeNotification);
    assert.equal(errorLog.mock.callCount(), 1);
    assert.deepEqual(received, ['Run created']);
    assert.equal(store.eventBatch('run-1', 0)[0].message, 'Run created');
    unsubscribe();
    store.updateRun('run-1', value => value, { type: 'next', message: 'Next event' });
    assert.deepEqual(received, ['Run created', 'Next event']);
    assert.equal(errorLog.mock.callCount(), 1);
  } finally { store.close(); }
});

test('a second coordinator cannot open the same database while the first is running', () => {
  const directory = mkdtempSync(join(tmpdir(), 'power-agents-single-'));
  const path = join(directory, 'runs.sqlite');
  const first = new Store(path);
  try {
    first.createRun(run(), created);
    assert.throws(() => new Store(path), /locked|busy/i);
    assert.equal(first.getRun('run-1')?.status, 'planning');
  } finally { first.close(); rmSync(directory, { recursive: true, force: true }); }
});
