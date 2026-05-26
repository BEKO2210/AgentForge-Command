# Example — building a tiny todo CLI with the 4-agent team

A worked example. Nothing here gets executed automatically; it shows what a real run with
the kit looks like — kickoff, the lead-split board, a few representative log lines per
agent, and the resulting handoff structure. Use it as a fixture you can read end-to-end,
or as a template you can adapt to a real goal.

## The goal

> Build a tiny CLI called `todo` (Node, single file) that supports `add <text>`, `list`,
> `done <id>`, persisting tasks to `todos.json`. Include 3 unit tests.

## The kickoff (paste into the Lead terminal)

Use [`PROMPTS.md`](../../PROMPTS.md) — the Lead block — and replace the placeholder with
the goal above. The lead then splits it into rows on `.team/board.md`, like
[`board.example.md`](board.example.md).

## What you should see, step by step

| Tick | Lead | Backend | Frontend | Quality |
|------|------|---------|----------|---------|
| 0 | Reads goal · splits board · pings team | (idle) | (idle) | (idle) |
| 1 | Updates board as DONE/blocked lines arrive | `CLAIM #1`, scaffolds `bin/todo` and `src/todos.js` | `CLAIM #3`, owns the CLI help/UX strings | `CLAIM #4`, sets up the test runner |
| 2 | (idle, integration) | `DONE #1 — bin/todo + JSON persistence` | `DONE #3 — argument parsing + help text` | `DONE #4 — 3 unit tests green` |
| 3 | Final sync, integration commit, push | (idle) | (idle) | `✅ quality sign-off — full gate green` |

The exact contents of the per-agent logs (`.team/log/<role>.md`) for this kind of run are
illustrated by the fixture in [`logs.example.md`](logs.example.md).

## What this example demonstrates

- **Decomposition by the lead** into independent rows that fit each lane's globs.
- **Per-agent serial commits** through `scripts/team-commit.sh` — no `git add -A`.
- **Cross-lane handoffs** using the structured `HANDOFF → @role · #id · …` line so
  `scripts/team-lint-log.sh` and `scripts/team-sync.sh` can track them.
- **Green-gate enforcement** before each commit (here: `npm run lint && npm test`).
- **The lead is the only pusher**; everyone else commits locally.

## Apply this template to your own goal

1. Copy `board.example.md` to your `.team/board.md` and replace the rows with your tasks.
2. Edit `scripts/team-check.sh` to run your project's real lint + test command.
3. Make sure each role's `.team/roles/<role>.md` lists the paths that role owns for your
   stack (Node, Python, Rust, etc.).
4. Kick off the Lead with your goal.
