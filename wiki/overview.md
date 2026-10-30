---
type: overview
status: active
created: 2026-10-07
updated: 2026-10-30
tags: [product, architecture]
---

# Project Overview

Power Agents is a local prototype where a user gives a goal to a team of 2–5 AI participants. A chosen leader proposes a plan; the user approves or requests revisions. The engine then runs dependent tasks, relays participant questions, assembles a result, and asks a second participant to review it. The browser shows events and text artifacts. See [[Data Flow]].

The implementation runs on one computer with Node.js 24+, a React/Vite client, a local HTTP API, and SQLite. It discovers Codex CLI, Claude Code, Antigravity CLI (`agy`), and OpenAI/Anthropic API connections at server startup. The composer loads a model list for each selected connection; CLI participants may keep the provider default, while API participants must select a model. A demo mode exercises the orchestration without model calls. See [[Tech Stack]], [[Provider Adapters]], and [[Model Selection Flow]].

The [[Client Interface]] supports an EN/RU switch without reloading, with a persisted browser preference and localized platform hints and feedback. Switching preserves drafts and user/model content; default flow node labels translate without changing their stored titles.

On macOS, a per-user LaunchAgent can start the built server at login and restart it after a process exit. It uses the same loopback address and local storage; see [[macOS Autostart Flow]].

Recent run summaries and journal entries load in bounded pages, with older history available on request. [[Backup and Restore Flow]] captures the SQLite state and workspaces while the server is stopped. Repository CI checks tests, coverage, type safety, build output, and dependency advisories.

Optional [[Telegram Notifications]] pair one private chat and send brief alerts when a plan needs approval or a reviewed run completes. Pairing and alert preferences live in Settings. Approval remains in the local browser; Telegram does not give a phone access to the loopback-only app.

## Current boundaries

A separate [[Flow Engine]] provides typed DAGs and demo runs via the protected local API, including approval gates, rejection notes, stale outputs, global scheduling and restart recovery. F2 [[Flows UI]] adds `#/flows` and `#/flows/<id>`, template creation, the dark React Flow canvas, typed connectors, node actions, a config inspector and SSE invalidation/refetch. [[Reel Flow Execution]] documents demo and live text paths. F3 implements Idea, Script and Scenes through read-only provider turns, validated JSON, one repair attempt, connection selection and readable card excerpts. F4 implements isolated content pipeline stages, ElevenLabs narration, Capture uploads, edit planning, preview/final rendering, QA and Range media playback. Flow Telegram actions remain planned for F5. Automated verification uses fake providers/renders; the live script-to-final reel acceptance run remains unverified.

- One active team at a time; up to three concurrent turns and one turn per participant.
- Text and Markdown results; providers do not edit external repositories.
- Runtime state is local under `.power-agents/`, excluded from Git.
- The current prototype has no universal MCP tool layer, browser attachments, or paid usage budget. The broader design describes some of these as future capabilities.
- Automated tests use provider mocks. A live Codex CLI + Claude Code + Gemini Antigravity CLI run completed the full plan-to-review flow on 2026-10-22 (a 1,446-word document task, 12 turns, about 14 minutes). It found and led to fixes for hidden CLI error reasons, unnamed failing participants and leader plans that duplicated synthesis and review. OpenAI/Anthropic API connections and larger tasks remain unverified live.

Canonical current behavior: [prototype guide](../docs/prototype.md), then live `src/` and `tests/`. Broader intent: [[Platform Design Source]]. Order of remaining work: [roadmap](../docs/roadmap.md) — M1 finishes the core loop (review rework, shared facts board, safe resume), M2 adds file and code output, M3 adds MCP team tools.

## Visual workspace

The selected Airy Pixel UI represents agents as provider-branded Rangers and outstanding tasks as numbered tokusatsu villains in a city. The ivory/cobalt interface, history page and navigation dialog, and minimal tabbed workspace are implemented. C1 saber and L1 staff are selected; procedural combat, communication and completion effects are implemented; articulated pose sheets are implemented for the ambient city only. [[Pixel Art Consistency]] defines the persistent rendering constraint; [[Client Interface]] describes real state mapping and narrow-screen scene scrolling.

Accessibility improvements retain the pixel aesthetic: stronger contrast, wrapping navigation, field-linked validation, semantic document disclosures, labelled leadership, readable control sizes and concise run announcements. Completion preserves the current tab and draft; see [[Client Interface]] for scope and verification limits.

The refined composer places task entry before the team summary and optional Ranger preview. Completed runs place the accepted document before the optional encounter, with safe formatted Markdown, source view, copy and download actions. Paused/failed runs show latest-review context when present and a direct path to clarification; sending and resuming remain separate. See [[Client Interface]].

An optional panorama above the workspace shows an ambient pixel city with moving traffic, planes and periodic monster attack effects. It starts collapsed and loads art on first expansion. Consistent actor scale and separate sky/sidewalk/road layers preserve depth; a separate city-motion toggle persists locally and respects reduced motion. Ambient scenery does not represent run progress.

Ambient city, cars and aircraft now use detailed generated raster artwork matched to the character references, with logical pixel rendering and newly redrawn small-grid vehicle sprites. The simplified procedural skyline has been removed; see [[Client Interface]] and [[Pixel Art Consistency]].

The ambient monsters now breathe, roar, stomp and perform three attack gestures each using aligned key poses. Shared ground anchors, fixed scale and padded logical canvases preserve pixel consistency. Minor generated art variation remains; see [[Client Interface]].

Editor drafts survive navigation and reload within the current browser tab through validated `sessionStorage`; creation and run-specific steering remain separate. Fragment links preserve run/tab context and browser back/forward. History filtering covers loaded pages only, with older pages available on request. These client changes leave the API, SSE, provider execution and SQLite contracts intact; server-wide history search and reusable named teams remain planned work.
