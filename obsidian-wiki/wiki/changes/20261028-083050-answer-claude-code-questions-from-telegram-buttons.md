---
type: note
title: Answer Claude Code questions from Telegram buttons
status: evergreen
created: 2026-10-28
updated: 2026-10-28
tags:
  - change
---

# Answer Claude Code questions from Telegram buttons

Turn-end questions with options now arrive in Telegram as buttons; a tap is handed back to Claude Code as the user's answer through the Stop hook.

## Details

TelegramService.requestChoice generalizes the approval buttons; new POST /api/telegram/question waits up to 9.5 min; the Stop hook blocks with the chosen option's message. Without the server it falls back to a plain alert.

## Files

- `src/server/telegram.ts`
- `src/server/http.ts`
- `tests/telegram.test.ts`
- `scripts/claude-turn-telegram.sh`
