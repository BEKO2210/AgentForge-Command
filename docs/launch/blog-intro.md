# Why I built the 4-Agent Team Kit

> Draft intro for a blog post, dev.to post, or LinkedIn article. Use as a starting
> point and adapt to your voice. Keep it personal — origin stories travel further than
> feature lists.

## Opening

I was running four Claude Code sessions on one repository at the same time. It made
sense in my head: a lead to plan, a backend to write the server, a frontend to build
the UI, a quality agent to keep the tests green. Four hands instead of one. What could
go wrong?

A lot, it turned out. They overwrote each other's files. They committed in the same
second and one of them lost the race. They started a task, then forgot what they were
doing because the board hadn't been updated. By the third session I'd stopped using
the agents to write code and started using them to clean up each other's mess.

So I tried the obvious answer: a framework. LangGraph for the orchestration. CrewAI for
the role play. AutoGen for the back-and-forth. They all worked, in the sense that the
tutorials worked. They didn't work for me. I wanted to *see* what was happening,
*audit* every move, and not pay for coordination tokens. I wanted the rules to fit on
one page.

So I wrote them on one page. The rules became a `PROTOCOL.md`. The plan became a
`board.md`. Each agent got an append-only log. The shared state went into a folder
called `.team/`. I wrapped commits in an atomic mkdir lock and a "green gate" that
nothing can commit through unless tests pass. Push privileges went to the lead.

That's the whole idea.

## What I learned building it

- **Logs as authority is more honest than a board as authority.** Append-only event
  streams don't lie; a board is a human-edited cache. When they disagree, prefer the
  log.
- **`mkdir` is a better lock than `set -C`.** It's atomic, portable, and the stale-break
  can be done via `rename` — so two waiters can't both win.
- **Zero deps isn't a virtue, it's a forcing function.** It made me notice every place I
  was reaching for a library out of habit instead of need.

## What's next

The numbered milestones are done. The kit ships with an 87-check Bash test suite, a
GitHub Actions gate, a live web console, an MCP server, snapshots, and a German
translation of the docs. The bigger work now isn't features — it's getting it into the
hands of teams that have the same problem and seeing what they need next.

If that's you, the repo is at <https://github.com/BEKO2210/4-Agent-Team-Kit-for-Claude-Code>
and the README has a `bash scripts/team-demo.sh` that shows the whole thing in 30
seconds without installing Claude Code.
