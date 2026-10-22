import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RunWorkspace } from '../src/client/RunWorkspace.tsx';
import { Composer } from '../src/client/Composer.tsx';
import { ModelPicker } from '../src/client/ModelPicker.tsx';
import { mergeBootstrap, mergeDetail } from '../src/client/App.tsx';
import { CityBackdrop } from '../src/client/CityBackdrop.tsx';
import { HistoryView } from '../src/client/HistoryView.tsx';
import { SquadPreview } from '../src/client/SquadPreview.tsx';
import { ArtifactView } from '../src/client/ArtifactView.tsx';
import { App } from '../src/client/App.tsx';
import { attackSample, memberMode, providerFor } from '../src/client/combat.ts';
import { monsterTimeline } from '../src/client/monsterAnimation.ts';
import type { Bootstrap, Connection, Run, RunEvent } from '../src/shared/types.ts';
const run: Run = {
  id: 'run', goal: 'A concrete goal', title: '<script>alert(1)</script>', status: 'awaiting_approval',
  mode: 'demo', members: [{ id: 'a', name: 'Alice', connectionId: 'codex', model: '', role: '' }, { id: 'b', name: 'Bob', connectionId: 'claude', model: '', role: '' }],
  leaderId: 'a', tasks: [], messages: [], artifacts: [], sessions: {}, turnCount: 1, reviewRound: 0, phase: 'plan', version: 1, createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z',
  plan: { summary: 'Proposed approach', successCriteria: ['Useful document'], roles: [{ memberId: 'a', role: 'Writer' }, { memberId: 'b', role: 'Reviewer' }], tasks: [{ id: 'first', title: 'Visible proposed task', description: 'Deliver a draft', assigneeId: 'a', dependsOn: [] }, { id: 'second', title: 'Review proposed task', description: 'Review the draft', assigneeId: 'b', dependsOn: ['first'] }] },
};
const render = (value: Run) => renderToStaticMarkup(createElement(RunWorkspace, { detail: { run: value, events: [] }, mutate: async () => value }));
test('bootstrap history retains loaded pages and resets its cursor when new runs create a gap', () => {
  const item = (id: string) => ({ id, title: id, status: 'completed' as const, mode: 'demo' as const,
    createdAt: id, updatedAt: id, version: 1 });
  const base: Bootstrap = { connections: [], csrfToken: 'token', maxConcurrent: 3, eventCursor: 4,
    runs: [item('4'), item('3'), item('2')], nextCursor: '2', totalRuns: 5 };
  const loaded = { ...base, runs: [item('4'), item('3'), item('2'), item('1')], nextCursor: '1' };
  const stable = mergeBootstrap(base, loaded);
  assert.deepEqual(stable.runs.map(value => value.id), ['4', '3', '2', '1']);
  assert.equal(stable.nextCursor, '1');
  const fresh = { ...base, runs: [item('6'), item('5'), item('4')], nextCursor: '4', totalRuns: 7, eventCursor: 6 };
  const merged = mergeBootstrap(fresh, loaded);
  assert.deepEqual(merged.runs.map(value => value.id), ['6', '5', '4', '3', '2', '1']);
  assert.equal(merged.nextCursor, '4');
  assert.equal(merged.eventCursor, 6);
});

test('detail refresh preserves fetched older events and gains new events without duplicates', () => {
  const event = (id: number): RunEvent => ({ id, runId: run.id, type: 'changed', message: String(id), createdAt: run.createdAt });
  const current = { run, events: [event(1), event(2), event(3)] };
  const incoming = { run: { ...run, version: 2 }, events: [event(2), event(3), event(4)], eventsBefore: 2 };
  const merged = mergeDetail(current, incoming);
  assert.deepEqual(merged.events.map(value => value.id), [1, 2, 3, 4]);
  assert.equal(merged.eventsBefore, undefined);
  const partial = mergeDetail({ ...current, events: [event(2), event(3)], eventsBefore: 2 }, incoming);
  assert.deepEqual(partial.events.map(value => value.id), [2, 3, 4]);
  assert.equal(partial.eventsBefore, 2);
});
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

test('city backdrop renders collapsed controls and expanded artwork lazily', () => {
  const collapsed = renderToStaticMarkup(createElement(CityBackdrop, { initiallyCollapsed: true }));
  assert.match(collapsed, /city-scene-collapsed/);
  assert.match(collapsed, /Показать город/);
  assert.doesNotMatch(collapsed, /city-backdrop-stage/);

  const expanded = renderToStaticMarkup(createElement(CityBackdrop, { initiallyCollapsed: false }));
  assert.match(expanded, /city-backdrop-stage/);
  assert.match(expanded, /city-landscape/);
  assert.match(expanded, /city-plane-one/);
  assert.match(expanded, /\/art\/villain-monster\.png/);
  assert.match(expanded, /Свернуть город/);
  assert.match(expanded, /Город · пауза/);
});

test('history view labels loaded-only search and preserves pagination controls', () => {
  const html = renderToStaticMarkup(createElement(HistoryView, {
    runs: [
      { id: 'one', title: 'Research result', status: 'completed', mode: 'demo', createdAt: run.createdAt, updatedAt: run.updatedAt, version: 1 },
      { id: 'two', title: 'Paused work', status: 'paused', mode: 'live', createdAt: run.createdAt, updatedAt: run.updatedAt, version: 1 },
    ],
    totalRuns: 5,
    hasMore: true,
    loading: false,
    loadMore: () => {},
    select: () => {},
  }));
  assert.match(html, /Все задачи/);
  assert.match(html, /Загружено 2 из 5 запусков/);
  assert.match(html, /Поиск среди загруженных запусков/);
  assert.match(html, /Найдено среди загруженных: 2/);
  assert.match(html, /Загрузить более ранние запуски/);
});

test('collapsed artifact and squad preview keep source and fallback initials available', () => {
  const artifact = { id: 'note', title: 'Draft note', body: 'Plain text', authorId: 'a', kind: 'work' as const, createdAt: run.createdAt };
  const artifactHtml = renderToStaticMarkup(createElement(ArtifactView, {
    artifact,
    runId: 'run',
    label: 'Документ участника',
    author: 'Alice',
    expanded: false,
  }));
  assert.match(artifactHtml, /Документ: Draft note/);
  assert.match(artifactHtml, /Исходный Markdown/);
  assert.match(artifactHtml, /\/api\/runs\/run\/artifacts\/note/);

  const squadHtml = renderToStaticMarkup(createElement(SquadPreview, { members: [
    { id: 'a', name: 'Alice', connectionId: 'unknown-provider', model: '', role: '' },
    { id: 'b', name: '', connectionId: 'codex', model: '', role: '' },
    { id: 'c', name: 'Claude', connectionId: 'claude', model: '', role: '' },
    { id: 'd', name: 'Gemini', connectionId: 'gemini', model: '', role: '' },
    { id: 'e', name: 'OpenAI', connectionId: 'openai-api', model: '', role: '' },
  ] }));
  assert.match(squadHtml, /Состав команды/);
  assert.match(squadHtml, /5 участников/);
  assert.match(squadHtml, /squad-preview-neutral/);
});

test('model picker exposes field error and retry affordance for unavailable catalogs', () => {
  const api: Connection = { id: 'openai-api', name: 'OpenAI', kind: 'openai-api', available: true, detail: '' };
  const html = renderToStaticMarkup(createElement(ModelPicker, {
    id: 'model-error',
    connection: api,
    value: '',
    catalog: { connectionId: api.id, models: [], status: 'error', note: '' },
    error: 'Выберите модель для API-подключения.',
    onChange: () => {},
    onRetry: () => {},
  }));
  assert.match(html, /role="group"/);
  assert.match(html, /aria-describedby="model-error-error"/);
  assert.match(html, /Список моделей недоступен/);
  assert.match(html, /Повторить/);
  assert.match(html, /Выберите модель для API-подключения/);
});

test('app shell renders a local bootstrap state without browser effects', () => {
  const html = renderToStaticMarkup(createElement(App));
  assert.match(html, /POWER AGENTS/);
  assert.match(html, /Подключаем рабочее пространство/);
  assert.match(html, /Перейти к рабочей области/);
  assert.match(html, /Показать город/);
  assert.match(html, /Подключения/);
});

test('combat helpers prioritize lifecycle states and stable attack samples', () => {
  const alice = run.members[0];
  assert.equal(providerFor('codex-cli'), 'codex');
  assert.equal(providerFor('anthropic-api'), 'claude');
  assert.equal(providerFor('unknown'), 'neutral');
  assert.equal(memberMode({ ...run, status: 'completed', phase: 'done' }, alice), 'victory');
  assert.equal(memberMode({ ...run, status: 'failed' }, alice), 'failed');
  assert.equal(memberMode({ ...run, status: 'paused' }, alice), 'paused');
  assert.equal(memberMode({ ...run, status: 'running', phase: 'synthesize' }, alice), 'synthesizing');
  assert.deepEqual(attackSample(21, 0), { phase: 'strike', progress: 0.6, hit: true });
  assert.equal(attackSample(Number.NaN, Number.NaN).phase, 'idle');
});

test('monster timelines keep authored gestures and effects bounded', () => {
  const mantis = monsterTimeline('mantis');
  const boss = monsterTimeline('boss');
  assert.equal(mantis.length, boss.length);
  assert.ok(mantis.some(beat => beat.action === 'roar'));
  assert.ok(mantis.some(beat => beat.effect === 'dust'));
  assert.ok(boss.some(beat => beat.action === 'attack2' && beat.effect === 'dust'));
  assert.ok(mantis.every(beat => beat.duration > 0));
});
