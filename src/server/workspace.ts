import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, join, sep } from 'node:path';
import { ProcessExitError, runProcess, runtimeEnvironment } from './adapters/process.js';

export const CHECK_TIMEOUT_MS = 10 * 60 * 1000;
export const CHECK_OUTPUT_BYTES = 200 * 1024;
const EMAIL = 'power-agents@localhost';

export interface Worktree { dir: string; branch: string }
export type MergeResult = { ok: true } | { ok: false; conflicts: string[] };
export interface CheckResult { passed: boolean; exitCode: number | null; output: string }

/** Git in the C locale so messages parse; the user's hooks and signing never run on platform commits. */
function git(cwd: string, args: string[], name = 'Power Agents'): Promise<string> {
  const identity = ['-c', `user.name=${name}`, '-c', `user.email=${EMAIL}`, '-c', 'commit.gpgsign=false'];
  return runProcess('git', [...identity, ...args], { cwd, signal: new AbortController().signal, env: { ...runtimeEnvironment(), LC_ALL: 'C' } });
}

const lines = (output: string) => output.split('\n').filter(Boolean);
const branchName = (runId: string, name: string) => `power-agents/${runId.slice(0, 8)}/${name}`;

export async function repoInfo(repoPath: string): Promise<{ root: string; baseCommit: string }> {
  if (!isAbsolute(repoPath)) throw new Error('Путь к репозиторию должен быть абсолютным.');
  try {
    const root = (await git(repoPath, ['rev-parse', '--show-toplevel'])).trim();
    return { root, baseCommit: (await git(root, ['rev-parse', '--verify', 'HEAD^{commit}'])).trim() };
  } catch { throw new Error(`Папка не является git-репозиторием с коммитами: ${repoPath}`); }
}

export async function createResultWorktree(repoRoot: string, runDir: string, runId: string, baseCommit: string): Promise<Worktree> {
  const worktree = { dir: join(runDir, 'result'), branch: branchName(runId, 'result') };
  await git(repoRoot, ['worktree', 'add', '-q', '-b', worktree.branch, worktree.dir, baseCommit]);
  return worktree;
}

/** Starts from the result branch tip, so merged dependencies are present; an existing worktree or branch is reused. */
export async function createTaskWorktree(repoRoot: string, runDir: string, runId: string, taskId: string): Promise<Worktree> {
  const worktree = { dir: join(runDir, 'tasks', taskId), branch: branchName(runId, taskId) };
  if (existsSync(worktree.dir)) return worktree;
  const branchExists = await git(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${worktree.branch}`]).then(() => true, () => false);
  await git(repoRoot, branchExists ? ['worktree', 'add', '-q', worktree.dir, worktree.branch] : ['worktree', 'add', '-q', '-b', worktree.branch, worktree.dir, branchName(runId, 'result')]);
  return worktree;
}

export async function commitTask(taskDir: string, authorName: string): Promise<boolean> {
  await git(taskDir, ['add', '-A']);
  if (!(await git(taskDir, ['status', '--porcelain'])).trim()) return false;
  const name = `Power Agents (${authorName})`;
  await git(taskDir, ['commit', '-q', '--no-verify', '-m', `Result from ${authorName}`], name);
  return true;
}

/** On a conflict the merge state stays in place for the leader to resolve. */
export async function mergeTask(resultDir: string, branch: string): Promise<MergeResult> {
  try {
    await git(resultDir, ['merge', '-q', '--no-ff', '--no-edit', '--no-verify', '-m', `Merge ${branch}`, branch]);
    return { ok: true };
  } catch (error) {
    const conflicts = lines(await git(resultDir, ['diff', '--name-only', '--diff-filter=U']));
    if (!conflicts.length) throw error;
    return { ok: false, conflicts };
  }
}

/** Stages the leader's edits (its sandbox may not write the git index), then requires no unmerged paths and no markers. */
export async function conflictsResolved(resultDir: string): Promise<boolean> {
  await git(resultDir, ['add', '-A']);
  if ((await git(resultDir, ['ls-files', '-u'])).trim()) return false;
  try { await git(resultDir, ['diff', '--cached', '--check']); }
  catch (error) {
    // --check also fails on whitespace errors, which do not block a merge.
    if (!(error instanceof ProcessExitError) || /conflict marker/.test(error.output)) return false;
  }
  return true;
}

export async function finishMerge(resultDir: string): Promise<void> {
  await git(resultDir, ['commit', '-q', '--no-edit', '--no-verify']);
}

export async function abortMerge(resultDir: string): Promise<void> {
  await git(resultDir, ['merge', '--abort']);
}

export async function diffStat(resultDir: string, baseCommit: string): Promise<string> {
  return (await git(resultDir, ['diff', '--stat', baseCommit, 'HEAD'])).trim();
}

/** The user's own check command, the only shell use; combined output keeps its last 200 KB. */
export function runCheck(resultDir: string, command: string, options: { timeoutMs?: number } = {}): Promise<CheckResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/sh', ['-c', command], { cwd: resultDir, env: runtimeEnvironment(), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let chunks: Buffer[] = [];
    let size = 0;
    let timedOut = false;
    const keep = (chunk: Buffer) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > 2 * CHECK_OUTPUT_BYTES) { chunks = [Buffer.concat(chunks).subarray(-CHECK_OUTPUT_BYTES)]; size = CHECK_OUTPUT_BYTES; }
    };
    const kill = (signal: NodeJS.Signals) => { try { process.kill(-child.pid!, signal); } catch { /* already exited */ } };
    const timeout = setTimeout(() => {
      timedOut = true;
      kill('SIGTERM');
      setTimeout(() => kill('SIGKILL'), 500).unref();
    }, options.timeoutMs ?? CHECK_TIMEOUT_MS);
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', code => {
      clearTimeout(timeout);
      let output = Buffer.concat(chunks).subarray(-CHECK_OUTPUT_BYTES).toString('utf8');
      if (timedOut) output += '\nПроверка остановлена: превышено время ожидания.\n';
      const exitCode = timedOut ? null : code;
      resolve({ passed: exitCode === 0, exitCode, output });
    });
  });
}

/** Removes every worktree under runDir; the run's branches stay for the user. */
export async function removeWorktrees(repoRoot: string, runDir: string): Promise<void> {
  if (existsSync(runDir)) {
    const prefix = realpathSync(runDir) + sep;
    const dirs = lines(await git(repoRoot, ['worktree', 'list', '--porcelain'])).filter(line => line.startsWith('worktree ')).map(line => line.slice('worktree '.length));
    for (const dir of dirs.filter(dir => dir.startsWith(prefix))) await git(repoRoot, ['worktree', 'remove', '--force', dir]);
  }
  await git(repoRoot, ['worktree', 'prune']);
}
