---
type: meta
status: active
created: 2026-10-07
updated: 2026-10-07
tags: [conventions, maintenance]
---

# Wiki Conventions

- Source code and `docs/` are authoritative. `.raw/` holds immutable dated snapshots and may be older.
- All notes use YAML frontmatter containing `type`, `status`, `created`, `updated`, and `tags`.
- Use unique filenames and Obsidian wikilinks; link to canonical files with relative Markdown links.
- State whether a capability is implemented, planned, or historical. Never infer implementation solely from a design document.
- Update relevant notes, indexes, [[log|Operation Log]], and [[hot|Hot Cache]] after a major implementation, following `AGENTS.md`.
- Do not put secrets, `.env`, SQLite data, private agent workspaces, or unredacted provider responses in the wiki.
