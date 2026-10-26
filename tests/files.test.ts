import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FILE_LIMITS, listFiles, resolveFile, taskFolder } from '../src/server/files.ts';

test('lists task files in order, skipping hidden entries, links and oversize files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'power-files-'));
  try {
    mkdirSync(join(dir, 'docs'));
    mkdirSync(join(dir, '.cache'));
    writeFileSync(join(dir, 'b.md'), 'bb');
    writeFileSync(join(dir, 'docs', 'a.md'), 'a');
    writeFileSync(join(dir, '.cache', 'x'), 'x');
    writeFileSync(join(dir, 'big.bin'), Buffer.alloc(FILE_LIMITS.fileBytes + 1));
    symlinkSync('/etc/hosts', join(dir, 'link'));
    assert.deepEqual(listFiles(dir), { files: [{ path: 'b.md', bytes: 2 }, { path: 'docs/a.md', bytes: 1 }], omitted: 1 });
    assert.deepEqual(listFiles(join(dir, 'missing')), { files: [], omitted: 0 });
    assert.equal(taskFolder('/w/run', 't1'), '/w/run/tasks/t1');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('resolves only regular files inside the folder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'power-files-'));
  try {
    writeFileSync(join(dir, 'a.md'), 'a');
    symlinkSync('/etc/hosts', join(dir, 'link'));
    assert.equal(resolveFile(dir, 'a.md'), join(dir, 'a.md'));
    for (const path of ['../a.md', '/etc/hosts', 'link', 'missing.md', '.']) assert.equal(resolveFile(dir, path), undefined, path);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
