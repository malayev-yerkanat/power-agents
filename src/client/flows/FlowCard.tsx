import { Handle, Position, type NodeProps } from '@xyflow/react';
import { nodeLabels, nodeTitle, outputExcerpt, portColors, statusLabels, type CanvasNode } from './helpers';

export function FlowCard({ data, selected }: NodeProps<CanvasNode>) {
  const { node, definition, runnable, pending, action } = data;
  const output = definition?.outputs[0];
  const value = output ? node.output?.[output.name] : undefined;
  const file = value?.files?.[0];
  return <article className={`flow-card flow-status-${node.status} ${selected ? 'flow-card-selected' : ''}`}
    data-testid={`flow-node-${node.id}`} data-status={node.status} aria-label={`Узел: ${nodeTitle(node, definition)}`}>
    {definition?.inputs.map((port, index) => <Handle key={port.name} type="target" position={Position.Left}
      id={port.name} title={`${port.name} · ${port.type}`} aria-label={`Вход ${port.name}`}
      style={{ top: 48 + index * 23, background: portColors[port.type] }} />)}
    <header><span className="flow-type">{nodeLabels[node.type] || definition?.title || node.type}</span>
      <h2>{nodeTitle(node, definition)}</h2><span className="flow-status-chip">{statusLabels[node.status]}</span></header>
    <div className="flow-preview"><pre>{outputExcerpt(value?.value)}</pre>
      {file && <p className="flow-file">Медиафайл: {file}<br />Просмотр появится с медиапайплайном.</p>}
    </div>
    {node.error && <p className="flow-node-error">{node.error}</p>}
    <footer className="nodrag nopan">
      {node.status === 'awaiting_approval'
        ? <><button disabled={pending} onClick={() => action?.(node.id, 'approve')}>Одобрить</button>
            <button disabled={pending} onClick={() => action?.(node.id, 'reject')}>Отклонить</button></>
        : <button disabled={pending || !runnable} title={!runnable ? 'Нужны одобренные результаты всех входов' : undefined}
            onClick={() => action?.(node.id, 'run')}>Запустить</button>}
    </footer>
    {definition?.outputs.map((port, index) => <Handle key={port.name} type="source" position={Position.Right}
      id={port.name} title={`${port.name} · ${port.type}`} aria-label={`Выход ${port.name}`}
      style={{ top: 48 + index * 23, background: portColors[port.type] }} />)}
  </article>;
}
