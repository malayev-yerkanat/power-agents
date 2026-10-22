# Vehicles v3 — small-sprite artwork

New built-in imagegen artwork replaces the rejected high-detail v2 vehicles. Broad window, wheel, fuselage and shading clusters are designed for small display sizes instead of fine illustration detail.

| File | Source PNG | Logical canvas | Display |
| --- | --- | --- | --- |
| sedan.png | 1983×793 RGBA | 80×32 | 160×64 |
| taxi.png | 2048×768 RGBA | 80×32, aspect-contained | 160×64 |
| airliner.png | 2172×724 RGBA | 96×32 | 192×64 |

PixelArtwork samples these new sources without smoothing onto the listed logical grids, then CSS enlarges exactly 2×. Preserve aspect ratio with rounded integer drawing bounds. Optional hardEdges converts alpha below128 to0 and the rest to255, removing residual generated glow. It applies to vehicles only. Canvas failures fall back to the original image and may retain the source halo.

The v2 city and approved character images remain unchanged. Travel directions, road/sky lanes, pause/collapse and reduced-motion behavior are retained. Previous v2 vehicle PNGs remain historical references, not current runtime assets.

The outputs are concept-derived sprites, not certified hand-authored grids or animation sheets. The requested16–24color palette was not verified; do not claim exact palette compliance. Visually inspected at their actual display size alongside the city and monsters. Sources remain unchanged; [generation prompts](PROMPTS.md) record the intended style and taxi cleanup attempt.
