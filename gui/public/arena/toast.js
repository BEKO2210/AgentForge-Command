// AgentForge — toast notifications (Run 1.8, ROADMAP 2.0 Tier 1).
//
// Two behaviours, by design:
//   • success / info  → auto-dismiss after 1.5s (brief confirmation)
//   • error           → PERSISTENT until the user dismisses it (errors must
//                       not vanish silently — that was the whole point)
// Enter/exit run on a 200ms transition. A polite live-region announces
// success/info; errors use role="alert" so assistive tech speaks them at once.

let region = null;

function ensureRegion() {
  if (region && document.body && document.body.contains(region)) return region;
  region = document.createElement("div");
  region.id = "toast-region";
  region.className = "toast-region";
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "false");
  document.body.appendChild(region);
  return region;
}

function dismiss(t) {
  if (!t || t._dismissed) return;
  t._dismissed = true;
  if (t._timer) clearTimeout(t._timer);
  t.classList.remove("show");
  t.classList.add("hide");
  // remove after the 200ms exit transition completes
  setTimeout(() => t.remove(), 220);
}

/**
 * Show a toast.
 * @param {string} message
 * @param {{type?: "success"|"error"|"info", duration?: number}} [opts]
 *   `duration` overrides the default (0 = persistent).
 * @returns {HTMLElement} the toast node
 */
export function showToast(message, opts = {}) {
  const { type = "info" } = opts;
  const r = ensureRegion();

  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  // Errors are assertive; success/info are polite (announced via the region).
  t.setAttribute("role", type === "error" ? "alert" : "status");

  const msg = document.createElement("span");
  msg.className = "toast-msg";
  msg.textContent = message;
  t.appendChild(msg);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "✕";
  close.addEventListener("click", () => dismiss(t));
  t.appendChild(close);

  r.appendChild(t);
  // next frame → trigger the enter transition
  requestAnimationFrame(() => t.classList.add("show"));

  // Errors persist (duration 0); everything else auto-dismisses at 1.5s.
  const ms = opts.duration != null ? opts.duration : (type === "error" ? 0 : 1500);
  if (ms > 0) t._timer = setTimeout(() => dismiss(t), ms);

  return t;
}

export function clearToasts() {
  if (region) region.replaceChildren();
}
