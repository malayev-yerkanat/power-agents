import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { receiveUpload } from './media.ts';
import { PipelineError } from './pipeline.ts';
import { join } from 'node:path';
import { z } from 'zod';
import type { CreateFlowInput, Flow, FlowNode, FlowPatch, PortValue } from '../../shared/flow-types.ts';
import type { Connection, TurnRunner } from '../../shared/types.ts';
import { createLiveExecutors } from './executors.ts';
import { Store } from '../store.ts';
import { registry, demoExecutor, robloxReel, type Executor } from './registry.ts';
export class FlowError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
const refuse = (message: string): never => { throw new FlowError(409, message); };
const invalid = (message: string): never => { throw new FlowError(400, message); };
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/, 'Invalid node or edge ID');
const nodeSchema = z.object({ id: idSchema, type: z.string().max(100), title: z.string().trim().min(1).max(200),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict(), config: z.record(z.string(), z.unknown()), gate: z.boolean() });
const endpoint = z.object({ node: idSchema, port: idSchema }).strict();
const patchSchema = z.object({ version: z.number().int().nonnegative().safe(), title: z.string().trim().min(1).max(200).optional(), autoRun: z.boolean().optional(),
  nodes: z.array(nodeSchema).max(200).optional(), edges: z.array(z.object({ id: idSchema, from: endpoint, to: endpoint }).strict()).max(2000).optional() }).strict();
const createSchema = z.object({ title: z.string().trim().min(1).max(200).default('Untitled flow'), template: z.literal('roblox-reel').optional(), mode: z.enum(['live', 'demo']).default('demo') }).strict();
const busy = (node: FlowNode) => node.status === 'queued' || node.status === 'running';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function hash(flow: Flow, node: FlowNode): string {
  const sources = flow.edges.filter(e => e.to.node === node.id).map(e => ({ port: e.to.port, source: e.from.node, output: e.from.port,
    version: flow.nodes.find(n => n.id === e.from.node)!.version })).sort((a, b) => a.port.localeCompare(b.port));
  return createHash('sha256').update(canonical({ config: node.config, upload: node.upload, sources })).digest('hex');
}
function descendants(flow: Flow, roots: string[]): Set<string> {
  const found = new Set(roots);
  for (const id of found) for (const e of flow.edges) if (e.from.node === id) found.add(e.to.node);
  return found;
}
function stale(flow: Flow, roots: string[], includeRoots = false): Flow {
  const affected = descendants(flow, roots);
  if (!includeRoots) for (const id of roots) affected.delete(id);
  return { ...flow, nodes: flow.nodes.map(n => !affected.has(n.id) ? n : { ...n,
    status: n.output ? 'stale' : busy(n) ? 'idle' : n.status, error: undefined, needsHuman: undefined }) };
}
function validate(nodes: FlowNode[], edges: Flow['edges']): void {
  if (new Set(nodes.map(n => n.id)).size !== nodes.length) invalid('Duplicate node ID');
  if (new Set(edges.map(e => e.id)).size !== edges.length) invalid('Duplicate edge ID');
  const connected = new Set<string>();
  for (const e of edges) {
    const from = nodes.find(n => n.id === e.from.node), to = nodes.find(n => n.id === e.to.node);
    const output = from && registry[from.type].outputs.find(p => p.name === e.from.port);
    const input = to && registry[to.type].inputs.find(p => p.name === e.to.port);
    if (!input || !output) invalid('Edge references an unknown node or port');
    if (input!.type !== 'text' && input!.type !== output!.type) invalid('Port types do not match');
    const key = `${e.to.node}:${e.to.port}`;
    if (connected.has(key)) invalid('Duplicate connection on input port');
    connected.add(key);
  }
  const done = new Set<string>(), visiting = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) invalid('Graph contains a cycle');
    if (done.has(id)) return;
    visiting.add(id);
    for (const e of edges) if (e.from.node === id) visit(e.to.node);
    visiting.delete(id); done.add(id);
  };
  nodes.forEach(n => visit(n.id));
}
function ready(flow: Flow, node: FlowNode): boolean {
  return registry[node.type].inputs.every(port => {
    const e = flow.edges.find(e => e.to.node === node.id && e.to.port === port.name);
    return e ? flow.nodes.some(n => n.id === e.from.node && n.status === 'approved') : !!port.optional;
  });
}
interface Options { store: Store; root: string; executors?: Record<string, Executor>; maxConcurrent?: number; connections?: Connection[]; runner?: TurnRunner }
interface Active { flowId: string; nodeId: string; version: number; lane?: string; controller: AbortController }
export class FlowEngine {
  private readonly active = new Map<number, Active>();
  private readonly queuedFlows = new Set<string>();
  private stopped = false;
  private scheduled = false;
  private readonly limit: number;
  private readonly liveExecutors: Record<string, Executor>;
  constructor(private readonly options: Options) {
    this.limit = options.maxConcurrent ?? 3;
    this.liveExecutors = createLiveExecutors({ connections: options.connections ?? [], runner: options.runner, madeTopics: id => this.madeTopics(id) });
    if (!Number.isSafeInteger(this.limit) || this.limit < 1) invalid('maxConcurrent must be a positive integer');
    for (const flow of options.store.unfinishedFlows()) {
      if (flow.nodes.some(busy)) this.change(flow.id, f => ({ ...f, nodes: f.nodes.map(n => busy(n) ? { ...n, status: 'failed', error: 'interrupted, run again' } : n) }), 'interrupted, run again');
      options.store.interruptNodeRuns(flow.id, 'interrupted, run again');
    }
  }
  connections(): Connection[] { return (this.options.connections ?? []).map(({ executable: _executable, ...connection }) => connection); }
  /** Chosen topics of approved Idea nodes in every other flow. */
  private madeTopics(exceptId: string): string[] {
    return this.options.store.listFlows().filter(summary => summary.id !== exceptId).flatMap(summary =>
      (this.options.store.getFlow(summary.id)?.nodes ?? []).filter(n => n.type === 'idea' && n.status === 'approved').flatMap(n => {
        const value = n.output?.idea?.value as { candidates?: { topic?: unknown }[]; chosen?: number } | undefined;
        const topic = value?.candidates?.[value.chosen ?? -1]?.topic;
        return typeof topic === 'string' ? [topic] : [];
      }));
  }
  get(id: string): Flow { const flow = this.options.store.getFlow(id); if (!flow) throw new FlowError(404, 'Flow not found'); return flow; }
  private node(flow: Flow, id: string): FlowNode { const node = flow.nodes.find(n => n.id === id); if (!node) throw new FlowError(404, 'Node not found'); return node; }
  private ensureOpen(): void { if (this.stopped) refuse('Flow engine is stopped'); }
  private change(id: string, fn: (flow: Flow) => Flow, message: string, nodeId?: string): Flow {
    return this.options.store.updateFlow(id, fn, { type: nodeId ? 'flow.node' : 'flow.updated', message, nodeId });
  }
  create(value: CreateFlowInput): Flow {
    this.ensureOpen();
    const input = createSchema.parse(value), now = new Date().toISOString();
    const graph = input.template ? robloxReel() : { nodes: [], edges: [] };
    return this.options.store.createFlow({ ...input, ...graph, id: randomUUID(), autoRun: false, version: 1, createdAt: now, updatedAt: now });
  }
  update(id: string, value: FlowPatch): Flow {
    this.ensureOpen();
    const patch = patchSchema.parse(value);
    this.get(id);
    const next = this.change(id, flow => {
      if (flow.version !== patch.version) refuse('Flow version changed; reload and try again');
      const nodes = patch.nodes?.map(input => {
        const definition = Object.hasOwn(registry, input.type) ? registry[input.type] : undefined;
        if (!definition) invalid(`Unknown node type: ${input.type}`);
        const config = definition!.config.parse(input.config), old = flow.nodes.find(n => n.id === input.id);
        if (old && busy(old) && (canonical(config) !== canonical(old.config) || old.type !== input.type || old.gate !== input.gate)) refuse('Cannot edit a queued/running node');
        const runtime = old?.type === input.type ? old : { status: 'idle' as const, version: old?.version ?? 0, notes: [] };
        return { ...runtime, ...input, config };
      }) ?? flow.nodes;
      for (const old of flow.nodes) if (busy(old) && !nodes.some(n => n.id === old.id)) refuse('Cannot remove a queued/running node');
      const edges = patch.edges ?? flow.edges;
      validate(nodes, edges);
      const changed = nodes.filter(n => {
        const old = flow.nodes.find(o => o.id === n.id);
        const incoming = (es: Flow['edges']) => es.filter(e => e.to.node === n.id).map(e => ({ from: e.from, to: e.to })).sort((a, b) => a.to.port.localeCompare(b.to.port));
        const rewired = canonical(incoming(edges)) !== canonical(incoming(flow.edges));
        if (rewired && old && busy(old)) refuse('Cannot rewire a queued/running node');
        return old && (old.type !== n.type || canonical(old.config) !== canonical(n.config) || rewired);
      }).map(n => n.id);
      return stale({ ...flow, title: patch.title ?? flow.title, autoRun: patch.autoRun ?? flow.autoRun, nodes, edges }, changed, true);
    }, 'Flow updated');
    this.abortInvalidated(id);
    if (patch.autoRun === true) this.autoQueue(id);
    return this.get(next.id);
  }
  run(id: string, nodeId: string): Flow {
    this.ensureOpen();
    const flow = this.get(id), node = this.node(flow, nodeId);
    if (busy(node) || node.status === 'awaiting_approval') refuse(`Node is ${node.status}; cannot run until approval is resolved`);
    if (!ready(flow, node)) refuse('Node is not ready: all required sources must be approved');
    const next = this.change(id, f => ({ ...f, nodes: f.nodes.map(n => n.id === nodeId ? { ...n, status: 'queued', needsHuman: undefined, error: undefined } : n) }), 'Queued', nodeId);
    this.queuedFlows.add(id); this.schedule(); return next;
  }
  approve(id: string, nodeId: string): Flow {
    this.ensureOpen();
    const flow = this.get(id), node = this.node(flow, nodeId);
    if (node.status !== 'awaiting_approval') refuse('Node is not awaiting approval');
    const next = this.change(id, f => stale({ ...f, nodes: f.nodes.map(n => n.id === nodeId ? { ...n, status: 'approved' } : n) }, [nodeId]), 'Approved', nodeId);
    this.abortInvalidated(id); this.autoQueue(id); return next;
  }
  reject(id: string, nodeId: string, value: string): Flow {
    this.ensureOpen();
    const note = z.string().trim().min(1).max(12_000).parse(value);
    const flow = this.get(id), node = this.node(flow, nodeId);
    if (node.status !== 'awaiting_approval') refuse('Node is not awaiting approval');
    if (!ready(flow, node)) refuse('Node is not ready');
    const next = this.change(id, f => stale({ ...f, nodes: f.nodes.map(n => n.id === nodeId ? { ...n, status: 'queued', notes: [...n.notes, note], error: undefined } : n) }, [nodeId]), 'Rejected; queued with note', nodeId);
    this.abortInvalidated(id); this.queuedFlows.add(id); this.schedule(); return next;
  }
  fileRoot(): string { return this.options.root; }
  async upload(id: string, nodeId: string, req: IncomingMessage): Promise<Flow> {
    this.ensureOpen();
    const node = this.node(this.get(id), nodeId);
    if (node.type !== 'capture') throw new FlowError(400, 'Only Capture accepts an uploaded take');
    if (busy(node)) refuse('Cannot upload to a queued/running Capture node');
    const dir = join(this.options.root, id, nodeId, 'uploads');
    const upload = await receiveUpload(req, dir);
    try {
      this.ensureOpen();
      const next = this.change(id, flow => {
        if (busy(this.node(flow, nodeId))) refuse('Cannot upload to a queued/running Capture node');
        const affected = descendants(flow, [nodeId]);
        return { ...flow, nodes: flow.nodes.map(n => affected.has(n.id) ? { ...n, status: 'stale', error: undefined, needsHuman: undefined,
          ...(n.id === nodeId ? { upload } : {}) } : n) };
      }, 'Take uploaded; dependent output is stale', nodeId);
      this.abortInvalidated(id); this.autoQueue(id); return next;
    } catch (error) { await unlink(join(dir, upload.name)).catch(() => {}); throw error; }
  }
  private abortInvalidated(id: string): void {
    const flow = this.get(id);
    for (const active of this.active.values()) if (active.flowId === id) {
      const node = flow.nodes.find(n => n.id === active.nodeId);
      if (node?.status !== 'running' || node.version !== active.version) active.controller.abort();
    }
  }
  private autoQueue(id: string): void {
    if (this.stopped) return;
    const flow = this.get(id);
    if (!flow.autoRun) return;
    const readyIds = flow.nodes.filter(n => ['idle', 'stale'].includes(n.status) && ready(flow, n)).map(n => n.id);
    if (!readyIds.length) return;
    this.change(id, f => ({ ...f, nodes: f.nodes.map(n => readyIds.includes(n.id) ? { ...n, status: 'queued', needsHuman: undefined, error: undefined } : n) }), 'Auto-run queued ready nodes');
    this.queuedFlows.add(id); this.schedule();
  }
  private schedule(): void {
    if (this.stopped || this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => { this.scheduled = false; if (!this.stopped) this.pump(); });
  }
  private pump(): void {
    const candidates = [...this.queuedFlows].flatMap(id => {
      const flow = this.get(id);
      if (!flow.nodes.some(n => n.status === 'queued')) this.queuedFlows.delete(id);
      return flow.nodes.filter(n => n.status === 'queued' && ready(flow, n)).map(node => ({ flow, node }));
    }).sort((a, b) => Number(!!registry[a.node.type].lane) - Number(!!registry[b.node.type].lane));
    for (const { flow, node } of candidates) {
      if (this.active.size >= this.limit) break;
      const lane = registry[node.type].lane;
      if ([...this.active.values()].some(a => (lane && a.lane === lane) || (a.flowId === flow.id && a.nodeId === node.id))) continue;
      const current = this.get(flow.id), latest = this.node(current, node.id);
      if (latest.status !== 'queued' || !ready(current, latest)) continue;
      const started = this.change(flow.id, f => stale({ ...f, nodes: f.nodes.map(n => n.id === node.id ? { ...n, status: 'running', outputVersion: n.output ? n.outputVersion ?? n.version : undefined, version: n.version + 1, inputHash: hash(f, n), error: undefined } : n) }, [node.id]), 'Running', node.id);
      const running = this.node(started, node.id), controller = new AbortController();
      const runId = this.options.store.startNodeRun(flow.id, node.id, running.version, running.inputHash!);
      this.active.set(runId, { flowId: flow.id, nodeId: node.id, version: running.version, lane, controller });
      this.abortInvalidated(flow.id);
      void this.execute(runId, started, running, controller.signal);
    }
  }
  private async execute(runId: number, flow: Flow, node: FlowNode, signal: AbortSignal): Promise<void> {
    let error: string | undefined;
    try {
      const dir = join(this.options.root, flow.id, node.id, `v${node.version}`);
      mkdirSync(dir, { recursive: true });
      const executor = this.options.executors?.[node.type] ?? (flow.mode === 'demo' ? demoExecutor : this.liveExecutors[node.type]);
      if (!executor) throw new Error(`${node.type} executor is not available`);
      const inputs: Record<string, PortValue> = Object.fromEntries(flow.edges.filter(e => e.to.node === node.id).map(e => [e.to.port, structuredClone(this.node(flow, e.from.node).output?.[e.from.port] ?? {})]));
      const result = await executor({ flow: structuredClone(flow), node: structuredClone(node), inputs, notes: [...node.notes], dir, signal });
      const output = z.record(z.string(), z.object({ value: z.unknown().optional(), files: z.array(z.string()).optional() }).strict()).parse(result);
      if (registry[node.type].outputs.some(p => !Object.hasOwn(output, p.name))) throw new Error('Executor omitted a required output port');
      if (this.stopped) return;
      const current = this.get(flow.id).nodes.find(n => n.id === node.id);
      if (current?.status !== 'running' || current.version !== node.version) { error = 'Execution superseded'; return; }
      this.change(flow.id, f => ({ ...f, nodes: f.nodes.map(n => n.id === node.id ? { ...n, output, outputVersion: node.version, needsHuman: undefined, status: n.gate ? 'awaiting_approval' : 'approved' } : n) }), node.gate ? 'Awaiting approval' : 'Approved', node.id);
      this.autoQueue(flow.id);
    } catch (cause) {
      if (this.stopped) return;
      error = cause instanceof Error ? cause.message : 'Execution failed';
      const current = this.get(flow.id).nodes.find(n => n.id === node.id);
      if (current?.status === 'running' && current.version === node.version) this.change(flow.id, f => ({ ...f, nodes: f.nodes.map(n => n.id === node.id ? { ...n, status: 'failed', error, needsHuman: cause instanceof PipelineError && cause.needsHuman, ...(cause instanceof PipelineError && cause.output ? { output: cause.output, outputVersion: node.version } : {}) } : n) }), error, node.id);
    } finally {
      this.active.delete(runId);
      if (!this.stopped) { this.options.store.finishNodeRun(runId, error); this.schedule(); }
    }
  }
  shutdown(): void {
    this.stopped = true;
    for (const active of this.active.values()) active.controller.abort();
  }
}
