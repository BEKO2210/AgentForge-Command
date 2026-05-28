# CHANGELOG (handoff run) — make Atlas visible + prove the workflow

This run focused on **(1)** making Atlas the readable, central figure in the UI
and **(2)** proving the end-to-end routing chain with a deterministic,
honestly-labelled test — plus the handoff folder you're reading.

> A previous run already fixed runtime/stability (auto-enter scoping, launch
> failures, corrupt-state recovery, clean shutdown, honest docs). This run
> builds on that.

## Files changed

| File | Why |
|---|---|
| `gui/public/arena.html` | Removed the big left explanatory text block and the static "Operator notes"; added the **Atlas stage**, a compact **stat strip**, and the **TEST HARNESS** status chip. |
| `gui/public/arena/ui.js` | Rewrote `renderLeadPanel` into the Atlas command center: **workflow stepper**, large readable **answer area**, **Dispatch & reports** panel, and a collapsible **Technical events** panel. |
| `gui/public/arena/main.js` | Added an **Atlas view model** (`answer` / `dispatch` / `tech` / `workflow`) and routed every server event into the right bucket so the human answer is never buried by tool/hook noise. Wired the harness flag + new `specialist-report` / `atlas-final` events. |
| `gui/public/arena/styles.css` | Styles for the stat strip, Atlas stage, stepper, answer lines (you/atlas/summary), dispatch cards, technical-events panel, TEST HARNESS badge, and responsive rules (Atlas-first on mobile). |
| `gui/server.js` | Added the **deterministic test harness** (`AGENTFORGE_HARNESS=1`): a synthetic Atlas that drives the real dispatch pipeline offline, emitting `harness:true` frames, `specialist-report` and `atlas-final`. Exposed `harness` on `/api/arena` + WS `hello`, plus a startup log line. |
| `gui/package.json` | Added scripts: `test:arena`, `test:server`, `test:workflow`, `test:e2e`, `smoke:atlas`. |
| `tests/run.sh` | Runs the new workflow suite as part of the full gate. |
| `tests/workflow-suite.mjs` *(new)* | **agentforge-real-workflow-smoke** — proves the routing chain A–H. |
| `scripts/smoke-atlas-workflow.mjs` *(new)* | One workflow run → Markdown report (`WORKFLOW_TEST_REPORT.md`); harness or live. |
| `scripts/shot-atlas-workflow.mjs` *(new)* | Headless-Chromium CDP driver → the three handoff screenshots. |
| `_handoff/agentforge-command/**` *(new)* | This handoff folder. |

## Which tests prove it

| Change | Proof |
|---|---|
| Routing chain (operator → Atlas → dispatch → reports → final) | `tests/workflow-suite.mjs` (8 checks, A–H) + `npm run smoke:atlas` report |
| Harness is honest (`harness:true` on every frame) | workflow-suite check H |
| Atlas addresses the 8 named specialists by id | workflow-suite check C |
| Each agent reports, honestly flagged running vs. not | workflow-suite check E |
| `/api/arena` advertises `harness` so the UI can label it | workflow-suite "honest mode" check |
| Server still boots without key / CLI / Rust; no crash | `tests/server-suite.mjs` (30 checks, incl. launch-failure + corrupt-state) |
| UI renders Atlas-dominant with answer + dispatch + collapsed tech | `screenshots/01-03` (captured by `shot-atlas-workflow.mjs`) |

Full gate: `bash tests/run.sh` → **165 passed, 0 failed**
(87 bash + 40 arena + 30 server + 8 workflow). `cargo test --release` in
`tools/forge-pulse` → 5 passed.

## New server events (for reference)

- `specialist-report` `{ id, line, running, harness? }` — a specialist's visible
  status back to Atlas.
- `atlas-final` `{ summary, addressed[], responded[], open[], harness? }` —
  Atlas's final summary of the run.
- `harness:true` is attached to every harness-emitted frame.
- `/api/arena` + WS `hello` now include `harness: <bool>`.
