---
type: note
title: M4: synthesis without a document is repeated; acceptance run
status: evergreen
created: 2026-10-28
updated: 2026-10-28
tags:
  - change
---

# M4: synthesis without a document is repeated; acceptance run

Fixed a pause caused by dropping a synthesis that only asked for fixes: such a synthesis now gets one repeat with a hint. Acceptance run 958811b4 with Gemini Low completed in about 7.5 minutes active versus 12.5 baseline.

## Details

Review passed first time. One review repeat remains when Claude sends artifact as a string. Verified: 192/192 Node tests, 83.46% line coverage, typecheck.

## Files

- `src/server/engine.ts`
- `tests/engine-extra.test.ts`
- `docs/roadmap.md`
- `wiki/log.md`
