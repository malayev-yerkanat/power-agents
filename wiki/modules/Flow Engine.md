---
type: module
title: "Flow Engine"
path: "src/server/flows/engine.ts"
status: active
language: typescript
purpose: "Execute typed DAG nodes with approval gates and demo outputs"
created: 2026-10-30
updated: 2026-10-30
tags: [module, flows, scheduling]
---

# Flow Engine

F1 adds an independent headless `FlowEngine`, constructed by [[Server Runtime]] beside [[Orchestration Engine]]. It uses [[Persistence Store]] flow JSON and node execution history. See [[Reel Flow Execution]] for the approval flow and [prototype guide](../../docs/prototype.md) for API contracts.

[Registry](../../src/server/flows/registry.ts) defines Brand, Idea, Script, Voice, Scenes, Capture, Edit, Preview, QA, Final and Prompt, their typed ports, defaulted Zod configs and gate defaults. Voice emits separate audio and timings values. Preview and Final share the `render` lane. The `roblox-reel` template wires ten nodes, including Final's required QA report input. The demo executor includes node type, port, config, execution version and rejection notes in deterministic inline fixtures.

[Engine](../../src/server/flows/engine.ts) validates replacement graphs, unique IDs, compatible ports (text accepts any), single input connections, acyclicity and optimistic flow versions. Runtime fields remain server owned. Config/type/gate edits, rewiring and removal are refused while their node is queued/running. Config/graph changes and upstream executions invalidate dependent output, preserving existing values. Late results cannot restore an invalidated execution.

The scheduler limits all flows together to three active calls and one per named lane, with renders lower priority. Execution increments the node version, records a SHA-256 hash of config and upstream identities/versions, creates a version directory, and records timing/status/error. Gate-off nodes approve automatically; gated nodes await an explicit decision. Auto-run queues newly ready idle/stale nodes, but never retries failed nodes. Shutdown aborts active signals; restart fails all unfinished nodes and histories without rerunning them, including flows outside API list limits.

[API routes](../../src/server/flows/http.ts) reuse local session, CSRF, request-size, origin and rate checks through [[Local HTTP API]]. The engine emits store flow events after updates; the global `/api/events` stream now delivers `flow` invalidations driven by `subscribeFlows`. [[Flows UI]] refetches the selected graph after matching events and stream open/reconnect. [Engine tests](../../tests/flow-engine.test.ts) and [API tests](../../tests/flow-http.test.ts) use in-memory SQLite and injected executors.

F2 implements the canvas and inspector in [[Flows UI]], with client-safe registry metadata exposed at `GET /api/flows/registry`. Uploads, Range-served media, live provider/pipeline executors and Telegram gate actions remain planned for F3–F5. Live execution without an injected executor fails explicitly with `not available until F3/F4`. Demo fixtures are not media files.
