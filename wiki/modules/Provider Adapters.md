---
type: module
title: "Provider Adapters"
path: "src/server/adapters/"
status: active
language: typescript
purpose: "Discover configured providers and run agent turns"
created: 2026-10-07
updated: 2026-10-07
tags: [module, providers]
---

# Provider Adapters

At startup, `discoverConnections` looks for `codex`, `claude`, and `agy` executables, plus `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`. Executable discovery does not prove account authorization. The user chooses a connection and model per participant; CLI participants may use their default, while API participants require a model ID.

`models.ts` provides an on-demand catalog for the selected connection. Codex and Antigravity expose local CLI model lists. Claude Code currently uses documented Sonnet, Opus, and Haiku aliases because its installed CLI does not provide a verified machine-readable list. OpenAI and Anthropic model lists are requested with server-side API keys. See [[Model Selection Flow]] for the selector and its limits.

`runTurn` selects CLI or API execution. CLI adapters run official clients in a constrained mode; API adapters call provider endpoints. The engine may pass a saved session ID to continue a turn. Errors are redacted before reaching users. Demo mode uses `src/server/core/demo.ts` instead of provider calls.

Automated adapter tests use mocks. A small live collaboration run completed with Codex CLI and Gemini Antigravity CLI on 2026-10-07, but provider login/model access may change and the other connections have not been smoke tested here.

See [adapter discovery](../../src/server/adapters/index.ts), [model catalog](../../src/server/adapters/models.ts), [CLI adapter](../../src/server/adapters/cli.ts), [API adapter](../../src/server/adapters/api.ts), and [demo](../../src/server/core/demo.ts).
