# Project agent guidance

Read `docs/prototype.md` for the current product behavior. `docs/superpowers/specs/` contains broader design intent; distinguish planned features from implemented code.

## Project wiki

The Obsidian compatible project wiki is in `wiki/`. Start with `wiki/hot.md`, then `wiki/index.md`, then the relevant module or flow page. Source code and `docs/` remain authoritative when a wiki page is stale.

After every major implementation, update the wiki as part of the same task, before declaring the work complete. A major implementation changes a user flow, module boundary, API or data contract, provider integration, security behavior, persistence model, or architectural decision. Routine formatting and isolated typo fixes do not require a wiki update.

For a major implementation:

1. Verify the completed behavior in code and tests. Update the canonical project document in `docs/` if its statements changed.
2. Update affected `wiki/modules/`, `wiki/flows/`, `wiki/decisions/`, and `wiki/overview.md` pages. Mark planned behavior as planned; do not describe it as implemented.
3. Update `wiki/index.md` and relevant `_index.md` files for any new, moved, or retired pages.
4. Add a dated entry at the top of `wiki/log.md` and replace `wiki/hot.md` with a concise current summary (under 500 words).
5. Check frontmatter, links, and references to source files. Include wiki changes with the implementation in the same review or commit.

Keep `.raw/` snapshots immutable. Create a new snapshot when a new source must be preserved. Do not copy secrets, `.env`, runtime state, or private workspaces into the wiki.
