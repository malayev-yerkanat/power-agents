---
type: dependency
status: active
created: 2026-10-07
updated: 2026-10-07
tags: [dependency, stack]
---

# Tech Stack

- Node.js 24+ and TypeScript run the local server. `tsx` loads TypeScript in development and production scripts.
- React 19, Vite 7, Tailwind CSS 4, and Phosphor icons implement the browser interface.
- Node's built-in `node:sqlite` `DatabaseSync` persists runs and events.
- Zod validates API inputs and structured model results.
- Node's test runner covers the engine, store, adapters, HTTP API, client, and prompts.
- Supported execution connections are Codex CLI, Claude Code, Antigravity CLI, OpenAI API, and Anthropic API, subject to local installation, login, keys, and model access.

Versions and scripts: [package.json](../../package.json). Setup: [prototype guide](../../docs/prototype.md).
