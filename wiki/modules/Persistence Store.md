---
type: module
title: "Persistence Store"
path: "src/server/store.ts"
status: active
language: typescript
purpose: "Persist runs and event journal in SQLite"
created: 2026-10-07
updated: 2026-10-30
tags: [module, sqlite]
---

# Persistence Store

Flows use separate `flows` JSON rows and `node_runs` execution metadata (node/version, input hash, timing, status and error). `updateFlow` increments the flow version transactionally and notifies flow subscribers after commit. Recovery queries unfinished flows/history without API response limits. Current node output lives in flow JSON; output-history rollback remains planned. See [[Flow Engine]].

`Store` uses Node's `DatabaseSync` with `runs` and `events` tables. A run is stored as JSON; events are separate ordered rows. `createRun` and `updateRun` write state and its event in one transaction. Updates increment the run version and timestamp. Subscribers receive the event after commit, which feeds [[Session and API Flow]].

Indexed queries return pages of lightweight run summaries and event history. The engine queries active runs directly instead of parsing the entire run history on each scheduler tick. Full run JSON remains available by ID.

The store also keeps Telegram pairing state, alert preferences, a polling offset, and an outbox. Entering `awaiting_approval` or `completed` inserts an outbox row in the same transaction as the run transition, if a recipient is paired and that alert is enabled. [[Telegram Notifications]] sends and retries those rows after commit.

The database is `.power-agents/state.sqlite` in normal use. The exclusive lock permits one server process for this project directory. The test suite uses `:memory:` stores. See [store](../../src/server/store.ts) and [store tests](../../tests/store.test.ts).

The offline [[Backup and Restore Flow]] captures the database and run workspaces, verifies SQLite and checksums, and refuses to overwrite existing state. `.env` and service logs are excluded. The backup itself contains private run and workspace content.
