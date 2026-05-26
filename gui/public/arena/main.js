// Agent Arena — entry point.
// Wires the store, spawn engine, broadcaster and UI together. Also talks to
// the existing server (/agents and /state) so Atlas can read repo signals,
// and to the new /arena WebSocket protocol for auto-enter toggles.

import { createStore } from "./state.js";
import { createSpawnEngine, deriveSignals } from "./spawner.js";
import { createBroadcaster } from "./broadcast.js";
import { renderHero, renderLead, renderGrid, renderTimeline, renderDrawer } from "./ui.js";
import { LEAD_ID } from "./data.js";

const store = createStore({ agents: [], timeline: [], filter: "all", selectedId: null });

/** Fetch repo signals (best-effort) so Atlas's spawn decisions reflect reality. */
async function loadSignals() {
  let guiAgents = [];
  let teamState = null;
  try { const r = await fetch("/agents"); if (r.ok) { const j = await r.json(); guiAgents = j.agents || []; } } catch {}
  try { const r = await fetch("/state");   if (r.ok) teamState = await r.json(); } catch {}
  return deriveSignals({ guiAgents, teamState });
}

const heroRoot = document.getElementById("hero-stats");
const leadRoot = document.getElementById("lead-panel");
const gridRoot = document.getElementById("agent-grid");
const timelineRoot = document.getElementById("timeline");
const drawerBackdrop = document.getElementById("drawer-backdrop");
const drawerEl = document.getElementById("drawer");
const broadcastInput = document.getElementById("broadcast-input");
const filterBar = document.getElementById("filter-bar");
const autoAllBtn = document.getElementById("auto-all");
const evolveAllBtn = document.getElementById("evolve-all");
const resetBtn = document.getElementById("reset");

const signals = await loadSignals();
const engine = createSpawnEngine({ store, signals });
const broadcaster = createBroadcaster({
  engine,
  onEvent: () => render(),
});

engine.bootstrap();
maybeOpenWS();

/* ----- Render orchestrator ----- */

function render() {
  const agents = store.get("agents") || [];
  const timeline = store.get("timeline") || [];
  const lead = agents.find((a) => a.id === LEAD_ID);
  renderHero(heroRoot, { agents, timeline });
  renderLead(leadRoot, lead, agents.length - (lead ? 1 : 0));
  renderGrid(gridRoot, agents, {
    filter: store.get("filter"),
    onSelect: openDrawer,
    onAuto: toggleAuto,
    onEvolve: (id) => { engine.evolve(id); render(); },
  });
  renderTimeline(timelineRoot, timeline);

  const selId = store.get("selectedId");
  const sel = selId && agents.find((a) => a.id === selId);
  if (sel) renderDrawer(drawerBackdrop, drawerEl, sel, drawerHandlers);
  else renderDrawer(drawerBackdrop, drawerEl, null, drawerHandlers);
}

store.subscribe("agents", render);
store.subscribe("timeline", render);
store.subscribe("filter", render);
store.subscribe("selectedId", render);

/* ----- Drawer + interactions ----- */

const drawerHandlers = {
  close: () => store.set("selectedId", null),
  evolve: (id) => { engine.evolve(id); },
  toggleAuto: (id) => toggleAuto(id),
};

function openDrawer(id) { store.set("selectedId", id); }
function closeDrawer() { store.set("selectedId", null); }

drawerBackdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
  if (e.key === "/") { broadcastInput.focus(); e.preventDefault(); }
});

/* ----- Broadcast bar ----- */

broadcastInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && broadcastInput.value.trim()) {
    const msg = broadcastInput.value.trim();
    broadcaster.fire(msg);
    broadcastInput.value = "";
  }
});

/* ----- Filter bar ----- */

filterBar.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-filter]"); if (!btn) return;
  filterBar.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
  store.set("filter", btn.dataset.filter);
});

/* ----- Bulk controls ----- */

autoAllBtn.addEventListener("click", () => {
  const agents = store.get("agents");
  const anyOff = agents.some((a) => !a.autoEnter && a.id !== LEAD_ID);
  for (const a of agents) {
    if (a.id === LEAD_ID) continue;
    if (a.autoEnter !== anyOff) engine.toggleAutoEnter(a.id);
  }
  syncAutoEnterServer();
});

evolveAllBtn.addEventListener("click", () => {
  const agents = store.get("agents");
  for (const a of agents) engine.evolve(a.id);
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset arena? This re-runs Atlas's spawn pass.")) return;
  location.reload();
});

/* ----- Auto-enter (optional server bridge) -----
 * If the server speaks the /arena WS protocol, send the toggle so it can
 * auto-press Enter on permission prompts in the matching PTYs. Local-only
 * fallback if the server doesn't implement it. */

let arenaSocket = null;
function maybeOpenWS() {
  try {
    arenaSocket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/arena`);
    arenaSocket.addEventListener("open", () => syncAutoEnterServer());
    arenaSocket.addEventListener("close", () => { arenaSocket = null; });
    arenaSocket.addEventListener("error", () => { arenaSocket = null; });
    arenaSocket.addEventListener("message", (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.t === "auto-fired") {
          engine.appendLine(m.id || LEAD_ID, `[server] auto-enter ${m.reason || "fired"} → ${m.target || ""}`);
        }
      } catch {}
    });
  } catch { arenaSocket = null; }
}
function syncAutoEnterServer() {
  if (!arenaSocket || arenaSocket.readyState !== 1) return;
  const auto = store.get("agents")
    .filter((a) => a.autoEnter)
    .map((a) => ({ id: a.id, name: a.name }));
  try { arenaSocket.send(JSON.stringify({ t: "auto-config", agents: auto })); } catch {}
}

function toggleAuto(id) {
  engine.toggleAutoEnter(id);
  syncAutoEnterServer();
}

render();
