---
type: note
title: Safe resume after restart (M1.3)
status: evergreen
created: 2026-10-26
updated: 2026-10-26
tags:
  - change
---

# Safe resume after restart (M1.3)

Calls cut off by a server restart are listed as outcome unknown and repeat only after the user confirms, instead of being silently re-run.

## Details

155/155 Node tests, 35/35 Chromium tests, typecheck. Live: restart mid-task listed 3 calls, unconfirmed resume refused, confirmed resume completed all tasks.

## Files

- `src/server/engine.ts`
- `src/server/http.ts`
- `src/server/core/prompts.ts`
- `src/shared/types.ts`
- `src/client/RunWorkspace.tsx`
- `tests/engine-extra.test.ts`
- `tests/http.test.ts`
- `docs/roadmap.md`
- `docs/prototype.md`
