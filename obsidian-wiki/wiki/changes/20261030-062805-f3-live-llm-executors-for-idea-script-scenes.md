---
type: note
title: F3 live LLM executors for Idea, Script, Scenes
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# F3 live LLM executors for Idea, Script, Scenes

Live flows now run Idea, Script and Scenes through the existing model connections with brief-based prompts, zod-validated JSON output, one retry, connection fallback and readable card excerpts.

## Details

Implemented with Codex. Verified: unit 228/228, e2e 39/39, typecheck, build, and one live Idea run on Claude Code (5 candidates, chose Inflation, total 24). Media executors remain F4.

## Files

- `src/server/flows/executors.ts`
- `src/server/flows/outputs.ts`
- `src/server/flows/engine.ts`
- `src/server/flows/http.ts`
- `src/server/flows/registry.ts`
- `src/server/engine.ts`
- `src/server/index.ts`
- `src/shared/types.ts`
- `src/client/flows/`
- `tests/flow-executors.test.ts`
- `tests/fixtures/flow-results.ts`
- `docs/prototype.md`
- `wiki/`
