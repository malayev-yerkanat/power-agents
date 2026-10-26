import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abortMerge, commitTask, conflictsResolved, createResultWorktree, createTaskWorktree, diffStat, finishMerge, mergeTask, removeWorktrees, repoInfo, runCheck } from '../src/server/workspace.ts';

const RUN_ID = 'abcdef12-3456-7890-abcd-ef1234567890';

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' }).trim();
}

/** A throwaway repo with one commit and an uncommitted file the platform must never touch. */
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'power-agents-workspace-')));
  const repo = join(root, 'repo');
  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  writeFileSync(join(repo, 'a.txt'), 'one\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-qm', 'init');
  writeFileSync(join(repo, 'local.txt'), 'uncommitted\n');
  const runDir = join(root, 'runs', RUN_ID);
  const state = () => ({ branch: git(repo, 'symbolic-ref', 'HEAD'), head: git(repo, 'rev-parse', 'HEAD'), status: git(repo, 'status', '--porcelain'), local: readFileSync(join(repo, 'local.txt'), 'utf8') });
  const before = state();
  return { root, repo, runDir, assertUserUnchanged: () => assert.deepEqual(state(), before), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('repoInfo returns the repo root and HEAD and rejects other paths', async () => {
  const f = fixture();
  try {
    assert.deepEqual(await repoInfo(join(f.repo, '.')), { root: f.repo, baseCommit: git(f.repo, 'rev-parse', 'HEAD') });
    await assert.rejects(repoInfo('repo'), /абсолютным/);
    await assert.rejects(repoInfo(f.root), /git/);
    await assert.rejects(repoInfo(join(f.root, 'missing')), /git/);
  } finally { f.cleanup(); }
});

test('tasks work in their own worktrees, commit, merge and see merged dependencies', async () => {
  const f = fixture();
  try {
    const { root, baseCommit } = await repoInfo(f.repo);
    const result = await createResultWorktree(root, f.runDir, RUN_ID, baseCommit);
    assert.deepEqual(result, { dir: join(f.runDir, 'result'), branch: 'power-agents/abcdef12/result' });
    assert.equal(git(result.dir, 'rev-parse', 'HEAD'), baseCommit);
    assert.equal(existsSync(join(result.dir, 'local.txt')), false);

    const first = await createTaskWorktree(root, f.runDir, RUN_ID, 't1');
    assert.deepEqual(first, { dir: join(f.runDir, 'tasks', 't1'), branch: 'power-agents/abcdef12/t1' });
    assert.equal(await commitTask(first.dir, 'Codex'), false);
    writeFileSync(join(first.dir, 'b.txt'), 'from t1\n');
    assert.equal(await commitTask(first.dir, 'Codex'), true);
    assert.equal(git(first.dir, 'log', '-1', '--format=%an'), 'Power Agents (Codex)');
    assert.equal(git(first.dir, 'status', '--porcelain'), '');
    assert.deepEqual(await createTaskWorktree(root, f.runDir, RUN_ID, 't1'), first);

    assert.deepEqual(await mergeTask(result.dir, first.branch), { ok: true });
    assert.equal(git(result.dir, 'rev-list', '--count', `${baseCommit}..HEAD`), '2');
    assert.equal(git(result.dir, 'log', '-1', '--format=%P').split(' ').length, 2);

    const dependent = await createTaskWorktree(root, f.runDir, RUN_ID, 't2');
    assert.equal(readFileSync(join(dependent.dir, 'b.txt'), 'utf8'), 'from t1\n');
    assert.match(await diffStat(result.dir, baseCommit), /b\.txt \| 1 \+/);
    f.assertUserUnchanged();
  } finally { f.cleanup(); }
});

async function conflicted(f: ReturnType<typeof fixture>) {
  const { root, baseCommit } = await repoInfo(f.repo);
  const result = await createResultWorktree(root, f.runDir, RUN_ID, baseCommit);
  const left = await createTaskWorktree(root, f.runDir, RUN_ID, 'left');
  const right = await createTaskWorktree(root, f.runDir, RUN_ID, 'right');
  writeFileSync(join(left.dir, 'a.txt'), 'left\n');
  writeFileSync(join(right.dir, 'a.txt'), 'right\n');
  await commitTask(left.dir, 'Codex');
  await commitTask(right.dir, 'Claude');
  assert.deepEqual(await mergeTask(result.dir, left.branch), { ok: true });
  return { result, right, head: git(result.dir, 'rev-parse', 'HEAD') };
}

test('a conflict is reported, then accepted only once markers are gone', async () => {
  const f = fixture();
  try {
    const { result, right, head } = await conflicted(f);
    assert.deepEqual(await mergeTask(result.dir, right.branch), { ok: false, conflicts: ['a.txt'] });
    assert.match(readFileSync(join(result.dir, 'a.txt'), 'utf8'), /^<<<<<<< /m);
    assert.equal(await conflictsResolved(result.dir), false);
    writeFileSync(join(result.dir, 'a.txt'), 'left and right\n');
    assert.equal(await conflictsResolved(result.dir), true);
    await finishMerge(result.dir);
    assert.equal(git(result.dir, 'rev-parse', 'HEAD^1'), head);
    assert.equal(git(result.dir, 'status', '--porcelain'), '');
    assert.equal(readFileSync(join(result.dir, 'a.txt'), 'utf8'), 'left and right\n');
    f.assertUserUnchanged();
  } finally { f.cleanup(); }
});

test('an unresolved conflict is aborted back to the last merged state', async () => {
  const f = fixture();
  try {
    const { result, right, head } = await conflicted(f);
    assert.equal((await mergeTask(result.dir, right.branch)).ok, false);
    await abortMerge(result.dir);
    assert.equal(git(result.dir, 'rev-parse', 'HEAD'), head);
    assert.equal(git(result.dir, 'status', '--porcelain'), '');
    assert.equal(readFileSync(join(result.dir, 'a.txt'), 'utf8'), 'left\n');
    f.assertUserUnchanged();
  } finally { f.cleanup(); }
});

test('mergeTask rethrows failures that are not conflicts', async () => {
  const f = fixture();
  try {
    const { root, baseCommit } = await repoInfo(f.repo);
    const result = await createResultWorktree(root, f.runDir, RUN_ID, baseCommit);
    await assert.rejects(mergeTask(result.dir, 'power-agents/abcdef12/missing'));
  } finally { f.cleanup(); }
});

test('runCheck reports pass, failure, timeout and keeps the output tail', async () => {
  const f = fixture();
  try {
    assert.deepEqual(await runCheck(f.repo, 'echo ok; echo warn >&2'), { passed: true, exitCode: 0, output: 'ok\nwarn\n' });
    assert.deepEqual(await runCheck(f.repo, 'echo broken; exit 3'), { passed: false, exitCode: 3, output: 'broken\n' });
    const long = await runCheck(f.repo, "head -c 300000 /dev/zero | tr '\\0' x; echo END");
    assert.equal(Buffer.byteLength(long.output), 200 * 1024);
    assert.ok(long.output.endsWith('xEND\n'));
    const slow = await runCheck(f.repo, 'echo started; sleep 5', { timeoutMs: 200 });
    assert.equal(slow.passed, false);
    assert.equal(slow.exitCode, null);
    assert.match(slow.output, /started[\s\S]*время/);
  } finally { f.cleanup(); }
});

test('removeWorktrees removes the run worktrees and keeps their branches', async () => {
  const f = fixture();
  try {
    const { root, baseCommit } = await repoInfo(f.repo);
    const result = await createResultWorktree(root, f.runDir, RUN_ID, baseCommit);
    const task = await createTaskWorktree(root, f.runDir, RUN_ID, 't1');
    writeFileSync(join(task.dir, 'dirty.txt'), 'uncommitted\n');
    await removeWorktrees(root, f.runDir);
    assert.equal(existsSync(result.dir), false);
    assert.equal(existsSync(task.dir), false);
    assert.equal(git(f.repo, 'worktree', 'list', '--porcelain').split('\n').filter(line => line.startsWith('worktree ')).length, 1);
    assert.deepEqual(git(f.repo, 'branch', '--format=%(refname:short)', '--list', 'power-agents/*').split('\n').sort(), [result.branch, task.branch]);
    assert.deepEqual(await createTaskWorktree(root, f.runDir, RUN_ID, 't1'), task);
    await removeWorktrees(root, join(f.root, 'never-created'));
    f.assertUserUnchanged();
  } finally { f.cleanup(); }
});
