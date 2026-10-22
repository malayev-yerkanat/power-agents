import test from 'node:test';
import assert from 'node:assert/strict';
import type { CreateRunInput } from '../src/shared/types';
import { validateComposer } from '../src/client/composerValidation';
import { completed, connections } from './e2e/fixtures';

const input: CreateRunInput = {
  goal: 'Enough detail for a goal',
  members: completed.members,
  leaderId: 'a',
  mode: 'live',
};

test('short goal is the first actionable error', () => {
  assert.deepEqual(validateComposer({ ...input, goal: 'short' }, connections)[0], {
    fieldId: 'goal', message: 'Опишите цель подробнее: минимум 10 символов.',
  });
});

test('member errors follow visible name, connection, model order', () => {
  const members = input.members.map((member, index) => index === 0
    ? { ...member, name: '', connectionId: 'missing' }
    : member);
  assert.deepEqual(validateComposer({ ...input, members }, connections).map(issue => issue.fieldId),
    ['name-a', 'connection-a']);
});

test('unknown provider is invalid in both live and demo modes', () => {
  const members = input.members.map((member, index) => index === 0
    ? { ...member, connectionId: 'removed-provider' }
    : member);
  assert.deepEqual(validateComposer({ ...input, members }, connections).map(issue => issue.fieldId),
    ['connection-a']);
  assert.deepEqual(validateComposer({ ...input, members, mode: 'demo' }, connections).map(issue => issue.fieldId),
    ['connection-a']);
});

test('unavailable provider is invalid for live mode', () => {
  const unavailable = { ...connections[0], available: false };
  assert.deepEqual(validateComposer(input, [unavailable, connections[1]]).map(issue => issue.fieldId),
    ['connection-a']);
  assert.deepEqual(validateComposer({ ...input, mode: 'demo' }, [unavailable, connections[1]]), []);
});

test('missing API model identifies its member only in live mode', () => {
  const api = { id: 'openai-api', name: 'OpenAI', kind: 'openai-api' as const, available: true, detail: '' };
  const members = input.members.map((member, index) => index === 0
    ? { ...member, connectionId: api.id }
    : member);
  assert.deepEqual(validateComposer({ ...input, members }, [...connections, api]).map(issue => issue.fieldId),
    ['model-a']);
  assert.deepEqual(validateComposer({ ...input, members, mode: 'demo' }, [...connections, api]), []);
});
