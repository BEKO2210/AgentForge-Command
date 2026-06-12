# Third-Party Notices & SBOM

AgentForge Command is built on open-source software. This file inventories the
**direct** dependencies and their licenses. Versions reflect the committed
lockfiles (`package-lock.json`, `gui/package-lock.json`, `mcp/package-lock.json`);
re-run the commands in [§ Regenerating](#regenerating-this-inventory) to refresh.

## Production dependencies (shipped / run at runtime)

| Package | Version | License | Source |
|---------|---------|---------|--------|
| `ws` | 8.21.0 | MIT | <https://github.com/websockets/ws> |
| `node-pty` | 1.1.0 | MIT | <https://github.com/microsoft/node-pty> |
| `@modelcontextprotocol/sdk` | 1.29.0 | MIT | <https://github.com/modelcontextprotocol/typescript-sdk> |

`ws` and `node-pty` are used by the cockpit server (`gui/`); the MCP SDK is used
by the read-only MCP server (`mcp/`). All three — and their transitive
dependencies — are **permissive (MIT)**.

## Bundled fonts (self-hosted runtime assets)

Served locally from `gui/public/arena/fonts/` so the cockpit never makes a
third-party request (no Google Fonts CDN call → local-first / DSGVO, see
[`PRIVACY.md`](PRIVACY.md)). Latin subset only, variable woff2.

| Font | Subset | License | Source |
|------|--------|---------|--------|
| JetBrains Mono | latin (variable) | SIL Open Font License 1.1 | <https://github.com/JetBrains/JetBrainsMono> |
| IBM Plex Sans | latin (variable) | SIL Open Font License 1.1 | <https://github.com/IBM/plex> |

The OFL permits redistribution of the font files; both fall back to the system
font stacks in `design-tokens.css` if they fail to load.

## Development dependencies (tooling only — NOT shipped)

| Package | Version | License | Source |
|---------|---------|---------|--------|
| `@playwright/test` | 1.60.0 | Apache-2.0 | <https://github.com/microsoft/playwright> |
| `@axe-core/playwright` | 4.11.3 | MPL-2.0 | <https://github.com/dequelabs/axe-core-npm> |
| `axe-core` (via above) | 4.11.4 | MPL-2.0 | <https://github.com/dequelabs/axe-core> |
| `c8` | 10.1.3 | ISC | <https://github.com/bcoe/c8> |

These run only in CI / local testing (E2E, a11y, coverage). They are **not**
bundled into, distributed with, or required by the product at runtime.

## First-party optional component

- **`forge-pulse`** (`tools/forge-pulse/`, Rust) — part of *this* repository,
  MIT-licensed. An optional accelerator; the JS path is the authoritative
  fallback, so it is never required.

## License summary

| License | Where | Type |
|---------|-------|------|
| MIT | `ws`, `node-pty`, `@modelcontextprotocol/sdk`, this project | Permissive |
| ISC | `c8` (dev) | Permissive |
| Apache-2.0 | `@playwright/test` (dev) | Permissive |
| MPL-2.0 | `axe-core` / `@axe-core/playwright` (dev) | Weak (file-level) copyleft |

**Compliance:**

- The **distributed runtime** depends only on **MIT** packages — fully
  permissive, no copyleft.
- **No GPL, AGPL, or SSPL** anywhere in the tree.
- The only copyleft license present is **MPL-2.0** (`axe-core`), which is
  **file-level** and **dev-only** (test tooling, never shipped). MPL-2.0 does
  not impose obligations on this project's source or distribution.

## Regenerating this inventory

```bash
# Direct dependencies + versions
npm ls --omit=dev --depth=0            # production
npm ls --include=dev --depth=0         # dev tooling (root workspace)

# Full machine-readable CycloneDX SBOM (recommended as a release artifact):
npx @cyclonedx/cyclonedx-npm@latest --output-format JSON --output-file docs/sbom.json
```

> A CycloneDX `docs/sbom.json` is intended to be generated in CI and attached to
> each GitHub Release (see ROADMAP Phase 5 / Phase 6), rather than committed —
> it is large and version-specific. The table above is the human-readable
> source of truth.
