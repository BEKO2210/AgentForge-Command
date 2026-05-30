#!/usr/bin/env node
// AgentForge — drawer polish contract (Run 1.4, ROADMAP 2.0 Tier 1).
import * as assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(ROOT, "gui/public/arena/styles.css"), "utf8");
const ui = fs.readFileSync(path.join(ROOT, "gui/public/arena/ui.js"), "utf8");

let pass = 0, fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };
function section(n) { console.log(`== ${n} ==`); }
function it(name, cond, msg) {
  try { assert.ok(cond, msg); pass++; console.log(`  ${c.g("ok")}  ${name}`); }
  catch (e) { fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`); }
}

section("Run 1.4 — git status colouring");
it("ui.js has a gitStatusHTML renderer", /function gitStatusHTML/.test(ui), "gitStatusHTML missing");
it("renderer escapes content (paths)", /gitStatusHTML[\s\S]*?escapeHTML\(line\)/.test(ui), "git status must escape paths");
it("drawer renders it via innerHTML (not raw text)", /\[data-git-status\][\s\S]*?innerHTML\s*=\s*gitStatusHTML/.test(ui), "drawer should use gitStatusHTML");
it("added/modified/deleted colour classes exist", /\.gs-added\b/.test(css) && /\.gs-modified\b/.test(css) && /\.gs-deleted\b/.test(css), "gs-* colour classes missing");
it("git-status block wraps + scrolls", /\.git-status\s*\{[^}]*white-space:\s*pre-wrap/s.test(css), "git-status wrapping missing");

section("Run 1.4 — typography / layout / motion / a11y");
it("prose has a readable max-width", /\.drawer .body section p\s*\{[^}]*max-width:\s*\d+ch/s.test(css), "prose max-width missing");
it("controls use a grid", /\.drawer .body .controls\s*\{[^}]*display:\s*grid/s.test(css), "controls grid missing");
it("drawer slide is tokenized", /\.drawer\s*\{[^}]*transition:transform var\(--dur-base/s.test(css), "drawer transition not tokenized");
it("close + body buttons have a focus ring", /\.drawer .close:focus-visible[\s\S]*--focus-ring/.test(css), "drawer focus ring missing");

console.log(`\ndrawer-suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
