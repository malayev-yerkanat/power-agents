---
type: note
title: F4 localization compatibility and final checks
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# F4 localization compatibility and final checks

Preserved the landed localization and used the existing translated file-size placeholder in Capture uploads. Corrected writable stream typing in the upload regression and updated translated template help to reflect implemented media stages.

## Details

Final verification: 65 of 65 flow plus i18n tests pass; full Node suite 242 of 259 pass with 17 sandbox listener EPERM failures; line coverage 83.08 percent. Typecheck and build pass. Playwright is blocked before execution by Vite listen EPERM, with 40 scenarios discovered. Content tests: 20 pass and one EPERM skip. No real provider calls, renders, env edits, commits or pushes. Full manifest and individually listed listener failures are in docs/f4-verification.md.

## Files

- `src/client/flows/FlowMedia.tsx`
- `src/client/flows/FlowList.tsx`
- `src/client/i18n-en.ts`
- `tests/flow-media.test.ts`
- `tests/flow-media-ui.test.ts`
- `docs/f4-verification.md`
- `wiki/log.md`
- `wiki/hot.md`
