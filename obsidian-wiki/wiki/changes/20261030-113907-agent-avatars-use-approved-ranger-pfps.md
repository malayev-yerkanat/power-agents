---
type: note
title: Agent avatars use approved Ranger pfps
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Agent avatars use approved Ranger pfps

The Avatar component now shows the approved v14 Ranger portraits for Codex, Claude and Gemini connections; other connections keep their initials.

## Details

Portraits copied to public/art/avatars at 128px (nearest-neighbour) and rendered pixelated. Covered by a new client test; npm test 316 pass, build passes, checked in the browser.

## Files

- `src/client/ui.tsx`
- `src/client/workspace-polish.css`
- `public/art/avatars`
- `tests/client.test.ts`
