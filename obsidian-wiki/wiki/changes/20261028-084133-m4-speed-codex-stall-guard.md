---
type: note
title: M4 Speed: Codex stall guard
status: evergreen
created: 2026-10-28
updated: 2026-10-28
tags:
  - change
---

# M4 Speed: Codex stall guard

A Codex turn with no output for 150 s is stopped and repeated once, unless it already used a team tool. Based on 109 live Codex turns: normal silences under 95 s, stalls 180-414 s.

## Details

Verified: 191/191 Node tests, 83.50% line coverage, typecheck. Not yet seen in a live run.

## Files

- `src/server/adapters/common.ts`
- `src/server/adapters/process.ts`
- `src/server/adapters/cli.ts`
- `src/server/engine.ts`
- `tests/adapters.test.ts`
- `tests/engine-extra.test.ts`
- `docs/roadmap.md`
- `wiki/log.md`
