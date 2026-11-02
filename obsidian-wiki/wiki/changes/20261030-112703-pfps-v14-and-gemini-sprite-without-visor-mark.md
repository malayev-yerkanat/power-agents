---
type: note
title: Pfps v14 and Gemini sprite without visor mark
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Pfps v14 and Gemini sprite without visor mark

Restyled the Codex pfp chest badge in the suit's own shaded blue, and removed the multicolour visor mark from the Gemini pfp and the in-app Gemini sprite.

## Details

public/art/gemini.png changed only in the visor-mark pixels; original kept at output/art-direction/v14-agent-pfps/sprite-gemini-original.png. verify_v14.py asserts zero changes outside the masks.

## Files

- `public/art/gemini.png`
- `output/art-direction/v14-agent-pfps`
