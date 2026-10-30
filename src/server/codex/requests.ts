import { basename } from 'node:path';
import { z } from 'zod';
import type { TelegramService } from '../telegram.ts';

const text = z.string().min(1).max(12_000);
const identity = { threadId: text, turnId: text, itemId: text };
const requestSchema = z.object({ id: z.union([text, z.number().int().safe()]), method: text, params: z.unknown() }).strict();
const approvalSchema = z.object({ ...identity, kind: z.literal('command').optional(), startedAtMs: z.number().optional(),
  approvalId: z.string().nullable().optional(), environmentId: z.string().nullable().optional(),
  command: text.nullable().optional(), cwd: text.nullable().optional(), reason: text.nullable().optional(),
  networkApprovalContext: z.object({ host: text, protocol: text }).strict().nullable().optional(),
  additionalPermissions: z.record(z.string(), z.unknown()).nullable().optional(),
  commandActions: z.array(z.unknown()).nullable().optional(),
  proposedExecpolicyAmendment: z.array(z.string()).nullable().optional(),
  proposedNetworkPolicyAmendments: z.array(z.unknown()).nullable().optional(),
  availableDecisions: z.array(z.union([z.enum(['accept', 'acceptForSession', 'decline', 'cancel']),
    z.record(z.string(), z.unknown())])).max(10).nullable().optional(),
}).strict().refine(p => Boolean(p.command || p.networkApprovalContext));
const questionSchema = z.object({ id: text, header: text, question: text, isSecret: z.literal(false),
  isOther: z.boolean().optional(), options: z.array(z.object({ label: z.string().min(1).max(1000), description: z.string().max(3000) })
    .strict()).max(10).nullable(), }).strict();
const inputSchema = z.object({ ...identity, questions: z.array(questionSchema).min(1).max(3),
  isBlocking: z.boolean().optional(), autoResolutionMs: z.number().int().nonnegative().nullable().optional(),
}).strict().refine(p => new Set(p.questions.map(q => q.id)).size === p.questions.length);
const specialPathSchema = z.union([
  z.object({ kind: z.enum(['root', 'minimal', 'tmpdir', 'slash_tmp']) }).strict(),
  z.object({ kind: z.literal('project_roots'), subpath: text.nullable() }).strict(),
]);
const filePathSchema = z.union([
  z.object({ type: z.literal('path'), path: text }).strict(),
  z.object({ type: z.literal('glob_pattern'), pattern: text }).strict(),
  z.object({ type: z.literal('special'), value: specialPathSchema }).strict(),
]);
const filePermissionsSchema = z.object({ read: z.array(text).max(32).nullable(), write: z.array(text).max(32).nullable(),
  globScanMaxDepth: z.number().int().nonnegative().optional(),
  entries: z.array(z.object({ path: filePathSchema, access: z.enum(['read', 'write', 'deny']) }).strict()).max(32).optional(),
}).strict();
const permissionsSchema = z.object({ ...identity, environmentId: text.nullable(), startedAtMs: z.number().int().nonnegative(),
  cwd: text, reason: text.nullable(), permissions: z.object({
    network: z.object({ enabled: z.boolean().nullable() }).strict().nullable(), fileSystem: filePermissionsSchema.nullable(),
  }).strict(),
}).strict();
const mcpPermissionSchema = z.object({ threadId: text, turnId: text, serverName: text, mode: z.literal('form'),
  message: text, requestedSchema: z.object({ type: z.literal('object'), properties: z.object({}).strict(),
    required: z.array(z.never()).optional(), additionalProperties: z.literal(false).optional(),
  }).strict(),
  _meta: z.object({ codex_approval_kind: z.literal('mcp_tool_call'), connector_name: text.optional(),
    tool_params: z.record(z.string(), z.unknown()).optional(), tool_params_display: z.array(z.unknown()).optional(),
  }).passthrough(),
}).strict();

interface Options {
  telegram: Pick<TelegramService, 'requestInput'>;
  respond: (threadId: string, requestId: string | number, method: string, params: Record<string, unknown>) => Promise<unknown>;
}
interface Prompt { text: string; options: { label: string }[]; id?: string }
interface Prepared { prompts: Prompt[]; method: string; decision?: Record<string, string>; permissions?: Record<string, unknown>; elicitation?: boolean; timeoutMs: number }
interface Pending { threadId: string; id: string | number; fingerprint: string; controller: AbortController; prepared?: Prepared }
const timeoutMs = 570_000;
const keyFor = (threadId: string, id: string | number) => JSON.stringify([threadId, typeof id, id]);

function prepareApproval(cwd: string, params: unknown): Prepared | undefined {
  const parsed = approvalSchema.safeParse(params);
  if (!parsed.success) return;
  const p = parsed.data;
  const allowed = p.availableDecisions ?? ['accept', 'decline'];
  const decisions = Object.fromEntries([
    ...(allowed.includes('accept') ? [['Approve once', 'accept']] : []),
    ...(allowed.includes('decline') ? [['Decline', 'decline']] : []),
  ]);
  if (!Object.keys(decisions).length) return;
  const details = [`🔐 Codex · ${basename(cwd)} · approval`, `Directory: ${p.cwd ?? cwd}`,
    ...(p.environmentId ? [`Environment: ${p.environmentId}`] : []),
    ...(p.command ? [`Command:\n${p.command}`] : []), ...(p.reason ? [`Reason:\n${p.reason}`] : []),
    ...(p.networkApprovalContext ? [`Network:\n${JSON.stringify(p.networkApprovalContext)}`] : []),
    ...(p.additionalPermissions ? [`Requested permissions:\n${JSON.stringify(p.additionalPermissions)}`] : []),
    'Approve once applies only to this request. You can also answer in the desktop app.'];
  const prompt = details.join('\n\n');
  if (prompt.length > 3800) return;
  return { prompts: [{ text: prompt, options: Object.keys(decisions).map(label => ({ label })) }],
    method: 'thread-follower-command-approval-decision', decision: decisions, timeoutMs };
}

function prepareQuestions(cwd: string, params: unknown): Prepared | undefined {
  const parsed = inputSchema.safeParse(params);
  if (!parsed.success) return;
  const p = parsed.data;
  if (p.autoResolutionMs === 0) return;
  const prompts = p.questions.map((q, index) => ({ id: q.id,
    text: [`❓ Codex · ${basename(cwd)} · ${index + 1}/${p.questions.length}`, q.header, q.question,
      ...(q.options ?? []).map((option, i) => `${i + 1}. ${option.label}\n${option.description}`),
      'Choose a button or reply to this Telegram message with your answer. You can also answer in the desktop app.'].join('\n\n'),
    options: (q.options ?? []).map(({ label }) => ({ label })),
  }));
  if (prompts.some(prompt => prompt.text.length > 3800)) return;
  return { prompts, method: 'thread-follower-submit-user-input', timeoutMs: Math.min(timeoutMs, p.autoResolutionMs ?? timeoutMs) };
}

function preparePermissions(cwd: string, params: unknown): Prepared | undefined {
  const parsed = permissionsSchema.safeParse(params);
  if (!parsed.success) return;
  const p = parsed.data;
  const permissions = { ...(p.permissions.network ? { network: p.permissions.network } : {}),
    ...(p.permissions.fileSystem ? { fileSystem: p.permissions.fileSystem } : {}) };
  const prompt = [`🔐 Codex · ${basename(cwd)} · permission request`, `Directory: ${p.cwd}`,
    ...(p.environmentId ? [`Environment: ${p.environmentId}`] : []), ...(p.reason ? [`Reason:\n${p.reason}`] : []),
    `Requested permissions:\n${JSON.stringify(permissions, null, 2)}`,
    'Approve once grants exactly these permissions for the current turn only. Decline grants nothing. You can also answer in the desktop app.',
  ].join('\n\n');
  if (prompt.length > 3800) return;
  return { prompts: [{ text: prompt, options: [{ label: 'Approve once' }, { label: 'Decline' }] }],
    decision: { 'Approve once': 'accept', Decline: 'decline' }, permissions,
    method: 'thread-follower-permissions-request-approval-response', timeoutMs };
}

function prepareMcpPermission(cwd: string, params: unknown): Prepared | undefined {
  const parsed = mcpPermissionSchema.safeParse(params);
  if (!parsed.success) return;
  const p = parsed.data;
  const prompt = [`🔐 Codex · ${basename(cwd)} · ${p._meta.connector_name ?? p.serverName}`,
    `Directory: ${cwd}`, p.message,
    ...(p._meta.tool_params ? [`Requested action:\n${JSON.stringify(p._meta.tool_params, null, 2)}`] : []),
    ...(p._meta.tool_params_display ? [`Details:\n${JSON.stringify(p._meta.tool_params_display, null, 2)}`] : []),
    'Approve once applies only to this request. You can also answer in the desktop app.',
  ].join('\n\n');
  if (prompt.length > 3800) return;
  // The request metadata may offer session/always grants; never echo those into a response.
  return { prompts: [{ text: prompt, options: [{ label: 'Approve once' }, { label: 'Decline' }] }],
    method: 'thread-follower-submit-mcp-server-elicitation-response', elicitation: true,
    decision: { 'Approve once': 'accept', Decline: 'decline' }, timeoutMs };
}

/** Reconciles only validated pending native requests; absence always cancels Telegram. */
export class CodexRequests {
  private readonly pending = new Map<string, Pending>();
  constructor(private readonly options: Options) {}

  sync(threadId: string, cwd: string, requests: unknown[]): void {
    if (requests.length > 32 || !threadId || !cwd) { this.cancel(threadId); return; }
    const next = new Map<string, Pending>();
    const duplicates = new Set<string>();
    for (const raw of requests) {
      const parsed = requestSchema.safeParse(raw);
      if (!parsed.success) continue;
      const r = parsed.data;
      const key = keyFor(threadId, r.id);
      if (next.has(key)) { duplicates.add(key); continue; }
      const fingerprint = JSON.stringify(r);
      if (fingerprint.length > 32_000 || !r.params || typeof r.params !== 'object'
        || !('threadId' in r.params) || r.params.threadId !== threadId) continue;
      const prepared = r.method === 'item/commandExecution/requestApproval' ? prepareApproval(cwd, r.params)
        : r.method === 'item/tool/requestUserInput' ? prepareQuestions(cwd, r.params)
        : r.method === 'item/permissions/requestApproval' ? preparePermissions(cwd, r.params)
        : r.method === 'mcpServer/elicitation/request' ? prepareMcpPermission(cwd, r.params) : undefined;
      next.set(key, { threadId, id: r.id, fingerprint, controller: new AbortController(), prepared });
    }
    for (const key of duplicates) next.delete(key);
    for (const [key, current] of this.pending) {
      if (current.threadId !== threadId) continue;
      if (next.get(key)?.fingerprint !== current.fingerprint) {
        this.pending.delete(key); current.controller.abort();
      }
    }
    for (const [key, current] of next) {
      if (this.pending.has(key) || this.pending.size >= 128) continue;
      this.pending.set(key, current);
      if (current.prepared) void this.ask(key, current).catch(() => {
        // Keep the failed request deduplicated; Desktop remains the authoritative fallback.
        current.controller.abort();
      });
    }
  }

  cancel(threadId?: string): void {
    for (const [key, current] of this.pending) {
      if (threadId !== undefined && current.threadId !== threadId) continue;
      this.pending.delete(key); current.controller.abort();
    }
  }

  private current(key: string, pending: Pending): boolean {
    return this.pending.get(key) === pending && !pending.controller.signal.aborted;
  }

  private async ask(key: string, pending: Pending): Promise<void> {
    const prepared = pending.prepared!;
    const deadline = Date.now() + prepared.timeoutMs;
    let answers: [string, { answers: string[] }][] = [];
    let decision: string | undefined;
    for (const prompt of prepared.prompts) {
      if (!this.current(key, pending) || Date.now() >= deadline) return;
      const answer = await this.options.telegram.requestInput(prompt.text, prompt.options,
        Math.max(1, deadline - Date.now()), pending.controller.signal);
      if (!this.current(key, pending) || !answer || Date.now() >= deadline) return;
      if (prepared.decision) {
        decision = Object.hasOwn(prepared.decision, answer) ? prepared.decision[answer] : undefined;
        if (!decision) return;
      } else answers = [...answers, [prompt.id!, { answers: [answer] }]];
    }
    if (!this.current(key, pending)) return;
    await this.options.respond(pending.threadId, pending.id, prepared.method, {
      conversationId: pending.threadId, requestId: pending.id,
      ...(prepared.elicitation ? { response: { action: decision, content: decision === 'accept' ? {} : null, _meta: null } }
        : prepared.permissions ? { response: { permissions: decision === 'accept' ? prepared.permissions : {}, scope: 'turn' } }
        : decision ? { decision } : { response: { answers: Object.fromEntries(answers) } }),
    });
  }
}
