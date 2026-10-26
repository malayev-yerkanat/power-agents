import { lstatSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { ArtifactFile } from '../shared/types.ts';

export const FILE_LIMITS = { count: 200, fileBytes: 1024 * 1024, totalBytes: 10 * 1024 * 1024 };
export const taskFolder = (runDir: string, taskId: string) => join(runDir, 'tasks', taskId);

/** Lists the regular files a task left in its folder, within limits; links, hidden entries and oversize files are skipped. */
export function listFiles(dir: string): { files: ArtifactFile[]; omitted: number } {
  const files: ArtifactFile[] = [];
  let omitted = 0;
  let total = 0;
  const walk = (current: string) => {
    let entries;
    try { entries = readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile()) continue;
      const bytes = lstatSync(full).size;
      if (files.length >= FILE_LIMITS.count || bytes > FILE_LIMITS.fileBytes || total + bytes > FILE_LIMITS.totalBytes) { omitted += 1; continue; }
      total += bytes;
      files.push({ path: relative(dir, full).split(sep).join('/'), bytes });
    }
  };
  walk(dir);
  return { files, omitted };
}

/** Resolves a listed file inside its folder; anything escaping the folder or not a regular file is refused. */
export function resolveFile(dir: string, path: string): string | undefined {
  const root = resolve(dir);
  const full = resolve(root, path);
  if (!full.startsWith(root + sep)) return undefined;
  try { return lstatSync(full).isFile() ? full : undefined; } catch { return undefined; }
}
