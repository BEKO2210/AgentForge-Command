# AgentForge GUI server

One Node process serves **Mission Control** — a cockpit for a swarm of Claude
Code agents led by **Atlas Prime**. It fronts an HTTP REST surface, a tool-hook
receiver, and two WebSocket channels (the arena protocol + a legacy PTY shim).

> The original 4-agent *terminal* console UI has been retired. `/console` now
> 302-redirects to Mission Control (`/`). The `.team/`-based coordination
> scaffold it grew from is untouched — see [`../.team/PROTOCOL.md`](../.team/PROTOCOL.md).

## Run

```bash
cd gui && npm install && cd ..
node gui/server.js              # → http://localhost:4173
```

The cockpit launches each agent in the directory you run from. Override with
`REPO_DIR=/path/to/repo`.

| Env var | Default | What it does |
|---|---|---|
| `PORT` | `4173` | Port for the local server. Reports a clear message and exits if the port is busy. |
| `REPO_DIR` | `cwd` | Repo the agents run in. |
| `AUTOSTART` | `off` | `off` = nothing autostarts (launch from the cockpit); `lead` = auto-spawn only Atlas; `all` = spawn every specialist (12 sessions). |
| `TEST_CMD` | *(unset)* | Replace `claude` with another command (e.g. `bash`) for smoke tests. |
| `ANTHROPIC_API_KEY` | *(unset)* | Enables live LLM briefings in the arena. Server-only, never sent to the browser. |
| `AGENTFORGE_LLM_MODEL` | `claude-sonnet-4-6` | Model id for the LLM bridge. |
| `AGENTFORGE_HARNESS` | *(unset)* | `1` runs the deterministic **test harness** for `atlas-brief` when no key is set (no LLM, frames tagged `harness:true`, UI shows a "TEST HARNESS" badge). |
| `AGENTFORGE_BUDGET_USD` | `0` (unlimited) | Soft spend ceiling; once exceeded, new Atlas briefs are refused with a clear error. |
| `FORGE_PULSE` | auto | Auto-detected if the binary is present; set `0` to disable the optional Rust accelerator. |

Missing prerequisites fail loudly, not silently:

- **No `node-pty` / `ws`** → a clear "run `npm install`" message, then exit.
- **Port in use** → a clear `EADDRINUSE` message suggesting another `PORT`.
- **No `claude` CLI on PATH** → the server still boots (so you can view the
  cockpit), reports `claude cli: missing`, and any **▶ launch** returns a
  visible `launch-error` instead of a cryptic terminal line. Set `TEST_CMD=bash`
  to drive PTYs without the CLI.
- **No `ANTHROPIC_API_KEY`** → the cockpit runs; the broadcast bar talks to
  Atlas's real `claude` PTY directly instead of the LLM bridge.
- **No Rust** → `forge-pulse` is simply skipped; everything else works.

## Mission Control (`/`)

A cockpit for a swarm of specialised agents led by **Atlas Prime**.

- **Status bar** — live capability flags: running PTYs (X/Y), auto-enter armed
  count, reports to Atlas, **ATLAS** (LLM bridge live/off), **CLI** (Claude CLI
  found/missing), **PULSE** (Rust accelerator rust/js).
- **Atlas command panel** with mascot, status pills and a live mission stream.
- **12 specialist cards**, each with an animated SVG mascot, channel callsign,
  status badge, terminal pane, confidence / risk / evolution mini-bars, and
  per-card `⏎ auto` + `★ evolve` toggles, plus **▶ launch** / **⊗ stop**.
- **Broadcast bar** — `/` focuses, `Enter` dispatches. **ATLAS** mode talks to
  Atlas (LLM bridge if keyed, else his real PTY); **SWARM** mode writes into
  every *running* specialist's PTY. There is **no mock simulator** — an idle
  swarm stays idle.
- **Spawn timeline** — every meaningful event (boot, spawn, evolution,
  auto-enter, reports), newest highlighted.
- **Spawn-Builder modal** — `Alt+N`. Define a custom specialist. Persists to
  `.team/arena.json` and survives restarts.
- **Detail drawer** — click any card for super-skill, briefing, stats, recent
  logs, capability chips, lineage, and a per-agent direct-message box (enabled
  only while that specialist's PTY is running).
- **Filters** — All / Active / Warning / Completed.
- **Reduced motion** — every animation honours `prefers-reduced-motion`.

### Auto-enter watchdog

Toggle **⏎ auto** on a card (or **⏎ Auto · all** in the toolbar) to arm the
server-side watchdog **for exactly the agents you selected**. When armed, the
server matches PTY output against a conservative whitelist (`(y/n)`,
`press enter`, `approve?`, `allow this tool to run`, …) and presses Enter for
you — single fire, 1.5s cooldown, with an `auto-fired` note broadcast back to
Atlas's stream. An armed banner stays visible while it's active.

### Per-specialist real Claude sessions

`gui/agents.json` ships an `agents` array (Atlas + 11 specialists) with
role-specific briefing prompts. They **don't** autostart — you spawn them on
demand from the cockpit (**▶ launch**) or over the arena WebSocket:

```jsonc
{ "t": "start-pty", "id": "sentinel", "goal": "make tests green" }
```

With a `goal`, the server pastes the matching prompt (`{{GOAL}}` replaced) and
presses Enter so the session boots into role. **Without** a goal (a plain
"launch"), the shell stays clean so you can drive it yourself. Every spawned
PTY gets `AGENTFORGE_AGENT_ID` and `AGENTFORGE_HOOK_URL` in its environment.

### Live LLM briefings

Set `ANTHROPIC_API_KEY` and the broadcast bar's ATLAS mode routes through
Claude live: streaming text deltas land in Atlas's stream, usage and cost are
reported into the spend ledger, and Atlas auto-dispatches each tagged
specialist (a second pass expands the one-line task into a full briefing pasted
into that specialist's PTY). Without a key, ATLAS mode talks to Atlas's real
`claude` PTY directly — no mock. Implementation in `gui/llm.js` — zero npm
dependencies, just `fetch` against the
[Anthropic Messages API](https://docs.anthropic.com/en/api/messages).

### Tool hooks

`POST` (or `GET`) `/api/hooks` turns Claude Code's native hook events into
authoritative specialist state instead of inferring it from stdout. Accepts
JSON, `application/x-www-form-urlencoded`, or a query string:

```
GET  /api/hooks?agent=sentinel&event=PreToolUse&tool=Read
POST /api/hooks   {"agent":"sentinel","event":"PostToolUse","tool":"Edit","ok":true}
```

Invalid events (missing `agent`/`event`) return `400` without crashing. Drop
[`../.claude/agentforge-hooks.example.json`](../.claude/agentforge-hooks.example.json)
into a project's `settings.json` and it just works inside cockpit-spawned PTYs.

### Persistence

Arena UI state lives in `<repo>/.team/arena.json` (gitignored):

```json
{
  "evolution":    { "sentinel": 3, "aurora": 2 },
  "autoEnter":    ["forge"],
  "customAgents": [ /* operator-defined specialists */ ],
  "atlasMission": ""
}
```

A corrupt file never crashes the server: it's backed up to
`arena.json.corrupt-<ts>` and the cockpit boots to empty state. Reset from the
UI ("↺ Reset") or by deleting the file.

## Test & workflow scripts

From the `gui/` directory:

```bash
npm run test:arena       # arena unit tests
npm run test:server      # server integration tests (HTTP + WS)
npm run test:workflow    # agentforge-real-workflow-smoke (routing chain A–H)
npm run test:e2e         # server + workflow
npm run smoke:atlas      # one workflow run → _handoff/.../WORKFLOW_TEST_REPORT.md
```

`smoke:atlas` and `test:workflow` use the deterministic harness by default; set
`AGENTFORGE_LIVE_TEST=1 ANTHROPIC_API_KEY=sk-ant-...` for a real LLM run. The
full operator handover is in `../_handoff/agentforge-command/`.

## API surface

- `GET /` → arena.html (Mission Control)
- `GET /console` → 302 redirect to `/`
- `GET /index.html` → 0-second meta-refresh to `/`
- `GET /api/agents` → `{ swarm, leadId, repoDir }` (role prompts never leak)
- `GET /api/state` → folded `.team/` state (board counts + per-role liveness)
- `GET /api/arena` → `{ autoEnter, evolution, customAgents, atlasMission, ptyAgents, leadId, runningPtys, pulse, claudeCli, harness, llm, spend }`
- `GET|POST /api/hooks` → tool-hook receiver (resolves event/tool → state)
- `WS  /` → legacy PTY bridge (input / resize / start / stop / output / exit)
- `WS  /arena` → arena protocol:
  - `auto-config` — arm auto-enter for exactly the listed agents
  - `persist` — save evolution / customAgents / atlasMission
  - `press` — manually fire Enter into a PTY
  - `input` — send raw bytes to a PTY
  - `start-pty` / `stop-pty` — lifecycle, with optional `{goal}` for specialists
  - `atlas-brief` — stream a live LLM briefing (deltas + final usage/cost)
  - `atlas-brief-abort` — cancel an in-flight brief
  - `spend-get` / `spend-reset` — read / reset the cost ledger

## Notes

- Binds to `127.0.0.1` only. Exposing publicly is the operator's call.
- Multi-line text is sent via bracketed paste so it doesn't submit
  line-by-line; Enter is sent as a separate write 150ms later.
- `node-pty` is a native module; if `npm install` can't find a prebuilt
  binary it will compile (needs Python + a C/C++ toolchain). Do **not** use
  `npm ci --ignore-scripts` — node-pty needs its build step.
- Ctrl-C / SIGTERM trigger a clean shutdown: every live PTY is killed, the
  Rust accelerator is hung up, and the WebSocket servers are closed.
