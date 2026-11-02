import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModelPicker } from '../src/client/ModelPicker';
import { TelegramSettingsView } from '../src/client/TelegramSettings';
import { uiMessage } from '../src/client/uiMessages';
import { en } from '../src/client/i18n-en';
import { language, locale, setLanguage, t } from '../src/client/i18n';

test('Russian is the default and returns the source text', () => {
  setLanguage('ru');
  assert.equal(language(), 'ru');
  assert.equal(locale(), 'ru-RU');
  assert.equal(t('Новая задача'), 'Новая задача');
  assert.equal(t('Загружено {loaded} из {total} запусков.', { loaded: 3, total: 9 }), 'Загружено 3 из 9 запусков.');
});

test('English translates and interpolates; unknown text falls back to Russian', () => {
  setLanguage('en');
  try {
    assert.equal(locale(), 'en-US');
    assert.equal(t('Новая задача'), 'New task');
    assert.equal(t('Загружено {loaded} из {total} запусков.', { loaded: 3, total: 9 }), 'Loaded 3 of 9 runs.');
    assert.equal(t('Текст без перевода'), 'Текст без перевода');
  } finally { setLanguage('ru'); }
});

test('every Russian UI string in the client has an English translation with the same placeholders', () => {
  const files = readdirSync('src/client', { recursive: true, encoding: 'utf8' })
    .filter(file => /\.tsx?$/.test(file) && !file.startsWith('i18n'));
  const missing: string[] = [];
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(join('src/client', file), 'utf8'), ts.ScriptTarget.Latest, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node: ts.Node) {
      if (ts.isTemplateExpression(node) || ts.isJsxText(node)) {
        const text = ts.isJsxText(node) ? node.text : [node.head.text, ...node.templateSpans.map(span => span.literal.text)].join('');
        assert.doesNotMatch(text, /[А-Яа-яЁё]/, `${file}: UI text must use a translation key`);
      }
      if (ts.isStringLiteralLike(node) && /[А-Яа-яЁё]/.test(node.text)) {
        const text = node.text;
        const english = en[text];
        if (!english) missing.push(`${file}: ${text}`);
        else assert.deepEqual(english.match(/\{\w+\}/g)?.sort() ?? [], text.match(/\{\w+\}/g)?.sort() ?? [], text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(missing, []);
});

test('all dictionary translations preserve placeholders and contain no untranslated Russian', () => {
  for (const [source, english] of Object.entries(en)) {
    assert.doesNotMatch(english, /[А-Яа-яЁё]/, source);
    assert.deepEqual(english.match(/\{\w+\}/g)?.sort() ?? [], source.match(/\{\w+\}/g)?.sort() ?? [], source);
  }
});

test('unknown keys never resolve to inherited dictionary properties', () => {
  setLanguage('en');
  try {
    for (const key of ['constructor', 'toString', '__proto__']) assert.equal(t(key), key);
    assert.equal(t('{toString}', {}), '{toString}');
  } finally { setLanguage('ru'); }
});

test('language changes persist the preference and survive denied storage', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let preference = '';
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      setItem(key: string, value: string) { assert.equal(key, 'power-agents.language'); preference = value; },
    } });
    setLanguage('en');
    assert.equal(preference, 'en');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage denied'); } });
    assert.doesNotThrow(() => setLanguage('ru'));
    assert.equal(language(), 'ru');
    assert.equal(locale(), 'ru-RU');
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    setLanguage('ru');
  }
});

test('stored validation guidance and model notes translate when rendered', () => {
  const props = {
    id: 'model', connection: { id: 'claude', kind: 'claude-cli' as const, name: 'Claude Code', available: true, detail: '' },
    value: '', catalog: { connectionId: 'claude', models: [], status: 'ready' as const,
      note: 'Стандартные псевдонимы Claude CLI. Доступ в вашем аккаунте не проверен.' },
    error: 'Выберите модель для API-подключения.', onChange: () => {}, onRetry: () => {},
  };
  setLanguage('en');
  try {
    const english = renderToStaticMarkup(createElement(ModelPicker, props));
    assert.match(english, /Choose a model for the API connection\./);
    assert.match(english, /Standard Claude CLI aliases/);
    assert.doesNotMatch(english, /[А-Яа-яЁё]/);
  } finally { setLanguage('ru'); }
  assert.match(renderToStaticMarkup(createElement(ModelPicker, props)), /Выберите модель для API-подключения\./);
});

test('stored Telegram feedback follows the selected language', () => {
  const props = {
    status: { configured: true, ready: true, connected: true, notifications: { approval: true, completed: true } },
    busy: false, error: 'Не удалось выполнить действие.', message: 'Тестовое уведомление поставлено в очередь.', pairUrl: '',
    onPair: async () => {}, onTest: async () => {}, onUnpair: async () => {}, onToggle: async () => {},
  };
  setLanguage('en');
  try {
    const english = renderToStaticMarkup(createElement(TelegramSettingsView, props));
    assert.match(english, /Test notification queued\./);
    assert.match(english, /Could not complete the action\./);
  } finally { setLanguage('ru'); }
});

test('platform metadata translates interpolated hints without changing unknown provider text', () => {
  setLanguage('en');
  try {
    assert.equal(uiMessage('CLI не найден. Установите agy и выполните вход.'), 'CLI not found. Install agy and sign in.');
    assert.equal(uiMessage('Claude Code не вернул список моделей. Проверьте вход в CLI и повторите попытку.'),
      'Claude Code did not return a model list. Check your CLI sign-in and try again.');
    assert.equal(uiMessage('Не удалось выполнить запрос (409).'), 'Request failed (409).');
    assert.equal(uiMessage('Ответ внешнего провайдера'), 'Ответ внешнего провайдера');
    assert.equal(uiMessage('OpenAI отклонил ключ (HTTP 401). Проверьте OPENAI_API_KEY в .env и перезапустите приложение.'),
      'OpenAI rejected the key (HTTP 401). Check OPENAI_API_KEY in .env and restart the app.');
  } finally { setLanguage('ru'); }
});
