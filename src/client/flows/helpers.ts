import type { Node, Edge } from '@xyflow/react';
import type { Flow, FlowNode, FlowPatch, FlowRegistryNode, PortType } from '../../shared/flow-types';
import { t } from '../i18n';

export type FlowCardData = {
  node: FlowNode; definition?: FlowRegistryNode; runnable: boolean;
  flowId: string; upload?: (id: string, file: File) => void;
  pending?: boolean; action?: (id: string, action: 'run' | 'approve' | 'reject') => void;
};
export type CanvasNode = Node<FlowCardData, 'flowCard'>;
export const portColors: Record<PortType, string> = {
  text: '#aeb8c5', brand: '#b794f6', idea: '#ffd166', script: '#80bfff', audio: '#f59bb5',
  timings: '#72dcc6', scenes: '#afcd79', video: '#cd9eff', edit: '#ffb478', report: '#7edaa0',
};
export const nodeLabels: Record<string, string> = {
  brand: 'Бренд', idea: 'Идея', script: 'Сценарий', voice: 'Озвучка', scenes: 'Сцены', capture: 'Съёмка',
  edit: 'План монтажа', preview: 'Превью', qa: 'Проверка качества', final: 'Финальный рендер', prompt: 'Заметка',
};
export const statusLabels: Record<FlowNode['status'], string> = {
  idle: 'Не запущен', queued: 'В очереди', running: 'В работе', awaiting_approval: 'Ждёт одобрения',
  approved: 'Одобрен', rejected: 'Отклонён', stale: 'Устарел', failed: 'Ошибка',
};
export function compatiblePorts(output?: PortType, input?: PortType): boolean {
  return !!output && !!input && (input === 'text' || input === output);
}
export function isRunnable(flow: Flow, node: FlowNode, definition?: FlowRegistryNode): boolean {
  if (!definition || ['queued', 'running', 'awaiting_approval'].includes(node.status)) return false;
  return definition.inputs.every(port => {
    const edge = flow.edges.find(e => e.to.node === node.id && e.to.port === port.name);
    return edge ? flow.nodes.some(n => n.id === edge.from.node && n.status === 'approved') : !!port.optional;
  });
}
export function toCanvas(flow: Flow, types: FlowRegistryNode[]): { nodes: CanvasNode[]; edges: Edge[] } {
  return {
    nodes: flow.nodes.map(node => {
      const definition = types.find(t => t.type === node.type);
      return { id: node.id, type: 'flowCard', position: { ...node.position },
        data: { node, definition, flowId: flow.id, runnable: isRunnable(flow, node, definition) } };
    }),
    edges: flow.edges.map(edge => ({ id: edge.id, source: edge.from.node, target: edge.to.node,
      sourceHandle: edge.from.port, targetHandle: edge.to.port, type: 'default' })),
  };
}
export function patchNodes(flow: Flow): NonNullable<FlowPatch['nodes']> {
  return flow.nodes.map(({ id, type, title, position, config, gate }) => ({ id, type, title, position: { ...position }, config, gate }));
}
export function outputExcerpt(value: unknown, nodeType?: string): string {
  if (value === undefined) return t('Результат появится после запуска');
  if (value && typeof value === 'object') {
    const result = value as Record<string, unknown>;
    if (nodeType === 'idea' && Array.isArray(result.candidates) && Number.isInteger(result.chosen)) {
      const chosen = result.candidates[result.chosen as number];
      if (chosen && typeof chosen.topic === 'string' && typeof chosen.hook === 'string')
        return `${chosen.topic}\n${chosen.hook}`;
    }
    if (nodeType === 'script' && typeof result.hook === 'string' && typeof result.wordCount === 'number')
      return `${result.hook}\n${t('{n} слов', { n: result.wordCount })}`;
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > 260 ? `${text.slice(0, 260)}…` : text;
}

export function nodeTitle(node: FlowNode, definition?: FlowRegistryNode): string {
  return node.title === definition?.title ? t(nodeLabels[node.type] ?? '') || node.title : node.title;
}
