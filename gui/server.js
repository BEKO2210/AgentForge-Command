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
import crypto from "node:crypto";
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

/* ----- Trust boundary: origin/host allowlist + per-session token (Phase 1) ---
 * The cockpit binds to 127.0.0.1, but loopback does NOT stop a malicious page
 * in the SAME browser from opening ws://localhost:PORT/arena and driving real
 * PTYs (CSWSH → drive-by RCE — see docs/THREAT_MODEL.md, Finding #1). We close
 * that boundary three ways:
 *   1. Host-header allowlist  → defeats DNS-rebinding.
 *   2. Origin allowlist       → rejects cross-site WS upgrades & state writes.
 *   3. Per-session token       → the secret a foreign origin cannot read.
 * AGENTFORGE_ALLOWED_ORIGINS (comma-separated) is a documented, deliberate
 * loosening (e.g. a remote tunnel). AGENTFORGE_NO_TOKEN=1 disables the token
 * for a knowingly-trusted single-user box (loud warning at boot). */
const NO_TOKEN = process.env.AGENTFORGE_NO_TOKEN === "1";
const SESSION_TOKEN = crypto.randomBytes(32).toString("hex");
const ALLOWED_ORIGINS = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
const ALLOWED_HOSTS = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];
if (process.env.AGENTFORGE_ALLOWED_ORIGINS) {
  for (const o of process.env.AGENTFORGE_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)) {
    ALLOWED_ORIGINS.push(o);
    try { ALLOWED_HOSTS.push(new URL(o).host); } catch { /* ignore malformed entry */ }
  }
}

// A request is trusted iff its Host is on the allowlist AND, when an Origin
// header is present, that Origin is on the allowlist. Browsers always attach
// Origin to cross-origin requests, so a *missing* Origin only happens for
// non-browser callers (curl, the local hook script) — those still face the
// Host check and the token check below.
function isTrustedOrigin(req) {
  const host = req.headers.host;
  if (!host || !ALLOWED_HOSTS.includes(host)) {
    console.warn(`[forge] blocked request — untrusted Host: ${host || "(none)"}`);
    return false;
  }
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn(`[forge] blocked request — untrusted Origin: ${origin}`);
    return false;
  }
  return true;
}

// Constant-time compare so a token check can't be timing-probed.
function tokenMatches(candidate) {
  if (NO_TOKEN) return true;
  if (!candidate || candidate.length !== SESSION_TOKEN.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(SESSION_TOKEN));
  } catch { return false; }
}

// Token may arrive as ?token= (WS + hook scripts) or x-afc-token header (XHR).
function hasValidToken(req) {
  if (NO_TOKEN) return true;
  let token = null;
  try {
    token = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${PORT}`}`).searchParams.get("token");
  } catch { /* malformed url */ }
  if (!token && req.headers["x-afc-token"]) token = String(req.headers["x-afc-token"]);
  return tokenMatches(token);
}
// AUTOSTART now takes three values:
//   "off" (default) — no specialist auto-runs; the operator launches from the UI
//   "lead"          — auto-spawn only Atlas
//   "all"           — auto-spawn every specialist (12 concurrent Claude sessions!)
// Old boolean values are translated: "0" → "off", "1" / unset → "off" too,
// since the new default is dormant. Set it explicitly if you want auto-spawn.
const _autoRaw = (process.env.AUTOSTART || "").toLowerCase();
const AUTOSTART = _autoRaw === "all" ? "all" : _autoRaw === "lead" ? "lead" : "off";
const ARENA_FILE = path.join(REPO_DIR, ".team", "arena.json");
// Deterministic test harness: when set AND no real LLM key is configured, the
// atlas-brief path runs a *clearly labelled* synthetic Atlas that exercises the
// real routing chain (goal → parse → dispatch → reports → final summary)
// without pretending an LLM ran. Every event it emits carries `harness:true`
// and the cockpit shows a "TEST HARNESS" badge. Never on by accident.
const HARNESS = process.env.AGENTFORGE_HARNESS === "1" || process.env.AGENTFORGE_TEST_HARNESS === "1";

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

/* ----- Deterministic test harness -----
 * Synthetic Atlas that drives the SAME routing pipeline the live LLM path uses
 * (parse → dispatch → per-specialist briefing → report → final summary), but
 * with fixed, offline content. It exists to prove the routing chain end-to-end
 * when no API key / Claude CLI is available. It is honest about being a harness:
 * every frame carries `harness:true` and the final summary says so. It does NOT
 * spawn PTYs or claim a specialist "worked" — it reports each addressed agent's
 * delivery status truthfully (dispatched vs. not-running). */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function harnessTargets(goal, roster) {
  const specialists = roster.filter((r) => r.id && r.id !== "atlas");
  const named = specialists.filter((r) => {
    const id = String(r.id);
    const name = String(r.name || "");
    const re = new RegExp(`\\b(${id}|${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b`, "i");
    return re.test(goal);
  });
  return named.length ? named : specialists;
}

async function runHarnessBrief({ ws, goal, roster, autoDispatch }) {
  const reqId = `h-${Date.now()}`;
  const send = (msg) => { try { ws.send(JSON.stringify({ ...msg, harness: true })); } catch {} };
  const targets = harnessTargets(goal, roster);

  send({ t: "atlas-brief-start", reqId, model: "test-harness" });
  await sleep(20);

  const plan = `Running a deterministic swarm check (TEST HARNESS — no live LLM). I will address ${targets.length} specialist${targets.length === 1 ? "" : "s"}: ${targets.map((t) => t.id).join(", ")}. Each is asked for one status line; I will then summarise who responded and what remains open.`;
  // Stream the plan in a few chunks so the transcript renders a live answer.
  for (const chunk of plan.match(/.{1,60}(\s|$)/g) || [plan]) {
    send({ t: "atlas-brief-delta", reqId, d: chunk });
    await sleep(12);
  }
  const briefings = targets.map((t) => ({ id: t.id, task: `report one-line ${t.role || "status"} check for the swarm audit` }));
  send({ t: "atlas-brief-end", reqId, plan, briefings,
         usage: { input_tokens: 0, output_tokens: 0 }, cost: 0 });
  await sleep(20);

  const responded = [];
  const notRunning = [];
  if (autoDispatch !== false) {
    for (const b of briefings) {
      const def = ptyIndex.get(b.id);
      if (!def) { send({ t: "dispatch-skip", reqId, id: b.id, reason: "unknown specialist" }); continue; }
      send({ t: "specialist-brief-start", reqId, id: b.id, task: b.task });
      await sleep(10);
      send({ t: "specialist-brief-delta", reqId, id: b.id, d: `You are ${def.name || b.id}. ${b.task}. Reply to @atlas with exactly one status line.` });
      await sleep(10);
      send({ t: "specialist-brief-end", reqId, id: b.id, usage: { input_tokens: 0, output_tokens: 0 }, cost: 0 });
      const running = agents.has(b.id) && agents.get(b.id).alive;
      send({ t: "dispatch", reqId, id: b.id, task: b.task, started: false, running });
      await sleep(10);
      // Truthful report: a harness status line is synthetic, clearly tagged.
      send({ t: "specialist-report", reqId, id: b.id,
             line: `[harness] ${(def.name || b.id)} ack — ${b.task}`,
             running });
      responded.push(b.id);
      if (!running) notRunning.push(b.id);
      await sleep(10);
    }
  }

  const summary = [
    `SWARM CHECK COMPLETE (TEST HARNESS — no live LLM ran).`,
    `Checked: routing chain for ${briefings.length} specialist${briefings.length === 1 ? "" : "s"} (${briefings.map((b) => b.id).join(", ")}).`,
    `Responded: ${responded.length ? responded.join(", ") : "none"}.`,
    notRunning.length
      ? `Open: ${notRunning.join(", ")} have no live PTY — launch them (or set ANTHROPIC_API_KEY / TEST_CMD) for a real session.`
      : `Open: nothing — every addressed specialist had a live session.`,
  ].join(" ");
  send({ t: "atlas-final", reqId, summary,
         addressed: briefings.map((b) => b.id), responded, open: notRunning });
}

/* ----- Arena persistence ----- */

const EMPTY_ARENA = () => ({ evolution: {}, autoEnter: [], customAgents: [], atlasMission: "", version: 1 });

function loadArenaState() {
  let raw;
  try {
    raw = fs.readFileSync(ARENA_FILE, "utf8");
  } catch {
    // No file yet — first run. Honest empty state, nothing to recover.
    return EMPTY_ARENA();
  }
  try {
    const j = JSON.parse(raw);
    return {
      evolution:  j.evolution  && typeof j.evolution  === "object" ? j.evolution  : {},
      autoEnter:  Array.isArray(j.autoEnter) ? j.autoEnter : [],
      customAgents: Array.isArray(j.customAgents) ? j.customAgents : [],
      atlasMission: typeof j.atlasMission === "string" ? j.atlasMission : "",
      version: 1,
    };
  } catch (e) {
    // The file exists but is corrupt. Never crash on it — preserve the broken
    // copy as a sidecar so nothing is silently lost, then reset to empty.
    try {
      const backup = `${ARENA_FILE}.corrupt-${Date.now()}`;
      fs.renameSync(ARENA_FILE, backup);
      console.error(`[forge] .team/arena.json was corrupt (${e.message}). Backed up to ${path.basename(backup)} and reset to empty state.`);
    } catch (e2) {
      console.error(`[forge] .team/arena.json was corrupt and could not be backed up: ${e2.message}`);
    }
    return EMPTY_ARENA();
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

/* ----- Command resolution -----
 * Before we spawn a PTY we resolve the command against $PATH so a missing
 * binary (most often the `claude` CLI) becomes an honest, actionable error
 * instead of a cryptic `execvp(3) failed` line buried in the terminal — or,
 * on platforms where node-pty throws synchronously, an uncaught exception
 * that takes the whole server down. */
function resolveCommand(cmd) {
  if (!cmd) return null;
  if (cmd.includes("/")) {
    try { fs.accessSync(cmd, fs.constants.X_OK); return cmd; } catch { return null; }
  }
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    const full = path.join(dir, cmd);
    try { fs.accessSync(full, fs.constants.X_OK); return full; } catch {}
  }
  return null;
}

// Cache the lead's command resolution once so the cockpit can show a
// "Claude CLI: found / missing" pill without re-probing PATH on every request.
function claudeCliPresent() {
  const cmd = (LEAD && LEAD.cmd) || "claude";
  return !!resolveCommand(cmd);
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

function launchError(id, reason) {
  console.error(`[forge] launch failed for '${id}': ${reason}`);
  broadcast({ t: "launch-error", id, reason });
  arenaBroadcast({ t: "launch-error", id, reason });
}

function startAgent(def) {
  // Preflight: a missing command must surface as a clear, actionable error —
  // not a silent crash or cryptic terminal noise. Returns false so callers
  // can skip any follow-up (briefing paste, etc.).
  if (!resolveCommand(def.cmd)) {
    launchError(def.id,
      `command not found: ${def.cmd}. Install it and ensure it is on PATH ` +
      (def.cmd === "claude"
        ? "(the Claude CLI — see https://claude.com/claude-code), or set TEST_CMD=bash for a smoke test."
        : "."));
    return false;
  }
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
    // Hook scripts (curl) carry the session token so they keep working while
    // foreign pages — which can't read the token — are rejected. In NO_TOKEN
    // mode the query is harmless (the server ignores it).
    AGENTFORGE_HOOK_URL: NO_TOKEN
      ? `http://127.0.0.1:${PORT}/api/hooks`
      : `http://127.0.0.1:${PORT}/api/hooks?token=${SESSION_TOKEN}`,
  };
  let term;
  try {
    term = pty.spawn(def.cmd, def.args || [], {
      name: "xterm-256color", cols: 140, rows: 30, cwd: REPO_DIR, env: ptyEnv,
    });
  } catch (e) {
    launchError(def.id, `failed to start ${def.cmd}: ${e.message}`);
    return false;
  }
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
  return true;
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
      claudeCli: claudeCliPresent(),
      harness: HARNESS && !process.env.ANTHROPIC_API_KEY,
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
    // CSRF / trust-boundary guard: a foreign page can fire GET (via <img>) or
    // POST at this endpoint, but cannot supply a valid Origin *and* the
    // session token. Both methods are gated (see THREAT_MODEL Finding #2).
    if (!isTrustedOrigin(req) || !hasValidToken(req)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, reason: "forbidden" }));
    }
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
  // Static files are public assets, but a foreign page could still try to use
  // the loopback server as a confused deputy — so we keep the Host check here
  // too (Origin is intentionally NOT required: assets must load same-origin).
  if (!req.headers.host || !ALLOWED_HOSTS.includes(req.headers.host)) {
    res.writeHead(403); return res.end("forbidden");
  }

  let rel;
  if (url === "/") rel = "/arena.html";
  else if (url === "/arena" || url === "/arena/") rel = "/arena.html";
  else {
    // Path-traversal hardening: decode %2e/%2f variants, then normalize, then
    // re-check containment (Finding #1 / THREAT_MODEL, defence in depth).
    try { rel = decodeURIComponent(url); }
    catch { res.writeHead(400); return res.end("bad request"); }
  }
  rel = path.normalize(rel);

  const file = path.join(PUBLIC, rel);
  // Guard against both escapes ("/../etc") and sibling-prefix tricks
  // ("/public-evil"): the resolved path must be PUBLIC itself or live under it.
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403); return res.end("forbidden");
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    const headers = {
      "Content-Type": TYPES[path.extname(file)] || "text/plain",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      // Security headers on every served file (THREAT_MODEL Finding #3).
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      // CSP: same-origin scripts only (no inline JS — the token rides a <meta>
      // tag, not an inline <script>). Google Fonts origins are allowlisted so
      // the cockpit keeps its typography; ws: is scoped to loopback.
      "Content-Security-Policy": [
        "default-src 'self'",
        "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
        "img-src 'self' data:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "script-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
      ].join("; "),
    };
    // Inject the per-session token into arena.html only. Same-origin scripts
    // can read the served HTML; cross-origin pages cannot — so the token never
    // leaks to a foreign origin. In NO_TOKEN mode the placeholder is blanked.
    if (path.basename(file) === "arena.html") {
      const html = data.toString().replace(/@SESSION_TOKEN@/g, NO_TOKEN ? "" : SESSION_TOKEN);
      res.writeHead(200, headers);
      return res.end(html);
    }
    res.writeHead(200, headers);
    res.end(data);
  });
});

/* ----- WebSocket ----- */

const wss = new WebSocketServer({ noServer: true });
const arenaWss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, sock, head) => {
  // Close the CSWSH boundary BEFORE handing the socket to ws (Finding #1):
  // reject untrusted Host/Origin and any upgrade without the session token.
  if (!isTrustedOrigin(req)) {
    sock.write("HTTP/1.1 403 Forbidden\r\n\r\n"); sock.destroy(); return;
  }
  if (!hasValidToken(req)) {
    sock.write("HTTP/1.1 403 Forbidden\r\n\r\n"); sock.destroy(); return;
  }
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
    claudeCli: claudeCliPresent(),
    harness: HARNESS && !process.env.ANTHROPIC_API_KEY,
    llm: { enabled: !!process.env.ANTHROPIC_API_KEY, model: process.env.AGENTFORGE_LLM_MODEL || "claude-sonnet-4-6" },
    spend: spendSnapshot(),
  }));
  // Replay buffers for any live PTYs so a late-joining arena client sees state.
  for (const [id, rec] of agents) {
    ws.send(JSON.stringify({ t: "o", id, d: rec.buf }));
    ws.send(JSON.stringify({ t: rec.alive ? "started" : "exit", id }));
  }
  ws.on("message", (raw) => {
    // WS message hardening (THREAT_MODEL Finding, DoS row):
    // 1) cap raw size so a single frame can't blow up memory.
    if (raw.length > 256 * 1024) {
      console.warn(`[forge] oversized arena message rejected (${raw.length} bytes)`);
      try { ws.close(1009, "message too big"); } catch {}
      return;
    }
    // 2) token-bucket rate-limit (≈10 msg/s, burst 10) per connection.
    if (!ws._rl) ws._rl = { tokens: 10, last: Date.now() };
    const now = Date.now();
    ws._rl.tokens = Math.min(10, ws._rl.tokens + ((now - ws._rl.last) / 1000) * 10);
    ws._rl.last = now;
    if (ws._rl.tokens < 1) {
      console.warn("[forge] arena ws rate limit exceeded");
      try { ws.close(1008, "rate limited"); } catch {}
      return;
    }
    ws._rl.tokens -= 1;

    let m;
    try { m = JSON.parse(raw); } catch { return; }
    switch (m.t) {
      case "auto-config": {
        // Arm auto-enter for EXACTLY the agents the operator selected. The
        // client (main.js → syncAutoEnterServer) sends `{ agents: [{id,…}] }`
        // listing only the armed cards. We also accept `autoEnterAll` and an
        // explicit `ptyIds` list for tooling. Auto-enter approves permission
        // prompts on the operator's behalf, so we must never arm an agent the
        // operator didn't pick — an empty selection means "disarm everything".
        const wanted = new Set();
        const ptyIds = new Set(swarm.map((a) => a.id));
        if (m.autoEnterAll) for (const id of ptyIds) wanted.add(id);
        if (Array.isArray(m.ptyIds)) for (const id of m.ptyIds) if (ptyIds.has(id)) wanted.add(id);
        if (Array.isArray(m.agents)) for (const a of m.agents) {
          const id = a && typeof a === "object" ? a.id : a;
          if (ptyIds.has(id)) wanted.add(id);
        }
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
        // Cap a single keystroke payload — real typing/paste is small; an
        // oversized `input` is either a bug or an attempt to flood the PTY.
        if (agents.has(m.id)) { try { agents.get(m.id).term.write(String(m.d || "").slice(0, 64 * 1024)); } catch {} }
        break;
      }
      case "start-pty": {
        const def = ptyIndex.get(m.id);
        if (def) {
          const launched = startAgent(def);
          // Only auto-paste the role briefing when the operator explicitly
          // dispatched with a goal. Manual "launch" from the UI sends no
          // goal — those sessions get a clean shell so the operator can
          // drive them directly (and so test environments using TEST_CMD
          // aren't drowned in role-prompt text). Atlas's auto-dispatch
          // always supplies a goal, so the briefing flow stays intact.
          const goal = (m.goal || "").trim();
          if (launched && def.prompt && goal) {
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
          if (HARNESS) {
            // Deterministic, clearly-labelled routing-chain test. No LLM, no
            // PTY spawns, no fake "work" — just the real dispatch pipeline.
            runHarnessBrief({ ws, goal, roster, autoDispatch });
            break;
          }
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
  if (NO_TOKEN) {
    console.warn("[forge] ⚠️  NO_TOKEN mode — no session token required.");
    console.warn("[forge] ⚠️  Use only on a trusted single-user machine.");
  } else {
    console.log("[forge] ════════════════════════════════════════════════════");
    console.log("[forge] session token (required for the cockpit & hooks):");
    console.log(`[forge] ${SESSION_TOKEN}`);
    console.log("[forge] open the cockpit via the link below — the token is");
    console.log("[forge] injected into the page automatically (same-origin).");
    console.log("[forge] ════════════════════════════════════════════════════");
  }
  console.log(`[forge] mission control: http://localhost:${PORT}/`);
  console.log(`[forge] working repo:    ${REPO_DIR}`);
  console.log(`[forge] swarm:           ${swarm.map((s) => s.id).join(", ")}`);
  console.log(`[forge] claude cli:      ${claudeCliPresent() ? "found" : `missing (launches will fail — install '${(LEAD && LEAD.cmd) || "claude"}' or set TEST_CMD=bash)`}`);
  console.log(`[forge] llm bridge:      ${process.env.ANTHROPIC_API_KEY ? "enabled" : "disabled (set ANTHROPIC_API_KEY)"}`);
  if (HARNESS && !process.env.ANTHROPIC_API_KEY) {
    console.log(`[forge] test harness:    ON — atlas-brief runs the deterministic routing harness (no live LLM). Frames are tagged harness:true.`);
  }
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

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`\n[forge] port ${PORT} is already in use. Stop the other process or start with a different port:\n  PORT=${PORT + 1} node gui/server.js\n`);
    process.exit(1);
  }
  console.error(`[forge] server error: ${e.message}`);
  process.exit(1);
});

/* ----- Clean shutdown ----- */
// Kill every live PTY, hang up the Rust accelerator and close the WebSocket
// servers so we don't leak child processes or sockets on Ctrl-C / SIGTERM.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[forge] ${signal} — shutting down: killing ${agents.size} PTY(s)…`);
  for (const [, rec] of agents) { try { rec.term.kill(); } catch {} }
  if (pulse) { try { pulse.kill(); } catch {} }
  for (const c of clients)      { try { c.close(); } catch {} }
  for (const c of arenaClients) { try { c.close(); } catch {} }
  try { wss.close(); } catch {}
  try { arenaWss.close(); } catch {}
  server.close(() => process.exit(0));
  // Hard backstop: never hang forever waiting on a stuck socket.
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
