---
type: module
title: "Client Interface"
path: "src/client/"
status: active
language: typescript
purpose: "Compose teams and operate runs from the browser"
created: 2026-10-07
updated: 2026-10-08
tags: [module, ui]
---

# Client Interface

`App.tsx` bootstraps the browser, keeps the selected run and connections in state, opens an EventSource for updates, and sends JSON mutations with the CSRF token. `session.ts` handles HTTP errors and recovers a stale session with one bootstrap and retry. `Composer.tsx` collects goal, 2–5 participants, leader, connections, roles, models, and live/demo mode. `ModelPicker.tsx` presents models returned for the chosen connection instead of accepting an arbitrary ID. `RunWorkspace.tsx` shows the plan, approval actions, progress, messages, and artifacts. `TelegramSettings.tsx` shows pairing, connection health, a test alert, preferences, and disconnect controls for [[Telegram Notifications]].

The UI is a view of server state; [[Orchestration Engine]] owns scheduling and persistence. See [App](../../src/client/App.tsx), [Composer](../../src/client/Composer.tsx), [ModelPicker](../../src/client/ModelPicker.tsx), [RunWorkspace](../../src/client/RunWorkspace.tsx), [[Session and API Flow]], and [[Model Selection Flow]].

## Pixel visual workspace

The selected v7 B Airy Pixel direction is implemented: ivory/cobalt surfaces, locally hosted Press Start 2P headings/navigation, readable prose, a centered single-column workspace, a native modal history drawer, and collapsed secondary team controls. Pause/resume remains near run status. Settings and team composition share the same theme.

[Encounter](../../src/client/Encounter.tsx) maps connection IDs to approved C1/L1/Gemini sprites and displays up to five members in staggered positions. Unknown providers use a neutral tile. Up to three outstanding tasks appear as numbered villains; a disclosure maps their numbers to real task titles and counts additional outstanding tasks. Completed tasks disappear. Member labels derive from actual run status, phase and task status; review is labelled as a phase rather than claiming a particular member is actively reviewing.

The scene uses fixed logical pixels and horizontal scrolling on narrow screens. Active workers have a subtle one-pixel CSS idle offset; paused/terminal states and reduced-motion preference disable it. Full combat/status animation sheets remain future work. Assets are concept-derived approved frames, not certified hand-authored animation assets. Follow [[Pixel Art Consistency]].

Validation: TypeScript/Vite production build and 85 passing platform tests after moving the encounter stylesheet import to the browser entry point. No dedicated visual or live-agent test was run for this interface change.
