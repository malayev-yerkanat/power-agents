# v12 agent profile pictures brief: emblem fixes and no rings

v11 (`../v11-agent-pfps/`) is approved apart from the fixes below. The starting images are copied here as `v11-codex.png`, `v11-claude.png` and `v11-gemini.png` (1024×1024). The sprite crops `ref-bust-*.png` stay the source of truth for every design.

**Change only what is listed.** Character, pose, colours, shading, pixel grid, background stripes and framing must stay as they are in v11.

## Fixes requested by the user

1. **Remove the ring from all three portraits.** Fill the area where it was with the same diagonal speed-stripe background, continuing each stripe so no ring outline, seam, glow or ghost is left.
2. **Codex chest emblem.** The v11 badge is a lopsided blob, the `>` is undersized and the `_` floats. Redraw it as a clean, symmetric blue badge, the shield/rounded shape seen on the sprite, with a crisp white outline. Inside it, centre a bold white `>_` terminal prompt: the `>` chevron and the `_` underscore share one baseline, are balanced in size, and the pair is centred in the badge.
3. **Gemini chest emblem.** The v11 emblem is lopsided and its colours bleed. Redraw it as a clean, symmetric four-colour pinwheel/sparkle as on the sprite: four equal angular blades in red, yellow, green and blue around one centre point. Each blade is one solid colour with 1–2 stepped shades, there's a dark navy outline, and it sits centred on the white chest panel.
4. **Gemini visor mark.** The v11 mark is crooked and oversized. Redraw it as a small, straight, symmetric four-colour mark (red, yellow, green, blue quadrants, as on the sprite) at the top centre of the visor. It must be axis-aligned with the helmet's centre line and about half the v11 size.

Claude gets fix 1 only.

## Method (keeps everything else identical)

- **Emblems (fixes 2–4): draw them deterministically, do not regenerate them.** Draw each emblem in Python/PIL as pixel art on the portrait's own logical pixel grid; measure the block size from the image. Use the portrait's existing palette and navy outline. Composite each one over the old emblem after clearing it with the surrounding panel colour. This guarantees straight, symmetric shapes.
- **Rings (fix 1):** use the image generator's edit mode with the v11 image as input, or a masked inpaint of only the ring area. Then verify that the character pixels are unchanged. If the edit changed the character, restore it from v11 using a character mask, so only the background changes. If the generator can't do this cleanly, rebuild the background stripes procedurally in PIL instead.
- Do the ring removal first and the emblems last, so a generator pass never touches the fixed emblems.
- Nearest-neighbour only; no smoothing or blur.

## Files

- `pfp-codex.png`, `pfp-claude.png`, `pfp-gemini.png`: final 1024×1024, opaque.
- `review-board.png`: per agent, v11 next to v12, plus a 4× zoom of each fixed emblem and the 64px/128px circular previews.
- `PROMPTS.md` (any generator prompts) and `inspection.json`: a checklist with each fix marked done, plus any pixels outside the fix areas that changed.
- Keep the scripts you used in this folder.

Only write inside `output/art-direction/v12-agent-pfps/`. Touch nothing else and run no state-changing git commands. If an image generation call hangs or fails, retry once, then fall back to the procedural method.
