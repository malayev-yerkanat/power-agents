---
type: note
title: M3 steps 0-2: team tools over MCP
status: evergreen
created: 2026-10-26
updated: 2026-10-26
tags:
  - change
---

# M3 steps 0-2: team tools over MCP

A local MCP endpoint gives agents team tools with one token per turn, so identity comes from the platform; the spike showed Claude and Codex can use it per run and Gemini cannot without global settings.

## Details

185/185 Node tests, 35/35 Chromium tests, typecheck, build, 0 audit findings.

## Files

- `src/server/core/team.ts`
- `src/server/mcp.ts`
- `src/server/engine.ts`
- `src/server/index.ts`
- `src/server/core/prompts.ts`
- `src/server/core/results.ts`
- `src/shared/types.ts`
- `tests/team.test.ts`
- `tests/mcp.test.ts`
- `package.json`
