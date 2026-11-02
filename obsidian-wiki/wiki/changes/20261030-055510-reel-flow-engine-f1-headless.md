---
type: note
title: Reel Flow engine F1 (headless)
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Reel Flow engine F1 (headless)

Added a headless node-graph flow engine for the Reel Flow workspace: typed nodes, approval gates, reject-with-note re-runs, stale propagation, auto-run, a render lane and restart safety, plus /api/flows routes and a roblox-reel template.

## Details

Milestone F1 of .claude/plans/reel-flow-workspace.plan.md. Demo executors only; canvas UI (F2) and live LLM/media executors (F3/F4) are planned. Implemented with Codex; verified with npm test 205/205, typecheck and build.

## Files

- `src/shared/flow-types.ts`
- `src/server/store.ts`
- `src/server/flows/registry.ts`
- `src/server/flows/engine.ts`
- `src/server/flows/http.ts`
- `src/server/http.ts`
- `src/server/index.ts`
- `tests/flow-engine.test.ts`
- `tests/flow-http.test.ts`
- `docs/prototype.md`
- `wiki/`
