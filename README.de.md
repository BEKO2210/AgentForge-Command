<div align="center">

# AgentForge Command

### Lokale Mission-Control für einen Schwarm aus Claude-Code-Agenten.

<p>
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-2ea043">
  <img alt="Stack: Node + Vanilla JS" src="https://img.shields.io/badge/stack-Node%20%2B%20Vanilla%20JS-3c873a">
  <img alt="Optional: Rust accelerator" src="https://img.shields.io/badge/optional-Rust%20accelerator-orange">
  <img alt="Built for Claude Code" src="https://img.shields.io/badge/built%20for-Claude%20Code-5b8cff">
</p>

<a href="README.md"><b>English</b></a> ·
<a href="#schnellstart"><b>Schnellstart</b></a> ·
<a href="#mission-control"><b>Mission Control</b></a> ·
<a href="#auto-enter"><b>Auto-Enter</b></a> ·
<a href="#architektur"><b>Architektur</b></a> ·
<a href="#optionaler-rust-beschleuniger"><b>Rust-Beschleuniger</b></a>

</div>

---

**AgentForge Command** ist ein lokales Cockpit, um mehrere Claude-Code-Sessions
in einem Fenster zu orchestrieren. Ein Lead-Agent — **Atlas Prime** — analysiert
das Repository und ruft einen Schwarm spezialisierter Agenten ins Leben, jeder
mit eigener Rolle, Super-Skill und animiertem Maskottchen. Der Operator kann
Briefings broadcasten, den Terminals beim Reagieren zusehen und einen
serverseitigen Auto-Enter-Watchdog scharf schalten, der Enter auf
Berechtigungs-Prompts drückt — damit nicht mehr alles bestätigt werden muss.

Lokal-first, dateibasiert koordiniert, abhängigkeitsarm. Der optionale
Rust-Beschleuniger (`forge-pulse`) schärft die Prompt-Erkennung, ist aber nie
zwingend.

> [!NOTE]
> Das 4-Agent-Coordination-Kit, mit dem dieses Projekt begann, läuft unverändert
> unter [`/console`](http://localhost:4173/console) und in
> [`.team/`](.team/) — das datei-basierte Protokoll, die Scripts, der MCP-Server
> und die Bash-Testsuite sind alle noch da. AgentForge Command setzt **auf**
> diesem Scaffold auf.

## Maskottchen

<p align="center">
  <img src="docs/mascots/_gallery.svg" alt="Galerie aller 12 Maskottchen" width="100%"/>
</p>

| Agent | Tier | Domäne |
|---|---|---|
| **ATLAS PRIME** | Cyber-Schildkröte | Chief Orchestrator |
| **SENTINEL**    | Wächter-Eule      | Risiko & Sicherheit |
| **AURORA**      | Neon-Fuchs        | Premium-UI / Motion |
| **FORGE**       | Schmiede-Maulwurf | Build & Release |
| **PRISM**       | Prisma-Chamäleon  | Visualisierung & Graphen |
| **ECHO**        | Signal-Fledermaus | Event-Stream & Replay |
| **VEGA**        | Neon-Kolibri      | Performance / Motion-Engine |
| **SCRIBE**      | Schreiber-Rabe    | Dokumentation |
| **LEDGER**      | Buchhalter-Waschbär | Kosten & Tokens |
| **RAVEN**       | Debug-Rabe        | Debug & Failure Analysis |
| **LUMA**        | Glühwürmchen      | Accessibility |
| **NOVA**        | Stern-Drache      | Produktstory / Positioning |

## Schnellstart

> [!IMPORTANT]
> Voraussetzungen: **Bash**, **Git**, die **[Claude Code](https://claude.com/claude-code) CLI**
> und **Node.js 18+**. Optional: **Rust / Cargo** für den `forge-pulse`-Beschleuniger.

```bash
git clone https://github.com/BEKO2210/AgentForge-Command
cd AgentForge-Command
cd gui && npm install && cd ..
node gui/server.js
# Öffne http://localhost:4173/   → Mission Control
```

Optional — Rust-Beschleuniger bauen (wird beim nächsten Start automatisch erkannt):

```bash
cd tools/forge-pulse
cargo build --release
```

Optional — echte LLM-Briefings:

```bash
ANTHROPIC_API_KEY=sk-ant-... node gui/server.js
# Atlas Prime briefed jetzt live über die Anthropic Messages API,
# inklusive Streaming + Kosten/Token-Anzeige.
```

## Mission Control

Die Standardoberfläche (`/`) ist **Mission Control**. Atlas Prime sitzt oben,
der Schwarm darunter.

Jeder Spezialist hat eine eigene Terminal-Karte mit:

- Einem animierten SVG-Maskottchen, das den aktuellen Zustand wiedergibt —
  volle 10er-Palette (`idle / listening / thinking / typing / working /
  reading / success / warning / error / celebrating`). Jedes Maskottchen
  hat dabei eigene Keyframes, sodass dasselbe `working` bei Sentinel
  (Security-Scan-Sweep), Forge (Amboss-Funken), Ledger (rotierende Münze)
  oder Nova (Feueratem) jeweils anders aussieht. Eine Side-by-side-Vorschau
  liegt unter
  [`/mascot-preview.html`](gui/public/mascot-preview.html).
- Channel-Callsign (`CH·01`), Rollen-Badge, Status-Pille mit pulsierendem Punkt.
- Live-Terminal-Zeilen mit blinkendem Cursor und einem unteren
  Activity-Glow-Streifen, solange der Agent arbeitet.
- Mini-Bars für Confidence / Risk / Evolution.
- Pro Karte: **⏎ auto** Toggle und **★ evolve** Button.

Die **Broadcast-Leiste** unten verteilt ein Briefing an den gesamten Schwarm.
Atlas appended in sein eigenes Terminal, jeder Spezialist durchläuft
`thinking → working → success → idle` und antwortet mit einer rollen-typischen
Log-Zeile. <kbd>/</kbd> fokussiert, <kbd>Enter</kbd> versendet,
<kbd>Esc</kbd> schließt jeden Drawer.

## Auto-Enter

> *„Sag dem System einmal: du darfst Enter drücken — und es macht es ab jetzt für dich."*

Ein Pro-PTY-Watchdog drückt Enter bei klaren Berechtigungs-Prompts, sodass der
Operator nicht ständig manuell bestätigen muss.

Serverseitig matched der Watchdog gegen eine konservative Whitelist:

```
(y/n)   [y/n]   (yes/no)   [yes/no]
press enter to continue   press any key
approve?   approve this?
do you want to ...   are you sure ...   continue?   confirm?
allow this to run   allow this tool to run
```

Wenn scharf, drückt der Server `\r` (Single-Fire, 1.5s Cooldown, damit kein
Loop entsteht) und broadcastet eine `auto-fired`-Notiz zurück ins Arena —
sichtbar in Atlas' Terminal.

Scharf schalten pro Agent mit dem **⏎ auto** Karten-Toggle oder via
**⏎ Auto · all** in der Toolbar. Die Auswahl wird persistiert — einmal scharf,
bleibt scharf bis zur Deaktivierung.

## Tool-Hooks

Statt den Agenten-Zustand aus dem PTY-Stdout zu raten, kann das Cockpit
auch direkt vom Claude-Code-Hook-System getrieben werden. Der Server hat
dafür genau einen Endpunkt:

```
POST /api/hooks            { "agent": "<id>", "event": "<hook>", "tool": "<name>" }
```

Dieselbe Payload wird als JSON-Body, `application/x-www-form-urlencoded`
oder GET-Query-String akzeptiert — je nachdem was im Hook-Script am
einfachsten ist. Event + Tool lösen einen der 11 Activity-States auf
(`reading`, `working`, `thinking`, `listening`, `success`, `warning`,
`idle`, …) und werden über denselben WebSocket ans Maskottchen propagiert,
den auch das Cockpit nutzt.

Jede gespawnte PTY sieht `AGENTFORGE_AGENT_ID` und `AGENTFORGE_HOOK_URL`
in ihrer Umgebung — die mitgelieferte
[`.claude/agentforge-hooks.example.json`](.claude/agentforge-hooks.example.json)
lässt sich somit 1:1 in eine Projekt-`settings.json` droppen.

## Persistenz

Arena-UI-State liegt unter `<repo>/.team/arena.json`:

```json
{
  "evolution":    { "sentinel": 3, "aurora": 2 },
  "autoEnter":    ["lead", "backend"],
  "customAgents": [ /* operator-definierte Spezialisten */ ],
  "atlasMission": ""
}
```

Die Datei ist gitignored — Runtime-State, keine Source-of-Truth. Reset aus der
UI ("↺ Reset") oder Datei löschen.

## Spawn-Builder

Atlas' Seed-Roster sind 12 Spezialisten. Für mehr: **+ New agent** klicken
(oder <kbd>Alt+N</kbd>):

- Name, Title, Role, Super-Skill
- Maskottchen (eine der 12 SVG-Vorlagen: turtle, owl, fox, mole, chameleon,
  bat, hummingbird, raven, raccoon, debug-raven, firefly, dragon)
- Accent-Farbe

Der neue Agent erscheint sofort im Grid, wird in `arena.json` persistiert und
überlebt Restarts. Die Maskottchen-Bibliothek liegt in
[`gui/public/arena/mascots.js`](gui/public/arena/mascots.js) — neue SVG-Vorlage
einfügen, fertig.

## Per-Specialist Real-Sessions

`gui/agents.json` hat zwei Roster:

- `agents` (4 Stück) — die ursprünglichen Lanes (Lead, Backend, Frontend,
  Quality), AUTOSTART, treiben die `/console`-Oberfläche.
- `specialists` (12 Stück) — jeweils mit eigenem rollen-spezifischem
  Briefing-Prompt für Claude. **Kein AUTOSTART** — werden bewusst on-demand
  über das Arena-WS gestartet (`{t:"start-pty", id, goal}`), damit nicht
  versehentlich 12 echte Claude-Sessions parallel starten.

Server-seitig wird beim Start das Briefing (mit `{{GOAL}}` ersetzt) per
bracketed-paste gefolgt von Enter eingespielt — die Session bootet direkt in
ihre Rolle.

## Echte LLM-Briefings (optional)

Wenn `ANTHROPIC_API_KEY` auf dem Server gesetzt ist, routet die Broadcast-Leiste
ein Briefing **live durch Claude**. Atlas antwortet in Echtzeit (Streaming
via SSE) und kann in derselben Antwort Pro-Spezialist-Briefings ableiten.
Verbrauchte Tokens + Kosten werden in Atlas' Terminal angezeigt.

Konfiguration:

| Variable | Bedeutung | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Aktiviert die Live-LLM-Bridge | *(nicht gesetzt → Mock)* |
| `AGENTFORGE_LLM_MODEL` | Modell-ID | `claude-sonnet-4-6` |

Implementierung in [`gui/llm.js`](gui/llm.js) — keine npm-Dependency,
nutzt nur `fetch`.

## Architektur

```
gui/server.js                          Node HTTP + WebSocket
  ├── http   /             → Mission Control (default)
  ├── http   /console      → Legacy 4-Agent Console
  ├── http   /api/agents   → PTY-Konfig (+ specialists)
  ├── http   /api/state    → Folded .team State
  ├── http   /api/arena    → Arena Server State + LLM-Status
  ├── ws     /             → PTY-Bridge
  └── ws     /arena        → Arena-Protokoll
                              (auto-enter, persistence, live PTY,
                               atlas-brief stream, specialist start)

gui/public/arena/
  ├── arena.html      ← Mission Control Shell
  ├── styles.css      ← Cockpit-Theme + Maskottchen-Animationen
  ├── data.js         ← Registry + Briefings + Spawn-Rules
  ├── mascots.js      ← 12 SVG-Vorlagen, 5 Evolution-Stufen
  ├── state.js        ← Reactive Store
  ├── spawner.js      ← Atlas' regelbasierte Spawn-Engine
  ├── broadcast.js    ← Broadcast-Simulator (Mock-Fallback)
  ├── ui.js           ← Renderer (Hero, Lead, Grid, Drawer, Modal, Timeline)
  └── main.js         ← Entry-Point; bindet Store, Engine, UI, WS

gui/llm.js            ← Optionale Anthropic-API-Bridge (Streaming)
tools/forge-pulse/    ← OPTIONALER Rust-Beschleuniger
docs/mascots/         ← Standalone Maskottchen-SVGs für Doku
scripts/render-mascots.mjs ← Renderer (führt das oben aus)
.team/                ← Datei-basiertes Coordination-Scaffold (unverändert)
```

## Optionaler Rust-Beschleuniger

Der Großteil der Runtime ist I/O-bound; Node schafft das ohne Probleme. Die
**eine Stelle**, an der eine engere Implementation lohnt, ist die Heißschleife,
die jedes PTY-Byte auf Berechtigungs-Prompts und Aktivitätsänderungen abklopft.
Mit wachsendem Schwarm soll diese Schleife sub-millisekundig bleiben und
crash-isoliert sein.

`tools/forge-pulse/` ist ein einzeiliges, dependency-freies Rust-Binary genau
dafür. Der Node-Server pipt PTY-Bytes in seinen Stdin und leitet sein Stdout
als `{t:"pulse", kind:"prompt"|"activity", …}` an das Arena-WS weiter. Es ist
**rein advisory** — Node's JS-Matcher bleibt führend für Auto-Enter, sodass
das Entfernen oder Skippen des Binaries funktional nichts ändert.

```bash
cd tools/forge-pulse
cargo build --release          # erzeugt target/release/forge-pulse
cargo test  --release          # 5 Unit-Tests
cargo clippy --release -- -D warnings   # lint clean
```

Wird vom Server beim nächsten Start automatisch gefunden. `FORGE_PULSE=0`
deaktiviert auch bei vorhandenem Binary.

## Qualität & Sicherheit

- **Tests** — `bash tests/run.sh` führt **147** Checks aus (87 Bash gegen
  die Coordination-Scripts + 40 Arena-Unit-Tests für die Cockpit-Module +
  20 Server-Integration-Tests, die den echten `gui/server.js` über HTTP +
  WebSocket booten). `cargo test --release` in `tools/forge-pulse` ergänzt
  5 Rust-Unit-Tests.
- **Lint** — `bash scripts/team-check.sh` (`bash -n` + `shellcheck` + Tests)
  und `cargo clippy --release -- -D warnings` sind beide clean.
- **Privacy** — alles lokal. Server bindet `127.0.0.1`. Arena-State in
  `.team/arena.json` (gitignored). Keine externen Tracker, keine Telemetry.
  LLM-Calls verlassen die Maschine **nur**, wenn du `ANTHROPIC_API_KEY` setzt.
- **Accessibility** — Focus-Rings auf jedem interaktiven Element, Keyboard-
  Shortcuts für Broadcast (`/`), Drawer (`Esc`), Spawn-Builder (`Alt+N`).
  Alle Animationen respektieren `prefers-reduced-motion: reduce`.

## Legacy 4-Agent-Console

Das ursprüngliche Coordination-Kit ist unverändert unter
[`/console`](http://localhost:4173/console) verfügbar. Board, Role-Lanes, Locks,
Green Gate, MCP-Server und `team-*.sh`-Scripts in [`.team/`](.team/) und
[`scripts/`](scripts/) funktionieren wie vorher — sie sind das Substrat, auf
dem Mission Control aufsetzt.

Eigene Doku der Console: [`gui/README.md`](gui/README.md).
Datei-Coordination-Regeln: [`.team/PROTOCOL.md`](.team/PROTOCOL.md).

## Lizenz

[MIT](LICENSE) — Copyright © 2026 Belkis Aslani (BEKO2210). Frei nutzbar, auch
kommerziell. Kommerzieller Support, Custom-Integrationen und Dual-Licensing für
embedded Use Cases — siehe [`COMMERCIAL.md`](COMMERCIAL.md).
