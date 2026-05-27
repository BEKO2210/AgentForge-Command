# AgentForge GUI server

One Node process, two surfaces:

- **`/`** → AgentForge Mission Control (the new default cockpit)
- **`/console`** → Legacy TEAM // CONSOLE (the original 4-agent terminal grid)

Both share the same HTTP/WebSocket server, PTY bridge and `.team/`-aware
state endpoints. There is no duplication — the cockpit was added on top of
the console; the console kept all its original behaviour.

## Run

```bash
cd gui && npm install && cd ..
node gui/server.js              # → http://localhost:4173
```

The cockpit launches each agent in the directory you run from. Override
with `REPO_DIR=/path/to/repo`.

| Env var | Default | What it does |
|---|---|---|
| `PORT` | `4173` | Port for the local server. |
| `REPO_DIR` | `cwd` | Repo the agents run in. |
| `AUTOSTART` | `1` | Set `0` to skip auto-spawning the 4 legacy PTYs. |
| `TEST_CMD` | *(unset)* | Replace `claude` with another command (e.g. `bash`) for smoke tests. |
| `ANTHROPIC_API_KEY` | *(unset)* | Enables live LLM briefings in the arena. Server-only, never sent to the browser. |
| `AGENTFORGE_LLM_MODEL` | `claude-sonnet-4-6` | Model id for the LLM bridge. |
| `FORGE_PULSE` | `1` if binary present | Set `0` to disable the optional Rust accelerator. |

## Mission Control (`/`)

A premium cockpit for a swarm of specialised agents led by **Atlas Prime**.

- **Atlas command panel** with mascot, status pills and a live mission stream.
- **12 specialist cards**, each with an animated SVG mascot, channel callsign,
  status badge, terminal pane (blinking cursor + activity glow), confidence /
  risk / evolution mini-bars, and per-card `⏎ auto` + `★ evolve` toggles.
- **Broadcast bar** — `/` focuses, `Enter` dispatches to the entire swarm.
  Falls back to the local mock simulator when no LLM is configured.
- **Spawn timeline** — every rule firing and every spawn event Atlas makes,
  with the newest event highlighted.
- **Spawn-Builder modal** — `Alt+N`. Define a custom specialist (name, role,
  super-skill, mascot picker, swatch palette). Persists to `.team/arena.json`.
- **Detail drawer** — click any card for super-skill, briefing, stats, recent
  logs, capability chips and lineage.
- **Filters** — All / Active / Warning / Completed.
- **Reduced motion** — every animation honours `prefers-reduced-motion`.

### Auto-enter watchdog

Toggle **⏎ auto** on a card (or **⏎ Auto · all** in the toolbar) to arm the
server-side watchdog. When armed, the server matches PTY output against a
conservative whitelist (`(y/n)`, `press enter`, `approve?`, `allow this tool
to run`, …) and presses Enter for you — single fire, 1.5s cooldown, with an
`auto-fired` note broadcast back to Atlas's terminal.

### Per-specialist real Claude sessions

`gui/agents.json` ships a `specialists` array (Atlas + 11) with role-specific
briefing prompts. They **don't** autostart — you spawn them on demand from
the arena WebSocket:

```jsonc
{ "t": "start-pty", "id": "sentinel", "goal": "make tests green" }
```

The server starts the PTY, pastes the matching prompt (with `{{GOAL}}`
replaced) and presses Enter. The session boots straight into role.

### Live LLM briefings

Set `ANTHROPIC_API_KEY` and the broadcast bar routes through Claude live:
streaming text deltas land in Atlas's terminal, usage and cost are reported.
Without a key it falls back to the local mock simulator. Implementation in
`gui/llm.js` — zero npm dependencies, just `fetch` against the
[Anthropic Messages API](https://docs.anthropic.com/en/api/messages).

### Persistence

Arena UI state lives in `<repo>/.team/arena.json` (gitignored):

```json
{
  "evolution":    { "sentinel": 3, "aurora": 2 },
  "autoEnter":    ["lead", "backend"],
  "customAgents": [ /* operator-defined specialists */ ],
  "atlasMission": ""
}
```

Reset from the UI ("↺ Reset") or by deleting the file.

## Legacy console (`/console`)

The original TEAM // CONSOLE is preserved unchanged:

1. The 4 panels start their `claude` sessions automatically.
2. Type your task into the **Goal** box (top).
3. Click **▶ Kickoff all** — sends each agent its role prompt (Lead first),
   Goal injected.
4. Drive them: per-panel **message box** (Enter sends), or the buttons:
   **⮞ prompt** (resend role prompt) · **⏎ Enter** · **state** (the autopilot
   nudge) · **y** · **Esc** · **^C** · **restart**. Top bar: **↻ state → all**.
5. You can also click into any panel and type directly — it's a full terminal.

![TEAM // CONSOLE hero](../docs/console.png)

## API surface

- `GET /` → arena.html
- `GET /console` → console.html
- `GET /index.html` → 0-second redirect to `/`
- `GET /api/agents` → `{ agents, specialists, repoDir }`
- `GET /api/state` → folded `.team/` state (board counts + per-role liveness)
- `GET /api/arena` → `{ autoEnter, evolution, customAgents, ptyAgents, specialists, runningPtys, pulse, llm }`
- `WS  /` → legacy PTY bridge (input / resize / start / stop / output / exit)
- `WS  /arena` → arena protocol:
  - `auto-config` — arm auto-enter for a set of PTYs
  - `persist` — save evolution / customAgents / atlasMission
  - `press` — manually fire Enter into a PTY
  - `input` — send raw bytes to a PTY
  - `start-pty` / `stop-pty` — lifecycle, with optional `{goal}` for specialists
  - `atlas-brief` — stream a live LLM briefing (deltas + final usage/cost)
  - `atlas-brief-abort` — cancel an in-flight brief

## Notes

- Binds to `127.0.0.1` only. Exposing publicly is the operator's call.
- Multi-line text is sent via bracketed paste so it doesn't submit
  line-by-line.
- `node-pty` is a native module; if `npm install` can't find a prebuilt
  binary it will compile (needs Python + a C/C++ toolchain).
