// Atlas's specialist registry and live state.
//
// The registry holds every specialist's identity (name, role, mascot, …)
// plus its current state (status, terminal lines coming from a real PTY,
// evolution level). Nothing is simulated — terminal lines arrive only when
// the operator launches the real PTY for that specialist; before that the
// card stays honestly idle.

import { SEED_AGENTS, BRIEFINGS, PRIORS, LEAD_ID } from "./data.js";

const NOW = () => Date.now();

export function createSpawnEngine({ store, persisted = {} }) {
  const savedEvolution = persisted.evolution   || {};
  const savedAutoEnter = new Set(persisted.autoEnter || []);
  const savedCustom    = Array.isArray(persisted.customAgents) ? persisted.customAgents : [];

  /** @type {Map<string, any>} */
  const registry = new Map(
    [...SEED_AGENTS, ...savedCustom].map((a) => [a.id, makeAgent(a)])
  );
  /** Chronological timeline of meaningful events — boots, spawns, evolution,
   *  auto-enter toggles, atlas briefings, specialist reports. */
  const timeline = [];

  function makeAgent(spec) {
    const priors = PRIORS[spec.id] || {};
    return {
      ...spec,
      status: "idle",
      animationState: "idle",
      briefing: spec.briefing || BRIEFINGS[spec.id] || `${spec.name || spec.id} briefing pending from Atlas.`,
      currentTask: "Standing by — launch the real session to begin.",
      lastAction: "—",
      evolutionLevel: savedEvolution[spec.id] || 1,
      spawnedAt: NOW(),
      terminalLines: [], // empty until a real PTY drives this card
      autoEnter: savedAutoEnter.has(spec.id),
      autoEnterCount: 0,
      ptyRunning: false,
      seed: spec.seed !== false,
      capabilities: spec.capabilities || ["briefing", "report"],
      mascot: spec.mascot || "fox",
      mascotSpecies: spec.mascotSpecies || spec.mascot || "Mascot",
      mascotLabel:   spec.mascotLabel   || "specialist mascot",
      lane: spec.lane || "lead",
      color: spec.color || "#5b8cff",
      accentColor: spec.accentColor || spec.color || "#5b8cff",
      risk:         spec.risk         ?? priors.risk         ?? 0.18,
      confidence:   spec.confidence   ?? priors.confidence   ?? 0.82,
      qualityScore: spec.qualityScore ?? priors.qualityScore ?? 0.86,
    };
  }

  function emit(kind, label, agentId) {
    timeline.unshift({ ts: NOW(), kind, label, agentId });
    if (timeline.length > 200) timeline.length = 200;
    if (store) store.set("timeline", [...timeline]);
  }

  function bootstrap() {
    emit("boot", "ATLAS PRIME standing by", LEAD_ID);
    emit("scan", "Awaiting operator briefing — Atlas is ready to dispatch.");
    publish();
  }

  function publish() {
    store.set("agents", Array.from(registry.values()));
  }
  function get(id)    { return registry.get(id); }
  function update(id, patch) {
    const a = registry.get(id); if (!a) return;
    Object.assign(a, patch);
    publish();
  }

  function appendLine(id, line) {
    const a = registry.get(id); if (!a) return;
    a.terminalLines = [...a.terminalLines.slice(-60), line];
    a.lastAction = line;
    publish();
    // Specialist → Atlas reporting. Every non-Atlas line is also threaded
    // into Atlas's mission stream as a compact report so Atlas always knows
    // what the swarm is doing.
    if (id !== LEAD_ID) {
      emit("report", `${a.name} ▸ ${line.slice(0, 100)}`, id);
    }
  }

  function setAnimationState(id, state) {
    const a = registry.get(id); if (!a) return;
    a.animationState = state;
    a.status = state;
    publish();
  }

  function setPtyRunning(id, running) {
    const a = registry.get(id); if (!a) return;
    a.ptyRunning = !!running;
    if (running) {
      a.animationState = "thinking";
      a.status = "thinking";
      emit("pty-up", `${a.name} live PTY started`, id);
    } else {
      a.animationState = "idle";
      a.status = "idle";
      emit("pty-down", `${a.name} PTY exited`, id);
    }
    publish();
  }

  function evolve(id) {
    const a = registry.get(id); if (!a) return;
    if (a.evolutionLevel >= 5) return;
    a.evolutionLevel++;
    emit("evolve", `${a.name} mascot evolved to level ${a.evolutionLevel}`, id);
    // Trigger the celebrating one-shot, then return to the prior state.
    const prev = a.animationState;
    a.animationState = "celebrating";
    a.status = "celebrating";
    publish();
    setTimeout(() => {
      const cur = registry.get(id); if (!cur) return;
      // Only revert if nothing else changed our state in the meantime.
      if (cur.animationState === "celebrating") {
        cur.animationState = prev === "celebrating" ? "idle" : prev;
        cur.status = cur.animationState;
        publish();
      }
    }, 1400);
  }

  function toggleAutoEnter(id) {
    const a = registry.get(id); if (!a) return;
    a.autoEnter = !a.autoEnter;
    emit(
      a.autoEnter ? "auto-on" : "auto-off",
      `${a.name} auto-enter ${a.autoEnter ? "armed" : "stood down"}`,
      id,
    );
    publish();
  }

  function spawnAgent(spec, reason = "operator") {
    if (registry.has(spec.id)) return get(spec.id);
    const agent = makeAgent({ ...spec, seed: false, spawnedBy: LEAD_ID });
    registry.set(spec.id, agent);
    emit("spawn", `Atlas registered ${agent.name} (${reason})`, agent.id);
    publish();
    return agent;
  }

  function customAgentSpecs() {
    return Array.from(registry.values())
      .filter((a) => a.seed === false)
      .map((a) => ({
        id: a.id, name: a.name, title: a.title, role: a.role, domain: a.domain || "specialist",
        superSkill: a.superSkill, mascot: a.mascot, mascotSpecies: a.mascotSpecies, mascotLabel: a.mascotLabel,
        color: a.color, accentColor: a.accentColor,
        capabilities: a.capabilities, seed: false, spawnedBy: a.spawnedBy,
        risk: a.risk, confidence: a.confidence, qualityScore: a.qualityScore,
        briefing: a.briefing, lane: a.lane || "lead",
      }));
  }

  function evolutionMap() {
    const m = {};
    for (const a of registry.values()) m[a.id] = a.evolutionLevel;
    return m;
  }

  return {
    bootstrap, publish,
    get, update, appendLine, setAnimationState, setPtyRunning,
    evolve, toggleAutoEnter, spawnAgent,
    customAgentSpecs, evolutionMap,
    registry, timeline, emit,
  };
}
