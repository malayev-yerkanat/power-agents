import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createPipelineExecutor } from '../src/server/flows/pipeline.ts';
import { robloxReel } from '../src/server/flows/registry.ts';
import type { ExecutionContext } from '../src/server/flows/registry.ts';

function fixture(code: string) {
  const root = mkdtempSync(join(tmpdir(), 'flow-pipeline-'));
  const stages = join(root, 'stages'), dir = join(root, 'flows/f/voice/v1');
  mkdirSync(stages, { recursive: true }); mkdirSync(dir, { recursive: true });
  writeFileSync(join(stages, 'voice.py'), `import argparse,json,pathlib,time\np=argparse.ArgumentParser()\np.add_argument('--in',dest='source');p.add_argument('--out');p.add_argument('--dir')\na=p.parse_args()\nd=pathlib.Path(a.dir)\n${code}\n`);
  const graph = robloxReel();
  const ctx: ExecutionContext = { flow: { ...graph, id: 'f', title: 'test', mode: 'live', autoRun: false, version: 1, createdAt: '', updatedAt: '' },
    node: { ...graph.nodes.find(n => n.id === 'voice')!, version: 1 }, inputs: { script: { value: { fullText: 'Hello' } } }, notes: ['revise'], dir, signal: new AbortController().signal };
  return { root, stages, ctx, close: () => rmSync(root, { recursive: true, force: true }) };
}

test('pipeline resolves inline values, files and supplemental script and runs isolated Python', async () => {
  const f = fixture(`(d/'narration.mp3').write_bytes(b'audio')\npathlib.Path(a.out).write_text(json.dumps({'outputs':{'audio':{'files':['narration.mp3']},'timings':{'value':{'words':[],'beats':[]}}}}))`);
  try {
    const result = await createPipelineExecutor('voice', { stageDir: f.stages })(f.ctx);
    assert.deepEqual(result.audio.files, ['narration.mp3']);
    const input = JSON.parse(readFileSync(join(f.ctx.dir, 'input.json'), 'utf8'));
    assert.deepEqual(input.inputs.script, { fullText: 'Hello' }); assert.deepEqual(input.notes, ['revise']);
    assert.equal(input.flowId, 'f'); assert.equal(input.version, 1);
  } finally { f.close(); }
});
for (const [label, code, expected] of [
  ['human', `pathlib.Path(a.out).write_text(json.dumps({'log':'Please upload a take'}))\nraise SystemExit(2)`, /Please upload/],
  ['failed', `pathlib.Path(a.out).write_text(json.dumps({'log':'QA failed'}))\nraise SystemExit(1)`, /QA failed/],
  ['missing output', `pathlib.Path(a.out).write_text(json.dumps({'port':'audio','files':['missing.mp3']}))`, /missing|invalid/i],
  ['escaping output', `pathlib.Path(a.out).write_text(json.dumps({'port':'audio','files':['../outside.mp3']}))`, /outside|invalid/i],
] as const) test(`pipeline handles ${label}`, async () => {
  const f = fixture(code);
  try { await assert.rejects(createPipelineExecutor('voice', { stageDir: f.stages })(f.ctx), error => {
    assert.match((error as Error).message, expected);
    assert.equal((error as { needsHuman?: boolean }).needsHuman, label === 'human'); return true;
  }); } finally { f.close(); }
});
test('pipeline times out and aborts the child process', async () => {
  for (const abort of [false, true]) {
    const f = fixture('time.sleep(60)'); const controller = new AbortController();
    try {
      const promise = createPipelineExecutor('voice', { stageDir: f.stages, timeoutMs: abort ? 10000 : 30 })({ ...f.ctx, signal: controller.signal });
      if (abort) setTimeout(() => controller.abort(), 30);
      await assert.rejects(promise, abort ? /abort/i : /timed out/i);
    } finally { f.close(); }
  }
});
test('pipeline gives setup guidance without a configured stage directory', async () => {
  const previous = process.env.REEL_PIPELINE_DIR; delete process.env.REEL_PIPELINE_DIR;
  const f = fixture('');
  try { await assert.rejects(createPipelineExecutor('voice')(f.ctx), /REEL_PIPELINE_DIR/); }
  finally { if (previous !== undefined) process.env.REEL_PIPELINE_DIR = previous; f.close(); }
});
test('reel template connects Voice timings to Scenes', () => {
  assert.ok(robloxReel().edges.some(e => e.from.node === 'voice' && e.to.node === 'scenes' && e.to.port === 'timings'));
});
test('pipeline resolves source version files and Capture upload from the correct flow directory', async () => {
  const f = fixture(`pathlib.Path(a.out).write_text(json.dumps({'outputs':{'audio':{'value':json.loads(pathlib.Path(a.source).read_text())},'timings':{'value':{}}}}))`);
  try {
    const script = f.ctx.flow.nodes.find(n => n.id === 'script')!;
    script.version = 3; script.outputVersion = 2; script.output = { script: { value: { fullText: 'Hello' }, files: ['source.json'] } };
    const sourceDir = join(f.root, 'flows/f/script/v2'); mkdirSync(sourceDir, { recursive: true }); writeFileSync(join(sourceDir, 'source.json'), '{}');
    const uploadDir = join(f.root, 'flows/f/voice/uploads'); mkdirSync(uploadDir, { recursive: true }); writeFileSync(join(uploadDir, 'take.mp4'), 'take');
    f.ctx.node.upload = { name: 'take.mp4', bytes: 4, at: '' };
    const result = await createPipelineExecutor('voice', { stageDir: f.stages })(f.ctx);
    const data = result.audio.value as { files: Record<string, string[]>; upload: string };
    assert.equal(data.files.script[0], join(sourceDir, 'source.json')); assert.equal(data.upload, join(uploadDir, 'take.mp4'));
  } finally { f.close(); }
});
test('pipeline refuses symlinked output directories escaping the version folder', async () => {
  const f = fixture(`import os\nos.symlink(str(d.parent),str(d/'escape'))\n(d.parent/'secret.mp3').write_bytes(b'secret')\npathlib.Path(a.out).write_text(json.dumps({'port':'audio','files':['escape/secret.mp3']}))`);
  try { await assert.rejects(createPipelineExecutor('voice', { stageDir: f.stages })(f.ctx), /outside|invalid/i); }
  finally { f.close(); }
});
test('abort also kills a stage descendant that ignores SIGTERM', async () => {
  const f = fixture(`import subprocess,sys\nsubprocess.Popen([sys.executable,'-c',"import os,signal,time,pathlib;signal.signal(signal.SIGTERM,signal.SIG_IGN);pathlib.Path('descendant.pid').write_text(str(os.getpid()));time.sleep(60)"])\ntime.sleep(60)`);
  const controller = new AbortController();
  try {
    const promise = createPipelineExecutor('voice', { stageDir: f.stages })({ ...f.ctx, signal: controller.signal });
    const pidFile = join(f.ctx.dir, 'descendant.pid');
    let pid = 0;
    for (let i = 0; i < 100; i++) {
      try { pid = Number(readFileSync(pidFile, 'utf8')); } catch { /* Child is starting. */ }
      if (pid) break; await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(pid > 0); controller.abort(); await assert.rejects(promise, /abort/i);
    let alive = true;
    for (let i = 0; i < 100; i++) {
      try { process.kill(pid, 0); } catch { alive = false; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(alive, false, 'SIGTERM-ignoring descendant was killed');
  } finally { controller.abort(); f.close(); }
});
test('pipeline output file paths must stay relative even when absolute paths point inside the folder', async () => {
  const f = fixture(`(d/'narration.mp3').write_bytes(b'audio')\npathlib.Path(a.out).write_text(json.dumps({'port':'audio','files':[str(d)+'//narration.mp3']}))`);
  try { await assert.rejects(createPipelineExecutor('voice', { stageDir: f.stages })(f.ctx), /outside|invalid/i); }
  finally { f.close(); }
});
