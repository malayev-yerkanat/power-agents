import type { IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { teamTools, type TeamGrant, type TeamToolName } from './core/team.ts';

/** What the endpoint needs from the engine: who a token is, which tools it may see, and running one. */
export interface TeamApi {
  grant(token: string): TeamGrant | undefined;
  tools(grant: TeamGrant): TeamToolName[];
  call(token: string, name: TeamToolName, args: unknown): unknown;
}
const MAX_BODY = 256 * 1024;

function reply(res: ServerResponse, status: number, message: string): true {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ error: message }));
  return true;
}

/**
 * Team tools for CLI agents at POST /mcp. Only local CLIs may call it: any browser Origin or foreign Host is refused,
 * and the bearer token (one per turn) alone decides who the caller is.
 */
export function createMcpHandler(api: TeamApi): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  return async (req, res) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/mcp') return false;
    const host = req.headers.host;
    if (!host || !['127.0.0.1', 'localhost', '[::1]'].some(name => host === `${name}:${req.socket.localPort}`)) return reply(res, 403, 'Invalid local host');
    if (req.headers.origin !== undefined || req.headers['sec-fetch-site'] !== undefined) return reply(res, 403, 'Browser requests are not allowed');
    if (req.method !== 'POST') return reply(res, 405, 'Only POST is supported');
    const auth = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const grant = token ? api.grant(token) : undefined;
    if (!grant) return reply(res, 401, 'Unknown or expired team token');
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > MAX_BODY) return reply(res, 413, 'Request too large');
    }
    let body: unknown;
    try { body = raw ? JSON.parse(raw) : undefined; } catch { return reply(res, 400, 'Invalid JSON'); }
    const server = new McpServer({ name: 'power-agents-team', version: '1.0.0' });
    for (const name of api.tools(grant)) {
      server.registerTool(name, { description: teamTools[name].description, inputSchema: teamTools[name].schema }, async (args: unknown) => {
        try { return { content: [{ type: 'text' as const, text: JSON.stringify(api.call(token, name, args)) }] }; }
        catch (error) { return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Ошибка инструмента.' }] }; }
      });
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    return true;
  };
}
