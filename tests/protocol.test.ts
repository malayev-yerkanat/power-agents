import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEnvelope } from '../src/server/core/protocol.ts';

test('an answer may publish up to 40 facts and name the facts it uses', () => {
  const facts = Array.from({ length: 40 }, (_, i) => ({ key: `fact-${i}`, value: String(i) }));
  const raw = (extra: object) => JSON.stringify({ summary: 'ok', status: 'done', messages: [], ...extra });
  assert.equal(parseEnvelope(raw({ facts, usesFacts: ['price'] }), ['a', 'b'], 'a').facts?.length, 40);
  assert.deepEqual(parseEnvelope(raw({ usesFacts: ['price'] }), ['a', 'b'], 'a').usesFacts, ['price']);
  assert.throws(() => parseEnvelope(raw({ facts: [...facts, { key: 'one-more', value: 'x' }] }), ['a', 'b'], 'a'));
});

test('a plain-text artifact is taken as the body; an empty one is still refused', () => {
  const raw = (extra: object) => JSON.stringify({ summary: 'ok', status: 'done', messages: [], ...extra });
  assert.deepEqual(parseEnvelope(raw({ artifact: 'Проверка пройдена' }), ['a', 'b'], 'a').artifact, { title: 'Результат', body: 'Проверка пройдена' });
  assert.deepEqual(parseEnvelope(raw({ artifact: { title: 'T', body: 'B' } }), ['a', 'b'], 'a').artifact, { title: 'T', body: 'B' });
  assert.throws(() => parseEnvelope(raw({ artifact: '  ' }), ['a', 'b'], 'a'));
});
