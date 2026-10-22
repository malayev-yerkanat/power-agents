---
type: meta
title: "Hot Cache"
status: active
created: 2026-10-07
updated: 2026-10-20
tags: [context]
---

# Hot Cache

## Last Updated

2026-10-20. Wiki cleanup only: current source snapshots and source pages for the [[UI Improvements Plan Source|UI plan]] and [[Design Audits Source|design audits]]. The latest implementation remains the 2026-10-10 work-first UI pass: drafts, run links, history, recovery and responsive controls, verified in the [UI audit](../docs/audits/2026-10-10-ui-improvements.md).

## Repository State

Everything since commit `55d8f05` (2026-10-08) (CI, backup, UI pass, art, wiki) is uncommitted. Local checks on 2026-10-20: 128/128 Node tests, 80.90% line coverage against an 80% gate, 35/35 Chromium tests, typecheck, build with a bundle-size warning, and a clean audit.

## Current System

- Power Agents is a local TypeScript/React/SQLite prototype. The Node server binds to `127.0.0.1:4317`; one team runs at a time with up to three parallel provider turns.
- A leader plans, the user approves, participants work and ask questions, then the leader synthesizes and another participant reviews. Universal MCP tools and external repository edits remain planned.
- `/api/bootstrap` returns 30 recent run summaries and an event cursor. Older runs and journal events load in pages; SSE replay requests a snapshot resync for gaps over 100 events.
- SQLite stores runs, events, Telegram settings and a durable alert outbox. [[Backup and Restore Flow]] captures SQLite and workspaces only while the server is stopped. Backups contain private task content; `.env` and logs are excluded.
- Telegram pairs one private chat with a one-use `/start` link for brief plan-ready and completion alerts. Approval stays in the local app; polling failure disables pairing and test controls until recovery.
- Codex, Claude and Antigravity CLI plus OpenAI/Anthropic APIs are available when configured. Gemini receives prompts through CLI stdin. CLI plan/read-only controls are not an OS isolation boundary. Automated provider tests use mocks; a small Codex/Gemini live run passed on 2026-10-07.
- A user LaunchAgent can start the built server at macOS login while the Mac is awake. CI checks tests with an 80% line-coverage gate, synthetic Chromium flows, type checking, build and dependency audit.

## Current UI

Task entry comes before a compact team summary and optional preview. Ambient city art loads on first expansion; the approved expanded pixel scale is unchanged. Completed runs show the accepted result above the optional encounter. Documents support safe Markdown, source view, copying and downloads. Paused/failed runs expose latest-review context when present and a clarification focus action; sending feedback and resuming remain separate.

Creation and run-specific steering drafts survive navigation/reload within one tab through validated `sessionStorage`. Fragment routes preserve run/tab context and browser history. The history page searches only loaded pages and retains older-page loading. Validation expands and focuses the affected field. Mobile targets and narrow-screen layout have browser checks. [[Pixel Art Consistency]] remains authoritative for visuals.

## Scope Boundaries

No server schema, provider execution, Telegram delivery, or SSE contract changed in this UI pass. Full-history search, archive/rename, named team presets, provider diagnostics, dark mode, new sprite production, and full screen-reader verification remain separate work. Larger live tasks and Telegram delivery need separate validation.
