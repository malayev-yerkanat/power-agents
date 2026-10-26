---
type: module
title: "Orchestration Engine"
path: "src/server/engine.ts"
status: active
language: typescript
purpose: "Schedule plan, task, reply, synthesis, and review turns"
created: 2026-10-07
updated: 2026-10-22
tags: [module, orchestration]
---

# Orchestration Engine

`Engine` owns the run lifecycle. `create` validates the team and starts planning. `approve` checks plan version and releases tasks. `control` pauses, resumes, or cancels. `message` queues user feedback and can trigger replanning.

Its scheduler limits active turns to three and prevents two concurrent turns for one participant. Task turns wait for dependencies. Once tasks and requests finish, the leader synthesizes and another participant reviews. Results pass through the schemas in `src/server/core/` before they change state. State changes go through [[Persistence Store]].

The scheduler queries indexed active runs instead of parsing every historical run on each tick. Restart recovery uses the same active-run query.

`promptFor` in `src/server/core/prompts.ts` sends each turn a trimmed run: a task sees its dependencies' latest results, synthesis sees every task's latest result plus the latest final and review, and review sees the latest final. Each document appears once, and messages are limited to the participant's own correspondence and user notes. The 300,000-character per-turn cap remains a safety net.

A failed task or reply turn marks only its task `failed`, with an error prefixed by the participant's name and an `error` event whose actor is that participant; other turns keep running. When nothing else can progress, the run pauses and lists the failed tasks. Resume retries only failed work, and a task with its own unanswered question returns as `waiting`. Plan, synthesis and review failures still pause the run at once.

The plan prompt prefers parallel tasks and names an owner for each shared fact; task turns ask the owner instead of inventing it. A question to a participant with its own unanswered question is held until that participant has its answer, so owners do not reply with guesses; if nothing else is running and no task has failed, the oldest held question is delivered to avoid mutual waits. A reply that also asks something keeps its answer, and its questions are delivered as notes. `protocol.ts` treats `null` optional fields as absent, reports schema failures as one readable line, and keeps text that follows a complete JSON answer by appending it to the summary. Every rejection of an answer is an `AnswerFormatError`; the engine retries such a turn once in the same session, placing the reason before the context block and logging a `format_retry` event. A second rejection fails the turn as usual. The plan prompt tells the leader not to add assembly, overall review or final-polish tasks, because synthesis and review run automatically after all tasks.

A `changes_requested` review may list `revisions` (task ID plus remark). Those tasks return to `pending`, their owners get the remark as a note, and the run goes back to the task phase; synthesis repeats only after they finish. Without revisions the leader re-synthesizes as before. A revision for an unknown task is an `AnswerFormatError`.

Runs keep a shared facts board (`Run.facts`, type `SharedFact`). Any answer may publish `facts`; the first publisher owns a key (matched case- and space-insensitively), only the owner can change it, and each change raises its version. A non-owner change is an `AnswerFormatError`, so the agent is asked again. Every turn sees the board in its context.

A task answer with status `waiting` and no open question is accepted while another task is still unfinished; the task wakes when a note is sent to its owner or another task completes. If nothing is running and no question is queued, stranded waiting tasks fail so «Продолжить» retries them.

Each launched call is recorded in `Run.inFlight` and removed by the change that finishes it (result, superseded stage, task failure); pause, cancel and run-level failure clear the list. On startup any remaining calls move to `Run.interrupted`: their tasks fail with "исход неизвестен", the pause message names each call, and `control(id, "resume")` refuses until called with `confirmRepeat` (the Continue button asks first). Agents never see these fields.

The engine limits runs to 100 turns and tasks to 20 turns. See [engine](../../src/server/engine.ts), [protocol](../../src/server/core/protocol.ts), and [[Data Flow]].
