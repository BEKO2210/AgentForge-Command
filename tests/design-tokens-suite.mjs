#!/usr/bin/env node
// AgentForge — design-tokens verification (Run 1.1, ROADMAP 2.0 Tier 1).
// Pure Node, no deps. Asserts the design system exists, defines the documented
// vocabulary, is loaded before styles.css, and that styles.css actually
// references the semantic colour tokens (proves the wiring, not just the file).
import * as assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let pass = 0, fail = 0;
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m` };
function section(n) { console.log(`== ${n} ==`); }
function it(name, fn) {
  try { fn(); pass++; console.log(`  ${c.g("ok")}  ${name}`); }
  catch (e) { fail++; console.log(`  ${c.r("FAIL")} ${name}\n      ${e.message}`); }
}

const tokens = read("gui/public/arena/design-tokens.css");
const html = read("gui/public/arena.html");
const styles = read("gui/public/arena/styles.css");

section("design-tokens.css defines the documented vocabulary");
const required = [
  "--spacing-xs", "--spacing-sm", "--spacing-md", "--spacing-lg", "--spacing-xl",
  "--shadow-sm", "--shadow-md", "--shadow-lg",
  "--radius-sm", "--radius-md",
  "--ease-standard", "--dur-fast",
  "--font-mono", "--font-ui",
  "--color-accent", "--color-accent-success", "--color-accent-warn", "--color-accent-error",
  "--focus-ring", "--tap-target",
];
for (const t of required) {
  it(`defines ${t}`, () => assert.ok(new RegExp(`${t}\\s*:`).test(tokens), `${t} missing from design-tokens.css`));
}

section("design-tokens.css is loaded before styles.css");
it("arena.html links design-tokens.css", () => assert.match(html, /design-tokens\.css/));
it("design-tokens.css comes before styles.css", () => {
  assert.ok(html.indexOf("design-tokens.css") < html.indexOf("styles.css"),
    "design-tokens.css must be linked before styles.css so tokens cascade first");
});

section("styles.css references the tokens (wiring, not just a file)");
for (const [legacy, token] of [["--good", "--color-accent-success"], ["--warn", "--color-accent-warn"], ["--bad", "--color-accent-error"], ["--accent", "--color-accent"]]) {
  it(`${legacy} flows from ${token}`, () => assert.ok(
    new RegExp(`${legacy}\\s*:\\s*var\\(${token}`).test(styles),
    `${legacy} should be var(${token}, …)`));
}

console.log(`\ndesign-tokens-suite: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
