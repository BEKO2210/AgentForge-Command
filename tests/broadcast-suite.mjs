#!/usr/bin/env node
// AgentForge — broadcast bar contract (Run 1.3, ROADMAP 2.0 Tier 1).
// Static checks; live behaviour is verified by the Playwright E2E.
import * as assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(ROOT, "gui/public/arena.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "gui/public/arena/styles.css"), "utf8");

let pass = 0, fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };
function section(n) { console.log(`== ${n} ==`); }
function it(name, cond, msg) {
  try { assert.ok(cond, msg); pass++; console.log(`  ${c.g("ok")}  ${name}`); }
  catch (e) { fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`); }
}

section("Run 1.3 — broadcast bar markup");
it("input enforces a 255-char max length", /id="broadcast-input"[^>]*maxlength="255"/s.test(html), "maxlength=255 missing");
it("input has an accessible label (sr-only)", /<label class="sr-only" for="broadcast-input"/.test(html), "sr-only label missing");
it("input is described by the error region", /id="broadcast-input"[^>]*aria-describedby="broadcast-error"/s.test(html), "aria-describedby missing");
it("a live char counter exists", /id="broadcast-count"/.test(html), "#broadcast-count missing");
it("an error live-region (role=alert) exists", /id="broadcast-error"[^>]*role="alert"/s.test(html) || /role="alert"[^>]*id="broadcast-error"/s.test(html), "#broadcast-error role=alert missing");

section("Run 1.3 — broadcast bar styles");
it("focus uses the success accent", /\.broadcast input:focus\s*\{[^}]*--color-accent-success/s.test(css), "focus success colour missing");
it("error state styled", /\.broadcast input\.error\s*\{[^}]*--color-accent-error/s.test(css), "error state missing");
it("send flash animation present", /\.broadcast input\.sent\s*\{[^}]*animation/s.test(css) && /@keyframes broadcastSent/.test(css), "sent flash missing");
it("counter + error text styled", /\.broadcast-count\s*\{/.test(css) && /\.broadcast-error\s*\{/.test(css), "counter/error styles missing");

console.log(`\nbroadcast-suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
