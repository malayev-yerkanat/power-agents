---
type: note
title: EN/RU language switch
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# EN/RU language switch

Added an EN/RU button to the top bar that switches the client UI between Russian and English without reload; choice persists in localStorage.

## Details

New src/client/i18n.ts (t(), locale(), LanguageProvider, LanguageToggle) and src/client/i18n-en.ts dictionary keyed by Russian text. All client strings wrapped in t(); dates/numbers follow the chosen locale. Server, agent output and stored flow titles stay untranslated. Tests: tests/i18n.test.ts (dictionary coverage) and an e2e toggle test.

## Files

- `src/client/i18n.ts`
- `src/client/i18n-en.ts`
- `src/client/main.tsx`
- `src/client/App.tsx`
- `src/client/workspace-polish.css`
- `src/client/*.tsx`
- `src/client/flows/*.tsx`
- `tests/i18n.test.ts`
- `tests/e2e/workspace.spec.ts`
- `docs/prototype.md`
