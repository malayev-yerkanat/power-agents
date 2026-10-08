import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import type { Connection, CreateRunInput, ModelCatalog, Run, RunEvent } from '../shared/types.ts';
import type { Store } from './store.ts';
import { createSchema as engineCreateSchema } from './core/protocol.ts';
import { createModelCatalogLoader } from './adapters/models.ts';
import type { TelegramService } from './telegram.ts';

interface EngineApi {
  create(input: CreateRunInput): Run | Promise<Run>;
  approve(id: string, version: number): Run | Promise<Run>;
  control(id: string, action: 'pause' | 'resume' | 'cancel'): Run | Promise<Run>;
  message(id: string, body: string): Run | Promise<Run>;
}
interface Options { store: Store; engine: EngineApi; connections: Connection[]; models?: (connection: Connection) => Promise<ModelCatalog>; telegram?: TelegramService; telegramError?: string }
class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) { super(message); this.statusCode = statusCode; }
}

const createSchema = engineCreateSchema.superRefine((value, ctx) => {
  const ids = new Set(value.members.map(member => member.id));
  if (ids.size !== value.members.length) ctx.addIssue({ code: 'custom', message: 'Member IDs must be unique' });
  if (!ids.has(value.leaderId)) ctx.addIssue({ code: 'custom', message: 'Leader must be a team member' });
});
const approveSchema = z.object({ version: z.number().int().nonnegative().safe() }).strict();
const controlSchema = z.object({ action: z.enum(['pause', 'resume', 'cancel']) }).strict();
const messageSchema = z.object({ body: z.string().trim().min(1).max(12_000) }).strict();
const telegramPreferencesSchema = z.object({ approval: z.boolean().optional(), completed: z.boolean().optional() }).strict()
  .refine(value => value.approval !== undefined || value.completed !== undefined, 'Select at least one notification preference');
const bodyLimit = 64 * 1024;
const cookieName = 'power_agents_session';

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function secureEqual(actual: string | undefined, expected: string): boolean {
  if (!actual || actual.length !== expected.length) return false;
  const bytes = Buffer.from(actual);
  const target = Buffer.from(expected);
  return bytes.length === target.length && timingSafeEqual(bytes, target);
}

function enforceLocalRequest(req: IncomingMessage): void {
  const host = req.headers.host;
  const allowedHosts = ['127.0.0.1', 'localhost', '[::1]'];
  if (!host || !allowedHosts.some(name => host === `${name}:${req.socket.localPort}`)) {
    throw new HttpError(403, 'Invalid local host');
  }
  if (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`) {
    throw new HttpError(403, 'Origin is not allowed');
  }
  if (req.headers['sec-fetch-site'] === 'cross-site' || req.headers['sec-fetch-site'] === 'same-site') {
    throw new HttpError(403, 'Cross-origin requests are not allowed');
  }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'Content-Type must be application/json');
  }
  if (Number(req.headers['content-length']) > bodyLimit) {
    req.resume();
    throw new HttpError(413, 'Request body exceeds 64 KB');
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    const cleanup = () => {
      req.off('data', data); req.off('end', end); req.off('error', error); req.off('aborted', aborted);
    };
    const error = (cause: Error) => { cleanup(); reject(cause); };
    const aborted = () => error(new HttpError(400, 'Request body was interrupted'));
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > bodyLimit) {
        cleanup(); req.resume(); reject(new HttpError(413, 'Request body exceeds 64 KB')); return;
      }
      chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'Request body must be valid JSON')); }
    };
    req.on('data', data); req.on('end', end); req.on('error', error); req.on('aborted', aborted);
  });
}

function eventStream(req: IncomingMessage, res: ServerResponse, store: Store, runId?: string): void {
  const url = new URL(req.url!, 'http://localhost');
  const rawCursor = url.searchParams.get('after') ?? req.headers['last-event-id'] ?? '0';
  if (typeof rawCursor !== 'string' || !/^\d+$/.test(rawCursor) || !Number.isSafeInteger(Number(rawCursor))) {
    throw new HttpError(400, 'Invalid event cursor');
  }
  if (runId && !store.getRun(runId)) throw new HttpError(404, 'Run not found');
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');
  const send = (event: RunEvent) => {
    if (runId && event.runId !== runId) return;
    if (res.destroyed || res.writableLength > 1024 * 1024) { res.destroy(); return; }
    res.write(`id: ${event.id}\nevent: run\ndata: ${JSON.stringify(event)}\n\n`);
  };
  if (runId) store.events(runId, Number(rawCursor)).forEach(send);
  else if (Number(rawCursor) > 0) {
    store.listRuns().flatMap(run => store.events(run.id, Number(rawCursor)))
      .sort((left, right) => left.id - right.id).forEach(send);
  }
  const unsubscribe = store.subscribe(send);
  const heartbeat = setInterval(() => { res.write(': heartbeat\n\n'); }, 15_000);
  heartbeat.unref();
  const cleanup = () => { clearInterval(heartbeat); unsubscribe(); };
  res.once('close', cleanup); res.once('error', cleanup);
}

function download(res: ServerResponse, store: Store, runId: string, artifactId: string): void {
  const artifact = store.getRun(runId)?.artifacts.find(value => value.id === artifactId);
  if (!artifact) throw new HttpError(404, 'Artifact not found');
  const filename = `artifact-${artifact.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}`;
  const unicodeName = encodeURIComponent(`${artifact.title.slice(0, 100)}.md`).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  res.writeHead(200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}.md"; filename*=UTF-8''${unicodeName}`,
  });
  res.end(artifact.body);
}

async function mutate(path: string[], body: unknown, { engine }: Options): Promise<Run> {
  if (path.length === 2) return engine.create(createSchema.parse(body));
  const id = path[2];
  if (path.length === 4 && path[3] === 'approve') return engine.approve(id, approveSchema.parse(body).version);
  if (path.length === 4 && path[3] === 'control') return engine.control(id, controlSchema.parse(body).action);
  if (path.length === 4 && path[3] === 'messages') return engine.message(id, messageSchema.parse(body).body);
  throw new HttpError(404, 'API endpoint not found');
}

function handleError(res: ServerResponse, error: unknown): void {
  if (res.headersSent) { res.destroy(); return; }
  if (error instanceof z.ZodError) { json(res, 400, { error: error.issues[0]?.message ?? 'Invalid request' }); return; }
  if (error instanceof HttpError) { json(res, error.statusCode, { error: error.message }); return; }
  const status = error instanceof Error && 'statusCode' in error ? Number(error.statusCode) : 500;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    json(res, status, { error: (error as Error).message }); return;
  }
  console.error('API request failed:', error);
  json(res, 500, { error: 'The request could not be completed' });
}

export function createApiHandler(options: Options): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  const session = randomBytes(32).toString('hex');
  const csrfToken = randomBytes(32).toString('hex');
  const models = options.models ?? createModelCatalogLoader();
  let windowStart = Date.now();
  let requestCount = 0;
  return async (req, res) => {
    if (!req.url?.startsWith('/api/') && req.url !== '/api') return false;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      enforceLocalRequest(req);
      if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); requestCount = 0; }
      if (++requestCount > 600) throw new HttpError(429, 'Too many requests; try again shortly');
      const url = new URL(req.url, 'http://localhost');
      let path: string[];
      try { path = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); }
      catch { throw new HttpError(400, 'Invalid URL encoding'); }
      if (req.method === 'GET' && url.pathname === '/api/health') { json(res, 200, { ok: true }); return true; }
      if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
        res.setHeader('Set-Cookie', `${cookieName}=${session}; Path=/api; HttpOnly; SameSite=Strict`);
        json(res, 200, { connections: options.connections, runs: options.store.listRuns(), csrfToken, maxConcurrent: 3 });
        return true;
      }
      const cookie = req.headers.cookie?.split(';').map(value => value.trim())
        .find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
      if (!secureEqual(cookie, session)) throw new HttpError(401, 'Open the application to start a session');
      if (req.method === 'GET') {
        if (url.pathname === '/api/events') eventStream(req, res, options.store);
        else if (url.pathname === '/api/telegram/status') json(res, 200, options.telegram?.status() ?? {
          configured: !!options.telegramError, ready: false, connected: false,
          ...(options.telegramError ? { error: options.telegramError } : {}),
          notifications: options.store.telegramPreferences(),
        });
        else if (path[1] === 'models' && path.length === 3) {
          const connection = options.connections.find(value => value.id === path[2]);
          if (!connection) throw new HttpError(404, 'Connection not found');
          json(res, 200, await models(connection));
        }
        else if (path[1] === 'runs' && path.length === 3) {
          const run = options.store.getRun(path[2]);
          if (!run) throw new HttpError(404, 'Run not found');
          json(res, 200, { run, events: options.store.events(run.id) });
        } else if (path[1] === 'runs' && path.length === 4 && path[3] === 'events') {
          eventStream(req, res, options.store, path[2]);
        } else if (path[1] === 'runs' && path.length === 5 && path[3] === 'artifacts') {
          download(res, options.store, path[2], path[4]);
        } else throw new HttpError(404, 'API endpoint not found');
      } else if (req.method === 'POST') {
        const token = req.headers['x-csrf-token'];
        if (typeof token !== 'string' || !secureEqual(token, csrfToken)) throw new HttpError(403, 'Invalid CSRF token');
        if (url.pathname === '/api/telegram/pair') {
          if (!options.telegram) throw new HttpError(503, 'Configure TELEGRAM_BOT_TOKEN to enable Telegram');
          if (!options.telegram.status().ready) throw new HttpError(503, 'Telegram bot is unavailable. Check the token and network.');
          z.object({}).strict().parse(await readBody(req));
          json(res, 200, options.telegram.beginPairing()); return true;
        }
        if (url.pathname === '/api/telegram/test') {
          if (!options.telegram) throw new HttpError(503, 'Telegram is not configured');
          if (!options.telegram.status().ready) throw new HttpError(503, 'Telegram bot is unavailable. Try again shortly.');
          z.object({}).strict().parse(await readBody(req));
          if (!options.store.telegramRecipient()) throw new HttpError(409, 'Pair a Telegram chat first');
          options.telegram.queueTest(); json(res, 200, { queued: true }); return true;
        }
        if (path[1] !== 'runs') throw new HttpError(404, 'API endpoint not found');
        const run = await mutate(path, await readBody(req), options);
        json(res, path.length === 2 ? 201 : 200, { run });
      } else if (req.method === 'PATCH' || req.method === 'DELETE') {
        const token = req.headers['x-csrf-token'];
        if (typeof token !== 'string' || !secureEqual(token, csrfToken)) throw new HttpError(403, 'Invalid CSRF token');
        if (req.method === 'PATCH' && url.pathname === '/api/telegram/preferences') {
          json(res, 200, { notifications: options.store.setTelegramPreferences(telegramPreferencesSchema.parse(await readBody(req))) });
        } else if (req.method === 'DELETE' && url.pathname === '/api/telegram/pairing') {
          if (options.telegram) await options.telegram.disconnect();
          else options.store.disconnectTelegram();
          json(res, 200, { connected: false });
        } else throw new HttpError(404, 'API endpoint not found');
      } else throw new HttpError(405, 'Method not allowed');
    } catch (error) { handleError(res, error); }
    return true;
  };
}
