# Board — single source of truth (owned by LEAD)

The lead fills this from the human's goal and keeps it in sync with the logs.
State values: `todo` · `doing` · `blocked` · `done`.

**Goal:** _(set by the human at kickoff — paste it here on the first board sync)_

| #  | Task | Owner | State | Notes |
|----|------|-------|-------|-------|
| _The lead populates this table after the human posts the kickoff prompt._ ||||

## Milestones
_(filled in by the lead once the table exists)_

## Conventions
- Highest priority / unblocks-others first.
- One agent per row at a time. Cross-domain work = a new row + a `@role` handoff.
- A row is `done` only when its owner proved it (test/build/etc.) and logged the proof.
