---
type: log
status: active
created: 2026-10-07
updated: 2026-10-30
tags: [history]
---

# Operation Log

## 2026-10-30 — F3 live Idea, Script and Scenes

- Implemented live text executors using discovered connections and injectable `TurnRunner`, read-only version directories, no team tools or session reuse. English brief-derived prompts include brand/upstream values, extra instructions and every rejection note. Zod validates candidate scores/selection, measured script length and five beats, and ordered scene coverage. One invalid-output correction includes JSON shape and measured count. Static live Brand is available; media remains planned for F4.
- Added the protected connection catalog, Russian inspector select with **Авто**, and readable Idea/Script excerpts. Updated canonical prototype, module/flow pages and overview. The template's connected Voice timings still require F4; removing that edge enables Scenes' script-time fallback. Hard-no topic safety is prompt guidance plus human approval, not deterministic semantic moderation.
- TDD source: [F3 plan](../.claude/plans/reel-flow-workspace.plan.md). Journeys: choose connection → generate Idea → approve → generate Script → approve → generate Scenes; reject with notes → revise; demo → no provider. RED: `node --import tsx --test tests/flow-executors.test.ts` failed with `ERR_MODULE_NOT_FOUND` for the not-yet-created executor. GREEN: `node --import tsx --test tests/flow*.test.ts` passes **34/34**. No checkpoint commits were created, as explicitly requested by the user.

| Guarantee | Evidence | Result |
|---|---|---|
| All prompts include connected brand/upstream data, extra instructions and rejection notes; turns are isolated/read-only | `tests/flow-executors.test.ts` unit tests | PASS |
| JSON/schema/count errors get one repair; unavailable connections fail; scenes cover beats and respect supplied timings | `tests/flow-executors.test.ts` unit tests | PASS |
| Engine uses providers for live only; HTTP runs live Idea and Script through approval without opening a socket | `tests/flow-engine.test.ts`, `tests/flow-http.test.ts` integration tests | PASS |
| Cards show chosen topic/hook and script count; inspector offers available connections and Auto | `tests/flow-canvas.test.ts` helper/render tests | PASS |

- `npm test`: **211/228 pass**, **17 fail**, all `listen EPERM`: all 14 tests in `tests/http.test.ts`; occupied-port preflight in `tests/launchd.test.ts`; team-tool impersonation/security integration in `tests/mcp.test.ts`; settings API test in `tests/telegram.test.ts`. No cancellations or skips. `npm run test:coverage` has the same 17 listener failures and measures **81.49%** overall line coverage; new `executors.ts` and `outputs.ts` each have 100% line coverage.
- `npm run typecheck` and `npm run build`: PASS (non-blocking Rollup annotation and large-chunk warnings). No lint script is defined. `npm run test:e2e`: Vite startup blocked by `listen EPERM` on `127.0.0.1:4318`; **0 executed**, **39 discovered** with `playwright test --list`. Real-provider F3 acceptance remains unverified; no actual model calls, dependency installs, `.env` edits, commits or pushes. Existing Telegram changes were left alone.

## 2026-10-30 — F2 flow canvas workspace

- Added the **Потоки** list and fragment routes, demo/live Roblox-template creation, dark React Flow canvas, status/output cards, typed connectors, run/approve/reject controls, note dialog, inspector, node/edge deletion, add-node menu and auto-run setting. Layout and edits use queued versioned writes with refetch on conflict.
- Added client-safe registry metadata and global SSE `flow` invalidations from store subscriptions. Flow detail/list refresh on events and SSE open/reconnect. Updated the prototype and linked module/flow pages. Live executors (F3/F4), upload/media playback (F4) and Telegram flow gates (F5) remain planned.
- Verification: `npm test` reports 194/211 passing; all 17 failures are sandbox `listen EPERM` (all 14 in `tests/http.test.ts`, occupied-port preflight in `tests/launchd.test.ts`, the team-tools security integration in `tests/mcp.test.ts`, and the settings API test in `tests/telegram.test.ts`). The six helper/navigation tests and all 13 flow engine/API tests pass. `npm run typecheck` and `npm run build` pass; the build retains a non-blocking large-chunk warning. Measured overall line coverage is 80.81%. `npm run test:e2e` cannot start Vite on `127.0.0.1:4318` (`listen EPERM`): zero executed; Playwright lists 39 scenarios, including four F2 tests. No lint script is defined.

## 2026-10-30 — F1 headless flow engine

- Added the typed node registry and Roblox reel template, separate DAG scheduler, gates/rejection reruns, stale propagation, version/hash directories, global concurrency/render lane and complete interrupted-execution recovery. Added protected flow routes and server lifecycle wiring while preserving existing Telegram work.
- Added engine and API tests, including the four-node demo through two approvals. Updated canonical prototype and wiki pages; UI, live executors, uploads/media and flow Telegram actions remain planned. Verification: 11/11 F1 tests pass; full suite 188/205 pass, with all 17 failures caused by sandbox `listen EPERM`; typecheck and production build pass. Measured overall line coverage is 81.51%; flow modules have over 99% line coverage.

## 2026-10-28 — M4: plain-text artifact accepted

- An answer whose `artifact` is plain text is taken as the body (title «Результат») instead of repeating the turn; seen in reviews of runs `ec0727e0` and `958811b4`. Verified: 193/193 Node tests, 83.47% line coverage, typecheck.

## 2026-10-28 — M4 acceptance run with Gemini Low

- Run `958811b4` (baseline goal, Gemini on `gemini-3.8-flash-low`) completed with review passed first time in about 7.5 minutes active (baseline 12.5). Gemini's task took 28 s; its promo met every requirement at about a third of the baseline length.
- Bug from the earlier M4 change: a synthesis that only asked for fixes lost its messages and had no final document, so the run paused. A synthesis without a document now gets one repeat with a hint. Verified: 192/192 Node tests, 83.46% line coverage, typecheck. Open: Claude sometimes sends `artifact` as a string, costing one review repeat.

## 2026-10-28 — M4: Gemini turns measured

- agy logs (82 turns): median 10 s startup per turn before the first model call (18.6% of Gemini time); the rest is mostly one model call on "Gemini 3.8 Flash (High)", median 39 s, p90 120 s. Earlier "Flash (Low)" turns were faster (median 14 s) but on simpler runs. No code change. See the [roadmap](../docs/roadmap.md).

## 2026-10-28 — M4: Codex stall guard

- Across 109 live Codex turns normal silent waits stayed under 95 s; 4 stalls ran 180–414 s with little output. Codex turns now stop after 150 s with no output (`StalledError`, `idleMs` in `runProcess`) and are repeated once, unless the turn already used a team tool.
- Verified: 191/191 Node tests, 83.50% line coverage, typecheck.

## 2026-10-28 — M4 live timing run

- Run `619723ae` (same goal as `99c6c723`) completed with the second review passed and no answer repeats. Active time to the first review verdict was about 8.5 minutes against 12.5 for the baseline; synthesis 85 s / 57 s (baseline 141 s with a repeat). The first review caught a cost error (975 → 875 ₸), adding one 2 min 43 s rework round. Claude's `recipe.md` text was attached to its result.
- Not a clean acceptance: the Claude CLI sign-in failed at the start (paused 2 min 13 s, resumed after re-login) and no Codex stall occurred this time. See the [roadmap](../docs/roadmap.md).

## 2026-10-28 — M4: measured inside turns, no double writing

- CLI transcripts show the slowest turns are Codex waits before any output (414 s for a 503-token synthesis; 180 s before a task's first tool call), likely provider-side. Claude wrote each saved document twice: file (~30 s) and full answer text (~22 s).
- The platform now attaches saved task file text to the result (`inlineText` in `src/server/files.ts`, 40 KB per task); the task prompt no longer asks for the full text when files were saved.
- Verified: 188/188 Node tests, 83.28% line coverage, typecheck.

## 2026-10-28 — M4 Speed started

- Baseline from live runs since 2026-10-20 (average / slowest turn): synthesis 124 s / 419 s, task 57–82 s, review 46 s, plan 39 s; a three-provider document run takes 11–13 minutes. See the [roadmap](../docs/roadmap.md).
- Synthesis, review and resolve turns no longer get team tools, and messages in their answers are dropped instead of repeating the turn (two of the last three Codex syntheses repeated for this, about a minute each).
- Verified: 187/187 Node tests, 83.21% line coverage, typecheck.

## 2026-10-26 — M3 acceptance

- Live run `99c6c723`: Claude (20) and Codex (19) used team tools mid-turn, each call a `team_tool` event by the calling member; probes with no token, a forged token, a browser Origin and a foreign Host were refused during and after the run. Roadmap criterion 12 done; Gemini stays without team tools.
- Two earlier runs showed Codex had the tools but answered at once because the prompt opened with "answer only with JSON"; prompts for tool users now open with "call team_status and read_inbox first".

## 2026-10-26 — M3 step 3–4: CLI wiring and docs

- Claude gets the team server through `--mcp-config` (token via `${POWER_AGENTS_TOKEN}`) with the team tools allowed; Codex through `-c mcp_servers.team.*`. The token is never in process arguments. Connections carry `teamTools`; the composer marks Gemini "без командных инструментов", and the leader's plan prompt lists who has tools. The capability is set per adapter type rather than probed at each start, to avoid spending provider quota.
- Verified: 187/187 Node tests, typecheck.

## 2026-10-26 — M3 steps 0–2: team tools over MCP

- Spike: Claude takes a per-run HTTP MCP server via `--mcp-config` (token from `${POWER_AGENTS_TOKEN}`, not in process arguments); Codex via `-c mcp_servers.team.*` with `bearer_token_env_var` and `default_tools_approval_mode="approve"`; agy loads `.agents/mcp_config.json` but only allows tool calls through its global settings, so Gemini stays without team tools.
- `src/server/core/team.ts` holds the tool rules (status, inbox, send, facts, blocked report; leader add/assign task) with strict schemas; `src/server/mcp.ts` serves them at `POST /mcp` with one token per turn, refusing browser origins and foreign hosts. Every call is a `team_tool` event with the token's member as actor.
- Verified: 185/185 Node tests (team.ts 100% lines), 83.01% line coverage, 35/35 Chromium tests, typecheck, build, 0 audit findings.

## 2026-10-26 — M2 acceptance

- Files run `ec0727e0`: all three providers saved their named file; the final lists them. Code run `5cc8a064` on a Node demo repo: two task branches merged into the result branch, `npm test` passed via the platform check, the user's branch and working tree unchanged, worktrees removed. Roadmap criterion 11 done. Live conflict resolution not yet observed.
- The engine-extra test wait limit rose from 2.5 s to 10 s: an intermittent failure (about 1 in 10 coverage runs, never reproduced in 15 runs) is most likely a slow wait under parallel test load.

## 2026-10-26 — Gemini terminal commands

- Live acceptance runs `90eb09d1` (files) and `44eb9911` (code) paused because Gemini tried a terminal command, which its headless mode denies, leaving an empty answer. In the code run Claude's change still merged and `npm test` passed on the result branch, with the user's branch untouched. Writable turns are now told not to use terminal commands, any denied action (`DeniedActionError`) gets one retry with that hint, and the error names the action. agy offers no per-run allow rule short of `--dangerously-skip-permissions`, which stays off.

## 2026-10-26 — M2 step 5: code-run UI, docs, denied writes

- The composer has an optional "Изменить код в git-проекте" section (repo path, check command); the run page shows the result branch, conflicts, the check result and the diff stat. Docs: new "Файлы и код" section in the prototype guide.
- Live files run `aaf204a5` paused because Gemini tried to write outside its folder and returned an empty answer. The Gemini parser now raises `WriteDeniedError` with the denied path, and the engine retries such a turn once with the folder named.
- Verified: 177/177 Node tests, 82.45% line coverage, 35/35 Chromium tests, typecheck, build, 0 audit findings.

## 2026-10-26 — M2 step 4: code runs in git worktrees

- A run created with `repoPath` (checked by the HTTP layer with `repoInfo`) stores `Run.repo`. The engine creates the result worktree, gives each task a worktree branched from the result tip, commits and merges finished tasks one at a time (`mergedTurn`), starts dependents only after their dependencies merge, lets the leader resolve conflicts in a `resolve` turn (otherwise aborts and pauses), runs `checkCommand` before synthesis as a `check` artifact, and removes worktrees on completion or cancel. The user's branch is never touched.
- Live files run `431d3181` completed, but only Claude saved its file: Codex and Gemini read "give the full text in the artifact" as permission to answer in text. The task prompt now says files named by the task must be saved to disk.
- Verified: 175/175 Node tests, 82.60% line coverage, 35/35 Chromium tests, typecheck, build, 0 audit findings.

## 2026-10-26 — M2 steps 1–3: write mode, task files, git module

- Task turns of CLI participants may now edit files, only in `tasks/<taskId>/` inside the run folder: Codex `workspace-write` with temp folders excluded (a spike showed `/tmp` was otherwise writable), Claude `acceptEdits` with file tools only, Gemini `accept-edits` in its sandbox. Other turns read; dependents, replies, synthesis and review get the folders they need. Finished tasks list their files (200 files, 1 MiB each, 10 MiB per task) and the UI offers downloads limited to listed files inside the folder.
- CLI conversations are kept per folder (`<member>#<taskId>` for task folders), after a live run showed Claude cannot resume a conversation from another folder.
- `src/server/workspace.ts` (git worktrees, commit, merge, conflicts, check command, cleanup) was built in a side session and merged; it is not wired into the engine yet.
- Verified: 171/171 Node tests, 82.20% line coverage, 35/35 Chromium tests, typecheck, 0 audit findings.

## 2026-10-26 — M1 follow-ups fixed

- A changed fact reopens finished tasks that listed it in `usesFacts`, with an old → new note (criterion 6). Synthesis and review calls get 15 minutes. Answers may publish up to 40 facts. See [[Orchestration Engine]] and the [roadmap](../docs/roadmap.md).
- Verified: 158/158 Node tests, 81.45% line coverage, 35/35 Chromium tests, typecheck, build, 0 audit findings.
- Live run `17a22e7c` completed cleanly: 41 facts, Codex and Gemini filled `usesFacts`, synthesis took 4 min 33 s, review passed first time. The one fact change (coffee 17 g, v2) came before any task finished on v1, so correctly no task reopened; the reopen path is covered by tests only.

## 2026-10-26 — M1 acceptance run

- Live run `10db85ce` (Codex leader, Claude, Gemini) passed all three M1 checks: restart mid-task listed 3 unknown outcomes and resumed only after confirmation; a review remark reached Claude's recipe task, which was revised (syrup fact 36 g → 33 g, v2) before re-synthesis, and the second review passed; all 20 short board facts appear in the final. Criterion 6 stays partial: a changed fact does not reopen dependent tasks. Follow-ups: synthesis timeouts, the 12-facts limit. See the [roadmap](../docs/roadmap.md).

## 2026-10-26 — zod security update

- CI's `npm audit` failed on advisory GHSA-mrhx-c7xc-m3w5 (zod below 4.6.6 can exhaust memory on oversized constrained collections). Raised zod to ^4.6.7. Verified: 0 audit findings, 155/155 Node tests, 35/35 Chromium tests, typecheck, build.

## 2026-10-26 — M1.3 safe resume after restart

- The engine records every running call. After a restart, cut-off calls are listed as "outcome unknown", their tasks fail, and resume needs `confirmRepeat` (the Continue button asks). See [[Orchestration Engine]] and the [roadmap](../docs/roadmap.md).
- Verified: 155/155 Node tests, 81.36% line coverage, 35/35 Chromium tests, typecheck. One unreproduced flaky failure in a single coverage run; 24 reruns passed.
- Live: a three-provider run restarted mid-task listed all 3 calls as outcome unknown, refused an unconfirmed resume (HTTP 400), and after confirmation all tasks completed; the run was then cancelled to save quota.

## 2026-10-26 — M1.2 live check and waiting on colleagues

- The 2026-10-23 live run used the facts board: all three agents published 22 owner-tagged facts. It paused because Gemini answered "waiting" after Codex said prices were not final; the engine treated that as an error. Now a task may wait without a question while colleagues are working, and wakes on a note or a finished task; stranded waits still fail. See [[Orchestration Engine]].
- Verified: 153/153 Node tests, 81.56% line coverage, 35/35 Chromium tests, typecheck.

## 2026-10-23 — M1.2 shared facts board

- Answers may publish `facts`. The first publisher owns a fact, only the owner can change it (raising its version), and a non-owner change triggers the format retry. Every turn sees the board in its context; prompts tell agents to check it before asking. See [[Orchestration Engine]] and the [roadmap](../docs/roadmap.md).
- Verified: 152/152 Node tests, 81.62% line coverage, 35/35 Chromium tests, typecheck.

## 2026-10-23 — M1.1 review remarks reach task owners

- Review answers may list `revisions` per task. On `changes_requested` those tasks reopen, owners receive the remark as a note, and synthesis repeats after their rework; unknown task IDs trigger the format retry. See [[Orchestration Engine]] and the [roadmap](../docs/roadmap.md).
- Verified: 149/149 Node tests, 81.50% line coverage, 35/35 Chromium tests, typecheck. A live three-provider run completed cleanly, but its review passed on the first round, so live rework is still unobserved.

## 2026-10-23 — Roadmap

- Added [roadmap](../docs/roadmap.md): status of the design's 12 acceptance criteria and three milestones. North star chosen by the user: finish the core loop first (M1: review rework, shared facts board, safe resume), then file and code output (M2), then MCP team tools (M3). Each milestone ends with a live three-provider run; small items wait in the backlog.
- Documentation only.

## 2026-10-23 — Connection failures explain themselves

- Model lists and API turns now say why a connection failed: a rejected key names the `.env` variable, and quota, missing-model, outage, no-connection and empty-list cases have their own messages. CLI failures show a sign-in hint without raw CLI output. Live check: the current invalid OpenAI key now reads "OpenAI отклонил ключ (HTTP 401)". See [[Provider Adapters]].
- Verified: 147/147 Node tests, 81.52% line coverage, 35/35 Chromium tests, typecheck.

## 2026-10-23 — One automatic retry for unreadable answers

- Plan and answer parsing now throw `AnswerFormatError` for any rejected answer. The engine asks the same agent once more in the same session with the reason, logs `format_retry`, and counts the extra turn; a second rejection fails the turn. Most pauses in the 2026-10-23 live runs were such format errors. See [[Orchestration Engine]].
- Verified: 146/146 Node tests, 81.58% line coverage, 35/35 Chromium tests, typecheck. Not yet exercised in a live run.

## 2026-10-23 — Parallel tasks with fact owners

- Plans now prefer parallel tasks with a named owner for each shared fact. A live run produced six real messages, including answered questions from Gemini to Codex and Claude.
- Fixed from those runs: `null` optional fields no longer fail a turn; schema and JSON errors are readable and show the start of a bad answer; a reply is held while its owner has its own unanswered question, with a fallback for mutual waits that never fires after a failure; a reply that also asks something keeps its answer and sends the question as a note; text after a complete JSON answer is kept in its summary. See [[Orchestration Engine]].
- Verified: 143/143 Node tests, 81.54% line coverage, 35/35 Chromium tests, typecheck.

## 2026-10-23 — Messaging experiment and Gemini hang fix

- Live run on a task with shared recipe, price and promo facts: the leader chained the three tasks, and agents again sent zero peer messages; consistency came from dependencies.
- Gemini timed out three times inside the LaunchAgent service. A replay with the service's environment showed Antigravity printing a complete result after about 64 seconds and then staying open. The Gemini adapter now ends the turn at the first complete result line and stops the process. The pause summary no longer ends a task error with a double period. See [[Provider Adapters]].
- Verified: 136/136 Node tests, 81.39% line coverage, 35/35 Chromium tests, typecheck.

## 2026-10-22 — Failure isolation for task and reply turns

- A failed task or reply turn now marks only its task `failed`; other participants keep working and their results are kept. The run pauses only when nothing else can progress, listing the failed tasks. Resume retries only them, and a task whose own question is still open returns as `waiting`. Plan, synthesis and review failures still pause at once. See [[Orchestration Engine]].
- Verified: 135/135 Node tests (two new isolation tests), 81.20% line coverage, 35/35 Chromium tests, typecheck. No live provider run for this change.

## 2026-10-22 — Live three-provider run and its fixes

- Live run with Codex CLI (leader), Claude Code and Gemini Antigravity CLI completed plan, three parallel tasks, synthesis and review for a 1,446-word Markdown guide in 12 turns and about 14 minutes. Claude Code first failed because its CLI was not signed in.
- Fixed from the run: CLI failures now show the CLI's own reason from stdout; run errors name the failing participant; the plan prompt keeps the leader from planning assembly/review/final tasks that duplicate synthesis and review. A follow-up live plan had three work tasks instead of six.
- Still open: one failed turn pauses and interrupts every participant; no peer messages occurred in this task. See [[Provider Adapters]] and [[Orchestration Engine]].
- Verified: 133/133 Node tests, 81.03% line coverage, 35/35 Chromium tests, typecheck.

## 2026-10-22 — Bounded turn context and CLI billing guard

- `promptFor` now sends each turn only the documents it needs, each once. Previously every turn resent all task outputs and documents twice, so five 30,000-character results stalled the run at synthesis. See [[Orchestration Engine]].
- `cliEnvironment` no longer forwards `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` to CLIs, so API keys in `.env` cannot switch Codex or Claude Code to API billing. See [[Provider Adapters]].
- Verified: 130/130 Node tests, 80.89% line coverage, 35/35 Chromium tests, typecheck. No live provider run.

## 2026-10-20 — Project folder cleanup

- Moved the 2026-10-09 design review from the local `.jez/artifacts/` folder to [docs/audits/2026-10-09-design-review.md](../docs/audits/2026-10-09-design-review.md), with screenshots under `docs/audits/assets/2026-10-09-design-review/`. Added `.raw/design-review-2026-10-09.md` and listed it in [[Design Audits Source]].
- Moved superseded city-v2 sedan, taxi and airliner sprites from `public/art/city-v2/` to `output/art-direction/city-v2-vehicles-superseded/`; `panorama.png` and runtime vehicles-v3 are unchanged.
- Deleted four git-ignored concept ZIP exports whose extracted contents are tracked. Moved the separate `power-agents-reel` Remotion project to a sibling folder outside the repository.
- No application code changed.

## 2026-10-20 — Wiki cleanup: sources and index

- Added immutable snapshots: `.raw/prototype-2026-10-20.md`, `.raw/ui-improvements-plan-2026-10-09.md` and three audit snapshots. Existing snapshots unchanged.
- Repointed [[Prototype Guide Source]] to the current snapshot and kept the 2026-10-07 copy as history. Added [[UI Improvements Plan Source]] and [[Design Audits Source]].
- Listed all source pages in the master index and Source Catalog. Noted `composerValidation` in [[Client Interface]].
- Documentation only; no code, behavior or verification status changed. Wiki and implementation remain uncommitted since 2026-10-08.

## 2026-10-10 — Work-first UI and navigation continuity

- Implemented optional/deferred city presentation, safe document reading, result-first completion, latest-review recovery context, per-tab drafts, fragment navigation, loaded-history filters, field-linked validation, and responsive control sizing.
- Preserved provider, persistence, session, and SSE contracts. Verification and synthetic browser evidence are recorded in [the UI audit](../docs/audits/2026-10-10-ui-improvements.md). No live provider job or Telegram notification was used for this pass.

## 2026-10-08 — Ambient monster cleanup and implementation

- Regenerated four source sheets, measured48 full-pose bounds, normalized support-foot anchors and fixed monster scales, and added padded pixel canvases.
- Implemented breathing, roar, stomp and three attack gestures each, with calm intervals, staggered timing and synchronized dust. Pause/resume retains the current hold; loading failures use original sprites.
- Inspected all aligned poses and sampled browser playback/pause. Build/typecheck and independent source review passed. No automated tests or live jobs run. Residual face/armor drift remains documented.
- Updated prototype, [[Client Interface]], [[Pixel Art Consistency]], [[overview|Project Overview]] and hot cache.

## 2026-10-08 — Monster animation pose studies

- Generated four transparent 4×3 sheets: 48 poses covering six sequences each for the insect and red boss.
- Added a standalone paused frame viewer, generation prompts and measured alpha/cell-bound inspection. Recorded identity drift, baseline variation and potential cross-cell contacts; these are not runtime-ready animations.
- Updated [[Client Interface]] and [[Pixel Art Consistency]]. Application behavior and source character frames remain unchanged; no automated tests or live jobs run.

## 2026-10-08 — Vehicles matched to the scene pixel style

- Replaced smooth, over-detailed vehicle artwork with newly generated broad-cluster sedan, taxi and airplane sprites.
- Cars80×32 and planes96×32 display at2× with aspect containment and binary alpha. City, monsters, scene size and animation behavior remain unchanged.
- Updated current asset guidance, [[Client Interface]], [[Pixel Art Consistency]], [[overview|Project Overview]] and prototype docs. Build and sampled browser inspection passed; no automated tests or live provider jobs.

## 2026-10-08 — Vehicle rendering fidelity

- Removed destructive 80×30 / 96×32 intermediate canvases for cars and aircraft. Original PNGs now render directly into the same display boxes with aspect ratios preserved. City and monster rendering remain unchanged.
- Updated asset guidance, [[Client Interface]], [[Pixel Art Consistency]], [[overview|Project Overview]] and prototype docs. Production build and sampled browser inspection passed; no automated tests run.

## 2026-10-08 — Detailed city and vehicle artwork

- Replaced the rejected simple city/car/plane geometry with newly generated raster art: layered city, blue sedan, yellow taxi and airliner. Preserved character sprites and the improved scene proportions.
- Added one-time logical-canvas rendering with nearest-neighbor sampling and integer 2× display. Alpha verified for vehicle sprites; traffic mirroring is separated from movement.
- Saved source assets and generation prompts under `public/art/city-v2/`; updated [[Client Interface]], [[Pixel Art Consistency]], [[overview|Project Overview]] and prototype docs. Production build and sampled browser checks passed; no automated tests or live provider runs.

## 2026-10-08 — City scale and composition correction

- User rejected the oversized street image, tiny vehicles and laptop monster reduction. Replaced thin side strips with a visible panoramic scene above the workspace.
- Added a dedicated layered pixel skyline, fixed 320px monster frames and 128px cars, explicit ground lanes and sky placement. Mobile crops around one monster; collapse pauses the scene, and existing runs open collapsed. Pause and reduced-motion handling remain.
- Updated [[Client Interface]], [[Pixel Art Consistency]], [[overview|Project Overview]] and canonical prototype docs. Production build and sampled browser layout checks passed; no automated tests or live jobs run.

## 2026-10-08 — Animated city backdrop

- Added a city around the workspace using approved art, pixel vehicles, planes and slow monster recoil/dust cycles. Central panels remain opaque; mobile keeps forms full width.
- Added a persisted motion toggle plus reduced-motion and hidden-tab pausing. Ambient animation is independent of real task progress.
- Updated canonical prototype documentation, [[Client Interface]], [[Pixel Art Consistency]] and [[overview|Project Overview]]. Production build and sampled desktop/mobile/pause checks passed; no automated tests or provider jobs run.

## 2026-10-08 — Airy Pixel design refinement

- Added a selected-squad preview to team setup, clearer task/team hierarchy, provider-colored monograms, restrained workspace tabs and stronger result-document emphasis.
- Preserved original sprite geometry, combat behavior, keyboard semantics and accessible text colors; added a skip link and pixel-bolt favicon.
- Updated [[Client Interface]], [[Pixel Art Consistency]], [[overview|Project Overview]] and `docs/prototype.md`. Production build and desktop/320px browser checks passed; no new agent jobs or notifications were sent.

## 2026-10-08 — Accessibility improvements

- Corrected text contrast, control boundaries and narrow-screen navigation/settings reflow while retaining Airy Pixel styling.
- Added lifecycle announcements, explicit result navigation, heading focus, native document disclosures and a visible leader label; terminal transitions preserve mounted drafts.
- Updated [[Client Interface]], [[overview|Project Overview]], [[Key Decisions]], `docs/prototype.md` and the audit remediation notes. Production build and sampled browser checks passed; full screen-reader and live transition checks remain outstanding.

## 2026-10-08 — Backend reliability improvements

- Added paged run summaries and event history, indexed active-run queries, an SSE snapshot cursor, and bounded replay with selected-run resynchronization.
- Added offline SQLite/workspace backup and restore with integrity checks, checksums, atomic staging, and no overwrite of existing state. See [[Backup and Restore Flow]].
- Made Telegram readiness reflect polling failures and recovery, with automatic Settings refresh. Gemini prompts now travel over stdin instead of process arguments; provider CLI modes remain provider-controlled isolation.
- Added GitHub Actions checks for type safety, full tests with an 80% line-coverage gate, production build, and dependency advisories. Integrated verification passed: 101 tests, 82.54% overall line coverage, build, and zero reported npm advisories.
- Restarted the idle local LaunchAgent and verified HTTP 200 for health, paged bootstrap, run history, and Telegram status. The live bootstrap returned summary fields and an event cursor; Telegram reported ready and connected without an error.

## 2026-10-08 — Combat choreography

- Added 12 fps provider-specific attacks, pixel projectiles/trails, monster reactions/counterattacks, task-completion bursts, message transfers, review scans and victory effects.
- Animation respects actual run/task lifecycle, reduced motion, hidden tabs and a local toggle; it never advances task progress. Source sprite poses stay unchanged.
- Updated [[Client Interface]], [[Pixel Art Consistency]], [[overview|Project Overview]], [[Key Decisions]] and `docs/prototype.md`. Production build passed; no automated tests or live agent jobs run for this change.

## 2026-10-08 — Airy Pixel platform foundation

- Implemented selected v7 B across navigation, composition, run workspace and settings.
- Added approved C1/L1/Gemini scene assets and task-to-monster mapping with actual run states; preserved approval and server orchestration contracts.
- Updated [[Client Interface]], [[overview|Project Overview]], [[Key Decisions]], [[Pixel Art Consistency]] and `docs/prototype.md`.
- Production build and 85 platform tests passed after moving the encounter stylesheet import to the browser entry point. No dedicated visual or paid/live agent run was performed for this interface change. Source review fixes include modal history focus and intermediate-width header wrapping.

## 2026-10-08 — macOS automatic startup

- Added a per-user LaunchAgent installer and service controls for the production server.
- Built the client, installed and started `com.poweragents.local`, and verified loopback UI/API access plus Codex, Claude, and Antigravity CLI discovery.
- Verified the installer plist and server reload. Current platform validation has 85 passing tests and 91.11% overall line coverage.
- Documented the single-server constraint, service logs, restart behavior, and Mac sleep/log-out limits in the prototype guide and wiki.

## 2026-10-08 — Weapon selection and platform mockups

- Recorded C1 straight saber and L1 rigid staff as selected in [[Pixel Art Consistency]].
- Added three static platform layout studies plus a plan-approval companion under `output/art-direction/v5-platform-mockups/`. No application behavior changed.

## 2026-10-08 — Telegram notifications

- Added optional server-side bot configuration and one-use private-chat pairing through Settings.
- Queued plan-ready and reviewed-completion alerts transactionally with run changes; added restart-safe delivery, retries, test messages, preferences, and disconnect.
- Kept approval in the local app and excluded task content from Telegram messages. Updated the prototype guide, wiki modules, flow, and navigation.
- Verified mocked Bot API behavior, protected HTTP routes, type checking, and project coverage; no live Telegram message was sent.

## 2026-10-08 — Pixel-art direction

- Recorded [[Pixel Art Consistency]] as the authoritative approved visual constraint, including logical-grid, shading, scene-composition, and inspection rules.
- Distinguished preferred Option B character construction and v2 identities from rejected v3 weapons and smooth encounter rendering.
- Recorded v4 working dimensions as a proposal and weapon choices as pending selection; no application redesign or animation implementation is claimed.
- Linked the decision from navigation, overview, key decisions, and client documentation while retaining model-selection and session-recovery context.

## 2026-10-07 — Model selection

- Replaced free-form model IDs in the team composer with a connection-specific selector.
- Added protected, on-demand model discovery through Codex and Antigravity CLI commands and OpenAI/Anthropic model-list APIs. Claude Code uses documented aliases until a machine-readable CLI list is available.
- Kept provider credentials on the server and documented that catalog presence does not prove account entitlement or endpoint compatibility.

## 2026-10-07 — Session recovery

- Added a one-time browser session recovery path after HTTP 401, including fresh CSRF tokens for mutations and event stream reconnection.
- Verified a full demo workflow in the in-app browser.
- Verified a live Codex/Gemini workflow through planning, approval, three dependent tasks, synthesis, and independent review; saved Markdown and review artifacts.
- Reproduced a stream recovery gap on server restart, fixed the retry path, and verified a production client reconnected without a page reload.
- Added backoff for repeated short-lived event streams and restricted the client request helper to same-origin `/api` paths after security review.

## 2026-10-07 — Initial scaffold

- Created a repository mode Obsidian wiki with module, flow, decision, dependency, source, and domain navigation.
- Preserved dated snapshots of the prototype guide, platform design, and implementation plan under `.raw/`.
- Documented the implemented architecture separately from planned platform capabilities.
- Added `AGENTS.md` maintenance instructions for updates after every major implementation.
