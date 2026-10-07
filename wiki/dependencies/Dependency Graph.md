---
type: dependency
status: active
created: 2026-10-07
updated: 2026-10-07
tags: [dependency, architecture]
---

# Dependency Graph

```mermaid
flowchart LR
  UI[Client Interface] --> API[Local HTTP API]
  API --> Engine[Orchestration Engine]
  API --> Store[Persistence Store]
  Engine --> Store
  Engine --> Adapters[Provider Adapters]
  Store --> API
  Contracts[Shared Contracts] -. types .-> UI
  Contracts -. types .-> API
  Contracts -. types .-> Engine
  Contracts -. types .-> Adapters
```

`src/server/index.ts` wires the server objects together. `src/server/core/` contains prompt, protocol, demo, and result logic used by the engine. See [[Architecture Overview]] and the [server entry](../../src/server/index.ts).
