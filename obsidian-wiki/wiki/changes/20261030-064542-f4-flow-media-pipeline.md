---
type: note
title: F4 flow media pipeline
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# F4 flow media pipeline

Implemented isolated content pipeline execution, streamed Capture uploads, contained Range media and native playback with distinct human-action failures. Restored Voice timings in the reel template and documented F4 setup and remaining live acceptance.

## Details

Verified 61 of61 flow tests. Full Node suite and coverage:241 of258 pass;17 sandbox listener EPERM failures,83.07 percent line coverage. Typecheck and build pass. Playwright discovers40 scenarios but cannot start its listener. Content21 tests:20 pass,one EPERM skip;91.5 percent stage coverage and TypeScript passes. No actual ElevenLabs or Remotion render, no env edits, commits or pushes. Telegram gates remain F5; concurrent Telegram and localization edits preserved.

## Files

- `.env.example`
- `src/shared/flow-types.ts`
- `src/server/flows/pipeline.ts`
- `src/server/flows/media.ts`
- `src/server/flows/engine.ts`
- `src/server/flows/registry.ts`
- `src/server/flows/executors.ts`
- `src/server/flows/http.ts`
- `src/client/flows/FlowMedia.tsx`
- `src/client/flows/FlowCanvas.tsx`
- `src/client/flows/FlowCard.tsx`
- `src/client/flows/FlowInspector.tsx`
- `src/client/flows/helpers.ts`
- `src/client/flows/useFlow.ts`
- `src/client/flows/flows.css`
- `tests/flow-pipeline.test.ts`
- `tests/flow-media.test.ts`
- `tests/flow-media-http.test.ts`
- `tests/flow-media-ui.test.ts`
- `tests/flow-engine.test.ts`
- `tests/e2e/flows.spec.ts`
- `docs/prototype.md`
- `docs/f4-verification.md`
- `wiki/`
