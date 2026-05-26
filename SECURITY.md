# Security policy

Thank you for taking the time to report security issues responsibly.

## Reporting a vulnerability

Please use **GitHub Private Security Advisories** to report any vulnerability:

> <https://github.com/BEKO2210/4-Agent-Team-Kit-for-Claude-Code/security/advisories/new>

That channel keeps the report confidential between you and the maintainer until a fix
is ready. Public issues are not the right place — please don't open a public issue for
suspected security problems.

When you report, please include:

- A short description of the issue and its impact.
- The affected component (`scripts/`, `gui/`, `mcp/`, …) and version (commit SHA or tag).
- Steps to reproduce, ideally with a minimal example.
- Any relevant logs (please redact secrets).

You should expect an acknowledgement within a few working days. Concrete fix timelines
depend on severity and complexity; the maintainer will keep you in the loop.

## What's in scope

This kit is a coordination scaffold that runs on a developer's own machine and reads /
writes files only inside the user's own repository. Issues that are in scope include:

- Path-traversal or arbitrary-file-write bugs in any helper script (`scripts/team-*.sh`).
- Lock-bypass / TOCTOU bugs in `scripts/lib/lock.sh` that could let two agents acquire
  the same lock.
- Injection bugs in `gui/server.js` or `mcp/server.js` (e.g. command injection from
  `.team/` content, missing `.team/` content sanitisation when rendered in the UI).
- Unsafe handling of git operations in `scripts/team-commit.sh` (e.g. staging files
  outside the explicitly passed paths).
- Unauthenticated network exposure of the optional GUI beyond `127.0.0.1`.

## What's out of scope

- The optional GUI is bound to `127.0.0.1` by design. Exposing it publicly is on the
  operator; we won't treat that as a vulnerability of the kit itself.
- Behaviour that requires write access to `.team/` from a malicious local user already
  inside your repo — that's a trust-boundary issue, not a vulnerability of the kit.
- Issues that depend on third-party dependencies (`node-pty`, `ws`,
  `@modelcontextprotocol/sdk`) — please report those upstream first; we'll pick up
  fixes once they ship.

## Supported versions

This is a pre-1.0 project. We support the latest tagged release; older tags receive
security fixes only at the maintainer's discretion.
