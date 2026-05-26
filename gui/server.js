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
const AUTOSTART = process.env.AUTOSTART !== "0";
const ARENA_FILE = path.join(REPO_DIR, ".team", "arena.json");

const config = JSON.parse(fs.readFileSync(path.join(HERE, "agents.json"), "utf8"));
if (process.env.TEST_CMD) {
  for (const a of config.agents) {
    a.cmd = process.env.TEST_CMD;
    a.args = [];
  }
}

const agents = new Map(); // id -> { def, term, buf, alive, tail }
const clients = new Set();
const arenaClients = new Set();

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
  const term = pty.spawn(def.cmd, def.args || [], {
    name: "xterm-256color", cols: 140, rows: 30, cwd: REPO_DIR, env: process.env,
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
    return res.end(JSON.stringify({ agents: config.agents, repoDir: REPO_DIR }));
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
      ptyAgents: config.agents.map((a) => a.id),
      pulse: !!pulse,
    }));
  }

  // Pretty routes ----------------------------------------------------------
  // /          → arena (the default surface)
  // /console   → legacy 4-agent console
  // /arena     → kept as an alias for backwards compatibility
  let rel;
  if (url === "/") rel = "/arena.html";
  else if (url === "/console" || url === "/console/") rel = "/console.html";
  else if (url === "/arena" || url === "/arena/") rel = "/arena.html";
  else rel = url;

  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "text/plain" });
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
      const def = config.agents.find((a) => a.id === m.id);
      if (def) startAgent(def);
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
    ptyAgents: config.agents.map((a) => a.id),
    pulse: !!pulse,
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
        const def = config.agents.find((a) => a.id === m.id);
        if (def) startAgent(def);
        break;
      }
      case "stop-pty": {
        const rec = agents.get(m.id); if (rec) try { rec.term.kill(); } catch {}
        break;
      }
    }
  });
  ws.on("close", () => arenaClients.delete(ws));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n[forge] AgentForge Command up on http://localhost:${PORT}`);
  console.log(`[forge] arena (default): http://localhost:${PORT}/`);
  console.log(`[forge] legacy console:  http://localhost:${PORT}/console`);
  console.log(`[forge] working repo:    ${REPO_DIR}`);
  startForgePulse();
  if (AUTOSTART) for (const def of config.agents) startAgent(def);
  else console.log("[forge] AUTOSTART=0 — start each PTY from the UI or send {t:'start-pty',id}");
});
