# Show HN draft — AgentForge Command

> Paste into a Show HN post. The HN audience values concrete, honest, minimal
> claims. No emojis in the title. Keep the body short; let the README do the
> rest.

## Title

```
Show HN: AgentForge Command – local mission control for a Claude Code swarm
```

## Body

```
I kept running multiple Claude Code sessions on one repo. Four worked. Twelve
broke my head. So I built a local cockpit that orchestrates a swarm of
specialised agents — Atlas Prime as the lead, eleven specialists each with a
role, super-skill and an animated mascot, all driven from one browser tab.

The 4-agent coordination kit that started the project is still in there. The
`.team/` board, the atomic `mkdir` locks, the per-agent append-only logs, the
green gate, the MCP server, the 88-check Bash test suite — all unchanged and
all still the substrate. The new cockpit sits on top:

- Twelve animated SVG mascots with idle/thinking/working/success/warning
  states and 5 evolution levels. Pure CSS, no library.
- Per-PTY auto-enter watchdog: arm an agent, the server presses Enter on
  clear permission prompts ((y/n), "press enter", "approve?", "allow this
  tool to run", …). Single fire, 1.5s cooldown. Off by default.
- Broadcast bar that either runs the local mock simulator OR — if you set
  ANTHROPIC_API_KEY — streams a live briefing through Claude with usage +
  cost reported back to the UI.
- Spawn-Builder modal for ad-hoc specialists; per-agent real Claude PTYs you
  launch on demand with the role briefing pre-pasted.
- Optional Rust accelerator (forge-pulse) for the hot-path PTY matcher.
  Single-file, zero deps, crash-isolated. Disable with FORGE_PULSE=0.

Local-first, binds to 127.0.0.1, no telemetry. State persists to
.team/arena.json. Reduced-motion fully respected. MIT-licensed.

  git clone https://github.com/BEKO2210/AgentForge-Command
  cd AgentForge-Command
  cd gui && npm install && cd ..
  node gui/server.js          # → http://localhost:4173/

Happy to answer questions about the auto-enter heuristics, why Rust ended up
at one specific seam and nowhere else, how the mascots stay cheap to render,
and how the 4-agent kit stayed compatible underneath.
```

## After posting

- Reply to early comments quickly (first hour matters).
- Don't argue with critics on Hacker News — explain your reasoning once,
  link to the relevant file, and let the work speak.
- Pin a comment with `node scripts/render-mascots.mjs` + the gallery image so
  people who scrolled past the body still see it.
