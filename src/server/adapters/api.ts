import type { TurnInput, TurnResult } from '../../shared/types.js';
import { MAX_OUTPUT_BYTES, TURN_TIMEOUT_MS, optionalText, record, requiredText } from './common.js';

async function boundedJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.body) throw new Error('Пустой HTTP-ответ провайдера.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_OUTPUT_BYTES) { await reader.cancel(); throw new Error('Ответ API превысил лимит 2 МиБ.'); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try { return record(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
  catch { throw new Error(`API вернул некорректный JSON (HTTP ${response.status}).`); }
}

function responseText(data: Record<string, unknown>, openai: boolean): string {
  if (openai) {
    if (data.status !== 'completed') throw new Error(`OpenAI не завершил ответ: ${String(data.status ?? 'unknown')}.`);
    const output = Array.isArray(data.output) ? data.output.map(record) : [];
    const content = output.filter(item => item.type === 'message').flatMap(item => Array.isArray(item.content) ? item.content.map(record) : []);
    return requiredText(content.filter(item => item.type === 'output_text').map(item => requiredText(item.text)).join('\n'));
  }
  if (data.stop_reason !== 'end_turn' && data.stop_reason !== 'stop_sequence') throw new Error(`Anthropic не завершил текстовый ответ: ${String(data.stop_reason ?? 'unknown')}.`);
  const content = Array.isArray(data.content) ? data.content.map(record) : [];
  return requiredText(content.filter(item => item.type === 'text').map(item => requiredText(item.text)).join('\n'));
}

export async function runApi(input: TurnInput): Promise<TurnResult> {
  const openai = input.connection.kind === 'openai-api';
  const keyName = openai ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
  const key = process.env[keyName]?.trim();
  if (!key) throw new Error(`Для API требуется переменная окружения ${keyName}.`);
  const model = input.member.model.trim();
  if (!model) throw new Error('Укажите модель для участника с API-подключением.');
  const body = openai
    ? { model, input: input.prompt, tools: [], max_output_tokens: 8192, ...(input.sessionId ? { previous_response_id: input.sessionId } : {}) }
    : { model, max_tokens: 8192, messages: [{ role: 'user', content: input.prompt }] };
  const signal = AbortSignal.any([input.signal, AbortSignal.timeout(TURN_TIMEOUT_MS)]);
  const response = await fetch(openai ? 'https://api.openai.com/v1/responses' : 'https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', ...(openai ? { authorization: `Bearer ${key}` } : { 'x-api-key': key, 'anthropic-version': '2023-06-01' }) },
    body: JSON.stringify(body),
  });
  const data = await boundedJson(response);
  if (!response.ok || data.error) {
    const error = typeof data.error === 'object' && data.error ? record(data.error) : {};
    throw new Error(`API HTTP ${response.status}: ${optionalText(error.message) ?? 'Проверьте ключ, модель и лимиты провайдера.'}`);
  }
  const text = responseText(data, openai);
  return openai ? { text, sessionId: optionalText(data.id) } : { text };
}
