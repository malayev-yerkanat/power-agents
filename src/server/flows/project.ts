import { mkdir, readFile, readdir, realpath, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { Flow, FlowNode } from '../../shared/flow-types.ts';
import { pipelineFile } from './pipeline.ts';

/** Where the reel of one flow is kept inside its content project. */
export interface ProjectFolder { project: string; folder: string; path: string }
const marker = '.power-agents-flow';
// Template order; stage folders sort the same way the reel is made.
const stageOrder = ['project', 'brand', 'idea', 'script', 'voice', 'scenes', 'capture', 'edit', 'preview', 'qa', 'final'];

/** CONTENT_PROJECTS_DIR, or the projects folder that holds REEL_PIPELINE_DIR (<projects>/<project>/pipeline/stages). */
export function projectsRoot(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicit = env.CONTENT_PROJECTS_DIR?.trim();
  if (explicit) return resolve(explicit);
  const stages = env.REEL_PIPELINE_DIR?.trim();
  return stages ? resolve(stages, '..', '..', '..') : undefined;
}

export async function listProjects(root = projectsRoot()): Promise<string[]> {
  if (!root) return [];
  try {
    return (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => entry.name).sort((a, b) => a.localeCompare(b));
  } catch { return []; }
}

export function slug(title: string): string {
  return title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'flow';
}

/** Resolves a project by folder name; refuses paths and symlinks that leave the projects folder. */
export async function projectDir(name: string, root = projectsRoot()): Promise<string> {
  if (!root) throw new Error('Set CONTENT_PROJECTS_DIR (or REEL_PIPELINE_DIR) in AI Orchestration/.env and restart the server');
  if (!name) throw new Error('Choose a project folder');
  if (!/^[^./\\][^/\\]*$/.test(name)) throw new Error(`Invalid project folder: ${name}`);
  let dir: string;
  try { dir = await realpath(join(root, name)); } catch { throw new Error(`Project folder not found: ${name}`); }
  if (!dir.startsWith((await realpath(root)) + sep)) throw new Error(`Project folder is outside the projects folder: ${name}`);
  return dir;
}

/** Creates <project>/reels/<flow name>/; a folder made by another flow or by hand is never reused. */
export async function prepareReelFolder(flow: Flow, name: string, root = projectsRoot()): Promise<ProjectFolder> {
  const dir = await projectDir(name, root);
  for (const candidate of [slug(flow.title), `${slug(flow.title)}-${flow.id.slice(0, 8)}`]) {
    const folder = join(dir, 'reels', candidate);
    const owner = await readFile(join(folder, marker), 'utf8').then(text => text.trim(), () => undefined);
    const empty = await readdir(folder).then(entries => entries.length === 0, () => true);
    if (owner === flow.id || (owner === undefined && empty)) {
      await mkdir(folder, { recursive: true });
      await writeFile(join(folder, marker), `${flow.id}\n`);
      return { project: name, folder, path: `reels/${candidate}` };
    }
  }
  throw new Error(`Reel folder for “${flow.title}” is already used; rename the flow`);
}

export function stageName(node: FlowNode): string {
  const index = stageOrder.indexOf(node.type);
  const base = `${String(index < 0 ? 99 : index).padStart(2, '0')}-${node.type}`;
  return node.id === node.type ? base : `${base}-${node.id.slice(0, 8)}`;
}

/** The reel folder of an approved Project node, when the flow has one. */
export function reelFolder(flow: Flow): string | undefined {
  const value = flow.nodes.find(n => n.type === 'project' && n.status === 'approved')?.output?.project?.value as Partial<ProjectFolder> | undefined;
  return typeof value?.folder === 'string' ? value.folder : undefined;
}

/** Copies a node's approved output into its stage folder: files as they are, inline values as <port>.json. */
export async function exportNode(flow: Flow, node: FlowNode, flowsRoot: string, folder: string): Promise<void> {
  if (node.type === 'project' || !node.output) return;
  const target = join(folder, stageName(node));
  const source = join(flowsRoot, flow.id, node.id, `v${node.outputVersion ?? node.version}`);
  await mkdir(target, { recursive: true });
  for (const [port, output] of Object.entries(node.output)) {
    for (const file of output.files ?? []) {
      const full = pipelineFile(source, file);
      if (!full) throw new Error(`Output file is missing or invalid: ${node.id}/${file}`);
      await mkdir(dirname(join(target, file)), { recursive: true });
      await copyFile(full, join(target, file));
    }
    if (output.value === undefined) continue;
    const value = output.value as { guide?: unknown; settings?: unknown };
    if (node.type === 'brand' && typeof value.guide === 'string') {
      // Same layout as the content project's brand folder.
      await writeFile(join(target, 'brand-guide.md'), value.guide);
      await writeFile(join(target, 'brand.json'), `${JSON.stringify(value.settings ?? {}, null, 2)}\n`);
    } else if (!(output.files ?? []).includes(`${port}.json`)) {
      await writeFile(join(target, `${port}.json`), `${JSON.stringify(output.value, null, 2)}\n`);
    }
  }
}
