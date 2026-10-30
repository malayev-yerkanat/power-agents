import { useState } from 'react';
import type { FlowNode, FlowRegistryNode } from '../../shared/flow-types';
import type { Connection } from '../../shared/types';
import { nodeLabels, nodeTitle } from './helpers';

const fieldLabels: Record<string, string> = {
  text: 'Текст', rules: 'Правила (по одному на строку)', prompt: 'Инструкция', connectionId: 'Подключение', model: 'Модель',
  topic: 'Тема', avoid: 'Уже сделанные темы (по одной на строку)', words: 'Число слов', voice: 'Голос', language: 'Язык', instructions: 'Указания', height: 'Высота кадра',
};
export function FlowInspector({ node, definition, connections, pending, save, close }: {
  node: FlowNode; definition: FlowRegistryNode; pending: boolean;
  connections: Connection[];
  save: (value: Pick<FlowNode, 'title' | 'gate' | 'config'>) => Promise<boolean | undefined>; close: () => void;
}) {
  const [title, setTitle] = useState(nodeTitle(node, definition));
  const [gate, setGate] = useState(node.gate);
  const [config, setConfig] = useState({ ...node.config });
  const [saved, setSaved] = useState(false);
  const busy = pending || ['queued', 'running'].includes(node.status);
  return <aside className="flow-inspector" aria-label="Инспектор узла">
    <div className="flow-inspector-heading"><h2>{nodeLabels[node.type] || definition.title}</h2>
      <button onClick={close} aria-label="Закрыть инспектор">×</button></div>
    <form onSubmit={async event => { event.preventDefault(); setSaved(false); if (await save({ title, gate, config })) setSaved(true); }}>
      <label>Название узла<input value={title} required maxLength={200} disabled={busy} onChange={e => { setTitle(e.target.value); setSaved(false); }} /></label>
      <label className="flow-checkbox"><input type="checkbox" checked={gate} disabled={busy} onChange={e => { setGate(e.target.checked); setSaved(false); }} />Требовать одобрение</label>
      {Object.entries(definition.configDefaults).map(([key, defaultValue]) => {
        const value = config[key] ?? defaultValue;
        const set = (next: unknown) => { setConfig(current => ({ ...current, [key]: next })); setSaved(false); };
        // Explicit name: a wrapping <label> would otherwise include a textarea's own text in its label text.
        const label = fieldLabels[key] || key;
        return <label key={key}>{label}
          {key === 'connectionId'
            ? <select aria-label={label} value={String(value)} disabled={busy} onChange={e => set(e.target.value)}>
                <option value="">Авто</option>
                {connections.filter(connection => connection.available).map(connection =>
                  <option key={connection.id} value={connection.id}>{connection.name}</option>)}
                {value && !connections.some(connection => connection.id === value && connection.available)
                  ? <option value={String(value)} disabled>{connections.find(connection => connection.id === value)?.name || String(value)} · недоступно</option> : null}
              </select>
            : typeof defaultValue === 'number'
            ? <input aria-label={label} type="number" value={typeof value === 'number' && Number.isFinite(value) ? value : ''} required disabled={busy} onChange={e => set(e.target.value === '' ? '' : Number(e.target.value))} />
            : Array.isArray(defaultValue)
              ? <textarea aria-label={label} rows={4} value={Array.isArray(value) ? value.join('\n') : ''} disabled={busy}
                  onChange={e => set(e.target.value ? e.target.value.split('\n') : [])} />
              : ['model', 'voice', 'language'].includes(key)
                ? <input aria-label={label} value={String(value)} disabled={busy} onChange={e => set(e.target.value)} />
                : <textarea aria-label={label} rows={4} value={String(value)} disabled={busy} onChange={e => set(e.target.value)} />}
        </label>;
      })}
      <button type="submit" disabled={busy}>Сохранить</button>{saved && <span role="status"> Сохранено</span>}
    </form>
    <p>Версия результата: {node.version}</p>
    <h3>Полный результат</h3><pre className="flow-full-output">{node.output ? JSON.stringify(node.output, null, 2) : 'Результата пока нет'}</pre>
    <h3>Замечания</h3>{node.notes.length ? <ul>{node.notes.map((note, i) => <li key={i}>{note}</li>)}</ul> : <p>Замечаний нет</p>}
    {node.error && <p className="flow-node-error" role="alert">{node.error}</p>}
  </aside>;
}
