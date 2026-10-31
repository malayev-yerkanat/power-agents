---
type: note
title: Shorter, structured Telegram alerts
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Shorter, structured Telegram alerts

Claude Code turn and approval alerts now start with an emoji status line, strip Markdown, cap the body at 400 characters at a sentence end, and separate header, recap and question with blank lines.

## Details

-

## Files

- `scripts/claude-turn-telegram.sh`
- `scripts/claude-approval-telegram.sh`
