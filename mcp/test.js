// Self-contained smoke test for the team-mcp server. Spawns the server, drives the MCP
// stdio JSON-RPC, and asserts on the responses. Run from this directory:
//   node test.js
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(HERE, "..");

const env = { ...process.env, REPO_DIR };
const proc = spawn(process.execPath, [path.join(HERE, "server.js")], {
  stdio: ["pipe", "pipe", "inherit"], env, cwd: HERE,
});

let buf = "";
const replies = new Map();
proc.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    try {
      const m = JSON.parse(line);
      if (m.id !== undefined) replies.set(m.id, m);
    } catch { /* not JSON-RPC */ }
  }
});

const send = (o) => proc.stdin.write(JSON.stringify(o) + "\n");
const wait = (id, timeout = 4000) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  (function poll() {
    if (replies.has(id)) return resolve(replies.get(id));
    if (Date.now() - t0 > timeout) return reject(new Error("timeout waiting for id=" + id));
    setTimeout(poll, 50);
  })();
});

let pass = 0, fail = 0;
const ok = (n) => { console.log("  \x1b[32mok\x1b[0m   " + n); pass++; };
const no = (n) => { console.log("  \x1b[31mFAIL\x1b[0m " + n); fail++; };
const expect = (cond, n) => (cond ? ok(n) : no(n));

try {
  send({ jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } });
  const init = await wait(1);
  expect(init.result?.serverInfo?.name === "team-mcp", "initialize: serverInfo.name === 'team-mcp'");

  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  send({ jsonrpc: "2.0", id: 2, method: "resources/list" });
  const lr = await wait(2);
  const uris = (lr.result?.resources || []).map((r) => r.uri);
  expect(uris.includes("team://state"),    "resources/list contains team://state");
  expect(uris.includes("team://board"),    "resources/list contains team://board");
  expect(uris.includes("team://memory"),   "resources/list contains team://memory");
  expect(uris.includes("team://protocol"), "resources/list contains team://protocol");
  expect(uris.some((u) => u.startsWith("team://log/")), "resources/list contains a per-role log");

  send({ jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri: "team://state" } });
  const rr = await wait(3);
  const text = rr.result?.contents?.[0]?.text || "";
  const j = JSON.parse(text);
  expect(Array.isArray(j.roles),                      "team://state: roles is an array");
  expect(typeof j.counts?.total === "number",         "team://state: counts.total is a number");
  expect(j.roles.every((r) => "state" in r),          "team://state: each role has a 'state' field");

  send({ jsonrpc: "2.0", id: 4, method: "tools/list" });
  const tl = await wait(4);
  const tools = (tl.result?.tools || []).map((t) => t.name);
  expect(tools.includes("team_state"),      "tools/list contains team_state");
  expect(tools.includes("refresh_metrics"), "tools/list contains refresh_metrics");

  send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "team_state", arguments: {} } });
  const tc = await wait(5);
  expect((tc.result?.content || []).some((c) => c.type === "text"), "tools/call team_state returns text content");
} catch (e) {
  no("driver error: " + (e?.message || e));
} finally {
  proc.kill("SIGTERM");
}

console.log(`\nmcp tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
