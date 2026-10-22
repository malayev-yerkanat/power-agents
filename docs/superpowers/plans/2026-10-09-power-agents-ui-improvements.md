# Power Agents UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Power Agents easier to start, read, recover, and revisit while preserving the approved Airy Pixel identity and the existing orchestration protocol.

**Architecture:** Keep the server, SQLite schema, provider adapters, and SSE protocol unchanged. Add small client modules for safe document rendering, per-tab draft storage, fragment navigation, history presentation, and recovery context; update existing layout styles instead of adding another override layer. Use a fixture-backed browser suite served by standalone Vite, alongside the existing Node/HTTP tests.

**Tech Stack:** Node.js 24+, TypeScript, React 19, Vite 7, Tailwind 4/CSS, existing Zod; add `react-markdown`, `remark-gfm`, and development-only `@playwright/test`.

---

## Status, context, and scope

**Planning only, 2026-10-09.** No implementation has started. Paths below are repository-relative to `/Users/bigbonch1k/Desktop/Personal/my projects/AI Orchestration`; line numbers identify the reviewed snapshot and are anchors, not immutable offsets.

Read before execution:

1. `AGENTS.md` and any nested guidance.
2. `docs/prototype.md`, then `wiki/hot.md`, `wiki/index.md`, `wiki/modules/Client Interface.md`.
3. `wiki/decisions/Pixel Art Consistency.md`: approved artwork, scale, ivory/cobalt surfaces, and pixel UI remain authoritative.
4. `docs/audits/2026-10-09-design-review.md` (originally `.jez/artifacts/design-review.md`): eleven findings and twelve baseline screenshots.
5. `src/client/App.tsx`, `Composer.tsx`, `RunWorkspace.tsx`, and `src/shared/types.ts`.

There are substantial existing uncommitted changes. Record `git status --short` and `git diff --stat` before execution; do not reset, overwrite, stage, or commit unrelated work. Use the current working tree as the design baseline. If isolation is requested, use the installed `using-git-worktrees` skill and ensure the baseline includes the user's current changes; a worktree from HEAD alone would omit much of this interface.

This plan is one client-subsystem improvement, split into three independently shippable milestones:

- **A — Work-first presentation:** Tasks 1–4, creation hierarchy, optional artwork loading, document reader, completion/recovery layout.
- **B — Continuity and navigation:** Tasks 5–7, validated per-tab drafts, deep links, real history view with explicitly loaded-only filtering.
- **C — Input and responsive quality:** Tasks 8–11, actionable validation, consistent control sizes/tokens, responsive verification, documentation and delivery checks.

Milestones share `App.tsx`, `Composer.tsx`, and `RunWorkspace.tsx`: execute integration steps serially. Independent helpers/tests may be delegated with explicit ownership. Run code review after each task; security review the Markdown and browser-storage changes. The plan's own coverage/type/placeholder review is performed by the author, not delegated.

### Scope decisions

- The city starts collapsed, with an explicit expansion control; its expanded artwork retains the 448px stage and existing integer scales. This is a deliberate hierarchy refinement to the prior full-panorama default, not replacement artwork.
- Composer puts the goal before the decorative squad preview and advanced team details. Default participants remain visible in a concise summary; configuration remains one disclosure away.
- Existing completed runs open Results and show the accepted document first. Completion during an open run still does not steal the user's tab or destroy a message draft.
- Drafts survive navigation and reload **within the same browser tab** using `sessionStorage`. They are not cross-device storage or reusable team presets, and are not guaranteed after closing the tab. This avoids shared-tab overwrite/conflict behavior. Clear/reset is explicit.
- History search is labelled **“Поиск среди загруженных запусков”**. It searches loaded pages only; existing pagination remains accessible even when the filter has no matches. It must not pretend to search all SQLite history.
- No combined “send and resume” mutation: send feedback and resume stay separate. Review artifacts have no persisted verdict; present “Последнее ревью,” not an invented approval/rejection badge.

### Separate follow-up plans, outside this implementation

Full-history server search, rename/archive, reusable named team presets, version diffs, provider authentication diagnostics, budgets, attachments, repository editing, general MCP tools, multi-user hosting, dark mode, and new sprite/pose production are independent capabilities. They need their own contract/design plans; none is silently included in this UI pass.

### Acceptance targets

| Concern | Acceptance |
| --- | --- |
| Creation hierarchy | With collapsed city and team defaults, goal textarea top <400px at 1440×900 and <600px at 390×844; 320px layout remains usable without page overflow |
| Results | On reopening a completed fixture, accepted artifact precedes the encounter in DOM/visual order and its heading is visible in a 1440×900 viewport |
| Reading | Real headings, lists, tables, links, code; raw HTML cannot execute; Markdown images cannot trigger remote fetches; original Markdown remains downloadable/copyable |
| Drafts | Goal/team/mode and run-specific steering survive navigation/reload; invalid stored data is rejected with a visible notice; unsuccessful requests preserve text |
| Navigation | Back/forward and direct run/tab links work, including runs not in the first history page; unknown routes get a recoverable state |
| Validation | Invalid field is expanded, focused, marked invalid, and linked to a specific error |
| Recovery | Paused/failed run exposes latest review when present and a direct clarification focus action; no fabricated review verdict |
| Responsive | 320/390/768/1440 widths, including persistent scrollbar; only document tables/code and encounter can scroll horizontally |
| Accessibility | Functional text >=12px; standard interactive hit areas >=44px on narrow/coarse-pointer layouts; keyboard dialogs/tabs and reduced motion retained |
| Performance | No monster sheets/panorama requests before first city expansion; collapsing pauses motion without replay/reset of already loaded art |
| Verification | Existing tests and HTTP/session protection pass; >=80% overall Node line coverage; browser suite, typecheck, build, dependency audit pass |

## File structure and responsibility map

| File | Action / responsibility |
| --- | --- |
| `playwright.config.ts` | Create isolated browser runner; standalone Vite on 127.0.0.1:4318 |
| `tests/e2e/fixtures.ts` | Create public synthetic run/connection data and API interception; no production data |
| `tests/e2e/workspace.spec.ts` | Create browser acceptance tests added task by task |
| `package.json`, `package-lock.json`, `.gitignore`, `tsconfig.json`, `.github/workflows/ci.yml` | Test dependencies, scripts, generated-output exclusions, config checking, CI |
| `src/client/CityBackdrop.tsx`, `city-backdrop.css` | Compact default and deferred decoration mount, preserving expanded geometry |
| `src/client/Composer.tsx` | Goal-first composition, expandable team settings, draft and validation wiring |
| `src/client/MarkdownDocument.tsx`, `document.css` | Create safe semantic document view and scoped prose styles |
| `src/client/ArtifactView.tsx` | Create one artifact's heading, copy/download, raw/formatted views |
| `src/client/RunContext.tsx` | Create workflow-stage labels, optional encounter, latest-review recovery context |
| `src/client/RunWorkspace.tsx` | Integrate result-first/active layout, route tab, steering draft, retain announcements |
| `src/client/draftStorage.ts` | Create browser-safe Zod schemas and storage codecs |
| `src/client/useBrowserDraft.ts` | Create per-tab draft state with explicit read/write/reset failure feedback |
| `src/client/navigation.ts`, `useWorkspaceLocation.ts` | Create pure fragment codec and browser history hook |
| `src/client/HistoryView.tsx` | Create loaded-page filtering/status controls and pagination UI |
| `src/client/composerValidation.ts` | Create pure ordered field validation result |
| `src/client/ModelPicker.tsx` | Preserve catalog help and expose model-specific error/focus fallback |
| `src/client/App.tsx` | Wire explicit page state, preserve selected-run request/SSE guards, correct history destination |
| `src/client/styles.css`, `workspace-polish.css`, `city-workspace.css`, `main.tsx` | Consolidate touched tokens/layout/control rules; import document styles |
| `tests/markdown.test.ts`, `tests/draft-storage.test.ts`, `tests/navigation.test.ts`, `tests/composer-validation.test.ts`, `tests/run-context.test.ts`, `tests/client.test.ts` | Focused unit/render tests; retain existing assertions |
| `docs/prototype.md`, `README.md`, `wiki/modules/Client Interface.md`, `wiki/flows/Session and API Flow.md`, `wiki/decisions/Pixel Art Consistency.md`, `wiki/overview.md`, `wiki/hot.md`, `wiki/log.md` | Update changed implemented behavior as milestones ship |
| `docs/audits/2026-10-09-ui-improvements.md`, `docs/audits/assets/2026-10-09-ui-*` | Final evidence/results, not copied private runs |

## Task 1: Establish a safe browser regression harness

**Files:** create `playwright.config.ts`, `tests/e2e/fixtures.ts`, `tests/e2e/workspace.spec.ts`; modify `package.json`, `package-lock.json`, `.gitignore`, `tsconfig.json`.

- [ ] **1. Record baseline and install only the test dependency.**

```sh
git status --short
git diff --stat
npm test
npm run typecheck
npm install -D @playwright/test
npx playwright install chromium
```

Expected: existing tests/types pass, or baseline failures are recorded before changes. Do not start `npm run dev`: `src/server/index.ts` opens `.power-agents/state.sqlite`, discovers real providers, recovers runs, and can start Telegram. Standalone Vite below never imports it.

- [ ] **2. Add the exact browser configuration and scripts.**

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4318', viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce', trace: 'retain-on-failure' },
  webServer: { command: 'npx vite --host 127.0.0.1 --port 4318 --strictPort',
    url: 'http://127.0.0.1:4318', reuseExistingServer: false },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
```

Merge into `package.json.scripts` without replacing existing scripts:

```json
"test:e2e": "playwright test"
```

Append `/test-results/` and `/playwright-report/` to `.gitignore`. Append `"playwright.config.ts"` to `tsconfig.json.include`. Do not exclude new client modules from coverage to satisfy the threshold.

- [ ] **3. Create synthetic fixture data and reject unexpected network mutations.**

```ts
// tests/e2e/fixtures.ts
import type { Page } from '@playwright/test';
import type { Bootstrap, Connection, Run } from '../../src/shared/types';
export const connections: Connection[] = [
  { id: 'codex', name: 'Codex CLI', kind: 'codex-cli', available: true, detail: 'Test connection' },
  { id: 'claude', name: 'Claude Code', kind: 'claude-cli', available: true, detail: 'Test connection' },
];
export const completed: Run = {
  id: 'review-fixture', title: 'Проверяемый результат', goal: 'Составить краткий план проверки интерфейса.',
  status: 'completed', mode: 'demo', phase: 'done', version: 1,
  createdAt: '2026-10-09T08:00:00Z', updatedAt: '2026-10-09T08:01:00Z',
  members: [
    { id: 'a', name: 'Codex CLI', connectionId: 'codex', model: '', role: 'Автор' },
    { id: 'b', name: 'Claude Code', connectionId: 'claude', model: '', role: 'Проверяющий' },
  ], leaderId: 'a', tasks: [], messages: [], sessions: {}, turnCount: 4, reviewRound: 1,
  artifacts: [{ id: 'final', title: 'План проверки', kind: 'final', authorId: 'a',
    body: '# Проверка\n\n- Проверить форму\n- Прочитать результат\n\n| Этап | Готово |\n| --- | --- |\n| Форма | Да |',
    createdAt: '2026-10-09T08:01:00Z' }],
};
export async function mockWorkspace(page: Page, runs: Run[] = [completed]) {
  await page.addInitScript(() => {
    class QuietEventSource extends EventTarget {
      onopen: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      constructor() { super(); setTimeout(() => this.onopen?.(new Event('open')), 0); }
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
      const json: Bootstrap = { connections, runs: runs.map(({ id, title, status, mode, createdAt, updatedAt, version }) =>
        ({ id, title, status, mode, createdAt, updatedAt, version })), totalRuns: runs.length,
        csrfToken: 'fixture-only', eventCursor: 0, maxConcurrent: 3 };
      await route.fulfill({ json }); return;
    }
    if (path.startsWith('/api/models/')) {
      await route.fulfill({ json: { connectionId: path.split('/').at(-1), models: [], status: 'ready', note: 'Test models' } }); return;
    }
    if (path === '/api/telegram/status') {
      await route.fulfill({ json: { configured: false, ready: false, connected: false,
        notifications: { approval: false, completed: false } } }); return;
    }
    const run = runs.find(item => path === `/api/runs/${item.id}`);
    if (run) { await route.fulfill({ json: { run, events: [] } }); return; }
    await route.fulfill({ status: 404, json: { error: 'Fixture not found' } });
  });
}
```

This mocks UI transport, not engine semantics. Existing `tests/http.test.ts`, `tests/session.test.ts`, and engine tests remain integration authority.

- [ ] **4. Write a baseline browser test and prove the first hierarchy regression is red.**

```ts
// tests/e2e/workspace.spec.ts
import { test, expect } from '@playwright/test';
import { completed, mockWorkspace } from './fixtures';

test('workspace bootstrap is isolated', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/');
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Составить план', exact: true })).toBeEnabled();
});

test('goal precedes decoration in first viewport', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/');
  const goal = page.getByLabel('Что нужно сделать?', { exact: true });
  await expect(goal).toBeVisible();
  const box = await goal.boundingBox();
  expect(box!.y).toBeLessThan(400);
});
```

```sh
npm run test:e2e -- --grep 'workspace bootstrap'
npm run test:e2e -- --grep 'goal precedes'
```

Expected: baseline passes; hierarchy assertion fails on current layout. Leave the failing test in the task branch until Task 2 passes; do not alter it to match the old layout.

## Task 2: Make creation work-first and load city artwork on demand

**Files:** modify `src/client/CityBackdrop.tsx:7–54`, `App.tsx:219`, `Composer.tsx:65–92`, `city-backdrop.css`, `workspace-polish.css`, `tests/e2e/workspace.spec.ts`.

- [ ] **1. Add a real asset-loading assertion before changing rendering.**

```ts
test('collapsed city does not request monster sheets', async ({ page }) => {
  await mockWorkspace(page);
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toBeVisible();
  expect(requests.filter(url => url.includes('/art/monster-motion/'))).toEqual([]);
  await page.getByRole('button', { name: 'Показать город', exact: true }).click();
  await expect.poll(() => requests.some(url => url.includes('/art/monster-motion/'))).toBe(true);
  await page.getByRole('button', { name: 'Свернуть город', exact: true }).click();
  await expect(page.locator('#ambient-city')).toBeHidden();
});
```

Run `npm run test:e2e -- --grep 'collapsed city|goal precedes'`; expected FAIL on current code.

- [ ] **2. Change the city default and defer only its artwork subtree.**

Keep the existing motion listeners/toggle logic. Replace the initial state and expansion handler in `CityBackdrop`:

```tsx
export function CityBackdrop({ initiallyCollapsed = true }: { initiallyCollapsed?: boolean }) {
  const [expanded, setExpanded] = useState(!initiallyCollapsed);
  const [hasExpanded, setHasExpanded] = useState(!initiallyCollapsed);
  const toggleExpanded = () => {
    if (!expanded) setHasExpanded(true);
    setExpanded(value => !value);
  };
```

Replace the artwork/control return with this block; retain the existing `playing`, motion preference, listeners and `toggleMotion` definitions above it:

```tsx
return <div className={`city-scene${expanded ? '' : ' city-scene-collapsed'}`}>
  <div id="ambient-city" className={`city-backdrop${playing ? '' : ' city-backdrop-paused'}`} aria-hidden="true" hidden={!expanded}>
    {hasExpanded && <div className="city-backdrop-stage">
      <PixelArtwork className="city-landscape" src="/art/city-v2/panorama.png" width={768} height={256} />
      <PixelArtwork className="city-plane city-plane-one" src="/art/vehicles-v3/airliner.png" width={96} height={32} hardEdges />
      <PixelArtwork className="city-plane city-plane-two" src="/art/vehicles-v3/airliner.png" width={96} height={32} hardEdges />
      <AnimatedCityMonster kind="mantis" playing={playing} className="city-monster city-monster-left" />
      <AnimatedCityMonster kind="boss" playing={playing} className="city-monster city-monster-right" />
      <PixelArtwork className="city-car city-car-one" src="/art/vehicles-v3/sedan.png" width={80} height={32} hardEdges />
      <PixelArtwork className="city-car city-car-two" src="/art/vehicles-v3/taxi.png" width={80} height={32} hardEdges />
      <span className="city-car city-car-three"><PixelArtwork className="city-car-art city-car-art-reverse" src="/art/vehicles-v3/sedan.png" width={80} height={32} hardEdges /></span>
    </div>}
  </div>
  <div className="city-motion-control">
    {expanded && <button className="city-motion-toggle" type="button" onClick={toggleMotion} disabled={reducedMotion}
      aria-pressed={motionEnabled && !reducedMotion} aria-label="Анимация города"
      title={reducedMotion ? 'Движение отключено настройкой уменьшения анимации' : undefined}>
      <span className="city-motion-icon" aria-hidden="true">{motionEnabled && !reducedMotion ? 'Ⅱ' : '▷'}</span>
      {reducedMotion ? 'Город · без движения' : motionEnabled ? 'Город · пауза' : 'Город · оживить'}
    </button>}
    <button className="city-motion-toggle" type="button" aria-expanded={expanded} aria-controls="ambient-city" onClick={toggleExpanded}>
      {expanded ? 'Свернуть город' : 'Показать город'}
    </button>
  </div>
</div>;
``` Once expanded, preserve mounted artwork across later collapse so the animation state can pause/resume. In `App.tsx` replace the current CityBackdrop invocation with:

```tsx
<CityBackdrop initiallyCollapsed />
```

Remove its `key`: switching runs must not reload/reinitialize the decorative scene. No sprite, atlas, timing, or grid edits.

- [ ] **3. Put goal first and disclose advanced team settings.**

Remove `<SquadPreview members={members} />` from `.composer-intro`. Wrap the existing team editor by replacing its opening `<div className="team-editor">` with these opening tags:

```tsx
<details className="team-settings" id="team-settings">
  <summary>Настроить команду · {members.length} {members.length < 5 ? 'участника' : 'участников'}</summary>
  <div className="team-editor">
```

Replace its matching closing `</div>` with `</div></details>`. Its existing member map and add-member button are preserved verbatim; this is a wrapper edit, not a reimplementation. Immediately before the disclosure insert:

```tsx
<p className="team-summary">{members.map(member =>
  `${member.name}${member.id === leaderId ? ' — лидер' : ''}`).join(' · ')}</p>
```

After that disclosure insert the relocated preview in its own native disclosure:

```tsx
<details className="squad-disclosure"><summary>Показать состав в сцене</summary>
  <SquadPreview members={members} />
</details>
```

Change the form opening to `<form noValidate onSubmit={submit}>` now, because required inputs may be inside closed team settings. The current explicit submission checks remain active; Task 8 improves their field guidance.

- [ ] **4. Replace affected layout declarations in their owning stylesheets.**

```css
/* city-backdrop.css: replace the collapsed rule and add its control alignment */
.city-scene-collapsed { height: 52px; border-bottom: 1px solid var(--pixel-rule); background: var(--pixel-paper); }
.city-scene-collapsed .city-motion-control { top: 4px; }

/* workspace-polish.css: replace these selectors, do not append a new override file */
.composer-intro { display: block; margin-bottom: 16px; }
.composer-intro h1 { margin-top: 12px; font-size: clamp(18px, 1.5vw, 22px); line-height: 1.5; }
.intro-copy { max-width: 60ch; font-size: 14px; line-height: 1.7; margin-top: 12px; }
.team-settings > summary { min-height: 44px; padding-block: 12px; cursor: pointer; }
.team-summary { font-size: 14px; line-height: 1.6; margin-bottom: 12px; }
.team-section { margin-top: 28px; }
```

Remove the obsolete two-column `.composer-intro` breakpoint declarations and `justify-self` rules tied to its old placement. Retain `.squad-preview` stage dimensions. Set `city-workspace.css` `.composer-content` top padding to `16px` and the existing `.workspace-grid` top margin to `16px`. Remove narrower breakpoint overrides that restore the old composer padding/title size; use the fluid rule above at every width. The acceptance test, not a guessed screenshot, determines whether further spacing adjustment is needed.

- [ ] **5. Verify and checkpoint.**

```sh
npm run test:e2e -- --grep 'workspace bootstrap|goal precedes|collapsed city'
node --import tsx --test tests/client.test.ts
npm run typecheck
```

Expected: all pass. Visually inspect expanded city and 2-/5-member preview at native size. Update the relevant docs as specified in Task 11 before the milestone commit. Include Task 1's harness/config changes in this first passing checkpoint. Local commit message: `feat: prioritize task creation and defer city artwork`.

## Task 3: Introduce a safe formatted document reader

**Files:** create `src/client/MarkdownDocument.tsx`, `ArtifactView.tsx`, `document.css`, `tests/markdown.test.ts`; modify `RunWorkspace.tsx:61`, `main.tsx`, `package.json`, `package-lock.json`.

- [ ] **1. Install Markdown dependencies and write security/rendering tests.**

```sh
npm install react-markdown remark-gfm
```

```ts
// tests/markdown.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownDocument } from '../src/client/MarkdownDocument';
const render = (body: string) => renderToStaticMarkup(createElement(MarkdownDocument, { body }));
test('documents have headings lists tables and safe links', () => {
  const html = render('# Heading\n\n- Item\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n[Source](https://example.com)');
  assert.match(html, /<h2>Heading<\/h2>/);
  assert.match(html, /<li>Item<\/li>/);
  assert.match(html, /<table>/);
  assert.match(html, /href="https:\/\/example.com"/);
});
test('model content cannot introduce HTML scripts images or dangerous links', () => {
  const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29)\n\n![remote](https://example.com/track.png)');
  assert.doesNotMatch(html, /<script|<img|onerror=|href="javascript:/i);
});
```

Run `node --import tsx --test tests/markdown.test.ts`; expected missing module FAIL.

- [ ] **2. Create the document component with a deliberately narrow link policy.**

```tsx
// src/client/MarkdownDocument.tsx
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
const plugins = [remarkGfm];
function documentUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
export function MarkdownDocument({ body }: { body: string }) {
  return <div className="markdown-document"><Markdown remarkPlugins={plugins} skipHtml
    urlTransform={documentUrl} components={{
      h1: ({ children }) => <h2>{children}</h2>,
      img: ({ alt }) => <span className="document-image-note">[Изображение: {alt || 'без подписи'}]</span>,
      a: ({ href, children }) => href
        ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        : <span>{children}</span>,
      table: ({ children }) => <div className="document-table" tabIndex={0} role="region" aria-label="Таблица документа"><table>{children}</table></div>,
    }}>{body}</Markdown></div>;
}
```

No `rehype-raw`, HTML injection, automatic external images, or `javascript:`/relative API links. Relative project links remain readable text in this iteration; do not reinterpret them as local filesystem access.

- [ ] **3. Create artifact actions and source disclosure.**

```tsx
// src/client/ArtifactView.tsx
import { useState } from 'react';
import type { Artifact } from '../shared/types';
import { MarkdownDocument } from './MarkdownDocument';
import { timeLabel } from './ui';
export function ArtifactView({ artifact, runId, label, author, expanded }: {
  artifact: Artifact; runId: string; label: string; author: string; expanded: boolean;
}) {
  const [notice, setNotice] = useState('');
  const document = <><MarkdownDocument body={artifact.body} />
    <details className="artifact-source"><summary>Исходный Markdown</summary><pre>{artifact.body}</pre></details></>;
  return <article className={`artifact ${expanded ? 'final-artifact' : ''}`}>
    <div className="artifact-heading"><div><div className="eyebrow">{label}</div>
      <h3>{artifact.title}</h3><p>{author} · {timeLabel(artifact.createdAt)}</p></div>
      <div className="artifact-actions"><button className="secondary-button" type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(artifact.body); setNotice('Markdown скопирован.'); }
        catch { setNotice('Копирование недоступно. Откройте исходный Markdown и выделите текст.'); }
      }}>Копировать Markdown</button>
      <a className="secondary-button" href={`/api/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifact.id)}`} download>Скачать Markdown</a></div>
    </div><p role="status">{notice}</p>
    {expanded ? document : <details className="artifact-disclosure"><summary>Документ: {artifact.title}</summary>{document}</details>}
  </article>;
}
```

In `RunWorkspace.tsx`, replace the artifact-map `<article>...</article>` with the component below. Preserve the existing `sortedArtifacts` and `latestFinalId` calculations:

```tsx
<ArtifactView key={artifact.id} artifact={artifact} runId={run.id}
  author={memberName(artifact.authorId)} expanded={artifact.id === latestFinalId}
  label={artifact.kind === 'final'
    ? artifact.id === latestFinalId
      ? run.status === 'completed' ? 'ПРИНЯТЫЙ ИТОГОВЫЙ РЕЗУЛЬТАТ' : 'ПОСЛЕДНИЙ ПРОЕКТ РЕЗУЛЬТАТА'
      : 'ПРЕДЫДУЩИЙ ПРОЕКТ РЕЗУЛЬТАТА'
    : artifact.kind === 'review' ? 'ОТЧЁТ РЕВЬЮ' : 'ДОКУМЕНТ УЧАСТНИКА'} />
```

Import `ArtifactView`; remove `DownloadSimple` if now unused. Task output `<pre>` is deliberately retained as raw agent output; accepted documents are the first reading priority.

- [ ] **4. Add scoped typography instead of changing global heading rules.**

```css
/* src/client/document.css */
.markdown-document { max-width: 72ch; font: 15px/1.7 var(--font-sans); overflow-wrap: anywhere; }
.markdown-document :is(h2,h3,h4,h5,h6) { font-family: var(--font-sans); line-height: 1.3; margin-block: 24px 12px; font-weight: 600; }
.markdown-document h2 { font-size: 24px; }
.markdown-document h3 { font-size: 20px; }
.markdown-document :is(p,ul,ol,blockquote,pre,table) { margin-block: 12px; }
.markdown-document ul { list-style: disc; padding-inline-start: 24px; }
.markdown-document ol { list-style: decimal; padding-inline-start: 24px; }
.markdown-document a { text-decoration: underline; text-underline-offset: 3px; }
.markdown-document pre, .artifact-source pre { overflow-x: auto; white-space: pre; padding: 16px; background: var(--pixel-surface); max-width: 100%; }
.document-table { max-width: 100%; overflow-x: auto; }
.document-table table { border-collapse: collapse; min-width: 100%; }
.document-table :is(th,td) { text-align: start; padding: 8px 12px; border: 1px solid var(--pixel-rule); }
.artifact-heading { flex-wrap: wrap; }
.artifact-actions { display: flex; flex-wrap: wrap; gap: 12px; }
.artifact-source { margin-top: 24px; }
```

Add `import './document.css';` to `main.tsx` after existing imports. This is a new component stylesheet, not another global override layer.

- [ ] **5. Verify rendering and existing artifact semantics.**

```sh
node --import tsx --test tests/markdown.test.ts tests/client.test.ts
npm run typecheck
npm run build
```

Expected PASS including existing latest-final ordering and download-path tests. Inspect a wide table and long code block on mobile in the isolated fixture. Commit after focused review/docs: `feat: render readable and safe result documents`.

## Task 4: Make completion result-first and recovery actionable

**Files:** create `src/client/RunContext.tsx`, `tests/run-context.test.ts`; modify `RunWorkspace.tsx:35–66`, `workspace-polish.css`, `tests/e2e/workspace.spec.ts`.

- [ ] **1. Write focused stage/recovery tests before the component.**

```ts
// tests/run-context.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RunContext } from '../src/client/RunContext';
import { completed } from './e2e/fixtures';
const render = (run: typeof completed) => renderToStaticMarkup(createElement(RunContext, { run, onClarify: () => {} }));
test('paused runs expose the latest review without inventing a verdict', () => {
  const html = render({ ...completed, status: 'paused', phase: 'synthesize', artifacts: [
    { id: 'r', title: 'Review', kind: 'review', body: 'Добавить источники', authorId: 'b', createdAt: completed.updatedAt },
  ] });
  assert.match(html, /Последнее ревью/);
  assert.match(html, /Добавить источники/);
  assert.match(html, /Уточнить задачу/);
  assert.doesNotMatch(html, /Ревью одобрено|Изменения запрошены/);
});
test('a normal pause without review has a clarification action but no fabricated review', () => {
  const html = render({ ...completed, status: 'paused', phase: 'tasks', artifacts: [] });
  assert.match(html, /Уточнить задачу/);
  assert.doesNotMatch(html, /Последнее ревью/);
});
```

The fixture's Playwright import is type-only; importing it in Node does not start a browser. Run `node --import tsx --test tests/run-context.test.ts`; expected missing module FAIL.

- [ ] **2. Create the stage/review context and optional encounter.**

```tsx
// src/client/RunContext.tsx
import { useState } from 'react';
import type { Run } from '../shared/types';
import { Encounter } from './Encounter';
import { MarkdownDocument } from './MarkdownDocument';
const phases: Array<{ id: Run['phase']; label: string }> = [
  { id: 'plan', label: 'План' }, { id: 'tasks', label: 'Задачи' },
  { id: 'synthesize', label: 'Итог' }, { id: 'review', label: 'Ревью' }, { id: 'done', label: 'Готово' },
];
export function RunContext({ run, onClarify }: { run: Run; onClarify: () => void }) {
  const needsAttention = run.status === 'paused' || run.status === 'failed';
  const review = [...run.artifacts].filter(item => item.kind === 'review')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
  return <section className="run-context" aria-label="Этапы и дальнейшие действия">
    <ol className="phase-list" aria-label="Этапы работы">{phases.map(phase =>
      <li key={phase.id} aria-current={run.phase === phase.id ? 'step' : undefined}>{phase.label}</li>)}</ol>
    {needsAttention && <div className="recovery-context">
      {review && <details open><summary>Последнее ревью</summary><MarkdownDocument body={review.body} /></details>}
      <button type="button" className="secondary-button" onClick={onClarify}>Уточнить задачу</button>
      <p>Уточнение отправляется отдельно. Чтобы возобновить работу после отправки, нажмите «Продолжить».</p>
    </div>}
  </section>;
}
export function EncounterPanel({ run }: { run: Run }) {
  const [expanded, setExpanded] = useState(run.status === 'running' || run.status === 'planning');
  return <details className="encounter-panel" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>Сцена команды</summary>{expanded && <Encounter run={run} />}
  </details>;
}
```

Only the actual current phase is marked. Do not mark all preceding phases successful: review can return the run to synthesis. The latest review is context, not proof that it caused every pause.

- [ ] **3. Integrate without changing mutation semantics or completion focus behavior.**

Import `RunContext, EncounterPanel` and remove the direct `Encounter` import. Immediately after the existing `run.error` and local error notes insert:

```tsx
<RunContext run={run} onClarify={() => document.getElementById('steering')?.focus()} />
```

Replace the existing standalone `<Encounter run={run} />` with:

```tsx
{run.status !== 'completed' && <EncounterPanel run={run} />}
```

After the `</section>` ending the tab panel, insert:

```tsx
{run.status === 'completed' && <EncounterPanel run={run} />}
```

Keep `useRunAnnouncement`, existing approval/version mutation, completion notice, tab keyboard behavior, and steering `startedActive` logic unchanged. In the existing top paused/failed button, choose secondary styling when a review exists, so correction is not visually subordinate:

```tsx
className={run.artifacts.some(artifact => artifact.kind === 'review') ? 'secondary-button' : 'primary-button'}
```

Keep labels “Продолжить” / “Повторить шаг” and the original `action('resume', 'control', { action: 'resume' })`. The clarification action only focuses the field; it does not submit or resume.

- [ ] **4. Add quiet stage/disclosure styles.**

```css
.phase-list { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-block: 20px; font: 13px/1.6 var(--font-sans); color: var(--color-muted); }
.phase-list [aria-current='step'] { color: var(--pixel-ink); font-weight: 600; text-decoration: underline; text-underline-offset: 5px; }
.recovery-context { padding: 16px; border: 1px solid var(--pixel-rule); margin-bottom: 24px; }
.recovery-context > p { margin-top: 12px; font-size: 13px; }
.recovery-context > button { margin-top: 16px; }
.encounter-panel > summary { min-height: 44px; padding-block: 12px; cursor: pointer; }
.encounter-panel { margin-block: 16px; }
```

- [ ] **5. Prove the result's position using a browser test and retain existing approval tests.**

```ts
test('completed result is above the optional encounter', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /Проверяемый результат/ }).click();
  const result = page.getByRole('heading', { name: 'План проверки', exact: true });
  await expect(result).toBeVisible();
  expect((await result.boundingBox())!.y).toBeLessThan(900);
  expect(await page.locator('.artifact').first().evaluate(el =>
    Boolean(el.compareDocumentPosition(document.querySelector('.encounter-panel')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(page.locator('.encounter-stage')).toHaveCount(0);
});
```

```sh
node --import tsx --test tests/run-context.test.ts tests/client.test.ts
npm run test:e2e -- --grep 'completed result'
npm run typecheck
```

Expected PASS. Verify a planning/active fixture still offers the encounter, a paused fixture does not pretend all workflow stages are complete, and clarification focus reaches the labelled field. Commit after review/docs: `feat: prioritize results and surface recovery context`.

## Task 5: Create validated, failure-aware per-tab draft storage

**Files:** create `src/client/draftStorage.ts`, `useBrowserDraft.ts`, `tests/draft-storage.test.ts`.

- [ ] **1. Write codec tests that cover corrupt and incomplete editor data.**

```ts
// tests/draft-storage.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { composerDraftSchema, readDraft, writeDraft, steeringDraftSchema } from '../src/client/draftStorage';
const draft = { goal: '', mode: 'demo' as const, leaderId: 'a', members: [
  { id: 'a', name: '', connectionId: 'missing-provider', model: '', role: '' },
  { id: 'b', name: 'Reviewer', connectionId: 'claude', model: '', role: '' },
] };
const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
};
test('incomplete draft round trips without changing provider identity', () => {
  const store = memory();
  assert.equal(writeDraft(store, 'draft', draft), '');
  assert.deepEqual(readDraft(store, 'draft', composerDraftSchema).value, draft);
});
test('corrupt oversized or wrong-version storage is rejected visibly', () => {
  const store = memory();
  for (const raw of ['{', 'x'.repeat(600_001), JSON.stringify({ version: 2, value: draft })]) {
    store.setItem('draft', raw);
    assert.equal(readDraft(store, 'draft', composerDraftSchema).value, undefined);
    assert.ok(readDraft(store, 'draft', composerDraftSchema).error);
  }
});
test('duplicate members and invalid leader cannot be restored', () => {
  assert.equal(composerDraftSchema.safeParse({ ...draft, leaderId: 'missing' }).success, false);
  assert.equal(composerDraftSchema.safeParse({ ...draft, members: [draft.members[0], draft.members[0]] }).success, false);
});
test('denied storage never crashes or claims to save', () => {
  const store = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
  assert.ok(readDraft(store, 'draft', steeringDraftSchema).error);
  assert.ok(writeDraft(store, 'draft', 'unsaved'));
});
```

Run `node --import tsx --test tests/draft-storage.test.ts`; expected missing module FAIL.

- [ ] **2. Implement storage codecs and editor-only schemas.**

```ts
// src/client/draftStorage.ts
import { z } from 'zod';
const member = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  name: z.string().max(80), connectionId: z.string().max(100), model: z.string().max(300), role: z.string().max(300) }).strict();
export const composerDraftSchema = z.object({ goal: z.string().max(12000), mode: z.enum(['live', 'demo']),
  members: z.array(member).min(2).max(5), leaderId: z.string().max(80) }).strict().refine(value =>
  new Set(value.members.map(item => item.id)).size === value.members.length &&
  value.members.some(item => item.id === value.leaderId), 'Invalid team');
export type ComposerDraft = z.infer<typeof composerDraftSchema>;
export const steeringDraftSchema = z.string().max(8000);
export function readDraft<T>(store: Pick<Storage, 'getItem'>, key: string, schema: z.ZodType<T>): { value?: T; error: string } {
  try {
    const raw = store.getItem(key);
    if (raw === null) return { error: '' };
    if (raw.length > 600_000) return { error: 'Сохранённый черновик слишком велик и не загружен.' };
    const envelope = z.object({ version: z.literal(1), value: schema }).strict().safeParse(JSON.parse(raw));
    return envelope.success ? { value: envelope.data.value, error: '' }
      : { error: 'Сохранённый черновик повреждён или устарел. Начат новый черновик.' };
  } catch { return { error: 'Черновик не удалось восстановить. Сохранение в этой вкладке может быть недоступно.' }; }
}
export function writeDraft<T>(store: Pick<Storage, 'setItem'>, key: string, value: T): string {
  try { store.setItem(key, JSON.stringify({ version: 1, value })); return ''; }
  catch { return 'Черновик не сохранён. Не закрывайте вкладку; скопируйте важный текст.'; }
}
```

Do not import server validation modules: they pull provider/server dependencies into the client. Empty fields are valid *drafts*, not valid run submissions. No CSRF token, executable path, run session ID, or provider credential belongs in these schemas.

- [ ] **3. Implement the hook without a delayed write or mount-time overwrite.**

```ts
// src/client/useBrowserDraft.ts
import { useCallback, useRef, useState } from 'react';
import type { z } from 'zod';
import { readDraft, writeDraft } from './draftStorage';
export function useBrowserDraft<T>(key: string, schema: z.ZodType<T>, createDefault: () => T) {
  const [initial] = useState(() => {
    if (typeof window === 'undefined') return { value: createDefault(), error: '' };
    try { const loaded = readDraft(window.sessionStorage, key, schema);
      return { value: loaded.value ?? createDefault(), error: loaded.error }; }
    catch { return { value: createDefault(), error: 'Хранилище вкладки недоступно. Черновик останется только в памяти.' }; }
  });
  const [value, setValue] = useState<T>(initial.value);
  const [storageError, setStorageError] = useState(initial.error);
  const current = useRef(value);
  const update = useCallback((next: T | ((previous: T) => T)) => {
    const resolved = typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next;
    current.current = resolved;
    setValue(resolved);
    try { setStorageError(writeDraft(window.sessionStorage, key, resolved)); }
    catch { setStorageError('Черновик не сохранён. Хранилище вкладки недоступно.'); }
  }, [key]);
  const reset = useCallback((next: T) => {
    current.current = next; setValue(next);
    try { window.sessionStorage.removeItem(key); setStorageError(''); }
    catch { setStorageError('Не удалось удалить сохранённый черновик из хранилища вкладки.'); }
  }, [key]);
  return { value, update, reset, storageError };
}
```

The key is stable for a mounted editor: Composer has one key; RunWorkspace already remounts per run. Writes happen synchronously in edit handlers, never as a delayed effect that could overwrite a newer draft or re-create one after successful submission.

- [ ] **4. Verify and checkpoint.**

```sh
node --import tsx --test tests/draft-storage.test.ts
npm run typecheck
```

Expected PASS. Add a schema bound test for an 8001-character steering value and 12001-character goal using the existing pattern:

```ts
test('draft text limits are enforced', () => {
  assert.equal(steeringDraftSchema.safeParse('x'.repeat(8001)).success, false);
  assert.equal(composerDraftSchema.safeParse({ ...draft, goal: 'x'.repeat(12001) }).success, false);
});
```

Commit after review: `feat: add validated per-tab draft storage`.

## Task 6: Preserve creation and steering drafts in the actual editors

**Files:** modify `src/client/Composer.tsx:18–24,51–61,73–97`, `RunWorkspace.tsx:15,29–31,64`, `tests/e2e/workspace.spec.ts`.

- [ ] **1. Add navigation/reload and failed-submit regression tests.**

```ts
test('creation draft survives visiting a run and reloading', async ({ page }) => {
  await mockWorkspace(page); await page.goto('/');
  await page.getByLabel('Что нужно сделать?', { exact: true }).fill('Сохранить это описание задачи');
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /Проверяемый результат/ }).click();
  await page.getByRole('button', { name: 'Новая задача', exact: true }).click();
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toHaveValue('Сохранить это описание задачи');
  await page.reload();
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toHaveValue('Сохранить это описание задачи');
});
test('failed creation preserves the draft and explicit clear removes it', async ({ page }) => {
  await mockWorkspace(page); await page.goto('/');
  await page.getByLabel('Что нужно сделать?', { exact: true }).fill('Сохранить после ошибки запроса');
  await page.getByRole('button', { name: 'Составить план', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic request rejected');
  await page.reload();
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toHaveValue('Сохранить после ошибки запроса');
  await page.getByRole('button', { name: 'Очистить черновик', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toHaveValue('');
});
```

Run `npm run test:e2e -- --grep 'creation draft|failed creation'`; expected FAIL before wiring.

- [ ] **2. Replace the four Composer state cells with one draft.**

Import `composerDraftSchema, type ComposerDraft` and `useBrowserDraft`. Keep `newMember` and provider preference sorting. Add this factory inside `Composer` before using the hook:

```tsx
const createDefaultDraft = (): ComposerDraft => {
  const sorted = [...connections].sort((a, b) => Number(b.available) - Number(a.available));
  const members = Array.from({ length: Math.min(3, Math.max(2, sorted.length)) },
    (_, index) => newMember(sorted[index] || sorted[0], index));
  return { goal: '', mode: 'live', members, leaderId: members[0]?.id || '' };
};
const draft = useBrowserDraft('power-agents:composer:v1', composerDraftSchema, createDefaultDraft);
const { goal, mode, members, leaderId } = draft.value;
const setGoal = (goal: string) => draft.update(value => ({ ...value, goal }));
const setMode = (mode: 'live' | 'demo') => draft.update(value => ({ ...value, mode }));
const setLeaderId = (leaderId: string) => draft.update(value => ({ ...value, leaderId }));
const setMembers = (next: Member[] | ((value: Member[]) => Member[])) => draft.update(value => {
  const members = typeof next === 'function' ? next(value.members) : next;
  return { ...value, members, leaderId: members.some(member => member.id === value.leaderId) ? value.leaderId : members[0].id };
});
```

Delete the original goal/mode/members/leader `useState` declarations. Existing immutable setters continue to work; remove the now-redundant separate leader correction in the delete handler. In `submit`, immediately after successful `await onCreate(...)`, call `draft.reset(createDefaultDraft())`; do not reset in `catch` or `finally`. Disable editable fieldsets during `busy` so a successful create cannot discard text entered while the request was pending. Wrap the goal/team controls in `<fieldset disabled={busy}>` without moving the launch action outside its form; retain the existing submit button's disabled handling.

Add immediately before the launch panel:

```tsx
<p className="draft-note">Черновик сохраняется в этой вкладке и восстанавливается после обновления страницы.</p>
<ErrorNote>{draft.storageError}</ErrorNote>
<button type="button" className="text-button" disabled={busy} onClick={() => draft.reset(createDefaultDraft())}>Очистить черновик</button>
```

For a restored unknown provider, insert this option before mapping existing connections; do not silently select a different provider:

```tsx
{!connections.some(connection => connection.id === member.connectionId) &&
  <option value={member.connectionId}>Недоступное подключение: {member.connectionId || 'не выбрано'}</option>}
```

- [ ] **3. Wire run-specific steering storage while preserving the existing race guard.**

Import `steeringDraftSchema` and `useBrowserDraft`; replace the `body` state with:

```tsx
const steeringDraft = useBrowserDraft(`power-agents:steering:${run.id}:v1`, steeringDraftSchema, () => '');
const body = steeringDraft.value;
const setBody = steeringDraft.update;
```

Leave `submittedBody` capture and `setBody(current => current === submittedBody ? '' : current)` after success intact. A newer edit must survive an in-flight message response. Render `<ErrorNote>{steeringDraft.storageError}</ErrorNote>` immediately before the steering form. Extend its visibility condition from `(isActive || startedActive)` to `(isActive || startedActive || !!body)` so a restored draft on a terminal run remains readable/copyable. Update its terminal hint to say it remains saved in this tab and cannot be sent.

- [ ] **4. Add a real in-flight message race test using the fixture transport.**

```ts
test('newer steering text survives a successful in-flight send', async ({ page }) => {
  const paused = { ...completed, status: 'paused' as const, phase: 'tasks' as const };
  await mockWorkspace(page, [paused]);
  let release: (() => void) | undefined;
  await page.route('**/api/runs/review-fixture/messages', async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { run: paused } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /Проверяемый результат/ }).click();
  const field = page.getByLabel('Направьте команду', { exact: true });
  await field.fill('Первое уточнение');
  await page.getByRole('button', { name: 'Отправить команде', exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await field.fill('Следующее уточнение');
  release!();
  await expect(field).toHaveValue('Следующее уточнение');
  await expect(page.getByRole('button', { name: 'Отправить команде', exact: true })).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /Проверяемый результат/ }).click();
  await expect(field).toHaveValue('Следующее уточнение');
});
```

- [ ] **5. Verify and checkpoint.**

```sh
npm run test:e2e -- --grep 'creation draft|failed creation|newer steering'
node --import tsx --test tests/draft-storage.test.ts tests/client.test.ts
npm run typecheck
```

Expected PASS. Confirm only editor fields appear under the two session-storage prefixes. Commit after review/docs: `feat: retain local editor drafts across navigation`.

## Task 7: Add deep links and a real history destination

**Files:** create `src/client/navigation.ts`, `useWorkspaceLocation.ts`, `HistoryView.tsx`, `tests/navigation.test.ts`; modify `App.tsx:45,156–170,205,220`, `RunWorkspace.tsx:8–15,53–58`, `tests/e2e/workspace.spec.ts`.

- [ ] **1. Write route-codec tests with explicit invalid inputs.**

```ts
// tests/navigation.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation, formatLocation } from '../src/client/navigation';
test('run and tab links round trip', () => {
  const route = { view: 'run' as const, runId: 'run_123', tab: 'artifacts' as const };
  assert.deepEqual(parseLocation(formatLocation(route)), route);
  assert.deepEqual(parseLocation('#/runs'), { view: 'history' });
  assert.deepEqual(parseLocation(''), { view: 'new' });
});
test('malformed paths IDs and tabs get a missing-route state', () => {
  for (const value of ['#/runs/%', '#/runs/..', '#/runs/id?tab=unknown', '#/admin', '#/runs/id/extra'])
    assert.deepEqual(parseLocation(value), { view: 'missing' });
});
```

Run `node --import tsx --test tests/navigation.test.ts`; expected missing module FAIL.

- [ ] **2. Implement the pure route contract and browser hook.**

```ts
// src/client/navigation.ts
export const workspaceTabs = ['tasks', 'messages', 'artifacts', 'events'] as const;
export type WorkspaceTab = typeof workspaceTabs[number];
export type WorkspaceLocation = { view: 'new' } | { view: 'history' } | { view: 'missing' }
  | { view: 'run'; runId: string; tab?: WorkspaceTab };
export function parseLocation(hash: string): WorkspaceLocation {
  if (!hash || hash === '#' || hash === '#/new') return { view: 'new' };
  if (hash === '#/runs') return { view: 'history' };
  const match = /^#\/runs\/([a-zA-Z0-9_-]{1,80})(?:\?tab=(tasks|messages|artifacts|events))?$/.exec(hash);
  return match ? { view: 'run', runId: match[1], ...(match[2] ? { tab: match[2] as WorkspaceTab } : {}) }
    : { view: 'missing' };
}
export function formatLocation(route: WorkspaceLocation): string {
  if (route.view === 'new') return '#/new';
  if (route.view === 'history') return '#/runs';
  if (route.view === 'missing') return '#/missing';
  return `#/runs/${encodeURIComponent(route.runId)}${route.tab ? `?tab=${route.tab}` : ''}`;
}
```

```ts
// src/client/useWorkspaceLocation.ts
import { useCallback, useEffect, useState } from 'react';
import { formatLocation, parseLocation, type WorkspaceLocation } from './navigation';
export function useWorkspaceLocation() {
  const [location, setLocation] = useState<WorkspaceLocation>(() =>
    typeof window === 'undefined' ? { view: 'new' } : parseLocation(window.location.hash));
  useEffect(() => {
    const sync = () => setLocation(parseLocation(window.location.hash));
    window.addEventListener('hashchange', sync); window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);
  const navigate = useCallback((next: WorkspaceLocation) => {
    const hash = formatLocation(next);
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setLocation(next);
  }, []);
  return { location, navigate };
}
```

Run IDs are already server-generated UUIDs; the broader bounded ASCII pattern also supports existing test IDs. Never put task text, tokens, or provider sessions into the fragment.

- [ ] **3. Create a history screen with honest loaded-only search.**

```tsx
// src/client/HistoryView.tsx
import { useState } from 'react';
import type { RunSummary } from '../shared/types';
import { dateLabel, statusLabels } from './ui';
export function HistoryView({ runs, totalRuns, hasMore, loading, loadMore, select }: {
  runs: RunSummary[]; totalRuns: number; hasMore: boolean; loading: boolean;
  loadMore: () => void; select: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const visible = runs.filter(run => (status === 'all' || run.status === status)
    && run.title.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  return <main className="main-content history-content">
    <h1 id="workspace-heading" tabIndex={-1}>Все задачи</h1>
    <p>Загружено {runs.length} из {totalRuns} запусков.</p>
    <div className="history-filters"><label>Поиск среди загруженных запусков
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>Статус<select value={status} onChange={event => setStatus(event.target.value)}>
        <option value="all">Все статусы</option>
        {(['planning','awaiting_approval','running','paused','completed','failed','cancelled'] as const)
          .map(value => <option value={value} key={value}>{statusLabels[value]}</option>)}
      </select></label></div>
    <p role="status">Найдено среди загруженных: {visible.length}</p>
    {visible.length ? <ul className="history-results">{visible.map(run => <li key={run.id}>
      <button type="button" onClick={() => select(run.id)}><strong>{run.title}</strong>
        <span>{statusLabels[run.status]} · {dateLabel(run.createdAt)}{run.mode === 'demo' ? ' · Демо' : ''}</span>
      </button></li>)}</ul> : <p>{runs.length ? 'Совпадений среди загруженных запусков нет.' : 'Запусков пока нет.'}</p>}
    {hasMore && <button type="button" className="secondary-button" disabled={loading} onClick={loadMore}>
      {loading ? 'Загружаем…' : 'Загрузить более ранние запуски'}</button>}
  </main>;
}
```

Add in `workspace-polish.css`:

```css
.history-content { max-width: 960px; margin-inline: auto; padding-inline: 16px; }
.history-filters { display: flex; flex-wrap: wrap; gap: 16px; margin-block: 24px; }
.history-filters label { display: grid; gap: 8px; flex: 1 1 240px; font-size: 14px; }
.history-filters :is(input,select) { min-height: 44px; border: 1px solid var(--pixel-rule); padding: 8px; min-width: 0; }
.history-results button { display: grid; gap: 8px; text-align: start; width: 100%; padding: 16px 0; border-bottom: 1px solid var(--pixel-rule); overflow-wrap: anywhere; }
.history-results span { font-size: 13px; color: var(--color-muted); }
```

- [ ] **4. Wire App without weakening request cancellation or stream recovery.**

Import the hook, `WorkspaceLocation` type and `HistoryView`. Replace the selected-ID state declaration with:

```tsx
const { location, navigate } = useWorkspaceLocation();
const selectedId = location.view === 'run' ? location.runId : null;
```

Retain `selectedRef`, all selected-ID abort guards, `mergeDetail`, bootstrap/session handling and event pagination. Replace `select` with:

```tsx
function goTo(next: WorkspaceLocation) {
  pendingHeadingFocus.current = true;
  setNavigationVersion(version => version + 1);
  navigate(next); setSidebarOpen(false);
}
function select(id: string | null) {
  goTo(id ? { view: 'run', runId: id } : { view: 'new' });
}
```

Add an effect to cover browser Back/Forward (not just click navigation), declared before the existing heading-focus effect:

```tsx
useEffect(() => {
  pendingHeadingFocus.current = true;
  setNavigationVersion(version => version + 1);
}, [location.view, selectedId]);
```

Use `location.view === 'new'` instead of `!selectedId` for creation selection styling. The drawer “Все задачи” button calls `goTo({ view: 'history' })`; it is selected only on history. Define this complete content expression before App's return:

```tsx
const workspace = !bootstrap
  ? <div className="bootstrap-state">{error
      ? <><ErrorNote>{error}</ErrorNote><button className="secondary-button" onClick={() => void refresh()}>Повторить подключение</button></>
      : <><div className="skeleton skeleton-title" /><div className="skeleton skeleton-composer" /><p>Подключаем рабочее пространство…</p></>}</div>
  : location.view === 'history'
    ? <HistoryView runs={bootstrap.runs} totalRuns={bootstrap.totalRuns} hasMore={!!bootstrap.nextCursor}
        loading={loadingHistory} loadMore={() => void loadOlderRuns()} select={id => select(id)} />
    : location.view === 'missing'
      ? <main className="main-content"><h1 id="workspace-heading" tabIndex={-1}>Страница не найдена</h1>
          <button className="secondary-button" onClick={() => goTo({ view: 'history' })}>Открыть историю</button></main>
      : selectedId
        ? detail
          ? <RunWorkspace key={detail.run.id} detail={detail} mutate={mutate} loadOlderEvents={loadOlderEvents}
              tabOverride={location.view === 'run' ? location.tab : undefined}
              onTabChange={tab => navigate({ view: 'run', runId: selectedId, tab })} />
          : <div className="bootstrap-state">{detailError
              ? <><ErrorNote>{detailError}</ErrorNote>
                  <button className="secondary-button" onClick={() => {
                    const id = selectedId;
                    setDetailError('');
                    request<RunDetail>(`/api/runs/${encodeURIComponent(id)}`).then(incoming => {
                      if (selectedRef.current === id) setDetail(current => mergeDetail(current, incoming));
                    }).catch(cause => { if (selectedRef.current === id) setDetailError(String(cause)); });
                  }}>Повторить</button>
                  <button className="secondary-button" onClick={() => goTo({ view: 'history' })}>Открыть историю</button></>
              : <><div className="skeleton skeleton-title" /><div className="skeleton skeleton-composer" /><p>Загружаем задачу…</p></>}</div>
        : <Composer connections={bootstrap.connections} onCreate={create} openSettings={() => setSettings(true)} loadModels={loadModels} />;
```

Replace the former bootstrap/run/composer expression after CityBackdrop with:

```tsx
{bootstrap && error && <div className="px-8 pt-4"><ErrorNote>{error}</ErrorNote></div>}
{workspace}
```

Direct run links fetch by ID even when their summary is absent from the loaded history. Stale retry responses keep the same selected-run guard as ordinary detail fetching.

- [ ] **5. Make tabs route-aware without hijacking completion.**

In `RunWorkspace`, import `WorkspaceTab`. Extend `Props` with:

```ts
tabOverride?: WorkspaceTab;
onTabChange?: (tab: WorkspaceTab) => void;
```

Destructure them. Replace the existing tab state with:

```tsx
const [localTab, setLocalTab] = useState<WorkspaceTab>(run.status === 'completed' ? 'artifacts' : 'tasks');
const tab = tabOverride ?? localTab;
const setTab = (next: WorkspaceTab) => { setLocalTab(next); onTabChange?.(next); };
```

Use this `setTab` in existing click/arrow/Home/End/completion-notice handlers. Do not add an effect that switches to Results whenever status changes. A direct `?tab=messages` link to a completed run must remain on Discussion.

- [ ] **6. Add route/history tests and verify browser navigation.**

```ts
test('direct run links restore tabs and browser back restores selection', async ({ page }) => {
  await mockWorkspace(page); await page.goto('/#/runs/review-fixture?tab=messages');
  await expect(page.getByRole('tab', { name: /^Обсуждение/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: /^Результаты/ }).click();
  await expect(page).toHaveURL(/tab=artifacts$/);
  await page.goBack();
  await expect(page.getByRole('tab', { name: /^Обсуждение/ })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.getByRole('tab', { name: /^Обсуждение/ })).toHaveAttribute('aria-selected', 'true');
});
test('all tasks opens searchable loaded history rather than creation', async ({ page }) => {
  await mockWorkspace(page); await page.goto('/');
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /^Все задачи/ }).click();
  await expect(page.getByRole('heading', { name: 'Все задачи', exact: true })).toBeVisible();
  await page.getByLabel('Поиск среди загруженных запусков').fill('несуществующее');
  await expect(page.getByText('Совпадений среди загруженных запусков нет.')).toBeVisible();
});
```

```sh
node --import tsx --test tests/navigation.test.ts tests/client.test.ts
npm run test:e2e
npm run typecheck
```

Expected PASS, including the earlier draft tests. Commit after review/docs: `feat: add run deep links and an explicit history view`.

## Task 8: Add field-specific validation with focus recovery

**Files:** create `src/client/composerValidation.ts`, `tests/composer-validation.test.ts`; modify `Composer.tsx:52–57,73–96`, `ModelPicker.tsx`, `tests/e2e/workspace.spec.ts`.

- [ ] **1. Write ordered validation tests.**

```ts
// tests/composer-validation.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateComposer } from '../src/client/composerValidation';
import { completed, connections } from './e2e/fixtures';
const input = { goal: 'Enough detail for a goal', members: completed.members, leaderId: 'a', mode: 'live' as const };
test('short goal is the first actionable error', () => {
  assert.deepEqual(validateComposer({ ...input, goal: 'short' }, connections)[0],
    { fieldId: 'goal', message: 'Опишите цель подробнее: минимум 10 символов.' });
});
test('missing API model points to the exact member and demo does not require it', () => {
  const api = { id: 'openai-api', name: 'OpenAI', kind: 'openai-api' as const, available: true, detail: '' };
  const members = input.members.map((member, index) => index === 0 ? { ...member, connectionId: api.id } : member);
  assert.ok(validateComposer({ ...input, members }, [...connections, api]).some(error => error.fieldId === 'model-a'));
  assert.deepEqual(validateComposer({ ...input, members, mode: 'demo' }, [...connections, api]), []);
});
test('unavailable connection and blank name identify their fields', () => {
  const members = input.members.map((member, index) => index === 0 ? { ...member, name: '', connectionId: 'missing' } : member);
  assert.deepEqual(validateComposer({ ...input, members }, connections).map(error => error.fieldId), ['name-a', 'connection-a']);
});
```

Run `node --import tsx --test tests/composer-validation.test.ts`; expected FAIL before implementation.

- [ ] **2. Implement deterministic errors in visible field order.**

```ts
// src/client/composerValidation.ts
import type { Connection, CreateRunInput } from '../shared/types';
export type ComposerIssue = { fieldId: string; message: string };
export function validateComposer(input: CreateRunInput, connections: Connection[]): ComposerIssue[] {
  const goal: ComposerIssue[] = input.goal.trim().length < 10
    ? [{ fieldId: 'goal', message: 'Опишите цель подробнее: минимум 10 символов.' }] : [];
  return [...goal, ...input.members.flatMap(member => {
    const connection = connections.find(item => item.id === member.connectionId);
    return [
      ...(!member.name.trim() ? [{ fieldId: `name-${member.id}`, message: 'Укажите имя участника.' }] : []),
      ...(!connection || input.mode === 'live' && !connection.available
        ? [{ fieldId: `connection-${member.id}`, message: 'Выберите доступное подключение для этого участника.' }] : []),
      ...(input.mode === 'live' && connection?.kind.endsWith('-api') && !member.model.trim()
        ? [{ fieldId: `model-${member.id}`, message: 'Выберите модель для API-подключения.' }] : []),
    ];
  })];
}
```

Server request validation remains authoritative; these are editor corrections, not a replacement for protocol validation.

- [ ] **3. Wire errors and expand/focus the offending field.**

Import `validateComposer, type ComposerIssue`. Add:

```tsx
const [issues, setIssues] = useState<ComposerIssue[]>([]);
const issueFor = (id: string) => issues.find(issue => issue.fieldId === id);
const issueProps = (id: string, help?: string) => ({
  'aria-invalid': issueFor(id) ? true : undefined,
  'aria-describedby': [help, issueFor(id) ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined,
});
const fieldError = (id: string) => issueFor(id)
  ? <p id={`${id}-error`} className="field-error">{issueFor(id)!.message}</p> : null;
```

Add `noValidate` to the composer form so native validation does not attempt to focus an input inside a closed disclosure. Replace the four current early-return checks with:

```tsx
const nextIssues = validateComposer({ goal, mode, members, leaderId }, connections);
setIssues(nextIssues);
if (nextIssues.length) {
  setError('Проверьте отмеченные поля.');
  const field = document.getElementById(nextIssues[0].fieldId);
  const disclosure = field?.closest('details');
  if (disclosure) disclosure.open = true;
  requestAnimationFrame(() => {
    const target = field instanceof HTMLSelectElement && field.disabled
      ? field.closest<HTMLElement>('.model-picker') : field;
    target?.focus();
  });
  return;
}
```

Spread `issueProps('goal', 'goal-help')` on the goal textarea, replacing its static `aria-describedby`; insert `fieldError('goal')` next to it. Apply `issueProps`/`fieldError` to name and connection fields using their exact current IDs. Pass the model issue explicitly to `ModelPicker` so catalogue notes remain connected:

```tsx
error={issueFor(`model-${member.id}`)?.message}
```

Extend `ModelPicker` Props with `error?: string`, destructure `error`, and replace select's accessibility attributes with:

```tsx
aria-invalid={error ? true : undefined}
aria-describedby={[note ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
```

Make the root model picker focusable for the unavailable-model case: replace its opening tag with `<div className="model-picker" tabIndex={-1} role="group" aria-label="Выбор модели" aria-describedby={error ? `${id}-error` : undefined}>`. A disabled select cannot receive focus, so validation falls back to this group without enabling a model the server did not offer.

After the existing note/retry element render:

```tsx
{error && <p id={`${id}-error`} className="field-error">{error}</p>}
```

Add this issue-removal helper:

```tsx
const clearIssues = (...ids: string[]) => setIssues(current => current.filter(issue => !ids.includes(issue.fieldId)));
```

Replace the four edit handlers with the following expressions at their existing controls:

```tsx
// goal textarea onChange
onChange={event => { clearIssues('goal'); setGoal(event.target.value); }}
// participant name input onChange
onChange={event => { clearIssues(`name-${member.id}`); updateMember(member.id, { name: event.target.value }); }}
// participant connection select onChange
onChange={event => { clearIssues(`connection-${member.id}`, `model-${member.id}`); updateMember(member.id, { connectionId: event.target.value, model: '' }); }}
// ModelPicker onChange
onChange={model => { clearIssues(`model-${member.id}`); updateMember(member.id, { model }); }}
// explicit draft reset button onClick
onClick={() => { draft.reset(createDefaultDraft()); setIssues([]); setError(''); }}
```

Do not clear unrelated field errors when one field changes.

- [ ] **4. Add focus and invalid-state regression coverage.**

```ts
test('short goal validation returns focus to the field', async ({ page }) => {
  await mockWorkspace(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  const goal = page.getByLabel('Что нужно сделать?', { exact: true });
  await goal.fill('short');
  await page.getByRole('button', { name: 'Составить план', exact: true }).click();
  await expect(goal).toBeFocused();
  await expect(goal).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#goal-error')).toContainText('минимум 10');
});
test('invalid collapsed team expands before focusing the member', async ({ page }) => {
  await mockWorkspace(page); await page.goto('/');
  await page.getByLabel('Что нужно сделать?', { exact: true }).fill('Полная цель для проверки формы');
  await page.locator('#team-settings > summary').click();
  const name = page.getByLabel('Имя участника 1', { exact: true });
  await name.fill('');
  await page.locator('#team-settings > summary').click();
  await page.getByRole('button', { name: 'Составить план', exact: true }).click();
  await expect(page.locator('#team-settings')).toHaveAttribute('open', '');
  await expect(name).toBeFocused();
});
```

Add `.field-error { color: var(--color-error-text); font: 13px/1.6 var(--font-sans); margin-top: 8px; }` in `workspace-polish.css`; Task 9 defines the token, or temporarily declare it in the same root block as `#923f38` now.

- [ ] **5. Verify and checkpoint.**

```sh
node --import tsx --test tests/composer-validation.test.ts tests/client.test.ts
npm run test:e2e -- --grep 'validation|invalid collapsed'
npm run typecheck
```

Expected PASS. Commit after review/docs: `fix: connect validation errors to their fields`.

## Task 9: Consolidate touched design tokens and fix touch/overflow behavior

**Files:** modify `styles.css:5–19,97,294–534`, `workspace-polish.css`, `city-backdrop.css`, `city-workspace.css`; extend `tests/e2e/workspace.spec.ts`.

- [ ] **1. Add behavioral layout assertions before style changes.**

```ts
for (const width of [320, 390, 768, 1440]) {
  test(`no page overflow at ${width}px`, async ({ page }) => {
    await mockWorkspace(page); await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.locator('#team-settings > summary').click();
    const dimensions = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      available: document.documentElement.clientWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.available);
  });
}
test('phone functional controls have 44px targets', async ({ page }) => {
  await mockWorkspace(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.locator('#team-settings > summary').click();
  const bad = await page.locator('.header-nav button,.icon-button,.leader-button,.city-motion-toggle').evaluateAll(elements =>
    elements.map(element => ({ name: element.getAttribute('aria-label') || element.textContent,
      width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
      .filter(item => item.width > 0 && item.height > 0 && (item.width < 44 || item.height < 44)));
  expect(bad).toEqual([]);
});
```

Run `npm run test:e2e -- --grep 'page overflow|44px'`; expected target failures before the CSS change. For scrollbar coverage, also inspect with macOS “always show scrollbars” or a browser environment with persistent scrollbars; do not change the user's OS preference automatically.

- [ ] **2. Define one token owner for the properties this pass touches.**

Put these in the existing `@theme`/root definitions in `styles.css`; remove duplicate definitions of the same token from `workspace-polish.css`:

```css
@theme {
  --color-accent: #285baf;
  --color-muted: #526b8d;
  --color-line: #cbd4df;
  --font-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
:root {
  --pixel-blue: var(--color-accent);
  --pixel-rule: var(--color-line);
  --pixel-paper: #fffdf5;
  --pixel-surface: #f7f8f5;
  --pixel-ink: #173973;
  --control-border: #7185a0;
  --control-shadow: 3px 3px 0 var(--pixel-ink);
  --control-size: 44px;
  --color-error-text: #923f38;
  --duration-fast: 120ms;
}
body { margin: 0; min-width: 0; }
```

Preserve the existing pixel-font variable and `@font-face`. Do not replace provider identity colors or art palettes. Replace these exact repeated values in **touched UI selectors only**:

| Existing literal | Replacement |
| --- | --- |
| `#7185a0` form/card borders | `var(--control-border)` |
| `3px 3px 0 #173973` control shadow | `var(--control-shadow)` |
| `#cbd4df` rules | `var(--pixel-rule)` |
| `#f7f8f5` quiet surfaces | `var(--pixel-surface)` |
| `120ms` hover transitions | `var(--duration-fast)` |

Remove superseded declarations for `.composer-intro`, `.goal-card`, control heights, and header font sizes from the earlier Airy Pixel/late-size patches in `styles.css`, leaving the current effective component rules in `workspace-polish.css`. Keep unrelated legacy cleanup out of this pass. Compare before/after computed styles of the approved desktop before deleting each duplicate; do not flatten all five stylesheets blindly.

- [ ] **3. Use a shared touch-sized interaction area and readable functional labels.**

Update the existing mobile blocks in `workspace-polish.css`, rather than creating another trailing override file:

```css
@media (max-width: 767px), (pointer: coarse) {
  .header-brand, .header-nav button, .header-new-task,
  .primary-button, .secondary-button, .text-button, .leader-button,
  .city-motion-toggle, .combat-controls button, .send-button,
  .example-row button, .goal-details summary, .workspace-details > summary,
  .artifact-disclosure summary, .artifact-source summary,
  .team-settings > summary, .squad-disclosure > summary, .encounter-panel > summary {
    min-height: var(--control-size);
    min-width: var(--control-size);
  }
  .icon-button, .icon-button.subtle { width: var(--control-size); height: var(--control-size); min-width: var(--control-size); min-height: var(--control-size); }
  .field input, .field select, .name-input { min-height: var(--control-size); }
  .header-nav, .header-new-task, .workspace-tabs button,
  .eyebrow, .section-index, .goal-card .section-label, .goal-card .font-mono, .field label span,
  .squad-preview figcaption, .add-member span, .rail-member .text-xs,
  .example-row, .history-meta, .message-status, .message-head time {
    font-size: 12px;
  }
  .member-heading { grid-template-columns: 38px minmax(0, 1fr) 44px; }
  .demo-option { min-height: var(--control-size); }
  .squad-preview { max-width: 100%; overflow-x: auto; }
}
```

Modify city controls' own rule to use `min-height: var(--control-size)` and `font-size: 12px` so the stylesheet loaded later cannot reduce targets. Remove the obsolete 36px header heights in the narrower 479px block. Keep meaningful focus-visible outlines on controls/disclosures and the original reduced-motion override. Use `padding-bottom: max(32px, env(safe-area-inset-bottom))` for the mobile `.app-main` rule in `city-workspace.css`; incorporate `env(safe-area-inset-left/right)` into the existing 16px mobile container padding, without changing desktop artwork scale.

- [ ] **4. Verify before and after consolidation.**

```sh
npm run test:e2e -- --grep 'page overflow|44px|goal precedes'
npm run typecheck
npm run build
```

Expected PASS. Manually inspect 320/390/768/1440 creation, history, result table, settings and expanded encounter. The scrollbar exception is local to tables/code/art scenes, never the entire page. Commit after review: `fix: improve responsive controls and unify UI tokens`.

## Task 10: Complete browser regression coverage and add the CI gate

**Files:** extend `tests/e2e/workspace.spec.ts`, `tests/e2e/fixtures.ts` only where a specific test needs a response; modify `.github/workflows/ci.yml`.

- [ ] **1. Add keyboard, recovery and reduced-motion coverage.**

```ts
test('keyboard tabs and modal escape retain focus behavior', async ({ page }) => {
  await mockWorkspace(page); await page.goto('/#/runs/review-fixture?tab=tasks');
  const tasks = page.getByRole('tab', { name: 'Задачи', exact: true });
  await tasks.focus(); await tasks.press('End');
  await expect(page.getByRole('tab', { name: 'Журнал', exact: true })).toBeFocused();
  await expect(page).toHaveURL(/tab=events$/);
  const connectionsButton = page.getByRole('button', { name: /^Подключения Сервер/ });
  await connectionsButton.click();
  await page.getByRole('button', { name: 'Закрыть подключения', exact: true }).press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(connectionsButton).toBeFocused();
});
test('paused review context leads to clarification without a mutation', async ({ page }) => {
  const paused = { ...completed, status: 'paused' as const, phase: 'synthesize' as const, reviewRound: 3,
    error: 'После трёх проверок остались замечания.', artifacts: [...completed.artifacts,
      { id: 'review', kind: 'review' as const, title: 'Review', body: 'Укажите источники.', authorId: 'b', createdAt: '2026-10-09T08:02:00Z' }] };
  await mockWorkspace(page, [paused]);
  const mutations: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') mutations.push(request.url()); });
  await page.goto('/#/runs/review-fixture');
  await expect(page.getByText('Укажите источники.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Уточнить задачу', exact: true }).click();
  await expect(page.getByLabel('Направьте команду', { exact: true })).toBeFocused();
  expect(mutations).toEqual([]);
});
test('reduced motion remains respected after first expansion', async ({ page }) => {
  await mockWorkspace(page); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await page.getByRole('button', { name: 'Показать город', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Анимация города', exact: true })).toBeDisabled();
  expect(await page.locator('.city-car').first().evaluate(element => getComputedStyle(element).animationPlayState)).toBe('paused');
});
```

- [ ] **2. Add storage-denied, malformed-route and successful-clear coverage.**

```ts
test('unavailable browser storage reports failure without preventing editing', async ({ page }) => {
  await mockWorkspace(page);
  await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', {
    get() { throw new DOMException('Denied', 'SecurityError'); },
  }));
  await page.goto('/');
  const field = page.getByLabel('Что нужно сделать?', { exact: true });
  await field.fill('Текст остаётся доступен в открытой форме');
  await expect(field).toHaveValue('Текст остаётся доступен в открытой форме');
  await expect(page.getByRole('alert')).toContainText('не сохранён');
});
test('malformed route offers a history recovery link', async ({ page }) => {
  await mockWorkspace(page); await page.goto('/#/runs/%');
  await expect(page.getByRole('heading', { name: 'Страница не найдена', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть историю', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Все задачи', exact: true })).toBeVisible();
});
test('successful creation clears the submitted draft only after success', async ({ page }) => {
  await mockWorkspace(page);
  await page.route('**/api/runs', async route => {
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    await route.fulfill({ json: { run: completed } });
  });
  await page.goto('/');
  await page.getByLabel('Что нужно сделать?', { exact: true }).fill('Создаваемая задача с достаточным описанием');
  await page.getByRole('button', { name: 'Составить план', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Проверяемый результат', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Новая задача', exact: true }).click();
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toHaveValue('');
});
```

These POSTs only reach route fixtures; no backend exists on the test origin.

- [ ] **3. Protect active-run reading/drafts during a terminal transition.**

```ts
test('completion preserves the selected tab and newer steering draft', async ({ page }) => {
  const active = { ...completed, status: 'paused' as const, phase: 'tasks' as const };
  await mockWorkspace(page, [active]);
  let release: (() => void) | undefined;
  await page.route('**/api/runs/review-fixture/messages', async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { run: { ...completed, version: 2 } } });
  });
  await page.goto('/#/runs/review-fixture?tab=messages');
  const field = page.getByLabel('Направьте команду', { exact: true });
  await field.fill('Отправляемое уточнение');
  await page.getByRole('button', { name: 'Отправить команде', exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await field.fill('Новый черновик');
  release!();
  await expect(page.getByRole('tab', { name: /^Обсуждение/ })).toHaveAttribute('aria-selected', 'true');
  await expect(field).toHaveValue('Новый черновик');
  await expect(field).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Посмотреть результаты', exact: true })).toBeVisible();
});
```

- [ ] **4. Assert history pagination still works while filtered.**

```ts
test('loaded-only search keeps older-page loading available', async ({ page }) => {
  await mockWorkspace(page);
  const older = { ...completed, id: 'older', title: 'Старый документ' };
  await page.route('**/api/bootstrap', async route => route.fulfill({ json: {
    connections: [], csrfToken: 'fixture-only', eventCursor: 0, maxConcurrent: 3,
    runs: [completed], totalRuns: 2, nextCursor: completed.id,
  } }));
  await page.route('**/api/runs?before=*', async route => route.fulfill({ json: { runs: [older], totalRuns: 2 } }));
  await page.goto('/#/runs');
  await page.getByLabel('Поиск среди загруженных запусков').fill('Старый');
  await expect(page.getByText('Совпадений среди загруженных запусков нет.')).toBeVisible();
  await page.getByRole('button', { name: 'Загрузить более ранние запуски', exact: true }).click();
  await expect(page.getByRole('button', { name: /Старый документ/ })).toBeVisible();
  await expect(page.getByText('Загружено 2 из 2 запусков.')).toBeVisible();
});
```

- [ ] **5. Run the full verification suite once after integration.**

```sh
npm run typecheck
node --import tsx --test --experimental-test-coverage --test-coverage-lines=80 tests/*.test.ts
npm run test:e2e
npm run build
npm audit --audit-level=high
```

Expected: all tests pass, aggregate Node line coverage >=80%, production build passes, no high/critical advisories. If the new browser-oriented modules reduce Node coverage, add meaningful unit/render tests for uncovered data/error branches; do not exclude files or lower the threshold. Browser tests cover interactions but are not counted in the Node runner's coverage figure. Do not claim a full WCAG certification from these checks.

- [ ] **6. Add the browser check to the existing CI job without removing current gates.**

Insert after the existing build step in `.github/workflows/ci.yml`:

```yaml
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-failure-evidence
          path: test-results/
          retention-days: 7
```

Fixtures contain synthetic text only. Keep the existing dependency audit. Review dependency changes and lockfile before the local commit: `test: guard core workspace interactions in browsers`.

## Task 11: Synchronize documentation, inspect visuals, and hand off

**Files:** modify the docs/wiki files in the file map; create `docs/audits/2026-10-09-ui-improvements.md` and synthetic fixture screenshots under `docs/audits/assets/`.

This is a **per-milestone documentation checkpoint plus final evidence task**. Do not defer all wiki changes until after implementation commits: apply the relevant passages below with each milestone, retaining planned wording for unfinished milestones. Existing historical audit entries stay historical; update conflicting current-behavior paragraphs rather than duplicating contradictory claims.

- [ ] **1. Update the canonical product description with the implemented behavior.**

In `docs/prototype.md`, replace current descriptions that assert an always-expanded city or nonpersistent drafts with this text once the respective milestone passes:

```markdown
### Рабочая область и документы

Город по умолчанию свёрнут. «Показать город» открывает прежнюю сцену без изменения масштаба спрайтов; декоративные изображения загружаются при первом открытии. Сворачивание, скрытая вкладка и системное уменьшение движения приостанавливают анимацию.

На экране новой задачи сначала видны цель и краткий состав команды. Подробные настройки участников и превью сцены раскрываются отдельно. При открытии завершённого запуска первым показан принятый документ; сцена команды доступна ниже. Завершение текущей работы не переключает выбранную вкладку автоматически.

Документы отображаются как форматированный Markdown. HTML из ответов не исполняется, внешние изображения автоматически не загружаются. Исходный Markdown можно раскрыть, скопировать или скачать. Ошибка копирования показывает способ скопировать исходный текст вручную.

### Черновики и навигация

Цель, состав команды, режим и уточнения к отдельным запускам сохраняются в sessionStorage текущей вкладки. Они восстанавливаются после переходов и обновления страницы; сохранение после закрытия вкладки не гарантируется. Черновики не содержат ключей API или служебных сессий провайдеров. Кнопка «Очистить черновик» сбрасывает создание задачи. При недоступном хранилище интерфейс сообщает, что текст остаётся только в памяти.

Успешное создание очищает отправленный черновик; ошибка запроса сохраняет его. Успешная отправка уточнения не удаляет новый текст, введённый во время запроса. Черновик завершённого запуска можно прочитать и скопировать, но нельзя отправить.

Ссылки вида `#/runs/<id>?tab=artifacts` открывают конкретный запуск и вкладку. Работают кнопки браузера «Назад» и «Вперёд». «Все задачи» открывает отдельную историю. Поиск и фильтр применяются только к загруженным запускам; более ранние страницы загружаются отдельной кнопкой.

При паузе или ошибке доступно последнее ревью, если оно есть, и переход к полю уточнения. Отправка уточнения и продолжение работы остаются отдельными действиями. Интерфейс не приписывает сохранённому ревью вердикт, которого нет в данных.
```

Add one concise paragraph to README's workspace section:

```markdown
The workspace keeps editor drafts in the current browser tab across navigation and reloads, supports direct run/tab links, and renders result documents as safe Markdown. The history view filters loaded pages and lets you fetch older ones. The decorative city opens on demand; completed runs prioritize the accepted document.
```

- [ ] **2. Update current wiki statements and append the decision refinement.**

Replace the opening client-module description's state-only navigation and nonpersistent draft claims with:

```markdown
`App.tsx` owns bootstrap/session/SSE synchronization and uses `useWorkspaceLocation.ts` for explicit creation, history, and run fragment routes. `navigation.ts` validates route IDs and tabs. `HistoryView.tsx` filters loaded summaries and retains older-page pagination; it is not a server-wide search.

`draftStorage.ts` validates editor-only versioned envelopes, and `useBrowserDraft.ts` synchronously saves edits to sessionStorage. Composer and per-run steering drafts survive navigation/reload in the current tab. Storage failures are visible. Unknown provider selections are preserved for correction rather than silently reassigned.

`MarkdownDocument.tsx` renders structured Markdown with raw HTML disabled and remote images replaced by text. `ArtifactView.tsx` provides safe document/source presentation and copy/download actions. `RunContext.tsx` exposes the current phase, optional encounter, and latest-review context for paused/failed runs without inventing a stored verdict.
```

In `wiki/flows/Session and API Flow.md`, add:

```markdown
Client fragment routes and sessionStorage drafts do not change bootstrap cookies, CSRF handling, SSE replay, run persistence, or the API contract. Browser drafts are separate from SQLite and are scoped to one tab. Direct links fetch run detail by ID even when the summary is not in the currently loaded history page. History filtering covers loaded pages only.
```

Append to `wiki/decisions/Pixel Art Consistency.md`:

```markdown
## Work-first hierarchy refinement — 2026-10-09

The city is now optional and initially collapsed; expanded artwork retains its approved grid, sources, and scale. Creation prioritizes the goal, completed runs prioritize the accepted document, and recovery prioritizes review context. Pixel typography remains for short identity/navigation labels; functional metadata and document prose use readable sizes. No sprite redraw or animation-geometry change is included.
```

Update `wiki/overview.md` with the same implemented scope and preserve its planned-capability distinctions. No new wiki page is necessary; update `wiki/index.md` only if navigation descriptions actually change. Update affected frontmatter `updated` fields to the implementation date.

- [ ] **3. Replace hot cache and prepend the log entry after verified implementation.**

Keep `wiki/hot.md` under 500 words and include this current-change summary alongside accurate existing backend/provider limitations:

```markdown
## Current UI

Power Agents prioritizes task entry, formatted results, and review recovery. Ambient city art loads on first expansion; the expanded pixel scale is unchanged. Completed runs show the accepted result above the optional encounter. Documents support safe Markdown, source view, copying, and downloads.

Creation and run-specific steering drafts survive navigation/reload within one tab through validated sessionStorage envelopes. Fragment routes preserve run/tab context and browser history. The history screen searches only loaded pages and retains older-page loading. Validation expands/focuses the affected field. Mobile targets and narrow-screen layout have dedicated browser checks.

## Scope boundaries

No server schema, provider execution, Telegram delivery, or SSE contract changed. Full-history search, archive/rename, named team presets, provider diagnostics, dark mode, and new sprite production remain separate work.
```

Prepend to `wiki/log.md` after all corresponding checks pass:

```markdown
## 2026-10-09 — Work-first UI and navigation continuity

Implemented optional/deferred city presentation, safe document reading, result-first completion, latest-review recovery context, per-tab drafts, fragment navigation, loaded-history filters, field-linked validation, and responsive control sizing. Preserved provider, persistence, session, and SSE contracts. Verification and synthetic browser evidence are recorded in `docs/audits/2026-10-09-ui-improvements.md`.
```

Use the actual execution date if different. The plan date is not proof that implementation occurred that day.

- [ ] **4. Capture synthetic visual evidence at the specified viewports.**

Using the fixture-backed browser, save:

- `docs/audits/assets/2026-10-09-ui-desktop-create.png` — 1440×900, default creation.
- `docs/audits/assets/2026-10-09-ui-desktop-result.png` — 1440×900, completed result.
- `docs/audits/assets/2026-10-09-ui-mobile-create.png` — 390×844, goal/launch hierarchy.
- `docs/audits/assets/2026-10-09-ui-mobile-320.png` — 320×812, persistent-scrollbar check where supported.
- `docs/audits/assets/2026-10-09-ui-tablet.png` — 768×1024, intentional composition.
- `docs/audits/assets/2026-10-09-ui-recovery.png` — paused review with clarification action.

Review hover/focus, 200% zoom, long titles, five participants, unavailable model catalog, long code/table content, empty history/results, invalid draft storage, and blocked clipboard. Inspect actual contrast of text/background pairs with a contrast tool before claiming WCAG ratios. Verify native details/dialog keyboard behavior and OS reduced motion. Screenshots use synthetic fixture content, never private existing runs.

Create the audit with actual command results, measured layout values, screenshot links, and any remaining limitations. Do not prefill “all checks passed.” Record screen-reader coverage honestly; keyboard checks are not a substitute for VoiceOver/NVDA.

- [ ] **5. Review scope and produce the final implementation handoff.**

```sh
git diff --check
git diff --stat
git diff -- src/client tests package.json package-lock.json .github/workflows/ci.yml docs/prototype.md wiki
```

Expected: intended client/test/doc changes only; no runtime state, `.env`, secrets, private workspace snapshots, or artwork replacements. Re-run only checks affected by any final fixes. Keep `.raw/` immutable. No push, deployment, live provider test, Telegram notification, or production service restart is part of this plan.

## Commit procedure at each checkpoint

Use the task's stated conventional commit message. Stage task-owned new files by exact path and edited tracked files by hunk; existing uncommitted work must not be swept into the commit. For example, Task 3's checkpoint is:

```sh
git diff --check
npm audit --audit-level=high
git add src/client/MarkdownDocument.tsx src/client/ArtifactView.tsx src/client/document.css tests/markdown.test.ts
git add -p src/client/RunWorkspace.tsx src/client/main.tsx package.json package-lock.json docs/prototype.md wiki/modules/Client\ Interface.md wiki/hot.md wiki/log.md
git diff --cached --check
git diff --cached
git commit -m "feat: render readable and safe result documents"
```

For each other checkpoint substitute the exact files listed in that task and its stated message. Checkpoints are local commits during authorized execution; this planning turn creates no commits. If the baseline makes a hunk inseparable from someone else's work, leave it unstaged and record it rather than manufacturing a clean history by discarding changes.

## Review-finding coverage and deliberate boundaries

| Review finding | Implementation tasks |
| --- | --- |
| 1. Creation displaced by city/intro | 2, 9 |
| 2. Finished document below scene | 4 |
| 3. Literal Markdown | 3 |
| 4. Lost drafts/navigation | 5, 6, 7 |
| 5. Distant validation feedback | 8 |
| 6. Misleading All tasks/history | 7 (loaded-only filters; global search remains separate) |
| 7. Small controls/functional text | 9 |
| 8. Narrow overflow/tablet composition | 2, 9, 10 |
| 9. Recovery lacks direct context | 4, 10 |
| 10. Hidden art eager loading | 2 |
| 11. Token/override drift | 9 (only touched properties; no wholesale restyle) |
| Documentation and regression evidence | 1, 10, 11 |

## Technical references checked during planning

- [react-markdown official documentation](https://github.com/remarkjs/react-markdown): component-based Markdown rendering, `remarkPlugins`, `skipHtml`, URL transforms and component overrides.
- [Playwright API mocking](https://playwright.dev/docs/mock): intercept requests before navigation and fulfill synthetic responses.
- [Playwright web-server configuration](https://playwright.dev/docs/test-webserver): managed local server and explicit reuse policy.

Resolve concrete dependency versions during execution and commit the lockfile. Do not claim that current versions or security advisories were tested by this planning document.

## Plan self-review record

- All eleven review findings map to a task in the coverage table; optional capabilities outside the reviewed defects have explicit separate-plan boundaries.
- Module exports, editor IDs, route tab values, storage keys, and `Run`/`Artifact` properties were cross-checked against the current source and against later tasks.
- Seventeen standalone TypeScript/TSX examples were syntax-checked using the repository's installed TypeScript transpiler. This is not an integrated typecheck or runtime test of the proposed implementation.
- Placeholder scan completed. Existing-code relocation steps identify exact wrappers/anchors; new modules include concrete code and tests.
- No implementation dependencies were installed and no application tests were represented as passing for these planned changes. Only the plan document was written in this turn.

## Execution handoff

1. **Subagent-driven (recommended):** load `/Users/bigbonch1k/.codex/skills/subagent-driven-development/SKILL.md`; assign one bounded task at a time, review specification compliance then code quality, and preserve shared-file ownership.
2. **Inline execution:** load `/Users/bigbonch1k/.codex/skills/executing-plans/SKILL.md`; execute the milestones with checkpoints and the same regression/documentation gates.

Implementation awaits the user's execution choice. This document does not authorize a production deployment or new external actions.
