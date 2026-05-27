# Reddit draft — r/ClaudeAI (and r/programming if it lands)

> Reddit posts do well with a real screenshot at the top, a clear use case,
> and an opening that signals "I built something and used it" rather than
> "look at my repo".

## Title

```
I got tired of Claude Code agents stepping on each other, so I built a
local mission control. 12 specialists, file-based coordination, optional
auto-enter for permission prompts.
```

## Body

```
Background: more than ~3 Claude Code sessions on one repo usually ends in
tears — overwritten files, races on git, "wait who's doing #3 again?". I
built a coordination kit, kept using it on a real project, then realised
twelve agents won't fit in the same head four did. So I added a cockpit.

The result is AgentForge Command. One Node process, two surfaces:
  - /         → Mission Control. Atlas Prime + 11 specialist cards.
  - /console  → the original 4-agent terminal grid, unchanged.

The cockpit has:
  - 12 animated SVG mascots (turtle, owl, fox, mole, chameleon, bat,
    hummingbird, raven, raccoon, debug-raven, firefly, dragon). Each has
    idle/thinking/working/success/warning states and 5 evolution levels.
    Pure CSS, zero libs.
  - A broadcast bar that either runs a local mock OR — if you set
    ANTHROPIC_API_KEY — streams a live briefing through Claude with usage
    + cost shown in Atlas's terminal.
  - A spawn timeline + a builder modal for ad-hoc specialists.
  - A per-PTY auto-enter watchdog: arm an agent and the server presses
    Enter on (y/n), "press enter", "approve?", "allow this tool to run" —
    single fire, 1.5s cooldown. Off by default.

Underneath, the original kit's rules still apply (one writer per file,
atomic mkdir locks, green gate, lead-only push). The /api/arena endpoint
exposes everything for any custom dashboards you want.

There's also an optional Rust accelerator (forge-pulse) — zero deps,
single file, advisory only, disable with FORGE_PULSE=0.

  git clone https://github.com/BEKO2210/AgentForge-Command
  cd AgentForge-Command
  cd gui && npm install && cd ..
  node gui/server.js          # → http://localhost:4173/

MIT-licensed, binds to 127.0.0.1, no telemetry. 88 bash tests + 5 Rust
tests on CI. Honest expectation: this is a developer cockpit, not a magic
autopilot. Atlas plans; the operator approves.

Happy to answer questions about the auto-enter heuristics, why Rust ended
up at exactly one seam and nowhere else, how the mascots stay cheap, and
how the 4-agent kit stayed compatible underneath.
```

## After posting

- Reply within the first 30 minutes. Reddit's algorithm rewards early
  engagement.
- If a comment asks "why not CrewAI / LangGraph?", explain the tradeoff
  plainly: AgentForge gives up dynamic graph routing and orchestrator-agent
  debate in exchange for zero coordination cost, git-native auditability,
  and a UI you can read at a glance.
