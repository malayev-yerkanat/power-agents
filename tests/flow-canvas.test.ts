import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compatiblePorts, toCanvas, isRunnable, patchNodes, nodeTitle, outputExcerpt } from '../src/client/flows/helpers.ts';
import { FlowInspector } from '../src/client/flows/FlowInspector.tsx';
import type { Flow, FlowRegistryNode } from '../src/shared/flow-types.ts';

const types: FlowRegistryNode[] = [
  { type: 'brand', title: 'Бренд', inputs: [], outputs: [{ name: 'brand', type: 'brand' }], gate: false, configDefaults: {} },
  { type: 'idea', title: 'Идея', inputs: [{ name: 'brand', type: 'brand' }], outputs: [{ name: 'idea', type: 'idea' }], gate: true, configDefaults: {} },
];
const flow: Flow = { id: 'test', title: 'Тест', mode: 'demo', autoRun: false, version: 3, createdAt: '', updatedAt: '',
  nodes: types.map((type, i) => ({ id: type.type, type: type.type, title: type.title, position: { x: i * 320, y: 10 },
    config: {}, gate: type.gate, status: 'idle', notes: [], version: 0 })),
  edges: [{ id: 'brand-idea', from: { node: 'brand', port: 'brand' }, to: { node: 'idea', port: 'brand' } }] };

test('ports accept the same kind or any output into a text input, direction matters', () => {
  assert.equal(compatiblePorts('brand', 'brand'), true);
  assert.equal(compatiblePorts('video', 'text'), true);
  assert.equal(compatiblePorts('text', 'video'), false);
  assert.equal(compatiblePorts('idea', 'script'), false);
  assert.equal(compatiblePorts(undefined, 'text'), false);
  assert.equal(compatiblePorts('text', undefined), false);
});

test('flow mapping preserves positions and named handles without mutating server data', () => {
  const original = structuredClone(flow);
  const mapped = toCanvas(flow, types);
  assert.equal(mapped.nodes[0].type, 'flowCard');
  assert.deepEqual(mapped.nodes[1].position, { x: 320, y: 10 });
  assert.equal(mapped.nodes[1].data.definition?.type, 'idea');
  assert.equal(mapped.nodes[1].data.runnable, false);
  assert.deepEqual(mapped.edges[0], { id: 'brand-idea', source: 'brand', target: 'idea', sourceHandle: 'brand', targetHandle: 'brand', type: 'default' });
  mapped.nodes[0].position.x = 99;
  assert.deepEqual(flow, original);
  assert.deepEqual(Object.keys(patchNodes(flow)[0]).sort(), ['config', 'gate', 'id', 'position', 'title', 'type']);
});

test('runnable follows approval and required/optional input rules, and blocks pending execution or decisions', () => {
  assert.equal(isRunnable(flow, flow.nodes[0], types[0]), true);
  assert.equal(isRunnable(flow, flow.nodes[1], types[1]), false);
  const approved: Flow = { ...flow, nodes: flow.nodes.map(n => n.id === 'brand' ? { ...n, status: 'approved' } : n) };
  assert.equal(isRunnable(approved, approved.nodes[1], types[1]), true);
  for (const status of ['queued', 'running', 'awaiting_approval'] as const)
    assert.equal(isRunnable(approved, { ...approved.nodes[1], status }, types[1]), false);
  assert.equal(isRunnable(flow, flow.nodes[0], undefined), false);
  const optional: FlowRegistryNode = { ...types[1], inputs: [{ name: 'brand', type: 'brand', optional: true }] };
  assert.equal(isRunnable({ ...flow, edges: [] }, flow.nodes[1], optional), true);
  assert.equal(isRunnable(flow, flow.nodes[1], optional), false);
});


test('default titles are Russian while user titles and output excerpts are preserved', () => {
  const definition = { ...types[0], title: 'Brand' };
  assert.equal(nodeTitle({ ...flow.nodes[0], title: 'Brand' }, definition), 'Бренд');
  assert.equal(nodeTitle({ ...flow.nodes[0], title: 'Мои правила' }, definition), 'Мои правила');
  assert.equal(outputExcerpt(undefined), 'Результат появится после запуска');
  assert.match(outputExcerpt({ score: 18 }), /"score": 18/);
  assert.equal(outputExcerpt('x'.repeat(300)).length, 261);
});

test('live idea and script excerpts show the chosen topic and hook without raw JSON', () => {
  const idea = { candidates: [{ topic: 'Skipped', hook: 'Skipped explained in Roblox' },
    { topic: 'Inflation', hook: 'Inflation explained in Roblox' }], chosen: 1 };
  assert.equal(outputExcerpt(idea, 'idea'), 'Inflation\nInflation explained in Roblox');
  assert.equal(outputExcerpt({ hook: 'Inflation explained in Roblox', wordCount: 142 }, 'script'),
    'Inflation explained in Roblox\n142 слов');
  assert.match(outputExcerpt({ candidates: [], chosen: 2 }, 'idea'), /"candidates"/);
  assert.equal(outputExcerpt('Demo script', 'script'), 'Demo script');
});

test('inspector offers auto and available connections while showing an unavailable saved choice', () => {
  const markup = renderToStaticMarkup(createElement(FlowInspector, {
    node: { ...flow.nodes[1], config: { connectionId: 'old' } },
    definition: { ...types[1], configDefaults: { connectionId: '' } }, pending: false,
    connections: [
      { id: 'claude', name: 'Claude Code', kind: 'claude-cli', available: true, detail: '' },
      { id: 'codex', name: 'Codex CLI', kind: 'codex-cli', available: false, detail: '' },
    ], save: async () => true, close: () => {},
  }));
  assert.match(markup, /<select aria-label="Подключение"/);
  assert.match(markup, /<option value="">Авто<\/option>/);
  assert.match(markup, /<option value="claude">Claude Code<\/option>/);
  assert.doesNotMatch(markup, /value="codex"/);
  assert.match(markup, /value="old" disabled="" selected="">old · недоступно/);
});
