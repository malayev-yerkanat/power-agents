import { createHash, randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import {
  chmodSync, closeSync, copyFileSync, existsSync, lstatSync, mkdirSync, openSync,
  readFileSync, readSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

type FileRecord = { path: string; sha256: string };
type Manifest = { format: 1; createdAt: string; files: FileRecord[] };
type RestoreOptions = { checkPort?: boolean; port?: number };

function inside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function typeOf(path: string): 'file' | 'directory' {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error(`Backup refuses symlinks: ${path}`);
  if (stat.isDirectory()) return 'directory';
  if (stat.isFile()) return 'file';
  throw new Error(`Backup refuses unsupported file type: ${path}`);
}

function copyTree(source: string, destination: string): void {
  if (typeOf(source) === 'file') {
    copyFileSync(source, destination);
    chmodSync(destination, 0o600 | (lstatSync(source).mode & 0o100));
    return;
  }
  mkdirSync(destination, { mode: 0o700 });
  for (const name of readdirSync(source).sort()) copyTree(join(source, name), join(destination, name));
}

function hash(path: string): string {
  const digest = createHash('sha256');
  const fd = openSync(path, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (let count = readSync(fd, buffer, 0, buffer.length, null); count > 0;
      count = readSync(fd, buffer, 0, buffer.length, null)) digest.update(buffer.subarray(0, count));
  } finally { closeSync(fd); }
  return digest.digest('hex');
}

function pathExists(path: string): boolean {
  try { lstatSync(path); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function files(root: string, path = root): FileRecord[] {
  if (typeOf(path) === 'file') return [{ path: relative(root, path).split(sep).join('/'), sha256: hash(path) }];
  return readdirSync(path).sort().flatMap(name => {
    if (path === root && name === 'manifest.json') return [];
    return files(root, join(path, name));
  });
}

function checkDatabase(path: string): void {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const result = db.prepare('PRAGMA quick_check').get() as { quick_check: string };
    if (result.quick_check !== 'ok') throw new Error(`SQLite integrity check failed: ${result.quick_check}`);
  } finally { db.close(); }
}

function realParent(path: string): string {
  if (!existsSync(dirname(path))) throw new Error(`Backup parent directory does not exist: ${dirname(path)}`);
  return join(realpathSync(dirname(path)), basename(path));
}

export async function backupProject(projectRoot: string, destination: string): Promise<void> {
  const data = resolve(projectRoot, '.power-agents');
  const sourceDb = join(data, 'state.sqlite');
  if (!existsSync(sourceDb) || typeOf(sourceDb) !== 'file') throw new Error(`SQLite state not found: ${sourceDb}`);
  if (typeOf(data) !== 'directory') throw new Error(`State directory is invalid: ${data}`);
  const target = realParent(resolve(destination));
  if (inside(realpathSync(data), target) || inside(target, realpathSync(data))) {
    throw new Error('Backup destination cannot overlap the .power-agents data directory.');
  }
  if (pathExists(target)) throw new Error(`Backup destination already exists: ${target}`);

  const staging = join(dirname(target), `.${basename(target)}.tmp-${randomUUID()}`);
  const db = new DatabaseSync(sourceDb);
  try {
    db.exec('PRAGMA busy_timeout = 0; PRAGMA locking_mode = EXCLUSIVE');
    try {
      const check = db.prepare('PRAGMA quick_check').get() as { quick_check: string };
      if (check.quick_check !== 'ok') throw new Error(`SQLite integrity check failed: ${check.quick_check}`);
    }
    catch (error) {
      if (String(error).includes('database is locked')) {
        throw new Error('SQLite database is locked. Stop the server (npm run service:stop) and retry the backup.');
      }
      throw error;
    }
    mkdirSync(staging, { mode: 0o700 });
    await sqliteBackup(db, join(staging, 'state.sqlite'));
    const copiedDb = new DatabaseSync(join(staging, 'state.sqlite'));
    try { copiedDb.exec('PRAGMA journal_mode = DELETE'); }
    finally { copiedDb.close(); }
    const workspaceRoot = join(data, 'workspaces');
    if (existsSync(workspaceRoot)) copyTree(workspaceRoot, join(staging, 'workspaces'));
    else mkdirSync(join(staging, 'workspaces'), { mode: 0o700 });
    checkDatabase(join(staging, 'state.sqlite'));
    chmodSync(join(staging, 'state.sqlite'), 0o600);
    const manifest: Manifest = { format: 1, createdAt: new Date().toISOString(), files: files(staging) };
    writeFileSync(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    renameSync(staging, target);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  } finally { db.close(); }
}

function verifyArchive(source: string): void {
  if (typeOf(source) !== 'directory') throw new Error(`Archive is not a directory: ${source}`);
  const allowed = new Set(['manifest.json', 'state.sqlite', 'workspaces']);
  for (const name of readdirSync(source)) if (!allowed.has(name)) throw new Error(`Unexpected archive entry: ${name}`);
  const manifestPath = join(source, 'manifest.json');
  if (!existsSync(manifestPath) || typeOf(manifestPath) !== 'file') throw new Error('Backup manifest is missing.');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
  if (manifest.format !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported backup manifest.');
  const actual = files(source);
  if (JSON.stringify(actual) !== JSON.stringify(manifest.files)) throw new Error('Backup checksum mismatch or missing files.');
  if (!actual.some(file => file.path === 'state.sqlite')) throw new Error('Backup is missing state.sqlite.');
  checkDatabase(join(source, 'state.sqlite'));
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise(resolveResult => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(500);
    socket.once('connect', () => { socket.destroy(); resolveResult(true); });
    socket.once('error', error => {
      socket.destroy();
      resolveResult((error as NodeJS.ErrnoException).code !== 'ECONNREFUSED');
    });
    socket.once('timeout', () => { socket.destroy(); resolveResult(true); });
  });
}

export async function restoreProject(projectRoot: string, source: string, options: RestoreOptions = {}): Promise<void> {
  const root = resolve(projectRoot);
  const data = join(root, '.power-agents');
  if (pathExists(data)) throw new Error(`State directory already exists: ${data}. Stop the server and move it aside before restoring.`);
  const port = options.port ?? Number(process.env.PORT ?? 4317);
  if (options.checkPort !== false) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
    if (await isPortOpen(port)) throw new Error(`Port ${port} is in use. Stop the server before restoring.`);
  }
  const archive = realpathSync(source);
  verifyArchive(archive);
  const staging = join(root, `.power-agents.restore-${randomUUID()}`);
  try {
    mkdirSync(staging, { mode: 0o700 });
    copyFileSync(join(archive, 'state.sqlite'), join(staging, 'state.sqlite'));
    chmodSync(join(staging, 'state.sqlite'), 0o600);
    copyTree(join(archive, 'workspaces'), join(staging, 'workspaces'));
    checkDatabase(join(staging, 'state.sqlite'));
    if (pathExists(data)) throw new Error(`State directory appeared during restore: ${data}`);
    renameSync(staging, data);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

async function main(): Promise<void> {
  const [command, flag, path, ...extra] = process.argv.slice(2);
  if (extra.length || !path || (command === 'backup' && flag !== '--to')
    || (command === 'restore' && flag !== '--from') || !['backup', 'restore'].includes(command)) {
    throw new Error('Usage: npm run data:backup -- --to /absolute/backup-directory\n   or: npm run data:restore -- --from /absolute/backup-directory');
  }
  if (!isAbsolute(path)) throw new Error('Use an absolute backup directory path.');
  if (command === 'backup') await backupProject(process.cwd(), path);
  else await restoreProject(process.cwd(), path);
  console.log(`${command === 'backup' ? 'Backup saved to' : 'State restored from'} ${path}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
