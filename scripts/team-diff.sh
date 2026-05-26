#!/usr/bin/env bash
# Diff two snapshots produced by team-snapshot.{mjs,sh}.
#   scripts/team-diff.sh <before.json> <after.json>
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v node >/dev/null 2>&1 || { echo "team-diff: needs Node.js" >&2; exit 1; }
exec node "$HERE/team-diff.mjs" "$@"
