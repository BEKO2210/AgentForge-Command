#!/usr/bin/env node
// Diff two team-state snapshots produced by team-snapshot.{mjs,sh}.
//   node scripts/team-diff.mjs <before.json> <after.json>
// Reports: count deltas, tasks that changed state, tasks added/removed, role-state deltas.
import fs from "node:fs";

const [, , aPath, bPath] = process.argv;
if (!aPath || !bPath) {
  process.stderr.write("usage: team-diff.mjs <before.json> <after.json>\n");
  process.exit(2);
}

const a = JSON.parse(fs.readFileSync(aPath, "utf8"));
const b = JSON.parse(fs.readFileSync(bPath, "utf8"));

const c = (k) => (b.counts?.[k] || 0) - (a.counts?.[k] || 0);
const fmt = (n) => (n > 0 ? "+" + n : String(n));

console.log(`team-diff: ${aPath} -> ${bPath}`);
console.log(`  generatedAt: ${a.generatedAt} -> ${b.generatedAt}`);
if (a.gitHead || b.gitHead) console.log(`  gitHead:     ${(a.gitHead || "?").slice(0, 7)} -> ${(b.gitHead || "?").slice(0, 7)}`);
console.log("");
console.log("Counts:");
for (const k of ["total", "todo", "doing", "blocked", "done"]) {
  const d = c(k);
  console.log(`  ${k.padEnd(8)} ${(a.counts?.[k] || 0).toString().padStart(4)} -> ${(b.counts?.[k] || 0).toString().padStart(4)}   (${fmt(d)})`);
}

const idx = (arr) => Object.fromEntries((arr || []).map((x) => [x.id, x]));
const aT = idx(a.tasks), bT = idx(b.tasks);
const allIds = [...new Set([...Object.keys(aT), ...Object.keys(bT)])].sort((x, y) => Number(x) - Number(y));

const changed = [], added = [], removed = [];
for (const id of allIds) {
  const aa = aT[id], bb = bT[id];
  if (!aa && bb) added.push(bb);
  else if (aa && !bb) removed.push(aa);
  else if (aa && bb && (aa.state !== bb.state || aa.owner !== bb.owner)) changed.push({ id, from: aa, to: bb });
}

console.log("\nTasks:");
if (!changed.length && !added.length && !removed.length) console.log("  (no changes)");
for (const t of added)   console.log(`  + #${t.id}  ${t.state.padEnd(8)} ${t.owner || "—"}  ${t.task}`);
for (const t of removed) console.log(`  - #${t.id}  ${t.state.padEnd(8)} ${t.owner || "—"}  ${t.task}`);
for (const t of changed) {
  const fromS = `${t.from.state}/${t.from.owner || "—"}`;
  const toS = `${t.to.state}/${t.to.owner || "—"}`;
  console.log(`  ~ #${t.id}  ${fromS.padEnd(20)} -> ${toS.padEnd(20)}  ${t.to.task}`);
}

const aR = idx(a.roles), bR = idx(b.roles);
const roleIds = [...new Set([...Object.keys(aR), ...Object.keys(bR)])].sort();
console.log("\nRoles:");
let roleChange = false;
for (const id of roleIds) {
  const aa = aR[id] || { state: "?" }, bb = bR[id] || { state: "?" };
  if (aa.state !== bb.state) {
    console.log(`  ~ ${id.padEnd(10)} ${aa.state.padEnd(8)} -> ${bb.state}`);
    roleChange = true;
  }
}
if (!roleChange) console.log("  (no role-state changes)");
