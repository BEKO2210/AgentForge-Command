#!/usr/bin/env node
// Capture the full team state as one self-contained JSON document.
// Useful for inspection, diffing two points in time, attaching to a bug report,
// or feeding a dashboard. Read-only: never writes into .team/ itself.
//
//   node scripts/team-snapshot.mjs                           print snapshot to stdout
//   node scripts/team-snapshot.mjs --save                    also write to .team/snapshots/<ts>.json
//   REPO_DIR=/path node scripts/team-snapshot.mjs            snapshot a different repo
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { buildState } from "../lib/state.mjs";

const REPO_DIR = process.env.REPO_DIR || process.cwd();
const TEAM_DIR = path.join(REPO_DIR, ".team");
const SAVE = process.argv.includes("--save");

function gitHead() {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: REPO_DIR, stdio: ["ignore", "pipe", "ignore"],
    }).toString().trim();
  } catch {
    return null;
  }
}

const snap = { ...buildState({ repoDir: REPO_DIR }), gitHead: gitHead() };
const out = JSON.stringify(snap, null, 2);
process.stdout.write(out + "\n");

if (SAVE) {
  const dir = path.join(TEAM_DIR, "snapshots");
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
  const ts = snap.generatedAt.replace(/[:.]/g, "-").replace("Z", "");
  const file = path.join(dir, ts + ".json");
  fs.writeFileSync(file, out);
  process.stderr.write(`team-snapshot: ✅ saved ${file}\n`);
}
