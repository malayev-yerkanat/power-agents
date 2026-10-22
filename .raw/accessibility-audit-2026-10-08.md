# Power Agents accessibility audit

Date: 2026-10-08  
Target: WCAG 2.2 AA  
Scope: current local platform at `http://127.0.0.1:4317/`; composer, history drawer, connections dialog, and an existing completed demo run.

## Remediation — 2026-10-08

The findings below preserve the original audit. A subsequent implementation addresses A11Y-01 through A11Y-05:

- Shared muted text is now `#526b8d` (5.36:1 on ivory); field borders are `#7185a0` (3.68:1 on cream).
- Header navigation and tabs wrap. Browser measurements at 320px: page width 320/320, navigation 288/288, tabs 288/288, settings 318/318 (client/scroll).
- A persistent polite status region exposes run lifecycle, phase, task and message changes.
- Native document disclosures expose expanded/collapsed state and hide collapsed bodies from the accessibility tree. The latest final remains fully visible.
- The team leader has a visible text label.
- Explicit navigation focuses the workspace heading; View Results focuses its panel. Completion no longer changes tabs automatically, and a mounted draft stays copyable. Drafts remain local component state.

Verification: production TypeScript/Vite build passed. Browser checks confirmed mobile reflow, heading focus, Escape focus return, keyboard disclosure expansion, tab Home navigation, explicit Results focus, status-region presence and leader text. These checks used an existing completed demo; no new job or notification was sent. Full VoiceOver/NVDA testing and live completion/draft-transition verification remain outstanding.

Evidence: [desktop](assets/2026-10-08-desktop-accessibility.jpg), [320px mobile](assets/2026-10-08-mobile-accessibility.jpg).

## Original audit summary

Baseline found five issues: two high priority and three medium priority. The first remediation pass addressed the confirmed issues in source and sampled browser checks. This remains a focused manual and source audit, not a complete conformance assessment.

No agent jobs were started, notifications sent, or connection settings changed during the audit or remediation pass.

## Method and limits

- Inspected rendered accessibility trees, computed styles, geometry, and keyboard behavior in the Codex in-app browser at 1280×900 and 320×800 CSS pixels. Restored the viewport override afterward.
- Reviewed client source, including asynchronous updates, form labels, dialogs, tabs, and animation controls.
- Calculated contrast from computed foreground/background colors using WCAG relative luminance. Ratios below are rounded for presentation, not threshold decisions.
- Did not run axe/Lighthouse or a full VoiceOver/NVDA session. Live planning/completion transitions were assessed in source, without starting jobs. Reduced-motion handling was inspected in source; OS-setting behavior, flashing thresholds, 200% text-only zoom, and text-spacing overrides remain unverified.

## Findings

### A11Y-01 — High: secondary text fails minimum contrast

**Baseline confirmed in rendered UI. Remediated in source and sampled browser checks. SC 1.4.3 (AA).**

Normal text requires 4.5:1; qualifying large text requires 3:1. See [W3C Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

| Example | Foreground / background | Ratio | Result |
| --- | --- | --- | --- |
| Introductory copy | `#627b9e` / `#fffdf5` | 4.25:1 | Fail |
| Muted hints and counters | `#657c9d` / `#fffdf5` | 4.19:1 | Fail |
| Team section helper text | `#6b809d` / `#fffdf5` | 3.97:1 | Fail |
| Field labels | `#5f789b` / `#fffdf5` | 4.44:1 | Fail |
| Muted heading at 320px viewport | `#7b92af` / `#fffdf5` | 3.14:1 | Fail at 21px, weight 500 |

The same heading qualifies as large text at the sampled desktop size and passes there. At 21px and weight 500 it needs 4.5:1.

**Source:** `src/client/styles.css:268`, `:291`, `:309`, `:324`, `:333`, `:516`.

**Remediation:** darkened the shared muted-text palette, strengthened low-contrast borders, and kept the approved pixel style.

### A11Y-02 — High: run lifecycle changes have no accessible announcements

**Baseline confirmed missing semantics in source and rendered run DOM. Remediated in source; transition behavior still needs a full screen-reader pass. SC 4.1.3 (AA).**

Planning, approval readiness, phase/completion updates, and message delivery feedback are ordinary text. The inspected completed-run DOM contained no live region. A user away from the changed content can miss a plan awaiting approval or work finishing. The named progress bar provides a value when encountered, but does not replace a lifecycle announcement.

**Source:** `src/client/RunWorkspace.tsx:42`, `:43`, `:45`, `:54`, `:58`; `src/client/ui.tsx:12`.

**Remediation:** added a persistent, concise `role="status"` region for status, phase, task-count, waiting-task and message-delivery changes. Combat ticks and visual effects are excluded. See [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

### A11Y-03 — Medium: ordinary navigation requires horizontal scrolling at 320px

**Baseline confirmed in rendered UI. Remediated in sampled browser checks. SC 1.4.10 (AA).**

At 320 CSS pixels, the page and main form fit, but `.header-nav` has a 288px client width and a 403px scroll width. The connections control extends beyond the visible header. Users must horizontally scroll ordinary navigation on a vertically scrolling page.

**Source:** `src/client/styles.css:300`, `:467`, `:530`.

**Remediation:** header navigation and tabs now wrap, while the spatial combat scene keeps intentional horizontal scrolling. Settings content also wraps within a 320 CSS-pixel viewport. See [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

### A11Y-04 — Medium: document preview controls omit expanded state

**Baseline confirmed in rendered DOM and source. Remediated with native disclosure semantics. SC 4.1.2 (A).**

All six sampled “Читать весь документ” buttons lack `aria-expanded` and a relationship to their document. Preview text is visually clipped using `max-height`, overflow, and a mask, while the accessibility tree exposes the full text. The control does not communicate its disclosure state programmatically.

**Source:** `src/client/RunWorkspace.tsx:55`; `src/client/styles.css:199`.

**Remediation:** non-final artifacts now use native `details`/`summary` with document-specific summary text. The latest final artifact remains fully visible.

### A11Y-05 — Medium: team leader is identified only by an unlabelled crown

**Baseline confirmed in rendered accessibility tree and source. Remediated in source and sampled browser checks. SC 1.1.1 (A).**

In “Команда и управление,” the leader has a crown SVG without a text alternative. The accessibility tree provides the member name and an unnamed image. Dynamic role text is not a reliable substitute for identifying the selected leader.

**Source:** `src/client/RunWorkspace.tsx:60`.

**Remediation:** added visible “Лидер” text and hid the decorative crown from assistive technology.

## Remediation checks

- `npm run build` passed on 2026-10-08 after the remediation changes.
- Sampled browser checks covered 320px reflow, settings dialog width, run-selection heading focus, native document disclosure expansion, explicit result navigation focus, and visible leader text.
- Full VoiceOver/NVDA traversal, live provider-state transitions, text-only zoom, text-spacing overrides, reduced-motion OS behavior and an automated scanner remain outstanding.

## Follow-up checks, not confirmed failures

- **Completion focus:** `RunWorkspace.tsx:18` automatically switches to Results on completion; `:58` removes the steering form. Verify completion while someone is reading another panel or typing. Prefer preserving their panel and announcing the available result; handle focus when removing a focused element.
- **Field boundaries:** computed input/select borders use `#bac9db` against `#fffcf4`. Review whether the low-contrast outline is necessary to identify each control, including empty fields, against SC 1.4.11. This audit did not establish a definitive failure for every field.
- **Settings reflow:** the 320px dialog measured 280px client width versus 314px scroll width. Identify the overflowing child and verify that all controls remain available without two-axis scrolling.
- **View navigation:** selecting a run returns focus to the history trigger. Consider focusing the new run heading to make the changed workspace easier to discover. This behavior alone was not counted as a WCAG failure.
- **Tabs:** consider `tabIndex={0}` on panels that begin with static content, following the ARIA tabs pattern. Not counted as a standalone WCAG failure.

## Positive observations

- Document language is Russian; sampled form controls have programmatic labels.
- History and settings use named native modal dialogs. Opening history focused its close button; Escape closed it and restored focus to the trigger. No confirmed background-focus escape was established.
- Tabs expose selection and relationships, use roving tab stops, and implement arrow/Home/End navigation. Home navigation was exercised successfully.
- Errors use `role="alert"`; Telegram feedback already uses `role="status"`.
- The progress bar has a name and values; task states have text equivalents.
- The encounter has text descriptions and an animation toggle. Source handles reduced motion and stops its clock when the document is hidden.
- Sub-24px controls were not automatically counted as failures: label hit areas, spacing, and equivalent controls must be considered under [W3C Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Recommended order

1. Correct shared text colors and narrow-screen navigation.
2. Add concise lifecycle announcements and verify completion focus behavior.
3. Correct document disclosure semantics and label the leader.
4. Recheck with VoiceOver and NVDA, keyboard-only operation, 320px reflow, text zoom/spacing, reduced motion, and an automated accessibility scanner. Include planning, approval, waiting, failure, and completion states.
