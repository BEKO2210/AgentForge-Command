// AgentForge Arena — entry point.
// Wires the reactive store, spawn engine, broadcaster and UI together. Also
// talks to the existing server for repo signals and to the new /arena
// WebSocket protocol for auto-enter toggles, persistence and live PTY data.

import { createStore } from "./state.js";
import { createSpawnEngine, deriveSignals } from "./spawner.js";
import { createBroadcaster } from "./broadcast.js";
import {
  renderHeroStats, renderLeadPanel, renderGrid,
  renderTimeline, renderDrawer, renderModal,
} from "./ui.js";
import { LEAD_ID } from "./data.js";

const store = createStore({
  agents: [], timeline: [], filter: "all",
  selectedId: null, modalOpen: false,
  connection: { ws: false, pulse: false, ptyIds: [] },
});

/* ----- Bootstrap: signals + persisted state in parallel ---------------- */

async function loadBootstrap() {
  const [signals, persisted] = await Promise.all([
    loadSignals(), loadPersisted(),
  ]);
  return { signals, persisted };
}
async function loadSignals() {
  let guiAgents = []; let teamState = null;
  try { const r = await fetch("/api/agents"); if (r.ok) { const j = await r.json(); guiAgents = j.agents || []; } } catch {}
  try { const r = await fetch("/api/state");  if (r.ok) teamState = await r.json(); } catch {}
  return deriveSignals({ guiAgents, teamState });
}
async function loadPersisted() {
  try { const r = await fetch("/api/arena"); if (r.ok) return await r.json(); }
  catch {}
  return {};
}

const heroRoot      = document.getElementById("hero-stats");
const leadRoot      = document.getElementById("lead-panel");
const gridRoot      = document.getElementById("agent-grid");
const timelineRoot  = document.getElementById("timeline");
const drawerBackdrop = document.getElementById("drawer-backdrop");
const drawerEl       = document.getElementById("drawer");
const modalBackdrop  = document.getElementById("modal-backdrop");
const modalEl        = document.getElementById("modal");
const broadcastInput = document.getElementById("broadcast-input");
const filterBar      = document.getElementById("filter-bar");
const autoAllBtn     = document.getElementById("auto-all");
const evolveAllBtn   = document.getElementById("evolve-all");
const resetBtn       = document.getElementById("reset");
const newAgentBtn    = document.getElementById("new-agent");
const connDot        = document.getElementById("conn-dot");

const { signals, persisted } = await loadBootstrap();
store.set("connection", {
  ws: false, pulse: !!persisted.pulse,
  ptyIds: persisted.ptyAgents || [],
});

const engine = createSpawnEngine({ store, signals, persisted });
const broadcaster = createBroadcaster({ engine, onEvent: () => scheduleRender() });

engine.bootstrap();
openArenaSocket();

/* ----- Render orchestrator -------------------------------------------- */
// One RAF-batched render keeps things smooth; the store fires often and
// rendering five panels per change would be wasteful.

let rafPending = false;
function scheduleRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; render(); });
}

function render() {
  const agents = store.get("agents") || [];
  const timeline = store.get("timeline") || [];
  const lead = agents.find((a) => a.id === LEAD_ID);
  const swarm = agents.length - (lead ? 1 : 0);

  renderHeroStats(heroRoot, { agents, timeline });
  renderLeadPanel(leadRoot, lead, swarm, timeline);
  renderGrid(gridRoot, agents, {
    filter: store.get("filter"),
    onSelect: openDrawer,
    onAuto:    toggleAuto,
    onEvolve:  (id) => { engine.evolve(id); persistSoon(); },
    onNewAgent: () => store.set("modalOpen", true),
  });
  renderTimeline(timelineRoot, timeline);

  const sel = store.get("selectedId") && agents.find((a) => a.id === store.get("selectedId"));
  renderDrawer(drawerBackdrop, drawerEl, sel || null, {
    close:      () => store.set("selectedId", null),
    evolve:     (id) => { engine.evolve(id); persistSoon(); },
    toggleAuto: (id) => toggleAuto(id),
  });

  renderModal(modalBackdrop, modalEl, {
    open: !!store.get("modalOpen"),
    onCancel: () => store.set("modalOpen", false),
    onCreate: (spec) => {
      engine.spawnAgent(spec, "operator-defined");
      store.set("modalOpen", false);
      persistSoon();
    },
  });
}

store.subscribe("agents",     scheduleRender);
store.subscribe("timeline",   scheduleRender);
store.subscribe("filter",     scheduleRender);
store.subscribe("selectedId", scheduleRender);
store.subscribe("modalOpen",  scheduleRender);
store.subscribe("connection", () => {
  const c = store.get("connection");
  if (connDot) {
    connDot.classList.toggle("on",  c.ws);
    connDot.classList.toggle("off", !c.ws);
    const txt = connDot.querySelector(".txt");
    if (txt) txt.textContent = c.ws ? (c.pulse ? "online · rust" : "online") : "offline";
  }
});

/* ----- Drawer + Modal close handlers ---------------------------------- */

drawerBackdrop.addEventListener("click", () => store.set("selectedId", null));
modalBackdrop.addEventListener("click", (e) => {
  // close only if user clicked the backdrop, not the modal contents
  if (e.target === modalBackdrop) store.set("modalOpen", false);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (store.get("modalOpen")) store.set("modalOpen", false);
    else if (store.get("selectedId")) store.set("selectedId", null);
  }
  if (e.key === "/" && document.activeElement !== broadcastInput) {
    broadcastInput.focus(); e.preventDefault();
  }
  if (e.key === "n" && e.altKey) {
    e.preventDefault(); store.set("modalOpen", true);
  }
});

/* ----- Broadcast bar -------------------------------------------------- */

broadcastInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && broadcastInput.value.trim()) {
    const msg = broadcastInput.value.trim();
    broadcaster.fire(msg);
    broadcastInput.value = "";
  }
});

/* ----- Toolbar -------------------------------------------------------- */

filterBar.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-filter]"); if (!btn) return;
  filterBar.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", b === btn);
    b.setAttribute("aria-selected", String(b === btn));
  });
  store.set("filter", btn.dataset.filter);
});

autoAllBtn.addEventListener("click", () => {
  const agents = store.get("agents");
  const targets = agents.filter((a) => a.id !== LEAD_ID);
  const allOn = targets.length > 0 && targets.every((a) => a.autoEnter);
  for (const a of targets) {
    if (a.autoEnter !== !allOn) engine.toggleAutoEnter(a.id);
  }
  syncAutoEnterServer();
  persistSoon();
});

evolveAllBtn.addEventListener("click", () => {
  for (const a of store.get("agents")) engine.evolve(a.id);
  persistSoon();
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset arena? This clears persisted evolution + auto-enter, then re-runs Atlas's spawn pass.")) return;
  if (arenaSocket && arenaSocket.readyState === 1) {
    arenaSocket.send(JSON.stringify({ t: "persist", evolution: {}, customAgents: [], atlasMission: "" }));
  }
  location.reload();
});

newAgentBtn.addEventListener("click", () => store.set("modalOpen", true));

/* ----- Auto-enter (server bridge) ------------------------------------ */

let arenaSocket = null;
function openArenaSocket() {
  try {
    arenaSocket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/arena`);
    arenaSocket.addEventListener("open",  () => {
      store.set("connection", { ...store.get("connection"), ws: true });
      syncAutoEnterServer();
    });
    arenaSocket.addEventListener("close", () => {
      store.set("connection", { ...store.get("connection"), ws: false });
      arenaSocket = null;
      setTimeout(openArenaSocket, 1800);
    });
    arenaSocket.addEventListener("error", () => { try { arenaSocket && arenaSocket.close(); } catch {} });
    arenaSocket.addEventListener("message", (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      handleServerMessage(m);
    });
  } catch { arenaSocket = null; }
}

function handleServerMessage(m) {
  if (!m || !m.t) return;
  if (m.t === "hello") {
    store.set("connection", {
      ws: true, pulse: !!m.pulse,
      ptyIds: m.ptyAgents || [],
    });
  } else if (m.t === "auto-config-ack") {
    // server confirmed the set of armed PTYs — could surface this if needed
  } else if (m.t === "auto-fired") {
    // Drop the note onto Atlas's terminal so the operator sees what happened.
    engine.appendLine(LEAD_ID, `[server] auto-enter → ${m.target} · ${m.reason || "prompt"}`);
  } else if (m.t === "pulse") {
    // Optional Rust accelerator advisory message — drop into Atlas's stream
    if (m.kind) engine.appendLine(LEAD_ID, `[forge-pulse] ${m.kind}: ${m.reason || ""}`);
  } else if (m.t === "o" && m.id) {
    // Live PTY bytes — append a single condensed line so the arena cards
    // get a feel for real terminal activity without rendering a full TTY.
    const id = m.id;
    const a = engine.get(id);
    if (a) {
      const txt = String(m.d || "").replace(/[\x00-\x1f]+/g, " ").trim();
      if (txt) {
        engine.appendLine(id, txt.slice(0, 100));
        engine.setAnimationState(id, "working");
      }
    }
  } else if (m.t === "started") {
    const a = engine.get(m.id); if (a) engine.setAnimationState(m.id, "thinking");
  } else if (m.t === "exit") {
    const a = engine.get(m.id);
    if (a) {
      engine.appendLine(m.id, `[process exited code=${m.code ?? "?"}]`);
      engine.setAnimationState(m.id, "warning");
    }
  }
}

function syncAutoEnterServer() {
  if (!arenaSocket || arenaSocket.readyState !== 1) return;
  const armed = (store.get("agents") || [])
    .filter((a) => a.autoEnter)
    .map((a) => ({ id: a.id, name: a.name }));
  // Also send any explicit PTY ids the operator can route auto-enter to.
  const ptyIds = (store.get("connection") || {}).ptyIds || [];
  try {
    arenaSocket.send(JSON.stringify({ t: "auto-config", agents: armed, ptyIds }));
  } catch {}
}

function toggleAuto(id) {
  engine.toggleAutoEnter(id);
  syncAutoEnterServer();
  persistSoon();
}

/* ----- Persistence ---------------------------------------------------- */

let persistTimer = null;
function persistSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 350);
}
function persist() {
  if (!arenaSocket || arenaSocket.readyState !== 1) return;
  try {
    arenaSocket.send(JSON.stringify({
      t: "persist",
      evolution: engine.evolutionMap(),
      customAgents: engine.customAgentSpecs(),
      atlasMission: "",
    }));
  } catch {}
}

window.addEventListener("beforeunload", () => persist());

/* Initial paint */
render();
