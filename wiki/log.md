---
type: log
status: active
created: 2026-10-07
updated: 2026-10-07
tags: [history]
---

# Operation Log

## 2026-10-07 — Model selection

- Replaced free-form model IDs in the team composer with a connection-specific selector.
- Added protected, on-demand model discovery through Codex and Antigravity CLI commands and OpenAI/Anthropic model-list APIs. Claude Code uses documented aliases until a machine-readable CLI list is available.
- Kept provider credentials on the server and documented that catalog presence does not prove account entitlement or endpoint compatibility.

## 2026-10-07 — Session recovery

- Added a one-time browser session recovery path after HTTP 401, including fresh CSRF tokens for mutations and event stream reconnection.
- Verified a full demo workflow in the in-app browser.
- Verified a live Codex/Gemini workflow through planning, approval, three dependent tasks, synthesis, and independent review; saved Markdown and review artifacts.
- Reproduced a stream recovery gap on server restart, fixed the retry path, and verified a production client reconnected without a page reload.
- Added backoff for repeated short-lived event streams and restricted the client request helper to same-origin `/api` paths after security review.

## 2026-10-07 — Initial scaffold

- Created a repository mode Obsidian wiki with module, flow, decision, dependency, source, and domain navigation.
- Preserved dated snapshots of the prototype guide, platform design, and implementation plan under `.raw/`.
- Documented the implemented architecture separately from planned platform capabilities.
- Added `AGENTS.md` maintenance instructions for updates after every major implementation.
