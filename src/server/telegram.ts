import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Store, TelegramPreferences } from './store.ts';

const botSchema = z.object({ ok: z.literal(true), result: z.object({
  id: z.union([z.number().int().safe(), z.string().regex(/^\d+$/)]),
  username: z.string().regex(/^[A-Za-z0-9_]{5,32}$/),
}) });
const idSchema = z.union([z.number().int().safe(), z.string().regex(/^\d+$/)]);
const updateSchema = z.object({
  update_id: z.number().int().safe().nonnegative(),
  callback_query: z.object({
    id: z.string().max(256), data: z.string().max(64).optional(), from: z.object({ id: idSchema }),
    message: z.object({ message_id: z.number().int().safe(), chat: z.object({ id: idSchema }) }).optional(),
  }).optional(),
  message: z.object({
    message_id: z.number().int().safe().optional(),
    reply_to_message: z.object({ message_id: z.number().int().safe() }).optional(),
    text: z.string().optional(),
    from: z.object({ id: z.union([z.number().int().safe(), z.string().regex(/^\d+$/)]) }).optional(),
    chat: z.object({ id: z.union([z.number().int().safe(), z.string().regex(/^\d+$/)]), type: z.string() }),
  }).optional(),
});
const updatesSchema = z.object({ ok: z.literal(true), result: z.array(updateSchema).max(100) });
const retrySchema = z.object({ parameters: z.object({ retry_after: z.number().int().positive().max(3600) }).optional() }).passthrough();

type Choice = number | string | undefined;
interface PendingChoice { resolve: (choice: Choice) => void; chatId: string; messageId?: number; text: string; options: { label: string; status: string }[]; session?: string; acceptText: boolean }
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
  private pollHealthy = false;
  private stopped = false;
  private deliveryTask?: Promise<void>;
  private activeSendController?: AbortController;
  private recipientChanges = 0;
  private recipientMutation = Promise.resolve();
  private lastSentAt = 0;
  private loops: Promise<void>[] = [];
  private readonly retryDelayMs: number;
  private readonly choices = new Map<string, PendingChoice>();

  constructor(private readonly store: Store, private readonly token: string, options: TelegramOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.retryDelayMs = options.retryDelayMs ?? 3000;
  }

  status(): TelegramStatus {
    return { configured: true, ready: !!this.username && this.loops.length > 0 && !this.stopped
      && this.pollHealthy, connected: !!this.store.telegramRecipient(),
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
      this.pollHealthy = false;
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

  async disconnect(): Promise<void> {
    await this.changeRecipient(() => { this.store.disconnectTelegram(); });
  }
  queueTest(): void { this.store.queueTelegramTest(); }

  async pollOnce(timeoutSeconds: 0 | 25 = 25): Promise<void> {
    const response = await this.request('getUpdates', {
      offset: this.store.telegramOffset(), timeout: timeoutSeconds, allowed_updates: ['message', 'callback_query'], limit: 100,
    });
    const parsed = updatesSchema.safeParse(response);
    if (!parsed.success) throw new Error('Telegram returned invalid updates');
    for (const update of parsed.data.result) {
      if (update.update_id < this.store.telegramOffset()) continue;
      if (update.callback_query) await this.answerChoice(update.callback_query);
      const message = update.message;
      if (message) await this.answerText(message);
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

  /** Sends text with Approve/Decline buttons; resolves true/false on a tap, undefined on timeout or abort. */
  async requestApproval(text: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean | undefined> {
    const choice = await this.requestChoice(text, [{ label: 'Approve', status: 'Approved.' }, { label: 'Decline', status: 'Declined.' }], timeoutMs, signal);
    return choice === undefined ? undefined : choice === 0;
  }

  /** Sends text with one button per option; resolves the tapped index, undefined on timeout, abort or cancel. */
  async requestChoice(text: string, options: { label: string; status: string }[], timeoutMs: number, signal?: AbortSignal, session?: string): Promise<number | undefined> {
    const choice = await this.requestPrompt(text, options, timeoutMs, signal, session, false);
    return typeof choice === 'number' ? choice : undefined;
  }

  /** Accepts a button or, with acceptText, an explicit private reply to this message; never unrelated chat text. */
  async requestInput(text: string, options: { label: string; description?: string }[], timeoutMs: number, signal?: AbortSignal, acceptText = true): Promise<string | undefined> {
    const choices = z.array(z.object({ label: z.string().min(1).max(1000).refine(label => label.trim().length > 0), description: z.string().optional() })).max(10).parse(options);
    const choice = await this.requestPrompt(text, choices.map(option => ({ label: option.label, status: 'Answer received.' })), timeoutMs, signal, undefined, acceptText);
    return typeof choice === 'number' ? choices[choice].label : choice;
  }

  private async requestPrompt(text: string, options: { label: string; status: string }[], timeoutMs: number, signal: AbortSignal | undefined, session: string | undefined, acceptText: boolean): Promise<Choice> {
    if (signal?.aborted || this.stopped) return undefined;
    z.string().min(1).max(3800).parse(text);
    z.number().int().positive().max(600_000).parse(timeoutMs);
    if (this.recipientChanges > 0) throw new Error('Telegram pairing is changing');
    if (this.choices.size >= 32) throw new Error('Too many pending Telegram requests');
    const chatId = this.store.telegramRecipient();
    if (!chatId) throw new Error('Pair a Telegram chat first');
    const id = randomBytes(12).toString('base64url');
    let pending!: PendingChoice;
    const answer = new Promise<Choice>(resolve => {
      pending = { resolve: choice => { this.choices.delete(id); resolve(choice); }, chatId, text, options, session, acceptText };
    });
    this.choices.set(id, pending);
    const timer = setTimeout(() => pending.resolve(undefined), timeoutMs);
    const abort = (): void => pending.resolve(undefined);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const sent = z.object({ ok: z.literal(true), result: z.object({ message_id: z.number().int().safe() }) })
        .safeParse(await this.request('sendMessage', { chat_id: chatId, text: acceptText ? `${text}\n\nTap an option or reply to this message.` : text,
          reply_markup: options.length ? { inline_keyboard: [
            options.map((option, index) => ({ text: option.label.slice(0, 64), callback_data: `${index}:${id}` })),
          ] } : { force_reply: true, selective: true } }));
      if (!sent.success) throw new Error('Telegram rejected the request');
      pending = { ...pending, messageId: sent.data.result.message_id };
      if (this.choices.has(id)) this.choices.set(id, pending);
      if (signal?.aborted) pending.resolve(undefined);
      const choice = await answer;
      if (choice === undefined) await this.closeChoice(pending, 'Answered on the Mac or expired.');
      return choice;
    } catch (error) {
      if (!this.choices.has(id)) return undefined;
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      this.choices.delete(id);
    }
  }

  /** Drops the open questions of one Claude Code session, e.g. once it was answered in the app. */
  cancelChoices(session: string): void {
    for (const pending of this.choices.values()) if (pending.session === session) pending.resolve(undefined);
  }

  private async answerChoice(query: NonNullable<z.infer<typeof updateSchema>['callback_query']>): Promise<void> {
    const match = /^(\d):([A-Za-z0-9_-]{16})$/.exec(query.data ?? '');
    const pending = match ? this.choices.get(match[2]) : undefined;
    const option = pending?.options[Number(match?.[1])];
    // Only the paired user, in the paired chat, on the message we sent, may decide.
    const authorized = !!option && String(query.from.id) === this.store.telegramUserId()
      && String(query.message?.chat.id) === pending!.chatId && pending!.chatId === this.store.telegramRecipient()
      && query.message?.message_id === pending!.messageId;
    // Remove and settle before network I/O: desktop cancellation and duplicate taps cannot race the acknowledgement.
    if (authorized) pending!.resolve(Number(match![1]));
    try { await this.request('answerCallbackQuery', { callback_query_id: query.id,
      text: authorized ? option.status : 'This request is no longer active' }); }
    catch { /* the decision still applies; the button spinner just times out */ }
    if (!authorized) return;
    await this.closeChoice(pending!, option.status);
  }

  private async answerText(message: NonNullable<z.infer<typeof updateSchema>['message']>): Promise<void> {
    const text = message.text?.trim();
    if (!text || text.length > 4000 || !message.reply_to_message || message.chat.type !== 'private'
      || String(message.from?.id) !== this.store.telegramUserId() || String(message.chat.id) !== this.store.telegramRecipient()) return;
    const pending = [...this.choices.values()].find(choice => choice.acceptText && choice.chatId === String(message.chat.id)
      && choice.messageId === message.reply_to_message!.message_id);
    if (!pending) return;
    pending.resolve(text);
    await this.closeChoice(pending, 'Answer received.');
  }

  private async closeChoice(pending: PendingChoice, status: string): Promise<void> {
    if (pending.messageId === undefined) return;
    try { await this.request('editMessageText', { chat_id: pending.chatId, message_id: pending.messageId, text: `${pending.text}\n\n${status}` }); }
    catch { /* buttons stay visible but a late tap gets "no longer active" */ }
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
    for (const pending of this.choices.values()) pending.resolve(undefined);
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
    for (const pending of this.choices.values()) pending.resolve(undefined);
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
        await this.pollOnce(this.pollHealthy ? 25 : 0);
        this.pollHealthy = true;
        if (this.error?.startsWith('Telegram polling')) this.error = undefined;
      }
      catch (error) {
        if (!this.stopped) {
          this.pollHealthy = false;
          this.error = error instanceof Error && /HTTP (401|403)/.test(error.message)
            ? 'Telegram polling authentication failed. Check TELEGRAM_BOT_TOKEN.'
            : error instanceof Error && error.message.includes('HTTP 409')
              ? 'Telegram polling conflicts with an existing webhook or another poller.'
              : 'Telegram polling is unavailable. Retrying.';
        }
        await delay(this.retryDelayMs, this.controller.signal);
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

  private async request(method: 'getMe' | 'getUpdates' | 'sendMessage' | 'answerCallbackQuery' | 'editMessageText', body: object): Promise<unknown> {
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
