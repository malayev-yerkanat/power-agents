import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setImmediate as yieldLoop } from 'node:timers/promises';
import { Engine } from '../src/server/engine.ts';
import { Store } from '../src/server/store.ts';
import type { Context } from '../src/server/core/prompts.ts';
import type { AgentEnvelope, CreateRunInput, Run, TaskSpec, TurnInput, TurnRunner } from '../src/shared/types.ts';

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }).trim();
const contextOf = (value: TurnInput): Context => JSON.parse(value.prompt.split('\nCONTEXT:\n')[1]) as Context;
const envelope = (fields: Partial<AgentEnvelope> = {}) => ({ text: JSON.stringify({ summary: 'Done', status: 'done', messages: [], ...fields }) });
const members = [
  { id: 'a', name: 'Agent a', connectionId: 'demo', model: '', role: 'Lead' },
  { id: 'b', name: 'Agent b', connectionId: 'demo', model: '', role: 'Builder' },
];
function plan(run: Run, tasks: TaskSpec[]) {
  return { text: JSON.stringify({ summary: 'Plan', successCriteria: ['Works'], roles: run.members.map(m => ({ memberId: m.id, role: m.role })), tasks }) };
}
async function until(predicate: () => boolean, describe: string): Promise<void> {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.fail(`Timed out waiting for ${describe}`);
}
function setup(runner: TurnRunner) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'power-repo-run-')));
  const repo = join(root, 'repo');
  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  writeFileSync(join(repo, 'README.md'), '# Demo\n');
  git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'init');
  const base = git(repo, 'rev-parse', 'HEAD');
  const store = new Store(':memory:');
  const workspaceRoot = join(root, 'workspaces');
  const engine = new Engine({ store, connections: [], workspaceRoot, demoRunner: runner });
  return {
    repo, base, engine, workspaceRoot,
    start(extra: Partial<CreateRunInput> = {}) {
      const input: CreateRunInput = { goal: 'Change the demo project', mode: 'demo', leaderId: 'a', members, repoPath: repo, ...extra };
      return engine.create(input, { root: repo, baseCommit: base });
    },
    async approve(id: string) {
      await until(() => engine.get(id).status === 'awaiting_approval', 'plan');
      engine.approve(id, engine.get(id).version);
    },
    untouched() {
      assert.equal(git(repo, 'rev-parse', 'HEAD'), base);
      assert.equal(git(repo, 'branch', '--show-current'), 'main');
      assert.equal(git(repo, 'status', '--porcelain'), '');
    },
    async clean() { engine.shutdown(); await yieldLoop(); store.close(); rmSync(root, { recursive: true, force: true }); },
  };
}
const write = (value: TurnInput, file: string, body: string) => writeFileSync(join(value.cwd, file), body);

test('code tasks run in worktrees, merge into the result branch, pass the check, and leave the user branch alone', async () => {
  const seen: Record<string, boolean> = {};
  const tasks: TaskSpec[] = [
    { id: 't1', title: 'A', description: 'Write a', assigneeId: 'a', dependsOn: [] },
    { id: 't2', title: 'B', description: 'Write b', assigneeId: 'b', dependsOn: [] },
    { id: 't3', title: 'C', description: 'Uses a', assigneeId: 'a', dependsOn: ['t1'] },
  ];
  const prompts: Record<string, string> = {};
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    prompts[taskId ?? value.purpose] = value.prompt;
    if (taskId === 't1') write(value, 'a.txt', 'a');
    if (taskId === 't2') write(value, 'b.txt', 'b');
    if (taskId === 't3') { seen.dependency = existsSync(join(value.cwd, 'a.txt')); write(value, 'c.txt', 'c'); }
    if (value.purpose === 'review') return envelope({ verdict: 'pass', artifact: { title: 'Review', body: 'ok' } });
    return envelope({ artifact: { title: value.purpose, body: 'Changed files' } });
  };
  const app = setup(runner);
  try {
    const run = app.start({ checkCommand: 'test -f a.txt && test -f b.txt && test -f c.txt && echo checked' });
    await app.approve(run.id);
    await until(() => ['completed', 'paused'].includes(app.engine.get(run.id).status), 'finish');
    const done = app.engine.get(run.id);
    assert.equal(done.status, 'completed', done.error);
    assert.ok(seen.dependency, 'a dependent task sees its merged dependency');
    const branch = done.repo!.resultBranch!;
    assert.match(branch, /^power-agents\/[0-9a-f]{8}\/result$/);
    for (const file of ['a.txt', 'b.txt', 'c.txt']) assert.equal(git(app.repo, 'show', `${branch}:${file}`), file[0]);
    const check = done.artifacts.find(a => a.kind === 'check')!;
    assert.match(check.title, /пройдена/);
    assert.match(check.body, /checked/);
    assert.equal(done.repo!.check?.passed, true);
    assert.match(done.repo!.diffStat!, /3 files changed/);
    assert.match(prompts.synthesize, /пройдена/);
    assert.match(prompts.t1, /рабочая копия git/);
    app.untouched();
    await until(() => git(app.repo, 'worktree', 'list').split('\n').length === 1, 'worktree cleanup');
    assert.equal(existsSync(join(app.workspaceRoot, run.id, 'result')), false);
    assert.match(git(app.repo, 'branch', '--list', 'power-agents/*'), /result/, 'branches stay for the user');
  } finally { await app.clean(); }
});

test('the leader resolves a merge conflict in the result worktree', async () => {
  let resolvePrompt = '';
  const tasks: TaskSpec[] = [
    { id: 't1', title: 'A', description: 'Menu', assigneeId: 'a', dependsOn: [] },
    { id: 't2', title: 'B', description: 'Menu too', assigneeId: 'b', dependsOn: [] },
  ];
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    if (taskId) write(value, 'menu.txt', `${taskId}\n`);
    if (value.purpose === 'resolve') { resolvePrompt = value.prompt; write(value, 'menu.txt', 't1 and t2\n'); }
    if (value.purpose === 'review') return envelope({ verdict: 'pass', artifact: { title: 'Review', body: 'ok' } });
    return envelope({ artifact: { title: value.purpose, body: 'Done' } });
  };
  const app = setup(runner);
  try {
    const run = app.start();
    await app.approve(run.id);
    await until(() => ['completed', 'paused'].includes(app.engine.get(run.id).status), 'finish');
    const done = app.engine.get(run.id);
    assert.equal(done.status, 'completed', done.error);
    assert.match(resolvePrompt, /menu\.txt/);
    assert.equal(git(app.repo, 'show', `${done.repo!.resultBranch}:menu.txt`), 't1 and t2');
    app.untouched();
  } finally { await app.clean(); }
});

test('an unresolved conflict aborts the merge and pauses with the file list', async () => {
  const tasks: TaskSpec[] = [
    { id: 't1', title: 'A', description: 'Menu', assigneeId: 'a', dependsOn: [] },
    { id: 't2', title: 'B', description: 'Menu too', assigneeId: 'b', dependsOn: [] },
  ];
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    if (taskId) write(value, 'menu.txt', `${taskId}\n`);
    return envelope({ artifact: { title: value.purpose, body: 'Done' } });
  };
  const app = setup(runner);
  try {
    const run = app.start();
    await app.approve(run.id);
    await until(() => app.engine.get(run.id).status === 'paused', 'pause');
    const paused = app.engine.get(run.id);
    assert.match(paused.error!, /menu\.txt/);
    const resultDir = join(app.workspaceRoot, run.id, 'result');
    assert.equal(existsSync(join(git(resultDir, 'rev-parse', '--git-dir'), 'MERGE_HEAD')), false);
    assert.equal(readFileSync(join(resultDir, 'menu.txt'), 'utf8').includes('<<<<<<<'), false);
    app.untouched();
  } finally { await app.clean(); }
});
