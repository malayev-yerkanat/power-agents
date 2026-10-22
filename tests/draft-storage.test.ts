import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  composerDraftSchema,
  readDraft,
  steeringDraftSchema,
  writeDraft,
} from '../src/client/draftStorage';

const draft = {
  goal: '',
  mode: 'demo' as const,
  leaderId: 'a',
  members: [
    { id: 'a', name: '', connectionId: 'missing-provider', model: '', role: '' },
    { id: 'b', name: 'Reviewer', connectionId: 'claude', model: '', role: '' },
  ],
};

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
}

test('incomplete draft round trips without changing provider identity', () => {
  const store = memory();
  assert.equal(writeDraft(store, 'draft', draft, composerDraftSchema), '');
  assert.deepEqual(readDraft(store, 'draft', composerDraftSchema), { value: draft, error: '' });
});

test('missing, corrupt, oversized, and wrong-version storage have distinct safe outcomes', () => {
  const store = memory();
  assert.deepEqual(readDraft(store, 'draft', composerDraftSchema), { error: '' });
  for (const raw of ['{', 'x'.repeat(600_001), JSON.stringify({ version: 2, value: draft })]) {
    store.setItem('draft', raw);
    const result = readDraft(store, 'draft', composerDraftSchema);
    assert.equal(result.value, undefined);
    assert.ok(result.error);
  }
});

test('duplicate members, invalid leader, and extra fields cannot be restored', () => {
  assert.equal(composerDraftSchema.safeParse({ ...draft, leaderId: 'missing' }).success, false);
  assert.equal(composerDraftSchema.safeParse({ ...draft, members: [draft.members[0], draft.members[0]] }).success, false);
  assert.equal(composerDraftSchema.safeParse({ ...draft, credential: 'secret' }).success, false);
});

test('denied storage never crashes or claims to save', () => {
  const store = {
    getItem: (): string | null => { throw new Error('denied'); },
    setItem: (): void => { throw new Error('quota'); },
  };
  assert.ok(readDraft(store, 'draft', steeringDraftSchema).error);
  assert.ok(writeDraft(store, 'draft', 'unsaved', steeringDraftSchema));
});

test('invalid values are rejected before any storage write', () => {
  const writes: string[] = [];
  const store = { setItem: (_key: string, value: string) => { writes.push(value); } };
  const invalidDraft = { ...draft, credential: 'secret' };
  assert.ok(writeDraft(store, 'draft', invalidDraft, composerDraftSchema));
  assert.equal(writes.length, 0);
});

test('envelopes over the read limit are rejected before any storage write', () => {
  const writes: string[] = [];
  const store = { setItem: (_key: string, value: string) => { writes.push(value); } };
  assert.ok(writeDraft(store, 'draft', 'x'.repeat(600_000), z.string()));
  assert.equal(writes.length, 0);
});

test('draft text limits are enforced', () => {
  assert.equal(steeringDraftSchema.safeParse('x'.repeat(8001)).success, false);
  assert.equal(composerDraftSchema.safeParse({ ...draft, goal: 'x'.repeat(12001) }).success, false);
});
