---
type: note
title: M3 steps 3-4: CLI wiring and docs
status: evergreen
created: 2026-10-26
updated: 2026-10-26
tags:
  - change
---

# M3 steps 3-4: CLI wiring and docs

Claude and Codex now connect the team tools per turn with the token only in the environment; Gemini is marked as having no team tools, and the leader learns who has them.

## Details

-

## Files

- `src/server/adapters/cli.ts`
- `src/server/adapters/index.ts`
- `src/server/engine.ts`
- `src/server/core/prompts.ts`
- `src/client/Composer.tsx`
- `docs/prototype.md`
- `docs/roadmap.md`
