#!/usr/bin/env node
// AgentForge — LLM bridge unit tests (gui/llm.js).
//
// The Anthropic Messages API path can't be exercised in CI without a key, so we
// mock global fetch with a synthetic SSE stream and assert the streaming parse,
// token/cost accounting, prompt construction, and error handling. Pure Node —
// no server, no PTY, no key. Runs in the portable test set.

import * as assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const llm = await import(pathToFileURL(path.join(ROOT, "gui/llm.js")).href);

let pass = 0, fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };
function section(n) { console.log(`== ${n} ==`); }
async function it(name, fn) {
  try { await fn(); pass++; console.log(`  ${c.g("ok")}  ${name}`); }
  catch (e) { fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`); }
}

// Build a Response-like object whose body streams the given SSE event strings.
function sseResponse(events, { ok = true, status = 200, textBody = "" } = {}) {
  const enc = new TextEncoder();
  const body = ok ? new ReadableStream({
    start(ctrl) { for (const e of events) ctrl.enqueue(enc.encode(e)); ctrl.close(); },
  }) : null;
  return { ok, status, body, text: async () => textBody };
}
const evt = (obj) => `event: ${obj.type}\ndata: ${JSON.stringify(obj)}\n\n`;

const realFetch = globalThis.fetch;
function withFetch(fn, captured) {
  globalThis.fetch = async (url, opts) => { if (captured) { captured.url = url; captured.opts = opts; } return fn(url, opts); };
}
function restoreFetch() { globalThis.fetch = realFetch; }

const ENV0 = { key: process.env.ANTHROPIC_API_KEY, model: process.env.AGENTFORGE_LLM_MODEL };
function setEnv({ key = "sk-ant-test", model } = {}) {
  if (key === null) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = key;
  if (model === undefined) delete process.env.AGENTFORGE_LLM_MODEL; else process.env.AGENTFORGE_LLM_MODEL = model;
}
function restoreEnv() {
  if (ENV0.key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = ENV0.key;
  if (ENV0.model === undefined) delete process.env.AGENTFORGE_LLM_MODEL; else process.env.AGENTFORGE_LLM_MODEL = ENV0.model;
}

const STREAM = [
  evt({ type: "message_start", message: { usage: { input_tokens: 1000, output_tokens: 0 } } }),
  evt({ type: "content_block_delta", delta: { text: "Hello " } }),
  evt({ type: "content_block_delta", delta: { text: "world" } }),
  evt({ type: "message_delta", usage: { output_tokens: 500 } }),
];

/* ============================ TESTS ============================ */

section("llmConfig");
await it("reports enabled iff ANTHROPIC_API_KEY is set, with the model", () => {
  setEnv({ key: null });
  assert.equal(llm.llmConfig().enabled, false);
  setEnv({ key: "sk-ant-x", model: "claude-opus-4-8" });
  const cfg = llm.llmConfig();
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.model, "claude-opus-4-8");
  restoreEnv();
});

section("streamBrief — streaming, usage + cost");
await it("streams deltas and accounts tokens + cost (sonnet)", async () => {
  setEnv({ key: "sk-ant-test", model: "claude-sonnet-4-6" });
  const cap = {};
  withFetch(() => sseResponse(STREAM), cap);
  const chunks = [];
  const r = await llm.streamBrief({ system: "sys", messages: [{ role: "user", content: "hi" }], onDelta: (d) => chunks.push(d) });
  restoreFetch(); restoreEnv();
  assert.equal(chunks.join(""), "Hello world");
  assert.deepEqual(r.usage, { input_tokens: 1000, output_tokens: 500 });
  // sonnet: in 3.00 / out 15.00 per 1M → 1000/1e6*3 + 500/1e6*15
  assert.ok(Math.abs(r.cost - (0.003 + 0.0075)) < 1e-9, `cost was ${r.cost}`);
  assert.equal(r.model, "claude-sonnet-4-6");
  // request shape
  const sent = JSON.parse(cap.opts.body);
  assert.equal(sent.stream, true);
  assert.equal(sent.model, "claude-sonnet-4-6");
  assert.equal(cap.opts.headers["x-api-key"], "sk-ant-test");
});

await it("unknown model → cost is null (honest, not silent $0)", async () => {
  setEnv({ key: "sk-ant-test", model: "claude-future-9" });
  withFetch(() => sseResponse(STREAM));
  const r = await llm.streamBrief({ system: "s", messages: [], onDelta: () => {} });
  restoreFetch(); restoreEnv();
  assert.equal(r.cost, null);
});

await it("throws a clear error when the API responds non-OK", async () => {
  setEnv({ key: "sk-ant-test" });
  withFetch(() => sseResponse([], { ok: false, status: 429, textBody: "rate limited" }));
  await assert.rejects(
    () => llm.streamBrief({ system: "s", messages: [], onDelta: () => {} }),
    /anthropic 429/);
  restoreFetch(); restoreEnv();
});

await it("throws when no API key is configured", async () => {
  setEnv({ key: null });
  await assert.rejects(() => llm.streamBrief({ system: "s", messages: [], onDelta: () => {} }), /ANTHROPIC_API_KEY/);
  restoreEnv();
});

section("atlasBrief + specialistBrief — prompt construction");
await it("atlasBrief sends the roster in the system prompt and the goal as the user message", async () => {
  setEnv({ key: "sk-ant-test", model: "claude-sonnet-4-6" });
  const cap = {};
  withFetch(() => sseResponse(STREAM), cap);
  const roster = [{ id: "sentinel", name: "Sentinel", role: "Security", superSkill: "guards" }];
  await llm.atlasBrief({ goal: "harden the repo", roster, onDelta: () => {} });
  restoreFetch(); restoreEnv();
  const sent = JSON.parse(cap.opts.body);
  assert.match(sent.system, /ATLAS PRIME/);
  assert.match(sent.system, /sentinel/);
  assert.match(sent.system, /BRIEFINGS/);
  assert.match(sent.messages[0].content, /harden the repo/);
});

await it("specialistBrief addresses the specialist and includes the task", async () => {
  setEnv({ key: "sk-ant-test", model: "claude-sonnet-4-6" });
  const cap = {};
  withFetch(() => sseResponse(STREAM), cap);
  await llm.specialistBrief({
    specialist: { id: "forge", name: "Forge", role: "Builder", superSkill: "ships", lane: "backend" },
    goal: "build X", plan: "do it well", task: "scaffold the module", onDelta: () => {},
  });
  restoreFetch(); restoreEnv();
  const sent = JSON.parse(cap.opts.body);
  assert.match(sent.system, /Forge/);
  assert.match(sent.system, /backend/);
  assert.match(sent.messages[0].content, /scaffold the module/);
});

section("PRICING export");
await it("covers the documented model tiers incl. opus-4-8", () => {
  for (const m of ["claude-opus-4-8", "claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"]) {
    assert.ok(llm.PRICING[m] && llm.PRICING[m].out > llm.PRICING[m].in, `${m} pricing`);
  }
});

console.log(`\nllm-suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
