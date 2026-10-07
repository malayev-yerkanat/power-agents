---
type: flow
status: active
created: 2026-10-07
updated: 2026-10-07
tags: [flow, providers, models]
---

# Model Selection Flow

1. The composer shows a model selector for each participant. Changing a connection clears the prior model, so a model from one provider cannot be carried into another connection by accident.
2. For each selected connection, the browser requests the protected `GET /api/models/:connectionId` route. The server returns model IDs and display names; secrets stay server-side.
3. Codex models come from `codex debug models`; Antigravity models come from `agy models`. Claude Code has no verified machine-readable catalog in this installation, so the selector offers documented Sonnet, Opus, and Haiku aliases and clearly marks account access as unverified.
4. OpenAI and Anthropic API connections query their provider's model-list endpoint with the server-side key. A missing key or failed catalog request is shown in the selector, with a retry action. API runs require a selected model. CLI runs may use the provider default.
5. The selected model ID remains the existing `Member.model` string in the run. The provider adapter passes it as `--model` or as the API request model. No storage migration is needed.

The catalog is a selection aid. A listed CLI model does not prove the user is logged in or entitled to run it; the real provider turn remains the authoritative check. The API provider's list describes models exposed to that key, but a particular endpoint can still reject an incompatible model.

See [composer](../../src/client/Composer.tsx), [model picker](../../src/client/ModelPicker.tsx), [catalog implementation](../../src/server/adapters/models.ts), [HTTP route](../../src/server/http.ts), [OpenAI model list](https://developers.openai.com/api/reference/resources/models/methods/list), and [Anthropic model list](https://platform.claude.com/docs/en/api/models/list).
