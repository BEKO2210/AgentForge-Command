#!/usr/bin/env node
// Render every mascot from gui/public/arena/mascots.js into a standalone SVG.
// Run with: node scripts/render-mascots.mjs
// Output:  docs/mascots/<id>.svg  +  docs/mascots/_index.svg (gallery)
//
// The renderer is a tiny stand-in for the browser: it imports the same
// SVG-template module the UI uses, wraps it with the correct viewBox and
// CSS animation hooks, and serialises a static SVG. The animations stay
// purely CSS, so GitHub's image renderer shows the static pose — which
// is what we want for documentation.

import { renderMascot, MASCOT_IDS } from "../gui/public/arena/mascots.js";
import { SEED_AGENTS } from "../gui/public/arena/data.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "docs", "mascots");
fs.mkdirSync(OUT, { recursive: true });

// Pixel-art mascots use a 32×32 viewBox. We frame each at 200×200 with a
// dark background + accent border so GitHub renders them readably whether
// it's the light or dark site theme.
const FRAME = (inner, label, color) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"
     shape-rendering="crispEdges"
     role="img" aria-label="${label} mascot">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0c1224"/>
      <stop offset="100%" stop-color="#06090f"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity=".25"/>
      <stop offset="70%" stop-color="${color}" stop-opacity=".03"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="200" height="200" rx="22" fill="url(#bg)"/>
  <rect x="6" y="6" width="188" height="188" rx="18" fill="none" stroke="${color}" stroke-opacity=".35"/>
  <circle cx="100" cy="100" r="86" fill="url(#halo)"/>
  <!-- centred 32-unit canvas, scaled up ×5 to fill the 200-unit frame -->
  <g transform="translate(20,20) scale(5)" style="color:${color}">
    ${inner}
  </g>
  <text x="100" y="186" text-anchor="middle"
        font-family="JetBrains Mono, ui-monospace, monospace"
        font-weight="700" font-size="9" fill="${color}"
        opacity=".75" letter-spacing="1.2">
    ${label.toUpperCase()}
  </text>
</svg>
`;

// Pull the <svg> tag and strip it; we just want the inner mascot body.
function extractInner(rawSvg) {
  const open = rawSvg.indexOf("<svg");
  const closeOpen = rawSvg.indexOf(">", open);
  const closeTag = rawSvg.lastIndexOf("</svg>");
  return rawSvg.slice(closeOpen + 1, closeTag);
}

const summary = [];
for (const agent of SEED_AGENTS) {
  const raw = renderMascot({
    mascot: agent.mascot, level: 5,
    color: agent.color, state: "idle", size: "lg",
  });
  const svg = FRAME(extractInner(raw), `${agent.name} · ${agent.mascotSpecies}`, agent.color);
  const file = path.join(OUT, `${agent.id}.svg`);
  fs.writeFileSync(file, svg);
  summary.push({ id: agent.id, name: agent.name, mascot: agent.mascot, color: agent.color, file });
}

// Composite gallery — 4 columns × 3 rows, 200px each.
const COLS = 4;
const W = 200, H = 200, GAP = 12;
const gw = COLS * W + (COLS - 1) * GAP;
const rows = Math.ceil(summary.length / COLS);
const gh = rows * H + (rows - 1) * GAP + 36;
let tiles = "";
for (let i = 0; i < summary.length; i++) {
  const s = summary[i];
  const col = i % COLS, row = Math.floor(i / COLS);
  const x = col * (W + GAP), y = row * (H + GAP);
  const inner = extractInner(renderMascot({ mascot: s.mascot, level: 5, color: s.color, state: "idle", size: "lg" }));
  tiles += `
    <g transform="translate(${x},${y})">
      <rect width="${W}" height="${H}" rx="18" fill="#0c1224"/>
      <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="14" fill="none" stroke="${s.color}" stroke-opacity=".4"/>
      <g transform="translate(20,20) scale(5)" shape-rendering="crispEdges" style="color:${s.color}">${inner}</g>
      <text x="${W / 2}" y="${H - 12}" text-anchor="middle"
            font-family="JetBrains Mono, ui-monospace, monospace"
            font-weight="700" font-size="11" fill="${s.color}" letter-spacing="1.4">
        ${s.name.toUpperCase()}
      </text>
    </g>
  `;
}
const gallery = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gw} ${gh}" width="${gw}" height="${gh}"
     role="img" aria-label="AgentForge mascot gallery">
  ${tiles}
</svg>
`;
fs.writeFileSync(path.join(OUT, "_gallery.svg"), gallery);

console.log(`Rendered ${summary.length} mascots into ${OUT}`);
for (const s of summary) console.log(`  ${s.id}  → ${s.name} (${s.mascot})`);
console.log(`  gallery → _gallery.svg (${gw}×${gh})`);
