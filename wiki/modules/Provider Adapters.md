---
type: module
title: "Provider Adapters"
path: "src/server/adapters/"
status: active
language: typescript
purpose: "Discover configured providers and run agent turns"
created: 2026-10-07
updated: 2026-10-22
tags: [module, providers]
---

# Provider Adapters

At startup, `discoverConnections` looks for `codex`, `claude`, and `agy` executables, plus `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`. Executable discovery does not prove account authorization. The user chooses a connection and model per participant; CLI participants may use their default, while API participants require a model ID.

`models.ts` provides an on-demand catalog for the selected connection. Codex and Antigravity expose local CLI model lists. Claude Code currently uses documented Sonnet, Opus, and Haiku aliases because its installed CLI does not provide a verified machine-readable list. OpenAI and Anthropic model lists are requested with server-side API keys. See [[Model Selection Flow]] for the selector and its limits.

`runTurn` selects CLI or API execution. CLI adapters run official clients in a constrained mode; API adapters call provider endpoints. The engine may pass a saved session ID to continue a turn. Errors are redacted before reaching users. Demo mode uses `src/server/core/demo.ts` instead of provider calls.

The Gemini adapter uses Antigravity CLI's `stream-json` input through stdin, so task text is absent from command arguments. The CLI processes still access their selected workspace and provider authentication environment. Their plan/read-only settings are provider controls, not a separate OS or container isolation boundary.

`cliEnvironment` forwards only each CLI's own sign-in variables (`CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_OAUTH_TOKEN`, and the Gemini/Google credentials). `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` stay with the API adapters, so configuring an API connection never moves Codex or Claude Code participants onto paid API billing.

When a CLI exits non-zero, `runProcess` keeps its stdout in a `ProcessExitError`, and `runCli` reports the CLI's own error from that output (for example Claude Code's "Not logged in") instead of a generic "no details".

Automated adapter tests use mocks. A live Codex CLI + Claude Code + Gemini Antigravity CLI run completed the full plan-to-review flow on 2026-10-22 (a 1,446-word document task, 12 turns, about 14 minutes). It found and led to fixes for hidden CLI error reasons, unnamed failing participants and leader plans that duplicated synthesis and review. OpenAI/Anthropic API connections and larger tasks remain unverified live.

See [adapter discovery](../../src/server/adapters/index.ts), [model catalog](../../src/server/adapters/models.ts), [CLI adapter](../../src/server/adapters/cli.ts), [API adapter](../../src/server/adapters/api.ts), and [demo](../../src/server/core/demo.ts).
