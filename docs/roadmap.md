# Power Agents roadmap

Updated: 2026-10-23.

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
| 3 | A reviewer's remark reaches the author, who revises; the final cites the revision | Partial: the leader re-synthesizes, task owners never rework |
| 4 | Independent tasks run in parallel; dependent tasks wait | Done |
| 5 | Messages to a busy participant are queued; delivery states are visible | Done |
| 6 | A changed shared decision triggers rework of affected tasks | Missing: no shared decisions store |
| 7 | Redelivery creates no duplicate task, message or parallel turn | Mostly done |
| 8 | Restart keeps state; an unknown outcome is shown, not repeated | Partial: resuming may repeat an unfinished call |
| 9 | Pause stops new turns; stop is shown only after confirmation | Done |
| 10 | Errors show a clear reason and next step | Done; 2026-10-23 |
| 11 | Document tasks without Git; code tasks in separate worktrees | Half: documents only |
| 12 | Identity is checked by the platform; keys never leak | Partial: keys stay server-side; no tool-level identity |

## Milestones

### M1 — Finish the core loop (criteria 3, 6, 8)

1. A reviewer's `changes_requested` remarks go to the owners of the affected tasks,
   who revise their work before the leader re-synthesizes.
2. A shared facts board: owners publish values (prices, names, terms); other
   participants read them from context instead of asking repeatedly.
3. Resume after a restart never silently repeats a call whose result may already exist.

Done when a live three-provider run shows a review remark reaching a task owner,
a revised task result cited in the final document, facts read from the board, and
a mid-run restart that resumes without repeating a finished call.

### M2 — Real output (criterion 11)

Agents write files in their run workspace. Code tasks run in separate git
worktrees and produce one merged result branch without touching the user's branch.

Done when a live run delivers a small code change on a result branch whose tests pass.

### M3 — Team tools (criteria 2 and 12 in depth)

A local MCP server gives CLI agents team tools (message, publish, request review)
with identity checked by the platform rather than by message text.

Done when a live run uses the tools and an impersonation attempt is rejected.

## Backlog

- Saved team presets.
- Search across all run history.
- CI housekeeping: Node 20 action deprecation, client bundle size warning.
- Live test of OpenAI and Anthropic API participants (needs a valid key in `.env`).
