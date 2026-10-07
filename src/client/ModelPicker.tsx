import type { Connection, ModelCatalog } from '../shared/types';

type Props = {
  id: string;
  connection: Connection;
  value: string;
  catalog?: ModelCatalog;
  onChange: (model: string) => void;
  onRetry: () => void;
};

export function ModelPicker({ id, connection, value, catalog, onChange, onRetry }: Props) {
  const api = connection.kind.endsWith('-api');
  const models = catalog?.models ?? [];
  const ready = catalog?.status === 'ready';
  const note = catalog ? catalog.note || (ready ? '' : 'Список моделей недоступен.') : 'Загружаем модели…';
  return <div className="model-picker">
    <select id={id} value={value} disabled={api && !models.length} aria-describedby={note ? `${id}-help` : undefined}
      onChange={event => onChange(event.target.value)}>
      <option value="" disabled={api}>{api ? 'Выберите модель' : 'По умолчанию'}</option>
      {models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
    </select>
    {note && <div id={`${id}-help`} className="flex items-center gap-2 text-xs text-muted">
      <span>{note}</span>
      {!ready && catalog && <button className="text-button" type="button" onClick={onRetry}>Повторить</button>}
    </div>}
  </div>;
}
