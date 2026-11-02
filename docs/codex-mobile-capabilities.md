# Codex Desktop mobile capability verification

Date: 2026-10-31
Gate result: **BLOCKED — the approved full Desktop mirror cannot proceed through the verified connector transport.**

Follow-up: [shared-server research](codex-mobile-shared-server-research.md) found a different transport candidate. The documented App Server successfully listed existing projects/chats, and two clients shared a private Unix socket. Desktop relaunch/tool parity remains unverified. The blocked result below applies to the original follower transport; it does not establish that Telegram integration is impossible.

This report completes the initial investigation, not the full capability acceptance suite. No mobile adapter, relay, bot task router, or Mini App has been implemented. Required mutation tests were not attempted because catalog/creation access and race-safe steering have not passed the transport gate.

## Environment and evidence

- Application: `/Applications/ChatGPT.app`, bundle ID `com.openai.codex`.
- Application version: `26.1027.30824`, build `22943`.
- Bundled CLI package: `0.166.0-alpha.5.1`, from `Contents/Resources/codex-cli/codex-package.json`. This is newer than the version recorded in the existing Telegram setup guide; that guide's original verification is not evidence for all capabilities in this build.
- `Contents/Resources/app.asar` SHA-256: `36bf3d2b35e95e11852074b9ca9459b89efbecd6b8311345d060cf66de8f0ba6`.
- Private IPC: the existing user-owned socket under `~/.codex/ipc/ipc.sock`; initialization version 0. Source reads and probes did not change Desktop files or databases.
- Existing focused baseline: **80 tests passed, zero failed**, using `node --import tsx --test tests/codex-*.test.ts tests/telegram*.test.ts`. Initial sandbox execution failed to bind fixture sockets; rerunning with local socket permission passed.
- Live read-only probe: initialization succeeded; existing ID-only discovery returned 100 IDs. Of the first three owner-discovery attempts, one succeeded and two did not return a usable owner. This is a bounded sample, not proof that the two chats can never be opened.
- Live read-only subscription to the reachable owner received a snapshot with version **11**, a conversation-state object, `turns` and `requests` arrays, and `turnHistory.kind = canonical`. The probe unsubscribed and closed. No transcript contents, user IDs, chat IDs, paths from snapshots, or answers were printed or persisted.

## Transport distinction

The local IPC broker is a generic request router, but that does not make every Desktop internal method remotely callable. Desktop explicitly registers owner discovery and a finite set of follower operations. The registration function `dQ` is in `/.vite/build/early-bootstrap-339-aea964a206c655e4.js`, character offset 1,131,344 in the inspected archive entry. It includes start, complete-history load, compact, steer, interrupt, settings, model settings, edit-last-turn, approvals, questions, and queued-follow-up operations. It does not register project listing, thread listing, or thread creation.

The same asset's broker routing at offsets approximately 1,114,667–1,116,322 and exact-version handler checks around 1,124,995/1,125,688 corroborate the boundary. Offsets are inspection aids for this exact archive hash, not stable API identifiers.

## Capability matrix

“Source only” means installed code evidence, not live mutation verification. “Not exposed” refers to the inspected follower socket registration, not a claim that Desktop's own UI cannot perform the action.

| Required operation | Observed interface | Evidence | Result and limitation |
| --- | --- | --- | --- |
| Connect and discover owner | `initialize` v0; `thread-owner-discovery` v1 with `hostId`, `conversationId` | Source and live read-only probe | PASS for sampled reachable owner; does not load an unowned chat |
| Existing project catalog/order, including empty projects | Internal `project/list` exists in app-server bridge | Source only; no follower socket handler | BLOCKED for external connector; recent chat directories are not an equivalent project catalog |
| All chats with pagination | Internal `thread/list` exists | Source only; no follower socket handler | BLOCKED; current repository query is capped at 100 recent nonarchived top-level IDs |
| Archived, old/unloaded, child, remote-host chats | Internal thread read/list paths exist; follower requires owner | Source only; partial owner sample | NOT VERIFIED; no claim of full coverage, project count parity, or remote-host support |
| Read followed chat and stream state | `thread-stream-following-changed` v1; snapshot `thread-stream-state-changed` v11 | Source plus live metadata-only observation | PASS for snapshot availability on one owned local chat; full transcript mapping is untested |
| Complete history | `thread-follower-load-complete-history` v1 | Registered handler; source only | Available candidate for owned chat; no bounded paginated history API established and no live load performed |
| Create Desktop chat in existing project | Desktop internal creation helpers/app tools | No follower socket create handler | BLOCKED; no verified background-service route |
| Start an idle chat turn | `thread-follower-start-turn` **v2** | Source only | Candidate for owned chat; existing adapter hardcodes v1 for non-initialize requests, so it cannot be reused unchanged; no mutation test |
| Steer captured active turn | `thread-follower-steer-turn` v1 | Source handler forwards no caller `expectedTurnId`; owner chooses current active turn | BLOCKED against approved expected-turn contract; read-before-send is not atomic |
| Stop captured active turn | `thread-follower-interrupt-turn` **v4** | Source handler supports expected-turn binding; source only | Candidate; existing v1 adapter is incompatible, and live behavior is untested |
| Reconcile lost acknowledgment | Existing follower responses/state observations | No caller idempotency/reconciliation contract proven | NOT VERIFIED; cannot claim exactly-once execution or safely retry uncertain submissions |

No synthetic full-conversation fixture was created: only metadata was retained from the live snapshot, and copying a private transcript merely to fabricate a fixture would not add evidence. Existing protocol tests remain the regression baseline. Future fixtures must derive from verified sanitized schemas, not guessed API names.

### Observed payload shapes and fixture status

These are field shapes observed in installed code, not complete validated public schemas. Versions apply to the inspected local follower transport; host-scoped forwarding may use different versions. All new mobile fixtures remain **not created** because the gate failed. Existing test coverage is listed separately from live evidence.

| Operation | Read/mutation | Observed payload/result shape | Version / fixture evidence |
| --- | --- | --- | --- |
| Initialize | Read/connection | `{clientType}`; result includes `{clientId}` | v0; existing `tests/codex-ipc.test.ts`, live handshake |
| Owner discovery | Read | `{hostId, conversationId}`; successful envelope identifies `handledByClientId` | v1; existing IPC/bridge tests, live sample |
| Follow snapshot | Read/subscription | `{hostId, conversationId, following}`; snapshot `{conversationId, hostId, change:{type:'snapshot', revision, conversationState}}` | Follow v1 / snapshot v11; existing bridge tests; live metadata only |
| Project catalog | Read | Internal `project/list {cursor, limit:100}` | No follower version/schema; no fixture/live catalog verification |
| Chat catalog | Read | Internal `thread/list`; complete input schema not validated | No follower version/schema; no fixture/live catalog verification |
| History read/page | Read | Internal `thread/read {threadId, includeTurns}` and `thread/turns/list {threadId, cursor, itemsView, limit}` | No follower paginated API verified; no mobile fixture |
| Complete history | Read/hydration | Follower `{conversationId}`; result `{revision}` with snapshot broadcast | v1; installed source only; no new fixture/live hydration |
| Create chat | Mutation | No callable follower payload established | No version/schema/fixture; not attempted |
| Start turn | Mutation | Follower `{conversationId, turnStart}`; nested `turnStart` schema not validated for mobile use | v2; source only, no fixture/live mutation |
| Steer turn | Mutation | `{conversationId,input,restoreMessage,serviceTier,attachments,clientUserMessageId,additionalContext,toolOutput}`; no caller `expectedTurnId` forwarded | v1; existing async-question tests are narrower than mobile steering; no mobile fixture/live mutation |
| Interrupt turn | Mutation | `{conversationId, mode, expectedTurnId}`; stale expected turn returns `null` | v4; source only, no mobile fixture/live mutation |
| Reconciliation | Read | No application receipt lookup/idempotency schema established | No version/schema/fixture; not attempted |

Payload source locations: the `916` asset at offsets 840,277 (start), 1,062,734 (steer), 1,064,234 (owner's current-turn selection), 1,245,514 (interrupt), 868,361 (stale interrupt), 1,474,314 (snapshot), 3,185,543 (project list), and 750,594 (thread list). Internal history methods are in the `339` asset around offset 870,690. The method-version map is in `early-bootstrap.js` around offset 175,103. No incomplete source shape above is suitable for implementing a mutation without further validation.

## Alternate app-tools transport

The installed application also contains a native app-tools pipe. Its protocol includes `tools/list`, `tools/call`, and `taskProject/list`. This is **not currently a verified replacement for the connector**:

- The packaged macOS production build enables native peer authorization through `native/browser-use-peer-authorization.node` and `authorizeSocketPeer(fd, false)`.
- `tools/call` requires caller context including `callerSource`, `callId`, `namespace`, `threadId`, `turnId`, `tool`, and arguments. Calls are routed through app/agent context; cancellation can be tied to the caller turn.
- `taskProject/list` requires a nonce and ready executor environment context. It is not a generic unauthenticated project endpoint.
- The tools available to an agent in this chat do not demonstrate that an independent, always-on Mac connector can invoke them legitimately.

Evidence: `/.vite/build/early-bootstrap-916-2f6483d5bfd826f1.js`, peer authorization around offset 257,730; protocol definitions around 260,429–261,738; caller-turn cancellation around 1,761,809; ready executor context around 4,059,103. Production flavor inclusion is defined in `/.vite/build/early-bootstrap.js`.

No peer authorization was bypassed. No nonce/credential was extracted, caller thread was impersonated, active turn was borrowed, or private app-tools operation was executed as a service. No UI automation or separate CLI daemon was substituted for the approved adapter.

## Decision and next action

Tasks 2–10 remain gated. Building them now would encode unsupported full-mirror and steering assumptions. This follows the user's explicit instruction to continue **if verification passes** and the implementation plan's Task 1 stop condition.

The smallest scope revision worth validating is an existing-owned-chat companion: browse a bounded set of reachable chats, read their current state, and send idle follow-ups after proving v2 start behavior. It would omit full project discovery, new-chat creation, and active-turn steering. That is materially less than the approved product and requires the user's choice before proceeding.

To preserve the full approved scope, first obtain a supported authorized Desktop service integration exposing catalog, creation, and atomic turn targeting. The app-tools transport may be investigated further only through a legitimate service authorization mechanism; this report does not claim that such a mechanism is impossible, only that one has not been established. A separate CLI-backed bot would change the source-of-truth requirement and is not an automatic fallback.

References: [design](superpowers/specs/2026-10-31-codex-telegram-mobile-design.md), [implementation plan](superpowers/plans/2026-10-31-codex-telegram-mobile.md), [current Telegram bridge](codex-telegram.md).
