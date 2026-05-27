// AgentForge swarm registry — Atlas Prime is the sole lead, everyone else is
// a specialist that reports back to Atlas. No mock data: every value here is
// either a static identity field (name, role, mascot, briefing template) or
// a derived live signal (status, terminal lines from a real PTY). The arena
// no longer simulates activity — it shows what the swarm actually does, or
// it stays honest and idle.

export const LEAD_ID = "atlas";

/** Identity of every agent in the swarm. Live state (status, terminal lines,
 *  evolution) lives on the running instance the spawner builds.  */
export const SEED_AGENTS = [
  {
    id: "atlas", name: "ATLAS PRIME", title: "Chief Orchestrator", role: "Lead",
    domain: "lead", lane: "lead", lead: true,
    superSkill: "Decomposes any mission, dispatches the right specialists and integrates every report back into a single coherent story.",
    mascot: "turtle", mascotSpecies: "Cyber Turtle", mascotLabel: "command-bridge turtle",
    color: "#f5b94a", accentColor: "#ffd97a",
    capabilities: ["plan", "dispatch", "integrate", "summarize", "decide", "push"],
    seed: true, spawnedBy: null,
  },
  {
    id: "sentinel", name: "SENTINEL", title: "Risk & Safety Officer", role: "Security",
    domain: "security", lane: "quality",
    superSkill: "Finds broken assumptions, security holes and gate violations before they ship.",
    mascot: "owl", mascotSpecies: "Guardian Owl", mascotLabel: "scanner owl",
    color: "#7ee787", accentColor: "#a6f8a6",
    capabilities: ["threat-model", "gate", "audit", "policy"],
    seed: true, spawnedBy: "atlas",
  },
  {
    id: "aurora", name: "AURORA", title: "Premium UI / Motion", role: "Design",
    domain: "ui", lane: "frontend",
    superSkill: "Turns functional UI into a premium experience with hierarchy, motion and atmosphere.",
    mascot: "fox", mascotSpecies: "Neon Fox", mascotLabel: "polish fox",
    color: "#f06bd2", accentColor: "#ffb3ef",
    capabilities: ["design", "motion", "polish", "tokens"],
    seed: true, spawnedBy: "atlas",
  },
  {
    id: "forge", name: "FORGE", title: "Build & Release", role: "Build",
    domain: "build", lane: "backend",
    superSkill: "Keeps the project stable, buildable, testable and release-ready.",
    mascot: "mole", mascotSpecies: "Forge Mole", mascotLabel: "build-pulse mole",
    color: "#ff9a55", accentColor: "#ffcf94",
    capabilities: ["ci", "release", "deps", "lint"],
    seed: true, spawnedBy: "atlas",
  },
  {
    id: "prism", name: "PRISM", title: "Visualisation & Graphs", role: "Viz",
    domain: "viz", lane: "frontend",
    superSkill: "Turns complex tool-calls and agent relationships into clear visualisations.",
    mascot: "chameleon", mascotSpecies: "Prism Chameleon", mascotLabel: "spectrum chameleon",
    color: "#a78bfa", accentColor: "#c8b5ff",
    capabilities: ["graphs", "3d", "data-map", "diagram"],
    seed: true, spawnedBy: "atlas",
  },
  {
    id: "echo", name: "ECHO", title: "Event Stream & Replay", role: "Signals",
    domain: "events", lane: "lead",
    superSkill: "Spots patterns across events, sessions and tool calls. Replays history.",
    mascot: "bat", mascotSpecies: "Signal Bat", mascotLabel: "sonar bat",
    color: "#36d6c3", accentColor: "#7df0e2",
    capabilities: ["hooks", "logs", "replay", "subscribe"],
    seed: true, spawnedBy: "atlas",
  },
  {
    id: "vega", name: "VEGA", title: "Performance & Motion Engine", role: "Perf",
    domain: "perf", lane: "frontend",
    superSkill: "Optimises motion, FPS, rendering and responsiveness without bloat.",
    mascot: "hummingbird", mascotSpecies: "Neon Hummingbird", mascotLabel: "fps hummingbird",
    color: "#34d399", accentColor: "#86efbf",
    capabilities: ["fps", "render", "raf", "tracing"],
    seed: true, spawnedBy: "atlas",
  },
  {
    id: "scribe", name: "SCRIBE", title: "Documentation & Explainers", role: "Docs",
    domain: "docs", lane: "lead",
    superSkill: "Explains complex systems so engineers instantly see why they matter.",
    mascot: "raven", mascotSpecies: "Scribe Raven", mascotLabel: "quill raven",
    color: "#9aa5c4", accentColor: "#c8d2ee",
    capabilities: ["readme", "tutorials", "diagrams", "changelog"],
    seed: true, spawnedBy: "atlas",
  },
  {
    id: "ledger", name: "LEDGER", title: "Cost, Tokens, Budget", role: "Cost",
    domain: "cost", lane: "quality",
    superSkill: "Makes cost, tokens, burn-rate and usage transparent and actionable.",
    mascot: "raccoon", mascotSpecies: "Accountant Raccoon", mascotLabel: "ledger raccoon",
    color: "#eab308", accentColor: "#facc15",
    capabilities: ["tokens", "budget", "billing", "telemetry"],
    seed: true, spawnedBy: "atlas",
  },
  {
    id: "raven", name: "RAVEN", title: "Debug & Failure Analysis", role: "Debug",
    domain: "debug", lane: "backend",
    superSkill: "Roots out root-causes in logs, errors and broken state.",
    mascot: "darkRaven", mascotSpecies: "Debug Raven", mascotLabel: "trace raven",
    color: "#ff6b7d", accentColor: "#ffa1ad",
    capabilities: ["stack", "diff", "bisect", "post-mortem"],
    seed: true, spawnedBy: "atlas",
  },
  {
    id: "luma", name: "LUMA", title: "Accessibility & Contrast", role: "A11y",
    domain: "a11y", lane: "frontend",
    superSkill: "Makes the UI accessible, readable and keyboard-driveable.",
    mascot: "firefly", mascotSpecies: "Firefly", mascotLabel: "focus firefly",
    color: "#fde047", accentColor: "#fff099",
    capabilities: ["aria", "contrast", "keyboard", "screen-reader"],
    seed: true, spawnedBy: "atlas",
  },
  {
    id: "nova", name: "NOVA", title: "Product Story & Positioning", role: "Product",
    domain: "product", lane: "lead",
    superSkill: "Turns features into a sharp story and a believable demo.",
    mascot: "dragon", mascotSpecies: "Tiny Star Dragon", mascotLabel: "story dragon",
    color: "#60a5fa", accentColor: "#9dc7ff",
    capabilities: ["narrative", "demo", "positioning", "launch"],
    seed: true, spawnedBy: "atlas",
  },
];

/** Briefing templates Atlas can hand to each specialist. These are not chat
 *  messages — they're the static intent of each role. Live briefings come
 *  from Atlas's LLM stream or the operator's broadcast bar. */
export const BRIEFINGS = {
  atlas:    "Hold mission coherence. Decompose goals, brief the swarm, integrate outputs, push only when the gate is green.",
  sentinel: "Audit every change against risk gates. Block unsafe outputs. Maintain the green gate.",
  aurora:   "Tighten the visual hierarchy. Add restrained motion, premium polish, no clown UI.",
  forge:    "Stabilise the build. Pin deps, gate releases, keep CI under 3 minutes.",
  prism:    "Render the agent graph, tool-call flows and dependencies so humans can read them at a glance.",
  echo:     "Subscribe to events, summarise patterns, surface replay points and broken loops.",
  vega:     "Watch FPS, jank and animation cost. Respect prefers-reduced-motion. Trim what is wasteful.",
  scribe:   "Document the system in plain language. README, tutorials, changelogs, diagrams.",
  ledger:   "Track tokens, cost and burn. Make every minute and every cent visible.",
  raven:    "Find root-causes. Bisect, diff state, write a clean post-mortem with proof.",
  luma:     "Audit contrast, ARIA, focus rings, keyboard flow. Make the UI usable for everyone.",
  nova:     "Turn shipped features into a 60-second demo that explains why this matters.",
};

/** Initial state confidence/risk/quality estimates. These are reasonable
 *  priors, not fake telemetry — they update from real PTY signals once a
 *  specialist is launched.  */
export const PRIORS = {
  atlas:    { confidence: 0.92, risk: 0.18, qualityScore: 0.94 },
  sentinel: { confidence: 0.88, risk: 0.08, qualityScore: 0.90 },
  aurora:   { confidence: 0.87, risk: 0.14, qualityScore: 0.91 },
  forge:    { confidence: 0.83, risk: 0.21, qualityScore: 0.86 },
  prism:    { confidence: 0.84, risk: 0.12, qualityScore: 0.88 },
  echo:     { confidence: 0.86, risk: 0.10, qualityScore: 0.89 },
  vega:     { confidence: 0.82, risk: 0.16, qualityScore: 0.87 },
  scribe:   { confidence: 0.89, risk: 0.07, qualityScore: 0.92 },
  ledger:   { confidence: 0.85, risk: 0.11, qualityScore: 0.88 },
  raven:    { confidence: 0.81, risk: 0.24, qualityScore: 0.84 },
  luma:     { confidence: 0.87, risk: 0.09, qualityScore: 0.90 },
  nova:     { confidence: 0.86, risk: 0.13, qualityScore: 0.89 },
};
