# v13 agent profile pictures brief: official logo shapes

v12 (`../v12-agent-pfps/`) is approved apart from three emblems. The starting images are copied here as `v12-codex.png`, `v12-claude.png` and `v12-gemini.png`, with no rings. The v12 script is kept as `v12_edit_portraits.py`; reuse its approach. `v11-codex.png` and `v11-gemini.png` hold the original pre-emblem pixels, for reference only.

**Change only the three emblems below.** Character, pose, shading, background stripes, framing and Claude stay pixel-identical to v12. Claude needs no changes; copy it to `pfp-claude.png` unchanged.

## Official references (supplied by the user)

- `logo-codex-official.png`: the Codex logo. A scalloped cloud/flower silhouette of about 8 rounded lobes. It has a vertical gradient from lavender (about `#b0a8ff`) at the top through periwinkle (about `#7c9cff`) to strong blue (about `#3a45ff`) at the bottom. Inside, a white `>` chevron with rounded stroke ends sits left of centre, and a white rounded `_` bar sits lower right, aligned to the chevron's bottom tip.
- `logo-gemini-official.png`: the Gemini logo. A four-pointed sparkle star with deeply concave curved sides and sharp tips. Its colour field is red at the top tip, yellow at the left tip, green at the bottom tip, and blue over the right tip and most of the body.

## Fixes requested by the user

1. **Codex chest emblem must match the official Codex logo.** Replace the v12 shield badge. Use the scalloped cloud silhouette, the stepped vertical lavender-to-blue gradient, and the white chevron and underscore in the official proportions and positions. The emblem sits on the white chest yoke in the same place and at about the same size as v12. If the lavender top lobes vanish against the white panel, add a 1-cell darker-blue rim. Do NOT use a black or navy outline.
2. **Gemini chest emblem must match the general visual style.** The v12 emblem's bold black outline and hard four-quadrant split look pasted on. Redraw it as the official concave four-point sparkle. Its colours follow the official placement (red top, yellow left, green bottom, blue right and body), with the blends done as 3–5 stepped pixel bands. Use **no black/navy outline**. Edge definition comes only from a 1-cell darker shade of each blade's own colour, matching how the suit's armour is shaded. Same position and about the same size as v12.
3. **Gemini visor logo must read as the Gemini logo.** Replace the v12 four-square block with a small version of the same concave sparkle, in the same colours, sitting at the top of the visor on the helmet's centre line. It should be small but recognisable as the sparkle: tips clearly pointed, sides visibly concave. Aim for about 9–11 logical cells tip to tip, and no outline.

## Pixel-art rules

- Draw every emblem deterministically in Python/PIL on the portrait's measured local pixel grid (v12 measured 12px for Codex and 13px for Gemini). Each logical cell is one flat colour.
- Translate the official gradients into 3–5 discrete stepped bands. No smooth gradients, antialiasing or blur.
- Before drawing, clear the old v12 emblem area with the surrounding panel or visor colours, as v12 did.
- Keep the shapes symmetric where the official logo is symmetric (the Gemini star's four tips are equal).

## Files

- `pfp-codex.png`, `pfp-claude.png`, `pfp-gemini.png`: final 1024×1024, opaque.
- `review-board.png`: per agent, v12 next to v13, plus a 4× zoom of each new emblem beside its official logo (scaled to the same height) and the 64px/128px circular previews.
- `inspection.json`: checklist of each fix and the count of pixels changed outside the emblem areas, which must be 0.
- Keep the scripts in this folder, plus a verify script that asserts zero changes outside the emblem masks.

Only write inside `output/art-direction/v13-agent-pfps/`. Touch nothing else and run no state-changing git commands. Do not wait indefinitely on any tool call.
