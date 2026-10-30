import { t } from './i18n';

const templates = [
  'CLI не найден. Установите {binary} и выполните вход.',
  '{name} не вернул список моделей. Проверьте вход в CLI и повторите попытку.',
  'Нет связи с {provider}. Проверьте интернет и повторите попытку.',
  '{provider} отклонил ключ (HTTP {status}). Проверьте {key} в .env и перезапустите приложение.',
  '{provider}: превышен лимит запросов или исчерпана квота (HTTP 429).',
  '{provider}: модель или адрес не найдены (HTTP 404).',
  '{provider} временно недоступен (HTTP {status}). Повторите позже.',
  '{provider} вернул ошибку HTTP {status}.',
  'Не удалось выполнить запрос ({status}).',
].map(key => {
  const names: string[] = [];
  const pattern = key.split(/(\{\w+\})/).map(part => {
    if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return '(.+?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return { key, names, pattern: new RegExp(`^${pattern}$`) };
});

/** Translate platform-owned metadata and feedback, leaving unknown provider text intact. */
export function uiMessage(text: string): string {
  for (const { key, names, pattern } of templates) {
    const match = pattern.exec(text);
    if (match) return t(key, Object.fromEntries(names.map((name, index) => [name, match[index + 1]])));
  }
  return t(text);
}
