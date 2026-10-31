---
type: note
title: Answer Claude Code questions from the app or Telegram
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Answer Claude Code questions from the app or Telegram

The Stop hook now exits 2 to hand a Telegram tap back, so it can run with asyncRewake and the turn ends at once; a new UserPromptSubmit hook cancels that session's open Telegram question when the user answers in the app.

## Details

requestChoice takes an optional session; new TelegramService.cancelChoices and POST /api/telegram/cancel; /api/telegram/question accepts session. Hook settings change (asyncRewake on Stop, new UserPromptSubmit hook) is applied by the user.

## Files

- `src/server/telegram.ts`
- `src/server/http.ts`
- `scripts/claude-turn-telegram.sh`
- `scripts/claude-prompt-telegram.sh`
- `tests/telegram.test.ts`
