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

### 2026-10-31 10:35 UTC - Fix upload timeout, flow crash and dropped Telegram approvals

Raised the server request timeout so 2 GB Capture uploads can finish, stopped failed flow result writes from crashing the server, and made Codex approval prompts in Telegram buttons-only so typed replies are no longer silently dropped.

Note: [[changes/20261031-103542-fix-upload-timeout-flow-crash-and-dropped-telegram-approvals|Fix upload timeout, flow crash and dropped Telegram approvals]]

### 2026-10-30 15:05 UTC - Flow UI P3 polish

Flow toolbar and mobile inspector respect safe-area insets; the running pulse and button hover use duration tokens; media links tell screen readers they open in a new tab.

Note: [[changes/20261030-150507-flow-ui-p3-polish|Flow UI P3 polish]]

### 2026-10-30 14:57 UTC - Flow UI P2 design fixes

Add-node menu gains focus management, Escape and outside-click close, and aria-controls; save status is a persistent live region; error toast sits inside the canvas body; radii follow a 6px control / 10px surface scale; React Flow aria labels are memoized per language.

Note: [[changes/20261030-145708-flow-ui-p2-design-fixes|Flow UI P2 design fixes]]

### 2026-10-30 14:54 UTC - Flow UI P1 design fixes

Flow canvas colors moved to --flow-* CSS tokens with one accent; controls raised to 44px targets, text to 12px minimum, canvas given a region role.

Note: [[changes/20261030-145407-flow-ui-p1-design-fixes|Flow UI P1 design fixes]]

### 2026-10-30 11:39 UTC - Agent avatars use approved Ranger pfps

The Avatar component now shows the approved v14 Ranger portraits for Codex, Claude and Gemini connections; other connections keep their initials.

Note: [[changes/20261030-113907-agent-avatars-use-approved-ranger-pfps|Agent avatars use approved Ranger pfps]]

### 2026-10-30 11:35 UTC - Codex pfp badge reshaped to 7-lobe cloud

Reshaped the Codex pfp chest badge into a seven-lobe cloud matching the official logo, with white clearance from the armour; colours and glyph unchanged.

Note: [[changes/20261030-113539-codex-pfp-badge-reshaped-to-7-lobe-cloud|Codex pfp badge reshaped to 7-lobe cloud]]

### 2026-10-30 11:27 UTC - Pfps v14 and Gemini sprite without visor mark

Restyled the Codex pfp chest badge in the suit's own shaded blue, and removed the multicolour visor mark from the Gemini pfp and the in-app Gemini sprite.

Note: [[changes/20261030-112703-pfps-v14-and-gemini-sprite-without-visor-mark|Pfps v14 and Gemini sprite without visor mark]]

### 2026-10-30 10:55 UTC - Agent profile pictures (pixel pfps v10-v13)

Added square retro pixel-art profile pictures for the Codex, Claude and Gemini Rangers, built from the approved sprites with official Codex and Gemini logo emblems. Concept assets awaiting approval; not wired into the app.

Note: [[changes/20261030-105523-agent-profile-pictures-pixel-pfps-v10-v13|Agent profile pictures (pixel pfps v10-v13)]]

### 2026-10-30 10:06 UTC - Claude Code Telegram hooks moved to their own bot

Claude Code approval, turn and prompt hooks now run from ~/.claude/tools/claude-telegram with a dedicated bot and bridge service, so Power Agents no longer serves them; removed the old hook scripts, the /api/telegram/approval, /question and /cancel endpoints, and TELEGRAM_CHAT_ID from .env.example.

Note: [[changes/20261030-100641-claude-code-telegram-hooks-moved-to-their-own-bot|Claude Code Telegram hooks moved to their own bot]]

### 2026-10-30 08:28 UTC - Fix missing Browser use Telegram approvals

Forward empty-form MCP tool confirmations, including Browser use download permissions, to the dedicated Codex bot. Approve once and decline use the desktop response format without persistent grants.

Note: [[changes/20261030-082815-fix-missing-browser-use-telegram-approvals|Fix missing Browser use Telegram approvals]]

### 2026-10-30 07:55 UTC - Verified dedicated Codex Telegram connection

Paired the separate Codex bot and verified a live structured question reply from Telegram reaches the active Codex desktop chat. Enabled local desktop chat coverage without sharing Claude bot credentials.

Note: [[changes/20261030-075535-verified-dedicated-codex-telegram-connection|Verified dedicated Codex Telegram connection]]

### 2026-10-30 07:53 UTC - Dedicated Codex Telegram approvals and questions

Added a separate Codex bot with isolated credentials, pairing and polling, plus desktop request mirroring and message-bound replies. Existing Claude integration is preserved.

Note: [[changes/20261030-075325-dedicated-codex-telegram-approvals-and-questions|Dedicated Codex Telegram approvals and questions]]

### 2026-10-30 07:30 UTC - Live reel 002 run fixes: voice, script, final size

First end-to-end live flow found and fixed five issues: free-plan ElevenLabs refuses library voices (default now Liam), script length follows the node word target, Script receives only the chosen idea, word count is measured not trusted, and Final renders full 1080x1920.

Note: [[changes/20261030-073041-live-reel-002-run-fixes-voice-script-final-size|Live reel 002 run fixes: voice, script, final size]]

### 2026-10-30 06:53 UTC - Review EN RU language toggle

Fixed missing platform translations, feedback that stayed in the previous language, and localized flow defaults being persisted as titles. Expanded translation regression coverage while preserving custom content and protected F4 files.

Note: [[changes/20261030-065316-review-en-ru-language-toggle|Review EN RU language toggle]]

### 2026-10-30 06:49 UTC - F4 media pipeline: stages, uploads, playback

Live flows now run Voice (ElevenLabs), Capture (Studio take upload), Edit plan, Preview, QA and Final through JSON-contract Python stages in the content project, with streamed uploads, Range media playback in cards and a needs-human state.

Note: [[changes/20261030-064930-f4-media-pipeline-stages-uploads-playback|F4 media pipeline: stages, uploads, playback]]

### 2026-10-30 06:49 UTC - Telegram waiting state covers earlier turns and Codex jobs

The turn alert now shows waiting on background work while a background agent or command from any turn has not reported back, or a Codex plugin job of the session is still running.

Note: [[changes/20261030-064928-telegram-waiting-state-covers-earlier-turns-and-codex-jobs|Telegram waiting state covers earlier turns and Codex jobs]]

### 2026-10-30 06:48 UTC - F4 localization compatibility and final checks

Preserved the landed localization and used the existing translated file-size placeholder in Capture uploads. Corrected writable stream typing in the upload regression and updated translated template help to reflect implemented media stages.

Note: [[changes/20261030-064800-f4-localization-compatibility-and-final-checks|F4 localization compatibility and final checks]]

### 2026-10-30 06:46 UTC - EN/RU language switch

Added an EN/RU button to the top bar that switches the client UI between Russian and English without reload; choice persists in localStorage.

Note: [[changes/20261030-064602-en-ru-language-switch|EN/RU language switch]]

### 2026-10-30 06:45 UTC - F4 flow media pipeline

Implemented isolated content pipeline execution, streamed Capture uploads, contained Range media and native playback with distinct human-action failures. Restored Voice timings in the reel template and documented F4 setup and remaining live acceptance.

Note: [[changes/20261030-064542-f4-flow-media-pipeline|F4 flow media pipeline]]

### 2026-10-30 06:30 UTC - Idea avoids made topics; Scenes runs before F4

Idea now gets an avoid list (its config plus approved ideas from other flows) and retries if it repeats one; the Roblox template seeds Inflation (reel 001) and no longer wires Voice timings into Scenes until F4.

Note: [[changes/20261030-063043-idea-avoids-made-topics-scenes-runs-before-f4|Idea avoids made topics; Scenes runs before F4]]

### 2026-10-30 06:28 UTC - F3 live LLM executors for Idea, Script, Scenes

Live flows now run Idea, Script and Scenes through the existing model connections with brief-based prompts, zod-validated JSON output, one retry, connection fallback and readable card excerpts.

Note: [[changes/20261030-062805-f3-live-llm-executors-for-idea-script-scenes|F3 live LLM executors for Idea, Script, Scenes]]

### 2026-10-30 06:11 UTC - Flows canvas fixes: hidden nodes and inspector labels

Fixed canvas nodes turning invisible after a flow refetch (React Flow measured size was dropped) and gave inspector config fields explicit accessible names so textarea content no longer leaks into their labels.

Note: [[changes/20261030-061122-flows-canvas-fixes-hidden-nodes-and-inspector-labels|Flows canvas fixes: hidden nodes and inspector labels]]

### 2026-10-30 06:04 UTC - F2 flow canvas workspace

Added the Russian Flows list, React Flow canvas, typed node editing and actions, registry metadata and SSE refetch updates. Updated the canonical prototype and project wiki; live executors and media remain planned.

Note: [[changes/20261030-060428-f2-flow-canvas-workspace|F2 flow canvas workspace]]

### 2026-10-30 06:02 UTC - Telegram alert shows waiting on background work

A turn that started a background agent, background command, Monitor or ScheduleWakeup now alerts as waiting on background work instead of done.

Note: [[changes/20261030-060237-telegram-alert-shows-waiting-on-background-work|Telegram alert shows waiting on background work]]

### 2026-10-30 06:00 UTC - Even shorter Telegram alerts

Turn alerts keep only the first paragraph, at most 200 characters, and drop Markdown headings; approval alerts show at most 200 characters of the command.

Note: [[changes/20261030-060004-even-shorter-telegram-alerts|Even shorter Telegram alerts]]

### 2026-10-30 05:58 UTC - Shorter, structured Telegram alerts

Claude Code turn and approval alerts now start with an emoji status line, strip Markdown, cap the body at 400 characters at a sentence end, and separate header, recap and question with blank lines.

Note: [[changes/20261030-055831-shorter-structured-telegram-alerts|Shorter, structured Telegram alerts]]

### 2026-10-30 05:55 UTC - Reel Flow engine F1 (headless)

Added a headless node-graph flow engine for the Reel Flow workspace: typed nodes, approval gates, reject-with-note re-runs, stale propagation, auto-run, a render lane and restart safety, plus /api/flows routes and a roblox-reel template.

Note: [[changes/20261030-055510-reel-flow-engine-f1-headless|Reel Flow engine F1 (headless)]]

### 2026-10-30 05:44 UTC - Answer Claude Code questions from the app or Telegram

The Stop hook now exits 2 to hand a Telegram tap back, so it can run with asyncRewake and the turn ends at once; a new UserPromptSubmit hook cancels that session's open Telegram question when the user answers in the app.

Note: [[changes/20261030-054417-answer-claude-code-questions-from-the-app-or-telegram|Answer Claude Code questions from the app or Telegram]]

### 2026-10-28 08:57 UTC - M4: plain-text artifact accepted

An answer whose artifact is plain text is now taken as the body instead of repeating the whole turn.

Note: [[changes/20261028-085709-m4-plain-text-artifact-accepted|M4: plain-text artifact accepted]]

### 2026-10-28 08:54 UTC - M4: synthesis without a document is repeated; acceptance run

Fixed a pause caused by dropping a synthesis that only asked for fixes: such a synthesis now gets one repeat with a hint. Acceptance run 958811b4 with Gemini Low completed in about 7.5 minutes active versus 12.5 baseline.

Note: [[changes/20261028-085434-m4-synthesis-without-a-document-is-repeated-acceptance-run|M4: synthesis without a document is repeated; acceptance run]]

### 2026-10-28 08:43 UTC - M4: Gemini turns measured

Recorded Gemini turn timing from agy logs in the roadmap: median 10 s startup per turn, then mostly one model call on Flash (High), median 39 s.

Note: [[changes/20261028-084313-m4-gemini-turns-measured|M4: Gemini turns measured]]

### 2026-10-28 08:41 UTC - M4 Speed: Codex stall guard

A Codex turn with no output for 150 s is stopped and repeated once, unless it already used a team tool. Based on 109 live Codex turns: normal silences under 95 s, stalls 180-414 s.

Note: [[changes/20261028-084133-m4-speed-codex-stall-guard|M4 Speed: Codex stall guard]]

### 2026-10-28 08:30 UTC - Answer Claude Code questions from Telegram buttons

Turn-end questions with options now arrive in Telegram as buttons; a tap is handed back to Claude Code as the user's answer through the Stop hook.

Note: [[changes/20261028-083050-answer-claude-code-questions-from-telegram-buttons|Answer Claude Code questions from Telegram buttons]]

### 2026-10-28 08:30 UTC - M4 live timing run

Live run 619723ae with the baseline goal completed with no answer repeats; about 8.5 minutes active to the first review verdict versus 12.5 for the baseline.

Note: [[changes/20261028-083028-m4-live-timing-run|M4 live timing run]]

### 2026-10-28 08:27 UTC - Claude Code turn-end alerts via Telegram

A global Stop hook sends the paired Telegram chat each finished Claude Code turn's recap, plus the open question and options when one waits, so sessions can be followed without the app open.

Note: [[changes/20261028-082722-claude-code-turn-end-alerts-via-telegram|Claude Code turn-end alerts via Telegram]]

### 2026-10-28 08:19 UTC - Approve or decline Claude Code requests from Telegram

Claude Code approval alerts now carry Approve/Decline buttons; the Power Agents server sends them, handles the tap, and returns the decision to the PermissionRequest hook.

Note: [[changes/20261028-081925-approve-or-decline-claude-code-requests-from-telegram|Approve or decline Claude Code requests from Telegram]]

### 2026-10-28 08:14 UTC - M4 Speed: no double writing of saved files

Measured inside slow turns from CLI transcripts. The platform now attaches saved task file text to the result, so agents no longer write each document twice.

Note: [[changes/20261028-081436-m4-speed-no-double-writing-of-saved-files|M4 Speed: no double writing of saved files]]

### 2026-10-28 08:13 UTC - Claude Code approval alerts via Telegram

Added a Claude Code PermissionRequest hook script that sends the paired Power Agents Telegram chat a message whenever a session waits for approval.

Note: [[changes/20261028-081354-claude-code-approval-alerts-via-telegram|Claude Code approval alerts via Telegram]]

### 2026-10-28 08:08 UTC - M4 Speed: no repeats in closing turns

Started milestone M4 Speed with a measured baseline. Synthesis, review and resolve turns no longer get team tools, and messages in their answers are dropped instead of repeating the whole turn.

Note: [[changes/20261028-080849-m4-speed-no-repeats-in-closing-turns|M4 Speed: no repeats in closing turns]]

### 2026-10-26 15:30 UTC - M3 acceptance

A live run showed Claude and Codex using team tools under platform-checked identity while forged and browser requests were refused; criterion 12 is done, with Gemini running without team tools.

Note: [[changes/20261026-153027-m3-acceptance|M3 acceptance]]

### 2026-10-26 14:53 UTC - M3 steps 3-4: CLI wiring and docs

Claude and Codex now connect the team tools per turn with the token only in the environment; Gemini is marked as having no team tools, and the leader learns who has them.

Note: [[changes/20261026-145356-m3-steps-3-4-cli-wiring-and-docs|M3 steps 3-4: CLI wiring and docs]]

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
