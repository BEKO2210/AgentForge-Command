// Broadcast simulator. When the user fires a broadcast, Atlas dispatches the
// message to every active specialist; each one transitions through
// thinking -> working -> success/idle and emits 1-2 role-flavoured log lines.
//
// 100% local. The engine never calls out to a real LLM. The point is to give
// the operator a realistic "swarm reacted" feeling so they can demo the
// orchestration model before wiring real agents.

import { RESPONSE_BANK, LEAD_ID } from "./data.js";
import { rand } from "./state.js";

export function createBroadcaster({ engine, onEvent }) {
  let seq = 0;

  function fire(message) {
    seq++;
    const id = `bc-${seq}`;
    const ts = Date.now();
    const agents = engine.registry;
    const lead = agents.get(LEAD_ID);

    if (lead) {
      engine.appendLine(LEAD_ID, `broadcast > ${message}`);
      engine.appendLine(LEAD_ID, rand.pick(RESPONSE_BANK[LEAD_ID]));
      engine.setAnimationState(LEAD_ID, "working");
    }
    onEvent && onEvent({ id, ts, type: "broadcast", message });

    let i = 0;
    for (const a of agents.values()) {
      if (a.id === LEAD_ID) continue;
      const delay = 220 + i * 160 + rand.between(0, 200);
      setTimeout(() => react(a.id, message), delay);
      i++;
    }

    // After everyone replied, Atlas summarises.
    const total = agents.size - 1;
    setTimeout(() => {
      if (lead) {
        engine.appendLine(LEAD_ID, `ATLAS ▸ swarm summary — ${total} agents engaged.`);
        engine.setAnimationState(LEAD_ID, "success");
        setTimeout(() => engine.setAnimationState(LEAD_ID, "idle"), 1400);
      }
    }, 220 + total * 160 + 900);
  }

  function react(agentId, message) {
    const a = engine.get(agentId); if (!a) return;
    engine.appendLine(agentId, `> received broadcast: ${shorten(message, 40)}`);
    engine.setAnimationState(agentId, "thinking");
    setTimeout(() => {
      engine.setAnimationState(agentId, "working");
      const bank = RESPONSE_BANK[agentId] || [`${agentId.toUpperCase()} ▸ working…`];
      engine.appendLine(agentId, rand.pick(bank));
    }, 350 + rand.between(0, 400));
    setTimeout(() => {
      engine.setAnimationState(agentId, "success");
      const bank = RESPONSE_BANK[agentId] || [`${agentId.toUpperCase()} ▸ done.`];
      engine.appendLine(agentId, rand.pick(bank));
    }, 900 + rand.between(0, 600));
    setTimeout(() => engine.setAnimationState(agentId, "idle"), 1900 + rand.between(0, 600));
  }

  function shorten(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  return { fire };
}
