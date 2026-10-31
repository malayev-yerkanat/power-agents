# v10 agent profile pictures brief

Square profile pictures (avatars) for the three agent Rangers, in the approved Power Agents pixel style. The agents are NOT redesigned: each portrait is a close-up bust of the existing approved sprite's helmet and costume.

Status: **concept assets awaiting user approval.** Nothing here is wired into the app.

## Layout reference (composition only)

`reference-layout.webp` is a user-supplied example of the wanted layout. Copy only its composition:

- Square 1:1 frame, head-and-shoulders bust, helmet front-on, filling about 70% of the frame height.
- A thick solid ring in the agent's accent colour, centred, with the shoulders breaking out of the bottom of the ring.
- Bright background of diagonal speed stripes behind the ring.

Do NOT copy its character, its helmet design, its smooth vector/low-poly rendering or any franchise element. It is a Power Rangers image; our designs must stay original.

## Character references (read-only; do not modify)

- `public/art/codex.png`: blue/lavender Ranger (Codex)
- `public/art/claude.png`: orange Ranger (Claude)
- `public/art/gemini.png`: cyan Ranger (Gemini)
- House rules: `wiki/decisions/Pixel Art Consistency.md`

Each portrait must keep that Ranger's helmet shape, visor, costume colours and markings recognisable from its sprite. Weapons are not needed.

## Visual rules

- Detailed mid-1990s 32-bit console-era arcade pixel art, same medium as the Ranger sprites. Visible pixel clusters on a coherent grid, dark navy outlines, three to five stepped shades per material.
- No smooth painting, airbrush, gradients without steps, vector look, 3D render, glossy illustration, blur or antialiasing.
- Accent colours: Codex lavender-blue `#b8b9ff`, Claude orange `#ffad80`, Gemini cyan `#7ed8ff`, plus ivory `#fff4da` and navy `#10182b`.
- Background stripe palette per agent, chosen so the ring and helmet contrast strongly (for example Codex: navy to lavender stripes; Claude: gold to coral stripes; Gemini: teal to mint stripes).
- No text, letters, numbers, logos or UI.
- No Power Rangers helmets, logos, Zords or show characters.
- Opaque background, full bleed, nothing important cropped by a circular avatar mask (keep the helmet inside the central circle).

## Files to generate (one PNG each, 1024×1024)

| File | Agent |
|---|---|
| `pfp-codex.png` | Codex |
| `pfp-claude.png` | Claude |
| `pfp-gemini.png` | Gemini |

Also make `review-board.png`: the three portraits side by side, plus each one shown inside a circular mask at 64px and 128px (nearest-neighbour), so small-size readability can be judged.

## Output

- Save everything to `output/art-direction/v10-agent-pfps/`.
- Record every exact prompt in `PROMPTS.md`.
- Write `inspection.json`: pixel dimensions per file and any visible drift from the sprite or defects you notice.
- Do not edit application code, `public/`, the wiki or any other asset.
