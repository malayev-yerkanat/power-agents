---
type: module
title: "Telegram Notifications"
path: "src/server/telegram.ts"
status: active
language: typescript
purpose: "Pair one private Telegram chat and deliver run alerts"
created: 2026-10-08
updated: 2026-10-08
tags: [module, telegram, notifications]
---

# Telegram Notifications

`TelegramService` verifies an optional server-side `TELEGRAM_BOT_TOKEN` with `getMe`, creates a short-lived one-use `/start` pairing link, receives private-chat messages with Bot API long polling, and delivers queued messages with `sendMessage`. The token is not exposed through [[Local HTTP API]] or stored in SQLite. [[Persistence Store]] keeps the pairing hash, recipient, update offset, preferences, and notification outbox.

Only two run transitions create automatic alerts: entry into `awaiting_approval` and entry into `completed`. The message contains a run ID and, for a proposed plan, its version; it does not contain the goal or artifacts. A test message can be queued from Settings. Delivery runs outside [[Orchestration Engine]] so Telegram failures do not pause the run. See [[Telegram Notification Flow]].

The first release supports one private chat and notification delivery only. Plans are approved in [[Client Interface]]. It does not expose the loopback-only app on a phone, accept Telegram approval buttons, or use a public webhook.

Evidence: [Telegram service](../../src/server/telegram.ts), [store](../../src/server/store.ts), [HTTP API](../../src/server/http.ts), and [tests](../../tests/telegram.test.ts).
