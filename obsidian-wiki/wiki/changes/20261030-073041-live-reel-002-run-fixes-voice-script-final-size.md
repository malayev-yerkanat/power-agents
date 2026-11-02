---
type: note
title: Live reel 002 run fixes: voice, script, final size
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# Live reel 002 run fixes: voice, script, final size

First end-to-end live flow found and fixed five issues: free-plan ElevenLabs refuses library voices (default now Liam), script length follows the node word target, Script receives only the chosen idea, word count is measured not trusted, and Final renders full 1080x1920.

## Details

Live run of reel 002 (The Food Chain) with reel 001 footage as a stand-in: Voice 52.7 s, QA passed all five checks (-15.6 LUFS), Final 1080x1920. Tests 267/267, typecheck, build, Python stages pass.

## Files

- `src/server/flows/outputs.ts`
- `src/server/flows/executors.ts`
- `src/server/flows/registry.ts`
- `tests/flow-executors.test.ts`
- `docs/prototype.md`
- `docs/f4-verification.md`
- `content pipeline/stages/voice.py`
- `content pipeline/stages/render.py`
- `content edit/src/Root.tsx`
