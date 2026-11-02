import { useEffect, useState } from 'react';
import type { Run } from '../shared/types';
import { Encounter } from './Encounter';
import { MarkdownDocument } from './MarkdownDocument';
import { t } from './i18n';

const phases: Array<{ id: Run['phase']; label: string }> = [
  { id: 'plan', label: 'План' },
  { id: 'tasks', label: 'Задачи' },
  { id: 'synthesize', label: 'Итог' },
  { id: 'review', label: 'Ревью' },
  { id: 'done', label: 'Готово' },
];

export function RunContext({ run, onClarify }: { run: Run; onClarify: () => void }) {
  const needsAttention = run.status === 'paused' || run.status === 'failed';
  const latestReview = [...run.artifacts]
    .filter(artifact => artifact.kind === 'review')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];

  return <section className="run-context" aria-label={t('Этапы и дальнейшие действия')}>
    <ol className="phase-list" aria-label={t('Этапы работы')}>{phases.map(phase =>
      <li key={phase.id} aria-current={run.phase === phase.id ? 'step' : undefined}>{t(phase.label)}</li>)}</ol>
    {needsAttention && <div className="recovery-context">
      {latestReview && <details open><summary>{t('Последнее ревью')}</summary><MarkdownDocument body={latestReview.body} /></details>}
      <button type="button" className="secondary-button" onClick={onClarify}>{t('Уточнить задачу')}</button>
      <p>{t('Уточнение отправляется отдельно. Чтобы возобновить работу после отправки, нажмите «{action}».', { action: run.status === 'failed' ? t('Повторить шаг') : t('Продолжить') })}</p>
    </div>}
  </section>;
}

export function EncounterPanel({ run }: { run: Run }) {
  const [expanded, setExpanded] = useState(run.status === 'running' || run.status === 'planning');
  useEffect(() => {
    if (run.status !== 'running' && run.status !== 'planning') setExpanded(false);
  }, [run.status]);
  return <details className="encounter-panel" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>{t('Сцена команды')}</summary>
    {expanded && <Encounter run={run} />}
  </details>;
}
