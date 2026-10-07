---
type: module
title: "Server Runtime"
path: "src/server/index.ts"
status: active
language: typescript
purpose: "Start the local server and connect storage, engine, adapters, and UI"
created: 2026-10-07
updated: 2026-10-07
tags: [module, runtime]
---

# Server Runtime

`src/server/index.ts` starts one HTTP server bound to `127.0.0.1`, using port `4317` unless `PORT` is set. In development it mounts Vite middleware; in production it serves `dist/`. Startup opens [[Persistence Store]], discovers [[Provider Adapters]], constructs [[Orchestration Engine]], and mounts [[Local HTTP API]].

The data directory is `.power-agents/`; the SQLite database and per-run workspaces live there. The server handles SIGINT and SIGTERM by aborting active turns, closing connections, and closing the store.

See [server entry](../../src/server/index.ts) and [prototype guide](../../docs/prototype.md).
