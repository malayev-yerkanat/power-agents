---
type: module
title: "Telegram Notifications"
path: "src/server/telegram.ts"
status: active
language: typescript
purpose: "Pair one private Telegram chat and deliver run alerts"
created: 2026-10-08
updated: 2026-10-30
tags: [module, telegram, notifications]
---

# Telegram Notifications

`TelegramService` verifies an optional server-side `TELEGRAM_BOT_TOKEN` with `getMe`, creates a short-lived one-use `/start` pairing link, receives private-chat messages with Bot API long polling, and delivers queued messages with `sendMessage`. The token is not exposed through [[Local HTTP API]] or stored in SQLite. [[Persistence Store]] keeps the pairing hash, recipient, update offset, preferences, and notification outbox.

Only two run transitions create automatic alerts: entry into `awaiting_approval` and entry into `completed`. The message contains a run ID and, for a proposed plan, its version; it does not contain the goal or artifacts. A test message can be queued from Settings. Delivery runs outside [[Orchestration Engine]] so Telegram failures do not pause the run. See [[Telegram Notification Flow]].

Readiness requires successful polling. Startup and recovery use an immediate poll, followed by normal long polling when healthy. A polling outage disables pairing and test actions until the service recovers; the open Settings panel refreshes status automatically.

Power Agents run plans are still approved in [[Client Interface]]. Claude hooks use the existing authenticated approval/question endpoints. Codex Desktop uses a dedicated bot and independent pairing database through `src/server/codex/service.ts`; it never borrows Claude’s token or polling offset. Native command/network and current-turn permission approvals, empty-form MCP tool confirmations (including Browser use downloads), plus structured blocking/async questions can be answered on the desktop or Telegram. Explicit replies are bound to the original bot message and paired private user. Unknown, secret, oversized, file-change, plan/option-picker, authentication and other MCP elicitation requests remain desktop-only.

The Codex adapter validates private socket ownership, protocol versions, owner identity and request/turn identity. Canonical history is transiently inspected; no snapshots or chat text are logged or persisted by the bridge. Desktop resolution, disconnect, expiration and duplicate replies invalidate controls. Async replies use ordinary steering with a fresh-state check; the internal desktop API has no atomic expected-turn guard. See [setup, supported prompts and limitations](../../docs/codex-telegram.md).

Evidence: [Telegram service](../../src/server/telegram.ts), [store](../../src/server/store.ts), [HTTP API](../../src/server/http.ts), and [tests](../../tests/telegram.test.ts).

Browser use download prompts arrive as `mcpServer/elicitation/request`, not native permission grants. Empty-object forms explicitly classified `mcp_tool_call` use the desktop follower elicitation response with empty content and null response metadata. Offered session/always persistence is never copied. Unknown/auth/OTP/user-verification forms remain desktop-only.
