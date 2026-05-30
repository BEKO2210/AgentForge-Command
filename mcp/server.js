#!/usr/bin/env node
// Read-only MCP server exposing the .team/ coordination state.
// Resources mirror the same view the GUI's /state endpoint and team-health.sh produce —
// so MCP clients (Claude Desktop, IDE plugins, agents) can read board, logs, memory,
// metrics and a folded JSON state without ever writing to the repo.
//
// Run:   node server.js          (uses cwd as the repo root)
//        REPO_DIR=/path/to/repo node server.js
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildState, listRoles, readFileSafe } from "../lib/state.mjs";

const REPO_DIR = process.env.REPO_DIR || process.cwd();
const TEAM_DIR = path.join(REPO_DIR, ".team");
const SCRIPTS_DIR = path.join(REPO_DIR, "scripts");

const state = () => buildState({ repoDir: REPO_DIR });
const teamRoles = () => listRoles(TEAM_DIR);

function runScript(name) {
  try {
    return execFileSync(path.join(SCRIPTS_DIR, name), [], {
      cwd: REPO_DIR, env: process.env, timeout: 10000, encoding: "utf8",
    });
  } catch (e) {
    return `(${name} failed: ${e.message || e})`;
  }
}

const STATIC_RESOURCES = [
  { uri: "team://state",    name: "Team state (JSON)",       description: "Folded board + per-agent health (mirrors gui /state)", mimeType: "application/json" },
  { uri: "team://board",    name: "Board (markdown)",        description: ".team/board.md",                                       mimeType: "text/markdown" },
  { uri: "team://memory",   name: "Durable memory",          description: ".team/memory.md — decisions that survive runs",       mimeType: "text/markdown" },
  { uri: "team://protocol", name: "Protocol",                description: ".team/PROTOCOL.md — the rules",                       mimeType: "text/markdown" },
  { uri: "team://health",   name: "Health report",           description: "Live output of scripts/team-health.sh",                mimeType: "text/plain" },
  { uri: "team://metrics",  name: "Metrics (markdown)",      description: ".team/metrics.md (refresh via tool refresh_metrics)", mimeType: "text/markdown" },
];

const server = new Server(
  { name: "team-mcp", version: "0.1.0" },
  { capabilities: { resources: {}, tools: {} } }
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const logs = teamRoles().map((r) => ({
    uri: `team://log/${r}`,
    name: `Log: ${r}`,
    description: `.team/log/${r}.md — append-only event stream`,
    mimeType: "text/markdown",
  }));
  return { resources: [...STATIC_RESOURCES, ...logs] };
});

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const u = req.params.uri;
  let text, mimeType;
  if (u === "team://state") { text = JSON.stringify(state(), null, 2); mimeType = "application/json"; }
  else if (u === "team://board")    { text = readFileSafe(path.join(TEAM_DIR, "board.md"),    "(no board.md)");    mimeType = "text/markdown"; }
  else if (u === "team://memory")   { text = readFileSafe(path.join(TEAM_DIR, "memory.md"),   "(no memory.md)");   mimeType = "text/markdown"; }
  else if (u === "team://protocol") { text = readFileSafe(path.join(TEAM_DIR, "PROTOCOL.md"), "(no PROTOCOL.md)"); mimeType = "text/markdown"; }
  else if (u === "team://health")   { text = runScript("team-health.sh");                                            mimeType = "text/plain"; }
  else if (u === "team://metrics")  { text = readFileSafe(path.join(TEAM_DIR, "metrics.md"),  runScript("team-metrics.sh")); mimeType = "text/markdown"; }
  else if (u.startsWith("team://log/")) {
    const role = u.slice("team://log/".length).replace(/[^a-z0-9_-]/gi, ""); // no path traversal
    text = readFileSafe(path.join(TEAM_DIR, "log", role + ".md"), `(no log for ${role})`);
    mimeType = "text/markdown";
  } else {
    throw new Error(`unknown resource: ${u}`);
  }
  return { contents: [{ uri: u, mimeType, text }] };
});

// Tool surface. team_state/refresh_metrics/swarm_status are read/refresh
// (safe). The action tools (launch_specialist, dispatch_goal) are intentional
// SAFE PLACEHOLDERS: actually spawning a PTY or dispatching a goal is a
// state-changing operation that must go through the cockpit's authenticated
// /arena WebSocket (origin + session token — see docs/THREAT_MODEL.md). This
// read-only MCP process holds no token and must NOT become an unauthenticated
// control path, so these tools return guidance to drive the cockpit instead.
const ACTION_SPECIALIST_IDS = ["sentinel", "aurora", "forge", "prism", "echo", "vega", "scribe", "ledger", "raven", "luma", "nova"];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "team_state",       description: "Return the current team state JSON (board counts + per-agent health)", inputSchema: { type: "object", properties: {} } },
    { name: "refresh_metrics",  description: "Run scripts/team-metrics.sh to regenerate .team/metrics.md and return its content", inputSchema: { type: "object", properties: {} } },
    { name: "swarm_status",     description: "Read-only snapshot of the swarm coordination state (board + roles)", inputSchema: { type: "object", properties: {} } },
    { name: "launch_specialist", description: "Guidance to launch a specialist PTY (the action must be performed in the cockpit — read-only MCP cannot spawn).", inputSchema: { type: "object", properties: { id: { type: "string", enum: ACTION_SPECIALIST_IDS } }, required: ["id"] } },
    { name: "dispatch_goal",    description: "Guidance to dispatch a mission goal to Atlas (the action must be performed in the cockpit — requires the session token).", inputSchema: { type: "object", properties: { goal: { type: "string" } }, required: ["goal"] } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = req.params.arguments || {};
  if (name === "team_state")      return { content: [{ type: "text", text: JSON.stringify(state(), null, 2) }] };
  if (name === "refresh_metrics") return { content: [{ type: "text", text: runScript("team-metrics.sh") }] };
  if (name === "swarm_status")    return { content: [{ type: "text", text: JSON.stringify(state(), null, 2) }] };
  if (name === "launch_specialist") {
    const id = String(args.id || "").toLowerCase();
    if (!ACTION_SPECIALIST_IDS.includes(id)) {
      return { isError: true, content: [{ type: "text", text: `unknown specialist '${id}'. Valid: ${ACTION_SPECIALIST_IDS.join(", ")}` }] };
    }
    return { content: [{ type: "text", text: `Launching a PTY is a state-changing action. Open the AgentForge cockpit and press ▶ on the '${id}' card — the cockpit holds the session token that authorises the /arena WebSocket.` }] };
  }
  if (name === "dispatch_goal") {
    const goal = String(args.goal || "").slice(0, 500);
    return { content: [{ type: "text", text: `To dispatch this goal, type it into the cockpit's Atlas broadcast bar:\n\n  ${goal}\n\nDispatching requires the session token, which only the cockpit holds (read-only MCP cannot act).` }] };
  }
  throw new Error(`unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("team-mcp: ready\n");
