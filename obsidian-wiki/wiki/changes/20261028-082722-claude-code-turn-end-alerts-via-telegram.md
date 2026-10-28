---
type: note
title: Claude Code turn-end alerts via Telegram
status: evergreen
created: 2026-10-28
updated: 2026-10-28
tags:
  - change
---

# Claude Code turn-end alerts via Telegram

A global Stop hook sends the paired Telegram chat each finished Claude Code turn's recap, plus the open question and options when one waits, so sessions can be followed without the app open.

## Details

Script reads the latest turn from the transcript (wrap-up recap/ask/actions, else last reply). Notify only; answers still go in the app. Registered in ~/.claude/settings.json hooks.Stop.

## Files

- `scripts/claude-turn-telegram.sh`
- `.env.example`
