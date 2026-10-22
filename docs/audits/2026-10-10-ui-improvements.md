# Power Agents UI improvement audit — 2026-10-10

This audit records the completed work-first UI pass against synthetic browser data. It does not certify live provider execution, Telegram delivery, a screen reader, or production state. The browser ran against standalone Vite at `127.0.0.1:4318`; `tests/e2e/fixtures.ts` intercepted `/api/**`, supplied fabricated connections and runs, rejected unexpected mutations, and replaced EventSource. No `npm run dev`, local SQLite database, provider, or private workspace was used for screenshots.

## Verification

The final integration checkpoint reported these results after Task 10:

| Check | Result |
| --- | --- |
| `node --import tsx --test --experimental-test-coverage --test-coverage-lines=80 tests/*.test.ts` | 128/128 Node tests passed; 80.90% overall line coverage, above the 80% gate |
| `npm run test:e2e` | 35/35 synthetic Chromium tests passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; Vite still warns that a bundle chunk exceeds 500 kB |
| `npm audit --audit-level=high` | 0 vulnerabilities reported |

The browser suite covers creation, result order, drafts and storage failure, direct links and browser history, loaded-page history search, validation focus, paused recovery, keyboard tabs and dialogs, reduced motion, mobile targets, and responsive widths. It uses mocked transport and does not establish engine behavior; the Node/HTTP/session suite remains the integration check for those contracts.

## Screenshots and measured layout

All screenshot text is synthetic. Each image is a viewport capture, not a full-page composite.

| View | Evidence | Measured result |
| --- | --- | --- |
| Desktop creation, 1440×900 | [desktop-create](assets/2026-10-10-ui-desktop-create.png) | Goal field top 384px; page scroll width 1440px |
| Completed run, 1440×900 | [desktop-result](assets/2026-10-10-ui-desktop-result.png) | Accepted-result label top 628px, with document heading visible in first viewport; page scroll width 1440px |
| Mobile creation, 390×844 | [mobile-create](assets/2026-10-10-ui-mobile-create.png) | Goal field top 552px; page scroll width 390px |
| Narrow creation, 320×812 | [mobile-320](assets/2026-10-10-ui-mobile-320.png) | With `overflow-y: scroll` and `scrollbar-gutter: stable`, content scroll width 305px in a 320px viewport; no page overflow |
| Tablet creation, 768×1024 | [tablet](assets/2026-10-10-ui-tablet.png) | Page scroll width 768px; goal field top 423px |
| Paused review, 1440×900 | [recovery](assets/2026-10-10-ui-recovery.png) | Latest review and clarification action visible before optional team scene; no page overflow |

In the six captures, the browser reported no requests to external origins. In separate fixture checks, there were zero `monster-motion` requests before expanding the city and four after expansion. The city rendered on expansion, while the 320px five-member composer and settings dialog each stayed at 320px page width. A native `details` team control opened with Enter. Reduced-motion media preference was active; the browser test also asserts paused city animation after expansion. A rejected clipboard write displayed the manual-copy fallback notice.

A long-title/long-document sample at an effective 720 CSS-pixel viewport with device scale 2 had a 720px page scroll width. This checks responsive reflow under a narrower CSS viewport; it is not a manual 200% browser-zoom or assistive magnification test. The document table and code container use local horizontal scrolling by design. The 320px persistent-scrollbar sample reserves gutter space in headless Chromium, whose screenshot process hides native scrollbar chrome; it does not prove every platform scrollbar style.

## Behavior and remaining limits

The city is collapsed by default and retains its prior expanded pixel scale. The composer places the goal before team details. Completed runs open the accepted Markdown document before an optional encounter; current-run completion keeps the selected tab. Markdown renders headings, lists, tables, links and code while skipping raw HTML and replacing remote images with text; original source remains viewable, copyable and downloadable. Paused/failed runs expose latest-review context when available and keep clarification and resume as separate actions.

Creation and run-specific steering drafts use validated `sessionStorage` envelopes in the current browser tab. Failed requests keep text, a completed run keeps steering read-only for copying, and blocked storage shows a notice. Fragment routes preserve run/tab context; direct links resolve run detail even when the summary is not loaded. History search and status filtering cover loaded pages only and retain older-page loading. Invalid fields receive linked messages and focus; narrow layouts use larger controls.

The server schema, provider execution, Telegram delivery, SSE protocol, and persistence contract did not change in this UI pass. This evidence does not include VoiceOver/NVDA testing, WCAG contrast-ratio measurement, manual true browser zoom, a live provider run, or a production service restart. Full-history server search, named team presets, archive/rename, and new sprite production remain separate work.
