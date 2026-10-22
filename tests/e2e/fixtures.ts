import type { Page } from '@playwright/test';
import type { Bootstrap, Connection, Run } from '../../src/shared/types';

export const connections: Connection[] = [
  { id: 'codex', name: 'Codex CLI', kind: 'codex-cli', available: true, detail: 'Test connection' },
  { id: 'claude', name: 'Claude Code', kind: 'claude-cli', available: true, detail: 'Test connection' },
];

export const completed: Run = {
  id: 'review-fixture',
  title: 'Проверяемый результат',
  goal: 'Составить краткий план проверки интерфейса.',
  status: 'completed',
  mode: 'demo',
  phase: 'done',
  version: 1,
  createdAt: '2026-10-09T08:00:00Z',
  updatedAt: '2026-10-09T08:01:00Z',
  members: [
    { id: 'a', name: 'Codex CLI', connectionId: 'codex', model: '', role: 'Автор' },
    { id: 'b', name: 'Claude Code', connectionId: 'claude', model: '', role: 'Проверяющий' },
  ],
  leaderId: 'a',
  tasks: [],
  messages: [],
  sessions: {},
  turnCount: 4,
  reviewRound: 1,
  artifacts: [{
    id: 'final',
    title: 'План проверки',
    kind: 'final',
    authorId: 'a',
    body: '# Проверка\n\n- Проверить форму\n- Прочитать результат\n\n| Этап | Готово |\n| --- | --- |\n| Форма | Да |',
    createdAt: '2026-10-09T08:01:00Z',
  }],
};

export async function mockWorkspace(page: Page, runs: Run[] = [completed]) {
  await page.addInitScript(() => {
    class QuietEventSource extends EventTarget {
      onopen: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      constructor() {
        super();
        setTimeout(() => this.onopen?.(new Event('open')), 0);
      }
      close() {}
    }
    Object.defineProperty(window, 'EventSource', { value: QuietEventSource });
  });

  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 409, json: { error: 'Synthetic request rejected; nothing was created.' } });
      return;
    }
    if (path === '/api/bootstrap') {
      const json: Bootstrap = {
        connections,
        runs: runs.map(({ id, title, status, mode, createdAt, updatedAt, version }) =>
          ({ id, title, status, mode, createdAt, updatedAt, version })),
        totalRuns: runs.length,
        csrfToken: 'fixture-only',
        eventCursor: 0,
        maxConcurrent: 3,
      };
      await route.fulfill({ json });
      return;
    }
    if (path.startsWith('/api/models/')) {
      await route.fulfill({ json: { connectionId: path.split('/').at(-1), models: [], status: 'ready', note: 'Test models' } });
      return;
    }
    if (path === '/api/telegram/status') {
      await route.fulfill({ json: { configured: false, ready: false, connected: false, notifications: { approval: false, completed: false } } });
      return;
    }
    const run = runs.find(item => path === `/api/runs/${item.id}`);
    if (run) {
      await route.fulfill({ json: { run, events: [] } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: 'Fixture not found' } });
  });
}
