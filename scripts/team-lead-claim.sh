#!/usr/bin/env bash
# Record the acting LEAD (supports the fallback-lead protocol: if the lead goes stale,
# the designated stand-in claims the role so exactly one agent integrates + pushes).
#   scripts/team-lead-claim.sh <role> [--force]
# Writes .team/state/lead = "<role> <pid> <iso>". Refuses if a *different* role claimed
# it within TEAM_LEAD_TTL seconds (default 1800) unless --force.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

ROLE="${1:?usage: team-lead-claim.sh <role> [--force]}"
FORCE=0; [ "${2:-}" = "--force" ] && FORCE=1
TTL="${TEAM_LEAD_TTL:-1800}"
STATE=".team/state"; FILE="$STATE/lead"
mkdir -p "$STATE"
now="$(date +%s)"

if [ -f "$FILE" ] && [ "$FORCE" -ne 1 ]; then
  cur_role="$(awk '{print $1; exit}' "$FILE" 2>/dev/null)"
  ts="$(_lock_mtime "$FILE")"
  age=$(( now - ts ))
  if [ -n "$cur_role" ] && [ "$cur_role" != "$ROLE" ] && [ "$age" -lt "$TTL" ]; then
    echo "team-lead-claim: '$cur_role' holds lead (age ${age}s < ${TTL}s). Use --force to override." >&2
    exit 1
  fi
fi

printf '%s %s %s\n' "$ROLE" "$BASHPID" "$(team_now)" > "$FILE"
team_log_event "$ROLE" lead-claim "acting lead"
echo "team-lead-claim: ✅ $ROLE is now the acting lead"
