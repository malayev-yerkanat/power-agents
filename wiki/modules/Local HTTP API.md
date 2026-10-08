---
type: module
title: "Local HTTP API"
path: "src/server/http.ts"
status: active
language: typescript
purpose: "Expose local JSON routes, artifact downloads, and SSE"
created: 2026-10-07
updated: 2026-10-08
tags: [module, api, security]
---

# Local HTTP API

The API provides `/api/bootstrap`, protected `GET /api/models/:connectionId`, health, run creation/detail, approval, control, messages, artifact download, and event streams. Telegram routes expose connection status, pairing, a test alert, preferences, and disconnect; they do not expose the bot token. Request bodies use Zod schemas and a 64 KiB limit. It checks loopback host and origin, uses a session cookie on protected routes, requires a CSRF token on mutations, and rate limits requests.

The session and CSRF values are generated when the handler starts. `/api/bootstrap` sets the cookie and returns connection/run data plus the CSRF token. Restarting the server invalidates a prior cookie. See [[Session and API Flow]], [HTTP implementation](../../src/server/http.ts), and [HTTP tests](../../tests/http.test.ts).

The browser client handles that expected restart case by calling bootstrap again and retrying one rejected request. The server still enforces its existing cookie, origin, and CSRF checks.
