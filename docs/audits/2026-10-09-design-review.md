# Design Review: Power Agents

**Date:** 2026-10-09  
**URL:** http://127.0.0.1:4317/  
**Score:** **Needs Improvement**  
**Skills:** `ui-review` and `frontend:design-review`  
**Scope:** Review only. No application implementation, configuration, or run data changed.

## Overall Impression

Power Agents has a recognizable visual identity and a reasonably coherent interface. Ivory surfaces, cobalt actions, square frames, pixel headings, and readable prose belong together. The main weakness is the allocation of attention: the decorative city and encounter scene receive more prominence than starting work, reading the deliverable, or resolving an interrupted run. It feels like a distinctive prototype with an unfinished everyday working experience.

The approved Airy Pixel direction is the standard for this review. Changing to Inter everywhere, rounding the panels, removing provider identity colors, or imposing the skill's generic six-pixel spacing rule would conflict with the project's decisions. Those are not recommended fixes.

## Evidence and limits

- Inspected the running production client and current working-tree source, including existing uncommitted changes. The served bundle was `index-CWvHTzI9.js`; local build timestamp was October 8, 18:52, later than the inspected client source timestamps.
- Browser checks: 1440×900 desktop, 768×1024 tablet, 390×844 phone, and 320×812 narrow viewport. Viewport override was reset afterward.
- Inspected creation, history, completed demo results, a paused real run, connection settings, and Telegram settings as displayed. Tested a deliberately short goal rejected locally before any request, draft loss on navigation, tab keyboard navigation, and dialog Escape/focus return.
- No runs were started, approved, resumed, or cancelled. No model prompts or Telegram messages were sent. Existing runs supplied the state coverage.
- Active execution and plan approval were reviewed in code, not exercised end to end. No screen-reader session, complete contrast audit, or performance benchmark was performed. Light mode is the implemented theme; no dark theme/toggle exists to validate.
- Screenshot files are local review evidence, not published assets. Screenshot scale in a viewer should not be treated as proof of font rasterization quality.

## Findings

### High priority

#### 1. The first screen prioritizes decoration over the task

**Observed:** At 1440×900, the goal textarea starts around document Y=952, below the first viewport; “Составить план” starts around Y=2135. At 390px, the input starts around Y=1246 and submit around Y=3181. A 448px city, large introduction, and squad preview precede the first useful field. The large header action says “Новая задача” while the user is already creating one.

**Impact:** The product initially reads as a scene to watch. The user's main next action is not visible, even on a substantial desktop viewport. This is the highest-impact design correction, not a request to remove the city.

**Proposed change:** Offer a compact city presentation during task creation, bring the goal into the initial viewport, and make team defaults usable without reading three fully expanded configuration rows. Preserve full-size artwork in an explicit expanded view; do not shrink sprites inconsistently.

**Source:** [App.tsx:219](../../src/client/App.tsx), [city-backdrop.css:5](../../src/client/city-backdrop.css), [Composer.tsx:65](../../src/client/Composer.tsx), [workspace-polish.css:23](../../src/client/workspace-polish.css).

![Desktop entry: artwork and introduction precede the goal](assets/2026-10-09-design-review/01-desktop-entry.png)

#### 2. Completed work still prioritizes the encounter over the result

**Observed:** Opening an existing completed demo correctly selects Results, but the page first presents a long title, demo banner, large empty-of-tasks battle scene, roster, motion controls, and task progress. The accepted document is below the first desktop viewport. The encounter has no collapse control.

**Impact:** The primary value of reopening a completed run—reading or downloading its result—is visually secondary to a scene that has finished conveying progress.

**Proposed change:** Make the accepted document and a labelled download action the primary completed-state surface. Collapse the encounter to a compact completion summary with an optional expansion. Keep the animated workspace prominent during active execution.

**Source:** [RunWorkspace.tsx:49–61](../../src/client/RunWorkspace.tsx), [workspace-polish.css:92](../../src/client/workspace-polish.css).

![Completed run before the result becomes visible](assets/2026-10-09-design-review/04-completed-first-viewport.png)

### Medium priority

#### 3. The document reader displays Markdown source instead of document structure

**Observed:** The accepted result visibly shows literal `#` headings and separators. Every artifact is rendered in a `<pre>`; Markdown links, lists, tables, and headings cannot acquire their intended semantics. Readable body font and a 72ch maximum width are already good choices, but they do not supply document structure.

**Proposed change:** Add a safe Markdown renderer with a restrained document typography system, table overflow handling, and an optional source view. Keep the existing Markdown download. Do not allow arbitrary raw HTML from model outputs.

**Source:** [RunWorkspace.tsx:61](../../src/client/RunWorkspace.tsx), [workspace-polish.css:116](../../src/client/workspace-polish.css).

![Literal Markdown in the accepted result](assets/2026-10-09-design-review/05-result-reader.png)

#### 4. Drafts and navigation context disappear

**Observed:** Entered `UI audit`, opened an existing run, returned to creation: the goal was blank. Goal/team settings and run/tab selection are component state. Reloading also has no run URL to restore. Steering drafts have the same documented navigation limitation.

**Impact:** Checking previous work while composing a new task can silently discard input. Runs cannot be bookmarked directly.

**Proposed change:** Persist creation drafts and team settings locally with a clear reset action; put selected run/tab in the URL. Preserve per-run steering drafts or warn before discarding them. Keep draft storage explicitly local.

**Source:** [Composer.tsx:18–24](../../src/client/Composer.tsx), [App.tsx:45](../../src/client/App.tsx), [App.tsx:220](../../src/client/App.tsx), [RunWorkspace.tsx:14–15](../../src/client/RunWorkspace.tsx).

#### 5. Validation reports the error far from the field to fix

**Observed:** Submitting the eight-character goal was rejected locally, but focus stayed on “Составить план.” At phone width the goal field was approximately 1383px above the visible viewport. Its `aria-invalid` was absent; the general alert was below all participant settings.

**Proposed change:** Return field/member-specific validation errors, display them next to their inputs, connect them with `aria-describedby`, set `aria-invalid`, and focus the first invalid input. Retain the existing announced error summary.

**Source:** [Composer.tsx:54–57](../../src/client/Composer.tsx), [Composer.tsx:76](../../src/client/Composer.tsx), [Composer.tsx:95](../../src/client/Composer.tsx).

![Mobile validation: the error is visible, but its field is far above](assets/2026-10-09-design-review/09-mobile-validation.png)

#### 6. “Все задачи” has the wrong destination, and history is hard to manage

**Observed:** “Все задачи 10” closes history and shows “Соберите команду. Дайте ей задачу.” It invokes the same `select(null)` as “Новая задача.” History has a chronological list and pagination, but no search, status filter, rename, archive, or full-title reveal before opening a truncated entry.

**Proposed change:** Correct the destination or rename/remove the duplicate item. For a subsequent product pass, prioritize searchable/filterable history and clear full titles before additional decoration. Rename/archive are useful missing capabilities, not regressions in an implemented feature.

**Source:** [App.tsx:203–207](../../src/client/App.tsx), [styles.css:42](../../src/client/styles.css).

[History screenshot](assets/2026-10-09-design-review/03-history.png).

#### 7. Phone controls and secondary labels are too small

**Measured:** Download and close buttons are 32×32px; header/city controls are 36px high; encounter animation is 28px high. The creation eyebrow is 9px and several navigation/section labels are 10–11px. Small pixel lettering adds reading effort even where contrast is adequate.

**Proposed change:** Establish a shared 44px interaction area on touch layouts while keeping small icons inside it. Raise functional secondary text to at least 12px and use the prose face for dense metadata. Keep pixel type for short, distinctive headings and controls.

These measurements fall below the invoked skill's 44px target guideline; they do not by themselves prove a WCAG AA failure, which has different target-size criteria and exceptions.

**Source:** [styles.css:97](../../src/client/styles.css), [workspace-polish.css:25](../../src/client/workspace-polish.css), [workspace-polish.css:63](../../src/client/workspace-polish.css), [workspace-polish.css:96](../../src/client/workspace-polish.css), [workspace-polish.css:174–176](../../src/client/workspace-polish.css), [city-backdrop.css:36](../../src/client/city-backdrop.css).

[Phone results](assets/2026-10-09-design-review/06-mobile-results.png) · [Phone connections](assets/2026-10-09-design-review/07-mobile-connections.png).

#### 8. Narrow screens have an overflow edge case; tablet composition is awkward

**Measured:** With a 320px viewport and a non-overlay vertical scrollbar, the document's available width was 305px while its content remained 320px. A page-level horizontal scrollbar appeared. `body { min-width: 320px }` causes this; it is separate from the intentionally scrollable encounter. At 390 and 768px, sampled document width fit the available space.

**Observed at 768px:** The intro remains two columns with a fixed 288px squad preview, producing a four-line headline beside small figures. The panorama crops both large monsters at opposite edges. Cropping is intentional, but this breakpoint's composition is weak and still puts the input below the fold.

**Proposed change:** Remove the body minimum-width dependency and validate against `documentElement.clientWidth`, including visible scrollbars. Switch the intro to its stacked layout earlier or rebalance its columns. Choose a deliberate tablet crop while retaining the artwork's pixel scale.

**Source:** [styles.css:13](../../src/client/styles.css), [workspace-polish.css:23](../../src/client/workspace-polish.css), [workspace-polish.css:156–160](../../src/client/workspace-polish.css), [city-backdrop.css:13](../../src/client/city-backdrop.css).

[320px overflow evidence](assets/2026-10-09-design-review/10-mobile-320-entry.png) · [Tablet composition](assets/2026-10-09-design-review/11-tablet-entry.png).

#### 9. Review-blocked runs do not lead directly to the problem

**Observed:** An existing paused run says “После трёх проверок остались замечания. Уточните задачу перед продолжением.” Its primary button is “Продолжить,” while the actual review reports are under Results and the clarification composer follows the task list. The scene takes most of the remaining viewport. All three tasks show complete while the run still needs synthesis/review; that task count is technically correct but does not explain what remains.

**Proposed change:** Show the latest review's unresolved points beside the pause explanation, provide a direct “Посмотреть замечания”/clarification action, and distinguish task completion from overall workflow stage. Keep resume available after the user can understand the reason for the pause.

**Source:** [RunWorkspace.tsx:40](../../src/client/RunWorkspace.tsx), [RunWorkspace.tsx:45–52](../../src/client/RunWorkspace.tsx), [RunWorkspace.tsx:61–64](../../src/client/RunWorkspace.tsx).

[Paused-run recovery view](assets/2026-10-09-design-review/12-paused-recovery.png).

#### 10. Hidden decoration still loads substantial artwork

**Code-confirmed:** Collapsing the ambient city uses `hidden` while keeping its component subtree mounted. Each monster immediately constructs and loads idle/attack images. The four source sheets total about 6.2 MiB on disk; other city assets also mount. This is not a measured network-transfer or load-time figure.

**Proposed change:** Defer decorative image/component initialization until the first expansion, then retain loaded resources. Prioritize workspace readiness over loading invisible art.

**Source:** [CityBackdrop.tsx:37–46](../../src/client/CityBackdrop.tsx), [AnimatedCityMonster.tsx:37–54](../../src/client/AnimatedCityMonster.tsx).

### Low priority / maintenance

#### 11. Styling is consistent in appearance but expensive to reason about

Five stylesheets form a layered override chain. `.goal-card`, typography, navigation, and control heights are repeatedly redefined. Many surface, border, shadow, and state colors remain literal values. The visible interface is substantially more coherent than the underlying stylesheet organization.

**Proposed change:** Consolidate effective component styles and introduce semantic tokens for surfaces, borders, text levels, shadow offsets, control heights, and motion durations. Do not flag every hex value in artwork or every non-six-pixel gap as a product defect. Generic `cn()`, `data-slot`, and `React.ComponentProps` conventions are not established requirements for these purpose-specific components.

**Source:** [main.tsx:4–8](../../src/client/main.tsx), [styles.css:70](../../src/client/styles.css), [styles.css:507](../../src/client/styles.css), [workspace-polish.css:37–40](../../src/client/workspace-polish.css).

## What is missing beyond the confirmed defects

These are capability gaps or proposed improvements, not claims that existing functionality is broken:

- **Everyday continuity:** saved drafts, run deep links, remembered tabs, reusable team configurations.
- **History management:** search/filter, descriptive editable titles, archive, useful empty/search states.
- **A complete reading experience:** formatted Markdown, obvious copy/download controls, and clearer grouping of the accepted final, earlier versions, and review findings. A version comparison would help later.
- **Readiness guidance:** connection discovery is implemented and honestly labelled, but first-run authentication/model access still requires a real call. A future explicit diagnostic should distinguish executable detection, authentication, model availability, and billing, without silently spending quota.
- **Operational visibility:** a compact plan → tasks → synthesis → review stage summary and clearer recovery entry points. Existing event logs, status announcements, and task progress are useful foundations.
- **Intentional prototype limits:** attachments, general MCP/tool execution, edits to external repositories, monetary budgets, and multi-user/public hosting are not implemented. README and prototype documentation say so. They should remain roadmap scope, not be implied by the current UI. Dark mode is likewise unsupported rather than broken.

## What Looks Good

- Distinctive, consistent Airy Pixel identity; cobalt action color and quiet reading surfaces work well.
- The workspace already separates tasks, discussion, results, and journal instead of showing everything at once.
- Latest final result is expanded; secondary documents use native disclosure controls.
- Native history/settings dialogs, labelled controls, skip link, navigation heading focus, and status announcements provide a solid accessibility base.
- Keyboard End selected/focused Journal; Escape closed settings and returned focus to its trigger in the inspected browser.
- Reduced-motion/hidden-tab handling and independent city/encounter motion controls exist in code. Decorative artwork is excluded from the accessibility tree.
- Status labels include text/icons; provider colors have identity meaning. Demo results are explicitly distinguished from model output.
- Most tested layouts wrap without general horizontal overflow; the encounter's own horizontal scroll is explained to users.

## Top 3 Fixes

1. **Rebalance attention by state:** compact city during creation, visible goal, result-first completion, and problem-first recovery.
2. **Make documents useful inside the app:** formatted Markdown, clear accepted result, accessible download/copy actions, and review findings near the action they inform.
3. **Protect everyday use:** preserve drafts/navigation, correct the history destination, and repair field validation, touch sizes, and narrow-screen overflow.

No fixes were implemented as part of this review.
