#!/usr/bin/env node
// AgentForge — runtime robustness suite (Phase 2).
//
// Covers the operational guardrails: /api/health probe, PTY cap, zombie
// reaping, and spend-ledger restore-from-file. Mirrors server-suite's
// lifecycle (spawn the real server with TEST_CMD=bash) but boots one server
// per scenario with scenario-specific env. Runs in NO_TOKEN mode — the auth
// surface is owned by tests/security-suite.mjs.

import * as assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0, fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };
function section(n) { console.log(`== ${n} ==`); }
async function it(name, fn) {
  try { await fn(); pass++; console.log(`  ${c.g("ok")}  ${name}`); }
  catch (e) { fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`); }
}

// dependency guard
try {
  const r = createRequire(new URL("../gui/", import.meta.url));
  await import(r.resolve("node-pty"));
  await import(r.resolve("ws"));
} catch (e) {
  console.log("== robustness suite ==");
  console.log("  - skipped (gui native deps unloadable: " + String(e.message || e) + ")");
  console.log("\nrobustness-suite: 0 passed, 0 failed (skipped)");
  process.exit(0);
}

// WebSocket client: global on Node 22+, `ws` package on 18/20.
let WS = globalThis.WebSocket;
if (!WS) { const r = createRequire(new URL("../gui/", import.meta.url)); const m = await import(r.resolve("ws")); WS = m.WebSocket || m.default || m; }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
process.on("exit", () => { for (const p of procs) { try { p.kill("SIGKILL"); } catch {} } });

async function boot(extraEnv = {}) {
  const port = 4960 + Math.floor(Math.random() * 30);
  const proc = spawn("node", [path.join(ROOT, "gui/server.js")], {
    cwd: ROOT,
    env: {
      ...process.env, PORT: String(port), TEST_CMD: "bash", AUTOSTART: "off",
      REPO_DIR: ROOT, FORGE_PULSE: "0", ANTHROPIC_API_KEY: "",
      AGENTFORGE_NO_TOKEN: "1", AGENTFORGE_WORKTREES: "0", ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  procs.push(proc);
  proc.stdout.setEncoding("utf8"); proc.stderr.setEncoding("utf8");
  let out = "", err = "";
  await new Promise((resolve, reject) => {
    proc.stdout.on("data", (d) => { out += d; if (out.includes("AgentForge Command up")) resolve(); });
    proc.stderr.on("data", (d) => { err += d; });
    proc.on("exit", (code) => reject(new Error(`server exited early code=${code}\n  tail: ${(err || out).slice(-400)}`)));
    setTimeout(() => reject(new Error(`server didn't come up\n  tail: ${(err || out).slice(-400)}`)), 5000);
  });
  const base = `http://127.0.0.1:${port}`;
  return {
    base, wsbase: `ws://127.0.0.1:${port}`,
    get: async (p) => { const r = await fetch(base + p); return { status: r.status, json: await r.json().catch(() => null) }; },
    stop: () => { try { proc.kill("SIGTERM"); } catch {} },
  };
}

// Open an arena WS, returning helpers to send and collect frames.
function openWS(wsbase) {
  const ws = new WS(wsbase + "/arena");
  const frames = [];
  ws.addEventListener("message", (ev) => { try { frames.push(JSON.parse(ev.data)); } catch {} });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve({
      send: (m) => ws.send(JSON.stringify(m)),
      frames,
      waitFor: async (pred, ms = 2500) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { const f = frames.find(pred); if (f) return f; await sleep(40); }
        return null;
      },
      close: () => { try { ws.close(); } catch {} },
    }), { once: true });
    ws.addEventListener("error", () => reject(new Error("ws open error")), { once: true });
    setTimeout(() => reject(new Error("ws open timeout")), 3000);
  });
}

/* ============================ TESTS ============================ */

section("/api/health probe");
await it("returns status ok with the documented shape", async () => {
  const srv = await boot();
  try {
    const { status, json } = await srv.get("/api/health");
    assert.equal(status, 200);
    assert.equal(json.status, "ok");
    assert.equal(typeof json.uptime, "number");
    assert.equal(typeof json.activePtys, "number");
    assert.equal(json.maxPtys, 12); // default = full seed swarm (Atlas + 11)
    assert.equal(typeof json.timestamp, "number");
    assert.ok("version" in json && "budgetUsd" in json && "spentUsd" in json);
    // never leak secrets
    assert.ok(!JSON.stringify(json).includes("ANTHROPIC"), "health must not echo env secrets");
  } finally { srv.stop(); }
});

section("PTY cap (AGENTFORGE_MAX_PTYS)");
await it("refuses to start more than MAX_PTYS, with a clear message", async () => {
  const srv = await boot({ AGENTFORGE_MAX_PTYS: "2" });
  try {
    const ws = await openWS(srv.wsbase);
    ws.send({ t: "start-pty", id: "forge" });
    ws.send({ t: "start-pty", id: "sentinel" });
    await sleep(400);
    const before = (await srv.get("/api/health")).json.activePtys;
    assert.equal(before, 2, `expected 2 active PTYs, got ${before}`);
    ws.send({ t: "start-pty", id: "aurora" }); // 3rd → over the cap
    const err = await ws.waitFor((f) => f.t === "launch-error" && f.id === "aurora");
    assert.ok(err, "expected a launch-error for the over-cap start");
    assert.match(err.reason, /limit/i);
    const after = (await srv.get("/api/health")).json.activePtys;
    assert.equal(after, 2, `cap breached: ${after} active PTYs`);
    ws.close();
  } finally { srv.stop(); }
});

section("Zombie reaping (idle exited PTYs are swept)");
await it("an exited PTY is reaped after the idle timeout", async () => {
  const srv = await boot({ AGENTFORGE_IDLE_TIMEOUT_MS: "300", AGENTFORGE_REAP_INTERVAL_MS: "200" });
  try {
    const ws = await openWS(srv.wsbase);
    ws.send({ t: "start-pty", id: "forge" });
    await sleep(400);
    assert.equal((await srv.get("/api/health")).json.activePtys, 1, "PTY should be live");
    ws.send({ t: "stop-pty", id: "forge" }); // kill it → becomes exited
    await ws.waitFor((f) => f.t === "exit" && f.id === "forge");
    // wait past idle timeout + a reap tick
    await sleep(900);
    assert.equal((await srv.get("/api/health")).json.activePtys, 0, "exited PTY should have been reaped");
    ws.close();
  } finally { srv.stop(); }
});

section("Spend ledger persistence (AGENTFORGE_SPEND_FILE)");
await it("restores totals from a pre-seeded JSONL file on boot", async () => {
  const file = path.join(os.tmpdir(), `afc-spend-${Date.now()}.jsonl`);
  fs.writeFileSync(file,
    JSON.stringify({ ts: Date.now(), model: "claude-sonnet-4-6", usage: { input_tokens: 1000, output_tokens: 2000 }, cost: 0.50, goal: "a" }) + "\n" +
    JSON.stringify({ ts: Date.now(), model: "claude-sonnet-4-6", usage: { input_tokens: 500, output_tokens: 1000 }, cost: 1.00, goal: "b" }) + "\n");
  const srv = await boot({ AGENTFORGE_SPEND_FILE: file });
  try {
    const { json } = await srv.get("/api/arena");
    assert.ok(json.spend, "arena state should carry a spend snapshot");
    assert.ok(Math.abs(json.spend.totalUsd - 1.50) < 1e-9, `expected restored total 1.50, got ${json.spend.totalUsd}`);
    assert.equal(json.spend.totalIn, 1500);
    assert.equal(json.spend.totalOut, 3000);
  } finally { srv.stop(); try { fs.unlinkSync(file); } catch {} }
});

console.log(`\nrobustness-suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
