# v11 portrait prompts and provenance

Tool: built-in image_gen. Claude accepted draft exported with Pillow; Codex attempt 2 selected from 2; Gemini attempt 1 selected from 1. No timeouts or failed calls. Generated source images were 1254×1254; final exports are 1024×1024 RGB using nearest-neighbour only.

## Claude — accepted existing draft
No new generation was requested or performed. The previous run's exact generation prompt is unavailable; it is not reconstructed here. Source: `draft-claude.png`. Export: `Image.open(source).resize((1024, 1024), Image.Resampling.NEAREST)`.

## Codex attempt 1 — rejected
References, in order: `draft-codex.png`, `ref-bust-codex.png`.
Reason rejected: stripes interrupted the ring's top arc.

```text
Use case: precise-object-edit / identity-preserve.
Asset: 1024x1024 opaque arcade pixel-art profile portrait.
Input image 1 (draft-codex.png) is the accepted character and exact edit target. Input image 2 (ref-bust-codex.png) is the original sprite crop, supporting identity reference only.
Change ONLY the background stripe colors and ring color of input image 1. Replace the lime-yellow diagonal speed-stripe background with dark navy and lavender-blue stripes in the #10182b / #b8b9ff color family. Make the thick solid ring #b8b9ff lavender-blue. Keep the stripe layout and ring geometry unchanged.
Preserve the accepted character IDENTICALLY: same position, silhouette, three-quarter head angle facing viewer's right, blue-violet helmet, white swoosh stripes sweeping across helmet top and side, black wraparound visor with cyan glints, pale silver mouthplate, white upper-chest yoke, blue shield badge containing the exact white terminal glyph ">_", large blue shoulder pads with lavender highlights, silver belt and gold buckle. Keep all character pixels/colors/details, scale, framing and pose unchanged. Do not redesign, recolor or add character details.
Detailed 32-bit arcade pixel art, dark navy stepped outlines and 3-5 stepped shades, hard pixel edges, no smoothing/blur/airbrush/3D. Preserve the head-and-torso composition and shoulders breaking in front of the bottom of the ring. No extra text, symbols, props, border or watermark. Return one square portrait.
```

## Codex attempt 2 — selected
Same references, same order. Improved ring; subtle seams and merging with same-colour stripes remain. Character visually preserved; exact pixel identity is not claimed.

```text
Use case: precise-object-edit / identity-preserve.
Asset: 1024x1024 opaque arcade pixel-art profile portrait.
Input image 1 (draft-codex.png) is the accepted character and exact edit target. Input image 2 (ref-bust-codex.png) is the original sprite crop, supporting identity reference only.
Change ONLY the background stripe colors and ring color of input image 1. Replace the lime-yellow diagonal speed-stripe background with dark navy and lavender-blue stripes in the #10182b / #b8b9ff color family. Make the thick solid ring #b8b9ff lavender-blue. Keep the stripe layout and ring geometry unchanged.
Preserve the accepted character IDENTICALLY: same position, silhouette, three-quarter head angle facing viewer's right, blue-violet helmet, white swoosh stripes sweeping across helmet top and side, black wraparound visor with cyan glints, pale silver mouthplate, white upper-chest yoke, blue shield badge containing the exact white terminal glyph ">_", large blue shoulder pads with lavender highlights, silver belt and gold buckle. Keep all character pixels/colors/details, scale, framing and pose unchanged. Do not redesign, recolor or add character details.
Detailed 32-bit arcade pixel art, dark navy stepped outlines and 3-5 stepped shades, hard pixel edges, no smoothing/blur/airbrush/3D. Preserve the head-and-torso composition and shoulders breaking in front of the bottom of the ring. No extra text, symbols, props, border or watermark. Return one square portrait.
Critical background geometry requirement: The ring is a separate foreground background layer ABOVE the diagonal stripes and BEHIND the ranger. It must be ONE clean uninterrupted circular annulus with a uniform flat #b8b9ff fill, uniform thickness and the same outline/position as the original draft's blue ring. No stripes may cross through or interrupt the ring. Do not merge the ring with stripes. No holes, dark wedges, joins, notches or stripe cutouts in its top arc. Ring must remain clearly legible against the navy and lavender diagonal background. Everything about the character stays EXACTLY unchanged from input image 1.
```

## Gemini attempt 1 — selected
Reference: `ref-bust-gemini.png`. Required elements are present; visor mark is enlarged relative to the sprite, emblem contours are interpreted, and the bust is tighter than the 70% target.

```text
Use case: stylized-concept.
Asset: 1024x1024 opaque arcade pixel-art profile portrait.
Input image 1 (ref-bust-gemini.png) is the ONLY source of truth for every character detail. Study the sprite closely and reproduce its helmet, visor, emblems, colors and placement. Do not invent or simplify symbols.
Subject: the same Gemini armored ranger in a head-and-shoulders/upper-torso bust. Keep the sprite's three-quarter head angle turned toward viewer's RIGHT; do not draw front-on. ROYAL-BLUE helmet and suit, including the blue shoulder pads; cyan is for the background/ring and NOT the suit. Black wraparound visor with a SMALL multicolour red/yellow/green mark at the TOP of the visor exactly where it is in the reference. Pale silver mouth plate below the visor. White chest panel with the reference's multicolour angular emblem: red upper section, yellow left section, green lower middle and blue right section. Match that angular four-colour silhouette; no plain blue triangle, no invented star or other logo. RED shoulder caps sit on top of BOTH blue shoulder pads, matching the reference.
Composition: square portrait, centered bust fills about 70-80% frame height, entire helmet visible, shoulders and upper torso visible, torso may meet bottom edge. Thick SOLID CYAN ring behind the head, shoulders breaking out across the ring's bottom. Bright diagonal cyan and pale ice-blue speed stripes behind the ring. No other objects.
Style: detailed 32-bit arcade PIXEL ART with consistent crisp block pixels, dark navy outlines and 3-5 hard stepped shades per material. Restrict the character to sprite colors and elements. No smooth gradients, blur, airbrush, vector or 3D finish. Preserve the small multicolour visor mark, full multicolour chest emblem and red shoulder caps. No text, added logos, symbols, weapons or watermark. Return one square portrait.
```

## Export and review
`build_review.py` rebuilds the review board and inspection file. It does not regenerate or alter the portraits. Reference crops are retained unchanged. Board comparison panels normalize helmet-top-to-mouthplate height to 240px, using annotated visual bounds; crop and portrait therefore share head scale, while circular previews are true 64px and 128px diameters. All image resizing uses nearest-neighbour. A hard circular mask creates each preview. See `inspection.json` for per-element findings and measured file properties.

