# Security policy

Thank you for taking the time to report security issues responsibly.

## Reporting a vulnerability

Please use **GitHub Private Security Advisories** to report any vulnerability:

> <https://github.com/BEKO2210/AgentForge-Command/security/advisories/new>

That channel keeps the report confidential between you and the maintainer
until a fix is ready. Public issues are not the right place — please don't
open a public issue for suspected security problems.

When you report, please include:

- A short description of the issue and its impact.
- The affected component (`gui/`, `tools/forge-pulse/`, `mcp/`, `scripts/`, …)
  and version (commit SHA or tag).
- Steps to reproduce, ideally with a minimal example.
- Any relevant logs (please redact secrets — especially any
  `ANTHROPIC_API_KEY`).

You should expect an acknowledgement within a few working days. Concrete fix
timelines depend on severity and complexity; the maintainer will keep you in
the loop.

## What's in scope

AgentForge Command is a local cockpit that drives Claude Code sessions
running in the operator's own repository. Issues that are in scope:

- Path-traversal or arbitrary-file-write bugs in the Node server
  (`gui/server.js`), any helper script (`scripts/team-*.sh`) or
  `tools/forge-pulse/`.
- Authentication bypass or trust-boundary breaks in the arena WebSocket
  protocol (`/arena`) — e.g. a client persisting state for a different
  operator, escaping the `customAgents` allowlist, or running arbitrary
  commands via `start-pty`.
- **Auto-enter watchdog** firing on prompts outside the conservative
  whitelist, in particular anything that could cause unintended `\r` writes
  into a PTY mid-prompt where the operator did not consent.
- Lock-bypass / TOCTOU bugs in `scripts/lib/lock.sh` that could let two
  agents acquire the same lock.
- Injection or unsafe rendering in `gui/server.js` or `mcp/server.js`
  (e.g. unescaped `.team/` content, command injection from config files).
- Unsafe handling of git operations in `scripts/team-commit.sh` (e.g.
  staging files outside the explicitly passed paths).
- The optional LLM bridge (`gui/llm.js`) leaking the `ANTHROPIC_API_KEY` to
  clients, logs, or repository state.
- Unauthenticated network exposure of the GUI beyond `127.0.0.1`.

## Mitigations in place (as of Phase 1)

The browser↔server trust boundary is enforced by four layers (details and
threat analysis in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md)):

- **Origin allowlist + Host-header validation** on every WebSocket upgrade and
  on all state-changing HTTP routes (`/api/hooks`). Only `localhost:PORT` /
  `127.0.0.1:PORT` are trusted by default; the Host check defeats
  DNS-rebinding. This closes the Cross-Site WebSocket Hijacking (CSWSH) /
  drive-by-RCE path.
- **Per-session capability token.** A `crypto.randomBytes(32)` token is minted
  at startup, printed to the server console, and injected into `arena.html` via
  a `<meta name="afc-token">` tag (readable only same-origin). The WS upgrade
  and `/api/hooks` reject any request without it; the token is compared in
  constant time. Hook scripts receive it through `AGENTFORGE_HOOK_URL`.
- **Security headers on all served files:** `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a restrictive
  `Content-Security-Policy` (`default-src 'self'`, `script-src 'self'` — no
  inline JS, Google Fonts origins allowlisted, `frame-ancestors 'none'`).
- **WebSocket message hardening:** 256 KB per-message size cap and a
  per-connection token-bucket rate limit (~10 msg/s), plus a length cap on
  `input` payloads written into a PTY.
- **Path-traversal hardening:** request paths are `decodeURIComponent`-d,
  `path.normalize`-d, and re-checked for containment under the public root
  (guards `%2e`/`%2f` and sibling-prefix tricks).

### Deliberate loosenings (opt-in, documented)

- `AGENTFORGE_ALLOWED_ORIGINS` (comma-separated) extends the origin/host
  allowlist — e.g. for a trusted remote tunnel. Empty by default (localhost
  only). Enabling it is a conscious widening of the trust boundary.
- `AGENTFORGE_NO_TOKEN=1` disables the session token for a knowingly-trusted
  single-user machine. The server prints a loud warning at boot. The
  origin/host checks remain active even in this mode.

A dedicated regression suite (`tests/security-suite.mjs`, part of the green
gate) proves these mitigations: foreign-origin and tokenless WS upgrades are
refused, `/api/hooks` rejects requests without the token, Host mismatches and
path traversal are blocked, and the security headers are asserted on every
response.

## What's out of scope

- The cockpit is bound to `127.0.0.1` by design. Exposing it publicly is on
  the operator; we won't treat that as a vulnerability of the project
  itself.
- Behaviour that requires write access to `.team/` from a malicious local
  user already inside your repo — that's a trust-boundary issue, not a
  vulnerability of AgentForge.
- Issues that depend on third-party dependencies (`node-pty`, `ws`,
  `@modelcontextprotocol/sdk`) — please report those upstream first; we'll
  pick up fixes once they ship.
- Costs incurred by your own use of the LLM bridge. Set
  `AGENTFORGE_LLM_MODEL` and budget guardrails on the Anthropic side.

## Supported versions

This is a pre-1.0 project. We support the latest tagged release; older tags
receive security fixes only at the maintainer's discretion.
