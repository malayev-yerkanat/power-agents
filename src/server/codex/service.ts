import { join } from 'node:path';
import { Store } from '../store.ts';
import { TelegramService, isTelegramToken } from '../telegram.ts';
import { createCodexTelegramBridge } from './index.ts';

interface Bridge { start(): void; stop(): void; status(): string }
interface Factories {
  createStore(path: string): Store;
  createTelegram(store: Store, token: string): TelegramService;
  createBridge(telegram: TelegramService): Bridge;
}
export interface CodexTelegramStatus {
  enabled: boolean; configured: boolean; ready: boolean; connected: boolean; status: string;
  error?: string; username?: string; pending?: { expiresAt: string };
}
export interface CodexTelegramService {
  start(): void;
  stop(): Promise<void>;
  status(): CodexTelegramStatus;
  beginPairing(): { url: string; expiresAt: string };
}
interface Options {
  dataRoot: string; token?: string; existingToken?: string; enabled: boolean; factories?: Factories;
}

/** Isolated bot identity, pairing, polling offset, and database; never borrows Claude's token. */
export function createCodexTelegramService(options: Options): CodexTelegramService {
  const token = options.token?.trim();
  const existingToken = options.existingToken?.trim();
  const error = token && !isTelegramToken(token) ? 'CODEX_TELEGRAM_BOT_TOKEN has an invalid BotFather token format.'
    : token && existingToken && token.split(':')[0] === existingToken.split(':')[0]
      ? 'Codex requires a different bot from Claude.' : undefined;
  const configured = Boolean(token && !error);
  const factories: Factories = options.factories ?? {
    createStore: path => new Store(path),
    createTelegram: (store, value) => new TelegramService(store, value),
    createBridge: createCodexTelegramBridge,
  };
  let store: Store | undefined, telegram: TelegramService | undefined, bridge: Bridge | undefined;
  let initializationError: string | undefined;
  if (options.enabled && configured) {
    try {
      store = factories.createStore(join(options.dataRoot, 'codex-telegram.sqlite'));
      telegram = factories.createTelegram(store, token!);
      bridge = factories.createBridge(telegram);
    } catch {
      store?.close(); store = undefined; telegram = undefined; bridge = undefined;
      initializationError = 'Codex Telegram storage or bridge could not initialize.';
    }
  }
  let started = false, stopped = false, stopping: Promise<void> | undefined;
  const status = (): CodexTelegramStatus => {
    const current = stopped ? undefined : telegram?.status();
    const ready = Boolean(started && !stopped && current?.ready);
    const problem = error ?? initializationError ?? current?.error;
    return { enabled: options.enabled, configured, ready, connected: Boolean(current?.connected),
      status: !options.enabled ? 'Disabled' : stopped ? 'Stopped' : problem ? 'Unavailable'
        : !configured ? 'Set CODEX_TELEGRAM_BOT_TOKEN' : !ready ? 'Connecting to dedicated Codex bot'
          : !current?.connected ? 'Pair the dedicated Codex bot' : bridge!.status(),
      ...(problem ? { error: problem } : {}), ...(current?.username ? { username: current.username } : {}),
      ...(current?.pending ? { pending: current.pending } : {}),
    };
  };
  return {
    start() {
      if (started || stopped || !telegram || !bridge) return;
      started = true; telegram.start(); bridge.start();
    },
    stop() {
      if (stopping) return stopping;
      stopped = true;
      stopping = (async () => {
        try { bridge?.stop(); await telegram?.stop(); }
        finally { store?.close(); store = undefined; }
      })();
      return stopping;
    },
    status,
    beginPairing() {
      if (!status().ready || !telegram) throw new Error('Dedicated Codex Telegram bot is not ready');
      return telegram.beginPairing();
    },
  };
}
