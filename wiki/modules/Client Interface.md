---
type: module
title: "Client Interface"
path: "src/client/"
status: active
language: typescript
purpose: "Compose teams and operate runs from the browser"
created: 2026-10-07
updated: 2026-10-07
tags: [module, ui]
---

# Client Interface

`App.tsx` bootstraps the browser, keeps the selected run and connections in state, opens an EventSource for updates, and sends JSON mutations with the CSRF token. `session.ts` handles HTTP errors and recovers a stale session with one bootstrap and retry. `Composer.tsx` collects goal, 2–5 participants, leader, connections, roles, models, and live/demo mode. `ModelPicker.tsx` presents models returned for the chosen connection instead of accepting an arbitrary ID. `RunWorkspace.tsx` shows the plan, approval actions, progress, messages, and artifacts.

The UI is a view of server state; [[Orchestration Engine]] owns scheduling and persistence. See [App](../../src/client/App.tsx), [Composer](../../src/client/Composer.tsx), [ModelPicker](../../src/client/ModelPicker.tsx), [RunWorkspace](../../src/client/RunWorkspace.tsx), [[Session and API Flow]], and [[Model Selection Flow]].
