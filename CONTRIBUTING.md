# Contributing

Thanks for considering a contribution. This kit is released under the [MIT
License](LICENSE); use it, fork it, send patches.

## Quick guide

1. **For bugs or questions:** open a GitHub issue with a minimal reproduction.
2. **For ideas / feature requests:** open an issue first to discuss before writing code.
   Small, focused changes are easier to land than sweeping rewrites.
3. **For security issues:** please follow [`SECURITY.md`](SECURITY.md) — use GitHub
   Private Security Advisories, **not** public issues.

## Pull requests

Before opening one, please make sure:

- The change has been discussed in an issue first (for anything non-trivial).
- The green gate is locally green:
  ```bash
  bash scripts/team-check.sh
  ```
- `shellcheck` is happy (the gate runs it at `-S warning`).
- The Bash test suite is green and you've added tests for any new script behaviour:
  ```bash
  bash tests/run.sh
  ```
- The MCP smoke tests still pass if you touched `mcp/`:
  ```bash
  cd mcp && npm install && node test.js
  ```

## House rules

- **Stay within the protocol.** The kit's whole point is the simplicity of
  [`.team/PROTOCOL.md`](.team/PROTOCOL.md). Features that violate it (e.g. background
  daemons, network components in the core, multiple writers per file) are unlikely to
  be accepted.
- **Zero deps in the core.** Top-level `scripts/` and `.team/` must stay
  dependency-free. The optional sub-packages (`gui/`, `mcp/`) ship their own
  `package.json` and may take deps with care.
- **Honest docs.** Don't add CI/coverage/feature claims that aren't backed by real
  workflows or real code. Follow the spirit of [`README_AUDIT.md`](README_AUDIT.md).
- **One source of truth for state.** The folded team-state view used by the GUI, the
  MCP server and `team-snapshot` is implemented once in [`lib/state.mjs`](lib/state.mjs)
  and described by [`schema/team-state.schema.json`](schema/team-state.schema.json).
  Touch the lib, not its three call sites.

## Style

- Bash: `set -euo pipefail`, quote everything, prefer `[ -n "$x" ]` over bare strings,
  no `eval`, no `git add -A`, traps for cleanup.
- JavaScript (GUI / MCP / snapshot): plain ESM, match the surrounding style, keep
  optional dependencies optional.
- Markdown: ATX headings, fenced code blocks with a language hint.

## Code of conduct

Participation in this project is governed by the
[Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree
to abide by its terms.
