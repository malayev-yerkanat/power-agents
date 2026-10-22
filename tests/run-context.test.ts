import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RunContext } from '../src/client/RunContext.tsx';
import { completed } from './e2e/fixtures.ts';
import type { Run } from '../src/shared/types.ts';

const render = (run: Run) => renderToStaticMarkup(createElement(RunContext, { run, onClarify: () => {} }));

test('paused runs expose the latest review without inventing a verdict', () => {
  const html = render({ ...completed, status: 'paused', phase: 'synthesize', artifacts: [
    { id: 'older', title: 'Review', kind: 'review', body: 'Старая версия', authorId: 'b', createdAt: '2026-10-09T08:00:00Z' },
    { id: 'newer', title: 'Review', kind: 'review', body: 'Добавить источники', authorId: 'b', createdAt: completed.updatedAt },
  ] });
  assert.match(html, /Последнее ревью/);
  assert.match(html, /Добавить источники/);
  assert.doesNotMatch(html, /Старая версия/);
  assert.match(html, /Уточнить задачу/);
  assert.doesNotMatch(html, /Ревью одобрено|Изменения запрошены/);
  assert.match(html, /aria-current="step">Итог/);
  assert.equal((html.match(/aria-current="step"/g) || []).length, 1);
});

test('a normal pause without review has a clarification action but no fabricated review', () => {
  const html = render({ ...completed, status: 'paused', phase: 'tasks', artifacts: [] });
  assert.match(html, /Уточнить задачу/);
  assert.doesNotMatch(html, /Последнее ревью/);
  assert.match(html, /aria-current="step">Задачи/);
});
