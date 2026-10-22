---
type: module
title: "Orchestration Engine"
path: "src/server/engine.ts"
status: active
language: typescript
purpose: "Schedule plan, task, reply, synthesis, and review turns"
created: 2026-10-07
updated: 2026-10-22
tags: [module, orchestration]
---

# Orchestration Engine

`Engine` owns the run lifecycle. `create` validates the team and starts planning. `approve` checks plan version and releases tasks. `control` pauses, resumes, or cancels. `message` queues user feedback and can trigger replanning.

Its scheduler limits active turns to three and prevents two concurrent turns for one participant. Task turns wait for dependencies. Once tasks and requests finish, the leader synthesizes and another participant reviews. Results pass through the schemas in `src/server/core/` before they change state. State changes go through [[Persistence Store]].

The scheduler queries indexed active runs instead of parsing every historical run on each tick. Restart recovery uses the same active-run query.

`promptFor` in `src/server/core/prompts.ts` sends each turn a trimmed run: a task sees its dependencies' latest results, synthesis sees every task's latest result plus the latest final and review, and review sees the latest final. Each document appears once, and messages are limited to the participant's own correspondence and user notes. The 300,000-character per-turn cap remains a safety net.

A failed task or reply turn marks only its task `failed`, with an error prefixed by the participant's name and an `error` event whose actor is that participant; other turns keep running. When nothing else can progress, the run pauses and lists the failed tasks. Resume retries only failed work, and a task with its own unanswered question returns as `waiting`. Plan, synthesis and review failures still pause the run at once. The plan prompt tells the leader not to add assembly, overall review or final-polish tasks, because synthesis and review run automatically after all tasks.

The engine limits runs to 100 turns and tasks to 20 turns. See [engine](../../src/server/engine.ts), [protocol](../../src/server/core/protocol.ts), and [[Data Flow]].
