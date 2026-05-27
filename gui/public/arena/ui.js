// UI renderers for the AgentForge Arena.
// Tiny vanilla view layer that diff-renders only what changed. The functions
// here are pure(ish): they take agents/state and write into DOM containers
// the entry script owns.

import { renderMascot, MASCOT_IDS } from "./mascots.js";
import { STATUS_LABELS } from "./state.js";
import { LEAD_ID } from "./data.js";

const escapeHTML = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

const pct = (v) => Math.round((Number(v) || 0) * 100);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const fmtTime = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const pad = (n) => String(n).padStart(2, "0");

/* ----- Hero stats ------------------------------------------------------- */

export function renderHeroStats(root, { agents, timeline, conn }) {
  const total = agents.length;
  const running = agents.filter((a) => a.ptyRunning).length;
  const warning = agents.filter((a) => a.animationState === "warning").length;
  const llm = conn && conn.llmEnabled ? "live" : "off";
  const reportEvts = timeline.filter((t) => t.kind === "report").length;
  const risk = avg(agents.map((a) => a.risk));
  const quality = avg(agents.map((a) => a.qualityScore));
  root.innerHTML = `
    <div class="hero-stats" role="group" aria-label="Mission stats">
      ${stat("LIVE PTYS",  `${running}`,  `${Math.max(0, total - running)} dormant`, running > 0 ? "delta" : "delta warn")}
      ${stat("REPORTS",    `${reportEvts}`, "to Atlas", "delta")}
      ${stat("ATLAS",      llm.toUpperCase(), conn && conn.llmModel ? conn.llmModel : "configure key", conn && conn.llmEnabled ? "delta" : "delta warn")}
      ${stat("WARNINGS",   `${warning}`,  warning ? "needs attention" : "all clear", warning ? "delta bad" : "delta")}
      ${stat("QUALITY",    `${pct(quality)}%`, `risk ${pct(risk)}%`, quality > 0.85 ? "delta" : "delta warn")}
    </div>
  `;
  function stat(label, value, deltaText, deltaClass) {
    return `<div class="hero-stat" role="status" aria-label="${label}: ${value}">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div class="${deltaClass}">${deltaText}</div>
    </div>`;
  }
}

/* ----- Atlas command panel --------------------------------------------- */

export function renderLeadPanel(root, lead, swarmSize, timeline, conn) {
  if (!lead) { root.innerHTML = ""; return; }
  // Mission stream — last 7 meaningful events (skip "scan" noise). Reports
  // from specialists are the most important entries; they're tagged so they
  // visually stand apart from boot/evolve/auto events.
  const stream = timeline
    .filter((t) => t.kind !== "scan")
    .slice(0, 7)
    .map((ev, i) =>
      `<div class="line ${i === 0 ? "recent" : ""} kind-${ev.kind}">
         <span class="ts">${fmtTime(ev.ts)}</span>
         <span class="badge">${ev.kind.toUpperCase()}</span>
         <span class="msg">${escapeHTML(ev.label)}</span>
       </div>`).join("");
  const recentAtlas = (lead.terminalLines || []).slice(-5);
  const llmEnabled = !!(conn && conn.llmEnabled);
  root.innerHTML = `
    <div class="lead-panel" aria-label="Atlas Prime command panel">
      <div class="lead-head">
        <div class="lead-mascot-wrap" style="color:${lead.color}" aria-hidden="true">
          ${renderMascot({ mascot: lead.mascot, level: lead.evolutionLevel, color: lead.color, state: lead.animationState, size: "lg" })}
        </div>
        <div class="lead-meta">
          <h2>${lead.name} <small>${escapeHTML(lead.title)}</small></h2>
          <p class="lead-briefing">${escapeHTML(lead.briefing)}</p>
          <div class="lead-row">
            <span class="pill ${llmEnabled ? "good" : "warn"}">
              <span class="dot ${llmEnabled ? "good" : "warn"}"></span>
              Atlas ${llmEnabled ? `live · ${escapeHTML(conn.llmModel || "claude")}` : "offline · no API key"}
            </span>
            <span class="pill"><span class="dot"></span>${STATUS_LABELS[lead.animationState] || lead.animationState}</span>
            <span class="pill"><span class="dot good"></span>${swarmSize} specialists</span>
            <span class="pill"><span class="dot"></span>Mascot Lv. ${lead.evolutionLevel}/5</span>
          </div>
        </div>
      </div>
      <div class="lead-transcript" aria-live="polite" aria-label="Atlas transcript">
        ${recentAtlas.length
          ? recentAtlas.map((l) => `<div class="t-line">${escapeHTML(l)}</div>`).join("")
          : `<div class="t-line empty">Atlas is standing by. Type below — or set <code>ANTHROPIC_API_KEY</code> on the server for live briefings.</div>`
        }
      </div>
      <div class="mission-stream" aria-live="polite" aria-label="Atlas mission stream">
        <h3>Mission stream — every specialist reports here</h3>
        ${stream || '<div class="line"><span class="ts">--:--:--</span> <span class="badge">IDLE</span> <span class="msg">No reports yet — launch a specialist or brief Atlas.</span></div>'}
      </div>
    </div>
  `;
}

/* ----- Terminal grid ---------------------------------------------------- */

/** Map of card-id → DOM element, used so we can update in place. */
const cardEls = new Map();
let gridOpts = {};

export function renderGrid(root, agents, opts) {
  const { filter } = opts;
  gridOpts = opts;
  // Filter: 'all' (default) excludes only Atlas; the lead panel renders the lead.
  const list = agents.filter((a) => {
    if (a.id === LEAD_ID) return false;
    if (filter === "active") return a.animationState === "working" || a.animationState === "thinking";
    if (filter === "warning") return a.animationState === "warning";
    if (filter === "completed") return a.animationState === "success";
    return true;
  });

  // Track which cards need to exist this frame; remove any that don't.
  const wanted = new Set(list.map((a) => a.id));
  for (const [id, el] of cardEls) {
    if (!wanted.has(id)) { el.remove(); cardEls.delete(id); }
  }

  // Append "+ new agent" tile only once.
  let addTile = root.querySelector('[data-action="new-agent"]');

  list.forEach((a, i) => {
    let el = cardEls.get(a.id);
    if (!el) {
      el = document.createElement("article");
      el.className = "tcard spawning";
      el.dataset.id = a.id;
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${a.name} — ${a.title}`);
      el.innerHTML = renderCardBody(a, i);
      cardEls.set(a.id, el);
      root.appendChild(el);
      // Strip the spawn class after the animation finishes so a future update
      // doesn't re-trigger it.
      setTimeout(() => el.classList.remove("spawning"), 700);
    } else {
      // Re-order if needed (rare; only when filter shuffles list)
      const want = Array.from(root.children).indexOf(el);
      if (want !== i) root.insertBefore(el, root.children[i]);
      updateCard(el, a, i);
    }
    el.style.setProperty("--accent", a.color);
  });

  if (!addTile) {
    addTile = document.createElement("button");
    addTile.className = "tcard";
    addTile.dataset.action = "new-agent";
    addTile.setAttribute("aria-label", "Spawn a new specialist");
    addTile.style.cssText = "min-height:200px;display:flex;align-items:center;justify-content:center;border-style:dashed;background:transparent;cursor:pointer;color:var(--muted);font:700 13px var(--mono);letter-spacing:.6px;";
    addTile.innerHTML = `<span style="display:flex;flex-direction:column;align-items:center;gap:8px;"><span style="font-size:28px;color:var(--accent)">+</span>Spawn new specialist</span>`;
    root.appendChild(addTile);
  } else {
    root.appendChild(addTile);
  }

  if (!root.dataset.wired) {
    root.dataset.wired = "1";
    root.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="new-agent"]')) {
        gridOpts.onNewAgent && gridOpts.onNewAgent(); return;
      }
      const card = e.target.closest(".tcard[data-id]"); if (!card) return;
      const id = card.dataset.id;
      const btn = e.target.closest("button[data-action]");
      if (btn) {
        e.stopPropagation();
        const a = btn.dataset.action;
        if (a === "auto")        gridOpts.onAuto       && gridOpts.onAuto(id);
        else if (a === "evolve") gridOpts.onEvolve     && gridOpts.onEvolve(id);
        else if (a === "launch-pty") gridOpts.onLaunchPty && gridOpts.onLaunchPty(id);
        else if (a === "stop-pty")   gridOpts.onStopPty   && gridOpts.onStopPty(id);
        return;
      }
      gridOpts.onSelect && gridOpts.onSelect(id);
    });
    root.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".tcard[data-id]"); if (!card) return;
      e.preventDefault();
      gridOpts.onSelect && gridOpts.onSelect(card.dataset.id);
    });
  }
}

function renderCardBody(a, channelIndex) {
  const isRunning = !!a.ptyRunning;
  return `
    <header>
      <div class="mascot-slot" style="color:${a.color}" aria-hidden="true">
        ${renderMascot({ mascot: a.mascot, level: a.evolutionLevel, color: a.color, state: a.animationState })}
      </div>
      <div class="meta">
        <h3 class="name">${escapeHTML(a.name)}
          <span class="channel">CH·${pad(channelIndex + 1)}</span>
        </h3>
        <div class="role">${escapeHTML(a.role)} · ${escapeHTML(a.title)}</div>
      </div>
      <span class="status-badge ${isRunning ? "live" : "dormant"}" data-status>
        ${isRunning ? "LIVE" : "DORMANT"}
      </span>
    </header>
    <div class="terminal ${isRunning ? "is-typing" : ""}" data-term aria-live="polite" aria-label="${escapeHTML(a.name)} terminal">
      ${renderTerminalLines(a)}
      <span class="activity-glow"></span>
    </div>
    <footer>
      <span class="mini-stat" title="Confidence"><b>CONF</b>
        <span class="bar"><span class="fill" style="width:${pct(a.confidence)}%"></span></span>
      </span>
      <span class="mini-stat risk" title="Risk"><b>RISK</b>
        <span class="bar"><span class="fill" style="width:${pct(a.risk)}%"></span></span>
      </span>
      <span class="mini-stat evo" title="Mascot evolution"><b>EVO</b>
        <span class="bar"><span class="fill" style="width:${(a.evolutionLevel/5)*100}%"></span></span>
      </span>
      <span class="spacer"></span>
      ${isRunning
        ? `<button class="card-btn stop" data-action="stop-pty"
                    aria-label="Stop ${escapeHTML(a.name)} session">⊗ stop</button>`
        : `<button class="card-btn launch" data-action="launch-pty"
                    aria-label="Launch ${escapeHTML(a.name)} real session">▶ launch</button>`
      }
      <button class="auto-toggle ${a.autoEnter ? "on" : ""}"
              data-action="auto"
              aria-pressed="${a.autoEnter}"
              aria-label="Toggle auto-enter for ${escapeHTML(a.name)}">⏎ auto</button>
    </footer>
  `;
}

function renderTerminalLines(a) {
  const lines = a.terminalLines.slice(-3);
  const last = lines.length - 1;
  return lines.map((l, i) =>
    `<span class="term-line ${i === last ? "fresh" : ""}">
       <span class="term-prompt">▸</span> ${escapeHTML(l)}${i === last && (a.animationState === "thinking" || a.animationState === "working") ? '<span class="term-cursor"></span>' : ''}
     </span>`).join("");
}

function updateCard(el, a, channelIndex) {
  el.classList.toggle("warning", a.animationState === "warning");
  el.classList.toggle("success", a.animationState === "success");
  el.classList.toggle("live",    !!a.ptyRunning);

  const channel = el.querySelector(".channel");
  if (channel) channel.textContent = `CH·${pad(channelIndex + 1)}`;

  const badge = el.querySelector("[data-status]");
  if (badge) {
    badge.textContent = a.ptyRunning ? "LIVE" : "DORMANT";
    badge.classList.toggle("live",    !!a.ptyRunning);
    badge.classList.toggle("dormant", !a.ptyRunning);
  }
  // Swap launch / stop button if PTY status changed.
  const launchBtn = el.querySelector('[data-action="launch-pty"]');
  const stopBtn   = el.querySelector('[data-action="stop-pty"]');
  if (a.ptyRunning && launchBtn) {
    launchBtn.outerHTML = `<button class="card-btn stop" data-action="stop-pty"
                                   aria-label="Stop ${escapeHTML(a.name)} session">⊗ stop</button>`;
  } else if (!a.ptyRunning && stopBtn) {
    stopBtn.outerHTML = `<button class="card-btn launch" data-action="launch-pty"
                                  aria-label="Launch ${escapeHTML(a.name)} real session">▶ launch</button>`;
  }

  const term = el.querySelector("[data-term]");
  if (term) {
    const want = a.terminalLines.slice(-3).join("") + "|" + a.animationState;
    if (term.dataset.want !== want) {
      term.dataset.want = want;
      // keep activity-glow node
      const glow = term.querySelector(".activity-glow");
      term.innerHTML = renderTerminalLines(a);
      if (glow) term.appendChild(glow); else {
        const g = document.createElement("span"); g.className = "activity-glow"; term.appendChild(g);
      }
      term.classList.toggle("is-typing", a.animationState === "working" || a.animationState === "thinking");
    }
  }

  const auto = el.querySelector('[data-action="auto"]');
  if (auto) {
    auto.classList.toggle("on", !!a.autoEnter);
    auto.setAttribute("aria-pressed", String(!!a.autoEnter));
  }

  // Only re-render the mascot SVG when something visible about it changes.
  const slot = el.querySelector(".mascot-slot");
  if (slot) {
    const sig = `${a.mascot}-${a.evolutionLevel}-${a.animationState}-${a.color}`;
    if (slot.dataset.sig !== sig) {
      slot.dataset.sig = sig;
      slot.style.color = a.color;
      slot.innerHTML = renderMascot({ mascot: a.mascot, level: a.evolutionLevel, color: a.color, state: a.animationState });
    }
  }

  const fills = el.querySelectorAll(".mini-stat .fill");
  if (fills.length >= 3) {
    fills[0].style.width = `${pct(a.confidence)}%`;
    fills[1].style.width = `${pct(a.risk)}%`;
    fills[2].style.width = `${(a.evolutionLevel/5)*100}%`;
  }
}

/* ----- Spawn timeline --------------------------------------------------- */

let lastNewestTs = 0;
export function renderTimeline(root, timeline) {
  const newestTs = timeline.length ? timeline[0].ts : 0;
  root.innerHTML = `
    <div class="timeline" aria-label="Spawn timeline">
      <h3>Spawn Timeline <span class="count">${timeline.length}</span></h3>
      <ul>
        ${timeline.slice(0, 60).map((ev, i) => `
          <li class="kind-${ev.kind} ${ev.ts === newestTs && newestTs !== lastNewestTs ? "is-newest" : ""}">
            <span class="ts">${fmtTime(ev.ts)}</span>
            <span class="kind">${ev.kind.toUpperCase()}</span>
            <span class="msg">${escapeHTML(ev.label)}</span>
          </li>`).join("")}
      </ul>
    </div>
  `;
  lastNewestTs = newestTs;
}

/* ----- Detail drawer ---------------------------------------------------- */

export function renderDrawer(backdrop, drawer, agent, handlers) {
  if (!agent) {
    backdrop.classList.remove("open");
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    return;
  }
  drawer.setAttribute("aria-hidden", "false");
  drawer.innerHTML = `
    <header style="color:${agent.color}">
      <div class="mascot-large" aria-hidden="true">
        ${renderMascot({ mascot: agent.mascot, level: agent.evolutionLevel, color: agent.color, state: agent.animationState, size: "lg" })}
      </div>
      <div>
        <h2>${escapeHTML(agent.name)}</h2>
        <div class="sub">${escapeHTML(agent.role)} · ${escapeHTML(agent.title)}</div>
      </div>
      <button class="close" data-action="close" aria-label="Close detail" title="Close (Esc)">ESC</button>
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
        <div class="caps">${agent.capabilities.map((c) => `<span class="cap">${escapeHTML(c)}</span>`).join("")}</div>
      </section>
      <section>
        <h3>Real Session</h3>
        <p>${agent.ptyRunning
          ? "Live PTY running. Type below to send input directly to this specialist."
          : "No live session yet. Launch starts a real <code>claude</code> PTY with this specialist's briefing pre-pasted."
        }</p>
        <div class="controls">
          ${agent.ptyRunning
            ? `<button class="btn danger" data-action="stop-pty">⊗ Stop session</button>`
            : `<button class="btn primary" data-action="launch-pty">▶ Launch real session</button>`
          }
          <button class="btn" data-action="evolve" ${agent.evolutionLevel >= 5 ? "disabled" : ""}>
            ★ Evolve (Lv. ${agent.evolutionLevel} / 5)
          </button>
          <button class="btn ${agent.autoEnter ? "primary" : ""}" data-action="auto"
                  aria-pressed="${agent.autoEnter}">
            ⏎ Auto-enter: ${agent.autoEnter ? "ON" : "OFF"}
          </button>
        </div>
      </section>
      <section class="chat">
        <h3>Direct message — ${escapeHTML(agent.name)}</h3>
        <p class="dim">${agent.ptyRunning
          ? `Goes straight to this specialist's PTY. <kbd>Enter</kbd> to send.`
          : `Launch the real session first to send direct input.`
        }</p>
        <form class="chat-form" data-id="${agent.id}">
          <input class="chat-input" type="text" autocomplete="off"
                 placeholder="${agent.ptyRunning ? `Message ${escapeHTML(agent.name)}…` : "Specialist offline"}"
                 ${agent.ptyRunning ? "" : "disabled"} />
          <button class="btn primary" type="submit" ${agent.ptyRunning ? "" : "disabled"}>Send</button>
        </form>
      </section>
      <section>
        <h3>Recent Activity</h3>
        <div class="logs" tabindex="0" aria-label="Recent log lines">
          ${agent.terminalLines.slice(-14).reverse().map((l) => `<div class="line">${escapeHTML(l)}</div>`).join("")
            || `<div class="line empty">Quiet — no activity yet.</div>`}
        </div>
      </section>
      <section>
        <h3>Mascot · ${escapeHTML(agent.mascotSpecies)}</h3>
        <p>${escapeHTML(agent.mascotLabel)} — idle, thinking, working, success and warning each have a distinct animation. Reports back to Atlas on every state change.</p>
      </section>
      <section>
        <h3>Lineage</h3>
        <p>${agent.spawnedBy ? `Reports to <b>${escapeHTML(agent.spawnedBy)}</b>` : `Sole lead orchestrator`}
           · seeded <b>${agent.seed ? "yes" : "no"}</b>
           · registered ${new Date(agent.spawnedAt).toLocaleTimeString()}.</p>
      </section>
    </div>
  `;
  backdrop.classList.add("open");
  drawer.classList.add("open");
  drawer.onclick = (e) => {
    const btn = e.target.closest("button[data-action]"); if (!btn) return;
    const a = btn.dataset.action;
    if (a === "close")        handlers.close();
    else if (a === "evolve")  handlers.evolve(agent.id);
    else if (a === "auto")    handlers.toggleAuto(agent.id);
    else if (a === "launch-pty") handlers.launchPty && handlers.launchPty(agent.id);
    else if (a === "stop-pty")   handlers.stopPty   && handlers.stopPty(agent.id);
  };
  const form = drawer.querySelector(".chat-form");
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const input = form.querySelector(".chat-input");
      const text = input && input.value.trim();
      if (!text || input.disabled) return;
      handlers.sendInput && handlers.sendInput(agent.id, text);
      input.value = "";
    };
  }
  const closeBtn = drawer.querySelector(".close");
  if (closeBtn) closeBtn.focus({ preventScroll: true });
}

/* ----- Spawn-Builder modal --------------------------------------------- */

const SWATCHES = ["#5b8cff", "#f06bd2", "#f5b94a", "#34d399", "#a78bfa", "#36d6c3", "#fde047", "#ff6b7d", "#9aa5c4", "#60a5fa", "#7ee787", "#ff9a55"];

let modalForm = {
  name: "",
  title: "",
  role: "Specialist",
  superSkill: "",
  mascot: "fox",
  color: "#5b8cff",
};

export function renderModal(backdrop, modal, opts) {
  const { open, onCancel, onCreate } = opts;
  if (!open) {
    backdrop.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    return;
  }
  modal.setAttribute("aria-hidden", "false");
  modal.innerHTML = `
    <header>
      <h3>Spawn a new specialist</h3>
      <span class="grow"></span>
      <button class="btn ghost" data-action="cancel" aria-label="Close">ESC</button>
    </header>
    <div class="body">
      <div>
        <label for="sb-name">Name</label>
        <input id="sb-name" type="text" maxlength="24" placeholder="e.g. ORACLE" value="${escapeHTML(modalForm.name)}" />
      </div>
      <div class="row">
        <div>
          <label for="sb-title">Title</label>
          <input id="sb-title" type="text" maxlength="48" placeholder="What they do in 3 words" value="${escapeHTML(modalForm.title)}" />
        </div>
        <div>
          <label for="sb-role">Role</label>
          <input id="sb-role" type="text" maxlength="24" placeholder="e.g. Research" value="${escapeHTML(modalForm.role)}" />
        </div>
      </div>
      <div>
        <label for="sb-skill">Super skill</label>
        <textarea id="sb-skill" rows="2" maxlength="180" placeholder="One sentence — the unfair advantage this agent brings.">${escapeHTML(modalForm.superSkill)}</textarea>
      </div>
      <div>
        <label>Mascot</label>
        <div class="mascot-picker" role="listbox" aria-label="Mascot choices">
          ${MASCOT_IDS.map((m) =>
            `<button type="button" data-mascot="${m}"
                     class="${m === modalForm.mascot ? "selected" : ""}"
                     aria-label="${m}"
                     style="color:${modalForm.color}">
               ${renderMascot({ mascot: m, level: 2, color: modalForm.color, state: "idle", size: "sm" })}
             </button>`).join("")}
        </div>
      </div>
      <div>
        <label>Accent colour</label>
        <div class="swatch-row" role="listbox" aria-label="Accent colour choices">
          ${SWATCHES.map((c) =>
            `<button type="button" class="swatch ${c === modalForm.color ? "selected" : ""}"
                     data-color="${c}" style="background:${c}"
                     aria-label="${c}"></button>`).join("")}
        </div>
      </div>
    </div>
    <footer>
      <button class="btn ghost" data-action="cancel">Cancel</button>
      <button class="btn primary" data-action="create">Spawn agent</button>
    </footer>
  `;
  backdrop.classList.add("open");

  // Wire form interactions
  modal.querySelector("#sb-name").addEventListener("input", (e) => { modalForm.name = e.target.value; });
  modal.querySelector("#sb-title").addEventListener("input", (e) => { modalForm.title = e.target.value; });
  modal.querySelector("#sb-role").addEventListener("input", (e) => { modalForm.role = e.target.value; });
  modal.querySelector("#sb-skill").addEventListener("input", (e) => { modalForm.superSkill = e.target.value; });

  modal.querySelectorAll(".mascot-picker button").forEach((b) => {
    b.addEventListener("click", () => {
      modalForm.mascot = b.dataset.mascot;
      modal.querySelectorAll(".mascot-picker button").forEach((bb) => bb.classList.toggle("selected", bb === b));
    });
  });
  modal.querySelectorAll(".swatch").forEach((b) => {
    b.addEventListener("click", () => {
      modalForm.color = b.dataset.color;
      modal.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("selected", s === b));
      // Recolour the mascot tiles to match selected colour.
      modal.querySelectorAll(".mascot-picker button").forEach((mb) => mb.style.color = modalForm.color);
    });
  });

  modal.querySelector('[data-action="cancel"]').addEventListener("click", () => onCancel && onCancel());
  modal.querySelector('[data-action="create"]').addEventListener("click", () => {
    if (!modalForm.name.trim()) {
      modal.querySelector("#sb-name").focus();
      return;
    }
    onCreate && onCreate({ ...modalForm, name: modalForm.name.trim().toUpperCase(), id: makeId(modalForm.name) });
    // reset for next time
    modalForm = { name: "", title: "", role: "Specialist", superSkill: "", mascot: "fox", color: "#5b8cff" };
  });
  modal.querySelector(".body button[data-action='cancel']")?.focus();
  setTimeout(() => modal.querySelector("#sb-name")?.focus(), 30);
}

function makeId(name) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent";
  return `${base}-${Math.random().toString(36).slice(2, 5)}`;
}
