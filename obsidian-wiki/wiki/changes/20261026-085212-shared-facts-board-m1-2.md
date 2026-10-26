---
type: note
title: Shared facts board (M1.2)
status: evergreen
created: 2026-10-26
updated: 2026-10-26
tags:
  - change
---

# Shared facts board (M1.2)

Agents publish owner-tagged facts that every turn reads; only owners change them. Tasks may also wait for colleagues who are still working instead of failing.

## Details

Verified with 153/153 Node tests, 35/35 Chromium tests, typecheck. Live run 2026-10-26: 36 facts from all three providers.

## Files

- `src/server/core/results.ts`
- `src/server/core/protocol.ts`
- `src/server/core/prompts.ts`
- `src/server/engine.ts`
- `src/shared/types.ts`
- `tests/engine-extra.test.ts`
- `tests/prompts.test.ts`
- `docs/roadmap.md`
- `docs/prototype.md`
