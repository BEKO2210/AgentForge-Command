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

/** Helpers for evolution + activity state shared by UI + broadcast. */
export const ACTIVITY_STATES = ["idle", "thinking", "working", "success", "warning"];
export const STATUS_LABELS = {
  idle: "standby",
  thinking: "analysing",
  working: "executing",
  success: "delivered",
  warning: "attention",
};

/** Quick random helpers — UI mock only, never real telemetry. */
export const rand = {
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  between: (a, b) => a + Math.random() * (b - a),
  jitter: (n, j = 0.04) => Math.max(0, Math.min(1, n + (Math.random() - 0.5) * 2 * j)),
};
