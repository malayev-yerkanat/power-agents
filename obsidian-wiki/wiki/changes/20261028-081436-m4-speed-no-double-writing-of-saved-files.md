---
type: note
title: M4 Speed: no double writing of saved files
status: evergreen
created: 2026-10-28
updated: 2026-10-28
tags:
  - change
---

# M4 Speed: no double writing of saved files

Measured inside slow turns from CLI transcripts. The platform now attaches saved task file text to the result, so agents no longer write each document twice.

## Details

Slowest turns are Codex waits before any output (414 s, 180 s), likely provider-side and not fixed. Claude spent ~22 s per task repeating file text in its answer. Verified: 188/188 Node tests, 83.28% line coverage, typecheck.

## Files

- `src/server/files.ts`
- `src/server/engine.ts`
- `src/server/core/prompts.ts`
- `tests/files.test.ts`
- `tests/engine-extra.test.ts`
- `docs/roadmap.md`
- `wiki/log.md`
