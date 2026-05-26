# Reddit draft — r/ClaudeAI (and r/programming if it lands)

> Reddit posts do well with a real screenshot at the top, a clear use case, and an
> opening that signals "I built something and used it" rather than "look at my repo".

## Title

```
I got tired of Claude Code agents stomping on each other in the same repo, so I built
a file-based coordination protocol. Here's how it works.
```

## Body

```
4 Claude Code sessions on one repo usually ends in tears: overwritten files, races on
git, "wait who's doing #3 again?". I built a coordination kit that fixes this without
any framework — just a `.team/` folder of Markdown and a few shell scripts.

The rules (one breath):
  - One writer per file. Each agent owns its own log. The lead owns the board.
  - Serialized commits through `team-commit.sh`. Atomic mkdir lock, PID liveness,
    no race conditions even when four agents commit in the same second.
  - Green gate before every commit. Edit `team-check.sh` once for your stack.
  - Lead-only push.

The interesting design choice is treating the append-only per-agent logs as the
authority and the board as a projection. A `team-sync.sh` tool folds the logs into
"this is the state your board should be in" and reports drift, but it never overwrites
the board (the board has exactly one writer).

Other bits:
  - `team-health.sh` reports each agent's liveness and flags hanging `doing` tasks.
  - `team-resume.sh` rebuilds state after a crash from logs + git.
  - `team-snapshot.sh` captures everything as JSON; `team-diff.sh` compares two
    snapshots.
  - Optional Node GUI with a live vitals strip (screenshot in the README).
  - Optional MCP server that exposes the state as read-only resources.

It's MIT, zero deps in the core, 77 Bash tests on CI.

You can see it in action without installing Claude Code:
  bash scripts/team-demo.sh

Repo: https://github.com/BEKO2210/4-Agent-Team-Kit-for-Claude-Code

Happy to answer questions or hear what you'd structure differently.
```

## After posting

- Reply within the first 30 minutes. Reddit's algorithm rewards early engagement.
- If a comment asks "why not CrewAI / LangGraph?", explain the tradeoff plainly:
  this kit gives up dynamic graph routing and orchestrator-agent debate in exchange
  for zero deps, git-native auditability, and no token cost for coordination.
