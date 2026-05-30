# AgentForge Command — Design System

> **Run 1.1 (ROADMAP 2.0, Tier 1).** The single source of truth for spacing,
> elevation, motion, typography and semantic colour. Tokens live in
> [`gui/public/arena/design-tokens.css`](../gui/public/arena/design-tokens.css)
> and are loaded **before** `styles.css`, so every component can reference them.
>
> This run establishes the foundation with **zero visual change** — the token
> values equal the palette already shipping. Subsequent Tier‑1 runs migrate the
> remaining literal values in `styles.css` onto these tokens.

## Spacing — 8px modular scale

A predictable rhythm built on an 8px base (with a 4px half-step). This is a
modular scale rather than a strict Fibonacci sequence — it keeps the cockpit's
dense, terminal-like layout on a consistent grid.

| Token | Value | Use |
|-------|-------|-----|
| `--spacing-xs` | 4px | hairline gaps, icon padding |
| `--spacing-sm` | 8px | inline gaps, chip padding |
| `--spacing-md` | 16px | card padding, control gaps |
| `--spacing-lg` | 24px | section spacing |
| `--spacing-xl` | 32px | major blocks |
| `--spacing-2xl` | 48px | page-level rhythm |

## Radii

`--radius-sm` 9px · `--radius-md` 14px · `--radius-pill` 999px.

## Elevation (shadows)

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,.12)` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,.15)` |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,.20)` |
| `--shadow-card` / `--shadow-deep` | the existing deep cockpit shadows, tokenized |

## Motion

`--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)` · `--dur-fast: 150ms` ·
`--dur-base: 240ms`. All transitions should honour `prefers-reduced-motion`
(see `styles.css`).

## Typography

`--font-mono` (JetBrains Mono) for terminals/metrics · `--font-ui` (IBM Plex
Sans) for chrome.

## Semantic colours

These are the *named roles*. Component CSS should use the semantic token, never
a raw hex.

| Token | Value | Role |
|-------|-------|------|
| `--color-bg` | `#040611` | app background |
| `--color-surface` | `#0c1224` | cards / panels |
| `--color-border` | `#1a2540` | dividers |
| `--color-text` | `#f1f5fb` | primary text |
| `--color-text-muted` | `#8a96b0` | secondary text |
| `--color-accent` | `#5b8cff` | primary / focus |
| `--color-accent-success` | `#54e6a8` | success / "good" |
| `--color-accent-warn` | `#ffcf5c` | warning |
| `--color-accent-error` | `#ff6b7d` | error / "bad" |
| `--color-cta` | `#22c55e` | launch / call-to-action |

`styles.css` maps its legacy names onto these (`--good → --color-accent-success`,
`--warn → --color-accent-warn`, `--bad → --color-accent-error`, `--accent`,
`--cta`).

## Agent colours — data-driven (not CSS tokens)

> ⚠️ The roadmap sketch referenced a 4-agent model ("Atlas/Sentinel/Aurora/
> Vanguard"). The **actual** swarm is **Atlas + 11 specialists** (no
> "Vanguard"), and each agent's colour is defined **once** in
> [`gui/public/arena/data.js`](../gui/public/arena/data.js). We deliberately do
> **not** duplicate them as CSS tokens — the registry is the single source, so
> there's no drift. Components receive the colour at render time (e.g. via the
> card's `--accent` custom property set inline).

| Agent | Colour | | Agent | Colour |
|-------|--------|---|-------|--------|
| atlas | `#f5b94a` | | vega | `#34d399` |
| sentinel | `#7ee787` | | scribe | `#9aa5c4` |
| aurora | `#f06bd2` | | ledger | `#eab308` |
| forge | `#ff9a55` | | raven | `#ff6b7d` |
| prism | `#a78bfa` | | luma | `#fde047` |
| echo | `#36d6c3` | | nova | `#60a5fa` |

## Conventions

- **Use a token, not a literal.** New CSS must reference `--spacing-*`,
  `--shadow-*`, `--radius-*`, `--color-*` rather than hard-coding values.
- **Focus rings:** `--focus-ring` (`2px solid --color-accent-success`).
- **Tap targets:** ≥ `--tap-target` (44px) on touch.
- Migration of the remaining literals in `styles.css` is tracked across Tier 1.
