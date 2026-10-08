import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLaunchAgentPlist, readLaunchAgentWorkingDirectory, resourcesBusy } from '../scripts/launchd.ts';

test('launch agent runs the production server from this checkout and preserves CLI discovery', () => {
  const plist = createLaunchAgentPlist({
    root: '/Users/example/AI & Agents',
    home: '/Users/example',
    node: '/usr/local/bin/node',
  });

  assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/);
  assert.match(plist, /<key>KeepAlive<\/key>\s*<true\/>/);
  assert.match(plist, /<key>WorkingDirectory<\/key>\s*<string>\/Users\/example\/AI &amp; Agents<\/string>/);
  assert.match(plist, /<string>\/usr\/local\/bin\/node<\/string>/);
  assert.match(plist, /<string>--env-file-if-exists=.env<\/string>/);
  assert.match(plist, /<string>src\/server\/index.ts<\/string>/);
  assert.match(plist, /<key>NODE_ENV<\/key>\s*<string>production<\/string>/);
  assert.match(plist, /\/Users\/example\/\.local\/bin/);
  assert.match(plist, /\/opt\/homebrew\/bin/);
  assert.match(plist, /codex-cli\/CodexCLI\.app\/Contents\/MacOS/);
  assert.match(plist, /<key>StandardErrorPath<\/key>/);
});

test('ownership compares the exact plist working directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'power-agents-plist-'));
  const path = join(dir, 'agent.plist');
  try {
    writeFileSync(path, createLaunchAgentPlist({ root: '/Users/example/project backup', home: '/Users/example', node: '/usr/local/bin/node' }));
    assert.equal(readLaunchAgentWorkingDirectory(path), '/Users/example/project backup');
    assert.notEqual(readLaunchAgentWorkingDirectory(path), '/Users/example/project');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('installer preflight detects an occupied local port', async () => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP port');
    assert.equal(resourcesBusy(tmpdir(), address.port), true);
  } finally {
    server.close();
  }
});
