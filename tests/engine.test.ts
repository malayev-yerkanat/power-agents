import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store.ts';
import { Engine } from '../src/server/engine.ts';
import { parsePlan } from '../src/server/core/protocol.ts';
import { demoRunner } from '../src/server/core/demo.ts';
import type { CreateRunInput, Run, TurnRunner } from '../src/shared/types.ts';
const input: CreateRunInput = { goal: 'Подготовить план небольшого проекта', mode: 'demo', leaderId: 'a', members: [
  { id: 'a', name: 'Агент А', connectionId: 'codex', model: '', role: '' },
  { id: 'b', name: 'Агент Б', connectionId: 'claude', model: '', role: '' },
] };
async function until(get: () => Run, predicate: (run: Run) => boolean): Promise<Run> {
  for (let i = 0; i < 1000; i++) { const run = get(); if (predicate(run)) return run; await new Promise(r => setTimeout(r, 10)); }
  throw new Error(`Timed out: ${JSON.stringify(get())}`);
}
function setup(runner?: TurnRunner) {
  const path = mkdtempSync(join(tmpdir(), 'power-engine-'));
  const store = new Store(':memory:');
  const engine = new Engine({ store, connections: [], workspaceRoot: path, demoRunner: runner ?? (async value => {
    // Demo timing is deliberately bypassed only in the scheduler tests.
    return demoRunner(value);
  }) });
  return { store, engine, clean: () => { engine.shutdown(); store.close(); rmSync(path, { recursive: true, force: true }); } };
}
test('approval barrier, peer question/answer, dependent work and independent review', async () => {
  const { engine, store, clean } = setup();
  try {
    const created = engine.create(input);
    const get = () => store.getRun(created.id)!;
    const proposed = await until(get, r => r.status === 'awaiting_approval');
    assert.equal(proposed.tasks.length, 0);
    assert.throws(() => engine.approve(created.id, proposed.version - 1), /обновлён/);
    engine.approve(created.id, proposed.version);
    const complete = await until(get, r => r.status === 'completed');
    assert.ok(complete.tasks.every(t => t.status === 'completed'));
    assert.ok(complete.messages.some(m => m.request && m.status === 'answered'));
    assert.ok(complete.messages.some(m => m.replyTo));
    assert.notEqual(complete.artifacts.find(a => a.kind === 'review')?.authorId, complete.leaderId);
  } finally { clean(); }
});
test('cancellation ignores a late provider response', async () => {
  let release!: (value: { text: string }) => void;
  const runner: TurnRunner = () => new Promise(resolve => { release = resolve; });
  const { engine, store, clean } = setup(runner);
  try {
    const run = engine.create(input);
    await new Promise(r => setTimeout(r, 20));
    engine.control(run.id, 'cancel');
    release({ text: '{}' });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(store.getRun(run.id)?.status, 'cancelled');
    assert.equal(store.getRun(run.id)?.plan, undefined);
  } finally { clean(); }
});
test('cyclic plan and duplicate members rejected', () => {
  const plan = { summary: 'plan', successCriteria: ['yes'], roles: [{ memberId: 'a', role: 'lead' }, { memberId: 'b', role: 'review' }], tasks: [{ id: 'x', title: 'x', description: 'x', assigneeId: 'a', dependsOn: ['x'] }] };
  assert.throws(() => parsePlan(JSON.stringify(plan), ['a', 'b']), /цикл/);
  const { engine, clean } = setup();
  try { assert.throws(() => engine.create({ ...input, members: [input.members[0], input.members[0]] }), /уникальные/); }
  finally { clean(); }
});
