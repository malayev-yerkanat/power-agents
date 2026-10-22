---
type: log
status: active
created: 2026-10-07
updated: 2026-10-22
tags: [history]
---

# Operation Log

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
