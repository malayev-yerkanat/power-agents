import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TelegramSettingsView, createTelegramClient, safeTelegramPairUrl } from '../src/client/TelegramSettings';

const notifications = { approval: true, completed: true };
const noOp = async () => {};

test('Telegram settings explain setup when the bot token is absent', () => {
  const html = renderToStaticMarkup(createElement(TelegramSettingsView, {
    status: { configured: false, ready: false, connected: false, notifications },
    busy: false, error: '', message: '', pairUrl: '', onPair: noOp,
    onTest: noOp, onUnpair: noOp, onToggle: noOp,
  }));
  assert.match(html, /TELEGRAM_BOT_TOKEN/);
  assert.doesNotMatch(html, /Подключить Telegram/);
});

test('Telegram settings expose paired alert preferences and disconnect action', () => {
  const html = renderToStaticMarkup(createElement(TelegramSettingsView, {
    status: { configured: true, ready: true, connected: true, username: 'my_bot', notifications },
    busy: false, error: '', message: '', pairUrl: '', onPair: noOp,
    onTest: noOp, onUnpair: noOp, onToggle: noOp,
  }));
  assert.match(html, /my_bot/);
  assert.match(html, /Тестовое уведомление/);
  assert.match(html, /Отключить/);
  assert.match(html, /План готов/);
  assert.match(html, /Задача завершена/);
});

test('Telegram settings show connection failure and prevent pairing until the bot is ready', () => {
  const html = renderToStaticMarkup(createElement(TelegramSettingsView, {
    status: { configured: true, ready: false, connected: false, error: 'Telegram bot could not connect.', notifications },
    busy: false, error: '', message: '', pairUrl: '', onPair: noOp,
    onTest: noOp, onUnpair: noOp, onToggle: noOp,
  }));
  assert.match(html, /Не удалось подключиться к Telegram/);
  assert.match(html, /disabled=""[^>]*>.*Подключить Telegram/);
});

test('Telegram pairing accepts only official HTTPS t.me bot links', () => {
  assert.equal(safeTelegramPairUrl('https://t.me/my_bot?start=abc'), 'https://t.me/my_bot?start=abc');
  assert.equal(safeTelegramPairUrl('javascript:alert(1)'), null);
  assert.equal(safeTelegramPairUrl('https://t.me.evil.test/my_bot'), null);
  assert.equal(safeTelegramPairUrl('http://t.me/my_bot'), null);
});

test('Telegram client sends CSRF token for each mutation and leaves status read-only', async () => {
  const calls: Array<{ path: string; options?: RequestInit }> = [];
  const request = async <T,>(path: string, options?: RequestInit): Promise<T> => {
    calls.push({ path, options });
    if (path.endsWith('/preferences')) return { notifications: { approval: false, completed: true } } as T;
    if (path.endsWith('/pair')) return { url: 'https://t.me/my_bot?start=abc', expiresAt: new Date().toISOString() } as T;
    if (path.endsWith('/test')) return { queued: true } as T;
    if (path.endsWith('/pairing')) return { connected: false } as T;
    return { configured: true, ready: true, connected: false, notifications } as T;
  };
  const client = createTelegramClient(request, 'csrf-token');
  await client.status();
  await client.pair();
  await client.test();
  await client.setNotifications({ approval: false });
  await client.unpair();
  assert.deepEqual(calls.map(call => [call.path, call.options?.method]), [
    ['/api/telegram/status', undefined],
    ['/api/telegram/pair', 'POST'],
    ['/api/telegram/test', 'POST'],
    ['/api/telegram/preferences', 'PATCH'],
    ['/api/telegram/pairing', 'DELETE'],
  ]);
  for (const call of calls.slice(1)) {
    assert.equal(new Headers(call.options?.headers).get('X-CSRF-Token'), 'csrf-token');
  }
});
