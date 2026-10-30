import { z } from 'zod';
import type { Flow, FlowNode, FlowEdge, PortSpec, PortType, PortValue } from '../../shared/flow-types.ts';
export interface ExecutionContext {
  flow: Flow; node: FlowNode; inputs: Record<string, PortValue>; notes: string[]; dir: string; signal: AbortSignal;
}
export type Executor = (ctx: ExecutionContext) => Promise<Record<string, PortValue>>;
export interface NodeDefinition {
  type: string; title: string; inputs: PortSpec[]; outputs: PortSpec[];
  config: z.ZodType<Record<string, unknown>>; gate: boolean; lane?: string;
}
const ports = (...types: PortType[]): PortSpec[] => types.map(type => ({ name: type, type }));
const text = z.string().max(24_000).default('');
const llm = { prompt: text, connectionId: z.string().max(200).default(''), model: z.string().max(200).default('') };
const define = (type: string, title: string, inputs: PortType[], outputs: PortType[], shape: z.ZodRawShape, gate = true, lane?: string): NodeDefinition =>
  ({ type, title, inputs: ports(...inputs), outputs: ports(...outputs), config: z.object(shape).strict(), gate, ...(lane ? { lane } : {}) });
export const registry: Readonly<Record<string, NodeDefinition>> = Object.freeze(Object.fromEntries([
  define('brand', 'Brand', [], ['brand'], { text, rules: z.array(z.string().max(2000)).max(100).default([]) }, false),
  define('idea', 'Idea', ['brand'], ['idea'], { ...llm, topic: text }),
  define('script', 'Script', ['idea', 'brand'], ['script'], { ...llm, words: z.number().int().min(1).max(5000).default(150) }),
  define('voice', 'Voice-over', ['script'], ['audio', 'timings'], { voice: z.string().max(200).default(''), language: z.string().max(50).default('en') }),
  define('scenes', 'Scenes', ['script', 'timings'], ['scenes'], llm),
  define('capture', 'Capture', ['scenes'], ['video'], { instructions: text }),
  define('edit', 'Edit plan', ['timings', 'video', 'brand'], ['edit'], llm),
  define('preview', 'Preview', ['edit', 'video', 'audio'], ['video'], { height: z.number().int().min(240).max(2160).default(540) }, true, 'render'),
  define('qa', 'QA', ['video', 'edit'], ['report'], { instructions: text }, false),
  define('final', 'Final', ['edit', 'video', 'audio', 'report'], ['video'], { height: z.number().int().min(240).max(2160).default(1080) }, true, 'render'),
  define('prompt', 'Prompt / Note', [], ['text'], { text }, false),
].map(definition => [definition.type, definition])));
export const demoExecutor: Executor = async ({ node, notes }) => Object.fromEntries(registry[node.type].outputs.map(port =>
  [port.name, { value: { type: node.type, port: port.name, version: node.version, config: node.config, notes: [...notes] } }]));
export function robloxReel(): Pick<Flow, 'nodes' | 'edges'> {
  const types = ['brand', 'idea', 'script', 'voice', 'scenes', 'capture', 'edit', 'preview', 'qa', 'final'];
  const nodes: FlowNode[] = types.map((type, index) => ({ id: type, type, title: registry[type].title,
    position: { x: index * 320, y: 160 }, config: registry[type].config.parse({}), gate: registry[type].gate,
    status: 'idle', version: 0, notes: [] }));
  const connections = [
    ['brand', 'idea', 'brand'], ['idea', 'script', 'idea'], ['brand', 'script', 'brand'], ['script', 'voice', 'script'],
    ['script', 'scenes', 'script'], ['voice', 'scenes', 'timings'], ['scenes', 'capture', 'scenes'],
    ['voice', 'edit', 'timings'], ['capture', 'edit', 'video'], ['brand', 'edit', 'brand'],
    ['edit', 'preview', 'edit'], ['capture', 'preview', 'video'], ['voice', 'preview', 'audio'],
    ['preview', 'qa', 'video'], ['edit', 'qa', 'edit'], ['edit', 'final', 'edit'],
    ['capture', 'final', 'video'], ['voice', 'final', 'audio'], ['qa', 'final', 'report'],
  ];
  const edges: FlowEdge[] = connections.map(([from, to, port]) => ({ id: `${from}-${to}-${port}`, from: { node: from, port }, to: { node: to, port } }));
  return { nodes, edges };
}
