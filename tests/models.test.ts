import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createModelCatalogLoader, parseAntigravityModels, parseApiModels, parseCodexModels } from '../src/server/adapters/models.ts';
import type { Connection } from '../src/shared/types.ts';

const codex: Connection = { id: 'codex', name: 'Codex CLI', kind: 'codex-cli', available: true, executable: '/bin/codex', detail: '' };
const gemini: Connection = { id: 'gemini', name: 'Gemini', kind: 'gemini-cli', available: true, executable: '/bin/agy', detail: '' };

test('parses visible Codex models without exposing metadata or hidden entries', () => {
  const input = JSON.stringify({ models: [
    { slug: 'gpt-6.1-sol', display_name: 'GPT-6.1 Sol', visibility: 'list', model_messages: { secret: 'ignore' } },
    { slug: 'hidden-model', display_name: 'Hidden', visibility: 'hide' },
  ] });
  assert.deepEqual(parseCodexModels(input), [{ id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' }]);
  assert.throws(() => parseCodexModels('{bad'), /JSON/);
  assert.throws(() => parseCodexModels(JSON.stringify({ models: 'bad' })), /models/);
});

test('parses Antigravity tab separated models and rejects malformed output', () => {
  assert.deepEqual(parseAntigravityModels('gemini-3.8-flash-low\tGemini 3.8 Flash (Low)\n'), [
    { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)' },
  ]);
  assert.throws(() => parseAntigravityModels('not-a-model-line'), /models/);
});

test('parses API models with bounded and valid identifiers', () => {
  assert.deepEqual(parseApiModels({ data: [
    { id: 'gpt-5', display_name: 'GPT 5' }, { id: 'bad id', display_name: 'Bad' },
    { id: 'x'.repeat(121), display_name: 'Too long for run schema' },
  ] }), [{ id: 'gpt-5', name: 'GPT 5' }]);
  assert.throws(() => parseApiModels({ data: {} }), /data/);
});

test('loads CLI models on demand and caches only successful results for five minutes', async () => {
  let calls = 0;
  let now = 0;
  const loader = createModelCatalogLoader({
    now: () => now,
    runCommand: async (_binary, args) => {
      calls += 1;
      assert.deepEqual(args, ['debug', 'models']);
      return JSON.stringify({ models: [{ slug: 'gpt-6.1-sol', display_name: 'GPT-6.1 Sol', visibility: 'list' }] });
    },
  });
  const first = await loader(codex);
  assert.equal(first.connectionId, 'codex');
  assert.equal(first.status, 'ready');
  assert.deepEqual(first.models, [{ id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' }]);
  assert.deepEqual(await loader(codex), first);
  assert.equal(calls, 1);
  now = 300_001;
  await loader(codex);
  assert.equal(calls, 2);
});

test('failed provider discovery returns a safe note and is retried', async () => {
  let calls = 0;
  const loader = createModelCatalogLoader({
    runCommand: async () => { calls += 1; throw new Error('secret API key: abc123'); },
  });
  const result = await loader(gemini);
  assert.equal(result.status, 'error');
  assert.deepEqual(result.models, []);
  assert.doesNotMatch(result.note, /abc123|secret/i);
  await loader(gemini);
  assert.equal(calls, 2);
});

test('Claude offers documented aliases with an access caveat; unavailable connections do not invoke CLI', async () => {
  const loader = createModelCatalogLoader({ runCommand: async () => { throw new Error('unexpected'); } });
  const claude = await loader({ ...codex, id: 'claude', kind: 'claude-cli' });
  assert.equal(claude.status, 'ready');
  assert.deepEqual(claude.models.map(model => model.id), ['sonnet', 'opus', 'haiku']);
  assert.match(claude.note, /не проверен/i);
  const unavailable = await loader({ ...codex, available: false });
  assert.equal(unavailable.status, 'unavailable');
});

test('API discovery reads only the official model endpoint with server-side credentials', async () => {
  const before = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  const urls: string[] = [];
  const loader = createModelCatalogLoader({ fetcher: async (url, init) => {
    urls.push(String(url));
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-key');
    return Response.json({ data: [{ id: 'gpt-5', object: 'model' }] });
  } });
  try {
    const result = await loader({ ...codex, id: 'openai-api', kind: 'openai-api' });
    assert.equal(result.status, 'ready');
    assert.deepEqual(result.models, [{ id: 'gpt-5', name: 'gpt-5' }]);
    assert.deepEqual(urls, ['https://api.openai.com/v1/models']);
    assert.doesNotMatch(JSON.stringify(result), /test-key/);
  } finally {
    if (before === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = before;
  }
});

test('Anthropic discovery follows bounded model-list pages', async () => {
  const before = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const urls: string[] = [];
  const loader = createModelCatalogLoader({ fetcher: async (url, init) => {
    urls.push(String(url));
    assert.equal(new Headers(init?.headers).get('x-api-key'), 'test-key');
    return Response.json(urls.length === 1
      ? { data: [{ id: 'claude-sonnet-4', display_name: 'Claude Sonnet 4' }], has_more: true, last_id: 'claude-sonnet-4' }
      : { data: [{ id: 'claude-opus-4', display_name: 'Claude Opus 4' }], has_more: false, last_id: 'claude-opus-4' });
  } });
  try {
    const result = await loader({ ...codex, id: 'anthropic-api', kind: 'anthropic-api' });
    assert.equal(result.status, 'ready');
    assert.deepEqual(result.models.map(model => model.id), ['claude-sonnet-4', 'claude-opus-4']);
    assert.deepEqual(urls, [
      'https://api.anthropic.com/v1/models?limit=100',
      'https://api.anthropic.com/v1/models?after_id=claude-sonnet-4&limit=100',
    ]);
  } finally {
    if (before === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = before;
  }
});
