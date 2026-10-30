# v11 agent profile pictures brief: sprite-faithful retry

v10 (`../v10-agent-pfps/`) got the overall look right, but **the user rejected it: up close, the portraits do not match the sprites.** They show wrong elements and invented symbols. v11 must be based **solely** on the original sprites. Every helmet, visor, emblem, stripe and colour must come from the sprite. Nothing new may be invented.

Status: concept assets awaiting user approval. Nothing is wired into the app.

## Keep from v10

- Square 1:1, 1024×1024, head-and-shoulders bust filling about 70% of the frame height.
- A thick solid ring in the agent accent colour behind the head, with the shoulders breaking out of the bottom of the ring.
- A bright background of diagonal speed stripes. The v10 per-agent palettes are fine.
- Detailed 32-bit arcade pixel art, dark navy outlines, 3–5 stepped shades per material. No smoothing, blur, airbrush, vector or 3D look.

## The only source of truth

- `public/art/codex.png`, `public/art/claude.png` and `public/art/gemini.png` (160×160 RGBA, read-only).
- Before generating anything, crop each sprite's head and upper torso, from the helmet top down to the belt. Enlarge each crop 8× with nearest-neighbour and save it here as `ref-bust-<agent>.png`. Study it pixel by pixel.
- Pass that enlarged crop to the image generator as the reference image.
- Keep the sprite's head angle. Each sprite's head is turned three-quarters toward the viewer's right. Do not redraw it front-on, which is where v10 invented helmet shapes.
- An element that is not in the sprite must not appear. An element that is in the sprite must appear, in the same place and colours.
- `reference-layout.webp` is composition only. Do not take any character detail from it.
- The house rule against text and logos does NOT apply to the sprite's own emblems. Reproduce them exactly as drawn, including the Codex `>_` glyph. Add no other text, logo or symbol.

## Required elements per agent (from the sprites; verify against your own crops)

### Codex (`pfp-codex.png`)
- Blue-violet helmet with white swoosh stripes sweeping back over the top and side.
- Wrap-around black visor with small cyan eye glints. Pale silver mouth plate below the visor.
- White upper-chest yoke. In its centre is a blue shield/badge emblem containing a white `>_` terminal-prompt glyph. This is the key identifier; v10 dropped it.
- Big blue shoulder pads with lavender highlights. If the crop reaches the belt, show the silver belt with gold buckle.

### Claude (`pfp-claude.png`)
- Orange helmet whose dome has fine ridged/striated grooves running front to back. v10 drew it smooth, which is wrong.
- Black visor with cyan glints, and a pale silver mouth plate.
- Ivory chest panel with an orange radiating starburst/sunburst emblem, exactly as on the sprite.
- Large rounded orange shoulder pads, and a dark collar line under the chin.

### Gemini (`pfp-gemini.png`)
- **Royal-blue** helmet and suit, as on the sprite. Do not shift it to cyan; cyan is only for the ring and background.
- Black visor with the small multicolour (red/yellow/green) emblem at the top of the visor. Pale silver mouth plate.
- White chest panel with the multicolour (red, yellow, green, blue) angular emblem as drawn on the sprite. v10 replaced it with a plain blue triangle, which is wrong.
- Red shoulder caps on the blue shoulder pads.

## Files

- `ref-bust-codex.png`, `ref-bust-claude.png`, `ref-bust-gemini.png`: the 8× crops.
- `pfp-codex.png`, `pfp-claude.png`, `pfp-gemini.png`: 1024×1024, opaque.
- `review-board.png`: for each agent, show the 8× sprite crop **next to** the portrait at the same head size, then the 64px and 128px circular previews (nearest-neighbour). The user will compare element by element.
- `PROMPTS.md`: every exact prompt.
- `inspection.json`: dimensions, plus a per-agent checklist with every required element above marked present/absent, and any remaining drift.

## Process

Generate, then compare each portrait to its crop yourself, element by element. Regenerate any portrait with a missing, extra or wrong element; up to 4 attempts per agent. Keep only the best attempt. Report honestly whatever still mismatches.

Only write inside `output/art-direction/v11-agent-pfps/`. Do not edit app code, `public/`, the wiki, or any other file. Other work is in progress in this checkout.
