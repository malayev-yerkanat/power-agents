---
type: module
title: "Flow Engine"
path: "src/server/flows/engine.ts"
status: active
language: typescript
purpose: "Execute typed DAG nodes with approval gates, demo outputs and live text nodes"
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

F2 implements the canvas and inspector in [[Flows UI]], with registry metadata at `GET /api/flows/registry`. F3 adds [live executors](../../src/server/flows/executors.ts) and [output validation](../../src/server/flows/outputs.ts) for Idea, Script and Scenes. Runtime passes discovered connections and `runTurn`; tests inject a `TurnRunner`. Brand returns static configured values in live mode; demo keeps its fixtures. Other live nodes fail with `not available until F4`. Uploads, Range-served media and pipeline executors remain planned for F4; Telegram gates remain planned for F5.

Connection/model come from config. Auto selects available Claude Code → Codex → Gemini CLI; explicit unavailable choices and missing CLI fallbacks fail in Russian. A synthetic member uses purpose `flow`, the node version directory and read-only access, without team tools or session reuse. `GET /api/flows/connections` exposes connection metadata without executable paths to the protected inspector.

English prompts include connected brand text/rules, upstream values, extra instructions and all rejection notes. Idea follows the content brief's topic sources, safety hard-no list and five-score rubric; validation enforces 3–5 candidates, score sums, exact hook pattern and highest-score selection ≥18. Safety semantics remain prompt guidance plus human approval, not a claim of automated moderation. Script builds the metaphor map first, validates actual 130–160-word text and count consistency, the hook and five fixed 0–55-second beats. Scenes checks ordered complete beat coverage, unique IDs and intervals. Optional timings accept five named `beats` or aligned `words` with one interval per script word; absent timings use beat times. Optional brand ports are available on all three LLM nodes.

Parsing/validation failure gets one stateless repair with the shape, error and prior response. Word errors state the measured count. A second failure is stored as a failed node; provider errors bypass formatting retries. [Executor tests](../../tests/flow-executors.test.ts) cover prompts, connections, JSON/count repair and scene contracts; engine and socket-free HTTP tests establish live-only provider calls and protected API execution. No live-provider acceptance run was performed for F3; see [[log|Operation Log]] for checks.
