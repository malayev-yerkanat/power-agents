import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RunWorkspace } from '../src/client/RunWorkspace.tsx';
import { Composer } from '../src/client/Composer.tsx';
import { ModelPicker } from '../src/client/ModelPicker.tsx';
import type { Connection, Run } from '../src/shared/types.ts';
const run: Run = {
  id: 'run', goal: 'A concrete goal', title: '<script>alert(1)</script>', status: 'awaiting_approval',
  mode: 'demo', members: [{ id: 'a', name: 'Alice', connectionId: 'codex', model: '', role: '' }, { id: 'b', name: 'Bob', connectionId: 'claude', model: '', role: '' }],
  leaderId: 'a', tasks: [], messages: [], artifacts: [], sessions: {}, turnCount: 1, reviewRound: 0, phase: 'plan', version: 1, createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z',
  plan: { summary: 'Proposed approach', successCriteria: ['Useful document'], roles: [{ memberId: 'a', role: 'Writer' }, { memberId: 'b', role: 'Reviewer' }], tasks: [{ id: 'first', title: 'Visible proposed task', description: 'Deliver a draft', assigneeId: 'a', dependsOn: [] }, { id: 'second', title: 'Review proposed task', description: 'Review the draft', assigneeId: 'b', dependsOn: ['first'] }] },
};
const render = (value: Run) => renderToStaticMarkup(createElement(RunWorkspace, { detail: { run: value, events: [] }, mutate: async () => value }));
test('approval preview shows tasks, dependencies and assigned roles before execution', () => {
  const html = render(run);
  assert.ok(html.includes('Visible proposed task'));
  assert.ok(html.includes('После: Visible proposed task'));
  assert.ok(html.includes('Writer'));
  assert.ok(html.includes('Согласовать и запустить'));
  assert.ok(html.includes('Демонстрационный сценарий'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>alert'));
});
test('accepted latest final is first and previous revision is identified as a draft', () => {
  const html = render({ ...run, status: 'completed', phase: 'done', artifacts: [
    { id: 'old', kind: 'final', title: 'Old draft', body: 'Previous result', authorId: 'a', createdAt: '2026-10-07T00:00:01Z' },
    { id: 'new', kind: 'final', title: 'Accepted revision', body: 'Updated result', authorId: 'a', createdAt: '2026-10-07T00:00:02Z' },
  ] });
  assert.ok(html.indexOf('Accepted revision') < html.indexOf('Old draft'));
  assert.ok(html.includes('ПРИНЯТЫЙ ИТОГОВЫЙ РЕЗУЛЬТАТ'));
  assert.ok(html.includes('ПРЕДЫДУЩИЙ ПРОЕКТ РЕЗУЛЬТАТА'));
  assert.ok(!html.includes('Согласовать и запустить'));
  assert.ok(html.includes('/api/runs/run/artifacts/new'));
});
test('composer distinguishes demo from real calls and presents model/team controls', () => {
  const html = renderToStaticMarkup(createElement(Composer, { connections: [
    { id: 'codex', name: 'Codex', kind: 'codex-cli', available: true, detail: 'Unverified login' },
    { id: 'claude', name: 'Claude', kind: 'claude-cli', available: true, detail: 'Unverified login' },
  ], onCreate: async () => {}, openSettings: () => {}, loadModels: async () => ({ connectionId: 'codex', models: [], status: 'ready' as const, note: '' }) }));
  assert.ok(html.includes('Демо без запросов к моделям'));
  assert.ok(html.includes('Реальный запуск использует ваши CLI-подписки или API.'));
  assert.ok(html.includes('Что нужно сделать?'));
  assert.ok(html.includes('План потребует вашего согласования'));
  assert.ok(html.includes('<select id="model-'));
  assert.ok(!html.includes('<input id="model-'));
});

test('model picker shows provider options and requires API model selection', () => {
  const cli: Connection = { id: 'codex', name: 'Codex', kind: 'codex-cli', available: true, detail: '' };
  const api: Connection = { id: 'anthropic-api', name: 'Anthropic', kind: 'anthropic-api', available: true, detail: '' };
  const renderPicker = (connection: Connection, catalog?: { connectionId: string; models: { id: string; name: string }[]; status: 'ready' | 'unavailable' | 'error'; note: string }) =>
    renderToStaticMarkup(createElement(ModelPicker, { id: 'model-test', connection, value: '', catalog, onChange: () => {}, onRetry: () => {} }));
  const cliHtml = renderPicker(cli, { connectionId: 'codex', models: [{ id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' }], status: 'ready', note: 'CLI models' });
  assert.match(cliHtml, /<option value=""[^>]*>По умолчанию<\/option>/);
  assert.match(cliHtml, /<option value="gpt-6\.1-sol">GPT-6\.1 Sol<\/option>/);
  const apiLoading = renderPicker(api);
  assert.match(apiLoading, /<select[^>]*disabled=""/);
  assert.match(apiLoading, /Загружаем модели/);
  const apiHtml = renderPicker(api, { connectionId: 'anthropic-api', models: [{ id: 'claude-opus-5', name: 'Claude Opus 5' }], status: 'ready', note: 'API models' });
  assert.match(apiHtml, /<option value=""[^>]*disabled=""[^>]*>Выберите модель<\/option>/);
  assert.match(apiHtml, /<option value="claude-opus-5">Claude Opus 5<\/option>/);
  const readyWithoutNote = renderPicker(cli, { connectionId: 'codex', models: [{ id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' }], status: 'ready', note: '' });
  assert.doesNotMatch(readyWithoutNote, /Список моделей недоступен/);
});
