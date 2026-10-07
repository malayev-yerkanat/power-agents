---
type: decision
status: active
created: 2026-10-07
updated: 2026-10-07
tags: [decision, architecture]
---

# Key Decisions

| Choice | Rationale and current effect |
| --- | --- |
| Local single-user server | Keeps execution and CLI credentials on the user's computer; API accepts loopback requests only. |
| Durable coordinator | [[Orchestration Engine]] persists run transitions and events in [[Persistence Store]] instead of depending on one model chat history. |
| Leader plus reviewer | The leader plans and synthesizes; another participant reviews the result. |
| Explicit approval boundary | The user approves a plan before assigned tasks begin. |
| Replaceable provider adapter | Teams can choose CLI and API connections independently of the participant role. |
| Text-first prototype | Current implementation produces text/Markdown; code editing and general tools remain future work. |

These choices are supported by the [platform design](../../docs/superpowers/specs/2026-10-07-agent-team-platform-design.md) and [current prototype](../../docs/prototype.md). Recheck code for the exact implemented scope before extending this page.
