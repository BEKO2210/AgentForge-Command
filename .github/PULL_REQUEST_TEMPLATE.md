## Summary

<!-- What does this change do, and why? Keep it short. -->

## Type

- [ ] Bug fix
- [ ] New feature / capability
- [ ] Refactor (no behaviour change)
- [ ] Docs / community
- [ ] CI / tooling

## Checklist

- [ ] `bash scripts/team-check.sh` is green locally
- [ ] `bash tests/run.sh` is green locally (147 checks: 87 bash + 40 arena + 20 server)
- [ ] If `mcp/` was touched: `cd mcp && node test.js` is green
- [ ] If `gui/` was touched: smoke-tested with `AUTOSTART=0 TEST_CMD=bash node gui/server.js`
- [ ] If `tools/forge-pulse/` was touched: `cargo build --release`, `cargo test --release`
      and `cargo clippy --release -- -D warnings` are clean
- [ ] If mascots changed: `node scripts/render-mascots.mjs` refreshed `docs/mascots/`
- [ ] If the state contract changed: `schema/team-state.schema.json` updated and
      `tests/validate-schema.mjs` still passes
- [ ] No `git add -A` style changes — only the paths actually touched
- [ ] Docs (`README.md`, `README.de.md`, `CHANGELOG.md`) updated when user-visible

## Notes for review

<!-- Anything reviewers should look at first, edge cases, screenshots, etc. -->
