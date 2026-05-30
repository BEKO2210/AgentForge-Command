#!/usr/bin/env node
// AgentForge — responsive layout contract (Run 1.7, ROADMAP 2.0 Tier 1).
// Static checks that the breakpoints + touch ergonomics are wired; the live
// behaviour (no horizontal scroll, real 44px targets) is proved by Playwright.
import * as assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(ROOT, "gui/public/arena/styles.css"), "utf8");

let pass = 0, fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };
function section(n) { console.log(`== ${n} ==`); }
function it(name, cond, msg) {
  try { assert.ok(cond, msg); pass++; console.log(`  ${c.g("ok")}  ${name}`); }
  catch (e) { fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`); }
}

section("Run 1.7 — breakpoint ladder");
for (const bp of [1200, 1000, 760, 460, 360]) {
  it(`has a max-width: ${bp}px breakpoint`,
     new RegExp(`@media \\(max-width:\\s*${bp}px\\)`).test(css), `missing ${bp}px breakpoint`);
}
it("phone layout collapses the swarm grid to one column",
   /@media \(max-width: 760px\)[\s\S]*\.grid\s*\{[^}]*grid-template-columns:\s*1fr/s.test(css),
   "grid does not collapse on phones");

section("Run 1.7 — no horizontal scroll guard");
it("body clips horizontal overflow",
   /\bbody\s*\{[^}]*overflow-x:\s*hidden/s.test(css), "body overflow-x:hidden missing");
it("html clips horizontal overflow at the viewport (off-canvas guard)",
   /\bhtml\s*\{[^}]*overflow-x:\s*clip/s.test(css), "html overflow-x:clip missing — off-canvas elements can scroll the page");
it("the top bar wraps on phones instead of overflowing",
   /@media \(max-width: 760px\)[\s\S]*\.appbar\s*\{[^}]*flex-wrap:\s*wrap/s.test(css), "appbar does not wrap on phones");

section("Run 1.7 — touch ergonomics (pointer: coarse → 44px targets)");
const coarseStart = css.indexOf("@media (pointer: coarse)");
const coarse = coarseStart >= 0 ? css.slice(coarseStart) : "";
it("a pointer: coarse block exists", coarseStart >= 0, "no pointer: coarse handling");
it("coarse pointers get a 44px min tap target via --tap",
   /min-height:\s*var\(--tap/.test(coarse), "tap targets not enforced on touch");
it("per-card buttons are included in the touch target set",
   /\.tcard \.card-btn/.test(coarse), "card buttons not bumped on touch");
it("square controls (close/swatch) also get a min-width",
   /min-width:\s*var\(--tap/.test(coarse), "square controls miss a horizontal target");
it("--tap is defined as 44px", /--tap:\s*44px/.test(css), "--tap token missing/!=44px");

console.log(`\nresponsive-suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
