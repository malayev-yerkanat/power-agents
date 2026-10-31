---
type: meta
title: "Hot Cache"
status: active
created: 2026-10-07
updated: 2026-10-30
tags: [context]
---

# Hot Cache

Codex Desktop now has a dedicated Telegram bot bridge, separate from Claude. Configure `CODEX_TELEGRAM_BOT_TOKEN`, enable `CODEX_TELEGRAM_ENABLED`, restart and pair with `npm run codex:telegram:pair`. Its store is `.power-agents/codex-telegram.sqlite`. Missing/duplicate credentials never fall back to Claude. See [[Telegram Notifications]], [[Telegram Notification Flow]] and [setup/limitations](../docs/codex-telegram.md).

Supported prompts: complete command/network approval previews, exact current-turn permission grants, empty-form MCP tool confirmations (including Browser use downloads), blocking questions, and structured async questions in an active turn. Explicit Telegram replies are bound to the paired user and message. Desktop answers, stale requests, disconnects and expiry invalidate controls. Unknown, secret, oversized, file-change, plan/option-picker, authentication and other MCP elicitation prompts remain desktop-only. The adapter uses undocumented desktop IPC with version checks; async replies are ordinary steering with a fresh-state check, not an atomic expected-turn operation.

Verification: 314/314 unit/integration tests, 86.79% overall line coverage, build/typecheck pass; all 44 browser tests passed during initial integration. Tests cover protocol framing, discovery, owner isolation, canonical history, stale answers, token isolation and pairing authorization. No linter is configured. Dedicated bot pairing and a live Telegram-to-Codex question reply are verified; coverage is all local desktop chats within the bounded discovery window. No commits or pushes. Existing Claude and artwork edits were preserved.

Previous major work: EN/RU interface fixes and F4 reel media pipeline. Start with [[Client Interface]], [[Flow Engine]], [[Flows UI]] and [[Reel Flow Execution]]. Canonical behavior is in [prototype guide](../docs/prototype.md); media verification limitations remain in [F4 verification](../docs/f4-verification.md). F5 Telegram approvals for Power Agents reel flows remain planned and are distinct from this Codex Desktop bridge.
