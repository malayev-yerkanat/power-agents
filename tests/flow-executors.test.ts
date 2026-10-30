import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Connection, TurnInput, TurnRunner } from '../src/shared/types.ts';
import { createLiveExecutors } from '../src/server/flows/executors.ts';
import { registry, type ExecutionContext } from '../src/server/flows/registry.ts';

const connection = (id: string, kind: Connection['kind'], available = true): Connection => ({ id, kind, available, name: id, detail: '' });
const connections = [connection('codex', 'codex-cli'), connection('gemini', 'gemini-cli'), connection('claude', 'claude-cli')];
import { idea, script, scenes, names, starts, ends } from './fixtures/flow-results.ts';
function context(type: string, config = {}): ExecutionContext {
  return { flow: { id: 'flow', mode: 'live' } as ExecutionContext['flow'], node: { id: type, type, title: type, position: { x: 0, y: 0 }, gate: true, status: 'running', version: 2, notes: [], config: registry[type].config.parse(config) },
    inputs: { brand: { value: { text: 'Our brand', rules: ['No victim mockery'] } }, idea: { value: idea }, script: { value: script() } }, notes: ['Clearer metaphor', 'More visual jokes'], dir: '/tmp/flow/idea/v2', signal: new AbortController().signal };
}
for (const [type, result] of Object.entries({ idea, script: script(), scenes })) {
  test(`${type} sends brand, upstream values, config and all rejection notes in an isolated read-only turn`, async () => {
    const calls: TurnInput[] = [];
    const runner: TurnRunner = async input => { calls.push(input); return { text: JSON.stringify(result), sessionId: 'discard' }; };
    const output = await createLiveExecutors({ runner, connections })[type](context(type, { prompt: 'Extra direction', model: 'chosen-model' }));
    assert.deepEqual(output[type].value, result);
    assert.equal(calls.length, 1);
    const input = calls[0];
    for (const value of ['Our brand', 'No victim mockery', 'Clearer metaphor', 'More visual jokes', 'Revise according to these notes', 'Extra direction', 'Robux trading']) assert.ok(input.prompt.includes(value), value);
    assert.equal(input.connection.id, 'claude'); assert.equal(input.member.model, 'chosen-model');
    assert.equal(input.cwd, '/tmp/flow/idea/v2'); assert.equal(input.writable, false); assert.equal(input.purpose, 'flow');
    assert.equal(input.team, undefined); assert.equal(input.sessionId, undefined);
  });
}
test('malformed JSON and invalid shapes get one stateless repair, then fail with parse detail', async () => {
  for (const bad of ['not json', '{}']) {
    const calls: TurnInput[] = [];
    const executor = createLiveExecutors({ connections, runner: async input => { calls.push(input); return { text: calls.length === 1 ? bad : JSON.stringify(idea) }; } }).idea;
    await executor(context('idea'));
    assert.equal(calls.length, 2); assert.match(calls[1].prompt, /return only valid JSON matching this shape/i);
    assert.equal(calls[1].sessionId, undefined); assert.match(calls[1].prompt, /No victim mockery/);
  }
  let calls = 0;
  await assert.rejects(createLiveExecutors({ connections, runner: async () => { calls++; return { text: 'broken' }; } }).idea(context('idea')), /JSON/);
  assert.equal(calls, 2);
});
test('script retries using the measured count, never trusting a fabricated wordCount', async () => {
  const calls: TurnInput[] = [];
  const executor = createLiveExecutors({ connections, runner: async input => { calls.push(input); return { text: JSON.stringify(calls.length === 1 ? { ...script(100), wordCount: 150 } : script()) }; } }).script;
  await executor(context('script', { words: 145 }));
  assert.equal(calls.length, 2); assert.match(calls[1].prompt, /100 words/); assert.match(calls[1].prompt, /145/);
  await assert.rejects(createLiveExecutors({ connections, runner: async () => ({ text: JSON.stringify(script(100)) }) }).script(context('script')), /100 words/);
});
test('connection selection prefers Claude, Codex, Gemini, supports explicit API, and fails clearly', async () => {
  for (const [available, expected] of [[connections, 'claude'], [connections.slice(0, 2), 'codex'], [[connections[1]], 'gemini']] as [Connection[], string][]) {
    await createLiveExecutors({ connections: available, runner: async input => { assert.equal(input.connection.id, expected); return { text: JSON.stringify(idea) }; } }).idea(context('idea'));
  }
  const api = connection('api', 'openai-api');
  await createLiveExecutors({ connections: [api], runner: async input => { assert.equal(input.connection.id, 'api'); return { text: JSON.stringify(idea) }; } }).idea(context('idea', { connectionId: 'api' }));
  const runner: TurnRunner = async () => { throw new Error('must not call'); };
  await assert.rejects(createLiveExecutors({ connections: [api], runner }).idea(context('idea')), /Нет доступных CLI/);
  for (const id of ['missing', 'claude']) await assert.rejects(createLiveExecutors({ connections: [connection('claude', 'claude-cli', false)], runner }).idea(context('idea', { connectionId: id })), /Подключение.*недоступно/);
});
test('idea enforces score totals, best choice, candidate count, hook format and production threshold', async () => {
  const invalid = [ { ...idea, candidates: idea.candidates.slice(0, 2) }, { ...idea, chosen: 9 },
    { ...idea, candidates: idea.candidates.map(c => ({ ...c, total: 15 })) },
    { ...idea, candidates: idea.candidates.map(c => ({ ...c, hook: 'Wrong hook' })) },
    { ...idea, candidates: idea.candidates.map(c => ({ ...c, scores: { ...c.scores, safety: 0 } })) },
    { ...idea, candidates: idea.candidates.map(c => ({ ...c, total: 15, scores: { hook: 3, mappability: 3, payoff: 3, timeliness: 3, safety: 3 } })) },
    { ...idea, candidates: idea.candidates.map((c, i) => i === 1 ? { ...c, total: 22, scores: { ...c.scores, hook: 5 } } : c) } ];
  for (const value of invalid) await assert.rejects(createLiveExecutors({ connections, runner: async () => ({ text: JSON.stringify(value) }) }).idea(context('idea')));
});
test('scenes cover every beat in order and use connected beat timings over script times', async () => {
  const ctx = context('scenes');
  const timings = { beats: names.map((beat, i) => ({ beat, start: starts[i] * .95, end: ends[i] * .95 })) };
  ctx.inputs.timings = { value: timings };
  const aligned = { scenes: scenes.scenes.map((scene, i) => ({ ...scene, start: timings.beats[i].start, end: timings.beats[i].end })) };
  await createLiveExecutors({ connections, runner: async input => { assert.match(input.prompt, /52.25/); return { text: JSON.stringify(aligned) }; } }).scenes(ctx);
  for (const value of [scenes, { scenes: aligned.scenes.slice(0, 4) }, { scenes: [...aligned.scenes].reverse() }]) {
    await assert.rejects(createLiveExecutors({ connections, runner: async () => ({ text: JSON.stringify(value) }) }).scenes(ctx));
  }
});
test('provider failures are not retried as formatting failures', async () => {
  let calls = 0;
  await assert.rejects(createLiveExecutors({ connections, runner: async () => { calls++; throw new Error('quota'); } }).idea(context('idea')), /quota/);
  assert.equal(calls, 1);
});


test('script rejects invalid hook, inconsistent text and noncanonical beat order/times', async () => {
  const valid = script();
  for (const value of [{ ...valid, hook: 'wrong' }, { ...valid, beats: [...valid.beats].reverse() },
    { ...valid, beats: valid.beats.map((b, i) => i === 0 ? { ...b, text: 'Wrong opening' } : b) },
    { ...valid, beats: valid.beats.map((b, i) => i === 4 ? { ...b, end: 80 } : b) }]) {
    await assert.rejects(createLiveExecutors({ connections, runner: async () => ({ text: JSON.stringify(value) }) }).script(context('script')));
  }
});
test('scenes map forced-alignment word intervals to beats and refuse missing/malformed timing inputs', async () => {
  const ctx = context('scenes');
  ctx.inputs.timings = { value: { words: Array.from({ length: 140 }, (_, i) => ({ start: i * .3, end: (i + 1) * .3 })) } };
  const boundaries = [0, 4, 34, 110, 130, 140];
  const aligned = { scenes: scenes.scenes.map((s, i) => ({ ...s, start: boundaries[i] * .3, end: boundaries[i + 1] * .3 })) };
  await createLiveExecutors({ connections, runner: async () => ({ text: JSON.stringify(aligned) }) }).scenes(ctx);
  for (const value of [undefined, {}, { words: [{ start: 0, end: 1 }] }, { words: [{ start: 2, end: 1 }] },
    { beats: names.map(beat => ({ beat, start: 0, end: 1 })) }]) {
    ctx.inputs.timings = { value };
    await assert.rejects(createLiveExecutors({ connections, runner: async () => { throw new Error('unexpected call'); } }).scenes(ctx));
  }
});
test('scene validation refuses duplicate IDs, reversed intervals and gaps', async () => {
  for (const value of [ { scenes: scenes.scenes.map(s => ({ ...s, id: 'same' })) },
    { scenes: scenes.scenes.map((s, i) => i === 1 ? { ...s, start: 8, end: 3 } : s) },
    { scenes: [...scenes.scenes.slice(0, 1), { ...scenes.scenes[1], end: 5 }, { ...scenes.scenes[1], id: 'gap', start: 6 }, ...scenes.scenes.slice(2)] } ]) {
    await assert.rejects(createLiveExecutors({ connections, runner: async () => ({ text: JSON.stringify(value) }) }).scenes(context('scenes')));
  }
});
test('cancelled calls never start a provider turn', async () => {
  const ctx = context('idea');
  ctx.signal = AbortSignal.abort();
  await assert.rejects(createLiveExecutors({ connections, runner: async () => { throw new Error('unexpected call'); } }).idea(ctx), /abort/i);
});
test('idea avoids configured and already-made topics, retrying once when a repeat comes back', async () => {
  const fresh = { ...idea, candidates: ['Tulip mania', 'FOMO', 'Trading'].map((topic, i) => ({ ...idea.candidates[i], topic, hook: `${topic} explained in Roblox` })) };
  const calls: TurnInput[] = [];
  const executor = createLiveExecutors({ connections, madeTopics: id => (id === 'flow' ? ['Gold rush'] : []),
    runner: async input => { calls.push(input); return { text: JSON.stringify(calls.length === 1 ? idea : fresh) }; } }).idea;
  const output = await executor(context('idea', { avoid: ['inflation '] }));
  assert.equal(calls.length, 2);
  assert.match(calls[0].prompt, /never propose these topics again: inflation; Gold rush/);
  assert.match(calls[1].prompt, /Topic already made: Inflation/);
  assert.deepEqual(output.idea.value, fresh);
});
test('script word range follows the node target instead of a fixed 130–160', async () => {
  const calls: TurnInput[] = [];
  const executor = createLiveExecutors({ connections, runner: async input => { calls.push(input); return { text: JSON.stringify(calls.length === 1 ? script(140) : script(125)) }; } }).script;
  const output = await executor(context('script', { words: 125 }));
  assert.match(calls[0].prompt, /115–135 words/);
  assert.match(calls[1].prompt, /Script has 140 words; return 115–135 words/);
  assert.equal((output.script.value as { wordCount: number }).wordCount, 125);
});
test('script receives only the chosen idea candidate', async () => {
  const calls: TurnInput[] = [];
  const executor = createLiveExecutors({ connections, runner: async input => { calls.push(input); return { text: JSON.stringify(script()) }; } }).script;
  const ctx = context('script');
  ctx.inputs.idea = { value: { ...idea, chosen: 1 } };
  delete ctx.inputs.script;
  await executor(ctx);
  assert.match(calls[0].prompt, /FOMO explained in Roblox/);
  assert.doesNotMatch(calls[0].prompt, /Inflation explained in Roblox|Trading explained in Roblox/);
});
