import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setImmediate as yieldLoop } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Engine } from '../src/server/engine.ts';
import { createMcpHandler } from '../src/server/mcp.ts';
import { Store } from '../src/server/store.ts';
import type { Context } from '../src/server/core/prompts.ts';
import type { CreateRunInput, Run, TaskSpec, TurnInput, TurnRunner } from '../src/shared/types.ts';

const contextOf = (value: TurnInput): Context => JSON.parse(value.prompt.split('\nCONTEXT:\n')[1]) as Context;
const envelope = (fields: object = {}) => ({ text: JSON.stringify({ summary: 'Done', status: 'done', messages: [], ...fields }) });
const input: CreateRunInput = {
  goal: 'Coordinate through team tools', mode: 'demo', leaderId: 'a',
  members: [{ id: 'a', name: 'Agent a', connectionId: 'demo', model: '', role: 'Lead' }, { id: 'b', name: 'Agent b', connectionId: 'demo', model: '', role: 'Builder' }],
};
const plan = (run: Run, tasks: TaskSpec[]) => ({ text: JSON.stringify({ summary: 'Plan', successCriteria: ['Works'], roles: run.members.map(m => ({ memberId: m.id, role: m.role })), tasks }) });
async function until(predicate: () => boolean, describe: string): Promise<void> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.fail(`Timed out waiting for ${describe}`);
}
async function connect(url: string, token: string): Promise<Client> {
  const client = new Client({ name: 'test-agent', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return client;
}
const text = (result: unknown) => ((result as { content: { text: string }[] }).content[0].text);
function raw(port: number, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers } }, res => { res.resume(); resolve(res.statusCode!); });
    req.on('error', reject);
    req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
  });
}

test('agents use team tools as themselves; impersonation, stale tokens and browser requests are refused', async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'power-mcp-'));
  const store = new Store(':memory:');
  let engine!: Engine;
  const handler = createMcpHandler({ grant: t => engine.grant(t), tools: g => engine.tools(g), call: (t, n, a) => engine.call(t, n, a) });
  const server = createServer((req, res) => { void handler(req, res).then(handled => { if (!handled) { res.writeHead(404); res.end(); } }); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}/mcp`;
  const seen: Record<string, unknown> = {};
  let staleToken = '';
  const tasks: TaskSpec[] = [
    { id: 't1', title: 'Price', description: 'Decide the price', assigneeId: 'a', dependsOn: [] },
    { id: 't2', title: 'Promo', description: 'Use the price', assigneeId: 'b', dependsOn: ['t1'] },
  ];
  const runner: TurnRunner = async value => {
    const { run, taskId } = contextOf(value);
    if (value.purpose === 'plan') return plan(run, tasks);
    if (taskId === 't1') {
      seen.leaderPrompt = value.prompt;
      const client = await connect(value.team!.url, value.team!.token);
      seen.leaderTools = (await client.listTools()).tools.map(t => t.name);
      await client.callTool({ name: 'publish_fact', arguments: { key: 'Цена', value: '1 200 ₸' } });
      await client.callTool({ name: 'send_message', arguments: { toId: 'b', body: 'Цена — 1 200 ₸' } });
      seen.added = JSON.parse(text(await client.callTool({ name: 'add_task', arguments: { title: 'Extra', description: 'Extra work', assigneeId: 'b', dependsOn: ['t1'] } })));
      seen.forged = await client.callTool({ name: 'send_message', arguments: { toId: 'b', body: 'Hi', fromId: 'b' } });
      await client.close();
    }
    if (taskId === 't2') {
      const client = await connect(value.team!.url, value.team!.token);
      staleToken = value.team!.token;
      seen.builderTools = (await client.listTools()).tools.map(t => t.name);
      seen.inbox = JSON.parse(text(await client.callTool({ name: 'read_inbox', arguments: {} })));
      seen.steal = await client.callTool({ name: 'publish_fact', arguments: { key: 'Цена', value: '1 ₸' } });
      seen.promote = await client.callTool({ name: 'add_task', arguments: { title: 'Mine', description: 'x', assigneeId: 'b' } });
      await client.close();
    }
    if (value.purpose === 'review') return envelope({ verdict: 'pass', artifact: { title: 'Review', body: 'ok' } });
    return envelope({ artifact: { title: value.purpose, body: 'Done' } });
  };
  engine = new Engine({ store, connections: [], workspaceRoot, demoRunner: runner, teamUrl: url });
  try {
    const run = engine.create(input);
    await until(() => engine.get(run.id).status === 'awaiting_approval', 'plan');
    engine.approve(run.id, engine.get(run.id).version);
    await until(() => ['completed', 'paused'].includes(engine.get(run.id).status), 'finish');
    const done = engine.get(run.id);
    assert.equal(done.status, 'completed', done.error);
    assert.match(String(seen.leaderPrompt), /командные инструменты MCP-сервера team/);
    assert.ok((seen.leaderTools as string[]).includes('add_task'));
    assert.ok(!(seen.builderTools as string[]).includes('add_task'), 'only the leader is offered leader tools');
    assert.equal((seen.forged as { isError?: boolean }).isError, true, 'a smuggled sender is rejected');
    assert.match(text(seen.steal), /принадлежит Agent a/);
    assert.equal((seen.steal as { isError?: boolean }).isError, true);
    assert.equal((seen.promote as { isError?: boolean }).isError, true);
    assert.ok((seen.inbox as { messages: { fromId: string; body: string }[] }).messages.some(m => m.fromId === 'a' && m.body === 'Цена — 1 200 ₸'));
    const extra = done.tasks.find(t => t.id === (seen.added as { taskId: string }).taskId)!;
    assert.deepEqual([extra.assigneeId, extra.status], ['b', 'completed']);
    assert.deepEqual(done.facts!.map(f => [f.key, f.value, f.ownerId]), [['Цена', '1 200 ₸', 'a']]);
    const events = store.eventBatch(run.id, 0).filter(e => e.type === 'team_tool');
    assert.ok(events.some(e => e.actorId === 'a') && events.some(e => e.actorId === 'b'));
    assert.equal(await raw(port, { Authorization: `Bearer ${staleToken}` }), 401, 'a token dies with its turn');
    assert.equal(await raw(port, {}), 401);
    assert.equal(await raw(port, { Authorization: 'Bearer forged' }), 401);
    assert.equal(await raw(port, { Authorization: `Bearer ${staleToken}`, Origin: 'https://evil.example' }), 403);
    assert.equal(await raw(port, { Authorization: `Bearer ${staleToken}`, Host: 'evil.example' }), 403);
  } finally {
    engine.shutdown(); await yieldLoop();
    server.closeAllConnections(); server.close(); store.close(); rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('the leader learns who has team tools; connections say so too', async () => {
  const { promptFor } = await import('../src/server/core/prompts.ts');
  const now = '2026-10-26T00:00:00.000Z';
  const run = { id: 'r', title: 'R', goal: 'Goal text here', status: 'planning', phase: 'plan', mode: 'live', leaderId: 'a', members: input.members, tasks: [], messages: [], artifacts: [], sessions: {}, turnCount: 0, reviewRound: 0, createdAt: now, updatedAt: now, version: 1 } as Run;
  assert.match(promptFor({ run, memberId: 'a', purpose: 'plan', toolMembers: ['a'] }), /Командные инструменты .* есть у: a; остальные общаются только через итоговый JSON-ответ/);
  assert.doesNotMatch(promptFor({ run, memberId: 'a', purpose: 'plan' }), /Командные инструменты/);
});
