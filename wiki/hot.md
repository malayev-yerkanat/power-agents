---
type: meta
title: "Hot Cache"
status: active
created: 2026-10-07
updated: 2026-10-22
tags: [context]
---

# Hot Cache

## Last Updated

2026-10-23. Gemini turns now end at the first complete result line, because Antigravity can stay open after answering when started from the service. A messaging experiment again produced no peer messages: the leader chained dependent tasks instead.

## Repository State

All work through the review fixes is pushed to `main` (CI green). The Gemini fix is being committed on 2026-10-23. Local checks: 136/136 Node tests, 81.39% line coverage, 35/35 Chromium tests, typecheck.

## Current System

- Power Agents is a local TypeScript/React/SQLite prototype. The Node server binds to `127.0.0.1:4317`; one team runs at a time with up to three parallel provider turns.
- A leader plans, the user approves, participants work and ask questions, then the leader synthesizes and another participant reviews. Universal MCP tools and external repository edits remain planned.
- `/api/bootstrap` returns 30 recent run summaries and an event cursor. Older runs and journal events load in pages; SSE replay requests a snapshot resync for gaps over 100 events.
- SQLite stores runs, events, Telegram settings and a durable alert outbox. [[Backup and Restore Flow]] captures SQLite and workspaces only while the server is stopped. Backups contain private task content; `.env` and logs are excluded.
- Telegram pairs one private chat with a one-use `/start` link for brief plan-ready and completion alerts. Approval stays in the local app; polling failure disables pairing and test controls until recovery.
- Codex, Claude and Antigravity CLI plus OpenAI/Anthropic APIs are available when configured. CLIs use their own sign-in and never receive `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`. Each turn receives only the documents it needs. Gemini receives prompts through CLI stdin. CLI plan/read-only controls are not an OS isolation boundary. Automated provider tests use mocks; a small Codex/Gemini live run passed on 2026-10-07.
- A user LaunchAgent can start the built server at macOS login while the Mac is awake. CI checks tests with an 80% line-coverage gate, synthetic Chromium flows, type checking, build and dependency audit.

## Current UI

Task entry comes before a compact team summary and optional preview. Ambient city art loads on first expansion; the approved expanded pixel scale is unchanged. Completed runs show the accepted result above the optional encounter. Documents support safe Markdown, source view, copying and downloads. Paused/failed runs expose latest-review context when present and a clarification focus action; sending feedback and resuming remain separate.

Drafts survive reload within one tab (`sessionStorage`). Fragment routes keep run/tab context. History search covers loaded pages; older pages load on request. [[Pixel Art Consistency]] remains authoritative for visuals.

## Scope Boundaries

No server schema, provider execution, Telegram delivery, or SSE contract changed in this UI pass. Full-history search, archive/rename, Telegram delivery checks, named team presets, provider diagnostics, dark mode, new sprite production, and full screen-reader verification remain separate work.
