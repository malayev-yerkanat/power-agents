---
type: flow
status: active
created: 2026-10-07
updated: 2026-10-07
tags: [flow, orchestration]
---

# Data Flow

1. [[Client Interface]] sends a goal, members, leader, and mode to [[Local HTTP API]].
2. [[Orchestration Engine]] validates the run, saves it through [[Persistence Store]], and schedules the leader's planning turn.
3. The leader's structured plan is parsed and saved. The run waits for user approval; user feedback can request another plan.
4. Approval starts eligible tasks. The engine observes dependencies, queues colleague questions, and resumes work when replies arrive.
5. The leader synthesizes finished work; a different participant reviews it. Revisions may create another pass before completion.
6. Each state transition stores a run version and an event. The browser receives event notices and fetches the latest run detail. Markdown artifacts can be downloaded.

Relevant code: [engine](../../src/server/engine.ts), [result application](../../src/server/core/results.ts), [HTTP](../../src/server/http.ts), [store](../../src/server/store.ts). See also [[overview|Project Overview]].
