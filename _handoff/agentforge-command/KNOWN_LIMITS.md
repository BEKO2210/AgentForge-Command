# KNOWN LIMITS — AgentForge Command

Honest boundaries. Nothing here is hidden behind a fake green state.

## Needs `ANTHROPIC_API_KEY`

- **Live Atlas LLM briefings.** Without a key, ATLAS mode does not call the
  Anthropic API. Instead it either talks to Atlas's real `claude` PTY (if the
  CLI is present) or runs the deterministic TEST HARNESS (if
  `AGENTFORGE_HARNESS=1`).
- **The live workflow test** (`AGENTFORGE_LIVE_TEST=1 ... smoke-atlas-workflow.mjs`)
  needs a key; otherwise it falls back to the harness and says so in the report.
- The key is **server-only** and never sent to the browser.

## Needs the Claude CLI (`claude` on PATH)

- **Real per-agent sessions** (▶ launch, direct messages, SWARM broadcast to a
  real terminal). Without the CLI, launches return a visible **launch failed**
  message (the app does not crash). Set `TEST_CMD=bash` to drive PTYs without it.
- The status bar shows **CLI = found/missing** so you always know.

## Works without Rust

- The `forge-pulse` accelerator is **optional**. If the binary isn't built, the
  server skips it (`pulse: js`) and auto-enter still works via the JS matcher.
  Build it with `cargo build --release --manifest-path tools/forge-pulse/Cargo.toml`
  to get `pulse: rust`; `cargo test --release` runs its 5 unit tests.

## Intentionally local

- The server binds to **`127.0.0.1`** only. Exposing it publicly is the
  operator's explicit choice.
- Arena UI state lives in **`.team/arena.json`** (gitignored runtime state, not
  a source of truth). A corrupt file is backed up and reset, never fatal.
- No telemetry, no external trackers. The only outbound call is the Anthropic
  API, and only when you set a key.

## Test harness boundaries (important)

- The harness proves the **routing chain only** (operator → Atlas → dispatch →
  reports → final summary). It does **not** run an LLM and does **not** make any
  specialist do real work. Its status lines are synthetic and tagged
  `[harness]`; every frame carries `harness:true` and the UI shows a **TEST
  HARNESS** badge.
- In harness mode, "responded" means "the routing delivered a message and the
  harness acked it" — not "a real agent completed a task".

## Not yet perfect / future work

- **Live mode has no separate final-summary call.** In live mode Atlas's
  streamed brief *is* his answer; there is no second LLM round that re-summarises
  who responded (the harness synthesises one via `atlas-final`). A future
  enhancement could add a real "integration" pass after specialist reports.
- **Specialist reports in live mode** come from raw PTY output (condensed,
  ANSI-stripped) — readable but not structured. The hook receiver gives cleaner
  state when `.claude/agentforge-hooks.example.json` is installed.
- **Screenshots** are generated with the bundled headless Chromium driver
  (`scripts/shot-atlas-workflow.mjs`); they depend on a Chromium binary being
  available at `$CHROME` (defaults to the Playwright path used by the repo's
  screenshot tooling).
- **No automated pixel/visual regression** — UI rendering is validated by the
  server-contract + workflow tests and by the captured screenshots, not by a
  visual-diff harness.
