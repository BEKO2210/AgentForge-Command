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
  spend: { totalIn: 0, totalOut: 0, totalUsd: 0, briefCount: 0, recent: [], budgetUsd: 0, overBudget: false },
  // Atlas's human-readable conversation model — kept separate from the noisy
  // technical event stream so the main stage shows his actual answer.
  atlas: { workflow: "idle", harness: false, answer: [], dispatch: [], tech: [] },
});

/* ----- Atlas view model -------------------------------------------------
 * Everything Atlas "says" (his streamed answer + final summary + the
 * operator's turns) goes into `answer`. Who he dispatched and what each
 * specialist reported goes into `dispatch`. Tool calls, hooks and raw PTY
 * lines go into `tech` — collapsed by default so they never bury the answer. */
const atlasView = store.get("atlas");
function pushAtlas() { store.set("atlas", { ...atlasView, answer: [...atlasView.answer], dispatch: [...atlasView.dispatch], tech: [...atlasView.tech] }); }
function setWorkflow(s) { if (atlasView.workflow !== s) { atlasView.workflow = s; pushAtlas(); } }
function atlasSay(line) { atlasView.answer = [...atlasView.answer.slice(-120), line]; pushAtlas(); }
function atlasStreamStart() { atlasView.answer = [...atlasView.answer.slice(-120), ""]; pushAtlas(); }
function atlasStreamAppend(d) {
  const a = atlasView.answer;
  if (!a.length) a.push("");
  a[a.length - 1] = (a[a.length - 1] + d).slice(0, 4000);
  pushAtlas();
}
function atlasTech(line) { atlasView.tech = [...atlasView.tech.slice(-200), `${nowHMS()} ${line}`]; pushAtlas(); }
function atlasDispatch(id, patch) {
  const list = atlasView.dispatch;
  const i = list.findIndex((d) => d.id === id);
  if (i >= 0) list[i] = { ...list[i], ...patch };
  else list.push({ id, status: "queued", ...patch });
  atlasView.dispatch = [...list];
  pushAtlas();
}
function atlasReset() {
  atlasView.workflow = "idle"; atlasView.answer = []; atlasView.dispatch = []; atlasView.tech = [];
  pushAtlas();
}
function nowHMS() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

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

const sbLive    = document.getElementById("sb-live");
const sbAuto    = document.getElementById("sb-auto");
const sbReports = document.getElementById("sb-reports");
const sbAtlas   = document.getElementById("sb-atlas");
const sbAtlasChip = document.getElementById("sb-atlas-chip");
const sbCli     = document.getElementById("sb-cli");
const sbCliChip = document.getElementById("sb-cli-chip");
const sbPulse   = document.getElementById("sb-pulse");
const sbPulseChip = document.getElementById("sb-pulse-chip");
const sbHarnessChip = document.getElementById("sb-harness-chip");
const helpBtn   = document.getElementById("help-btn");
const helpOverlay = document.getElementById("help-overlay");
const cmdOverlay  = document.getElementById("cmd-overlay");
const autoBanner  = document.getElementById("auto-banner");
const autoBannerCount = document.getElementById("auto-banner-count");
const autoBannerDisarm = document.getElementById("auto-banner-disarm");

const persisted = await loadPersisted();
store.set("connection", {
  ws: false,
  pulse: !!persisted.pulse,
  claudeCli: !!persisted.claudeCli,
  harness: !!persisted.harness,
  ptyIds: persisted.ptyAgents || [],
  llmEnabled: !!(persisted.llm && persisted.llm.enabled),
  llmModel: persisted.llm && persisted.llm.model,
  leadId: persisted.leadId || LEAD_ID,
});
atlasView.harness = !!persisted.harness; pushAtlas();
if (persisted.spend) store.set("spend", persisted.spend);

const engine = createSpawnEngine({ store, persisted });
engine.bootstrap();
// arenaSocket + openArenaSocket are declared further down; defer the WS open
// to a microtask so the lexical binding has been initialised by then.
queueMicrotask(() => openArenaSocket());

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
  const spend = store.get("spend") || {};

  renderHeroStats(heroRoot, { agents, timeline, conn, spend });
  renderLeadPanel(leadRoot, lead, swarm, conn, store.get("atlas"));
  renderGrid(gridRoot, agents, {
    filter: store.get("filter"),
    onSelect: openDrawer,
    onAuto: toggleAuto,
    onEvolve: (id) => { engine.evolve(id); persistSoon(); },
    onNewAgent: () => store.set("modalOpen", true),
    onLaunchPty: (id) => launchPty(id),
    onStopPty:   (id) => stopPty(id),
    spend,                       // ledger card reads this directly
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

  // Status bar
  const running = agents.filter((a) => a.ptyRunning).length;
  const armed   = agents.filter((a) => a.autoEnter).length;
  const reports = timeline.filter((t) => t.kind === "report").length;
  if (sbLive)    sbLive.textContent    = `${running}/${agents.length}`;
  if (sbAuto)    sbAuto.textContent    = armed;
  if (sbReports) sbReports.textContent = reports;
  if (sbAtlas)   sbAtlas.textContent   = conn.llmEnabled ? "live" : "off";
  if (sbAtlasChip) sbAtlasChip.classList.toggle("live", !!conn.llmEnabled);
  if (sbCli)     sbCli.textContent     = conn.claudeCli ? "found" : "missing";
  if (sbCliChip) {
    sbCliChip.classList.toggle("live", !!conn.claudeCli);
    sbCliChip.classList.toggle("warn", conn.ws && !conn.claudeCli);
    sbCliChip.title = conn.claudeCli
      ? "Claude CLI found on PATH — launches will start real sessions."
      : "Claude CLI not found on PATH — ▶ launch will fail. Install it or set TEST_CMD=bash.";
  }
  if (sbPulse)   sbPulse.textContent   = conn.pulse ? "rust" : "js";
  if (sbPulseChip) sbPulseChip.classList.toggle("on", !!conn.pulse);
  if (sbHarnessChip) sbHarnessChip.hidden = !conn.harness;
  if (autoBanner) {
    autoBanner.hidden = armed === 0;
    if (autoBannerCount) autoBannerCount.textContent = String(armed);
  }

  // Update broadcast bar copy depending on mode + LLM availability.
  if (broadcastInput) {
    const hasLlm = !!(conn && conn.llmEnabled);
    if (broadcastMode === "atlas") {
      broadcastInput.placeholder = hasLlm
        ? "Talk to Atlas — he briefs the swarm…"
        : "Talk to Atlas (direct PTY · no API key). Press / to focus this bar.";
      broadcastInput.disabled = false;
    } else {
      broadcastInput.placeholder = "Broadcast a raw command to every running specialist…";
      broadcastInput.disabled = false;
    }
    if (broadcastMeta) {
      broadcastMeta.textContent = broadcastMode === "atlas"
        ? (hasLlm ? `⏎ DISPATCH · ATLAS@${conn.llmModel || "claude"} · / FOCUS` : "⏎ DIRECT TO ATLAS PTY · / FOCUS")
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
store.subscribe("spend",      scheduleRender);
store.subscribe("atlas",      scheduleRender);
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

let cmdMode = false;
function setCmdMode(on) {
  cmdMode = !!on;
  if (cmdOverlay) cmdOverlay.hidden = !on;
}
function toggleHelp(on) {
  if (!helpOverlay) return;
  helpOverlay.hidden = on === false ? true : on === true ? false : !helpOverlay.hidden;
}

document.addEventListener("keydown", (e) => {
  // Escape closes anything that's open, in order.
  if (e.key === "Escape") {
    if (cmdMode)                         { setCmdMode(false); return; }
    if (helpOverlay && !helpOverlay.hidden) { toggleHelp(false); return; }
    if (store.get("modalOpen"))          { store.set("modalOpen", false); return; }
    if (store.get("selectedId"))         { closeDrawer(); return; }
    return;
  }

  // Command mode is a single-key follow-up. Swallow Browser-style modifier
  // keys so we don't break native shortcuts the user might still want.
  if (cmdMode) {
    if (e.metaKey || e.altKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    const agents = store.get("agents") || [];
    const specialists = agents.filter((a) => a.id !== LEAD_ID);
    e.preventDefault();
    if (/^[1-9]$/.test(k)) {
      const target = specialists[parseInt(k, 10) - 1];
      if (target) openDrawer(target.id);
    } else if (k === "a") { broadcastMode = "atlas"; scheduleRender(); }
      else if (k === "b") { broadcastMode = "swarm"; scheduleRender(); }
      else if (k === "l") { for (const s of specialists) launchPty(s.id); }
      else if (k === "s") { for (const s of specialists) if (s.ptyRunning) stopPty(s.id); }
      else if (k === "n") { store.set("modalOpen", true); }
      else if (k === "e") { for (const a of agents) engine.evolve(a.id); persistSoon(); }
      else if (k === "?") { toggleHelp(true); }
    setCmdMode(false);
    return;
  }

  // Top-level shortcuts.
  if (e.key === "/" && document.activeElement !== broadcastInput) {
    if (!broadcastInput.disabled) { broadcastInput.focus(); e.preventDefault(); }
    return;
  }
  if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault(); setCmdMode(true); return;
  }
  if (e.key === "?" && document.activeElement !== broadcastInput &&
      document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
    e.preventDefault(); toggleHelp(true); return;
  }
  if (e.key === "n" && e.altKey) {
    e.preventDefault(); store.set("modalOpen", true); return;
  }
});

if (helpBtn) helpBtn.addEventListener("click", () => toggleHelp());
if (helpOverlay) helpOverlay.addEventListener("click", (e) => {
  if (e.target === helpOverlay || e.target.closest('[data-action="help-close"]')) toggleHelp(false);
});
if (cmdOverlay) cmdOverlay.addEventListener("click", () => setCmdMode(false));
if (autoBannerDisarm) autoBannerDisarm.addEventListener("click", () => {
  for (const a of (store.get("agents") || [])) if (a.autoEnter) engine.toggleAutoEnter(a.id);
  syncAutoEnterServer(); persistSoon();
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
  if (!arenaSocket || arenaSocket.readyState !== 1) return;
  const conn = store.get("connection") || {};
  const lead = (store.get("agents") || []).find((a) => a.id === LEAD_ID);

  atlasSay(`you ▸ ${msg}`);
  setWorkflow("asked");
  engine.setAnimationState(LEAD_ID, "listening");

  // No LLM bridge AND no harness? Talk to Atlas's real claude-CLI PTY directly.
  // First message launches the PTY with the operator's text as the mission;
  // subsequent messages are typed straight into the running terminal. His real
  // output streams into the answer area as it arrives.
  if (!conn.llmEnabled && !conn.harness) {
    if (lead && lead.ptyRunning) {
      arenaSocket.send(JSON.stringify({ t: "input", id: LEAD_ID, d: msg + "\r" }));
    } else {
      arenaSocket.send(JSON.stringify({ t: "start-pty", id: LEAD_ID, goal: msg }));
      atlasTech("[arena] launching Atlas PTY with mission…");
    }
    return;
  }

  // LLM bridge OR harness — route through the dispatch pipeline.
  const roster = (store.get("agents") || []).map((a) => ({
    id: a.id, name: a.name, role: a.role, superSkill: a.superSkill,
  }));
  arenaSocket.send(JSON.stringify({ t: "atlas-brief", goal: msg, roster }));
}

function broadcastToSwarm(msg) {
  if (!arenaSocket || arenaSocket.readyState !== 1) return;
  // Send the same text into every running specialist's PTY as a real input.
  // Specialists that aren't running are honestly skipped (and reported).
  const sent = [];
  const skipped = [];
  for (const a of (store.get("agents") || [])) {
    if (a.id === LEAD_ID) continue;
    if (a.ptyRunning) { arenaSocket.send(JSON.stringify({ t: "input", id: a.id, d: msg + "\r" })); sent.push(a.id); }
    else skipped.push(a.id);
  }
  atlasSay(`you ▸ (swarm broadcast) ${msg}`);
  atlasTech(`[swarm] delivered to ${sent.length ? sent.join(", ") : "(none running)"}${skipped.length ? ` · skipped (not running): ${skipped.join(", ")}` : ""}`);
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
// Per-session capability token, injected into <meta name="afc-token"> by the
// server. The WS upgrade is rejected without it (closes the CSWSH boundary).
function afcToken() {
  const el = document.querySelector('meta[name="afc-token"]');
  return el ? el.getAttribute("content") || "" : "";
}
function openArenaSocket() {
  try {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const tok = afcToken();
    const q = tok ? `?token=${encodeURIComponent(tok)}` : "";
    arenaSocket = new WebSocket(`${proto}://${location.host}/arena${q}`);
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
      claudeCli: !!m.claudeCli,
      harness: !!m.harness,
      ptyIds: m.ptyAgents || [],
      llmEnabled: !!(m.llm && m.llm.enabled),
      llmModel: m.llm && m.llm.model,
      leadId: m.leadId || LEAD_ID,
      runningPtys: [],
    });
    atlasView.harness = !!m.harness; pushAtlas();
  } else if (m.t === "atlas-brief-start") {
    // A fresh run — clear the previous dispatch list, open a streaming answer
    // line and move the workflow into "planning".
    atlasView.dispatch = []; pushAtlas();
    setWorkflow("planning");
    atlasStreamStart();
    atlasTech(`[atlas] briefing via ${m.model || "claude"}${m.harness ? " · TEST HARNESS" : ""}`);
    engine.setAnimationState(LEAD_ID, "thinking");
    setTimeout(() => {
      const a = engine.get(LEAD_ID);
      if (a && a.animationState === "thinking") engine.setAnimationState(LEAD_ID, "typing");
    }, 350);
  } else if (m.t === "atlas-brief-delta") {
    atlasStreamAppend(m.d || "");
    const a = engine.get(LEAD_ID);
    if (a && a.animationState !== "typing") engine.setAnimationState(LEAD_ID, "typing");
  } else if (m.t === "atlas-brief-end") {
    atlasTech(`[atlas] plan done · ${m.usage?.input_tokens || 0}→${m.usage?.output_tokens || 0} tokens · $${(m.cost || 0).toFixed(4)}`);
    if (Array.isArray(m.briefings) && m.briefings.length) {
      setWorkflow("dispatching");
      for (const b of m.briefings) atlasDispatch(b.id, { task: b.task, status: "queued" });
      engine.setAnimationState(LEAD_ID, "working");
    } else {
      setWorkflow("final");
      engine.setAnimationState(LEAD_ID, "success");
      setTimeout(() => engine.setAnimationState(LEAD_ID, "idle"), 1600);
    }
  } else if (m.t === "dispatch") {
    atlasDispatch(m.id, { task: m.task, status: "dispatched", running: !!m.running });
    setWorkflow("working");
    const a = engine.get(m.id);
    if (a) {
      engine.appendLine(m.id, m.running ? `[atlas] dispatched — running` : `[atlas] dispatched — not running (launch to deliver)`);
      if (m.running) engine.setAnimationState(m.id, "working");
    }
  } else if (m.t === "dispatch-skip") {
    atlasDispatch(m.id, { status: "skipped", report: m.reason });
    atlasTech(`[atlas] could not dispatch @${m.id} — ${m.reason}`);
  } else if (m.t === "specialist-brief-start") {
    atlasDispatch(m.id, { task: m.task, status: "briefing" });
    const a = engine.get(m.id);
    if (a) { engine.appendLine(m.id, `[atlas → ${m.id}] ${m.task}`); engine.setAnimationState(m.id, "thinking"); }
  } else if (m.t === "specialist-brief-delta") {
    atlasTech(`[brief ${m.id}] ${String(m.d || "").slice(0, 120)}`);
  } else if (m.t === "specialist-brief-end") {
    atlasDispatch(m.id, { status: "dispatched" });
    const a = engine.get(m.id);
    if (a) { engine.setAnimationState(m.id, "success"); setTimeout(() => engine.setAnimationState(m.id, "working"), 1200); }
  } else if (m.t === "specialist-brief-error") {
    atlasDispatch(m.id, { status: "error", report: m.reason });
    engine.appendLine(m.id, `[brief failed] ${m.reason}`);
    engine.setAnimationState(m.id, "warning");
    setTimeout(() => engine.setAnimationState(m.id, "idle"), 1800);
  } else if (m.t === "specialist-report") {
    // A specialist reported back to Atlas — the visible answer, honestly
    // flagged running vs. not.
    atlasDispatch(m.id, { report: m.line, running: !!m.running, status: m.running ? "running" : "dispatched" });
    setWorkflow("reports");
    const a = engine.get(m.id);
    if (a) engine.appendLine(m.id, m.line);
  } else if (m.t === "atlas-final") {
    atlasSay(`ATLAS ▸ ${m.summary}`);
    setWorkflow("done");
    engine.setAnimationState(LEAD_ID, "success");
    setTimeout(() => engine.setAnimationState(LEAD_ID, "idle"), 2200);
  } else if (m.t === "spend-update") {
    store.set("spend", m.spend || {});
  } else if (m.t === "atlas-brief-error") {
    atlasSay(`ATLAS ▸ ${m.reason || "live brief failed"}`);
    setWorkflow("failed");
    const hard = /quota|rate|5\d{2}|over budget|abort/i.test(m.reason || "");
    engine.setAnimationState(LEAD_ID, hard ? "error" : "warning");
    setTimeout(() => engine.setAnimationState(LEAD_ID, "idle"), 1800);
  } else if (m.t === "auto-config-ack") {
    /* server confirmed */
  } else if (m.t === "auto-fired") {
    atlasTech(`[server] auto-enter → ${m.target} · ${m.reason || "prompt"}`);
  } else if (m.t === "pulse") {
    if (m.kind && m.id) atlasTech(`[forge-pulse] ${m.id}: ${m.kind} ${m.reason || ""}`);
  } else if (m.t === "hook") {
    // Authoritative state from a Claude Code tool hook → card state + tech log.
    const a = engine.get(m.id);
    if (a && m.state) engine.setAnimationState(m.id, m.state);
    const label = m.tool ? `${m.event} ${m.tool}` : m.event;
    const detail = m.file ? ` · ${m.file}` : "";
    atlasTech(`[hook] ${m.id}: ${label}${detail}`);
    if (a) engine.appendLine(m.id, `[hook] ${label}${detail}`);
    if (m.event === "PostToolUse" && m.ok && a) {
      setTimeout(() => {
        const cur = engine.get(m.id);
        if (cur && cur.animationState === "success") engine.setAnimationState(m.id, "idle");
      }, 1000);
    }
  } else if (m.t === "started") {
    engine.setPtyRunning(m.id, true);
    if (m.id !== LEAD_ID) atlasDispatch(m.id, { running: true });
  } else if (m.t === "exit") {
    engine.appendLine(m.id, `[process exited code=${m.code ?? "?"}]`);
    engine.setPtyRunning(m.id, false);
    if (m.id !== LEAD_ID) atlasDispatch(m.id, { running: false });
  } else if (m.t === "o" && m.id) {
    // Real PTY bytes. Strip ANSI and condense each chunk to one line.
    const clean = String(m.d || "")
      .replace(/\x1b\[[\d;?]*[a-zA-Z]/g, "")   // ANSI CSI
      .replace(/\x1b\][^\x07]*\x07/g, "")      // OSC
      .replace(/[\x00-\x1f]+/g, " ")
      .trim();
    if (clean) {
      engine.appendLine(m.id, clean.slice(0, 160));
      if (m.id === LEAD_ID) atlasStreamAppend(clean.slice(0, 160) + "\n");  // real Atlas PTY output IS his answer
      else atlasDispatch(m.id, { report: clean.slice(0, 140), running: true });
    }
    engine.setAnimationState(m.id, "working");
  } else if (m.t === "launch-error") {
    // A PTY failed to start (most often: the claude CLI isn't installed).
    // The PTY never came up, so don't fake a "pty-down" — just surface the
    // error loudly on the agent's card AND in Atlas's stream, then settle idle.
    engine.appendLine(m.id, `[launch failed] ${m.reason || "could not start session"}`);
    engine.setAnimationState(m.id, "error");
    if (m.id === LEAD_ID) { atlasSay(`ATLAS ▸ launch failed: ${m.reason || "could not start session"}`); setWorkflow("failed"); }
    else atlasDispatch(m.id, { status: "error", report: m.reason || "launch failed", running: false });
    atlasTech(`[server] launch failed for ${m.id}: ${m.reason || "could not start session"}`);
    setTimeout(() => {
      const cur = engine.get(m.id);
      if (cur && cur.animationState === "error") engine.setAnimationState(m.id, "idle");
    }, 2600);
  } else if (m.t === "error") {
    atlasTech(`[server] ${m.reason || "error"}`);
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
