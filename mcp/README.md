# team-mcp — read-only MCP server for the .team/ state

Exposes the kit's coordination state (board, logs, memory, health, metrics) as
[Model Context Protocol](https://modelcontextprotocol.io) resources, so any MCP-aware
client (Claude Desktop, IDE plugins, agents) can read the team's state without writing
to the repo.

This sub-package is opt-in. The core kit has zero runtime dependencies; the MCP server
ships its own `package.json` and is only used when you explicitly enable it.

## Install

```bash
cd mcp
npm install
```

## Run

```bash
# defaults: REPO_DIR=current working directory
node mcp/server.js

# or point it at any repo that contains a .team/ folder
REPO_DIR=/path/to/your/repo node mcp/server.js
```

The server speaks MCP over stdio. Wire it into an MCP client config — for example,
Claude Desktop's `~/Library/Application Support/Claude/claude_desktop_config.json`:

```jsonc
{
  "mcpServers": {
    "team": {
      "command": "node",
      "args": ["/absolute/path/to/repo/mcp/server.js"],
      "env": { "REPO_DIR": "/absolute/path/to/repo" }
    }
  }
}
```

## Resources

| URI | Description | MIME |
|-----|-------------|------|
| `team://state`    | Folded board + per-agent health, JSON (mirrors GUI `/state`) | `application/json` |
| `team://board`    | `.team/board.md` raw markdown                                | `text/markdown` |
| `team://memory`   | `.team/memory.md` — decisions across runs                    | `text/markdown` |
| `team://protocol` | `.team/PROTOCOL.md` — the rules                              | `text/markdown` |
| `team://health`   | Live output of `scripts/team-health.sh`                       | `text/plain` |
| `team://metrics`  | `.team/metrics.md` (refresh with the tool below)              | `text/markdown` |
| `team://log/<role>` | Per-agent append-only log                                   | `text/markdown` |

## Tools

- `team_state` — returns the same JSON as `team://state`.
- `refresh_metrics` — runs `scripts/team-metrics.sh` and returns its output.

Both tools are **read-only** with respect to coordination semantics (`refresh_metrics`
regenerates a gitignored artifact; it does not mutate the board or logs).

## Test

```bash
cd mcp
node test.js
```

The smoke test spawns the server, drives the MCP stdio handshake, and asserts on the
expected resources and tools. It currently runs 12 checks.
