---
type: note
title: M2 steps 1-3: write mode, task files, git module
status: evergreen
created: 2026-10-26
updated: 2026-10-26
tags:
  - change
---

# M2 steps 1-3: write mode, task files, git module

CLI task turns can write files in their own task folder, finished tasks list and offer their files, and a git workspace module for code runs was added (not yet wired).

## Details

171/171 Node tests, 35/35 Chromium tests, typecheck, 0 audit findings. A spike confirmed each CLI is blocked outside its folder.

## Files

- `src/server/adapters/cli.ts`
- `src/server/files.ts`
- `src/server/engine.ts`
- `src/server/http.ts`
- `src/server/core/prompts.ts`
- `src/shared/types.ts`
- `src/client/ArtifactView.tsx`
- `src/server/workspace.ts`
