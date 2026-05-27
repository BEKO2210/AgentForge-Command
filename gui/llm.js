// Optional LLM bridge for AgentForge.
//
// When ANTHROPIC_API_KEY is set, the broadcast bar can route briefings through
// Claude — Atlas Prime answers in real time and dispatches per-specialist
// briefings inferred from the same call. Streaming is plain-text SSE; we
// forward `delta` events to the arena clients and track tokens + cost.
//
// Zero npm dependencies: uses fetch + the public Anthropic Messages API
// (https://api.anthropic.com/v1/messages). Falls back cleanly when no key
// is configured — the caller's `enabled` check decides whether to dispatch
// through the live path or the mock simulator.

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION  = "2023-06-01";

// Published per-1M-token prices (sonnet 4.6 / opus 4.7) — wire-format only,
// kept here as a single source of truth so the arena can show a cost meter.
// Update when Anthropic changes pricing.
const PRICING = {
  "claude-opus-4-7":    { in: 15.00, out: 75.00 },
  "claude-sonnet-4-6":  {  in: 3.00, out: 15.00 },
  "claude-haiku-4-5":   {  in: 1.00, out:  5.00 },
};

export function llmConfig() {
  return {
    enabled: !!process.env.ANTHROPIC_API_KEY,
    model:   process.env.AGENTFORGE_LLM_MODEL || "claude-sonnet-4-6",
  };
}

/**
 * Stream a briefing through Claude. Calls `onDelta(text)` for each text
 * fragment, then resolves with usage stats. Throws on network/auth errors.
 *
 * @param {object} opt
 * @param {string} opt.system           System prompt (e.g. Atlas Prime role)
 * @param {Array<{role:string, content:string}>} opt.messages  Chat turns
 * @param {(d:string)=>void} opt.onDelta            Streaming text chunks
 * @param {AbortSignal} [opt.signal]                Cancellation
 */
export async function streamBrief({ system, messages, onDelta, signal }) {
  const { enabled, model } = llmConfig();
  if (!enabled) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      stream: true,
      messages,
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`anthropic ${res.status}: ${text.slice(0, 200)}`);
  }

  let usage = { input_tokens: 0, output_tokens: 0 };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // SSE: each event is two lines `event: foo\ndata: {...}\n\n`
    let sep;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const evt = buf.slice(0, sep); buf = buf.slice(sep + 2);
      const dataLine = evt.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      const payload = dataLine.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      let j; try { j = JSON.parse(payload); } catch { continue; }
      if (j.type === "content_block_delta" && j.delta && j.delta.text) {
        onDelta(j.delta.text);
      } else if (j.type === "message_delta" && j.usage) {
        if (j.usage.output_tokens) usage.output_tokens = j.usage.output_tokens;
      } else if (j.type === "message_start" && j.message && j.message.usage) {
        usage = { ...usage, ...j.message.usage };
      }
    }
  }
  const price = PRICING[model] || { in: 0, out: 0 };
  const cost = (usage.input_tokens / 1e6) * price.in
             + (usage.output_tokens / 1e6) * price.out;
  return { model, usage, cost };
}

/** Convenience: ask Atlas to brief the swarm in one stream. */
export async function atlasBrief({ goal, roster, onDelta, signal }) {
  const rosterDesc = roster.map((s) =>
    `- ${s.name} (${s.id}) — ${s.role}: ${s.superSkill}`
  ).join("\n");
  const system = [
    "You are ATLAS PRIME, chief orchestrator of an AgentForge swarm.",
    "You assign work to specialists from this exact roster:",
    rosterDesc,
    "",
    "When given a goal, do TWO things in one response:",
    "1. A single paragraph (≤3 sentences) explaining your plan.",
    "2. A bulleted list 'BRIEFINGS:' where each bullet is `- <id>: <one-sentence task>`.",
    "Use only ids from the roster. Don't invent new agents.",
    "Keep the briefings concrete and small enough to fit in one PR.",
  ].join("\n");
  return streamBrief({
    system,
    messages: [{ role: "user", content: `Mission goal: ${goal}` }],
    onDelta, signal,
  });
}

export { PRICING };
