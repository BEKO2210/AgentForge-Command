#!/usr/bin/env node
// AgentForge — worktree isolation + session reattach suite (Phase 3).
//
// Spawns the real server against a THROWAWAY git repo (REPO_DIR=tmp) so it can
// exercise git-worktree creation for real without touching the project repo.
// Proves: per-specialist worktrees on separate branches, parallel edits don't
// collide, cleanup policy, non-git fallback, and orphaned-session reattach.
// Runs in NO_TOKEN mode (auth is owned by tests/security-suite.mjs).

import * as assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
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

// dependency + git guard
try {
  const r = createRequire(new URL("../gui/", import.meta.url));
  await import(r.resolve("node-pty"));
  await import(r.resolve("ws"));
  execFileSync("git", ["--version"], { stdio: "pipe" });
} catch (e) {
  console.log("== worktree suite ==");
  console.log("  - skipped (need gui native deps + git: " + String(e.message || e) + ")");
  console.log("\nworktree-suite: 0 passed, 0 failed (skipped)");
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
const tmpDirs = [];
process.on("exit", () => {
  for (const p of procs) { try { p.kill("SIGKILL"); } catch {} }
  for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }
});

function git(args, cwd) { return execFileSync("git", args, { cwd, stdio: "pipe", encoding: "utf8" }); }

function makeGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "afc-wt-"));
  tmpDirs.push(dir);
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.email", "t@t.t"], dir);
  git(["config", "user.name", "t"], dir);
  git(["config", "commit.gpgsign", "false"], dir); // throwaway repo: never sign
  fs.writeFileSync(path.join(dir, "README.md"), "seed\n");
  git(["add", "-A"], dir);
  git(["commit", "-q", "--no-gpg-sign", "-m", "seed"], dir);
  return dir;
}
function makePlainDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "afc-plain-"));
  tmpDirs.push(dir);
  return dir;
}

async function boot(repoDir, extraEnv = {}) {
  const port = 4820 + Math.floor(Math.random() * 60);
  const proc = spawn("node", [path.join(ROOT, "gui/server.js")], {
    cwd: ROOT,
    env: {
      ...process.env, PORT: String(port), TEST_CMD: "bash", AUTOSTART: "off",
      REPO_DIR: repoDir, FORGE_PULSE: "0", ANTHROPIC_API_KEY: "",
      AGENTFORGE_NO_TOKEN: "1", ...extraEnv,
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
    base, port,
    get: async (p) => { const r = await fetch(base + p); return { status: r.status, json: await r.json().catch(() => null) }; },
    stopAndWait: () => new Promise((res) => { proc.once("exit", res); try { proc.kill("SIGTERM"); } catch { res(); } setTimeout(res, 2500); }),
  };
}

function openWS(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/arena`);
  const frames = [];
  ws.addEventListener("message", (ev) => { try { frames.push(JSON.parse(ev.data)); } catch {} });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve({
      send: (m) => ws.send(JSON.stringify(m)),
      waitFor: async (pred, ms = 3000) => {
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

const wt = (repo, id) => path.join(repo, ".agentforge", "worktrees", id);

/* ============================ TESTS ============================ */

section("Worktree isolation — per specialist, separate branch");
await it("two specialists get distinct worktrees on agentforge/<id> branches", async () => {
  const repo = makeGitRepo();
  const srv = await boot(repo);
  try {
    const ws = await openWS(srv.port);
    ws.send({ t: "start-pty", id: "forge" });
    ws.send({ t: "start-pty", id: "sentinel" });
    assert.ok(await ws.waitFor((f) => f.t === "started" && f.id === "forge"), "forge did not start");
    assert.ok(await ws.waitFor((f) => f.t === "started" && f.id === "sentinel"), "sentinel did not start");
    await sleep(300);
    assert.ok(fs.existsSync(wt(repo, "forge")), "forge worktree dir missing");
    assert.ok(fs.existsSync(wt(repo, "sentinel")), "sentinel worktree dir missing");
    const branches = git(["branch", "--list", "agentforge/*"], repo);
    assert.match(branches, /agentforge\/forge/);
    assert.match(branches, /agentforge\/sentinel/);
    ws.close();
  } finally { await srv.stopAndWait(); }
});

await it("atlas (lead) stays on the shared repo — no worktree", async () => {
  const repo = makeGitRepo();
  const srv = await boot(repo);
  try {
    const ws = await openWS(srv.port);
    ws.send({ t: "start-pty", id: "atlas" });
    assert.ok(await ws.waitFor((f) => f.t === "started" && f.id === "atlas"), "atlas did not start");
    await sleep(200);
    assert.ok(!fs.existsSync(wt(repo, "atlas")), "atlas must not get a worktree");
    ws.close();
  } finally { await srv.stopAndWait(); }
});

await it("parallel edits to the same filename do not collide", async () => {
  const repo = makeGitRepo();
  const srv = await boot(repo);
  try {
    const ws = await openWS(srv.port);
    ws.send({ t: "start-pty", id: "forge" });
    ws.send({ t: "start-pty", id: "sentinel" });
    await ws.waitFor((f) => f.t === "started" && f.id === "sentinel");
    await sleep(400); // let bash settle
    ws.send({ t: "input", id: "forge", d: "printf forge-edit > shared.txt\r" });
    ws.send({ t: "input", id: "sentinel", d: "printf sentinel-edit > shared.txt\r" });
    await sleep(700);
    assert.equal(fs.readFileSync(path.join(wt(repo, "forge"), "shared.txt"), "utf8"), "forge-edit");
    assert.equal(fs.readFileSync(path.join(wt(repo, "sentinel"), "shared.txt"), "utf8"), "sentinel-edit");
    ws.close();
  } finally { await srv.stopAndWait(); }
});

section("Worktree lifecycle — cleanup policy");
await it("worktree is KEPT after stop by default (no CLEANUP)", async () => {
  const repo = makeGitRepo();
  const srv = await boot(repo);
  try {
    const ws = await openWS(srv.port);
    ws.send({ t: "start-pty", id: "forge" });
    await ws.waitFor((f) => f.t === "started" && f.id === "forge");
    await sleep(200);
    ws.send({ t: "stop-pty", id: "forge" });
    await sleep(400);
    assert.ok(fs.existsSync(wt(repo, "forge")), "worktree should be kept for review by default");
    ws.close();
  } finally { await srv.stopAndWait(); }
});

await it("worktree is REMOVED on stop when AGENTFORGE_WORKTREE_CLEANUP=1", async () => {
  const repo = makeGitRepo();
  const srv = await boot(repo, { AGENTFORGE_WORKTREE_CLEANUP: "1" });
  try {
    const ws = await openWS(srv.port);
    ws.send({ t: "start-pty", id: "forge" });
    await ws.waitFor((f) => f.t === "started" && f.id === "forge");
    await sleep(200);
    assert.ok(fs.existsSync(wt(repo, "forge")), "worktree should exist before stop");
    ws.send({ t: "stop-pty", id: "forge" });
    await sleep(500);
    assert.ok(!fs.existsSync(wt(repo, "forge")), "worktree should be removed with cleanup on");
    ws.close();
  } finally { await srv.stopAndWait(); }
});

section("Fallback — non-git repo uses shared dir, no error");
await it("a non-git REPO_DIR starts the PTY without a worktree", async () => {
  const dir = makePlainDir();
  const srv = await boot(dir);
  try {
    const ws = await openWS(srv.port);
    ws.send({ t: "start-pty", id: "forge" });
    const started = await ws.waitFor((f) => f.t === "started" && f.id === "forge");
    const errd = await ws.waitFor((f) => f.t === "launch-error" && f.id === "forge", 300);
    assert.ok(started && !errd, "forge should start cleanly in a non-git dir");
    assert.ok(!fs.existsSync(path.join(dir, ".agentforge")), "no worktree dir in a non-git repo");
    ws.close();
  } finally { await srv.stopAndWait(); }
});

section("Session reattach — metadata persists, orphans surface on restart");
await it("sessions.json is written and orphans are surfaced after restart", async () => {
  const repo = makeGitRepo();
  const srv1 = await boot(repo);
  try {
    const ws = await openWS(srv1.port);
    ws.send({ t: "start-pty", id: "forge" });
    await ws.waitFor((f) => f.t === "started" && f.id === "forge");
    await sleep(200);
    ws.close();
    const sFile = path.join(repo, ".team", "sessions.json");
    assert.ok(fs.existsSync(sFile), ".team/sessions.json should be written");
    const saved = JSON.parse(fs.readFileSync(sFile, "utf8"));
    assert.ok(saved.sessions.some((s) => s.id === "forge"), "forge should be in saved sessions");
  } finally { await srv1.stopAndWait(); }
  // restart against the same repo → forge should be reported as orphaned
  const srv2 = await boot(repo);
  try {
    const { json } = await srv2.get("/api/arena");
    assert.ok(Array.isArray(json.orphaned), "arena should expose an orphaned array");
    const forge = json.orphaned.find((s) => s.id === "forge");
    assert.ok(forge, "forge should be surfaced as orphaned after restart");
    assert.equal(forge.status, "orphaned");
    assert.equal(forge.branch, "agentforge/forge");
  } finally { await srv2.stopAndWait(); }
});

console.log(`\nworktree-suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
