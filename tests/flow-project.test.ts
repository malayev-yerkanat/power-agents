import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store.ts';
import { FlowEngine } from '../src/server/flows/engine.ts';
import { prepareReelFolder, projectDir, projectsRoot, slug, stageName } from '../src/server/flows/project.ts';
import { parseBrandFiles } from '../src/client/flows/brands.ts';
import type { Flow, FlowNode } from '../src/shared/flow-types.ts';

async function until(get: () => Flow, predicate: (flow: Flow) => boolean) {
  for (let i = 0; i < 500; i++) { const flow = get(); if (predicate(flow)) return flow; await new Promise(r => setTimeout(r, 5)); }
  throw new Error(`Timed out: ${JSON.stringify(get())}`);
}
const status = (flow: Flow, id: string) => flow.nodes.find(n => n.id === id)!.status;
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'power-project-'));
  const projects = join(dir, 'projects'), root = join(dir, 'flows');
  mkdirSync(join(projects, 'reel-channel'), { recursive: true });
  const store = new Store(':memory:');
  const engine = new FlowEngine({ store, root, projectsRoot: projects });
  return { dir, projects, root, store, engine, clean: () => { engine.shutdown(); store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

test('parseBrandFiles reads a brand guide and brand.json like the content project brand folder', () => {
  const both = parseBrandFiles([{ name: 'brand-guide.md', text: '# Explained in ROBLOX: brand guide\n\nVoice: deadpan.' },
    { name: 'brand.json', text: '{"name":"Explained in ROBLOX","colors":{"accent":"#FFC814"}}' }]);
  assert.equal(both.name, 'Explained in ROBLOX');
  assert.match(both.guide, /deadpan/);
  assert.deepEqual(both.settings, { name: 'Explained in ROBLOX', colors: { accent: '#FFC814' } });
  assert.equal(parseBrandFiles([{ name: 'guide.md', text: '# Space Facts — brand guide\nRules' }]).name, 'Space Facts');
  assert.equal(parseBrandFiles([{ name: 'notes.txt', text: 'no heading' }]).name, 'notes');
  assert.throws(() => parseBrandFiles([{ name: 'brand.json', text: '{oops' }]), /JSON/);
  assert.throws(() => parseBrandFiles([{ name: 'brand.json', text: '[1]' }]), /JSON/);
  assert.throws(() => parseBrandFiles([{ name: 'logo.png', text: '' }]), /\.md/);
});

test('projects folder comes from CONTENT_PROJECTS_DIR or three levels above REEL_PIPELINE_DIR; names cannot leave it', async () => {
  assert.equal(projectsRoot({ CONTENT_PROJECTS_DIR: '/c/projects', REEL_PIPELINE_DIR: '/x/p/pipeline/stages' }), '/c/projects');
  assert.equal(projectsRoot({ REEL_PIPELINE_DIR: '/c/projects/p1/pipeline/stages' }), '/c/projects');
  assert.equal(projectsRoot({}), undefined);
  assert.equal(slug('Reel 002: Food Chain!'), 'reel-002-food-chain');
  assert.equal(slug('Ролик'), 'flow');
  const { projects, dir, clean } = setup();
  try {
    mkdirSync(join(dir, 'outside'));
    symlinkSync(join(dir, 'outside'), join(projects, 'escape'));
    await assert.rejects(projectDir('../outside', projects), /Invalid project/);
    await assert.rejects(projectDir('escape', projects), /outside the projects folder/);
    await assert.rejects(projectDir('missing', projects), /not found/);
    await assert.rejects(projectDir('', projects), /Choose a project/);
    assert.equal(stageName({ id: 'voice', type: 'voice' } as FlowNode), '04-voice');
    assert.equal(stageName({ id: 'abcdef1234', type: 'prompt' } as FlowNode), '99-prompt-abcdef12');
  } finally { clean(); }
});

test('a reel folder is reused by its own flow, never by another flow or a folder made by hand', async () => {
  const { projects, clean } = setup();
  try {
    const flow = { id: 'flow-one-id', title: 'Reel 002' } as Flow;
    const first = await prepareReelFolder(flow, 'reel-channel', projects);
    assert.equal(first.path, 'reels/reel-002');
    assert.deepEqual(await prepareReelFolder(flow, 'reel-channel', projects), first);
    const other = await prepareReelFolder({ id: 'flow-two-id', title: 'Reel 002' } as Flow, 'reel-channel', projects);
    assert.equal(other.path, 'reels/reel-002-flow-two');
    mkdirSync(join(projects, 'reel-channel', 'reels', 'manual'));
    writeFileSync(join(projects, 'reel-channel', 'reels', 'manual', 'keep.txt'), 'mine');
    assert.equal((await prepareReelFolder({ id: 'flow-three', title: 'Manual' } as Flow, 'reel-channel', projects)).path, 'reels/manual-flow-thr');
  } finally { clean(); }
});

test('live Project and Brand nodes create the reel folder and copy approved output into stage folders', async () => {
  const { store, engine, projects, clean } = setup();
  try {
    const brand = store.saveBrand({ name: 'Explained in ROBLOX', guide: '# Guide\nDeadpan.', settings: { colors: { accent: '#FFC814' } } })!;
    const created = engine.create({ title: 'Reel 002', mode: 'live' });
    const node = (id: string, config: Record<string, unknown>) => ({ id, type: id, title: id, position: { x: 0, y: 0 }, config, gate: false });
    const f = engine.update(created.id, { version: created.version,
      nodes: [node('project', { project: 'reel-channel' }), node('brand', { brandId: brand.id, text: 'Extra note' })] });
    const get = () => store.getFlow(f.id)!;
    engine.run(f.id, 'brand');
    const branded = await until(get, flow => status(flow, 'brand') === 'approved');
    assert.deepEqual(branded.nodes[1].output?.brand.value, { name: 'Explained in ROBLOX', guide: '# Guide\nDeadpan.',
      settings: { colors: { accent: '#FFC814' } }, accent: '#FFC814', text: 'Extra note', rules: [] });
    // Brand was approved before the project folder existed; approving Project copies it then.
    engine.run(f.id, 'project');
    const done = await until(get, flow => status(flow, 'project') === 'approved');
    await engine.exported();
    const reel = join(realpathSync(projects), 'reel-channel', 'reels', 'reel-002');
    assert.deepEqual(done.nodes[0].output?.project.value, { project: 'reel-channel', folder: reel, path: 'reels/reel-002' });
    assert.equal(readFileSync(join(reel, '01-brand', 'brand-guide.md'), 'utf8'), '# Guide\nDeadpan.');
    assert.deepEqual(JSON.parse(readFileSync(join(reel, '01-brand', 'brand.json'), 'utf8')), { colors: { accent: '#FFC814' } });
    assert.ok(!existsSync(join(reel, '00-project')));
    store.deleteBrand(brand.id);
    engine.run(f.id, 'brand');
    const failed = await until(get, flow => status(flow, 'brand') === 'failed');
    assert.match(failed.nodes[1].error!, /Бренд не найден/);
  } finally { clean(); }
});

test('a missing project choice fails the Project node with a clear message', async () => {
  const { store, engine, clean } = setup();
  try {
    const created = engine.create({ title: 'Reel', mode: 'live' });
    const f = engine.update(created.id, { version: created.version,
      nodes: [{ id: 'project', type: 'project', title: 'Project', position: { x: 0, y: 0 }, config: {}, gate: false }] });
    engine.run(f.id, 'project');
    const failed = await until(() => store.getFlow(f.id)!, flow => status(flow, 'project') === 'failed');
    assert.match(failed.nodes[0].error!, /Choose a project folder/);
  } finally { clean(); }
});
