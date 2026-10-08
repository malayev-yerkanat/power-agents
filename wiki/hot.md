---
type: meta
title: "Hot Cache"
status: active
created: 2026-10-07
updated: 2026-10-08
tags: [context]
---

# Hot Cache

## Last Updated

2026-10-08. Implemented the selected Airy Pixel interface and run-state city scene. Telegram notifications, the approved pixel-art constraint, and selected C1/L1 weapons remain documented below.

## Key Recent Facts

- Power Agents is a local TypeScript/React/SQLite prototype for coordinated text and document tasks. The browser talks to a Node server on `127.0.0.1:4317`.
- Current implementation supports a leader plan, user approval, assigned tasks, agent messages, synthesis, and independent review. It does not implement universal MCP tools or editing external repositories.
- The broader platform design is aspirational. Use [[overview|Project Overview]] and live code when documenting present behavior.
- Automated tests cover orchestration with mocked providers. A live Codex CLI + Gemini Antigravity CLI run completed planning, approval, dependent tasks, synthesis, and independent review for a small checklist task.
- Protected API routes require a session cookie minted by `/api/bootstrap`; mutations also require a CSRF header. After a 401, the client reboots the session and retries once with a fresh CSRF token.
- A production-mode browser restart test confirmed the live event stream reconnects without reloading the page.
- The model field is a selector. Codex and Antigravity lists come from local CLI discovery; OpenAI and Anthropic lists come from their APIs when keys are configured. Claude Code offers documented aliases with an access caveat.
- An optional Telegram bot pairs one private chat through a one-use `/start` link. SQLite queues plan-ready and completion alerts with run transitions; delivery retries after restart. Messages omit task content. Approval still happens in the local app. See [[Telegram Notification Flow]].
- A user LaunchAgent now runs the production server at login and restarts it after exit. It retains local SQLite and CLI discovery. It cannot run while the Mac sleeps or is off. See [[macOS Autostart Flow]].

## Recent Changes

- Installed `com.poweragents.local` from `scripts/launchd.ts`; port 4317 now belongs to launchd. Production page and API responded, and all three CLI connections were discovered.
- Added [[Telegram Notifications]], Settings controls, and [[Telegram Notification Flow]]. `TELEGRAM_BOT_TOKEN` is server-side and optional; no live bot message was sent during automated verification.
- Added [[Pixel Art Consistency]] as the authoritative visual constraint. Airy Pixel B is implemented with C1/L1 sprites, a city encounter, and a modal run-history drawer. Full animation sheets remain planned.

- Added [[Model Selection Flow]] and updated the provider, client, and API pages for model discovery.
- Updated [[Session and API Flow]], [[Client Interface]], and [[Local HTTP API]] for restart recovery, including event stream retry while the server is offline.
- Verified the demo workflow through planning, approval, tasks, messages, and independent review in the browser.

## Active Threads

- Keep this wiki synchronized as the prototype evolves. Check provider and authentication behavior against code before changing related notes.
- Codex and Gemini worked in one live run; other providers and larger task types still need separate validation.
