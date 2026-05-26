# Show HN draft — 4-Agent Team Kit for Claude Code

> Paste into a Show HN post. The HN audience values concrete, honest, minimal claims.
> No emojis in the title. Keep the body short; let the README do the rest.

## Title

```
Show HN: 4-Agent Team Kit – coordinating Claude Code sessions through plain files
```

## Body

```
I kept running multiple Claude Code agents on the same repo and they kept stepping on
each other — overwriting files, racing on commits, losing the plot. I wanted the
coordination to fit in my head, not in a framework, so I built this and used it on a
real project.

It's a coordination protocol, not a runtime. Four sessions share one `.team/` folder
of markdown (a board, per-agent append-only logs, role files, a memory file). A handful
of POSIX shell scripts enforce the rules: one writer per file, serialized commits
through an atomic `mkdir` lock with PID-liveness stale detection, a green gate before
every commit, lead-only push. Logs are the authority; the board is a projection a
`team-sync.sh` tool reconciles. There's also an optional Node web console and an
optional read-only MCP server.

Zero dependencies in the core. MIT-licensed. CI runs `bash -n` + shellcheck + an 87-check
sandboxed test suite on every push.

A self-contained 30-second demo runs without Claude Code:
  git clone https://github.com/BEKO2210/4-Agent-Team-Kit-for-Claude-Code
  cd 4-Agent-Team-Kit-for-Claude-Code
  bash scripts/team-demo.sh

Happy to answer questions about the locking, the board/log reconciliation, why I
didn't pick LangGraph/CrewAI/AutoGen, and how it behaves when an agent crashes.
```

## After posting

- Reply to early comments quickly (first hour matters).
- Don't argue with critics on Hacker News — explain your reasoning once, link to the
  relevant file, and let the work speak.
- Pin a comment with the demo command so people who scrolled past the body still see it.
