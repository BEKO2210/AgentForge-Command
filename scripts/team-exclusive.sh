#!/usr/bin/env bash
# Run a heavy/exclusive command so two agents never run conflicting ones at once
# (production build, e2e, dev server, DB migration — anything sharing a resource).
#   scripts/team-exclusive.sh <role> <lock-name> -- <command...>
# e.g.  scripts/team-exclusive.sh quality e2e -- npm run test:e2e
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

ROLE="${1:?usage: team-exclusive.sh <role> <lock-name> -- <command...>}"
NAME="${2:?lock name required}"; shift 2
if [ "${1:-}" = "--" ]; then shift; fi
[ "$#" -ge 1 ] || { echo "team-exclusive: pass a command after --"; exit 1; }

LOCK=".team/locks/${NAME}.lock"
STALE=1800

acquire_lock "$LOCK" "$ROLE" "$STALE" 600 || { echo "team-exclusive: timed out on '$NAME'"; exit 1; }
trap 'release_lock "$LOCK" "$ROLE"' EXIT INT TERM

echo "team-exclusive: running under '$NAME' lock: $*"
team_log_event "$ROLE" exclusive "start $NAME: $*"
set +e
"$@"
rc=$?
set -e
team_log_event "$ROLE" exclusive "end $NAME (rc=$rc)"
exit "$rc"
