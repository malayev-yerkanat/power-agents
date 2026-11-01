---
type: decision
title: "Codex Telegram Mobile"
status: planned
created: 2026-10-31
updated: 2026-10-31
tags: [telegram, codex, architecture, planned]
---

# Codex Telegram Mobile

Approved design, not implemented: mirror existing Desktop projects and chats in a Telegram Mini App, create tasks in existing projects, continue conversations, and submit ordinary bot messages to an explicitly selected chat. Execution requires an awake Mac and running Desktop/connector.

A hosted relay forwards content over an authenticated outbound Mac connection. It stores pairing metadata only, with no transcripts, task queue, payload logs, or response cache. Desktop remains the source of truth. The existing Mac-hosted bot keeps its token and sole poller; it cannot answer while the Mac sleeps, and accumulated task messages must be rejected after recovery.

The first implementation gate verifies full catalog/history access and Desktop creation, starting, steering, stopping, and delivery reconciliation. Current approval/question IPC support does not prove those capabilities. Unsupported remote-host or unloaded conversations must not be silently omitted. Uncertain submissions are reconciled or explicitly left uncertain, never automatically replayed.

See the [approved spec](../../docs/superpowers/specs/2026-10-31-codex-telegram-mobile-design.md) and [implementation plan](../../docs/superpowers/plans/2026-10-31-codex-telegram-mobile.md). Current implemented behavior remains in [[Telegram Notifications]], [[Telegram Notification Flow]], and [Codex setup](../../docs/codex-telegram.md).

## Capability investigation — 2026-10-31

The first gate is blocked; see the [evidence report](../../docs/codex-mobile-capabilities.md). Existing focused tests pass (80/80), and a live read-only owner snapshot was verified. The inspected follower socket lacks project/all-chat catalog and chat creation handlers; steering does not preserve a caller-supplied expected turn. The separate app-tools pipe has scoped peer/caller authorization, not a verified background-service contract. No mobile implementation or live mutation test proceeded.

## Shared-server follow-up

[New research](../../docs/codex-mobile-shared-server-research.md) verifies the documented App Server can read existing projects/chats and accept two clients through a private Unix socket. A supervised stdio launcher using the installed executable override is the proposed Desktop attachment. Actual Desktop restart, tool/approval preservation, and mutations remain unverified. The original follower-only blocker is not proof the feature is impossible.
