import { Handle, Position, type NodeProps } from '@xyflow/react';
import { nodeLabels, nodeTitle, outputExcerpt, portColors, statusLabels, type CanvasNode } from './helpers';
import { FlowMedia, FlowUpload } from './FlowMedia';
import { t, useLanguage } from '../i18n';

export function FlowCard({ data, selected }: NodeProps<CanvasNode>) {
  useLanguage();
  const { node, definition, runnable, pending, action, flowId, upload } = data;
  const output = definition?.outputs[0];
  const value = output ? node.output?.[output.name] : undefined;
  return <article className={`flow-card flow-status-${node.status} ${node.needsHuman ? 'flow-needs-human' : ''} ${selected ? 'flow-card-selected' : ''}`}
    data-testid={`flow-node-${node.id}`} data-status={node.status} aria-label={t('Узел: {title}', { title: nodeTitle(node, definition) })}>
    {definition?.inputs.map((port, index) => <Handle key={port.name} type="target" position={Position.Left}
      id={port.name} title={`${port.name} · ${port.type}`} aria-label={t('Вход {name}', { name: port.name })}
      style={{ top: 48 + index * 23, background: portColors[port.type] }} />)}
    <header><span className="flow-type">{t(nodeLabels[node.type] ?? '') || definition?.title || node.type}</span>
      <h2>{nodeTitle(node, definition)}</h2><span className="flow-status-chip">{node.needsHuman ? t('Нужно действие') : t(statusLabels[node.status])}</span></header>
    <div className="flow-preview">{(value?.value !== undefined || !value?.files?.length) && (['idea', 'script'].includes(node.type)
      ? <p className="flow-text-preview">{outputExcerpt(value?.value, node.type)}</p>
      : <pre>{outputExcerpt(value?.value)}</pre>)}
      <FlowMedia flowId={flowId} node={node} />
    </div>
    <FlowUpload node={node} pending={pending} upload={upload} />
    {node.error && <p className="flow-node-error">{node.error}</p>}
    <footer className="nodrag nopan">
      {node.status === 'awaiting_approval'
        ? <><button disabled={pending} onClick={() => action?.(node.id, 'approve')}>{t('Одобрить')}</button>
            <button disabled={pending} onClick={() => action?.(node.id, 'reject')}>{t('Отклонить')}</button></>
        : <button disabled={pending || !runnable} title={!runnable ? t('Нужны одобренные результаты всех входов') : undefined}
            onClick={() => action?.(node.id, 'run')}>{t('Запустить')}</button>}
    </footer>
    {definition?.outputs.map((port, index) => <Handle key={port.name} type="source" position={Position.Right}
      id={port.name} title={`${port.name} · ${port.type}`} aria-label={t('Выход {name}', { name: port.name })}
      style={{ top: 48 + index * 23, background: portColors[port.type] }} />)}
  </article>;
}
