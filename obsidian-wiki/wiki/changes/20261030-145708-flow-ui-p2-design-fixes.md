---
type: note
title: Flow UI P2 design fixes
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Flow UI P2 design fixes

Add-node menu gains focus management, Escape and outside-click close, and aria-controls; save status is a persistent live region; error toast sits inside the canvas body; radii follow a 6px control / 10px surface scale; React Flow aria labels are memoized per language.

## Details

New e2e test covers the menu behaviour and the canvas region role. Error strings already translate through uiMessage, so no change was needed there.

## Files

- `src/client/flows/flows.css`
- `src/client/flows/FlowCanvas.tsx`
- `src/client/flows/FlowInspector.tsx`
- `tests/e2e/flows.spec.ts`
