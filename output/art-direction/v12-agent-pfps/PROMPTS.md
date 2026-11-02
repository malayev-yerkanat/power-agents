# v12 edit record

No image generator was used. There are no generator prompts.

The brief permits procedural stripe reconstruction. The PIL method keeps the approved character pixels intact and makes every change auditable.

Run: `PYTHONDONTWRITEBYTECODE=1 python3 edit_portraits.py` from this folder. The script writes only beside itself.

1. Protect the source character silhouettes. Remove the background rings inside documented annulus masks by continuing the diagonal speed stripes with nearest source-pixel patches. The clean top-border profile anchors the Codex and Gemini top arcs in stepped rows. Categorical stripe-label continuation removes isolated donor fragments by copying matching source pixels; it never averages or blurs RGB colours. No whole-portrait resampling.
2. Clear only the old coloured emblem footprints, plus the old visor mark trail. Use surrounding chest-panel colours and same-row helmet/visor samples.
3. Draw Codex on its nominal 12px local grid: reflected stepped blue shield, white outline, a centred bold `>_` with one shared baseline.
4. Draw Gemini on its nominal 13px local grid: four identical quarter-turned angular blades (red, blue, green, yellow) with a navy outline, centred at the white chest panel. Draw a small symmetric four-quadrant visor cross on the same grid.
5. Compare final and source pixels. Assert zero changes outside ring/emblem masks and zero protected character changes. Save exact diff masks, 64px/128px circular previews, and native-crop 4× emblem zooms on the review board. Run `PYTHONDONTWRITEBYTECODE=1 python3 verify_artifacts.py` for an independent read-only check of exported pixels, actual glyph components, equal blade areas/quarter-turns, previews, and board crops.

The generated source rasters do not have a mathematically exact global pixel grid; the 12px/13px local grids follow measured emblem block sizes. Outside the requested repairs, source pixels are retained exactly.
