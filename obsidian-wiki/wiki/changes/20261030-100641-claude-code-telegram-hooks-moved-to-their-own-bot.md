---
type: note
title: Claude Code Telegram hooks moved to their own bot
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Claude Code Telegram hooks moved to their own bot

Claude Code approval, turn and prompt hooks now run from ~/.claude/tools/claude-telegram with a dedicated bot and bridge service, so Power Agents no longer serves them; removed the old hook scripts, the /api/telegram/approval, /question and /cancel endpoints, and TELEGRAM_CHAT_ID from .env.example.

## Details

TelegramService choice code stays: the Codex Telegram work uses it.

## Files

- `scripts/claude-approval-telegram.sh`
- `scripts/claude-turn-telegram.sh`
- `scripts/claude-prompt-telegram.sh`
- `src/server/http.ts`
- `.env.example`
