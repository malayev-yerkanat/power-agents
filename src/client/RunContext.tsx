import { useEffect, useState } from 'react';
import type { Run } from '../shared/types';
import { Encounter } from './Encounter';
import { MarkdownDocument } from './MarkdownDocument';

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

  return <section className="run-context" aria-label="Этапы и дальнейшие действия">
    <ol className="phase-list" aria-label="Этапы работы">{phases.map(phase =>
      <li key={phase.id} aria-current={run.phase === phase.id ? 'step' : undefined}>{phase.label}</li>)}</ol>
    {needsAttention && <div className="recovery-context">
      {latestReview && <details open><summary>Последнее ревью</summary><MarkdownDocument body={latestReview.body} /></details>}
      <button type="button" className="secondary-button" onClick={onClarify}>Уточнить задачу</button>
      <p>Уточнение отправляется отдельно. Чтобы возобновить работу после отправки, нажмите «{run.status === 'failed' ? 'Повторить шаг' : 'Продолжить'}».</p>
    </div>}
  </section>;
}

export function EncounterPanel({ run }: { run: Run }) {
  const [expanded, setExpanded] = useState(run.status === 'running' || run.status === 'planning');
  useEffect(() => {
    if (run.status !== 'running' && run.status !== 'planning') setExpanded(false);
  }, [run.status]);
  return <details className="encounter-panel" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>Сцена команды</summary>
    {expanded && <Encounter run={run} />}
  </details>;
}
