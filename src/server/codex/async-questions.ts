import { randomUUID } from 'node:crypto';
import { basename, isAbsolute } from 'node:path';
import { z } from 'zod';
import type { TelegramService } from '../telegram.ts';

const identifier = z.string().min(1).max(300);
const questionSchema = z.object({ title: z.string().min(1).max(3800),
  options: z.array(z.string().min(1).max(1000)).max(10).nullable().optional() }).strict();
const agentSchema = z.object({ type: z.literal('agentMessage'), id: identifier,
  questions: z.array(questionSchema).min(1).max(3) });
const itemSchema = z.object({ type: z.string(), id: identifier }).passthrough();
const turnSchema = z.object({
  turnId: identifier.nullable().optional(), status: z.string(), items: z.array(itemSchema).max(20_000),
});
const stateSchema = z.object({ id: identifier, turns: z.array(turnSchema).max(1000),
  turnHistory: z.object({ kind: z.string(), history: z.object({
    entitiesByKey: z.record(z.string(), z.unknown()),
    islands: z.array(z.object({ entries: z.array(z.object({ value: identifier })).max(10_000) })).max(1000),
  }).optional() }).optional(),
});
const replySchema = z.array(z.object({ questionItemId: z.string().max(1000),
  question: z.string().max(3800), answer: z.string().max(12_000) }).strict()).min(1).max(3);
const openTag = '<send_user_message_question_reply>';
const closeTag = '</send_user_message_question_reply>';
const timeoutMs = 570_000;

interface Options {
  telegram: Pick<TelegramService, 'requestInput'>;
  /** Must refresh state and verify expectedTurnId before sending; must never start a turn. */
  send: (threadId: string, method: string, params: Record<string, unknown>, expectedTurnId: string) => Promise<unknown>;
}
interface Pending {
  threadId: string; turnId: string; cwd: string; questionId: string; title: string; options: string[];
  fingerprint: string; controller: AbortController;
}

function parseReply(raw: string): z.infer<typeof replySchema> | undefined {
  const delimiter = '\n## My request:\n';
  const index = raw.lastIndexOf(delimiter);
  const text = (index < 0 ? raw : raw.slice(index + delimiter.length)).trim();
  if (!text.startsWith(openTag) || !text.endsWith(closeTag) || text.length > 50_000) return;
  try {
    const json: unknown = JSON.parse(text.slice(openTag.length, -closeTag.length));
    return replySchema.safeParse(Array.isArray(json) ? json : [json]).data;
  } catch { return; }
}

function answeredIds(items: z.infer<typeof itemSchema>[]): Set<string> {
  const result = new Set<string>();
  for (const item of items) {
    // Also suspend controls while the Desktop is submitting to avoid racing its answer.
    const inputs = item.type === 'userMessage' ? item.content : item.type === 'steeringUserMessage'
      && (item.status === 'accepted' || item.status === 'pending') ? item.input : undefined;
    if (!Array.isArray(inputs)) continue;
    const raw = inputs.flatMap(value => value?.type === 'text' && typeof value.text === 'string' ? [value.text] : []).join('\n').trim();
    for (const reply of parseReply(raw) ?? []) result.add(reply.questionItemId);
  }
  return result;
}

function collect(threadId: string, cwd: string, state: unknown): Pending[] {
  const parsed = stateSchema.safeParse(state);
  if (!parsed.success || parsed.data.id !== threadId || !isAbsolute(cwd)) return [];
  const turns = snapshotTurns(parsed.data);
  const active = turns.filter(turn => turn.status === 'inProgress');
  if (active.length !== 1 || !active[0].turnId) return [];
  const turn = active[0], answered = answeredIds(turn.items);
  const result: Pending[] = [], seen = new Set<string>();
  for (const raw of turn.items) {
    const item = agentSchema.safeParse(raw);
    if (!item.success) continue;
    for (const [index, q] of item.data.questions.entries()) {
      const questionId = JSON.stringify(['request_user_input_async', item.data.id, index]);
      if (seen.has(questionId)) return []; // Ambiguous duplicate item identity fails closed.
      seen.add(questionId);
      if (answered.has(questionId)) continue;
      const entry = { threadId, turnId: turn.turnId!, cwd, questionId, title: q.title, options: q.options ?? [] };
      result.push({ ...entry, fingerprint: JSON.stringify(entry), controller: new AbortController() });
    }
  }
  return result.length <= 32 ? result : [];
}

function snapshotTurns(state: z.infer<typeof stateSchema>): z.infer<typeof turnSchema>[] {
  if (state.turnHistory?.kind !== 'canonical') return state.turns;
  const history = state.turnHistory.history;
  if (!history) return [];
  const canonical = history.islands.flatMap(island => island.entries.map(entry => history.entitiesByKey[entry.value]));
  const parsed = z.array(turnSchema).max(10_000).safeParse(canonical);
  if (!parsed.success) return [];
  const result = new Map(parsed.data.map(turn => [turn.turnId, turn]));
  if (result.size !== parsed.data.length) return [];
  for (const overlay of state.turns) {
    const base = result.get(overlay.turnId);
    if (!base) { result.set(overlay.turnId, overlay); continue; }
    // Terminal state on either copy disables questions rather than reviving a stale prompt.
    const status = base.status === 'inProgress' ? overlay.status : base.status;
    const items = [...new Map([...base.items, ...overlay.items].map(item => [item.id, item])).values()];
    result.set(overlay.turnId, { ...base, ...overlay, status, items });
  }
  return [...result.values()];
}

/** Checks the fresh snapshot immediately before a response leaves the process. */
export function canSendAsyncAnswer(threadId: string, cwd: string, state: unknown,
  expectedTurnId: string, params: Record<string, unknown>): boolean {
  if (params.conversationId !== threadId || params.toolOutput !== undefined) return false;
  const input = z.array(z.object({ type: z.literal('text'), text: z.string().max(50_000),
    text_elements: z.array(z.unknown()).max(0).optional() }).strict()).length(1).safeParse(params.input);
  if (!input.success) return false;
  const replies = parseReply(input.data[0].text);
  if (!replies || new Set(replies.map(reply => reply.questionItemId)).size !== replies.length) return false;
  const current = collect(threadId, cwd, state);
  return replies.every(reply => reply.answer.trim().length > 0 && current.some(question =>
    question.turnId === expectedTurnId && question.questionId === reply.questionItemId && question.title === reply.question));
}

/** Mirrors only structured questions in an active Desktop turn; no transcript storage. */
export class CodexAsyncQuestions {
  private readonly pending = new Map<string, Pending>();
  constructor(private readonly options: Options) {}

  sync(threadId: string, cwd: string, conversationState: unknown): void {
    const next = new Map(collect(threadId, cwd, conversationState).map(p => [JSON.stringify([threadId, p.questionId]), p]));
    for (const [key, current] of this.pending) {
      if (current.threadId === threadId && next.get(key)?.fingerprint !== current.fingerprint) {
        this.pending.delete(key); current.controller.abort();
      }
    }
    for (const [key, pending] of next) {
      if (this.pending.has(key) || this.pending.size >= 128) continue;
      this.pending.set(key, pending);
      void this.ask(key, pending).catch(() => pending.controller.abort());
    }
  }

  cancel(threadId?: string): void {
    for (const [key, pending] of this.pending) {
      if (threadId !== undefined && pending.threadId !== threadId) continue;
      this.pending.delete(key); pending.controller.abort();
    }
  }

  private async ask(key: string, pending: Pending): Promise<void> {
    const text = [`❓ Codex · ${basename(pending.cwd)}`, pending.title,
      ...pending.options.map((label, index) => `${index + 1}. ${label}`),
      'Choose a button or reply to this message. You can also answer in the desktop app.'].join('\n\n');
    if (text.length > 3800) return;
    const deadline = Date.now() + timeoutMs;
    const answer = await this.options.telegram.requestInput(text, pending.options.map(label => ({ label })),
      timeoutMs, pending.controller.signal);
    if (this.pending.get(key) !== pending || pending.controller.signal.aborted || Date.now() >= deadline
      || !answer?.trim() || answer.length > 12_000) return;
    const prompt = `${openTag}\n${JSON.stringify([{ questionItemId: pending.questionId, question: pending.title, answer }])}\n${closeTag}`;
    const id = randomUUID();
    await this.options.send(pending.threadId, 'thread-follower-steer-turn', {
      conversationId: pending.threadId, clientUserMessageId: id,
      input: [{ type: 'text', text: prompt, text_elements: [] }], attachments: [],
      restoreMessage: { id, text: prompt, cwd: pending.cwd, createdAt: Date.now(), context: {
        prompt, addedFiles: [], fileAttachments: [], ideContext: null, imageAttachments: [], workspaceRoots: [pending.cwd],
      } },
    }, pending.turnId);
  }
}
