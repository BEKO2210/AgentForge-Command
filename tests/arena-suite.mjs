#!/usr/bin/env node
// AgentForge arena — unit tests for the in-process modules.
//
// No external test framework. The runner counts pass/fail and exits 1 if any
// case fails. Output mirrors the bash suite's `ok` / `FAIL` lines so it
// composes naturally with tests/run.sh.

import * as assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Dynamic import of an absolute path needs a file:// URL on Windows.
const importLocal = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

let pass = 0;
let fail = 0;
let suite = "";

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  dim:   (s) => `\x1b[2m${s}\x1b[0m`,
};

function describe(name, fn) {
  suite = name; console.log(`== ${name} ==`);
  try { fn(); } catch (e) {
    fail++; console.log(`  ${c.red("FAIL")} (suite threw: ${e.message})`);
  }
}
async function describeAsync(name, fn) {
  suite = name; console.log(`== ${name} ==`);
  try { await fn(); } catch (e) {
    fail++; console.log(`  ${c.red("FAIL")} (suite threw: ${e.message})`);
  }
}
function it(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === "function") {
      return r.then(() => { pass++; console.log(`  ${c.green("ok")}  ${name}`); })
              .catch((e) => { fail++; console.log(`  ${c.red("FAIL")} ${name}\n      ${e.message}`); });
    }
    pass++; console.log(`  ${c.green("ok")}  ${name}`);
  } catch (e) {
    fail++; console.log(`  ${c.red("FAIL")} ${name}\n      ${e.message}`);
  }
}

/* ----- lib/state.mjs --------------------------------------------------- */

describe("lib/state.mjs · buildState / parseBoard", async () => {
  const mod = await importLocal("lib/state.mjs");
  const fs = await import("node:fs");
  const os = await import("node:os");

  it("buildState returns the contract shape", () => {
    const s = mod.buildState({ repoDir: ROOT });
    assert.ok(typeof s.generatedAt === "string");
    assert.ok(typeof s.counts === "object");
    assert.ok(Array.isArray(s.tasks));
    assert.ok(Array.isArray(s.roles));
    for (const k of ["total", "todo", "doing", "blocked", "done"]) {
      assert.equal(typeof s.counts[k], "number");
    }
  });

  it("buildState parses tasks out of the .team board fixture", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arena-state-"));
    fs.mkdirSync(path.join(dir, ".team", "roles"), { recursive: true });
    fs.mkdirSync(path.join(dir, ".team", "log"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".team", "board.md"),
      "| # | Task | Owner | State | Notes |\n" +
      "|---|------|-------|-------|-------|\n" +
      "| 1 | a    | atlas | done  | done  |\n" +
      "| 2 | b    | forge | doing | —     |\n");
    for (const r of ["lead", "backend", "frontend", "quality"]) {
      fs.writeFileSync(path.join(dir, ".team", "roles", r + ".md"), `# ${r}\n`);
    }
    const s = mod.buildState({ repoDir: dir });
    assert.equal(s.counts.total, 2);
    assert.equal(s.counts.done, 1);
    assert.equal(s.counts.doing, 1);
    assert.equal(s.tasks[0].owner, "atlas");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

/* ----- gui/public/arena/state.js --------------------------------------- */

describe("arena/state.js · createStore", async () => {
  const mod = await importLocal("gui/public/arena/state.js");
  const s = mod.createStore({ a: 1, b: 2 });

  it("get returns initial values", () => {
    assert.equal(s.get("a"), 1);
    assert.equal(s.get("b"), 2);
  });

  it("set + subscribe fires the subscriber", () => {
    let called = 0; let lastVal = null;
    const unsub = s.subscribe("a", (v) => { called++; lastVal = v; });
    s.set("a", 99);
    assert.equal(called, 1);
    assert.equal(lastVal, 99);
    unsub();
    s.set("a", 100);
    assert.equal(called, 1, "unsubscribe must stop fires");
  });

  it("set on same value does not fire", () => {
    let called = 0;
    s.subscribe("b", () => called++);
    s.set("b", s.get("b"));
    assert.equal(called, 0);
  });

  it("update mutates via callback", () => {
    s.update("a", (v) => v + 1);
    assert.equal(s.get("a"), 101);
  });

  it("wildcard subscriber sees every change", () => {
    const seen = [];
    const stop = s.subscribe("*", (_v, _p, k) => seen.push(k));
    s.set("a", 200);
    s.set("b", 200);
    assert.deepEqual(seen, ["a", "b"]);
    stop();
  });
});

/* ----- gui/public/arena/data.js ---------------------------------------- */

describe("arena/data.js · roster integrity", async () => {
  const mod = await importLocal("gui/public/arena/data.js");

  it("12 specialists, atlas first with lead role", () => {
    assert.equal(mod.SEED_AGENTS.length, 12);
    assert.equal(mod.SEED_AGENTS[0].id, "atlas");
    assert.equal(mod.SEED_AGENTS[0].lead, true);
  });

  it("every agent has the full identity shape", () => {
    for (const a of mod.SEED_AGENTS) {
      for (const k of ["id","name","title","role","mascot","color","lane","superSkill"]) {
        assert.ok(a[k], `${a.id} missing ${k}`);
      }
    }
  });

  it("priors cover every agent", () => {
    for (const a of mod.SEED_AGENTS) {
      const p = mod.PRIORS[a.id];
      assert.ok(p, `${a.id} missing PRIORS entry`);
      for (const k of ["risk","confidence","qualityScore"]) {
        assert.ok(typeof p[k] === "number" && p[k] >= 0 && p[k] <= 1, `${a.id}.${k} not in [0,1]`);
      }
    }
  });

  it("BRIEFINGS cover every agent", () => {
    for (const a of mod.SEED_AGENTS) {
      assert.ok(typeof mod.BRIEFINGS[a.id] === "string");
      assert.ok(mod.BRIEFINGS[a.id].length > 10);
    }
  });

  it("ids are unique", () => {
    const ids = mod.SEED_AGENTS.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("lanes are one of the four .team logs", () => {
    const valid = new Set(["lead", "backend", "frontend", "quality"]);
    for (const a of mod.SEED_AGENTS) {
      assert.ok(valid.has(a.lane), `${a.id} has unknown lane ${a.lane}`);
    }
  });
});

/* ----- gui/public/arena/mascots.js ------------------------------------- */

describe("arena/mascots.js · renderMascot", async () => {
  const mod = await importLocal("gui/public/arena/mascots.js");

  it("exports 12 mascot ids", () => {
    assert.equal(mod.MASCOT_IDS.length, 12);
    for (const m of ["turtle","owl","fox","mole","chameleon","bat","hummingbird","raven","raccoon","darkRaven","firefly","dragon"]) {
      assert.ok(mod.MASCOT_IDS.includes(m), `${m} missing from MASCOT_IDS`);
    }
  });

  it("renders an SVG string with the right classes", () => {
    const svg = mod.renderMascot({ mascot: "turtle", level: 3, color: "#abc", state: "working" });
    assert.match(svg, /^\s*<svg/);
    assert.match(svg, /mascot-turtle/);
    assert.match(svg, /state-working/);
    assert.match(svg, /lvl-3/);
    assert.match(svg, /<\/svg>\s*$/);
  });

  it("level 1 produces the base body only; level 5 adds ornaments", () => {
    const lvl1 = mod.renderMascot({ mascot: "owl", level: 1 });
    const lvl5 = mod.renderMascot({ mascot: "owl", level: 5 });
    // Pixel-art rect count grows monotonically with evolution level.
    const c1 = (lvl1.match(/<rect /g) || []).length;
    const c5 = (lvl5.match(/<rect /g) || []).length;
    assert.ok(c5 > c1, `level 5 (${c5}) should have more rects than level 1 (${c1})`);
  });
  it("uses a 32×32 pixel-art viewBox with crisp edges", () => {
    const svg = mod.renderMascot({ mascot: "fox", level: 3 });
    assert.match(svg, /viewBox="0 0 32 32"/);
    assert.match(svg, /shape-rendering="crispEdges"/);
  });

  it("unknown mascot falls back to the turtle template", () => {
    const svg = mod.renderMascot({ mascot: "nonsense", level: 1 });
    assert.match(svg, /mascot-nonsense/);   // class follows the id
    assert.match(svg, /r-shell/);            // body parts are the turtle's
  });

  it("respects size presets", () => {
    const sm = mod.renderMascot({ mascot: "fox", size: "sm" });
    const xl = mod.renderMascot({ mascot: "fox", size: "xl" });
    assert.match(sm, /width="64"/);
    assert.match(xl, /width="240"/);
  });
});

/* ----- gui/public/arena/spawner.js ------------------------------------- */

describe("arena/spawner.js · createSpawnEngine", async () => {
  const stateMod   = await importLocal("gui/public/arena/state.js");
  const spawnerMod = await importLocal("gui/public/arena/spawner.js");

  function freshEngine(persisted = {}) {
    const store = stateMod.createStore({ agents: [], timeline: [] });
    const engine = spawnerMod.createSpawnEngine({ store, persisted });
    engine.bootstrap();
    return { store, engine };
  }

  it("bootstrap puts 12 agents in the registry", () => {
    const { engine } = freshEngine();
    assert.equal(engine.registry.size, 12);
    assert.ok(engine.get("atlas"));
    assert.ok(engine.get("sentinel"));
  });

  it("persisted evolution levels are restored", () => {
    const { engine } = freshEngine({ evolution: { sentinel: 4 } });
    assert.equal(engine.get("sentinel").evolutionLevel, 4);
    assert.equal(engine.get("aurora").evolutionLevel, 1);
  });

  it("evolve increments and caps at level 5", () => {
    const { engine } = freshEngine();
    for (let i = 0; i < 10; i++) engine.evolve("forge");
    assert.equal(engine.get("forge").evolutionLevel, 5);
  });

  it("appendLine on a specialist emits a 'report' timeline event", () => {
    const { engine } = freshEngine();
    const before = engine.timeline.length;
    engine.appendLine("sentinel", "audit clear");
    const after = engine.timeline.length;
    assert.ok(after > before);
    assert.equal(engine.timeline[0].kind, "report");
    assert.match(engine.timeline[0].label, /SENTINEL/);
  });

  it("appendLine on Atlas does NOT emit a report event", () => {
    const { engine } = freshEngine();
    const before = engine.timeline.filter((e) => e.kind === "report").length;
    engine.appendLine("atlas", "thinking…");
    const after = engine.timeline.filter((e) => e.kind === "report").length;
    assert.equal(after, before);
  });

  it("setPtyRunning flips status and emits pty-up/pty-down", () => {
    const { engine } = freshEngine();
    engine.setPtyRunning("aurora", true);
    assert.equal(engine.get("aurora").ptyRunning, true);
    assert.equal(engine.timeline[0].kind, "pty-up");
    engine.setPtyRunning("aurora", false);
    assert.equal(engine.get("aurora").ptyRunning, false);
    assert.equal(engine.timeline[0].kind, "pty-down");
  });

  it("spawnAgent adds a custom specialist that customAgentSpecs() exports", () => {
    const { engine } = freshEngine();
    engine.spawnAgent({ id: "oracle", name: "ORACLE", title: "Test", role: "X",
                       superSkill: "y", mascot: "fox", color: "#abc" });
    assert.ok(engine.get("oracle"));
    const specs = engine.customAgentSpecs();
    assert.equal(specs.length, 1);
    assert.equal(specs[0].id, "oracle");
  });

  it("toggleAutoEnter flips and emits a timeline event", () => {
    const { engine } = freshEngine();
    engine.toggleAutoEnter("forge");
    assert.equal(engine.get("forge").autoEnter, true);
    assert.equal(engine.timeline[0].kind, "auto-on");
    engine.toggleAutoEnter("forge");
    assert.equal(engine.get("forge").autoEnter, false);
    assert.equal(engine.timeline[0].kind, "auto-off");
  });
});

/* ----- gui/llm.js ------------------------------------------------------ */

describe("gui/llm.js · config + pricing", async () => {
  const mod = await importLocal("gui/llm.js");

  it("PRICING covers the three model tiers", () => {
    for (const id of ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"]) {
      assert.ok(mod.PRICING[id], `${id} missing from PRICING`);
      assert.ok(mod.PRICING[id].in > 0);
      assert.ok(mod.PRICING[id].out > mod.PRICING[id].in,
                `${id} output cheaper than input — sanity check`);
    }
  });

  it("llmConfig reports enabled iff key is set", () => {
    const orig = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal(mod.llmConfig().enabled, false);
    process.env.ANTHROPIC_API_KEY = "sk-test-fake";
    assert.equal(mod.llmConfig().enabled, true);
    assert.ok(mod.llmConfig().model);
    if (orig === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = orig;
  });
});

/* ----- server.js · parseAtlasBrief + spend helpers --------------------- */

describe("server.js · parseAtlasBrief", async () => {
  // The parser is identical to the helper in tests/parser_test.mjs but we
  // inline a copy so the test runs without launching the server.
  function parseAtlasBrief(text) {
    if (!text) return { plan: "", briefings: [] };
    const lines = text.split(/\r?\n/);
    let i = lines.findIndex((l) => /^\s*briefings\s*:?/i.test(l));
    const plan = i > 0 ? lines.slice(0, i).join("\n").trim() : text.trim();
    const briefings = [];
    if (i >= 0) {
      for (const raw of lines.slice(i + 1)) {
        const m = raw.match(/^[\s*\-•]*@?([a-z][a-z0-9_-]*)\s*[:\-—]\s*(.+?)\s*$/i);
        if (m && m[2].length > 0) briefings.push({ id: m[1].toLowerCase(), task: m[2] });
      }
    }
    return { plan, briefings };
  }

  it("standard dash-bullet briefings", () => {
    const r = parseAtlasBrief("Plan.\n\nBRIEFINGS:\n- forge: pin deps\n- sentinel: audit gate");
    assert.equal(r.briefings.length, 2);
    assert.equal(r.briefings[0].id, "forge");
    assert.equal(r.briefings[1].task, "audit gate");
  });

  it("star-bullets and @-prefixed ids", () => {
    const r = parseAtlasBrief("BRIEFINGS:\n* @aurora: polish hero\n* @luma: contrast pass");
    assert.equal(r.briefings.length, 2);
    assert.equal(r.briefings[0].id, "aurora");
  });

  it("no BRIEFINGS section yields empty array", () => {
    const r = parseAtlasBrief("Atlas thinking out loud.");
    assert.equal(r.briefings.length, 0);
    assert.equal(r.plan, "Atlas thinking out loud.");
  });

  it("em-dash separator works", () => {
    const r = parseAtlasBrief("BRIEFINGS:\n- raven — bisect last commit");
    assert.equal(r.briefings.length, 1);
    assert.equal(r.briefings[0].task, "bisect last commit");
  });

  it("ignores garbage lines silently", () => {
    const r = parseAtlasBrief("BRIEFINGS:\n- forge: x\nfoo bar baz\n- vega: fast");
    assert.equal(r.briefings.length, 2);
    assert.equal(r.briefings[0].id, "forge");
    assert.equal(r.briefings[1].id, "vega");
  });
});

describe("server.js · spendForecast", () => {
  function spendForecast(briefs, totalUsd, budgetUsd) {
    const last = briefs.slice(-10);
    if (last.length === 0) return { samples: 0, trend: "steady", burnPerMin: 0,
                                     timeToBudgetSec: null, nextHourUsd: 0, avgCost: null };
    const avgCost = last.reduce((s, b) => s + b.cost, 0) / last.length;
    const samples = last.length;
    if (samples < 2) return { avgCost, samples, trend: "steady", burnPerMin: 0,
                              timeToBudgetSec: null, nextHourUsd: 0 };
    const windowSec = Math.max(1, Math.round((last[last.length - 1].ts - last[0].ts) / 1000));
    const windowMin = windowSec / 60;
    const cumulative = last.reduce((s, b) => s + b.cost, 0);
    const burnPerMin = windowMin > 0 ? cumulative / windowMin : 0;
    const nextHourUsd = burnPerMin * 60;
    const remaining = budgetUsd > 0 ? Math.max(0, budgetUsd - totalUsd) : null;
    const timeToBudgetSec = (remaining !== null && burnPerMin > 0)
      ? Math.round((remaining / burnPerMin) * 60) : null;
    const mid = Math.floor(samples / 2);
    const oldHalf = last.slice(0, mid).reduce((s, b) => s + b.cost, 0) / Math.max(1, mid);
    const newHalf = last.slice(mid).reduce((s, b) => s + b.cost, 0) / Math.max(1, samples - mid);
    let trend = "steady";
    if (newHalf > oldHalf * 1.2) trend = "rising";
    else if (newHalf < oldHalf * 0.8) trend = "falling";
    return { avgCost, samples, windowSec, burnPerMin, nextHourUsd, timeToBudgetSec, trend };
  }

  const now = Date.now();
  it("0 samples → steady, no projection", () => {
    const r = spendForecast([], 0, 0);
    assert.equal(r.samples, 0);
    assert.equal(r.trend, "steady");
    assert.equal(r.burnPerMin, 0);
  });
  it("1 sample → still steady, no projection", () => {
    const r = spendForecast([{ ts: now, cost: 0.1 }], 0.1, 0);
    assert.equal(r.samples, 1);
    assert.equal(r.burnPerMin, 0);
  });
  it("constant-cost briefs → trend=steady, burn computed", () => {
    const briefs = Array.from({ length: 4 }, (_, i) => ({ ts: now + i * 60000, cost: 0.01 }));
    const r = spendForecast(briefs, 0.04, 0);
    assert.equal(r.trend, "steady");
    assert.ok(r.burnPerMin > 0);
  });
  it("ramp-up cost → trend=rising", () => {
    const briefs = [
      { ts: now + 0,      cost: 0.001 },
      { ts: now + 60000,  cost: 0.001 },
      { ts: now + 120000, cost: 0.020 },
      { ts: now + 180000, cost: 0.022 },
    ];
    const r = spendForecast(briefs, 0.044, 0);
    assert.equal(r.trend, "rising");
  });
  it("ramp-down cost → trend=falling", () => {
    const briefs = [
      { ts: now + 0,      cost: 0.05 },
      { ts: now + 60000,  cost: 0.04 },
      { ts: now + 120000, cost: 0.005 },
      { ts: now + 180000, cost: 0.001 },
    ];
    const r = spendForecast(briefs, 0.1, 0);
    assert.equal(r.trend, "falling");
  });
  it("budget set → timeToBudgetSec is finite when burning", () => {
    const briefs = Array.from({ length: 4 }, (_, i) => ({ ts: now + i * 60000, cost: 0.01 }));
    const r = spendForecast(briefs, 0.04, 1.00);
    assert.ok(r.timeToBudgetSec !== null);
    assert.ok(r.timeToBudgetSec > 0);
  });
});

/* ----- Summary --------------------------------------------------------- */

setTimeout(() => {
  console.log("");
  console.log(`arena unit tests: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}, 200);
