// Atlas Prime's spawn engine.
//
// Phase 1 — Atlas analyses the repo signals it sees in /agents and /state.
// Phase 2 — applies SPAWN_RULES to decide which specialists to instantiate.
// Phase 3 — emits a chronological spawn timeline the UI binds to.
//
// The engine is fully deterministic for a given input. Atlas may spawn extra
// agents via spawnAgent(id) at runtime; the registry is not closed.

import { SEED_AGENTS, BRIEFINGS, SEED_LINES, SPAWN_RULES, LEAD_ID } from "./data.js";

const NOW = () => Date.now();

export function createSpawnEngine({ store, signals }) {
  /** @type {Map<string, any>} */
  const registry = new Map(SEED_AGENTS.map((a) => [a.id, makeAgent(a, false)]));
  /** @type {Array<{ts:number, kind:string, agentId?:string, label:string, rule?:string}>} */
  const timeline = [];

  function makeAgent(spec, justSpawned) {
    return {
      ...spec,
      status: justSpawned ? "thinking" : "idle",
      animationState: justSpawned ? "thinking" : "idle",
      briefing: BRIEFINGS[spec.id] || "Briefing pending from Atlas.",
      currentTask: justSpawned ? "Awaiting initial briefing." : "Standing by.",
      lastAction: "—",
      evolutionLevel: 1,
      spawnedAt: justSpawned ? NOW() : NOW() - 1000,
      terminalLines: [...(SEED_LINES[spec.id] || [`${spec.id} ▸ online`])],
      autoEnter: false,
      autoEnterCount: 0,
      health: { fps: 60, errors: 0, lastBeat: NOW() },
    };
  }

  function emit(kind, label, agentId, rule) {
    timeline.unshift({ ts: NOW(), kind, label, agentId, rule });
    if (timeline.length > 200) timeline.length = 200;
    if (store) store.set("timeline", [...timeline]);
  }

  /** Initial bootstrap — Atlas pages itself in, then runs the rules. */
  function bootstrap() {
    emit("boot", "ATLAS PRIME initialised", LEAD_ID);
    emit("scan", "Scanning repository signals…");

    const fired = new Set();
    for (const rule of SPAWN_RULES) {
      const hit = rule.triggers.some((t) => signals.includes(t.toLowerCase()));
      if (!hit) continue;
      emit("rule", `Rule '${rule.label}' matched`, undefined, rule.id);
      for (const id of rule.agents) {
        if (fired.has(id)) continue;
        fired.add(id);
        const a = registry.get(id);
        if (!a) continue;
        a.spawnedAt = NOW();
        a.animationState = "thinking";
        a.status = "thinking";
        emit("spawn", `Spawned ${a.name} — ${a.title}`, id, rule.id);
      }
    }

    // Always spawn the rest of the seed roster so the demo is full at boot.
    for (const a of registry.values()) {
      if (a.id === LEAD_ID) continue;
      if (fired.has(a.id)) continue;
      a.spawnedAt = NOW();
      emit("spawn", `Spawned ${a.name} — on standby`, a.id);
    }

    publish();
  }

  function publish() {
    store.set("agents", Array.from(registry.values()));
  }

  function publishAgent(id) {
    publish();
  }

  function get(id) { return registry.get(id); }

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
  }

  function setAnimationState(id, state) {
    const a = registry.get(id); if (!a) return;
    a.animationState = state;
    a.status = state;
    publish();
  }

  function evolve(id) {
    const a = registry.get(id); if (!a) return;
    if (a.evolutionLevel >= 5) return;
    a.evolutionLevel++;
    emit("evolve", `${a.name} mascot evolved to level ${a.evolutionLevel}`, id);
    publish();
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

  /** Spawn an additional agent beyond the seed roster. */
  function spawnAgent(spec, reason = "manual") {
    if (registry.has(spec.id)) return get(spec.id);
    const agent = makeAgent({ ...spec, seed: false, spawnedBy: LEAD_ID }, true);
    registry.set(spec.id, agent);
    emit("spawn", `Atlas spawned ${agent.name} — ${reason}`, agent.id);
    publish();
    return agent;
  }

  return {
    bootstrap, publish, publishAgent,
    get, update, appendLine, setAnimationState,
    evolve, toggleAutoEnter, spawnAgent,
    registry, timeline,
  };
}

/** Heuristically derive signal tokens from /state and /agents responses. */
export function deriveSignals({ guiAgents, teamState }) {
  const tokens = new Set();
  const push = (s) => tokens.add(String(s).toLowerCase());

  if (Array.isArray(guiAgents)) for (const a of guiAgents) push(a.id);
  if (teamState && Array.isArray(teamState.roles)) for (const r of teamState.roles) push(r.id);
  if (teamState && Array.isArray(teamState.tasks)) {
    for (const t of teamState.tasks) {
      push(t.owner); push(t.state); for (const w of (t.task || "").split(/\W+/)) if (w) push(w);
    }
  }
  // Project-shape hints — these are constants that always exist in this repo
  // so the rule engine always lights up sensible specialists.
  ["gui/", "tests/", "docs/", "README", ".github/", "Makefile", "log/", "events"].forEach(push);
  return Array.from(tokens);
}
