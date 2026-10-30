---
type: meta
title: "Hot Cache"
status: active
created: 2026-10-07
updated: 2026-10-30
tags: [context]
---

# Hot Cache

F3 implements live Idea, Script and Scenes. Read [[Flow Engine]] and [[Reel Flow Execution]], then the [prototype guide](../docs/prototype.md). [[Flows UI]] retains the dark canvas, gates, stale outputs, versioned edits and SSE refetch.

English prompts include connected brand text/rules, upstream values, extra instructions and all rejection notes. Idea proposes 3–5 candidates, scores five 1–5 criteria and chooses a best total ≥18. The hard-no topics are prompt rules; human approval checks semantic safety. Script builds a metaphor map first, validates 130–160 actual spoken words, the “explained in Roblox” hook and fixed five beats. Scenes validates complete ordered coverage using connected beat/word timings or script beats.

The inspector loads `/api/flows/connections`, offers available connections and **Авто**, and retains unavailable saved choices. Auto prefers Claude Code → Codex → Gemini CLI; explicit unavailable choices fail in Russian. Live turns use the version folder read-only, no team tools or session reuse. JSON/schema/count errors get one stateless correction; provider errors do not. Cards show the chosen topic/hook or script hook/word count instead of JSON.

Demo makes no provider calls. Brand has static live output; other live nodes fail until F4. Media pipeline, uploads and playback remain planned for F4; flow Telegram approvals for F5. To run live Scenes now, remove the template's Voice → Scenes edge so it uses approved Script beat times. Connected optional ports still require source approval.

Verification: 34/34 flow tests pass. Full suite: 211/228 pass; 17 sandbox `listen EPERM` failures. Typecheck/build pass; overall measured line coverage 81.49%. Playwright lists 39 scenarios but executes zero because Vite cannot listen on 127.0.0.1:4318. No real model calls or live-provider acceptance run. See [[log|Operation Log]] for evidence. Existing Telegram edits, `.env`, runtime/private workspaces and immutable `.raw/` snapshots remain untouched.
