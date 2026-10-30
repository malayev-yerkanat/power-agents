---
type: module
title: "Flows UI"
path: "src/client/flows/"
status: active
language: typescript
purpose: "Edit and operate typed approval flows on a canvas"
created: 2026-10-30
updated: 2026-10-30
tags: [module, flows, ui]
---

# Flows UI

F2 adds the Russian **Потоки** navigation entry beside the team workspace. [Navigation](../../src/client/navigation.ts) supports `#/flows` for the list and `#/flows/<id>` for a canvas. [FlowList](../../src/client/flows/FlowList.tsx) creates a `roblox-reel` template in demo mode by default, with a demo/live selector. Existing team-run styling and behavior remain separate. See [[Reel Flow Execution]] and the [prototype guide](../../docs/prototype.md).

[FlowCanvas](../../src/client/flows/FlowCanvas.tsx) uses pinned `@xyflow/react` 12.12.0 and its stylesheet for a near-black dotted canvas, pan/zoom, initial fit-to-view, Controls and MiniMap. Thin bezier edges join coloured input/output handles. The toolbar shows the title, demo/live badge, **Автозапуск**, and **+ Узел** registry menu. [flows.css](../../src/client/flows/flows.css) scopes the new workspace appearance.

[FlowCard](../../src/client/flows/FlowCard.tsx) shows the type, node title, status chip and first output port's text/JSON excerpt. F3 renders Idea's chosen topic/hook and Script's hook/word count as readable text. Handles expose registry port names as tooltips and colours by type. Running pulses; awaiting approval is amber; approved is green; stale is dimmed; failed is red. Ready nodes expose **Запустить**; gated results expose **Одобрить** and **Отклонить**. Reject opens a note dialog and reruns with the required note. Media file paths show a placeholder; upload and media playback routes remain planned for F4.

[FlowInspector](../../src/client/flows/FlowInspector.tsx) opens on the right for a selected node. It edits title, approval gate and config from registry defaults: strings use input/textarea, numbers use number inputs, and string arrays use newline textareas. F3 loads `GET /api/flows/connections` and renders **Подключение** as a select of available connections plus **Авто**; a saved unavailable choice stays visible but disabled. It also shows full output JSON, notes, execution version and error. Saving patches the graph; queued/running execution settings are disabled. Historical output rollback is not implemented.

[useFlow](../../src/client/flows/useFlow.ts) loads detail plus `GET /api/flows/registry`, queues writes against the current version, and refetches after a rejected write. A 409 asks the user to repeat the action against refreshed state. Drag positions persist after 350 ms of debounce. Connecting handles checks matching port types (`text` input accepts any); server validation still enforces the graph contract and errors appear in a toast. Delete removes selected nodes/edges and incident edges. **+ Узел** copies registry config and gate defaults. **Автозапуск** patches the server's existing scheduler setting.

[App](../../src/client/App.tsx) forwards global SSE `flow` notifications as browser invalidations. The selected flow refetches detail on each matching event and on stream open/reconnect; the list refreshes on invalidation. Store notifications are not replayed with the team-run event cursor, so reconnect snapshot reads recover gaps. [[Flow Engine]] owns execution and [[Local HTTP API]] owns protected routes; the client never imports the server registry or executors.

[Pure helper tests](../../tests/flow-canvas.test.ts) cover compatible ports, readiness and flow-to-React-Flow mapping; [navigation tests](../../tests/navigation.test.ts) cover route round trips. [Browser tests](../../tests/e2e/flows.spec.ts) exercise Brand → Idea → approval → Script, the complete ten-node demo, inspector event/conflict recovery, and graph connection/add/drag/keyboard/delete persistence with the real engine/API handler behind intercepted browser requests and flow events. These are demo-only checks; live Idea/Script/Scenes have fake-runner tests; real-provider smoke testing remains unverified and media executors remain planned for F4. Browser verification depends on permission to bind the Playwright Vite server; see [[log|Operation Log]] for the recorded run result.
