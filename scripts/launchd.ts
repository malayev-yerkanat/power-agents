import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const label = 'com.poweragents.local';
if (!process.getuid) throw new Error('macOS launchd requires a POSIX user account.');
const uid = process.getuid();
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = homedir();
const plistPath = join(home, 'Library', 'LaunchAgents', `${label}.plist`);
const service = `gui/${uid}/${label}`;

function xml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export function createLaunchAgentPlist({ root, home, node }: { root: string; home: string; node: string }): string {
  const path = [
    join(home, '.local', 'bin'),
    '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS',
    '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
  ].join(':');
  const logRoot = join(root, '.power-agents', 'logs');
  const string = (value: string) => `<string>${xml(value)}</string>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>${string(label)}
  <key>ProgramArguments</key>
  <array>
    ${[node, '--env-file-if-exists=.env', '--import', 'tsx', 'src/server/index.ts'].map(string).join('\n    ')}
  </array>
  <key>WorkingDirectory</key>${string(root)}
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>${string('production')}
    <key>HOME</key>${string(home)}
    <key>PATH</key>${string(path)}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key>${string(join(logRoot, 'server.log'))}
  <key>StandardErrorPath</key>${string(join(logRoot, 'server-error.log'))}
</dict>
</plist>
`;
}

function isLoaded(): boolean {
  return spawnSync('launchctl', ['print', service], { stdio: 'ignore' }).status === 0;
}

function launchctl(...args: string[]): void {
  execFileSync('launchctl', args, { stdio: 'inherit' });
}

export function readLaunchAgentWorkingDirectory(path: string): string {
  return execFileSync('plutil', ['-extract', 'WorkingDirectory', 'raw', '-o', '-', path], { encoding: 'utf8' })
    .replace(/\r?\n$/, '');
}

function inUse(args: string[]): boolean {
  const result = spawnSync('lsof', args, { stdio: 'ignore' });
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) throw new Error('Could not check whether the server has stopped.');
  return result.status === 0;
}

export function resourcesBusy(root: string, port: number): boolean {
  if (inUse(['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'])) return true;
  const database = join(root, '.power-agents', 'state.sqlite');
  return existsSync(database) && inUse(['-nP', database]);
}

function configuredPort(): number {
  const envPath = join(root, '.env');
  const values = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
  const port = Number(values.PORT ?? 4317);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer between 1024 and 65535.');
  return port;
}

async function waitUntilFree(port: number): Promise<void> {
  for (let attempt = 0; attempt < 25; attempt++) {
    if (!resourcesBusy(root, port)) return;
    await delay(200);
  }
  throw new Error(`Port ${port} or the SQLite database is still in use. Stop the manually started server before starting launchd.`);
}

function checkOwnership(): void {
  if (!existsSync(plistPath) && isLoaded()) {
    throw new Error(`${label} is loaded without the expected plist; refusing to modify another service.`);
  }
  if (existsSync(plistPath) && readLaunchAgentWorkingDirectory(plistPath) !== root) {
    throw new Error(`${plistPath} points to a different checkout; remove it manually before installing here.`);
  }
}

function requireInstalled(): void {
  if (!existsSync(plistPath)) throw new Error('Install the service first: npm run service:install');
  checkOwnership();
}

async function main(command?: string): Promise<void> {
  if (command === 'install') {
    if (!existsSync(join(root, 'dist', 'index.html'))) throw new Error('Build the app first: npm run build');
    if (!existsSync(join(root, 'node_modules', 'tsx'))) throw new Error('Install dependencies first: npm install');
    checkOwnership();
    const port = configuredPort();
    mkdirSync(dirname(plistPath), { recursive: true, mode: 0o700 });
    mkdirSync(join(root, '.power-agents', 'logs'), { recursive: true, mode: 0o700 });
    if (isLoaded()) launchctl('bootout', service);
    await waitUntilFree(port);
    writeFileSync(plistPath, createLaunchAgentPlist({ root, home, node: process.execPath }), { mode: 0o600 });
    launchctl('bootstrap', `gui/${uid}`, plistPath);
    console.log(`Installed ${label}. Open http://127.0.0.1:${port}/`);
  } else if (command === 'restart') {
    requireInstalled();
    const port = configuredPort();
    if (isLoaded()) launchctl('bootout', service);
    await waitUntilFree(port);
    launchctl('bootstrap', `gui/${uid}`, plistPath);
  } else if (command === 'start') {
    requireInstalled();
    if (!isLoaded()) {
      await waitUntilFree(configuredPort());
      launchctl('bootstrap', `gui/${uid}`, plistPath);
    }
  } else if (command === 'stop') {
    requireInstalled();
    if (isLoaded()) launchctl('bootout', service);
  } else if (command === 'status') {
    launchctl('print', service);
  } else if (command === 'uninstall') {
    checkOwnership();
    if (isLoaded()) launchctl('bootout', service);
    if (existsSync(plistPath)) unlinkSync(plistPath);
    console.log(`Removed ${label}.`);
  } else {
    throw new Error('Usage: node --import tsx scripts/launchd.ts install|start|stop|restart|status|uninstall');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await main(process.argv[2]); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
