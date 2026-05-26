// SVG mascot library for the AgentForge Arena.
//
// Each mascot is hand-built character work — not a generic emoji. The same
// SVG renders at every size; CSS state classes (idle / thinking / working /
// success / warning) drive the animations so a single mascot can convey what
// the agent is doing without changing markup.
//
// Evolution levels (1..5) layer additional ornaments on top of the base —
// antennae, scanlines, sonar rings, particle trails, etc. — so a higher level
// reads instantly as "more capable" without becoming chaotic.

const STROKE = "currentColor";

/**
 * @param {object} opt
 * @param {string} opt.mascot
 * @param {number} [opt.level]
 * @param {string} [opt.color]
 * @param {string} [opt.state]  - idle | thinking | working | success | warning
 * @param {("xs"|"sm"|"md"|"lg"|"xl")} [opt.size]
 */
export function renderMascot({ mascot, level = 1, color = "#5b8cff", state = "idle", size = "md" }) {
  const dim = { xs: 40, sm: 64, md: 96, lg: 160, xl: 240 }[size] || 96;
  const lvl = Math.max(1, Math.min(5, level | 0));
  const tpl = MASCOTS[mascot] || MASCOTS.turtle;
  const body = tpl(lvl);
  return `
    <svg class="mascot mascot-${mascot} state-${state} lvl-${lvl} size-${size}"
         data-mascot="${mascot}" viewBox="0 0 100 100"
         width="${dim}" height="${dim}"
         style="color:${color}"
         role="img" aria-label="${mascot} mascot, evolution level ${lvl}, state ${state}">
      <defs>
        <radialGradient id="halo-${mascot}-${lvl}" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stop-color="currentColor" stop-opacity="${0.05 + lvl * 0.045}"/>
          <stop offset="60%" stop-color="currentColor" stop-opacity="0.02"/>
          <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
        </radialGradient>
        <filter id="glow-${mascot}-${lvl}" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="${0.9 + lvl * 0.32}" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle class="mascot-halo" cx="50" cy="52" r="46" fill="url(#halo-${mascot}-${lvl})"/>
      <g class="mascot-body" filter="url(#glow-${mascot}-${lvl})">${body}</g>
      ${renderEvoOrnaments(mascot, lvl)}
    </svg>
  `;
}

/** Lightweight floating ornaments shared by every mascot above level 1. */
function renderEvoOrnaments(_mascot, level) {
  if (level <= 1) return "";
  const count = (level - 1) * 2;
  let out = "";
  for (let i = 0; i < count; i++) {
    const cx = 14 + ((i * 13 + 7) % 72);
    const cy =  8 + ((i * 19 + 5) % 16);
    const r  = 0.7 + (i % 3) * 0.25;
    const d  = 1.6 + (i % 4) * 0.45;
    out += `<circle class="evo-spark" cx="${cx}" cy="${cy}" r="${r}" style="animation-duration:${d}s;animation-delay:${i * 0.21}s"/>`;
  }
  return out;
}

/* ----- Mascot library ---------------------------------------------------- */

const MASCOTS = {
  // ATLAS PRIME — Cyber Turtle with a command-bridge shell.
  // Breathing belly · radar sweep · shell lights · subtle head bob.
  turtle: (lvl) => `
    <g class="m-turtle">
      <ellipse class="m-belly" cx="50" cy="62" rx="22" ry="4" fill="currentColor" opacity=".08"/>
      <path class="m-shell" d="M28 58q22 -24 44 0q-2 22 -22 22q-20 0 -22 -22z"
            fill="none" stroke="${STROKE}" stroke-width="2.2" stroke-linejoin="round"/>
      <path class="m-shell-line" d="M50 36v40M30 58q20 14 40 0" stroke="${STROKE}" stroke-width="0.7" fill="none" opacity=".4"/>
      <circle class="m-radar"     cx="50" cy="58" r="11" fill="none" stroke="${STROKE}" stroke-width="1" opacity=".55"/>
      <path   class="m-radar-arm" d="M50 58 L60 52" stroke="${STROKE}" stroke-width="1.2" opacity=".9"/>
      <circle class="m-radar-dot" cx="50" cy="58" r="1.6" fill="${STROKE}"/>
      ${lvl >= 2 ? '<circle class="shell-light l1" cx="38" cy="54" r="1.2" fill="currentColor"/>' : ""}
      ${lvl >= 2 ? '<circle class="shell-light l2" cx="62" cy="54" r="1.2" fill="currentColor"/>' : ""}
      ${lvl >= 3 ? '<circle class="shell-light l3" cx="50" cy="46" r="1.2" fill="currentColor"/>' : ""}
      ${lvl >= 4 ? '<path class="shell-bridge" d="M38 56h24" stroke="currentColor" stroke-width="0.7" opacity=".55"/>' : ""}
      <path class="m-neck" d="M44 38 Q50 30 56 38" stroke="${STROKE}" stroke-width="2" fill="none"/>
      <ellipse class="m-head" cx="50" cy="30" rx="9" ry="8" fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <circle  class="m-eye left"  cx="47.5" cy="29" r="1.3" fill="${STROKE}"/>
      <circle  class="m-eye right" cx="52.5" cy="29" r="1.3" fill="${STROKE}"/>
      <path    class="m-cheek"  d="M44 33q3 2 6 0" stroke="${STROKE}" stroke-width="0.7" fill="none" opacity=".5"/>
      <rect class="m-foot l" x="25" y="74" width="9" height="4" rx="1.5" fill="none" stroke="${STROKE}" stroke-width="1.5"/>
      <rect class="m-foot r" x="66" y="74" width="9" height="4" rx="1.5" fill="none" stroke="${STROKE}" stroke-width="1.5"/>
      ${lvl >= 5 ? '<path class="m-antenna" d="M50 22v-8" stroke="currentColor" stroke-width="1.3"/><circle class="m-antenna-tip" cx="50" cy="13" r="1.7" fill="currentColor"/>' : ""}
    </g>
  `,

  // SENTINEL — Guardian Owl. Tracks left/right · slow blink · tuft tufts.
  owl: (lvl) => `
    <g class="m-owl">
      <path class="m-owl-body" d="M30 32q20 -22 40 0v32q0 16 -20 16q-20 0 -20 -16z"
            fill="none" stroke="${STROKE}" stroke-width="2.2" stroke-linejoin="round"/>
      <path class="m-owl-chest" d="M36 48q14 -10 28 0v18q0 12 -14 12q-14 0 -14 -12z"
            stroke="${STROKE}" stroke-width="0.8" fill="currentColor" opacity=".07"/>
      <g class="m-owl-eyes">
        <circle class="m-owl-eye left"  cx="42" cy="44" r="6" fill="none" stroke="${STROKE}" stroke-width="1.8"/>
        <circle class="m-owl-eye right" cx="58" cy="44" r="6" fill="none" stroke="${STROKE}" stroke-width="1.8"/>
        <circle class="m-owl-pupil left"  cx="42" cy="44" r="2.2" fill="${STROKE}"/>
        <circle class="m-owl-pupil right" cx="58" cy="44" r="2.2" fill="${STROKE}"/>
        <circle class="m-owl-glint left"  cx="40.5" cy="42.5" r=".7" fill="#fff" opacity=".7"/>
        <circle class="m-owl-glint right" cx="56.5" cy="42.5" r=".7" fill="#fff" opacity=".7"/>
      </g>
      <path class="m-beak" d="M48 50l2 4l2 -4z" fill="${STROKE}"/>
      ${lvl >= 2 ? '<path class="scan-line" d="M30 62h40" stroke="currentColor" stroke-width=".7" opacity=".5"/>' : ""}
      ${lvl >= 3 ? '<path class="m-tuft l" d="M32 30l3 -6l3 6" fill="none" stroke="currentColor" stroke-width="1.4"/><path class="m-tuft r" d="M62 30l3 -6l3 6" fill="none" stroke="currentColor" stroke-width="1.4"/>' : ""}
      ${lvl >= 4 ? '<path class="m-feather l" d="M34 70q4 -3 8 0" stroke="currentColor" stroke-width=".7" fill="none" opacity=".5"/><path class="m-feather r" d="M58 70q4 -3 8 0" stroke="currentColor" stroke-width=".7" fill="none" opacity=".5"/>' : ""}
      ${lvl >= 5 ? '<circle class="m-aura" cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width="0.5" opacity=".25"/>' : ""}
      <path class="m-talon" d="M40 80v6M50 80v6M60 80v6" stroke="${STROKE}" stroke-width="1.3"/>
    </g>
  `,

  // AURORA — Neon Fox. Tail-flick · ear-twitch · iridescent stripe.
  fox: (lvl) => `
    <g class="m-fox">
      <path class="m-fox-tail" d="M22 70q-14 -10 -8 -28q10 12 16 22"
            fill="none" stroke="${STROKE}" stroke-width="2.2" stroke-linejoin="round"/>
      <path class="m-fox-tail-tip" d="M16 44q-4 4 -2 8" stroke="${STROKE}" stroke-width="2" fill="none"/>
      <path class="m-fox-body" d="M30 70q14 -22 42 -16q4 14 -10 22q-16 8 -32 -6z"
            fill="none" stroke="${STROKE}" stroke-width="2.2" stroke-linejoin="round"/>
      <path class="m-fox-belly" d="M34 70q12 -14 32 -10" stroke="currentColor" stroke-width=".7" fill="none" opacity=".4"/>
      <path class="m-fox-head" d="M58 50l16 -12l-4 14l-12 -2z"
            fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-fox-ear" d="M70 41l5 -10l-1 8z" fill="currentColor" opacity=".55"/>
      <circle class="m-fox-eye" cx="64" cy="48" r="1.4" fill="${STROKE}"/>
      <circle class="m-fox-glint" cx="63.4" cy="47.5" r=".5" fill="#fff" opacity=".8"/>
      <path class="m-fox-mouth" d="M62 53q3 1 6 0" stroke="${STROKE}" stroke-width=".7" fill="none" opacity=".55"/>
      ${lvl >= 2 ? '<path class="m-fox-tail-glow" d="M22 70q-14 -10 -8 -28q10 12 16 22" stroke="currentColor" stroke-width="3.6" fill="none" opacity=".25"/>' : ""}
      ${lvl >= 3 ? '<circle class="m-shimmer" cx="46" cy="58" r="1.5" fill="currentColor"/>' : ""}
      ${lvl >= 4 ? '<path class="m-fox-stripe" d="M36 62q14 -8 26 -4" stroke="currentColor" stroke-width="0.9" fill="none" opacity=".65"/>' : ""}
      ${lvl >= 5 ? '<path class="m-fox-aura" d="M30 70q14 -22 42 -16" stroke="currentColor" stroke-width="6" fill="none" opacity=".18"/>' : ""}
    </g>
  `,

  // FORGE — Mole. Hammer-cycle · sparks · pulsing forge glow.
  mole: (lvl) => `
    <g class="m-mole">
      <ellipse class="m-mole-shadow" cx="50" cy="80" rx="22" ry="3" fill="currentColor" opacity=".1"/>
      <ellipse class="m-mole-body" cx="50" cy="60" rx="24" ry="16" fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <path    class="m-mole-fur" d="M30 50q20 -8 40 0" stroke="${STROKE}" stroke-width=".7" fill="none" opacity=".4"/>
      <circle  class="m-mole-head" cx="34" cy="56" r="11" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <ellipse class="m-mole-nose" cx="25" cy="56" rx="2.6" ry="2" fill="${STROKE}"/>
      <path    class="m-mole-whisker" d="M22 56h-6M22 58q-4 1 -7 3" stroke="${STROKE}" stroke-width=".6" fill="none" opacity=".6"/>
      <line    class="m-mole-eye" x1="32" y1="54" x2="34" y2="54" stroke="${STROKE}" stroke-width="1.4"/>
      <path    class="m-mole-claw" d="M70 70l6 6M66 74l4 6M72 64l6 4" stroke="${STROKE}" stroke-width="1.6" fill="none"/>
      <path    class="m-mole-anvil" d="M14 78h12l-2 -4h-8z" stroke="${STROKE}" stroke-width="1.2" fill="none" opacity=".55"/>
      ${lvl >= 2 ? '<circle class="spark s1" cx="78" cy="74" r="1.3" fill="currentColor"/>' : ""}
      ${lvl >= 3 ? '<circle class="spark s2" cx="74" cy="80" r="1.5" fill="currentColor"/>' : ""}
      ${lvl >= 4 ? '<circle class="spark s3" cx="82" cy="64" r="1.1" fill="currentColor"/>' : ""}
      ${lvl >= 5 ? '<path class="m-mole-hammer" d="M20 30l-6 -6l10 -4l4 10z" fill="currentColor" opacity=".6"/><path class="m-mole-haft" d="M22 32l8 8" stroke="currentColor" stroke-width="1.2" opacity=".6"/>' : ""}
    </g>
  `,

  // PRISM — Chameleon. Eye turret · iridescent skin spots · crest.
  chameleon: (lvl) => `
    <g class="m-cham">
      <path class="m-cham-tail" d="M76 70q14 -2 10 14q-12 -2 -16 -6"
            fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-cham-tail-curl" d="M86 84q-3 4 1 7" stroke="${STROKE}" stroke-width="1.4" fill="none" opacity=".7"/>
      <path class="m-cham-body" d="M20 60q4 -16 28 -16q22 0 28 18q-4 12 -20 12q-22 0 -36 -14z"
            fill="none" stroke="${STROKE}" stroke-width="2.2" stroke-linejoin="round"/>
      <circle class="m-cham-eye-outer" cx="26" cy="48" r="5.5" fill="none" stroke="${STROKE}" stroke-width="1.6"/>
      <circle class="m-cham-eye-inner" cx="26" cy="48" r="2"  fill="${STROKE}"/>
      <circle class="m-cham-eye-glint" cx="25" cy="46.5" r=".6" fill="#fff" opacity=".8"/>
      <path   class="m-cham-mouth" d="M16 60q6 2 12 0" stroke="${STROKE}" stroke-width=".7" fill="none" opacity=".55"/>
      <path   class="m-cham-toes" d="M28 78l-2 6m12 -6l-2 6m12 -6l-2 6m12 -6l-2 6" stroke="${STROKE}" stroke-width="1.4"/>
      ${lvl >= 2 ? '<circle class="m-cham-spot s1" cx="44" cy="56" r="1.5" fill="currentColor" opacity=".7"/>' : ""}
      ${lvl >= 3 ? '<circle class="m-cham-spot s2" cx="54" cy="50" r="1.5" fill="currentColor" opacity=".65"/>' : ""}
      ${lvl >= 4 ? '<circle class="m-cham-spot s3" cx="62" cy="58" r="1.5" fill="currentColor" opacity=".6"/>' : ""}
      ${lvl >= 5 ? '<path class="m-cham-crest" d="M40 38l4 -8l4 6l4 -8l4 6l4 -8l4 6" stroke="currentColor" stroke-width="1.2" fill="none"/>' : ""}
    </g>
  `,

  // ECHO — Signal Bat. Sonar rings · flap · ear-twitch.
  bat: (lvl) => `
    <g class="m-bat">
      <path class="m-bat-wing l" d="M50 50l-32 -8l14 30z" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-bat-wing-rib l" d="M50 50l-22 -4M50 50l-12 18" stroke="${STROKE}" stroke-width=".6" opacity=".5"/>
      <path class="m-bat-wing r" d="M50 50l32 -8l-14 30z" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-bat-wing-rib r" d="M50 50l22 -4M50 50l12 18" stroke="${STROKE}" stroke-width=".6" opacity=".5"/>
      <ellipse class="m-bat-body" cx="50" cy="54" rx="6" ry="9" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <circle  class="m-bat-eye"  cx="48" cy="50" r="1.1" fill="${STROKE}"/>
      <circle  class="m-bat-eye"  cx="52" cy="50" r="1.1" fill="${STROKE}"/>
      <path    class="m-bat-fang" d="M48 56l1 3M52 56l-1 3" stroke="${STROKE}" stroke-width=".8"/>
      <path    class="m-bat-ear l" d="M46 44l-2 -7l4 4z" fill="${STROKE}"/>
      <path    class="m-bat-ear r" d="M54 44l2 -7l-4 4z" fill="${STROKE}"/>
      ${lvl >= 2 ? '<circle class="sonar s1" cx="50" cy="54" r="14" fill="none" stroke="currentColor" stroke-width="0.6" opacity=".55"/>' : ""}
      ${lvl >= 3 ? '<circle class="sonar s2" cx="50" cy="54" r="22" fill="none" stroke="currentColor" stroke-width="0.5" opacity=".4"/>' : ""}
      ${lvl >= 4 ? '<circle class="sonar s3" cx="50" cy="54" r="32" fill="none" stroke="currentColor" stroke-width="0.4" opacity=".3"/>' : ""}
      ${lvl >= 5 ? '<circle class="sonar s4" cx="50" cy="54" r="42" fill="none" stroke="currentColor" stroke-width="0.35" opacity=".22"/>' : ""}
    </g>
  `,

  // VEGA — Hummingbird. Hyper-fast wings · trail · tongue darting.
  hummingbird: (lvl) => `
    <g class="m-hb">
      <ellipse class="m-hb-body" cx="50" cy="56" rx="13" ry="7" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <circle  class="m-hb-head" cx="64" cy="50" r="6" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path    class="m-hb-beak" d="M70 50l14 -1l-14 3z" fill="${STROKE}"/>
      <path    class="m-hb-tongue" d="M82 49h4" stroke="${STROKE}" stroke-width=".8"/>
      <path    class="m-hb-wing top" d="M36 50q-4 -16 10 -8q4 4 -2 14" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path    class="m-hb-wing bot" d="M36 60q-4 16 10 8q4 -4 -2 -14" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <circle  class="m-hb-eye" cx="65" cy="49" r="1.1" fill="${STROKE}"/>
      <circle  class="m-hb-glint" cx="64.4" cy="48.5" r=".5" fill="#fff" opacity=".8"/>
      ${lvl >= 2 ? '<circle class="m-trail t1" cx="42" cy="54" r="1.2" fill="currentColor" opacity=".7"/>' : ""}
      ${lvl >= 3 ? '<circle class="m-trail t2" cx="32" cy="56" r="1" fill="currentColor" opacity=".55"/>' : ""}
      ${lvl >= 4 ? '<circle class="m-trail t3" cx="22" cy="58" r="0.8" fill="currentColor" opacity=".35"/>' : ""}
      ${lvl >= 5 ? '<path class="m-hb-tail" d="M36 56l-12 -2l4 4l-4 4l12 -2" stroke="currentColor" stroke-width="0.8" fill="none" opacity=".7"/>' : ""}
    </g>
  `,

  // SCRIBE — Raven with quill, parchment, glyph-lines.
  raven: (lvl) => `
    <g class="m-rv">
      <ellipse class="m-rv-body" cx="50" cy="58" rx="14" ry="10" fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <circle  class="m-rv-head" cx="62" cy="48" r="7" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path    class="m-rv-beak" d="M68 48l10 -1l-10 4z" fill="${STROKE}"/>
      <path    class="m-rv-wing" d="M40 56q4 -8 18 -8q -8 6 -16 12z" fill="none" stroke="${STROKE}" stroke-width="1.6"/>
      <path    class="m-rv-wing-detail" d="M44 56q4 -4 12 -4" stroke="${STROKE}" stroke-width=".6" opacity=".5"/>
      <circle  class="m-rv-eye" cx="63" cy="47" r="1.2" fill="${STROKE}"/>
      <circle  class="m-rv-glint" cx="62.5" cy="46.5" r=".5" fill="#fff" opacity=".8"/>
      <path    class="m-rv-leg" d="M44 68v8M52 68v8" stroke="${STROKE}" stroke-width="1.4"/>
      ${lvl >= 2 ? '<path class="m-quill" d="M28 36l-8 14l12 -4z" fill="none" stroke="currentColor" stroke-width="1.4"/>' : ""}
      ${lvl >= 3 ? '<path class="m-cursor" d="M22 56h6" stroke="currentColor" stroke-width="2"/>' : ""}
      ${lvl >= 4 ? '<path class="m-paper" d="M14 70h20v14h-20z" fill="none" stroke="currentColor" stroke-width="0.8" opacity=".5"/>' : ""}
      ${lvl >= 5 ? '<path class="m-glyph" d="M16 76h16M16 80h12" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2 3" opacity=".75"/>' : ""}
    </g>
  `,

  // LEDGER — Raccoon. Coins spin · bar fills · tick-tape rises.
  raccoon: (lvl) => `
    <g class="m-rc">
      <ellipse class="m-rc-body" cx="50" cy="58" rx="16" ry="12" fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <circle  class="m-rc-head" cx="36" cy="44" r="10" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path    class="m-rc-mask" d="M26 44q4 -5 20 0" stroke="${STROKE}" stroke-width="2.2" fill="none"/>
      <path    class="m-rc-mask-fill" d="M26 44q4 -5 20 0v2q-10 4 -20 0z" fill="${STROKE}" opacity=".55"/>
      <circle  class="m-rc-eye" cx="31" cy="44.5" r="1.4" fill="#fff"/>
      <circle  class="m-rc-eye" cx="41" cy="44.5" r="1.4" fill="#fff"/>
      <circle  class="m-rc-pupil" cx="31" cy="44.5" r=".8" fill="${STROKE}"/>
      <circle  class="m-rc-pupil" cx="41" cy="44.5" r=".8" fill="${STROKE}"/>
      <path    class="m-rc-ear l" d="M30 34l-2 -6l5 4z" fill="${STROKE}"/>
      <path    class="m-rc-ear r" d="M42 34l2 -6l-5 4z" fill="${STROKE}"/>
      <path    class="m-rc-tail" d="M64 64q14 -2 16 14" stroke="${STROKE}" stroke-width="2" fill="none"/>
      <path    class="m-rc-stripe s1" d="M64 64q3 4 6 9" stroke="${STROKE}" stroke-width="1.2" opacity=".7"/>
      <path    class="m-rc-stripe s2" d="M70 70q3 4 4 9" stroke="${STROKE}" stroke-width="1.2" opacity=".55"/>
      ${lvl >= 2 ? '<circle class="m-coin c1" cx="74" cy="44" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><text x="74" y="46" text-anchor="middle" font-size="4" fill="currentColor" font-family="monospace">¤</text>' : ""}
      ${lvl >= 3 ? '<circle class="m-coin c2" cx="82" cy="52" r="2.4" fill="none" stroke="currentColor" stroke-width="1.2"/>' : ""}
      ${lvl >= 4 ? '<rect class="m-bar" x="16" y="78" width="28" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="0.8" opacity=".55"/><rect class="m-bar-fill" x="16" y="78" width="12" height="4" rx="1" fill="currentColor" opacity=".75"/>' : ""}
      ${lvl >= 5 ? '<text x="74" y="68" font-size="6" font-family="monospace" fill="currentColor" opacity=".85" class="m-tick">+0.42</text>' : ""}
    </g>
  `,

  // RAVEN debug — black/silhouette, glitch lines.
  darkRaven: (lvl) => `
    <g class="m-drv">
      <ellipse class="m-drv-body" cx="50" cy="60" rx="16" ry="11" fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <path    class="m-drv-wing" d="M30 60q6 -12 22 -10q -8 10 -16 14z" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <circle  class="m-drv-head" cx="66" cy="48" r="8" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path    class="m-drv-beak" d="M74 48l10 -2l-10 5z" fill="${STROKE}"/>
      <circle  class="m-drv-eye" cx="67" cy="46" r="1.5" fill="${STROKE}"/>
      <circle  class="m-drv-glow" cx="67" cy="46" r="3" fill="currentColor" opacity=".15"/>
      <path    class="m-drv-leg" d="M44 70v8M54 70v8" stroke="${STROKE}" stroke-width="1.6"/>
      ${lvl >= 2 ? '<path class="m-glitch g1" d="M30 50h6M40 52h4" stroke="currentColor" stroke-width="1" opacity=".7"/>' : ""}
      ${lvl >= 3 ? '<path class="m-glitch g2" d="M20 64h10M58 70h6" stroke="currentColor" stroke-width="1" opacity=".7"/>' : ""}
      ${lvl >= 4 ? '<path class="m-trace" d="M14 86l20 -4l16 6l20 -10" stroke="currentColor" stroke-width="0.7" fill="none" opacity=".55" stroke-dasharray="3 2"/>' : ""}
      ${lvl >= 5 ? '<text x="50" y="92" text-anchor="middle" font-size="5" font-family="monospace" fill="currentColor" opacity=".85" class="m-stack">stack#0xE3</text>' : ""}
    </g>
  `,

  // LUMA — Firefly. Glow lantern · sparks · gentle wing-blur.
  firefly: (lvl) => `
    <g class="m-ff">
      <ellipse class="m-ff-body" cx="50" cy="52" rx="9" ry="6" fill="none" stroke="${STROKE}" stroke-width="1.8"/>
      <circle  class="m-ff-head" cx="42" cy="50" r="4" fill="none" stroke="${STROKE}" stroke-width="1.8"/>
      <circle  class="m-ff-eye" cx="41" cy="50" r="0.9" fill="${STROKE}"/>
      <path    class="m-ff-antenna" d="M42 47l-3 -6M44 46l-1 -5" stroke="${STROKE}" stroke-width=".7" fill="none"/>
      <path    class="m-ff-wing l" d="M50 46q-5 -14 -2 0z" fill="${STROKE}" opacity=".5"/>
      <path    class="m-ff-wing r" d="M50 46q5 -14 2 0z" fill="${STROKE}" opacity=".5"/>
      <circle  class="m-ff-glow" cx="58" cy="54" r="6" fill="currentColor" opacity=".55"/>
      <circle  class="m-ff-glow-core" cx="58" cy="54" r="2.5" fill="currentColor" opacity="1"/>
      ${lvl >= 2 ? '<circle class="m-spark sp1" cx="32" cy="34" r="1.4" fill="currentColor"/>' : ""}
      ${lvl >= 3 ? '<circle class="m-spark sp2" cx="72" cy="38" r="1.2" fill="currentColor"/>' : ""}
      ${lvl >= 4 ? '<circle class="m-spark sp3" cx="78" cy="68" r="1.3" fill="currentColor"/>' : ""}
      ${lvl >= 5 ? '<circle class="m-spark sp4" cx="22" cy="72" r="1.4" fill="currentColor"/>' : ""}
    </g>
  `,

  // NOVA — Tiny star dragon. Star-orbit · breath-spark · wing flap.
  dragon: (lvl) => `
    <g class="m-dr">
      <path class="m-dr-tail" d="M76 70q14 4 12 16q-14 -2 -18 -8"
            fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-dr-tail-tip" d="M88 86q3 2 1 6" stroke="${STROKE}" stroke-width="1.4" fill="none" opacity=".7"/>
      <path class="m-dr-body" d="M22 60q8 -18 30 -18q22 0 26 16q-4 14 -22 14q-22 0 -34 -12z"
            fill="none" stroke="${STROKE}" stroke-width="2.2" stroke-linejoin="round"/>
      <circle class="m-dr-head" cx="22" cy="54" r="7" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <circle class="m-dr-eye" cx="20" cy="52" r="1.3" fill="${STROKE}"/>
      <path   class="m-dr-breath" d="M14 56l-6 -2l6 1l-6 -1" stroke="${STROKE}" stroke-width="0.9" fill="none" opacity=".55"/>
      <path   class="m-dr-wing" d="M48 42l8 -18l4 20z" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path   class="m-dr-wing-detail" d="M52 30l2 8M56 28l1 9" stroke="${STROKE}" stroke-width=".6" opacity=".5"/>
      <path   class="m-dr-spike" d="M30 42l4 -6l4 6M44 38l4 -6l4 6M58 38l4 -6l4 6"
              stroke="${STROKE}" stroke-width="1.4" fill="none"/>
      ${lvl >= 2 ? '<circle class="m-star s1" cx="78" cy="22" r="1.6" fill="currentColor"/>' : ""}
      ${lvl >= 3 ? '<circle class="m-star s2" cx="68" cy="14" r="1.2" fill="currentColor"/>' : ""}
      ${lvl >= 4 ? '<circle class="m-star s3" cx="88" cy="32" r="1.4" fill="currentColor"/>' : ""}
      ${lvl >= 5 ? '<circle class="m-orbit" cx="50" cy="56" r="40" fill="none" stroke="currentColor" stroke-width="0.4" stroke-dasharray="2 3" opacity=".55"/>' : ""}
    </g>
  `,
};

export const MASCOT_IDS = Object.keys(MASCOTS);
