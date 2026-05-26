// One-window control panel for the 4-agent Claude Code team.
// Spawns one PTY per agent (claude, by default), bridges them to the browser over a
// WebSocket, and serves the static UI. Agents run in REPO_DIR (default: cwd) so they
// can read the .team/ files. Local only (binds 127.0.0.1).
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

function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of clients) if (c.readyState === 1) c.send(s);
}

function startAgent(def) {
  const prev = agents.get(def.id);
  if (prev && prev.term) {
    try {
      prev.term.kill();
    } catch {
      /* already gone */
    }
  }
  const term = pty.spawn(def.cmd, def.args || [], {
    name: "xterm-256color",
    // Default wide enough to fit a typical 2×2 grid card (~130 visible cols) so
    // first-screen output (Claude welcome, etc.) isn't truncated before the
    // browser's FitAddon sends an accurate resize.
    cols: 140,
    rows: 30,
    cwd: REPO_DIR,
    env: process.env,
  });
  const rec = { def, term, buf: "", alive: true };
  term.onData((d) => {
    rec.buf = (rec.buf + d).slice(-200000); // ~200KB scrollback replayed to new clients
    broadcast({ t: "o", id: def.id, d });
  });
  term.onExit(({ exitCode }) => { rec.alive = false; broadcast({ t: "exit", id: def.id, code: exitCode }); });
  agents.set(def.id, rec);
  broadcast({ t: "started", id: def.id });
  console.log(`[team-gui] started '${def.id}' (${def.cmd}) in ${REPO_DIR}`);
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
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
  const rel = url === "/" ? "/index.html" : url;
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

const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  clients.add(ws);
  // Replay scrollback AND the current liveness state so late-joining clients
  // see the correct online/offline indicators on each card.
  for (const [id, rec] of agents) {
    ws.send(JSON.stringify({ t: "o", id, d: rec.buf }));
    ws.send(JSON.stringify({ t: rec.alive ? "started" : "exit", id }));
  }
  ws.on("message", (raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const rec = agents.get(m.id);
    if (m.t === "i" && rec) rec.term.write(m.d);
    else if (m.t === "resize" && rec) {
      try {
        rec.term.resize(Math.max(2, m.cols | 0), Math.max(2, m.rows | 0));
      } catch {
        /* ignore bad sizes */
      }
    } else if (m.t === "start") {
      const def = config.agents.find((a) => a.id === m.id);
      if (def) startAgent(def);
    } else if (m.t === "stop" && rec) {
      try {
        rec.term.kill();
      } catch {
        /* ignore */
      }
    }
  });
  ws.on("close", () => clients.delete(ws));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n[team-gui] open http://localhost:${PORT}`);
  console.log(`[team-gui] agents run in: ${REPO_DIR}`);
  if (AUTOSTART) for (const def of config.agents) startAgent(def);
  else console.log("[team-gui] AUTOSTART=0 — click 'restart' in the UI to launch each agent");
});
