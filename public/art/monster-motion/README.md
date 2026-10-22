# Ambient monster motion — 2026-10-08

Four regenerated transparent 1448×1086 PNG sheets contain 48 key poses. They derive from the approved insect/boss references and the v8 animation studies. Originals in `output/art-direction/v8-monster-animation-studies/` remain untouched.

## Cleanup and rendering

- Regenerated edges, armor identity and pose spacing with the image-generation tool, using the approved original monster alongside each study.
- Measured 12 separate connected opaque silhouettes per sheet at alpha >=128. `inspection.json` records source bounds and ground-contact ranges.
- Crop complete silhouettes, not equal grid cells: extended claws cross nominal cell boundaries. `src/client/monsterAtlas.ts` is runtime-authoritative; `atlas.json` mirrors it for the review page.
- One fixed scale per monster: insect110 logical pixels tall in neutral stance; boss134. Poses are never individually stretched to fit.
- Right ground-contact edge anchors each pose; all ground baselines align. A192×176 logical canvas provides attack padding around the original160×160 footprint. Display384×352 at integer2×, offset(-32,-32) inside the existing320×320 scene actor box.
- Nearest-neighbor sampling and binary alpha128 run in the canvas renderer. Source PNGs retain their generated resolution/transparency; they are not certified native-grid exports.

## Sequences

| Monster | Idle gestures | Attacks |
|---|---|---|
| Insect | breathing, roar, stomp | sickle slash, overhead cleave, spit windup/lunge |
| Boss | breathing, roar, stomp | claw swipe, ground slam, core-charge gesture |

Calm breathing alternates the first two idle poses. Five occasional gestures each use four key poses with anticipation, strike and recovery holds, separated by3.4–5.6seconds of rest. Schedules differ between actors. Dust appears on the stomp/slam strike; emitted projectiles/beam artwork is not included.

## Integration and limits

`AnimatedCityMonster.tsx` draws only on pose changes. City pause, collapse, reduced motion and hidden-tab state freeze playback; resume preserves the remaining frame hold. Load/render failure falls back to the approved static sprite. The task/run Encounter remains separate and unchanged.

[Frame inspection page](./review.html) shows the exact normalized poses and baseline. Open via the local app at `/art/monster-motion/review.html`; it requires HTTP.

All48 normalized poses were visually inspected in-browser. Production typecheck/build passed; sampled playback, pause/resume and collapse behavior were checked. No automated tests or live provider jobs were run. Minor generated facial/armor variation remains. These are implemented four-key-pose animations, not fully hand-authored inbetweened loops; further polish can add transition frames without changing the atlas contract.
