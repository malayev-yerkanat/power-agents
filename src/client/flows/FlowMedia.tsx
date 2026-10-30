import type { FlowNode } from '../../shared/flow-types';
import { t } from '../i18n';

export function mediaUrl(flowId: string, nodeId: string, version: number, path: string): string {
  return `/api/flows/${encodeURIComponent(flowId)}/files/${encodeURIComponent(nodeId)}/v${version}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function FlowMedia({ flowId, node }: { flowId: string; node: FlowNode }) {
  const files = Object.entries(node.output ?? {}).flatMap(([port, output]) => (output.files ?? []).map(path => ({ port, path })));
  if (!files.length) return null;
  return <div className="flow-media nodrag nopan nowheel">{files.map(({ port, path }) => {
    const url = mediaUrl(flowId, node.id, node.outputVersion ?? node.version, path);
    return <div key={`${port}:${path}`}>
      {/\.mp4$/i.test(path) && <video controls preload="metadata" src={url} aria-label={`${port}: ${path}`} />}
      {/\.mp3$/i.test(path) && <audio controls preload="metadata" src={url} aria-label={`${port}: ${path}`} />}
      <a href={url} target="_blank" rel="noreferrer">{path}</a>
    </div>;
  })}</div>;
}

export function FlowUpload({ node, pending, upload }: { node: FlowNode; pending?: boolean; upload?: (id: string, file: File) => void }) {
  if (node.type !== 'capture') return null;
  return <div className="flow-upload nodrag nopan nowheel">
    <label>{t('Загрузить съёмку')}<input type="file" accept=".mp4,.mov" aria-label={t('Загрузить съёмку')} disabled={pending || !upload || ['queued', 'running'].includes(node.status)}
      onChange={event => { const file = event.currentTarget.files?.[0]; if (file) upload?.(node.id, file); event.currentTarget.value = ''; }} /></label>
    {node.upload && <p>{node.upload.name} · {t('{n} МБ', { n: (node.upload.bytes / 1024 / 1024).toFixed(1) })}</p>}
  </div>;
}
