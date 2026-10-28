---
type: note
title: M4 Speed: no repeats in closing turns
status: evergreen
created: 2026-10-28
updated: 2026-10-28
tags:
  - change
---

# M4 Speed: no repeats in closing turns

Started milestone M4 Speed with a measured baseline. Synthesis, review and resolve turns no longer get team tools, and messages in their answers are dropped instead of repeating the whole turn.

## Details

Baseline from live runs: synthesis 124 s average, 419 s slowest. Two of the last three Codex syntheses were repeated because of messages (about 1 min each). Verified: 187/187 Node tests, 83.21% line coverage, typecheck.

## Files

- `src/server/engine.ts`
- `tests/mcp.test.ts`
- `docs/roadmap.md`
