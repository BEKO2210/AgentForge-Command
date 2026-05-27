# Changelog

All notable changes to this project are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com); the project does not yet publish to a
package registry, so versions are git tags for now.

## [Unreleased] — Mascot state machines + tool-hook receiver

### Added — 10-state animation roster

All 12 specialists (Atlas plus the 11 lieutenants) now ship a full 10-state
animation machine: `idle / listening / thinking / typing / working / reading /
success / warning / error / celebrating`. The states are not just colour-swaps —
each specialist expresses its persona visually (Sentinel's eyes scan, Forge's
anvil sparks, Ledger's coin spins, Raven's debug glitch lines run, Luma's
lantern strobes morse, Nova breathes fire on success, etc.). One-shot states
(`success`, `celebrating`) restart cleanly on each trigger so they read
correctly when fired in rapid succession.

A side-by-side preview at **`/mascot-preview.html`** renders every mascot in
every state for quick visual regression. The headless screenshot harness at
`scripts/sim-state-shots.mjs` captures each row as a PNG under
`docs/state-shots/`, then exercises the `/api/hooks` → WebSocket → DOM-class
pipeline end-to-end against a live server (8 / 8 round-trips per run).

### Added — `POST /api/hooks` tool-hook receiver

The cockpit can now be driven authoritatively by Claude Code's native
hook system instead of inferring state from PTY stdout. The new endpoint
accepts JSON body, form-urlencoded, or GET query-string payloads and maps the
hook event + tool to one of the 11 activity states:

| Event              | Tool(s)                                        | State        |
|--------------------|------------------------------------------------|--------------|
| `PreToolUse`       | `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch`| `reading`    |
| `PreToolUse`       | `Edit`, `Write`, `MultiEdit`, `NotebookEdit`   | `working`    |
| `PreToolUse`       | `Bash`, `BashOutput`                           | `working`    |
| `PreToolUse`       | `Task`                                         | `thinking`   |
| `PostToolUse`      | any (ok)                                       | `success` → idle |
| `PostToolUse`      | any (error)                                    | `warning`    |
| `Notification` / `SessionStart` / `UserPromptSubmit` |                                | `listening`  |
| `Stop`             |                                                | `idle`       |

Every spawned PTY now exports `AGENTFORGE_AGENT_ID` + `AGENTFORGE_HOOK_URL`
so the bundled `.claude/agentforge-hooks.example.json` template can be
dropped into a project's `settings.json` and Just Works. End-to-end smoke
covers all three payload shapes plus 13 representative event/tool tuples.

### Removed

- **`test-site/`** worked-example demo directory and the matching smoke
  block from `tests/run.sh`. The example lived on as a one-off from the
  earlier 4-agent kit; the kit's own coordination scaffold + the new
  cockpit are the only first-class surfaces now.

### Tests

- Full suite is now **147 / 147** green: **87** bash + **40** arena unit +
  **20** server integration. The bash count drops by 1 from the previous
  88 because the `test-site` smoke block is gone.

---

## [Earlier · Unreleased] — AgentForge Command

The project has been re-framed as **AgentForge Command**, a local mission-control
cockpit for a Claude Code swarm led by **ATLAS PRIME**. The 4-agent coordination
kit that started it (the `.team/` scaffold, scripts, MCP server) stays in place
and lives on at `/console` — the new cockpit sits on top of it as the default
surface.

### Added — AgentForge Mission Control (`/`)

- **Atlas Prime + 11 specialists** — Sentinel, Aurora, Forge, Prism, Echo, Vega,
  Scribe, Ledger, Raven, Luma, Nova. Each has a role, super-skill, animated SVG
  mascot, 5-level evolution lab, terminal card with status badge and mini-stats.
- **Atlas Command Panel** — dedicated hero panel with mascot, status pills and a
  live mission stream that scrolls the latest spawn + rule + broadcast events.
- **Spawn timeline** — dramatic vertical connector + newest-event highlight,
  colour-coded by kind (boot / scan / rule / spawn / evolve / broadcast).
- **Broadcast bar** — `/` focuses, `Enter` dispatches. If `ANTHROPIC_API_KEY`
  is set on the server, the brief streams through Claude live (Atlas + per-
  specialist briefings inferred in one call). Otherwise falls back to the
  built-in mock simulator.
- **Spawn-Builder modal** — `Alt+N`. Define a new specialist visually (name,
  title, role, super-skill, mascot picker, swatch palette). New agents persist
  to `.team/arena.json` and survive restarts.
- **Per-specialist real PTY** — `agents.json` ships 12 `specialists` entries
  with role-specific Claude briefings. Each can be launched on-demand into its
  own PTY from the arena WebSocket (`{t:"start-pty", id, goal}`); the server
  pastes the briefing and presses Enter so the session boots into role.
- **Persistence** — `.team/arena.json` keeps evolution levels, auto-enter
  selection and operator-defined custom agents across restarts. Gitignored.
- **Auto-enter watchdog** — per-PTY toggle that presses Enter on conservative
  permission prompts (`(y/n)`, "press enter", "approve?", "allow this tool to
  run", …). Single-fire, 1.5s cooldown, broadcasts `auto-fired` back to the UI.
- **Mascot character animations** — each species has its own distinctive
  behaviour (radar sweep, tail-flick, sonar rings, lantern glow, glitch trace,
  …). Reduced-motion fully respected.
- **Mascot SVG gallery** — `docs/mascots/*.svg` + `_gallery.svg`, rendered
  directly from the live mascot source via `scripts/render-mascots.mjs`.

### Added — Rust accelerator (`tools/forge-pulse/`)

- Single-file, zero-dependency Rust binary that pipes PTY chunks and emits
  prompt/activity events. Auto-detected by the Node server; advisory only —
  the JS matcher drives auto-enter. Disable with `FORGE_PULSE=0`.
- 5 unit tests, clippy-clean (`-D warnings`).

### Added — server / API

- `/` → arena (default), `/console` → legacy 4-agent console, `/index.html`
  → 0-second redirect to `/`.
- `/api/agents`, `/api/state`, `/api/arena` — typed REST surface.
- WS `/arena` — protocol for auto-enter, persistence, real-PTY-start, atlas
  LLM streaming.
- Optional LLM bridge (`gui/llm.js`) — uses `fetch` against the Anthropic
  Messages API. Streams text deltas back to the arena, reports usage + cost.
  Zero npm dependencies.

### Changed

- Default route is now Mission Control. The legacy 4-agent console moved to
  `/console`; bookmarks for `/` and `/arena` both land in the cockpit.
- `agents.json` gained a `specialists` array — backward-compatible (the
  original 4 still autostart for the console).
- README rewritten around AgentForge Command. The original 4-agent kit's
  docs are preserved under `gui/README.md` and `.team/PROTOCOL.md`.

### Quality

- 88/88 bash tests still green.
- 5/5 Rust unit tests green.
- `cargo clippy --release -- -D warnings` clean.
- End-to-end smoke verified: HTTP routes, WS handshake, auto-fire on `(y/n)`,
  persistence round-trip, pulse events wrapped + delivered, specialist PTY
  launch with briefing paste, LLM fallback when no key is configured.

## [Pre-AgentForge] — GUI ops-console refresh

### Added — GUI ops-console refresh

A multi-pass refresh of the optional `gui/` console, driven by feedback from a real
session and informed by the UI/UX Pro Max + frontend-design Claude Skills.

- **Per-role progress bars** in the top vitals strip — four stacked bars (lead /
  backend / frontend / quality), each filled by that role's `done / total` ratio in
  its own accent colour. Replaces the previous four state-coloured segments that
  collapsed to nothing when their counts were zero.
- **Selected & needs-input feedback** — clicking a card sets a bright accent ring +
  `selected` badge; non-focused cards pulse warn-yellow with a `⚠ needs input` badge
  when their terminal output matches common confirmation prompts (`(y/n)`,
  "press enter", "do you want to…"). Cleared as soon as the user types into the card.
- **Card hover lift, focus-visible rings, contrast bump** — Medium/High severity UX
  guidelines (focus states for keyboard users, visible hover feedback,
  contrast-readability).
- **CTA-green Kickoff button** with a half-second pulse on click and an
  auto-clearing Goal textarea, per the UX "Submit Feedback" guideline.
- **Ops-console identity** — corner brackets on every card in the role colour (8 thin
  lines via a single `::after` gradient grid), channel callsigns `CH·01 … CH·04`,
  telemetry-style vital chips with role-accent borders, a brand subscript
  `· LOCAL · N/4 CH · ONLINE | PARTIAL | STANDBY | OFFLINE ·` driven live by the
  WebSocket + agent state, and a subtle CRT-scanline overlay on each terminal
  (disabled under `prefers-reduced-motion`).
- **Centred 4-bar equalizer activity meter** in every card header. Calm in idle,
  bars animate at varied tempos while terminal output is flowing (debounced ~700ms
  after silence), turn flat red when the PTY exits. Replaces the small left-edge
  status dot.

### Fixed — GUI

- **Right-side cutoff** in the 2×2 grid — added `min-width:0` / `min-height:0` to the
  grid items and forced `width:100%` on the xterm viewport so cards can shrink
  cleanly and `FitAddon` sizes correctly.
- **First-paint truncation** in terminals — server now spawns each PTY at
  `cols: 140` (was `100`). The first screen (Claude welcome, `/init` prompts, etc.)
  now fits the typical card width without an ellipsis before the browser's
  `FitAddon` sends an exact resize.
- **Late-joining clients showed agents as offline** — `gui/server.js` now tracks a
  per-agent `alive` flag and replays both scrollback AND current liveness on each
  new WebSocket connection.

### Changed — typography & palette

- Swapped UI font from Hanken Grotesk to **IBM Plex Sans** (paired with JetBrains
  Mono, per the "Developer Mono" pairing). Single Google Fonts request.
- Refreshed the slate-based palette (`bg #05080f`, `panel #0d1424`,
  `border #1a2540`) and added a dedicated `--cta` token (emerald
  `#22c55e + #34d399`) so the primary action reads distinctly from the blue
  interactive accent used for selection / focus.

### Tests

- The Bash test suite now reports **88 passed** (was 87) after picking up the
  `test-site` smoke harness added by the agents during a worked example. No protocol
  or coordination-script behaviour changed.

## [0.1.0] — 2026-05-26 — Initial public preview (MIT)

The first feature-complete public preview, released under the **MIT License**. All
numbered milestones from `ROADMAP.md` (phases 0–6) are shipped; only the deliberately
optional academic appendix is left out.

### Changed — licensing & community
- `LICENSE` switched from "Private Use" to the **MIT License**. Copyright remains with
  Belkis Aslani (BEKO2210); commercial support / dual-licensing for embedded use are
  available — see the README.
- Added `SECURITY.md` (Private Security Advisories), `CONTRIBUTING.md`, and
  `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).

### Added — shared state library
- `lib/state.mjs` is now the single canonical implementation of the folded team state
  (counts, tasks, role liveness). `gui/server.js`, `mcp/server.js` and
  `scripts/team-snapshot.mjs` all import it. The contract stays described in
  `schema/team-state.schema.json`.
- `gui/` is now ESM (`"type": "module"`) so it can share that module directly.

### Added — CI hardening
- `.github/workflows/gate.yml` gains a second job that runs `npm audit` against
  `gui/` and `mcp/` lockfiles on every push (fails the gate on advisories at
  severity `high` or above).

### Added — coordination scripts
- `scripts/lib/lock.sh` — atomic `mkdir` lock directory, PID-liveness stale detection,
  atomic rename-based break, ownership-checked release.
- `scripts/team-commit.sh` — serialised commits with `--dry-run` / `TEAM_DRY_RUN=1`.
- `scripts/team-exclusive.sh` — serialise heavy operations (build / e2e / migrations).
- `scripts/team-check.sh` — green gate (`bash -n` + optional `shellcheck -S warning` +
  test suite); the contract for "never commit red."
- `scripts/team-health.sh` — per-agent liveness, stale-task detection, deadlock signal.
- `scripts/team-sync.sh` — board↔log drift report (logs are the authority).
- `scripts/team-resume.sh` — rebuild state from logs + Git after a crash/restart.
- `scripts/team-metrics.sh` — throughput per role + board progress.
- `scripts/team-backup.sh` — snapshot / restore `.team/`.
- `scripts/team-lead-claim.sh` — fallback-lead record (`.team/state/lead`).
- `scripts/team-lint-log.sh` — validate structured `@role` handoff lines.
- `scripts/team-worktrees.sh` — per-role Git worktrees on `team/<role>` branches.
- `scripts/team-role.sh` — add / list / remove team roles at runtime (with start prompt).
- `scripts/team-handoff.sh` — paste-able briefing for a fresh Claude Code session.
- `scripts/team-sections.sh` — per-section view (sub-team `## name` board headings).
- `scripts/team-federate.sh` — aggregate boards across multiple repos.
- `scripts/team-snapshot.{mjs,sh}` — capture the full team state as one JSON document.
- `scripts/team-diff.{mjs,sh}` — diff two snapshots (counts, tasks, role states).

### Added — protocol files
- `.team/PROTOCOL.md` — the five rules, the handoff schema, resilience policy,
  sub-teams and cross-repo conventions, concurrency variants.
- `.team/roles/{lead,backend,frontend,quality}.md` — explicit lanes and definition-of-done.
- `.team/roles/_template.md` — template for runtime-added roles.
- `.team/memory.md` — durable, run-spanning decisions (lead-curated).
- `.team/board.md` — single work board (lead-owned).

### Added — GUI
- `gui/server.js` — local web console that runs the four sessions as real PTYs, plus the
  `/state` endpoint that derives board progress + per-agent health from `.team/`.
- `gui/public/index.html` — distinctive "TEAM // CONSOLE" UI: live vitals strip
  (segmented progress + colour-coded agent chips), per-agent accent decks, motion.

### Added — MCP
- `mcp/server.js` — read-only Model Context Protocol server (stdio) exposing
  `team://state | board | memory | protocol | health | metrics | log/<role>` resources
  and `team_state` / `refresh_metrics` tools.
- `mcp/test.js` — self-contained smoke test (12 checks).

### Added — schema, examples, docs, CI
- `schema/team-state.schema.json` — JSON Schema (draft 2020-12) describing the contract
  shared by `/state`, `team://state` and `team-snapshot`.
- `examples/todo-cli/` — a worked example: kickoff, board fixture, representative logs.
- `tests/run.sh` — sandboxed Bash test suite (87 checks at this tag).
- `tests/validate-schema.mjs` — structural sanity check for the JSON Schema.
- `.github/workflows/gate.yml` — GitHub Actions runs the gate on every push / PR.
- Premium English README + the German `README.de.md`.
- This `CHANGELOG.md`.

### Notes
- Core has **zero runtime dependencies**. GUI and MCP each ship their own `package.json`
  and are strictly opt-in.
- Continuous integration: see the live `gate` badge in the README.
- License: **MIT** — see `LICENSE`. Commercial support and dual-licensing for embedded
  use are available; see the README.
