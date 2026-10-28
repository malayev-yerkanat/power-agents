---
type: note
title: Approve or decline Claude Code requests from Telegram
status: evergreen
created: 2026-10-28
updated: 2026-10-28
tags:
  - change
---

# Approve or decline Claude Code requests from Telegram

Claude Code approval alerts now carry Approve/Decline buttons; the Power Agents server sends them, handles the tap, and returns the decision to the PermissionRequest hook.

## Details

New POST /api/telegram/approval waits up to 570s; only the paired user on the sent message can decide; the hook falls back to a plain alert when the server is down. Hook timeout raised to 600s.

## Files

- `src/server/telegram.ts`
- `src/server/http.ts`
- `src/server/store.ts`
- `scripts/claude-approval-telegram.sh`
- `tests/telegram.test.ts`
