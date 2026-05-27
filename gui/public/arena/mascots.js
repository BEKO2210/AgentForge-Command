// AgentForge mascots — pixel-art primitives.
//
// Every mascot is built from `<rect>` elements only — no paths, no curves.
// Same approach Claude's own mascot animations use ([Codrops, May 2026]).
// That choice has three concrete payoffs:
//
// 1. **Recognisability.** A pixel silhouette reads as the animal almost
//    immediately — turtles get shells, owls get giant eye pairs, foxes get
//    sharp ear triangles. Where the previous line-art primitives had to be
//    studied, the silhouette here is the whole point.
// 2. **Animation cost.** Animating individual `<rect>`s with CSS transforms
//    (translate / scaleY / rotate) costs nothing and reads as deliberate
//    animation: wing flap = two rects scaleY 1 ↔ 0.4, blink = pupil scaleY
//    1 ↔ 0.1, breath = body translateY ±1px.
// 3. **Theme fit.** Pixel-art matches a terminal cockpit — anything painterly
//    would fight the rest of the UI.
//
// SVG `viewBox` is 32×32 for every species. Evolution levels (1..5) add
// ornament rects on top of the base — see SPRITES[*].evo[].
//
// Naming: each rect carries the class `r-<id>` where <id> is the body-part
// it belongs to. CSS targets these classes for per-part animation.

const RECTS = (rects) =>
  rects.map((r) => {
    const cls = r.c ? ` class="r-${r.c}"` : "";
    const op = r.o !== undefined ? ` opacity="${r.o}"` : "";
    return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.f}"${cls}${op}/>`;
  }).join("");

/**
 * Render a mascot.
 * @param {object} opt
 * @param {string} opt.mascot   - turtle, owl, fox, mole, chameleon, bat,
 *                                 hummingbird, raven, raccoon, darkRaven,
 *                                 firefly, dragon
 * @param {number} [opt.level]  - 1..5 evolution level
 * @param {string} [opt.color]  - accent colour used by the halo + sparks
 * @param {string} [opt.state]  - idle | thinking | working | success | warning
 * @param {("xs"|"sm"|"md"|"lg"|"xl")} [opt.size]
 */
export function renderMascot({ mascot, level = 1, color = "#5b8cff", state = "idle", size = "md" }) {
  const dim = { xs: 40, sm: 64, md: 96, lg: 160, xl: 240 }[size] || 96;
  const lvl = Math.max(1, Math.min(5, level | 0));
  const spec = SPRITES[mascot] || SPRITES.turtle;
  const base = RECTS(spec.base);
  // Evolution layers stack additively — at level 3 the level-1, -2, -3
  // ornaments are all on. Each layer is rendered above the base body.
  let evo = "";
  for (let i = 0; i < lvl - 1 && spec.evo && spec.evo[i]; i++) {
    evo += RECTS(spec.evo[i]);
  }
  return `
    <svg class="mascot mascot-${mascot} state-${state} lvl-${lvl} size-${size}"
         data-mascot="${mascot}" viewBox="0 0 32 32"
         width="${dim}" height="${dim}"
         shape-rendering="crispEdges"
         style="color:${color}"
         role="img" aria-label="${spec.label || mascot} mascot, evolution level ${lvl}, state ${state}">
      <rect class="halo" x="2" y="2" width="28" height="28" fill="currentColor" opacity="${0.04 + lvl * 0.025}" rx="4"/>
      <g class="mascot-body">${base}</g>
      <g class="mascot-evo">${evo}</g>
    </svg>
  `;
}

/* ----------------------------------------------------------------------- *
 *  Sprite library
 *
 *  Each species is a base body + up to 4 evolution layers. All coordinates
 *  fit in a 32×32 grid. The first level is the bare silhouette; layers add
 *  accessories, glow, and identity markers.
 * ----------------------------------------------------------------------- */

const SPRITES = {

  /* ── ATLAS — Cyber Turtle ─────────────────────────────────────────── *
   * Iconic green shell (with hex pattern), small head with two pixel
   * eyes, four stubby legs, short tail. Antenna at evolution 5.            */
  turtle: {
    label: "cyber turtle",
    base: [
      // shadow strip
      { c: "shadow", x: 6,  y: 25, w: 20, h: 1,  f: "#000", o: 0.35 },
      // four legs
      { c: "leg",  x: 6,  y: 21, w: 3, h: 4, f: "#3f6c45" },
      { c: "leg",  x: 23, y: 21, w: 3, h: 4, f: "#3f6c45" },
      { c: "leg",  x: 9,  y: 22, w: 3, h: 3, f: "#3f6c45" },
      { c: "leg",  x: 20, y: 22, w: 3, h: 3, f: "#3f6c45" },
      // shell shadow / underside
      { c: "shell-base", x: 5, y: 14, w: 22, h: 8, f: "#2a4530" },
      // shell main dome
      { c: "shell", x: 6,  y: 11, w: 20, h: 10, f: "#4a8a55" },
      { c: "shell", x: 7,  y: 10, w: 18, h: 1,  f: "#4a8a55" },
      { c: "shell", x: 8,  y: 9,  w: 16, h: 1,  f: "#4a8a55" },
      // shell highlight
      { c: "shell-light", x: 8, y: 11, w: 5, h: 1, f: "#7bbd8a" },
      { c: "shell-light", x: 7, y: 12, w: 3, h: 1, f: "#7bbd8a" },
      // shell pattern (hex tiles)
      { c: "shell-pattern", x: 11, y: 13, w: 3, h: 3, f: "#3f6c45" },
      { c: "shell-pattern", x: 16, y: 13, w: 3, h: 3, f: "#3f6c45" },
      { c: "shell-pattern", x: 13, y: 17, w: 3, h: 3, f: "#3f6c45" },
      { c: "shell-pattern", x: 18, y: 16, w: 3, h: 2, f: "#3f6c45" },
      // tail
      { c: "tail", x: 26, y: 17, w: 2, h: 2, f: "#5fa86d" },
      { c: "tail", x: 28, y: 18, w: 1, h: 1, f: "#5fa86d" },
      // head + neck
      { c: "neck", x: 3,  y: 16, w: 3, h: 3, f: "#5fa86d" },
      { c: "head", x: 1,  y: 14, w: 5, h: 5, f: "#5fa86d" },
      // eyes (two black pixels)
      { c: "eye",  x: 2,  y: 16, w: 1, h: 1, f: "#000" },
      { c: "eye",  x: 4,  y: 16, w: 1, h: 1, f: "#000" },
    ],
    evo: [
      // lvl 2 — radar dot on shell
      [ { c: "radar", x: 15, y: 9, w: 2, h: 2, f: "currentColor" } ],
      // lvl 3 — shell lights blink
      [ { c: "shell-led", x: 10, y: 14, w: 1, h: 1, f: "currentColor" },
        { c: "shell-led", x: 20, y: 14, w: 1, h: 1, f: "currentColor" } ],
      // lvl 4 — command-bridge bar
      [ { c: "bridge", x: 8,  y: 8, w: 16, h: 1, f: "currentColor", o: 0.7 } ],
      // lvl 5 — antenna
      [ { c: "antenna",     x: 15, y: 3, w: 2, h: 6, f: "currentColor" },
        { c: "antenna-tip", x: 14, y: 1, w: 4, h: 2, f: "currentColor" } ],
    ],
  },

  /* ── SENTINEL — Guardian Owl ──────────────────────────────────────── *
   * Stout body, big yellow eyes that fill half the head, tiny triangular
   * beak, two ear tufts, talon row. Pupils blink. Scan-line at evo 2.       */
  owl: {
    label: "guardian owl",
    base: [
      // body
      { c: "body", x: 7,  y: 11, w: 18, h: 14, f: "#5e3f2d" },
      { c: "body", x: 8,  y: 10, w: 16, h: 1,  f: "#5e3f2d" },
      // chest
      { c: "chest", x: 10, y: 16, w: 12, h: 9, f: "#a07655" },
      // head
      { c: "head", x: 6,  y: 6,  w: 20, h: 8,  f: "#5e3f2d" },
      { c: "head", x: 7,  y: 5,  w: 18, h: 1,  f: "#5e3f2d" },
      { c: "head", x: 9,  y: 4,  w: 14, h: 1,  f: "#5e3f2d" },
      // ear tufts
      { c: "tuft",  x: 6,  y: 3, w: 2, h: 2,  f: "#5e3f2d" },
      { c: "tuft",  x: 24, y: 3, w: 2, h: 2,  f: "#5e3f2d" },
      // face disc (light feather ring)
      { c: "face",  x: 8,  y: 7, w: 16, h: 7, f: "#c7a37f" },
      // huge eyes — yellow ring + black pupil + white glint
      { c: "eye-bg",   x: 9,  y: 8, w: 5, h: 5, f: "#fcd34d" },
      { c: "eye-bg",   x: 18, y: 8, w: 5, h: 5, f: "#fcd34d" },
      { c: "eye-pupil",x: 10, y: 9, w: 3, h: 3, f: "#000" },
      { c: "eye-pupil",x: 19, y: 9, w: 3, h: 3, f: "#000" },
      { c: "eye-glint",x: 11, y: 9, w: 1, h: 1, f: "#fff" },
      { c: "eye-glint",x: 20, y: 9, w: 1, h: 1, f: "#fff" },
      // beak
      { c: "beak", x: 15, y: 13, w: 2, h: 2, f: "#f59e0b" },
      { c: "beak", x: 16, y: 15, w: 1, h: 1, f: "#f59e0b" },
      // talons
      { c: "talon", x: 9,  y: 25, w: 2, h: 2, f: "#f59e0b" },
      { c: "talon", x: 14, y: 25, w: 2, h: 2, f: "#f59e0b" },
      { c: "talon", x: 19, y: 25, w: 2, h: 2, f: "#f59e0b" },
    ],
    evo: [
      // lvl 2 — scan line under eyes
      [ { c: "scan", x: 6, y: 14, w: 20, h: 1, f: "currentColor", o: 0.7 } ],
      // lvl 3 — chest feather pattern
      [ { c: "feather", x: 12, y: 18, w: 2, h: 1, f: "#5e3f2d" },
        { c: "feather", x: 16, y: 18, w: 2, h: 1, f: "#5e3f2d" },
        { c: "feather", x: 14, y: 20, w: 2, h: 1, f: "#5e3f2d" } ],
      // lvl 4 — wing edges
      [ { c: "wing", x: 5,  y: 14, w: 2, h: 7, f: "#3a261a" },
        { c: "wing", x: 25, y: 14, w: 2, h: 7, f: "#3a261a" } ],
      // lvl 5 — aura halo
      [ { c: "aura", x: 4, y: 5, w: 24, h: 22, f: "currentColor", o: 0.12 } ],
    ],
  },

  /* ── AURORA — Neon Fox ────────────────────────────────────────────── *
   * Pointy triangular head, big ears, white muzzle + chest, long bushy
   * tail with WHITE tip, four legs. Glow stripe on tail at evo 2.          */
  fox: {
    label: "neon fox",
    base: [
      // legs
      { c: "leg", x: 10, y: 24, w: 2, h: 4, f: "#c2410c" },
      { c: "leg", x: 16, y: 24, w: 2, h: 4, f: "#c2410c" },
      { c: "leg", x: 20, y: 24, w: 2, h: 4, f: "#c2410c" },
      // tail (orange) with white tip
      { c: "tail", x: 22, y: 14, w: 3, h: 2, f: "#e85a1c" },
      { c: "tail", x: 24, y: 15, w: 3, h: 3, f: "#e85a1c" },
      { c: "tail", x: 26, y: 17, w: 3, h: 4, f: "#e85a1c" },
      { c: "tail-tip", x: 27, y: 20, w: 3, h: 3, f: "#fff" },
      // body
      { c: "body", x: 8,  y: 16, w: 16, h: 9, f: "#e85a1c" },
      { c: "body", x: 9,  y: 15, w: 14, h: 1, f: "#e85a1c" },
      // belly (white)
      { c: "belly", x: 10, y: 21, w: 12, h: 3, f: "#fff" },
      // head — triangular shape via stacked rects
      { c: "head", x: 6,  y: 10, w: 8,  h: 7, f: "#e85a1c" },
      { c: "head", x: 7,  y: 9,  w: 6,  h: 1, f: "#e85a1c" },
      { c: "head", x: 4,  y: 13, w: 2,  h: 3, f: "#e85a1c" },   // muzzle taper
      // ears (orange triangles)
      { c: "ear",   x: 5,  y: 6, w: 3, h: 4, f: "#e85a1c" },
      { c: "ear",   x: 12, y: 6, w: 3, h: 4, f: "#e85a1c" },
      // inner ear (pink)
      { c: "ear-in", x: 6,  y: 8, w: 1, h: 2, f: "#fda4af" },
      { c: "ear-in", x: 13, y: 8, w: 1, h: 2, f: "#fda4af" },
      // muzzle (white)
      { c: "muzzle", x: 3,  y: 14, w: 4, h: 2, f: "#fff" },
      // black nose tip
      { c: "nose",   x: 2,  y: 14, w: 2, h: 2, f: "#111" },
      // eyes
      { c: "eye",    x: 8,  y: 12, w: 1, h: 1, f: "#111" },
      { c: "eye",    x: 12, y: 12, w: 1, h: 1, f: "#111" },
    ],
    evo: [
      // lvl 2 — tail glow stripe
      [ { c: "tail-glow", x: 22, y: 13, w: 8, h: 1, f: "currentColor", o: 0.7 } ],
      // lvl 3 — cheek shimmer (sparkle pixel near tail)
      [ { c: "shimmer", x: 17, y: 12, w: 1, h: 1, f: "currentColor" },
        { c: "shimmer", x: 19, y: 14, w: 1, h: 1, f: "currentColor" } ],
      // lvl 4 — back stripe (darker accent)
      [ { c: "stripe", x: 12, y: 16, w: 10, h: 1, f: "#9a2f0a" } ],
      // lvl 5 — outer aura ring
      [ { c: "aura", x: 1, y: 8, w: 30, h: 18, f: "currentColor", o: 0.1 } ],
    ],
  },

  /* ── FORGE — Forge Mole ───────────────────────────────────────────── *
   * Almost blind mole — tiny eye slit, big pink snout, two GIANT shovel
   * claws on the front. Body brown, fur tufts at evo 3. Anvil at lvl 4.   */
  mole: {
    label: "forge mole",
    base: [
      // body
      { c: "body", x: 5,  y: 12, w: 22, h: 14, f: "#5a4030" },
      { c: "body", x: 6,  y: 11, w: 20, h: 1,  f: "#5a4030" },
      { c: "body", x: 4,  y: 14, w: 1,  h: 10, f: "#5a4030" },
      { c: "body", x: 27, y: 14, w: 1,  h: 10, f: "#5a4030" },
      // belly highlight
      { c: "belly", x: 7,  y: 18, w: 18, h: 6, f: "#7a5a44" },
      // snout (pink)
      { c: "snout", x: 1,  y: 16, w: 4, h: 3, f: "#fb7185" },
      // tiny eye slit
      { c: "eye",   x: 7,  y: 15, w: 2, h: 1, f: "#111" },
      // whiskers
      { c: "whisker", x: 0, y: 14, w: 1, h: 1, f: "#a78bfa", o: 0.7 },
      { c: "whisker", x: 0, y: 19, w: 1, h: 1, f: "#a78bfa", o: 0.7 },
      // two BIG shovel claws on front
      { c: "claw",  x: 24, y: 19, w: 6, h: 3, f: "#cbd5e1" },
      { c: "claw",  x: 25, y: 22, w: 5, h: 1, f: "#cbd5e1" },
      { c: "claw",  x: 26, y: 23, w: 4, h: 1, f: "#94a3b8" },
      // claw tips (silver)
      { c: "claw-tip", x: 29, y: 19, w: 1, h: 1, f: "#fff" },
      { c: "claw-tip", x: 29, y: 21, w: 1, h: 1, f: "#fff" },
      // back feet
      { c: "foot",  x: 6,  y: 26, w: 3, h: 1, f: "#3d2a20" },
      { c: "foot",  x: 22, y: 26, w: 3, h: 1, f: "#3d2a20" },
    ],
    evo: [
      // lvl 2 — first spark
      [ { c: "spark", x: 26, y: 16, w: 1, h: 1, f: "currentColor" } ],
      // lvl 3 — more sparks + fur tuft on head
      [ { c: "spark", x: 28, y: 14, w: 1, h: 1, f: "currentColor" },
        { c: "spark", x: 24, y: 14, w: 1, h: 1, f: "currentColor" },
        { c: "fur",   x: 10, y: 10, w: 1, h: 1, f: "#3d2a20" },
        { c: "fur",   x: 14, y: 10, w: 1, h: 1, f: "#3d2a20" } ],
      // lvl 4 — anvil behind the mole
      [ { c: "anvil",     x: 12, y: 26, w: 8, h: 1, f: "#475569" },
        { c: "anvil-top", x: 14, y: 24, w: 4, h: 2, f: "#64748b" } ],
      // lvl 5 — hammer floating above
      [ { c: "hammer-head",  x: 22, y: 5, w: 4, h: 3, f: "#94a3b8" },
        { c: "hammer-shaft", x: 23, y: 8, w: 1, h: 4, f: "#5a4030" } ],
    ],
  },

  /* ── PRISM — Prism Chameleon ──────────────────────────────────────── *
   * Long body, curly tail, one HUGE turret eye, tongue stub.
   * Spots cycle colour. Crest at lvl 5.                                    */
  chameleon: {
    label: "prism chameleon",
    base: [
      // tail (curls)
      { c: "tail", x: 24, y: 16, w: 5, h: 2, f: "#0ea5e9" },
      { c: "tail", x: 27, y: 18, w: 2, h: 5, f: "#0ea5e9" },
      { c: "tail", x: 25, y: 22, w: 3, h: 2, f: "#0ea5e9" },
      // body main
      { c: "body", x: 6,  y: 14, w: 20, h: 9, f: "#0ea5e9" },
      { c: "body", x: 7,  y: 13, w: 18, h: 1, f: "#0ea5e9" },
      // belly highlight
      { c: "belly", x: 8,  y: 18, w: 16, h: 4, f: "#38bdf8" },
      // feet (claws)
      { c: "foot",  x: 8,  y: 23, w: 2, h: 3, f: "#0369a1" },
      { c: "foot",  x: 14, y: 23, w: 2, h: 3, f: "#0369a1" },
      { c: "foot",  x: 20, y: 23, w: 2, h: 3, f: "#0369a1" },
      // toe pixels
      { c: "toe", x: 8,  y: 26, w: 1, h: 1, f: "#0369a1" },
      { c: "toe", x: 10, y: 26, w: 1, h: 1, f: "#0369a1" },
      { c: "toe", x: 14, y: 26, w: 1, h: 1, f: "#0369a1" },
      { c: "toe", x: 16, y: 26, w: 1, h: 1, f: "#0369a1" },
      { c: "toe", x: 20, y: 26, w: 1, h: 1, f: "#0369a1" },
      { c: "toe", x: 22, y: 26, w: 1, h: 1, f: "#0369a1" },
      // head (squarish)
      { c: "head", x: 3,  y: 12, w: 6,  h: 7, f: "#0ea5e9" },
      // turret eye (the big one on top)
      { c: "eye-cone", x: 2,  y: 9,  w: 4, h: 4, f: "#0ea5e9" },
      { c: "eye-ball", x: 2,  y: 9,  w: 4, h: 4, f: "#fef3c7" },
      { c: "eye-iris", x: 3,  y: 10, w: 2, h: 2, f: "#111" },
      { c: "eye-glint",x: 3,  y: 10, w: 1, h: 1, f: "#fff" },
      // mouth + tongue stub
      { c: "mouth", x: 2,  y: 16, w: 4, h: 1, f: "#0369a1" },
      { c: "tongue",x: 1,  y: 16, w: 1, h: 1, f: "#f472b6" },
    ],
    evo: [
      // lvl 2 — colour-cycling spot
      [ { c: "spot", x: 12, y: 16, w: 2, h: 2, f: "#f472b6" } ],
      // lvl 3 — more spots
      [ { c: "spot", x: 17, y: 15, w: 2, h: 2, f: "#fcd34d" },
        { c: "spot", x: 21, y: 17, w: 2, h: 2, f: "#a78bfa" } ],
      // lvl 4 — back stripes
      [ { c: "stripe", x: 14, y: 13, w: 1, h: 3, f: "#0369a1" },
        { c: "stripe", x: 19, y: 13, w: 1, h: 3, f: "#0369a1" } ],
      // lvl 5 — crest spikes
      [ { c: "crest", x: 12, y: 11, w: 1, h: 2, f: "currentColor" },
        { c: "crest", x: 15, y: 10, w: 1, h: 3, f: "currentColor" },
        { c: "crest", x: 18, y: 11, w: 1, h: 2, f: "currentColor" },
        { c: "crest", x: 21, y: 12, w: 1, h: 1, f: "currentColor" } ],
    ],
  },

  /* ── ECHO — Signal Bat ────────────────────────────────────────────── *
   * Triangular body, two big wings with finger bones, pointed ears,
   * tiny fangs. Sonar rings at evo 2+.                                     */
  bat: {
    label: "signal bat",
    base: [
      // wings — left
      { c: "wing-l", x: 1,  y: 12, w: 9, h: 7, f: "#312e81" },
      { c: "wing-l", x: 3,  y: 11, w: 7, h: 1, f: "#312e81" },
      // wing finger bones
      { c: "wing-bone", x: 4, y: 13, w: 1, h: 5, f: "#1e1b4b" },
      { c: "wing-bone", x: 6, y: 13, w: 1, h: 5, f: "#1e1b4b" },
      // wings — right
      { c: "wing-r", x: 22, y: 12, w: 9, h: 7, f: "#312e81" },
      { c: "wing-r", x: 22, y: 11, w: 7, h: 1, f: "#312e81" },
      { c: "wing-bone", x: 26, y: 13, w: 1, h: 5, f: "#1e1b4b" },
      { c: "wing-bone", x: 28, y: 13, w: 1, h: 5, f: "#1e1b4b" },
      // body (dark triangle)
      { c: "body", x: 12, y: 10, w: 8,  h: 12, f: "#1e1b4b" },
      { c: "body", x: 13, y: 22, w: 6,  h: 2,  f: "#1e1b4b" },
      { c: "body", x: 14, y: 24, w: 4,  h: 1,  f: "#1e1b4b" },
      // ears (pointy)
      { c: "ear", x: 12, y: 7,  w: 2, h: 3, f: "#1e1b4b" },
      { c: "ear", x: 18, y: 7,  w: 2, h: 3, f: "#1e1b4b" },
      { c: "ear-in", x: 12, y: 8, w: 1, h: 2, f: "#7c3aed", o: 0.6 },
      { c: "ear-in", x: 19, y: 8, w: 1, h: 2, f: "#7c3aed", o: 0.6 },
      // eyes (red)
      { c: "eye", x: 14, y: 13, w: 1, h: 1, f: "#fca5a5" },
      { c: "eye", x: 17, y: 13, w: 1, h: 1, f: "#fca5a5" },
      // tiny fangs
      { c: "fang", x: 14, y: 16, w: 1, h: 2, f: "#fff" },
      { c: "fang", x: 17, y: 16, w: 1, h: 2, f: "#fff" },
    ],
    evo: [
      // lvl 2 — first sonar ring
      [ { c: "sonar s1", x: 8, y: 6, w: 16, h: 1, f: "currentColor", o: 0.6 },
        { c: "sonar s1", x: 8, y: 25, w: 16, h: 1, f: "currentColor", o: 0.6 } ],
      // lvl 3 — wider sonar
      [ { c: "sonar s2", x: 5, y: 3, w: 22, h: 1, f: "currentColor", o: 0.4 },
        { c: "sonar s2", x: 5, y: 28, w: 22, h: 1, f: "currentColor", o: 0.4 } ],
      // lvl 4 — wing tips highlight
      [ { c: "wing-tip", x: 1, y: 19, w: 2, h: 1, f: "currentColor" },
        { c: "wing-tip", x: 29, y: 19, w: 2, h: 1, f: "currentColor" } ],
      // lvl 5 — aura
      [ { c: "aura", x: 0, y: 0, w: 32, h: 32, f: "currentColor", o: 0.08 } ],
    ],
  },

  /* ── VEGA — Neon Hummingbird ──────────────────────────────────────── *
   * Tiny streamlined body, long needle beak, rapidly-flapping wings,
   * forked tail. Motion trail rects at evo 2+.                             */
  hummingbird: {
    label: "neon hummingbird",
    base: [
      // motion trail (always present, base layer)
      { c: "trail",  x: 3,  y: 14, w: 2, h: 1, f: "#34d399", o: 0.4 },
      { c: "trail",  x: 6,  y: 14, w: 2, h: 1, f: "#34d399", o: 0.6 },
      // body (chest pink, back green)
      { c: "back",   x: 11, y: 12, w: 9,  h: 4, f: "#10b981" },
      { c: "back",   x: 11, y: 11, w: 7,  h: 1, f: "#10b981" },
      { c: "chest",  x: 12, y: 15, w: 8,  h: 3, f: "#f472b6" },
      // head
      { c: "head",   x: 17, y: 9,  w: 5,  h: 5, f: "#10b981" },
      // eye
      { c: "eye",    x: 19, y: 11, w: 1, h: 1, f: "#111" },
      // long needle beak
      { c: "beak",   x: 22, y: 11, w: 8, h: 1, f: "#fcd34d" },
      // wings (top + bottom, animated)
      { c: "wing-t", x: 11, y: 8,  w: 8, h: 4, f: "#6ee7b7", o: 0.85 },
      { c: "wing-b", x: 11, y: 17, w: 8, h: 4, f: "#6ee7b7", o: 0.85 },
      // forked tail
      { c: "tail",   x: 7,  y: 15, w: 4, h: 1, f: "#10b981" },
      { c: "tail",   x: 7,  y: 17, w: 4, h: 1, f: "#10b981" },
    ],
    evo: [
      // lvl 2 — extra trail particles
      [ { c: "trail2", x: 1, y: 14, w: 1, h: 1, f: "currentColor", o: 0.7 } ],
      // lvl 3 — chest shimmer
      [ { c: "shimmer", x: 14, y: 16, w: 1, h: 1, f: "currentColor" } ],
      // lvl 4 — beak tip glow
      [ { c: "beak-tip", x: 30, y: 11, w: 1, h: 1, f: "currentColor" } ],
      // lvl 5 — orbit halo
      [ { c: "orbit", x: 4, y: 6, w: 26, h: 18, f: "currentColor", o: 0.1 } ],
    ],
  },

  /* ── SCRIBE — Scribe Raven ────────────────────────────────────────── *
   * Black raven on a perch with a feather quill in claw. Yellow beak.    */
  raven: {
    label: "scribe raven",
    base: [
      // perch (paper) under feet — base level scroll
      { c: "scroll", x: 4,  y: 26, w: 24, h: 2, f: "#fef3c7" },
      { c: "scroll-edge", x: 4, y: 26, w: 24, h: 1, f: "#d4a574" },
      // body (black)
      { c: "body",   x: 8,  y: 12, w: 14, h: 13, f: "#0f172a" },
      { c: "body",   x: 9,  y: 11, w: 12, h: 1,  f: "#0f172a" },
      // belly highlight
      { c: "belly",  x: 11, y: 18, w: 8, h: 6,  f: "#1e293b" },
      // wing (folded)
      { c: "wing",   x: 9,  y: 13, w: 6, h: 9, f: "#020617" },
      // head
      { c: "head",   x: 17, y: 7,  w: 8, h: 7, f: "#0f172a" },
      // beak (yellow, pointed)
      { c: "beak",   x: 25, y: 10, w: 5, h: 1, f: "#fcd34d" },
      { c: "beak",   x: 25, y: 11, w: 4, h: 1, f: "#fcd34d" },
      { c: "beak",   x: 25, y: 12, w: 3, h: 1, f: "#fcd34d" },
      // eye
      { c: "eye",    x: 22, y: 10, w: 2, h: 2, f: "#fcd34d" },
      { c: "eye",    x: 23, y: 11, w: 1, h: 1, f: "#000" },
      // legs / claws
      { c: "leg",    x: 12, y: 25, w: 2, h: 2, f: "#fcd34d" },
      { c: "leg",    x: 18, y: 25, w: 2, h: 2, f: "#fcd34d" },
    ],
    evo: [
      // lvl 2 — quill in front of body
      [ { c: "quill-shaft",   x: 18, y: 16, w: 1, h: 8, f: "#fcd34d" },
        { c: "quill-feather", x: 16, y: 13, w: 5, h: 3, f: "#fcd34d" } ],
      // lvl 3 — ink dot pixel on scroll
      [ { c: "ink", x: 16, y: 27, w: 2, h: 1, f: "#1e293b" } ],
      // lvl 4 — script lines on scroll
      [ { c: "line", x: 6,  y: 27, w: 6, h: 1, f: "#1e293b", o: 0.6 },
        { c: "line", x: 19, y: 27, w: 6, h: 1, f: "#1e293b", o: 0.6 } ],
      // lvl 5 — second quill behind ear
      [ { c: "feather-tuft", x: 14, y: 6, w: 1, h: 3, f: "#fcd34d" } ],
    ],
  },

  /* ── LEDGER — Accountant Raccoon ──────────────────────────────────── *
   * Grey body, BLACK bandit mask across eyes, striped tail (light/dark),
   * little hands holding a coin.                                           */
  raccoon: {
    label: "accountant raccoon",
    base: [
      // tail (striped)
      { c: "tail",       x: 22, y: 18, w: 3, h: 3, f: "#94a3b8" },
      { c: "tail",       x: 24, y: 20, w: 4, h: 3, f: "#1e293b" },
      { c: "tail",       x: 26, y: 22, w: 4, h: 3, f: "#94a3b8" },
      { c: "tail",       x: 28, y: 24, w: 3, h: 2, f: "#1e293b" },
      // body
      { c: "body",       x: 7,  y: 14, w: 16, h: 12, f: "#94a3b8" },
      { c: "body",       x: 8,  y: 13, w: 14, h: 1,  f: "#94a3b8" },
      // chest light
      { c: "chest",      x: 10, y: 18, w: 10, h: 7,  f: "#cbd5e1" },
      // legs
      { c: "leg",        x: 9,  y: 26, w: 3, h: 2,  f: "#475569" },
      { c: "leg",        x: 18, y: 26, w: 3, h: 2,  f: "#475569" },
      // head
      { c: "head",       x: 6,  y: 7,  w: 14, h: 8, f: "#94a3b8" },
      { c: "head",       x: 7,  y: 6,  w: 12, h: 1, f: "#94a3b8" },
      // ears
      { c: "ear",        x: 6,  y: 4,  w: 3, h: 3, f: "#94a3b8" },
      { c: "ear",        x: 17, y: 4,  w: 3, h: 3, f: "#94a3b8" },
      { c: "ear-in",     x: 7,  y: 5,  w: 1, h: 1, f: "#1e293b" },
      { c: "ear-in",     x: 18, y: 5,  w: 1, h: 1, f: "#1e293b" },
      // BANDIT MASK
      { c: "mask",       x: 6,  y: 9,  w: 14, h: 3, f: "#1e293b" },
      // eyes (white inside mask)
      { c: "eye",        x: 8,  y: 10, w: 2, h: 2, f: "#fff" },
      { c: "eye",        x: 16, y: 10, w: 2, h: 2, f: "#fff" },
      { c: "eye-pupil",  x: 9,  y: 11, w: 1, h: 1, f: "#000" },
      { c: "eye-pupil",  x: 17, y: 11, w: 1, h: 1, f: "#000" },
      // nose
      { c: "nose",       x: 12, y: 13, w: 2, h: 1, f: "#1e293b" },
      // little hands
      { c: "hand",       x: 5,  y: 18, w: 2, h: 2, f: "#475569" },
      { c: "hand",       x: 21, y: 18, w: 2, h: 2, f: "#475569" },
    ],
    evo: [
      // lvl 2 — coin in hand
      [ { c: "coin", x: 22, y: 16, w: 3, h: 3, f: "#fcd34d" },
        { c: "coin", x: 23, y: 17, w: 1, h: 1, f: "#a16207" } ],
      // lvl 3 — second coin floating
      [ { c: "coin2", x: 26, y: 6, w: 2, h: 2, f: "currentColor" } ],
      // lvl 4 — budget bar at bottom
      [ { c: "bar-bg",   x: 2,  y: 30, w: 24, h: 1, f: "#1e293b" },
        { c: "bar-fill", x: 2,  y: 30, w: 14, h: 1, f: "#fcd34d" } ],
      // lvl 5 — tick numbers
      [ { c: "tick", x: 25, y: 10, w: 1, h: 1, f: "currentColor" },
        { c: "tick", x: 27, y: 12, w: 1, h: 1, f: "currentColor" },
        { c: "tick", x: 29, y: 10, w: 1, h: 1, f: "currentColor" } ],
    ],
  },

  /* ── RAVEN (debug) — Dark Raven ───────────────────────────────────── *
   * Black raven silhouette with GLITCH-RED eye, glitch lines.            */
  darkRaven: {
    label: "debug raven",
    base: [
      // body
      { c: "body",  x: 8,  y: 12, w: 14, h: 13, f: "#000" },
      { c: "body",  x: 9,  y: 11, w: 12, h: 1,  f: "#000" },
      // belly
      { c: "belly", x: 11, y: 18, w: 8, h: 6,  f: "#171717" },
      // wing
      { c: "wing",  x: 9,  y: 13, w: 6, h: 9, f: "#0a0a0a" },
      // head
      { c: "head",  x: 17, y: 7,  w: 8, h: 7, f: "#000" },
      // beak (sharp + dark red)
      { c: "beak",  x: 25, y: 10, w: 5, h: 1, f: "#7f1d1d" },
      { c: "beak",  x: 25, y: 11, w: 4, h: 1, f: "#7f1d1d" },
      { c: "beak",  x: 25, y: 12, w: 3, h: 1, f: "#7f1d1d" },
      // ERROR-RED eye
      { c: "eye",   x: 22, y: 10, w: 2, h: 2, f: "#ef4444" },
      { c: "eye-glow", x: 21, y: 9, w: 4, h: 4, f: "#ef4444", o: 0.25 },
      // legs
      { c: "leg",   x: 12, y: 25, w: 2, h: 3, f: "#7f1d1d" },
      { c: "leg",   x: 18, y: 25, w: 2, h: 3, f: "#7f1d1d" },
    ],
    evo: [
      // lvl 2 — glitch lines
      [ { c: "glitch", x: 5,  y: 16, w: 4, h: 1, f: "#ef4444", o: 0.7 },
        { c: "glitch", x: 24, y: 22, w: 5, h: 1, f: "#ef4444", o: 0.7 } ],
      // lvl 3 — more glitches
      [ { c: "glitch", x: 1,  y: 9,  w: 6, h: 1, f: "#ef4444", o: 0.5 },
        { c: "glitch", x: 22, y: 16, w: 8, h: 1, f: "#ef4444", o: 0.5 } ],
      // lvl 4 — trace dashes at bottom
      [ { c: "trace", x: 4,  y: 30, w: 2, h: 1, f: "currentColor" },
        { c: "trace", x: 8,  y: 30, w: 2, h: 1, f: "currentColor" },
        { c: "trace", x: 12, y: 30, w: 2, h: 1, f: "currentColor" },
        { c: "trace", x: 16, y: 30, w: 2, h: 1, f: "currentColor" } ],
      // lvl 5 — stack frame box
      [ { c: "stack",       x: 0,  y: 0, w: 8, h: 5, f: "#7f1d1d", o: 0.5 },
        { c: "stack-text",  x: 1,  y: 2, w: 6, h: 1, f: "currentColor" } ],
    ],
  },

  /* ── LUMA — Firefly ───────────────────────────────────────────────── *
   * Small insect body. Translucent wings. BIG glowing lantern on tail.    */
  firefly: {
    label: "firefly",
    base: [
      // wings (translucent)
      { c: "wing-l", x: 4,  y: 7,  w: 8, h: 5, f: "#fde047", o: 0.4 },
      { c: "wing-r", x: 14, y: 7,  w: 8, h: 5, f: "#fde047", o: 0.4 },
      // body segments
      { c: "head",    x: 10, y: 14, w: 4, h: 3, f: "#713f12" },
      { c: "thorax",  x: 12, y: 17, w: 5, h: 3, f: "#854d0e" },
      { c: "abdomen", x: 13, y: 20, w: 6, h: 4, f: "#a16207" },
      // antennae
      { c: "antenna", x: 9,  y: 11, w: 1, h: 3, f: "#713f12" },
      { c: "antenna", x: 14, y: 11, w: 1, h: 3, f: "#713f12" },
      { c: "antenna-tip", x: 8,  y: 10, w: 1, h: 1, f: "#fde047" },
      { c: "antenna-tip", x: 15, y: 10, w: 1, h: 1, f: "#fde047" },
      // eyes
      { c: "eye",     x: 11, y: 15, w: 1, h: 1, f: "#000" },
      // legs (six small pixels)
      { c: "leg", x: 11, y: 23, w: 1, h: 2, f: "#713f12" },
      { c: "leg", x: 14, y: 23, w: 1, h: 2, f: "#713f12" },
      { c: "leg", x: 17, y: 23, w: 1, h: 2, f: "#713f12" },
      // LANTERN (the big glow)
      { c: "lantern-glow", x: 17, y: 21, w: 8, h: 6, f: "#fde047", o: 0.4 },
      { c: "lantern-mid",  x: 18, y: 22, w: 6, h: 4, f: "#fef08a" },
      { c: "lantern-core", x: 19, y: 23, w: 4, h: 2, f: "#fff" },
    ],
    evo: [
      // lvl 2 — sparkle particles
      [ { c: "spark s1", x: 2,  y: 4,  w: 1, h: 1, f: "currentColor" } ],
      // lvl 3 — more sparks
      [ { c: "spark s2", x: 28, y: 6,  w: 1, h: 1, f: "currentColor" },
        { c: "spark s3", x: 4,  y: 28, w: 1, h: 1, f: "currentColor" } ],
      // lvl 4 — wing veins
      [ { c: "vein", x: 6,  y: 9, w: 4, h: 1, f: "#a16207", o: 0.5 },
        { c: "vein", x: 16, y: 9, w: 4, h: 1, f: "#a16207", o: 0.5 } ],
      // lvl 5 — outer aura
      [ { c: "aura", x: 14, y: 18, w: 14, h: 12, f: "currentColor", o: 0.15 } ],
    ],
  },

  /* ── NOVA — Tiny Star Dragon ──────────────────────────────────────── *
   * Coiled dragon body, two wings, three spikes on back, small head,
   * smoke breath, stars around (level 2+).                                 */
  dragon: {
    label: "star dragon",
    base: [
      // tail curl
      { c: "tail",  x: 22, y: 18, w: 4, h: 2, f: "#7c3aed" },
      { c: "tail",  x: 25, y: 20, w: 2, h: 4, f: "#7c3aed" },
      { c: "tail",  x: 23, y: 24, w: 3, h: 2, f: "#7c3aed" },
      // body
      { c: "body",  x: 6,  y: 14, w: 18, h: 8, f: "#7c3aed" },
      { c: "body",  x: 7,  y: 13, w: 16, h: 1, f: "#7c3aed" },
      // belly highlight (lighter)
      { c: "belly", x: 8,  y: 18, w: 14, h: 4, f: "#a78bfa" },
      // legs
      { c: "leg",   x: 9,  y: 22, w: 2, h: 3, f: "#5b21b6" },
      { c: "leg",   x: 14, y: 22, w: 2, h: 3, f: "#5b21b6" },
      { c: "leg",   x: 19, y: 22, w: 2, h: 3, f: "#5b21b6" },
      // wing
      { c: "wing",  x: 12, y: 8,  w: 8, h: 5, f: "#5b21b6" },
      { c: "wing",  x: 14, y: 7,  w: 4, h: 1, f: "#5b21b6" },
      { c: "wing-membrane", x: 13, y: 11, w: 1, h: 2, f: "#a78bfa" },
      { c: "wing-membrane", x: 16, y: 11, w: 1, h: 2, f: "#a78bfa" },
      { c: "wing-membrane", x: 19, y: 11, w: 1, h: 2, f: "#a78bfa" },
      // back spikes
      { c: "spike", x: 10, y: 12, w: 1, h: 2, f: "#fcd34d" },
      { c: "spike", x: 13, y: 12, w: 1, h: 2, f: "#fcd34d" },
      { c: "spike", x: 17, y: 12, w: 1, h: 2, f: "#fcd34d" },
      // head
      { c: "head",  x: 2,  y: 13, w: 6, h: 5, f: "#7c3aed" },
      // horns
      { c: "horn",  x: 3,  y: 11, w: 1, h: 2, f: "#fcd34d" },
      { c: "horn",  x: 5,  y: 11, w: 1, h: 2, f: "#fcd34d" },
      // eye
      { c: "eye",   x: 3,  y: 15, w: 1, h: 1, f: "#fcd34d" },
      // smoke breath
      { c: "breath", x: 0,  y: 16, w: 2, h: 1, f: "currentColor", o: 0.6 },
    ],
    evo: [
      // lvl 2 — first star
      [ { c: "star", x: 26, y: 4, w: 2, h: 2, f: "#fcd34d" } ],
      // lvl 3 — more stars
      [ { c: "star", x: 22, y: 2, w: 2, h: 2, f: "#fcd34d" },
        { c: "star", x: 29, y: 8, w: 1, h: 1, f: "#fcd34d" } ],
      // lvl 4 — fire breath
      [ { c: "fire", x: 0, y: 15, w: 1, h: 1, f: "#f97316" },
        { c: "fire", x: 0, y: 17, w: 1, h: 1, f: "#fb923c" } ],
      // lvl 5 — orbit ring
      [ { c: "orbit", x: 0, y: 6, w: 32, h: 22, f: "currentColor", o: 0.08 } ],
    ],
  },
};

export const MASCOT_IDS = Object.keys(SPRITES);
