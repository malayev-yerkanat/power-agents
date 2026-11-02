# v14 brief: restyle the Codex badge, remove the Gemini visor mark

Start from v13 (copied here as `v13-*.png`; the v13 script is `edit_v13.py`). Change only what is listed. Everything else stays pixel-identical.

## 1. Codex chest badge: match the portrait's visual style

The user says the v13 badge's shape and colour don't match the rest of the art. Its problems: a saw-tooth scalloped edge that reads as a gear, flat pastel lavender bands unlike any colour on the suit, and a thin rim unlike the armour's outlines.

Restyle it the same way as the approved Gemini chest sparkle (see `v13-gemini.png`):
- **Shape:** the official Codex cloud (`logo-codex-official.png`), with smooth, chunky rounded lobes in this portrait's pixel density. That means gentle bumps 1–2 cells deep, built from short stepped arcs; no single-cell teeth. It's about the same size as the Gemini chest sparkle (about 19–21 cells wide), centred on the white chest panel where the badge is now.
- **Colour:** use the suit's own blue ramp, sampled from `v13-codex.png` armour: a highlight, a mid tone and a shadow. The upper-left lobes get a hint of the lavender used in the shoulder highlights. Light comes from the upper left, like the armour. Use 3 stepped shades only. No pastel bands.
- **Edge:** no separate rim line. As on the Gemini sparkle, the edge comes from the darkest shade of the badge's own blue.
- **Glyph:** white `>_`, 2 cells thick, with a sharp chevron and the underscore on the chevron's bottom row, placed as in the official logo.
- Clear the old badge area to the surrounding white chest-panel pixels first, as v12/v13 did.

## 2. Remove the Gemini visor mark from every Gemini Ranger design

The user wants no badge on the Gemini visor anywhere.

a. **`pfp-gemini.png`:** remove the visor sparkle completely. Restore the area as visor black, plus helmet blue where the sparkle overlapped the helmet. Rebuild it from the neighbouring visor and helmet pixels on the same rows, so no coloured cell, outline or ghost remains. The chest sparkle stays exactly as in v13.

b. **The in-app sprite `public/art/gemini.png`** (160×160 RGBA, used by the app's encounter scene): remove the small multicolour mark at the top of the visor. Replace only those pixels with the visor's black, or the helmet blue where the mark sits on the helmet, following the existing visor edge. Keep the alpha channel and every other pixel identical. The untouched original is saved here as `sprite-gemini-original.png`. Write the result to `sprite-gemini.png` in this folder first, verify it, then copy it over `public/art/gemini.png`. That file is the ONLY file outside this folder you may write.

Do not edit the older concept folders (v2–v13).

## Files

- `pfp-codex.png`, `pfp-claude.png` (an unchanged copy of `v13-claude.png`), `pfp-gemini.png`.
- `sprite-gemini.png`, then copied to `public/art/gemini.png`.
- `review-board.png`:
  - Codex: v13 next to v14, with a 6× badge zoom beside the Gemini chest sparkle zoom, for a style comparison.
  - Gemini pfp: v13 next to v14, with a 6× visor zoom.
  - Sprite: original next to edited, at 8×.
  - 64px/128px circle previews.
- `edit_v14.py` and `verify_v14.py`. The verify script asserts zero changes outside the badge and visor masks, for every file including the sprite. `inspection.json` holds the results.

Run no state-changing git commands. Work in small steps and save often.
