# Detailed ambient city assets

**Current scope:** panorama.png remains active. The v2 vehicles (sedan, taxi, airliner) are historical and moved to [output/art-direction/city-v2-vehicles-superseded](../../../output/art-direction/city-v2-vehicles-superseded/) on 2026-10-20 so they no longer ship in the build; current vehicle sprites and rendering rules are in [vehicles-v3](../vehicles-v3/README.md). The following records the v2 implementation.

Generated with the built-in imagegen tool using the approved Codex Ranger and villain boss as style references. These replace the simplified procedural city and vehicle drawings, not the approved character frames or run encounter background.

| Asset | Source PNG | Runtime source | Display |
| --- | --- | --- | --- |
| panorama.png | 2172×724 RGB | 768×256 | 1536×512, top cropped 64px in the 448px scene |
| sedan.png | 2059×764 RGBA | Original PNG, browser minification | 160×60 |
| taxi.png | 2060×763 RGBA | Original PNG, browser minification | 160×60 |
| airliner.png | 2172×724 RGBA | Original PNG, browser minification | 192×64 |

Sources are preserved unchanged. PixelArtwork rasterizes the city once with nearest-neighbor sampling, then CSS displays its logical canvas at integer 2×. Cars and aircraft render directly from their original PNGs with browser minification and object-fit: contain. Their former 80×30 / 96×32 intermediate canvases discarded too much detail and are no longer used. Vehicle/aircraft alpha channels were checked for transparent and opaque pixels, and visually inspected on the city. Opposing traffic mirrors only the inner artwork; the outer element owns movement.

These are generated concept-derived production visuals, not hand-authored animation sheets or a mathematically limited palette. Small source shading irregularities remain; the city uses its logical grid, while vehicle/aircraft minification retains the original aspect ratio inside the existing display box. Do not force detailed vehicle sources through a tiny nearest-neighbor canvas; it aliases windows, wheels and outlines. Future edits must preserve the relative actor scale, dark contours and stepped material shading.

Prompts: [city, sedan and aircraft](PROMPTS.md); [taxi variation](../../../output/art-direction/city-v2-vehicles-superseded/TAXI-PROMPT.md). The taxi also used the generated sedan as a shape/style reference.
