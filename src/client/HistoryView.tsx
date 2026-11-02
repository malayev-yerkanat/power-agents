import { useState } from 'react';
import type { RunSummary } from '../shared/types';
import { dateLabel, statusLabels } from './ui';
import { t } from './i18n';

type Props = {
  runs: RunSummary[];
  totalRuns: number;
  hasMore: boolean;
  loading: boolean;
  loadMore: () => void;
  select: (id: string) => void;
};

const statuses = ['planning', 'awaiting_approval', 'running', 'paused', 'completed', 'failed', 'cancelled'] as const;

export function HistoryView({ runs, totalRuns, hasMore, loading, loadMore, select }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const term = query.trim().toLocaleLowerCase('ru');
  const visible = runs.filter(run =>
    (status === 'all' || run.status === status) && run.title.toLocaleLowerCase('ru').includes(term));

  return <main className="main-content history-content">
    <h1 id="workspace-heading" tabIndex={-1}>{t('Все задачи')}</h1>
    <p>{t('Загружено {loaded} из {total} запусков.', { loaded: runs.length, total: totalRuns })}</p>
    <div className="history-filters">
      <label>{t('Поиск среди загруженных запусков')}
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <label>{t('Статус')}
        <select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">{t('Все статусы')}</option>
          {statuses.map(value => <option value={value} key={value}>{t(statusLabels[value])}</option>)}
        </select>
      </label>
    </div>
    <p role="status">{t('Найдено среди загруженных: {count}', { count: visible.length })}</p>
    {visible.length ? <ul className="history-results">{visible.map(run => <li key={run.id}>
      <button type="button" onClick={() => select(run.id)}>
        <strong>{run.title}</strong>
        <span>{t(statusLabels[run.status])} · {dateLabel(run.createdAt)}{run.mode === 'demo' ? t(' · Демо') : ''}</span>
      </button>
    </li>)}</ul> : <p>{runs.length ? t('Совпадений среди загруженных запусков нет.') : t('Запусков пока нет.')}</p>}
    {hasMore && <button type="button" className="secondary-button" disabled={loading} onClick={loadMore}>
      {loading ? t('Загружаем…') : t('Загрузить более ранние запуски')}
    </button>}
  </main>;
}
