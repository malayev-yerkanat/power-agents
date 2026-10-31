import type { Connection, ModelCatalog } from '../shared/types';
import { t } from './i18n';
import { uiMessage } from './uiMessages';

type Props = {
  id: string;
  connection: Connection;
  value: string;
  catalog?: ModelCatalog;
  error?: string;
  onChange: (model: string) => void;
  onRetry: () => void;
};

export function ModelPicker({ id, connection, value, catalog, error, onChange, onRetry }: Props) {
  const api = connection.kind.endsWith('-api');
  const models = catalog?.models ?? [];
  const ready = catalog?.status === 'ready';
  const note = catalog ? uiMessage(catalog.note) || (ready ? '' : t('Список моделей недоступен.')) : t('Загружаем модели…');
  return <div className="model-picker" tabIndex={-1} role="group" aria-label={t('Выбор модели')} aria-describedby={error ? `${id}-error` : undefined}>
    <select id={id} value={value} disabled={api && !models.length} aria-invalid={error ? true : undefined}
      aria-describedby={[note ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
      onChange={event => onChange(event.target.value)}>
      <option value="" disabled={api}>{api ? t('Выберите модель') : t('По умолчанию')}</option>
      {models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
    </select>
    {note && <div id={`${id}-help`} className="flex items-center gap-2 text-xs text-muted">
      <span>{note}</span>
      {!ready && catalog && <button className="text-button" type="button" onClick={onRetry}>{t('Повторить')}</button>}
    </div>}
    {error && <p id={`${id}-error`} className="field-error">{uiMessage(error)}</p>}
  </div>;
}
