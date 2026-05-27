#!/usr/bin/env node
// Per-bot smoke test. Launches each of the 12 specialists in turn as a real
// PTY, runs a role-flavoured shell task in it, and asserts the expected
// output came back. Reports per-bot pass/fail at the end. Failures are
// findings — the runner prints them all so we can fix the lot in one pass.
//
// Why bash tasks per bot? Without ANTHROPIC_API_KEY we don't have a real
// LLM in the loop, but the PTY plumbing itself, the start/stop lifecycle,
// the auto-enter watchdog, the input echo path, the started/exit events,
// the per-bot persistence + arena state — all of those are real and worth
// pinning. The shell tasks are intentionally simple but each one matches
// what the matching specialist would *plausibly* do during a real run.

const PORT = Number(process.env.PORT || 4811);
const WSBASE = `ws://127.0.0.1:${PORT}`;
const BASE   = `http://127.0.0.1:${PORT}`;

const ts = () => new Date().toISOString().slice(11, 19);
const c = {
  ok:   (s) => `\x1b[32m${s}\x1b[0m`,
  fail: (s) => `\x1b[31m${s}\x1b[0m`,
  dim:  (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const findings = [];
function note(id, kind, msg) {
  const tag = kind === "ok" ? c.ok("ok  ") : kind === "FAIL" ? c.fail("FAIL") : "    ";
  console.log(`${ts()}  ${tag}  [${id.padEnd(8)}] ${msg}`);
  if (kind === "FAIL") findings.push({ id, msg });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----- WS helpers ----- */

function openWS(p) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WSBASE + p);
    ws.addEventListener("open",  () => resolve(ws), { once: true });
    ws.addEventListener("error", () => reject(new Error("ws open error")), { once: true });
    setTimeout(() => reject(new Error("ws open timeout")), 2000);
  });
}
function bufferedWS(ws) {
  const frames = [];
  ws.addEventListener("message", (ev) => { try { frames.push(JSON.parse(ev.data)); } catch {} });
  return frames;
}
async function waitFor(frames, pred, timeoutMs = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const i = frames.findIndex(pred);
    if (i >= 0) return frames[i];
    await sleep(40);
  }
  return null;
}
async function waitForPrompt(frames, id, timeoutMs = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const recent = frames.filter((m) => m.t === "o" && m.id === id);
    const joined = recent.map((m) => m.d).join("");
    if (/[#$] $/m.test(joined) || joined.includes("[?2004h")) return true;
    await sleep(50);
  }
  return false;
}

/* ----- Per-bot test plan -----
 * Each bot gets:
 *   - cmd:      the shell line we send
 *   - expects:  one or more substrings that must appear in 'o' frames
 *   - cleanup:  optional cleanup line
 * Tasks deliberately stay in-character. */
const PLAN = [
  { id: "atlas",    cmd: 'echo "ATLAS_ONLINE"; whoami | tr -d "\\n"; echo " ATLAS_WHOAMI"',
                    expects: ["ATLAS_ONLINE", "ATLAS_WHOAMI"] },

  { id: "sentinel", cmd: 'find /etc -name "passwd" -type f 2>/dev/null | head -1 | grep -q passwd && echo SENTINEL_SCAN_OK',
                    expects: ["SENTINEL_SCAN_OK"] },

  { id: "aurora",   cmd: 'printf "body { color: #f5b94a; }\\n" > /tmp/aurora-test.css && grep -q "color" /tmp/aurora-test.css && echo AURORA_STYLE_OK',
                    expects: ["AURORA_STYLE_OK"],
                    cleanup: "rm -f /tmp/aurora-test.css" },

  { id: "forge",    cmd: 'mkdir -p /tmp/forge-out && cd /tmp/forge-out && date > BUILD_INFO && test -s BUILD_INFO && echo FORGE_BUILD_OK',
                    expects: ["FORGE_BUILD_OK"],
                    cleanup: "rm -rf /tmp/forge-out" },

  { id: "prism",    cmd: 'for i in 1 2 3; do printf "*"; done; echo " PRISM_RENDER_OK"',
                    expects: ["*** PRISM_RENDER_OK"] },

  { id: "echo",     cmd: 'echo "evt1"; echo "evt2"; echo "evt3"; echo ECHO_STREAM_OK',
                    expects: ["evt1", "evt2", "evt3", "ECHO_STREAM_OK"] },

  { id: "vega",     cmd: 'T=$(date +%N); echo VEGA_PERF_OK_$T',
                    expects: ["VEGA_PERF_OK_"] },

  { id: "scribe",   cmd: 'printf "# Demo\\nDocumented by SCRIBE.\\n" > /tmp/scribe-doc.md && grep -q "SCRIBE" /tmp/scribe-doc.md && echo SCRIBE_DOC_OK',
                    expects: ["SCRIBE_DOC_OK"],
                    cleanup: "rm -f /tmp/scribe-doc.md" },

  { id: "ledger",   cmd: 'TOTAL=0; for c in 12 34 56; do TOTAL=$((TOTAL + c)); done; echo LEDGER_SUM=$TOTAL',
                    expects: ["LEDGER_SUM=102"] },

  { id: "raven",    cmd: 'printf "TRACE\\n  at foo.js:1\\n  at bar.js:2\\n" | wc -l | tr -d " " | xargs -I{} echo RAVEN_TRACE_LINES={}',
                    expects: ["RAVEN_TRACE_LINES=3"] },

  { id: "luma",     cmd: 'CONTRAST=4.5; awk "BEGIN{exit !($CONTRAST >= 4.5)}" && echo LUMA_CONTRAST_OK',
                    expects: ["LUMA_CONTRAST_OK"] },

  { id: "nova",     cmd: 'cat <<\'END\' | wc -w | tr -d " " | xargs -I{} echo NOVA_DEMO_WORDS={}\nAgentForge orchestrates a swarm of specialised Claude Code agents from one local cockpit.\nEND',
                    expects: ["NOVA_DEMO_WORDS=13"] },
];

/* ----- Run ----- */

async function runOne(spec) {
  const ws = await openWS("/arena");
  const frames = bufferedWS(ws);
  const hello = await waitFor(frames, (m) => m.t === "hello", 3000);
  if (!hello) { note(spec.id, "FAIL", "no hello frame"); ws.close(); return; }

  // 1. Launch (without goal — clean shell, no role-prompt paste)
  ws.send(JSON.stringify({ t: "start-pty", id: spec.id }));
  const started = await waitFor(frames, (m) => m.t === "started" && m.id === spec.id, 3000);
  if (!started) { note(spec.id, "FAIL", "did not start within 3s"); ws.close(); return; }
  const promptOk = await waitForPrompt(frames, spec.id, 3000);
  if (!promptOk) { note(spec.id, "FAIL", "shell prompt never appeared"); ws.send(JSON.stringify({ t: "stop-pty", id: spec.id })); ws.close(); return; }
  note(spec.id, "ok", "PTY started · shell ready");

  // 2. Run task with a deterministic marker.
  const mark = `__AFC_${spec.id.toUpperCase()}_DONE__`;
  ws.send(JSON.stringify({ t: "input", id: spec.id, d: spec.cmd + "\r" }));
  ws.send(JSON.stringify({ t: "input", id: spec.id, d: `echo ${mark}\r` }));
  const doneFrame = await waitFor(frames, (m) => m.t === "o" && m.id === spec.id && String(m.d).includes(mark), 5000);
  if (!doneFrame) {
    note(spec.id, "FAIL", "task didn't complete (no done marker)");
    ws.send(JSON.stringify({ t: "stop-pty", id: spec.id })); ws.close(); return;
  }

  // 3. Verify expectations against the full output.
  const allOut = frames.filter((m) => m.t === "o" && m.id === spec.id).map((m) => String(m.d)).join("");
  let missed = [];
  for (const ex of spec.expects) if (!allOut.includes(ex)) missed.push(ex);
  if (missed.length) note(spec.id, "FAIL", `task output missing: ${missed.join(", ")}`);
  else               note(spec.id, "ok", `task output contains all expected markers (${spec.expects.length})`);

  // 4. Cleanup task (best-effort, no assertion).
  if (spec.cleanup) {
    ws.send(JSON.stringify({ t: "input", id: spec.id, d: spec.cleanup + "\r" }));
    await sleep(150);
  }

  // 5. Stop cleanly + verify exit event arrives.
  ws.send(JSON.stringify({ t: "stop-pty", id: spec.id }));
  const exitFrame = await waitFor(frames, (m) => m.t === "exit" && m.id === spec.id, 3000);
  if (!exitFrame) note(spec.id, "FAIL", "did not emit exit frame after stop-pty");
  else            note(spec.id, "ok", `exited cleanly (code=${exitFrame.code ?? "?"})`);

  ws.close();
}

async function main() {
  console.log(c.bold(`AgentForge · per-bot smoke (${PLAN.length} specialists)`));
  for (const spec of PLAN) {
    console.log(c.dim(`---- ${spec.id} ----`));
    await runOne(spec);
  }

  // Also exercise the dispatch path (start-pty WITH a goal). In TEST_CMD=bash
  // the briefing isn't valid shell, but the test cares about the protocol:
  // we should see started + at least some output the server pasted from
  // def.prompt, then a clean exit.
  console.log("");
  console.log(c.bold("Dispatch path · start-pty WITH goal pastes briefing"));
  for (const id of PLAN.map((p) => p.id)) {
    console.log(c.dim(`---- ${id} (with goal) ----`));
    await runWithGoal(id, "test-goal-" + id);
  }

  // Stress test: launch all 12 at once and verify every started + every
  // exit event arrives. Catches issues like the PTY index map racing, the
  // arenaBroadcast loop skipping clients, or node-pty hitting fd limits.
  console.log("");
  console.log(c.bold("Concurrent launch · all 12 specialists simultaneously"));
  await runConcurrent(PLAN.map((p) => p.id));

  console.log("");
  console.log(c.bold("Summary:"));
  const total = PLAN.length;
  const ok = total - new Set(findings.map((f) => f.id)).size;
  console.log(`  ${ok}/${total} bots fully passed (across all phases)`);
  if (findings.length) {
    console.log(`  ${findings.length} findings:`);
    for (const f of findings) console.log(`    - [${f.id}] ${f.msg}`);
  }
  process.exit(findings.length === 0 ? 0 : 1);
}

async function runWithGoal(id, goal) {
  const ws = await openWS("/arena");
  const frames = bufferedWS(ws);
  await waitFor(frames, (m) => m.t === "hello", 3000);
  ws.send(JSON.stringify({ t: "start-pty", id, goal }));
  const started = await waitFor(frames, (m) => m.t === "started" && m.id === id, 3000);
  if (!started) { note(id, "FAIL", "did not start (with goal)"); ws.close(); return; }
  // The server defers the paste 900ms + Enter 150ms. Allow 1.6s.
  await sleep(1700);
  const all = frames.filter((m) => m.t === "o" && m.id === id).map((m) => String(m.d)).join("");
  // Briefing prompts mention either the agent's NAME or "{{GOAL}}" replacement.
  const briefingSeen = new RegExp(id, "i").test(all) || all.includes(goal);
  if (briefingSeen) note(id, "ok", "briefing payload reached the PTY (auto-dispatch path)");
  else              note(id, "FAIL", "briefing payload never arrived in PTY output");
  ws.send(JSON.stringify({ t: "stop-pty", id }));
  await waitFor(frames, (m) => m.t === "exit" && m.id === id, 3000);
  ws.close();
}

async function runConcurrent(ids) {
  const ws = await openWS("/arena");
  const frames = bufferedWS(ws);
  await waitFor(frames, (m) => m.t === "hello", 3000);
  // Fire all start-ptys back-to-back.
  for (const id of ids) ws.send(JSON.stringify({ t: "start-pty", id }));
  // Each must produce a "started" event within 4s.
  const startedSeen = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 6000 && startedSeen.size < ids.length) {
    for (const f of frames) if (f.t === "started" && ids.includes(f.id)) startedSeen.add(f.id);
    await sleep(80);
  }
  for (const id of ids) {
    if (startedSeen.has(id)) note(id, "ok", "concurrent launch · started");
    else                     note(id, "FAIL", "concurrent launch · never started");
  }
  // Now stop all and verify every exit arrives.
  for (const id of ids) ws.send(JSON.stringify({ t: "stop-pty", id }));
  const exitSeen = new Set();
  const t1 = Date.now();
  while (Date.now() - t1 < 4000 && exitSeen.size < ids.length) {
    for (const f of frames) if (f.t === "exit" && ids.includes(f.id)) exitSeen.add(f.id);
    await sleep(80);
  }
  for (const id of ids) {
    if (exitSeen.has(id)) note(id, "ok", "concurrent launch · exited");
    else                  note(id, "FAIL", "concurrent launch · never exited");
  }
  ws.close();
}

main().catch((e) => { console.error("simulator crashed:", e); process.exit(2); });
