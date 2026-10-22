---
type: flow
title: "Backup and Restore Flow"
status: active
created: 2026-10-08
updated: 2026-10-08
tags: [flow, sqlite, operations]
---

# Backup and Restore Flow

Stop the local server before backing up or restoring. Use `npm run service:stop` if [[macOS Autostart Flow|launchd]] owns it. `npm run data:backup -- --to /absolute/new-directory` captures the SQLite database and per-run workspaces from `.power-agents/`. The command requires an exclusive database lock, verifies SQLite, creates a SHA-256 file manifest, and atomically publishes the finished backup directory. It rejects an existing destination, symlinks, unsupported file types, and a destination overlapping the live data directory.

To recover, keep the server stopped and move the existing `.power-agents/` directory aside. `npm run data:restore -- --from /absolute/backup-directory` refuses to overwrite state, checks the local port, verifies the manifest and database, then atomically installs the restored state. Restart the server afterward. The restored application may pause an in-progress run under the normal restart recovery behavior; see [[Orchestration Engine]].

The backup includes task text, model output, and any files in run workspaces. It excludes `.env` and service logs. Store it privately. See [backup command](../../scripts/backup.ts), [tests](../../tests/backup.test.ts), [[Persistence Store]], and the [prototype guide](../../docs/prototype.md).
