import { useCallback, useEffect, useState } from 'react';
import type { Flow, FlowSummary } from '../../shared/flow-types';
import { flowEventName, type Request } from './useFlow';
import { locale, t } from '../i18n';
import { uiMessage } from '../uiMessages';

export function FlowList({ request, csrfToken, open }: { request: Request; csrfToken: string; open: (id: string) => void }) {
  const [flows, setFlows] = useState<FlowSummary[] | null>(null);
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const data = await request<{ flows: FlowSummary[] }>('/api/flows', { signal });
    setFlows(data.flows);
  }, [request]);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => void refresh(controller.signal).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить потоки.'); });
    load();
    window.addEventListener(flowEventName, load);
    return () => { controller.abort(); window.removeEventListener(flowEventName, load); };
  }, [refresh]);
  async function create() {
    setPending(true); setError('');
    try {
      const { flow } = await request<{ flow: Flow }>('/api/flows', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ title: t('Ролик ROBLOX'), template: 'roblox-reel', mode }) });
      open(flow.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать поток.'); }
    finally { setPending(false); }
  }
  return <main className="flows-list">
    <h1 id="workspace-heading" tabIndex={-1}>{t('Потоки')}</h1>
    <p>{t('От идеи до ролика: запускайте шаги и одобряйте результаты на канвасе.')}</p>
    <div className="flow-list-actions"><label>{t('Режим нового потока')} <select value={mode} onChange={e => setMode(e.target.value as 'demo' | 'live')}>
      <option value="demo">{t('Демо')}</option><option value="live">{t('Живой')}</option></select></label>
      <button onClick={() => void create()} disabled={pending}>{t('Новый поток')}</button></div>
    <p className="flow-muted">{t('Шаблон: ролик ROBLOX. В демо запросы к моделям не выполняются. В живом режиме доступны текстовые шаги и медиапайплайн. Для медиа настройте ElevenLabs и папку этапов.')}</p>
    {error && <p role="alert">{uiMessage(error)}</p>}
    {flows === null ? <p>{t('Загружаем потоки…')}</p> : !flows.length ? <p>{t('Потоков пока нет. Создайте первый из шаблона.')}</p>
      : <ul className="flow-list-items">{flows.map(flow => <li key={flow.id}><button onClick={() => open(flow.id)}>
          <strong>{flow.title}</strong><span>{flow.mode === 'demo' ? t('Демо') : t('Живой')} · {new Date(flow.updatedAt).toLocaleString(locale())}</span>
        </button></li>)}</ul>}
  </main>;
}
