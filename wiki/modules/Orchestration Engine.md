---
type: module
title: "Orchestration Engine"
path: "src/server/engine.ts"
status: active
language: typescript
purpose: "Schedule plan, task, reply, synthesis, and review turns"
created: 2026-10-07
updated: 2026-10-07
tags: [module, orchestration]
---

# Orchestration Engine

`Engine` owns the run lifecycle. `create` validates the team and starts planning. `approve` checks plan version and releases tasks. `control` pauses, resumes, or cancels. `message` queues user feedback and can trigger replanning.

Its scheduler limits active turns to three and prevents two concurrent turns for one participant. Task turns wait for dependencies. Once tasks and requests finish, the leader synthesizes and another participant reviews. Results pass through the schemas in `src/server/core/` before they change state. State changes go through [[Persistence Store]].

The engine limits runs to 100 turns and tasks to 20 turns. See [engine](../../src/server/engine.ts), [protocol](../../src/server/core/protocol.ts), and [[Data Flow]].
