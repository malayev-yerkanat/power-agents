import { z } from 'zod';
import { DesktopIpc, type Message } from './ipc.ts';

interface RequestHandler { sync(threadId: string, cwd: string, requests: unknown[]): void; cancel(threadId?: string): void }
interface AsyncHandler { sync(threadId: string, cwd: string, state: unknown): void; cancel(threadId?: string): void }
interface Snapshot { id: string; cwd: string; requests: unknown[]; [key: string]: unknown }
type Ipc = Pick<DesktopIpc, 'connect' | 'close' | 'request' | 'follow'>;
interface Options {
  socketPath: string; threadIds: () => string[]; ready: () => boolean; requests: RequestHandler;
  asyncQuestions?: AsyncHandler;
  createIpc?: (receive: (message: Message) => void, close: () => void) => Ipc;
}
const stateEnvelope = z.object({ sourceClientId: z.string(), version: z.number(), params: z.object({
  hostId: z.literal('local'), conversationId: z.string(), change: z.object({ type: z.string() }).passthrough(),
}) });
const snapshotSchema = z.object({ type: z.literal('snapshot'), revision: z.number().int().nonnegative(),
  conversationState: z.object({ id: z.string(), cwd: z.string(), requests: z.array(z.unknown()).max(100) }).passthrough() });

/** Only mirrors owned local chats. Unknown protocol versions never dispatch decisions. */
export class CodexBridge {
  private ipc?: Ipc;
  private timer?: ReturnType<typeof setInterval>;
  private stopped = false;
  private busy = false;
  private wasReady = false;
  private readonly owners = new Map<string, string>();
  private readonly revisions = new Map<string, number>();
  private readonly blocked = new Set<string>();
  private readonly snapshots = new Map<string, Set<(state?: Snapshot) => void>>();
  private readonly refreshes = new Map<string, ReturnType<typeof setTimeout>>();
  private state = 'Waiting for Codex desktop';
  constructor(private readonly options: Options) {}

  status(): string { return this.state; }
  start(): void {
    void this.tick();
    this.timer = setInterval(() => { void this.tick(); }, 10_000);
    this.timer.unref();
  }
  stop(): void {
    this.stopped = true; clearInterval(this.timer);
    const ipc = this.ipc; this.disconnected(); ipc?.close();
  }
  disconnected(): void {
    this.cancel(); this.owners.clear(); this.revisions.clear(); this.blocked.clear(); this.ipc = undefined;
    for (const waits of this.snapshots.values()) for (const resolve of waits) resolve();
    this.snapshots.clear();
    for (const timer of this.refreshes.values()) clearTimeout(timer);
    this.refreshes.clear();
    this.state = 'Waiting for Codex desktop';
  }

  async tick(): Promise<void> {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      if (!this.options.ready()) { this.cancel(); this.wasReady = false; return; }
      if (!this.ipc) {
        const ipc = this.options.createIpc?.(m => this.receive(m), () => this.disconnected())
          ?? new DesktopIpc(this.options.socketPath, m => this.receive(m), () => this.disconnected());
        this.ipc = ipc;
        await ipc.connect();
        if (this.stopped) { ipc.close(); return; }
        this.state = 'Connected to Codex desktop';
      }
      const ipc = this.ipc;
      const ids = new Set(this.options.threadIds().slice(0, 100));
      for (const [id, owner] of this.owners) if (!ids.has(id)) {
        this.cancel(id); ipc.follow(id, owner, false); this.owners.delete(id); this.revisions.delete(id);
      }
      const discover = async (id: string): Promise<void> => {
        if (this.stopped || this.ipc !== ipc) return;
        const owner = this.owners.get(id);
        if (owner) { if (!this.wasReady && !this.blocked.has(id)) ipc.follow(id, owner); return; }
        try {
          const result = z.object({ owner: z.string().min(1) }).parse(await ipc.request('thread-owner-discovery', { hostId: 'local', conversationId: id }));
          if (this.stopped || this.ipc !== ipc) return;
          this.owners.set(id, result.owner); ipc.follow(id, result.owner);
        } catch { /* An unloaded chat has no owner; retry on the next discovery pass. */ }
      };
      const remaining = [...ids];
      for (let offset = 0; offset < remaining.length; offset += 8) {
        await Promise.all(remaining.slice(offset, offset + 8).map(discover));
      }
      this.wasReady = true;
    } catch {
      const ipc = this.ipc; this.disconnected(); ipc?.close();
    } finally { this.busy = false; }
  }

  async respond(threadId: string, _requestId: string | number, method: string, params: Record<string, unknown>): Promise<unknown> {
    const owner = this.owners.get(threadId);
    if (!owner || !this.ipc || this.blocked.has(threadId) || !this.options.ready()) throw new Error('Codex bridge unavailable');
    return this.ipc.request(method, params, owner);
  }

  freshSnapshot(threadId: string): Promise<Snapshot | undefined> {
    const owner = this.owners.get(threadId);
    if (!owner || !this.ipc || this.blocked.has(threadId)) return Promise.resolve(undefined);
    return new Promise(resolve => {
      const waits = this.snapshots.get(threadId) ?? new Set();
      const done = (state?: Snapshot) => { clearTimeout(timer); waits.delete(done); if (!waits.size) this.snapshots.delete(threadId); resolve(state); };
      const timer = setTimeout(() => done(), 3000);
      waits.add(done); this.snapshots.set(threadId, waits);
      this.ipc!.follow(threadId, owner);
    });
  }

  receive(message: Message): void {
    if (this.stopped) return;
    if (message.method === 'client-status-changed') {
      const parsed = z.object({ clientId: z.string(), status: z.literal('disconnected') }).safeParse(message.params);
      if (parsed.success) for (const [id, owner] of this.owners) if (owner === parsed.data.clientId) {
        this.cancel(id); this.owners.delete(id); this.revisions.delete(id);
        for (const resolve of [...(this.snapshots.get(id) ?? [])]) resolve();
      }
      return;
    }
    if (message.method === 'thread-stream-following-status-requested') {
      for (const [id, owner] of this.owners) if (!this.blocked.has(id)) this.ipc?.follow(id, owner);
      return;
    }
    if (message.method !== 'thread-stream-state-changed') return;
    const parsed = stateEnvelope.safeParse(message);
    if (!parsed.success) return;
    const { sourceClientId, version, params: { conversationId: id, change } } = parsed.data;
    if (this.owners.get(id) !== sourceClientId) return;
    if (version !== 11) {
      this.cancel(id); this.blocked.add(id); this.state = 'Codex desktop protocol changed; bridge paused'; return;
    }
    if (this.blocked.has(id) || !this.options.ready()) return;
    if (change.type === 'snapshot') this.snapshot(id, change);
    else if (change.type === 'patches') this.patches(id, sourceClientId, change);
    else { this.cancel(id); this.blocked.add(id); }
  }

  private snapshot(id: string, change: unknown): void {
    const result = snapshotSchema.safeParse(change);
    if (!result.success || result.data.conversationState.id !== id) { this.cancel(id); return; }
    const { revision, conversationState: state } = result.data;
    if (revision < (this.revisions.get(id) ?? -1)) return;
    this.revisions.set(id, revision);
    this.options.requests.sync(id, state.cwd, state.requests);
    this.options.asyncQuestions?.sync(id, state.cwd, state);
    for (const resolve of [...(this.snapshots.get(id) ?? [])]) resolve(state);
  }

  private patches(id: string, owner: string, change: Record<string, unknown>): void {
    const schema = z.object({ revision: z.number().int(), baseRevision: z.number().int(),
      patches: z.array(z.object({ path: z.array(z.union([z.string(), z.number()])) }).passthrough()).max(10000) });
    const parsed = schema.safeParse(change);
    if (!parsed.success) { this.cancel(id); this.ipc?.follow(id, owner); return; }
    const { revision, baseRevision, patches } = parsed.data;
    if (revision <= (this.revisions.get(id) ?? -1)) return;
    const lost = baseRevision !== this.revisions.get(id);
    this.revisions.set(id, revision);
    const requestChange = lost || patches.some(p => p.path.length === 0 || p.path[0] === 'requests');
    const questionChange = lost || patches.some(p => p.path.length === 0 || p.path[0] === 'steeringUserMessages'
      || (p.path[0] === 'turnHistory' && (!['text', 'aggregatedOutput', 'durationMs'].includes(String(p.path.at(-1)))
        || p.path.includes('questions')))
      || (p.path[0] === 'turns' && (p.path.length <= 2 || p.path.some(key => ['questions', 'status', 'turnId', 'content', 'input'].includes(String(key)))
        || (p.path[2] === 'items' && p.path.length <= 4))));
    if (requestChange) this.options.requests.cancel(id);
    if (lost) this.options.asyncQuestions?.cancel(id);
    if (requestChange) this.ipc?.follow(id, owner);
    else if (questionChange && !this.refreshes.has(id)) this.refreshes.set(id, setTimeout(() => {
      this.refreshes.delete(id);
      if (this.owners.get(id) === owner && !this.stopped) this.ipc?.follow(id, owner);
    }, 100));
  }

  private cancel(id?: string): void { this.options.requests.cancel(id); this.options.asyncQuestions?.cancel(id); }
}
