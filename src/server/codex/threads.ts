import { DatabaseSync } from 'node:sqlite';

/** Discovery reads IDs only, never chat text, titles, credentials, or rollout files. */
export function desktopThreadIds(databasePath: string): string[] {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return db.prepare('SELECT id FROM threads WHERE archived = 0 AND attached_thread_parent_id IS NULL ORDER BY updated_at DESC LIMIT 100')
      .all().map(row => row.id).filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100);
  } finally { db.close(); }
}
