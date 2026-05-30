#!/usr/bin/env node
// AgentForge — WCAG contrast gate (Run 1.6, ROADMAP 2.0 Tier 1).
//
// Reads the REAL token values out of design-tokens.css and asserts every
// text/accent colour clears its WCAG 2.1 AA threshold against every cockpit
// background it can sit on. This is a regression gate: if a future token edit
// drops a colour below AA, the gate goes red — contrast can't silently rot.
//
// Thresholds (WCAG 2.1):
//   • normal text  → 4.5:1   (1.4.3 Contrast Minimum)
//   • large/UI/non-text → 3:1 (1.4.3 large, 1.4.11 non-text)
import * as assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokens = fs.readFileSync(path.join(ROOT, "gui/public/arena/design-tokens.css"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "gui/public/arena/styles.css"), "utf8");

let pass = 0, fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };
function section(n) { console.log(`== ${n} ==`); }
function it(name, cond, msg) {
  try { assert.ok(cond, msg); pass++; console.log(`  ${c.g("ok")}  ${name}`); }
  catch (e) { fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`); }
}

// ---- colour math (sRGB relative luminance → WCAG ratio) -------------------
const parseHex = (h) => {
  h = h.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lin = (ch) => { ch /= 255; return ch <= 0.03928 ? ch / 12.92 : Math.pow((ch + 0.055) / 1.055, 2.4); };
const lum = (rgb) => { const [r, g, b] = rgb.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => {
  const la = lum(parseHex(a)) + 0.05, lb = lum(parseHex(b)) + 0.05;
  return Math.max(la, lb) / Math.min(la, lb);
};

// ---- pull real token values out of the stylesheet -------------------------
const tok = (name) => {
  const m = tokens.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})`));
  assert.ok(m, `token ${name} not found / not a hex literal in design-tokens.css`);
  return m[1];
};

const bg        = tok("--color-bg");
const surface   = tok("--color-surface");
// bg2 is the cockpit gradient floor in styles.css :root — read it too.
const bg2       = (css.match(/--bg2\s*:\s*(#[0-9a-fA-F]{3,8})/) || [])[1] || bg;
const BACKGROUNDS = { bg, surface, bg2 };

// Foreground text/icon tokens that carry meaning → must clear AA text (4.5:1).
const TEXT = {
  "--color-text": tok("--color-text"),
  "--color-text-muted": tok("--color-text-muted"),
  "--color-accent": tok("--color-accent"),
  "--color-accent-success": tok("--color-accent-success"),
  "--color-accent-warn": tok("--color-accent-warn"),
  "--color-accent-error": tok("--color-accent-error"),
  "--color-cta": tok("--color-cta"),
};

section("Run 1.6 — every text token clears WCAG AA (4.5:1) on every background");
for (const [bgName, bgVal] of Object.entries(BACKGROUNDS)) {
  for (const [name, val] of Object.entries(TEXT)) {
    const r = contrast(val, bgVal);
    it(`${name} (${val}) on ${bgName} (${bgVal}) → ${r.toFixed(2)}:1`,
       r >= 4.5, `only ${r.toFixed(2)}:1 — below AA text (4.5:1)`);
  }
}

section("Run 1.6 — focus ring is a high-contrast non-text indicator (≥3:1)");
{
  // Focus ring uses --color-accent-success; must clear 3:1 (1.4.11) on surfaces.
  const ring = tok("--color-accent-success");
  for (const [bgName, bgVal] of Object.entries(BACKGROUNDS)) {
    const r = contrast(ring, bgVal);
    it(`focus ring on ${bgName} → ${r.toFixed(2)}:1`, r >= 3, `only ${r.toFixed(2)}:1 (<3:1)`);
  }
}

section("Run 1.6 — opt-in high-contrast mode (prefers-contrast: more)");
it("a prefers-contrast: more block exists",
   /@media \(prefers-contrast: more\)/.test(css), "no prefers-contrast: more support");
it("high-contrast mode strengthens borders",
   /@media \(prefers-contrast: more\)[\s\S]*--border\s*:/.test(css), "borders not strengthened in high-contrast");
it("high-contrast mode brightens muted text",
   /@media \(prefers-contrast: more\)[\s\S]*--muted\s*:/.test(css), "muted not strengthened in high-contrast");

section("Run 1.6 — Windows High Contrast / forced-colors keeps focus visible");
it("a forced-colors: active block preserves a focus outline",
   /@media \(forced-colors: active\)[\s\S]*outline/.test(css), "no forced-colors focus fallback");

console.log(`\ncontrast-suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
