import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowClockwise, ArrowUpRight, CaretRight, Check, FolderSimple, List, PlugsConnected, Plus, SidebarSimple, X } from '@phosphor-icons/react';
import type { Bootstrap, CreateRunInput, EventHistoryPage, ModelCatalog, Run, RunDetail, RunEvent, RunSummary, RunSummaryPage } from '../shared/types';
import { FlowList } from './flows/FlowList';
import { flowEventName } from './flows/useFlow';
import { Composer } from './Composer';
import { CityBackdrop } from './CityBackdrop';
import { HistoryView } from './HistoryView';
import type { WorkspaceLocation } from './navigation';
import { RunWorkspace } from './RunWorkspace';
import { api, createSessionRequest } from './session';
import { TelegramSettings } from './TelegramSettings';
import { useWorkspaceLocation } from './useWorkspaceLocation';
import { dateLabel, ErrorNote, statusLabels } from './ui';
import { uiMessage } from './uiMessages';
import { LanguageToggle, t, useLanguage } from './i18n';

const FlowCanvas = lazy(() => import('./flows/FlowCanvas').then(module => ({ default: module.FlowCanvas })));

function summary(run: Run): RunSummary {
  return { id: run.id, title: run.title, status: run.status, mode: run.mode,
    createdAt: run.createdAt, updatedAt: run.updatedAt, version: run.version };
}

function mergeSummaries(recent: RunSummary[], older: RunSummary[]): RunSummary[] {
  const byId = new Map(older.map(run => [run.id, run]));
  for (const run of recent) {
    const existing = byId.get(run.id);
    if (!existing || run.version >= existing.version) byId.set(run.id, run);
  }
  return [...byId.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
}

export function mergeBootstrap(incoming: Bootstrap, current: Bootstrap | null): Bootstrap {
  if (!current) return incoming;
  const runs = mergeSummaries(incoming.runs, current.runs);
  const addedRunsNeedPaging = incoming.totalRuns > current.totalRuns && runs.length < incoming.totalRuns;
  return { ...incoming, runs, nextCursor: addedRunsNeedPaging ? incoming.nextCursor : current.nextCursor };
}

export function mergeDetail(current: RunDetail | null, incoming: RunDetail): RunDetail {
  if (!current || current.run.id !== incoming.run.id) return incoming;
  if (current.run.version > incoming.run.version) return current;
  const byId = new Map(current.events.map(event => [event.id, event]));
  for (const event of incoming.events) byId.set(event.id, event);
  const hasOlderEvents = current.eventsBefore !== undefined
    || (current.events.length > 0 && incoming.events.length > 0 && current.events[0].id < incoming.events[0].id);
  return { ...incoming, events: [...byId.values()].sort((left, right) => left.id - right.id),
    eventsBefore: hasOlderEvents ? current.eventsBefore : incoming.eventsBefore };
}

export function App() {
  useLanguage();
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const { location, navigate } = useWorkspaceLocation();
  const selectedId = location.view === 'run' ? location.runId : null;
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [settings, setSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [navigationVersion, setNavigationVersion] = useState(0);
  const pendingHeadingFocus = useRef(false);
  const historyDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (sidebarOpen) historyDialog.current?.showModal();
    else historyDialog.current?.close();
  }, [sidebarOpen]);
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [streamVersion, setStreamVersion] = useState(0);
  const streamRecoveryCount = useRef(0);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const fetchBootstrap = useCallback(() => api<Bootstrap>('/api/bootstrap'), []);
  const applyBootstrap = useCallback((data: Bootstrap) => {
    setBootstrap(current => mergeBootstrap(data, current));
    setError('');
  }, []);
  const loadBootstrap = useCallback(async (): Promise<Bootstrap> => {
    const data = await fetchBootstrap();
    applyBootstrap(data);
    return data;
  }, [fetchBootstrap, applyBootstrap]);
  const request = useMemo(() => createSessionRequest(loadBootstrap), [loadBootstrap]);
  const loadModels = useCallback((connectionId: string) => request<ModelCatalog>(`/api/models/${encodeURIComponent(connectionId)}`), [request]);
  const refresh = useCallback(async () => {
    try { await loadBootstrap(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось подключиться к серверу.'); }
  }, [loadBootstrap]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!bootstrap) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let stableTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const stream = new EventSource(`/api/events?after=${bootstrap.eventCursor}`);
    stream.onopen = () => {
      if (disposed) return;
      setStreamStatus('connected');
      window.dispatchEvent(new CustomEvent(flowEventName));
      stableTimer = setTimeout(() => { if (!disposed) streamRecoveryCount.current = 0; }, 30_000);
    };
    const recover = () => {
      if (disposed) return;
      setStreamStatus('disconnected');
      stream.close();
      if (stableTimer) clearTimeout(stableTimer);
      const attempt = ++streamRecoveryCount.current;
      if (attempt > 3) {
        setError('Не удалось восстановить поток событий. Проверьте cookies для 127.0.0.1 и обновите страницу.');
        return;
      }
      let failures = 0;
      const reconnect = async () => {
        try {
          const data = await fetchBootstrap();
          const id = selectedRef.current;
          const incoming = id ? await request<RunDetail>(`/api/runs/${encodeURIComponent(id)}`) : null;
          if (!disposed) {
            applyBootstrap(data);
            if (incoming && selectedRef.current === id) {
              setDetail(current => mergeDetail(current, incoming));
              setDetailError('');
            }
            reconnectTimer = setTimeout(() => {
              if (!disposed) setStreamVersion(value => value + 1);
            }, Math.min(1000 * 2 ** (attempt - 1), 8000));
          }
        } catch {
          if (disposed) return;
          failures += 1;
          reconnectTimer = setTimeout(() => void reconnect(), Math.min(1000 * 2 ** failures, 8000));
        }
      };
      void reconnect();
    };
    stream.onerror = recover;
    stream.addEventListener('resync', recover);
    const receive = (event: MessageEvent<string>) => {
      try { JSON.parse(event.data) as RunEvent; } catch { return; }
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const id = selectedRef.current;
        const results = await Promise.allSettled([loadBootstrap(), id ? request<RunDetail>(`/api/runs/${encodeURIComponent(id)}`) : Promise.resolve(null)]);
        if (disposed) return;
        if (results[0].status === 'rejected') setError('Не удалось обновить список задач. Проверьте подключение к локальному серверу.');
        if (results[1].status === 'fulfilled' && results[1].value && selectedRef.current === id) {
          const incoming = results[1].value;
          setDetail(current => mergeDetail(current, incoming));
          setDetailError('');
        }
      }, 180);
    };
    const receiveFlow = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data?.flowId === 'string') window.dispatchEvent(new CustomEvent(flowEventName, { detail: data }));
      } catch { /* Ignore malformed invalidations. */ }
    };
    stream.addEventListener('flow', receiveFlow);
    stream.addEventListener('run', receive);
    return () => { disposed = true; if (timer) clearTimeout(timer); if (reconnectTimer) clearTimeout(reconnectTimer); if (stableTimer) clearTimeout(stableTimer); stream.removeEventListener('flow', receiveFlow); stream.removeEventListener('run', receive); stream.removeEventListener('resync', recover); stream.close(); };
  }, [!!bootstrap, applyBootstrap, fetchBootstrap, loadBootstrap, request, streamVersion]);
  useEffect(() => {
    setDetail(null); setDetailError('');
    if (!selectedId) return;
    const controller = new AbortController();
    request<RunDetail>(`/api/runs/${encodeURIComponent(selectedId)}`, { signal: controller.signal }).then(incoming => {
      if (!controller.signal.aborted) setDetail(current => mergeDetail(current, incoming));
    }).catch(cause => { if (!controller.signal.aborted) setDetailError(cause instanceof Error ? cause.message : 'Не удалось загрузить задачу.'); });
    return () => controller.abort();
  }, [selectedId, request]);
  useEffect(() => {
    pendingHeadingFocus.current = true;
    setNavigationVersion(version => version + 1);
  }, [location.view, selectedId]);
  useEffect(() => {
    if (!pendingHeadingFocus.current || sidebarOpen || !bootstrap) return;
    if (selectedId && detail?.run.id !== selectedId) return;
    const heading = document.getElementById('workspace-heading');
    if (heading) { heading.focus(); pendingHeadingFocus.current = false; }
  }, [navigationVersion, sidebarOpen, selectedId, detail?.run.id, bootstrap]);
  function goTo(next: WorkspaceLocation) {
    pendingHeadingFocus.current = true;
    setNavigationVersion(version => version + 1);
    navigate(next);
    setSidebarOpen(false);
  }
  function select(id: string | null) {
    goTo(id ? { view: 'run', runId: id } : { view: 'new' });
  }
  async function loadOlderRuns() {
    if (!bootstrap?.nextCursor || loadingHistory) return;
    setLoadingHistory(true);
    try {
      const page = await request<RunSummaryPage>(`/api/runs?before=${encodeURIComponent(bootstrap.nextCursor)}`);
      setBootstrap(current => current ? { ...current, runs: mergeSummaries(current.runs, page.runs), nextCursor: page.nextCursor,
        totalRuns: page.totalRuns } : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось загрузить историю запусков.'); }
    finally { setLoadingHistory(false); }
  }
  async function loadOlderEvents() {
    if (!detail?.eventsBefore) return;
    const runId = detail.run.id;
    const before = detail.eventsBefore;
    const page = await request<EventHistoryPage>(`/api/runs/${encodeURIComponent(runId)}/events/history?before=${before}`);
    setDetail(current => current?.run.id === runId && current.eventsBefore === before
      ? { ...current, events: [...page.events, ...current.events], eventsBefore: page.before } : current);
  }
  async function mutate(path: string, payload: unknown): Promise<Run> {
    if (!bootstrap) throw new Error('Дождитесь подключения к серверу.');
    const result = await request<{ run: Run }>(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': bootstrap.csrfToken }, body: JSON.stringify(payload) });
    if (selectedRef.current === result.run.id) setDetail(current => current?.run.id === result.run.id
      ? { ...current, run: result.run } : { run: result.run, events: [] });
    setBootstrap(current => current ? { ...current,
      runs: mergeSummaries([summary(result.run)], current.runs),
      totalRuns: current.runs.some(run => run.id === result.run.id) ? current.totalRuns : current.totalRuns + 1 } : current);
    return result.run;
  }
  async function create(input: CreateRunInput) { const run = await mutate('/api/runs', input); select(run.id); }
  const connectionsReady = bootstrap?.connections.filter(connection => connection.available).length || 0;
  const workspace = !bootstrap
    ? <div className="bootstrap-state">{error
        ? <><ErrorNote>{error}</ErrorNote><button className="secondary-button mt-4" onClick={() => void refresh()}><ArrowClockwise size={16} />{t('Повторить подключение')}</button></>
        : <><div className="skeleton skeleton-title" /><div className="skeleton skeleton-copy" /><div className="skeleton skeleton-composer" /><p className="text-sm text-muted mt-5">{t('Подключаем рабочее пространство…')}</p></>}</div>
    : location.view === 'flows'
      ? <FlowList request={request} csrfToken={bootstrap.csrfToken} open={id => goTo({ view: 'flow', flowId: id })} />
      : location.view === 'flow'
        ? <Suspense fallback={<div className="flows-list"><h1 id="workspace-heading" tabIndex={-1}>{t('Загружаем канвас…')}</h1></div>}><FlowCanvas key={location.flowId} id={location.flowId} request={request} csrfToken={bootstrap.csrfToken} back={() => goTo({ view: 'flows' })} /></Suspense>
    : location.view === 'history'
      ? <HistoryView runs={bootstrap.runs} totalRuns={bootstrap.totalRuns} hasMore={!!bootstrap.nextCursor}
          loading={loadingHistory} loadMore={() => void loadOlderRuns()} select={id => select(id)} />
      : location.view === 'missing'
        ? <main className="main-content history-content"><h1 id="workspace-heading" tabIndex={-1}>{t('Страница не найдена')}</h1>
            <button className="secondary-button" onClick={() => goTo({ view: 'history' })}>{t('Открыть историю')}</button></main>
        : selectedId
          ? detail?.run.id === selectedId
            ? <RunWorkspace key={detail.run.id} detail={detail} mutate={mutate} loadOlderEvents={loadOlderEvents}
                tabOverride={location.view === 'run' ? location.tab : undefined}
                onTabChange={tab => navigate({ view: 'run', runId: selectedId, tab })} />
            : <div className="bootstrap-state">{detailError
                ? <><ErrorNote>{detailError}</ErrorNote><button className="secondary-button mt-4" onClick={() => {
                    const id = selectedId;
                    setDetailError('');
                    request<RunDetail>(`/api/runs/${encodeURIComponent(id)}`).then(incoming => {
                      if (selectedRef.current === id) setDetail(current => mergeDetail(current, incoming));
                    }).catch(cause => { if (selectedRef.current === id) setDetailError(cause instanceof Error ? cause.message : 'Не удалось загрузить задачу.'); });
                  }}><ArrowClockwise size={15} />{t('Повторить')}</button>
                  <button className="secondary-button mt-4" onClick={() => goTo({ view: 'history' })}>{t('Открыть историю')}</button></>
                : <><div className="skeleton skeleton-title" /><div className="skeleton skeleton-composer" /><p className="text-sm text-muted mt-4">{t('Загружаем задачу…')}</p></>}</div>
          : <Composer connections={bootstrap.connections} onCreate={create} openSettings={() => setSettings(true)} loadModels={loadModels} />;
  return <div className="app-shell" onKeyDown={event => { if (event.key === 'Escape') setSidebarOpen(false); }}>
    <a className="skip-link" href="#workspace-heading" onClick={event => { const heading = document.getElementById('workspace-heading'); if (heading) { event.preventDefault(); heading.focus(); } }}>{t('Перейти к рабочей области')}</a>
    <dialog ref={historyDialog} id="run-navigation" className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label={t('История запусков')} onCancel={() => setSidebarOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX > bounds.right || event.clientX < bounds.left) setSidebarOpen(false); } }}>
      <button className="icon-button history-close" aria-label={t('Закрыть историю')} onClick={() => setSidebarOpen(false)}><X size={18} /></button>
      <button className="brand" onClick={() => select(null)} aria-label={t('Power Agents — новая задача')}><span className="brand-bolt" aria-hidden="true" /><span>POWER AGENTS</span></button>
      <button className="new-task-button" onClick={() => select(null)}><Plus size={17} />{t('Новая задача')}<ArrowUpRight size={15} className="ml-auto opacity-50" /></button>
      <div className="sidebar-section-title"><span>{t('РАБОЧЕЕ ПРОСТРАНСТВО')}</span><SidebarSimple size={15} /></div>
      <button className={`sidebar-nav ${location.view === 'history' ? 'is-active' : ''}`} onClick={() => goTo({ view: 'history' })}><FolderSimple size={18} /><span>{t('Все задачи')}</span><span className="sidebar-count">{bootstrap?.totalRuns || 0}</span></button>
      <button className={`sidebar-nav ${location.view === 'flows' || location.view === 'flow' ? 'is-active' : ''}`} onClick={() => goTo({ view: 'flows' })}><FolderSimple size={18} /><span>{t('Потоки')}</span></button>
      <div className="sidebar-section-title mt-7"><span>{t('ИСТОРИЯ ЗАПУСКОВ')}</span></div>
      <nav className="run-history" aria-label={t('История запусков')}>{bootstrap?.runs.length ? <>{bootstrap.runs.map(run => <button key={run.id} className={`history-item ${selectedId === run.id ? 'is-selected' : ''}`} aria-current={selectedId === run.id ? 'page' : undefined} onClick={() => select(run.id)}><span className={`history-dot history-${run.status}`} /><span className="min-w-0 flex-1"><span className="history-title">{run.title}</span><span className="history-meta">{run.mode === 'demo' ? t('Демо · ') : ''}{t(statusLabels[run.status])}<span>{dateLabel(run.createdAt)}</span></span></span></button>)}{bootstrap.nextCursor && <button className="history-item" disabled={loadingHistory} onClick={() => void loadOlderRuns()}>{loadingHistory ? t('Загружаем…') : t('Показать более ранние запуски')}</button>}</> : <div className="history-empty"><p>{t('Пока чистый лист')}</p><span>{t('Ваши задачи и результаты')}<br />{t('будут сохраняться здесь.')}</span></div>}</nav>
      <div className="sidebar-bottom"><button className="connection-button" onClick={() => { setSidebarOpen(false); setSettings(true); }}><PlugsConnected size={19} /><span>{t('Подключения')}<small>{bootstrap ? t('{ready} из {total} доступны', { ready: connectionsReady, total: bootstrap.connections.length }) : t('Проверяем окружение')}</small></span><CaretRight size={13} /></button><div className="local-status"><span className={`connection-dot ${streamStatus === 'connected' ? 'is-connected' : ''}`} /><span>{streamStatus === 'connected' ? t('Локальное пространство') : streamStatus === 'disconnected' ? t('Переподключение…') : t('Подключаемся…')}</span><span className="ml-auto">v0.1</span></div></div>
    </dialog>
    <div className="app-main"><header className="topbar">
      <button className="header-brand" onClick={() => select(null)} aria-label={t('Power Agents — новая задача')}><span className="brand-bolt" aria-hidden="true" /><span>POWER AGENTS</span></button>
      <nav className="header-nav" aria-label={t('Разделы пространства')}>
        <button className={!sidebarOpen ? 'is-active' : ''} onClick={() => setSidebarOpen(false)}>{t('Пространство')}</button>
        <button aria-expanded={sidebarOpen} aria-controls="run-navigation" onClick={() => setSidebarOpen(value => !value)}><List size={17} />{t('Запуски')}</button>
        <button className={location.view === 'flows' || location.view === 'flow' ? 'is-active' : ''} onClick={() => goTo({ view: 'flows' })}>{t('Потоки')}</button>
        <button onClick={() => setSettings(true)}><PlugsConnected size={17} />{t('Подключения')}<span className={`connection-dot ${streamStatus === 'connected' ? 'is-connected' : ''}`} aria-label={streamStatus === 'connected' ? t('Сервер подключён') : t('Нет потока событий')} /></button>
      </nav>
      <LanguageToggle />
      <button className="primary-button header-new-task" onClick={() => select(null)}><Plus size={17} /><span>{t('Новая задача')}</span></button>
    </header>
      {location.view !== 'flows' && location.view !== 'flow' && <CityBackdrop initiallyCollapsed />}
      {bootstrap && error && <div className="px-8 pt-4"><ErrorNote>{error}</ErrorNote></div>}
      {workspace}
    </div>
    <Settings open={settings} bootstrap={bootstrap} close={() => setSettings(false)} refresh={refresh} request={request} />
  </div>;
}
function Settings({ open, bootstrap, close, refresh, request }: { open: boolean; bootstrap: Bootstrap | null; close: () => void; refresh: () => Promise<void>; request: <T>(path: string, options?: RequestInit) => Promise<T> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  return <dialog ref={dialog} className="settings-dialog" onCancel={close} onClick={event => { if (event.target === event.currentTarget) close(); }} aria-labelledby="settings-title"><div className="settings-inner"><div className="flex items-start justify-between gap-4"><div><span className="eyebrow">{t('ОКРУЖЕНИЕ')}</span><h2 id="settings-title">{t('Подключения')}</h2></div><button className="icon-button" aria-label={t('Закрыть подключения')} onClick={close}><X size={19} /></button></div><p className="settings-intro">{t('Используйте установленный CLI или API-подключение. Команда запускается на вашем компьютере.')}</p><div className="connection-list">{bootstrap?.connections.map(connection => <div className="connection-row" key={connection.id}><div className="flex items-center justify-between gap-3"><h3>{connection.name}</h3><span className={`connection-availability ${connection.available ? 'available' : ''}`}>{connection.available && <Check size={12} />}{connection.available ? t('Обнаружено') : t('Не настроено')}</span></div><p>{uiMessage(connection.detail)}</p>{connection.executable && <code>{connection.executable}</code>}</div>)}</div>{bootstrap && <TelegramSettings open={open} request={request} csrfToken={bootstrap.csrfToken} />}<div className="settings-note"><strong>{t('Перед первым запуском')}</strong><p>{t('Наличие CLI не подтверждает авторизацию: войдите в аккаунт через соответствующий CLI в терминале. Авторизация проверяется при первом обращении к модели. Для API задайте OPENAI_API_KEY или ANTHROPIC_API_KEY в окружении сервера и перезапустите приложение.')}</p><p>{t('API-запросы могут расходовать средства вашего провайдера. Пароли и ключи в этом интерфейсе не вводятся.')}</p></div><button className="secondary-button w-full" disabled={busy} onClick={async () => { setBusy(true); try { await refresh(); } finally { setBusy(false); } }}><ArrowClockwise size={16} />{busy ? t('Проверяем…') : t('Обновить статус')}</button></div></dialog>;
}
