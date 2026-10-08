---
type: overview
status: active
created: 2026-10-07
updated: 2026-10-08
tags: [product, architecture]
---

# Project Overview

Power Agents is a local prototype where a user gives a goal to a team of 2–5 AI participants. A chosen leader proposes a plan; the user approves or requests revisions. The engine then runs dependent tasks, relays participant questions, assembles a result, and asks a second participant to review it. The browser shows events and text artifacts. See [[Data Flow]].

The implementation runs on one computer with Node.js 24+, a React/Vite client, a local HTTP API, and SQLite. It discovers Codex CLI, Claude Code, Antigravity CLI (`agy`), and OpenAI/Anthropic API connections at server startup. The composer loads a model list for each selected connection; CLI participants may keep the provider default, while API participants must select a model. A demo mode exercises the orchestration without model calls. See [[Tech Stack]], [[Provider Adapters]], and [[Model Selection Flow]].

On macOS, a per-user LaunchAgent can start the built server at login and restart it after a process exit. It uses the same loopback address and local storage; see [[macOS Autostart Flow]].

Optional [[Telegram Notifications]] pair one private chat and send brief alerts when a plan needs approval or a reviewed run completes. Pairing and alert preferences live in Settings. Approval remains in the local browser; Telegram does not give a phone access to the loopback-only app.

## Current boundaries

- One active team at a time; up to three concurrent turns and one turn per participant.
- Text and Markdown results; providers do not edit external repositories.
- Runtime state is local under `.power-agents/`, excluded from Git.
- The current prototype has no universal MCP tool layer, browser attachments, or paid usage budget. The broader design describes some of these as future capabilities.
- Automated tests use provider mocks. A small live Codex CLI + Gemini Antigravity CLI run completed the full plan-to-review flow on 2026-10-07; this does not verify the other providers or broader task types.

Canonical current behavior: [prototype guide](../docs/prototype.md), then live `src/` and `tests/`. Broader intent: [[Platform Design Source]].

## Visual workspace

The selected Airy Pixel UI represents agents as provider-branded Rangers and outstanding tasks as numbered tokusatsu villains in a city. The ivory/cobalt interface, native history drawer, and minimal tabbed workspace are implemented. C1 saber and L1 staff are selected; full combat animation remains planned. [[Pixel Art Consistency]] defines the persistent rendering constraint; [[Client Interface]] describes real state mapping and narrow-screen scene scrolling.
