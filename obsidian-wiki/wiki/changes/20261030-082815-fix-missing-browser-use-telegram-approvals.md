---
type: note
title: Fix missing Browser use Telegram approvals
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Fix missing Browser use Telegram approvals

Forward empty-form MCP tool confirmations, including Browser use download permissions, to the dedicated Codex bot. Approve once and decline use the desktop response format without persistent grants.

## Details

Reproduced with the observed request schema. 314 regression tests pass, line coverage 86.79%, build/typecheck pass; focused expiry and safety tests pass. No new live download approval was executed.

## Files

- `src/server/codex/requests.ts`
- `tests/codex-requests.test.ts`
- `docs/codex-telegram.md`
- `docs/prototype.md`
- `wiki/modules/Telegram Notifications.md`
- `wiki/flows/Telegram Notification Flow.md`
- `wiki/log.md`
- `wiki/hot.md`
