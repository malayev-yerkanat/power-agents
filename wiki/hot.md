---
type: meta
title: "Hot Cache"
status: active
created: 2026-10-07
updated: 2026-11-01
tags: [context]
---

# Hot Cache

Planning completed: [[Codex Telegram Mobile]] records the approved phone mirror of existing Desktop projects/chats, new tasks, chat continuation, and explicit bot target selection. The hosted Mini App uses a small relay with no transcript storage. Execution is awake-only. The spec and ten-task implementation plan are linked from that decision page; no mobile functionality or deployment has been implemented.

Shared-server follow-up: [research](../docs/codex-mobile-shared-server-research.md) confirms existing project/chat reads through the documented App Server and two simultaneous clients on a private Unix socket. A supervised Desktop launcher is the new candidate; actual Desktop relaunch, tools, approvals, and mutations still need verification. No phone app is ready.

Original follower-transport capability gate BLOCKED: [evidence report](../docs/codex-mobile-capabilities.md). The installed follower socket lacks project/all-chat catalog and chat creation handlers; steering cannot bind a caller-selected turn atomically. Existing focused tests pass (80/80); live initialization and an owned v11 canonical snapshot pass. The separate scoped app-tools pipe is not a verified background-service integration. No mobile adapter/relay/UI implementation or live mutation test proceeded. Unknown delivery cannot be automatically retried.

The bot token and sole poller remain on the Mac in the planned architecture. Therefore offline bot messages cannot receive an immediate rejection; reject accumulated tasks after reconnecting. The Mini App can independently show offline through relay heartbeat state.

Current implemented Codex integration is a dedicated Telegram completion/approval/question bridge, separate from Claude. Completion alerts cover observed active turns that finish successfully, without historical replay. Alerts use “✅ Project · done” followed by a brief final-response excerpt, retained in the durable outbox. The durable outbox retries delivery and deduplicates chat/turn identities. Disconnected or unobserved short turns may be missed. See [[Telegram Notifications]], [[Telegram Notification Flow]], and [setup/limitations](../docs/codex-telegram.md). It supports command/network and current-turn permission requests, supported empty-form MCP confirmations, and structured questions. Private IPC is version-checked; unknown/secret/oversized requests remain Desktop-only. Desktop answers and stale/disconnected requests invalidate controls.

Latest: the [platform audit](../docs/audits/2026-11-01-platform-audit.md) ranks remaining work in phases; Phase 0 added anti-framing page headers and fixed the single current header section and fragment scroll reset. Phase 1 sandboxed the repo check command (macOS `sandbox-exec`) and stopped the dev server serving `.power-agents/`. Phase 1 also added launch-link sign-in (`npm run open`, persistent signed session) and made Codex Telegram approvals opt-in (`CODEX_TELEGRAM_APPROVALS=true`). Next: Phase 2 agent prompt rewrite and structured output, then distinct run titles. Recent application work includes upload timeout, flow-result crash, and dropped Telegram approval fixes. Canonical behavior is in [prototype guide](../docs/prototype.md). F4 reel media pipeline live acceptance limits remain in [F4 verification](../docs/f4-verification.md); F5 reel-flow Telegram gates remain separate planned work.
