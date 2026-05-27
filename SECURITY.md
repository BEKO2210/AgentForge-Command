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
