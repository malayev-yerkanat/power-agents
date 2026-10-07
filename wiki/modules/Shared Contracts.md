---
type: module
title: "Shared Contracts"
path: "src/shared/types.ts"
status: active
language: typescript
purpose: "Share run, plan, task, artifact, event, and provider types"
created: 2026-10-07
updated: 2026-10-07
tags: [module, contracts]
---

# Shared Contracts

`src/shared/types.ts` defines the shapes passed among the client, HTTP layer, engine, store, and adapters. A `Run` contains team membership, plan, tasks, messages, artifacts, session IDs, status, phase, counters, and version. `RunEvent` records changes for the UI stream. Runtime validation is implemented separately in the HTTP and core protocol layers.

See [types](../../src/shared/types.ts), [[Data Flow]], and [[Dependency Graph]].
