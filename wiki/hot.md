---
type: meta
title: "Hot Cache"
status: active
created: 2026-10-07
updated: 2026-10-07
tags: [context]
---

# Hot Cache

## Last Updated

2026-10-07. Added connection-specific model selectors, browser session recovery, and verified demo and live runs.

## Key Recent Facts

- Power Agents is a local TypeScript/React/SQLite prototype for coordinated text and document tasks. The browser talks to a Node server on `127.0.0.1:4317`.
- Current implementation supports a leader plan, user approval, assigned tasks, agent messages, synthesis, and independent review. It does not implement universal MCP tools or editing external repositories.
- The broader platform design is aspirational. Use [[overview|Project Overview]] and live code when documenting present behavior.
- Automated tests cover orchestration with mocked providers. A live Codex CLI + Gemini Antigravity CLI run completed planning, approval, dependent tasks, synthesis, and independent review for a small checklist task.
- Protected API routes require a session cookie minted by `/api/bootstrap`; mutations also require a CSRF header. After a 401, the client reboots the session and retries once with a fresh CSRF token.
- A production-mode browser restart test confirmed the live event stream reconnects without reloading the page.
- The model field is a selector. Codex and Antigravity lists come from local CLI discovery; OpenAI and Anthropic lists come from their APIs when keys are configured. Claude Code offers documented aliases with an access caveat.

## Recent Changes

- Added [[Model Selection Flow]] and updated the provider, client, and API pages for model discovery.
- Updated [[Session and API Flow]], [[Client Interface]], and [[Local HTTP API]] for restart recovery, including event stream retry while the server is offline.
- Verified the demo workflow through planning, approval, tasks, messages, and independent review in the browser.

## Active Threads

- Keep this wiki synchronized as the prototype evolves. Check provider and authentication behavior against code before changing related notes.
- Codex and Gemini worked in one live run; other providers and larger task types still need separate validation.
