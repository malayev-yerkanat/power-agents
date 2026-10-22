# Power Agents scene assets

Approved C1 Codex straight saber, L1 Claude rigid staff, Gemini blaster, and three villains copied unchanged from `output/art-direction/v4-weapon-exploration/preview-frames/`. City copied unchanged from `output/art-direction/v2-ai-rangers-city/city-background.png`.

Character frames are 160×160 logical pixels with stance baseline144 and approximately96px Ranger silhouettes. Use integer placement and pixelated rendering; never smooth, stretch independently, or generatively repaint sprites during scene assembly. The city is1536×1024 and displayed at768×512; the viewport trims scenery only.

These are the approved concept-derived frames, not verified hand-authored animation sheets. Existing logo/highlight noise and approximate stance pivots remain. Runtime combat translates the original frames at integer coordinates, with procedural SVG trails, projectiles and finite status effects. No smooth rotation, new pose frames or limb articulation is implied.

## Detailed ambient panorama

The decorative panorama now uses [city-v2](city-v2/README.md): newly generated detailed city, sedan, taxi and airliner artwork matched to the approved character style. The original encounter assets above stay unchanged. Runtime rasterization uses a shared logical pixel grid and integer 2× display; source images and prompts are retained.

Current vehicles use [vehicles-v3](vehicles-v3/README.md), redrawn with broad clusters for 80×32 / 96×32 logical grids at 2×. The previous high-detail vehicles were rejected both when aggressively reduced and when smoothly scaled. The city-v2 panorama remains active.

## Articulated ambient monsters

[monster-motion](monster-motion/README.md) contains the cleaned insect/boss key-pose sheets, aligned crop metadata and a browser inspection page. The ambient city now uses breathing, roar, stomp and three attack gestures per monster. Original static assets remain loading/error fallbacks and the run Encounter retains its original rendering.
