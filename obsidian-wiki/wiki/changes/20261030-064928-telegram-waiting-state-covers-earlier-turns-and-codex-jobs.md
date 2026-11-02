---
type: note
title: Telegram waiting state covers earlier turns and Codex jobs
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Telegram waiting state covers earlier turns and Codex jobs

The turn alert now shows waiting on background work while a background agent or command from any turn has not reported back, or a Codex plugin job of the session is still running.

## Details

Launch ids come only from real launch results; completions from task notifications and agent hand-backs. Codex status is read from the plugin's state.json by session id.

## Files

- `scripts/claude-turn-telegram.sh`
