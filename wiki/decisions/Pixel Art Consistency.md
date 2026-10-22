---
type: decision
status: approved
created: 2026-10-08
updated: 2026-10-10
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

The user selected **v7 B Airy Pixel** and requested implementation. The first implementation used ivory/cobalt surfaces, restrained pixel headings and controls, readable body copy, a single-column tabbed workspace, a modal history drawer, and the original selected C1/L1/Gemini frames. Scene state is derived from runs/tasks. The fixed logical grid scrolls on small screens. CSS idle initially used a one-pixel offset rather than an animation sheet; later combat choreography is recorded below. See [[Client Interface]] for current scope and limitations.

## Combat choreography implementation

The user requested full combat animation after approving the interface. Runtime combat choreography is now implemented using the approved static frames, integer movement and finite pixel SVG effects. This includes three provider-specific attack sequences, hit recoil, task defeat, messaging, review, synthesis and completion effects. It does not claim newly hand-drawn pose sheets or independently articulated limbs. Original C1/L1 geometry remains authoritative. Live states gate combat; animation never substitutes for actual task progress. Full-frame animation art production remains a distinct future refinement.

## Design refinement — 2026-10-08

The approved direction now also appears in team setup through a static squad preview using the existing 160px frames. Typography, whitespace, muted cobalt controls and quiet rules establish hierarchy; provider colors remain identity accents. The UI does not add smooth scaling, glass effects or perpetual decorative motion. Scene geometry and approved weapon designs are retained. See [[Client Interface]] for implementation details.

## Ambient city extension — 2026-10-08

The user requested a living city around the minimal workspace. Ambient traffic, planes and monster attack effects are now permitted outside opaque reading surfaces, with an independent pause control, OS reduced-motion support and hidden-tab pausing. This extends the preceding refinement's motion constraint. The initial ambient city used an enlarged street image and shrinking laptop monsters; the user rejected its inconsistent scale. The revised ambient skyline is a dedicated 768×224 logical scene at 2×. Monsters remain 320px frames, cars 128×56, on separate sidewalk/road baselines. Narrow screens crop the composition and never shrink actors independently. A reserved panorama above the working area replaces thin side strips. The run encounter retains its original city artwork. Vehicles/effects use crisp SVG geometry and stepped integer translation. No smooth rotation, fractional sprite scaling or new polished character art is introduced. Ambient monsters are decorative and do not represent task progress.

## Detailed environment artwork — 2026-10-08

The user rejected simplified city/vehicle geometry beside the detailed characters. The ambient environment now uses generated raster artwork with dark outlines, stepped material highlights, building texture and mechanical detail. See [asset guide and prompts](../../public/art/city-v2/README.md). Runtime nearest-neighbor rasterization and integer 2× display preserve a shared logical pixel grid. Do not replace these with minimal vector buildings or toy vehicle icons. The established panorama composition and monster scale remain; source generation is not proof of hand-authored pixel or animation alignment.

## Vehicle minification correction — 2026-10-08

The user identified severe detail loss in cars/aircraft after nearest-neighbor reduction to tiny intermediate canvases. These assets now display directly from original PNGs, using browser minification and preserved aspect ratios. Pixel style comes from the approved artwork; forcing every detailed source through a two-pixel display grid is not appropriate. Keep pixelated integer enlargement for native character sprites and the city canvas; do not apply that rule to drastic vehicle minification. Display scale, movement and source artwork remain unchanged.

## Vehicles redrawn for the target grid — 2026-10-08

The smooth minification workaround was rejected for looking too high-resolution. New vehicles-v3 artwork uses larger deliberate clusters before rasterization: simplified wheel hubs, broader glass planes, fewer aircraft windows and stepped material shades. Cars80×32 and planes96×32 render at2× with preserved proportions and binary-alpha edges. This supersedes direct minification as the vehicle rendering policy. Do not reuse fine-detail v2 vehicle art on the small grid or turn smooth scaling back on. The city and character sources remain unchanged.

## Monster pose studies — 2026-10-08

A [48-pose study pack](../../output/art-direction/v8-monster-animation-studies/README.md) now explores breathing, roaring, stomping and three attacks for each of the two ambient monsters. Four transparent 4×3 sheets and a manual/animated review viewer are saved outside runtime assets. These are studies: identity drift, cell-boundary contacts, baseline differences and unverified recovery loops remain. Existing character sprites and application animation behavior are unchanged. Production work must align a pilot idle loop before connecting new poses to the app.


## Ambient pose integration — 2026-10-08

The user approved cleanup and implementation. [Cleaned monster sheets](../../public/art/monster-motion/README.md) now run in the ambient city. Complete opaque-silhouette crop bounds replace uniform grid slicing; each monster has one fixed logical scale, a shared support-foot/ground anchor and padded attack bounds. Nearest sampling, binary alpha and integer2× display keep the scene pixel density consistent. No smooth rotation or per-pose resizing is permitted.

Breathing alternates calm poses; roar, stomp and three attacks occur intermittently with distinct schedules. Dust follows the actual strike frame. Pause, collapse, reduced motion and visibility controls stop playback. Original source sprites remain fallbacks and the run Encounter retains its existing behavior. Browser inspection covered all48 aligned poses; residual generated costume/face variation and missing inbetweens remain art-production limitations, not claims of perfect hand-authored loops.

## Work-first hierarchy refinement — 2026-10-10

The city is now optional and initially collapsed; expanded artwork retains its approved grid, sources, and scale. Creation prioritizes the goal, completed runs prioritize the accepted document, and recovery prioritizes review context. Pixel typography remains for short identity/navigation labels; functional metadata and document prose use readable sizes. No sprite redraw or animation-geometry change is included.
