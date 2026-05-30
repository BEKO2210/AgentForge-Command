#!/usr/bin/env node
// AgentForge — server integration tests.
//
// Spawns the real Node server with TEST_CMD=bash so we can drive PTYs
// without launching Claude Code, then runs HTTP + WebSocket assertions
// against it. The runner exits 1 on any failure.

import * as assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
// Node 22 ships a global WebSocket — we don't need the `ws` package here.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4500 + Math.floor(Math.random() * 200);
const BASE = `http://127.0.0.1:${PORT}`;
const WSBASE = `ws://127.0.0.1:${PORT}`;

let pass = 0;
let fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };

function section(name) { console.log(`== ${name} ==`); }
async function it(name, fn) {
  try {
    await fn();
    pass++; console.log(`  ${c.g("ok")}  ${name}`);
  } catch (e) {
    fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`);
  }
}

/* ----- Server lifecycle ----- */

// CI guard: the suite spawns the real gui server which requires node-pty +
// ws. Directory existence isn't enough — node-pty is a NATIVE module and
// `npm ci --ignore-scripts` leaves the .node binary unbuilt. The only
// honest check is "can we actually load it?". We do the same import from
// inside gui/ so it resolves the right node_modules.
async function loadGuiModule(name) {
  const guiUrl = new URL("../gui/", import.meta.url);
  const r = (await import("node:module")).createRequire(guiUrl);
  const resolved = r.resolve(name); // throws if package isn't there
  return import(resolved);
}
let ptyOk = true;
let ptyError = "";
try {
  await loadGuiModule("node-pty");
  await loadGuiModule("ws");
} catch (e) {
  ptyOk = false;
  ptyError = String(e.message || e);
}

// WebSocket client constructor: global on Node 22+, the `ws` package on 18/20
// (the server depends on `ws` anyway, so it's always available here).
let WS = globalThis.WebSocket;
if (!WS && ptyOk) { const m = await loadGuiModule("ws"); WS = m.WebSocket || m.default || m; }

let server = null;
async function startServer() {
  if (!ptyOk) {
    throw new Error("gui native deps unloadable: " + ptyError +
                    "\n  fix: `cd gui && npm ci` (NOT --ignore-scripts — node-pty needs its build step)");
  }
  server = spawn("node", [path.join(ROOT, "gui/server.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      TEST_CMD: "bash",
      AUTOSTART: "off",
      REPO_DIR: ROOT,
      AGENTFORGE_BUDGET_USD: "5.00",
      FORGE_PULSE: "0", // disable Rust accelerator for deterministic timing
      ANTHROPIC_API_KEY: "", // unset → tests cover the no-key path
      // This suite exercises FUNCTIONAL behaviour (PTY lifecycle, persist,
      // hooks). The auth gate (origin/host/token) is owned by
      // tests/security-suite.mjs, which runs with the token ON. Here we opt
      // out of the token so the functional assertions stay focused.
      AGENTFORGE_NO_TOKEN: "1",
      // Worktree isolation is covered by tests/worktree-suite.mjs in a throwaway
      // git repo. Disable it here so these tests don't mutate the real repo.
      AGENTFORGE_WORKTREES: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.setEncoding("utf8");
  server.stderr.setEncoding("utf8");
  let stdoutBuf = "";
  let stderrBuf = "";
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => {
      stdoutBuf += d;
      if (stdoutBuf.includes("AgentForge Command up")) resolve();
    });
    // Capture stderr so a startup failure is debuggable on CI — without
    // this we used to see "server exited early code=1:" with an empty tail.
    server.stderr.on("data", (d) => { stderrBuf += d; });
    server.on("exit", (code) => {
      const tail = (stderrBuf || stdoutBuf).slice(-600).trim();
      reject(new Error(`server exited early code=${code}\n  stderr/tail: ${tail || "(empty)"}`));
    });
    setTimeout(() => {
      const tail = (stderrBuf || stdoutBuf).slice(-400).trim();
      reject(new Error(`server didn't come up in 5s\n  tail: ${tail || "(empty)"}`));
    }, 5000);
  });
}
function stopServer() {
  if (server) { try { server.kill("SIGTERM"); } catch {} }
}
process.on("exit", stopServer);
process.on("SIGINT", () => { stopServer(); process.exit(130); });

// Boot a throwaway server with custom env (own port, own REPO_DIR) for the
// failure-mode tests that can't share the long-lived `server` above. Resolves
// with handles + a stop() the caller must invoke.
const extraServers = [];
async function bootServer(extraEnv = {}) {
  const port = 4700 + Math.floor(Math.random() * 200);
  const proc = spawn("node", [path.join(ROOT, "gui/server.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      TEST_CMD: "bash",
      AUTOSTART: "off",
      REPO_DIR: ROOT,
      FORGE_PULSE: "0",
      ANTHROPIC_API_KEY: "",
      AGENTFORGE_NO_TOKEN: "1", // functional fixtures; auth is in security-suite
      AGENTFORGE_WORKTREES: "0", // worktrees covered by worktree-suite
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout.setEncoding("utf8");
  proc.stderr.setEncoding("utf8");
  let outBuf = "", errBuf = "";
  extraServers.push(proc);
  await new Promise((resolve, reject) => {
    proc.stdout.on("data", (d) => { outBuf += d; if (outBuf.includes("AgentForge Command up")) resolve(); });
    proc.stderr.on("data", (d) => { errBuf += d; });
    proc.on("exit", (code) => reject(new Error(`extra server exited early code=${code}\n  tail: ${(errBuf || outBuf).slice(-400).trim()}`)));
    setTimeout(() => reject(new Error(`extra server didn't come up\n  tail: ${(errBuf || outBuf).slice(-400).trim()}`)), 5000);
  });
  return {
    port,
    base: `http://127.0.0.1:${port}`,
    wsbase: `ws://127.0.0.1:${port}`,
    stdout: () => outBuf,
    stderr: () => errBuf,
    stop: () => { try { proc.kill("SIGTERM"); } catch {} },
  };
}
process.on("exit", () => { for (const p of extraServers) { try { p.kill("SIGKILL"); } catch {} } });

async function openWS(pathname) {
  const ws = new WS(WSBASE + pathname);
  // Buffer EVERY frame from connect-time. The server sends `hello` (and fast
  // acks) immediately; attaching the listener only inside nextMsg would race
  // and lose early messages — native WebSocket (Node 22) happened to win that
  // race, the ws package (Node 18/20) did not. Buffering makes it deterministic.
  ws._frames = [];
  ws.addEventListener("message", (ev) => { try { ws._frames.push(JSON.parse(ev.data)); } catch {} });
  await new Promise((resolve, reject) => {
    const onOpen  = () => { ws.removeEventListener("error", onError); resolve(); };
    const onError = () => { ws.removeEventListener("open", onOpen); reject(new Error("ws open error")); };
    ws.addEventListener("open",  onOpen,  { once: true });
    ws.addEventListener("error", onError, { once: true });
    setTimeout(() => reject(new Error("ws open timeout")), 5000);
  });
  return ws;
}
// Resolve with the first buffered frame matching `predicate` (past or future),
// consuming it so repeated waits get distinct frames.
function nextMsg(ws, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      const i = (ws._frames || []).findIndex((m) => !predicate || predicate(m));
      if (i >= 0) { const m = ws._frames[i]; ws._frames.splice(i, 1); return resolve(m); }
      if (Date.now() - t0 > timeoutMs) return reject(new Error("ws msg timeout"));
      setTimeout(tick, 20);
    };
    tick();
  });
}

/* ----- Tests ----- */

await startServer();

section("HTTP routes");
await it("GET / serves the arena (200, HTML)", async () => {
  const r = await fetch(BASE + "/");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") || "", /html/);
  const body = await r.text();
  assert.match(body, /AGENT/);
  assert.match(body, /arena\/main\.js/);
});
await it("GET /console returns 302 redirect to /", async () => {
  const r = await fetch(BASE + "/console", { redirect: "manual" });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "/");
});
await it("GET /api/agents returns swarm + leadId=atlas", async () => {
  const r = await fetch(BASE + "/api/agents");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.leadId, "atlas");
  assert.equal(j.swarm.length, 12);
  assert.equal(j.swarm[0].id, "atlas");
  // prompts must never leak over HTTP
  for (const s of j.swarm) assert.equal(s.prompt, undefined);
});
await it("GET /api/state returns the .team folded view", async () => {
  const r = await fetch(BASE + "/api/state");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.generatedAt && j.counts && Array.isArray(j.tasks) && Array.isArray(j.roles));
});
await it("GET /api/arena reports spend.forecast + llm + pulse", async () => {
  const r = await fetch(BASE + "/api/arena");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.leadId, "atlas");
  assert.equal(j.llm.enabled, false); // no API key in test env
  assert.equal(j.pulse, false);       // FORGE_PULSE=0
  assert.equal(typeof j.spend.budgetUsd, "number");
  assert.equal(j.spend.budgetUsd, 5);
  assert.ok(j.spend.forecast);
  assert.equal(j.spend.forecast.samples, 0);
  assert.equal(j.spend.forecast.trend, "steady");
});
await it("GET /unknown-path returns 404", async () => {
  const r = await fetch(BASE + "/zzzzz-not-here");
  assert.equal(r.status, 404);
});
await it("static asset /arena/styles.css serves 200 text/css", async () => {
  const r = await fetch(BASE + "/arena/styles.css");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") || "", /css/);
});

section("WebSocket /arena handshake");
await it("hello carries leadId, swarm, llm, spend", async () => {
  const ws = await openWS("/arena");
  const hello = await nextMsg(ws, (m) => m.t === "hello");
  assert.equal(hello.leadId, "atlas");
  assert.equal(hello.ptyAgents.length, 12);
  assert.equal(hello.llm.enabled, false);
  assert.ok(hello.spend);
  ws.close();
});

section("WebSocket /arena · auto-enter watchdog");
await it("auto-config arms a PTY and acks with the armed list", async () => {
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  ws.send(JSON.stringify({ t: "auto-config", agents: [{ id: "atlas" }] }));
  const ack = await nextMsg(ws, (m) => m.t === "auto-config-ack");
  assert.ok(Array.isArray(ack.autoEnter));
  // Exactly the armed agent — not the whole swarm (see regression below).
  assert.deepEqual(ack.autoEnter, ["atlas"]);
  ws.close();
});
await it("(y/n) prompt fires auto-enter via the JS matcher", async () => {
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  ws.send(JSON.stringify({ t: "auto-config", agents: [{ id: "atlas" }] }));
  await nextMsg(ws, (m) => m.t === "auto-config-ack");
  ws.send(JSON.stringify({ t: "start-pty", id: "atlas" }));
  await nextMsg(ws, (m) => m.t === "started" && m.id === "atlas");
  // Drive the bash PTY to print a (y/n) prompt + run read.
  ws.send(JSON.stringify({ t: "input", id: "atlas",
    d: "echo 'continue? (y/n)'; read -p '> ' R; echo \"got: $R\"\r" }));
  // Expect an auto-fired event followed by a clean "got:" line with no R.
  const fired = await nextMsg(ws, (m) => m.t === "auto-fired" && m.target === "atlas", 4000);
  assert.match(fired.reason, /(y\/n|continue\?)/);
  ws.send(JSON.stringify({ t: "stop-pty", id: "atlas" }));
  ws.close();
});

section("WebSocket /arena · persist round-trip");
await it("persist + read-back through /api/arena", async () => {
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  ws.send(JSON.stringify({
    t: "persist",
    evolution: { sentinel: 4, aurora: 2 },
    customAgents: [{ id: "oracle-test", name: "ORACLE", title: "Tester",
                     role: "Q", superSkill: "test", mascot: "fox",
                     color: "#abc", seed: false }],
    atlasMission: "verify everything",
  }));
  await nextMsg(ws, (m) => m.t === "persist-ack");
  const j = await (await fetch(BASE + "/api/arena")).json();
  assert.equal(j.evolution.sentinel, 4);
  assert.equal(j.atlasMission, "verify everything");
  assert.equal(j.customAgents.length, 1);
  assert.equal(j.customAgents[0].id, "oracle-test");
  // Clean up so other tests aren't affected.
  ws.send(JSON.stringify({ t: "persist", evolution: {}, customAgents: [], atlasMission: "" }));
  await nextMsg(ws, (m) => m.t === "persist-ack");
  ws.close();
});

section("WebSocket /arena · specialist PTY lifecycle");
await it("start-pty boots a session and emits started", async () => {
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  ws.send(JSON.stringify({ t: "start-pty", id: "forge" }));
  const m = await nextMsg(ws, (m) => m.t === "started" && m.id === "forge");
  assert.equal(m.id, "forge");
  ws.send(JSON.stringify({ t: "stop-pty", id: "forge" }));
  await nextMsg(ws, (m) => m.t === "exit" && m.id === "forge", 3000);
  ws.close();
});
await it("unknown start-pty id surfaces an error event", async () => {
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  ws.send(JSON.stringify({ t: "start-pty", id: "doesnt-exist" }));
  const err = await nextMsg(ws, (m) => m.t === "error", 2000);
  assert.match(err.reason || "", /unknown pty id/);
  ws.close();
});
await it("start-pty WITHOUT a goal does NOT paste the role briefing (regression)", async () => {
  // Bug found by the E2E sim: when the operator clicked "Launch" with no
  // explicit goal, the server fell back to def.prompt and pasted the
  // briefing text into the PTY, drowning the session in noise. This test
  // pins the fix: a manual launch must leave the shell clean.
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  // Pick scribe because no other test in this run starts it.
  ws.send(JSON.stringify({ t: "start-pty", id: "scribe" })); // NO goal
  await nextMsg(ws, (m) => m.t === "started" && m.id === "scribe");
  // Settle window: collect every "o" frame for scribe over 1.2s and
  // assert none of them contain prose from the briefing template.
  const out = [];
  const onMsg = (ev) => {
    try { const m = JSON.parse(ev.data); if (m.t === "o" && m.id === "scribe") out.push(String(m.d || "")); } catch {}
  };
  ws.addEventListener("message", onMsg);
  await new Promise((r) => setTimeout(r, 1200));
  ws.removeEventListener("message", onMsg);
  const joined = out.join("");
  assert.ok(!/You are SCRIBE/.test(joined), `briefing leaked into PTY: ${joined.slice(0, 200)}`);
  assert.ok(!/AgentForge swarm/.test(joined), "briefing template leaked into PTY");
  ws.send(JSON.stringify({ t: "stop-pty", id: "scribe" }));
  ws.close();
});
await it("start-pty WITH a goal pastes the role briefing once, then Enter", async () => {
  // Mirror image: when a goal IS supplied (which is what atlas's
  // auto-dispatch does), the briefing must still get pasted and run.
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  ws.send(JSON.stringify({ t: "start-pty", id: "echo", goal: "test mission xyz" }));
  await nextMsg(ws, (m) => m.t === "started" && m.id === "echo");
  // Wait long enough for the 900ms deferred paste + the 150ms Enter.
  const briefingFrame = await nextMsg(ws,
    (m) => m.t === "o" && m.id === "echo" && /ECHO|test mission xyz/.test(String(m.d || "")), 3000);
  assert.ok(briefingFrame, "briefing should have been pasted when a goal is supplied");
  ws.send(JSON.stringify({ t: "stop-pty", id: "echo" }));
  ws.close();
});
await it("input writes bytes into a running PTY (and PTY echoes them back)", async () => {
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  ws.send(JSON.stringify({ t: "start-pty", id: "sentinel" }));
  await nextMsg(ws, (m) => m.t === "started" && m.id === "sentinel");
  ws.send(JSON.stringify({ t: "input", id: "sentinel", d: "echo ZZZ123\r" }));
  const out = await nextMsg(ws, (m) => m.t === "o" && m.id === "sentinel" && /ZZZ123/.test(m.d), 3000);
  assert.match(out.d, /ZZZ123/);
  ws.send(JSON.stringify({ t: "stop-pty", id: "sentinel" }));
  ws.close();
});

section("WebSocket /arena · atlas-brief (no key path)");
await it("atlas-brief without ANTHROPIC_API_KEY returns a clear error", async () => {
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  ws.send(JSON.stringify({ t: "atlas-brief", goal: "test", roster: [] }));
  const err = await nextMsg(ws, (m) => m.t === "atlas-brief-error");
  assert.match(err.reason || "", /ANTHROPIC_API_KEY/);
  ws.close();
});

section("WebSocket /arena · spend");
await it("spend-get returns the snapshot with forecast", async () => {
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  ws.send(JSON.stringify({ t: "spend-get" }));
  const upd = await nextMsg(ws, (m) => m.t === "spend-update");
  assert.equal(typeof upd.spend.totalUsd, "number");
  assert.equal(upd.spend.budgetUsd, 5);
  assert.ok(upd.spend.forecast);
  ws.close();
});
await it("spend-reset zeroes the ledger and pushes an update", async () => {
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  ws.send(JSON.stringify({ t: "spend-reset" }));
  const upd = await nextMsg(ws, (m) => m.t === "spend-update");
  assert.equal(upd.spend.totalUsd, 0);
  assert.equal(upd.spend.briefCount, 0);
  ws.close();
});

section("Concurrency · multiple arena clients see the same broadcasts");
await it("started events reach two arena clients", async () => {
  // Both sockets collect every frame as it arrives, so consecutive waits
  // on the same socket can't deadlock each other.
  const fa = []; const fb = [];
  const a = new WS(WSBASE + "/arena");
  const b = new WS(WSBASE + "/arena");
  a.addEventListener("message", (e) => { try { fa.push(JSON.parse(e.data)); } catch {} });
  b.addEventListener("message", (e) => { try { fb.push(JSON.parse(e.data)); } catch {} });
  await new Promise((r) => a.addEventListener("open", r, { once: true }));
  await new Promise((r) => b.addEventListener("open", r, { once: true }));

  const waitFor = (buf, pred, timeoutMs = 5000) =>
    new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const i = buf.findIndex(pred);
        if (i >= 0) { resolve(buf[i]); return; }
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`waitFor timeout (saw ${buf.length} frames: ${buf.map((m)=>m.t+(m.id?"/"+m.id:"")).slice(0,6).join(", ")})`));
          return;
        }
        setTimeout(tick, 25);
      };
      tick();
    });

  await waitFor(fa, (m) => m.t === "hello");
  await waitFor(fb, (m) => m.t === "hello");
  a.send(JSON.stringify({ t: "start-pty", id: "echo" })); // an id no previous test launches
  const [ma, mb] = await Promise.all([
    waitFor(fa, (m) => m.t === "started" && m.id === "echo"),
    waitFor(fb, (m) => m.t === "started" && m.id === "echo"),
  ]);
  assert.equal(ma.id, mb.id);
  a.send(JSON.stringify({ t: "stop-pty", id: "echo" }));
  a.close(); b.close();
});

section("HTTP /api/hooks · tool-hook receiver");
await it("GET query string resolves event+tool to a state", async () => {
  const r = await fetch(BASE + "/api/hooks?agent=forge&event=PreToolUse&tool=Read");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.agentId, "forge");
  assert.equal(j.state, "reading");
});
await it("POST JSON PostToolUse(ok) → success", async () => {
  const r = await fetch(BASE + "/api/hooks", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent: "forge", event: "PostToolUse", tool: "Edit", ok: true }),
  });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.state, "success");
});
await it("POST form-urlencoded is accepted", async () => {
  const r = await fetch(BASE + "/api/hooks", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "agent=forge&event=Stop",
  });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.state, "idle");
});
await it("missing agent/event → 400 without crashing", async () => {
  const r = await fetch(BASE + "/api/hooks", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: "Stop" }),
  });
  assert.equal(r.status, 400);
  const j = await r.json();
  assert.equal(j.ok, false);
  // server must still be serving afterwards
  assert.equal((await fetch(BASE + "/api/arena")).status, 200);
});
await it("a hook event reaches connected arena clients over WS", async () => {
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  // Arm the listener BEFORE firing the hook so we can't miss the frame.
  const hookP = nextMsg(ws, (m) => m.t === "hook" && m.id === "vega", 3000);
  await fetch(BASE + "/api/hooks?agent=vega&event=PreToolUse&tool=Bash");
  const hook = await hookP;
  assert.equal(hook.state, "working");
  ws.close();
});

section("WebSocket /arena · auto-enter arms ONLY the selected agents (regression)");
await it("arming one agent does NOT arm the whole swarm", async () => {
  // Regression for the bug where any non-empty `agents` list armed every PTY.
  const ws = await openWS("/arena");
  await nextMsg(ws, (m) => m.t === "hello");
  ws.send(JSON.stringify({ t: "auto-config", agents: [{ id: "forge" }] }));
  const ack = await nextMsg(ws, (m) => m.t === "auto-config-ack");
  assert.deepEqual(ack.autoEnter.sort(), ["forge"]);
  // read-back through HTTP confirms persistence matches the selection
  const j = await (await fetch(BASE + "/api/arena")).json();
  assert.deepEqual(j.autoEnter.sort(), ["forge"]);
  // empty selection disarms everything
  ws.send(JSON.stringify({ t: "auto-config", agents: [] }));
  const ack2 = await nextMsg(ws, (m) => m.t === "auto-config-ack");
  assert.deepEqual(ack2.autoEnter, []);
  ws.close();
});

section("HTTP /api/arena · honest capability flags");
await it("reports claudeCli boolean (bash is present in test env)", async () => {
  const j = await (await fetch(BASE + "/api/arena")).json();
  assert.equal(typeof j.claudeCli, "boolean");
  assert.equal(j.claudeCli, true); // TEST_CMD=bash → resolvable
});

section("No fake activity · idle cockpit stays silent");
await it("a fresh server with nothing launched emits hello and NO activity frames", async () => {
  // Use a dedicated server so prior tests' (real) PTY buffer replays don't
  // count against us. With nothing ever started, an honest cockpit produces
  // zero terminal/dispatch frames — no mock simulator filling the silence.
  const srv = await bootServer();
  try {
    const frames = [];
    const ws = new WS(srv.wsbase + "/arena");
    ws.addEventListener("message", (e) => { try { frames.push(JSON.parse(e.data)); } catch {} });
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    await new Promise((r) => setTimeout(r, 1200));
    ws.close();
    const noise = frames.filter((f) => ["o", "started", "dispatch", "specialist-brief-delta", "auto-fired"].includes(f.t));
    assert.equal(noise.length, 0, `expected no activity frames, saw: ${noise.map((f) => f.t).join(",")}`);
    assert.ok(frames.some((f) => f.t === "hello"), "should still receive the hello frame");
  } finally {
    srv.stop();
  }
});

section("Launch failure · missing command surfaces a clear error");
await it("start-pty with a missing command emits launch-error, server survives", async () => {
  const srv = await bootServer({ TEST_CMD: "agentforge-nonexistent-binary-xyz" });
  try {
    const ws = new WS(srv.wsbase + "/arena");
    const frames = [];
    ws.addEventListener("message", (e) => { try { frames.push(JSON.parse(e.data)); } catch {} });
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("no hello")), 2000);
      const h = () => { if (frames.some((f) => f.t === "hello")) { clearTimeout(t); ws.removeEventListener("message", h); resolve(); } };
      ws.addEventListener("message", h); h();
    });
    ws.send(JSON.stringify({ t: "start-pty", id: "forge" }));
    const err = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`no launch-error (saw: ${frames.map((f) => f.t).join(",")})`)), 3000);
      const h = () => { const f = frames.find((x) => x.t === "launch-error" && x.id === "forge"); if (f) { clearTimeout(t); ws.removeEventListener("message", h); resolve(f); } };
      ws.addEventListener("message", h); h();
    });
    assert.match(err.reason || "", /command not found/i);
    // server must still respond on HTTP after the failed launch
    assert.equal((await fetch(srv.base + "/api/arena")).status, 200);
    ws.close();
  } finally {
    srv.stop();
  }
});

section("Resilience · corrupt arena.json is recovered, not fatal");
await it("a corrupt .team/arena.json boots to empty state + leaves a backup", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arena-corrupt-"));
  fs.mkdirSync(path.join(dir, ".team"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".team", "arena.json"), "{ this is : not json ]");
  const srv = await bootServer({ REPO_DIR: dir });
  try {
    const j = await (await fetch(srv.base + "/api/arena")).json();
    assert.deepEqual(j.autoEnter, []);
    assert.deepEqual(j.customAgents, []);
    assert.equal(j.atlasMission, "");
    const files = fs.readdirSync(path.join(dir, ".team"));
    assert.ok(files.some((f) => f.startsWith("arena.json.corrupt-")),
      `expected a corrupt backup, saw: ${files.join(",")}`);
  } finally {
    srv.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ----- Summary ----- */

for (const p of extraServers) { try { p.kill("SIGTERM"); } catch {} }
stopServer();
setTimeout(() => {
  console.log("");
  console.log(`server integration tests: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}, 200);
