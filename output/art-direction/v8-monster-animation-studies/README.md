# Monster animation pose studies

**Status: generated studies, not implementation-ready animation sheets.** Built-in imagegen created four transparent PNG sheets using the approved `public/art/villain-monster.png` and `villain-boss.png` as identity/style references. Source sheets are saved unchanged. The live application is unchanged.

Open [index.html](index.html) in a browser for a paused-by-default frame viewer. Play, pause, frame stepping and 4/6/8fps options expose the current pose sequence. It displays raw cells without alignment repair.

## Pack

Each sheet contains four columns × three rows (12 poses), read left-to-right. All files are 1448×1086 RGBA, giving exact 362×362 source cells. Proposed future runtime frames: 160×160 logical pixels with stance baseline144; final export conventions remain to be agreed during animation production.

| Monster | Sheet | Row1 | Row2 | Row3 |
| --- | --- | --- | --- | --- |
| Green insect | [mantis-idle.png](mantis-idle.png) | Breathing | Roar | Stomp |
| Green insect | [mantis-attacks.png](mantis-attacks.png) | Sickle slash | Double cleave | Spit wind-up/release |
| Red boss | [boss-idle.png](boss-idle.png) | Breathing | Roar | Stomp |
| Red boss | [boss-attacks.png](boss-attacks.png) | Claw swipe | Ground slam | Chest-core blast |

Total: **48 poses / 12 four-pose sequences**. Projectile, beam, dust and shockwave artwork is intentionally separate from these character studies.

## Inspection

- Visually inspected all four generated sheets: three rows and four poses each, recognizable monster identities, articulated arms/knees/torso and clear attack silhouettes. Some facial and armor details drift from the approved reference and between frames.
- Confirmed RGBA and alpha range0–255 for every sheet. Semi-transparent outline/halo pixels remain; this is not a certified binary-alpha export.
- Measured opaque cell bounds at alpha≥128; see [inspection.json](inspection.json). Frames are not aligned to the intended90% stance baseline (326 sourcepixels). Idle sheets place feet around342–358px for the boss and322–344px for the insect, depending on the row.
- Boss attack row1/column2 has opaque content touching the cell bottom; neighboring raised-arm artwork is near the row boundary. Mantis attack reach extends close to neighboring cells. Raw grid slicing can clip or import adjacent pixels: extraction rectangles must be reviewed before export.
- Breathing peak changes arm pose more than an ideal subtle idle; it needs simplification. Roar/stomp and attack studies are event sequences, not verified seamless loops. Recovery poses differ from the approved neutral frame.
- Lighting and palette are broadly consistent, but pixel density, geometry, precise colors and limb volumes are not certified frame-consistent. The viewer deliberately exposes these issues rather than hiding them with interpolation.

## Next animation-production pass

1. Approve pose directions and retain one neutral master per monster.
2. Correct costume/face drift, cross-cell contacts and silhouette margins.
3. Extract and align each pose to160×160 with a stable grounded support foot and baseline144; raised feet must retain their actual lift.
4. Start with one breathing pilot per monster. Refine/inbetween until the loop returns cleanly to its first frame.
5. Time attacks as anticipation → strike → recovery. Suggested studies: idle120–250ms holds, attacks60–140ms strike frames and longer recovery. Verify in context rather than treating these as final timings.
6. Add separate projectiles/dust and connect sequences to runtime states only after visual approval and alignment/loop checks.

[Prompts](PROMPTS.md) document requested constraints; generated outputs do not automatically satisfy those constraints.
