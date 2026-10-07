import type { Connection, ModelCatalog, ModelOption } from '../../shared/types.js';
import { cliEnvironment } from './cli.js';
import { runProcess } from './process.js';

const timeoutMs = 15_000;
const cacheMs = 5 * 60_000;
const maxBytes = 2 * 1024 * 1024;
const maxModels = 500;
const modelIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/;

interface Dependencies {
  runCommand?: typeof runProcess;
  fetcher?: typeof fetch;
  now?: () => number;
}

function modelOption(id: unknown, name: unknown): ModelOption | undefined {
  if (typeof id !== 'string' || !modelIdPattern.test(id)) return undefined;
  const label = typeof name === 'string' ? name.trim() : '';
  if (label.length > 160 || /[\x00-\x1f\x7f]/.test(label)) return undefined;
  return { id, name: label || id };
}

function uniqueModels(models: ModelOption[]): ModelOption[] {
  if (models.length > maxModels) throw new Error('Too many models in provider response');
  return [...new Map(models.map(model => [model.id, model])).values()];
}

export function parseCodexModels(output: string): ModelOption[] {
  let parsed: unknown;
  try { parsed = JSON.parse(output); }
  catch { throw new Error('Invalid JSON model response'); }
  const models = parsed && typeof parsed === 'object' && 'models' in parsed ? parsed.models : undefined;
  if (!Array.isArray(models)) throw new Error('Missing models array');
  return uniqueModels(models.filter(value => value && typeof value === 'object' && value.visibility === 'list')
    .map(value => modelOption(value.slug, value.display_name)).filter((value): value is ModelOption => Boolean(value)));
}

export function parseAntigravityModels(output: string): ModelOption[] {
  const lines = output.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length || lines.length > maxModels) throw new Error('Invalid models list');
  const models = lines.map(line => {
    const columns = line.split('\t');
    if (columns.length !== 2) throw new Error('Invalid models list');
    const model = modelOption(columns[0], columns[1]);
    if (!model) throw new Error('Invalid models list');
    return model;
  });
  return uniqueModels(models);
}

export function parseApiModels(data: unknown): ModelOption[] {
  if (!data || typeof data !== 'object' || !('data' in data) || !Array.isArray(data.data)) {
    throw new Error('Missing data array');
  }
  return uniqueModels(data.data.map(value => value && typeof value === 'object'
    ? modelOption(value.id, value.display_name) : undefined)
    .filter((value): value is ModelOption => Boolean(value)));
}

async function boundedJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Model response is too large');
  if (!response.body) throw new Error('Empty model response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('Model response is too large'); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new Error('Invalid JSON model response'); }
}

async function apiModels(connection: Connection, fetcher: typeof fetch): Promise<ModelOption[]> {
  const openai = connection.kind === 'openai-api';
  const key = process.env[openai ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY']?.trim();
  if (!key) throw new Error('Missing provider key');
  const signal = AbortSignal.timeout(timeoutMs);
  const base = openai ? 'https://api.openai.com/v1/models' : 'https://api.anthropic.com/v1/models';
  const headers: Record<string, string> = openai ? { authorization: `Bearer ${key}` }
    : { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  let cursor: string | undefined;
  let all: ModelOption[] = [];
  for (let page = 0; page < 10; page += 1) {
    const url = cursor ? `${base}?after_id=${encodeURIComponent(cursor)}&limit=100` : `${base}${openai ? '' : '?limit=100'}`;
    const response = await fetcher(url, { headers, signal });
    if (!response.ok) throw new Error('Provider rejected model discovery');
    const data = await boundedJson(response);
    const models = parseApiModels(data);
    all = uniqueModels([...all, ...models]);
    if (openai || !data || typeof data !== 'object' || !('has_more' in data) || data.has_more !== true) return all;
    const lastId = 'last_id' in data ? data.last_id : undefined;
    if (typeof lastId !== 'string' || !modelIdPattern.test(lastId)) throw new Error('Invalid model cursor');
    cursor = lastId;
  }
  throw new Error('Model response has too many pages');
}

async function discover(connection: Connection, dependencies: Dependencies): Promise<ModelCatalog> {
  const base = { connectionId: connection.id, note: '' };
  if (!connection.available) {
    return { ...base, models: [], status: 'unavailable', note: 'Подключение недоступно. Настройте его и перезапустите приложение.' };
  }
  if (connection.kind === 'claude-cli') {
    return { ...base, models: [
      { id: 'sonnet', name: 'Claude Sonnet' }, { id: 'opus', name: 'Claude Opus' }, { id: 'haiku', name: 'Claude Haiku' },
    ], status: 'ready', note: 'Стандартные псевдонимы Claude CLI. Доступ в вашем аккаунте не проверен.' };
  }
  try {
    let models: ModelOption[];
    if (connection.kind === 'codex-cli' || connection.kind === 'gemini-cli') {
      if (!connection.executable) throw new Error('Missing executable');
      const args = connection.kind === 'codex-cli' ? ['debug', 'models'] : ['models'];
      const output = await (dependencies.runCommand ?? runProcess)(connection.executable, args, {
        cwd: process.cwd(), signal: AbortSignal.timeout(timeoutMs), timeoutMs,
        env: cliEnvironment(connection.kind),
      });
      models = connection.kind === 'codex-cli' ? parseCodexModels(output) : parseAntigravityModels(output);
    } else if (connection.kind === 'openai-api' || connection.kind === 'anthropic-api') {
      models = await apiModels(connection, dependencies.fetcher ?? fetch);
    } else throw new Error('Unsupported provider');
    if (!models.length) throw new Error('Empty model list');
    return { ...base, models, status: 'ready', note: '' };
  } catch {
    return { ...base, models: [], status: 'error', note: 'Не удалось загрузить модели. Проверьте подключение и повторите попытку.' };
  }
}

export function createModelCatalogLoader(dependencies: Dependencies = {}): (connection: Connection) => Promise<ModelCatalog> {
  const now = dependencies.now ?? Date.now;
  let cache: Record<string, { expiresAt: number; value: ModelCatalog }> = {};
  return async connection => {
    const cached = cache[connection.id];
    if (cached && cached.expiresAt > now()) return cached.value;
    const value = await discover(connection, dependencies);
    if (value.status === 'ready') {
      cache = { ...cache, [connection.id]: { expiresAt: now() + cacheMs, value } };
    }
    return value;
  };
}
