# FINDINGS — out-of-scope discoveries (all phases)

> **What this file is for.** Per the ROADMAP Master Protocol (§2, rule 2: *no
> scope creep*), anything noticed *outside* the current phase's scope is
> recorded here instead of being fixed on the spot. It is a shared inbox across
> all phases. Each entry should be small, dated, and actionable later.
>
> **What this file is NOT.** Not a bug tracker for in-scope work (that lives in
> the phase's own tasks/PR), and not a place to fix things — only to note them.

## How to add an entry

Append to the table. Keep it terse; link to file/line where useful.

| Date | Found in phase | Severity | Area | Finding | Suggested phase / action |
|------|---------------|----------|------|---------|--------------------------|

---

## Open findings

| Date | Found in phase | Severity | Area | Finding | Suggested phase / action |
|------|---------------|----------|------|---------|--------------------------|
| 2026-05-30 | Phase 2 | low | UI (`arena/ui.js`) | Phase 2.7 makes `streamBrief` return `cost: null` for an unknown model (+ a server warning), but `recordSpend`/`spendSnapshot` still coerce `null → 0`, so the Ledger card renders `$0.00` rather than "cost unknown". Propagating `null` to the UI touches the spend contract that `server-suite` asserts. | Now that E2E exists, render `null` as "cost unknown" in a future polish pass (still low priority). |

---

## Notes

- The three primary security findings (#1 CSWSH/Origin, #2 `/api/hooks` CSRF,
  #3 missing CSP/headers) are **already tracked in the ROADMAP** (Phase 1) and
  documented in `docs/THREAT_MODEL.md`. They are **in scope**, so they do *not*
  belong here — this file is only for things the roadmap did not already plan.
- When an entry is resolved, move it to a "Resolved" section below with the PR
  reference rather than deleting it, so the audit trail stays intact.

## Resolved findings

| Date resolved | Original finding | PR / commit |
|---------------|------------------|-------------|
| 2026-05-30 | Phase 3 deferred UI — 🌳 worktree badge on the card, `git status` in the drawer, and the orphaned-sessions relaunch banner. | Phase 4: implemented in `arena/ui.js` + `arena/main.js` + `arena.html`, verified by `tests/e2e/cockpit.e2e.mjs`. |
| _(none yet)_ | | |
