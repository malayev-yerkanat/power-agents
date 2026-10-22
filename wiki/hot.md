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

2026-10-22. A live Codex + Claude Code + Gemini run completed the full flow. Fixes from it: CLI error reasons surface, errors name the participant, and the leader no longer plans duplicate synthesis/review tasks. A failed task or reply now affects only its task; others keep working and the run pauses only when stuck. Open: peer messaging was not exercised.

## Repository State

All work through the review fixes is pushed to `main` (CI green). Failure isolation is being committed on 2026-10-22. Local checks: 135/135 Node tests, 81.20% line coverage, 35/35 Chromium tests, typecheck.

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

Creation and run-specific steering drafts survive navigation/reload within one tab through validated `sessionStorage`. Fragment routes preserve run/tab context and browser history. The history page searches only loaded pages and retains older-page loading. [[Pixel Art Consistency]] remains authoritative for visuals.

## Scope Boundaries

No server schema, provider execution, Telegram delivery, or SSE contract changed in this UI pass. Full-history search, archive/rename, Telegram delivery checks, named team presets, provider diagnostics, dark mode, new sprite production, and full screen-reader verification remain separate work.
