# Installation Guide

## Quick Start

```bash
git clone https://github.com/BEKO2210/AgentForge-Command
cd AgentForge-Command
npm install
npm start
```

Opens <http://localhost:4173>. The server prints a **session token** at
startup and injects it into the page automatically — open the printed link in
the same browser and you're in. The cockpit boots even with **no API key**, **no
Claude CLI**, and **no Rust**; it tells you honestly which capabilities are
available.

> `npm install` / `npm start` work from the repository root thanks to the npm
> workspace setup — no `cd gui` needed.

## Prerequisites

AgentForge uses [`node-pty`](https://github.com/microsoft/node-pty), a native
module, so a C/C++ toolchain + Python 3 are needed to build it from source
(prebuilt binaries cover most platforms, but not all).

### Linux

```bash
sudo apt-get install build-essential python3
```

### macOS

```bash
xcode-select --install
```

### Windows

Install Python 3 and the **Microsoft Visual C++ Build Tools** (or use the
Docker path below to skip the local toolchain entirely).

## Troubleshooting: node-pty build fails

If `npm install` fails with something like *"node-pty could not build"*:

1. Confirm Python 3 is installed and on PATH: `python3 --version`.
2. On macOS, run `xcode-select --install` even if Xcode is already installed.
3. Force a fresh resolution / prebuilt fetch for your Node version:
   ```bash
   npm install --force
   ```
4. Last resort: use Docker (below) — no local build required.

## Docker (no local build required)

```bash
docker compose up --build
# or:
docker build -t agentforge-command:latest .
docker run -p 4173:4173 agentforge-command:latest
```

The image bundles the build tools and starts in **Harness Mode** by default
(`AGENTFORGE_HARNESS=1`) so you can try the cockpit without an
`ANTHROPIC_API_KEY`. The port is mapped to your host's `localhost:4173`.

> The cockpit binds to `127.0.0.1` inside the container; the Compose file maps
> it to your host loopback only. To drive real Claude sessions instead of the
> harness, pass your own env (`-e ANTHROPIC_API_KEY=…`) and unset
> `AGENTFORGE_HARNESS`.

## Advanced configuration (environment variables)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4173` | HTTP/WS port (bound to `127.0.0.1`). |
| `ANTHROPIC_API_KEY` | — | Enables the live Atlas LLM bridge. Server-only. |
| `AGENTFORGE_LLM_MODEL` | `claude-sonnet-4-6` | Model for the LLM bridge. |
| `AGENTFORGE_MAX_PTYS` | `8` | Max concurrent PTYs (guardrail). |
| `AGENTFORGE_IDLE_TIMEOUT_MS` | `300000` | Idle time before an exited PTY is reaped. |
| `AGENTFORGE_BUDGET_USD` | `0` (off) | Soft spend cap; briefs refused once exceeded. |
| `AGENTFORGE_SPEND_FILE` | — | JSONL append-log to persist the spend ledger across restarts. |
| `AGENTFORGE_LOG_LEVEL` | `info` | `debug \| info \| warn \| error`. |
| `AGENTFORGE_QUIET` / `--quiet` | off | Drop everything below `error`. |
| `AGENTFORGE_ALLOWED_ORIGINS` | — | Comma-separated extra trusted origins (e.g. a tunnel). |
| `AGENTFORGE_NO_TOKEN` | off | Disable the session token (trusted single-user box only). |

See [`SECURITY.md`](../SECURITY.md) and [`docs/THREAT_MODEL.md`](THREAT_MODEL.md)
for the security model behind the last two.
