---
type: module
title: "Server Runtime"
path: "src/server/index.ts"
status: active
language: typescript
purpose: "Start the local server and connect storage, engine, adapters, and UI"
created: 2026-10-07
updated: 2026-10-08
tags: [module, runtime]
---

# Server Runtime

`src/server/index.ts` starts one HTTP server bound to `127.0.0.1`, using port `4317` unless `PORT` is set. In development it mounts Vite middleware; in production it serves `dist/`. Startup opens [[Persistence Store]], discovers [[Provider Adapters]], constructs [[Orchestration Engine]], starts optional [[Telegram Notifications]] connection attempts in the background, and mounts [[Local HTTP API]]. A temporary Telegram outage does not block the local server from starting.

The data directory is `.power-agents/`; the SQLite database and per-run workspaces live there. The server handles SIGINT and SIGTERM by aborting active turns, closing connections, and closing the store.

On macOS, `scripts/launchd.ts` installs a per-user LaunchAgent after the client is built. It runs this entry point in production mode with the project as `WorkingDirectory`, loads the optional `.env`, supplies a PATH for local provider CLIs, and writes logs under `.power-agents/logs/`. `RunAtLoad` and `KeepAlive` start it at login and restart an exited process. See [[macOS Autostart Flow]].

See [server entry](../../src/server/index.ts), [service installer](../../scripts/launchd.ts), and [prototype guide](../../docs/prototype.md).
