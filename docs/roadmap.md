# Power Agents roadmap

Updated: 2026-10-28 (M1–M3 accepted; M4 Speed started).

## North star

A reliable text and document team on one Mac first, then real file and code output.
The [platform design](superpowers/specs/2026-10-07-agent-team-platform-design.md)
remains the source of intent; this roadmap orders the remaining work.

## How work is chosen

- Work happens in milestones. Each milestone ends with a live Codex + Claude Code +
  Gemini run that serves as its acceptance test.
- Bugs found during a milestone are fixed inside that milestone.
- Backlog items are picked up only between milestones.
- Every new request is placed in a milestone or the backlog before work starts.

## Status against the design's acceptance criteria

| # | Criterion | Status |
| --- | --- | --- |
| 1 | No main work before plan approval | Done |
| 2 | Agents exchange material across providers without the user | Done; live run on 2026-10-23 |
| 3 | A reviewer's remark reaches the author, who revises; the final cites the revision | Done; live acceptance 2026-10-26 |
| 4 | Independent tasks run in parallel; dependent tasks wait | Done |
| 5 | Messages to a busy participant are queued; delivery states are visible | Done |
| 6 | A changed shared decision triggers rework of affected tasks | Done in code (2026-10-26): tasks list the facts they use; a changed fact reopens finished tasks that used the old version |
| 7 | Redelivery creates no duplicate task, message or parallel turn | Mostly done |
| 8 | Restart keeps state; an unknown outcome is shown, not repeated | Done; live acceptance 2026-10-26 |
| 9 | Pause stops new turns; stop is shown only after confirmation | Done |
| 10 | Errors show a clear reason and next step | Done; 2026-10-23 |
| 11 | Document tasks without Git; code tasks in separate worktrees | Done; live acceptance 2026-10-26 |
| 12 | Identity is checked by the platform; keys never leak | Done; live acceptance 2026-10-26 (Gemini without team tools) |

## Milestones

### M1 — Finish the core loop (criteria 3, 6, 8)

1. Done in code on 2026-10-23: a reviewer's `changes_requested` remarks go to the owners of the affected tasks,
   who revise their work before the leader re-synthesizes.
2. Done in code on 2026-10-23: a shared facts board: owners publish values (prices, names, terms); other
   participants read them from context instead of asking repeatedly.
3. Done in code on 2026-10-26: resume after a restart never silently repeats a call whose result may already exist.

Done when a live three-provider run shows a review remark reaching a task owner,
a revised task result cited in the final document, facts read from the board, and
a mid-run restart that resumes without repeating a finished call.

**Accepted on 2026-10-26** (run `10db85ce`). A restart during three parallel tasks listed
all three calls as outcome unknown; an unconfirmed resume was refused and a confirmed one
continued. The first review sent a remark on the syrup yield to Claude's recipe task;
Claude revised it and changed the syrup fact from 36 g to 33 g (v2); Codex re-costed in
the next synthesis; the final uses 33 g and the second review passed. All 20 short facts
on the board (33 total, from all three providers) appear in the final.

Follow-ups found by the acceptance run:

- Fixed 2026-10-26: a changed fact now reopens tasks that used it (criterion 6).
- Fixed 2026-10-26: synthesis and review calls get 15 minutes instead of 5.
- Fixed 2026-10-26: up to 40 facts per answer instead of 12.

### M2 — Real output (criterion 11)

Agents write files in their run workspace. Code tasks run in separate git
worktrees and produce one merged result branch without touching the user's branch.

Done when a live run delivers a small code change on a result branch whose tests pass.

**Accepted on 2026-10-26.** Files run `ec0727e0`: Claude, Codex and Gemini each saved their
Markdown file in their task folder (`recipe.md`, `pricing.md`, `promo.md`) and the final lists
all three. Code run `5cc8a064` on a small Node demo repo with a failing test: Claude
implemented `menuPrice` in `src/price.js`, Gemini documented it in `README.md`; both task
branches merged into `power-agents/5cc8a064/result`, the platform's `npm test` check passed
(2/2), the user's `main`, HEAD and working tree were unchanged, and the worktrees were removed.

Found on the way and fixed: CLI conversations are kept per folder; the task prompt requires
saving named files; writes outside the folder and terminal commands that a CLI denies are
retried once with a hint. Leader conflict resolution is covered by tests; no live run has
produced a conflict yet.

### M3 — Team tools (criteria 2 and 12 in depth)

A local MCP server gives CLI agents team tools (message, publish, request review)
with identity checked by the platform rather than by message text.

Done when a live run uses the tools and an impersonation attempt is rejected.

**Accepted on 2026-10-26** (run `99c6c723`). Claude and Codex used the team tools mid-turn
(39 calls: status, inbox, messages, facts), each logged with the calling member. Probes during
and after the run were refused: no token and a forged token (401), a browser `Origin` and a
foreign `Host` (403). Gemini works without team tools: agy allows MCP tool calls only through
its global settings, which the platform does not change.

Found on the way: Codex had the tools but answered at once while the prompt opened with
"answer only with JSON"; tool users' prompts now open with the tool step.

### M4 — Speed

Runs finish faster without losing quality. Baseline from live runs since 2026-10-20
(average / slowest turn): synthesis 124 s / 419 s, task 57–82 s / ~540 s, review 46 s / 85 s,
plan 39 s / 53 s. A three-provider document run took 11–13 minutes end to end.

Done when the same three-provider document run (same goal as `99c6c723`) completes with
review passed in clearly less time than the baseline, with no answer repeats in synthesis
or review.

- Done 2026-10-28: synthesis, review and conflict-resolve turns no longer get team tools, and
  messages in their answers are dropped instead of repeating the turn (two of the last three
  Codex syntheses were repeated for this, about a minute each).
- Measured 2026-10-28 from CLI transcripts: the slowest turns are Codex waits before any
  output (414 s for a 503-token synthesis, 180 s before a task's first tool call), while a
  normal synthesis writes about 4,000 tokens in 80 s. The cause is not in Codex's logs and
  is likely on the provider side. Claude wrote each saved document twice, into the file
  (~30 s) and again as the full text in its answer (~22 s).
- Done 2026-10-28: saved task files are attached to the result by the platform (up to 40 KB
  of text per task) and agents no longer repeat their text in the answer.
- Done 2026-10-28: a Codex turn that prints nothing for 150 s is stopped and repeated once,
  unless it already used a team tool (a repeat could send a message twice). Across 109 live
  Codex turns normal silences stayed under 95 s; the 4 stalls ran 180–414 s.
- Measured 2026-10-28 from agy logs (82 Gemini turns): startup before the first model call
  takes a median 10 s (max 25 s, 18.6% of Gemini time) — agy starts a language server and
  signs in on every turn. Almost all the rest is one model call: "Gemini 3.8 Flash (High)",
  the agy default since 2026-10-22, median 39 s (p90 120 s). Older "Flash (Low)" turns took a
  median 14 s, but on simpler early runs, so the two are not comparable. No code change: the
  model can already be set per member when creating a run.
- Acceptance run `958811b4` on 2026-10-28 (baseline goal, Gemini on `gemini-3.8-flash-low`):
  completed, review passed first time, about 7.5 minutes of active time against 12.5 for the
  baseline. Gemini's one task took 28 s and its promo section (4.5k characters, against 14.6k
  in the baseline) met every requirement; Gemini's saved `promo.md` was attached by the platform.
  Found and fixed in the run: the first synthesis asked Claude for fixes instead of combining;
  dropping its messages left no final document and paused the run. A synthesis with no document
  is now repeated once with a hint, and the run was resumed. One review answer was repeated
  because Claude sent `artifact` as a string (also seen in run `ec0727e0`).
- Done 2026-10-28: a plain-text `artifact` is taken as the body instead of repeating the turn.
- Live run `619723ae` on 2026-10-28 (same goal as `99c6c723`): completed, second review passed,
  no answer repeats. Plan to first review verdict took about 8.5 minutes of active time
  (baseline 12.5 minutes to its single passing review); synthesis 85 s and 57 s (baseline 141 s
  with a repeat), review 62 s and 44 s. The first review caught a real cost error (975 → 875 ₸),
  which added one 2 min 43 s rework round. Claude's saved `recipe.md` reached later turns
  through the attached file text. Not a clean acceptance: the Claude CLI sign-in failed at the
  start, the run was paused 2 min 13 s and resumed, and no Codex stall happened this time.

## Backlog

- Saved team presets.
- Search across all run history.
- CI housekeeping: Node 20 action deprecation, client bundle size warning.
- Live test of OpenAI and Anthropic API participants (needs a valid key in `.env`).
