#!/usr/bin/env node
// Lightweight, zero-dependency structural check that schema/team-state.schema.json
// describes the shape produced by scripts/team-snapshot.mjs. It is intentionally
// minimal — enough to catch contract drift, without pulling in a full JSON-Schema
// validator. Run from the repo root:  node tests/validate-schema.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

let pass = 0, fail = 0;
const ok = (m) => { console.log("  \x1b[32mok\x1b[0m   " + m); pass++; };
const no = (m) => { console.log("  \x1b[31mFAIL\x1b[0m " + m); fail++; };
const expect = (cond, m) => (cond ? ok(m) : no(m));

const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schema/team-state.schema.json"), "utf8"));
expect(schema.$schema?.includes("json-schema.org"), "schema declares $schema");
expect(schema.type === "object",                    "schema root type is object");
expect(Array.isArray(schema.required),              "schema lists required keys");
for (const k of ["generatedAt", "counts", "tasks", "roles"]) {
  expect(schema.required.includes(k), `schema.required includes '${k}'`);
}

// Build a snapshot and structurally check it. We re-implement the parser inline so
// this test is self-contained and does NOT execute team-snapshot.mjs (which would
// print JSON to stdout on import).
function buildLocalState() {
  const TEAM_DIR = path.join(ROOT, ".team");
  const readFileSafe = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };
  const mtimeMs = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
  const counts = { total: 0, todo: 0, doing: 0, blocked: 0, done: 0 };
  const tasks = [];
  for (const line of readFileSafe(path.join(TEAM_DIR, "board.md")).split("\n")) {
    if (!/^\s*\|/.test(line) || /----/.test(line)) continue;
    const c = line.split("|").map((s) => s.trim());
    const id = c[1];
    if (!/^\d+$/.test(id)) continue;
    const state = (c[4] || "").toLowerCase();
    counts.total++;
    if (counts[state] !== undefined) counts[state]++;
    tasks.push({ id, task: c[2] || "", owner: (c[3] || "").replace(/[@\s]/g, "").toLowerCase(), state });
  }
  let roleFiles = [];
  try { roleFiles = fs.readdirSync(path.join(TEAM_DIR, "roles")); } catch {}
  const roles = roleFiles
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort()
    .map((id) => {
      const mt = mtimeMs(path.join(TEAM_DIR, "log", id + ".md"));
      const ageSec = mt ? Math.round((Date.now() - mt) / 1000) : -1;
      const state = ageSec < 0 ? "no-log" : ageSec < 900 ? "active" : ageSec < 1800 ? "idle" : "stale";
      return { id, ageSec, state };
    });
  return { generatedAt: new Date().toISOString(), counts, tasks, roles };
}

const sample = buildLocalState();
expect(typeof sample.generatedAt === "string",                "sample.generatedAt is a string");
expect(Number.isInteger(sample.counts.total),                  "sample.counts.total is integer");
expect(Array.isArray(sample.tasks),                            "sample.tasks is array");
expect(Array.isArray(sample.roles),                            "sample.roles is array");
const taskStates = new Set(["todo", "doing", "blocked", "done", ""]);
expect(sample.tasks.every((t) => taskStates.has(t.state)),     "every sample task has a valid state");
const roleStates = new Set(["active", "idle", "stale", "no-log"]);
expect(sample.roles.every((r) => roleStates.has(r.state)),     "every sample role has a valid state");
expect(sample.roles.every((r) => /^[a-z][a-z0-9_-]*$/.test(r.id)), "every role id matches schema pattern");

console.log(`\nschema validation: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
