# Codex Telegram Mobile Design

Date: 2026-10-31
Status: approved architecture; planned behavior, not implemented.

## Goal and approved choices

Provide a single-user Telegram Mini App that mirrors existing Codex Desktop projects and chats. The user can read history, start a new task in an existing project, and continue a chat from a phone. Ordinary bot messages can also submit work to an explicitly selected target. Execution requires the Mac to be awake with Codex Desktop and the connector running.

The approved connection is a hosted Mini App plus a small relay. Chat content may pass through the relay but must not be stored there. Desktop remains the source of truth. Existing supported approval and question controls remain available in Desktop and Telegram.

User approved navigation, explicit target selection, awake-only operation, and the architecture on 2026-10-31. User explicitly requested both this written spec and the detailed implementation plan. No implementation, deployment, commit, or push is authorized by this planning task.

## Current evidence and first gate

`src/server/codex/threads.ts` currently reads only the IDs of 100 recent nonarchived, top-level chats. `bridge.ts` follows only chats with a Desktop owner. `async-questions.ts` sends narrowly scoped question steering; it does not establish arbitrary turn creation support. `docs/codex-telegram.md` records the undocumented IPC compatibility boundary.

Before building the relay or UI, verify the installed Desktop's actual capabilities: project enumeration and ordering, complete paginated chat discovery, unloaded and archived chat access, history pagination, chat creation in an existing project, starting an idle turn, steering an active turn, interruption, and observable submission identity. Record exact versions and observed request/response schemas without private content. Do not invent IPC method names or equate CLI threads with Desktop chats.

All projects/chats means the user's existing local Desktop projects and top-level chats, including older and archived history and chats outside projects. Attached child conversations must remain discoverable in their parent context if Desktop exposes them. Remote-host projects/chats must be identified during discovery: if present, full mirroring is blocked until their support is proven or the user approves a narrower scope. Never silently omit inaccessible chats or claim full parity from a 100-chat sample.

If any required capability is unavailable, stop the dependent milestone and propose a concrete scope or adapter revision. Do not substitute a separate CLI conversation store, directly write Codex SQLite, patch Desktop, or change its approval policies.

## User experience

1. Projects: existing Desktop projects, search, chats outside projects, and archived history. Preserve project identity even when names collide. Search must state whether it covers loaded items or all history; v1 searches loaded metadata and offers load-more.
2. Project chats: paginated chats with title, recent activity, execution state, and New task. New task uses an existing project and Desktop's existing defaults for execution settings.
3. Conversation: paginated text/Markdown history, live output, pending supported questions, composer, and Stop. Non-text items show an explicit unsupported-item label instead of silently disappearing. New attachments and voice input are excluded.
4. Sending to an idle chat starts a new turn. Sending during execution steers the captured active turn. If that turn ends before submission, return a conflict; do not silently start a new turn.
5. Opening a chat never changes the bot target. Use this chat for bot messages explicitly sets the target and returns a bot receipt naming the project and chat. `/target` shows or changes it; `/new` selects an existing project and creates a new chat only on an explicit submission.
6. Plain bot messages require a valid selected target. Explicit replies to pending approval/question messages retain their existing routing precedence; stale replies are rejected, never reinterpreted as tasks. Text never grants permissions.
7. Bot acknowledgments name the captured destination and distinguish accepted, rejected, and uncertain delivery. Target changes cannot redirect a message already received. Target state clears on unpairing; deleted or inaccessible targets require reselection. Archived chats are readable, but sending requires an explicit Desktop-compatible unarchive action or a clear unsupported-action message.

The visual reference is `.superpowers/brainstorm/27387-1793449126/content/phone-flow.html`; it is a static sample, not an implementation dependency. Documents are the authoritative design.

## Components and boundaries

### Desktop adapter on the Mac

Extend `src/server/codex/` with separate catalog, history, operation, compatibility, and local submission-store modules. Expose typed application operations, never an arbitrary IPC proxy. Each operation checks device/session identity, resource identity, capabilities, Desktop ownership, and current state. Follow active/open chats on demand; do not subscribe to every transcript.

Desktop owns project configuration, conversations, transcripts, and model execution. The connector owns local target metadata and a submission ledger. It does not create a second transcript database. Preserve the existing local Power Agents listener and CSRF/session protections.

### Hosted relay

A separate deployable Node service hosts the Mini App/API and accepts an authenticated outbound WebSocket from the Mac. The Mac's existing loopback HTTP API and private IPC socket are never exposed publicly. The relay routes only enumerated mobile operations to the paired device.

Persistent relay data is limited to opaque pairing/device IDs, Telegram user ID, public authentication material, revocation state, and schema metadata. Do not persist titles, paths, messages, prompts, responses, file contents, or search terms. Transient bounded memory buffers are cleared on delivery, timeout, disconnect, or process shutdown. No task outbox, durable message broker, response cache, request-body logs, crash payload capture, or transcript-bearing telemetry. Sensitive HTTP responses use `Cache-Control: no-store`; browser code has no transcript localStorage, IndexedDB, or service-worker cache.

Use HTTPS/WSS. A local pairing command registers a device public key using a one-use, short-lived code. The private device key remains on the Mac. Bind sessions to the single paired Telegram user and device, with revocation. Authenticate Telegram Mini App launch data server-side; verify its documented signature using Telegram's public key and bot ID, freshness, and paired user identity. This avoids moving the bot token to the relay. Validate this mechanism with current official documentation and a real launch before committing to it. Reject unsigned browser access to live data.

### Mini App

Use a separate React entry and build output. Render untrusted Markdown without raw HTML and allow only safe link schemes. Keep drafts in memory during navigation; disclose that closing/reloading can discard them. Paginate catalog/history and subscribe to the open chat. Reconnect refreshes authoritative state before enabling writes.

### Telegram bot

Keep the existing dedicated Codex bot token and sole long-poll consumer on the Mac. Add a task router alongside existing approvals/questions, preserving Claude isolation. The relay does not start a competing poller or install a webhook.

Important availability limit: while the Mac is asleep, Telegram's native composer remains available but the bot cannot immediately answer. The Mini App disables submission; bot messages accumulated during disconnection are rejected when the Mac reconnects. An always-available offline bot reply would require moving ingress/token handling to a hosted service and is outside this design.

## Protocol, safety, and failure behavior

Application operations: list projects, list chats, read history, create chat and first turn, send to idle chat, steer active turn, interrupt active turn, read/set bot target, read submission status, and subscribe/unsubscribe. These are application-level names; actual Desktop methods are outputs of the verification gate.

Requests carry protocol version, request/submission ID, device/session identity, operation, resource IDs, expected state/turn where applicable, connection generation, and a deadline. Validate bounded schemas on both sides. Initial limits: 50 catalog/history items per page, 16,000 text characters per Mini App submission, 4,000 per bot task, 256 KiB per protocol frame, one pending mutation per chat and ten submissions per minute per user. Chunk history/output by item and bytes rather than truncating security-relevant prompts.

Use a heartbeat every five seconds and mark the Mac offline after fifteen seconds without a valid heartbeat. Distinguish Mac offline, Codex unavailable, incompatible version, reconnecting, and relay/network unavailable. Lost phone connectivity is not proof that the Mac is offline. Submission requires a fresh authenticated device connection and an explicit Desktop capability check.

Persist an intent on the Mac before dispatch. Store submission ID, operation, opaque destination IDs, local keyed payload digest, timestamps, state, and resulting chat/turn IDs where available; do not store task bodies. States: prepared, dispatching, accepted, rejected, uncertain. Serialize conflicting mutations per chat; validate target revision when setting selection. Reuse a submission ID only for the same digest and operation. Retain local deduplication metadata for seven days; expired attempts are not automatically retried.

A crash between Desktop accepting and local acknowledgment is not exactly-once execution. Reconcile using an observable request/turn identity proven by the capability gate. If identity cannot be established, mark uncertain, block automatic retries, and ask the user to inspect Desktop. Never replay an uncertain create-chat operation or task on reconnect. A chat created without a confirmed first turn is reported as a partial result, not recreated.

Bot ingress must establish a fresh connection generation after startup, polling loss, Desktop loss, or relay outage. Drain and reject backlog through a captured update high-water mark before enabling new task dispatch; reject messages dated before the ready boundary, including the ambiguous boundary second. Delayed/ambiguous messages get a fresh-send instruction. Process updates serially so target selection and task capture have deterministic order. Existing prompt responses still undergo their own request/turn checks. Local bot task admission also requires a healthy relay generation for consistent phone status.

Permission decisions continue through the existing strict request adapter. Never downgrade unknown approval types into task text. All live Desktop operations retain existing sandbox/model/approval settings; task submission is not approval.

## Test and acceptance criteria

- Capability report proves existing projects and old/unloaded chats are discoverable, not only the recent active subset. Explicitly enumerate unsupported remote/child/archive cases.
- A new phone task produces exactly the expected Desktop chat and a continuation uses its existing identity. Active steering cannot become a new idle turn by accident.
- Same-title projects/chats, pagination boundaries, streamed-output gaps, Unicode, unsafe Markdown, expired identity, revoked devices, unauthorized users, and invalid cursors have tests.
- Duplicate updates, concurrent target changes, lost acknowledgments, partial chat creation, restart recovery, old bot updates, and disconnect-before-dispatch never silently execute unintended work.
- Offline Mini App sending is disabled; reconnect backlog is rejected. Relay disk/log/cache inspection finds no seeded transcript markers, including error paths.
- Existing approval/question and Claude bot tests remain passing. Supported Desktop-first decisions invalidate Telegram buttons as before.
- Unit/integration coverage meets the existing 80% requirement. Typecheck, build, focused and full tests, and browser tests pass. No linter currently exists; report that rather than inventing a lint command.
- A final single-user phone acceptance run uses a disposable project and benign task. Hosting/BotFather changes and real task execution are separate implementation actions, not performed during planning.

## Delivery stages

1. Capability evidence and go/no-go decision.
2. Typed local adapter, submission ledger, and routing regression protection.
3. Relay authentication/transport and privacy verification.
4. Bot task routing and explicit target selection.
5. Mini App, live updates, and reconnect handling.
6. Phone acceptance, operational documentation, compatibility runbook, and wiki updates.

## References

- Current implementation: `docs/codex-telegram.md`, `src/server/codex/`, `src/server/telegram.ts`.
- Telegram Mini Apps and signature validation: https://core.telegram.org/bots/webapps#validating-data-for-third-party-use
- Implementation plan: [Codex Telegram Mobile](../plans/2026-10-31-codex-telegram-mobile.md).
