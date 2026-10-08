import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Store, TelegramPreferences } from './store.ts';

const botSchema = z.object({ ok: z.literal(true), result: z.object({
  id: z.union([z.number().int().safe(), z.string().regex(/^\d+$/)]),
  username: z.string().regex(/^[A-Za-z0-9_]{5,32}$/),
}) });
const updateSchema = z.object({
  update_id: z.number().int().safe().nonnegative(),
  message: z.object({
    text: z.string().optional(),
    from: z.object({ id: z.union([z.number().int().safe(), z.string().regex(/^\d+$/)]) }).optional(),
    chat: z.object({ id: z.union([z.number().int().safe(), z.string().regex(/^\d+$/)]), type: z.string() }),
  }).optional(),
});
const updatesSchema = z.object({ ok: z.literal(true), result: z.array(updateSchema).max(100) });
const retrySchema = z.object({ parameters: z.object({ retry_after: z.number().int().positive().max(3600) }).optional() }).passthrough();

interface TelegramOptions { fetcher?: typeof fetch; retryDelayMs?: number }
export interface TelegramStatus {
  configured: boolean; ready: boolean; connected: boolean; username?: string; pending?: { expiresAt: string };
  notifications: TelegramPreferences; error?: string;
}

function nonceHash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export function isTelegramToken(value: string): boolean {
  return /^\d{5,20}:[A-Za-z0-9_-]{20,100}$/.test(value);
}
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal?.aborted) { resolve(); return; }
    const timer = setTimeout(done, ms);
    function done(): void { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); }
    signal?.addEventListener('abort', done, { once: true });
  });
}

export class TelegramService {
  private readonly fetcher: typeof fetch;
  private readonly controller = new AbortController();
  private username?: string;
  private error?: string;
  private stopped = false;
  private deliveryTask?: Promise<void>;
  private activeSendController?: AbortController;
  private recipientChanges = 0;
  private recipientMutation = Promise.resolve();
  private lastSentAt = 0;
  private loops: Promise<void>[] = [];
  private readonly retryDelayMs: number;

  constructor(private readonly store: Store, private readonly token: string, options: TelegramOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.retryDelayMs = options.retryDelayMs ?? 3000;
  }

  status(): TelegramStatus {
    return { configured: true, ready: !!this.username && this.loops.length > 0 && !this.stopped
      && !this.error?.includes('polling conflicts'), connected: !!this.store.telegramRecipient(),
      ...(this.username ? { username: this.username } : {}),
      ...(this.store.telegramPendingPairing() ? { pending: this.store.telegramPendingPairing() } : {}),
      ...(this.error ? { error: this.error } : {}), notifications: this.store.telegramPreferences() };
  }

  async initialize(): Promise<void> {
    try {
      const response = await this.request('getMe', {});
      const parsed = botSchema.safeParse(response);
      if (!parsed.success) throw new Error('Telegram bot authentication failed. Check TELEGRAM_BOT_TOKEN.');
      this.store.bindTelegramBot(String(parsed.data.result.id));
      this.username = parsed.data.result.username;
      this.error = undefined;
    } catch {
      this.error = 'Telegram bot could not connect. Check the token and network.';
      throw new Error(this.error);
    }
  }

  beginPairing(nonce = randomBytes(32).toString('base64url')): { url: string; expiresAt: string } {
    if (!this.username) throw new Error('Telegram bot is not ready');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(nonce)) throw new Error('Invalid pairing code');
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    this.store.createTelegramPairing(nonceHash(nonce), expiresAt);
    return { url: `https://t.me/${this.username}?start=${nonce}`, expiresAt };
  }

  setPreferences(update: Partial<TelegramPreferences>): TelegramPreferences {
    return this.store.setTelegramPreferences(update);
  }

  async disconnect(): Promise<void> {
    await this.changeRecipient(() => { this.store.disconnectTelegram(); });
  }
  queueTest(): void { this.store.queueTelegramTest(); }

  async pollOnce(): Promise<void> {
    const response = await this.request('getUpdates', {
      offset: this.store.telegramOffset(), timeout: 25, allowed_updates: ['message'], limit: 100,
    });
    const parsed = updatesSchema.safeParse(response);
    if (!parsed.success) throw new Error('Telegram returned invalid updates');
    for (const update of parsed.data.result) {
      if (update.update_id < this.store.telegramOffset()) continue;
      const message = update.message;
      const match = message?.chat.type === 'private' && message.from
        && String(message.chat.id) === String(message.from.id)
        ? /^\/start(?:@[A-Za-z0-9_]+)? ([A-Za-z0-9_-]{1,64})$/.exec(message.text ?? '') : null;
      const hash = match ? nonceHash(match[1]) : undefined;
      if (hash && this.store.telegramCanConsumePairing(hash)) {
        await this.changeRecipient(() => {
          this.store.processTelegramUpdate(update.update_id, hash,
            String(message!.from!.id), String(message!.chat.id));
        });
      } else this.store.processTelegramUpdate(update.update_id);
    }
  }

  deliverOnce(): Promise<void> {
    if (this.deliveryTask) return this.deliveryTask;
    if (this.stopped || this.recipientChanges > 0) return Promise.resolve();
    const task = this.deliverOne();
    this.deliveryTask = task.finally(() => { this.deliveryTask = undefined; });
    return this.deliveryTask;
  }

  private async deliverOne(): Promise<void> {
    const message = this.store.telegramDueMessages()[0];
    if (!message) return;
    if (message.chatId !== this.store.telegramRecipient()) { this.store.telegramCancel(message.id); return; }
    const elapsed = Date.now() - this.lastSentAt;
    if (elapsed < 1000) await delay(1000 - elapsed, this.controller.signal);
    if (this.stopped || this.recipientChanges > 0 || message.chatId !== this.store.telegramRecipient()) return;
    let status: number;
    let body: unknown;
    const sendController = new AbortController();
    this.activeSendController = sendController;
    try {
      const response = await this.fetcher(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: message.chatId, text: message.text }),
        signal: AbortSignal.any([this.controller.signal, sendController.signal, AbortSignal.timeout(10_000)]),
      });
      status = response.status;
      body = await response.json();
    } catch {
      if (!this.stopped && this.recipientChanges === 0) this.reschedule(message.id, message.attempts + 1);
      return;
    } finally { this.activeSendController = undefined; }
    this.lastSentAt = Date.now();
    if (status === 200 && z.object({ ok: z.literal(true) }).safeParse(body).success) {
      this.store.telegramMarkSent(message.id);
    } else if (status === 403) {
      this.store.disconnectTelegram();
      this.error = 'Telegram bot was blocked or lost access. Pair the chat again.';
    } else if (status === 400) {
      this.store.telegramCancel(message.id);
      this.error = 'Telegram rejected a notification.';
    } else if (status === 429) {
      const retry = retrySchema.safeParse(body);
      this.reschedule(message.id, message.attempts + 1, retry.success ? retry.data.parameters?.retry_after : undefined);
    } else {
      this.reschedule(message.id, message.attempts + 1);
    }
  }

  start(): void {
    if (this.loops.length || this.stopped) return;
    this.loops = [this.runLoop()];
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.controller.abort();
    this.activeSendController?.abort();
    await Promise.allSettled(this.loops);
    if (this.deliveryTask) await Promise.allSettled([this.deliveryTask]);
  }

  private async runLoop(): Promise<void> {
    while (!this.stopped && !this.username) {
      try { await this.initialize(); }
      catch { await delay(this.retryDelayMs, this.controller.signal); }
    }
    if (this.stopped) return;
    await Promise.all([this.pollLoop(), this.deliveryLoop()]);
  }

  private async changeRecipient(change: () => void): Promise<void> {
    this.recipientChanges += 1;
    const mutation = this.recipientMutation.then(async () => {
      this.activeSendController?.abort();
      if (this.deliveryTask) await Promise.allSettled([this.deliveryTask]);
      change();
    });
    this.recipientMutation = mutation.catch(() => {});
    try { await mutation; }
    finally { this.recipientChanges -= 1; }
  }

  private async pollLoop(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.pollOnce();
        if (this.error?.startsWith('Telegram polling')) this.error = undefined;
      }
      catch (error) {
        if (!this.stopped) this.error = error instanceof Error && error.message.includes('HTTP 409')
          ? 'Telegram polling conflicts with an existing webhook or another poller.'
          : 'Telegram polling is unavailable. Retrying.';
        await delay(3000, this.controller.signal);
      }
    }
  }

  private async deliveryLoop(): Promise<void> {
    while (!this.stopped) {
      try { await this.deliverOnce(); }
      catch { if (!this.stopped) this.error = 'Telegram delivery is unavailable. Retrying.'; }
      await delay(1000, this.controller.signal);
    }
  }

  private reschedule(id: number, attempts: number, retryAfterSeconds?: number): void {
    const backoffMs = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));
    const wait = retryAfterSeconds ? retryAfterSeconds * 1000 : backoffMs + Math.random() * 500;
    this.store.telegramReschedule(id, attempts, new Date(Date.now() + wait).toISOString());
  }

  private async request(method: 'getMe' | 'getUpdates', body: object): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(method === 'getUpdates' ? 35_000 : 10_000)]),
      });
    } catch { throw new Error(`Telegram ${method} request failed`); }
    if (!response.ok) throw new Error(`Telegram ${method} returned HTTP ${response.status}`);
    try { return await response.json(); }
    catch { throw new Error(`Telegram ${method} returned invalid JSON`); }
  }
}
