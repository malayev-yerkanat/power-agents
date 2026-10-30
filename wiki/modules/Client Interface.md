---
type: module
title: "Client Interface"
path: "src/client/"
status: active
language: typescript
purpose: "Compose teams and operate runs from the browser"
created: 2026-10-07
updated: 2026-10-30
tags: [module, ui]
---

# Client Interface

F2 adds a separate **Потоки** list/canvas at `#/flows` and `#/flows/<id>`; see [[Flows UI]] for cards, typed ports, inspector, queued versioned writes and flow event refresh.

`App.tsx` owns bootstrap/session/SSE synchronization and uses [useWorkspaceLocation](../../src/client/useWorkspaceLocation.ts) for creation, history, run and flow fragment routes. [navigation](../../src/client/navigation.ts) validates route IDs and tabs. [HistoryView](../../src/client/HistoryView.tsx) filters loaded summaries and retains older-page pagination; it is not a server-wide search. [session](../../src/client/session.ts) handles HTTP errors and recovers a stale session with one bootstrap and retry. [Composer](../../src/client/Composer.tsx) collects goal, 2–5 participants, leader, connections, roles, models, and live/demo mode. [ModelPicker](../../src/client/ModelPicker.tsx) presents models returned for the chosen connection instead of accepting an arbitrary ID. [RunWorkspace](../../src/client/RunWorkspace.tsx) shows the plan, approval actions, progress, messages, and artifacts. [TelegramSettings](../../src/client/TelegramSettings.tsx) shows pairing, connection health, a test alert, preferences, and disconnect controls for [[Telegram Notifications]].

[draftStorage](../../src/client/draftStorage.ts) validates editor-only versioned envelopes, and [useBrowserDraft](../../src/client/useBrowserDraft.ts) saves edits to `sessionStorage`. Composer and per-run steering drafts survive navigation and reload in the current tab. Storage failures are visible. Unknown provider selections are preserved for correction rather than silently reassigned.

[MarkdownDocument](../../src/client/MarkdownDocument.tsx) renders structured Markdown with raw HTML disabled and remote images replaced by text. [ArtifactView](../../src/client/ArtifactView.tsx) provides document/source presentation and copy/download actions. [RunContext](../../src/client/RunContext.tsx) exposes the current phase, optional encounter, and latest-review context for paused/failed runs without inventing a stored verdict.

The history page and navigation dialog start with 30 recent run summaries and load older runs on request. Selecting a run fetches full detail with the latest 100 journal events; the journal can load older event pages. A large SSE replay gap triggers snapshot recovery for the run list and selected detail. See [[Session and API Flow]].

The UI is a view of server state; [[Orchestration Engine]] owns scheduling and persistence. See [App](../../src/client/App.tsx), [Composer](../../src/client/Composer.tsx), [ModelPicker](../../src/client/ModelPicker.tsx), [RunWorkspace](../../src/client/RunWorkspace.tsx), [[Session and API Flow]], and [[Model Selection Flow]].

## Pixel visual workspace

The selected v7 B Airy Pixel direction is implemented: ivory/cobalt surfaces, locally hosted Press Start 2P headings/navigation, readable prose, a centered single-column workspace, a history page with a native modal navigation dialog, and collapsed secondary team controls. Creation places the goal and team summary before the optional squad preview. The ambient city starts collapsed and loads its artwork on first expansion. Completed runs place the accepted document above the optional encounter. Pause/resume remains near run status. Settings and team composition share the same theme.

[Encounter](../../src/client/Encounter.tsx) maps connection IDs to approved C1/L1/Gemini sprites and displays up to five members in staggered positions. Unknown providers use a neutral tile. Up to three outstanding tasks appear as numbered villains; a disclosure maps their numbers to real task titles and counts additional outstanding tasks. Completed tasks disappear. Member labels derive from actual run status, phase and task status; review is labelled as a phase rather than claiming a particular member is actively reviewing.

The scene uses fixed logical pixels and horizontal scrolling on narrow screens. Combat now uses a 12 fps React clock and integer sprite positions: Codex dash/slash, Claude staff lunge, Gemini projectile/recoil, monster impact/counter-projectile and Ranger recoil, completion burst, message envelope, review scan, planning/synthesis charge and run-victory confetti. Only running assigned tasks trigger attacks. The reviewer is the first nonleader, matching the current engine. Paused/failed/cancelled/approval states suppress combat. The clock stops in hidden tabs and for reduced motion or the local animation toggle. A terminal completion can briefly settle newly observed effects; reopening a run does not replay historical transitions. Dedicated hand-drawn pose sheets remain future work. Assets are concept-derived approved frames, not certified hand-authored animation assets. Follow [[Pixel Art Consistency]].

Validation: TypeScript/Vite production build and 85 passing platform tests after moving the encounter stylesheet import to the browser entry point. No dedicated visual or live-agent test was run for this interface change.

## Combat rendering modules

- [combat.ts](../../src/client/combat.ts): provider identity, lifecycle-aware member states, staggered 48-frame attack cycle and visibility-aware clock.
- [CombatEffects.tsx](../../src/client/CombatEffects.tsx): bounded declarative SVG effects on the 768×356 logical grid; all generated geometry is rounded to pixels with crisp edges.
- [Encounter.tsx](../../src/client/Encounter.tsx): target selection, formations, effects for newly observed task/message/run transitions, explanatory state labels and animation toggle. At most three monsters appear, with running tasks prioritized. Effects are decorative and do not mutate or advance server state.

Combat is a visual activity indicator, not a measured percentage, health or quality estimate. Existing original sprites are translated without smooth rotation/scaling. Short-lived transition effects expire and the animation interval cleans up on unmount. New artwork/animation sheets would require a separate art-production pass.

## Accessibility and reading context

The 2026-10-08 accessibility pass darkens shared text colors, strengthens form borders, wraps header navigation and tabs, and allows settings paths/text to wrap at 320 CSS pixels. The spatial encounter keeps its intentional horizontal scrolling.

Explicit run navigation focuses `workspace-heading`. [useRunAnnouncement](../../src/client/useRunAnnouncement.ts) supplies a persistent polite status region for lifecycle, phase, task counts and message updates; combat ticks are excluded. Completion preserves the selected tab and offers a button that focuses Results. A steering draft stays available read-only on terminal transitions, preserving text for copying. Per-run drafts also survive navigation and reload in the current browser tab through `sessionStorage`; they are not cross-device storage or SQLite records.

Additional artifacts use native document-specific disclosures; the latest final remains visible. Team leadership has a visible text label, and tab panels are keyboard-focusable. Invalid composer fields expand, receive focus, and link to a specific error; [composerValidation](../../src/client/composerValidation.ts) maps each issue to its field ID. See the [baseline audit](../../docs/audits/2026-10-08-accessibility.md) and [2026-10-10 UI audit](../../docs/audits/2026-10-10-ui-improvements.md), summarized in [[Design Audits Source]]. Full assistive-technology verification remains outstanding.

## Airy Pixel design refinement

The 2026-10-08 refinement retains approved sprites, ivory/cobalt colors, pixel typography and the minimal layout. [SquadPreview](../../src/client/SquadPreview.tsx) shows the currently selected 2–5 agents in a static staggered formation on the composer. Frames remain 160×160 CSS pixels with nearest-neighbor rendering; provider identity does not determine roles. The preview is decorative because the editable roster supplies names and controls.

[workspace-polish.css](../../src/client/workspace-polish.css) loads after the existing client and encounter styles. It defines the refined intro composition, goal/team hierarchy, restrained tabs and document surfaces, provider-colored monograms and responsive single-column layout. Scene rendering and combat logic are unchanged. Keyboard navigation is immediate; pointer press feedback uses short pixel-step translations, disabled for reduced motion. A skip link focuses the workspace heading; a pixel-bolt favicon identifies the browser tab.

Verification: production build, desktop inspection, 320px page/nav/tab/settings measurements, native-size images and a five-member preview. Existing paused/completed runs were inspected without starting jobs. No automated test suite or full assistive-technology session was run for this visual pass.

Design evidence and before/after rationale: [design refinement](../../docs/audits/2026-10-08-design-refinement.md).

## Ambient city backdrop — 2026-10-08

[CityBackdrop](../../src/client/CityBackdrop.tsx) offers a compact disclosure above the workspace and mounts the panoramic artwork only after the first expansion. The first fixed backdrop was rejected for mismatched scale; its replacement's procedural buildings and vehicles were then rejected for insufficient detail. The current expanded scene uses [generated city-v2 raster assets](../../public/art/city-v2/README.md), with layered architecture, textured surfaces, dark contours and shaded vehicles matching the character references. Existing Ranger/monster frames and run encounter art are unchanged.

[PixelArtwork](../../src/client/PixelArtwork.tsx) renders the city at 768×256 logical pixels. Current [vehicles-v3 sprites](../../public/art/vehicles-v3/README.md) were redrawn with broad clusters for cars at 80×32 and aircraft at 96×32, all displayed at integer 2×. Aspect-contained integer drawing preserves proportions; optional binary alpha removes residual vehicle halos. This replaces the v2 vehicles, which lost details when reduced and looked overly smooth when directly minified. Monster frames remain 320×320. [city-backdrop.css](../../src/client/city-backdrop.css) crops 64px off the 512px city canvas to preserve the existing 448px scene and ground alignment. Mobile crops around one monster without shrinking assets. A collapse control pauses/hides the scene; all routes open with the city collapsed. Reversed traffic mirrors the inner artwork independently of its moving wrapper. [city-workspace.css](../../src/client/city-workspace.css) keeps the ivory working area below the scene.

This ambient scene is independent of task state; only the existing encounter represents actual work. The separate city-motion button stores its preference locally. Reduced-motion preferences and hidden tabs pause all city animation; event listeners clean up on unmount. Decoration is hidden from assistive technology and cannot intercept pointer input. No React animation clock or new dependency is added.

Production build and sampled browser checks at 1920px, 1440px and 320px passed. Pause, saved preference after reload and animation styles were checked. OS reduced-motion and visibility handling were reviewed in source; no automated tests or live provider jobs were run. The initial backdrop screenshot is historical; [current vehicle style](../../docs/audits/assets/2026-10-08-vehicle-style-match.jpg).

## Articulated ambient monsters — 2026-10-08

[AnimatedCityMonster](../../src/client/AnimatedCityMonster.tsx), [monsterAnimation](../../src/client/monsterAnimation.ts) and [monsterAtlas](../../src/client/monsterAtlas.ts) now replace the ambient static-image shake with articulated pose playback. [Cleaned source sheets and rendering notes](../../public/art/monster-motion/README.md) preserve48 poses; breathing uses the calm first two, while roar, stomp and three attacks use four key poses each. Rest intervals and staggered actor schedules keep the panorama calm. Dust is synchronized to stomp/slam strikes; detached old impact timers were removed.

Individual full-silhouette crops avoid cutting limbs at source-cell edges. Fixed per-monster scale and a shared ground anchor prevent per-frame resizing. A padded192×176 logical canvas renders at2× around the original320px actor box. Canvas updates occur only on pose changes, without a React animation clock. Pause/collapse/hidden-tab/reduced-motion stop the timer; resume preserves the remaining hold. Failed image loading/rendering falls back to original static sprites.

This affects only the ambient city. The task-state Encounter remains unchanged. Minor face/armor drift and limited inbetween frames remain; this is a first key-pose implementation. All48 aligned poses were inspected in-browser, production build/typecheck passed, and sampled playback and pause controls were checked. No automated tests or live provider jobs were run.
