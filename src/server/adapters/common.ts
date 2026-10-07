export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
export const TURN_TIMEOUT_MS = 5 * 60 * 1000;

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ожидался JSON-объект в ответе провайдера.');
  return value as Record<string, unknown>;
}

/** Accept a complete object, optionally wrapped in a single Markdown code fence. */
export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  try { return record(JSON.parse(fence ? fence[1] : trimmed)); }
  catch { throw new Error('Провайдер вернул некорректный JSON-объект.'); }
}

export function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Провайдер вернул пустой текст ответа.');
  return value;
}

export function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
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
