# Airy Pixel design refinement

Date: 2026-10-08. Applied `redesign-existing-projects`, `design-taste-frontend`, and `emil-design-eng` to the existing React/TypeScript/Tailwind 4 interface.

The user's approved minimal 32-bit direction takes precedence over generic skill suggestions for rounded surfaces, glass, magnetic controls, smooth sprite scaling or continuous decorative UI motion. Existing ivory/cobalt colors, pixel headings, readable prose, C1/L1 weapons, city assets and combat behavior remain authoritative.

## Design changes

| Before | After | Why |
| --- | --- | --- |
| Text-only setup introduction | Selected squad beside a concise briefing | Establishes Ranger identity before execution |
| Similar heavy frames around most sections | Strong goal/final-result emphasis, quieter roster and panel boundaries | Makes the main actions easier to identify |
| Index-colored initials | Provider-colored pixel monograms | Keeps identity consistent when participants are reordered |
| Large boxed tabs and nested message cards | Underlined tabs and separated discussion rows | Reduces visual density without removing information |
| Repeated hard-edged panels with uniform emphasis | Consistent rules, restrained offset shadows and deliberate spacing | Retains the pixel character with more hierarchy |
| Small prose and very long display titles | More readable document text and restrained run titles | Improves scanning and reading |
| Generic browser tab and repeated navigation | Pixel-bolt favicon and keyboard skip link | Adds product identity and direct content access |

## Scope

- `SquadPreview.tsx`: decorative, selected 2–5 member formation; native 160×160 frames; neutral fallback for unknown providers.
- `Composer.tsx`: concise introduction and sequential goal/team sections; existing controls and submission contract retained.
- `ui.tsx`: provider identity for monograms, independent of operational roles.
- `workspace-polish.css`: focused refinement layer loaded after existing theme/scene CSS; no new library.
- `App.tsx`: skip link; `index.html` and `public/favicon.svg`: browser identity.

## Verification

- TypeScript and Vite production build passed.
- Desktop composer and existing paused/completed run views inspected.
- At 320 CSS pixels, page width remained 320; navigation and tabs measured 288 client/288 scroll; settings measured 318/318.
- Five-member preview rendered all five loaded images at 160×160 CSS pixels without page overflow.
- Skip link moved focus to `workspace-heading`; tab Home navigation selected and focused Tasks; dialog Escape restored its trigger.
- No new agent jobs or Telegram notifications were sent. No automated test suite, full screen-reader session, or new artwork production was performed for this visual pass.

## Captured views

[Mobile composition at 320 CSS pixels](assets/2026-10-08-design-mobile.jpg).

![Refined composer](assets/2026-10-08-design-composer.jpg)

![Refined run workspace](assets/2026-10-08-design-workspace.jpg)
