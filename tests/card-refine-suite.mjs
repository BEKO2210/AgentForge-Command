#!/usr/bin/env node
// AgentForge — card refinement contract (Run 1.2, ROADMAP 2.0 Tier 1).
// Static CSS checks that the card polish is actually wired (the live behaviour
// is additionally verified by the Playwright E2E).
import * as assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(ROOT, "gui/public/arena/styles.css"), "utf8");

let pass = 0, fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };
function section(n) { console.log(`== ${n} ==`); }
function it(name, re, msg) {
  try { assert.ok(re.test(css), msg); pass++; console.log(`  ${c.g("ok")}  ${name}`); }
  catch (e) { fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`); }
}

section("Run 1.2 — card focus / hover / motion / badge");
it("card opener has a :focus-visible ring from --focus-ring",
   /header\[data-action="open"\]:focus-visible\s*\{[^}]*--focus-ring/, "missing card focus-visible ring");
it("per-card action buttons have a :focus-visible ring",
   /\.auto-toggle:focus-visible[^{]*,[^{]*\.card-btn:focus-visible\s*\{[^}]*--focus-ring/, "missing button focus-visible ring");
it("card transition is tokenized (ease-standard + dur)",
   /\.tcard\s*\{[^}]*transition:[^}]*--ease-standard/, "card transition not tokenized");
it("card hover lifts (translateY)",
   /\.tcard:hover\s*\{[^}]*transform:\s*translateY\(-[23]px\)/, "card hover lift missing");
it("worktree badge truncates instead of overlapping (ellipsis + max-width)",
   /\.worktree-badge\s*\{[^}]*max-width:\s*100%[^}]*text-overflow:\s*ellipsis/s, "badge overflow guard missing");

console.log(`\ncard-refine-suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
