# Why I built AgentForge Command

> Draft intro for a blog post, dev.to post, or LinkedIn article. Use as a
> starting point and adapt to your voice. Keep it personal — origin stories
> travel further than feature lists.

## Opening

I was running four Claude Code sessions on one repository at the same time.
It made sense in my head: a lead to plan, a backend to write the server, a
frontend to build the UI, a quality agent to keep the tests green. Four
hands instead of one. What could go wrong?

A lot, it turned out. They overwrote each other's files. They committed in
the same second and one of them lost the race. They started a task, then
forgot what they were doing because the board hadn't been updated. By the
third session I'd stopped using the agents to write code and started using
them to clean up each other's mess.

So I tried the obvious answer: a framework. LangGraph for the orchestration.
CrewAI for the role play. AutoGen for the back-and-forth. They all worked,
in the sense that the tutorials worked. They didn't work for me. I wanted to
*see* what was happening, *audit* every move, and not pay for coordination
tokens. I wanted the rules to fit on one page.

So I wrote them on one page. The rules became a `PROTOCOL.md`. The plan
became a `board.md`. Each agent got an append-only log. The shared state
went into a folder called `.team/`. I wrapped commits in an atomic mkdir
lock and a "green gate" that nothing can commit through unless tests pass.
Push privileges went to the lead.

That worked. It became the 4-Agent Team Kit.

## Then I needed to see twelve

Four agents fit in one head. Twelve don't. Once I started imagining a
specialist for risk, one for design polish, one for cost tracking, one for
debug forensics, I realised the file-based scaffold was the right substrate
but the wrong **interface**. I needed a cockpit.

AgentForge Command is that cockpit. Atlas Prime — a cyber turtle with a
command-bridge shell — sits at the top and orchestrates a swarm of eleven
specialists. Each one has a role, a super-skill, a mascot that breathes and
reacts to state, and a terminal that you can either drive yourself or hand
over to a real Claude session. The board, the locks, the green gate, the
MCP server, the bash test suite — all still there, still honest. The
cockpit is built **on top of** them.

## What I kept and what I added

I kept everything that earned its keep:

- The `.team/` substrate.
- The `team-*.sh` scripts.
- The atomic `mkdir` locks.
- The green gate that nothing pushes through red.
- The MCP server that exposes state read-only.
- The 87 sandboxed bash tests (plus 40 arena unit + 20 server integration on top).

I added what was missing:

- A premium browser cockpit at `/` with twelve animated mascots, a live
  mission stream, a broadcast bar, a spawn timeline and a builder modal for
  ad-hoc specialists.
- A per-PTY **auto-enter watchdog** so I never have to approve `(y/n)` again.
- A tiny **Rust accelerator** (`forge-pulse`) for the byte-level prompt
  matcher — crash-isolated, dependency-free, fully optional.
- An **optional live LLM bridge**: set `ANTHROPIC_API_KEY` and Atlas brief
  the swarm through the real API; fall back to a built-in mock when you
  don't.

## What I learned building it

- **Logs as authority is more honest than a board as authority.** Append-only
  event streams don't lie; a board is a human-edited cache. When they
  disagree, prefer the log.
- **`mkdir` is a better lock than `set -C`.** Atomic, portable, and the
  stale-break can be done via `rename` so two waiters can't both win.
- **Polyglot stacks grow at well-scoped seams.** Rust earned exactly one
  module — the hot-path matcher — and stayed out of the rest of the system.
  That's how it should grow.
- **Defaults matter more than features.** Auto-enter off by default,
  conservative whitelist, single fire, cooldown. Premium polish, not
  premium chaos.

## What's next

Not features — fit. Real teams. Specialists tuned to specialists' problems.
Maybe a Tauri desktop build later when somebody actually wants it.

The repo is at <https://github.com/BEKO2210/AgentForge-Command>. The arena
runs locally on `127.0.0.1:4173`, no account, no telemetry, no cloud — until
you tell it to.
