#!/usr/bin/env bash
# Boot the cockpit in deterministic test-harness mode for recording a demo.
# No API key, no real LLM calls — every frame is honestly flagged "harness".
# Usage:  bash scripts/record-demo.sh   (then drive the browser; Ctrl-C to stop)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

echo "🚀 AgentForge Command — demo (harness mode)"
node -v >/dev/null 2>&1 || { echo "Node.js 18+ required"; exit 1; }
[ -d gui/node_modules ] || { echo "📦 installing…"; (cd gui && npm ci); }

export AGENTFORGE_HARNESS=1
export PORT="${PORT:-4173}"
echo "🎬 open http://localhost:${PORT} and drive the cockpit; Ctrl-C to stop."
exec node gui/server.js
