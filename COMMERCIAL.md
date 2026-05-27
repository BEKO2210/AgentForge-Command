# Commercial support & licensing

AgentForge Command is free under the [MIT License](LICENSE) for everyone —
personal, academic, and commercial. The maintainer offers paid services on
top of it for teams that want help going from "it works on my machine" to
"we run multi-agent workflows in production".

## What's free, forever

- Using AgentForge Command in any project, including commercial ones.
- Modifying it, forking it, embedding it.
- Asking questions on the public issue tracker.

The only thing you give up by staying purely on MIT is the maintainer's
calendar.

## Where commercial help fits

### 1. Production support pack

Best for: small teams that have adopted the cockpit and want a backstop.

- Monthly call to review your swarm setup and adapt it as your codebase grows.
- Priority response on a private channel for "we're stuck" moments.
- Stack-specific tuning of `scripts/team-check.sh`, lane globs, the gate, and
  the arena's spawn rules.
- Help wiring `team-health.sh` / `team-sync.sh` / `/api/arena` into your
  existing dashboards.

### 2. Custom integrations

Best for: organisations that need the cockpit to talk to their world.

- New specialists, sub-teams, or domain-specific extensions (e.g. data, ML,
  security agents) with role-tuned briefings.
- Custom arena widgets, MCP resources, or dashboards consuming `/api/state`
  and `/api/arena`.
- Bridges to your CI/CD, on-call, or observability tooling.
- Native Tauri desktop builds layered on the same server + arena code.

### 3. Dual-licensing for embedded use

Best for: organisations that can't accept MIT for embedded redistribution
(typical reasons: warranty / indemnification, attribution-free use, internal
compliance).

The maintainer owns the copyright and can grant a non-MIT commercial license
for specific use cases. Pricing scales with scope; please get in touch with
the details.

## How to get in touch

- For general or commercial enquiries, open an issue and add the label
  `commercial`.
- For anything sensitive (legal, security, contracts), use
  [GitHub Private Security Advisories](https://github.com/BEKO2210/AgentForge-Command/security/advisories/new).
  Advisories aren't only for vulnerabilities — they're the most reliable
  private channel this repository exposes.

## A note on expectations

This is a focused project run by one maintainer. Commercial work is taken on
selectively, and only where the maintainer can deliver real value. The honest
answer to "can you do X" is sometimes "yes", sometimes "not yet", and
sometimes "another tool fits better" — you'll get whichever is true.
