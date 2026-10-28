---
type: note
title: M4: Gemini turns measured
status: evergreen
created: 2026-10-28
updated: 2026-10-28
tags:
  - change
---

# M4: Gemini turns measured

Recorded Gemini turn timing from agy logs in the roadmap: median 10 s startup per turn, then mostly one model call on Flash (High), median 39 s.

## Details

82 turns measured. Low-model turns were faster but on older, simpler runs, so not comparable. Docs only, no code change.

## Files

- `docs/roadmap.md`
- `wiki/log.md`
