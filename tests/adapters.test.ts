import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseJsonObject, runTurn, discoverConnections } from '../src/server/adapters/index.js';
import { buildCliCommand, cliEnvironment, parseCliResult } from '../src/server/adapters/cli.js';
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
    await assert.rejects(runTurn(input()), (error: Error) => error.message.includes('[REDACTED]') && !error.message.includes('secret-'));
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


test('CLI environment preserves own auth and hides unrelated secrets from children', async () => {
  const saved = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, SENTINEL_SECRET: process.env.SENTINEL_SECRET };
  process.env.OPENAI_API_KEY = 'openai-auth';
  process.env.ANTHROPIC_API_KEY = 'anthropic-auth';
  process.env.SENTINEL_SECRET = 'unrelated';
  try {
    assert.equal(cliEnvironment('codex-cli').OPENAI_API_KEY, 'openai-auth');
    assert.equal(cliEnvironment('codex-cli').ANTHROPIC_API_KEY, undefined);
    assert.equal(cliEnvironment('claude-cli').ANTHROPIC_API_KEY, 'anthropic-auth');
    assert.equal(cliEnvironment('claude-cli').OPENAI_API_KEY, undefined);
    const stdout = await runProcess(process.execPath, ['-e', 'process.stdout.write(String(process.env.SENTINEL_SECRET))'], { cwd: process.cwd(), signal: new AbortController().signal });
    assert.equal(stdout, 'undefined');
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
