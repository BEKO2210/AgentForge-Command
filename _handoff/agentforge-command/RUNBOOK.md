# RUNBOOK — AgentForge Command

Step-by-step operator commands. Run from the repo root unless noted.

## 0. Prerequisites

- **Node.js 18+** (tested on Node 22), **Bash**, **Git**.
- Optional: **Claude Code CLI** (`claude` on PATH) for real per-agent sessions.
- Optional: **`ANTHROPIC_API_KEY`** for live Atlas LLM briefings.
- Optional: **Rust/Cargo** for the `forge-pulse` accelerator (never required).

## 1. Install

```bash
cd gui && npm install && cd ..
```

> Do NOT use `npm ci --ignore-scripts` — `node-pty` is native and needs its
> build step.

## 2. Start the server

```bash
node gui/server.js
# → http://localhost:4173/
```

Useful env vars:

| Var | Effect |
|---|---|
| `PORT=4173` | server port (clear message + exit if busy) |
| `REPO_DIR=/path` | repo the agents run in (default: cwd) |
| `AUTOSTART=off\|lead\|all` | autostart nothing / just Atlas / all 12 |
| `ANTHROPIC_API_KEY=sk-ant-...` | enable live Atlas LLM briefings |
| `AGENTFORGE_HARNESS=1` | deterministic test harness (no key) |
| `TEST_CMD=bash` | replace `claude` with bash for smoke tests |
| `FORGE_PULSE=0` | disable the Rust accelerator |

Check the startup log — it reports `claude cli: found/missing`, `llm bridge:
enabled/disabled`, and `test harness: ON` when applicable.

## 3. Talk to Atlas

1. Open `http://localhost:4173/`.
2. Press `/` to focus the broadcast bar (mode **ATLAS**).
3. Type a mission and press **Enter**.
   - **Live** (`ANTHROPIC_API_KEY` set): Atlas streams a real answer and
     dispatches specialists.
   - **No key, CLI present:** the first message launches Atlas's real `claude`
     PTY with your mission.
   - **Harness** (`AGENTFORGE_HARNESS=1`): a deterministic routing run, clearly
     badged **TEST HARNESS**.

Watch the **workflow stepper** advance and the **Dispatch & reports** panel fill.

## 4. Launch a specialist (real Claude session)

- Click **▶ launch** on any specialist card (or open its drawer → **Launch real
  session**). The server starts a PTY for that agent.
- If the `claude` CLI is missing you get a visible **launch failed** message on
  the card and in Atlas's stream (no silent failure, no crash).

## 5. Send a message to one specialist

- Click a card to open its drawer → **Direct message** box at the bottom.
- The box is **disabled until that specialist's PTY is running** — launch first.

## 6. Broadcast to the running swarm

- Toggle the broadcast bar to **SWARM** (button on the left of the bar).
- Text is written into every *running* specialist's PTY. Dormant ones are
  skipped (honestly — they aren't faked as active).

## 7. Auto-enter (approve permission prompts)

- Toggle **⏎ auto** on a card to arm the server-side watchdog **for that agent
  only**. Toolbar **⏎ Auto · all** arms every specialist.
- A banner stays visible while any agent is armed; **Disarm all** clears it.
- It presses Enter only on a conservative whitelist (`(y/n)`, `press enter`,
  `approve?`, …), single-fire with a 1.5s cooldown, and logs an `auto-fired`
  note.

## 8. Tool hooks (authoritative agent state)

Drop `.claude/agentforge-hooks.example.json` into a project's
`settings.json`. Cockpit-spawned PTYs already have `AGENTFORGE_AGENT_ID` and
`AGENTFORGE_HOOK_URL` set. Probe it directly:

```bash
curl "http://127.0.0.1:4173/api/hooks?agent=sentinel&event=PreToolUse&tool=Read"
# → {"ok":true,"agentId":"sentinel","state":"reading",...}
```

Hook events appear on the agent's card and in Atlas's **Technical events** panel.

## 9. Tests

```bash
# full gate (bash + arena + server + workflow + schema)
bash tests/run.sh

# focused (from the gui/ directory)
cd gui
npm run test:arena       # arena unit tests
npm run test:server      # server integration tests
npm run test:workflow    # agentforge-real-workflow-smoke (routing chain)
npm run test:e2e         # server + workflow
npm run smoke:atlas      # one workflow run → WORKFLOW_TEST_REPORT.md

# optional Rust accelerator
cd tools/forge-pulse && cargo test --release
```

## 10. Live workflow test (real LLM)

```bash
AGENTFORGE_LIVE_TEST=1 ANTHROPIC_API_KEY=sk-ant-... node scripts/smoke-atlas-workflow.mjs
# drives a REAL Atlas run and writes the Markdown report.
```

## 11. Regenerate screenshots (optional)

```bash
node scripts/shot-atlas-workflow.mjs
# writes _handoff/agentforge-command/screenshots/{01-atlas-idle,02-atlas-workflow,03-tech-open}.png
```

## 12. Recognising failures

- **Port busy:** startup prints `port N is already in use` and exits — pick another `PORT`.
- **CLI missing:** status bar **CLI = missing**; launches show **launch failed**.
- **No key, no harness:** ATLAS mode talks to the real `claude` PTY; if `claude`
  is missing you'll see the launch error.
- **Corrupt `.team/arena.json`:** auto-backed-up to `arena.json.corrupt-<ts>` and
  reset; the server logs it and keeps running.
