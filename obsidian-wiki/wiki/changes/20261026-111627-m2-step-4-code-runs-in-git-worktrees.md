---
type: note
title: M2 step 4: code runs in git worktrees
status: evergreen
created: 2026-10-26
updated: 2026-10-26
tags:
  - change
---

# M2 step 4: code runs in git worktrees

Code runs now use per-task git worktrees merged into a result branch, with leader conflict resolution, the user's check command, and cleanup; the task prompt now requires saving named files to disk.

## Details

175/175 Node tests, 35/35 Chromium tests, typecheck, build, 0 audit findings.

## Files

- `src/server/engine.ts`
- `src/server/http.ts`
- `src/server/core/prompts.ts`
- `src/server/core/protocol.ts`
- `src/shared/types.ts`
- `tests/repo-run.test.ts`
- `tests/http.test.ts`
- `tests/engine-extra.test.ts`
