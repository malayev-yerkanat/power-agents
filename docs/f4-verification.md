# F4 media pipeline — implementation and verification

Implemented 2026-10-30 against the F4 and pipeline-step contract in
[the approved workspace plan](../.claude/plans/reel-flow-workspace.plan.md).
Telegram flow approvals remain planned for F5.

The live flow now supports approved Script → ElevenLabs Voice → timed Scenes →
uploaded Studio Capture → deterministic Edit → Preview → QA → Final. Media logic
lives in the content project, behind isolated JSON-in/JSON-out Python stages.
The server resolves upstream values/files, schedules and cancels processes,
records human-action failures, streams uploads and serves versioned media.
Cards and the inspector expose uploads, playable files and human-action status.
Retained media keeps its producing output version during reruns and failures.

## Verification

| Check | Result |
| --- | --- |
| `node --import tsx --test tests/flow*.test.ts` | **62/62 pass**, no skips or cancellations |
| `node --import tsx --test tests/flow*.test.ts tests/i18n.test.ts` | **65/65 pass**, including all English dictionary/placeholder checks |
| `npm test` | **242/259 pass**, **17 fail**, all `listen EPERM`; no skips/cancellations |
| `npm run typecheck` | PASS, zero TypeScript errors |
| `npm run build` | PASS; existing non-blocking Rollup annotation and bundle-size warnings |
| `npm run test:coverage` | **242/259 pass**, same 17 EPERM failures; **83.08% line coverage**, 87.72% branches, 81.81% functions |
| `npm run test:e2e` | Vite startup fails with `listen EPERM` at `127.0.0.1:4318`; **0 tests executed** |
| `npx --no-install playwright test --list` | **40 scenarios discovered**, including the new Capture upload/media scenario |
| Content: `python3 -m unittest discover -s pipeline/tests` | **21 tests: 20 pass, 1 skip**, zero failures; local ElevenLabs HTTP stub skips only for sandbox bind EPERM |
| Content: `./edit/node_modules/.bin/tsc -p edit/tsconfig.json --noEmit` | PASS, zero TypeScript errors, using installed Remotion 4.0.290 |
| Content: Python stdlib trace coverage | **322/352 executable stage lines (91.5%)**; voice 92.0%, capture 93.1%, edit 94.8%, render 93.3%, QA 89.4%, helper 86.3% |
| Content: composition/metadata assertions | **7/7 pass**, no rendering |
| Source review | No remaining blocking correctness/security findings |
| `git diff --check` | PASS |
| Lint | Neither project defines a lint command; TypeScript checks were run |

The 17 Node listener failures are all 14 cases in `tests/http.test.ts`,
the occupied-port preflight in `tests/launchd.test.ts`, the team-tool security
integration in `tests/mcp.test.ts`, and the settings API case in
`tests/telegram.test.ts`. The socket-free flow API tests pass, including session,
CSRF/origin, a raw upload larger than the 64 KiB JSON limit, encoded filenames,
2 GiB header rejection, Range 206/416 and traversal 404.

The listener-blocked cases, listed individually:

1. Model catalog requires a session and rejects unknown connections.
2. Bootstrap issues strict session cookie and protects all remaining API reads.
3. Bootstrap and run history return bounded summary pages with validated cursors.
4. SSE replay is capped and emits a resync marker for historical overflow.
5. Bootstrap event cursor replays changes made before SSE subscribes.
6. Run detail and older-event pages keep event responses bounded.
7. Rejects missing CSRF, hostile Origin, hostile Host, and cross-site fetch metadata.
8. Rejects malformed JSON, invalid bodies, wrong content type, and oversized input.
9. Routes validated mutations and streams Markdown artifact downloads.
10. Global SSE delivers run events and per-run SSE replays after a cursor.
11. Maps expected engine errors to 4xx and hides internal failure details.
12. Run creation rejects duplicate member IDs and an outside leader through the engine.
13. Task files download only when listed and inside the task folder.
14. A code run must point at a git repository.
15. Installer preflight detects an occupied local port.
16. Agents use team tools as themselves; impersonation, stale tokens and browser requests are refused.
17. Telegram settings API requires session and CSRF, and exposes an unconfigured state.

Python tests exercise real ffmpeg normalization with a mocked HTTP response,
real generated magenta-sync capture processing and tiny-media QA. Remotion
invocation is mocked. Stage tests cover missing key/take human messages,
alignment/beat mapping, caption gaps/punctuation/accent selection, punch/card
planning, failure reports, public staging cleanup and cancellation. Server
tests cover exit 0/2/1, missing/escaping/symlinked outputs, upstream file versions,
timeout/abort and a descendant that ignores SIGTERM. Oversized streamed uploads
remove the partial file without destroying the request before a 413 can be sent.

TDD RED evidence was recorded before implementation: content tests failed for
missing stage scripts; the pipeline tests failed for the missing executor;
media UI tests failed for the missing FlowMedia component. These same targets
pass after implementation. A new English upload-size regression reproduced the unlocalized МБ suffix before it was corrected to the existing `{n} МБ` key. The upload stream test retains its PassThrough type for write/end; typecheck passes. No checkpoint commits were made, per user request.

During the work, unrelated localization changes appeared in the shared client
files. They were preserved and included in final workspace validation. An early
run was blocked by their then-missing `i18n-en` module; that module subsequently
arrived, and final checks above supersede those intermediate failures. Existing
Telegram changes were preserved; F4 made no edits to `src/server/http.ts`,
`src/server/telegram.ts`, Telegram tests or Telegram scripts.

## F4 file manifest

Paths below are relative to their project roots. Shared flow UI files also
contain concurrent localization edits; unrelated localization files are not
listed as F4 work.

**Power Agents (`AI Orchestration/`):**

- `.env.example` — environment names only, with no machine-specific path.
- `src/shared/flow-types.ts` — upload, human-action and output-version fields.
- `src/server/flows/pipeline.ts` (new) — subprocess contract, file validation,
  input collection, timeouts and process-tree cancellation.
- `src/server/flows/media.ts` (new) — streamed uploads and Range media.
- `src/server/flows/engine.ts` — upload invalidation, pipeline failures and retained output versions.
- `src/server/flows/executors.ts` — live stage executor wiring.
- `src/server/flows/registry.ts` — restored Voice timings edge and supported render heights.
- `src/server/flows/http.ts` — upload and versioned media routes.
- `src/client/i18n-en.ts` — additive English entry for updated F4 template help; existing localization preserved.
- `src/client/flows/FlowList.tsx` — translated help now describes the implemented media pipeline.
- `src/client/flows/FlowMedia.tsx` (new) — media links/controls and Capture upload input.
- `src/client/flows/FlowCanvas.tsx` — upload actions passed to cards/inspector.
- `src/client/flows/FlowCard.tsx` — playable output and distinct human-action state.
- `src/client/flows/FlowInspector.tsx` — Capture upload and file listing.
- `src/client/flows/helpers.ts` — flow identity and upload callback in canvas data.
- `src/client/flows/useFlow.ts` — serialized raw-file upload request.
- `src/client/flows/flows.css` — media/upload/human-action presentation.
- `tests/flow-pipeline.test.ts` (new).
- `tests/flow-media.test.ts` (new).
- `tests/flow-media-http.test.ts` (new).
- `tests/flow-media-ui.test.ts` (new).
- `tests/flow-engine.test.ts` — pipeline failure and template integration.
- `tests/e2e/flows.spec.ts` — Capture upload/media browser scenario.
- `docs/prototype.md` — setup, contract, API, dimensions and limits.
- `docs/f4-verification.md` (this report).
- `wiki/modules/Flow Engine.md`, `Flows UI.md`, `Local HTTP API.md`,
  `Shared Contracts.md`.
- `wiki/flows/Reel Flow Execution.md`.
- `wiki/overview.md`, `wiki/index.md`, `wiki/modules/_index.md`,
  `wiki/flows/_index.md`, `wiki/log.md`, `wiki/hot.md`.
- `obsidian-wiki/` — change records and generated log/index/hot updates written
  by the required `wiki-record-change.py` transaction, preserving existing notes.

**Content (`content/projects/project-1-explained-in-roblox/`):**

- `pipeline/stages/_common.py` (new) — isolated stdlib contract helper.
- `pipeline/stages/voice.py` (new).
- `pipeline/stages/capture.py` (new).
- `pipeline/stages/edit_plan.py` (new).
- `pipeline/stages/render.py` (new).
- `pipeline/stages/qa.py` (new).
- `pipeline/stages/README.md` (new) — setup, stage schema and operational details.
- `pipeline/stages/THIRD_PARTY_LICENSES.md` (new) — upstream MIT notice.
- `pipeline/tests/test_stages.py` (new).
- `edit/src/Reel.tsx` — dynamic FlowReel plus retained legacy component.
- `edit/src/Root.tsx` — dynamic composition/metadata alongside reel 001.
- `obsidian-wiki/` (new) — initialized and recorded through
  `wiki-record-change.py`; generated metadata, ledgers, overview, index,
  hot cache, log and change notes.

## Remaining acceptance and configuration

The seven metadata/registration assertions can be reproduced from the content
project's `edit/` directory, without rendering:

```sh
node <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
}).outputText, filename);
const { flowMetadata, Root } = require('./src/Root.tsx');
const metadata = (overrides = {}, edit = {}) => flowMetadata({ props: {
  edit: { duration: 45.01, captions: [], punches: [], cards: [], ...edit },
  footage: '', narration: '', height: 540, ...overrides
}});
assert.deepEqual(metadata(), { durationInFrames: 1351, fps: 30, width: 304, height: 540 });
assert.equal(metadata({ height: 1080 }).width, 608);
assert.equal(metadata({}, { fps: 24 }).durationInFrames, 1081);
assert.throws(() => metadata({}, { duration: 0 }), /duration/);
assert.throws(() => metadata({ height: 720 }), /height/);
assert.throws(() => metadata({}, { fps: 0 }), /fps/);
assert.deepEqual(Root({}).props.children.map(child => child.props.id), ['reel-001-inflation', 'FlowReel']);
console.log('7 Remotion metadata and registration checks passed');
NODE
```

The full live reel 002 script-to-final acceptance run was **not performed**:
no real ElevenLabs request or Remotion render was made. It still needs a key,
approved live script/scenes, a manually recorded take and actual rendering.
Browser execution and socket-dependent tests need an environment that allows
loopback listeners. The code and isolated media checks are implemented; this
report does not claim the live F4 acceptance criterion has been observed.

Set `REEL_PIPELINE_DIR` and `ELEVENLABS_API_KEY` in the server environment and
restart before using the live pipeline. No `.env` was created or edited.
The documented premade default voice is Liam (`TX3LPaxmHKxFdv7VOQHJ`); Rachel is a library voice the free-plan API refuses.
`config.height` is vertical height: 540/1080; codec-safe rounded widths are
304/608. QA allows the corresponding subpixel aspect rounding.

No commits, pushes, dependencies, `output/` content or reel 001 media changes.
Telegram gates remain F5.
