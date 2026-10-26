import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseJsonObject, runTurn, discoverConnections } from '../src/server/adapters/index.js';
import { buildCliCommand, cliEnvironment, parseCliResult, runCli } from '../src/server/adapters/cli.js';
import { runProcess } from '../src/server/adapters/process.js';
import type { TurnInput } from '../src/shared/types.js';

function input(kind: TurnInput['connection']['kind'] = 'openai-api'): TurnInput {
  return { runId: 'run', member: { id: 'member', name: 'Agent', connectionId: kind, model: 'explicit-model', role: 'worker' },
    connection: { id: kind, name: kind, kind, available: true, detail: '' }, purpose: 'task', prompt: 'Hello',
    cwd: process.cwd(), signal: new AbortController().signal, onProgress() {} };
}

test('JSON parser accepts objects and fenced objects, rejects ambiguous or missing output', () => {
  assert.deepEqual(parseJsonObject('```json\n{"answer":42}\n```'), { answer: 42 });
  assert.deepEqual(parseJsonObject('{"answer":"quoted } brace"}'), { answer: 'quoted } brace' });
  for (const text of ['', '[]', 'null', '{} {}', 'Here is {}', '```json\n{bad}\n```']) assert.throws(() => parseJsonObject(text));
});

test('CLI parsers extract authoritative text and session ids; fail closed on provider errors', () => {
  assert.deepEqual(parseCliResult('codex-cli', [
    '{"type":"thread.started","thread_id":"thread-1"}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"answer"}}',
    '{"type":"turn.completed"}',
  ].join('\n')), { text: 'answer', sessionId: 'thread-1' });
  assert.deepEqual(parseCliResult('claude-cli', '{"type":"result","subtype":"success","result":"answer","session_id":"s1"}'), { text: 'answer', sessionId: 's1' });
  assert.deepEqual(parseCliResult('gemini-cli', '{"status":"SUCCESS","response":"answer","conversation_id":"s2"}'), { text: 'answer', sessionId: 's2' });
  assert.deepEqual(parseCliResult('gemini-cli', [
    '{"event":"init","conversation_id":"s2"}',
    '{"event":"step_update","step_update":{"text_delta":"partial"}}',
    '{"event":"result","result":{"status":"SUCCESS","response":"answer","conversation_id":"s2"}}',
  ].join('\n')), { text: 'answer', sessionId: 's2' });
  assert.throws(() => parseCliResult('gemini-cli', '{"event":"init","conversation_id":"s2"}'), /заверш|результ/i);
  assert.throws(() => parseCliResult('gemini-cli', '{"event":"result","result":{"status":"ERROR","error":"failed"}}'), /failed/);
  assert.throws(() => parseCliResult('claude-cli', '{"is_error":true,"result":"login required"}'), /login required/);
  assert.throws(() => parseCliResult('gemini-cli', '{"status":"ERROR","response":"no"}'));
  assert.throws(() => parseCliResult('codex-cli', '{"type":"turn.failed","error":{"message":"auth failed"}}'), /auth failed/);
  assert.throws(() => parseCliResult('codex-cli', '{"type":"item.completed","item":{"type":"agent_message","text":"partial"}}'));
});

test('CLI commands constrain permission and preserve explicit session/model', () => {
  const turn = { ...input('claude-cli'), sessionId: 'session' };
  const claude = buildCliCommand(turn);
  assert.equal(claude.stdin, 'Hello');
  assert.ok(claude.args.includes('plan'));
  assert.equal(claude.args[claude.args.indexOf('--tools') + 1], '');
  assert.ok(claude.args.includes('--strict-mcp-config'));
  assert.deepEqual(JSON.parse(claude.args[claude.args.indexOf('--settings') + 1]), { disableAllHooks: true });
  assert.ok(claude.args.includes('session'));
  const codex = buildCliCommand({ ...turn, connection: input('codex-cli').connection });
  assert.ok(codex.args.includes('read-only'));
  assert.ok(codex.args.includes('--ignore-user-config'));
  assert.ok(codex.args.indexOf('-s') < codex.args.indexOf('resume'));
  const gemini = buildCliCommand({ ...turn, connection: input('gemini-cli').connection });
  assert.ok(gemini.args.includes('--sandbox'));
  assert.ok(gemini.args.includes('--conversation'));
  assert.equal(gemini.args[gemini.args.indexOf('--input-format') + 1], 'stream-json');
  assert.equal(gemini.args[gemini.args.indexOf('--output-format') + 1], 'stream-json');
  assert.ok(!gemini.args.includes('Hello'));
  assert.ok(!gemini.args.includes('--print'));
  assert.deepEqual(JSON.parse(gemini.stdin ?? ''), { event: 'user', message: { content: 'Hello' } });
});

test('API validation requires configured key and explicit model without network access', async () => {
  const previous = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(runTurn(input()), /OPENAI_API_KEY/);
    process.env.OPENAI_API_KEY = 'test-key';
    const turn = input();
    turn.member = { ...turn.member, model: '' };
    await assert.rejects(runTurn(turn), /модел/i);
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});

test('API parses text blocks, sends explicit model, and redacts provider errors', async (t) => {
  const oldOpenai = process.env.OPENAI_API_KEY;
  const oldAnthropic = process.env.ANTHROPIC_API_KEY;
  process.env.OPENAI_API_KEY = 'secret-openai-key';
  process.env.ANTHROPIC_API_KEY = 'secret-anthropic-key';
  try {
    let request: RequestInit | undefined;
    t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
      request = options;
      return Response.json({ id: 'resp_1', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'answer' }] }] });
    });
    assert.deepEqual(await runTurn(input()), { text: 'answer', sessionId: 'resp_1' });
    assert.equal(JSON.parse(String(request?.body)).model, 'explicit-model');
    assert.deepEqual(JSON.parse(String(request?.body)).tools, []);
    t.mock.restoreAll();
    t.mock.method(globalThis, 'fetch', async () => Response.json({ content: [{ type: 'text', text: 'anthropic answer' }], stop_reason: 'end_turn' }));
    assert.deepEqual(await runTurn(input('anthropic-api')), { text: 'anthropic answer' });
    t.mock.restoreAll();
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'bad secret-openai-key secret-anthropic-key' } }, { status: 401 }));
    await assert.rejects(runTurn(input()), (error: Error) => error.message.includes('[REDACTED]') && !error.message.includes('secret-')
      && error.message.startsWith('OpenAI отклонил ключ (HTTP 401). Проверьте OPENAI_API_KEY в .env'));
    t.mock.restoreAll();
    t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'incomplete', output: [{ type: 'message', content: [{ type: 'output_text', text: 'partial' }] }] }));
    await assert.rejects(runTurn(input()), /incomplete/);
    t.mock.restoreAll();
    t.mock.method(globalThis, 'fetch', async () => Response.json({ content: [], stop_reason: 'end_turn' }));
    await assert.rejects(runTurn(input('anthropic-api')), /пуст|текст/i);
  } finally {
    t.mock.restoreAll();
    if (oldOpenai === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldOpenai;
    if (oldAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = oldAnthropic;
  }
});

test('process runner uses stdin, enforces output bound, and aborts promptly', async () => {
  const options = { cwd: process.cwd(), signal: new AbortController().signal };
  assert.equal(await runProcess(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { ...options, stdin: 'hello' }), 'hello');
  await assert.rejects(runProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(3*1024*1024))'], options), /лимит/i);
  const controller = new AbortController();
  const promise = runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { ...options, signal: controller.signal });
  setTimeout(() => controller.abort(), 50);
  await assert.rejects(promise, /отмен/i);
  const alreadyAborted = AbortSignal.abort();
  await assert.rejects(runProcess('nonexistent-command', [], { ...options, signal: alreadyAborted }), /отмен/i);
});

test('discovery returns stable IDs and describes unverified login', async () => {
  const connections = await discoverConnections();
  assert.deepEqual(connections.map(({ id }) => id), ['codex', 'claude', 'gemini', 'openai-api', 'anthropic-api']);
  for (const connection of connections.filter(c => c.available && c.executable)) assert.match(connection.detail, /вход.*не провер/i);
});


test('cancellation kills a descendant that ignores SIGTERM', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'power-agents-cancel-'));
  const pidPath = join(directory, 'pid');
  const controller = new AbortController();
  const script = `const {spawn}=require('node:child_process');
    const child=spawn(process.execPath,['-e','process.on("SIGTERM",()=>{}); setInterval(()=>{},1000)'],{stdio:'ignore'});
    require('node:fs').writeFileSync(process.argv[1],String(child.pid));
    process.on('SIGTERM',()=>{}); setInterval(()=>{},1000);`;
  const result = runProcess(process.execPath, ['-e', script, pidPath], { cwd: directory, signal: controller.signal });
  // Attach rejection handling before aborting to avoid an unhandled rejection.
  const rejection = assert.rejects(result, /отмен/i);
  try {
    let pid = 0;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { pid = Number(await readFile(pidPath, 'utf8')); break; } catch { await delay(10); }
    }
    assert.ok(pid > 0, 'child pid became available');
    await delay(80);
    controller.abort();
    await rejection;
    await delay(50);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally { controller.abort(); await rm(directory, { recursive: true, force: true }); }
});

test('process timeout and failed authentication surface bounded redacted errors', async () => {
  const options = { cwd: process.cwd(), signal: new AbortController().signal };
  await assert.rejects(runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { ...options, timeoutMs: 30 }), /время/i);
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'secret-for-process-test';
  try {
    await assert.rejects(runProcess(process.execPath, ['-e', 'process.stderr.write("login failed secret-for-process-test"); process.exit(1)'], options), (error: Error) => error.message.includes('login failed [REDACTED]') && !error.message.includes('secret-for-process-test'));
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});

test('API rejects oversized, invalid and truncated responses and forwards cancellation', async (t) => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-api-key';
  try {
    for (const response of [new Response('x'.repeat(2 * 1024 * 1024 + 1)), new Response('not json')]) {
      t.mock.method(globalThis, 'fetch', async () => response);
      await assert.rejects(runTurn(input()), /лимит|JSON/);
      t.mock.restoreAll();
    }
    const controller = new AbortController();
    let forwarded: AbortSignal | undefined;
    t.mock.method(globalThis, 'fetch', (_url: unknown, options: RequestInit) => new Promise((_resolve, reject) => {
      forwarded = options.signal as AbortSignal;
      forwarded.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    const pending = runTurn({ ...input(), signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, /отмен/i);
    assert.equal(forwarded?.aborted, true);
  } finally {
    t.mock.restoreAll();
    if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous;
  }
});


test('CLI environment keeps CLI sign-in and never forwards the app API keys', async () => {
  const names = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CODEX_HOME', 'CLAUDE_CODE_OAUTH_TOKEN', 'SENTINEL_SECRET'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { OPENAI_API_KEY: 'openai-auth', ANTHROPIC_API_KEY: 'anthropic-auth', ANTHROPIC_AUTH_TOKEN: 'gateway-auth',
    CODEX_HOME: '/codex-home', CLAUDE_CODE_OAUTH_TOKEN: 'subscription-auth', SENTINEL_SECRET: 'unrelated' });
  try {
    for (const kind of ['codex-cli', 'claude-cli', 'gemini-cli'] as const) {
      const env = cliEnvironment(kind);
      assert.deepEqual([env.OPENAI_API_KEY, env.ANTHROPIC_API_KEY, env.ANTHROPIC_AUTH_TOKEN], [undefined, undefined, undefined], kind);
    }
    assert.equal(cliEnvironment('codex-cli').CODEX_HOME, '/codex-home');
    assert.equal(cliEnvironment('claude-cli').CLAUDE_CODE_OAUTH_TOKEN, 'subscription-auth');
    const stdout = await runProcess(process.execPath, ['-e', 'process.stdout.write(String(process.env.SENTINEL_SECRET))'], { cwd: process.cwd(), signal: new AbortController().signal });
    assert.equal(stdout, 'undefined');
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('a failing CLI reports its own reason from stdout instead of "no details"', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'power-cli-exit-'));
  const fake = async (name: string, stdout: string) => {
    const path = join(directory, name);
    await writeFile(path, `#!/bin/sh\ncat >/dev/null\nprintf '%s' '${stdout}'\nexit 1\n`);
    await chmod(path, 0o755);
    return { ...input('claude-cli'), cwd: directory, connection: { ...input('claude-cli').connection, executable: path } };
  };
  try {
    await assert.rejects(runCli(await fake('claude-logged-out', '{"is_error":true,"subtype":"success","result":"Not logged in · Please run /login"}')),
      (error: Error) => error.message === 'Not logged in · Please run /login');
    await assert.rejects(runCli(await fake('claude-garbage', 'not json')), /CLI завершился с ошибкой \(1\): нет подробностей/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a CLI that prints its result but stays open is finished and stopped', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'power-cli-linger-'));
  try {
    const pidPath = join(directory, 'pid');
    const script = `require('fs').writeFileSync(process.argv[1], String(process.pid)); process.stdout.write('{"event":"init"}\\n{"event":"result","result":{"status":"SUCCESS","response":"done"}}\\n'); setInterval(() => {}, 1000);`;
    const started = Date.now();
    const output = await runProcess(process.execPath, ['-e', script, pidPath], { cwd: directory, signal: new AbortController().signal, timeoutMs: 20_000,
      isComplete: text => text.includes('"event":"result"') });
    assert.ok(Date.now() - started < 5_000);
    assert.match(output, /"response":"done"/);
    const pid = Number(await readFile(pidPath, 'utf8'));
    await delay(700);
    assert.throws(() => process.kill(pid, 0), /ESRCH/);

    const gemini = join(directory, 'agy');
    await writeFile(gemini, `#!/bin/sh\ncat >/dev/null\nprintf '%s\\n' '{"event":"result","result":{"status":"SUCCESS","response":"promo","conversation_id":"g1"}}'\nsleep 60\n`);
    await chmod(gemini, 0o755);
    const cliStarted = Date.now();
    const result = await runCli({ ...input('gemini-cli'), cwd: directory, connection: { ...input('gemini-cli').connection, executable: gemini } });
    assert.deepEqual(result, { text: 'promo', sessionId: 'g1' });
    assert.ok(Date.now() - cliStarted < 5_000);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('combine and review calls get the 15-minute limit; other turns keep 5 minutes', async () => {
  const { turnTimeoutMs } = await import('../src/server/adapters/common.js');
  assert.equal(turnTimeoutMs('synthesize'), 15 * 60 * 1000);
  assert.equal(turnTimeoutMs('review'), 15 * 60 * 1000);
  for (const purpose of ['plan', 'task', 'reply'] as const) assert.equal(turnTimeoutMs(purpose), 5 * 60 * 1000);
});

test('writable turns edit only inside their folder; readable folders are added; no bypass flags', () => {
  const writable = { ...input('claude-cli'), cwd: '/work/run/tasks/t1', writable: true, readDirs: ['/work/run/tasks/t0'] } as TurnInput;
  const claude = buildCliCommand(writable).args;
  assert.equal(claude[claude.indexOf('--permission-mode') + 1], 'acceptEdits');
  assert.equal(claude[claude.indexOf('--tools') + 1], 'Read,Edit,Write,Glob,Grep');
  assert.equal(claude[claude.indexOf('--add-dir') + 1], '/work/run/tasks/t0');
  const codex = buildCliCommand({ ...writable, connection: input('codex-cli').connection }).args;
  assert.equal(codex[codex.indexOf('-s') + 1], 'workspace-write');
  assert.ok(codex.includes('sandbox_workspace_write.exclude_tmpdir_env_var=true'));
  assert.ok(codex.includes('sandbox_workspace_write.exclude_slash_tmp=true'));
  assert.ok(codex.includes('--skip-git-repo-check'));
  assert.equal(codex[codex.indexOf('-C') + 1], '/work/run/tasks/t1');
  const gemini = buildCliCommand({ ...writable, connection: input('gemini-cli').connection }).args;
  assert.equal(gemini[gemini.indexOf('--mode') + 1], 'accept-edits');
  assert.ok(gemini.includes('--sandbox'));
  assert.equal(gemini[gemini.indexOf('--add-dir') + 1], '/work/run/tasks/t0');
  for (const args of [claude, codex, gemini]) assert.ok(!args.some(a => /dangerously|bypass|yolo|danger-full-access/i.test(a)), args.join(' '));
  const reader = buildCliCommand({ ...input('claude-cli'), readDirs: ['/work/run/result'] } as TurnInput).args;
  assert.equal(reader[reader.indexOf('--permission-mode') + 1], 'plan');
  assert.equal(reader[reader.indexOf('--tools') + 1], 'Read,Glob,Grep');
});

test('a Gemini write outside its folder is reported with the denied path', async () => {
  const { DeniedActionError } = await import('../src/server/adapters/common.js');
  const output = [
    JSON.stringify({ event: 'step_update', step_update: { state: 'ERROR', step_type: 'tool', tool_name: 'write_file', tool_info: { name: 'write_file', parameters: { Path: '/work/run/promo.md' } }, error: { type: 'TOOL_ERROR', message: 'permission check failed' } } }),
    JSON.stringify({ event: 'result', result: { conversation_id: 'c1', status: 'SUCCESS', response: '', denied_actions: [{ action: 'write_file', display_name: 'WriteFile' }] } }),
  ].join('\n');
  assert.throws(() => parseCliResult('gemini-cli', output), (error: Error) => error instanceof DeniedActionError && /write_file/.test(error.message) && /\/work\/run\/promo\.md/.test(error.message));
  const command = JSON.stringify({ event: 'result', result: { conversation_id: 'c1', status: 'SUCCESS', response: '', denied_actions: [{ action: 'command' }] } });
  assert.throws(() => parseCliResult('gemini-cli', command), /^Error: CLI запретил действие: command$|CLI запретил действие: command/);
});
