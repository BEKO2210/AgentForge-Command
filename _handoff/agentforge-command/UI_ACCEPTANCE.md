# UI ACCEPTANCE — AgentForge Command

What each area of Mission Control is, what changed in this run, and how it maps
to the acceptance criteria. Screenshots are in `screenshots/`.

## The screens / areas

| # | Area | What it shows |
|---|---|---|
| 1 | **App bar** | Brand, connection state (offline / online · atlas live · rust), help `?`. |
| 2 | **Status bar** | Compact capability chips: **LIVE** (running/total PTYs), **AUTO** (armed), **REPORTS**, **ATLAS** (LLM live/off), **CLI** (Claude CLI found/missing), **PULSE** (rust/js), and **MODE = TEST HARNESS** when the harness is active. |
| 3 | **Stat strip** | Five mission stats (live PTYs, reports, Atlas, spend, warnings) as a thin band — no big paragraph. |
| 4 | **Atlas command center** (dominant) | Big Atlas mascot + name (+ TEST HARNESS tag), capability pills, and the **workflow stepper**. |
| 5 | **Atlas — his answer** | The headline area. Large, readable (15px), scrollable. **YOU** turns, **ATLAS** streamed answer, and a green **ATLAS · SUMMARY** final block. |
| 6 | **Dispatch & reports** | Per-specialist cards Atlas addressed, each with an honest badge (RUNNING / DISPATCHED / SKIPPED / ERROR), the task, and the report line (or "no live session — ▶ launch to deliver"). |
| 7 | **Technical events** | Collapsible `<details>` panel for tool calls, hook events, raw PTY lines, auto-enter and pulse notes. Collapsed by default so it never buries the answer. |
| 8 | **Agent grid** | The 12 specialist cards (mascot, channel, status, terminal, confidence/risk/evolution bars, launch/stop, ⏎ auto). |
| 9 | **Spawn timeline** | Right-hand chronological event log (boots, spawns, evolution, reports). |
| 10 | **Broadcast bar** | Bottom. ATLAS mode (talk to Atlas) / SWARM mode (raw to running specialists). |
| 11 | **Detail drawer** | Per-card: super-skill, briefing, stats, capabilities, **direct message** (enabled only when the PTY runs), recent activity, lineage. |
| 12 | **Spawn-Builder modal** | `Alt+N` — define a custom specialist (name, role, super-skill, mascot, colour). |

## Workflow stepper states

`idle → User → Atlas → Atlas plans → Dispatch → Agents work → Reports in →
Atlas summary → Done`. A failure turns the first step red (`failed`).

## What was improved in this run

- **Atlas is now the dominant figure.** A large, readable answer panel replaced
  the cramped 5-line transcript. Font is 15px with generous height
  (`min-height:280px`, scrollable).
- **Removed the big left explanatory text block** from the hero. The main
  screen now belongs to Atlas + swarm status. (Tips live in the `?` help
  overlay.)
- **Removed the static "Operator notes" block** from the right column.
- **Separated the human-readable answer from technical events.** Tool calls,
  hooks and raw PTY output moved into a collapsible "Technical events" panel; the
  answer area shows only the conversation (you / Atlas / summary).
- **Added a workflow stepper** so the operator sees exactly where a run is.
- **Added a Dispatch & reports panel** that names every specialist Atlas
  addressed and shows their report — honestly flagged running vs. not-running.
- **Added a TEST HARNESS badge** (Atlas name tag + status-bar chip) so a
  deterministic run can never be mistaken for a real LLM run.
- **Responsive:** desktop = Atlas dominant with answer (1.7fr) + dispatch (1fr);
  the answer/dispatch columns stack under 1000px; on mobile Atlas comes first,
  then the swarm grid; the answer area never collapses below readability.

## What was removed / moved

| Removed / moved | Where it went |
|---|---|
| Hero paragraph ("Atlas Prime scanned the repository…") | deleted; the `?` help overlay covers usage |
| "Operator notes" list (right column) | deleted; same tips live in `?` help |
| Cramped `lead-transcript` (5 lines) | replaced by the large `answer-scroll` |
| `mission-stream` mixing reports + events | split into **Dispatch & reports** (human) + **Technical events** (debug) |

## Acceptance criteria → evidence

| Criterion | Met by |
|---|---|
| Atlas is the central main figure | Atlas command center is the dominant area (screenshots 01–03) |
| Real Atlas answer is large & readable | `.answer-scroll` 15px, ≥280px tall |
| Not just tool calls / technical events | technical events are in a collapsed `<details>` panel |
| Old left text block no longer blocks the work area | hero paragraph + operator notes removed |
| I can send a message to Atlas | broadcast bar ATLAS mode → `atlas-brief` |
| System shows honestly what happens next | workflow stepper + dispatch panel + honest badges |
| Each agent really addressed / started / unavailable / harness-labelled | dispatch badges (RUNNING/DISPATCHED/SKIPPED) + TEST HARNESS badge |
| No fake success | harness frames tagged `harness:true`; not-running agents shown as such |
