import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store.ts';
import { FlowEngine } from '../src/server/flows/engine.ts';
import { registry, demoExecutor, robloxReel, type Executor } from '../src/server/flows/registry.ts';
import type { Flow, FlowEdge, FlowPatch } from '../src/shared/flow-types.ts';
const node = (id: string, type = id, gate = registry[type].gate): FlowPatch['nodes'] extends (infer T)[] | undefined ? T : never =>
  ({ id, type, title: id, position: { x: 0, y: 0 }, config: {}, gate });
const edge = (from: string, to: string, port = from, target = port): FlowEdge => ({ id: `${from}-${to}-${target}`, from: { node: from, port }, to: { node: to, port: target } });
async function until(get: () => Flow, predicate: (flow: Flow) => boolean) {
  for (let i = 0; i < 500; i++) { const flow = get(); if (predicate(flow)) return flow; await new Promise(r => setTimeout(r, 5)); }
  throw new Error(`Timed out: ${JSON.stringify(get())}`);
}
function setup(executors?: Record<string, Executor>, maxConcurrent?: number) {
  const root = mkdtempSync(join(tmpdir(), 'power-flow-'));
  const store = new Store(':memory:');
  const engine = new FlowEngine({ store, root, executors, maxConcurrent });
  const create = (nodes: NonNullable<FlowPatch['nodes']>, edges: FlowEdge[] = [], autoRun = false, mode: 'live' | 'demo' = 'demo') => {
    const f = engine.create({ title: 'Flow', mode });
    return engine.update(f.id, { version: f.version, nodes, edges, autoRun });
  };
  return { root, store, engine, create, clean: () => { engine.shutdown(); store.close(); rmSync(root, { recursive: true, force: true }); } };
}
const status = (flow: Flow, id: string) => flow.nodes.find(n => n.id === id)!.status;
test('gates block downstream, approval unlocks, rejection carries notes and increments version', async () => {
  const { engine, store, create, clean, root } = setup();
  try {
    const f = create([node('brand'), node('idea')], [edge('brand', 'idea')]);
    const get = () => store.getFlow(f.id)!;
    assert.throws(() => engine.run(f.id, 'idea'), /ready/i);
    engine.run(f.id, 'brand');
    await until(get, f => status(f, 'brand') === 'approved');
    engine.run(f.id, 'idea');
    await until(get, f => status(f, 'idea') === 'awaiting_approval');
    assert.throws(() => engine.run(f.id, 'idea'), /approval/i);
    engine.reject(f.id, 'idea', 'Make it about physics');
    const retry = await until(get, f => status(f, 'idea') === 'awaiting_approval' && f.nodes[1].version === 2);
    assert.match(JSON.stringify(retry.nodes[1].output), /physics/);
    assert.ok(existsSync(join(root, f.id, 'idea', 'v2')));
    engine.approve(f.id, 'idea');
    assert.equal(status(get(), 'idea'), 'approved');
    assert.deepEqual(store.nodeRuns(f.id).map(r => r.status), ['done', 'done', 'done']);
    assert.equal(get().nodes[1].inputHash?.length, 64);
  } finally { clean(); }
});
test('autoRun chains until gates and marks old output stale on config change and re-approval', async () => {
  const { engine, store, create, clean } = setup();
  try {
    const f = create([node('brand'), node('idea'), node('script')], [edge('brand', 'idea'), edge('brand', 'script'), edge('idea', 'script')], true);
    const get = () => store.getFlow(f.id)!;
    await until(get, f => status(f, 'idea') === 'awaiting_approval');
    assert.equal(status(get(), 'script'), 'idle');
    engine.approve(f.id, 'idea');
    await until(get, f => status(f, 'script') === 'awaiting_approval');
    engine.approve(f.id, 'script');
    const before = get();
    const changed = engine.update(f.id, { version: before.version, autoRun: false, nodes: before.nodes.map(n => n.id === 'brand' ? { ...n, config: { text: 'New brand' } } : n) });
    assert.deepEqual(changed.nodes.map(n => n.status), ['stale', 'stale', 'stale']);
    assert.deepEqual(changed.nodes[2].output, before.nodes[2].output);
    assert.throws(() => engine.update(f.id, { version: before.version, title: 'Old' }), /version/i);
    engine.run(f.id, 'brand');
    await until(get, f => status(f, 'brand') === 'approved');
    engine.run(f.id, 'idea');
    await until(get, f => status(f, 'idea') === 'awaiting_approval');
    engine.approve(f.id, 'idea');
    assert.equal(status(get(), 'script'), 'stale');
    assert.notEqual(get().nodes[1].inputHash, before.nodes[1].inputHash);
  } finally { clean(); }
});
test('restart fails running and queued nodes and histories without rerunning', async () => {
  let calls = 0;
  const pending: Executor = () => { calls++; return new Promise(() => {}); };
  const { root, engine, store, create, clean } = setup({ prompt: pending }, 1);
  try {
    const f = create([node('one', 'prompt'), node('two', 'prompt')]);
    engine.run(f.id, 'one'); engine.run(f.id, 'two');
    await until(() => store.getFlow(f.id)!, f => status(f, 'one') === 'running');
    engine.shutdown();
    const restarted = new FlowEngine({ store, root, executors: { prompt: pending } });
    try {
      const recovered = store.getFlow(f.id)!;
      assert.ok(recovered.nodes.every(n => n.status === 'failed' && /interrupted, run again/.test(n.error!)));
      assert.equal(store.nodeRuns(f.id)[0].status, 'failed');
      await new Promise(r => setTimeout(r, 20));
      assert.equal(calls, 1);
    } finally { restarted.shutdown(); }
  } finally { clean(); }
});
test('validates graph cycles, port types, duplicate inputs, ids, configs and node types', () => {
  const { create, clean } = setup();
  try {
    assert.throws(() => create([node('a', 'prompt'), node('b', 'prompt')], [edge('a', 'b', 'text')]), /port/i);
    assert.throws(() => create([node('a', 'brand'), node('b', 'idea')], [edge('a', 'b', 'brand', 'brand'), { ...edge('a', 'b', 'brand', 'brand'), id: 'duplicate' }]), /duplicate/i);
    assert.throws(() => create([node('a', 'brand'), node('b', 'script')], [edge('a', 'b', 'brand', 'idea')]), /type/i);
    assert.throws(() => create([node('a', 'preview')], [edge('a', 'a', 'video', 'video')]), /cycle/i);
    assert.throws(() => create([{ ...node('a', 'prompt'), type: 'missing' }]), /type/i);
    assert.throws(() => create([node('../escape', 'prompt')]), /id/i);
    assert.throws(() => create([{ ...node('p', 'prompt'), config: { text: 42 } }]), /string/i);
    assert.throws(() => create([node('p', 'prompt'), node('p', 'prompt')]), /duplicate/i);
  } finally { clean(); }
});
test('global concurrency spans flows and render lane serializes preview and final', async () => {
  const releases: (() => void)[] = [];
  let active = 0, peak = 0, renders = 0, renderPeak = 0;
  const slow: Executor = async ctx => {
    active++; peak = Math.max(peak, active);
    const render = ctx.node.type === 'preview' || ctx.node.type === 'final';
    if (render) { renders++; renderPeak = Math.max(renderPeak, renders); }
    await new Promise<void>(resolve => releases.push(resolve));
    active--; if (render) renders--;
    return demoExecutor(ctx);
  };
  const { engine, store, create, clean } = setup({ prompt: slow, preview: slow, final: slow }, 2);
  try {
    const f = create([node('p', 'prompt'), node('q', 'prompt')]);
    const second = create([node('r', 'prompt')]);
    for (const [id, n] of [[f.id, 'p'], [f.id, 'q'], [second.id, 'r']]) engine.run(id, n);
    await until(() => store.getFlow(f.id)!, () => releases.length === 2);
    assert.equal(status(store.getFlow(second.id)!, 'r'), 'queued');
    releases.splice(0).forEach(r => r());
    await until(() => store.getFlow(second.id)!, () => releases.length === 1);
    releases.splice(0).forEach(r => r());
    await until(() => store.getFlow(second.id)!, f => status(f, 'r') === 'approved');
    const template = engine.create({ title: 'Reel', mode: 'demo', template: 'roblox-reel' });
    store.updateFlow(template.id, f => ({ ...f, nodes: f.nodes.map(n => ({ ...n, status: ['preview', 'final'].includes(n.id) ? 'idle' : 'approved', output: Object.fromEntries(registry[n.type].outputs.map(p => [p.name, { value: p.name }])) })) }), { type: 'seed', message: 'approved dependencies' });
    const finalFlow = engine.create({ title: 'Final', mode: 'demo', template: 'roblox-reel' });
    store.updateFlow(finalFlow.id, f => ({ ...f, nodes: f.nodes.map(n => ({ ...n, status: n.id === 'final' ? 'idle' : 'approved', output: Object.fromEntries(registry[n.type].outputs.map(p => [p.name, { value: p.name }])) })) }), { type: 'seed', message: 'approved dependencies' });
    engine.run(template.id, 'preview'); engine.run(finalFlow.id, 'final');
    await until(() => store.getFlow(template.id)!, () => releases.length === 1);
    assert.equal(renders, 1);
    releases.splice(0).forEach(r => r());
    await until(() => store.getFlow(template.id)!, () => releases.length === 1);
    releases.splice(0).forEach(r => r());
    await until(() => store.getFlow(finalFlow.id)!, f => status(f, 'final') === 'awaiting_approval');
    assert.equal(peak, 2); assert.equal(renderPeak, 1);
  } finally { releases.splice(0).forEach(r => r()); clean(); }
});
test('template includes all typed ports and final waits on QA; live missing executor fails clearly', async () => {
  const { engine, store, create, clean } = setup();
  try {
    const f = engine.create({ title: 'Reel', mode: 'demo', template: 'roblox-reel' });
    assert.equal(f.nodes.length, 10);
    assert.equal(registry.qa.gate, false);
    assert.deepEqual(registry.voice.outputs.map(p => p.name), ['audio', 'timings']);
    assert.ok(f.edges.some(e => e.from.node === 'qa' && e.to.node === 'final' && e.to.port === 'report'));
    assert.equal(robloxReel().nodes[0].status, 'idle');
    const live = create([node('p', 'prompt')], [], false, 'live');
    engine.run(live.id, 'p');
    const failed = await until(() => store.getFlow(live.id)!, f => status(f, 'p') === 'failed');
    assert.match(failed.nodes[0].error!, /not available until F3\/F4/);
    assert.equal(store.nodeRuns(live.id)[0].status, 'failed');
  } finally { clean(); }
});
test('refuses edits during queued/running execution and ignores late results after invalidation', async () => {
  let release!: () => void;
  const { engine, store, create, clean } = setup({ idea: async ctx => { await new Promise<void>(r => { release = r; }); return demoExecutor(ctx); } });
  try {
    const f = create([node('brand'), node('idea')], [edge('brand', 'idea')]);
    const get = () => store.getFlow(f.id)!;
    engine.run(f.id, 'brand'); await until(get, f => status(f, 'brand') === 'approved');
    engine.run(f.id, 'idea'); await until(get, f => status(f, 'idea') === 'running');
    assert.throws(() => engine.run(f.id, 'idea'), /running/i);
    assert.throws(() => engine.update(f.id, { version: get().version, nodes: get().nodes.map(n => n.id === 'idea' ? { ...n, config: { topic: 'change' } } : n) }), /running/i);
    engine.update(f.id, { version: get().version, nodes: get().nodes.map(n => n.id === 'brand' ? { ...n, config: { text: 'change' } } : n) });
    release(); await new Promise(r => setTimeout(r, 20));
    assert.notEqual(status(get(), 'idea'), 'awaiting_approval');
    assert.equal(get().nodes[1].output, undefined);
    assert.equal(store.nodeRuns(f.id)[0].status, 'failed');
  } finally { clean(); }
});
test('recovery includes flows outside list pagination and all unfinished history', () => {
  const { engine, root, store, create, clean } = setup();
  try {
    const f = create([node('p', 'prompt')]);
    store.updateFlow(f.id, f => ({ ...f, createdAt: '2000-01-01', nodes: f.nodes.map(n => ({ ...n, status: 'running' })) }), { type: 'seed', message: 'interrupted' });
    for (let i = 0; i < 101; i++) store.startNodeRun(f.id, 'p', i, 'hash');
    for (let i = 0; i < 201; i++) store.createFlow({ ...f, id: `newer-${i}` });
    assert.equal(store.listFlows().some(s => s.id === f.id), false);
    engine.shutdown();
    const recovered = new FlowEngine({ store, root });
    try {
      assert.equal(status(store.getFlow(f.id)!, 'p'), 'failed');
      assert.ok(store.nodeRuns(f.id, 200).every(r => r.status === 'failed'));
    } finally { recovered.shutdown(); }
  } finally { clean(); }
});
