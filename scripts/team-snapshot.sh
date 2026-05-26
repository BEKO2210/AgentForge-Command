#!/usr/bin/env bash
# Capture the full team state as one self-contained JSON document.
#   scripts/team-snapshot.sh           print snapshot to stdout
#   scripts/team-snapshot.sh --save    also write to .team/snapshots/<ts>.json
# Thin wrapper around scripts/team-snapshot.mjs (requires Node.js).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v node >/dev/null 2>&1 || { echo "team-snapshot: needs Node.js (used for safe JSON output)" >&2; exit 1; }
exec node "$HERE/team-snapshot.mjs" "$@"
