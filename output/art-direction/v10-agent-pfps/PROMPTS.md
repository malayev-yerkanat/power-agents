# v10 agent profile picture prompts

Status: concept assets awaiting user approval. Tool: built-in `image_gen.imagegen`. Every call used `referenced_image_paths` and `transparent_background=false`. The layout reference was inspected for composition only, not supplied to the generator. Each portrait had one initial generation and one rendering correction; all six exact prompts are recorded below. The correction pass was selected for all three final files.

## pfp-codex.png — initial generation

Reference image: `public/art/codex.png`

Exact prompt:

```text
Use case: stylized-concept
Asset type: square retro pixel-art agent profile picture, concept awaiting user approval.
Primary request: Create ONE finished 1024×1024 PNG portrait, opaque and full bleed, using the attached approved Ranger sprite as the character identity reference. This is a close-up portrait of that same original character, NOT a redesign.
Input image 1: read-only character reference. Study its helmet silhouette, visor shape, costume colours, shoulder armour and ivory costume markings; translate the existing three-quarter sprite into a front-facing head-and-shoulders bust. Do not include the weapon or the full body.
Composition/framing: 1:1 square; centred, front-on helmet and head-and-shoulders bust filling about 70% of frame height. Keep the entire helmet comfortably inside the central circle and inside a circular avatar crop, including its top and both sides. A thick solid accent-colour ring is centred behind the character. The shoulders overlap and break out across the bottom of the ring, extending to the lower frame edge. Bright diagonal speed stripes fill the background behind the ring. Ring and helmet must contrast strongly with the stripes.
Style/medium: detailed mid-1990s 32-bit console-era arcade pixel art in the same medium as the supplied sprite. Deliberate visible pixel clusters on one coherent logical grid, crisp stair-stepped contours, consistent dark navy outlines, restrained ramps of three to five discrete shades per material. Aim for a 256×256 logical pixel canvas enlarged exactly 4× with nearest-neighbour to 1024×1024. Curves, diagonal stripes, highlights and ring edges must all have visible square pixel steps. Flat stepped shading, no soft lighting.
Shared palette: ivory #fff4da and navy #10182b.
Text: none.
Constraints: preserve the reference character's recognizable helmet, visor, costume palette and geometric armour markings. No invented horns, animal faces, teeth, mouth grille or extra helmet crest. No text, letters, numbers, logos, UI, watermark, weapons or additional characters. No Power Rangers helmet designs, show characters, Zords or other franchise elements. No smooth painting, airbrush, continuous gradients, vector look, low-poly rendering, 3D render, glossy illustration, blur or antialiasing. Opaque background, no transparent areas.
Character: Codex, the blue/lavender Ranger in the supplied sprite. Preserve the rounded blue/lavender helmet shell, dark wraparound visor with its ivory trim, ivory neck and chest details, and blue/lavender shoulder plates. Retain the existing costume's broad geometric ivory chest marking without adding a logo.
Agent accent and solid ring: lavender-blue #b8b9ff. Background: high-contrast diagonal navy, cobalt and lavender stripes in discrete flat colour bands; keep the pale lavender ring legible against them. Costume shadows remain cobalt and navy; do not turn this character cyan.
```

## pfp-claude.png — initial generation

Reference image: `public/art/claude.png`

Exact prompt:

```text
Use case: stylized-concept
Asset type: square retro pixel-art agent profile picture, concept awaiting user approval.
Primary request: Create ONE finished 1024×1024 PNG portrait, opaque and full bleed, using the attached approved Ranger sprite as the character identity reference. This is a close-up portrait of that same original character, NOT a redesign.
Input image 1: read-only character reference. Study its helmet silhouette, visor shape, costume colours, shoulder armour and ivory costume markings; translate the existing three-quarter sprite into a front-facing head-and-shoulders bust. Do not include the weapon or the full body.
Composition/framing: 1:1 square; centred, front-on helmet and head-and-shoulders bust filling about 70% of frame height. Keep the entire helmet comfortably inside the central circle and inside a circular avatar crop, including its top and both sides. A thick solid accent-colour ring is centred behind the character. The shoulders overlap and break out across the bottom of the ring, extending to the lower frame edge. Bright diagonal speed stripes fill the background behind the ring. Ring and helmet must contrast strongly with the stripes.
Style/medium: detailed mid-1990s 32-bit console-era arcade pixel art in the same medium as the supplied sprite. Deliberate visible pixel clusters on one coherent logical grid, crisp stair-stepped contours, consistent dark navy outlines, restrained ramps of three to five discrete shades per material. Aim for a 256×256 logical pixel canvas enlarged exactly 4× with nearest-neighbour to 1024×1024. Curves, diagonal stripes, highlights and ring edges must all have visible square pixel steps. Flat stepped shading, no soft lighting.
Shared palette: ivory #fff4da and navy #10182b.
Text: none.
Constraints: preserve the reference character's recognizable helmet, visor, costume palette and geometric armour markings. No invented horns, animal faces, teeth, mouth grille or extra helmet crest. No text, letters, numbers, logos, UI, watermark, weapons or additional characters. No Power Rangers helmet designs, show characters, Zords or other franchise elements. No smooth painting, airbrush, continuous gradients, vector look, low-poly rendering, 3D render, glossy illustration, blur or antialiasing. Opaque background, no transparent areas.
Character: Claude, the orange Ranger in the supplied sprite. Preserve the compact rounded orange helmet shell, dark visor and ivory facial trim, orange shoulder armour, ivory neck detail and existing radiating ivory geometric chest marking. Retain that marking as costume geometry without adding a logo.
Agent accent and solid ring: orange #ffad80. Background: bright gold, ochre and coral diagonal stripes in discrete flat colour bands; use sufficiently darker coral/ochre around the ring for the pale orange ring and helmet to remain clear. Costume shadows use burnt orange and navy.
```

## pfp-gemini.png — initial generation

Reference image: `public/art/gemini.png`

Exact prompt:

```text
Use case: stylized-concept
Asset type: square retro pixel-art agent profile picture, concept awaiting user approval.
Primary request: Create ONE finished 1024×1024 PNG portrait, opaque and full bleed, using the attached approved Ranger sprite as the character identity reference. This is a close-up portrait of that same original character, NOT a redesign.
Input image 1: read-only character reference. Study its helmet silhouette, visor shape, costume colours, shoulder armour and ivory costume markings; translate the existing three-quarter sprite into a front-facing head-and-shoulders bust. Do not include the weapon or the full body.
Composition/framing: 1:1 square; centred, front-on helmet and head-and-shoulders bust filling about 70% of frame height. Keep the entire helmet comfortably inside the central circle and inside a circular avatar crop, including its top and both sides. A thick solid accent-colour ring is centred behind the character. The shoulders overlap and break out across the bottom of the ring, extending to the lower frame edge. Bright diagonal speed stripes fill the background behind the ring. Ring and helmet must contrast strongly with the stripes.
Style/medium: detailed mid-1990s 32-bit console-era arcade pixel art in the same medium as the supplied sprite. Deliberate visible pixel clusters on one coherent logical grid, crisp stair-stepped contours, consistent dark navy outlines, restrained ramps of three to five discrete shades per material. Aim for a 256×256 logical pixel canvas enlarged exactly 4× with nearest-neighbour to 1024×1024. Curves, diagonal stripes, highlights and ring edges must all have visible square pixel steps. Flat stepped shading, no soft lighting.
Shared palette: ivory #fff4da and navy #10182b.
Text: none.
Constraints: preserve the reference character's recognizable helmet, visor, costume palette and geometric armour markings. No invented horns, animal faces, teeth, mouth grille or extra helmet crest. No text, letters, numbers, logos, UI, watermark, weapons or additional characters. No Power Rangers helmet designs, show characters, Zords or other franchise elements. No smooth painting, airbrush, continuous gradients, vector look, low-poly rendering, 3D render, glossy illustration, blur or antialiasing. Opaque background, no transparent areas.
Character: Gemini, the cyan Ranger in the supplied sprite. Preserve the blue/cyan helmet shell with its bright cyan crown and ivory accents, dark visor, blue/cyan shoulder armour and the distinctive ivory and cyan geometric chest panels. Preserve the darker cobalt blue portions visible in the sprite rather than recolouring the whole costume mint. Retain the existing costume marking as abstract panel geometry without adding a logo.
Agent accent and solid ring: cyan #7ed8ff. Background: bright teal to mint diagonal speed stripes in discrete flat colour bands, with darker teal beside the pale cyan ring to establish clear contrast. Costume highlights are cyan and ivory; shadows are cobalt and navy.
```

## Rendering correction pass

Image 1 was the corresponding initial generated portrait; image 2 was the matching original Ranger sprite. The generated intermediate filenames are recorded in `inspection.json`.

### pfp-codex.png — correction

Exact prompt:

```text
Use case: style-transfer
Asset type: final square retro pixel-art codex agent profile picture, 1024×1024 opaque PNG.
Input image 1: edit target, the generated codex portrait.
Input image 2: original approved codex Ranger sprite, character identity reference only.
Change only the rendering discipline of image 1: remove all smooth gradients, airbrushed transitions, blended edges and tiny noisy colour variations. Render the existing design with a strict 256×256 logical square pixel grid enlarged 4× with nearest-neighbour. Every logical pixel must be a uniform flat square; all outlines, ring edges, visor reflections and diagonal stripes are crisp stepped pixel clusters. Limit each material to three to five discrete flat shades, with a compact overall palette. The accent ring must use one uniform flat colour: #b8b9ff.
Preserve image 1's square full-bleed composition, frontal head and shoulders, helmet silhouette and visor, costume markings and palette, bright diagonal speed stripes, centred thick ring, and shoulders overlapping the ring's lower edge. Keep the helmet wholly inside the circular avatar safe area. Preserve the recognizable original character details from image 2; do not invent a new helmet or costume. Dark navy #10182b outlines and ivory #fff4da highlights.
No text, letters, numbers, logos, UI, watermarks, weapons, extra characters, franchise designs, vector rendering, glossy shading, blur or antialiasing. This must read as detailed mid-1990s 32-bit arcade pixel art rather than a pixel filter over an illustration.
```

### pfp-claude.png — correction

Exact prompt:

```text
Use case: style-transfer
Asset type: final square retro pixel-art claude agent profile picture, 1024×1024 opaque PNG.
Input image 1: edit target, the generated claude portrait.
Input image 2: original approved claude Ranger sprite, character identity reference only.
Change only the rendering discipline of image 1: remove all smooth gradients, airbrushed transitions, blended edges and tiny noisy colour variations. Render the existing design with a strict 256×256 logical square pixel grid enlarged 4× with nearest-neighbour. Every logical pixel must be a uniform flat square; all outlines, ring edges, visor reflections and diagonal stripes are crisp stepped pixel clusters. Limit each material to three to five discrete flat shades, with a compact overall palette. The accent ring must use one uniform flat colour: #ffad80.
Preserve image 1's square full-bleed composition, frontal head and shoulders, helmet silhouette and visor, costume markings and palette, bright diagonal speed stripes, centred thick ring, and shoulders overlapping the ring's lower edge. Keep the helmet wholly inside the circular avatar safe area. Preserve the recognizable original character details from image 2; do not invent a new helmet or costume. Dark navy #10182b outlines and ivory #fff4da highlights.
No text, letters, numbers, logos, UI, watermarks, weapons, extra characters, franchise designs, vector rendering, glossy shading, blur or antialiasing. This must read as detailed mid-1990s 32-bit arcade pixel art rather than a pixel filter over an illustration.
```

### pfp-gemini.png — correction

Exact prompt:

```text
Use case: style-transfer
Asset type: final square retro pixel-art gemini agent profile picture, 1024×1024 opaque PNG.
Input image 1: edit target, the generated gemini portrait.
Input image 2: original approved gemini Ranger sprite, character identity reference only.
Change only the rendering discipline of image 1: remove all smooth gradients, airbrushed transitions, blended edges and tiny noisy colour variations. Render the existing design with a strict 256×256 logical square pixel grid enlarged 4× with nearest-neighbour. Every logical pixel must be a uniform flat square; all outlines, ring edges, visor reflections and diagonal stripes are crisp stepped pixel clusters. Limit each material to three to five discrete flat shades, with a compact overall palette. The accent ring must use one uniform flat colour: #7ed8ff.
Preserve image 1's square full-bleed composition, frontal head and shoulders, helmet silhouette and visor, costume markings and palette, bright diagonal speed stripes, centred thick ring, and shoulders overlapping the ring's lower edge. Keep the helmet wholly inside the circular avatar safe area. Preserve the recognizable original character details from image 2; do not invent a new helmet or costume. Dark navy #10182b outlines and ivory #fff4da highlights.
No text, letters, numbers, logos, UI, watermarks, weapons, extra characters, franchise designs, vector rendering, glossy shading, blur or antialiasing. This must read as detailed mid-1990s 32-bit arcade pixel art rather than a pixel filter over an illustration.
```

## Export and review board

The generator returned 1254×1254 RGB PNGs despite the 1024×1024 request. Final portraits were exported at exactly 1024×1024 with nearest-neighbour sampling, with no palette quantization, repainting or smoothing. This export does not establish a coherent logical pixel grid. `build_review_board.py` creates the board from the final portraits using nearest-neighbour resizing and binary circular masks. Board text is added by PIL; the portrait files contain no text.

