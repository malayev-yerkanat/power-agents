import { basename, isAbsolute } from 'node:path';
import { z } from 'zod';
import type { TelegramService } from '../telegram.ts';

const identifier = z.string().min(1).max(300);
const turnSchema = z.object({ turnId: identifier.nullable().optional(), status: z.string(),
  items: z.array(z.unknown()).max(20_000).optional().default([]) });
const stateSchema = z.object({ id: identifier, turns: z.array(turnSchema).max(1000),
  turnHistory: z.object({ kind: z.string(), history: z.object({
    entitiesByKey: z.record(z.string(), z.unknown()),
    islands: z.array(z.object({ entries: z.array(z.object({ value: identifier })).max(10_000) })).max(1000),
  }).optional() }).optional(),
});
type Turn = z.infer<typeof turnSchema>;

function snapshotTurns(threadId: string, state: unknown): Map<string, Turn> | undefined {
  const parsed = stateSchema.safeParse(state);
  if (!parsed.success || parsed.data.id !== threadId) return;
  const { turns, turnHistory } = parsed.data;
  let canonical: Turn[] = [];
  if (turnHistory?.kind === 'canonical') {
    if (!turnHistory.history) return;
    const { islands, entitiesByKey } = turnHistory.history;
    const result = z.array(turnSchema).max(10_000).safeParse(
      islands.flatMap(island => island.entries.map(entry => entitiesByKey[entry.value])));
    if (!result.success) return;
    canonical = result.data;
  }
  const result = new Map<string, Turn>();
  for (const group of [canonical, turns]) {
    const seen = new Set<string>();
    for (const turn of group) {
      if (!turn.turnId || seen.has(turn.turnId)) return;
      seen.add(turn.turnId);
      const prior = result.get(turn.turnId);
      const priorStatus = prior?.status;
      // Conflicting terminal copies cannot establish a successful completion.
      const status = priorStatus && priorStatus !== 'inProgress' && turn.status !== 'inProgress' && priorStatus !== turn.status
        ? 'unknown' : priorStatus && priorStatus !== 'inProgress' ? priorStatus : turn.status;
      // A terminal canonical copy takes precedence over a stale active overlay.
      const items = priorStatus && priorStatus !== 'inProgress' && turn.status === 'inProgress'
        ? [...turn.items, ...prior!.items] : [...(prior?.items ?? []), ...turn.items];
      result.set(turn.turnId, { ...turn, status, items });
    }
  }
  return result;
}

const messageSchema = z.object({ type: z.literal('agentMessage'), text: z.string(),
  phase: z.string().nullable().optional() });

function summary(items: unknown[]): string {
  const messages = items.flatMap(item => {
    const parsed = messageSchema.safeParse(item);
    return parsed.success && parsed.data.text.trim() ? [parsed.data] : [];
  });
  const final = messages.findLast(item => item.phase === 'final_answer')
    ?? messages.findLast(item => item.phase == null);
  const text = final?.text.replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '').replace(/(\*\*|__|`)/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return 'Finished working. Open Codex Desktop to see the result.';
  const characters = Array.from(text);
  return characters.length <= 200 ? text : `${characters.slice(0, 199).join('').trimEnd()}…`;
}

/** Announces observed successful turns with a bounded excerpt of their final response. */
export class CodexCompletions {
  private readonly active = new Map<string, Set<string>>();
  constructor(private readonly telegram: Pick<TelegramService, 'queueCodexCompletion'>) {}

  sync(threadId: string, cwd: string, state: unknown): void {
    const turns = isAbsolute(cwd) ? snapshotTurns(threadId, state) : undefined;
    if (!turns) { this.cancel(threadId); return; }
    const previous = this.active.get(threadId);
    for (const [turnId, turn] of turns) {
      if (turn.status === 'completed' && previous?.has(turnId)) {
        const project = basename(cwd).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) || 'workspace';
        this.telegram.queueCodexCompletion(threadId, turnId,
          `✅ ${project} · done\n\n${summary(turn.items)}`);
      }
    }
    this.active.set(threadId, new Set([...turns].filter(([, turn]) => turn.status === 'inProgress').map(([id]) => id)));
  }

  cancel(threadId?: string): void {
    if (threadId === undefined) this.active.clear();
    else this.active.delete(threadId);
  }
}
