# Known Limitations & Trade-offs

Honest boundaries. AgentForge favours a small, transparent, local-first design
over feature sprawl — these are the conscious trade-offs that follow from it.

## By design

- **Local-first, single-user.** AgentForge runs on one machine, one browser.
  There is no multi-user access control and no account system. Treat the
  cockpit as a single-operator tool (the security model assumes this — see
  [`SECURITY.md`](SECURITY.md)).
- **Worktrees are local.** Each specialist gets an isolated `git worktree` on
  `agentforge/<id>`, but multi-machine collaboration is manual `git push`/
  `pull` — there is no built-in cloud sync (deliberate; see ROADMAP §11).
- **PTY-based, not a hosted API service.** AgentForge bridges to a local
  `claude` CLI (or your API key). Anthropic's Pro/Max policy restricts
  third-party PTY frameworks — see the **Policy notice** in the
  [README](README.md) and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).
- **No fake reattach across restarts.** PTY processes do not survive a server
  restart. AgentForge persists session *metadata* and surfaces previous
  sessions as **orphaned** with one-click relaunch — it never pretends to
  recover live execution state.
- **No mock activity.** With no key and nothing running, the cockpit stays
  honestly idle rather than animating fake work.

## Platform notes

- **Linux** — primary, fully-supported runtime. The full PTY-integration test
  suite runs here in CI across Node 18 / 20 / 22.
- **macOS** — supported. On Apple Silicon, `node-pty`'s native addon is rebuilt
  by `npm ci` automatically; no extra steps. CI builds + loads it on macOS for
  Node 18/20/22.
- **Windows** — `node-pty` **builds and loads** on Windows (verified in CI), so
  the cockpit runs. However PTY/`bash` emulation (ConPTY) is imperfect, so the
  heavy PTY-integration suite is exercised on Linux, not Windows. For the
  smoothest Windows experience, run via **Docker/WSL** (see
  [`docs/INSTALL.md`](docs/INSTALL.md)).

## Dependency notes

- **`node-pty`** (MIT, Microsoft) — native module; a fresh `npm ci` rebuilds it
  per Node ABI. Node 18 → 20 → 22 are all verified.
- **`ws`** (MIT) — actively maintained; `npm audit` is clean (CI gate).
- **`forge-pulse`** (optional Rust) — an advisory accelerator. The JS matcher is
  authoritative and the system runs identically without the binary.

## Performance envelope

- **Concurrency:** capped by `AGENTFORGE_MAX_PTYS` (default **8**). Higher
  counts work but increase memory and zombie-reaping pressure.
- **Output rate:** comfortable at ~1–10 KB/s per PTY. The auto-enter matcher is
  sub-millisecond per check (see [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md)), so
  it is not the bottleneck; extreme output rates can still flood the browser.
- **Arena size:** 100+ cards render but the UI has no virtual scrolling yet, so
  very large swarms degrade UI smoothness.

## Test coverage caveats

- **Node-side coverage** is enforced (`c8`, ~76% lines — see `.c8rc.json`). The
  **browser bundle** (`gui/public/arena/*.js`) is covered by the Playwright E2E
  suite rather than `c8`, so it is intentionally excluded from the line-coverage
  number (including it would report a misleading 0%).

See [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) for the security boundary and
[`_handoff/agentforge-command/KNOWN_LIMITS.md`](_handoff/agentforge-command/KNOWN_LIMITS.md)
for the operator/runbook-level limits.
