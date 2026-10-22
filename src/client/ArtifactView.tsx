import { useState } from 'react';
import type { Artifact } from '../shared/types';
import { MarkdownDocument } from './MarkdownDocument';
import { timeLabel } from './ui';

type Props = { artifact: Artifact; runId: string; label: string; author: string; expanded: boolean };

export function ArtifactView({ artifact, runId, label, author, expanded }: Props) {
  const [notice, setNotice] = useState('');
  const document = <>
    <MarkdownDocument body={artifact.body} />
    <details className="artifact-source"><summary>Исходный Markdown</summary><pre>{artifact.body}</pre></details>
  </>;
  return <article className={`artifact ${expanded ? 'final-artifact' : ''}`}>
    <div className="artifact-heading">
      <div><div className="eyebrow">{label}</div><h2>{artifact.title}</h2><p className="artifact-meta">{author} · {timeLabel(artifact.createdAt)}</p></div>
      <div className="artifact-actions">
        <button className="secondary-button" type="button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(artifact.body);
            setNotice('Markdown скопирован.');
          } catch {
            setNotice('Копирование недоступно. Откройте исходный Markdown и выделите текст.');
          }
        }}>Копировать Markdown</button>
        <a className="secondary-button" href={`/api/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifact.id)}`} download>Скачать Markdown</a>
      </div>
    </div>
    <p className="artifact-action-notice" role="status">{notice}</p>
    {expanded ? document : <details className="artifact-disclosure"><summary>Документ: {artifact.title}</summary>{document}</details>}
  </article>;
}
