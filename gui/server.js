// One-window control panel for the Claude Code team — now with the Agent Arena.
//
// Two surfaces share the same Node server + WebSocket bridge:
//   - /            → the original 4-agent TEAM // CONSOLE (terminals + vitals)
//   - /arena       → the new Agent Mission Control / Bot Arena
//
// Auto-enter (server-side) is opt-in per PTY: when an Arena agent's auto-enter
// toggle is on, this server watches that PTY's output for permission prompts
// ("(y/n)", "press enter", "approve?") and presses Enter for the operator —
// so they don't have to keep approving the same prompts. The watch only fires
// for PTYs the user explicitly enabled.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildState } from "../lib/state.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

let pty;
try {
  const m = await import("node-pty");
  pty = m.default || m;
} catch {
  console.error("\n[team-gui] node-pty is not installed.\n  cd gui && npm install\n");
  process.exit(1);
}

let WebSocketServer;
try {
  ({ WebSocketServer } = await import("ws"));
} catch {
  console.error("\n[team-gui] ws is not installed.\n  cd gui && npm install\n");
  process.exit(1);
}

const REPO_DIR = process.env.REPO_DIR || process.cwd();
const PORT = Number(process.env.PORT) || 4173;
const AUTOSTART = process.env.AUTOSTART !== "0";

const config = JSON.parse(fs.readFileSync(path.join(HERE, "agents.json"), "utf8"));
// Optional override so you can smoke-test without launching claude: TEST_CMD=bash
if (process.env.TEST_CMD) {
  for (const a of config.agents) {
    a.cmd = process.env.TEST_CMD;
    a.args = [];
  }
}

const agents = new Map(); // id -> { def, term, buf }
const clients = new Set();
const arenaClients = new Set();

/* ----- Auto-enter watchdog -----
 * autoEnter holds the PTY ids the user wants the server to press Enter for
 * when a permission/confirmation prompt is detected. Patterns are intentionally
 * conservative — we only fire on clear "(y/n)", "press enter", "approve?" style
 * prompts, never on arbitrary text. */
const autoEnter = new Set();
const AUTO_PROMPT_RE = /\(y\/n\)|\[y\/n\]|\(yes\/no\)|\[yes\/no\]|press +enter +to +continue|press +any +key|approve\??|do +you +want +to|are +you +sure|continue\?|confirm\?|allow +this(?: +tool)? +to +run/i;
const AUTO_COOLDOWN_MS = 1500;
const autoLastFire = new Map(); // ptyId -> ms

function fireAutoEnter(id, reasonLine) {
  const last = autoLastFire.get(id) || 0;
  if (Date.now() - last < AUTO_COOLDOWN_MS) return;
  const rec = agents.get(id); if (!rec || !rec.alive) return;
  autoLastFire.set(id, Date.now());
  try { rec.term.write("\r"); } catch {}
  const note = { t: "auto-fired", id, target: id, reason: reasonLine.slice(0, 80) };
  for (const c of arenaClients) if (c.readyState === 1) {
    try { c.send(JSON.stringify(note)); } catch {}
  }
  console.log(`[team-gui] auto-enter → ${id} (reason: ${reasonLine.trim().slice(0, 60)})`);
}

function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of clients) if (c.readyState === 1) c.send(s);
}

function startAgent(def) {
  const prev = agents.get(def.id);
  if (prev && prev.term) {
    try { prev.term.kill(); } catch { /* already gone */ }
  }
  const term = pty.spawn(def.cmd, def.args || [], {
    name: "xterm-256color",
    cols: 140,
    rows: 30,
    cwd: REPO_DIR,
    env: process.env,
  });
  const rec = { def, term, buf: "", alive: true, tail: "" };
  term.onData((d) => {
    rec.buf = (rec.buf + d).slice(-200000);
    // Keep a small sliding tail so we can match prompts that arrived across
    // multiple chunks (Claude sometimes writes "Are\n you sure?" in pieces).
    rec.tail = (rec.tail + d).slice(-1200);
    broadcast({ t: "o", id: def.id, d });
    if (autoEnter.has(def.id)) {
      const m = rec.tail.match(AUTO_PROMPT_RE);
      if (m) {
        rec.tail = ""; // consume so we don't fire repeatedly on the same prompt
        fireAutoEnter(def.id, m[0]);
      }
    }
  });
  term.onExit(({ exitCode }) => { rec.alive = false; broadcast({ t: "exit", id: def.id, code: exitCode }); });
  agents.set(def.id, rec);
  broadcast({ t: "started", id: def.id });
  console.log(`[team-gui] started '${def.id}' (${def.cmd}) in ${REPO_DIR}`);
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const PUBLIC = path.join(HERE, "public");

const server = http.createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/agents") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ agents: config.agents, repoDir: REPO_DIR }));
  }
  if (url === "/state") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(buildState({ repoDir: REPO_DIR })));
  }
  if (url === "/arena/state") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ autoEnter: Array.from(autoEnter), agents: config.agents.map((a) => a.id) }));
  }
  // Map /arena and /arena/ to arena.html (pretty URL).
  let rel = url === "/" ? "/index.html" : url;
  if (rel === "/arena" || rel === "/arena/") rel = "/arena.html";
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "text/plain" });
    res.end(data);
  });
});

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
      try { rec.term.resize(Math.max(2, m.cols | 0), Math.max(2, m.rows | 0)); } catch { /* ignore bad sizes */ }
    } else if (m.t === "start") {
      const def = config.agents.find((a) => a.id === m.id);
      if (def) startAgent(def);
    } else if (m.t === "stop" && rec) {
      try { rec.term.kill(); } catch { /* ignore */ }
    }
  });
  ws.on("close", () => clients.delete(ws));
});

arenaWss.on("connection", (ws) => {
  arenaClients.add(ws);
  ws.send(JSON.stringify({ t: "hello", autoEnter: Array.from(autoEnter) }));
  ws.on("message", (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.t === "auto-config") {
      // The client tells us which agents have auto-enter on. We accept arena
      // agent ids OR real PTY ids — anything matching a real PTY id is honoured.
      // If autoEnterAll is true, arm every real PTY.
      const wanted = new Set();
      const ptyIds = new Set(config.agents.map((a) => a.id));
      if (m.autoEnterAll) for (const id of ptyIds) wanted.add(id);
      if (Array.isArray(m.agents)) for (const a of m.agents) if (ptyIds.has(a.id)) wanted.add(a.id);
      // Heuristic mapping: when the arena toggles a specialist that has no real
      // PTY, default to arming ALL ptys so the operator's intent ("stop nagging
      // me for permission") is honoured. The user can scope it down later by
      // disabling autoEnterAll.
      const arenaCount = Array.isArray(m.agents) ? m.agents.length : 0;
      if (arenaCount > 0 && wanted.size === 0) for (const id of ptyIds) wanted.add(id);
      autoEnter.clear();
      for (const id of wanted) autoEnter.add(id);
      ws.send(JSON.stringify({ t: "auto-config-ack", autoEnter: Array.from(autoEnter) }));
      console.log(`[team-gui] auto-enter armed for: ${[...autoEnter].join(", ") || "(none)"}`);
    } else if (m.t === "press" && agents.has(m.id)) {
      // Manual "press enter for me" command from the arena.
      try { agents.get(m.id).term.write("\r"); } catch {}
    }
  });
  ws.on("close", () => arenaClients.delete(ws));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n[team-gui] open http://localhost:${PORT}`);
  console.log(`[team-gui] console:  http://localhost:${PORT}/`);
  console.log(`[team-gui] arena:    http://localhost:${PORT}/arena`);
  console.log(`[team-gui] agents run in: ${REPO_DIR}`);
  if (AUTOSTART) for (const def of config.agents) startAgent(def);
  else console.log("[team-gui] AUTOSTART=0 — click 'restart' in the UI to launch each agent");
});
