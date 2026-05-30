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
| 2026-05-30 | Phase 2 | low | UI (`arena/ui.js`) | Phase 2.7 makes `streamBrief` return `cost: null` for an unknown model (+ a server warning), but `recordSpend`/`spendSnapshot` still coerce `null → 0`, so the Ledger card renders `$0.00` rather than "cost unknown". Propagating `null` to the UI touches the untested browser bundle and the spend contract that `server-suite` asserts. | Phase 4 — add E2E first, then render `null` as "cost unknown" without risking the contract. |
| 2026-05-30 | Phase 3 | low | UI (`arena/main.js`, `ui.js`) | Server-side worktree + reattach are done and tested; the **data is already plumbed** to the client (`started` frames carry `worktree`/`branch`; `hello` + `/api/arena` carry `orphaned`). The visual treatment from tasks 3.1d/3.2c — a 🌳 worktree badge on the card, `git status` in the drawer, and an "Orphaned sessions" relaunch card — is **not yet rendered**. Deliberately deferred: the browser bundle has no E2E coverage yet, and this is the flagship "premium polish" UI. | Phase 4 — once Playwright E2E exists, render the badge + orphaned card and verify visually. |

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
| _(none yet)_ | | |
