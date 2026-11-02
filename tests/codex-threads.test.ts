import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { desktopThreadIds } from '../src/server/codex/threads.ts';

test('desktop discovery reads bounded recent nonarchived top-level IDs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'codex-threads-'));
  const path = join(dir, 'state.sqlite');
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE threads (id TEXT, archived INTEGER, attached_thread_parent_id TEXT, updated_at INTEGER)');
  const insert = db.prepare('INSERT INTO threads VALUES (?, ?, ?, ?)');
  insert.run('archived', 1, null, 1000); insert.run('child', 0, 'parent', 1000);
  for (let i = 0; i < 105; i++) insert.run(`thread-${i}`, 0, null, i);
  db.close();
  try {
    const ids = desktopThreadIds(path);
    assert.equal(ids.length, 100); assert.equal(ids[0], 'thread-104');
    assert.ok(!ids.includes('archived') && !ids.includes('child'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
