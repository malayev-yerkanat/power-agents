import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { LAUNCH_TTL_MS, createLaunchToken, createLaunchVerifier, csrfValue, loadAccessKey, sessionValue } from '../src/server/access.ts';

test('the access key is created owner-only once and reused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'power-access-'));
  try {
    const path = join(dir, 'nested', 'access.key');
    const key = loadAccessKey(path);
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.match(readFileSync(path, 'utf8'), /^[0-9a-f]{64}\n$/);
    assert.deepEqual(loadAccessKey(path), key);
    assert.equal(sessionValue(key), sessionValue(loadAccessKey(path)));
    assert.notEqual(sessionValue(key), csrfValue(key));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a launch token works once, expires, and must be signed by this key', () => {
  const key = Buffer.alloc(32, 1), other = Buffer.alloc(32, 2);
  const now = 1_800_000_000_000;
  const verify = createLaunchVerifier(key);
  const token = createLaunchToken(key, now);
  assert.equal(verify(token, now + 1000), true);
  assert.equal(verify(token, now + 2000), false);
  assert.equal(verify(createLaunchToken(key, now), now + LAUNCH_TTL_MS), false);
  assert.equal(verify(createLaunchToken(other, now), now), false);
  const [expiry, nonce, signature] = createLaunchToken(key, now).split('.');
  assert.equal(verify(`${Number(expiry) + 1}.${nonce}.${signature}`, now), false);
  assert.equal(verify(createLaunchToken(key, now + LAUNCH_TTL_MS), now), false);
  for (const bad of ['', 'x', `${expiry}.${nonce}`, `${expiry}.${nonce}.${signature}.extra`]) assert.equal(verify(bad, now), false);
});
