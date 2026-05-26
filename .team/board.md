# Board — single source of truth (owned by LEAD)

The lead fills this from the human's goal and keeps it in sync with the logs.
State values: `todo` · `doing` · `blocked` · `done`.

**Goal:** Test-Website unter `test-site/` — minimaler statischer Auftritt (Landing + About + Kontakt) mit kleinem Backend-Stub und Smoke-Test.

| #  | Task                                                              | Owner    | State | Notes |
|----|-------------------------------------------------------------------|----------|-------|-------|
| 1  | `test-site/` Doku + Verzeichnis-Skelett (README, Ordnerlayout)    | lead     | done  | committed 4d0c68e — README + Layout |
| 2  | HTML/CSS Landing + About + Kontakt (responsive, a11y-basics)      | frontend | done  | committed d90ea4e — index/about/contact + main.css + app.js |
| 3  | Mini-Backend: statischer Server + `/api/hello` JSON-Endpoint      | backend  | done  | committed b8a36fd — routes /, /about, /contact, /api/hello |
| 4  | Smoke-Test: Server startet, `/` und `/api/hello` antworten 200    | quality  | done  | committed d7b08ab + d8c85a7 + e355834; sign-off, 8/8 smoke green |

## Milestones
- **M1** — Skelett & Doku stehen (#1 done) → frontend & backend können parallel ziehen.
- **M2** — Frontend + Backend lokal lauffähig (#2, #3 done).
- **M3** — Quality-Smoke grün + Lead-Push (#4 done, sign-off).

## Conventions
- Highest priority / unblocks-others first.
- One agent per row at a time. Cross-domain work = a new row + a `@role` handoff.
- A row is `done` only when its owner proved it (test/build/etc.) and logged the proof.
