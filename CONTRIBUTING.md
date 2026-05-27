# Contributing

Thanks for considering a contribution. AgentForge Command is released under
the [MIT License](LICENSE) — use it, fork it, send patches.

## Quick guide

1. **For bugs or questions:** open a GitHub issue with a minimal reproduction.
2. **For ideas / feature requests:** open an issue first to discuss before
   writing code. Small, focused changes are easier to land than sweeping
   rewrites.
3. **For security issues:** please follow [`SECURITY.md`](SECURITY.md) — use
   GitHub Private Security Advisories, **not** public issues.

## Pull requests

Before opening one, please make sure:

- The change has been discussed in an issue first (for anything non-trivial).
- The green gate is locally green:
  ```bash
  bash scripts/team-check.sh        # → tests + bash -n + shellcheck
  ```
- `shellcheck` is happy (the gate runs it at `-S warning`).
- The Bash test suite is green and you've added tests for any new script
  behaviour:
  ```bash
  bash tests/run.sh                  # 88 sandboxed checks
  ```
- If you touched the Rust accelerator:
  ```bash
  cd tools/forge-pulse
  cargo build --release
  cargo test  --release              # 5 unit tests
  cargo clippy --release -- -D warnings
  ```
- If you touched the MCP server, the smoke tests still pass:
  ```bash
  cd mcp && npm install && node test.js
  ```

## House rules

- **The `.team/` substrate stays clean.** AgentForge Command builds on top of
  the original 4-agent kit — [`.team/PROTOCOL.md`](.team/PROTOCOL.md) and the
  `team-*.sh` scripts must keep working. Features that subvert the protocol
  (e.g. background daemons, network components in the core, multiple writers
  per file) are unlikely to be accepted there.
- **Dependency budget.** Top-level `scripts/` and `.team/` stay
  dependency-free. The optional sub-packages (`gui/`, `mcp/`, `tools/forge-pulse/`)
  ship their own manifests and may take deps **with care** — every new dep
  needs a sentence in the PR explaining why a stdlib path didn't fit.
- **One source of truth for state.** The folded team-state view used by the
  GUI, the MCP server and `team-snapshot` is implemented once in
  [`lib/state.mjs`](lib/state.mjs) and described by
  [`schema/team-state.schema.json`](schema/team-state.schema.json). Touch the
  lib, not its three call sites.
- **Mascots are source.** Both the live arena and the static `docs/mascots/`
  images come from `gui/public/arena/mascots.js`. If you add a species, run
  `node scripts/render-mascots.mjs` to refresh the docs.
- **Honest docs.** Don't add CI / coverage / feature claims that aren't backed
  by real workflows or real code.

## Style

- **Bash:** `set -euo pipefail`, quote everything, prefer `[ -n "$x" ]` over
  bare strings, no `eval`, no `git add -A`, traps for cleanup.
- **JavaScript** (`gui/`, `mcp/`, `lib/`, snapshots): plain ESM, match the
  surrounding style, keep optional dependencies optional. No bundler. No
  framework in `gui/public/arena/`.
- **Rust** (`tools/forge-pulse/`): clippy-clean at `-D warnings`, no
  unwrap/expect on user-facing code paths, single-file binary preferred,
  zero dependencies.
- **Markdown:** ATX headings, fenced code blocks with a language hint.

## Code of conduct

Participation in this project is governed by the
[Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating,
you agree to abide by its terms.
