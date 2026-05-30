#!/usr/bin/env node
// AgentForge — SECURITY regression suite (Phase 1).
//
// ┌───────────────────────────────────────────────────────────────────────┐
// │ SECURITY SUITE — these tests are written TEST-FIRST.                    │
// │ Before the Phase-1 fixes they are meant to be RED: each red dot PROVES  │
// │ an open hole (CSWSH / missing token / CSRF / DNS-rebinding). After the  │
// │ origin-allowlist + host-check + per-session token + headers land, they  │
// │ all turn GREEN. Never write the fix before the failing test.            │
// └───────────────────────────────────────────────────────────────────────┘
//
// Mirrors tests/server-suite.mjs: spawns the real gui server with
// TEST_CMD=bash, then drives raw HTTP + WebSocket against it. The runner
// exits 1 on any failure. The `ws` package is used for the WS tests because
// it lets us set a custom Origin header (the WHATWG global WebSocket cannot).

import * as assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4900 + Math.floor(Math.random() * 90);
const HOSTPORT = `127.0.0.1:${PORT}`;
const TRUSTED_ORIGIN = `http://127.0.0.1:${PORT}`;

let pass = 0;
let fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };
function section(name) { console.log(`== ${name} ==`); }
async function it(name, fn) {
  try { await fn(); pass++; console.log(`  ${c.g("ok")}  ${name}`); }
  catch (e) { fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`); }
}

// ---- dependency guard (same honest probe as server-suite) -------------------
async function loadGui(name) {
  const r = createRequire(new URL("../gui/", import.meta.url));
  return import(r.resolve(name));
}
let WS = null;
try {
  await loadGui("node-pty");
  const wsMod = await loadGui("ws");
  WS = wsMod.WebSocket || wsMod.default || wsMod;
  if (typeof WS !== "function") throw new Error("ws WebSocket constructor not found");
} catch (e) {
  console.log("== security suite ==");
  console.log("  - skipped (gui native deps unloadable: " + String(e.message || e) + ")");
  console.log("    fix: `cd gui && npm ci` (NOT --ignore-scripts — node-pty needs its build step)");
  console.log("\nsecurity-suite: 0 passed, 0 failed (skipped)");
  process.exit(0);
}

// ---- server lifecycle -------------------------------------------------------
let server = null;
let stdoutBuf = "";
let stderrBuf = "";
async function startServer() {
  server = spawn("node", [path.join(ROOT, "gui/server.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      TEST_CMD: "bash",
      AUTOSTART: "off",
      REPO_DIR: ROOT,
      FORGE_PULSE: "0",
      ANTHROPIC_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.setEncoding("utf8");
  server.stderr.setEncoding("utf8");
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => { stdoutBuf += d; if (stdoutBuf.includes("AgentForge Command up")) resolve(); });
    server.stderr.on("data", (d) => { stderrBuf += d; });
    server.on("exit", (code) => reject(new Error(`server exited early code=${code}\n  tail: ${(stderrBuf || stdoutBuf).slice(-500).trim()}`)));
    setTimeout(() => reject(new Error(`server didn't come up in 5s\n  tail: ${(stderrBuf || stdoutBuf).slice(-400).trim()}`)), 5000);
  });
}
function stopServer() { if (server) { try { server.kill("SIGTERM"); } catch {} } }
process.on("exit", stopServer);
process.on("SIGINT", () => { stopServer(); process.exit(130); });

// The server prints its per-session token after the Phase-1.3 fix. Before the
// fix nothing is printed → returns "" and the token-dependent tests still
// exercise (and fail on) the missing protection.
function sessionToken() {
  const m = stdoutBuf.match(/\b([a-f0-9]{64})\b/);
  return m ? m[1] : "";
}

// ---- low-level HTTP helper (raw path + arbitrary Host, no URL normalisation)
function rawRequest({ method = "GET", path: reqPath = "/", host = HOSTPORT, origin, body, contentType } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { Host: host };
    if (origin) headers["Origin"] = origin;
    if (body != null) {
      headers["Content-Type"] = contentType || "application/json";
      headers["Content-Length"] = Buffer.byteLength(body);
    }
    const req = http.request(
      { hostname: "127.0.0.1", port: PORT, method, path: reqPath, headers },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (d) => { data += d; });
        res.on("end", () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
      },
    );
    req.on("error", reject);
    if (body != null) req.write(body);
    req.end();
  });
}

// ---- WS helper: try to connect, report whether it OPENED -------------------
function wsAttempt({ token, origin } = {}) {
  return new Promise((resolve) => {
    const qs = token === undefined ? "" : `?token=${encodeURIComponent(token)}`;
    let ws;
    try {
      ws = new WS(`ws://127.0.0.1:${PORT}/arena${qs}`, { origin, headers: origin ? { Origin: origin } : undefined });
    } catch (e) {
      return resolve({ opened: false, reason: "construct-threw: " + e.message });
    }
    let settled = false;
    const done = (r) => { if (settled) return; settled = true; try { ws.close(); } catch {} resolve(r); };
    let firstMsg = null;
    ws.on("open", () => {
      // Opened — wait briefly for the server's first frame so we can tell a
      // genuine accept (hello) from an immediate policy close.
      setTimeout(() => done({ opened: true, firstMsg, reason: "open" }), 250);
    });
    ws.on("message", (raw) => { if (firstMsg === null) firstMsg = String(raw).slice(0, 200); });
    ws.on("unexpected-response", (_req, res) => done({ opened: false, reason: `http-${res.statusCode}` }));
    ws.on("error", (e) => done({ opened: false, reason: "error: " + (e.message || e) }));
    ws.on("close", (code) => done({ opened: false, reason: "close-" + code }));
    setTimeout(() => done({ opened: ws.readyState === 1, reason: "timeout" }), 3000);
  });
}

// ============================ TESTS ==========================================
console.log("SECURITY SUITE — these tests should currently be RED, they prove the");
console.log("CSWSH/CSRF/token gaps, and turn GREEN after the Phase-1 fixes land.\n");

await startServer();

section("1. WebSocket upgrade with a foreign Origin must be rejected (CSWSH)");
await it("WS from https://evil.com is refused (never opens)", async () => {
  const r = await wsAttempt({ token: sessionToken(), origin: "https://evil.com" });
  assert.equal(r.opened, false, `foreign-origin WS should be refused, got: ${r.reason}`);
});

section("2. WebSocket upgrade without a session token must be rejected");
await it("WS to /arena without ?token= is refused", async () => {
  const r = await wsAttempt({ origin: TRUSTED_ORIGIN }); // no token at all
  assert.equal(r.opened, false, `tokenless WS should be refused, got: ${r.reason}`);
});

section("3. /api/hooks must require a valid session token (CSRF)");
await it("POST /api/hooks?token=invalid → 403", async () => {
  const r = await rawRequest({
    method: "POST",
    path: "/api/hooks?token=invalid",
    origin: TRUSTED_ORIGIN,
    body: JSON.stringify({ agent: "atlas", event: "Stop" }),
  });
  assert.equal(r.status, 403, `expected 403, got ${r.status} (${r.body.slice(0, 120)})`);
});
await it("GET /api/hooks?token=invalid must not mutate state (403)", async () => {
  const r = await rawRequest({ path: "/api/hooks?token=invalid&agent=atlas&event=Stop", origin: TRUSTED_ORIGIN });
  assert.equal(r.status, 403, `expected 403, got ${r.status} (${r.body.slice(0, 120)})`);
});

section("4. Host-header mismatch must be rejected (DNS-rebinding)");
await it("GET / with Host: attacker.com:9999 → 403", async () => {
  const r = await rawRequest({ path: "/", host: "attacker.com:9999" });
  assert.equal(r.status, 403, `expected 403 for bad Host, got ${r.status}`);
});

section("5. Path traversal must never leak files outside PUBLIC");
await it("GET /%2e%2e/%2e%2e/etc/passwd → non-200, no /etc/passwd content", async () => {
  const r = await rawRequest({ path: "/%2e%2e/%2e%2e/etc/passwd" });
  assert.notEqual(r.status, 200, `traversal should not return 200 (got ${r.status})`);
  assert.ok(!/root:.*:0:0:/.test(r.body), "response must not contain /etc/passwd content");
});
await it("GET /..%252f..%252fetc%252fpasswd (double-encoded) → non-200, no leak", async () => {
  const r = await rawRequest({ path: "/..%252f..%252fetc%252fpasswd" });
  assert.notEqual(r.status, 200, `double-encoded traversal should not return 200 (got ${r.status})`);
  assert.ok(!/root:.*:0:0:/.test(r.body), "response must not contain /etc/passwd content");
});

section("6. Security headers + CSP on served HTML");
await it("GET / carries nosniff, DENY frame, referrer + CSP", async () => {
  const r = await rawRequest({ path: "/" });
  assert.equal(r.headers["x-content-type-options"], "nosniff", "missing X-Content-Type-Options");
  assert.equal(r.headers["x-frame-options"], "DENY", "missing X-Frame-Options: DENY");
  assert.ok((r.headers["referrer-policy"] || "").includes("no-referrer"), "missing Referrer-Policy");
  assert.ok((r.headers["content-security-policy"] || "").includes("default-src 'self'"), "missing/weak CSP");
});

section("7. Positive control — the legitimate cockpit still works");
await it("WS with valid token + localhost origin opens and gets hello", async () => {
  const tok = sessionToken();
  const r = await wsAttempt({ token: tok, origin: TRUSTED_ORIGIN });
  assert.equal(r.opened, true, `legit WS should open, got: ${r.reason}`);
});
await it("GET / from a trusted host returns the cockpit (200)", async () => {
  const r = await rawRequest({ path: "/", origin: TRUSTED_ORIGIN });
  assert.equal(r.status, 200, `expected 200 for trusted GET, got ${r.status}`);
});

// ---- Phase 4 additions: config + reattach trust boundary -------------------
// Spawn a server with custom env and resolve { code, out } once it either
// comes up or exits. Used for the negative config tests (which must exit≠0).
function spawnUntilUpOrExit(env, { expectUp = false } = {}) {
  return new Promise((resolve) => {
    const proc = spawn("node", [path.join(ROOT, "gui/server.js")], {
      cwd: ROOT,
      env: { ...process.env, TEST_CMD: "bash", AUTOSTART: "off", FORGE_PULSE: "0",
        ANTHROPIC_API_KEY: "", AGENTFORGE_NO_TOKEN: "1", AGENTFORGE_WORKTREES: "0", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    const onData = (d) => {
      out += d;
      if (expectUp && out.includes("AgentForge Command up")) { try { proc.kill("SIGTERM"); } catch {} resolve({ code: null, out, up: true }); }
    };
    proc.stdout.setEncoding("utf8"); proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", onData); proc.stderr.on("data", onData);
    proc.on("exit", (code) => resolve({ code, out, up: false }));
    setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} resolve({ code: -1, out, up: false }); }, 6000);
  });
}

function writeAgents(obj) {
  const f = path.join(os.tmpdir(), `afc-agents-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(f, typeof obj === "string" ? obj : JSON.stringify(obj));
  return f;
}

section("7b. /api/agent/<id>/git-status is token-gated");
await it("git-status without a valid token → 403", async () => {
  const r = await rawRequest({ path: "/api/agent/atlas/git-status?token=invalid", origin: TRUSTED_ORIGIN });
  assert.equal(r.status, 403, `expected 403, got ${r.status}`);
});

section("8. Schema validation — a bad agents.json fails loudly (no silent boot)");
await it("invalid agent id pattern → exit 1 with a clear error", async () => {
  const f = writeAgents({ agents: [{ id: "123bad", name: "X", cmd: "claude" }] });
  const r = await spawnUntilUpOrExit({ AGENTFORGE_AGENTS_FILE: f, PORT: "4811" }, { expectUp: true });
  assert.equal(r.code, 1, `expected exit 1, got ${r.code} (up=${r.up})`);
  assert.match(r.out, /failed validation|id must match/i);
});
await it("empty cmd → exit 1 with a clear error", async () => {
  const f = writeAgents({ agents: [{ id: "forge", name: "Forge", cmd: "" }] });
  const r = await spawnUntilUpOrExit({ AGENTFORGE_AGENTS_FILE: f, PORT: "4812" }, { expectUp: true });
  assert.equal(r.code, 1, `expected exit 1, got ${r.code}`);
  assert.match(r.out, /cmd must be a non-empty string/i);
});
await it("missing required 'agents' array → exit 1", async () => {
  const f = writeAgents({ nope: true });
  const r = await spawnUntilUpOrExit({ AGENTFORGE_AGENTS_FILE: f, PORT: "4813" }, { expectUp: true });
  assert.equal(r.code, 1, `expected exit 1, got ${r.code}`);
  assert.match(r.out, /missing required array 'agents'/i);
});
await it("malformed JSON → exit 1 (parse error, not a crash)", async () => {
  const f = writeAgents("{ not json ");
  const r = await spawnUntilUpOrExit({ AGENTFORGE_AGENTS_FILE: f, PORT: "4814" }, { expectUp: true });
  assert.equal(r.code, 1, `expected exit 1, got ${r.code}`);
  assert.match(r.out, /could not read\/parse/i);
});

section("9. Session reattach — a tampered sessions.json cannot execute anything");
await it("a malicious cmd in .team/sessions.json is never launched", async () => {
  // PTYs are launched from agents.json via ptyIndex — NEVER from the persisted
  // session metadata. So even a poisoned sessions.json is inert: relaunching an
  // id that isn't in agents.json is rejected, and the recorded cmd is ignored.
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "afc-sess-"));
  fs.mkdirSync(path.join(repo, ".team"), { recursive: true });
  fs.writeFileSync(path.join(repo, ".team", "sessions.json"), JSON.stringify({
    sessions: [{ id: "evilagent", cmd: "rm -rf /", args: ["--no-preserve-root"], cwd: repo, branch: "main", status: "running" }],
  }));
  const port = 4815;
  const proc = spawn("node", [path.join(ROOT, "gui/server.js")], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), TEST_CMD: "bash", AUTOSTART: "off",
      REPO_DIR: repo, FORGE_PULSE: "0", ANTHROPIC_API_KEY: "", AGENTFORGE_NO_TOKEN: "1", AGENTFORGE_WORKTREES: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    let out = "";
    proc.stdout.setEncoding("utf8"); proc.stdout.on("data", (d) => { out += d; });
    await new Promise((res, rej) => {
      proc.stdout.on("data", () => { if (out.includes("AgentForge Command up")) res(); });
      proc.on("exit", (c) => rej(new Error(`server exited code=${c}`)));
      setTimeout(() => rej(new Error("server didn't boot")), 5000);
    });
    // The orphan is surfaced (display-only)...
    const arena = await (await fetch(`http://127.0.0.1:${port}/api/arena`)).json();
    assert.ok(arena.orphaned.some((s) => s.id === "evilagent"), "orphan should be surfaced for review");
    // ...but trying to (re)launch it is rejected — it is not in agents.json.
    const ws = new WS(`ws://127.0.0.1:${port}/arena`);
    const frames = [];
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", () => rej(new Error("ws error"))); setTimeout(res, 1500); });
    ws.on("message", (m) => { try { frames.push(JSON.parse(m)); } catch {} });
    ws.send(JSON.stringify({ t: "start-pty", id: "evilagent" }));
    await new Promise((r) => setTimeout(r, 600));
    const err = frames.find((f) => f.t === "error" && /unknown pty id/i.test(f.reason || ""));
    const started = frames.find((f) => f.t === "started" && f.id === "evilagent");
    assert.ok(err && !started, "tampered session id must be rejected, never started");
    try { ws.close(); } catch {}
  } finally {
    try { proc.kill("SIGKILL"); } catch {}
    try { fs.rmSync(repo, { recursive: true, force: true }); } catch {}
  }
});

// ============================ TALLY ==========================================
stopServer();
console.log(`\nsecurity-suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
