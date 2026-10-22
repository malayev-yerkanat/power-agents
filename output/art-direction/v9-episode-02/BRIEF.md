# Episode 02 asset brief: "The Second Wave"

New visual assets for the 30-second vertical Power Agents reel (1080×1920). These replace the procedural shapes in the first Episode 02 cut. **The three agent Rangers are NOT redesigned.** Their approved sprites are only style and scale references.

Status: **concept assets awaiting user approval.** Nothing here is wired into the reel yet.

## Style references (read-only; do not modify)

- Agents, style and pixel density:
  - `public/art/codex.png` (blue Ranger with straight saber)
  - `public/art/claude.png` (orange Ranger with rigid staff)
  - `public/art/gemini.png` (cyan Ranger)
- Approved environment treatment: `public/art/city-v2/panorama.png`
- House rules: `wiki/decisions/Pixel Art Consistency.md`

## Visual rules for every asset

- Detailed 32-bit console-era arcade pixel art (mid-90s Saturday-morning ranger-team show meets arcade beat-'em-up). It must match the Ranger sprites' medium.
- Visible pixel clusters on a coherent grid, dark navy outlines, three to five stepped shades per material.
- No smooth painting, airbrush, vector look, 3D render, glossy illustration or blur.
- Side-on, slightly three-quarter arcade camera, same as the Rangers.
- Agent palette accents: Codex lavender-blue `#b8b9ff`, Claude orange `#ffad80`, Gemini cyan `#7ed8ff`, plus ivory `#fff4da` and navy `#10182b`.
- **No text, letters, numbers, logos or UI** in any image. All words are added in code later.
- No franchise imitation: no Power Rangers helmets, logos, Zords, Megazord shapes or show characters. Every design must be original.
- Sprites go on a genuinely transparent background with about 6% margin, full body, nothing cropped. Characters face LEFT unless noted, because the Rangers face right toward them.

## Assets to generate (one PNG each)

| # | File | Kind | Description |
|---|---|---|---|
| 1 | `bg-villain-lair.png` | Portrait 2:3 background, opaque | Interior of an orbiting villain fortress. A throne platform in the lower middle stays empty for the villain sprite. A huge circular window behind shows the night-time city and planet below. Purple/magenta and sickly-green lighting, alien machinery, hanging cables. |
| 2 | `bg-city-battle.png` | Portrait 2:3 background, opaque | Street-level battle stage in a modern city at dusk: skyscrapers, damaged road, scattered debris, small fires and smoke. A clear flat ground plane in the lower third for fighters; open sky in the upper third for UI. Not the existing panorama; a new composition with the same treatment. |
| 3 | `bg-command-desk.png` | Portrait 2:3 background, opaque | Commander's desk at night. Close-up of a laptop at desk level, seen front-on with its screen facing the viewer as a plain flat light rectangle (UI is overlaid later), a phone lying face-up to the right with a blank dark screen, a mug, warm lamp light and the city glow through a window. |
| 4 | `bg-sunrise-rooftop.png` | Portrait 2:3 background, opaque | Rooftop at sunrise after the battle. Stepped-gradient sky (deep purple to orange to gold), skyline silhouettes, a flat rooftop edge across the lower third for a hero pose, distant smoke clearing. |
| 5 | `bg-title-burst.png` | Portrait 2:3 background, opaque | Title-card backdrop: a dramatic radial speed-burst with three diagonal energy stripes (lavender-blue, orange, cyan) on deep navy, pixel sparks. Leave the centre calm for large title text. |
| 6 | `villain-commander.png` | Transparent sprite | NEW villain overlord, distinct from every existing villain asset. A tall armoured alien tyrant with a long cape, a sceptre topped by a ticking-clock crystal and a horned crown-helmet. Purple/black/gold. Pointing forward with menace. |
| 7 | `deadline-beast.png` | Transparent sprite, facing left | The monster of the episode: a hulking kaiju built from clockwork and paperwork. Clock-face chest, calendar-page plates, hourglass shoulders, claws made of fountain-pen nibs. Red/rust/brass. Fighting stance. |
| 8 | `deadline-beast-giant.png` | Transparent sprite, facing left | The same Deadline Beast after the villain's power-up: larger, glowing cracks, extra spikes, roaring with arms raised. The design must clearly be the same creature. |
| 9 | `minion-shield.png` | Transparent sprite, facing left | A foot-soldier minion made of stacked sticky notes and paper clips, holding a hexagonal energy shield in front of itself (cyan glow). |
| 10 | `agent-megabot.png` | Transparent sprite, facing left | An ORIGINAL giant combining robot, not a Megazord. Legs from a lavender-blue jet (Codex), torso from an orange heavy truck (Claude), arms and head from a cyan drone (Gemini). Heroic standing pose, visor eyes, chest core glowing. |
| 11 | `agent-megabot-strike.png` | Transparent sprite, facing left | The same Megabot mid-strike, swinging a giant glowing energy saber down diagonally, with motion pixels on the blade. |
| 12 | `vehicle-jet.png` | Transparent sprite, flying left | Codex's lavender-blue fighter jet; parts visibly suggest robot legs. |
| 13 | `vehicle-truck.png` | Transparent sprite, driving left | Claude's orange armoured heavy truck; it visibly suggests a robot torso. |
| 14 | `vehicle-drone.png` | Transparent sprite, flying left | Gemini's cyan quad-rotor drone; it visibly suggests robot arms and head. |
| 15 | `fx-sheet.png` | Transparent 3×2 effect sheet | Six separate effects in a grid, each well separated: (1) fiery explosion, (2) white-blue sword slash arc, (3) glowing data orb (lavender-blue), (4) cyan hexagonal shield shattering into shards, (5) purple lightning bolt, (6) gold impact star burst. |

## Output

- Save to `output/art-direction/v9-episode-02/` using the file names above.
- Record every exact prompt in `PROMPTS.md`.
- Write `inspection.json`: pixel dimensions, whether alpha exists, the fraction of transparent pixels, and any visible drift or defects you notice per file.
- Do not edit application code, `public/`, the reel project or any other asset.
