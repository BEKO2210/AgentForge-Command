// SVG mascot library for the Agent Arena.
// Every mascot returns a self-contained <svg> string. Animation states live as
// CSS classes (.idle / .thinking / .working / .success / .warning) on the root.
// All animation is CSS-driven so prefers-reduced-motion can disable it globally.
//
// Mascots are intentionally restrained: monochrome line work + the agent's
// accent colour. Evolution levels add layered detail (1=base, 5=full).

const STROKE = "currentColor";

/**
 * Build a mascot SVG.
 * @param {object} opt
 * @param {string} opt.mascot   - turtle, owl, fox, mole, chameleon, bat, hummingbird, raven, raccoon, darkRaven, firefly, dragon
 * @param {number} [opt.level]  - 1..5 evolution level
 * @param {string} [opt.color]  - accent fill/stroke colour
 * @param {string} [opt.state]  - idle | thinking | working | success | warning
 * @param {boolean} [opt.large] - render a larger / detailed version (drawer use)
 */
export function renderMascot({ mascot, level = 1, color = "#5b8cff", state = "idle", large = false }) {
  const size = large ? 220 : 96;
  const lvl = Math.max(1, Math.min(5, level | 0));
  const body = MASCOTS[mascot] ? MASCOTS[mascot](lvl, large) : MASCOTS.turtle(lvl, large);
  return `
    <svg class="mascot mascot-${mascot} state-${state} lvl-${lvl}"
         data-mascot="${mascot}" viewBox="0 0 100 100"
         width="${size}" height="${size}"
         style="color:${color}"
         role="img" aria-label="${mascot} mascot, evolution level ${lvl}">
      <defs>
        <filter id="glow-${mascot}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="${1.2 + lvl * 0.35}" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g class="mascot-body" filter="url(#glow-${mascot})">
        ${body}
      </g>
      ${renderEvolutionParticles(lvl)}
    </svg>
  `;
}

function renderEvolutionParticles(level) {
  if (level <= 1) return "";
  const count = (level - 1) * 2;
  let out = "";
  for (let i = 0; i < count; i++) {
    const cx = 12 + (i * 11) % 76;
    const cy = 10 + ((i * 17) % 72);
    const r = 0.6 + (i % 3) * 0.3;
    const d = 1.2 + (i % 4) * 0.4;
    out += `<circle class="evo-spark" cx="${cx}" cy="${cy}" r="${r}" style="animation-duration:${d}s;animation-delay:${i * 0.18}s"/>`;
  }
  return out;
}

const MASCOTS = {
  // ATLAS PRIME — Cyber Turtle with a command bridge shell.
  turtle: (lvl) => `
    <g class="m-turtle">
      <!-- shell -->
      <path class="m-shell" d="M28 56q22 -22 44 0q-3 22 -22 22q-19 0 -22 -22z"
            fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <!-- inner radar -->
      <circle class="m-radar" cx="50" cy="56" r="11" fill="none" stroke="${STROKE}" stroke-width="1.3" opacity=".55"/>
      <circle class="m-radar-dot" cx="50" cy="56" r="1.6" fill="${STROKE}"/>
      <!-- shell lights -->
      ${lvl >= 2 ? '<circle class="shell-light l1" cx="38" cy="52" r="1.2" fill="currentColor"/>' : ""}
      ${lvl >= 2 ? '<circle class="shell-light l2" cx="62" cy="52" r="1.2" fill="currentColor"/>' : ""}
      ${lvl >= 3 ? '<circle class="shell-light l3" cx="50" cy="46" r="1.2" fill="currentColor"/>' : ""}
      ${lvl >= 4 ? '<path class="shell-bridge" d="M38 56h24" stroke="currentColor" stroke-width="0.7" opacity=".6"/>' : ""}
      <!-- head -->
      <circle class="m-head" cx="50" cy="34" r="9" fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <circle class="m-eye" cx="47.5" cy="33" r="1.2" fill="${STROKE}"/>
      <circle class="m-eye" cx="52.5" cy="33" r="1.2" fill="${STROKE}"/>
      <!-- feet -->
      <rect x="25" y="74" width="8" height="4" rx="1.5" fill="none" stroke="${STROKE}" stroke-width="1.5"/>
      <rect x="67" y="74" width="8" height="4" rx="1.5" fill="none" stroke="${STROKE}" stroke-width="1.5"/>
      ${lvl >= 5 ? '<path class="m-antenna" d="M50 25v-7" stroke="currentColor" stroke-width="1.4"/><circle cx="50" cy="17" r="1.6" fill="currentColor"/>' : ""}
    </g>
  `,

  // SENTINEL — Guardian Owl, scan lines and blinking eyes.
  owl: (lvl) => `
    <g class="m-owl">
      <path class="m-owl-body" d="M30 32q20 -20 40 0v32q0 14 -20 14q-20 0 -20 -14z"
            fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <circle class="m-owl-eye left"  cx="42" cy="44" r="6" fill="none" stroke="${STROKE}" stroke-width="1.8"/>
      <circle class="m-owl-eye right" cx="58" cy="44" r="6" fill="none" stroke="${STROKE}" stroke-width="1.8"/>
      <circle class="m-owl-pupil" cx="42" cy="44" r="2" fill="${STROKE}"/>
      <circle class="m-owl-pupil" cx="58" cy="44" r="2" fill="${STROKE}"/>
      <path class="m-beak" d="M48 50l2 4l2 -4z" fill="${STROKE}"/>
      ${lvl >= 2 ? '<path class="scan-line" d="M30 60h40" stroke="currentColor" stroke-width=".7" opacity=".45"/>' : ""}
      ${lvl >= 3 ? '<path class="m-tuft l" d="M32 30l3 -6l3 6" fill="none" stroke="currentColor" stroke-width="1.4"/><path class="m-tuft r" d="M62 30l3 -6l3 6" fill="none" stroke="currentColor" stroke-width="1.4"/>' : ""}
      ${lvl >= 4 ? '<path class="m-talon" d="M40 78v6M50 78v6M60 78v6" stroke="currentColor" stroke-width="1.3"/>' : ""}
      ${lvl >= 5 ? '<circle class="m-aura" cx="50" cy="50" r="32" fill="none" stroke="currentColor" stroke-width="0.6" opacity=".25"/>' : ""}
    </g>
  `,

  // AURORA — Neon Fox, glowing tail.
  fox: (lvl) => `
    <g class="m-fox">
      <path class="m-fox-tail" d="M22 70q-14 -10 -8 -28q10 12 16 22"
            fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-fox-body" d="M30 70q14 -22 42 -16q4 14 -10 22q-16 8 -32 -6z"
            fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <path class="m-fox-head" d="M58 50l16 -12l-4 14l-12 -2z"
            fill="none" stroke="${STROKE}" stroke-width="2"/>
      <circle class="m-fox-eye" cx="64" cy="48" r="1.4" fill="${STROKE}"/>
      ${lvl >= 2 ? '<path class="m-fox-tail-glow" d="M22 70q-14 -10 -8 -28q10 12 16 22" stroke="currentColor" stroke-width="3.5" fill="none" opacity=".3"/>' : ""}
      ${lvl >= 3 ? '<circle class="m-shimmer" cx="46" cy="58" r="1.5" fill="currentColor"/>' : ""}
      ${lvl >= 4 ? '<path class="m-fox-stripe" d="M36 60q10 -6 22 -4" stroke="currentColor" stroke-width="0.8" fill="none" opacity=".5"/>' : ""}
      ${lvl >= 5 ? '<path class="m-fox-aura" d="M30 70q14 -22 42 -16" stroke="currentColor" stroke-width="6" fill="none" opacity=".18"/>' : ""}
    </g>
  `,

  // FORGE — Mole with sparks.
  mole: (lvl) => `
    <g class="m-mole">
      <ellipse class="m-mole-body" cx="50" cy="60" rx="24" ry="16" fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <circle class="m-mole-head" cx="34" cy="56" r="10" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <circle class="m-mole-nose" cx="26" cy="56" r="2" fill="${STROKE}"/>
      <line class="m-mole-eye" x1="32" y1="54" x2="34" y2="54" stroke="${STROKE}" stroke-width="1.4"/>
      <path class="m-mole-claw" d="M70 70l6 6M66 74l4 6M72 64l6 4" stroke="${STROKE}" stroke-width="1.6" fill="none"/>
      ${lvl >= 2 ? '<circle class="spark s1" cx="78" cy="74" r="1.2" fill="currentColor"/>' : ""}
      ${lvl >= 3 ? '<circle class="spark s2" cx="74" cy="80" r="1.4" fill="currentColor"/>' : ""}
      ${lvl >= 4 ? '<circle class="spark s3" cx="82" cy="64" r="1" fill="currentColor"/>' : ""}
      ${lvl >= 5 ? '<path class="m-mole-hammer" d="M20 32l-6 -6l10 -4l4 10z" fill="currentColor" opacity=".5"/>' : ""}
    </g>
  `,

  // PRISM — Chameleon, colour cycle.
  chameleon: (lvl) => `
    <g class="m-cham">
      <path class="m-cham-tail" d="M76 70q14 -2 10 14q-12 -2 -16 -6"
            fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-cham-body" d="M20 60q4 -16 28 -16q22 0 28 18q-4 12 -20 12q-22 0 -36 -14z"
            fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <circle class="m-cham-eye-outer" cx="26" cy="50" r="5" fill="none" stroke="${STROKE}" stroke-width="1.6"/>
      <circle class="m-cham-eye-inner" cx="26" cy="50" r="2" fill="${STROKE}"/>
      <path class="m-cham-toes" d="M28 78l-2 6m12 -6l-2 6m12 -6l-2 6m12 -6l-2 6" stroke="${STROKE}" stroke-width="1.4"/>
      ${lvl >= 2 ? '<circle class="m-cham-spot s1" cx="44" cy="56" r="1.4" fill="currentColor" opacity=".6"/>' : ""}
      ${lvl >= 3 ? '<circle class="m-cham-spot s2" cx="54" cy="50" r="1.4" fill="currentColor" opacity=".55"/>' : ""}
      ${lvl >= 4 ? '<circle class="m-cham-spot s3" cx="62" cy="58" r="1.4" fill="currentColor" opacity=".5"/>' : ""}
      ${lvl >= 5 ? '<path class="m-cham-crest" d="M48 30l4 -6l4 6l-4 4z" fill="currentColor"/>' : ""}
    </g>
  `,

  // ECHO — Signal Bat, sonar rings.
  bat: (lvl) => `
    <g class="m-bat">
      <path class="m-bat-wing l" d="M50 50l-30 -10l12 28z" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-bat-wing r" d="M50 50l30 -10l-12 28z" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <ellipse class="m-bat-body" cx="50" cy="54" rx="6" ry="9" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <circle class="m-bat-eye" cx="48" cy="50" r="1.1" fill="${STROKE}"/>
      <circle class="m-bat-eye" cx="52" cy="50" r="1.1" fill="${STROKE}"/>
      <path class="m-bat-ear l" d="M46 44l-2 -6l4 4z" fill="${STROKE}"/>
      <path class="m-bat-ear r" d="M54 44l2 -6l-4 4z" fill="${STROKE}"/>
      ${lvl >= 2 ? '<circle class="sonar s1" cx="50" cy="54" r="14" fill="none" stroke="currentColor" stroke-width="0.6" opacity=".55"/>' : ""}
      ${lvl >= 3 ? '<circle class="sonar s2" cx="50" cy="54" r="22" fill="none" stroke="currentColor" stroke-width="0.5" opacity=".4"/>' : ""}
      ${lvl >= 4 ? '<circle class="sonar s3" cx="50" cy="54" r="32" fill="none" stroke="currentColor" stroke-width="0.4" opacity=".3"/>' : ""}
      ${lvl >= 5 ? '<circle class="sonar s4" cx="50" cy="54" r="42" fill="none" stroke="currentColor" stroke-width="0.35" opacity=".22"/>' : ""}
    </g>
  `,

  // VEGA — Hummingbird, fast wings.
  hummingbird: (lvl) => `
    <g class="m-hb">
      <ellipse class="m-hb-body" cx="50" cy="56" rx="13" ry="7" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <circle class="m-hb-head" cx="64" cy="50" r="6" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-hb-beak" d="M70 50l12 -1l-12 3z" fill="${STROKE}"/>
      <path class="m-hb-wing top" d="M36 50q-4 -16 10 -8q4 4 -2 14" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-hb-wing bot" d="M36 60q-4 16 10 8q4 -4 -2 -14" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <circle class="m-hb-eye" cx="65" cy="49" r="1.1" fill="${STROKE}"/>
      ${lvl >= 2 ? '<circle class="m-trail t1" cx="42" cy="54" r="1.2" fill="currentColor" opacity=".7"/>' : ""}
      ${lvl >= 3 ? '<circle class="m-trail t2" cx="32" cy="56" r="1" fill="currentColor" opacity=".5"/>' : ""}
      ${lvl >= 4 ? '<circle class="m-trail t3" cx="22" cy="58" r="0.8" fill="currentColor" opacity=".35"/>' : ""}
      ${lvl >= 5 ? '<path class="m-hb-tail" d="M36 56l-12 -2l4 4l-4 4l12 -2" stroke="currentColor" stroke-width="0.8" fill="none" opacity=".7"/>' : ""}
    </g>
  `,

  // SCRIBE — Raven with quill.
  raven: (lvl) => `
    <g class="m-rv">
      <ellipse class="m-rv-body" cx="50" cy="58" rx="14" ry="10" fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <circle class="m-rv-head" cx="62" cy="48" r="7" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-rv-beak" d="M68 48l10 -1l-10 4z" fill="${STROKE}"/>
      <path class="m-rv-wing" d="M40 56q4 -8 18 -8q -8 6 -16 12z" fill="none" stroke="${STROKE}" stroke-width="1.6"/>
      <circle class="m-rv-eye" cx="63" cy="47" r="1.2" fill="${STROKE}"/>
      <path class="m-rv-leg" d="M44 68v8M52 68v8" stroke="${STROKE}" stroke-width="1.4"/>
      ${lvl >= 2 ? '<path class="m-quill" d="M28 36l-8 14l12 -4z" fill="none" stroke="currentColor" stroke-width="1.4"/>' : ""}
      ${lvl >= 3 ? '<path class="m-cursor" d="M22 56h6" stroke="currentColor" stroke-width="2"/>' : ""}
      ${lvl >= 4 ? '<path class="m-paper" d="M14 70h20v14h-20z" fill="none" stroke="currentColor" stroke-width="0.8" opacity=".5"/>' : ""}
      ${lvl >= 5 ? '<path class="m-glyph" d="M16 76h16M16 80h12" stroke="currentColor" stroke-width="0.7" opacity=".7"/>' : ""}
    </g>
  `,

  // LEDGER — Raccoon with coins.
  raccoon: (lvl) => `
    <g class="m-rc">
      <ellipse class="m-rc-body" cx="50" cy="58" rx="16" ry="12" fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <circle class="m-rc-head" cx="36" cy="44" r="10" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-rc-mask" d="M28 44q4 -4 16 0" stroke="${STROKE}" stroke-width="2.2" fill="none"/>
      <circle class="m-rc-eye" cx="32" cy="44" r="1.3" fill="${STROKE}"/>
      <circle class="m-rc-eye" cx="40" cy="44" r="1.3" fill="${STROKE}"/>
      <path class="m-rc-ear l" d="M30 34l-2 -6l5 4z" fill="${STROKE}"/>
      <path class="m-rc-ear r" d="M42 34l2 -6l-5 4z" fill="${STROKE}"/>
      <path class="m-rc-tail" d="M64 64q14 -2 16 14" stroke="${STROKE}" stroke-width="2" fill="none"/>
      <path class="m-rc-stripe" d="M64 64q4 4 16 14" stroke="${STROKE}" stroke-width="1.2" fill="none" opacity=".5"/>
      ${lvl >= 2 ? '<circle class="m-coin c1" cx="74" cy="44" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><text x="74" y="46" text-anchor="middle" font-size="4" fill="currentColor" font-family="monospace">¤</text>' : ""}
      ${lvl >= 3 ? '<circle class="m-coin c2" cx="82" cy="52" r="2.4" fill="none" stroke="currentColor" stroke-width="1.2"/>' : ""}
      ${lvl >= 4 ? '<path class="m-bar" d="M16 78h28v4h-28z" fill="none" stroke="currentColor" stroke-width="0.8" opacity=".55"/><path class="m-bar-fill" d="M16 78h12v4h-12z" fill="currentColor" opacity=".7"/>' : ""}
      ${lvl >= 5 ? '<text x="74" y="68" font-size="6" font-family="monospace" fill="currentColor" opacity=".8" class="m-tick">+0.42</text>' : ""}
    </g>
  `,

  // RAVEN debug — black, glitchy.
  darkRaven: (lvl) => `
    <g class="m-drv">
      <ellipse class="m-drv-body" cx="50" cy="60" rx="16" ry="11" fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <path class="m-drv-wing" d="M30 60q6 -12 22 -10q -8 10 -16 14z" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <circle class="m-drv-head" cx="66" cy="48" r="8" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-drv-beak" d="M74 48l10 -2l-10 5z" fill="${STROKE}"/>
      <circle class="m-drv-eye" cx="67" cy="46" r="1.5" fill="${STROKE}"/>
      <path class="m-drv-leg" d="M44 70v8M54 70v8" stroke="${STROKE}" stroke-width="1.6"/>
      ${lvl >= 2 ? '<path class="m-glitch g1" d="M30 50h6M40 52h4" stroke="currentColor" stroke-width="1" opacity=".7"/>' : ""}
      ${lvl >= 3 ? '<path class="m-glitch g2" d="M20 64h10M58 70h6" stroke="currentColor" stroke-width="1" opacity=".7"/>' : ""}
      ${lvl >= 4 ? '<path class="m-trace" d="M14 86l20 -4l16 6l20 -10" stroke="currentColor" stroke-width="0.7" fill="none" opacity=".55"/>' : ""}
      ${lvl >= 5 ? '<text x="50" y="92" text-anchor="middle" font-size="5" font-family="monospace" fill="currentColor" opacity=".8" class="m-stack">stack#0xE3</text>' : ""}
    </g>
  `,

  // LUMA — Firefly with light pulses.
  firefly: (lvl) => `
    <g class="m-ff">
      <ellipse class="m-ff-body" cx="50" cy="52" rx="9" ry="6" fill="none" stroke="${STROKE}" stroke-width="1.8"/>
      <circle class="m-ff-head" cx="42" cy="50" r="4" fill="none" stroke="${STROKE}" stroke-width="1.8"/>
      <circle class="m-ff-eye" cx="41" cy="50" r="0.9" fill="${STROKE}"/>
      <path class="m-ff-wing l" d="M50 46q-4 -12 -2 0z" fill="${STROKE}" opacity=".5"/>
      <path class="m-ff-wing r" d="M50 46q4 -12 2 0z" fill="${STROKE}" opacity=".5"/>
      <circle class="m-ff-glow" cx="58" cy="54" r="6" fill="currentColor" opacity=".5"/>
      ${lvl >= 2 ? '<circle class="m-spark sp1" cx="32" cy="34" r="1.4" fill="currentColor"/>' : ""}
      ${lvl >= 3 ? '<circle class="m-spark sp2" cx="72" cy="38" r="1.2" fill="currentColor"/>' : ""}
      ${lvl >= 4 ? '<circle class="m-spark sp3" cx="78" cy="68" r="1.3" fill="currentColor"/>' : ""}
      ${lvl >= 5 ? '<circle class="m-spark sp4" cx="22" cy="72" r="1.4" fill="currentColor"/>' : ""}
    </g>
  `,

  // NOVA — Tiny star dragon.
  dragon: (lvl) => `
    <g class="m-dr">
      <path class="m-dr-tail" d="M76 70q14 4 12 16q-14 -2 -18 -8"
            fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-dr-body" d="M22 60q8 -18 30 -18q22 0 26 16q-4 14 -22 14q-22 0 -34 -12z"
            fill="none" stroke="${STROKE}" stroke-width="2.2"/>
      <circle class="m-dr-head" cx="22" cy="54" r="7" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <circle class="m-dr-eye" cx="20" cy="52" r="1.2" fill="${STROKE}"/>
      <path class="m-dr-wing" d="M48 42l8 -16l4 18z" fill="none" stroke="${STROKE}" stroke-width="2"/>
      <path class="m-dr-spike" d="M30 42l4 -6l4 6M44 38l4 -6l4 6M58 38l4 -6l4 6"
            stroke="${STROKE}" stroke-width="1.4" fill="none"/>
      ${lvl >= 2 ? '<circle class="m-star s1" cx="78" cy="22" r="1.5" fill="currentColor"/>' : ""}
      ${lvl >= 3 ? '<circle class="m-star s2" cx="68" cy="14" r="1.2" fill="currentColor"/>' : ""}
      ${lvl >= 4 ? '<circle class="m-star s3" cx="88" cy="32" r="1.4" fill="currentColor"/>' : ""}
      ${lvl >= 5 ? '<circle class="m-orbit" cx="50" cy="56" r="40" fill="none" stroke="currentColor" stroke-width="0.4" stroke-dasharray="2 3" opacity=".5"/>' : ""}
    </g>
  `,
};

export const MASCOT_IDS = Object.keys(MASCOTS);
