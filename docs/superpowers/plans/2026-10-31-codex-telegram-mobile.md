# Codex Telegram Mobile Implementation Plan

> **For agentic workers:** Use the available subagent-driven-development or executing-plans skill when execution is requested. Steps use checkboxes for tracking. If a named skill is unavailable, report it and follow the project's approved task-by-task workflow. Do not commit, push, deploy, or run real user tasks without the corresponding authorization.

**Goal:** Mirror existing Codex Desktop projects/chats in Telegram and submit new tasks or follow-ups from the Mini App and the explicitly targeted bot.

**Architecture:** A React Mini App talks to a hosted relay; an authenticated outbound Mac connection forwards narrow operations to the existing Desktop adapter. Desktop owns transcripts. The relay stores pairing metadata only, and the Mac retains the dedicated bot token/poller.

**Tech Stack:** Existing TypeScript, Node.js 24+, React/Vite, Zod, node:test, SQLite, and Playwright. Add a maintained Node WebSocket server library after verifying its current supported API; use Node's built-in client where supported. Host selection follows capability verification and must support long-lived WSS without payload logging.

**Spec:** [Approved design](../specs/2026-10-31-codex-telegram-mobile-design.md).

**Status:** Task 1 investigated on 2026-10-31; capability gate BLOCKED. Read-only live IPC and 80 baseline tests pass, but required catalog/creation access and caller-bound steering are not established. See [capability report](../../codex-mobile-capabilities.md). Tasks 2–10 have not started; mutation acceptance remains unverified.

## Execution order and gate

Follow-up research: [shared backend route](../../codex-mobile-shared-server-research.md) replaces the follower-only assumption with a candidate shared App Server and supervised stdio launcher. Existing catalog reads and two-client private-socket access passed. Before resuming Task 2, verify actual Desktop startup, tools/approvals, and mutation parity through this route. No Desktop relaunch or production implementation has happened yet.

Execute Task 1 first. Its report must provide exact Desktop methods, schemas, supported versions, and evidence before Tasks 2–10 begin. This plan deliberately specifies application contracts rather than guessing private IPC calls. If evidence changes a contract, update this plan/spec before implementing the dependent task.

Use separate reviewable milestones for adapter, relay, bot, and Mini App. They are dependent parts of one phone workflow, not parallel greenfield products. Delegate independent tests/reviews only after contracts are frozen. Before changes, read root/nested AGENTS.md, README.md, docs/prototype.md, and wiki/hot.md. Preserve unrelated work. No new worktree, commit, or external deployment is needed to produce these planning documents.

## File ownership map

Existing integration points:

- `src/server/codex/threads.ts`: bounded ID-only discovery; retain its approval behavior until replacement is verified.
- `src/server/codex/ipc.ts`, `bridge.ts`, `index.ts`: versioned Desktop connection, ownership, snapshots, and existing response transport.
- `src/server/codex/service.ts`: dedicated Codex bot lifecycle.
- `src/server/telegram.ts`: existing sole poller, pairing, callbacks, and structured replies.
- `src/server/index.ts`: service startup/shutdown wiring.
- `package.json`, `package-lock.json`, `tsconfig.json`: build/test dependency integration.

New modules, with one responsibility each:

- `src/shared/codex-mobile.ts`: bounded transport schemas and public DTOs.
- `src/server/codex/mobile/catalog.ts`, `history.ts`, `operations.ts`, `capabilities.ts`: verified Desktop application adapter.
- `src/server/codex/mobile/store.ts`, `submissions.ts`: local target/ledger persistence and dispatch state machine.
- `src/server/codex/mobile/connector.ts`: outbound authenticated relay lifecycle.
- `src/server/codex/mobile/bot-router.ts`: explicit targeting and task ingress.
- `src/relay/{auth,devices,router,connection,server}.ts`: isolated public service; no imports of local HTTP/session bootstrap or Desktop credentials.
- `src/mobile/{main,App,Projects,Chats,Conversation,ConnectionStatus}.tsx`, `src/mobile/{api,store,styles}.ts` (styles use `.css`): phone UI and transient state.
- `mobile.html`, `vite.mobile.config.ts`: separate static bundle.
- `tests/codex-mobile-*.test.ts`, `tests/relay-*.test.ts`, `tests/e2e/codex-mobile.spec.ts`: isolated tests with fake Desktop and transport.

Do not create all files upfront. Each task adds only its owned files. Keep components/modules focused; do not expand the existing Telegram class into a generic remote desktop server.

## Task 1: Verify Desktop capabilities and produce evidence

**Files:** Read `src/server/codex/*.ts`, `tests/codex-*.test.ts`, `docs/codex-telegram.md`; create `docs/codex-mobile-capabilities.md`. Create a redacted fixture under `tests/fixtures/codex-mobile/` only after observing the real schema.

- [x] Record installed Desktop version and existing IPC initialization/snapshot versions. Inspect installed application code read-only for exact supported request names and payload shapes. Do not read or print credentials or dump private conversation databases.
- [x] Run existing bridge tests to establish a baseline:

  ```sh
  node --import tsx --test tests/codex-*.test.ts tests/telegram*.test.ts
  ```

  Expected: tests pass. Socket-binding restrictions are environment failures to resolve/report, not evidence that a capability works.

- [x] Produce a capability table with columns: operation, actual method/schema, read or mutation, version, test fixture, live evidence, limitations, pass/fail. Cover project ordering/identity, all chat pages, old/unloaded chat opening, archived and child conversations, remote-host entries, history pagination, streaming, creation, turn start, steering, stop, and receipt reconciliation.
- [ ] Verify read operations against Desktop-visible counts/identities without persisting titles or transcripts. Do not infer a project list solely from recent chat working directories. Include an empty project and same-name project identities.
- [ ] Derive schemas from installed code/observed responses, redact samples with synthetic IDs and text, then add fixture parsing tests. Reject unknown versions instead of coercing them into the supported shape.
- [ ] For mutation evidence, use a disposable existing project and an explicitly authorized benign task. Record only synthetic IDs, timestamps, resulting state, and outcome. Check new-chat visibility in Desktop; continuation in the same chat; active-turn conflict; stop; unloaded chat ownership; and lost-ack reconciliation. Do not probe mutations on normal work chats.
- [x] Document the absence of an atomic expected-turn or idempotency mechanism if absent. A local mutex cannot eliminate races with Desktop users. Any inability to preserve steering semantics blocks that feature until a safe UX/protocol revision is approved.
- [ ] Mark the gate PASS only when each required operation is proven. Otherwise record the specific BLOCKED capability and the smallest proposed revision. No relay/UI implementation proceeds on a guess.

**Review:** Read the report against every behavior in the spec. Never claim “all chats” when only owned recent chats work. The plan does not authorize fallback to a separate CLI daemon.

## Task 2: Freeze application contracts and limits

**Create:** `src/shared/codex-mobile.ts`, `tests/codex-mobile-contracts.test.ts`.

- [ ] Write table-driven failing tests for unknown operations/fields, malformed UUIDs, missing identities, wrong expected-state variants, overlong text, oversized frames, and foreign cursors.
- [ ] Define the discriminated application contract with these semantics (Desktop method mapping comes only from Task 1):

  ```ts
  type SubmitTarget =
    | { kind: 'new'; projectId: string }
    | { kind: 'idle'; chatId: string }
    | { kind: 'active'; chatId: string; expectedTurnId: string };
  type SubmissionState =
    | 'prepared' | 'dispatching' | 'accepted' | 'rejected' | 'uncertain';
  type ConnectionState =
    | 'connected' | 'mac-offline' | 'codex-unavailable'
    | 'incompatible' | 'reconnecting' | 'relay-unavailable';
  ```

  Envelopes require protocol version 1, UUID request ID, opaque device ID, connection generation, operation, and deadline. Mutations add UUID submission ID. The authenticated server supplies user identity; never trust a client-claimed user ID.

- [ ] Implement strict Zod schemas and server-owned DTO projection. Define opaque cursor validation tied to user/device/query. Return bounded pages of at most 50 items, a next cursor, and explicit unsupported item/capability flags.
- [ ] Enforce the spec's frame/text/rate limits on both peers. Errors use stable codes: `unauthorized`, `offline`, `unsupported`, `conflict`, `expired`, `invalid`, `rate-limited`, `uncertain`. Do not return raw Desktop exceptions.
- [ ] Run RED, then GREEN:

  ```sh
  node --import tsx --test tests/codex-mobile-contracts.test.ts
  npm run typecheck
  ```

  Expected: rejected payload tests and valid round trips pass; no private IPC DTO reaches the UI unfiltered.

## Task 3: Implement verified catalog/history adapter

**Create:** `src/server/codex/mobile/{catalog,history,capabilities}.ts`, `tests/codex-mobile-catalog.test.ts`, `tests/codex-mobile-history.test.ts`.
**Modify only as needed:** `src/server/codex/{threads,bridge,ipc}.ts`.

- [ ] Write failing tests using Task 1 fixtures for multiple pages, equal timestamps, duplicate names, empty projects, archived/unloaded chats, child context, and unsupported remote entries.
- [ ] Run the tests and confirm failure is a missing implementation, not a broken fixture.
- [ ] Implement verified read calls through injected transport interfaces. Resolve resource IDs against Desktop; never accept arbitrary client filesystem paths. Keep existing approval discovery unchanged until regressions prove compatibility.
- [ ] Write failing tests for history gaps, duplicate stream events, unsupported content, reconnect revision resets, and unknown protocol versions.
- [ ] Implement history projection and on-demand subscriptions. Refresh on revision gaps; release subscriptions when a chat closes. Preserve chronological order without loading every transcript.
- [ ] Run `node --import tsx --test tests/codex-mobile-catalog.test.ts tests/codex-mobile-history.test.ts tests/codex-bridge.test.ts tests/codex-threads.test.ts`. Expected: all pass with synthetic data; no transcript logging.

## Task 4: Add local submission ledger and Desktop operations

**Create:** `src/server/codex/mobile/{store,submissions,operations}.ts`, `tests/codex-mobile-submissions.test.ts`.

- [ ] Write failing restart/crash tests around intent persistence, dispatch, Desktop acceptance, and acknowledgment. Include two simultaneous sends, duplicate IDs with different text, state transition during dispatch, partial chat creation, and an uncertain retry.
- [ ] Implement a local SQLite table with unique submission IDs, operation, destination IDs, keyed digest, connection generation, state, timestamps, and resulting IDs. No task-body column. Store the digest key outside the database in protected local credentials. Test schema migrations on a temporary database.
- [ ] Implement this dispatch sequence: authenticate; validate resource/state; acquire chat mutation lock; recheck state; persist intent; mark dispatching; invoke verified Desktop operation; persist accepted/rejected receipt. On ambiguous failure persist uncertain.
- [ ] Reconcile uncertain entries only with Task 1's proven identity mechanism. Without proof, return uncertain and disable automatic resend. On startup, convert interrupted dispatching entries to uncertain; never execute prepared/dispatching rows as a backlog.
- [ ] Create-chat receipts retain the created chat ID even if first-turn dispatch fails. A retry may continue that chat only after resolved status and explicit user action; it must not create another chat silently.
- [ ] Add target storage with a monotonic revision. Compare revisions on target changes; capture chat ID/revision when ingesting a bot message. Clear target/session state on unpair.
- [ ] Run `node --import tsx --test tests/codex-mobile-submissions.test.ts`. Expected: one dispatch for a known duplicate; zero dispatches for stale/conflicting/unauthorized submissions; uncertain requests never auto-replay.

## Task 5: Build isolated relay authentication and routing

**Create:** `src/relay/{auth,devices,router,connection,server}.ts`, `tests/relay-auth.test.ts`, `tests/relay-routing.test.ts`, `tests/relay-privacy.test.ts`.
**Modify:** `package.json`, `package-lock.json`, `tsconfig.json` for a separate relay entry/check/build and chosen WebSocket dependency.

- [ ] Verify current official Telegram third-party signature instructions and the selected WebSocket library documentation. Implement Telegram's exact canonicalization/signature rules; do not invent a custom signature format.
- [ ] Write failing authentication tests for tampered launch data, duplicate query keys, wrong bot ID, expired/future auth timestamps, unpaired users, revoked devices, reused pairing codes, and cross-device routing.
- [ ] Implement a maximum five-minute launch-data age, thirty-second clock skew allowance, and fifteen-minute in-memory session. Reauthentication is required after expiry. One-use pairing codes expire in five minutes. Authenticate device challenges with its registered public key; never place credentials in URLs.
- [ ] Implement one active device connection per pairing generation, explicit replacement/revocation, request deadlines, five-second heartbeats, fifteen-second liveness timeout, per-user rate limits, and schema checks on both directions.
- [ ] Set `Cache-Control: no-store`, restrictive CORS/origin checks, secure session handling, and WebSocket origin checks. Route only the enumerated contract; reject arbitrary method names, URLs, and local API routes.
- [ ] Write privacy tests using a unique fake transcript marker. Exercise success, error, timeout, and disconnect; assert the marker is absent from persistent metadata, captured logs, error telemetry, and caches.
- [ ] Bound in-memory response/subscription buffers; disconnect a slow consumer and require resync instead of persisting an unbounded backlog. Clear buffers on session expiration/revocation.
- [ ] Run `node --import tsx --test tests/relay-*.test.ts` and `npm run typecheck`. Expected: authentication/routing/privacy tests pass without contacting Telegram or a real relay host.

## Task 6: Connect the Mac and relay

**Create:** `src/server/codex/mobile/connector.ts`, `tests/codex-mobile-connector.test.ts`.
**Modify:** `src/server/codex/service.ts`, `src/server/index.ts`; add a pairing helper under `scripts/codex-mobile.ts`.

- [ ] Write failing tests for startup-disabled mode, invalid credentials, device revocation, reconnect generations, expired commands, relay outage, Desktop outage, incompatible Desktop, and shutdown during dispatch.
- [ ] Implement outbound WSS with device authentication, bounded exponential reconnect backoff, and graceful cancellation. Separate Desktop readiness from relay reachability. Do not accept mutation commands while either is unhealthy.
- [ ] Add an opt-in mobile flag and relay URL/private-key configuration names to the ignored local environment workflow. `.env.example` contains names only. Keep existing bot behavior unchanged when mobile is disabled.
- [ ] Implement local pairing/revocation commands through the current authenticated local control pattern. Output only short-lived pairing instructions/status, never private keys or bot tokens.
- [ ] Run `node --import tsx --test tests/codex-mobile-connector.test.ts tests/codex-service.test.ts tests/codex-http.test.ts`. Expected: existing service behavior passes and no public listener is added to the Mac.

## Task 7: Extend bot routing without breaking approvals

**Create:** `src/server/codex/mobile/bot-router.ts`, `tests/codex-mobile-bot.test.ts`.
**Modify:** `src/server/telegram.ts`, `src/server/codex/service.ts` through an optional Codex-only task handler.

- [ ] Write failing tests for unpaired/group messages, no target, stale target, same-name chats, explicit question replies, stale replies, approval text, target change races, startup backlog, reconnect backlog, and duplicate update IDs.
- [ ] Add `/target` and `/new` flows with server-bound opaque button IDs. Bind actions to paired user/private chat, expiry, and target revision. No model call occurs until explicit task submission.
- [ ] Route replies/callbacks through existing pending-request handlers first. Route only eligible nonreply ordinary text to the task handler. Show destination in every accepted/rejected/uncertain receipt.
- [ ] Implement serialized update ingestion and backlog rejection through a high-water mark plus ready-time boundary. If freshness is uncertain, reject and request a newly sent message. Never turn the existing alert retry outbox into a task outbox.
- [ ] Preserve the single local Codex poller, token isolation, and existing question/approval controls. Document that offline bot rejection is delayed until Mac recovery; the native composer cannot be disabled.
- [ ] Run `node --import tsx --test tests/codex-mobile-bot.test.ts tests/telegram*.test.ts tests/codex-requests.test.ts tests/codex-async-questions.test.ts`. Expected: all regressions pass; permission text cannot become an approval or unintended task.

## Task 8: Build the approved Mini App flow

**Create:** `mobile.html`, `vite.mobile.config.ts`, `src/mobile/{main,App,Projects,Chats,Conversation,ConnectionStatus}.tsx`, `src/mobile/{api,store}.ts`, `src/mobile/styles.css`, `tests/e2e/codex-mobile.spec.ts`.
**Modify:** `package.json` and browser fixture/config files as needed for an isolated mobile build.

- [ ] Write browser tests before UI code: project → older chat → history; project → new task; idle follow-up; active steering; explicit target selection; browsing does not change target.
- [ ] Build the four approved screens using shared contract DTOs. Keep navigation and draft state in memory, show current project/chat in the composer, and label loaded-only search. Add archived/outside-project entry points.
- [ ] Implement loading, empty, unauthorized, unsupported, disconnected, and uncertain-delivery states. Only verified Desktop acceptance shows “Sent”; network success alone is insufficient.
- [ ] Add Stop tied to the captured active turn. If active state changes, refresh and require a fresh action rather than targeting a different turn.
- [ ] Render streamed Markdown safely; unsupported items remain visible as labels. Bound rendering/history pages. Reconnect refreshes state and reconciles submissions before enabling Send.
- [ ] Test 390×844 and narrow 320-pixel screens, keyboard/safe-area behavior, accessible labels/focus, multiline text, long titles, and malicious Markdown URLs. Do not reproduce Desktop's entire settings surface.
- [ ] Run `npm run test:e2e -- tests/e2e/codex-mobile.spec.ts`, `npm run typecheck`, and the new `npm run build:mobile` script. Expected: phone flows pass against fake relay/Desktop; no live task is dispatched.

## Task 9: Integration, privacy, and regression gate

**Create:** `tests/codex-mobile-integration.test.ts`; extend relevant relay/phone fixtures.

- [ ] Connect fake Desktop, real local connector/relay transport, and browser fixtures. Test paired identity end-to-end instead of stubbing authentication out of every layer.
- [ ] Inject disconnect immediately before dispatch, after Desktop acceptance, and during streaming. Verify no silent duplicate and correct uncertain/reconnecting UI.
- [ ] Simulate sleep/wake and accumulated Telegram updates. Verify stale messages never start tasks; a newly sent post-recovery message can execute once.
- [ ] Test revocation during a live subscription and a pending mutation. Late responses must not reach the revoked session. Validate origin/auth boundaries and content-free logs under failures.
- [ ] Run the project gates:

  ```sh
  npm test
  npm run test:coverage
  npm run typecheck
  npm run build
  npm run build:mobile
  npm run test:e2e
  ```

  Expected: all suites pass and overall line coverage is at least 80%, including relay/mobile logic in the configured scope. No lint script currently exists; report this. Run a dependency audit after adding transport dependencies. Investigate failures rather than weakening security tests.

## Task 10: Phone acceptance and operational handoff

**Update:** `docs/codex-telegram.md`, `docs/prototype.md`, `README.md`, `.env.example`, `wiki/modules/Telegram Notifications.md`, `wiki/flows/Telegram Notification Flow.md`, `wiki/decisions/Codex Telegram Mobile.md`, `wiki/overview.md`, `wiki/index.md`, `wiki/hot.md`, `wiki/log.md`.

- [ ] Prepare a hosting configuration with HTTPS/WSS, no payload logging, no response caching, metadata-only backups, restricted operator access, and bounded resource usage. Deployment/BotFather updates require explicit authorization; planning is not deployment approval.
- [ ] Verify a real Telegram launch and server-side signature validation. Confirm the relay has no bot token and the Mac remains the sole poller.
- [ ] With an authorized benign disposable task, verify phone creation, Desktop visibility, continuation, steering, stop, explicit bot routing, Desktop-first approvals, sleep/offline display, delayed backlog rejection, and safe recovery.
- [ ] Capture a redacted acceptance checklist with tested versions and failures. Do not save private phone screenshots/transcripts in the repository.
- [ ] Publish setup, unpair/revoke, credential rotation, disable/rollback, Desktop-update compatibility, and uncertain-delivery recovery instructions in project docs. Disable the mobile flag to roll back without removing existing approval support.
- [ ] Mark wiki behavior implemented only after verification. Update the existing wiki indexes and hot/log pages; preserve raw snapshots. Record completed changes with the required wiki helper. Report any helper failure.
- [ ] Review the final diff and report changed behavior, tests, coverage, live checks, and remaining limits. Do not commit/push unless asked.

## Plan self-review

Coverage mapping: catalog/history → Tasks 1–3; creation/continuation/steering/stop and duplicate safety → Tasks 1, 4, 8–9; relay privacy/auth → Tasks 5–6, 9; bot target/offline backlog/approval separation → Task 7; phone layout and connection states → Task 8; deployment/operations/docs → Task 10.

No private Desktop method is asserted without evidence. All new file names above are proposed implementation ownership, not claims that files already exist. Later adapter code must be derived from Task 1; the plan is not permission to guess a missing protocol. No implementation or live verification was performed while writing this plan.
