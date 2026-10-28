import type { TurnPurpose } from '../../shared/types.js';
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
export const TURN_TIMEOUT_MS = 5 * 60 * 1000;
/** The CLI refused an action (a write outside the folder, a terminal command); the turn may be retried with a hint. */
export class DeniedActionError extends Error {
  constructor(detail: string) { super(`CLI запретил действие: ${detail}`); }
}
/** The CLI printed nothing for too long; a turn that has not touched the team yet may be retried. */
export class StalledError extends Error {
  constructor(seconds: number) { super(`Агент не отвечал ${seconds} с.`); }
}
/** Codex prints an event per finished item: across 109 live turns normal silences stayed under 95 s, stalls ran 180–414 s. */
export const CODEX_STALL_MS = 150 * 1000;
/** Combining and reviewing read every result, so they get the design's 15-minute ceiling. */
export const turnTimeoutMs = (purpose: TurnPurpose) => purpose === 'synthesize' || purpose === 'review' ? 15 * 60 * 1000 : TURN_TIMEOUT_MS;

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ожидался JSON-объект в ответе провайдера.');
  return value as Record<string, unknown>;
}

/** Accept a complete object, optionally wrapped in a single Markdown code fence. */
export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  try { return record(JSON.parse(fence ? fence[1] : trimmed)); }
  catch { throw new Error(`Провайдер вернул некорректный JSON-объект. Начало ответа: «${trimmed.slice(0, 160)}»`); }
}

export function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Провайдер вернул пустой текст ответа.');
  return value;
}

export function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** A plain-language reason for an API provider's HTTP failure, naming what to check. */
export function providerRejection(provider: 'openai' | 'anthropic', status: number): string {
  const name = provider === 'openai' ? 'OpenAI' : 'Anthropic';
  if (status === 401 || status === 403) return `${name} отклонил ключ (HTTP ${status}). Проверьте ${provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} в .env и перезапустите приложение.`;
  if (status === 429) return `${name}: превышен лимит запросов или исчерпана квота (HTTP 429).`;
  if (status === 404) return `${name}: модель или адрес не найдены (HTTP 404).`;
  if (status >= 500) return `${name} временно недоступен (HTTP ${status}). Повторите позже.`;
  return `${name} вернул ошибку HTTP ${status}.`;
}

export function redactError(value: unknown): string {
  let message = value instanceof Error ? value.message : String(value);
  for (const [name, secret] of Object.entries(process.env)) {
    if (/(?:KEY|TOKEN|SECRET|PASSWORD)$/i.test(name) && secret?.trim()) {
      message = message.split(secret).join('[REDACTED]').split(secret.trim()).join('[REDACTED]');
    }
  }
  return message.slice(0, 2000);
}
