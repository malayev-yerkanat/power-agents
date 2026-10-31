---
type: note
title: Idea avoids made topics; Scenes runs before F4
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Idea avoids made topics; Scenes runs before F4

Idea now gets an avoid list (its config plus approved ideas from other flows) and retries if it repeats one; the Roblox template seeds Inflation (reel 001) and no longer wires Voice timings into Scenes until F4.

## Details

Verified: unit 230/230, e2e 39/39, typecheck, build; live Idea run chose Supply and Demand with no Inflation candidate.

## Files

- `src/server/flows/registry.ts`
- `src/server/flows/executors.ts`
- `src/server/flows/engine.ts`
- `src/client/flows/FlowInspector.tsx`
- `tests/flow-executors.test.ts`
- `tests/flow-engine.test.ts`
