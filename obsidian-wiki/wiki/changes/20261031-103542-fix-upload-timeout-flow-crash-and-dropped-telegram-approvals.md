---
type: note
title: Fix upload timeout, flow crash and dropped Telegram approvals
status: evergreen
created: 2026-10-31
updated: 2026-10-31
tags:
  - change
---

# Fix upload timeout, flow crash and dropped Telegram approvals

Raised the server request timeout so 2 GB Capture uploads can finish, stopped failed flow result writes from crashing the server, and made Codex approval prompts in Telegram buttons-only so typed replies are no longer silently dropped.

## Details

requestTimeout 30 s -> 30 min (JSON bodies still capped at 64 KB); FlowEngine.execute rejection now logged and the queue still reschedules; TelegramService.requestInput gained acceptText (default true), CodexRequests passes false for decisions. Tests added for all three.

## Files

- `src/server/index.ts`
- `src/server/flows/engine.ts`
- `src/server/telegram.ts`
- `src/server/codex/requests.ts`
- `docs/codex-telegram.md`
- `tests/flow-engine.test.ts`
- `tests/codex-requests.test.ts`
- `tests/telegram-input.test.ts`
