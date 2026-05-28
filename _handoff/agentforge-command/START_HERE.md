# START HERE — AgentForge Command handoff

This folder is the operator's handover for **AgentForge Command**. Read this
file first, then `RUNBOOK.md` for step-by-step commands.

## What is AgentForge Command?

A **local mission-control cockpit** for a swarm of Claude Code agents.
**Atlas Prime** is the single lead: you talk to Atlas, Atlas plans, dispatches
the right specialists, and every specialist reports back to him. There are 11
specialists (Sentinel, Aurora, Forge, Prism, Echo, Vega, Scribe, Ledger,
Raven, Luma, Nova). It runs entirely on your machine; the server binds to
`127.0.0.1`.

The UI is one Node server (`gui/server.js`) serving Mission Control at
`http://localhost:4173/`.

## How do I start it?

```bash
cd gui && npm install && cd ..
node gui/server.js
# open http://localhost:4173/
```

That's it. The app boots even with **no API key**, **no Claude CLI**, and **no
Rust** — it just tells you honestly which capabilities are available.

## The three modes (and how to tell which you're in)

The status bar (top of the cockpit) and `GET /api/arena` tell you the truth:

| Mode | When | What's real | How it's labelled |
|---|---|---|---|
| **Live LLM** | `ANTHROPIC_API_KEY` is set | Atlas's answer is real model output; specialists get real briefings pasted into real PTYs | status bar **ATLAS = live** |
| **Direct PTY** | No key, but the `claude` CLI is installed | Atlas talks to a real `claude` terminal session; his real output streams in | status bar **ATLAS = off**, **CLI = found** |
| **Test harness** | `AGENTFORGE_HARNESS=1` and no key | Deterministic routing only — **no LLM, no real work** | a yellow **TEST HARNESS** badge on Atlas + status bar **MODE = TEST HARNESS** |

> The harness exists so the routing chain can be proven offline. It never
> pretends an LLM ran: every event it emits is tagged `harness:true` and the
> badge is impossible to miss.

## How do I know Atlas is *really* answering?

Look at the big **"Atlas — his answer to you"** panel (the dominant area).

- **Live / Direct PTY:** you see Atlas's actual words stream in there.
- **Test harness:** you see the yellow **TEST HARNESS** badge and the answer
  text literally says "TEST HARNESS — no live LLM ran".

If you only see tool calls / hooks, those live in the collapsed **"Technical
events"** panel at the bottom — they never replace the answer.

## What should I see when everything works?

After sending Atlas a swarm-check message:

1. Your message appears as a **YOU** bubble.
2. Atlas's plan **streams** into the answer area, and the **workflow stepper**
   advances: `User → Atlas → Atlas plans → Dispatch → Agents work → Reports in
   → Atlas summary → Done`.
3. The **Dispatch & reports** panel fills with each addressed specialist, an
   honest badge (**RUNNING** / **DISPATCHED** / **SKIPPED**), and a report line.
4. A green **ATLAS · SUMMARY** block appears with what was checked, who
   responded, and what's open.

See `screenshots/02-atlas-workflow.png` for exactly this.

## Prove it yourself in 10 seconds

```bash
# deterministic routing proof (no key, no CLI needed)
cd gui && npm run smoke:atlas
# → writes _handoff/agentforge-command/WORKFLOW_TEST_REPORT.md and prints PASS/FAIL
```

## Where to go next

- `RUNBOOK.md` — install → start → test Atlas → launch an agent → hooks → auto-enter.
- `WORKFLOW_TEST_REPORT.md` — the latest routing-chain proof (regenerate with `smoke:atlas`).
- `UI_ACCEPTANCE.md` — what each screen area is and what changed.
- `KNOWN_LIMITS.md` — what needs a key / CLI / Rust, and what's intentionally local.
- `CHANGELOG_HANDOFF.md` — files changed, why, and the tests that prove it.
