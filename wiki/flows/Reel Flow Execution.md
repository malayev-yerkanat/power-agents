---
type: flow
title: "Reel Flow Execution"
status: active
created: 2026-10-30
updated: 2026-10-30
tags: [flow, dag, approvals]
---

# Reel Flow Execution

F1 implements the local API and demo execution in [[Flow Engine]]; F2 adds the browser canvas in [[Flows UI]]. Live provider/media executors remain planned for F3/F4. Authoritative behavior: [prototype guide](../../docs/prototype.md), [engine](../../src/server/flows/engine.ts), [API tests](../../tests/flow-http.test.ts).

1. Open **Потоки** (`#/flows`), keep **Демо** selected and choose **Новый поток**. This creates the `roblox-reel` template through `POST /api/flows` and opens `#/flows/<id>`. The API also supports empty flows. Mutations reuse the bootstrap session and CSRF header. Template gates follow the registry; Brand, Prompt and QA approve automatically.
2. Drag cards to save layout, connect port handles, select nodes/edges and press Delete, or choose **+ Узел**. The inspector edits title, gate and registry-default config, and exposes full output JSON, notes, version and error. Writes queue with the latest flow version; 409 refetches server state. Edges connect matching output/input types; text inputs accept any output. Every required input must have one connection to an approved source before a node can run.
3. Choose **Запустить** on **Бренд**, then **Идея**. Approve Idea to unlock **Сценарий**, then run it. Each button calls `POST /api/flows/:id/nodes/:nodeId/run` with `{}`. It queues globally, then starts with its next node version, input hash and `.power-agents/flows/<flowId>/<nodeId>/v<version>/` directory.
4. Gated results stop at `awaiting_approval` with an amber card border. **Одобрить** sends `{}`; **Отклонить** opens a required note dialog and sends `{ note }`. Rejection preserves the note for the next execution. Downstream nodes remain blocked until the upstream result is approved.
5. With `autoRun` enabled, ready idle/stale nodes queue after an approval or successful execution. Otherwise run each node explicitly. Preview and Final serialize in a lower-priority render lane. QA runs without a gate, and Final waits for its report.
6. Config changes, rewiring and upstream reruns/approvals invalidate descendant output. Previous output stays visible in the API with stale status; downstream reruns use current source versions. Concurrent execution-setting edits and outdated patch versions are refused.
7. On restart, queued/running nodes and all unfinished history rows fail with `interrupted, run again`. A failed node requires an explicit run; a late superseded result cannot overwrite current state.

`GET /api/flows/:id` returns the graph and recent execution records; `/api/flows/registry` exposes client-safe registry metadata and config defaults. Global SSE `flow` events invalidate the selected graph and list, prompting refetches; opening/reopening the stream also refreshes flows to recover missed changes. Flow events do not share the persisted team-run event replay history.

Cards preview the first output port; stale results remain visible but dimmed. File paths show media placeholders. Current output stays in flow JSON and execution metadata in `node_runs`; historical rollback and playable demo media are not implemented. Planned follow-ups are LLM executors (F3), media pipeline/upload/download (F4), and Telegram approval (F5). Selecting live mode currently yields an explicit unavailable-executor error rather than running a provider.

The [demo browser tests](../../tests/e2e/flows.spec.ts) cover the Brand/Idea/Script gate and every template node through Final, using the real flow engine/API handler with intercepted HTTP and flow notifications. See [[log|Operation Log]] for actual verification results; no live executor acceptance is implied.
