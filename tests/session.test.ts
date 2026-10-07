import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, api, createSessionRequest } from '../src/client/session.ts';

test('API helper only sends same-origin local API requests', async context => {
  const requests: Array<{ path: unknown; credentials: RequestCredentials | undefined }> = [];
  context.mock.method(globalThis, 'fetch', async (path: unknown, options?: RequestInit) => {
    requests.push({ path, credentials: options?.credentials });
    return Response.json({ ok: true });
  });

  await assert.rejects(api('https://other.example/api/runs'), /local API path/);
  await api('/api/health', { credentials: 'include' });

  assert.deepEqual(requests, [{ path: '/api/health', credentials: 'same-origin' }]);
});

test('recovers a stale session and retries a mutation with the new CSRF token', async () => {
  const tokens: string[] = [];
  let bootstrapCalls = 0;
  const send = async <T>(_path: string, options?: RequestInit): Promise<T> => {
    const token = new Headers(options?.headers).get('X-CSRF-Token') ?? '';
    tokens.push(token);
    if (token === 'old') throw new ApiError(401, 'Open the application to start a session');
    return { ok: true } as T;
  };
  const request = createSessionRequest(async () => {
    bootstrapCalls += 1;
    return { csrfToken: 'new' };
  }, send);

  const result = await request<{ ok: boolean }>('/api/runs', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'old' }, body: '{}',
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(tokens, ['old', 'new']);
  assert.equal(bootstrapCalls, 1);
});

test('concurrent stale requests share one session refresh', async () => {
  let bootstrapCalls = 0;
  const send = async <T>(_path: string, options?: RequestInit): Promise<T> => {
    if (new Headers(options?.headers).get('X-CSRF-Token') === 'old') throw new ApiError(401, 'stale');
    return { ok: true } as T;
  };
  const request = createSessionRequest(async () => {
    bootstrapCalls += 1;
    await new Promise(resolve => setTimeout(resolve, 10));
    return { csrfToken: 'new' };
  }, send);
  const options = { method: 'POST', headers: { 'X-CSRF-Token': 'old' } };

  await Promise.all([request('/api/runs/a/approve', options), request('/api/runs/b/control', options)]);
  assert.equal(bootstrapCalls, 1);
});

test('does not retry other errors or loop when the browser still cannot keep a session', async () => {
  let bootstrapCalls = 0;
  let requests = 0;
  const bootstrap = async () => { bootstrapCalls += 1; return { csrfToken: 'new' }; };
  const forbidden = createSessionRequest(bootstrap, async () => {
    requests += 1;
    throw new ApiError(403, 'Forbidden');
  });
  await assert.rejects(forbidden('/api/runs'), /Forbidden/);
  assert.equal(bootstrapCalls, 0);
  assert.equal(requests, 1);

  const denied = createSessionRequest(bootstrap, async () => {
    requests += 1;
    throw new ApiError(401, 'stale');
  });
  await assert.rejects(denied('/api/runs'), /локальную сессию/);
  assert.equal(bootstrapCalls, 1);
  assert.equal(requests, 3);
});
