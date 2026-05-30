# AgentForge Command — Production Roadmap

> **Zweck dieser Datei:** Ein vollständiger, phasenweise abarbeitbarer Plan, um AgentForge Command von „funktioniert lokal" auf **production-ready, sicher, getestet, rechtlich sauber und launch-fähig** zu bringen. Geschrieben als Reihe von **Work Orders**, die Claude Code **einzeln** (eine Phase pro Session, ein Branch pro Phase) abarbeitet — nicht in einem Rutsch.
>
> **Audit-Basis:** Commit-Stand `main` (57 Commits). Codebasis: **11.763 LOC** Produktivcode (986 LOC `server.js`), **1.637 LOC** Tests, 165 Bash/Node-Checks + 5 Rust-Tests grün. Stack: Node + Vanilla JS, optionaler Rust-Accelerator. Lizenz: MIT.
>
> **Status-Legende:** ☐ offen · ◑ in Arbeit · ☑ erledigt (Claude Code aktualisiert die Checkboxen pro Task)

---

## 0. Executive Summary — Die wichtigsten Befunde zuerst

Das Projekt ist **technisch deutlich reifer als der „Comming soon"-Eindruck** vermuten lässt: sauberes Shutdown-Handling, ehrliches „no fake activity"-Prinzip, Korrupt-State-Recovery, Spend-Ledger mit Forecast, CI-Gate inkl. `npm audit`, durchdachte SECURITY.md. Das ist eine gute Grundlage. Es gibt **einen echten Blocker** und eine überschaubare Zahl klar benennbarer Lücken.

| # | Befund | Schwere | Phase |
|---|--------|---------|-------|
| 1 | **Keine `Origin`-Prüfung beim WS-Upgrade → Cross-Site WebSocket Hijacking (CSWSH).** Jede offene Website kann sich zu `ws://localhost:4173/arena` verbinden, Tastatureingaben in laufende `claude`-PTYs schreiben (`input`), Sessions starten (`start-pty`) und Auto-Enter scharf schalten (`auto-config`). In Kombination = Drive-by-RCE. `127.0.0.1`-Binding schützt **nicht**. | 🔴 **P0 / Launch-Blocker** | 1 |
| 2 | **Kein CSRF-Schutz auf `/api/hooks`** (insb. GET): jede Seite kann per `<img src=…>` Mascot-State faken. Geringe Schwere, aber Trust-Boundary-Bruch. | 🟠 P1 | 1 |
| 3 | **Keine Security-Header / CSP** auf ausgeliefertem HTML. | 🟠 P1 | 1 |
| 4 | **Keine Git-Worktree-Isolation** — alle Specialists teilen sich `REPO_DIR` und können sich gegenseitig überschreiben. **Alle direkten Wettbewerber haben das** (Octogent, Crystal, Claude Squad, ccpm). Größte Feature-Lücke. | 🟠 P1 (Wettbewerb) | 3 |
| 5 | Kein `engines`-Feld / `.nvmrc`; CI nutzt inkonsistent Node 20 **und** 22; node-pty-Native-Build bricht auf macOS/Windows ohne Build-Tools. | 🟡 P2 | 2 |
| 6 | Keine Ressourcen-Guardrails (max. parallele PTYs), kein `/api/health`, kein strukturiertes Logging. | 🟡 P2 | 2 |
| 7 | Keine Security-Tests, kein Browser-E2E (Playwright), keine automatisierte a11y-Prüfung, **Benchmark für „sub-ms hot loop"-Claim fehlt** (Behauptung ohne Beleg). | 🟡 P2 | 4 |
| 8 | **Anthropic-Policy-Risiko (04.04.2026): Pro/Max-Abos für Drittanbieter-Frameworks gesperrt.** AgentForge spawnt echte `claude`-PTYs → fällt potenziell darunter. Muss im README offen adressiert werden. Kein Third-Party-Notices/SBOM, kein „Claude"-Trademark-/Non-Endorsement-Hinweis. | 🟠 P1 (rechtlich) | 5 |
| 9 | **Repo-Beschreibung = „Comming soon..." (Tippfehler + Platzhalter), 0 Stars, keine Topics, kein Release/Tag, kein Demo-GIF.** Killt den ersten Eindruck — der wichtigste Viral-Hebel liegt brach. | 🟢 P1 (Launch) | 6 |
| 10 | `package.json` heißt `team-gui` v1.0.0, kein Root-`package.json`, Pricing-Tabelle in `llm.js` ohne `opus-4-8`, kein Modell-Validation. | 🟡 P3 | 2/5 |

**Kernthese zur Viralität:** Mehr Code ≠ viral. Octogent ging mit ~kleiner Codebasis auf 472★/79 Forks; oh-my-claudecode mit 858★ in 24 h. Ruflo ist mit 250k LOC die Ausnahme, nicht die Regel — und gilt als „komplex". **AgentForges Trumpf ist Politur + ehrliches Verhalten + die niedrigste Aktivierungsenergie.** Genau da setzt Phase 6 an.

---

## 1. Wettbewerbs-Benchmark (Stand Mai 2026)

| Tool | Stars | Ansatz | Worktree-Isolation | Web-UI / Politur | „Try ohne Key" | Lizenz |
|------|-------|--------|:------------------:|:----------------:|:--------------:|--------|
| **Ruflo** (ex Claude Flow) | ~31k | CLI/MCP, Hive-Mind, persistente Memory, Federation (mTLS+ed25519), ~250k LOC | ✅ | ◑ (Chat-UI) | ✅ (hosted) | MIT |
| **Octogent** | ~472 | Lokales Web-Dashboard, „Tentacles", PTY-basiert (Cap 32) | ✅ | ✅ | ☐ | MIT |
| **ccpm** | ~7,9k | CLI, plan-getrieben | ✅ | ☐ | ☐ | MIT |
| **Claude Squad / Crystal** | mittel | Terminal, Worktree pro Agent | ✅ | ☐ (TUI) | ☐ | OSS |
| **AgentForge Command** | 0 | Lokales **Mission-Control-Cockpit**, 1 Lead (Atlas), Mascots, Spend-Ledger, Rust-Accelerator | ❌ (Phase 3) | ✅✅ **(stärkste Politur)** | ◑ (Harness vorhanden, nicht gehostet) | MIT |

**Ableitungen für die Roadmap:**
- **Worktree-Isolation ist Tischeinsatz** → Phase 3, Pflicht.
- **Premium-UI + Mascots + „no fake activity" sind dein Alleinstellungsmerkmal** → in Phase 6 in den Vordergrund stellen (Demo-GIF!).
- **Hosted Harness-Demo** („try without key") ist die billigste Viral-Maßnahme, die Ruflo bereits nutzt → Phase 6.
- **Octogent-Lektion:** „PTY überlebt Browser-Reload, aber nicht Server-Neustart" — AgentForge sollte mindestens gleichziehen → Phase 3 (Session-Reattach).

---

## 2. Master-Ausführungsprotokoll (für Claude Code verbindlich)

> **Diese Regeln gelten für JEDE Phase. Claude Code liest sie zu Beginn jeder Session erneut.**

1. **Eine Phase pro Session, ein Branch pro Phase.** Branch-Name: `phase-N-<kurzname>` (z. B. `phase-1-security-origin`). Niemals zwei Phasen mischen.
2. **Kein Scope-Creep.** Nur Tasks der aktuellen Phase. Auffälligkeiten außerhalb des Scopes → in `_handoff/agentforge-command/FINDINGS.md` notieren, **nicht** spontan fixen.
3. **Green Gate vor jedem Commit.** `bash scripts/team-check.sh` **und** (falls Rust berührt) `cargo clippy --release -- -D warnings && cargo test --release` müssen grün sein. Kein roter Gate-Commit.
4. **Tests zuerst bei Sicherheits-Fixes.** Erst der fehlschlagende Regressionstest (beweist die Lücke), dann der Fix (macht ihn grün). Gilt strikt für Phase 1 & 4.
5. **Fallback-Pflicht.** Jedes neue Feature braucht einen sicheren Degradationspfad (Feature fehlt/aus → alter Pfad funktioniert weiter). Beispiele inline pro Task.
6. **Keine Breaking Changes ohne Migrationsnotiz** in `CHANGELOG.md` + `_handoff/.../KNOWN_LIMITS.md`.
7. **Conventional Commits** (`feat:`, `fix:`, `sec:`, `test:`, `docs:`, `chore:`). Ein Thema pro Commit.
8. **Abschluss jeder Phase:** PR gegen `main`, Checkboxen in dieser Datei aktualisieren, Handoff-Eintrag schreiben, **erst dann** nächste Phase.
9. **Niemals Secrets loggen** (insb. `ANTHROPIC_API_KEY`). Bei jedem `console.log`/Test-Output prüfen.
10. **Bei Unsicherheit STOPP + Frage** an den Operator, statt zu raten. Lieber eine Rückfrage als ein falscher Fix in sicherheitskritischem Code.

**Definition of Done (projektweit):** Gate grün · neue Tests grün · Doku aktualisiert · CHANGELOG-Eintrag · keine offenen `TODO`/`FIXME` ohne Issue-Referenz · keine neuen `npm audit` High/Critical.

---

## 3. Phase 0 — Triage & Baseline *(kein Verhaltensänderung)*

**Ziel:** Messbare Ausgangslage + Threat-Model, bevor irgendetwas geändert wird. Ein Tag Arbeit, null Risiko.

**Warum:** „Production-ready" ist messbar oder es ist Meinung. Ohne Baseline kein Beweis der Verbesserung — und Phase 4 (Benchmarks) braucht Vorher-Werte.

**Aufgaben:**
- ☑ `docs/THREAT_MODEL.md` anlegen: Trust-Boundaries (Browser ↔ Server ↔ PTY ↔ Anthropic-API), Assets (laufende `claude`-Sessions = RCE-Wert), Angreifer (bösartige Webseite im selben Browser, anderer lokaler User, MITM auf API). STRIDE-Tabelle. **Befund #1–3 explizit dokumentieren.**
- ☑ `docs/BASELINE.md` anlegen: aktuelle LOC pro Datei, Test-Anzahl (165+5), Gate-Laufzeit, Bundle-Größe `gui/public/arena/*`, Anzahl `console.log`. Reproduzierbares Mess-Snippet beilegen.
- ☑ Coverage-Ist-Zustand erheben (Node `--experimental-test-coverage` oder `c8`) und in BASELINE festhalten — auch wenn es 0 % „echte" Coverage zeigt.
- ☑ `_handoff/agentforge-command/FINDINGS.md` anlegen (Sammelstelle für Out-of-Scope-Funde aller Phasen).

**Akzeptanzkriterien / Gate:** Beide Docs existieren, Gate weiterhin grün, **kein** Produktivcode geändert.

---

## 4. Phase 1 — Security Hardening 🔴 *(Launch-Blocker — höchste Priorität)*

**Ziel:** Die Trust-Boundary zwischen Browser und Server schließen. Nach dieser Phase kann keine fremde Website mehr das Cockpit fernsteuern.

**Warum:** Befund #1 ist ein realer RCE-Pfad. Solange er offen ist, **darf das Repo nicht beworben werden** — ein viraler Launch mit einer Drive-by-RCE-Lücke ist ein Reputations-GAU.

### 1.1 Origin-Allowlist + Host-Check (CSWSH & DNS-Rebinding) ☑
- In `gui/server.js`, im `server.on("upgrade", …)`-Handler: `req.headers.origin` gegen Allowlist prüfen — erlaubt nur `http://localhost:${PORT}` und `http://127.0.0.1:${PORT}`. Bei Mismatch: `sock.write("HTTP/1.1 403 Forbidden\r\n\r\n"); sock.destroy();`
- Gleiche Origin-Logik als Helper `isTrustedOrigin(req)`; auch auf **alle state-ändernden HTTP-Routen** anwenden (`/api/hooks`).
- **Host-Header-Check** (DNS-Rebinding-Schutz) auf HTTP **und** Upgrade: nur `localhost:PORT` / `127.0.0.1:PORT` akzeptieren, sonst 403.
- **Fallback:** ENV `AGENTFORGE_ALLOWED_ORIGINS` (kommagetrennt) erlaubt bewusste Erweiterung (z. B. Remote-Tunnel) — leer = nur localhost. Dokumentieren, dass das eine bewusste Lockerung ist.

### 1.2 Per-Session Capability-Token ☑
- Beim Start `crypto.randomBytes(32).toString("hex")` generieren, **in die Konsole drucken** und in `arena.html` server-seitig als `window.__AFC_TOKEN` injizieren (Server liest `arena.html`, ersetzt Platzhalter — same-origin kann lesen, cross-origin nicht).
- WS-Upgrade verlangt `?token=` == Session-Token. State-ändernde HTTP-Routen verlangen Header `x-afc-token` **oder** Query-Token.
- `AGENTFORGE_HOOK_URL`, das in PTY-Env injiziert wird, um `?token=…` erweitern → Hook-Skripte funktionieren weiter, fremde Seiten nicht.
- **Fallback:** `AGENTFORGE_NO_TOKEN=1` für bewussten Single-User-Trust (mit lauter Warnung im Log). Default = Token an.

### 1.3 `/api/hooks` absichern ☑
- GET darf **keinen** State mehr ändern (nur als reiner Probe-Echo ohne Broadcast erlauben, oder GET auf 405 setzen wenn ohne Token). POST verlangt Token + Origin/Host-Check.
- Body-Cap (64 KB) ist vorhanden — behalten, zusätzlich `Content-Type`-Allowlist.

### 1.4 Security-Header & CSP ☑
- Für ausgelieferte Dateien setzen: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (Clickjacking), `Referrer-Policy: no-referrer`, restriktive `Content-Security-Policy` (`default-src 'self'; connect-src 'self' ws://localhost:* ws://127.0.0.1:*; img-src 'self' data:; style-src 'self' 'unsafe-inline'`). CSP gegen tatsächliche Inline-Styles in `arena.html` testen, ggf. Nonce statt `unsafe-inline`.

### 1.5 WS-Message-Härtung ☑
- Pro Arena-WS-Nachricht: max. Rohgröße cappen (z. B. 256 KB), JSON-Parse in try/catch (vorhanden), unbekannte `m.t` ignorieren (vorhanden). `input`/`press` zusätzlich auf plausible Länge begrenzen.
- Simple Rate-Limit pro Connection (Token-Bucket) gegen Message-Flooding.

### 1.6 Path-Traversal-Härtung (statische Files) ☑
- `decodeURIComponent` auf `rel` anwenden, dann `path.normalize`, dann erneut `startsWith(PUBLIC)`-Check — schützt gegen `%2e%2e`-Varianten. Regressionstest beilegen.

**Tests (Phase 4 ergänzt mehr — hier die Pflicht-Minimalmenge):**
- ☑ `tests/security-suite.mjs`: WS-Upgrade mit fremdem `Origin` → 403. WS ohne Token → 403. Host-Mismatch → 403. `/api/hooks` GET-Mutation ohne Token → blockiert. Path-Traversal `/..%2f..%2fetc%2fpasswd` → 404/403.
- ☑ `tests/run.sh` um `security-suite` erweitern; Gate-Check muss sie ausführen.

**Akzeptanzkriterien / Gate:**
- Alle Security-Tests grün; bestehende 165+5 weiterhin grün.
- Manueller Beweis dokumentiert: ein zweiter Browser-Tab auf `https://example.com` mit `new WebSocket("ws://localhost:4173/arena")` wird abgewiesen (vorher/nachher in `THREAT_MODEL.md`).
- SECURITY.md aktualisiert: neues Token-/Origin-Modell beschrieben.

---

## 5. Phase 2 — Runtime-Robustheit & Ressourcen-Guardrails

**Ziel:** Sauberer Betrieb auf realen Maschinen (Linux/macOS/Windows), keine Zombie-Prozesse, klare Fehler, Supervisor-fähig.

**Warum:** Installations-Hürden und Native-Build-Fehler sind die Top-Ursache für „funktioniert bei mir nicht"-Issues → tötet Star-Conversion direkt nach dem Klick.

**Aufgaben:**
- ☑ **Node-Version festnageln:** `engines` (`"node": ">=18"`) in `gui/package.json` + `mcp/package.json`, `.nvmrc` (`20`) im Root. CI-Inkonsistenz beheben → eine Quelle der Wahrheit.
- ☑ **Root-`package.json`** als npm-Workspace (`workspaces: ["gui", "mcp"]`) + Root-Scripts (`npm run dev`, `npm test`, `npm run gate`) → ein Einstiegspunkt statt „cd gui && …". `start` muss aus dem Root funktionieren.
- ☑ **node-pty-Resilienz:** beim Import-Fehler bereits guter Hinweis (vorhanden). Ergänzen: `docs/INSTALL.md` mit Build-Tool-Voraussetzungen pro OS (Linux `build-essential python3`, macOS `xcode-select --install`, Windows `windows-build-tools`). **Fallback-Pfad dokumentieren:** Docker-Image (siehe unten) für User ohne Build-Kette.
- ☑ **Dockerfile + `docker-compose.yml`:** ein `docker run`-Pfad, der Harness-Mode ohne lokale Toolchain startet (Viral-Hebel + Test-Reproduzierbarkeit). `127.0.0.1`-Binding im Container beachten (Port-Mapping nur an localhost).
- ☑ **`/api/health`-Endpoint:** `{ status, uptime, activePtys, budget, version }` für Supervisor/Probes. Kein Secret im Output.
- ☑ **PTY-Cap:** `AGENTFORGE_MAX_PTYS` (Default z. B. 8), `start-pty` lehnt über Limit mit klarer Meldung ab (Octogent-Parität: dort 32). Schützt vor versehentlichem 12-Session-Sturm.
- ☑ **Zombie-Reaping:** idle/exited PTY-Records nach Timeout aus `agents`-Map entfernen; `onExit` räumt `autoLastFire` etc. auf.
- ☑ **Strukturiertes Logging:** dünner Logger (`log.info/warn/error`) mit `AGENTFORGE_LOG_LEVEL` (`debug|info|warn|error`, Default `info`) + `--quiet`. Kein Verhalten ändern, nur Konsistenz.
- ☑ **Spend-Ledger optional persistieren:** `AGENTFORGE_SPEND_FILE` → JSONL-Append, beim Start einlesen. **Fallback:** ohne ENV exakt wie heute (in-memory, Reset bei Neustart).
- ☑ **Modell-/Pricing-Pflege** (`gui/llm.js`): `claude-opus-4-8` ergänzen, Pricing-Tabelle + Default kommentiert „zuletzt geprüft am …", unbekanntes Modell → `cost: null` statt stiller 0, sichtbarer Hinweis im UI.

**Akzeptanzkriterien / Gate:** `npm start` aus Root läuft · `/api/health` liefert validen JSON · PTY-Cap greift (Test) · Docker-Image baut & startet Harness · Gate grün · `npm audit` ohne High/Critical.

---

## 6. Phase 3 — Wettbewerbs-Parität: Der Moat

**Ziel:** Die Features schließen, die alle ernsthaften Konkurrenten haben — plus AgentForges eigene Stärke (Cockpit) darauf aufsetzen.

**Warum:** Ohne Worktree-Isolation ist das Tool für echte Parallelarbeit unbrauchbar (Agenten überschreiben sich) — der häufigste „deal-breaker"-Kommentar bei solchen Tools.

### 3.1 Git-Worktree-Isolation pro Specialist 🟠 ☐
- Beim `start-pty` für einen Specialist optional ein dediziertes `git worktree` unter `.agentforge/worktrees/<id>/` auf Branch `agentforge/<id>` anlegen; PTY-`cwd` darauf setzen. Atlas (Lead) bleibt auf `REPO_DIR` (integriert/merged).
- Lifecycle: Worktree bei `stop-pty` optional behalten (für Review) oder aufräumen (`AGENTFORGE_WORKTREE_CLEANUP`).
- UI: Worktree-/Branch-Badge auf der Karte; Drawer zeigt `git status` des Worktrees.
- **Fallback:** `AGENTFORGE_WORKTREES=0` → altes Verhalten (shared `REPO_DIR`). Default an, aber sauber abschaltbar. Bei Nicht-Git-Repo automatisch deaktivieren + Hinweis.
- Tests: Worktree-Anlage, isolierte Edits stomp-frei, Cleanup, Nicht-Git-Fallback.

### 3.2 Session-Reattach über Server-Neustart hinweg ☐
- PTY-Metadaten (id, cmd, cwd, Branch, Startzeit) in `.team/sessions.json` persistieren. node-pty-Prozesse überleben den Server-Neustart selbst nicht — daher: beim Start erkannte verwaiste Sessions sauber als „verwaist" markieren und **Ein-Klick-Relaunch** im selben Worktree anbieten (Octogent-Parität, ehrlich umgesetzt: kein Fake-Reattach).
- **Fallback:** Datei fehlt/korrupt → Korrupt-Backup-Muster wie bei `arena.json` wiederverwenden.

### 3.3 Orchestrierung als MCP-Tools (Aufbau auf vorhandenem `mcp/`) ☐
- Der vorhandene `mcp/server.js` ist **read-only** State-Exposure. Ergänzen: opt-in **Action-Tools** (`dispatch_goal`, `launch_specialist`, `swarm_status`), die über die lokale `/arena`-WS + Token an den laufenden Server delegieren — so wird AgentForge per `claude mcp add agentforge -- node mcp/server.js` aus Claude Code heraus steuerbar.
- **Sicherheitsgrenze:** Action-Tools nur, wenn Token vorhanden; read-only bleibt Default. In THREAT_MODEL ergänzen.

### 3.4 `agents.json`-Schema-Validierung ☐
- JSON-Schema für `agents.json` (analog `schema/team-state.schema.json`) + Validierung beim Start mit klarer Fehlermeldung statt stillem Fehlverhalten. `cmd` bleibt operator-authored (kein WS-Injection-Pfad) — im Schema dokumentieren, dass `cmd` Vertrauensgrenze ist.

**Akzeptanzkriterien / Gate:** Zwei Specialists editieren parallel ohne Konflikt (Worktree-Beweis im Test) · Reattach-Flow dokumentiert & getestet · MCP-Action-Tools nur mit Token · Schema-Validierung bricht bei kaputter `agents.json` sauber ab · Gate grün.

---

## 7. Phase 4 — Test- & Quality-Engineering

**Ziel:** Belegbare Qualität statt Behauptung. Jeder Marketing-Claim („sub-ms", „165 Tests", „stabil") wird durch einen reproduzierbaren Beweis gedeckt.

**Warum:** Viral-Traffic bringt kritische Augen (Show HN/Reddit). Ein widerlegter Claim („sub-ms" ohne Zahl) kostet mehr Glaubwürdigkeit, als er je gebracht hat.

**Aufgaben:**
- ☐ **Security-Regression-Suite** (aus Phase 1) als Dauer-Bestandteil des Gates.
- ☐ **Playwright-E2E:** echter Headless-Browser fährt das Cockpit im **Harness-Mode** (kein Key nötig): Atlas dispatcht → Stepper läuft → Dispatch-Panel zeigt Specialists → „TEST HARNESS"-Badge sichtbar. Deckt die UI ab, die die Server-Suite nicht sieht.
- ☐ **a11y automatisiert:** `axe-core` gegen `arena.html` (Kontrast, ARIA, Fokus) — der README behauptet a11y, also belegen. `prefers-reduced-motion` testen.
- ☐ **Performance-Benchmark `forge-pulse` vs. JS-Matcher:** Mikro-Benchmark (z. B. 1 Mio. PTY-Byte-Chunks), reale Zahlen (p50/p99 Latenz, Durchsatz) in `docs/BENCHMARKS.md`. **Entweder Claim mit Zahl belegen oder Claim entschärfen.**
- ☐ **CI-Matrix:** `ubuntu-latest`, `macos-latest`, `windows-latest` × Node `18/20/22`. node-pty-Build auf allen dreien verifizieren (deckt Befund #5 ab). Windows ist erfahrungsgemäß der Bruchpunkt — bewusst testen.
- ☐ **Coverage-Reporting** (`c8`) mit Schwellwert (Start: Ist-Wert + 5 %, nicht utopisch), Badge in README.
- ☐ **CI-Status-Badge** (gate) + Coverage-Badge ins README.
- ☐ *(optional)* Lasttest: 8 parallele PTYs + Broadcast-Sturm, Speicher-/CPU-Profil dokumentieren.

**Akzeptanzkriterien / Gate:** E2E grün in CI · a11y ohne Violations (oder dokumentierte, bewusste Ausnahmen) · `BENCHMARKS.md` mit echten Zahlen · CI-Matrix grün auf 3 OS × 3 Node · Coverage-Schwelle erzwungen.

---

## 8. Phase 5 — Recht, Compliance & Vertrauen

**Ziel:** Rechtlich sauber und transparent — besonders relevant, weil du im DACH-Raum agierst und das Tool fremden Code + eine fremde API berührt.

**Warum:** Ein viraler OSS-Launch zieht auch Juristen-Augen an. „Claude"-Marken-Missbrauch, fehlende Third-Party-Notices oder eine verschwiegene Pro/Max-Sperre sind vermeidbare Eigentore.

> ⚠️ **Hinweis:** Ich bin kein Anwalt; das ist keine Rechtsberatung. Die Punkte unten sind Standard-OSS-Hygiene. Für die Trademark-/Policy-Formulierungen im Zweifel kurz fachlich gegenlesen lassen.

**Aufgaben:**
- ☐ **Anthropic-Policy offen adressieren** (Befund #8): README-Abschnitt „Pro/Max vs. API". Klarstellen: Der **LLM-Bridge-Pfad nutzt deinen API-Key** (von der 04.04.2026-Sperre unberührt). Der **PTY-Pfad startet deine lokale `claude`-CLI** — Nutzer sind selbst dafür verantwortlich, dass ihre Nutzung den Anthropic-Nutzungsbedingungen entspricht. Keine Umgehungs-Anleitung, nur ehrliche Einordnung.
- ☐ **Trademark-/Non-Endorsement-Notice:** „Claude" und „Claude Code" sind Marken von Anthropic; AgentForge ist ein **inoffizielles, unabhängiges** Community-Tool, **nicht** von Anthropic unterstützt oder gesponsert. In README + `NOTICE`.
- ☐ **Third-Party-Notices / Lizenz-Inventar:** `THIRD_PARTY_NOTICES.md` für `node-pty`, `ws`, `@modelcontextprotocol/sdk` (Lizenztexte/Verweise). MIT-Kompatibilität bestätigen.
- ☐ **SBOM:** CycloneDX im CI generieren (`@cyclonedx/cyclonedx-npm`) und als Release-Artefakt anhängen.
- ☐ **Kosten-/Datenfluss-Transparenz:** README-Abschnitt „Was verlässt deine Maschine?" — nur API-Calls an `api.anthropic.com` **wenn** Key gesetzt; sonst nichts. Spend-Ledger erklärt, dass **du** die Token-Kosten trägst. (Die „No telemetry"-Aussage ist bereits gut — hier nur schärfen.)
- ☐ **Datenschutz/DSGVO-Notiz** (DACH): kurze `PRIVACY.md` — keine personenbezogene Datenverarbeitung serverseitig, alles lokal, keine Cookies/Tracker. Passt zu deinem „privacy-first"-Profil.
- ☐ **Responsible-Use / Auto-Enter-Warnung:** Prominenter Hinweis, dass Auto-Enter Berechtigungs-Prompts **automatisch bestätigt** und nur in vertrauenswürdigen Repos genutzt werden sollte. (SECURITY.md nennt das bereits als in-scope — ins README hochziehen.)
- ☐ **SECURITY.md finalisieren:** Coordinated-Disclosure-Fenster (z. B. 90 Tage), das neue Token-Modell, unterstützte Versionen-Tabelle.
- ☐ **Branding-Konsistenz:** `package.json`-Name `team-gui` → `agentforge-command` (bzw. scoped), Versionierung an Releases koppeln (Phase 6).

**Akzeptanzkriterien / Gate:** Alle genannten Dateien existieren & sind im README verlinkt · SBOM-Artefakt im CI · keine Marken-/Lizenz-Falschaussagen · Gate grün.

---

## 9. Phase 6 — Viralität & Launch 🚀

**Ziel:** Aktivierungsenergie minimieren, ersten Eindruck maximieren, sauber launchen. **Erst starten, wenn Phase 1 abgeschlossen ist** (kein Launch mit offener RCE).

**Warum:** Du hast bereits Launch-Entwürfe (`docs/launch/show-hn.md`, `reddit-claudeai.md`, `blog-intro.md`) — aber „Comming soon..." als Repo-Beschreibung, 0 Topics, kein Release und kein Demo-GIF verschenken jeden Klick. Das hier ist der Hebel mit dem höchsten ROI pro Stunde.

**Aufgaben:**
- ☐ **Repo-Metadaten fixen:** Beschreibung (statt „Comming soon...") z. B. *„A premium local mission-control cockpit for orchestrating a swarm of Claude Code agents — honest, local-first, zero telemetry."* + Topics: `claude-code`, `ai-agents`, `agent-orchestration`, `multi-agent`, `mission-control`, `nodejs`, `rust`, `local-first`, `developer-tools`.
- ☐ **Demo-Asset (wichtigster Einzel-Hebel):** 10–20 s **asciinema**/GIF/MP4 oben im README — Atlas bekommt ein Ziel, dispatcht, Mascots animieren, Stepper läuft. Im Harness-Mode aufnehmbar (kein Key nötig). Das verkauft die Politur, die deine Konkurrenz nicht hat.
- ☐ **Hosted „Try without key"-Demo:** Harness-Mode statisch/als Read-Only-Replay deployen (GitHub Pages/Netlify/Cloudflare — du hast die Infra). Ruflos Erfolgsmuster: ausprobieren ohne Install/Key.
- ☐ **One-command try:** `npx agentforge-command` **oder** `docker run …` als allererster Schritt im README (über `git clone`). Niedrigste Hürde gewinnt.
- ☐ **Vergleichstabelle ins README** (aus Abschnitt 1 dieser Datei, neutral & fair — eigene Schwächen offen, eigene Stärke Politur+Ehrlichkeit hervorgehoben).
- ☐ **„Why AgentForge"-Abschnitt:** 3 Sätze, die das Alleinstellungsmerkmal auf den Punkt bringen (no fake activity · premium cockpit · local-first/zero-telemetry).
- ☐ **GitHub Release v1.0.0 + semver-Tags:** CHANGELOG + `docs/release-notes/*` existieren bereits → echtes Release ziehen, SBOM anhängen. Ab dann Tag pro Release.
- ☐ **Badges:** CI-Gate, Coverage, License, „tested on Linux/macOS/Windows", Node-Version. Tote/Platzhalter-Badges entfernen.
- ☐ **README EN/DE synchron halten** (`README.de.md` existiert — Diff prüfen, dein DACH-Publikum bedienen).
- ☐ **`.github/FUNDING.yml`** verifizieren (existiert) + Sponsor-CTA dezent.
- ☐ **Launch-Sequenzierung** (deine Entwürfe finalisieren): Tag 0 Show HN (vormittags US-Zeit) → r/ClaudeAI + r/ClaudeCode (menschlicher Ton, kein Marketing-Sprech) → dev.to-Artikel → in `awesome-claude-code-toolkit` als PR eintragen (kuratierte Liste = nachhaltiger Traffic). **Erst posten, wenn Demo-GIF + One-command-try + Release live sind.**

**Akzeptanzkriterien / Gate:** Repo-Beschreibung/Topics gesetzt · Demo-Asset im README · One-command-try funktioniert frisch geklont · v1.0.0-Release publiziert · Vergleichstabelle live · Launch-Posts terminiert (nicht vor Phase 1).

---

## 10. Reihenfolge & Abhängigkeiten

```
Phase 0 (Baseline)
   └─> Phase 1 (Security) ── HARTE VORAUSSETZUNG für Phase 6 (Launch)
          ├─> Phase 2 (Robustheit)
          │       └─> Phase 3 (Worktree/Reattach/MCP)
          ├─> Phase 4 (Tests/Benchmarks)  [kann parallel zu 2/3 laufen]
          └─> Phase 5 (Recht/Compliance)  [kann parallel zu 2/3/4 laufen]
                    └─> Phase 6 (Launch)  [zuletzt, nach 1 zwingend]
```

**Empfohlene Sprint-Taktung (je 1 fokussierte Claude-Code-Session, ggf. mehrere pro Phase):**
1. Phase 0 — ½ Tag
2. Phase 1 — 1–2 Sessions (höchste Sorgfalt, Tests zuerst)
3. Phase 2 — 1–2 Sessions
4. Phase 4 — 1–2 Sessions (Benchmarks brauchen Zeit)
5. Phase 3 — 2 Sessions (Worktree ist der größte Brocken)
6. Phase 5 — 1 Session
7. Phase 6 — 1 Session + Launch-Tag

---

## 11. Was bewusst NICHT gemacht wird (Anti-Scope)

Damit das Projekt fokussiert bleibt und nicht zum 250k-LOC-Moloch wird:
- **Keine** Federation/Multi-Machine in v1 (Ruflos Terrain; später als Plugin denkbar).
- **Keine** persistente „Learning-Loop"-Memory in v1 (Komplexitäts-/Wartungsfalle).
- **Keine** Multi-Provider-Abstraktion (Gemini/Codex) — AgentForge ist bewusst **Claude-Code-nativ**; das ist Fokus, kein Mangel.
- **Kein** Account-/Cloud-Backend — local-first bleibt das Versprechen.

> Diese Entscheidungen in `docs/THREAT_MODEL.md` bzw. README als „Non-Goals" festhalten — bewusste Reduktion ist ein Qualitätsmerkmal, kein Defizit.

---

## 12. Tracking-Checkliste (Kurzform)

- ☑ **P0:** Phase 1.1 Origin/Host-Check
- ☑ **P0:** Phase 1.2 Session-Token
- ☑ **P1:** Phase 1.3–1.6 (Hooks/CSP/WS/Path)
- ☐ **P1:** Phase 3.1 Worktree-Isolation
- ☐ **P1:** Phase 5 Anthropic-Policy + Trademark + Notices
- ☐ **P1:** Phase 6 Repo-Beschreibung + Demo + Release
- ☑ **P2:** Phase 2 Robustheit/Guardrails
- ☐ **P2:** Phase 4 Tests/Benchmarks/CI-Matrix
- ☐ **P3:** Branding/Pricing-Pflege

---

*Erstellt als Senior-Level-Audit & Production-Plan. Jede Phase ist eine eigenständige, gate-gesicherte Arbeitseinheit für Claude Code. Reihenfolge einhalten, Master-Protokoll (Abschnitt 2) bei jeder Session zuerst lesen.*
