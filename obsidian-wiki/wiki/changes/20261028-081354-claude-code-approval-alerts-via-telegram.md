---
type: note
title: Claude Code approval alerts via Telegram
status: evergreen
created: 2026-10-28
updated: 2026-10-28
tags:
  - change
---

# Claude Code approval alerts via Telegram

Added a Claude Code PermissionRequest hook script that sends the paired Power Agents Telegram chat a message whenever a session waits for approval.

## Details

Chat ID is copied once into git-ignored .env as TELEGRAM_CHAT_ID because the server holds an exclusive SQLite lock; hook registered in ~/.claude/settings.json.

## Files

- `scripts/claude-approval-telegram.sh`
- `.env.example`
