import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import type { CreateFlowInput, Flow, FlowPatch, FlowRegistryNode } from '../../shared/flow-types.ts';
import type { Connection } from '../../shared/types.ts';
import type { Store } from '../store.ts';
import { registry } from './registry.ts';

export interface FlowApi {
  connections?(): Connection[];
  create(input: CreateFlowInput): Flow | Promise<Flow>;
  update(id: string, patch: FlowPatch): Flow | Promise<Flow>;
  run(id: string, nodeId: string): Flow | Promise<Flow>;
  approve(id: string, nodeId: string): Flow | Promise<Flow>;
  reject(id: string, nodeId: string, note: string): Flow | Promise<Flow>;
}
interface Helpers {
  readBody(req: IncomingMessage): Promise<unknown>;
  json(res: ServerResponse, status: number, body: unknown): void;
  HttpError: new (status: number, message: string) => Error;
}
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const title = z.string().trim().min(1).max(200);
const endpoint = z.object({ node: id, port: id }).strict();
const createSchema = z.object({ title: title.default('Untitled flow'), template: z.literal('roblox-reel').optional(),
  mode: z.enum(['demo', 'live']).default('demo') }).strict();
const patchSchema = z.object({ version: z.number().int().nonnegative().safe(), title: title.optional(), autoRun: z.boolean().optional(),
  nodes: z.array(z.object({ id, type: id, title, position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict(),
    config: z.record(z.string(), z.unknown()), gate: z.boolean() }).strict()).max(200).optional(),
  edges: z.array(z.object({ id, from: endpoint, to: endpoint }).strict()).max(2000).optional() }).strict();
const emptySchema = z.object({}).strict();
const rejectSchema = z.object({ note: z.string().trim().min(1).max(12_000) }).strict();

export async function handleFlows(req: IncomingMessage, res: ServerResponse, path: string[], store: Store,
  flows: FlowApi | undefined, { readBody, json, HttpError }: Helpers): Promise<void> {
  if (!flows) throw new HttpError(404, 'API endpoint not found');
  if (req.method === 'GET' && path.length === 2) { json(res, 200, { flows: store.listFlows() }); return; }
  if (req.method === 'GET' && path.length === 3 && path[2] === 'connections') {
    json(res, 200, { connections: flows.connections?.() ?? [] }); return;
  }
  if (req.method === 'GET' && path.length === 3 && path[2] === 'registry') {
    const types: FlowRegistryNode[] = Object.values(registry).map(({ type, title, inputs, outputs, gate, lane, config }) => ({
      type, title, inputs, outputs, gate, ...(lane ? { lane } : {}), configDefaults: config.parse({}),
    }));
    json(res, 200, { types }); return;
  }
  if (req.method === 'GET' && path.length === 3) {
    const flow = store.getFlow(path[2]);
    if (!flow) throw new HttpError(404, 'Flow not found');
    json(res, 200, { flow, nodeRuns: store.nodeRuns(flow.id) }); return;
  }
  if (req.method === 'POST' && path.length === 2) {
    json(res, 201, { flow: await flows.create(createSchema.parse(await readBody(req))) }); return;
  }
  if (req.method === 'PATCH' && path.length === 3) {
    json(res, 200, { flow: await flows.update(path[2], patchSchema.parse(await readBody(req))) }); return;
  }
  if (req.method === 'POST' && path.length === 6 && path[3] === 'nodes' && ['run', 'approve', 'reject'].includes(path[5])) {
    const body = await readBody(req);
    if (path[5] !== 'reject') emptySchema.parse(body);
    const flow = path[5] === 'reject' ? await flows.reject(path[2], path[4], rejectSchema.parse(body).note)
      : await flows[path[5] as 'run' | 'approve'](path[2], path[4]);
    json(res, 200, { flow }); return;
  }
  throw new HttpError(404, 'API endpoint not found');
}
