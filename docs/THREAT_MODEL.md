# Threat Model — AgentForge Command

> **Status:** Phase 0 (Triage & Baseline). This document records the trust
> boundaries, assets, attackers and the STRIDE analysis **as the code stands
> today** (`main`, pre-hardening). It deliberately documents the open findings
> #1–#3 so Phase 1 can prove the fix against a written "before" picture.
>
> **Scope:** the local cockpit (`gui/server.js`), the arena WebSocket protocol
> (`/arena`), the HTTP surface, the optional LLM bridge (`gui/llm.js`), the
> read-only MCP server (`mcp/server.js`) and the spawned `claude` PTYs.
>
> **This is not a claim that the product is currently safe to expose.** Findings
> #1–#3 below are open. They are scheduled for Phase 1 (Security Hardening),
> which is a hard prerequisite for any public launch (Phase 6).

---

## 1. System overview & trust boundaries

AgentForge Command is a **local-first** mission-control cockpit. A single Node
process (`gui/server.js`) binds to `127.0.0.1:4173`, serves a static browser UI
(`gui/public/arena.html` + `arena/*.js`), exposes a small HTTP API, and upgrades
two WebSocket channels (`/arena`, legacy `/ws`). Through the arena WS the
browser can spawn and drive real `claude` Code sessions in **PTYs** (pseudo-
terminals) whose `cwd` is the operator's repository (`REPO_DIR`).

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Operator's machine (single OS user)                                       │
│                                                                            │
│  ┌────────────┐   TB1   ┌─────────────────────┐  TB2  ┌────────────────┐  │
│  │  Browser   │ ──────▶ │  gui/server.js      │ ────▶ │  claude PTYs   │  │
│  │  (arena UI)│ ◀────── │  127.0.0.1:4173     │ ◀──── │  (node-pty)    │  │
│  │  any tab   │  HTTP   │  - HTTP API         │ stdio │  cwd=REPO_DIR  │  │
│  │  same      │  + WS   │  - /arena WS        │       │  shell + files │  │
│  │  browser!  │         │  - /ws  WS (legacy) │       └───────┬────────┘  │
│  └────────────┘         │  - LLM bridge       │               │           │
│                         │  - spend ledger     │               │           │
│                         └──────────┬──────────┘               │           │
│                                    │ TB3 (HTTPS, key)          │ TB2       │
└────────────────────────────────────┼───────────────────────────┼──────────┘
                                     ▼                            ▼
                          ┌────────────────────┐      files / git in REPO_DIR
                          │ api.anthropic.com  │      (real edits, real cmds)
                          └────────────────────┘
```

### Trust boundaries

| ID | Boundary | What crosses it | Current enforcement |
|----|----------|-----------------|---------------------|
| **TB1** | **Browser ↔ Server** | HTTP requests, WS upgrade + arena messages (`start-pty`, `input`, `press`, `auto-config`, `persist`, `atlas-brief`), hook events (`/api/hooks`) | `127.0.0.1` bind only. **No `Origin` check, no `Host` check, no auth token, no CSRF token, no CSP** (Findings #1–#3). Body cap 64 KB on `/api/hooks`; static-file `startsWith(PUBLIC)` guard. |
| **TB2** | **Server ↔ PTY (`claude`)** | Bytes written to the PTY (operator keystrokes, dispatched briefings, auto-`\r`), bytes read back | `cmd` is **operator-authored** in `agents.json` (not client-supplied). `input`/`press` write raw bytes into a live PTY. Auto-enter writes `\r` to approve prompts for armed agents only. PTY runs as the operator's OS user with full repo access. |
| **TB3** | **Server ↔ Anthropic API** | `ANTHROPIC_API_KEY`, prompts, completions, token usage | Key is **server-side only**, read from env, never sent to the browser (`/api/arena` exposes only `llm.enabled`/`model`). TLS to `api.anthropic.com`. Calls happen **only** when a key is set. |
| **TB4** | **OS user ↔ repo / `.team`** | `.team/arena.json`, locks, `agents.json` | Out of scope per `SECURITY.md`: a malicious local user already inside the repo is a different trust class. Noted here for completeness. |

**Key insight (why `127.0.0.1` is not enough):** TB1 is crossed by *the browser*,
not by *the network*. Any web page the operator visits in the **same browser**
can issue cross-origin requests to `http://localhost:4173` / `ws://localhost:4173`.
The loopback bind stops a *remote* host on the LAN, but it does **not** stop a
malicious origin running in the operator's own browser. That is the root of
Finding #1.

---

## 2. Assets (what an attacker wants)

| Asset | Value to attacker | Where it lives |
|-------|-------------------|----------------|
| **Live `claude` PTY (write access)** | **RCE-equivalent.** Writing `input` into a PTY = typing into a shell/agent that can edit files and run commands in `REPO_DIR`. Arming `auto-config` = prompts get auto-approved. **This is the crown jewel.** | TB2, reachable via TB1 |
| Ability to **spawn** PTYs (`start-pty`) | Start arbitrary configured specialists, including with an attacker-supplied `goal` that gets pasted into the agent | arena WS |
| `ANTHROPIC_API_KEY` | Direct billing/abuse; impersonation | Server env (TB3) |
| Spend ledger / cost data | Financial reconnaissance | `/api/arena`, WS `hello` |
| Repo contents under `REPO_DIR` | Source code, secrets, git history | TB2 |
| Cockpit state (`arena.json`, mascot/timeline) | Low — UI state; spoofing only | `/api/hooks`, `persist` |

---

## 3. Attackers (threat actors)

| # | Actor | Capability | In scope? |
|---|-------|-----------|:---------:|
| A1 | **Malicious website in the same browser** | Operator visits `evil.com` in another tab while the cockpit runs. The page runs JS: `new WebSocket("ws://localhost:4173/arena")`, `fetch("http://localhost:4173/api/hooks?…")`, `<img src=…>`. **Cannot read** cross-origin responses, but **can send** state-changing messages (CSWSH / CSRF). | ✅ **Primary** |
| A2 | **DNS-rebinding attacker** | Lures operator to a domain that re-resolves to `127.0.0.1`, turning a remote page into a same-"site" request against the loopback server. Defeated by a `Host`-header allowlist (not yet present). | ✅ |
| A3 | **Other local OS user** | A second account on the same machine connecting to `127.0.0.1:4173`. Loopback is shared across local users. | ◑ Partial (token in Phase 1.2 mitigates) |
| A4 | **MITM on the Anthropic API path** | Network attacker between server and `api.anthropic.com`. Mitigated by TLS; key never leaves the server in plaintext. | ◑ (rely on TLS) |
| A5 | Malicious **`agents.json`** author | Whoever writes `agents.json` controls `cmd`. This is an **operator-authored trust input**, not a remote vector — documented as a boundary, not a bug. | Boundary (doc only) |

---

## 4. STRIDE analysis

Legend — **Status:** 🔴 open (this audit) · 🟠 partial · 🟢 mitigated · ⚪ accepted/out-of-scope.

| STRIDE | Threat (concrete) | Vector | Current control | Status | Planned (phase) |
|--------|-------------------|--------|-----------------|:------:|-----------------|
| **S**poofing | Foreign origin pretends to be the legitimate UI over the arena WS | A1 / TB1 | None — upgrade accepts any `Origin` | 🔴 **#1** | Origin+Host allowlist, per-session token (1.1/1.2) |
| **S**poofing | DNS-rebinding presents loopback as attacker's site | A2 | None — no `Host` check | 🔴 **#1** | `Host` allowlist on HTTP + upgrade (1.1) |
| **T**ampering | Foreign page mutates cockpit/mascot state via `GET /api/hooks` (`<img src>`) or `persist` | A1 | None on GET; `persist` whitelists fields only | 🔴 **#2** | Token + Origin/Host on state routes; GET no longer mutates (1.3) |
| **T**ampering | Foreign page writes keystrokes into a live PTY (`input`/`press`) | A1 / TB2 | None — any arena WS client can write | 🔴 **#1** | Token-gated WS (1.2); message hardening (1.5) |
| **R**epudiation | No audit trail of who armed auto-enter / dispatched | A1/A3 | `console.log` of auto-enter arming only | 🟠 | Structured logging (Phase 2) |
| **I**nfo disclosure | Browser reads role prompts / API key | A1 | Prompts stripped from HTTP (`/api/agents`); key server-only | 🟢 | — |
| **I**nfo disclosure | Path traversal reads files outside `PUBLIC` | A1 | `path.join` + `startsWith(PUBLIC)`; **no `decodeURIComponent`/`normalize`** first → `%2e%2e` variants untested | 🟠 | Decode→normalize→re-check + regression test (1.6) |
| **D**enial of service | Message/connection flooding over arena WS; many PTYs | A1/A3 | 64 KB cap on `/api/hooks` only; no WS rate-limit, no PTY cap | 🟠 | WS size cap + token-bucket (1.5); PTY cap (Phase 2) |
| **E**levation of privilege | Foreign origin → spawn PTY (`start-pty`) → paste goal → **auto-`\r`** approves prompts → arbitrary command execution in `REPO_DIR` | A1 chain | None — the full chain is reachable unauthenticated | 🔴 **#1 (Drive-by RCE)** | Token+Origin gate the whole arena WS (1.1/1.2) |
| **E**levation of privilege | Missing security headers enable clickjacking / sniffing / injection assist | A1 | No `CSP`, `X-Frame-Options`, `nosniff`, `Referrer-Policy` | 🔴 **#3** | Security headers + CSP (1.4) |

---

## 5. The three open findings (documented in detail)

### 🔴 Finding #1 — No `Origin`/`Host` check on the WS upgrade → Cross-Site WebSocket Hijacking (CSWSH), leading to drive-by RCE

**Where:** `gui/server.js`, `server.on("upgrade", …)` (≈ line 665) and
`arenaWss.on("connection", …)` (≈ line 699).

**What happens today:** the upgrade handler routes purely on the URL path and
calls `handleUpgrade` unconditionally. It never inspects `req.headers.origin`
or `req.headers.host`:

```js
server.on("upgrade", (req, sock, head) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/arena") {
    arenaWss.handleUpgrade(req, sock, head, (ws) => arenaWss.emit("connection", ws, req));
  } else {
    wss.handleUpgrade(req, sock, head, (ws) => wss.emit("connection", ws, req));
  }
});
```

**Why it matters:** WebSocket connections are **not** subject to the Same-Origin
Policy the way `fetch` reads are. Any page in the operator's browser can open
`new WebSocket("ws://localhost:4173/arena")` and, once connected, send the same
JSON messages the real UI sends. The arena message handler honours, with no
authentication:

- `start-pty` → spawns a configured specialist's `claude` PTY, optionally with
  an attacker-chosen `goal` that is bracket-pasted into the agent.
- `input` / `press` → writes arbitrary bytes / `\r` into any live PTY.
- `auto-config` → arms **auto-enter**, which auto-approves permission prompts.

Chained (arm auto-enter → start PTY → feed input → prompts auto-approved), a
single malicious web page the operator merely *visits* can drive a real coding
agent with shell access in the operator's repo. **`127.0.0.1` binding does not
help** (attacker A1 is *inside* the browser; DNS-rebinding A2 covers the rest).

**Proof-of-concept (to be captured before/after in Phase 1):** from any other
origin (e.g. a tab on `https://example.com`):

```js
const ws = new WebSocket("ws://localhost:4173/arena");
ws.onopen = () => {
  ws.send(JSON.stringify({ t: "auto-config", autoEnterAll: true }));
  ws.send(JSON.stringify({ t: "start-pty", id: "forge", goal: "…attacker goal…" }));
  ws.send(JSON.stringify({ t: "input", id: "forge", d: "…\r" }));
};
```

**Severity:** 🔴 P0 / Launch-Blocker.
**Fix (Phase 1.1/1.2):** `isTrustedOrigin(req)` allowlist (`http://localhost:PORT`,
`http://127.0.0.1:PORT`, plus opt-in `AGENTFORGE_ALLOWED_ORIGINS`), `Host`-header
allowlist on HTTP **and** upgrade, and a per-session capability token required on
the WS upgrade (`?token=`). A failing regression test (`tests/security-suite.mjs`)
proves the rejection first.

---

### 🟠 Finding #2 — No CSRF protection on `/api/hooks` (GET mutates state)

**Where:** `gui/server.js`, `if (url === "/api/hooks")` (≈ line 607) →
`consumeHookEvent()` (≈ line 217) → `arenaBroadcastSafe()`.

**What happens today:** `GET /api/hooks?agent=…&event=…&tool=…` is accepted as a
"curl convenience" path. It calls `consumeHookEvent`, which **broadcasts a
`hook` frame to every arena client** (changing mascot/timeline state). A GET with
side effects is reachable by any page via `<img src="http://localhost:4173/api/hooks?agent=forge&event=PostToolUse&tool=Edit">`
— a classic CSRF. There is no token and no `Origin`/`Host` check; only a 64 KB
body cap (POST) and a `Content-Type`-lenient parser.

**Impact:** an attacker can **spoof agent activity** (fake "Forge edited a file")
in the operator's cockpit. Low direct severity (no RCE, no data read — responses
are cross-origin-opaque), but it is a real trust-boundary break and a misleading-
state vector.

**Severity:** 🟠 P1.
**Fix (Phase 1.3):** GET must not mutate state (probe-echo only, or `405`
without token); POST requires token + Origin/Host check + `Content-Type`
allowlist; keep the 64 KB cap.

---

### 🟠 Finding #3 — No security headers / CSP on served HTML

**Where:** `gui/server.js`, static-file response (≈ line 652). Only
`Content-Type` and `Cache-Control` are set:

```js
res.writeHead(200, {
  "Content-Type": TYPES[path.extname(file)] || "text/plain",
  "Cache-Control": "no-cache, no-store, must-revalidate",
});
```

**What's missing:** `Content-Security-Policy`, `X-Frame-Options: DENY`
(clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
Without a CSP, an injection bug anywhere in the served JS has no second line of
defence, and the cockpit can be framed by a hostile page.

**Severity:** 🟠 P1.
**Fix (Phase 1.4):** set the headers above and a restrictive CSP
(`default-src 'self'; connect-src 'self' ws://localhost:* ws://127.0.0.1:*;
img-src 'self' data:; style-src 'self' 'unsafe-inline'`). The CSP must be
validated against the actual inline styles in `arena.html`; prefer a nonce over
`unsafe-inline` where feasible.

---

## 6. Non-goals (intentional reductions — see ROADMAP §11)

These are deliberate scope decisions, not gaps:

- **No federation / multi-machine** in v1 (Ruflo's terrain; possible plugin later).
- **No persistent "learning-loop" memory** in v1 (complexity/maintenance trap).
- **No multi-provider abstraction** (Gemini/Codex) — AgentForge is deliberately
  Claude-Code-native.
- **No account/cloud backend** — local-first is the promise.
- **A malicious local OS user already inside the repo** (TB4) is treated as a
  different trust class (per `SECURITY.md`), not a product vulnerability.

When Phase 3 adds opt-in MCP **action-tools** (`dispatch_goal`,
`launch_specialist`), this document must be extended: those tools are only safe
behind the same per-session token, and read-only must remain the default.

---

## 7. Phase 0 status of this model

- Trust boundaries TB1–TB4 enumerated. ✅
- Assets, attackers (A1–A5), full STRIDE table recorded. ✅
- Findings #1–#3 documented with file/line references and a reproducible PoC
  sketch for #1, to be turned into a measured before/after in Phase 1. ✅
- **No production code changed in Phase 0.** The fixes referenced above are
  scheduled, not applied.
