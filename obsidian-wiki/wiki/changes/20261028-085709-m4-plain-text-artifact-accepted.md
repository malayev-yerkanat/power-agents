---
type: note
title: M4: plain-text artifact accepted
status: evergreen
created: 2026-10-28
updated: 2026-10-28
tags:
  - change
---

# M4: plain-text artifact accepted

An answer whose artifact is plain text is now taken as the body instead of repeating the whole turn.

## Details

Seen in reviews of runs ec0727e0 and 958811b4, about 20 s each. Verified: 193/193 Node tests, 83.47% line coverage, typecheck.

## Files

- `src/server/core/protocol.ts`
- `tests/protocol.test.ts`
- `tests/engine-extra.test.ts`
- `docs/roadmap.md`
- `wiki/log.md`
