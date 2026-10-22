---
type: overview
status: active
created: 2026-10-07
updated: 2026-10-10
tags: [product, architecture]
---

# Project Overview

Power Agents is a local prototype where a user gives a goal to a team of 2–5 AI participants. A chosen leader proposes a plan; the user approves or requests revisions. The engine then runs dependent tasks, relays participant questions, assembles a result, and asks a second participant to review it. The browser shows events and text artifacts. See [[Data Flow]].

The implementation runs on one computer with Node.js 24+, a React/Vite client, a local HTTP API, and SQLite. It discovers Codex CLI, Claude Code, Antigravity CLI (`agy`), and OpenAI/Anthropic API connections at server startup. The composer loads a model list for each selected connection; CLI participants may keep the provider default, while API participants must select a model. A demo mode exercises the orchestration without model calls. See [[Tech Stack]], [[Provider Adapters]], and [[Model Selection Flow]].

On macOS, a per-user LaunchAgent can start the built server at login and restart it after a process exit. It uses the same loopback address and local storage; see [[macOS Autostart Flow]].

Recent run summaries and journal entries load in bounded pages, with older history available on request. [[Backup and Restore Flow]] captures the SQLite state and workspaces while the server is stopped. Repository CI checks tests, coverage, type safety, build output, and dependency advisories.

Optional [[Telegram Notifications]] pair one private chat and send brief alerts when a plan needs approval or a reviewed run completes. Pairing and alert preferences live in Settings. Approval remains in the local browser; Telegram does not give a phone access to the loopback-only app.

## Current boundaries

- One active team at a time; up to three concurrent turns and one turn per participant.
- Text and Markdown results; providers do not edit external repositories.
- Runtime state is local under `.power-agents/`, excluded from Git.
- The current prototype has no universal MCP tool layer, browser attachments, or paid usage budget. The broader design describes some of these as future capabilities.
- Automated tests use provider mocks. A small live Codex CLI + Gemini Antigravity CLI run completed the full plan-to-review flow on 2026-10-07; this does not verify the other providers or broader task types.

Canonical current behavior: [prototype guide](../docs/prototype.md), then live `src/` and `tests/`. Broader intent: [[Platform Design Source]].

## Visual workspace

The selected Airy Pixel UI represents agents as provider-branded Rangers and outstanding tasks as numbered tokusatsu villains in a city. The ivory/cobalt interface, history page and navigation dialog, and minimal tabbed workspace are implemented. C1 saber and L1 staff are selected; procedural combat, communication and completion effects are implemented; articulated pose sheets are implemented for the ambient city only. [[Pixel Art Consistency]] defines the persistent rendering constraint; [[Client Interface]] describes real state mapping and narrow-screen scene scrolling.

Accessibility improvements retain the pixel aesthetic: stronger contrast, wrapping navigation, field-linked validation, semantic document disclosures, labelled leadership, readable control sizes and concise run announcements. Completion preserves the current tab and draft; see [[Client Interface]] for scope and verification limits.

The refined composer places task entry before the team summary and optional Ranger preview. Completed runs place the accepted document before the optional encounter, with safe formatted Markdown, source view, copy and download actions. Paused/failed runs show latest-review context when present and a direct path to clarification; sending and resuming remain separate. See [[Client Interface]].

An optional panorama above the workspace shows an ambient pixel city with moving traffic, planes and periodic monster attack effects. It starts collapsed and loads art on first expansion. Consistent actor scale and separate sky/sidewalk/road layers preserve depth; a separate city-motion toggle persists locally and respects reduced motion. Ambient scenery does not represent run progress.

Ambient city, cars and aircraft now use detailed generated raster artwork matched to the character references, with logical pixel rendering and newly redrawn small-grid vehicle sprites. The simplified procedural skyline has been removed; see [[Client Interface]] and [[Pixel Art Consistency]].

The ambient monsters now breathe, roar, stomp and perform three attack gestures each using aligned key poses. Shared ground anchors, fixed scale and padded logical canvases preserve pixel consistency. Minor generated art variation remains; see [[Client Interface]].

Editor drafts survive navigation and reload within the current browser tab through validated `sessionStorage`; creation and run-specific steering remain separate. Fragment links preserve run/tab context and browser back/forward. History filtering covers loaded pages only, with older pages available on request. These client changes leave the API, SSE, provider execution and SQLite contracts intact; server-wide history search and reusable named teams remain planned work.
