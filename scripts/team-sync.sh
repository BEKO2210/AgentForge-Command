#!/usr/bin/env bash
# Board <-> log drift report.
# Design: the append-only logs are the AUTHORITY (an event stream of CLAIM/DONE/BLOCKED);
# the board is a human-maintained PROJECTION of them. This script folds the logs into the
# state each task SHOULD have and reports where board.md disagrees — so the LEAD can
# reconcile. It deliberately does NOT edit the board (the board has exactly one writer).
#   scripts/team-sync.sh [--strict]
# --strict: exit 1 when any drift is found (useful inside a gate).
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

STRICT=0
[ "${1:-}" = "--strict" ] && STRICT=1
BOARD=".team/board.md"

report="$(awk -F'|' '
  function strip(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  FILENAME ~ /\/log\// {
    role = FILENAME; sub(/.*\/log\//, "", role); sub(/\.md$/, "", role)
    line = $0
    while (match(line, /(CLAIM|DONE|BLOCKED) #[0-9]+/)) {
      tok = substr(line, RSTART, RLENGTH); line = substr(line, RSTART + RLENGTH)
      verb = tok; sub(/ .*/, "", verb)
      id = tok; sub(/.*#/, "", id)
      p = (verb == "DONE") ? 3 : (verb == "BLOCKED") ? 2 : 1
      if (p >= rank[id]) { rank[id] = p; state[id] = (verb == "DONE") ? "done" : (verb == "BLOCKED") ? "blocked" : "doing" }
      if (verb == "CLAIM") owner[id] = role
      seen[id] = 1
    }
    next
  }
  FILENAME ~ /board\.md$/ && /^[ \t]*\|/ && $0 !~ /----/ {
    id = strip($2); st = tolower(strip($5))
    if (id ~ /^[0-9]+$/) bstatus[id] = st
  }
  END {
    for (id in seen) {
      if (!(id in bstatus)) { print "#" id " DRIFT: logs=" state[id] " but not on board (owner=" owner[id] ")"; d++; continue }
      if (bstatus[id] != state[id]) { print "#" id " DRIFT: board=" bstatus[id] " logs=" state[id] " (owner=" owner[id] ")"; d++ }
    }
    for (id in bstatus) {
      if ((bstatus[id] == "doing" || bstatus[id] == "blocked") && !(id in seen)) { print "#" id " DRIFT: board=" bstatus[id] " but no log evidence"; d++ }
    }
    print "::COUNT::" d + 0
  }
' .team/log/*.md "$BOARD" 2>/dev/null | sort -V)"

drift="$(printf '%s\n' "$report" | sed -n 's/^::COUNT:://p' | tail -n1)"
printf '%s\n' "$report" | grep -v '^::COUNT::' || true

if [ -z "${drift:-}" ] || [ "${drift:-0}" = "0" ]; then
  echo "team-sync: ✅ board matches logs"
  team_log_event lead sync "ok"
  exit 0
fi
echo "team-sync: ⚠ $drift drift item(s) — LEAD should reconcile board.md"
team_log_event lead sync "$drift drift item(s)"
[ "$STRICT" -eq 1 ] && exit 1
exit 0
