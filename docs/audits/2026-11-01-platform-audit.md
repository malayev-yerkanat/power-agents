# Platform audit and improvement plan — 2026-11-01

Scope: the whole app on branch `feat/reel-flows` (server, client, adapters, Flows, Telegram and Codex bridges).
Lenses (installed skills): `security-review`, `agent-security-hardening`, `agent-architecture-audit`,
`ponytail-review`, `production-audit`, `ui-review`, `accessibility`, `click-path-audit`.

Method: read the server, adapter, workspace, MCP, Telegram and Codex bridge code; ran the checks; walked the
running LaunchAgent build in a browser at 1440×900 and 375×812 without creating runs.

## Baseline (verified 2026-11-01)

| Check | Result |
| --- | --- |
| `npm run typecheck` | 0 errors |
| `npm test` | 331 / 331 pass (7.7 s) |
| `vite build` | OK; main chunk 688 KB (208 KB gzip), warning > 500 KB |
| `npm audit --omit=dev` | 0 vulnerabilities |
| CI | typecheck, 80 % line-coverage gate, build, Playwright e2e, audit |
| Linter | none configured |
| E2E | not run in this audit |

## What is already right

- **Core loop works end to end.** All 12 design acceptance criteria are done; M1–M3 accepted on live
  three-provider runs (see `docs/roadmap.md`).
- **Local-only HTTP surface is tight.** Host, Origin and `Sec-Fetch-Site` checks, session cookie plus CSRF
  token with timing-safe compare, strict zod schemas, 64 KB JSON cap, 600 req/min limit, `nosniff`.
- **Agent processes are contained.** No shell for CLIs, environment allowlist, secrets redacted from errors,
  Codex `--ignore-user-config` with tmp excluded from the write sandbox, Claude hooks and slash commands
  off, strict MCP config, per-turn MCP bearer token, browser requests refused on `/mcp`.
- **File paths are guarded.** Downloads only serve files the task result lists and that resolve inside the
  task folder; Markdown renders with `skipHtml` and a URL transform.
- **Telegram is careful.** 32-byte pairing nonce stored as a hash, 10-minute expiry, private chat only,
  button taps accepted only from the paired user on the sent message; Codex bridge refuses unknown IPC
  protocol versions and checks the socket owner and mode.
- **Engineering discipline.** Strict TypeScript, 331 tests, coverage gate in CI, a roadmap tied to live
  acceptance runs, earlier UI and accessibility audits in `docs/audits/`.

## Findings

Severity: **High** = can cause harm or blocks the main flow; **Medium** = clear cost to users or maintainers;
**Low** = polish.

### Security

| ID | Sev | Finding | Fix |
| --- | --- | --- | --- |
| S1 | High | `runCheck` (`src/server/workspace.ts`) runs the user's check command with `/bin/sh -c` in the result worktree, **outside any sandbox**, after agents have edited that worktree. An agent misled by text in the repo or goal can change `package.json` scripts or test files, and `npm test` then runs that code as the user with `HOME` and network access. | Run the check under a macOS `sandbox-exec` profile (writes only inside the worktree, no network), or pause before the check and show any changed scripts, configs or test files for approval. |
| S2 | Medium | App pages send no `Content-Security-Policy` or `X-Frame-Options` (verified with `curl -I /`). Any website can frame `127.0.0.1:4317` and trick a click on approve, resume or cancel. | Add `Content-Security-Policy: frame-ancestors 'none'; default-src 'self'; …` and `X-Frame-Options: DENY` to HTML responses in `src/server/index.ts`. |
| S3 | Medium | `/api/bootstrap` gives the session cookie and CSRF token to any local process that sends a valid Host header. Any program running as this user can start runs that write to any repo path. | Print a one-time launch URL with a token at startup, as Jupyter does, and require it for bootstrap. The LaunchAgent can open it. |
| S4 | Low | The Codex–Telegram bridge can approve **shell commands** on this Mac from Telegram. The checks are strong, but a taken-over Telegram account becomes remote command approval. | Make command and permission approvals a separate opt-in (questions on by default, approvals off). Show the full command and directory, which already happens. |
| S5 | Low | `npm run dev` serves the project root through Vite. Not checked: whether `.power-agents/` files are reachable in dev mode. Production mode returns the SPA for `/.env` and 404 for the database (verified). | Add `server.fs.deny` entries for `.power-agents/**` in the Vite middleware config. |
| S6 | Low | Run text, model answers and backups are stored without encryption (documented). | Keep as is; state it in the settings screen. |

### Agent architecture

| ID | Sev | Finding | Fix |
| --- | --- | --- | --- |
| A1 | High | **The prompt contradicts itself.** The base rule in `src/server/core/prompts.ts` says "do not run tools, do not change files, work is done in text". The folder note then says to save files with write tools, and the team note says to call `team_status` first. The roadmap records the symptoms: Codex answered without tools, Claude wrote documents twice, a synthesis asked for fixes instead of combining. | Build the prompt from per-purpose sections. Include the "text only" rule only when the turn has no folder and no tools. Keep one rule per behaviour. |
| A2 | High | The JSON envelope is parsed from free text. Each format slip costs a repeated turn: `artifact` sent as a string, messages inside synthesis, fenced JSON. | Use native structured output where the provider has it: Codex `--output-schema`, OpenAI `text.format` with `json_schema`, Anthropic tool use or structured output. Keep the text parser as fallback for Claude Code and Gemini. |
| A3 | Medium | Every turn receives the whole run as one JSON string, up to 300 KB, and long runs then fail with "create a new task". Nothing is cached. This works against M4 (speed). | Put the stable part first (rules, goal, plan) and the changing part last, so provider prompt caching applies. Send summaries of finished artifacts instead of full bodies when a turn does not need them. |
| A4 | Medium | API adapters have a fixed `max_tokens` / `max_output_tokens` of 8192, no streaming, and treat `max_tokens` as an error. A long synthesis on the OpenAI or Anthropic API will fail. API participants are not live-tested yet (backlog). | Set limits per purpose (synthesis higher), stream, continue once on `max_tokens`, and add the live API run to the M4 acceptance test. |
| A5 | Low | Prompts are Russian only and default to Russian output, but the UI has an English mode. | Answer in the goal's language; base the system text on a language parameter. |
| A6 | Low | No per-run usage view (tokens, cost, wall time per member). A monetary budget is listed as not implemented. | Record turn duration and token counts per call; show them in the run's timeline. |

### Code quality and repository

| ID | Sev | Finding | Fix |
| --- | --- | --- | --- |
| C1 | Medium | Very dense code. `src/server/engine.ts` has 380 lines but 45 KB; 31 lines are over 200 characters and the longest source line is 2,409 characters. Reviews and diffs are hard; bugs hide in one-liners. | Add Prettier (`printWidth` 120). Apply it in one formatting-only commit. |
| C2 | Medium | No linter, although the global working rules require one. | Add ESLint with `typescript-eslint`, `react-hooks` and `jsx-a11y`; run it in CI. |
| C3 | Medium | `feat/reel-flows` carries 8 unmerged commits and 33 uncommitted files that mix Reel Flows, the Codex–Telegram bridge and avatars. | Commit the pending Codex completion-alert work separately, then merge the branch to `main`. Use one branch per feature from now on. |
| C4 | Medium | **Three products in one app:** agent team runs, a Roblox reel video pipeline (Flows), and a Codex Desktop → Telegram bridge. Each is partly finished, which is the main reason the app feels unfinished. | Decide the core (team runs, per the roadmap north star). Put Flows behind a feature flag or a clearly labelled "Labs" area. Run the Codex bridge as its own small service; it already has its own database and bot. |
| C5 | Low | `output/` holds 127 MB of art iterations (295 tracked files); `.git` is 182 MB. | Move art iterations to Git LFS or outside the repo; keep shipped sprites in `public/`. |
| C6 | Low | Server errors are Russian only, so the English UI shows Russian errors. i18n uses Russian source text as keys, so any wording change breaks the English lookup. | Return error codes plus parameters from the server; translate in the client. Move to stable message IDs. |
| C7 | Low | 688 KB main client chunk (also in the backlog). | Lazy-load the city scene, encounter art and Markdown renderer; check icon imports. |

### UX / UI and accessibility

| ID | Sev | Finding | Fix |
| --- | --- | --- | --- |
| U1 | High | **Navigation does not show where you are.** "Пространство" stays underlined on every page. On Flows, both "Пространство" and "Потоки" are underlined. On a run page "Пространство" is active. "Запуски" opens an overlay drawer, not a page. | One active nav item from the route. Make Runs a page on desktop and keep the drawer for mobile only. |
| U2 | High | **Runs cannot be told apart.** The title is the start of the goal text. All 36 runs in history read "Цель: подготовить пакет к запуску нового сезонного напитка «…»". The run header cuts the title mid-word in a large pixel font. | Have the leader return a short `title` in the plan, allow rename, and show date, participants and result in each history row. |
| U3 | Medium | Three visual styles: the light pixel/mono workspace, a dark rounded React Flow canvas, and an unstyled Flows list (native select and default buttons). The composer uses native `<details>` triangles. | Share one set of tokens and components (buttons, selects, disclosure, cards) across Workspace, Runs and Flows. |
| U4 | Medium | At 1440 px the composer and the result document use a column of about 600 px. Result tables scroll sideways inside that column. | Widen the document column (about 880–960 px) or use two columns: document beside tasks and timeline. |
| U5 | Medium | Flow canvas: at fit view, node text is unreadable, and node cards show raw JSON. | Show a one-line human summary per node; open zoomed to the first pending or gated node. |
| U6 | Low | 18 visible text elements are under 12 px on the mobile run page; desktop meta labels are about 10 px. | Minimum 12 px for meta text, 14 px for body text. |
| U7 | Low | Changing the hash route keeps the old scroll position. A run opened on mobile started in the middle of the document. | Scroll to top on route change; keep it only for back/forward. |
| U8 | Low | No progress estimate or elapsed time during a run (ties to A6). | Show elapsed time per stage and the M4 baseline as a guide. |

## Plan

Effort assumes one person working with an agent. Each phase ends with `npm run typecheck`, `npm test` and
`npm run test:e2e` passing.

### Phase 0 — Land and stop the bleeding (about 2 hours)

Status 2026-11-01: steps 2 and 3 done and verified (typecheck, 332/332 unit, 47/47 e2e, build).
Step 1 (commit and merge) is waiting for the user. The running LaunchAgent serves the old build until
`npm run build` and `npm run service:restart`.

1. Commit the pending Codex completion-alert work; merge `feat/reel-flows` into `main` (C3).
2. Add CSP `frame-ancestors 'none'` and `X-Frame-Options: DENY` to HTML responses, with a test (S2).
3. Fix the active nav item and scroll-to-top on route change (U1 part 1, U7).

### Phase 1 — Trust and safety (about 1 day)

Status 2026-11-01: S1 and S5 done and verified. S1: the check runs under `sandbox-exec`; a control run showed
the same script writes outside the worktree and opens an internet connection without the sandbox, and gets
`Operation not permitted` / `EPERM` with it. S5 was a real exposure: the dev server returned 200 for
`/.power-agents/state.sqlite` and the server log; both now return 403. S3 and S4 done on 2026-11-01 after your go-ahead: sign-in by
one-time launch link (`npm run open`) with a persistent signed session, and the check sandbox cannot read the key;
Codex Telegram approvals need `CODEX_TELEGRAM_APPROVALS=true`. Phase 1 is complete.

1. Sandbox the repo check command, or require approval when agents changed scripts or configs (S1).
2. Require a launch token for `/api/bootstrap` (S3).
3. Make Telegram command approvals a separate opt-in (S4); add `server.fs.deny` for dev mode (S5).

### Phase 2 — Agent reliability and speed (2–3 days; measure against the M4 baseline)

1. Rewrite `promptFor` into per-purpose sections without contradictions (A1).
2. Use native structured output for Codex and both APIs (A2).
3. Order context stable-first and trim finished artifacts (A3).
4. Per-purpose output limits, streaming and continuation for API adapters; live API acceptance run (A4).
5. Record tokens and duration per turn (A6).

Done when the `99c6c723` goal finishes with review passed, no repeated turns, in less time than run `619723ae`.

### Phase 3 — UX coherence (2–3 days)

1. Leader-generated short run titles, rename, richer history rows (U2).
2. Runs as a page on desktop (U1 part 2).
3. Shared design tokens and components across Workspace, Runs and Flows (U3).
4. Wider document layout (U4); readable flow nodes (U5); minimum text sizes (U6); elapsed time (U8).

Done when a new user can find a past run by name in under 10 seconds and every page has one active nav item.

### Phase 4 — Codebase health (about 1 day)

1. Prettier formatting commit; ESLint with `jsx-a11y` in CI (C1, C2).
2. Server error codes translated in the client; stable i18n IDs (C6).
3. Code-split the client below 500 KB (C7); move art iterations out of Git (C5).

### Phase 5 — Product focus (decision, then backlog)

1. Decide the scope of Flows and the Codex bridge (C4).
2. Then the existing backlog: saved team presets, search across run history, output language (A5).

## Not covered

- Playwright e2e suite was not run in this audit.
- No live provider run was made; agent findings come from code and the roadmap's recorded runs.
- Dev-mode (`npm run dev`) file exposure was not tested (S5).
- No screen-reader pass; accessibility checks were automated counts plus visual review.
