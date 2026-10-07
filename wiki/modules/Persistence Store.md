---
type: module
title: "Persistence Store"
path: "src/server/store.ts"
status: active
language: typescript
purpose: "Persist runs and event journal in SQLite"
created: 2026-10-07
updated: 2026-10-07
tags: [module, sqlite]
---

# Persistence Store

`Store` uses Node's `DatabaseSync` with `runs` and `events` tables. A run is stored as JSON; events are separate ordered rows. `createRun` and `updateRun` write state and its event in one transaction. Updates increment the run version and timestamp. Subscribers receive the event after commit, which feeds [[Session and API Flow]].

The database is `.power-agents/state.sqlite` in normal use. The exclusive lock permits one server process for this project directory. The test suite uses `:memory:` stores. See [store](../../src/server/store.ts) and [store tests](../../tests/store.test.ts).
