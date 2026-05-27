#!/usr/bin/env node
// Visual state-machine test.
//
// Spawns headless Chromium against the LIVE server, navigates to
// /docs/mascot-preview.html, then for each fully-wired specialist takes a
// screenshot of its 10-state row. The output is one PNG per mascot in
// docs/state-shots/, which makes regressions obvious at a glance: if a state
// looks identical to its neighbour, the animation isn't doing its job.
//
// No npm deps — drives Chrome over its `--remote-debugging-pipe` stdio.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT  = path.join(ROOT, "docs", "state-shots");
fs.mkdirSync(OUT, { recursive: true });

const PORT = Number(process.env.PORT || 4830);
const CHROME = process.env.CHROME
  || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const WIRED = ["atlas", "sentinel", "aurora", "forge", "prism", "echo", "vega", "scribe", "ledger", "raven", "luma"];

/* ----- Chrome / CDP plumbing (same pattern as render-screenshots.mjs) ----- */

let chrome = null, cdpPipeOut = null, cdpPipeIn = null;
let nextId = 1;
const cdpPending = new Map();
let sessionId = null;

async function startChrome() {
  const userDir = fs.mkdtempSync(path.join("/tmp", "afc-states-"));
  chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu",
    "--disable-dev-shm-usage", "--hide-scrollbars",
    "--remote-debugging-pipe", "--remote-allow-origins=*",
    `--user-data-dir=${userDir}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  cdpPipeIn = chrome.stdio[3]; cdpPipeOut = chrome.stdio[4];
  cdpPipeOut.setEncoding("utf8");
  let buf = "";
  cdpPipeOut.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\0")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.id && cdpPending.has(m.id)) {
        const { res, rej } = cdpPending.get(m.id); cdpPending.delete(m.id);
        if (m.error) rej(new Error(`CDP ${m.error.code}: ${m.error.message}`));
        else res(m.result);
      }
    }
  });
}
function stopChrome() { if (chrome) try { chrome.kill("SIGTERM"); } catch {} }
process.on("exit", stopChrome);

function cdp(method, params = {}, sid) {
  return new Promise((res, rej) => {
    const id = nextId++; cdpPending.set(id, { res, rej });
    const env = { id, method, params }; if (sid) env.sessionId = sid;
    cdpPipeIn.write(JSON.stringify(env) + "\0");
    setTimeout(() => { if (cdpPending.has(id)) { cdpPending.delete(id); rej(new Error(`CDP ${method} timeout`)); } }, 30000);
  });
}

async function attach() {
  const { targetInfos } = await cdp("Target.getTargets");
  const page = targetInfos.find((t) => t.type === "page") || targetInfos[0];
  const { sessionId: sid } = await cdp("Target.attachToTarget", { targetId: page.targetId, flatten: true });
  sessionId = sid;
  await cdp("Page.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);
  await cdp("DOM.enable", {}, sessionId);
}
async function setViewport(width, height) {
  await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
}
async function navigate(url, waitSel) {
  await cdp("Page.navigate", { url }, sessionId);
  await new Promise((r) => setTimeout(r, 1200));
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    const r = await cdp("Runtime.evaluate", { expression: `!!document.querySelector(${JSON.stringify(waitSel)})`, returnByValue: true }, sessionId);
    if (r.result.value === true) { await new Promise((r) => setTimeout(r, 400)); return; }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("selector " + waitSel + " never appeared");
}
async function evalJS(expr) {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error("JS error: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
async function shot(name) {
  const { data } = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true }, sessionId);
  const p = path.join(OUT, `${name}.png`);
  fs.writeFileSync(p, Buffer.from(data, "base64"));
  const stat = fs.statSync(p);
  console.log(`  ${name}.png  (${(stat.size / 1024).toFixed(1)} KB)`);
  return p;
}

/* ----- The actual test ------------------------------------------------- */

await startChrome();
await attach();
await setViewport(1500, 900);

const URL = `http://127.0.0.1:${PORT}/`;
const PREVIEW_URL = `http://127.0.0.1:${PORT}/mascot-preview.html`;

console.log("[states] navigating to preview…");
await navigate(PREVIEW_URL, ".mascot");

// For each wired mascot, scroll to its row and crop the screen to that row.
for (const id of WIRED) {
  console.log(`[states] capturing ${id}…`);
  // Find the H2 header for this mascot and scroll it into view at the top.
  await evalJS(`(() => {
    const h2s = Array.from(document.querySelectorAll("h2"));
    const h = h2s.find(h => h.textContent.toLowerCase().includes(${JSON.stringify(id)}));
    if (!h) throw new Error("no header for ${id}");
    h.scrollIntoView({ block: "start" });
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 400));
  await shot(`${id}-states`);
}

/* ----- End-to-end hook integration test against the LIVE server -------- */

console.log("");
console.log("[hooks] verifying tool-hook → animation-state pipeline");

// Open the live cockpit and exercise the hook endpoint for each wired mascot
await navigate(URL, "#agent-grid .tcard");
await new Promise((r) => setTimeout(r, 800));

// Helper: POST a hook and check the corresponding card actually changes class
async function checkHook(agent, event, tool, expectedState) {
  // Atlas lives in the lead panel up top, specialists in cards in the grid.
  // For each, the mascot SVG sits inside a wrapper element we can find by
  // either data-id (cards) or class (lead-mascot-wrap for atlas).
  const ok = await evalJS(`(async () => {
    const isLead = ${JSON.stringify(agent)} === "atlas";
    let svgSelector;
    if (isLead) svgSelector = ".lead-mascot-wrap .mascot";
    else        svgSelector = '[data-id="${agent}"] .mascot-slot .mascot';
    let svg = document.querySelector(svgSelector);
    if (!svg) return { ok:false, reason:"no mascot svg for " + ${JSON.stringify(agent)} };
    const r = await fetch(${JSON.stringify(`http://127.0.0.1:${PORT}/api/hooks`)}, {
      method: "POST", headers: {"content-type":"application/json"},
      body: JSON.stringify({ agent: ${JSON.stringify(agent)}, event: ${JSON.stringify(event)}, tool: ${JSON.stringify(tool || "")} }),
    });
    const j = await r.json();
    // Wait up to 700ms for the websocket round-trip to update the state.
    // The mascot SVG gets replaced when the store changes, so we have to
    // re-query the element on each tick.
    for (let i = 0; i < 14; i++) {
      await new Promise(r2 => setTimeout(r2, 50));
      svg = document.querySelector(svgSelector);
      if (!svg) continue;
      const cls = Array.from(svg.classList).find(c => c.startsWith("state-"));
      if (cls === "state-" + ${JSON.stringify(expectedState)}) {
        return { ok:true, reqState: j.state, sawClass: cls };
      }
    }
    svg = document.querySelector(svgSelector);
    const cls = svg ? (Array.from(svg.classList).find(c => c.startsWith("state-")) || "(no state class)") : "(no svg)";
    return { ok:false, reason:"didn't observe expected class", reqState:j.state, sawClass:cls };
  })()`);
  const tag = ok.ok ? "\x1b[32mok\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  ${tag} ${agent.padEnd(8)} hook=${event}${tool?":"+tool:""} → expected state-${expectedState} → ${JSON.stringify(ok)}`);
  return ok.ok;
}

const cases = [
  { agent: "sentinel", event: "PreToolUse",  tool: "Read",      expect: "reading" },
  { agent: "sentinel", event: "PreToolUse",  tool: "Write",     expect: "working" },
  { agent: "sentinel", event: "PreToolUse",  tool: "Task",      expect: "thinking" },
  { agent: "aurora",   event: "Notification", expect: "listening" },
  { agent: "aurora",   event: "PostToolUse", expect: "success" },
  { agent: "forge",    event: "PreToolUse",  tool: "Bash",      expect: "working" },
  { agent: "forge",    event: "PreToolUse",  tool: "Grep",      expect: "reading" },
  { agent: "atlas",    event: "Stop",        expect: "idle" },
];

let pass = 0;
for (const c of cases) if (await checkHook(c.agent, c.event, c.tool, c.expect)) pass++;
console.log("");
console.log(`hook→state pipeline: ${pass}/${cases.length} pass`);

stopChrome();
process.exit(pass === cases.length ? 0 : 1);
