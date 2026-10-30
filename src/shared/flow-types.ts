/** Value kinds a node port carries; an edge may only join ports of the same kind ('text' accepts any). */
export type PortType = 'text' | 'brand' | 'idea' | 'script' | 'audio' | 'timings' | 'scenes' | 'video' | 'edit' | 'report';
export type NodeStatus = 'idle' | 'queued' | 'running' | 'awaiting_approval' | 'approved' | 'rejected' | 'stale' | 'failed';
export interface PortSpec { name: string; type: PortType; optional?: boolean }
/** Client-safe node registry metadata; server validation schemas never cross the API boundary. */
export interface FlowRegistryNode {
  type: string; title: string; inputs: PortSpec[]; outputs: PortSpec[];
  gate: boolean; lane?: string; configDefaults: Record<string, unknown>;
}
/** What one output port produced: an inline value, files in the node's version folder, or both. */
export interface PortValue { value?: unknown; files?: string[] }
export interface FlowNode {
  id: string; type: string; title: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  /** Stop for approval after a run; downstream nodes wait until it is approved. */
  gate: boolean;
  status: NodeStatus;
  /** Bumped at the start of every run; output files live under v<version>. */
  version: number;
  /** Hash of the config and upstream outputs the latest output was made from. */
  inputHash?: string;
  output?: Record<string, PortValue>;
  /** Rejection notes, passed to every later run of this node. */
  notes: string[];
  error?: string;
}
export interface FlowEdge { id: string; from: { node: string; port: string }; to: { node: string; port: string } }
export interface Flow {
  id: string; title: string; template?: string; mode: 'live' | 'demo';
  /** Run newly ready nodes as soon as their inputs are approved. */
  autoRun: boolean;
  nodes: FlowNode[]; edges: FlowEdge[];
  createdAt: string; updatedAt: string; version: number;
}
export type FlowSummary = Pick<Flow, 'id' | 'title' | 'template' | 'mode' | 'createdAt' | 'updatedAt' | 'version'>;
export interface NodeRun {
  id: number; flowId: string; nodeId: string; version: number; status: 'running' | 'done' | 'failed';
  inputHash: string; startedAt: string; finishedAt?: string; error?: string;
}
export interface CreateFlowInput { title: string; template?: string; mode: 'live' | 'demo' }
export interface FlowPatch {
  version: number; title?: string; autoRun?: boolean;
  nodes?: Pick<FlowNode, 'id' | 'type' | 'title' | 'position' | 'config' | 'gate'>[];
  edges?: FlowEdge[];
}
export interface FlowEvent { flowId: string; nodeId?: string; type: string; message: string }
