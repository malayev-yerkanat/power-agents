import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { backupProject, restoreProject } from '../scripts/backup.ts';

function fixture(): { root: string; db: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'power-agents-backup-'));
  const data = join(root, '.power-agents');
  mkdirSync(join(data, 'workspaces', 'run-1'), { recursive: true });
  const db = join(data, 'state.sqlite');
  const sqlite = new DatabaseSync(db);
  sqlite.exec("PRAGMA journal_mode = WAL; CREATE TABLE items (value TEXT); INSERT INTO items VALUES ('saved');");
  sqlite.close();
  writeFileSync(join(data, 'workspaces', 'run-1', 'output.txt'), 'workspace result');
  mkdirSync(join(data, 'logs'));
  writeFileSync(join(data, 'logs', 'server.log'), 'private log');
  writeFileSync(join(root, '.env'), 'TOKEN=private');
  return { root, db, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('backup and restore copy SQLite and workspaces, excluding logs and .env', async () => {
  const f = fixture();
  try {
    const archive = join(f.root, 'archive');
    await backupProject(f.root, archive);
    assert.deepEqual(readdirSync(archive).sort(), ['manifest.json', 'state.sqlite', 'workspaces']);
    const restored = join(f.root, 'restored');
    mkdirSync(restored);
    await restoreProject(restored, archive, { checkPort: false });
    const db = new DatabaseSync(join(restored, '.power-agents', 'state.sqlite'), { readOnly: true });
    assert.equal(db.prepare('SELECT value FROM items').get()?.value, 'saved');
    db.close();
    assert.equal(readFileSync(join(restored, '.power-agents', 'workspaces', 'run-1', 'output.txt'), 'utf8'), 'workspace result');
  } finally { f.cleanup(); }
});

test('backup refuses a running SQLite owner and leaves no final archive', async () => {
  const f = fixture();
  try {
    const owner = new DatabaseSync(f.db);
    owner.exec('PRAGMA locking_mode = EXCLUSIVE; SELECT * FROM items');
    try {
      const archive = join(f.root, 'archive');
      await assert.rejects(backupProject(f.root, archive), /Stop the server|database is locked/i);
      assert.equal(readdirSync(f.root).includes('archive'), false);
    } finally { owner.close(); }
  } finally { f.cleanup(); }
});

test('restore rejects a changed archive and existing state', async () => {
  const f = fixture();
  try {
    const archive = join(f.root, 'archive');
    await backupProject(f.root, archive);
    await assert.rejects(restoreProject(f.root, archive, { checkPort: false }), /already exists/i);
    const restored = join(f.root, 'restored');
    mkdirSync(restored);
    writeFileSync(join(archive, 'workspaces', 'run-1', 'output.txt'), 'tampered');
    await assert.rejects(restoreProject(restored, archive, { checkPort: false }), /checksum/i);
    assert.equal(readdirSync(restored).includes('.power-agents'), false);
  } finally { f.cleanup(); }
});

test('backup rejects symlinks and destinations inside the data directory', async () => {
  const f = fixture();
  try {
    await assert.rejects(backupProject(f.root, join(f.root, '.power-agents', 'archive')), /inside|overlap/i);
    symlinkSync(join(f.root, '.env'), join(f.root, '.power-agents', 'workspaces', 'run-1', 'secret'));
    await assert.rejects(backupProject(f.root, join(f.root, 'archive')), /symlink/i);
  } finally { f.cleanup(); }
});
