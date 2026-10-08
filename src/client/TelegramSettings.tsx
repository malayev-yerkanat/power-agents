import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowSquareOut, Check, PaperPlaneTilt, SpinnerGap } from '@phosphor-icons/react';

export type TelegramNotifications = { approval: boolean; completed: boolean };
export type TelegramStatus = {
  configured: boolean;
  ready: boolean;
  connected: boolean;
  username?: string;
  error?: string;
  pending?: { expiresAt: string };
  notifications: TelegramNotifications;
};
type Requester = <T>(path: string, options?: RequestInit) => Promise<T>;
type TelegramAction = keyof TelegramNotifications;

export function safeTelegramPairUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 't.me' || url.port || url.username || url.password) return null;
    if (!/^\/[A-Za-z0-9_]{5,32}$/.test(url.pathname) || !url.searchParams.has('start')) return null;
    return url.toString();
  } catch { return null; }
}

export function createTelegramClient(request: Requester, csrfToken: string) {
  const mutation = (method: string, body?: unknown): RequestInit => ({
    method,
    headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: () => request<TelegramStatus>('/api/telegram/status'),
    pair: () => request<{ url: string; expiresAt: string }>('/api/telegram/pair', mutation('POST', {})),
    test: () => request<{ queued: true }>('/api/telegram/test', mutation('POST', {})),
    setNotifications: (preferences: Partial<TelegramNotifications>) => request<{ notifications: TelegramNotifications }>('/api/telegram/preferences', mutation('PATCH', preferences)),
    unpair: () => request<{ connected: false }>('/api/telegram/pairing', mutation('DELETE')),
  };
}

type ViewProps = {
  status: TelegramStatus;
  busy: boolean;
  error: string;
  message: string;
  pairUrl: string;
  onPair: () => Promise<void>;
  onTest: () => Promise<void>;
  onUnpair: () => Promise<void>;
  onToggle: (kind: TelegramAction, enabled: boolean) => Promise<void>;
};

export function TelegramSettingsView({ status, busy, error, message, pairUrl, onPair, onTest, onUnpair, onToggle }: ViewProps) {
  const link = safeTelegramPairUrl(pairUrl);
  return <section className="telegram-settings" aria-labelledby="telegram-settings-title">
    <div className="telegram-settings-heading"><div><span className="eyebrow">УВЕДОМЛЕНИЯ</span><h3 id="telegram-settings-title">Telegram</h3></div><span className={`connection-availability ${status.connected ? 'available' : ''}`}>{status.connected && <Check size={12} />}{status.connected ? 'Подключено' : status.configured ? 'Не подключено' : 'Не настроено'}</span></div>
    {status.configured && status.error && <p className="telegram-feedback telegram-feedback-error" role="alert">Не удалось подключиться к Telegram. Проверьте токен бота и доступ к сети. Уведомления могут задерживаться.</p>}
    {status.configured && !status.ready && !status.error && <p className="telegram-feedback" role="status">Подключаемся к Telegram…</p>}
    {!status.configured ? <p className="telegram-explainer">Создайте бота через BotFather и задайте TELEGRAM_BOT_TOKEN в окружении сервера, затем перезапустите приложение. Токен не вводится в браузере.</p> : status.connected ? <>
      <p className="telegram-explainer">Уведомления отправляются в привязанный личный чат{status.username ? ` через бота @${status.username.replace(/^@/, '')}` : ''}. Содержимое задачи в сообщениях не передаётся.</p>
      <div className="telegram-preferences">
        <label><span><strong>План готов</strong><small>Сообщить, когда план ожидает согласования.</small></span><input type="checkbox" checked={status.notifications.approval} disabled={busy} onChange={event => void onToggle('approval', event.target.checked)} /></label>
        <label><span><strong>Задача завершена</strong><small>Сообщить после завершения и проверки результата.</small></span><input type="checkbox" checked={status.notifications.completed} disabled={busy} onChange={event => void onToggle('completed', event.target.checked)} /></label>
      </div>
      <div className="telegram-actions"><button type="button" className="secondary-button" disabled={busy || !status.ready} onClick={() => void onTest()}><PaperPlaneTilt size={15} />Тестовое уведомление</button><button type="button" className="text-button" disabled={busy} onClick={() => void onUnpair()}>Отключить</button></div>
    </> : <>
      <p className="telegram-explainer">Создайте одноразовую ссылку и откройте её в Telegram. Отправьте боту команду Start, чтобы привязать личный чат.</p>
      <div className="telegram-actions"><button type="button" className="secondary-button" disabled={busy || !status.ready} onClick={() => void onPair()}>{busy ? <SpinnerGap size={15} /> : <PaperPlaneTilt size={15} />}{status.pending ? 'Создать новую ссылку' : 'Подключить Telegram'}</button>{link && <a className="telegram-pair-link" href={link} target="_blank" rel="noopener noreferrer">Открыть бота<ArrowSquareOut size={14} /></a>}</div>
      {status.pending && <p className="telegram-pending" role="status">Ожидаем команду Start в Telegram. Ссылка действует до {new Date(status.pending.expiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.</p>}
    </>}
    {error && <p className="telegram-feedback telegram-feedback-error" role="alert">{error}</p>}
    {message && <p className="telegram-feedback" role="status">{message}</p>}
  </section>;
}

export function TelegramSettings({ open, request, csrfToken }: { open: boolean; request: Requester; csrfToken: string }) {
  const client = useMemo(() => createTelegramClient(request, csrfToken), [request, csrfToken]);
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [pairUrl, setPairUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    try {
      const next = await client.status();
      setStatus(next);
      if (next.connected) setPairUrl('');
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось получить статус Telegram.'); }
  }, [client]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  useEffect(() => {
    if (!open || !status || (status.ready && (!status.pending || status.connected))) return;
    const timer = setInterval(() => { void load(); }, 3000);
    return () => clearInterval(timer);
  }, [open, status?.ready, status?.pending?.expiresAt, status?.connected, load]);
  const action = async (run: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await run(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось выполнить действие.'); }
    finally { setBusy(false); }
  };
  const pair = () => action(async () => {
    setPairUrl('');
    const result = await client.pair();
    const url = safeTelegramPairUrl(result.url);
    if (!url) throw new Error('Сервер вернул некорректную ссылку Telegram.');
    setPairUrl(url);
    setStatus(current => current ? { ...current, pending: { expiresAt: result.expiresAt } } : current);
  });
  const test = () => action(async () => { await client.test(); setMessage('Тестовое уведомление поставлено в очередь.'); });
  const unpair = () => action(async () => { await client.unpair(); setPairUrl(''); await load(); setMessage('Telegram отключён.'); });
  const toggle = (kind: TelegramAction, enabled: boolean) => action(async () => {
    const result = await client.setNotifications({ [kind]: enabled });
    setStatus(current => current ? { ...current, notifications: result.notifications } : current);
  });
  if (!open) return null;
  if (!status) return <section className="telegram-settings" aria-label="Telegram"><p className="telegram-explainer">Загружаем статус Telegram…</p>{error && <><p className="telegram-feedback telegram-feedback-error" role="alert">{error}</p><button type="button" className="text-button telegram-retry" onClick={() => void load()}>Повторить</button></>}</section>;
  return <TelegramSettingsView status={status} busy={busy} error={error} message={message} pairUrl={pairUrl} onPair={pair} onTest={test} onUnpair={unpair} onToggle={toggle} />;
}
