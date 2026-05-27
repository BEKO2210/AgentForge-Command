#!/usr/bin/env node
// End-to-end simulator. Plays the role of an operator using the AgentForge
// cockpit to build a small static test site:
//
//   1. operator connects to /arena and watches the hello/spend handshake
//   2. operator launches three specialists as real PTYs (TEST_CMD=bash):
//        forge   — builds dirs + writes index.html + a tiny server stub
//        scribe  — writes a README + a small CSS file
//        sentinel— runs a smoke test against the built site
//   3. operator broadcasts a swarm-wide nudge
//   4. operator persists evolution + auto-enter, then re-reads /api/arena
//      to confirm the round-trip
//   5. operator stops every PTY and verifies the exits arrive cleanly
//
// Along the way we log every step, every server message, and every assertion.
// Failures are collected and printed at the end. No external deps — Node 22
// global WebSocket + global fetch.

import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT || 4810);
const BASE = `http://127.0.0.1:${PORT}`;
const WSBASE = `ws://127.0.0.1:${PORT}`;
const OUT_DIR = "/tmp/agentforge-demo-site";

// ---- Scoreboard --------------------------------------------------------

const findings = [];
function note(kind, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const tag = kind === "ok"   ? "\x1b[32mok\x1b[0m"
           : kind === "FAIL" ? "\x1b[31mFAIL\x1b[0m"
           : kind === "BUG"  ? "\x1b[35mBUG\x1b[0m"
           :                    "  ";
  console.log(`${ts}  ${tag}  ${msg}`);
  if (kind === "FAIL" || kind === "BUG") findings.push({ kind, msg });
}

// ---- WS helpers --------------------------------------------------------

function openWS(p) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WSBASE + p);
    ws.addEventListener("open",  () => resolve(ws),  { once: true });
    ws.addEventListener("error", () => reject(new Error("ws open error")), { once: true });
    setTimeout(() => reject(new Error("ws open timeout")), 2000);
  });
}
function bufferedWS(ws) {
  const frames = [];
  ws.addEventListener("message", (ev) => { try { frames.push(JSON.parse(ev.data)); } catch {} });
  return frames;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(frames, pred, timeoutMs = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const i = frames.findIndex(pred);
    if (i >= 0) return frames[i];
    await sleep(40);
  }
  throw new Error("waitFor timeout · last 5 frames: " +
    frames.slice(-5).map((f) => f.t + (f.id ? "/" + f.id : "")).join(", "));
}

// Wait until a freshly-started PTY shows its shell prompt. The bash prompt
// in TEST_CMD mode ends with "# " (root) or "$ ", and bracketed-paste mode
// prints "[?2004h". We wait for either marker before driving the session.
async function waitForPrompt(frames, id, timeoutMs = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const recent = frames.filter((m) => m.t === "o" && m.id === id);
    const joined = recent.map((m) => m.d).join("");
    if (/[#$] $/m.test(joined) || joined.includes("[?2004h")) return true;
    await sleep(60);
  }
  throw new Error(`prompt for ${id} did not arrive in ${timeoutMs}ms`);
}

// Send shell command to a PTY and wait until our marker comes back. We
// filter by id so the three running specialists don't mix their markers.
async function shell(ws, id, frames, cmd, timeoutMs = 4000) {
  ws.send(JSON.stringify({ t: "input", id, d: cmd + "\r" }));
  const mark = "__AFC_DONE_" + Math.random().toString(36).slice(2, 8) + "__";
  ws.send(JSON.stringify({ t: "input", id, d: `echo ${mark}\r` }));
  await waitFor(frames, (m) => m.t === "o" && m.id === id && String(m.d).includes(mark), timeoutMs);
  return true;
}

// ---- Main simulation ---------------------------------------------------

async function main() {
  // Clean slate for the demo site.
  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  note(">>", "Connecting to /arena…");
  const ws = await openWS("/arena");
  const frames = bufferedWS(ws);
  const hello = await waitFor(frames, (m) => m.t === "hello");
  note("ok", `hello received · leadId=${hello.leadId}, swarm=${hello.ptyAgents.length}, llm=${hello.llm.enabled}, pulse=${hello.pulse}`);

  if (hello.leadId !== "atlas") note("BUG", `hello.leadId is "${hello.leadId}", expected "atlas"`);
  if (hello.ptyAgents.length !== 12) note("BUG", `hello.ptyAgents count is ${hello.ptyAgents.length}, expected 12`);
  if (!hello.spend) note("BUG", "hello has no spend snapshot");
  if (!hello.spend.forecast) note("BUG", "hello.spend has no forecast");

  /* ----- 1. Launch forge as a real PTY ----- */

  note(">>", "Launching FORGE specialist (real PTY)…");
  ws.send(JSON.stringify({ t: "start-pty", id: "forge" }));
  await waitFor(frames, (m) => m.t === "started" && m.id === "forge");
  await waitForPrompt(frames, "forge");
  note("ok", "forge PTY started and shell prompt ready");

  note(">>", "FORGE: scaffolding the demo site…");
  await shell(ws, "forge", frames, `mkdir -p ${OUT_DIR}`);
  await shell(ws, "forge", frames, `cd ${OUT_DIR} && pwd`);
  await shell(ws, "forge", frames, `cat > ${OUT_DIR}/index.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AgentForge demo</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <h1>Built by the swarm</h1>
  <p id="status">loading…</p>
  <script src="app.js"></script>
</body>
</html>
HTML`);
  note("ok", "forge wrote index.html");

  /* ----- 2. Scribe writes README + CSS ----- */

  note(">>", "Launching SCRIBE specialist…");
  ws.send(JSON.stringify({ t: "start-pty", id: "scribe" }));
  await waitFor(frames, (m) => m.t === "started" && m.id === "scribe");
  await waitForPrompt(frames, "scribe");
  await shell(ws, "scribe", frames, `cat > ${OUT_DIR}/style.css <<'CSS'
body { font:14px/1.5 ui-sans-serif,system-ui; background:#05080f; color:#f1f5fb; max-width:640px; margin:48px auto; padding:0 22px; }
h1 { color:#f5b94a; letter-spacing:.5px; }
#status.ok { color:#54e6a8; }
#status.err { color:#ff6b7d; }
CSS`);
  await shell(ws, "scribe", frames, `cat > ${OUT_DIR}/app.js <<'JS'
document.getElementById("status").textContent = "online · built by atlas + forge + scribe + sentinel";
document.getElementById("status").classList.add("ok");
JS`);
  await shell(ws, "scribe", frames, `cat > ${OUT_DIR}/README.md <<'MD'
# AgentForge demo site

Built end-to-end by the AgentForge swarm during a live simulator run.
MD`);
  note("ok", "scribe wrote style.css + app.js + README.md");

  /* ----- 3. Sentinel runs a smoke test ----- */

  note(">>", "Launching SENTINEL specialist…");
  ws.send(JSON.stringify({ t: "start-pty", id: "sentinel" }));
  await waitFor(frames, (m) => m.t === "started" && m.id === "sentinel");
  await waitForPrompt(frames, "sentinel");
  await shell(ws, "sentinel", frames, `cd ${OUT_DIR} && ls -1`);
  await shell(ws, "sentinel", frames, `test -s ${OUT_DIR}/index.html && echo INDEX_OK`);
  await shell(ws, "sentinel", frames, `test -s ${OUT_DIR}/style.css && echo CSS_OK`);
  await shell(ws, "sentinel", frames, `test -s ${OUT_DIR}/app.js && echo JS_OK`);
  await shell(ws, "sentinel", frames, `grep -q 'Built by the swarm' ${OUT_DIR}/index.html && echo HEADLINE_OK`);

  const want = ["INDEX_OK", "CSS_OK", "JS_OK", "HEADLINE_OK"];
  for (const w of want) {
    const seen = frames.some((m) => m.t === "o" && m.id === "sentinel" && String(m.d).includes(w));
    if (seen) note("ok", `sentinel smoke check: ${w}`);
    else      note("FAIL", `sentinel smoke check missing: ${w}`);
  }

  /* ----- 4. Report path: each specialist's output should land in Atlas's
   *        mission stream. The arena UI does this in the browser, but
   *        the server's pulse/o frames are the source. We assert the o
   *        frames actually reached us so the UI can do its thing. */

  const oFromForge = frames.filter((m) => m.t === "o" && m.id === "forge").length;
  const oFromScribe = frames.filter((m) => m.t === "o" && m.id === "scribe").length;
  const oFromSentinel = frames.filter((m) => m.t === "o" && m.id === "sentinel").length;
  note(oFromForge    > 5 ? "ok" : "BUG", `forge   produced ${oFromForge} output frames`);
  note(oFromScribe   > 5 ? "ok" : "BUG", `scribe  produced ${oFromScribe} output frames`);
  note(oFromSentinel > 5 ? "ok" : "BUG", `sentinel produced ${oFromSentinel} output frames`);

  /* ----- 5. Atlas-brief without API key → expect a clean error ----- */

  note(">>", "atlas-brief without ANTHROPIC_API_KEY (expect graceful error)…");
  ws.send(JSON.stringify({ t: "atlas-brief", goal: "tell every specialist to wave", roster: [] }));
  const err = await waitFor(frames, (m) => m.t === "atlas-brief-error");
  if (/ANTHROPIC_API_KEY/.test(err.reason || "")) note("ok", "atlas-brief gracefully refused without a key");
  else note("FAIL", `atlas-brief error reason was: ${err.reason}`);

  /* ----- 6. Persistence round-trip ----- */

  note(">>", "Persisting evolution + autoEnter + customAgents…");
  ws.send(JSON.stringify({
    t: "persist",
    evolution: { atlas: 5, forge: 4, sentinel: 3 },
    customAgents: [{
      id: "oracle-sim", name: "ORACLE", title: "Sim test", role: "Q",
      superSkill: "verify", mascot: "owl", color: "#5b8cff", seed: false,
    }],
    atlasMission: "build demo site",
  }));
  await waitFor(frames, (m) => m.t === "persist-ack");
  const api = await (await fetch(BASE + "/api/arena")).json();
  if (api.evolution.atlas === 5 && api.evolution.forge === 4 && api.evolution.sentinel === 3) note("ok", "evolution persisted");
  else note("BUG", `evolution round-trip wrong: ${JSON.stringify(api.evolution)}`);
  if (api.customAgents.length === 1 && api.customAgents[0].id === "oracle-sim") note("ok", "custom agent persisted");
  else note("BUG", `customAgents round-trip wrong: ${JSON.stringify(api.customAgents)}`);
  if (api.atlasMission === "build demo site") note("ok", "atlasMission persisted");
  else note("BUG", `atlasMission round-trip wrong: ${api.atlasMission}`);

  /* ----- 7. Auto-enter watchdog end-to-end ----- */

  note(">>", "Arming auto-enter on forge and triggering a (y/n) prompt…");
  ws.send(JSON.stringify({ t: "auto-config", agents: [{ id: "forge" }] }));
  const ack = await waitFor(frames, (m) => m.t === "auto-config-ack");
  if (ack.autoEnter.includes("forge")) note("ok", "auto-config-ack lists forge");
  else note("BUG", `auto-config-ack did not include forge: ${JSON.stringify(ack.autoEnter)}`);
  ws.send(JSON.stringify({ t: "input", id: "forge",
    d: "echo 'continue? (y/n)'; read -p '> ' R; echo \"REPLY=[$R]\"\r" }));
  const fired = await waitFor(frames, (m) => m.t === "auto-fired" && m.target === "forge", 5000);
  note("ok", `auto-fired emitted: reason="${fired.reason}"`);
  // The bash `read` should have returned empty because the server pressed Enter.
  await sleep(500);
  const replyFrame = frames.find((m) => m.t === "o" && m.id === "forge" && String(m.d).includes("REPLY=[]"));
  if (replyFrame) note("ok", "bash 'read' received empty input → auto-enter actually pressed Enter");
  else note("FAIL", "could not confirm the REPLY=[] line — auto-enter may have written something else");

  /* ----- 8. Multi-target broadcast (SWARM mode) ----- */

  note(">>", "Broadcasting raw text to every running PTY…");
  const baseO = frames.length;
  for (const id of ["forge", "scribe", "sentinel"]) {
    ws.send(JSON.stringify({ t: "input", id, d: "echo BROADCAST_HEARD_BY_$$\r" }));
  }
  await sleep(800);
  let heard = 0;
  for (const id of ["forge", "scribe", "sentinel"]) {
    if (frames.slice(baseO).some((m) => m.t === "o" && m.id === id && String(m.d).includes("BROADCAST_HEARD_BY_"))) heard++;
  }
  note(heard === 3 ? "ok" : "BUG", `broadcast heard by ${heard}/3 running specialists`);

  /* ----- 9. Stop all PTYs cleanly ----- */

  note(">>", "Stopping every PTY…");
  for (const id of ["forge", "scribe", "sentinel"]) {
    ws.send(JSON.stringify({ t: "stop-pty", id }));
  }
  await sleep(800);
  for (const id of ["forge", "scribe", "sentinel"]) {
    const exit = frames.find((m) => m.t === "exit" && m.id === id);
    if (exit) note("ok", `${id} exited cleanly (code=${exit.code ?? "?"})`);
    else      note("FAIL", `${id} did not emit an exit frame`);
  }

  /* ----- 10. The demo site really exists on disk ----- */

  const files = ["index.html", "style.css", "app.js", "README.md"];
  for (const f of files) {
    const full = path.join(OUT_DIR, f);
    if (fs.existsSync(full) && fs.statSync(full).size > 10) note("ok", `disk: ${f} exists (${fs.statSync(full).size}b)`);
    else note("FAIL", `disk: ${f} missing or empty`);
  }

  // Validate the generated HTML actually parses (basic sanity).
  const html = fs.readFileSync(path.join(OUT_DIR, "index.html"), "utf8");
  if (html.includes("<title>") && html.includes("</html>")) note("ok", "index.html is a structurally complete document");
  else note("FAIL", "index.html is malformed");

  ws.close();

  /* ----- Summary ----- */

  console.log("");
  console.log(`findings: ${findings.length}`);
  for (const f of findings) console.log(`  [${f.kind}] ${f.msg}`);
  process.exit(findings.length === 0 ? 0 : 1);
}

main().catch((e) => {
  note("FAIL", "simulator crashed: " + e.message);
  console.error(e);
  process.exit(2);
});
