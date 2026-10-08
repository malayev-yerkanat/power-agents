---
type: flow
title: "Telegram Notification Flow"
status: active
created: 2026-10-08
updated: 2026-10-08
tags: [flow, telegram, notifications]
---

# Telegram Notification Flow

## Pairing

The user sets `TELEGRAM_BOT_TOKEN` in the server environment and restarts the app. In Settings, the user requests a one-use link and sends `/start` to the bot from a private chat. [[Telegram Notifications]] validates the nonce and chat identity, then [[Persistence Store]] records the recipient and polling offset. Pairing and preferences are available only through the existing local session and CSRF-protected mutation API. See [[Session and API Flow]].

## Delivery

When a run enters `awaiting_approval` or `completed`, the store writes an outbox row in the same SQLite transaction as the run and event. It queues nothing before pairing, for internal agent messages, or for ordinary pause/cancel transitions. The service sends due rows to the paired chat, limits send frequency, and retries transient errors. Pending rows survive restart; turning off a preference or disconnecting cancels its pending messages. The UI can queue a test notification.

## Failure and recovery

An invalid bot token, unavailable Bot API, blocked bot, or conflicting Telegram poller is surfaced as connection status. A temporary connection failure at startup is retried in the background while the local app remains available. Telegram failure does not change the run state. Delivery is at least once: after a crash between Telegram accepting a message and SQLite recording success, the user may receive a duplicate. Unpairing aborts and waits for local in-flight sends, but a message already accepted by Telegram may still arrive. The app is bound to `127.0.0.1`; Telegram alerts do not open its workspace on a phone.

Evidence: [store](../../src/server/store.ts), [service](../../src/server/telegram.ts), [settings UI](../../src/client/TelegramSettings.tsx), [tests](../../tests/telegram.test.ts).
