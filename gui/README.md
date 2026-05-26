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
