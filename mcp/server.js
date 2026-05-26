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

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "team_state",       description: "Return the current team state JSON (board counts + per-agent health)", inputSchema: { type: "object", properties: {} } },
    { name: "refresh_metrics",  description: "Run scripts/team-metrics.sh to regenerate .team/metrics.md and return its content", inputSchema: { type: "object", properties: {} } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  if (name === "team_state")      return { content: [{ type: "text", text: JSON.stringify(state(), null, 2) }] };
  if (name === "refresh_metrics") return { content: [{ type: "text", text: runScript("team-metrics.sh") }] };
  throw new Error(`unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("team-mcp: ready\n");
