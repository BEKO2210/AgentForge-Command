// AgentForge Arena — entry point.
//
// Wires the reactive store, the spawn engine and the UI together. There is no
// mock activity left in the system: every terminal line the arena shows comes
// from either a real PTY the operator launched or Atlas's LLM stream. When
// no LLM key is configured and no PTYs are running, the cockpit stays
// honestly idle and tells the operator what to do.

import { createStore } from "./state.js";
import { createSpawnEngine } from "./spawner.js";
import {
  renderHeroStats, renderLeadPanel, renderGrid,
  renderTimeline, renderDrawer, renderModal,
} from "./ui.js";
import { LEAD_ID } from "./data.js";

const store = createStore({
  agents: [], timeline: [], filter: "all",
  selectedId: null, modalOpen: false,
  connection: { ws: false, pulse: false, ptyIds: [], llmEnabled: false, leadId: LEAD_ID },
});

/* ----- Bootstrap ------------------------------------------------------- */

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
const broadcastMeta  = document.getElementById("broadcast-meta");
const broadcastModeBtn = document.getElementById("broadcast-mode");
const filterBar      = document.getElementById("filter-bar");
const autoAllBtn     = document.getElementById("auto-all");
const evolveAllBtn   = document.getElementById("evolve-all");
const resetBtn       = document.getElementById("reset");
const newAgentBtn    = document.getElementById("new-agent");
const connDot        = document.getElementById("conn-dot");

const persisted = await loadPersisted();
store.set("connection", {
  ws: false,
  pulse: !!persisted.pulse,
  ptyIds: persisted.ptyAgents || [],
  llmEnabled: !!(persisted.llm && persisted.llm.enabled),
  llmModel: persisted.llm && persisted.llm.model,
  leadId: persisted.leadId || LEAD_ID,
});

const engine = createSpawnEngine({ store, persisted });
engine.bootstrap();
openArenaSocket();

/* Broadcast mode — toggles between "atlas" (talk to Atlas only — he dispatches
   the rest) and "swarm" (broadcast to every running specialist). */
let broadcastMode = "atlas";

/* ----- Render orchestrator -------------------------------------------- */

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
  const conn = store.get("connection") || {};

  renderHeroStats(heroRoot, { agents, timeline, conn });
  renderLeadPanel(leadRoot, lead, swarm, timeline, conn);
  renderGrid(gridRoot, agents, {
    filter: store.get("filter"),
    onSelect: openDrawer,
    onAuto: toggleAuto,
    onEvolve: (id) => { engine.evolve(id); persistSoon(); },
    onNewAgent: () => store.set("modalOpen", true),
    onLaunchPty: (id) => launchPty(id),
    onStopPty:   (id) => stopPty(id),
  });
  renderTimeline(timelineRoot, timeline);

  const sel = store.get("selectedId") && agents.find((a) => a.id === store.get("selectedId"));
  renderDrawer(drawerBackdrop, drawerEl, sel || null, {
    close:      () => store.set("selectedId", null),
    evolve:     (id) => { engine.evolve(id); persistSoon(); },
    toggleAuto: (id) => toggleAuto(id),
    launchPty:  (id) => launchPty(id),
    stopPty:    (id) => stopPty(id),
    sendInput:  (id, text) => sendDirectInput(id, text),
  });
  renderModal(modalBackdrop, modalEl, {
    open: !!store.get("modalOpen"),
    onCancel: () => store.set("modalOpen", false),
    onCreate: (spec) => {
      engine.spawnAgent(spec, "operator");
      store.set("modalOpen", false);
      persistSoon();
    },
  });

  // Update broadcast bar copy depending on mode + LLM availability.
  if (broadcastInput) {
    const hasLlm = !!(conn && conn.llmEnabled);
    if (broadcastMode === "atlas") {
      broadcastInput.placeholder = hasLlm
        ? "Talk to Atlas — he briefs the swarm…"
        : "Set ANTHROPIC_API_KEY on the server to brief Atlas. Press / to focus this bar.";
      broadcastInput.disabled = !hasLlm;
    } else {
      broadcastInput.placeholder = "Broadcast a raw command to every running specialist…";
      broadcastInput.disabled = false;
    }
    if (broadcastMeta) {
      broadcastMeta.textContent = broadcastMode === "atlas"
        ? (hasLlm ? `⏎ DISPATCH · ATLAS@${conn.llmModel || "claude"} · / FOCUS` : "⏎ DISABLED · NO API KEY · / FOCUS")
        : "⏎ BROADCAST TO ALL · / FOCUS";
    }
    if (broadcastModeBtn) {
      broadcastModeBtn.textContent = broadcastMode === "atlas" ? "ATLAS" : "SWARM";
      broadcastModeBtn.setAttribute("aria-label", `Broadcast target: ${broadcastMode}`);
    }
  }
}

store.subscribe("agents",     scheduleRender);
store.subscribe("timeline",   scheduleRender);
store.subscribe("filter",     scheduleRender);
store.subscribe("selectedId", scheduleRender);
store.subscribe("modalOpen",  scheduleRender);
store.subscribe("connection", () => {
  const c = store.get("connection") || {};
  if (connDot) {
    connDot.classList.toggle("on",  c.ws);
    connDot.classList.toggle("off", !c.ws);
    const txt = connDot.querySelector(".txt");
    if (txt) {
      const status = !c.ws ? "offline"
        : c.llmEnabled ? `online · atlas live${c.pulse ? " · rust" : ""}`
        : `online${c.pulse ? " · rust" : ""}`;
      txt.textContent = status;
    }
  }
  scheduleRender();
});

/* ----- Drawer + Modal -------------------------------------------------- */

function openDrawer(id) { store.set("selectedId", id); }
function closeDrawer()  { store.set("selectedId", null); }

drawerBackdrop.addEventListener("click", closeDrawer);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) store.set("modalOpen", false);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (store.get("modalOpen")) store.set("modalOpen", false);
    else if (store.get("selectedId")) closeDrawer();
  }
  if (e.key === "/" && document.activeElement !== broadcastInput) {
    if (!broadcastInput.disabled) { broadcastInput.focus(); e.preventDefault(); }
  }
  if (e.key === "n" && e.altKey) { e.preventDefault(); store.set("modalOpen", true); }
});

/* ----- Broadcast bar (Atlas chat or swarm broadcast) ------------------- */

if (broadcastInput) {
  broadcastInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const msg = broadcastInput.value.trim(); if (!msg) return;
    if (broadcastMode === "atlas") sendAtlasBrief(msg);
    else broadcastToSwarm(msg);
    broadcastInput.value = "";
  });
}
if (broadcastModeBtn) {
  broadcastModeBtn.addEventListener("click", () => {
    broadcastMode = broadcastMode === "atlas" ? "swarm" : "atlas";
    scheduleRender();
  });
}

function sendAtlasBrief(msg) {
  const conn = store.get("connection") || {};
  if (!conn.llmEnabled || !arenaSocket || arenaSocket.readyState !== 1) {
    engine.appendLine(LEAD_ID, "[arena] cannot brief — set ANTHROPIC_API_KEY on the server.");
    engine.setAnimationState(LEAD_ID, "warning");
    setTimeout(() => engine.setAnimationState(LEAD_ID, "idle"), 1800);
    return;
  }
  const roster = (store.get("agents") || []).map((a) => ({
    id: a.id, name: a.name, role: a.role, superSkill: a.superSkill,
  }));
  arenaSocket.send(JSON.stringify({ t: "atlas-brief", goal: msg, roster }));
  engine.appendLine(LEAD_ID, `operator > ${msg}`);
  engine.setAnimationState(LEAD_ID, "thinking");
}

function broadcastToSwarm(msg) {
  if (!arenaSocket || arenaSocket.readyState !== 1) return;
  // Send the same text into every running specialist's PTY as a real input.
  // Specialists that aren't running silently skip.
  const running = (store.get("connection") || {}).runningPtys || [];
  for (const a of (store.get("agents") || [])) {
    if (a.id === LEAD_ID) continue;
    if (!a.ptyRunning) continue;
    arenaSocket.send(JSON.stringify({ t: "input", id: a.id, d: msg + "\r" }));
  }
  engine.appendLine(LEAD_ID, `swarm broadcast > ${msg}`);
}

/* ----- Filter / bulk controls ----------------------------------------- */

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
  if (!confirm("Reset arena? This clears persisted evolution + auto-enter + custom agents.")) return;
  if (arenaSocket && arenaSocket.readyState === 1) {
    arenaSocket.send(JSON.stringify({ t: "persist", evolution: {}, customAgents: [], atlasMission: "" }));
  }
  location.reload();
});

newAgentBtn.addEventListener("click", () => store.set("modalOpen", true));

/* ----- PTY lifecycle controls ----------------------------------------- */

function launchPty(id, goal = "") {
  if (!arenaSocket || arenaSocket.readyState !== 1) return;
  arenaSocket.send(JSON.stringify({ t: "start-pty", id, goal }));
  engine.appendLine(id, "[arena] launching real session…");
}
function stopPty(id) {
  if (!arenaSocket || arenaSocket.readyState !== 1) return;
  arenaSocket.send(JSON.stringify({ t: "stop-pty", id }));
}
function sendDirectInput(id, text) {
  if (!arenaSocket || arenaSocket.readyState !== 1) return;
  const payload = text.endsWith("\r") ? text : text + "\r";
  arenaSocket.send(JSON.stringify({ t: "input", id, d: payload }));
  engine.appendLine(id, `> ${text}`);
}

/* ----- WebSocket bridge ----------------------------------------------- */

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
      llmEnabled: !!(m.llm && m.llm.enabled),
      llmModel: m.llm && m.llm.model,
      leadId: m.leadId || LEAD_ID,
      runningPtys: [],
    });
  } else if (m.t === "atlas-brief-start") {
    engine.appendLine(LEAD_ID, `[atlas] live briefing via ${m.model}…`);
    engine.setAnimationState(LEAD_ID, "working");
  } else if (m.t === "atlas-brief-delta") {
    const a = engine.get(LEAD_ID); if (a) {
      const last = a.terminalLines[a.terminalLines.length - 1] || "";
      a.terminalLines[a.terminalLines.length - 1] = (last + m.d).slice(0, 240);
      engine.publish();
    }
  } else if (m.t === "atlas-brief-end") {
    engine.appendLine(LEAD_ID, `[atlas] done · ${m.usage?.input_tokens || 0}→${m.usage?.output_tokens || 0} tokens · $${(m.cost || 0).toFixed(4)}`);
    engine.setAnimationState(LEAD_ID, "success");
    setTimeout(() => engine.setAnimationState(LEAD_ID, "idle"), 1600);
  } else if (m.t === "atlas-brief-error") {
    engine.appendLine(LEAD_ID, `[atlas] ${m.reason || "live brief failed"}`);
    engine.setAnimationState(LEAD_ID, "warning");
    setTimeout(() => engine.setAnimationState(LEAD_ID, "idle"), 1600);
  } else if (m.t === "auto-config-ack") {
    /* server confirmed */
  } else if (m.t === "auto-fired") {
    engine.appendLine(LEAD_ID, `[server] auto-enter → ${m.target} · ${m.reason || "prompt"}`);
  } else if (m.t === "pulse") {
    if (m.kind && m.id) engine.appendLine(LEAD_ID, `[forge-pulse] ${m.id}: ${m.kind} ${m.reason || ""}`);
  } else if (m.t === "started") {
    engine.setPtyRunning(m.id, true);
  } else if (m.t === "exit") {
    engine.appendLine(m.id, `[process exited code=${m.code ?? "?"}]`);
    engine.setPtyRunning(m.id, false);
  } else if (m.t === "o" && m.id) {
    // Real PTY bytes. Strip ANSI and condense each chunk to one line.
    const clean = String(m.d || "")
      .replace(/\x1b\[[\d;?]*[a-zA-Z]/g, "")   // ANSI CSI
      .replace(/\x1b\][^\x07]*\x07/g, "")      // OSC
      .replace(/[\x00-\x1f]+/g, " ")
      .trim();
    if (clean) engine.appendLine(m.id, clean.slice(0, 160));
    engine.setAnimationState(m.id, "working");
  } else if (m.t === "error") {
    engine.appendLine(LEAD_ID, `[server] ${m.reason || "error"}`);
  }
}

function syncAutoEnterServer() {
  if (!arenaSocket || arenaSocket.readyState !== 1) return;
  const armed = (store.get("agents") || [])
    .filter((a) => a.autoEnter)
    .map((a) => ({ id: a.id, name: a.name }));
  try {
    arenaSocket.send(JSON.stringify({ t: "auto-config", agents: armed }));
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
