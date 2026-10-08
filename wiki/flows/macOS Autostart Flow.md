---
type: flow
title: "macOS Autostart Flow"
status: active
created: 2026-10-08
updated: 2026-10-08
tags: [flow, macos, launchd, operations]
---

# macOS Autostart Flow

After dependencies are installed and `npm run build` succeeds, `npm run service:install` writes `com.poweragents.local.plist` to the current user's `~/Library/LaunchAgents/` and loads it with `launchctl`. The agent runs the production [[Server Runtime]] from the project directory, loads optional `.env`, and keeps the same `.power-agents/` SQLite data and workspaces as manual runs. It starts when the user logs in and restarts after a process exit. It does not run while the Mac sleeps, is shut down, or the user is logged out.

The agent's PATH includes the installed Codex, Claude, and Antigravity CLI locations. The server remains bound to `127.0.0.1` on port 4317 unless `.env` sets `PORT`. Logs are in `.power-agents/logs/`. The installer checks that the configured port and database are free before loading the agent. Stop a manually started server before installation; only one server may hold [[Persistence Store]]. Use `npm run service:stop` before a manual development session and `npm run service:start` afterwards. Rebuild and `npm run service:restart` after client changes; restart after `.env` changes. `npm run service:uninstall` removes the login agent.

This startup mode leaves [[Telegram Notifications]] pending while the Mac is unavailable. On the next launch, the existing outbox retries due messages. See [installer](../../scripts/launchd.ts), [prototype guide](../../docs/prototype.md), and [test](../../tests/launchd.test.ts).
