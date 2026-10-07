export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Requester = <T>(path: string, options?: RequestInit) => Promise<T>;
type Session = { csrfToken: string };

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  if (!/^\/api(?:\/|$)/.test(path)) throw new Error('Expected a local API path.');
  const response = await fetch(path, { ...options, credentials: 'same-origin' });
  const data = await response.json().catch(() => ({ error: 'Сервер вернул неожиданный ответ.' }));
  if (!response.ok) throw new ApiError(response.status, data.error || `Не удалось выполнить запрос (${response.status}).`);
  return data as T;
}

export function createSessionRequest(bootstrap: () => Promise<Session>, send: Requester = api): Requester {
  let recovering: Promise<Session> | undefined;
  const recover = (): Promise<Session> => {
    if (!recovering) {
      const pending = bootstrap();
      recovering = pending;
      const clear = () => { if (recovering === pending) recovering = undefined; };
      void pending.then(clear, clear);
    }
    return recovering;
  };

  return async <T>(path: string, options?: RequestInit): Promise<T> => {
    try { return await send<T>(path, options); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }

    const session = await recover();
    const headers = new Headers(options?.headers);
    if (options?.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())) {
      headers.set('X-CSRF-Token', session.csrfToken);
    }
    try { return await send<T>(path, { ...options, headers }); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw new Error('Не удалось сохранить локальную сессию. Откройте приложение в обычной вкладке и разрешите cookies для 127.0.0.1.');
      }
      throw error;
    }
  };
}
