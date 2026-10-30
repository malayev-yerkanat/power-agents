---
type: meta
title: "Hot Cache"
status: active
created: 2026-10-07
updated: 2026-10-30
tags: [context]
---

# Hot Cache

EN/RU review fixes scene labels, connection/model hints, translated feedback after toggling, and flow defaults being saved as localized titles. Source keys stay in feedback state and translate at render time, including screen-reader announcements; custom content and drafts remain intact. See [[Client Interface]] and the [prototype guide](../docs/prototype.md). Verification: 50/50 focused tests, typecheck/build pass; full suite 248/265 passes with 17 pre-existing loopback `EPERM` failures. Playwright discovers 44 scenarios but Vite cannot bind port 4318, so browser execution remains unverified. No linter is configured. Protected F4 files were not edited; no commits.

F4 implements the live reel media pipeline. Start with [[Flow Engine]], [[Flows UI]], [[Reel Flow Execution]] and the [prototype guide](../docs/prototype.md). [F4 verification](../docs/f4-verification.md) includes the complete file manifest and check results.

Set `REEL_PIPELINE_DIR` to the content project's `pipeline/stages/` and provide `ELEVENLABS_API_KEY` in the server environment, then restart. Voice always uses ElevenLabs; missing credentials or a missing take fail with **Нужно действие**. Record a Studio take with its magenta sync frame and upload MP4/MOV on Capture (card or inspector, up to 2 GiB). Replacement uploads invalidate dependent results. New templates connect Voice timings to Scenes; existing saved graphs retain their edges.

The Python contract passes inline values, absolute contained upstream files, brand, notes and execution identity. Voice produces normalized narration and word/beat alignment; Edit deterministically groups accented captions and plans punches/cards. Preview/Final render dynamic FlowReel at vertical heights 540/1080 with even rounded 9:16 widths. QA checks length, dimensions, audio, loudness and hook captions; failed reports remain visible and block Final. Exit 2 marks human action; normal aborts clean staged public assets before remaining process children are killed. File URLs use outputVersion so retained media survives reruns.

F1–F3 behavior remains: typed DAGs, gates, rejection notes, stale results, global scheduling, restart recovery and validated live text generation. Demo makes no provider calls. F5 Telegram flow approvals remain planned.

Verification: 62/62 flow tests; full Node suite 242/259 pass, with 17 sandbox listener EPERM failures. Typecheck/build pass; measured line coverage 83.08%. Playwright discovers 40 but executes 0 because Vite cannot listen. Python 20/21 pass with 1 EPERM skip, stage coverage 91.5%; content TypeScript and 7 metadata assertions pass. No real ElevenLabs/Remotion calls or live reel 002 acceptance run. Existing Telegram/localization edits, .env, output/media and immutable snapshots preserved; no commits or pushes.
