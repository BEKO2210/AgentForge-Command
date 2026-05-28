#!/usr/bin/env node
// Drive the cockpit through a full Atlas swarm-check and capture screenshots:
//   01-atlas-idle.png      — the rebuilt Atlas-dominant stage, idle
//   02-atlas-workflow.png  — after a swarm-check run (answer + dispatch + final)
//   03-tech-open.png       — the technical-events panel expanded
//
// Uses headless Chromium over the DevTools Protocol (WebSocket). No npm deps —
// Node 22's global WebSocket talks to chrome --remote-debugging-port.
//
// Modes (honest, same rule as the rest of the project):
//   - default: deterministic TEST HARNESS (AGENTFORGE_HARNESS=1, no LLM).
//   - AGENTFORGE_LIVE_TEST=1 + ANTHROPIC_API_KEY: real LLM run.
//
// Usage: node scripts/shot-atlas-workflow.mjs [outDir]

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "_handoff", "agentforge-command", "screenshots"));
fs.mkdirSync(OUT, { recursive: true });

const PORT = Number(process.env.PORT || 4906);
const CDP_PORT = Number(process.env.CDP_PORT || 9242);
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const LIVE = process.env.AGENTFORGE_LIVE_TEST === "1" && !!process.env.ANTHROPIC_API_KEY;
const MESSAGE =
  "Atlas, führe einen echten Schwarm-Check aus. Bitte sprich Sentinel, Aurora, Forge, " +
  "Scribe, Ledger, Raven, Luma und Nova jeweils mit einer kurzen Aufgabe an. Jeder " +
  "Spezialist soll mit genau einer Statusmeldung antworten. Danach gib mir als Atlas " +
  "eine finale Zusammenfassung: Was wurde geprüft, wer hat geantwortet, was ist offen?";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----- server ----- */
let server = null;
async function startServer() {
  const env = { ...process.env, PORT: String(PORT), TEST_CMD: "bash", AUTOSTART: "off", FORGE_PULSE: "0", REPO_DIR: ROOT };
  if (LIVE) env.AGENTFORGE_HARNESS = "0";
  else { env.AGENTFORGE_HARNESS = "1"; env.ANTHROPIC_API_KEY = ""; }
  server = spawn("node", [path.join(ROOT, "gui/server.js")], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.setEncoding("utf8");
  let buf = "";
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => { buf += d; if (buf.includes("AgentForge Command up")) resolve(); });
    server.on("exit", (c) => reject(new Error(`server died code=${c}`)));
    setTimeout(() => reject(new Error("server timeout")), 6000);
  });
}

/* ----- chrome + CDP ----- */
let chrome = null;
async function startChrome() {
  const userDir = fs.mkdtempSync(path.join("/tmp", "afc-shot-"));
  chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${userDir}`,
    "--window-size=1480,1024", "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  // Wait for the DevTools endpoint.
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) break; } catch {}
    await sleep(100);
  }
}
async function newPageWS() {
  const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: "PUT" }).catch(() => null)
    || await fetch(`http://127.0.0.1:${CDP_PORT}/json/new`, { method: "PUT" });
  const t = await r.json();
  return t.webSocketDebuggerUrl;
}

function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const ready = new Promise((res) => ws.addEventListener("open", res, { once: true }));
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => ready.then(() => new Promise((res) => {
    const myId = ++id;
    pending.set(myId, (m) => res(m.result || {}));
    ws.send(JSON.stringify({ id: myId, method, params }));
  }));
  return { send, close: () => ws.close() };
}

async function shoot(cdp, file) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(data, "base64"));
  console.log(`  wrote ${file}`);
}

async function evalJS(cdp, expr) {
  const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result ? r.result.value : undefined;
}

async function main() {
  console.log(`[shot] mode: ${LIVE ? "LIVE" : "TEST HARNESS"} · out: ${OUT}`);
  await startServer();
  await startChrome();
  const cdp = cdpClient(await newPageWS());
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1480, height: 1024, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
  await sleep(1600);
  await shoot(cdp, "01-atlas-idle.png");

  // Send the swarm-check message into the broadcast bar and dispatch.
  await evalJS(cdp, `(() => {
    const i = document.getElementById('broadcast-input');
    i.focus(); i.value = ${JSON.stringify(MESSAGE)};
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return true;
  })()`);

  // Wait for Atlas's final summary line to appear (or up to ~8s).
  for (let i = 0; i < 80; i++) {
    const done = await evalJS(cdp, `!!document.querySelector('.a-line.final')`);
    if (done) break;
    await sleep(100);
  }
  await sleep(400);
  await shoot(cdp, "02-atlas-workflow.png");

  // Expand the technical events panel.
  await evalJS(cdp, `(() => { const d = document.querySelector('details.tech-events'); if (d) d.open = true; return true; })()`);
  await sleep(400);
  await shoot(cdp, "03-tech-open.png");

  cdp.close();
}

let code = 0;
try { await main(); }
catch (e) { console.error("[shot] failed:", e.message); code = 1; }
finally {
  if (chrome) try { chrome.kill("SIGTERM"); } catch {}
  if (server) try { server.kill("SIGTERM"); } catch {}
}
setTimeout(() => process.exit(code), 200);
