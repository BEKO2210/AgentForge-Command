#!/usr/bin/env node
// One-command launcher for AgentForge Command.
//   npx agentforge-command            (after `npm publish` — see README)
//   node bin/agentforge.mjs           (from a clone)
// Forwards any args to gui/server.js and inherits stdio so the session token
// banner and logs show up normally.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const server = path.join(here, "..", "gui", "server.js");

const child = spawn(process.execPath, [server, ...process.argv.slice(2)], { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
