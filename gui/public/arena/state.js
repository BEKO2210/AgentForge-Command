// Reactive store for the Agent Arena. Plain JS — no framework.
// Subscribers receive (key, value, prevValue). UI subscribes by topic so we
// don't redraw the world on every keystroke.

export function createStore(initial = {}) {
  const data = { ...initial };
  const subs = new Map(); // topic -> Set<fn>

  function get(key) { return data[key]; }
  function set(key, value) {
    const prev = data[key];
    if (prev === value) return;
    data[key] = value;
    const s = subs.get(key); if (s) for (const fn of s) fn(value, prev, key);
    const any = subs.get("*"); if (any) for (const fn of any) fn(value, prev, key);
  }
  function update(key, mutator) {
    set(key, mutator(data[key]));
  }
  function subscribe(key, fn) {
    if (!subs.has(key)) subs.set(key, new Set());
    subs.get(key).add(fn);
    return () => subs.get(key).delete(fn);
  }
  function snapshot() { return JSON.parse(JSON.stringify(data)); }
  return { get, set, update, subscribe, snapshot };
}

/** Activity states each agent can be in. The CSS state machine in
 *  styles.css has a `.state-<name>` rule for every entry here, so adding
 *  one here means the mascot needs a matching `.state-<name>` block.
 *
 *  The phases roughly map to a real workflow:
 *    idle         dormant, waiting for input
 *    listening    receiving a briefing from Atlas or an operator broadcast
 *    thinking     planning / analysing (before the work starts)
 *    typing       LLM stream is producing text in real time
 *    working      executing a tool / running a PTY command
 *    reading      consuming files, transcripts, logs (input-heavy)
 *    reporting    sending an @atlas report after a sub-task done
 *    success      one-shot pop when a task lands
 *    warning      gate hesitates / soft attention needed
 *    error        real failure
 *    celebrating  one-shot for mascot evolution + milestones */
export const ACTIVITY_STATES = [
  "idle", "listening", "thinking", "typing", "working",
  "reading", "reporting", "success", "warning", "error", "celebrating",
];
export const STATUS_LABELS = {
  idle:        "standby",
  listening:   "receiving",
  thinking:    "analysing",
  typing:      "streaming",
  working:     "executing",
  reading:     "scanning",
  reporting:   "reporting",
  success:     "delivered",
  warning:     "attention",
  error:       "failed",
  celebrating: "evolved",
};

/** Quick random helpers — UI mock only, never real telemetry. */
export const rand = {
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  between: (a, b) => a + Math.random() * (b - a),
  jitter: (n, j = 0.04) => Math.max(0, Math.min(1, n + (Math.random() - 0.5) * 2 * j)),
};
