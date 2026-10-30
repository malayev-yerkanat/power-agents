---
type: flow
title: "Reel Flow Execution"
status: active
created: 2026-10-30
updated: 2026-10-30
tags: [flow, dag, approvals]
---

# Reel Flow Execution

F1 implements the local API and demo execution in [[Flow Engine]]; F2 adds the browser canvas in [[Flows UI]]. F3 adds live Idea, Script and Scenes; media executors remain planned for F4. Authoritative behavior: [prototype guide](../../docs/prototype.md), [engine](../../src/server/flows/engine.ts), [API tests](../../tests/flow-http.test.ts).

1. Open **Потоки** (`#/flows`), choose **Демо** for fixtures or **Живой** for LLM text generation, then choose **Новый поток**. This creates the `roblox-reel` template through `POST /api/flows` and opens `#/flows/<id>`. The API also supports empty flows. Mutations reuse the bootstrap session and CSRF header. Template gates follow the registry; Brand, Prompt and QA approve automatically.
2. Drag cards to save layout, connect port handles, select nodes/edges and press Delete, or choose **+ Узел**. The inspector edits title, gate and registry-default config (including an available-connection select with **Авто**), and exposes full output JSON, notes, version and error. Writes queue with the latest flow version; 409 refetches server state. Edges connect matching output/input types; text inputs accept any output. Every required input must have one connection to an approved source before a node can run.
3. For live mode, set Brand text/rules and optionally Idea topic, extra instructions, connection and model in the inspector. **Авто** prefers Claude Code → Codex → Gemini CLI and fails clearly if none is available. Choose **Запустить** on **Бренд**, then **Идея**. Approve Idea to unlock **Сценарий**, then run it. Each button calls `POST /api/flows/:id/nodes/:nodeId/run` with `{}`. It queues globally, then starts with its next node version, input hash and `.power-agents/flows/<flowId>/<nodeId>/v<version>/` directory.
4. Gated results stop at `awaiting_approval` with an amber card border. **Одобрить** sends `{}`; **Отклонить** opens a required note dialog and sends `{ note }`. Rejection preserves every note for later executions; live prompts include them under “Revise according to these notes”. Downstream nodes remain blocked until the upstream result is approved.
5. With `autoRun` enabled, ready idle/stale nodes queue after an approval or successful execution. Otherwise run each node explicitly. Preview and Final serialize in a lower-priority render lane. QA runs without a gate, and Final waits for its report.
6. Config changes, rewiring and upstream reruns/approvals invalidate descendant output. Previous output stays visible in the API with stale status; downstream reruns use current source versions. Concurrent execution-setting edits and outdated patch versions are refused.
7. On restart, queued/running nodes and all unfinished history rows fail with `interrupted, run again`. A failed node requires an explicit run; a late superseded result cannot overwrite current state.

`GET /api/flows/:id` returns the graph and recent execution records; `/api/flows/registry` exposes client-safe registry metadata and config defaults. Global SSE `flow` events invalidate the selected graph and list, prompting refetches; opening/reopening the stream also refreshes flows to recover missed changes. Flow events do not share the persisted team-run event replay history.

Cards preview the first output port; live Idea shows its chosen topic and hook, and Script shows its hook and measured word count; stale results remain visible but dimmed. File paths show media placeholders. Current output stays in flow JSON and execution metadata in `node_runs`; historical rollback and playable demo media are not implemented. Live Idea returns 3–5 scored candidates and a highest-scoring selection ≥18, Script returns a metaphor map and five-beat 130–160-word script, and Scenes returns an ordered shot list. Prompts include the hard-no topic rules; the human gate still checks semantic safety. Turns are read-only, without team tools or session reuse; malformed output gets one correction before failing. Planned follow-ups are media pipeline/upload/download (F4) and Telegram approval (F5). Other live nodes fail with `not available until F4`.

To run live Scenes before F4, delete the template's Voice → Scenes timing edge, then approve Script. Scenes uses script beat times when timings are disconnected; connected timings take precedence and still require approval. Inline timings accept `{ beats: [{ beat, start, end }] }` or `{ words: [{ start, end }] }`, with ordered intervals and one aligned interval per whitespace-separated script word. Connected Brand carries both text and rules into Scenes.

The [demo browser tests](../../tests/e2e/flows.spec.ts) cover the Brand/Idea/Script gate and every template node through Final, using the real flow engine/API handler with intercepted HTTP and flow notifications. See [[log|Operation Log]] for actual verification results; the socket-free HTTP tests exercise injected live Idea/Script runners, but no real provider acceptance run is implied.
