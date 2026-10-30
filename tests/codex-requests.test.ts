import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CodexRequests } from '../src/server/codex/requests.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));
const approval = (id: string | number = 1, overrides = {}) => ({ id, method: 'item/commandExecution/requestApproval',
  params: { threadId: 't', turnId: 'turn', itemId: 'item', command: 'npm test', cwd: '/project', ...overrides } });
const question = (overrides = {}) => ({ id: 2, method: 'item/tool/requestUserInput', params: {
  threadId: 't', turnId: 'turn', itemId: 'item', questions: [{ id: 'q', header: 'Choice', question: 'Which?',
    isSecret: false, isOther: true, options: [{ label: 'One', description: 'First option' }] }], ...overrides } });
function harness() {
  const inputs: { text: string; options: { label: string }[]; signal?: AbortSignal; resolve: (answer: string | undefined) => void }[] = [];
  const responses: unknown[][] = [];
  const bridge = new CodexRequests({ telegram: { requestInput: (text, options, _timeout, signal) => new Promise(resolve => {
    inputs.push({ text, options, signal, resolve });
  }) }, respond: async (...args) => { responses.push(args); } });
  return { bridge, inputs, responses };
}

// Shape observed in Desktop's Browser use download permission, not a native permission grant.
const browserPermission = (overrides = {}) => ({ id: 'browser-request', method: 'mcpServer/elicitation/request', params: {
  threadId: 't', turnId: 'turn', serverName: 'cua_repl', mode: 'form',
  _meta: { codex_approval_kind: 'mcp_tool_call', connector_id: 'browser-use', connector_name: 'Browser use',
    persist: ['session', 'always'], 'x-codex-turn-metadata': { auto_review_enabled: true },
    tool_params: { asset_origins: ['https://support.grnd.gg'] },
    tool_params_display: [{ display_name: 'Download from', name: 'asset_origins', value: 'https://support.grnd.gg' }] },
  message: 'I need your permission to download assets used by support.grnd.gg',
  requestedSchema: { type: 'object', properties: {} }, ...overrides,
} });

test('Browser use MCP download approval reaches Telegram and approves once without persistence', async () => {
  const h = harness(); h.bridge.sync('t', '/project', [browserPermission()]);
  assert.equal(h.inputs.length, 1);
  assert.match(h.inputs[0].text, /Browser use/);
  assert.match(h.inputs[0].text, /https:\/\/support\.grnd\.gg/);
  assert.match(h.inputs[0].text, /asset_origins/);
  assert.doesNotMatch(h.inputs[0].text, /auto_review_enabled/);
  assert.deepEqual(h.inputs[0].options, [{ label: 'Approve once' }, { label: 'Decline' }]);
  h.inputs[0].resolve('Approve once'); await tick();
  assert.deepEqual(h.responses, [['t', 'browser-request', 'thread-follower-submit-mcp-server-elicitation-response', {
    conversationId: 't', requestId: 'browser-request', response: { action: 'accept', content: {}, _meta: null },
  }]]);
});

test('MCP permission decline, expiry and desktop resolution never approve', async () => {
  const h = harness(); h.bridge.sync('t', '/project', [browserPermission()]);
  h.inputs[0].resolve('Decline'); await tick();
  assert.deepEqual((h.responses[0][3] as { response: unknown }).response, { action: 'decline', content: null, _meta: null });
  for (const answer of ['Approve once', undefined, 'Always']) {
    const cancelled = harness(); cancelled.bridge.sync('t', '/project', [browserPermission()]);
    cancelled.bridge.sync('t', '/project', []); cancelled.inputs[0].resolve(answer); await tick();
    assert.equal(cancelled.responses.length, 0);
  }
  for (const answer of [undefined, 'Always']) {
    const expired = harness(); expired.bridge.sync('t', '/project', [browserPermission()]);
    expired.inputs[0].resolve(answer); await tick();
    expired.bridge.sync('t', '/project', [browserPermission()]);
    assert.equal(expired.responses.length, 0); assert.equal(expired.inputs.length, 1);
  }
});

test('MCP credential forms, auth, URLs, unknown grants and oversized details stay desktop-only', () => {
  const original = browserPermission().params;
  for (const override of [
    { mode: 'url', url: 'https://example.com/auth' }, { mode: 'openai/userVerification' },
    { _meta: { ...original._meta, codex_approval_kind: 'browser_auth' } },
    { _meta: { ...original._meta, codex_approval_kind: 'browser_email_otp' } },
    { _meta: {} }, { requestedSchema: { type: 'object', properties: { password: { type: 'string' } } } },
    { requestedSchema: { type: 'object', properties: {}, required: ['hidden'] } },
    { _meta: { ...original._meta, tool_params: { details: 'a'.repeat(4000) } } },
    { threadId: 'other' }, { unexpectedPrivilege: true },
  ]) {
    const h = harness(); h.bridge.sync('t', '/project', [browserPermission(override)]);
    assert.equal(h.inputs.length, 0);
  }
});

test('approves only once and includes full context, never broader policy grants', async () => {
  const h = harness();
  h.bridge.sync('t', '/project', [approval(1, { reason: 'Run tests', additionalPermissions: { network: { enabled: true } } })]);
  assert.match(h.inputs[0].text, /npm test/);
  assert.match(h.inputs[0].text, /network/);
  h.inputs[0].resolve('Approve once'); await tick();
  assert.deepEqual(h.responses, [['t', 1, 'thread-follower-command-approval-decision', { conversationId: 't', requestId: 1, decision: 'accept' }]]);
  h.bridge.sync('t', '/project', [approval(1, { reason: 'Run tests', additionalPermissions: { network: { enabled: true } } })]);
  assert.equal(h.inputs.length, 1);
});

test('desktop-first, disappearance and changed payload invalidate pending answers', async () => {
  const h = harness(); h.bridge.sync('t', '/project', [approval()]);
  h.bridge.sync('t', '/project', []);
  assert.equal(h.inputs[0].signal?.aborted, true);
  h.inputs[0].resolve('Approve once'); await tick(); assert.equal(h.responses.length, 0);
  h.bridge.sync('t', '/project', [approval()]);
  h.bridge.sync('t', '/project', [approval(1, { command: 'different' })]);
  assert.equal(h.inputs[1].signal?.aborted, true);
  h.inputs[1].resolve('Approve once'); await tick(); assert.equal(h.responses.length, 0);
  h.inputs[2].resolve('Decline'); await tick(); assert.equal(h.responses.length, 1);
});

test('unknown, incomplete, cross-thread, oversized and secret requests stay on desktop', () => {
  const h = harness();
  for (const value of [approval(1, { command: null }), approval(1, { threadId: 'other' }),
    approval(1, { command: 'a'.repeat(4000) }), { id: 3, method: 'item/fileChange/requestApproval', params: {} },
    question({ questions: [{ id: 'q', question: 'Password?', header: 'Password', isSecret: true, options: null }] }),
    approval(1, { unexpectedPrivilege: true })]) h.bridge.sync('t', '/project', [value]);
  assert.equal(h.inputs.length, 0);
});

test('questions collect every answer and map exact labels or free text to IDs', async () => {
  const h = harness();
  const qs = question().params.questions;
  h.bridge.sync('t', '/project', [question({ questions: [...qs, { ...qs[0], id: 'second', options: null }] })]);
  assert.match(h.inputs[0].text, /First option/);
  h.inputs[0].resolve('One'); await tick(); assert.equal(h.responses.length, 0);
  h.inputs[1].resolve('Custom answer'); await tick();
  assert.deepEqual(h.responses, [['t', 2, 'thread-follower-submit-user-input', { conversationId: 't', requestId: 2,
    response: { answers: { q: { answers: ['One'] }, second: { answers: ['Custom answer'] } } } }]]);
});

test('timeouts, errors and non-option approval replies never approve', async () => {
  for (const reply of [undefined, 'yes', 'acceptForSession']) {
    const h = harness(); h.bridge.sync('t', '/project', [approval()]); h.inputs[0].resolve(reply); await tick();
    h.bridge.sync('t', '/project', [approval()]);
    assert.equal(h.responses.length, 0); assert.equal(h.inputs.length, 1);
  }
  const h = harness(); h.bridge.sync('t', '/project', [approval(1, { availableDecisions: ['decline', 'cancel'] })]);
  assert.deepEqual(h.inputs[0].options, [{ label: 'Decline' }]);
  h.inputs[0].resolve('Approve once'); await tick(); assert.equal(h.responses.length, 0);
});

test('typed request IDs are distinct and cancellation can target one thread', async () => {
  const h = harness(); h.bridge.sync('t', '/project', [approval(1), approval('1')]);
  assert.equal(h.inputs.length, 2); h.bridge.cancel('other');
  assert.equal(h.inputs[0].signal?.aborted, false); h.bridge.cancel();
  assert.ok(h.inputs.every(input => input.signal?.aborted));
  for (const input of h.inputs) input.resolve('Approve once');
  await tick(); assert.equal(h.responses.length, 0);
});

test('Telegram and desktop errors remain deduplicated without unhandled rejection', async () => {
  let prompts = 0; let replies = 0;
  const unavailable = new CodexRequests({ telegram: { requestInput: async () => { prompts++; throw new Error('offline'); } },
    respond: async () => { replies++; } });
  unavailable.sync('t', '/project', [approval()]); await tick(); unavailable.sync('t', '/project', [approval()]);
  assert.equal(prompts, 1); assert.equal(replies, 0);
  const disconnected = new CodexRequests({ telegram: { requestInput: async () => 'Approve once' },
    respond: async () => { replies++; throw new Error('gone'); } });
  disconnected.sync('t', '/project', [approval()]); await tick(); disconnected.sync('t', '/project', [approval()]);
  await tick(); assert.equal(replies, 1);
});

test('ambiguous duplicate IDs, unavailable decisions, and expired questions are not forwarded', async () => {
  const h = harness();
  h.bridge.sync('t', '/project', [approval(), approval(1, { command: 'other' })]);
  h.bridge.sync('t', '/project', [approval(1, { availableDecisions: ['cancel'] })]);
  h.bridge.sync('t', '/project', [question({ autoResolutionMs: 0 })]);
  h.bridge.sync('t', '/project', [null]);
  assert.equal(h.inputs.length, 0);
  h.bridge.sync('t', '/project', [question({ autoResolutionMs: 1 })]);
  await new Promise(resolve => setTimeout(resolve, 5));
  h.inputs[0].resolve('One'); await tick(); assert.equal(h.responses.length, 0);
});

test('oversized question options and duplicate question IDs remain desktop-only', () => {
  const h = harness();
  const q = question().params.questions[0];
  h.bridge.sync('t', '/project', [question({ questions: [q, q] })]);
  h.bridge.sync('t', '/project', [question({ questions: [{ ...q, question: 'x'.repeat(3800) }] })]);
  assert.equal(h.inputs.length, 0);
  h.bridge.sync('t', '/project', [approval()]);
  h.bridge.sync('t', '/project', Array.from({ length: 33 }, (_, id) => approval(id)));
  assert.equal(h.inputs[0].signal?.aborted, true);
});

const permissionRequest = (permissions: unknown, overrides = {}) => ({ id: 3, method: 'item/permissions/requestApproval', params: {
  threadId: 't', turnId: 'turn', itemId: 'item', environmentId: 'local', startedAtMs: 123,
  cwd: '/project', reason: 'Read input and write export', permissions, ...overrides,
} });

test('native permissions show the complete grant and approve only the requested current-turn subset', async () => {
  const h = harness();
  const permissions = { network: { enabled: true }, fileSystem: { read: ['/input'], write: ['/export'],
    entries: [{ path: { type: 'path', path: '/export' }, access: 'write' }] } };
  h.bridge.sync('t', '/project', [permissionRequest(permissions)]);
  assert.match(h.inputs[0].text, /current turn/);
  assert.match(h.inputs[0].text, /\/input/);
  assert.match(h.inputs[0].text, /\/export/);
  h.inputs[0].resolve('Approve once'); await tick();
  assert.deepEqual(h.responses, [['t', 3, 'thread-follower-permissions-request-approval-response', {
    conversationId: 't', requestId: 3, response: { permissions, scope: 'turn' },
  }]]);
});

test('native permission decline grants nothing and null request categories stay omitted', async () => {
  for (const answer of ['Decline', 'Approve once']) {
    const h = harness(); h.bridge.sync('t', '/project', [permissionRequest({ network: { enabled: true }, fileSystem: null })]);
    h.inputs[0].resolve(answer); await tick();
    assert.deepEqual(h.responses[0], ['t', 3, 'thread-follower-permissions-request-approval-response', {
      conversationId: 't', requestId: 3,
      response: { permissions: answer === 'Decline' ? {} : { network: { enabled: true } }, scope: 'turn' },
    }]);
  }
});

test('unknown permission shapes, added fields and grants too large to display stay desktop-only', () => {
  const h = harness();
  for (const permissions of [
    { network: { enabled: true, newGrant: true }, fileSystem: null },
    { network: null, fileSystem: { read: null, write: null, entries: [{ path: { type: 'special', value: { kind: 'unknown', path: 'x', subpath: null } }, access: 'write' }] } },
    { network: null, fileSystem: { read: null, write: ['x'.repeat(3900)] } },
    { network: null, fileSystem: null, broadPermission: true },
  ]) h.bridge.sync('t', '/project', [permissionRequest(permissions)]);
  h.bridge.sync('t', '/project', [permissionRequest({ network: null, fileSystem: null }, { futureScope: 'session' })]);
  assert.equal(h.inputs.length, 0);
});
