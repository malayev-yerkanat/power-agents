---
type: note
title: F2 flow canvas workspace
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# F2 flow canvas workspace

Added the Russian Flows list, React Flow canvas, typed node editing and actions, registry metadata and SSE refetch updates. Updated the canonical prototype and project wiki; live executors and media remain planned.

## Details

Verification: 194/211 Node tests pass; all 17 failures are sandbox loopback listen EPERM. Typecheck and production build pass. Overall measured line coverage 80.81%. Playwright discovers 39 tests including 4 for F2; execution is blocked before tests by Vite listen EPERM. No commit, dependency or environment changes were made for F2.

## Files

- `src/client/flows`
- `src/client/App.tsx`
- `src/client/main.tsx`
- `src/client/navigation.ts`
- `src/shared/flow-types.ts`
- `src/server/flows/http.ts`
- `src/server/http.ts`
- `tests/navigation.test.ts`
- `tests/flow-canvas.test.ts`
- `tests/flow-http.test.ts`
- `tests/e2e/flows.spec.ts`
- `docs/prototype.md`
- `wiki/modules/Flows UI.md`
- `wiki/modules/Flow Engine.md`
- `wiki/modules/Client Interface.md`
- `wiki/modules/Local HTTP API.md`
- `wiki/modules/_index.md`
- `wiki/flows/Reel Flow Execution.md`
- `wiki/flows/Session and API Flow.md`
- `wiki/flows/_index.md`
- `wiki/index.md`
- `wiki/overview.md`
- `wiki/log.md`
- `wiki/hot.md`
