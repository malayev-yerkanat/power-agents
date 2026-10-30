---
type: note
title: Flows canvas fixes: hidden nodes and inspector labels
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Flows canvas fixes: hidden nodes and inspector labels

Fixed canvas nodes turning invisible after a flow refetch (React Flow measured size was dropped) and gave inspector config fields explicit accessible names so textarea content no longer leaks into their labels.

## Details

Found while verifying F2 built by Codex; e2e 39/39, unit 211/211, typecheck and build pass.

## Files

- `src/client/flows/FlowCanvas.tsx`
- `src/client/flows/FlowInspector.tsx`
