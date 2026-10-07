---
type: domain
status: active
created: 2026-10-07
updated: 2026-10-07
tags: [architecture]
---

# Architecture Overview

Power Agents is one local Node process plus a browser client. [[Server Runtime]] serves the UI and API. [[Client Interface]] creates teams and displays progress. [[Local HTTP API]] validates requests and streams events. [[Orchestration Engine]] owns the state machine and dispatches turns through [[Provider Adapters]]. [[Persistence Store]] commits run state and event entries transactionally. [[Shared Contracts]] defines the exchanged shapes.

The execution path is [[Data Flow]]; browser session behavior is [[Session and API Flow]]. [[Dependency Graph]] shows module relationships. The current implementation is narrower than the long-term platform design; see [[overview|Project Overview]] and [[Platform Design Source]].
