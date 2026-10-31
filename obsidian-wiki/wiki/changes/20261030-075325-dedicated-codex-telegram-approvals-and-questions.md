---
type: note
title: Dedicated Codex Telegram approvals and questions
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Dedicated Codex Telegram approvals and questions

Added a separate Codex bot with isolated credentials, pairing and polling, plus desktop request mirroring and message-bound replies. Existing Claude integration is preserved.

## Details

Verified native approval/question mapping, private IPC, canonical async history, desktop-first cancellation, duplicate rejection and separate bot lifecycle. Unsupported prompts stay on desktop; internal IPC is version-checked. Setup guide documents compatibility and pairing.

## Files

- `src/server/codex`
- `src/server/telegram.ts`
- `src/server/http.ts`
- `src/server/index.ts`
- `scripts/codex-telegram.ts`
- `tests/codex-*.test.ts`
- `tests/telegram-input.test.ts`
- `.env.example`
- `package.json`
- `README.md`
- `docs/prototype.md`
- `docs/codex-telegram.md`
- `wiki`
