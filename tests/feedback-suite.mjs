#!/usr/bin/env node
// AgentForge — loading/feedback contract (Run 1.8, ROADMAP 2.0 Tier 1).
// Static checks for toasts, spinner, skeleton, disabled states and the
// staggered entrance. Live behaviour is proved by the Playwright E2E.
import * as assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const css   = read("gui/public/arena/styles.css");
const toast = read("gui/public/arena/toast.js");
const main  = read("gui/public/arena/main.js");
const ui    = read("gui/public/arena/ui.js");

let pass = 0, fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };
function section(n) { console.log(`== ${n} ==`); }
function it(name, cond, msg) {
  try { assert.ok(cond, msg); pass++; console.log(`  ${c.g("ok")}  ${name}`); }
  catch (e) { fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`); }
}

section("Run 1.8 — toast behaviour (success auto-dismiss / error persistent)");
it("toast.js exports showToast", /export function showToast/.test(toast), "showToast not exported");
it("errors get role=alert, others role=status",
   /role[\s\S]*?"error"\s*\?\s*"alert"\s*:\s*"status"/.test(toast), "toast role mapping missing");
it("success/info auto-dismiss at 1.5s, errors persist (duration 0)",
   /type === "error" \? 0 : 1500/.test(toast), "auto-dismiss/persist policy missing");
it("a positive duration arms a dismiss timer",
   /if \(ms > 0\) t\._timer = setTimeout/.test(toast), "dismiss timer missing");
it("exit waits for the 200ms transition before removal",
   /classList\.add\("hide"\)[\s\S]*setTimeout\(\(\) => t\.remove\(\), 2\d\d\)/.test(toast), "exit transition/removal missing");

section("Run 1.8 — toast styles");
it("a toast region is fixed + non-interactive backdrop",
   /\.toast-region\s*\{[^}]*position:fixed[^}]*pointer-events:none/s.test(css), "toast-region styles missing");
it("toasts transition in/out over 200ms",
   /\.toast\s*\{[^}]*transition:opacity 200ms/s.test(css), "200ms toast transition missing");
it("success/error/info wear the right accent",
   /\.toast-success\s*\{[^}]*var\(--good\)/.test(css) &&
   /\.toast-error\s*\{[^}]*var\(--bad\)/.test(css) &&
   /\.toast-info\s*\{[^}]*var\(--accent\)/.test(css), "toast accent colours missing");

section("Run 1.8 — spinner + skeleton");
it("an on-brand spinner exists (currentColor + spin keyframe)",
   /\.spinner\s*\{[^}]*border-top-color:currentColor[\s\S]*@keyframes spin/s.test(css), "spinner missing");
it("a skeleton shimmer exists",
   /\.skeleton::after\b[\s\S]*@keyframes skeletonSweep/s.test(css), "skeleton shimmer missing");
it("the drawer git-status loading state shows a spinner",
   /data-git-status[^>]*>\s*<span class="spinner"/.test(ui), "git-status loading spinner missing");

section("Run 1.8 — disabled states + staggered entrance");
it("disabled controls are greyed + not-allowed",
   /button:disabled[\s\S]*\{[^}]*cursor:not-allowed/s.test(css), "disabled styling missing");
it("card entrance is staggered by --stagger * 50ms",
   /\.tcard\.spawning\s*\{[^}]*animation-delay:calc\(var\(--stagger[^)]*\)\s*\*\s*50ms\)/s.test(css), "stagger delay missing");
it("renderGrid sets the --stagger index per card",
   /setProperty\("--stagger"/.test(ui), "--stagger not wired in renderGrid");

section("Run 1.8 — wired into the app");
it("main.js imports showToast", /import \{ showToast \} from "\.\/toast\.js"/.test(main), "showToast not imported");
it("evolve-all raises a success toast",
   /Evolved \$\{n\}[\s\S]*type: "success"/.test(main), "evolve-all success toast missing");
it("error events raise persistent error toasts",
   (main.match(/showToast\([^)]*type: "error"/gs) || []).length >= 2, "error toasts not wired to error events");
it("a launch in flight disables its button with a spinner",
   /function setLaunchPending[\s\S]*btn\.disabled = true[\s\S]*class="spinner"/.test(main), "launch pending state missing");

console.log(`\nfeedback-suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
