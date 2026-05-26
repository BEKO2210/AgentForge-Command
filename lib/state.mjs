// Single source of truth for the "folded" team state used by:
//   - gui/server.js        (GET /state)
//   - mcp/server.js        (team://state and team_state tool)
//   - scripts/team-snapshot.mjs
//
// Keep this module dependency-free (only node: built-ins) so every consumer stays
// optional. Contract is described in schema/team-state.schema.json.
import fs from "node:fs";
import path from "node:path";

export const readFileSafe = (p, fallback = "") => {
  try { return fs.readFileSync(p, "utf8"); } catch { return fallback; }
};
export const mtimeMs = (p) => {
  try { return fs.statSync(p).mtimeMs; } catch { return 0; }
};

export function listRoles(teamDir) {
  let files = [];
  try { files = fs.readdirSync(path.join(teamDir, "roles")); } catch { return []; }
  return files
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

export function parseBoard(teamDir) {
  const counts = { todo: 0, doing: 0, blocked: 0, done: 0, total: 0 };
  const tasks = [];
  for (const line of readFileSafe(path.join(teamDir, "board.md")).split("\n")) {
    if (!/^\s*\|/.test(line) || /----/.test(line)) continue;
    const c = line.split("|").map((s) => s.trim());
    const id = c[1];
    if (!/^\d+$/.test(id)) continue;
    const state = (c[4] || "").toLowerCase();
    counts.total++;
    if (counts[state] !== undefined) counts[state]++;
    tasks.push({
      id,
      task: c[2] || "",
      owner: (c[3] || "").replace(/[@\s]/g, "").toLowerCase(),
      state,
    });
  }
  return { counts, tasks };
}

// Build the folded state. Pass `repoDir` (defaults to cwd) and an env-like object
// (defaults to process.env) to override thresholds for liveness classification.
export function buildState({ repoDir = process.cwd(), env = process.env } = {}) {
  const teamDir = path.join(repoDir, ".team");
  const { counts, tasks } = parseBoard(teamDir);
  const now = Date.now();
  const ACTIVE = Number(env.TEAM_ACTIVE_SECS || 900);
  const STALE = Number(env.TEAM_STALE_SECS || 1800);
  const roles = listRoles(teamDir).map((id) => {
    const mt = mtimeMs(path.join(teamDir, "log", id + ".md"));
    const ageSec = mt ? Math.round((now - mt) / 1000) : -1;
    let state = "no-log";
    if (ageSec >= 0) state = ageSec < ACTIVE ? "active" : ageSec < STALE ? "idle" : "stale";
    return { id, ageSec, state };
  });
  return {
    generatedAt: new Date().toISOString(),
    repoDir,
    counts,
    tasks,
    roles,
  };
}
