# Power Agents: project wiki

Mode: B — repository
Purpose: Maintain an Obsidian compatible map of the local AI agent orchestration prototype.
Owner: Project maintainers
Created: 2026-10-07

## Structure

- `.raw/`: immutable snapshots of source documents.
- `wiki/index.md`: master catalog.
- `wiki/hot.md`: recent context cache.
- `wiki/log.md`: newest-first operation log.
- `wiki/overview.md`: current project summary.
- `wiki/modules/`, `wiki/components/`, `wiki/flows/`: implemented system map.
- `wiki/decisions/`, `wiki/dependencies/`: rationale and technical stack.
- `wiki/sources/`: snapshot summaries and provenance.
- `wiki/domains/`, `wiki/entities/`, `wiki/concepts/`: navigation by topic.
- `wiki/comparisons/`, `wiki/questions/`, `wiki/meta/`: later analysis and conventions.
- `wiki/_templates/`: note templates.

## Conventions and maintenance

Follow the project workflow in `AGENTS.md`. Every wiki note has YAML frontmatter with `type`, `status`, `created`, `updated`, and `tags`. Use unique note filenames and `[[Wikilinks]]`. Update `wiki/index.md` when adding or removing pages. Add log entries at the top without changing older entries. Replace `wiki/hot.md` after each major wiki update. Source code and `docs/` are canonical; `.raw/` is never edited in place.
