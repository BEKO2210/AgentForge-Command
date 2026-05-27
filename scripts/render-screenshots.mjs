#!/usr/bin/env node
// Take headless Chromium screenshots of the AgentForge cockpit and write
// them to docs/screenshots/*.png. Used to seed the README and the launch
// docs. Stays optional — the deliverable is the SVGs in docs/mascots/ plus
// the PNGs this script produces.
//
// Usage:
//   node scripts/render-screenshots.mjs
//
// Env:
//   CHROME       — override path to the chrome binary
//   PORT         — pick a port (default: 4900)
//   PERSISTED    — write a pre-loaded .team/arena.json for richer shots
//
// The script:
//   1. spawns the real server with TEST_CMD=bash so no real Claude session
//      gets launched.
//   2. boots Chrome with --remote-debugging-pipe and drives it via Chrome
//      DevTools Protocol over the stdio pipe. No npm deps.
//   3. captures the cockpit at desktop and mobile breakpoints, and the
//      Atlas drawer + Ledger drawer + Spawn-Builder modal as separate
//      shots.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT  = path.join(ROOT, "docs", "screenshots");
fs.mkdirSync(OUT, { recursive: true });

const PORT = Number(process.env.PORT || 4900);
const CHROME = process.env.CHROME
  || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/* ----- Server (real cockpit, real arena state) ------------------------- */

let server = null;
async function startServer() {
  // Pre-seed a persisted state so the cockpit shows non-trivial cards.
  if (process.env.PERSISTED !== "0") {
    const seed = {
      evolution: {
        atlas: 5, sentinel: 4, aurora: 4, forge: 3, prism: 3,
        echo: 2, vega: 3, scribe: 2, ledger: 3, raven: 2, luma: 4, nova: 5,
      },
      autoEnter: ["sentinel", "forge"],
      customAgents: [],
      atlasMission: "demo",
      version: 1,
    };
    fs.mkdirSync(path.join(ROOT, ".team"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, ".team", "arena.json"), JSON.stringify(seed, null, 2));
  }

  server = spawn("node", [path.join(ROOT, "gui/server.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT), TEST_CMD: "bash",
      AUTOSTART: "off", FORGE_PULSE: "0",
      REPO_DIR: ROOT, AGENTFORGE_BUDGET_USD: "5.00",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.setEncoding("utf8");
  let buf = "";
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => { buf += d; if (buf.includes("AgentForge Command up")) resolve(); });
    server.stderr.on("data", () => {});
    server.on("exit", (c) => reject(new Error(`server died code=${c}: ${buf.slice(-200)}`)));
    setTimeout(() => reject(new Error("server start timeout")), 5000);
  });
}
function stopServer() { if (server) try { server.kill("SIGTERM"); } catch {} }
process.on("exit", stopServer);
process.on("SIGINT", () => { stopServer(); process.exit(130); });

/* ----- CDP client (over the chrome --remote-debugging-pipe pipe) ------- */

let chrome = null;
let cdpPipeOut = null;
let cdpPipeIn  = null;
let nextId = 1;
const cdpPending = new Map();

async function startChrome() {
  const userDir = fs.mkdtempSync(path.join("/tmp", "afc-shot-"));
  chrome = spawn(CHROME, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--hide-scrollbars",
    "--remote-debugging-pipe",
    "--remote-allow-origins=*",
    `--user-data-dir=${userDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  // stdio: 0=stdin, 1=stdout, 2=stderr, 3=writeToChrome (CDP), 4=readFromChrome
  cdpPipeIn  = chrome.stdio[3];
  cdpPipeOut = chrome.stdio[4];
  let buf = "";
  cdpPipeOut.setEncoding("utf8");
  cdpPipeOut.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\0")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id && cdpPending.has(msg.id)) {
        const { resolve, reject } = cdpPending.get(msg.id);
        cdpPending.delete(msg.id);
        if (msg.error) reject(new Error(`CDP ${msg.error.code}: ${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method === "Runtime.consoleAPICalled" || msg.method === "Runtime.exceptionThrown") {
        const tag = msg.method === "Runtime.exceptionThrown" ? "JS-ERR" : "console";
        const args = msg.params.args || (msg.params.exceptionDetails ? [msg.params.exceptionDetails.exception] : []);
        const str = args.map((a) => a.value ?? a.description ?? "").join(" ");
        if (str) console.log(`  [${tag}] ${str.slice(0, 200)}`);
      }
    }
  });
  chrome.on("exit", (c) => {
    for (const { reject } of cdpPending.values()) reject(new Error(`chrome exited code=${c}`));
    cdpPending.clear();
  });
}
function stopChrome() { if (chrome) try { chrome.kill("SIGTERM"); } catch {} }
process.on("exit", stopChrome);

function cdp(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const env = { id, method, params };
    if (sessionId) env.sessionId = sessionId;
    cdpPending.set(id, { resolve, reject });
    cdpPipeIn.write(JSON.stringify(env) + "\0");
    setTimeout(() => {
      if (cdpPending.has(id)) {
        cdpPending.delete(id);
        reject(new Error(`CDP ${method} timeout`));
      }
    }, 30000);
  });
}

/* ----- Screenshot helper ----------------------------------------------- */

let sessionId = null;

async function attachToFirstTarget() {
  const { targetInfos } = await cdp("Target.getTargets");
  const page = targetInfos.find((t) => t.type === "page") || targetInfos[0];
  const { sessionId: sid } = await cdp("Target.attachToTarget", { targetId: page.targetId, flatten: true });
  sessionId = sid;
  await cdp("Page.enable", {}, sessionId);
  await cdp("DOM.enable", {}, sessionId);
  await cdp("Runtime.enable", {}, sessionId);
  await cdp("Log.enable", {}, sessionId).catch(() => {});
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] }, sessionId);
}

async function setViewport(width, height) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile: width <= 480,
  }, sessionId);
}

async function navigate(url, waitForSelector) {
  await cdp("Page.navigate", { url }, sessionId);
  // Give the document a moment to start parsing the module script.
  await new Promise((r) => setTimeout(r, 1500));
  if (waitForSelector) {
    const t0 = Date.now();
    while (Date.now() - t0 < 7000) {
      const r = await cdp("Runtime.evaluate", {
        expression: `!!document.querySelector(${JSON.stringify(waitForSelector)})`,
        returnByValue: true,
      }, sessionId);
      if (r.result.value === true) {
        // Extra settle for renders + WebSocket hello.
        await new Promise((r) => setTimeout(r, 700));
        return;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    // Last-ditch diagnostic: dump body content snippet to stderr.
    const r = await cdp("Runtime.evaluate", {
      expression: `document.body.innerHTML.slice(0, 600)`,
      returnByValue: true,
    }, sessionId);
    console.error("[shoot] selector never appeared, body excerpt:\n" + (r.result.value || "(empty)"));
    throw new Error(`selector ${waitForSelector} never appeared`);
  } else {
    await new Promise((r) => setTimeout(r, 800));
  }
}

async function runScript(expression) {
  const r = await cdp("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  }, sessionId);
  if (r.exceptionDetails) {
    throw new Error("JS error: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}

async function shot(name) {
  // Briefly give CSS animations a frame to settle into a steady pose.
  await new Promise((r) => setTimeout(r, 350));
  const { data } = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false }, sessionId);
  const file = path.join(OUT, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  const stat = fs.statSync(file);
  console.log(`  ${name}.png  (${(stat.size / 1024).toFixed(1)} KB)`);
}

/* ----- The actual shoots ----------------------------------------------- */

await startServer();
console.log(`[shoot] server up on :${PORT}`);
await startChrome();
console.log(`[shoot] chrome up`);
await attachToFirstTarget();

const URL = `http://127.0.0.1:${PORT}/`;

// 1) Desktop default
await setViewport(1440, 900);
await navigate(URL, "#agent-grid .tcard");
await runScript("document.body.scrollIntoView({block:'start'}); 1");
await shot("01-mission-control");

// 2) Tablet-ish (single-column lead, multi-column grid)
await setViewport(1024, 768);
await navigate(URL, "#agent-grid .tcard");
await shot("02-tablet");

// 3) Mobile (390 ≈ iPhone 14 pro)
await setViewport(390, 800);
await navigate(URL, "#hero-stats");
await shot("03-mobile");

// 4) Atlas drawer open (click the atlas-like card by id atlas — but Atlas isn't in the grid;
//    open the SENTINEL drawer instead, that's a representative specialist).
await setViewport(1440, 900);
await navigate(URL, "[data-id=\"sentinel\"]");
await runScript(`(async () => {
  const card = document.querySelector('[data-id="sentinel"]');
  card.click();
  await new Promise(r => setTimeout(r, 400));
})()`);
await shot("04-sentinel-drawer");

// 5) Ledger drawer (cost panel)
await navigate(URL, "[data-id=\"ledger\"]");
await runScript(`(async () => {
  const card = document.querySelector('[data-id="ledger"]');
  card.click();
  await new Promise(r => setTimeout(r, 400));
})()`);
await shot("05-ledger-drawer");

// 6) Spawn-builder modal
await navigate(URL, "#new-agent");
await runScript(`(async () => {
  document.querySelector('#new-agent').click();
  await new Promise(r => setTimeout(r, 400));
})()`);
await shot("06-spawn-builder");

// 7) Help overlay (Ctrl+K then ? in two stages — easier: click the ? button)
await navigate(URL, "#help-btn");
await runScript(`(async () => {
  document.querySelector('#help-btn').click();
  await new Promise(r => setTimeout(r, 350));
})()`);
await shot("07-help-overlay");

// 8) Command mode overlay
await navigate(URL, "#hero-stats");
await runScript(`(async () => {
  // Synthesise Ctrl+K via the keydown handler the app installs on document.
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
  await new Promise(r => setTimeout(r, 350));
})()`);
await shot("08-command-mode");

console.log("[shoot] done");
stopChrome();
stopServer();
setTimeout(() => process.exit(0), 200);
