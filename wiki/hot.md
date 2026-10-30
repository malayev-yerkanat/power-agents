---
type: meta
title: "Hot Cache"
status: active
created: 2026-10-07
updated: 2026-10-30
tags: [context]
---

# Hot Cache

F2 adds [[Flows UI]] beside the existing team workspace. Read [[Reel Flow Execution]], then [prototype guide](../docs/prototype.md). **Потоки** opens `#/flows`, lists saved graphs and creates the `roblox-reel` template with demo/live selection. Demo makes no model calls; live provider/pipeline executors remain planned for F3/F4.

Each `#/flows/<id>` opens a dark dotted React Flow canvas with pan/zoom, initial fit, controls, minimap, typed coloured ports and status cards. Run **Бренд**, run **Идея**, approve its result, then run **Сценарий**. Rejection requires a note and reruns. Drag saves positions after debounce; connect checks port types (`text` accepts any); Delete removes selection; **+ Узел** uses registry defaults. The inspector edits title, gate and generated config fields and shows full output JSON, notes, version and errors. Toolbar **Автозапуск** uses the existing scheduler.

`GET /api/flows/registry` exposes client-safe type/title/ports/gate/lane/config defaults. The global `/api/events` stream emits `flow` invalidations from `subscribeFlows`. The canvas refetches detail after matching events and stream open/reconnect, recovering missed notifications without a separate flow replay cursor. Client writes queue against the current version; rejected writes refetch, 409 asks the user to repeat, and server errors show in a toast.

[[Flow Engine]] retains F1 gates, stale propagation, three global executions, named lanes, version/hash directories and restart failure without silent rerun. Demo outputs are inline fixtures; file paths show a media placeholder. Live LLM nodes (F3), uploads/pipeline/playable media (F4), and Telegram flow approvals (F5) remain planned.

Pure helper/navigation tests and real-engine/API demo browser tests cover the new routes and execution path; see [[log|Operation Log]] for recorded verification results. Browser checks need a local Vite listener, and socket-based tests may be blocked by sandbox `listen EPERM`. Existing team-run and Telegram behavior remains separate. Runtime state, `.env`, private workspaces and immutable `.raw/` snapshots stay out of wiki source material.
