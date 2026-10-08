# Power Agents — platform layout studies

2026-10-08. Static design exploration only. C1 straight saber and L1 rigid staff are selected. Platform layout awaits user selection; application code and behavior remain unchanged.

## Options

- **A / Arena** (`a-arena.png`): encounter-first dark workspace. Strongest sense of watching a team; less room for long discussions. Full city scene at its 768×512 logical dimensions inside the larger frame.
- **B / Command Desk** (`b-command-desk.png`): light working surface, compact city stage, tasks and persistent discussion/results rail. Recommended balance of character and everyday usefulness.
- **C / Mission Control** (`c-mission-control.png`): dark operational workspace with compact encounter, run summary, task list and selected task detail. Best for dense supervision; less immersive.
- **B / Plan approval** (`b-plan-approval.png`): companion showing proposed approach, success criteria, roles, feedback and explicit approval before execution.

All images are 1600×1040. Same illustrative research run, with dynamic roles. English mockup copy is illustrative; the current app uses Russian. No language migration is implied.

## Production method and inspection

`render_mockups.py` deterministically draws static layout studies and composites the existing v4 preview frames. No generated repainting or weapon changes. Sprites retain their exact logical pixels at 1×; backgrounds use the previous nearest-neighbor normalization and compact panels crop the city. Compact scenes omit the boss for space. Body typography is conventional UI text; the 32-bit constraint applies to all game artwork, effects and future animations.

Inspected all three actual output images and the approval companion for layout, framing, readable text, sprite cropping and distinct layout hierarchy. Replaced unsupported arrow glyphs with plain separators. Characters and weapons are complete. These are concept layouts, not browser screenshots, interactive prototypes, responsive specifications, production-certified sprites or tested animations.

Existing art limitations remain: noisy emblem/highlight pixels, detailed scenery relative to actors, and absent ground shadows. At 1× the characters are approximately 96px high; larger sprite display should be explored at exact 2× in the selected layout. No fabricated combat-health percentages are used; progress text refers to completed tasks. Before implementation, define explicit links between individual villains and task labels, state indicators, idle/working poses, and narrow-screen layout.

Current UI controls and workflow were reviewed in `Composer.tsx` and `RunWorkspace.tsx`. Persistent side-by-side discussion and selected-task panels are proposed arrangements of existing content. Mockups show sample data; no provider connectivity or live execution is claimed.

## Next step

Select A, B, C or a combination. Refine the chosen layout, scene sizing and state presentation before application implementation.
