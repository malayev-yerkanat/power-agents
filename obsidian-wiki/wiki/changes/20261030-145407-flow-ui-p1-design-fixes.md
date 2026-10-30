---
type: note
title: Flow UI P1 design fixes
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Flow UI P1 design fixes

Flow canvas colors moved to --flow-* CSS tokens with one accent; controls raised to 44px targets, text to 12px minimum, canvas given a region role.

## Details

Port, edge, background and minimap colors in TSX now reference CSS variables. Close buttons use .flow-icon-button. Handles get a 23px invisible hit area matching port spacing.

## Files

- `src/client/flows/flows.css`
- `src/client/flows/FlowCanvas.tsx`
- `src/client/flows/FlowInspector.tsx`
- `src/client/flows/helpers.ts`
