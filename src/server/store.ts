import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Run, RunEvent } from '../shared/types.ts';

type EventInput = Pick<RunEvent, 'type' | 'message' | 'actorId'>;
type Listener = (event: RunEvent) => void;
type EventRow = {
  id: number; run_id: string; type: string; message: string;
  actor_id: string | null; created_at: string;
};

export class Store {
  private readonly db: DatabaseSync;
  private readonly listeners = new Set<Listener>();
  private closed = false;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES runs(id),
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        actor_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_run_id ON events(run_id, id);
    `);
  }

  listRuns(): Run[] {
    return this.db.prepare('SELECT data FROM runs ORDER BY created_at DESC, rowid DESC')
      .all().map(row => JSON.parse(row.data as string) as Run);
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
      return JSON.parse(data) as Run;
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
      return JSON.parse(data) as Run;
    }, event);
  }

  events(runId: string, after = 0): RunEvent[] {
    return this.db.prepare(`
      SELECT id, run_id, type, message, actor_id, created_at
      FROM events WHERE run_id = ? AND id > ? ORDER BY id ASC
    `).all(runId, after).map(row => {
      const value = row as unknown as EventRow;
      return {
        id: value.id, runId: value.run_id, type: value.type, message: value.message,
        ...(value.actor_id === null ? {} : { actorId: value.actor_id }),
        createdAt: value.created_at,
      };
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  close(): void {
    if (this.closed) return;
    this.db.close();
    this.listeners.clear();
    this.closed = true;
  }

  private commitRun(write: () => Run, input: EventInput): Run {
    this.db.exec('BEGIN IMMEDIATE');
    let run: Run;
    let event: RunEvent;
    try {
      run = write();
      const createdAt = new Date().toISOString();
      const result = this.db.prepare(`
        INSERT INTO events (run_id, type, message, actor_id, created_at) VALUES (?, ?, ?, ?, ?)
      `).run(run.id, input.type, input.message, input.actorId ?? null, createdAt);
      event = { ...input, id: Number(result.lastInsertRowid), runId: run.id, createdAt };
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
}
