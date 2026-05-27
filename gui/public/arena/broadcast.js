// AgentForge no longer ships a mock broadcast simulator. All swarm activity
// must come from a real source — either Atlas's LLM stream or a real PTY a
// specialist is running. This file is kept as a thin marker so existing
// imports don't break during the cutover; it intentionally does nothing.

export function createBroadcaster() {
  return {
    fire(_msg) {
      // Intentionally empty — no mock activity. The UI will show a clear
      // "set ANTHROPIC_API_KEY to brief Atlas" notice when the LLM is off.
    },
  };
}
