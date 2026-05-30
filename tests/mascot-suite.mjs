#!/usr/bin/env node
// AgentForge — mascot character polish contract (Run 1.5, ROADMAP 2.0 Tier 1).
//
// The 12-mascot sprite system + per-state animations already existed and are
// exercised by arena-suite (MASCOT_IDS=12, viewBox, crispEdges, aria-label,
// fallback, evo levels, sizes). This suite locks in the *Run 1.5* additions —
// the genuinely-missing personality polish:
//   • a card-hover "hello" bob (motion-guarded),
//   • an active/live vibrancy treatment so a running agent reads as vivid,
// plus a guard that the a11y + reduced-motion contract didn't regress.
import * as assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(ROOT, "gui/public/arena/styles.css"), "utf8");

let pass = 0, fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };
function section(n) { console.log(`== ${n} ==`); }
function it(name, cond, msg) {
  try { assert.ok(cond, msg); pass++; console.log(`  ${c.g("ok")}  ${name}`); }
  catch (e) { fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`); }
}

// Slice out the prefers-reduced-motion:no-preference block so we can assert the
// hover bob lives *inside* it (i.e. it really is motion-guarded).
const npStart = css.indexOf("@media (prefers-reduced-motion: no-preference)");
const npBlock = npStart >= 0 ? css.slice(npStart) : "";

section("Run 1.5 — card-hover personality (motion-guarded)");
it("a card-hover mascot bob keyframe exists",
   /@keyframes m-card-hello/.test(css), "m-card-hello keyframe missing");
it("the bob is scoped to a hovered card's mascot body",
   /\.tcard:hover .mascot-slot .mascot-body\s*\{[^}]*animation:\s*m-card-hello/s.test(css),
   "hover bob not wired to .tcard:hover .mascot-slot .mascot-body");
it("the hover bob sits inside prefers-reduced-motion: no-preference",
   /\.tcard:hover .mascot-slot .mascot-body\s*\{[^}]*m-card-hello/s.test(npBlock),
   "hover bob is not motion-guarded");

section("Run 1.5 — active/live vibrancy");
it("a running (.live) card saturates its mascot",
   /\.tcard\.live .mascot-slot svg\s*\{[^}]*filter:\s*saturate\(/s.test(css),
   "live vibrancy (saturate) missing");
it("a running card warms its mascot slot glow",
   /\.tcard\.live .mascot-slot::after\s*\{[^}]*var\(--good\)/s.test(css),
   "live slot glow tint missing");

section("Run 1.5 — a11y / reduced-motion contract held");
it("reduced-motion neutralises the mascot body animation",
   /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.mascot .mascot-body\s*\{[^}]*animation:none/s.test(css),
   "reduced-motion does not kill the mascot body animation");

// Render contract: every mascot is a labelled, crisp, body-grouped SVG.
const mod = await import(pathToFileURL(path.join(ROOT, "gui/public/arena/mascots.js")).href);
section("Run 1.5 — all 12 mascots render with personality + a11y");
it("MASCOT_IDS has all 12 species", mod.MASCOT_IDS.length === 12, `got ${mod.MASCOT_IDS.length}`);
for (const m of mod.MASCOT_IDS) {
  const svg = mod.renderMascot({ mascot: m, level: 3, state: "working" });
  it(`${m}: labelled, crisp, body-grouped, stateful`,
     /role="img"/.test(svg) && /aria-label="[^"]+/.test(svg) &&
     /shape-rendering="crispEdges"/.test(svg) && /viewBox="0 0 32 32"/.test(svg) &&
     /class="mascot-body"/.test(svg) && /state-working/.test(svg),
     `${m} render missing a personality/a11y attribute`);
}

console.log(`\nmascot-suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
