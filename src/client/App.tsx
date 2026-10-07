import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowClockwise, ArrowUpRight, CaretRight, Check, Command, FolderSimple, List, PlugsConnected, Plus, SidebarSimple, X } from '@phosphor-icons/react';
import type { Bootstrap, CreateRunInput, Run, RunDetail, RunEvent } from '../shared/types';
import { Composer } from './Composer';
import { RunWorkspace } from './RunWorkspace';
import { api, createSessionRequest } from './session';
import { dateLabel, ErrorNote, statusLabels } from './ui';

export function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [settings, setSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [streamVersion, setStreamVersion] = useState(0);
  const streamRecoveryCount = useRef(0);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const fetchBootstrap = useCallback(() => api<Bootstrap>('/api/bootstrap'), []);
  const applyBootstrap = useCallback((data: Bootstrap) => { setBootstrap(data); setError(''); }, []);
  const loadBootstrap = useCallback(async (): Promise<Bootstrap> => {
    const data = await fetchBootstrap();
    applyBootstrap(data);
    return data;
  }, [fetchBootstrap, applyBootstrap]);
  const request = useMemo(() => createSessionRequest(loadBootstrap), [loadBootstrap]);
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
    const stream = new EventSource('/api/events');
    stream.onopen = () => {
      if (disposed) return;
      setStreamStatus('connected');
      stableTimer = setTimeout(() => { if (!disposed) streamRecoveryCount.current = 0; }, 30_000);
    };
    stream.onerror = () => {
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
          if (!disposed) {
            applyBootstrap(data);
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
          setDetail(current => current?.run.id === incoming.run.id && current.run.version > incoming.run.version ? current : incoming);
          setDetailError('');
        }
      }, 180);
    };
    stream.addEventListener('run', receive);
    return () => { disposed = true; if (timer) clearTimeout(timer); if (reconnectTimer) clearTimeout(reconnectTimer); if (stableTimer) clearTimeout(stableTimer); stream.removeEventListener('run', receive); stream.close(); };
  }, [!!bootstrap, applyBootstrap, fetchBootstrap, loadBootstrap, request, streamVersion]);
  useEffect(() => {
    setDetail(null); setDetailError('');
    if (!selectedId) return;
    const controller = new AbortController();
    request<RunDetail>(`/api/runs/${encodeURIComponent(selectedId)}`, { signal: controller.signal }).then(incoming => {
      if (!controller.signal.aborted) setDetail(current => current?.run.id === incoming.run.id && current.run.version > incoming.run.version ? current : incoming);
    }).catch(cause => { if (!controller.signal.aborted) setDetailError(cause instanceof Error ? cause.message : 'Не удалось загрузить задачу.'); });
    return () => controller.abort();
  }, [selectedId, request]);
  function select(id: string | null) { setSelectedId(id); setSidebarOpen(false); }
  async function mutate(path: string, payload: unknown): Promise<Run> {
    if (!bootstrap) throw new Error('Дождитесь подключения к серверу.');
    const result = await request<{ run: Run }>(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': bootstrap.csrfToken }, body: JSON.stringify(payload) });
    if (selectedRef.current === result.run.id) setDetail(current => ({ run: result.run, events: current?.events || [] }));
    setBootstrap(current => current ? { ...current, runs: [result.run, ...current.runs.filter(run => run.id !== result.run.id)] } : current);
    return result.run;
  }
  async function create(input: CreateRunInput) { const run = await mutate('/api/runs', input); select(run.id); }
  const connectionsReady = bootstrap?.connections.filter(connection => connection.available).length || 0;
  return <div className="app-shell" onKeyDown={event => { if (event.key === 'Escape') setSidebarOpen(false); }}>
    {sidebarOpen && <button className="sidebar-overlay" aria-label="Закрыть меню" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="Основная навигация">
      <button className="brand" onClick={() => select(null)} aria-label="Power Agents — новая задача"><span className="brand-mark"><Command size={23} weight="bold" /></span><span>power<span className="brand-light">agents</span><small>TEAM WORKSPACE</small></span></button>
      <button className="new-task-button" onClick={() => select(null)}><Plus size={17} />Новая задача<ArrowUpRight size={15} className="ml-auto opacity-50" /></button>
      <div className="sidebar-section-title"><span>РАБОЧЕЕ ПРОСТРАНСТВО</span><SidebarSimple size={15} /></div>
      <button className={`sidebar-nav ${!selectedId ? 'is-active' : ''}`} onClick={() => select(null)}><FolderSimple size={18} /><span>Все задачи</span><span className="sidebar-count">{bootstrap?.runs.length || 0}</span></button>
      <div className="sidebar-section-title mt-7"><span>ИСТОРИЯ ЗАПУСКОВ</span></div>
      <nav className="run-history" aria-label="История запусков">{bootstrap?.runs.length ? bootstrap.runs.map(run => <button key={run.id} className={`history-item ${selectedId === run.id ? 'is-selected' : ''}`} onClick={() => select(run.id)}><span className={`history-dot history-${run.status}`} /><span className="min-w-0 flex-1"><span className="history-title">{run.title}</span><span className="history-meta">{run.mode === 'demo' ? 'Демо · ' : ''}{statusLabels[run.status]}<span>{dateLabel(run.createdAt)}</span></span></span></button>) : <div className="history-empty"><p>Пока чистый лист</p><span>Ваши задачи и результаты<br />будут сохраняться здесь.</span></div>}</nav>
      <div className="sidebar-bottom"><button className="connection-button" onClick={() => setSettings(true)}><PlugsConnected size={19} /><span>Подключения<small>{bootstrap ? `${connectionsReady} из ${bootstrap.connections.length} доступны` : 'Проверяем окружение'}</small></span><CaretRight size={13} /></button><div className="local-status"><span className={`connection-dot ${streamStatus === 'connected' ? 'is-connected' : ''}`} /><span>{streamStatus === 'connected' ? 'Локальное пространство' : streamStatus === 'disconnected' ? 'Переподключение…' : 'Подключаемся…'}</span><span className="ml-auto">v0.1</span></div></div>
    </aside>
    <div className="app-main"><header className="topbar"><div className="flex min-w-0 items-center gap-3"><button className="icon-button mobile-menu" aria-label="Открыть меню" onClick={() => setSidebarOpen(true)}><List size={21} /></button><span className="text-muted">Рабочее пространство</span><CaretRight size={12} className="text-muted shrink-0" /><span className="truncate">{selectedId ? 'Командная задача' : 'Новая задача'}</span></div><button className="topbar-connection" onClick={() => setSettings(true)}><span className={`connection-dot ${connectionsReady ? 'is-connected' : ''}`} /><span>{connectionsReady} доступно</span><PlugsConnected size={15} /></button></header>
      {!bootstrap ? <div className="bootstrap-state">{error ? <><ErrorNote>{error}</ErrorNote><button className="secondary-button mt-4" onClick={() => void refresh()}><ArrowClockwise size={16} />Повторить подключение</button></> : <><div className="skeleton skeleton-title" /><div className="skeleton skeleton-copy" /><div className="skeleton skeleton-composer" /><p className="text-sm text-muted mt-5">Подключаем рабочее пространство…</p></>}</div> : <>{error && <div className="px-8 pt-4"><ErrorNote>{error}</ErrorNote></div>}{selectedId ? detail ? <RunWorkspace key={detail.run.id} detail={detail} mutate={mutate} /> : <div className="bootstrap-state">{detailError ? <><ErrorNote>{detailError}</ErrorNote><button className="secondary-button mt-4" onClick={() => { setDetailError(''); request<RunDetail>(`/api/runs/${encodeURIComponent(selectedId)}`).then(setDetail).catch(cause => setDetailError(String(cause))); }}><ArrowClockwise size={15} />Повторить</button></> : <><div className="skeleton skeleton-title" /><div className="skeleton skeleton-composer" /><p className="text-sm text-muted mt-4">Загружаем задачу…</p></>}</div> : <Composer connections={bootstrap.connections} onCreate={create} openSettings={() => setSettings(true)} />}</>}
    </div>
    <Settings open={settings} bootstrap={bootstrap} close={() => setSettings(false)} refresh={refresh} />
  </div>;
}
function Settings({ open, bootstrap, close, refresh }: { open: boolean; bootstrap: Bootstrap | null; close: () => void; refresh: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  return <dialog ref={dialog} className="settings-dialog" onCancel={close} onClick={event => { if (event.target === event.currentTarget) close(); }} aria-labelledby="settings-title"><div className="settings-inner"><div className="flex items-start justify-between gap-4"><div><span className="eyebrow">ОКРУЖЕНИЕ</span><h2 id="settings-title">Подключения</h2></div><button className="icon-button" aria-label="Закрыть подключения" onClick={close}><X size={19} /></button></div><p className="settings-intro">Используйте установленный CLI или API-подключение. Команда запускается на вашем компьютере.</p><div className="connection-list">{bootstrap?.connections.map(connection => <div className="connection-row" key={connection.id}><div className="flex items-center justify-between gap-3"><h3>{connection.name}</h3><span className={`connection-availability ${connection.available ? 'available' : ''}`}>{connection.available && <Check size={12} />}{connection.available ? 'Обнаружено' : 'Не настроено'}</span></div><p>{connection.detail}</p>{connection.executable && <code>{connection.executable}</code>}</div>)}</div><div className="settings-note"><strong>Перед первым запуском</strong><p>Наличие CLI не подтверждает авторизацию: войдите в аккаунт через соответствующий CLI в терминале. Авторизация проверяется при первом обращении к модели. Для API задайте OPENAI_API_KEY или ANTHROPIC_API_KEY в окружении сервера и перезапустите приложение.</p><p>API-запросы могут расходовать средства вашего провайдера. Пароли и ключи в этом интерфейсе не вводятся.</p></div><button className="secondary-button w-full" disabled={busy} onClick={async () => { setBusy(true); await refresh(); setBusy(false); }}><ArrowClockwise size={16} />{busy ? 'Проверяем…' : 'Обновить статус'}</button></div></dialog>;
}
