import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { EventHistoryPage, Run, RunEvent, RunSummaryPage } from '../shared/types.ts';
import type { Flow, FlowEvent, FlowSummary, NodeRun } from '../shared/flow-types.ts';

type EventInput = Pick<RunEvent, 'type' | 'message' | 'actorId'>;
type Listener = (event: RunEvent) => void;
type FlowListener = (event: FlowEvent) => void;
type EventRow = {
  id: number; run_id: string; type: string; message: string;
  actor_id: string | null; created_at: string;
};
export interface TelegramPreferences { approval: boolean; completed: boolean }
export interface TelegramOutboxMessage {
  id: number; kind: 'approval' | 'completed' | 'test'; runId?: string;
  runVersion?: number; chatId: string; text: string; attempts: number; nextAttemptAt: string;
}
type TelegramSettingsRow = {
  bot_id: string | null; chat_id: string | null; user_id: string | null;
  pair_hash: string | null; pair_expires_at: string | null;
  approval_enabled: number; completed_enabled: number; update_offset: number;
};
type TelegramMessageRow = {
  id: number; kind: TelegramOutboxMessage['kind']; run_id: string | null;
  run_version: number | null; chat_id: string; text: string; attempts: number;
  next_attempt_at: string;
};

export class Store {
  private readonly db: DatabaseSync;
  private readonly listeners = new Set<Listener>();
  private readonly flowListeners = new Set<FlowListener>();
  private closed = false;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    try { this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      PRAGMA locking_mode = EXCLUSIVE;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS runs_created ON runs(created_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS runs_status ON runs(json_extract(data, '$.status'));
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES runs(id),
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        actor_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_run_id ON events(run_id, id);
      CREATE TABLE IF NOT EXISTS telegram_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1), bot_id TEXT, chat_id TEXT, user_id TEXT,
        pair_hash TEXT, pair_expires_at TEXT, approval_enabled INTEGER NOT NULL DEFAULT 1,
        completed_enabled INTEGER NOT NULL DEFAULT 1, update_offset INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO telegram_settings (id) VALUES (1);
      CREATE TABLE IF NOT EXISTS telegram_outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL,
        run_id TEXT, run_version INTEGER, chat_id TEXT NOT NULL, text TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT NOT NULL, sent_at TEXT,
        UNIQUE (run_id, kind, run_version)
      );
      CREATE INDEX IF NOT EXISTS telegram_outbox_due ON telegram_outbox(state, next_attempt_at, id);
      CREATE TABLE IF NOT EXISTS flows (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS flows_created ON flows(created_at DESC, id DESC);
      CREATE TABLE IF NOT EXISTS node_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flow_id TEXT NOT NULL REFERENCES flows(id),
        node_id TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL,
        input_hash TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, error TEXT
      );
      CREATE INDEX IF NOT EXISTS node_runs_flow ON node_runs(flow_id, node_id, id);
    `); } catch (error) { this.db.close(); throw error; }
  }

  runSummaries(before?: string, limit = 30): RunSummaryPage {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid run page size');
    const cursor = before ? this.db.prepare('SELECT created_at FROM runs WHERE id = ?').get(before) : undefined;
    if (before && !cursor) throw new Error('Invalid run cursor');
    const rows = before ? this.db.prepare(`
      SELECT id, created_at, json_extract(data, '$.title') AS title,
        json_extract(data, '$.status') AS status, json_extract(data, '$.mode') AS mode,
        json_extract(data, '$.updatedAt') AS updated_at, json_extract(data, '$.version') AS version
      FROM runs WHERE created_at < ? OR (created_at = ? AND id < ?)
      ORDER BY created_at DESC, id DESC LIMIT ?
    `).all(cursor!.created_at, cursor!.created_at, before, limit + 1) : this.db.prepare(`
      SELECT id, created_at, json_extract(data, '$.title') AS title,
        json_extract(data, '$.status') AS status, json_extract(data, '$.mode') AS mode,
        json_extract(data, '$.updatedAt') AS updated_at, json_extract(data, '$.version') AS version
      FROM runs ORDER BY created_at DESC, id DESC LIMIT ?
    `).all(limit + 1);
    const visible = rows.slice(0, limit);
    return { totalRuns: Number(this.db.prepare('SELECT COUNT(*) AS count FROM runs').get()!.count),
    runs: visible.map(row => ({ id: row.id as string, title: row.title as string,
      status: row.status as Run['status'], mode: row.mode as Run['mode'],
      createdAt: row.created_at as string, updatedAt: row.updated_at as string,
      version: row.version as number })),
    ...(rows.length > limit ? { nextCursor: visible.at(-1)!.id as string } : {}) };
  }

  hasRun(id: string): boolean { return !!this.db.prepare('SELECT 1 FROM runs WHERE id = ?').get(id); }

  listActiveRuns(): Run[] {
    return this.db.prepare("SELECT data FROM runs WHERE json_extract(data, '$.status') IN ('planning', 'running') ORDER BY created_at DESC, id DESC")
      .all().map(row => JSON.parse(row.data as string) as Run);
  }

  hasActiveRun(exceptId?: string): boolean {
    return !!this.db.prepare("SELECT 1 FROM runs WHERE json_extract(data, '$.status') IN ('planning', 'running') AND (? IS NULL OR id != ?) LIMIT 1")
      .get(exceptId ?? null, exceptId ?? null);
  }

  getRun(id: string): Run | undefined {
    const row = this.db.prepare('SELECT data FROM runs WHERE id = ?').get(id);
    return row ? JSON.parse(row.data as string) as Run : undefined;
  }

  createRun(run: Run, event: EventInput): Run {
    return this.commitRun(() => {
      const data = JSON.stringify(run);
      this.db.prepare('INSERT INTO runs (id, created_at, data) VALUES (?, ?, ?)')
        .run(run.id, run.createdAt, data);
      return { run: JSON.parse(data) as Run };
    }, event);
  }

  updateRun(id: string, update: (run: Run) => Run, event: EventInput): Run {
    return this.commitRun(() => {
      const previous = this.getRun(id);
      if (!previous) throw new Error(`Run not found: ${id}`);
      const version = previous.version + 1;
      const previousTime = Date.parse(previous.updatedAt);
      const updatedAt = new Date(Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0))
        .toISOString();
      const next = update(previous);
      if (next.id !== id) throw new Error('A run ID cannot be changed');
      const data = JSON.stringify({ ...next, version, updatedAt });
      this.db.prepare('UPDATE runs SET data = ? WHERE id = ?').run(data, id);
      return { run: JSON.parse(data) as Run, previous };
    }, event);
  }

  eventBatch(runId: string | undefined, after: number, limit = 100): RunEvent[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 101) throw new Error('Invalid event page size');
    const rows = runId ? this.db.prepare(`SELECT id, run_id, type, message, actor_id, created_at FROM events
      WHERE run_id = ? AND id > ? ORDER BY id ASC LIMIT ?`).all(runId, after, limit)
      : this.db.prepare(`SELECT id, run_id, type, message, actor_id, created_at FROM events
      WHERE id > ? ORDER BY id ASC LIMIT ?`).all(after, limit);
    return rows.map(row => this.eventFromRow(row as unknown as EventRow));
  }

  latestEventId(): number {
    return Number(this.db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM events').get()!.id);
  }

  eventHistory(runId: string, before?: number, limit = 100): EventHistoryPage {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid event page size');
    const rows = before === undefined ? this.db.prepare(`SELECT id, run_id, type, message, actor_id, created_at FROM events
      WHERE run_id = ? ORDER BY id DESC LIMIT ?`).all(runId, limit + 1)
      : this.db.prepare(`SELECT id, run_id, type, message, actor_id, created_at FROM events
      WHERE run_id = ? AND id < ? ORDER BY id DESC LIMIT ?`).all(runId, before, limit + 1);
    const visible = rows.slice(0, limit).reverse().map(row => this.eventFromRow(row as unknown as EventRow));
    return { events: visible, ...(rows.length > limit ? { before: visible[0].id } : {}) };
  }

  private eventFromRow(value: EventRow): RunEvent {
    return { id: value.id, runId: value.run_id, type: value.type, message: value.message,
      ...(value.actor_id === null ? {} : { actorId: value.actor_id }), createdAt: value.created_at };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  telegramPreferences(): TelegramPreferences {
    const row = this.telegramSettings();
    return { approval: !!row.approval_enabled, completed: !!row.completed_enabled };
  }

  setTelegramPreferences(update: Partial<TelegramPreferences>): TelegramPreferences {
    const next = { ...this.telegramPreferences(), ...update };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE telegram_settings SET approval_enabled = ?, completed_enabled = ? WHERE id = 1')
        .run(Number(next.approval), Number(next.completed));
      if (!next.approval) this.db.prepare("UPDATE telegram_outbox SET state = 'cancelled' WHERE state = 'pending' AND kind = 'approval'").run();
      if (!next.completed) this.db.prepare("UPDATE telegram_outbox SET state = 'cancelled' WHERE state = 'pending' AND kind = 'completed'").run();
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return next;
  }

  telegramRecipient(): string | undefined { return this.telegramSettings().chat_id ?? undefined; }
  telegramUserId(): string | undefined { return this.telegramSettings().user_id ?? undefined; }
  telegramOffset(): number { return this.telegramSettings().update_offset; }
  telegramPendingPairing(): { expiresAt: string } | undefined {
    const row = this.telegramSettings();
    return row.pair_hash && row.pair_expires_at && Date.parse(row.pair_expires_at) > Date.now()
      ? { expiresAt: row.pair_expires_at } : undefined;
  }

  telegramCanConsumePairing(nonceHash: string): boolean {
    const row = this.telegramSettings();
    return row.pair_hash === nonceHash && !!row.pair_expires_at
      && Date.parse(row.pair_expires_at) > Date.now();
  }

  bindTelegramBot(botId: string): void {
    if (this.telegramSettings().bot_id === botId) return;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`UPDATE telegram_settings SET bot_id = ?, chat_id = NULL, user_id = NULL,
        pair_hash = NULL, pair_expires_at = NULL, update_offset = 0 WHERE id = 1`).run(botId);
      this.db.prepare("UPDATE telegram_outbox SET state = 'cancelled' WHERE state = 'pending'").run();
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  createTelegramPairing(nonceHash: string, expiresAt: string): void {
    this.db.prepare('UPDATE telegram_settings SET pair_hash = ?, pair_expires_at = ? WHERE id = 1')
      .run(nonceHash, expiresAt);
  }

  processTelegramUpdate(updateId?: number, nonceHash?: string, userId?: string, chatId?: string): boolean {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.telegramSettings();
      if (updateId !== undefined && updateId < row.update_offset) { this.db.exec('COMMIT'); return false; }
      let paired = false;
      if (nonceHash && userId && chatId && row.pair_hash === nonceHash
        && row.pair_expires_at && Date.parse(row.pair_expires_at) > Date.now()) {
        this.db.prepare(`UPDATE telegram_settings SET chat_id = ?, user_id = ?,
          pair_hash = NULL, pair_expires_at = NULL WHERE id = 1`).run(chatId, userId);
        this.db.prepare("UPDATE telegram_outbox SET state = 'cancelled' WHERE state = 'pending' AND chat_id != ?").run(chatId);
        paired = true;
      }
      if (updateId !== undefined) this.db.prepare('UPDATE telegram_settings SET update_offset = ? WHERE id = 1').run(updateId + 1);
      this.db.exec('COMMIT');
      return paired;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  disconnectTelegram(): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE telegram_settings SET chat_id = NULL, user_id = NULL, pair_hash = NULL, pair_expires_at = NULL WHERE id = 1').run();
      this.db.prepare("UPDATE telegram_outbox SET state = 'cancelled' WHERE state = 'pending'").run();
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  queueTelegramTest(): void {
    const chatId = this.telegramRecipient();
    if (!chatId) throw new Error('Telegram chat is not paired');
    this.db.prepare(`INSERT INTO telegram_outbox (kind, chat_id, text, next_attempt_at)
      VALUES ('test', ?, ?, ?)`).run(chatId, 'Power Agents: тестовое уведомление.', new Date().toISOString());
  }

  telegramDueMessages(now = new Date().toISOString()): TelegramOutboxMessage[] {
    return this.db.prepare(`SELECT id, kind, run_id, run_version, chat_id, text, attempts, next_attempt_at
      FROM telegram_outbox WHERE state = 'pending' AND next_attempt_at <= ? ORDER BY id`).all(now)
      .map(row => this.telegramMessage(row as unknown as TelegramMessageRow));
  }

  telegramAllMessages(): TelegramOutboxMessage[] {
    return this.db.prepare('SELECT id, kind, run_id, run_version, chat_id, text, attempts, next_attempt_at FROM telegram_outbox ORDER BY id')
      .all().map(row => this.telegramMessage(row as unknown as TelegramMessageRow));
  }

  telegramMarkSent(id: number): void {
    this.db.prepare("UPDATE telegram_outbox SET state = 'sent', sent_at = ? WHERE id = ? AND state = 'pending'")
      .run(new Date().toISOString(), id);
  }

  telegramReschedule(id: number, attempts: number, nextAttemptAt: string): void {
    this.db.prepare("UPDATE telegram_outbox SET attempts = ?, next_attempt_at = ? WHERE id = ? AND state = 'pending'")
      .run(attempts, nextAttemptAt, id);
  }

  telegramCancel(id: number): void {
    this.db.prepare("UPDATE telegram_outbox SET state = 'cancelled' WHERE id = ? AND state = 'pending'").run(id);
  }

  private telegramSettings(): TelegramSettingsRow {
    return this.db.prepare('SELECT * FROM telegram_settings WHERE id = 1').get() as unknown as TelegramSettingsRow;
  }

  private telegramMessage(row: TelegramMessageRow): TelegramOutboxMessage {
    return { id: row.id, kind: row.kind, ...(row.run_id ? { runId: row.run_id } : {}),
      ...(row.run_version === null ? {} : { runVersion: row.run_version }), chatId: row.chat_id,
      text: row.text, attempts: row.attempts, nextAttemptAt: row.next_attempt_at };
  }

  listFlows(): FlowSummary[] {
    return this.db.prepare(`SELECT id, created_at, json_extract(data, '$.title') AS title, json_extract(data, '$.template') AS template,
      json_extract(data, '$.mode') AS mode, json_extract(data, '$.updatedAt') AS updated_at, json_extract(data, '$.version') AS version
      FROM flows ORDER BY created_at DESC, id DESC LIMIT 200`).all().map(row => ({
      id: row.id as string, title: row.title as string, ...(row.template ? { template: row.template as string } : {}),
      mode: row.mode as Flow['mode'], createdAt: row.created_at as string, updatedAt: row.updated_at as string, version: row.version as number }));
  }

  getFlow(id: string): Flow | undefined {
    const row = this.db.prepare('SELECT data FROM flows WHERE id = ?').get(id);
    return row ? JSON.parse(row.data as string) as Flow : undefined;
  }

  unfinishedFlows(): Flow[] {
    return this.db.prepare(`SELECT data FROM flows WHERE EXISTS (
      SELECT 1 FROM json_each(flows.data, '$.nodes') WHERE json_extract(value, '$.status') IN ('queued', 'running')
    ) OR EXISTS (SELECT 1 FROM node_runs WHERE flow_id = flows.id AND status = 'running')`)
      .all().map(row => JSON.parse(row.data as string) as Flow);
  }

  interruptNodeRuns(flowId: string, error: string): void {
    this.db.prepare(`UPDATE node_runs SET status = 'failed', finished_at = ?, error = ? WHERE flow_id = ? AND status = 'running'`)
      .run(new Date().toISOString(), error, flowId);
  }

  createFlow(flow: Flow): Flow {
    this.db.prepare('INSERT INTO flows (id, created_at, data) VALUES (?, ?, ?)').run(flow.id, flow.createdAt, JSON.stringify(flow));
    this.emitFlow({ flowId: flow.id, type: 'flow.created', message: flow.title });
    return flow;
  }

  /** Read-modify-write in one transaction; `update` may throw to refuse the change. */
  updateFlow(id: string, update: (flow: Flow) => Flow, event: Omit<FlowEvent, 'flowId'>): Flow {
    this.db.exec('BEGIN IMMEDIATE');
    let next: Flow;
    try {
      const previous = this.getFlow(id);
      if (!previous) throw new Error(`Flow not found: ${id}`);
      const changed = update(structuredClone(previous));
      if (changed.id !== id) throw new Error('A flow ID cannot be changed');
      next = { ...changed, version: previous.version + 1, updatedAt: new Date().toISOString() };
      this.db.prepare('UPDATE flows SET data = ? WHERE id = ?').run(JSON.stringify(next), id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    this.emitFlow({ flowId: id, ...event });
    return next;
  }

  startNodeRun(flowId: string, nodeId: string, version: number, inputHash: string): number {
    return Number(this.db.prepare(`INSERT INTO node_runs (flow_id, node_id, version, status, input_hash, started_at)
      VALUES (?, ?, ?, 'running', ?, ?)`).run(flowId, nodeId, version, inputHash, new Date().toISOString()).lastInsertRowid);
  }

  finishNodeRun(id: number, error?: string): void {
    this.db.prepare('UPDATE node_runs SET status = ?, finished_at = ?, error = ? WHERE id = ?')
      .run(error === undefined ? 'done' : 'failed', new Date().toISOString(), error ?? null, id);
  }

  nodeRuns(flowId: string, limit = 100): NodeRun[] {
    return this.db.prepare(`SELECT id, flow_id, node_id, version, status, input_hash, started_at, finished_at, error
      FROM node_runs WHERE flow_id = ? ORDER BY id DESC LIMIT ?`).all(flowId, limit).map(row => ({
      id: row.id as number, flowId: row.flow_id as string, nodeId: row.node_id as string, version: row.version as number,
      status: row.status as NodeRun['status'], inputHash: row.input_hash as string, startedAt: row.started_at as string,
      ...(row.finished_at ? { finishedAt: row.finished_at as string } : {}), ...(row.error ? { error: row.error as string } : {}) }));
  }

  subscribeFlows(listener: FlowListener): () => void {
    this.flowListeners.add(listener);
    return () => { this.flowListeners.delete(listener); };
  }

  private emitFlow(event: FlowEvent): void {
    for (const listener of [...this.flowListeners]) {
      try { listener({ ...event }); }
      catch (error) { console.error('Flow event listener failed after commit:', error); }
    }
  }

  close(): void {
    if (this.closed) return;
    this.db.close();
    this.listeners.clear();
    this.flowListeners.clear();
    this.closed = true;
  }

  private commitRun(write: () => { run: Run; previous?: Run }, input: EventInput): Run {
    this.db.exec('BEGIN IMMEDIATE');
    let run: Run;
    let event: RunEvent;
    try {
      const written = write();
      run = written.run;
      const createdAt = new Date().toISOString();
      const result = this.db.prepare(`
        INSERT INTO events (run_id, type, message, actor_id, created_at) VALUES (?, ?, ?, ?, ?)
      `).run(run.id, input.type, input.message, input.actorId ?? null, createdAt);
      event = { ...input, id: Number(result.lastInsertRowid), runId: run.id, createdAt };
      this.enqueueTelegramTransition(written.previous, run);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    for (const listener of [...this.listeners]) {
      try { listener({ ...event }); }
      catch (error) { console.error('Run event listener failed after commit:', error); }
    }
    return run;
  }

  private enqueueTelegramTransition(previous: Run | undefined, run: Run): void {
    if (!previous || previous.status === run.status) return;
    const settings = this.telegramSettings();
    if (!settings.chat_id) return;
    const kind = run.status === 'awaiting_approval' && settings.approval_enabled ? 'approval'
      : run.status === 'completed' && settings.completed_enabled ? 'completed' : undefined;
    if (!kind) return;
    const text = kind === 'approval'
      ? `Power Agents: план ожидает согласования.\nID работы: ${run.id}\nВерсия: ${run.version}`
      : `Power Agents: работа завершена.\nID работы: ${run.id}`;
    this.db.prepare(`INSERT OR IGNORE INTO telegram_outbox
      (kind, run_id, run_version, chat_id, text, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(kind, run.id, run.version, settings.chat_id, text, new Date().toISOString());
  }
}
