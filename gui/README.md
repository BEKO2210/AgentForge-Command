# Team GUI — one window, no terminal hopping

A tiny local web console that runs all four agents at once: each agent is a real
Claude Code session (a PTY) shown in its own panel; you chat, hit Enter, and fire the
common commands from buttons — without switching terminals.

## Run
```bash
cd gui
npm install            # installs node-pty + ws (prebuilt binaries, no compiler needed on common platforms)
cd ..                  # run from your repo root so agents see .team/
node gui/server.js     # → open http://localhost:4173
```
The agents launch in the directory you run from (override with `REPO_DIR=/path/to/repo`).

## Use
1. The 4 panels start their `claude` sessions automatically.
2. Type your task into the **Goal** box (top).
3. Click **▶ Kickoff all** — sends each agent its role prompt (Lead first), Goal injected.
4. Drive them: per-panel **message box** (Enter sends), or the buttons:
   **⮞ prompt** (resend role prompt) · **⏎ Enter** · **state** (the autopilot nudge) ·
   **y** · **Esc** · **^C** · **restart**. Top bar: **↻ state → all**.
5. You can also click into any panel and type directly — it's a full terminal.

## What you see

![TEAM // CONSOLE hero](../docs/console.png)

- **Top vitals strip** — four stacked progress bars, one per role
  (`lead` / `backend` / `frontend` / `quality`), each filled by that role's
  `done / total` ratio of board tasks. A role with no tasks shows `idle`
  instead of a fake `0 / 0`. To the right: telemetry-style chips with each
  role's accent border showing live `active` / `idle` / `stale` state from the
  `.team/log/*.md` mtime.
- **Brand status** — under the `TEAM // CONSOLE` wordmark, a small live
  subscript: `· LOCAL · N/4 CH · ONLINE | PARTIAL | STANDBY | OFFLINE ·`,
  driven by the WebSocket connection and the per-agent liveness state.
- **Cards (one per agent)** — role-coloured corner brackets, channel callsign
  (`CH·01` … `CH·04`) and `#role` tag in the header. Cards lift slightly on
  hover; the focused one shows a bright accent ring + `selected` badge.
- **Centred activity meter** — a 4-bar equalizer in the middle of every card
  header. Calm in idle, bars animate at varied tempos while the terminal is
  writing, then go flat red if the PTY exits. Honours `prefers-reduced-motion`.
- **`⚠ needs input`** — when an agent's terminal output looks like a
  confirmation prompt (`(y/n)`, "press enter", "do you want to…"), the
  *non-focused* card pulses warn-yellow with a badge until you click into it
  or send any input.
- **Kickoff feedback** — the green `▶ Kickoff all` button briefly flashes
  after a dispatch, and the Goal textarea clears so you can see the action
  was accepted. The per-agent `⮞ prompt` button still reads the Goal box
  live, so you can re-send the same goal to individual agents.
- **First-paint sizing** — the server spawns each PTY at `cols=140` so the
  first screen (Claude welcome, `/init` prompts, etc.) fits the card width
  without truncation, even before the browser's `FitAddon` sends an exact
  resize.

## Config (`agents.json`)
- `cmd`/`args` — defaults to `claude`; change if your CLI differs or to add flags.
- `prompt` — the launch prompt per agent (mirrors `../PROMPTS.md`); `{{GOAL}}` (lead) is
  filled from the Goal box.
- `label` — panel title.

## Env
- `PORT` (default `4173`), `REPO_DIR` (default: cwd), `AUTOSTART=0` (don't auto-launch;
  use each panel's **restart**), `TEST_CMD=bash` (smoke-test the bridge without claude).

## Notes
- Binds to `127.0.0.1` only (local). It drives whatever `claude` would do in your repo —
  same permission prompts; approve them with the panel buttons or by typing.
- Multi-line text (messages / prompts) is sent via bracketed paste so it doesn't submit
  line-by-line.
- `node-pty` is a native module; if `npm install` can't find a prebuilt binary it will
  compile (needs Python + a C/C++ toolchain).

---

## Agent Arena · Mission Control (`/arena`)

The same server also hosts a second surface — **Agent Arena**, an orchestration
cockpit for a swarm of specialised agents led by **ATLAS PRIME**.

```bash
node gui/server.js
# open http://localhost:4173/arena
```

What you get:

- **Atlas Prime** (cyber turtle, lead) plus 11 specialists with their own roles, super-skills
  and mascots: Sentinel (owl · risk), Aurora (fox · UI), Forge (mole · build),
  Prism (chameleon · viz), Echo (bat · events), Vega (hummingbird · perf),
  Scribe (raven · docs), Ledger (raccoon · cost), Raven (debug), Luma (firefly · a11y),
  Nova (dragon · product story).
- **Spawn timeline** — every rule firing and every spawn event Atlas makes.
- **Per-agent terminal cards** with idle / thinking / working / success / warning
  mascot animations, plus mini stats (confidence, risk, evolution).
- **Mascot Evolution** — five levels per mascot, additive SVG detail per level.
- **Broadcast bar** — type a briefing, press Enter, Atlas dispatches to every
  specialist and the terminals reply with role-flavoured logs.
- **Detail drawer** — click any card to see the agent's super-skill, briefing,
  capabilities, recent logs and mascot evolution controls.
- **Filters** — All / Active / Warning / Completed.
- **Reduced motion** — every animation respects `prefers-reduced-motion: reduce`.

### Auto-enter for permission prompts

The brief asked for an agent that can *steuern mehrere Terminals und auch Enter
drücken wenn man das erlaubt*. The Arena ships a per-PTY **auto-enter watchdog**:

- Toggle **⏎ auto** on an arena card (or use **⏎ Auto · all** in the toolbar).
- The arena tells the server which agents are armed. The server then watches
  every armed PTY's output for clear permission prompts —
  `(y/n)`, `[y/n]`, `press enter to continue`, `approve?`, `allow this tool to run`, etc. —
  and presses Enter for the operator (single fire, 1.5s cooldown so it can't
  loop on a stuck prompt).
- A note is broadcast back to the arena (`auto-fired`) so you see in the
  terminal log exactly when and why the server intervened.

It only fires on patterns that are unambiguously confirmations. It will not
auto-press through arbitrary CLI output. Disable any agent's auto-enter by
clicking the toggle again.

### Architecture

```
gui/server.js
  ├── http   /          → public/index.html      (original 4-agent console)
  ├── http   /arena     → public/arena.html      (Agent Mission Control)
  ├── http   /agents    → JSON config
  ├── http   /state     → folded .team state
  ├── http   /arena/state → arena server state (autoEnter list)
  ├── ws     /          → PTY bridge for the console
  └── ws     /arena     → arena protocol (auto-enter toggles)

gui/public/arena/
  ├── data.js       → registry, briefings, spawn rules, response bank
  ├── mascots.js    → 12 SVG mascot templates (evolution-aware)
  ├── state.js      → tiny reactive store
  ├── spawner.js    → Atlas's rule-based spawn engine
  ├── broadcast.js  → broadcast simulator (state machine per agent)
  ├── ui.js         → renderers (hero, lead panel, grid, drawer, timeline)
  ├── main.js       → app entry; ties store, engine, UI, WS
  └── styles.css    → cockpit dark theme + mascot animations
```

### Adding more agents

`gui/public/arena/data.js` is the single source of truth. Add a row to
`SEED_AGENTS`, add a matching SVG template to `gui/public/arena/mascots.js`,
optionally extend `SPAWN_RULES`. Atlas picks them up on next page load.
