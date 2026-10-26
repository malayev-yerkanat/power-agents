---
type: note
title: M2 step 5: code-run UI, docs, denied writes
status: evergreen
created: 2026-10-26
updated: 2026-10-26
tags:
  - change
---

# M2 step 5: code-run UI, docs, denied writes

The run form takes an optional git project and check command, the run page shows the result branch and check, and a Gemini write outside its folder is reported and retried once.

## Details

177/177 Node tests, 35/35 Chromium tests, typecheck, build, 0 audit findings.

## Files

- `src/client/Composer.tsx`
- `src/client/RunWorkspace.tsx`
- `src/client/draftStorage.ts`
- `src/client/composerValidation.ts`
- `src/server/adapters/cli.ts`
- `src/server/adapters/common.ts`
- `src/server/engine.ts`
- `docs/prototype.md`
- `docs/roadmap.md`
