#!/usr/bin/env bash
# Show the board organized by sub-team sections.
# Convention: a "section" is introduced by a "## <name>" heading in board.md; tasks under
# that heading belong to it. Tasks without any preceding ## heading are grouped under
# "(main)". A board with no sections still works — it reports as one "(main)" section.
# Existing tools (team-sync, team-health, team-metrics) ignore sections and operate on the
# whole board, so sections are purely additive.
#   scripts/team-sections.sh                 read .team/board.md
#   TEAM_BOARD=path scripts/team-sections.sh read a different board
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

BOARD="${TEAM_BOARD:-.team/board.md}"
[ -f "$BOARD" ] || { echo "team-sections: $BOARD not found" >&2; exit 1; }

awk '
function strip(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
function key(sec) { return (sec == "") ? "(main)" : sec }

/^##[ \t]+/ {
  current = $0; sub(/^##[ \t]+/, "", current); sub(/[ \t]+$/, "", current)
  if (!(current in seen)) { sections[++nsec] = current; seen[current] = 1 }
  next
}
/^[ \t]*\|/ && $0 !~ /----/ {
  n = split($0, c, "|")
  id = strip(c[2]); state = tolower(strip(c[5])); owner = strip(c[4])
  if (id !~ /^[0-9]+$/) next
  k = key(current)
  if (!(k in seen)) { sections[++nsec] = k; seen[k] = 1 }
  counts[k "|" state]++
  totals[k]++
  o = tolower(owner)
  if (o != "" && o != "—" && o != "-") owners[k "|" o]++
}

END {
  if (nsec == 0) { print "(board has no rows yet)"; exit 0 }
  for (i = 1; i <= nsec; i++) {
    k = sections[i]
    if (!(k in totals)) continue
    printf "## %s\n", k
    printf "  total=%d  todo=%d  doing=%d  blocked=%d  done=%d\n",
      totals[k]+0, counts[k "|todo"]+0, counts[k "|doing"]+0,
      counts[k "|blocked"]+0, counts[k "|done"]+0
    printf "  owners:"
    found = 0
    for (kk in owners) {
      if (index(kk, k "|") == 1) {
        o = substr(kk, length(k) + 2)
        printf " %s(%d)", o, owners[kk]
        found++
      }
    }
    if (!found) printf " (none)"
    printf "\n\n"
  }
}
' "$BOARD"

team_log_event lead sections "report emitted"
