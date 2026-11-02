---
type: meta
title: "Hot Cache"
status: active
created: 2026-10-07
updated: 2026-11-02
tags: [context]
---

# Hot Cache

Latest (2026-11-02): reel flows gained a **Project folder** node, now first in the `roblox-reel` template (eleven nodes) and wired into Brand's optional `project` input. It picks a folder from `CONTENT_PROJECTS_DIR` (default: three levels above `REEL_PIPELINE_DIR`) and creates `<project>/reels/<flow name>/`; approved outputs are copied into numbered stage folders. The **Brand** node now picks from a shared brand library (`brands` table, `/api/flows/brands`), filled by uploading a brand guide `.md` and/or `brand.json` or by an in-app form. Explained in ROBLOX is the first library brand. The Flows UI follows Airy Pixel. See [[Flow Engine]] and [[Flows UI]]. Existing flows such as Reel 002 have no Project node; add one with **+ Node**.

Platform: the [platform audit](../docs/audits/2026-11-01-platform-audit.md) ranks remaining work in phases. Phase 0 added anti-framing headers and navigation fixes. Phase 1 sandboxed the repo check, stopped the dev server serving `.power-agents/`, added launch-link sign-in (`npm run open`) and made Codex Telegram approvals opt-in. Next: Phase 2 agent prompt rewrite and structured output, then distinct run titles.

Reel media: F4 runs Voice, Capture, Edit, Preview, QA and Final through Python stages; live acceptance limits are in [F4 verification](../docs/f4-verification.md). F5 Telegram gates for reel flows remain planned.

Codex mobile: [[Codex Telegram Mobile]] is planned, not built. The original follower transport is blocked ([evidence](../docs/codex-mobile-capabilities.md)); a supervised Desktop launcher on the documented App Server is the candidate ([research](../docs/codex-mobile-shared-server-research.md)). Implemented today: a Codex Telegram bridge for completion alerts, approvals and questions; see [[Telegram Notifications]] and [setup](../docs/codex-telegram.md).

Canonical behavior is in the [prototype guide](../docs/prototype.md).
