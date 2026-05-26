#!/usr/bin/env bash
# Aggregate .team/board.md state across multiple repos for a "meta-lead" view.
# Each argument is a repo root that contains a .team/board.md.
#   scripts/team-federate.sh <repo-path>...
# No new infrastructure: each repo continues to coordinate independently; this just
# folds the per-repo counts into one summary table.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

[ "$#" -ge 1 ] || { echo "usage: team-federate.sh <repo-path>..." >&2; exit 1; }

gt=0; gdn=0; gdg=0; gb=0; gtd=0
printf '%-44s %-7s %-7s %-7s %-9s %-7s\n' "REPO" "TOTAL" "DONE" "DOING" "BLOCKED" "TODO"
for repo in "$@"; do
  board="$repo/.team/board.md"
  if [ ! -f "$board" ]; then
    printf '%-44s %s\n' "$repo" "(no .team/board.md)"
    continue
  fi
  read -r total dn dg bl td <<<"$(awk -F'|' '
    /^[ \t]*\|/ && $0 !~ /----/ {
      id=$2; s=tolower($5); gsub(/^[ \t]+|[ \t]+$/, "", id); gsub(/^[ \t]+|[ \t]+$/, "", s)
      if (id ~ /^[0-9]+$/) {
        t++
        if (s == "done")    d++
        else if (s == "doing")   dg++
        else if (s == "blocked") b++
        else if (s == "todo")    td++
      }
    } END { print t+0, d+0, dg+0, b+0, td+0 }' "$board")"
  printf '%-44s total=%-2d done=%-2d doing=%-2d blocked=%-2d todo=%-2d\n' \
    "$repo" "${total:-0}" "${dn:-0}" "${dg:-0}" "${bl:-0}" "${td:-0}"
  gt=$((gt + ${total:-0})); gdn=$((gdn + ${dn:-0})); gdg=$((gdg + ${dg:-0}))
  gb=$((gb + ${bl:-0})); gtd=$((gtd + ${td:-0}))
done
printf '%-44s total=%-2d done=%-2d doing=%-2d blocked=%-2d todo=%-2d\n' \
  "TOTAL" "$gt" "$gdn" "$gdg" "$gb" "$gtd"
team_log_event lead federate "$# repos, total=$gt done=$gdn"
