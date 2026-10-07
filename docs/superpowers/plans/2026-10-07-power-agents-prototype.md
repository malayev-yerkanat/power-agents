# Power Agents Prototype Implementation Plan

> **For agentic workers:** Use subagent-driven development for bounded modules. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a running local web prototype where different providers collaborate on one approved task and return a reviewed shared result.

**Architecture:** A Node.js coordinator owns persisted runs, task dependencies, mailboxes and review rounds. CLI/API adapters execute bounded turns; React displays real state over a local HTTP API and SSE. Structured turn results transport team messages in this prototype, with next-turn delivery; dedicated MCP tools and autonomous workspace mutation belong to the full version.

**Tech Stack:** Node.js 24, TypeScript, SQLite (`node:sqlite`), React, Vite, Tailwind, Zod, Node test runner.

---

## Prototype boundary

All three CLI providers are real integrations. API providers use server-side environment credentials. A clearly labelled deterministic demo lets users inspect collaboration without spending provider quota. Prototype tasks read context and produce text/document artifacts; agents run in planning/read-only modes. The application itself is implemented normally. General shell execution, code merges, file uploads, credential-entry UI and a shared MCP tool server follow after this collaboration slice.

## Task 1: Contracts and persistence

Owner: root/shared contracts; persistence worker owns `src/server/store.ts` and `tests/store.test.ts`.

- [ ] Define `Run`, `TeamPlan`, `TeamTask`, `TeamMessage`, `Artifact`, `RunEvent` and adapter contracts in `src/shared/types.ts`.
- [ ] Start with an in-memory database test that creates a run and event atomically, reloads them, and rejects a duplicate ID.
- [ ] Implement a synchronous SQLite store with immutable run updates and a monotonically increasing event ID.
- [ ] Verify restart persistence, event pagination and unknown-run rejection.
- [ ] Run `npx tsx --test tests/store.test.ts`; expect all cases to pass.

## Task 2: Provider adapters

Owner: adapter worker owns `src/server/adapters/` and `tests/adapters.test.ts`.

- [ ] Test JSON extraction from plain/fenced and provider-wrapped output before implementation.
- [ ] Detect installed executable paths and credential presence without exposing credentials.
- [ ] Implement bounded process execution with argument arrays, stdout limits, abort handling and child process cleanup.
- [ ] Implement Codex, Claude and Antigravity read-only/planning invocations and provider session continuation.
- [ ] Add OpenAI Responses and Anthropic Messages API adapters with required explicit model and environment key.
- [ ] Test missing credentials, non-zero CLI exit, cancellation and malformed provider result; no paid calls in automated tests.
- [ ] Run `npx tsx --test tests/adapters.test.ts`; expect all cases to pass.

## Task 3: Coordination and application API

Owner: root owns `src/server/engine.ts`, helper modules, HTTP entrypoint and integration tests.

- [ ] Write a scripted-runner integration test: leader proposes plan; workers remain idle before approval; one sends a question; peer answers; worker continues; leader synthesizes; reviewer passes.
- [ ] Validate plans against approved member IDs and reject dependency cycles.
- [ ] Schedule up to three independent turns, at most one per member session. Give queued peer questions priority and release slots while waiting.
- [ ] Persist every transition and artifact. Accept only validated envelopes and existing recipients; enforce turn/review limits.
- [ ] Implement pause, cancel, resume and restart recovery as explicit states. Do not automatically replay interrupted attempts.
- [ ] Serve loopback-only API with same-origin session/CSRF protection, bounded bodies and reconnectable SSE.
- [ ] Run `npm test`; expect deterministic workflow, recovery and HTTP protection tests to pass.

## Task 4: Browser workspace

Owner: UI worker owns `src/client/` only.

- [ ] Build the actual empty workspace, team configuration, goal form and clear live/demo selection.
- [ ] Connect run list, plan approval, tasks, conversation, artifacts and event history to the API.
- [ ] Include pending, error, disconnected and interrupted states, accessible forms, keyboard focus and mobile layout.
- [ ] Implement pause/resume/cancel, user steering messages and artifact download. Render provider text as text, never untrusted HTML.
- [ ] Run `npm run build`; expect typecheck and Vite production build to pass.

## Task 5: Integration and delivery

- [ ] Review spec compliance first, then correctness/security; fix findings and repeat affected checks.
- [ ] Run `npm test`, `npm run build`, `npm audit --omit=dev`.
- [ ] Start the local app and inspect in a browser: create demo run, approve, observe peer exchange and revised result, refresh and confirm persistence.
- [ ] Perform a minimal live provider collaboration check if authenticated providers permit it; report any unavailable provider accurately.
- [ ] Document setup, key environment variables, workflow, privacy/permission boundary and prototype limitations in `README.md`.
- [ ] Commit local implementation and show the running workspace; publishing remains a separate user action.

## Acceptance

The demo is always labelled and cannot masquerade as live execution. A live run must originate from selected adapters. The plan needs explicit approval before execution. Messages must affect a later agent turn and appear in the shared history. Completion requires synthesis and an independent review, or the app reports the actual blocked/partial state. Runs and artifacts survive application restart.
