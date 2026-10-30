import { useState } from 'react';
import type { Artifact } from '../shared/types';
import { MarkdownDocument } from './MarkdownDocument';
import { timeLabel } from './ui';
import { t } from './i18n';

const fileSize = (bytes: number) => bytes < 1024 ? t('{n} Б', { n: bytes }) : bytes < 1024 * 1024 ? t('{n} КБ', { n: Math.round(bytes / 1024) }) : t('{n} МБ', { n: (bytes / 1024 / 1024).toFixed(1) });

type Props = { artifact: Artifact; runId: string; label: string; author: string; expanded: boolean };

export function ArtifactView({ artifact, runId, label, author, expanded }: Props) {
  const [notice, setNotice] = useState('');
  const document = <>
    <MarkdownDocument body={artifact.body} />
    <details className="artifact-source"><summary>{t('Исходный Markdown')}</summary><pre>{artifact.body}</pre></details>
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
        }}>{t('Копировать Markdown')}</button>
        <a className="secondary-button" href={`/api/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifact.id)}`} download>{t('Скачать Markdown')}</a>
      </div>
    </div>
    <p className="artifact-action-notice" role="status">{t(notice)}</p>
    {!!artifact.files?.length && artifact.taskId && <div className="artifact-files"><div className="eyebrow">{t('Файлы задачи')}</div><ul>
      {artifact.files.map(file => <li key={file.path}><a href={`/api/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(artifact.taskId!)}/${file.path.split('/').map(encodeURIComponent).join('/')}`} download>{file.path}</a> <span className="artifact-meta">{fileSize(file.bytes)}</span></li>)}
    </ul>{!!artifact.omittedFiles && <p className="artifact-meta">{t('Не показано файлов: {count} (лимиты: 200 файлов, 1 МБ на файл, 10 МБ на задачу).', { count: artifact.omittedFiles })}</p>}</div>}
    {expanded ? document : <details className="artifact-disclosure"><summary>{t('Документ:')} {artifact.title}</summary>{document}</details>}
  </article>;
}
