---
type: meta
title: Wiki Log
status: evergreen
created: 2026-10-26
updated: 2026-10-26
tags:
  - meta
  - log
---

# Wiki Log

Newest completed operations appear first.

### 2026-10-26 14:50 UTC - M3 steps 0-2: team tools over MCP

A local MCP endpoint gives agents team tools with one token per turn, so identity comes from the platform; the spike showed Claude and Codex can use it per run and Gemini cannot without global settings.

Note: [[changes/20261026-145008-m3-steps-0-2-team-tools-over-mcp|M3 steps 0-2: team tools over MCP]]

### 2026-10-26 13:47 UTC - M2 acceptance

Live files and code runs passed: all three agents saved files, two task branches merged, the platform's npm test check passed, and the user's branch stayed unchanged. Criterion 11 is done.

Note: [[changes/20261026-134733-m2-acceptance|M2 acceptance]]

### 2026-10-26 11:29 UTC - Gemini terminal commands

Writable turns are told to use file tools instead of terminal commands, and any action a CLI denies is retried once with that hint and reported by name.

Note: [[changes/20261026-112944-gemini-terminal-commands|Gemini terminal commands]]

### 2026-10-26 11:23 UTC - M2 step 5: code-run UI, docs, denied writes

The run form takes an optional git project and check command, the run page shows the result branch and check, and a Gemini write outside its folder is reported and retried once.

Note: [[changes/20261026-112326-m2-step-5-code-run-ui-docs-denied-writes|M2 step 5: code-run UI, docs, denied writes]]

### 2026-10-26 11:16 UTC - M2 step 4: code runs in git worktrees

Code runs now use per-task git worktrees merged into a result branch, with leader conflict resolution, the user's check command, and cleanup; the task prompt now requires saving named files to disk.

Note: [[changes/20261026-111627-m2-step-4-code-runs-in-git-worktrees|M2 step 4: code runs in git worktrees]]

### 2026-10-26 11:07 UTC - M2 steps 1-3: write mode, task files, git module

CLI task turns can write files in their own task folder, finished tasks list and offer their files, and a git workspace module for code runs was added (not yet wired).

Note: [[changes/20261026-110756-m2-steps-1-3-write-mode-task-files-git-module|M2 steps 1-3: write mode, task files, git module]]

### 2026-10-26 10:47 UTC - M1 follow-ups fixed

Changed facts reopen tasks that used them, combine and review calls get 15 minutes, and answers may publish up to 40 facts.

Note: [[changes/20261026-104724-m1-follow-ups-fixed|M1 follow-ups fixed]]

### 2026-10-26 09:41 UTC - M1 acceptance run

A live three-provider run passed review rework, board facts in the final, and safe resume after a mid-run restart; the roadmap marks M1 accepted with three follow-ups.

Note: [[changes/20261026-094123-m1-acceptance-run|M1 acceptance run]]

### 2026-10-26 09:22 UTC - zod security update

Raised zod to 4.6.7 to fix advisory GHSA-mrhx-c7xc-m3w5, which failed CI's npm audit.

Note: [[changes/20261026-092227-zod-security-update|zod security update]]

### 2026-10-26 09:18 UTC - Safe resume after restart (M1.3)

Calls cut off by a server restart are listed as outcome unknown and repeat only after the user confirms, instead of being silently re-run.

Note: [[changes/20261026-091828-safe-resume-after-restart-m1-3|Safe resume after restart (M1.3)]]

### 2026-10-26 08:52 UTC - Shared facts board (M1.2)

Agents publish owner-tagged facts that every turn reads; only owners change them. Tasks may also wait for colleagues who are still working instead of failing.

Note: [[changes/20261026-085212-shared-facts-board-m1-2|Shared facts board (M1.2)]]
