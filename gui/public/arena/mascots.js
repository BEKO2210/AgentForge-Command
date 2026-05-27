// AgentForge mascots — disciplined pixel-art primitives.
//
// Every mascot is built from `<rect>` elements only — no paths, no curves.
// What changed in this revision: each species now has a deliberate 4-tone
// COLOUR RAMP (shadow / base / mid / spec) plus accent colours, drawn with
// a consistent top-left light source. Outlines use the shadow tone so the
// silhouette reads cleanly even at small sizes. This is the discipline
// premium pixel art uses — without it, flat fills look amateurish even
// when the silhouette is correct.
//
// Convention per mascot:
//   - shadow → 1px outline + bottom/right body edges + cast shadow strips
//   - base   → main body fill
//   - mid    → top/left highlights (light source is at upper-left)
//   - spec   → 1-2 pixel specular sparks for shells/eyes/feathers
//   - accent → species-specific colour (eye iris, beak, scarf, lantern…)
//
// CSS classes on each rect (.r-eye, .r-wing-l, …) are preserved from the
// previous revision so the animation rules in styles.css keep working
// without changes.

const RECTS = (rects) =>
  rects.map((r) => {
    const cls = r.c ? ` class="r-${r.c}"` : "";
    const op = r.o !== undefined ? ` opacity="${r.o}"` : "";
    return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.f}"${cls}${op}/>`;
  }).join("");

/**
 * Render a mascot.
 * @param {object} opt
 * @param {string} opt.mascot   - turtle | owl | fox | mole | chameleon | bat |
 *                                hummingbird | raven | raccoon | darkRaven |
 *                                firefly | dragon
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
 *  Each entry declares its colour ramp inline at the top of the comment so
 *  it's easy to see which palette it lives in. Within the rect list, the
 *  order is: outline → base body → highlights → details → accessories.
 *  Reading the file you should be able to picture the mascot before you
 *  even render it.
 * ----------------------------------------------------------------------- */

const SPRITES = {

  /* ── ATLAS — Cyber Turtle ─────────────────────────────────────────── *
   * Ramp: #1f3a25 / #3f7a4a / #6dc176 / #b6f0bd   shell green
   *       #5fa86d / #7bbd8a                        skin (head/neck/tail)
   * Iconic green dome shell with a top-left highlight band, hex tile
   * pattern in the shadow tone, small head poking out left. Antenna
   * gold tip at evo 5.                                                  */
  turtle: {
    label: "cyber turtle",
    base: [
      // soft cast shadow
      { c: "cast", x: 6, y: 26, w: 20, h: 1, f: "#000", o: 0.4 },
      // legs (base + shadow under)
      { c: "leg", x:  6, y: 22, w: 3, h: 3, f: "#3f7a4a" },
      { c: "leg", x:  6, y: 25, w: 3, h: 1, f: "#1f3a25" },
      { c: "leg", x: 23, y: 22, w: 3, h: 3, f: "#3f7a4a" },
      { c: "leg", x: 23, y: 25, w: 3, h: 1, f: "#1f3a25" },
      { c: "leg", x: 10, y: 23, w: 3, h: 2, f: "#3f7a4a" },
      { c: "leg", x: 19, y: 23, w: 3, h: 2, f: "#3f7a4a" },
      // shell — outline first (shadow tone)
      { c: "shell-outline", x:  4, y: 13, w: 24, h: 1, f: "#1f3a25" },
      { c: "shell-outline", x:  3, y: 14, w:  1, h: 8, f: "#1f3a25" },
      { c: "shell-outline", x: 28, y: 14, w:  1, h: 8, f: "#1f3a25" },
      { c: "shell-outline", x:  4, y: 22, w: 24, h: 1, f: "#1f3a25" },
      { c: "shell-outline", x:  6, y: 11, w: 20, h: 1, f: "#1f3a25" },
      { c: "shell-outline", x:  8, y:  9, w: 16, h: 1, f: "#1f3a25" },
      // shell base fill
      { c: "shell", x:  4, y: 14, w: 24, h: 8, f: "#3f7a4a" },
      { c: "shell", x:  6, y: 12, w: 20, h: 2, f: "#3f7a4a" },
      { c: "shell", x:  8, y: 10, w: 16, h: 2, f: "#3f7a4a" },
      // top-left highlight band (mid)
      { c: "shell-hi", x:  9, y: 11, w: 10, h: 1, f: "#6dc176" },
      { c: "shell-hi", x:  6, y: 13, w:  4, h: 1, f: "#6dc176" },
      { c: "shell-hi", x:  5, y: 14, w:  1, h: 4, f: "#6dc176" },
      // bottom-right shadow band on the shell (darker base)
      { c: "shell-sh", x: 22, y: 19, w:  5, h: 3, f: "#2a4f30" },
      { c: "shell-sh", x: 26, y: 15, w:  2, h: 4, f: "#2a4f30" },
      // specular spark — single bright pixel top-left
      { c: "shell-spec", x:  7, y: 13, w: 2, h: 1, f: "#b6f0bd" },
      // hex pattern in the shadow tone
      { c: "shell-pattern", x: 12, y: 14, w: 3, h: 2, f: "#1f3a25" },
      { c: "shell-pattern", x: 17, y: 14, w: 3, h: 2, f: "#1f3a25" },
      { c: "shell-pattern", x: 14, y: 18, w: 4, h: 2, f: "#1f3a25" },
      // tail
      { c: "tail", x: 26, y: 17, w: 3, h: 2, f: "#5fa86d" },
      { c: "tail", x: 28, y: 18, w: 1, h: 1, f: "#1f3a25" },
      // neck + head with outline
      { c: "head-outline", x: 3, y: 17, w: 1, h: 2, f: "#1f3a25" },
      { c: "head-outline", x: 0, y: 14, w: 6, h: 1, f: "#1f3a25" },
      { c: "head-outline", x: 0, y: 19, w: 6, h: 1, f: "#1f3a25" },
      { c: "head-outline", x: 0, y: 15, w: 1, h: 4, f: "#1f3a25" },
      { c: "neck", x: 3, y: 16, w: 3, h: 3, f: "#5fa86d" },
      { c: "head", x: 1, y: 15, w: 5, h: 4, f: "#5fa86d" },
      { c: "head-hi", x: 1, y: 15, w: 4, h: 1, f: "#7bbd8a" },
      // eyes (whites + black pupils for definition at 32px)
      { c: "eye-w", x: 2, y: 16, w: 2, h: 2, f: "#fff" },
      { c: "eye",   x: 2, y: 16, w: 1, h: 1, f: "#000" },
      { c: "eye-w", x: 4, y: 16, w: 1, h: 2, f: "#fff" },
      { c: "eye",   x: 4, y: 16, w: 1, h: 1, f: "#000" },
      // small mouth
      { c: "mouth", x: 1, y: 18, w: 2, h: 1, f: "#1f3a25" },
    ],
    evo: [
      // lvl 2 — radar dot top of shell
      [ { c: "radar", x: 15, y: 9, w: 2, h: 2, f: "currentColor" } ],
      // lvl 3 — shell LEDs
      [ { c: "shell-led", x: 10, y: 15, w: 1, h: 1, f: "currentColor" },
        { c: "shell-led", x: 21, y: 15, w: 1, h: 1, f: "currentColor" } ],
      // lvl 4 — bridge bar
      [ { c: "bridge", x: 8, y: 8, w: 16, h: 1, f: "currentColor", o: 0.7 } ],
      // lvl 5 — gold antenna
      [ { c: "antenna",     x: 15, y: 3, w: 2, h: 6, f: "#fcd34d" },
        { c: "antenna",     x: 16, y: 3, w: 1, h: 6, f: "#fde68a" },
        { c: "antenna-tip", x: 13, y: 1, w: 6, h: 2, f: "#fcd34d" },
        { c: "antenna-tip", x: 14, y: 1, w: 4, h: 1, f: "#fde68a" } ],
    ],
  },

  /* ── SENTINEL — Guardian Owl ──────────────────────────────────────── *
   * Ramp: #3b2418 / #6b4630 / #a07655 / #d9b58f   feather brown          *
   *       #fcd34d / #fde68a                       eye yellow + glow      *
   *       #f59e0b / #b45309                       beak + talons          *
   *
   * Improvements vs. the old sprite:
   *   - Body silhouette rounded off (chamfered corners) so the bird
   *     reads as a sphere, not a square block.
   *   - Heart-shaped face disc — narrower at the top, wider mid-face,
   *     pointed at the beak — instead of a flat rectangle.
   *   - Eyes now have a separate `r-eye-lid` strip we can drop down for
   *     real blink + slow-close animations.
   *   - Pupils split off the eye-bg so they can track left↔right inside
   *     the yellow sclera without warping the whole eye.
   *   - Tiny scan-line ring around the head (visible only in scan / read
   *     states) gives Sentinel its "security camera" personality. */
  owl: {
    label: "guardian owl",
    base: [
      // outline silhouette — chamfered corners (no sharp 90° at top)
      { c: "body-outline", x: 8,  y:  6, w: 16, h: 1, f: "#3b2418" },
      { c: "body-outline", x: 7,  y:  7, w:  1, h: 1, f: "#3b2418" },
      { c: "body-outline", x: 24, y:  7, w:  1, h: 1, f: "#3b2418" },
      { c: "body-outline", x: 6,  y:  8, w:  1, h: 16, f: "#3b2418" },
      { c: "body-outline", x: 25, y:  8, w:  1, h: 16, f: "#3b2418" },
      { c: "body-outline", x: 7,  y: 24, w:  1, h: 1, f: "#3b2418" },
      { c: "body-outline", x: 24, y: 24, w:  1, h: 1, f: "#3b2418" },
      { c: "body-outline", x: 8,  y: 25, w: 16, h: 1, f: "#3b2418" },
      // body (base) — fills inside the outline
      { c: "body", x: 7, y:  7, w: 18, h:  1, f: "#6b4630" },
      { c: "body", x: 7, y: 24, w: 18, h:  1, f: "#6b4630" },
      { c: "body", x: 7, y:  8, w: 18, h: 16, f: "#6b4630" },
      // top-left highlight + bottom-right shadow
      { c: "body-hi", x:  8, y:  7, w: 5, h: 1, f: "#a07655" },
      { c: "body-hi", x:  7, y:  8, w: 1, h: 5, f: "#a07655" },
      { c: "body-sh", x: 22, y: 19, w: 3, h: 6, f: "#3b2418" },
      { c: "body-sh", x: 19, y: 24, w: 5, h: 1, f: "#3b2418" },
      // chest disc (lighter, pointed at the bottom for owl belly shape)
      { c: "chest",    x:  9, y: 14, w: 14, h: 10, f: "#a07655" },
      { c: "chest",    x: 11, y: 24, w: 10, h:  1, f: "#a07655" },
      { c: "chest-hi", x:  9, y: 14, w:  4, h:  1, f: "#d9b58f" },
      // chest feather hints (V-shaped)
      { c: "feather", x: 11, y: 17, w: 2, h: 1, f: "#6b4630" },
      { c: "feather", x: 15, y: 17, w: 2, h: 1, f: "#6b4630" },
      { c: "feather", x: 19, y: 17, w: 2, h: 1, f: "#6b4630" },
      { c: "feather", x: 13, y: 20, w: 2, h: 1, f: "#6b4630" },
      { c: "feather", x: 17, y: 20, w: 2, h: 1, f: "#6b4630" },
      // head highlight + shadow
      { c: "head-hi", x: 8,  y:  7, w: 5, h: 1, f: "#a07655" },
      { c: "head-hi", x: 7,  y:  8, w: 1, h: 3, f: "#a07655" },
      // ear tufts — taller + pointier
      { c: "tuft",  x: 6,  y: 4, w: 2, h: 3, f: "#3b2418" },
      { c: "tuft",  x: 7,  y: 2, w: 1, h: 2, f: "#3b2418" },
      { c: "tuft",  x: 24, y: 4, w: 2, h: 3, f: "#3b2418" },
      { c: "tuft",  x: 24, y: 2, w: 1, h: 2, f: "#3b2418" },
      // HEART-SHAPED face disc — narrower top, wider mid, pointed bottom
      { c: "face", x: 10, y:  8, w: 12, h: 1, f: "#d9b58f" },
      { c: "face", x:  9, y:  9, w: 14, h: 4, f: "#d9b58f" },
      { c: "face", x: 10, y: 13, w: 12, h: 1, f: "#d9b58f" },
      { c: "face", x: 12, y: 14, w:  8, h: 1, f: "#d9b58f" },
      // face shadow — vertical groove down the middle (heart split)
      { c: "face-groove", x: 15, y: 12, w: 2, h: 3, f: "#a07655", o: 0.6 },
      // eyes — separate sclera, pupil, glint, AND a lid that drops for blink
      { c: "eye-bg",    x:  9, y:  9, w: 5, h: 4, f: "#fcd34d" },
      { c: "eye-bg",    x: 18, y:  9, w: 5, h: 4, f: "#fcd34d" },
      { c: "eye-rim",   x:  9, y:  9, w: 5, h: 1, f: "#b45309" },
      { c: "eye-rim",   x: 18, y:  9, w: 5, h: 1, f: "#b45309" },
      { c: "eye-pupil", x: 11, y: 10, w: 2, h: 3, f: "#0f172a" },
      { c: "eye-pupil", x: 19, y: 10, w: 2, h: 3, f: "#0f172a" },
      { c: "eye-glint", x: 11, y: 10, w: 1, h: 1, f: "#fff" },
      { c: "eye-glint", x: 19, y: 10, w: 1, h: 1, f: "#fff" },
      // eye lids — drop these down in CSS for blink (default position: hidden up top)
      { c: "eye-lid",   x:  9, y:  8, w: 5, h: 1, f: "#6b4630" },
      { c: "eye-lid",   x: 18, y:  8, w: 5, h: 1, f: "#6b4630" },
      // beak — wider base, pointed tip
      { c: "beak",      x: 15, y: 13, w: 2, h: 2, f: "#f59e0b" },
      { c: "beak",      x: 15, y: 15, w: 2, h: 1, f: "#f59e0b" },
      { c: "beak",      x: 16, y: 16, w: 1, h: 1, f: "#b45309" },
      // talons — single perch bar + three curved claws
      { c: "talon", x:  8, y: 26, w: 16, h: 1, f: "#f59e0b" },
      { c: "talon", x:  9, y: 27, w:  3, h: 1, f: "#b45309" },
      { c: "talon", x: 14, y: 27, w:  4, h: 1, f: "#b45309" },
      { c: "talon", x: 20, y: 27, w:  3, h: 1, f: "#b45309" },
    ],
    evo: [
      // lvl 2 — scan ring around the head (camera-style)
      [ { c: "scan-ring", x:  5, y: 13, w: 22, h: 1, f: "currentColor", o: 0.55 } ],
      // lvl 3 — tail feather row at bottom
      [ { c: "tail-feather", x: 10, y: 23, w: 1, h: 1, f: "#3b2418" },
        { c: "tail-feather", x: 14, y: 23, w: 1, h: 1, f: "#3b2418" },
        { c: "tail-feather", x: 18, y: 23, w: 1, h: 1, f: "#3b2418" },
        { c: "tail-feather", x: 22, y: 23, w: 1, h: 1, f: "#3b2418" } ],
      // lvl 4 — wing edges
      [ { c: "wing", x: 5,  y: 14, w: 2, h: 8, f: "#3b2418" },
        { c: "wing", x: 25, y: 14, w: 2, h: 8, f: "#3b2418" },
        { c: "wing-hi", x: 5, y: 14, w: 1, h: 4, f: "#6b4630" } ],
      // lvl 5 — guardian aura (subtle halo)
      [ { c: "aura", x: 3, y: 3, w: 26, h: 26, f: "currentColor", o: 0.12 } ],
    ],
  },

  /* ── AURORA — Neon Fox ────────────────────────────────────────────── *
   * Ramp: #8a2a08 / #e85a1c / #ff8a4d / #ffd7a8 + #fff (belly/tail tip)  *
   * Sharp pointed head, big triangular ears, white muzzle + belly,      *
   * BUSHY TAIL with a white tip. Lighting top-left.                     */
  fox: {
    label: "neon fox",
    base: [
      // outline silhouette (back legs to ears)
      { c: "body-outline", x: 7,  y: 26, w: 16, h: 1, f: "#8a2a08" },
      { c: "body-outline", x: 7,  y: 15, w: 1,  h: 11, f: "#8a2a08" },
      { c: "body-outline", x: 23, y: 15, w: 1,  h: 11, f: "#8a2a08" },
      { c: "body-outline", x: 3,  y: 13, w: 4,  h: 1, f: "#8a2a08" },
      { c: "body-outline", x: 13, y: 13, w: 11, h: 1, f: "#8a2a08" },
      // body
      { c: "body", x: 8, y: 16, w: 15, h: 10, f: "#e85a1c" },
      // belly (white)
      { c: "belly", x: 10, y: 21, w: 11, h: 4, f: "#fff" },
      // top-left body highlight
      { c: "body-hi", x: 9,  y: 16, w: 4, h: 1, f: "#ff8a4d" },
      // bottom-right body shadow
      { c: "body-sh", x: 20, y: 22, w: 3, h: 4, f: "#8a2a08" },
      // legs (each leg gets a darker bottom edge)
      { c: "leg", x: 10, y: 24, w: 2, h: 3, f: "#c2410c" },
      { c: "leg", x: 10, y: 27, w: 2, h: 1, f: "#8a2a08" },
      { c: "leg", x: 16, y: 24, w: 2, h: 3, f: "#c2410c" },
      { c: "leg", x: 16, y: 27, w: 2, h: 1, f: "#8a2a08" },
      { c: "leg", x: 20, y: 24, w: 2, h: 3, f: "#c2410c" },
      { c: "leg", x: 20, y: 27, w: 2, h: 1, f: "#8a2a08" },
      // tail — split into three segments so the tip can flick independently
      { c: "tail",     x: 22, y: 14, w: 3, h: 2, f: "#e85a1c" },
      { c: "tail",     x: 24, y: 15, w: 3, h: 3, f: "#e85a1c" },
      { c: "tail-mid", x: 26, y: 17, w: 3, h: 4, f: "#e85a1c" },
      { c: "tail-hi",  x: 22, y: 14, w: 2, h: 1, f: "#ff8a4d" },
      { c: "tail-tip", x: 27, y: 20, w: 3, h: 3, f: "#fff" },
      { c: "tail-tip", x: 27, y: 23, w: 3, h: 1, f: "#ffd7a8" },
      // head shape — sharp pointed snout to the left
      { c: "head", x: 4, y: 11, w: 11, h: 6, f: "#e85a1c" },
      { c: "head", x: 6, y: 17, w: 7,  h: 1, f: "#e85a1c" },
      { c: "head-outline", x: 3, y: 13, w: 1, h: 3, f: "#8a2a08" },
      { c: "head-outline", x: 14, y: 11, w: 1, h: 7, f: "#8a2a08" },
      { c: "head-hi", x: 5, y: 11, w: 6, h: 1, f: "#ff8a4d" },
      // cheek tufts — small spike on each side of the head (foxes have these)
      { c: "cheek", x: 13, y: 16, w: 1, h: 2, f: "#fff" },
      { c: "cheek", x: 14, y: 17, w: 1, h: 1, f: "#fff" },
      // ears (outline + inside)
      { c: "ear-outline", x: 4,  y: 7, w: 1, h: 5, f: "#8a2a08" },
      { c: "ear-outline", x: 7,  y: 7, w: 1, h: 5, f: "#8a2a08" },
      { c: "ear-outline", x: 10, y: 7, w: 1, h: 5, f: "#8a2a08" },
      { c: "ear-outline", x: 13, y: 7, w: 1, h: 5, f: "#8a2a08" },
      { c: "ear", x: 5,  y: 7, w: 2, h: 5, f: "#e85a1c" },
      { c: "ear", x: 11, y: 7, w: 2, h: 5, f: "#e85a1c" },
      { c: "ear-in", x: 5,  y: 9, w: 2, h: 2, f: "#fda4af" },
      { c: "ear-in", x: 11, y: 9, w: 2, h: 2, f: "#fda4af" },
      // muzzle (white)
      { c: "muzzle", x: 3, y: 14, w: 4, h: 2, f: "#fff" },
      { c: "muzzle", x: 4, y: 13, w: 3, h: 1, f: "#fff" },
      // whiskers — three thin lines on each side
      { c: "whisker", x: 0, y: 13, w: 1, h: 1, f: "#0f172a", o: 0.6 },
      { c: "whisker", x: 0, y: 16, w: 1, h: 1, f: "#0f172a", o: 0.6 },
      // nose (black with one highlight pixel)
      { c: "nose",    x: 1, y: 14, w: 2, h: 2, f: "#0f172a" },
      { c: "nose-hi", x: 1, y: 14, w: 1, h: 1, f: "#475569" },
      // small pink tongue tip (visible only in celebrating state)
      { c: "tongue", x: 3, y: 16, w: 2, h: 1, f: "#f472b6", o: 0 },
      // eyes (each: black + white glint), with separate lids for slow-close
      { c: "eye",       x: 8,  y: 13, w: 1, h: 2, f: "#0f172a" },
      { c: "eye-glint", x: 8,  y: 13, w: 1, h: 1, f: "#fcd34d" },
      { c: "eye",       x: 12, y: 13, w: 1, h: 2, f: "#0f172a" },
      { c: "eye-glint", x: 12, y: 13, w: 1, h: 1, f: "#fcd34d" },
      { c: "eye-lid",   x: 8,  y: 12, w: 1, h: 1, f: "#e85a1c" },
      { c: "eye-lid",   x: 12, y: 12, w: 1, h: 1, f: "#e85a1c" },
    ],
    evo: [
      [ { c: "tail-glow", x: 22, y: 13, w: 8, h: 1, f: "currentColor", o: 0.7 } ],
      [ { c: "shimmer", x: 17, y: 12, w: 1, h: 1, f: "currentColor" },
        { c: "shimmer", x: 19, y: 14, w: 1, h: 1, f: "currentColor" } ],
      [ { c: "stripe", x: 12, y: 16, w: 10, h: 1, f: "#8a2a08" } ],
      [ { c: "aura", x: 1, y: 8, w: 30, h: 18, f: "currentColor", o: 0.1 } ],
    ],
  },

  /* ── FORGE — Forge Mole ───────────────────────────────────────────── *
   * Ramp: #3d2818 / #6b4a32 / #8a6448 / #b48868                          *
   * Round brown body, pink snout with nostrils, BIG silver shovel claws *
   * (silver gets its own dark/mid/light ramp so they really look metal). */
  mole: {
    label: "forge mole",
    base: [
      // cast shadow
      { c: "cast", x: 6, y: 27, w: 22, h: 1, f: "#000", o: 0.35 },
      // body outline
      { c: "body-outline", x: 4, y: 12, w: 24, h: 1, f: "#3d2818" },
      { c: "body-outline", x: 3, y: 13, w: 1, h: 13, f: "#3d2818" },
      { c: "body-outline", x: 28, y: 13, w: 1, h: 13, f: "#3d2818" },
      { c: "body-outline", x: 4, y: 26, w: 24, h: 1, f: "#3d2818" },
      // body
      { c: "body", x: 4, y: 13, w: 24, h: 13, f: "#6b4a32" },
      // top-left highlight
      { c: "body-hi", x: 5, y: 13, w: 5, h: 1, f: "#8a6448" },
      { c: "body-hi", x: 4, y: 14, w: 1, h: 4, f: "#8a6448" },
      // bottom-right shadow
      { c: "body-sh", x: 22, y: 22, w: 6, h: 4, f: "#3d2818" },
      // belly
      { c: "belly", x: 7, y: 18, w: 18, h: 6, f: "#8a6448" },
      // snout (pink, tapered)
      { c: "snout-outline", x: 0, y: 14, w: 1, h: 4, f: "#3d2818" },
      { c: "snout-outline", x: 1, y: 18, w: 5, h: 1, f: "#3d2818" },
      { c: "snout", x: 1, y: 15, w: 5, h: 3, f: "#fb7185" },
      { c: "snout-hi", x: 1, y: 15, w: 3, h: 1, f: "#fda4af" },
      // nostrils
      { c: "nostril", x: 2, y: 16, w: 1, h: 1, f: "#7f1d1d" },
      { c: "nostril", x: 4, y: 16, w: 1, h: 1, f: "#7f1d1d" },
      // eye slit (closed eye, since moles can barely see)
      { c: "eye", x: 7, y: 14, w: 3, h: 1, f: "#3d2818" },
      // whiskers
      { c: "whisker", x: 0, y: 19, w: 1, h: 1, f: "#a78bfa", o: 0.8 },
      // GIANT shovel claws (4-tone metal ramp), now split per finger so
      // each one can strike at a slightly offset rhythm.
      { c: "claw-sh", x: 23, y: 18, w: 8, h: 1, f: "#475569" },     // top edge shadow
      { c: "claw",    x: 23, y: 19, w: 8, h: 3, f: "#cbd5e1" },     // main blade
      { c: "claw-hi", x: 23, y: 19, w: 8, h: 1, f: "#f1f5f9" },     // top highlight
      { c: "claw-sh", x: 23, y: 22, w: 8, h: 1, f: "#64748b" },     // under-edge
      // claw fingers — three separate classes for individual strike
      { c: "finger-1",    x: 23, y: 22, w: 1, h: 2, f: "#cbd5e1" },
      { c: "finger-2",    x: 26, y: 22, w: 1, h: 2, f: "#cbd5e1" },
      { c: "finger-3",    x: 29, y: 22, w: 1, h: 2, f: "#cbd5e1" },
      { c: "claw-tip", x: 30, y: 19, w: 1, h: 3, f: "#f1f5f9" },
      // brow pixel (above eye) — animates to express focus/anger
      { c: "brow", x: 6, y: 13, w: 4, h: 1, f: "#3d2818", o: 0 },
      // small back feet
      { c: "foot", x:  6, y: 26, w: 3, h: 1, f: "#3d2818" },
      { c: "foot", x: 22, y: 26, w: 3, h: 1, f: "#3d2818" },
      // hidden working-state anvil (revealed in CSS when state-working)
      { c: "anvil-base", x: 18, y: 25, w: 6, h: 1, f: "#475569", o: 0 },
      { c: "anvil-top",  x: 19, y: 23, w: 4, h: 2, f: "#64748b", o: 0 },
      { c: "anvil-hi",   x: 19, y: 23, w: 4, h: 1, f: "#94a3b8", o: 0 },
    ],
    evo: [
      [ { c: "spark", x: 28, y: 16, w: 1, h: 1, f: "currentColor" } ],
      [ { c: "spark", x: 25, y: 14, w: 1, h: 1, f: "currentColor" },
        { c: "spark", x: 30, y: 17, w: 1, h: 1, f: "currentColor" },
        { c: "fur",   x: 10, y: 11, w: 1, h: 1, f: "#3d2818" },
        { c: "fur",   x: 14, y: 11, w: 1, h: 1, f: "#3d2818" } ],
      [ { c: "anvil",     x: 12, y: 26, w: 8, h: 1, f: "#475569" },
        { c: "anvil-top", x: 14, y: 24, w: 4, h: 2, f: "#64748b" },
        { c: "anvil-hi",  x: 14, y: 24, w: 4, h: 1, f: "#94a3b8" } ],
      [ { c: "hammer-head", x: 22, y:  5, w: 4, h: 3, f: "#94a3b8" },
        { c: "hammer-hi",   x: 22, y:  5, w: 4, h: 1, f: "#cbd5e1" },
        { c: "hammer-shaft",x: 23, y:  8, w: 1, h: 4, f: "#6b4a32" } ],
    ],
  },

  /* ── PRISM — Prism Chameleon ──────────────────────────────────────── *
   * Ramp: #034a73 / #0ea5e9 / #38bdf8 / #bae6fd                          *
   * Long body, turret eye on top with iris + glint, curled tail.        *
   * Skin spots cycle through pink/yellow/cyan via CSS animation.        */
  chameleon: {
    label: "prism chameleon",
    base: [
      // body outline
      { c: "body-outline", x: 5,  y: 13, w: 22, h: 1, f: "#034a73" },
      { c: "body-outline", x: 5,  y: 23, w: 22, h: 1, f: "#034a73" },
      { c: "body-outline", x: 4,  y: 14, w: 1, h: 9, f: "#034a73" },
      { c: "body-outline", x: 27, y: 14, w: 1, h: 9, f: "#034a73" },
      // tail (curl)
      { c: "tail-outline", x: 27, y: 16, w: 3, h: 1, f: "#034a73" },
      { c: "tail-outline", x: 30, y: 17, w: 1, h: 5, f: "#034a73" },
      { c: "tail-outline", x: 28, y: 22, w: 2, h: 1, f: "#034a73" },
      { c: "tail", x: 27, y: 17, w: 3, h: 1, f: "#0ea5e9" },
      { c: "tail", x: 29, y: 17, w: 2, h: 5, f: "#0ea5e9" },
      { c: "tail", x: 27, y: 21, w: 2, h: 1, f: "#0ea5e9" },
      { c: "tail-hi", x: 29, y: 17, w: 2, h: 1, f: "#38bdf8" },
      // body fill
      { c: "body", x: 5, y: 14, w: 22, h: 9, f: "#0ea5e9" },
      // top highlight
      { c: "body-hi", x: 6, y: 14, w: 14, h: 1, f: "#38bdf8" },
      { c: "body-hi", x: 5, y: 15, w: 1, h: 3, f: "#38bdf8" },
      // bottom shadow
      { c: "body-sh", x: 6, y: 22, w: 21, h: 1, f: "#034a73" },
      { c: "body-sh", x: 20, y: 19, w: 7, h: 4, f: "#0288c4" },
      // belly (lighter)
      { c: "belly", x: 8, y: 18, w: 16, h: 4, f: "#38bdf8" },
      // feet (claws)
      { c: "foot", x:  8, y: 24, w: 2, h: 3, f: "#034a73" },
      { c: "foot", x: 14, y: 24, w: 2, h: 3, f: "#034a73" },
      { c: "foot", x: 20, y: 24, w: 2, h: 3, f: "#034a73" },
      { c: "toe", x:  8, y: 27, w: 1, h: 1, f: "#034a73" },
      { c: "toe", x: 10, y: 27, w: 1, h: 1, f: "#034a73" },
      { c: "toe", x: 14, y: 27, w: 1, h: 1, f: "#034a73" },
      { c: "toe", x: 16, y: 27, w: 1, h: 1, f: "#034a73" },
      { c: "toe", x: 20, y: 27, w: 1, h: 1, f: "#034a73" },
      { c: "toe", x: 22, y: 27, w: 1, h: 1, f: "#034a73" },
      // head
      { c: "head-outline", x: 3, y: 13, w: 5, h: 1, f: "#034a73" },
      { c: "head-outline", x: 3, y: 18, w: 5, h: 1, f: "#034a73" },
      { c: "head-outline", x: 2, y: 14, w: 1, h: 4, f: "#034a73" },
      { c: "head", x: 3, y: 14, w: 5, h: 4, f: "#0ea5e9" },
      { c: "head-hi", x: 3, y: 14, w: 4, h: 1, f: "#38bdf8" },
      // turret eye — small dark cone + big pale dome on top
      { c: "eye-cone", x: 4, y: 10, w: 3, h: 2, f: "#034a73" },
      { c: "eye-ball-outline", x: 2, y: 6, w: 7, h: 1, f: "#034a73" },
      { c: "eye-ball-outline", x: 2, y: 7, w: 1, h: 4, f: "#034a73" },
      { c: "eye-ball-outline", x: 8, y: 7, w: 1, h: 4, f: "#034a73" },
      { c: "eye-ball", x: 3, y: 7, w: 5, h: 4, f: "#fef3c7" },
      { c: "eye-iris", x: 4, y: 8, w: 3, h: 2, f: "#0f172a" },
      { c: "eye-glint", x: 4, y: 8, w: 1, h: 1, f: "#fff" },
      // mouth + tongue (tip separated so it can dart independently)
      { c: "mouth", x: 3, y: 17, w: 4, h: 1, f: "#034a73" },
      { c: "tongue", x: 1, y: 17, w: 2, h: 1, f: "#f472b6" },
      { c: "tongue-tip", x: 0, y: 17, w: 1, h: 1, f: "#f472b6", o: 0 },
      // data glyphs — three small pixels above the body that appear only
      // in reading state, scrolling like a tape of incoming bytes.
      { c: "data-glyph", x: 8,  y: 11, w: 1, h: 1, f: "currentColor", o: 0 },
      { c: "data-glyph", x: 12, y: 11, w: 1, h: 1, f: "currentColor", o: 0 },
      { c: "data-glyph", x: 16, y: 11, w: 1, h: 1, f: "currentColor", o: 0 },
      { c: "data-glyph", x: 20, y: 11, w: 1, h: 1, f: "currentColor", o: 0 },
    ],
    evo: [
      [ { c: "spot", x: 12, y: 16, w: 2, h: 2, f: "#f472b6" } ],
      [ { c: "spot", x: 17, y: 15, w: 2, h: 2, f: "#fcd34d" },
        { c: "spot", x: 21, y: 17, w: 2, h: 2, f: "#a78bfa" } ],
      [ { c: "stripe", x: 14, y: 13, w: 1, h: 3, f: "#034a73" },
        { c: "stripe", x: 19, y: 13, w: 1, h: 3, f: "#034a73" } ],
      [ { c: "crest", x: 12, y: 11, w: 1, h: 2, f: "currentColor" },
        { c: "crest", x: 15, y: 10, w: 1, h: 3, f: "currentColor" },
        { c: "crest", x: 18, y: 11, w: 1, h: 2, f: "currentColor" },
        { c: "crest", x: 21, y: 12, w: 1, h: 1, f: "currentColor" } ],
    ],
  },

  /* ── ECHO — Signal Bat ────────────────────────────────────────────── *
   * Ramp: #0c0a26 / #312e81 / #5b51c5 / #a5b4fc                          *
   * Triangular body, big wings WITH finger bones, pointed ears,         *
   * red eyes + tiny fangs. Sonar rings via evo layers.                  */
  bat: {
    label: "signal bat",
    base: [
      // left wing — outline + fill + bones
      { c: "wing-outline", x: 1,  y: 11, w: 11, h: 1, f: "#0c0a26" },
      { c: "wing-outline", x: 1,  y: 19, w: 9, h: 1, f: "#0c0a26" },
      { c: "wing-outline", x: 0,  y: 12, w: 1, h: 7, f: "#0c0a26" },
      { c: "wing-l", x: 1, y: 12, w: 11, h: 7, f: "#312e81" },
      { c: "wing-l-hi", x: 1, y: 12, w: 10, h: 1, f: "#5b51c5" },
      { c: "wing-bone", x: 4, y: 13, w: 1, h: 5, f: "#0c0a26" },
      { c: "wing-bone", x: 7, y: 13, w: 1, h: 5, f: "#0c0a26" },
      // right wing — mirror
      { c: "wing-outline", x: 20, y: 11, w: 11, h: 1, f: "#0c0a26" },
      { c: "wing-outline", x: 22, y: 19, w: 9, h: 1, f: "#0c0a26" },
      { c: "wing-outline", x: 31, y: 12, w: 1, h: 7, f: "#0c0a26" },
      { c: "wing-r", x: 20, y: 12, w: 11, h: 7, f: "#312e81" },
      { c: "wing-r-hi", x: 20, y: 12, w: 10, h: 1, f: "#5b51c5" },
      { c: "wing-bone", x: 24, y: 13, w: 1, h: 5, f: "#0c0a26" },
      { c: "wing-bone", x: 27, y: 13, w: 1, h: 5, f: "#0c0a26" },
      // body (triangle) — outline + fill
      { c: "body-outline", x: 12, y: 9, w: 8, h: 1, f: "#0c0a26" },
      { c: "body-outline", x: 11, y: 10, w: 1, h: 12, f: "#0c0a26" },
      { c: "body-outline", x: 20, y: 10, w: 1, h: 12, f: "#0c0a26" },
      { c: "body-outline", x: 13, y: 24, w: 6, h: 1, f: "#0c0a26" },
      { c: "body", x: 12, y: 10, w: 8, h: 14, f: "#1e1b4b" },
      { c: "body-hi", x: 12, y: 10, w: 4, h: 1, f: "#312e81" },
      // pointed ears — taller, with separate tip pixel for perk animation
      { c: "ear",         x: 12, y: 7, w: 2, h: 3, f: "#1e1b4b" },
      { c: "ear",         x: 18, y: 7, w: 2, h: 3, f: "#1e1b4b" },
      { c: "ear-tip",     x: 12, y: 6, w: 1, h: 1, f: "#0c0a26" },
      { c: "ear-tip",     x: 19, y: 6, w: 1, h: 1, f: "#0c0a26" },
      { c: "ear-in",      x: 12, y: 8, w: 1, h: 2, f: "#7c3aed", o: 0.7 },
      { c: "ear-in",      x: 19, y: 8, w: 1, h: 2, f: "#7c3aed", o: 0.7 },
      // red eyes (white outline + red + black pupil pixel)
      { c: "eye-outline", x: 13, y: 12, w: 3, h: 3, f: "#0c0a26" },
      { c: "eye-outline", x: 16, y: 12, w: 3, h: 3, f: "#0c0a26" },
      { c: "eye-w",       x: 14, y: 13, w: 1, h: 1, f: "#fff" },
      { c: "eye-w",       x: 17, y: 13, w: 1, h: 1, f: "#fff" },
      { c: "eye",         x: 14, y: 13, w: 1, h: 1, f: "#ef4444" },
      { c: "eye",         x: 17, y: 13, w: 1, h: 1, f: "#ef4444" },
      // fangs
      { c: "fang",        x: 14, y: 17, w: 1, h: 2, f: "#fff" },
      { c: "fang",        x: 17, y: 17, w: 1, h: 2, f: "#fff" },
      // tail — small below body, pointed
      { c: "tail",        x: 15, y: 25, w: 2, h: 1, f: "#1e1b4b" },
      { c: "tail",        x: 15, y: 26, w: 1, h: 1, f: "#0c0a26" },
      // sonar dots radiating from the ears — hidden by default,
      // CSS reveals + animates them in listening / thinking / working states.
      { c: "sonar-dot", x:  7, y:  9, w: 2, h: 1, f: "currentColor", o: 0 },
      { c: "sonar-dot", x:  3, y:  6, w: 2, h: 1, f: "currentColor", o: 0 },
      { c: "sonar-dot", x: 23, y:  9, w: 2, h: 1, f: "currentColor", o: 0 },
      { c: "sonar-dot", x: 27, y:  6, w: 2, h: 1, f: "currentColor", o: 0 },
    ],
    evo: [
      [ { c: "sonar s1", x: 8,  y: 5, w: 16, h: 1, f: "currentColor", o: 0.65 },
        { c: "sonar s1", x: 8,  y: 25, w: 16, h: 1, f: "currentColor", o: 0.65 } ],
      [ { c: "sonar s2", x: 5,  y: 2, w: 22, h: 1, f: "currentColor", o: 0.4 },
        { c: "sonar s2", x: 5,  y: 28, w: 22, h: 1, f: "currentColor", o: 0.4 } ],
      [ { c: "wing-tip", x: 0,  y: 19, w: 2, h: 1, f: "currentColor" },
        { c: "wing-tip", x: 30, y: 19, w: 2, h: 1, f: "currentColor" } ],
      [ { c: "aura", x: 0, y: 0, w: 32, h: 32, f: "currentColor", o: 0.08 } ],
    ],
  },

  /* ── VEGA — Neon Hummingbird ──────────────────────────────────────── *
   * Ramp: #064e3b / #10b981 / #34d399 / #a7f3d0   green back            *
   *       #be185d / #f472b6 / #fbcfe8              pink chest           *
   * Streamlined body, long needle beak, wings touching the shoulder.    */
  hummingbird: {
    label: "neon hummingbird",
    base: [
      // motion trail
      { c: "trail",  x: 1, y: 14, w: 1, h: 1, f: "#34d399", o: 0.6 },
      { c: "trail",  x: 3, y: 14, w: 2, h: 1, f: "#34d399", o: 0.5 },
      { c: "trail",  x: 6, y: 14, w: 2, h: 1, f: "#34d399", o: 0.4 },
      // body outline (green back + pink chest)
      { c: "body-outline", x: 11, y: 10, w: 10, h: 1, f: "#064e3b" },
      { c: "body-outline", x: 11, y: 18, w: 10, h: 1, f: "#064e3b" },
      { c: "body-outline", x: 10, y: 11, w: 1, h: 7, f: "#064e3b" },
      { c: "body-outline", x: 21, y: 11, w: 1, h: 7, f: "#064e3b" },
      // back (green)
      { c: "back", x: 11, y: 11, w: 10, h: 4, f: "#10b981" },
      { c: "back-hi", x: 11, y: 11, w: 9, h: 1, f: "#34d399" },
      // chest (pink)
      { c: "chest", x: 11, y: 15, w: 10, h: 3, f: "#f472b6" },
      { c: "chest-hi", x: 12, y: 15, w: 6, h: 1, f: "#fbcfe8" },
      // head
      { c: "head-outline", x: 17, y: 9, w: 6, h: 1, f: "#064e3b" },
      { c: "head-outline", x: 17, y: 14, w: 6, h: 1, f: "#064e3b" },
      { c: "head-outline", x: 23, y: 10, w: 1, h: 4, f: "#064e3b" },
      { c: "head", x: 17, y: 10, w: 6, h: 4, f: "#10b981" },
      { c: "head-hi", x: 17, y: 10, w: 5, h: 1, f: "#34d399" },
      // eye
      { c: "eye-w", x: 19, y: 11, w: 1, h: 1, f: "#fff" },
      { c: "eye", x: 19, y: 11, w: 1, h: 1, f: "#0f172a" },
      // long needle beak
      { c: "beak-outline", x: 22, y: 10, w: 9, h: 1, f: "#92400e" },
      { c: "beak-outline", x: 22, y: 12, w: 9, h: 1, f: "#92400e" },
      { c: "beak",         x: 22, y: 11, w: 9, h: 1, f: "#fcd34d" },
      // wings (top + bottom) anchored to body
      { c: "wing-t-outline", x: 9, y: 9, w: 11, h: 1, f: "#064e3b" },
      { c: "wing-t", x: 10, y: 9, w: 9, h: 2, f: "#6ee7b7" },
      { c: "wing-t", x: 13, y: 8, w: 4, h: 1, f: "#6ee7b7", o: 0.85 },
      { c: "wing-b-outline", x: 9, y: 19, w: 11, h: 1, f: "#064e3b" },
      { c: "wing-b", x: 10, y: 19, w: 9, h: 2, f: "#6ee7b7" },
      { c: "wing-b", x: 13, y: 21, w: 4, h: 1, f: "#6ee7b7", o: 0.85 },
      // forked tail
      { c: "tail", x: 6, y: 13, w: 4, h: 1, f: "#10b981" },
      { c: "tail", x: 6, y: 16, w: 4, h: 1, f: "#10b981" },
      { c: "tail", x: 6, y: 15, w: 1, h: 1, f: "#064e3b" },
    ],
    evo: [
      [ { c: "trail2", x: 1, y: 13, w: 1, h: 1, f: "currentColor", o: 0.7 } ],
      [ { c: "shimmer", x: 14, y: 16, w: 1, h: 1, f: "currentColor" } ],
      [ { c: "beak-tip", x: 30, y: 11, w: 1, h: 1, f: "currentColor" } ],
      [ { c: "orbit", x: 4, y: 5, w: 26, h: 22, f: "currentColor", o: 0.1 } ],
    ],
  },

  /* ── SCRIBE — Scribe Raven ────────────────────────────────────────── *
   * Ramp: #020617 / #0f172a / #334155 / #94a3b8                          *
   * Black raven body (with feather highlight), YELLOW beak, gold eye,   *
   * sits on a parchment scroll. Quill at evo 2.                         */
  raven: {
    label: "scribe raven",
    base: [
      // parchment scroll (perch)
      { c: "scroll-outline", x: 3, y: 25, w: 26, h: 1, f: "#92400e" },
      { c: "scroll",         x: 3, y: 26, w: 26, h: 2, f: "#fef3c7" },
      { c: "scroll-edge",    x: 3, y: 28, w: 26, h: 1, f: "#d4a574" },
      { c: "scroll-curl",    x: 2, y: 26, w: 1, h: 2, f: "#d4a574" },
      { c: "scroll-curl",    x: 29, y: 26, w: 1, h: 2, f: "#d4a574" },
      // body outline
      { c: "body-outline", x: 8, y: 11, w: 14, h: 1, f: "#020617" },
      { c: "body-outline", x: 8, y: 25, w: 14, h: 1, f: "#020617" },
      { c: "body-outline", x: 7, y: 12, w: 1, h: 13, f: "#020617" },
      { c: "body-outline", x: 22, y: 12, w: 1, h: 13, f: "#020617" },
      // body
      { c: "body", x: 8, y: 12, w: 14, h: 13, f: "#0f172a" },
      // top-left feather highlight (subtle)
      { c: "body-hi", x: 8, y: 12, w: 4, h: 1, f: "#334155" },
      { c: "body-hi", x: 8, y: 13, w: 1, h: 4, f: "#334155" },
      // wing (folded, darker)
      { c: "wing", x: 9, y: 13, w: 6, h: 10, f: "#020617" },
      { c: "wing-hi", x: 9, y: 13, w: 4, h: 1, f: "#334155" },
      // head
      { c: "head-outline", x: 17, y: 6, w: 8, h: 1, f: "#020617" },
      { c: "head-outline", x: 17, y: 14, w: 8, h: 1, f: "#020617" },
      { c: "head-outline", x: 16, y: 7, w: 1, h: 7, f: "#020617" },
      { c: "head-outline", x: 25, y: 7, w: 1, h: 7, f: "#020617" },
      { c: "head", x: 17, y: 7, w: 8, h: 7, f: "#0f172a" },
      { c: "head-hi", x: 17, y: 7, w: 5, h: 1, f: "#334155" },
      // beak (yellow, tapered)
      { c: "beak-outline", x: 25, y: 9, w: 6, h: 1, f: "#92400e" },
      { c: "beak-outline", x: 25, y: 13, w: 6, h: 1, f: "#92400e" },
      { c: "beak", x: 25, y: 10, w: 6, h: 1, f: "#fcd34d" },
      { c: "beak", x: 25, y: 11, w: 5, h: 1, f: "#fcd34d" },
      { c: "beak", x: 25, y: 12, w: 4, h: 1, f: "#fcd34d" },
      { c: "beak-hi", x: 25, y: 10, w: 4, h: 1, f: "#fde68a" },
      // eye (gold ring + black pupil + white glint)
      { c: "eye-w", x: 21, y: 9, w: 3, h: 3, f: "#fcd34d" },
      { c: "eye",   x: 22, y: 10, w: 1, h: 1, f: "#0f172a" },
      { c: "eye-glint", x: 23, y: 9, w: 1, h: 1, f: "#fff" },
      // legs
      { c: "leg", x: 12, y: 25, w: 2, h: 2, f: "#fcd34d" },
      { c: "leg", x: 18, y: 25, w: 2, h: 2, f: "#fcd34d" },
    ],
    evo: [
      [ { c: "quill-shaft",   x: 18, y: 16, w: 1, h: 8, f: "#fcd34d" },
        { c: "quill-shaft",   x: 19, y: 16, w: 1, h: 8, f: "#92400e" },
        { c: "quill-feather", x: 16, y: 13, w: 5, h: 3, f: "#fcd34d" },
        { c: "quill-feather", x: 16, y: 13, w: 4, h: 1, f: "#fde68a" } ],
      [ { c: "ink", x: 16, y: 27, w: 2, h: 1, f: "#1e293b" } ],
      [ { c: "line", x: 6,  y: 27, w: 6, h: 1, f: "#1e293b", o: 0.6 },
        { c: "line", x: 19, y: 27, w: 6, h: 1, f: "#1e293b", o: 0.6 } ],
      [ { c: "feather-tuft", x: 14, y: 6, w: 1, h: 3, f: "#fcd34d" } ],
    ],
  },

  /* ── LEDGER — Accountant Raccoon ──────────────────────────────────── *
   * Ramp: #475569 / #94a3b8 / #cbd5e1 / #f1f5f9   grey fur              *
   *       #0f172a (mask) / #fff (eyes) / #fcd34d (coin)                 */
  raccoon: {
    label: "accountant raccoon",
    base: [
      // tail — alternating stripes (light/dark/light/dark)
      { c: "tail-outline", x: 23, y: 16, w: 8, h: 1, f: "#1e293b" },
      { c: "tail-outline", x: 23, y: 26, w: 8, h: 1, f: "#1e293b" },
      { c: "tail-outline", x: 23, y: 17, w: 1, h: 9, f: "#1e293b" },
      { c: "tail-outline", x: 31, y: 17, w: 1, h: 9, f: "#1e293b" },
      { c: "tail", x: 23, y: 17, w: 8, h: 2, f: "#cbd5e1" },
      { c: "tail", x: 23, y: 19, w: 8, h: 2, f: "#1e293b" },
      { c: "tail", x: 23, y: 21, w: 8, h: 2, f: "#94a3b8" },
      { c: "tail", x: 23, y: 23, w: 8, h: 2, f: "#1e293b" },
      { c: "tail", x: 23, y: 25, w: 8, h: 1, f: "#cbd5e1" },
      // body outline
      { c: "body-outline", x: 7, y: 14, w: 16, h: 1, f: "#475569" },
      { c: "body-outline", x: 7, y: 26, w: 16, h: 1, f: "#475569" },
      { c: "body-outline", x: 6, y: 15, w: 1, h: 11, f: "#475569" },
      { c: "body-outline", x: 23, y: 15, w: 1, h: 11, f: "#475569" },
      { c: "body", x: 7, y: 15, w: 16, h: 11, f: "#94a3b8" },
      { c: "body-hi", x: 7, y: 15, w: 4, h: 1, f: "#cbd5e1" },
      { c: "body-sh", x: 19, y: 22, w: 4, h: 4, f: "#475569" },
      // chest light
      { c: "chest", x: 10, y: 18, w: 10, h: 7, f: "#cbd5e1" },
      { c: "chest-hi", x: 10, y: 18, w: 6, h: 1, f: "#f1f5f9" },
      // legs
      { c: "leg", x:  9, y: 26, w: 3, h: 2, f: "#475569" },
      { c: "leg", x: 18, y: 26, w: 3, h: 2, f: "#475569" },
      // head outline
      { c: "head-outline", x: 6, y: 7, w: 14, h: 1, f: "#475569" },
      { c: "head-outline", x: 6, y: 15, w: 14, h: 1, f: "#475569" },
      { c: "head-outline", x: 5, y: 8, w: 1, h: 7, f: "#475569" },
      { c: "head-outline", x: 20, y: 8, w: 1, h: 7, f: "#475569" },
      // head
      { c: "head", x: 6, y: 8, w: 14, h: 7, f: "#94a3b8" },
      { c: "head-hi", x: 6, y: 8, w: 5, h: 1, f: "#cbd5e1" },
      // ears
      { c: "ear", x: 5, y: 4, w: 3, h: 3, f: "#94a3b8" },
      { c: "ear", x: 18, y: 4, w: 3, h: 3, f: "#94a3b8" },
      { c: "ear-outline", x: 5, y: 3, w: 3, h: 1, f: "#475569" },
      { c: "ear-outline", x: 18, y: 3, w: 3, h: 1, f: "#475569" },
      { c: "ear-in", x: 6, y: 5, w: 1, h: 1, f: "#1e293b" },
      { c: "ear-in", x: 19, y: 5, w: 1, h: 1, f: "#1e293b" },
      // BANDIT MASK (thick black bar with side wraps)
      { c: "mask", x: 6, y: 9, w: 14, h: 4, f: "#0f172a" },
      { c: "mask", x: 5, y: 10, w: 1, h: 2, f: "#0f172a" },
      { c: "mask", x: 20, y: 10, w: 1, h: 2, f: "#0f172a" },
      // eyes in mask (white + black pupil)
      { c: "eye-w", x: 8, y: 10, w: 2, h: 2, f: "#fff" },
      { c: "eye-w", x: 16, y: 10, w: 2, h: 2, f: "#fff" },
      { c: "eye-pupil", x: 9, y: 11, w: 1, h: 1, f: "#000" },
      { c: "eye-pupil", x: 17, y: 11, w: 1, h: 1, f: "#000" },
      // nose
      { c: "nose", x: 12, y: 14, w: 2, h: 1, f: "#0f172a" },
      // hands
      { c: "hand", x: 6, y: 16, w: 2, h: 2, f: "#475569" },
      { c: "hand", x: 22, y: 16, w: 2, h: 2, f: "#475569" },
    ],
    evo: [
      [ { c: "coin", x: 22, y: 14, w: 3, h: 3, f: "#fcd34d" },
        { c: "coin-hi", x: 22, y: 14, w: 3, h: 1, f: "#fde68a" },
        { c: "coin-sym", x: 23, y: 15, w: 1, h: 1, f: "#92400e" } ],
      [ { c: "coin2", x: 26, y: 6, w: 2, h: 2, f: "currentColor" } ],
      [ { c: "bar-bg",   x: 2,  y: 30, w: 24, h: 1, f: "#1e293b" },
        { c: "bar-fill", x: 2,  y: 30, w: 14, h: 1, f: "#fcd34d" } ],
      [ { c: "tick", x: 25, y: 10, w: 1, h: 1, f: "currentColor" },
        { c: "tick", x: 27, y: 12, w: 1, h: 1, f: "currentColor" },
        { c: "tick", x: 29, y: 10, w: 1, h: 1, f: "currentColor" } ],
    ],
  },

  /* ── RAVEN (debug) — Dark Raven ───────────────────────────────────── *
   * Ramp: #000 / #0a0a0a / #1f2937 / #4b5563                             *
   * Pitch-black silhouette, RED glowing eye, glitch lines, sharp beak.  */
  darkRaven: {
    label: "debug raven",
    base: [
      // body outline (using pure black on a slightly less-black body)
      { c: "body-outline", x: 8, y: 11, w: 14, h: 1, f: "#000" },
      { c: "body-outline", x: 8, y: 25, w: 14, h: 1, f: "#000" },
      { c: "body-outline", x: 7, y: 12, w: 1, h: 13, f: "#000" },
      { c: "body-outline", x: 22, y: 12, w: 1, h: 13, f: "#000" },
      { c: "body", x: 8, y: 12, w: 14, h: 13, f: "#0a0a0a" },
      // subtle highlight (very dark slate)
      { c: "body-hi", x: 8, y: 12, w: 4, h: 1, f: "#1f2937" },
      // wing
      { c: "wing", x: 9, y: 13, w: 6, h: 10, f: "#000" },
      // head
      { c: "head-outline", x: 17, y: 6, w: 8, h: 1, f: "#000" },
      { c: "head-outline", x: 17, y: 14, w: 8, h: 1, f: "#000" },
      { c: "head-outline", x: 16, y: 7, w: 1, h: 7, f: "#000" },
      { c: "head-outline", x: 25, y: 7, w: 1, h: 7, f: "#000" },
      { c: "head", x: 17, y: 7, w: 8, h: 7, f: "#0a0a0a" },
      // sharp beak (dark red, drips slightly)
      { c: "beak-outline", x: 25, y: 9, w: 6, h: 1, f: "#450a0a" },
      { c: "beak-outline", x: 25, y: 13, w: 6, h: 1, f: "#450a0a" },
      { c: "beak", x: 25, y: 10, w: 6, h: 1, f: "#7f1d1d" },
      { c: "beak", x: 25, y: 11, w: 5, h: 1, f: "#7f1d1d" },
      { c: "beak", x: 25, y: 12, w: 4, h: 1, f: "#7f1d1d" },
      // ERROR-RED eye with glow halo
      { c: "eye-glow", x: 21, y: 9, w: 4, h: 4, f: "#ef4444", o: 0.3 },
      { c: "eye-w", x: 22, y: 10, w: 2, h: 2, f: "#ef4444" },
      { c: "eye", x: 22, y: 10, w: 1, h: 1, f: "#fca5a5" },
      // legs
      { c: "leg", x: 12, y: 25, w: 2, h: 3, f: "#7f1d1d" },
      { c: "leg", x: 18, y: 25, w: 2, h: 3, f: "#7f1d1d" },
    ],
    evo: [
      [ { c: "glitch", x: 5,  y: 16, w: 4, h: 1, f: "#ef4444", o: 0.7 },
        { c: "glitch", x: 24, y: 22, w: 5, h: 1, f: "#ef4444", o: 0.7 } ],
      [ { c: "glitch", x: 1,  y: 9,  w: 6, h: 1, f: "#ef4444", o: 0.5 },
        { c: "glitch", x: 22, y: 16, w: 8, h: 1, f: "#ef4444", o: 0.5 } ],
      [ { c: "trace", x: 4,  y: 30, w: 2, h: 1, f: "currentColor" },
        { c: "trace", x: 8,  y: 30, w: 2, h: 1, f: "currentColor" },
        { c: "trace", x: 12, y: 30, w: 2, h: 1, f: "currentColor" },
        { c: "trace", x: 16, y: 30, w: 2, h: 1, f: "currentColor" } ],
      [ { c: "stack",       x: 0,  y: 0, w: 8, h: 5, f: "#7f1d1d", o: 0.5 },
        { c: "stack-text",  x: 1,  y: 2, w: 6, h: 1, f: "currentColor" } ],
    ],
  },

  /* ── LUMA — Firefly ───────────────────────────────────────────────── *
   * Ramp: #4a2906 / #854d0e / #a16207 / #ca8a04   brown body            *
   *       lantern: white core, yellow mid, yellow-glow halo             *
   * Small insect — diagonal head→thorax→abdomen line, glowing lantern.  */
  firefly: {
    label: "firefly",
    base: [
      // wings (translucent yellow)
      { c: "wing-l", x: 5,  y: 12, w: 8, h: 6, f: "#fde047", o: 0.55 },
      { c: "wing-l", x: 7,  y: 11, w: 5, h: 1, f: "#fde047", o: 0.3 },
      { c: "wing-l-edge", x: 5,  y: 12, w: 8, h: 1, f: "#fde047", o: 0.8 },
      { c: "wing-r", x: 14, y: 12, w: 8, h: 6, f: "#fde047", o: 0.55 },
      { c: "wing-r", x: 15, y: 11, w: 5, h: 1, f: "#fde047", o: 0.3 },
      { c: "wing-r-edge", x: 14, y: 12, w: 8, h: 1, f: "#fde047", o: 0.8 },
      // body segments (each with outline + highlight)
      { c: "head-outline", x: 8, y: 13, w: 6, h: 1, f: "#4a2906" },
      { c: "head-outline", x: 8, y: 18, w: 6, h: 1, f: "#4a2906" },
      { c: "head-outline", x: 8, y: 14, w: 1, h: 4, f: "#4a2906" },
      { c: "head", x: 9, y: 14, w: 5, h: 4, f: "#713f12" },
      { c: "head-hi", x: 9, y: 14, w: 4, h: 1, f: "#854d0e" },
      { c: "thorax-outline", x: 13, y: 14, w: 5, h: 1, f: "#4a2906" },
      { c: "thorax-outline", x: 13, y: 19, w: 5, h: 1, f: "#4a2906" },
      { c: "thorax", x: 13, y: 15, w: 5, h: 4, f: "#854d0e" },
      { c: "thorax-hi", x: 13, y: 15, w: 4, h: 1, f: "#a16207" },
      { c: "abdomen-outline", x: 17, y: 15, w: 6, h: 1, f: "#4a2906" },
      { c: "abdomen-outline", x: 17, y: 20, w: 6, h: 1, f: "#4a2906" },
      { c: "abdomen", x: 17, y: 16, w: 6, h: 4, f: "#a16207" },
      { c: "abdomen-hi", x: 17, y: 16, w: 5, h: 1, f: "#ca8a04" },
      // antennae
      { c: "antenna", x: 8, y: 11, w: 1, h: 3, f: "#4a2906" },
      { c: "antenna", x: 11, y: 11, w: 1, h: 3, f: "#4a2906" },
      { c: "antenna-tip", x: 7, y: 10, w: 2, h: 1, f: "#fde047" },
      { c: "antenna-tip", x: 11, y: 10, w: 2, h: 1, f: "#fde047" },
      // eye
      { c: "eye-w", x: 10, y: 15, w: 1, h: 1, f: "#fff" },
      { c: "eye",   x: 10, y: 15, w: 1, h: 1, f: "#000" },
      // legs
      { c: "leg", x: 10, y: 18, w: 1, h: 3, f: "#4a2906" },
      { c: "leg", x: 13, y: 19, w: 1, h: 3, f: "#4a2906" },
      { c: "leg", x: 16, y: 20, w: 1, h: 3, f: "#4a2906" },
      // LANTERN — wide glow halo, mid yellow, white core
      { c: "lantern-glow", x: 19, y: 17, w: 9, h: 7, f: "#fde047", o: 0.35 },
      { c: "lantern-glow", x: 18, y: 18, w: 11, h: 5, f: "#fde047", o: 0.25 },
      { c: "lantern-mid",  x: 21, y: 18, w: 6, h: 5, f: "#fef08a" },
      { c: "lantern-mid",  x: 21, y: 18, w: 6, h: 1, f: "#fef9c3" },
      { c: "lantern-core", x: 22, y: 19, w: 4, h: 3, f: "#fff" },
    ],
    evo: [
      [ { c: "spark s1", x: 2,  y: 4,  w: 1, h: 1, f: "currentColor" } ],
      [ { c: "spark s2", x: 28, y: 6,  w: 1, h: 1, f: "currentColor" },
        { c: "spark s3", x: 4,  y: 28, w: 1, h: 1, f: "currentColor" } ],
      [ { c: "vein", x: 6,  y: 14, w: 5, h: 1, f: "#a16207", o: 0.5 },
        { c: "vein", x: 16, y: 14, w: 5, h: 1, f: "#a16207", o: 0.5 } ],
      [ { c: "aura", x: 14, y: 17, w: 16, h: 14, f: "currentColor", o: 0.15 } ],
    ],
  },

  /* ── NOVA — Tiny Star Dragon ──────────────────────────────────────── *
   * Ramp: #3b0764 / #7c3aed / #a78bfa / #d8b4fe   purple body           *
   *       gold horns (#fcd34d / #b45309), small smoke breath            *
   * Coiled body, two wings with membranes, three back spikes.           */
  dragon: {
    label: "star dragon",
    base: [
      // tail (curled)
      { c: "tail-outline", x: 22, y: 17, w: 5, h: 1, f: "#3b0764" },
      { c: "tail-outline", x: 22, y: 21, w: 5, h: 1, f: "#3b0764" },
      { c: "tail-outline", x: 27, y: 18, w: 1, h: 3, f: "#3b0764" },
      { c: "tail-outline", x: 24, y: 22, w: 4, h: 1, f: "#3b0764" },
      { c: "tail-outline", x: 23, y: 25, w: 4, h: 1, f: "#3b0764" },
      { c: "tail", x: 22, y: 18, w: 5, h: 3, f: "#7c3aed" },
      { c: "tail", x: 24, y: 22, w: 4, h: 1, f: "#7c3aed" },
      { c: "tail", x: 23, y: 23, w: 4, h: 2, f: "#7c3aed" },
      { c: "tail-hi", x: 22, y: 18, w: 5, h: 1, f: "#a78bfa" },
      // body outline
      { c: "body-outline", x: 6, y: 13, w: 18, h: 1, f: "#3b0764" },
      { c: "body-outline", x: 6, y: 22, w: 18, h: 1, f: "#3b0764" },
      { c: "body-outline", x: 5, y: 14, w: 1, h: 8, f: "#3b0764" },
      { c: "body-outline", x: 24, y: 14, w: 1, h: 8, f: "#3b0764" },
      // body
      { c: "body", x: 6, y: 14, w: 18, h: 8, f: "#7c3aed" },
      // belly highlight (lighter)
      { c: "belly", x: 8, y: 17, w: 14, h: 4, f: "#a78bfa" },
      { c: "belly-hi", x: 8, y: 17, w: 6, h: 1, f: "#d8b4fe" },
      // back highlight
      { c: "body-hi", x: 6, y: 14, w: 5, h: 1, f: "#a78bfa" },
      // legs
      { c: "leg", x: 9,  y: 22, w: 2, h: 3, f: "#5b21b6" },
      { c: "leg", x: 14, y: 22, w: 2, h: 3, f: "#5b21b6" },
      { c: "leg", x: 19, y: 22, w: 2, h: 3, f: "#5b21b6" },
      { c: "leg-hi", x: 9,  y: 22, w: 1, h: 1, f: "#7c3aed" },
      { c: "leg-hi", x: 14, y: 22, w: 1, h: 1, f: "#7c3aed" },
      { c: "leg-hi", x: 19, y: 22, w: 1, h: 1, f: "#7c3aed" },
      // wing (folded back, with membranes)
      { c: "wing-outline", x: 11, y: 7, w: 10, h: 1, f: "#3b0764" },
      { c: "wing-outline", x: 11, y: 13, w: 10, h: 1, f: "#3b0764" },
      { c: "wing", x: 12, y: 8, w: 8, h: 5, f: "#5b21b6" },
      { c: "wing", x: 14, y: 7, w: 4, h: 1, f: "#5b21b6" },
      { c: "wing-hi", x: 12, y: 8, w: 5, h: 1, f: "#7c3aed" },
      { c: "wing-membrane", x: 13, y: 11, w: 1, h: 2, f: "#a78bfa" },
      { c: "wing-membrane", x: 16, y: 11, w: 1, h: 2, f: "#a78bfa" },
      { c: "wing-membrane", x: 19, y: 11, w: 1, h: 2, f: "#a78bfa" },
      // back spikes (gold)
      { c: "spike", x: 10, y: 11, w: 1, h: 3, f: "#fcd34d" },
      { c: "spike", x: 10, y: 11, w: 1, h: 1, f: "#fde68a" },
      { c: "spike", x: 13, y: 11, w: 1, h: 3, f: "#fcd34d" },
      { c: "spike", x: 13, y: 11, w: 1, h: 1, f: "#fde68a" },
      { c: "spike", x: 17, y: 11, w: 1, h: 3, f: "#fcd34d" },
      { c: "spike", x: 17, y: 11, w: 1, h: 1, f: "#fde68a" },
      // head
      { c: "head-outline", x: 2, y: 13, w: 6, h: 1, f: "#3b0764" },
      { c: "head-outline", x: 2, y: 18, w: 6, h: 1, f: "#3b0764" },
      { c: "head-outline", x: 1, y: 14, w: 1, h: 4, f: "#3b0764" },
      { c: "head", x: 2, y: 14, w: 6, h: 4, f: "#7c3aed" },
      { c: "head-hi", x: 2, y: 14, w: 5, h: 1, f: "#a78bfa" },
      // horns (gold + dark gold base)
      { c: "horn", x: 3, y: 11, w: 1, h: 2, f: "#fcd34d" },
      { c: "horn", x: 3, y: 12, w: 1, h: 1, f: "#b45309" },
      { c: "horn", x: 6, y: 11, w: 1, h: 2, f: "#fcd34d" },
      { c: "horn", x: 6, y: 12, w: 1, h: 1, f: "#b45309" },
      // eye (gold)
      { c: "eye-w", x: 3, y: 15, w: 2, h: 2, f: "#fcd34d" },
      { c: "eye",   x: 3, y: 15, w: 1, h: 1, f: "#000" },
      // smoke breath
      { c: "breath", x: 0, y: 16, w: 2, h: 1, f: "currentColor", o: 0.6 },
      { c: "breath", x: 0, y: 15, w: 1, h: 1, f: "currentColor", o: 0.4 },
    ],
    evo: [
      [ { c: "star", x: 26, y: 4, w: 2, h: 2, f: "#fcd34d" } ],
      [ { c: "star", x: 22, y: 2, w: 2, h: 2, f: "#fcd34d" },
        { c: "star", x: 29, y: 8, w: 1, h: 1, f: "#fcd34d" } ],
      [ { c: "fire", x: 0, y: 15, w: 1, h: 1, f: "#f97316" },
        { c: "fire", x: 0, y: 17, w: 1, h: 1, f: "#fb923c" } ],
      [ { c: "orbit", x: 0, y: 6, w: 32, h: 22, f: "currentColor", o: 0.08 } ],
    ],
  },
};

export const MASCOT_IDS = Object.keys(SPRITES);
