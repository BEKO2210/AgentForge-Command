# Baseline — AgentForge Command (Phase 0)

> **Purpose:** a measurable starting line. "Production-ready" is measurable or
> it is opinion. Every number below was captured on the `main`-equivalent
> working tree at the start of the roadmap, with a reproducible snippet so any
> later phase can re-measure and prove movement. Phase 4 (Benchmarks) needs
> these "before" values.

**Measured:** 2026-05-29 · **Toolchain:** Node `v22.22.2`, npm `10.9.7`,
cargo `1.94.1` · **Coverage tool:** `c8@10` (via `npx`, not a committed dep).

> ⚠️ Numbers are environment-dependent (Node version, whether `node-pty`/`ws`
> are installed, machine speed). Re-run the snippet in §6 to refresh. The point
> is the **method**, not the third decimal.

---

## 1. Lines of code (per file / group)

Counted with `wc -l`, excluding `node_modules/`, build artefacts, and binary
assets.

### Server-side JavaScript (the production runtime)

| File | LOC | Role |
|------|----:|------|
| `gui/server.js` | 986 | HTTP + WS server, PTY orchestration, spend ledger, hooks |
| `gui/llm.js` | 167 | Optional Anthropic LLM bridge (pricing, config) |
| `mcp/server.js` | 98 | Read-only MCP state-exposure server |
| `lib/state.mjs` | 70 | Shared state/board parsing helpers |
| **Subtotal** | **1 321** | |

### Browser bundle (`gui/public/arena/*.js`)

| File | LOC |
|------|----:|
| `mascots.js` | 1 080 |
| `ui.js` | 746 |
| `main.js` | 653 |
| `spawner.js` | 179 |
| `data.js` | 157 |
| `state.js` | 68 |
| `broadcast.js` | 13 |
| **Subtotal** | **2 896** |

### Other production surface

| Group | LOC | Notes |
|-------|----:|------|
| `gui/public/arena/styles.css` | 2 782 | UI styling |
| HTML (`arena.html`, `index.html`, `mascot-preview.html`) | 301 | |
| Bash scripts (`scripts/*.sh`, `scripts/lib/*.sh`) + node helpers (`scripts/*.mjs`) | 2 549 | 19 `team-*.sh` scripts + sim/render helpers |
| Rust accelerator (`tools/forge-pulse/src/main.rs`) | 190 | optional sidecar |

### Tests (not production, tracked for ratio)

| File | LOC |
|------|----:|
| `tests/server-suite.mjs` | 587 |
| `tests/arena-suite.mjs` | 468 |
| `tests/run.sh` | 329 |
| `tests/workflow-suite.mjs` | 181 |
| `tests/validate-schema.mjs` | 72 |
| **Subtotal** | **1 637** |

> The ROADMAP header cites **11 763 LOC** production code and **1 637 LOC**
> tests. The test figure reproduces exactly. The production figure is the broad
> count (JS + browser bundle + CSS + HTML + scripts + Rust); the **server-side
> JS that the threat model cares about is 1 321 LOC**, of which `server.js`
> alone is 986.

---

## 2. Tests

Run via `bash scripts/team-check.sh` → `tests/run.sh`.

| Suite | Count | Notes |
|-------|------:|------|
| arena unit tests | 40 | `lib/state.mjs`, `arena/*.js`, `server.js` pure fns |
| server integration tests | 30 | spawns `server.js`; **needs `node-pty` + `ws` installed** |
| `agentforge-real-workflow-smoke` | 8 | harness mode (no key/CLI needed) |
| script/other groups | (remainder) | git-sandbox tests for `team-*.sh` |
| **`tests/run.sh` total** | **165** | matches ROADMAP's "165" |
| Rust unit tests (`cargo test --release`) | 5 | `tools/forge-pulse` — matches "5" |

**Important caveat:** if `gui/node_modules` is missing (`node-pty`/`ws` not
loadable), `tests/run.sh` **skips** the 30 server-integration tests and the 8
workflow-smoke tests and reports **127 passed**. The full **165** only runs
after `cd gui && npm ci` (note: *not* `--ignore-scripts` — `node-pty` needs its
native build step).

| Condition | Reported total |
|-----------|---------------:|
| `gui/node_modules` absent | 127 |
| `gui/node_modules` present | 165 |

---

## 3. Gate runtime

`bash scripts/team-check.sh` (shell syntax check + optional shellcheck + full
`tests/run.sh`), wall-clock on the measurement machine:

| Condition | Runtime |
|-----------|--------:|
| Server suite skipped (no `node_modules`) | ~4.1 s |
| Full suite (node-pty + ws installed) | ~9.8 s |

`shellcheck` was **not** installed in the measurement environment, so step 2 of
the gate was skipped (it is optional and only strengthens the check when
present). `cargo test --release` for the Rust sidecar compiles in ~17 s cold,
runs the 5 tests in <0.01 s.

---

## 4. `console.*` usage

There is no structured logger yet (Phase 2 adds one). Count of `console.*`
calls in production/tooling code (excluding `node_modules` and `tests/`):

| Scope | `console.*` calls |
|-------|------------------:|
| `gui/server.js` | 22 |
| `gui/llm.js` | 0 |
| `scripts/*.mjs` (sim/render/diff helpers) | ~50 |
| `mcp/test.js` | 3 |
| **Total (production + tooling JS)** | **82** |

The 22 in `server.js` are the runtime-relevant ones (startup banner, port-in-use
hint, auto-enter arming, shutdown). **Secret-logging check:** `ANTHROPIC_API_KEY`
is read server-side and is **not** emitted by any `console.*` call (verified by
grep); keep this invariant when Phase 2 introduces the logger.

---

## 5. Coverage (current state, honest)

Measured with `c8@10` wrapping the full gate, scoped to `gui/`, `lib/`, `mcp/`.
c8 sets `NODE_V8_COVERAGE`, which the server-suite's spawned `server.js`
subprocess inherits, so server coverage is real (not just the unit imports).

**Aggregate (files c8 actually loaded):**

| Metric | Value |
|--------|------:|
| Statements | 86.67 % (2380/2746) |
| Branches | 66.31 % (250/377) |
| Functions | 77.41 % (48/62) |
| Lines | 86.67 % (2380/2746) |

**Per file:**

| File | % Lines | % Branch | Notes |
|------|--------:|---------:|------|
| `arena/data.js` | 100 | 100 | |
| `arena/mascots.js` | 100 | 76.92 | |
| `arena/state.js` | 100 | 100 | |
| `lib/state.mjs` | 100 | 84.84 | |
| `arena/spawner.js` | 88.82 | 74 | |
| `gui/server.js` | 76.26 | 60.15 | the big runtime file |
| `gui/llm.js` | 38.32 | 100 | LLM path only runs with a key |
| `scripts/team-snapshot.mjs` | 76.92 | 50 | |

**The honest caveat (this is the real coverage story):** the 86.67 % is only of
the files c8 *saw* during the node-side test run. Two large, untested surfaces
do **not** appear in that number:

1. **Browser-only UI logic** — `arena/main.js` (653 LOC) and `arena/ui.js`
   (746 LOC) run in the browser, never under Node, so they get **0 %** coverage
   today. There is no headless-browser/E2E test (Playwright is a Phase 4 task).
2. **`mcp/server.js`** — not exercised by the gate at all → effectively **0 %**.

So: the **node-testable core is well covered (~87 % lines)**, but the
**end-to-end product** (UI bundle + MCP) is substantially less covered. Phase 4
sets a coverage threshold at *current value + 5 %* (not utopian) and adds E2E +
a11y to close the browser gap. This baseline is the number that threshold is
measured against.

---

## 6. Reproducible measurement snippet

Copy-paste from the repo root. Requires Node, and (for the full picture)
`gui/node_modules` installed.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "## Toolchain"
node --version; npm --version; cargo --version 2>/dev/null || echo "no cargo"

echo "## LOC — server-side JS"
wc -l gui/server.js gui/llm.js mcp/server.js lib/state.mjs

echo "## LOC — browser bundle / css / html"
wc -l gui/public/arena/*.js gui/public/arena/styles.css gui/public/*.html

echo "## LOC — tests"
wc -l tests/*.mjs tests/run.sh

echo "## console.* in server.js"
grep -c 'console\.' gui/server.js

echo "## Tests + gate runtime"
# Install gui deps first for the full 165 (else 127):  (cd gui && npm ci)
START=$(date +%s.%N)
bash scripts/team-check.sh
END=$(date +%s.%N)
echo "gate runtime: $(echo "$END - $START" | bc)s"

echo "## Rust tests"
( cd tools/forge-pulse && cargo test --release 2>&1 | tail -3 )

echo "## Coverage (c8 — not a committed dep)"
npx --yes c8@10 --reporter=text-summary \
  --src gui --src lib --src mcp \
  bash scripts/team-check.sh
# c8 writes ./coverage — gitignored. Remove with: rm -rf coverage
```

---

## 7. Snapshot summary

| Dimension | Baseline value |
|-----------|----------------|
| Server-side JS LOC | 1 321 (986 = `server.js`) |
| Total production LOC (broad: JS+CSS+HTML+scripts+Rust) | ~11 763 (per ROADMAP) |
| Test LOC | 1 637 |
| Tests (full) | 165 Node + 5 Rust |
| Tests (no `node_modules`) | 127 Node |
| Gate runtime | ~4.1 s (skipped) / ~9.8 s (full) |
| `console.*` in `server.js` | 22 |
| Coverage — node core (lines) | 86.67 % |
| Coverage — browser UI (`main.js`/`ui.js`) & `mcp/server.js` | ~0 % (no E2E) |
| Secret leakage in logs | none found (`ANTHROPIC_API_KEY` not logged) |

**No production code was changed to produce this baseline.** The only tree
changes in Phase 0 are these docs, `_handoff/.../FINDINGS.md`, and a `.gitignore`
entry for the `coverage/` artefact.
