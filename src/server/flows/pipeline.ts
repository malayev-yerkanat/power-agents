import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { z } from 'zod';
import type { PortValue } from '../../shared/flow-types.ts';
import { resolveFile } from '../files.ts';
import type { ExecutionContext, Executor } from './registry.ts';

const stages = { voice: 'voice', capture: 'capture', edit: 'edit_plan', preview: 'render', final: 'render', qa: 'qa' } as const;
const timeouts = { voice: 5, capture: 10, edit: 2, preview: 30, final: 30, qa: 5 };
const portValue = z.object({ value: z.unknown().optional(), files: z.array(z.string().min(1)).optional() }).strict();
const outputSchema = z.record(z.string(), portValue);
export class PipelineError extends Error {
  constructor(message: string, public needsHuman = false, public output?: Record<string, PortValue>) { super(message); }
}
/** resolveFile plus realpath containment also rejects symlinked parent folders. */
export function pipelineFile(dir: string, path: string): string | undefined {
  const full = resolveFile(dir, path);
  if (!full) return undefined;
  try { return realpathSync(full).startsWith(realpathSync(dir) + sep) ? full : undefined; } catch { return undefined; }
}
function checkedOutputs(dir: string, value: unknown): Record<string, PortValue> {
  const outputs = outputSchema.parse(value);
  for (const output of Object.values(outputs)) for (const file of output.files ?? []) {
    if (isAbsolute(file) || !pipelineFile(dir, file)) throw new PipelineError(`Pipeline output file is missing, outside its node folder or invalid: ${file}`);
  }
  return outputs;
}
function collect(ctx: ExecutionContext): { inputs: Record<string, unknown>; files: Record<string, string[]>; brand: unknown; upload?: string } {
  const root = dirname(dirname(ctx.dir));
  const inputs: Record<string, unknown> = {}, files: Record<string, string[]> = {};
  const add = (port: string, sourceId: string, sourcePort: string) => {
    const source = ctx.flow.nodes.find(n => n.id === sourceId)!;
    const output = source.output?.[sourcePort];
    if (!output) return;
    const paths = (output.files ?? []).map(file => {
      const full = pipelineFile(join(root, source.id, `v${source.outputVersion ?? source.version}`), file);
      if (!full) throw new PipelineError(`Upstream file is missing or invalid: ${source.id}/${file}`);
      return full;
    });
    if (paths.length) files[port] = paths;
    if (output.value !== undefined) inputs[port] = structuredClone(output.value);
    else if (paths.length) inputs[port] = paths[0];
  };
  for (const edge of ctx.flow.edges.filter(e => e.to.node === ctx.node.id)) add(edge.to.port, edge.from.node, edge.from.port);
  // Script/timings/brand also inform Capture duration, edit cards and QA's hook.
  const ancestors = new Set<string>();
  const visit = (id: string) => { for (const e of ctx.flow.edges.filter(e => e.to.node === id)) if (!ancestors.has(e.from.node)) { ancestors.add(e.from.node); visit(e.from.node); } };
  visit(ctx.node.id);
  for (const port of ['script', 'timings', 'brand']) if (!(port in inputs)) {
    const source = ctx.flow.nodes.find(n => ancestors.has(n.id) && n.output?.[port]);
    if (source) add(port, source.id, port);
  }
  // Direct executor consumers may supply values without a persisted graph.
  for (const [port, output] of Object.entries(ctx.inputs)) if (!(port in inputs) && output.value !== undefined) inputs[port] = structuredClone(output.value);
  const upload = ctx.node.upload && pipelineFile(join(root, ctx.node.id, 'uploads'), ctx.node.upload.name);
  if (ctx.node.upload && !upload) throw new PipelineError('Uploaded take is missing; upload it again');
  return { inputs, files, brand: inputs.brand ?? {}, ...(upload ? { upload } : {}) };
}
async function run(script: string, ctx: ExecutionContext, timeout: number): Promise<number | null> {
  ctx.signal.throwIfAborted();
  return new Promise((resolveRun, reject) => {
    // Detached process group lets abort/timeout terminate ffmpeg/Remotion descendants too.
    const child = spawn('python3', ['-I', script, '--in', join(ctx.dir, 'input.json'), '--out', join(ctx.dir, 'output.json'), '--dir', ctx.dir],
      { cwd: ctx.dir, stdio: ['ignore', 'ignore', 'ignore'], detached: process.platform !== 'win32' });
    let failure: Error | undefined, forceKill: ReturnType<typeof setTimeout> | undefined;
    const send = (signal: NodeJS.Signals) => {
      try { if (child.pid && process.platform !== 'win32') process.kill(-child.pid, signal); else child.kill(signal); } catch { child.kill(signal); }
    };
    const kill = (error: Error) => {
      if (failure) return;
      failure = error;
      // render.py handles TERM and removes staged public assets in finally.
      send('SIGTERM');
      forceKill = setTimeout(() => send('SIGKILL'), 2000);
    };
    const abort = () => kill(new PipelineError('Pipeline execution aborted'));
    const timer = setTimeout(() => kill(new PipelineError(`Pipeline execution timed out after ${timeout} ms`)), timeout);
    ctx.signal.addEventListener('abort', abort, { once: true });
    const cleanup = () => { clearTimeout(timer); clearTimeout(forceKill); ctx.signal.removeEventListener('abort', abort); };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', code => {
      // The stage has completed its cleanup; reap any descendant ignoring TERM.
      if (failure) send('SIGKILL');
      cleanup(); if (failure) reject(failure); else resolveRun(code);
    });
    if (ctx.signal.aborted) abort();
  });
}
export function createPipelineExecutor(type: keyof typeof stages, options: { stageDir?: string; timeoutMs?: number } = {}): Executor {
  return async ctx => {
    const stageDir = options.stageDir ?? process.env.REEL_PIPELINE_DIR;
    if (!stageDir) throw new PipelineError('Set REEL_PIPELINE_DIR to the content project pipeline/stages folder in AI Orchestration/.env and restart the server');
    const script = pipelineFile(resolve(stageDir), `${stages[type]}.py`);
    if (!script) throw new PipelineError(`Pipeline stage is missing: ${stages[type]}.py (check REEL_PIPELINE_DIR)`);
    const data = collect(ctx);
    const config = { ...ctx.node.config };
    if (type === 'qa' && config.height === undefined) {
      const video = ctx.flow.edges.find(e => e.to.node === ctx.node.id && e.to.port === 'video');
      config.height = ctx.flow.nodes.find(n => n.id === video?.from.node)?.config.height ?? 540;
    }
    await writeFile(join(ctx.dir, 'input.json'), JSON.stringify({ ...data, config, notes: ctx.notes, flowId: ctx.flow.id, nodeId: ctx.node.id, version: ctx.node.version }));
    const code = await run(script, ctx, options.timeoutMs ?? timeouts[type] * 60_000);
    let result: Record<string, unknown>;
    try { result = JSON.parse(await readFile(join(ctx.dir, 'output.json'), 'utf8')); }
    catch { throw new PipelineError(`Pipeline ${stages[type]} exited ${code} without valid output.json`); }
    let output: Record<string, PortValue> | undefined;
    if (result.outputs !== undefined) output = checkedOutputs(ctx.dir, result.outputs);
    else if (typeof result.port === 'string') output = checkedOutputs(ctx.dir, { [result.port]: { ...(result.value !== undefined ? { value: result.value } : {}), ...(result.files !== undefined ? { files: result.files } : {}) } });
    if (code !== 0) throw new PipelineError(typeof result.log === 'string' ? result.log : `Pipeline ${stages[type]} failed (exit ${code})`, code === 2, output);
    if (!output) throw new PipelineError('Pipeline omitted its outputs');
    return output;
  };
}
export const pipelineExecutors = Object.fromEntries(Object.keys(stages).map(type => [type, createPipelineExecutor(type as keyof typeof stages)]));
