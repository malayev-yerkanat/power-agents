---
type: module
title: "Shared Contracts"
path: "src/shared/types.ts"
status: active
language: typescript
purpose: "Share run, plan, task, artifact, event, and provider types"
created: 2026-10-07
updated: 2026-10-30
tags: [module, contracts]
---

# Shared Contracts

`src/shared/flow-types.ts` separately defines typed ports, per-port output values, flow nodes/edges, flow summaries, graph patches, execution history and flow events. Node versions count executions; flow versions protect updates. A node retains rejection notes and current multi-port output. See [[Flow Engine]].

`src/shared/types.ts` defines the shapes passed among the client, HTTP layer, engine, store, and adapters. A `Run` contains team membership, plan, tasks, messages, artifacts, session IDs, status, phase, counters, and version. `RunEvent` records changes for the UI stream. `ModelCatalog` carries model IDs, names, discovery status, and a user-facing note for one connection; the chosen model stays in `Member.model`. Runtime validation is implemented separately in the HTTP and core protocol layers.

`RunSummaryPage` and `EventHistoryPage` describe bounded history responses. `Bootstrap` carries recent summaries, a cursor for older runs, the total count, and a global event cursor. `RunDetail` carries the full selected run with its latest event page and an optional cursor for earlier events.

See [types](../../src/shared/types.ts), [[Data Flow]], [[Model Selection Flow]], and [[Dependency Graph]].
