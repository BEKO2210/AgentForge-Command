// AgentForge Command — local mission control for a swarm of Claude Code agents.
//
// One Node server fronts three surfaces:
//   - /            → Agent Arena (mission control, default)
//   - /console     → legacy 4-agent terminal console (the original TEAM // CONSOLE)
//   - /api/*       → small REST surface (agents config, team state, arena state)
//   - WS /         → PTY bridge for both surfaces (real terminals to the browser)
//   - WS /arena    → arena protocol (auto-enter toggles, persistence, spawn-builder)
//
// Auto-enter: per-PTY watchdog that presses Enter on clear permission prompts
//   ("(y/n)", "press enter", "approve?", …) once the operator has armed it.
//   Off by default. Patterns are conservative. 1.5s cooldown to avoid loops.
//
// Persistence: arena UI state lives in <repo>/.team/arena.json so evolution
//   levels and auto-enter selections survive restarts.
//
// Optional Rust accelerator: if a forge-pulse binary is found on $PATH or in
//   ./tools/forge-pulse/target/release/, the server pipes PTY bytes through
//   it for sharper auto-enter detection. Falls back to the native JS matcher
//   when the binary is absent — no extra dependency.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn as spawnProc } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildState } from "../lib/state.mjs";
import { atlasBrief, specialistBrief, llmConfig } from "./llm.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

let pty;
try {
  const m = await import("node-pty");
  pty = m.default || m;
} catch {
  console.error("\n[forge] node-pty is not installed.\n  cd gui && npm install\n");
  process.exit(1);
}

let WebSocketServer;
try {
  ({ WebSocketServer } = await import("ws"));
} catch {
  console.error("\n[forge] ws is not installed.\n  cd gui && npm install\n");
  process.exit(1);
}

const REPO_DIR = process.env.REPO_DIR || process.cwd();
const PORT = Number(process.env.PORT) || 4173;
// AUTOSTART now takes three values:
//   "off" (default) — no specialist auto-runs; the operator launches from the UI
//   "lead"          — auto-spawn only Atlas
//   "all"           — auto-spawn every specialist (12 concurrent Claude sessions!)
// Old boolean values are translated: "0" → "off", "1" / unset → "off" too,
// since the new default is dormant. Set it explicitly if you want auto-spawn.
const _autoRaw = (process.env.AUTOSTART || "").toLowerCase();
const AUTOSTART = _autoRaw === "all" ? "all" : _autoRaw === "lead" ? "lead" : "off";
const ARENA_FILE = path.join(REPO_DIR, ".team", "arena.json");

const config = JSON.parse(fs.readFileSync(path.join(HERE, "agents.json"), "utf8"));
// One swarm, one list. ATLAS PRIME is the lead; everyone else reports to
// Atlas. `specialists` from older configs is honoured as a fallback.
const swarm = Array.isArray(config.agents) && config.agents.length
  ? config.agents
  : (Array.isArray(config.specialists) ? config.specialists : []);
const LEAD = swarm.find((a) => a.lead) || swarm.find((a) => a.id === "atlas") || swarm[0];
const ptyIndex = new Map(swarm.map((d) => [d.id, d]));
if (process.env.TEST_CMD) {
  for (const a of swarm) { a.cmd = process.env.TEST_CMD; a.args = []; }
}

const agents = new Map(); // id -> { def, term, buf, alive, tail }
const clients = new Set();
const arenaClients = new Set();

/* ----- Spend / budget tracking -----
 * Every Atlas brief stream returns usage + cost. We aggregate them into a
 * per-session ledger and broadcast updates so the arena's Ledger card can
 * show live spend without polling. AGENTFORGE_BUDGET_USD enforces a soft cap:
 * once exceeded, new briefs are refused with a clear error. 0 = unlimited. */
const BUDGET_USD = Number(process.env.AGENTFORGE_BUDGET_USD || 0);
const spend = {
  totalIn: 0, totalOut: 0, totalUsd: 0, briefs: [],
  startedAt: Date.now(), budgetUsd: BUDGET_USD,
};
function recordSpend(entry) {
  spend.totalIn  += entry.usage?.input_tokens  || 0;
  spend.totalOut += entry.usage?.output_tokens || 0;
  spend.totalUsd += entry.cost || 0;
  spend.briefs.push({
    ts: Date.now(),
    model: entry.model,
    input: entry.usage?.input_tokens  || 0,
    output: entry.usage?.output_tokens || 0,
    cost: entry.cost || 0,
    goal: (entry.goal || "").slice(0, 120),
  });
  if (spend.briefs.length > 100) spend.briefs.splice(0, spend.briefs.length - 100);
  arenaBroadcastSafe({ t: "spend-update", spend: spendSnapshot() });
}
function spendSnapshot() {
  return {
    totalIn: spend.totalIn,
    totalOut: spend.totalOut,
    totalUsd: spend.totalUsd,
    briefCount: spend.briefs.length,
    recent: spend.briefs.slice(-10),
    budgetUsd: spend.budgetUsd,
    remainingUsd: spend.budgetUsd > 0 ? Math.max(0, spend.budgetUsd - spend.totalUsd) : null,
    overBudget: spend.budgetUsd > 0 && spend.totalUsd >= spend.budgetUsd,
    startedAt: spend.startedAt,
    forecast: spendForecast(),
  };
}

/** Burn-rate + projected spend based on the briefs observed so far.
 *
 *   - `avgCost`     — mean USD per brief (last 10)
 *   - `windowSec`   — width of the observation window used
 *   - `burnPerMin`  — derived as totalCostInWindow / windowMinutes
 *   - `nextHourUsd` — burnPerMin * 60 (only if we have at least 2 briefs)
 *   - `timeToBudgetSec` — if a budget is set, seconds until it's exhausted
 *   - `trend`       — "rising" | "falling" | "steady" by comparing the most
 *                     recent half of the window to the older half.
 *
 *   Returns nulls for fields we don't have enough data for, so the UI can
 *   stay honest (no fake forecast from a single sample). */
function spendForecast() {
  const last = spend.briefs.slice(-10);
  if (last.length === 0) {
    return { avgCost: null, windowSec: 0, burnPerMin: 0, nextHourUsd: 0,
             timeToBudgetSec: null, trend: "steady", samples: 0 };
  }
  const avgCost = last.reduce((s, b) => s + b.cost, 0) / last.length;
  const samples = last.length;
  if (samples < 2) {
    return { avgCost, windowSec: 0, burnPerMin: 0, nextHourUsd: 0,
             timeToBudgetSec: null, trend: "steady", samples };
  }
  const windowSec = Math.max(1, Math.round((last[last.length - 1].ts - last[0].ts) / 1000));
  const windowMin = windowSec / 60;
  const cumulative = last.reduce((s, b) => s + b.cost, 0);
  const burnPerMin = windowMin > 0 ? cumulative / windowMin : 0;
  const nextHourUsd = burnPerMin * 60;
  const remaining = spend.budgetUsd > 0 ? Math.max(0, spend.budgetUsd - spend.totalUsd) : null;
  const timeToBudgetSec = (remaining !== null && burnPerMin > 0)
    ? Math.round((remaining / burnPerMin) * 60) : null;
  // Trend: compare the second half of the window to the first half.
  const mid = Math.floor(samples / 2);
  const oldHalf = last.slice(0, mid).reduce((s, b) => s + b.cost, 0) / Math.max(1, mid);
  const newHalf = last.slice(mid).reduce((s, b) => s + b.cost, 0) / Math.max(1, samples - mid);
  let trend = "steady";
  if (newHalf > oldHalf * 1.2) trend = "rising";
  else if (newHalf < oldHalf * 0.8) trend = "falling";
  return { avgCost, windowSec, burnPerMin, nextHourUsd, timeToBudgetSec, trend, samples };
}
function arenaBroadcastSafe(msg) {
  const s = JSON.stringify(msg);
  for (const c of arenaClients) if (c.readyState === 1) { try { c.send(s); } catch {} }
}

/* ----- Claude Code tool-hook receiver -----
 *
 * Claude Code can run shell commands as hooks at PreToolUse / PostToolUse /
 * Notification / Stop. When configured to POST here, those events become the
 * AUTHORITATIVE source for specialist state — the cockpit doesn't have to
 * guess from raw stdout bytes any more.
 *
 *   PreToolUse  Read|Grep|Glob|WebFetch|WebSearch   → state = "reading"
 *   PreToolUse  Edit|Write|MultiEdit                → state = "working"
 *   PreToolUse  Bash|BashOutput                     → state = "working"
 *   PreToolUse  Task                                → state = "thinking"
 *   PostToolUse  (any, success)                     → state = "success" → idle
 *   PostToolUse  (any, error)                       → state = "warning"
 *   Notification                                    → state = "listening"
 *   Stop                                            → state = "idle"
 *
 * Hooks identify which specialist they belong to via the AGENTFORGE_AGENT_ID
 * env var the server injects when it spawns each PTY. */
const HOOK_STATE_MAP = {
  // Read-style tools
  "PreToolUse:Read":      "reading",
  "PreToolUse:Grep":      "reading",
  "PreToolUse:Glob":      "reading",
  "PreToolUse:WebFetch":  "reading",
  "PreToolUse:WebSearch": "reading",
  // Write-style tools
  "PreToolUse:Write":     "working",
  "PreToolUse:Edit":      "working",
  "PreToolUse:MultiEdit": "working",
  "PreToolUse:NotebookEdit": "working",
  // Run-style
  "PreToolUse:Bash":      "working",
  "PreToolUse:BashOutput":"working",
  // Plan-style
  "PreToolUse:Task":      "thinking",
  // Lifecycle
  "Notification":         "listening",
  "Stop":                 "idle",
  "SessionStart":         "listening",
  "UserPromptSubmit":     "listening",
};

function resolveHookState(event, tool, ok) {
  // Post-tool events override map: success → success ping, failure → warning.
  if (event === "PostToolUse") return ok === false ? "warning" : "success";
  const key = tool ? `${event}:${tool}` : event;
  return HOOK_STATE_MAP[key] || HOOK_STATE_MAP[event] || null;
}

function consumeHookEvent(body) {
  // Body shape we accept (lenient):
  //   { agent, event, tool, ok, summary, file, session_id }
  // `agent` falls back to AGENTFORGE_AGENT_ID env-style query string for
  // shells that can't easily build JSON. Returns { ok, agentId, state }.
  const agent = String(body.agent || body.id || "").toLowerCase().trim();
  const event = String(body.event || body.hook || "").trim();
  const tool = body.tool ? String(body.tool).trim() : "";
  const ok = body.ok === undefined ? true : (body.ok === false || body.ok === "false") ? false : true;
  if (!agent || !event) return { ok: false, reason: "missing agent or event" };
  const state = resolveHookState(event, tool, ok);
  const payload = {
    t: "hook", id: agent, event, tool: tool || null, state, ok,
    summary: body.summary || body.tool_response_summary || null,
    file: body.file || body.path || null,
    ts: Date.now(),
  };
  arenaBroadcastSafe(payload);
  return { ok: true, agentId: agent, state, event, tool };
}

/* ----- Atlas brief parser -----
 * Atlas's system prompt asks for a paragraph plus a `BRIEFINGS:` block of
 * `- <id>: <task>` lines. We pull those out so the server can autodispatch
 * each specialist's PTY with the matching sub-briefing.  */
function parseAtlasBrief(text) {
  if (!text) return { plan: "", briefings: [] };
  const lines = text.split(/\r?\n/);
  let i = lines.findIndex((l) => /^\s*briefings\s*:?/i.test(l));
  const plan = i > 0 ? lines.slice(0, i).join("\n").trim() : text.trim();
  const briefings = [];
  if (i >= 0) {
    for (const raw of lines.slice(i + 1)) {
      // Accept "- id: task" / "* id: task" / "id: task" / "@id task"
      const m = raw.match(/^[\s*\-•]*@?([a-z][a-z0-9_-]*)\s*[:\-—]\s*(.+?)\s*$/i);
      if (m && m[2].length > 0) briefings.push({ id: m[1].toLowerCase(), task: m[2] });
    }
  }
  return { plan, briefings };
}

/* ----- Arena persistence ----- */

function loadArenaState() {
  try {
    const raw = fs.readFileSync(ARENA_FILE, "utf8");
    const j = JSON.parse(raw);
    return {
      evolution:  j.evolution  && typeof j.evolution  === "object" ? j.evolution  : {},
      autoEnter:  Array.isArray(j.autoEnter) ? j.autoEnter : [],
      customAgents: Array.isArray(j.customAgents) ? j.customAgents : [],
      atlasMission: typeof j.atlasMission === "string" ? j.atlasMission : "",
      version: 1,
    };
  } catch {
    return { evolution: {}, autoEnter: [], customAgents: [], atlasMission: "", version: 1 };
  }
}
function saveArenaState(next) {
  try {
    fs.mkdirSync(path.dirname(ARENA_FILE), { recursive: true });
    fs.writeFileSync(ARENA_FILE, JSON.stringify(next, null, 2));
  } catch (e) {
    console.error(`[forge] failed to save arena state: ${e.message}`);
  }
}
let arenaState = loadArenaState();

/* ----- Auto-enter watchdog ----- */

const autoEnter = new Set(arenaState.autoEnter || []);
const AUTO_PROMPT_RE = /\(y\/n\)|\[y\/n\]|\(yes\/no\)|\[yes\/no\]|press +enter +to +continue|press +any +key|approve\??|do +you +want +to|are +you +sure|continue\?|confirm\?|allow +this(?: +tool)? +to +run/i;
const AUTO_COOLDOWN_MS = 1500;
const autoLastFire = new Map();

function fireAutoEnter(id, reasonLine) {
  const last = autoLastFire.get(id) || 0;
  if (Date.now() - last < AUTO_COOLDOWN_MS) return;
  const rec = agents.get(id); if (!rec || !rec.alive) return;
  autoLastFire.set(id, Date.now());
  try { rec.term.write("\r"); } catch {}
  const note = { t: "auto-fired", id, target: id, reason: reasonLine.slice(0, 80), ts: Date.now() };
  for (const c of arenaClients) if (c.readyState === 1) {
    try { c.send(JSON.stringify(note)); } catch {}
  }
  console.log(`[forge] auto-enter → ${id} (reason: ${reasonLine.trim().slice(0, 60)})`);
}

/* ----- Optional Rust accelerator: forge-pulse -----
 * Spawned once if the binary exists. We feed it the same bytes that flow to
 * the browser; it writes JSON lines like {"t":"prompt","id":"lead","reason":"(y/n)"}
 * back to us. Auto-enter still uses the JS path; the Rust output is *advisory*
 * (logged + forwarded to arena clients) until we trust it. */

let pulse = null;
function findForgePulse() {
  const candidates = [
    path.join(REPO_DIR, "tools", "forge-pulse", "target", "release", "forge-pulse"),
    path.join(REPO_DIR, "tools", "forge-pulse", "target", "debug", "forge-pulse"),
  ];
  for (const p of candidates) {
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
  }
  return null;
}
function startForgePulse() {
  if (process.env.FORGE_PULSE === "0") return;
  const bin = findForgePulse();
  if (!bin) return;
  try {
    pulse = spawnProc(bin, [], { stdio: ["pipe", "pipe", "pipe"] });
    pulse.on("error", () => { pulse = null; });
    pulse.on("exit", () => { pulse = null; });
    pulse.stderr.setEncoding("utf8");
    pulse.stderr.on("data", (d) => process.stderr.write(`[forge-pulse] ${d}`));
    pulse.stdout.setEncoding("utf8");
    let buf = "";
    pulse.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        try {
          const m = JSON.parse(line);
          // Wrap and force the outer envelope tag so the inner `t` doesn't
          // override us via object-spread.
          const wrapped = { ...m, t: "pulse", kind: m.t || m.kind, source: "rust" };
          for (const c of arenaClients) if (c.readyState === 1) {
            try { c.send(JSON.stringify(wrapped)); } catch {}
          }
        } catch { /* ignore malformed */ }
      }
    });
    console.log(`[forge] forge-pulse Rust accelerator: ${bin}`);
  } catch (e) {
    console.warn(`[forge] forge-pulse failed to start: ${e.message}`);
    pulse = null;
  }
}

/* ----- PTY lifecycle ----- */

function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of clients) if (c.readyState === 1) c.send(s);
}
function arenaBroadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of arenaClients) if (c.readyState === 1) c.send(s);
}

function startAgent(def) {
  const prev = agents.get(def.id);
  if (prev && prev.term) {
    try { prev.term.kill(); } catch {}
  }
  // Inject env vars so Claude Code hooks running inside this PTY know
  // which specialist they belong to and where to POST events. The hook
  // script in .claude/settings.json reads these to build its curl call.
  const ptyEnv = {
    ...process.env,
    AGENTFORGE_AGENT_ID: def.id,
    AGENTFORGE_HOOK_URL: `http://127.0.0.1:${PORT}/api/hooks`,
  };
  const term = pty.spawn(def.cmd, def.args || [], {
    name: "xterm-256color", cols: 140, rows: 30, cwd: REPO_DIR, env: ptyEnv,
  });
  const rec = { def, term, buf: "", alive: true, tail: "" };
  term.onData((d) => {
    rec.buf = (rec.buf + d).slice(-200000);
    rec.tail = (rec.tail + d).slice(-1200);
    broadcast({ t: "o", id: def.id, d });
    arenaBroadcast({ t: "o", id: def.id, d, ts: Date.now() });
    if (pulse && pulse.stdin.writable) {
      try { pulse.stdin.write(JSON.stringify({ id: def.id, d }) + "\n"); } catch {}
    }
    if (autoEnter.has(def.id)) {
      const m = rec.tail.match(AUTO_PROMPT_RE);
      if (m) {
        rec.tail = "";
        fireAutoEnter(def.id, m[0]);
      }
    }
  });
  term.onExit(({ exitCode }) => {
    rec.alive = false;
    broadcast({ t: "exit", id: def.id, code: exitCode });
    arenaBroadcast({ t: "exit", id: def.id, code: exitCode });
  });
  agents.set(def.id, rec);
  broadcast({ t: "started", id: def.id });
  arenaBroadcast({ t: "started", id: def.id });
  console.log(`[forge] started '${def.id}' (${def.cmd}) in ${REPO_DIR}`);
}

/* ----- HTTP ----- */

const TYPES = {
  ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".json":"application/json", ".svg":"image/svg+xml",
  ".woff2":"font/woff2", ".png":"image/png",
};
const PUBLIC = path.join(HERE, "public");

const server = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];

  // REST surfaces ----------------------------------------------------------
  if (url === "/api/agents" || url === "/agents") {
    res.writeHead(200, { "Content-Type": "application/json" });
    // Never leak raw role prompts over HTTP — they're operator-authored
    // briefings, not public metadata.
    return res.end(JSON.stringify({
      swarm: swarm.map(({ prompt, ...rest }) => rest),
      leadId: LEAD ? LEAD.id : null,
      repoDir: REPO_DIR,
    }));
  }
  if (url === "/api/state" || url === "/state") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(buildState({ repoDir: REPO_DIR })));
  }
  if (url === "/api/arena" || url === "/arena/state") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      autoEnter: Array.from(autoEnter),
      evolution: arenaState.evolution,
      customAgents: arenaState.customAgents,
      atlasMission: arenaState.atlasMission,
      ptyAgents: swarm.map((a) => a.id),
      leadId: LEAD ? LEAD.id : null,
      runningPtys: Array.from(agents.keys()),
      pulse: !!pulse,
      llm: { enabled: !!process.env.ANTHROPIC_API_KEY, model: process.env.AGENTFORGE_LLM_MODEL || "claude-sonnet-4-6" },
      spend: spendSnapshot(),
    }));
  }

  // Tool-hook receiver — POST /api/hooks
  // Body: JSON { agent, event, tool?, ok?, summary?, file? }
  //  OR    application/x-www-form-urlencoded same fields
  //  OR    GET /api/hooks?agent=…&event=…&tool=…  (curl convenience)
  // Always replies with the resolved state so the hook script can also be
  // used as a probe in non-production sessions.
  if (url === "/api/hooks") {
    if (req.method === "GET") {
      const u = new URL(req.url, `http://localhost:${PORT}`);
      const body = Object.fromEntries(u.searchParams);
      const r = consumeHookEvent(body);
      res.writeHead(r.ok ? 200 : 400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(r));
    }
    if (req.method === "POST") {
      let raw = "";
      req.setEncoding("utf8");
      req.on("data", (c) => { raw += c; if (raw.length > 64 * 1024) req.destroy(); });
      req.on("end", () => {
        let body = {};
        try { body = JSON.parse(raw); }
        catch {
          // form-urlencoded fallback
          try { body = Object.fromEntries(new URLSearchParams(raw)); } catch { body = {}; }
        }
        const r = consumeHookEvent(body);
        res.writeHead(r.ok ? 200 : 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(r));
      });
      return;
    }
    res.writeHead(405); return res.end("method not allowed");
  }

  // Pretty routes ----------------------------------------------------------
  // /          → mission control (the only surface)
  // /arena     → alias for backwards compatibility
  // /console   → redirects to / (the legacy 4-agent console is gone)
  if (url === "/console" || url === "/console/") {
    res.writeHead(302, { Location: "/" });
    return res.end();
  }
  let rel;
  if (url === "/") rel = "/arena.html";
  else if (url === "/arena" || url === "/arena/") rel = "/arena.html";
  else rel = url;

  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] || "text/plain",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });
    res.end(data);
  });
});

/* ----- WebSocket ----- */

const wss = new WebSocketServer({ noServer: true });
const arenaWss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, sock, head) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/arena") {
    arenaWss.handleUpgrade(req, sock, head, (ws) => arenaWss.emit("connection", ws, req));
  } else {
    wss.handleUpgrade(req, sock, head, (ws) => wss.emit("connection", ws, req));
  }
});

// Legacy /ws → kept as a thin compatibility shim. The arena WebSocket on
// /arena is the canonical channel; nothing in the current UI uses this one
// any more, but old tooling that hits the root WS gets the same PTY view.
wss.on("connection", (ws) => {
  clients.add(ws);
  for (const [id, rec] of agents) {
    ws.send(JSON.stringify({ t: "o", id, d: rec.buf }));
    ws.send(JSON.stringify({ t: rec.alive ? "started" : "exit", id }));
  }
  ws.on("message", (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const rec = agents.get(m.id);
    if (m.t === "i" && rec) rec.term.write(m.d);
    else if (m.t === "resize" && rec) {
      try { rec.term.resize(Math.max(2, m.cols | 0), Math.max(2, m.rows | 0)); } catch {}
    } else if (m.t === "start") {
      const def = ptyIndex.get(m.id); if (def) startAgent(def);
    } else if (m.t === "stop" && rec) {
      try { rec.term.kill(); } catch {}
    }
  });
  ws.on("close", () => clients.delete(ws));
});

arenaWss.on("connection", (ws) => {
  arenaClients.add(ws);
  ws.send(JSON.stringify({
    t: "hello",
    autoEnter: Array.from(autoEnter),
    evolution: arenaState.evolution,
    customAgents: arenaState.customAgents,
    atlasMission: arenaState.atlasMission,
    ptyAgents: swarm.map((a) => a.id),
    leadId: LEAD ? LEAD.id : null,
    pulse: !!pulse,
    llm: { enabled: !!process.env.ANTHROPIC_API_KEY, model: process.env.AGENTFORGE_LLM_MODEL || "claude-sonnet-4-6" },
    spend: spendSnapshot(),
  }));
  // Replay buffers for any live PTYs so a late-joining arena client sees state.
  for (const [id, rec] of agents) {
    ws.send(JSON.stringify({ t: "o", id, d: rec.buf }));
    ws.send(JSON.stringify({ t: rec.alive ? "started" : "exit", id }));
  }
  ws.on("message", (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    switch (m.t) {
      case "auto-config": {
        const wanted = new Set();
        const ptyIds = new Set(config.agents.map((a) => a.id));
        if (m.autoEnterAll) for (const id of ptyIds) wanted.add(id);
        if (Array.isArray(m.ptyIds)) for (const id of m.ptyIds) if (ptyIds.has(id)) wanted.add(id);
        const arenaCount = Array.isArray(m.agents) ? m.agents.length : 0;
        if (arenaCount > 0 && wanted.size === 0) for (const id of ptyIds) wanted.add(id);
        autoEnter.clear(); for (const id of wanted) autoEnter.add(id);
        arenaState.autoEnter = Array.from(autoEnter);
        saveArenaState(arenaState);
        ws.send(JSON.stringify({ t: "auto-config-ack", autoEnter: Array.from(autoEnter) }));
        console.log(`[forge] auto-enter armed: ${[...autoEnter].join(", ") || "(none)"}`);
        break;
      }
      case "persist": {
        // Generic state save from the arena. We accept a small whitelist of
        // fields so a misbehaving client can't dump arbitrary data.
        const next = { ...arenaState };
        if (m.evolution && typeof m.evolution === "object") next.evolution = m.evolution;
        if (Array.isArray(m.customAgents)) next.customAgents = m.customAgents;
        if (typeof m.atlasMission === "string") next.atlasMission = m.atlasMission.slice(0, 4000);
        arenaState = { ...next, version: 1 };
        saveArenaState(arenaState);
        ws.send(JSON.stringify({ t: "persist-ack" }));
        break;
      }
      case "press": {
        if (agents.has(m.id)) { try { agents.get(m.id).term.write("\r"); } catch {} }
        break;
      }
      case "input": {
        if (agents.has(m.id)) { try { agents.get(m.id).term.write(String(m.d || "")); } catch {} }
        break;
      }
      case "start-pty": {
        const def = ptyIndex.get(m.id);
        if (def) {
          startAgent(def);
          // Only auto-paste the role briefing when the operator explicitly
          // dispatched with a goal. Manual "launch" from the UI sends no
          // goal — those sessions get a clean shell so the operator can
          // drive them directly (and so test environments using TEST_CMD
          // aren't drowned in role-prompt text). Atlas's auto-dispatch
          // always supplies a goal, so the briefing flow stays intact.
          const goal = (m.goal || "").trim();
          if (def.prompt && goal) {
            const promptText = def.prompt.replace("{{GOAL}}", goal);
            setTimeout(() => {
              const rec2 = agents.get(def.id); if (!rec2) return;
              try {
                rec2.term.write("\x1b[200~" + promptText + "\x1b[201~");
                // Send Enter as a SEPARATE write 150ms later — Claude
                // Code drops Enter if it's bundled with bracketed paste.
                setTimeout(() => { try { rec2.term.write("\r"); } catch {} }, 150);
              } catch {}
            }, 900);
          }
        } else {
          ws.send(JSON.stringify({ t: "error", reason: `unknown pty id: ${m.id}` }));
        }
        break;
      }
      case "stop-pty": {
        const rec = agents.get(m.id); if (rec) try { rec.term.kill(); } catch {}
        break;
      }
      case "atlas-brief": {
        // Stream a real Atlas briefing through the configured LLM. The text
        // is accumulated server-side so when the stream ends we can pull the
        // `BRIEFINGS:` block out and auto-dispatch each specialist's PTY
        // with its sub-briefing. Cost is recorded into the spend ledger.
        const goal = String(m.goal || "").slice(0, 4000);
        const roster = Array.isArray(m.roster) ? m.roster.slice(0, 32) : [];
        const autoDispatch = m.autoDispatch !== false; // opt-out flag
        const cfg = llmConfig();
        if (!cfg.enabled) {
          ws.send(JSON.stringify({ t: "atlas-brief-error", reason: "ANTHROPIC_API_KEY not set on the server." }));
          break;
        }
        if (spend.budgetUsd > 0 && spend.totalUsd >= spend.budgetUsd) {
          ws.send(JSON.stringify({ t: "atlas-brief-error",
            reason: `Budget ceiling $${spend.budgetUsd.toFixed(2)} reached (spent $${spend.totalUsd.toFixed(4)}). Raise AGENTFORGE_BUDGET_USD to continue.` }));
          break;
        }
        const ac = new AbortController();
        const reqId = `b-${Date.now()}`;
        let accum = "";
        ws.send(JSON.stringify({ t: "atlas-brief-start", reqId, model: cfg.model }));
        atlasBrief({
          goal, roster,
          signal: ac.signal,
          onDelta: (d) => {
            accum += d;
            try { ws.send(JSON.stringify({ t: "atlas-brief-delta", reqId, d })); } catch {}
          },
        }).then(({ usage, cost, model }) => {
          recordSpend({ usage, cost, model, goal });
          const parsed = parseAtlasBrief(accum);
          arenaBroadcastSafe({
            t: "atlas-brief-end", reqId, usage, cost, model,
            briefings: parsed.briefings,
            plan: parsed.plan.slice(0, 400),
            autoDispatch,
          });
          if (autoDispatch && parsed.briefings.length) {
            // Pass 2 — for every specialist Atlas tagged, fire a *parallel*
            // LLM stream that expands the one-sentence label into a full
            // role-aware briefing. The deltas land on the specialist's card
            // live; when the stream completes the server pastes the full
            // text into the specialist's PTY (starting it if needed) and
            // presses Enter as a separate write.
            const roster = Array.isArray(m.roster) ? m.roster : [];
            for (const b of parsed.briefings) {
              if (b.id === "atlas") continue;
              const def = ptyIndex.get(b.id);
              if (!def) {
                arenaBroadcastSafe({ t: "dispatch-skip", id: b.id, reason: "unknown specialist" });
                continue;
              }
              const specMeta = roster.find((r) => r.id === b.id) || {
                id: b.id, name: def.name || b.id, role: def.label || b.id,
                superSkill: def.prompt || "(no super-skill metadata)",
                lane: def.lane,
              };
              arenaBroadcastSafe({ t: "specialist-brief-start", reqId, id: b.id, task: b.task });
              const wasRunning = agents.has(b.id) && agents.get(b.id).alive;
              let specAccum = "";
              specialistBrief({
                specialist: specMeta,
                goal, plan: parsed.plan, task: b.task,
                onDelta: (d) => {
                  specAccum += d;
                  arenaBroadcastSafe({ t: "specialist-brief-delta", reqId, id: b.id, d });
                },
              }).then(({ usage, cost, model }) => {
                recordSpend({ usage, cost, model, goal: `[${b.id}] ${b.task}` });
                arenaBroadcastSafe({
                  t: "specialist-brief-end", reqId, id: b.id, usage, cost, model,
                });
                // Now paste the full briefing into the specialist's PTY and
                // press Enter as a separate write 150ms later.
                if (!wasRunning) startAgent(def);
                setTimeout(() => {
                  const rec2 = agents.get(def.id); if (!rec2) return;
                  try {
                    rec2.term.write("\x1b[200~" + specAccum + "\x1b[201~");
                    setTimeout(() => { try { rec2.term.write("\r"); } catch {} }, 150);
                  } catch {}
                }, wasRunning ? 200 : 900);
                arenaBroadcastSafe({
                  t: "dispatch", reqId, id: b.id, task: b.task, started: !wasRunning,
                });
              }).catch((e) => {
                arenaBroadcastSafe({
                  t: "specialist-brief-error", reqId, id: b.id,
                  reason: String(e.message || e),
                });
                // Best-effort fallback: paste the original short task so the
                // dispatch isn't lost when the expansion call fails.
                if (!wasRunning) startAgent(def);
                setTimeout(() => {
                  const rec2 = agents.get(def.id); if (!rec2) return;
                  try {
                    rec2.term.write("\x1b[200~" + b.task + "\x1b[201~");
                    setTimeout(() => { try { rec2.term.write("\r"); } catch {} }, 150);
                  } catch {}
                }, wasRunning ? 200 : 900);
              });
            }
          }
        }).catch((e) => {
          ws.send(JSON.stringify({ t: "atlas-brief-error", reqId, reason: String(e.message || e) }));
        });
        ws._atlasAborts = ws._atlasAborts || new Map();
        ws._atlasAborts.set(reqId, ac);
        break;
      }
      case "atlas-brief-abort": {
        const ac = ws._atlasAborts && ws._atlasAborts.get(m.reqId);
        if (ac) { try { ac.abort(); } catch {} }
        break;
      }
      case "spend-reset": {
        spend.totalIn = 0; spend.totalOut = 0; spend.totalUsd = 0;
        spend.briefs.length = 0; spend.startedAt = Date.now();
        ws.send(JSON.stringify({ t: "spend-update", spend: spendSnapshot() }));
        break;
      }
      case "spend-get": {
        ws.send(JSON.stringify({ t: "spend-update", spend: spendSnapshot() }));
        break;
      }
    }
  });
  ws.on("close", () => arenaClients.delete(ws));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n[forge] AgentForge Command up on http://localhost:${PORT}`);
  console.log(`[forge] mission control: http://localhost:${PORT}/`);
  console.log(`[forge] working repo:    ${REPO_DIR}`);
  console.log(`[forge] swarm:           ${swarm.map((s) => s.id).join(", ")}`);
  console.log(`[forge] llm bridge:      ${process.env.ANTHROPIC_API_KEY ? "enabled" : "disabled (set ANTHROPIC_API_KEY)"}`);
  startForgePulse();
  // No autostart by default — Atlas decides which specialists run, and the
  // operator launches them from the cockpit. Set AUTOSTART=lead to auto-spawn
  // only Atlas, or AUTOSTART=all to spawn every specialist (12 sessions).
  if (AUTOSTART === "all") {
    for (const def of swarm) startAgent(def);
  } else if (AUTOSTART === "lead" && LEAD) {
    startAgent(LEAD);
  } else {
    console.log("[forge] specialists are dormant — launch from the cockpit (set AUTOSTART=lead|all to change)");
  }
});
