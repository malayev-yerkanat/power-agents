---
type: note
title: Review EN RU language toggle
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Review EN RU language toggle

Fixed missing platform translations, feedback that stayed in the previous language, and localized flow defaults being persisted as titles. Expanded translation regression coverage while preserving custom content and protected F4 files.

## Details

Verification: 50 focused tests pass; full unit suite 248 of 265 pass with 17 pre-existing listen EPERM failures. Typecheck and build pass. Playwright discovers 44 scenarios but Vite startup is blocked by loopback EPERM; browser execution remains unverified. No linter is configured; no commits.

## Files

- `src/client/i18n.ts`
- `src/client/i18n-en.ts`
- `src/client/uiMessages.ts`
- `src/client/flows/FlowCanvas.tsx`
- `src/client/flows/FlowInspector.tsx`
- `src/client/useRunAnnouncement.ts`
- `tests/i18n.test.ts`
- `tests/e2e/workspace.spec.ts`
- `tests/e2e/i18n-flows.spec.ts`
- `docs/prototype.md`
- `wiki/modules/Client Interface.md`
- `wiki/overview.md`
- `wiki/hot.md`
- `wiki/log.md`
