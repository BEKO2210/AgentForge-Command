#!/usr/bin/env node
// AgentForge — "agentforge-real-workflow-smoke".
//
// Proves the END-TO-END routing chain: operator → Atlas → dispatch →
// specialists → reports → Atlas final summary. It is honest about its mode:
//
//   - With ANTHROPIC_API_KEY set (and AGENTFORGE_LIVE_TEST=1) it would drive
//     the real LLM. That path costs tokens, so by default we DON'T do it here.
//   - Otherwise it runs the server's deterministic TEST HARNESS
//     (AGENTFORGE_HARNESS=1). Every frame is tagged `harness:true` and the
//     server/UI label it "TEST HARNESS" — nothing pretends an LLM ran.
//
// The harness exercises the SAME server pipeline the live path uses
// (parse → dispatch → per-specialist briefing → report → final summary), so a
// green run here means the routing wiring is sound. Exits 1 on any failure.

import * as assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4720 + Math.floor(Math.random() * 150);
const WSBASE = `ws://127.0.0.1:${PORT}`;
const BASE = `http://127.0.0.1:${PORT}`;

// The exact operator message this run drives Atlas with.
const ATLAS_MESSAGE =
  "Atlas, führe einen echten Schwarm-Check aus. Bitte sprich Sentinel, Aurora, " +
  "Forge, Scribe, Ledger, Raven, Luma und Nova jeweils mit einer kurzen Aufgabe an. " +
  "Jeder Spezialist soll mit genau einer Statusmeldung antworten. Danach gib mir als " +
  "Atlas eine finale Zusammenfassung: Was wurde geprüft, wer hat geantwortet, was ist offen?";
const EXPECTED = ["sentinel", "aurora", "forge", "scribe", "ledger", "raven", "luma", "nova"];

let pass = 0, fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m` };
function section(n) { console.log(`== ${n} ==`); }
async function it(name, fn) {
  try { await fn(); pass++; console.log(`  ${c.g("ok")}  ${name}`); }
  catch (e) { fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`); }
}

async function loadGuiModule(name) {
  const guiUrl = new URL("../gui/", import.meta.url);
  const r = (await import("node:module")).createRequire(guiUrl);
  return import(r.resolve(name));
}
let ptyOk = true, ptyError = "";
try { await loadGuiModule("node-pty"); await loadGuiModule("ws"); }
catch (e) { ptyOk = false; ptyError = String(e.message || e); }

const LIVE = process.env.AGENTFORGE_LIVE_TEST === "1" && !!process.env.ANTHROPIC_API_KEY;

let server = null;
async function startServer() {
  if (!ptyOk) throw new Error("gui native deps unloadable: " + ptyError + "\n  fix: `cd gui && npm ci`");
  const env = {
    ...process.env, PORT: String(PORT), TEST_CMD: "bash", AUTOSTART: "off",
    REPO_DIR: ROOT, FORGE_PULSE: "0",
  };
  if (LIVE) { env.AGENTFORGE_HARNESS = "0"; }
  else { env.AGENTFORGE_HARNESS = "1"; env.ANTHROPIC_API_KEY = ""; }
  server = spawn("node", [path.join(ROOT, "gui/server.js")], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.setEncoding("utf8"); server.stderr.setEncoding("utf8");
  let out = "", err = "";
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => { out += d; if (out.includes("AgentForge Command up")) resolve(); });
    server.stderr.on("data", (d) => { err += d; });
    server.on("exit", (code) => reject(new Error(`server exited early code=${code}\n  tail: ${(err || out).slice(-400)}`)));
    setTimeout(() => reject(new Error(`server didn't come up\n  tail: ${(err || out).slice(-400)}`)), 5000);
  });
}
function stopServer() { if (server) { try { server.kill("SIGTERM"); } catch {} } }
process.on("exit", stopServer);
process.on("SIGINT", () => { stopServer(); process.exit(130); });

function openWS(pathname) {
  const ws = new WebSocket(WSBASE + pathname);
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(ws), { once: true });
    ws.addEventListener("error", () => reject(new Error("ws open error")), { once: true });
    setTimeout(() => reject(new Error("ws open timeout")), 2000);
  });
}

console.log(`\n[agentforge-real-workflow-smoke] mode: ${LIVE ? "LIVE (real LLM)" : "TEST HARNESS (deterministic, no LLM)"}`);
await startServer();

section("Mission Control is reachable and Atlas exists");
await it("GET /api/arena reports atlas as lead and the mode honestly", async () => {
  const j = await (await fetch(BASE + "/api/arena")).json();
  assert.equal(j.leadId, "atlas");
  assert.ok(j.ptyAgents.includes("atlas"), "atlas must be in the swarm");
  if (LIVE) assert.equal(j.llm.enabled, true, "live mode needs the LLM enabled");
  else assert.equal(j.harness, true, "harness mode must be advertised so the UI can label it");
});

// Collect the full event stream for one workflow run, then assert against it.
section("Run the swarm-check workflow and capture every frame");
const frames = [];
let ws;
await it("operator sends the message to Atlas (A)", async () => {
  ws = await openWS("/arena");
  ws.addEventListener("message", (e) => { try { frames.push(JSON.parse(e.data)); } catch {} });
  await new Promise((r) => {
    const h = () => { if (frames.some((f) => f.t === "hello")) { ws.removeEventListener("message", h); r(); } };
    ws.addEventListener("message", h); h();
  });
  // Start two specialists so we can prove the "running vs not-running" split is
  // reported truthfully (no fake green for the dormant ones).
  ws.send(JSON.stringify({ t: "start-pty", id: "sentinel" }));
  ws.send(JSON.stringify({ t: "start-pty", id: "forge" }));
  await new Promise((r) => setTimeout(r, 400));
  const roster = EXPECTED.concat("atlas").map((id) => ({ id, name: id.toUpperCase(), role: "Specialist", superSkill: "x" }));
  ws.send(JSON.stringify({ t: "atlas-brief", goal: ATLAS_MESSAGE, roster }));
});

async function waitFor(pred, timeoutMs = 6000, label = "frame") {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const f = frames.find(pred);
    if (f) return f;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timeout waiting for ${label} (saw: ${[...new Set(frames.map((f) => f.t))].join(",")})`);
}

await it("Atlas's answer is visibly streamed, human-readable (B, G)", async () => {
  await waitFor((f) => f.t === "atlas-brief-start", 6000, "atlas-brief-start");
  const delta = await waitFor((f) => f.t === "atlas-brief-delta" && /[a-z]{4,}/i.test(f.d || ""), 6000, "atlas-brief-delta");
  assert.ok(delta.d.length > 0, "Atlas must stream readable answer text, not only tool events");
});

let briefEnd;
await it("Atlas addresses the expected specialists by id (C)", async () => {
  briefEnd = await waitFor((f) => f.t === "atlas-brief-end", 6000, "atlas-brief-end");
  const ids = (briefEnd.briefings || []).map((b) => b.id);
  for (const id of EXPECTED) assert.ok(ids.includes(id), `Atlas did not address @${id} (got: ${ids.join(",")})`);
});

await it("each addressed specialist gets a dispatch with a concrete task (D)", async () => {
  for (const id of EXPECTED) {
    const d = await waitFor((f) => f.t === "dispatch" && f.id === id, 7000, `dispatch ${id}`);
    assert.ok(d.task && d.task.length > 0, `@${id} dispatch carried no task`);
  }
});

await it("each addressed specialist returns a visible report, honestly flagged (E)", async () => {
  for (const id of EXPECTED) {
    const rep = await waitFor((f) => f.t === "specialist-report" && f.id === id, 7000, `report ${id}`);
    assert.ok(rep.line && rep.line.length > 0, `@${id} produced no visible report line`);
    assert.equal(typeof rep.running, "boolean", `@${id} report must state running truthfully`);
  }
  // The two we launched must be running; the rest honestly not-running.
  const running = frames.filter((f) => f.t === "specialist-report" && f.running).map((f) => f.id);
  assert.ok(running.includes("sentinel") && running.includes("forge"), `launched agents should report running, got: ${running.join(",")}`);
});

await it("Atlas produces a final summary covering checked/responded/open (F)", async () => {
  const fin = await waitFor((f) => f.t === "atlas-final", 7000, "atlas-final");
  assert.ok(fin.summary && /respond/i.test(fin.summary), "final summary must mention who responded");
  for (const id of EXPECTED) assert.ok(fin.addressed.includes(id), `final summary missing addressed @${id}`);
  assert.ok(Array.isArray(fin.open), "final summary must list what is open");
});

await it("honesty: in harness mode every workflow frame is tagged harness:true (H)", async () => {
  if (LIVE) { assert.ok(true, "live mode — no harness tag expected"); return; }
  const kinds = ["atlas-brief-start", "atlas-brief-end", "dispatch", "specialist-report", "atlas-final"];
  for (const k of kinds) {
    const f = frames.find((x) => x.t === k);
    assert.ok(f && f.harness === true, `${k} frame must carry harness:true so nothing looks like a real LLM run`);
  }
});

if (ws) ws.close();
stopServer();
setTimeout(() => {
  console.log("");
  console.log(`agentforge-real-workflow-smoke: ${pass} passed, ${fail} failed  ${c.d(`(${LIVE ? "live" : "harness"} mode)`)}`);
  process.exit(fail === 0 ? 0 : 1);
}, 200);
