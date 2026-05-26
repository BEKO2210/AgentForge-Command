// UI rendering for the Agent Arena. Tiny vanilla view layer — listens to the
// store and re-renders only the section that changed.

import { renderMascot } from "./mascots.js";
import { STATUS_LABELS } from "./state.js";
import { LEAD_ID } from "./data.js";

const $ = (sel, root = document) => root.querySelector(sel);

/* ----- Hero / stats ----- */

export function renderHero(root, { agents, timeline }) {
  const total = agents.length;
  const active = agents.filter((a) => a.animationState === "working" || a.animationState === "thinking").length;
  const warning = agents.filter((a) => a.animationState === "warning").length;
  const completed = timeline.filter((t) => t.kind === "spawn").length;
  const risk = avg(agents.map((a) => a.risk));
  const quality = avg(agents.map((a) => a.qualityScore));

  root.innerHTML = `
    <div class="hero-stats" role="region" aria-label="Mission stats">
      ${stat("ACTIVE",   `${active}`,   `${agents.length - active} on standby`, "delta")}
      ${stat("SPAWNED",  `${total}`,    `${completed} spawn events`,            "delta")}
      ${stat("WARNINGS", `${warning}`,  warning ? "needs attention" : "all clear", warning ? "delta bad" : "delta")}
      ${stat("RISK",     `${pct(risk)}%`, "rolled-up", risk > 0.25 ? "delta warn" : "delta")}
      ${stat("QUALITY",  `${pct(quality)}%`, "swarm avg", quality > 0.85 ? "delta" : "delta warn")}
    </div>
  `;

  function stat(label, value, deltaText, deltaClass) {
    return `<div class="hero-stat">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div class="${deltaClass}">${deltaText}</div>
    </div>`;
  }
}

/* ----- Lead panel (Atlas Prime) ----- */

export function renderLead(root, lead, swarmSize) {
  if (!lead) return;
  root.innerHTML = `
    <div class="lead-panel">
      <div class="lead-mascot-wrap" style="color:${lead.color}">
        ${renderMascot({ mascot: lead.mascot, level: lead.evolutionLevel, color: lead.color, state: lead.animationState, large: true })}
      </div>
      <div>
        <h2>${lead.name} <small>${lead.title}</small></h2>
        <p class="lead-briefing">${lead.briefing}</p>
        <div class="lead-row">
          <span class="pill"><span class="dot good"></span>${swarmSize} agents online</span>
          <span class="pill"><span class="dot"></span>${STATUS_LABELS[lead.animationState] || lead.animationState}</span>
          <span class="pill"><span class="dot warn"></span>Risk ${pct(lead.risk)}%</span>
          <span class="pill"><span class="dot good"></span>Quality ${pct(lead.qualityScore)}%</span>
          <span class="pill"><span class="dot"></span>Mascot Lv. ${lead.evolutionLevel}</span>
        </div>
      </div>
    </div>
  `;
}

/* ----- Grid of agent terminal cards ----- */

export function renderGrid(root, agents, { filter = "all", onSelect, onAuto, onEvolve }) {
  const visible = agents.filter((a) => {
    if (a.id === LEAD_ID) return false;
    if (filter === "all") return true;
    if (filter === "active") return a.animationState === "working" || a.animationState === "thinking";
    if (filter === "warning") return a.animationState === "warning";
    if (filter === "completed") return a.animationState === "success";
    return true;
  });

  // Diff-style render: rebuild grid only when set of ids changes.
  const wantIds = visible.map((a) => a.id).join("|");
  if (root.dataset.ids !== wantIds) {
    root.dataset.ids = wantIds;
    root.innerHTML = visible.map(cardHTML).join("");
    wireGrid(root, { onSelect, onAuto, onEvolve });
  } else {
    // Otherwise update each card in place.
    for (const a of visible) updateCard(root, a);
  }
}

function cardHTML(a) {
  return `
    <article class="tcard ${a.animationState === "warning" ? "warning" : ""} ${a.animationState === "success" ? "success" : ""}"
             style="--accent:${a.color}"
             data-id="${a.id}" tabindex="0"
             aria-label="${a.name} — ${a.title}">
      <header>
        <div class="mascot-slot" style="color:${a.color}">
          ${renderMascot({ mascot: a.mascot, level: a.evolutionLevel, color: a.color, state: a.animationState })}
        </div>
        <div class="meta">
          <h3 class="name">${a.name}</h3>
          <div class="role">${a.role} · ${a.title}</div>
        </div>
        <span class="status-badge" data-status>${STATUS_LABELS[a.animationState] || a.animationState}</span>
      </header>
      <div class="terminal" data-term aria-live="polite">
        ${a.terminalLines.slice(-3).map((l) => `<div class="term-line"><span class="term-prompt">▸</span> ${escapeHTML(l)}</div>`).join("")}
      </div>
      <footer>
        <span class="mini-stat" title="Confidence"><b>CONF</b>
          <span class="bar"><span class="fill" style="width:${pct(a.confidence)}%"></span></span>
        </span>
        <span class="mini-stat risk" title="Risk"><b>RISK</b>
          <span class="bar"><span class="fill" style="width:${pct(a.risk)}%"></span></span>
        </span>
        <span class="mini-stat evo" title="Mascot evolution level"><b>EVO</b>
          <span class="bar"><span class="fill" style="width:${(a.evolutionLevel/5)*100}%"></span></span>
        </span>
        <span class="spacer"></span>
        <button class="auto-toggle ${a.autoEnter ? "on" : ""}"
                data-action="auto"
                aria-pressed="${a.autoEnter}"
                title="Auto-enter on permission prompts">⏎ auto</button>
        <button class="auto-toggle" data-action="evolve" title="Evolve mascot (level ${a.evolutionLevel}/5)">★ evolve</button>
      </footer>
    </article>
  `;
}

function updateCard(root, a) {
  const el = root.querySelector(`.tcard[data-id="${a.id}"]`);
  if (!el) return;
  el.classList.toggle("warning", a.animationState === "warning");
  el.classList.toggle("success", a.animationState === "success");
  const badge = el.querySelector("[data-status]");
  if (badge) badge.textContent = STATUS_LABELS[a.animationState] || a.animationState;
  const term = el.querySelector("[data-term]");
  if (term) {
    const want = a.terminalLines.slice(-3).map((l) => l).join("");
    if (term.dataset.want !== want) {
      term.dataset.want = want;
      term.innerHTML = a.terminalLines.slice(-3).map((l, i, arr) =>
        `<div class="term-line ${i === arr.length - 1 ? "fresh" : ""}"><span class="term-prompt">▸</span> ${escapeHTML(l)}</div>`).join("");
    }
  }
  const auto = el.querySelector('[data-action="auto"]');
  if (auto) { auto.classList.toggle("on", a.autoEnter); auto.setAttribute("aria-pressed", String(a.autoEnter)); }
  const mascotSlot = el.querySelector(".mascot-slot");
  if (mascotSlot) {
    const svg = mascotSlot.querySelector("svg");
    const newLvl = `lvl-${a.evolutionLevel}`;
    if (!svg || !svg.classList.contains(newLvl) || !svg.classList.contains(`state-${a.animationState}`)) {
      mascotSlot.innerHTML = renderMascot({ mascot: a.mascot, level: a.evolutionLevel, color: a.color, state: a.animationState });
    }
  }
  const fills = el.querySelectorAll(".mini-stat .fill");
  if (fills.length >= 3) {
    fills[0].style.width = `${pct(a.confidence)}%`;
    fills[1].style.width = `${pct(a.risk)}%`;
    fills[2].style.width = `${(a.evolutionLevel/5)*100}%`;
  }
}

function wireGrid(root, { onSelect, onAuto, onEvolve }) {
  root.addEventListener("click", (e) => {
    const card = e.target.closest(".tcard"); if (!card) return;
    const id = card.dataset.id;
    const btn = e.target.closest("button[data-action]");
    if (btn) {
      e.stopPropagation();
      if (btn.dataset.action === "auto") onAuto && onAuto(id);
      else if (btn.dataset.action === "evolve") onEvolve && onEvolve(id);
      return;
    }
    onSelect && onSelect(id);
  });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".tcard"); if (!card) return;
    e.preventDefault();
    onSelect && onSelect(card.dataset.id);
  });
}

/* ----- Spawn timeline ----- */

export function renderTimeline(root, timeline) {
  root.innerHTML = `
    <div class="timeline">
      <h3>Spawn Timeline · ${timeline.length} events</h3>
      <ul>
        ${timeline.slice(0, 40).map((ev) => `
          <li class="kind-${ev.kind}">
            <span class="ts">${formatTime(ev.ts)}</span>
            <span class="kind">${ev.kind.toUpperCase()}</span>
            <span class="msg">${escapeHTML(ev.label)}</span>
          </li>`).join("")}
      </ul>
    </div>`;
}

/* ----- Detail drawer ----- */

export function renderDrawer(backdropEl, drawerEl, agent, handlers) {
  if (!agent) {
    backdropEl.classList.remove("open");
    drawerEl.classList.remove("open");
    return;
  }
  drawerEl.innerHTML = `
    <header style="color:${agent.color}">
      <div class="mascot-large">
        ${renderMascot({ mascot: agent.mascot, level: agent.evolutionLevel, color: agent.color, state: agent.animationState, large: true })}
      </div>
      <div>
        <h2>${agent.name}</h2>
        <div class="sub">${agent.role} · ${agent.title}</div>
      </div>
      <button class="close" data-action="close" aria-label="Close detail">ESC</button>
    </header>
    <div class="body">
      <section>
        <h3>Super Skill</h3>
        <p>${escapeHTML(agent.superSkill)}</p>
      </section>
      <section>
        <h3>Current Briefing</h3>
        <p>${escapeHTML(agent.briefing)}</p>
      </section>
      <section>
        <h3>Stats</h3>
        <div class="stats">
          <div class="stat"><div class="label">Confidence</div><div class="value">${pct(agent.confidence)}%</div></div>
          <div class="stat"><div class="label">Risk</div><div class="value">${pct(agent.risk)}%</div></div>
          <div class="stat"><div class="label">Quality</div><div class="value">${pct(agent.qualityScore)}%</div></div>
          <div class="stat"><div class="label">Evolution</div><div class="value">${agent.evolutionLevel} / 5</div></div>
        </div>
      </section>
      <section>
        <h3>Capabilities</h3>
        <p>${agent.capabilities.map((c) => `<span class="lead-row pill" style="margin:2px 6px 2px 0;display:inline-flex">${escapeHTML(c)}</span>`).join("")}</p>
      </section>
      <section>
        <h3>Mascot · ${escapeHTML(agent.mascotSpecies)}</h3>
        <p>${escapeHTML(agent.mascotLabel)}. Idle, thinking, working, success and warning each have their own animation state.</p>
        <div class="controls">
          <button class="btn" data-action="evolve">★ Evolve mascot (Lv. ${agent.evolutionLevel} / 5)</button>
          <button class="btn ${agent.autoEnter ? "primary" : ""}" data-action="auto">⏎ Auto-enter: ${agent.autoEnter ? "ON" : "OFF"}</button>
        </div>
      </section>
      <section>
        <h3>Recent Logs</h3>
        <div class="logs">
          ${agent.terminalLines.slice(-12).reverse().map((l) => `<div class="line">${escapeHTML(l)}</div>`).join("")}
        </div>
      </section>
      <section>
        <h3>Lineage</h3>
        <p>${agent.spawnedBy ? `Spawned by <b>${escapeHTML(agent.spawnedBy)}</b>` : `Lead orchestrator`} · seeded <b>${agent.seed ? "yes" : "no"}</b> · joined ${new Date(agent.spawnedAt).toLocaleTimeString()}.</p>
      </section>
    </div>
  `;
  backdropEl.classList.add("open");
  drawerEl.classList.add("open");
  drawerEl.onclick = (e) => {
    const btn = e.target.closest("button[data-action]"); if (!btn) return;
    if (btn.dataset.action === "close") handlers.close();
    else if (btn.dataset.action === "evolve") handlers.evolve(agent.id);
    else if (btn.dataset.action === "auto") handlers.toggleAuto(agent.id);
  };
}

/* ----- Util ----- */

const pct = (v) => Math.round((Number(v) || 0) * 100);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const formatTime = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
