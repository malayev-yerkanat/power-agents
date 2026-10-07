import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { createServer as createViteServer } from 'vite';
import { Store } from './store.ts';
import { Engine } from './engine.ts';
import { discoverConnections } from './adapters/index.ts';
import { createApiHandler } from './http.ts';

const root = process.cwd();
const port = Number(process.env.PORT ?? 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer between 1024 and 65535.');
const dataRoot = resolve(root, '.power-agents');
const store = new Store(join(dataRoot, 'state.sqlite'));
const connections = await discoverConnections();
const engine = new Engine({ store, connections, workspaceRoot: join(dataRoot, 'workspaces') });
const api = createApiHandler({ store, engine, connections });
const production = process.env.NODE_ENV === 'production';
const server = createServer();
const vite = production ? undefined : await createViteServer({
  root, server: { middlewareMode: true, hmr: { server }, allowedHosts: ['localhost', '127.0.0.1'] }, appType: 'spa',
});
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
server.on('request', (req, res) => {
  void (async () => {
    if (await api(req, res)) return;
    if (vite) { vite.middlewares(req, res); return; }
    const dist = join(root, 'dist');
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(req.url ?? '/', `http://127.0.0.1:${port}`).pathname); }
    catch { res.writeHead(400).end(); return; }
    const candidate = resolve(dist, `.${pathname}`);
    if (!candidate.startsWith(`${dist}${sep}`) && candidate !== dist) { res.writeHead(403).end(); return; }
    const file = extname(candidate) ? candidate : join(dist, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end('Run npm run build first.'); return; }
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(readFileSync(file));
  })().catch(error => { console.error('Request failed:', error); if (!res.headersSent) res.writeHead(500); res.end('Request failed'); });
});
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.listen(port, '127.0.0.1', () => console.log(`Power Agents: http://127.0.0.1:${port}`));
server.on('error', error => { console.error(error.message); engine.shutdown(); store.close(); process.exitCode = 1; void vite?.close(); });
let stopping = false;
function stop(): void {
  if (stopping) return; stopping = true;
  engine.shutdown();
  void vite?.close();
  server.close();
  server.closeAllConnections();
  setTimeout(() => { store.close(); process.exit(0); }, 3000).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
