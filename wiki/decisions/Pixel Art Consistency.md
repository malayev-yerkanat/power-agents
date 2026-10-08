---
type: decision
status: approved
created: 2026-10-08
updated: 2026-10-08
tags: [decision, art-direction, pixel-art]
---

# Pixel Art Consistency

## Context

Power Agents' planned visual workspace represents collaborating AI agents as Rangers and tasks as tokusatsu villains in a modern city. The user approved sturdy Ranger proportions, AI-branded costumes, and a side-on, slightly three-quarter arcade camera. Provider identity does not assign a permanent operational role or team-leader position.

The user rejected the v3 Claude staff's wobbly construction, the Codex sword's uneven proportions, and the smooth illustrated rendering of encounter scenes. This decision records an approved, persistent design constraint. The exploration history below records design approval. The implementation status is recorded in the latest section and in [[Client Interface]].

## Decision

> Power Agents must maintain a consistent 32-bit-era pixel-art aesthetic across characters, weapons, villains, environments, effects, animation frames, and encounter compositions. Scene assembly must preserve the approved sprite style and pixel density. Smooth illustrated rendering, inconsistent pixel scales, or softened asset edges are visual regressions.

“32-bit” describes a console-era visual aesthetic, not a requirement for 32×32-pixel sprites.

### Rendering rules

- Use deliberate, visible pixel clusters on a coherent logical grid.
- Keep crisp stepped contours and consistent outline weight.
- Use restrained palette ramps and discrete shading bands; gradients and highlights must also use deliberate pixel steps.
- Avoid smooth vector-like curves, airbrushed shading, glossy illustration rendering, and blurred edges.
- Maintain compatible pixel density across actors, weapons, scenery, and effects at their intended relative scale.
- Use integer enlargement and nearest-neighbor sampling for pixel-faithful previews.
- Preserve approved geometry during scene assembly. If generative composition repaints or changes an asset, disclose the drift instead of claiming exact reuse.

### Working-grid proposal for v4

The exploration proposes a **160×160 logical-pixel frame**, a Ranger roughly **96 logical pixels tall**, and **2× display scale** (320×320 frame, roughly 192-pixel actor). Frame padding accommodates weapons. These are proposed production targets, pending visual validation and selection, rather than claims about generated PNG dimensions or verified pixel alignment.

Image-generator output resolution must be recorded separately. A large generated image, visible enlarged pixels, or a pixelation filter alone does not prove a coherent logical grid. Do not label an asset grid-verified or animation-ready until its grid, alpha edges, alignment, and intended use have actually been checked.

## Acceptance and consequences

Every revision must be inspected both as an isolated asset and in an encounter composition, at intended browser size and at an enlarged pixel-inspection scale. Check silhouette, complete framing, alpha transparency, outline and shading consistency, relative scale, ground contact, and provider identity. Check weapon alignment through grips and fittings, balanced proportions, and symmetry where the design calls for it.

Record any remaining drift or cleanup requirement explicitly. Concept artwork stays labelled as concept artwork. The user selected **C1 straight saber for Codex and L1 rigid staff for Claude** on 2026-10-08. Animation studies and application implementation require their respective later approval steps. Platform layouts are being explored as static mockups before implementation.

## Evidence and reference status

- User instruction on **2026-10-08** approved the persistent constraint above and requested weapon alternatives plus a scene-style validation preview.
- [Option B Ranger](../../output/art-direction/b-command-diorama/ranger.png): preferred sturdy proportions, armor construction, and character treatment. Its elevated scene viewpoint is not the selected camera.
- [v2 asset guide](../../output/art-direction/v2-ai-rangers-city/README.md): approved provider identities and costume direction, modern-city setting, and tokusatsu enemy concepts. These are visual references, not certified production sprites.
- [v3 Codex saber](../../output/art-direction/v3-weapons-formations/codex-saber.png) and [v3 Claude staff](../../output/art-direction/v3-weapons-formations/claude-staff.png): rejected weapon construction examples.
- [v3 triangle scene](../../output/art-direction/v3-weapons-formations/formation-a-triangle.png) and [v3 staggered scene](../../output/art-direction/v3-weapons-formations/formation-b-staggered.png): examples of rejected smooth rendering. Neither is an authoritative pixel-treatment reference.
- `output/art-direction/v4-weapon-exploration/`: weapon exploration archive; C1 and L1 are selected. Platform layout and final formation remain pending selection. Inspection records with those assets determine which output properties were verified.

See [[Key Decisions]], [[overview|Project Overview]], and [[Client Interface]] for the boundary between art direction and implemented product behavior.

- [Platform mockups](../../output/art-direction/v5-platform-mockups/README.md): three static interface directions and a plan-approval companion. These are design studies, not implemented behavior.

## Whole-platform visual direction — 2026-10-08

The user rejected the conventional UI surrounding a pixel scene in v5. The 32-bit treatment must extend to navigation, window borders, buttons, icons, typography, task panels, and status indicators throughout the platform, with readable body copy. [v6 full-interface concepts](../../output/art-direction/v6-pixel-platform/README.md) explore three directions; selection remains pending. These generated mockups do not approve invented features or supersede selected C1/L1 source sprites.

### Density refinement

The user requested the same whole-platform pixel direction with a minimal layout and generous empty space. Avoid filling every area with decoration, duplicate portraits, slogans, or simultaneous panels. Prefer quiet pixel frames, restrained accents and tabs for secondary content. [v7 minimal studies](../../output/art-direction/v7-minimal-pixel/README.md) explore dark side-by-side and light stacked layouts; selection remains pending.

## Selected and implemented foundation

The user selected **v7 B Airy Pixel** and requested implementation. The first implementation now uses ivory/cobalt surfaces, restrained pixel headings and controls, readable body copy, a single-column tabbed workspace, a modal history drawer, and the original selected C1/L1/Gemini frames. Scene state is derived from runs/tasks. The fixed logical grid scrolls on small screens. CSS idle is a one-pixel offset, not an animation sheet. Full combat/communication/review animation remains future work. See [[Client Interface]] for scope and limitations.
