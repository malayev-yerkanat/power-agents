---
type: note
title: F4 media pipeline: stages, uploads, playback
status: evergreen
created: 2026-10-30
updated: 2026-10-30
tags:
  - change
---

# F4 media pipeline: stages, uploads, playback

Live flows now run Voice (ElevenLabs), Capture (Studio take upload), Edit plan, Preview, QA and Final through JSON-contract Python stages in the content project, with streamed uploads, Range media playback in cards and a needs-human state.

## Details

Implemented with Codex alongside the EN/RU localization. Verified here: unit 259/259, e2e 41/41, typecheck, build, Python stages 21/21. Live reel acceptance pending an ElevenLabs key.

## Files

- `src/server/flows/pipeline.ts`
- `src/server/flows/media.ts`
- `src/server/flows/engine.ts`
- `src/server/flows/executors.ts`
- `src/server/flows/registry.ts`
- `src/server/flows/http.ts`
- `src/shared/flow-types.ts`
- `src/client/flows/`
- `tests/flow-pipeline.test.ts`
- `tests/flow-media*.test.ts`
- `.env.example`
- `docs/prototype.md`
- `wiki/`
