---
type: flow
status: active
created: 2026-10-07
updated: 2026-10-30
tags: [flow, api, security]
---

# Session and API Flow

1. The browser loads `/api/bootstrap`. The server sets `power_agents_session` as an HttpOnly, SameSite=Strict cookie and returns a CSRF token, connections, 30 recent run summaries, and the latest event cursor.
2. Protected reads and EventSource requests carry the cookie. JSON mutations also send `X-CSRF-Token`.
3. The server validates loopback Host, Origin, fetch metadata, session cookie, CSRF token, body schema, and rate limit as applicable.
4. State changes emit SSE notifications. `App.tsx` then refetches bootstrap and the selected run. Older runs and events are loaded through explicit pages.

F2 adds `flow` events on the global `/api/events` stream, driven by `store.subscribeFlows`. These events carry a flow invalidation rather than a graph patch. [[Flows UI]] refetches the selected flow after each matching event and refreshes flow state on stream open/reconnect to recover missed changes; the list also refreshes. Flow notifications do not participate in the persisted team-run event cursor or replay history.

For team-run events, SSE replays at most 100 missed events. A larger backlog emits `resync`; the browser fetches a fresh bootstrap snapshot and selected-run detail, then reconnects from the snapshot cursor. This bounds replay work while retaining paged access to historical events.

The server creates session values at startup. A stale or absent cookie makes protected requests return HTTP 401 with `Open the application to start a session`. The message describes missing session state, even if the page is visible. The client now fetches `/api/bootstrap` and retries a rejected request once, replacing the CSRF token for mutations. Concurrent rejected requests share one recovery fetch. The client only sends same-origin `/api` paths. The event stream closes after an error, retries bootstrap with a bounded delay while the server is unavailable, then opens a new stream after backoff. Its failure count resets only after 30 seconds of stable connection; after repeated short-lived failures, the UI asks the user to check cookies and reload.

Client fragment routes and `sessionStorage` drafts do not change bootstrap cookies, CSRF handling, SSE replay, run persistence, or the API contract. Browser drafts are separate from SQLite and scoped to one tab. Direct links fetch run detail by ID even when its summary is absent from the loaded history page. History filtering covers loaded pages only.

A production-mode browser check on 2026-10-07 confirmed the page remained open while the server stopped and restarted: the status changed from connected to reconnecting and back to connected without a page reload.

See [HTTP implementation](../../src/server/http.ts), [session client](../../src/client/session.ts), [app wiring](../../src/client/App.tsx), and [session tests](../../tests/session.test.ts).
