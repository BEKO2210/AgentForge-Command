#!/usr/bin/env bash
# Throughput metrics from the logs + board progress. Writes .team/metrics.md.
#   scripts/team-metrics.sh
# Counts CLAIM/DONE/BLOCKED per role (durations are omitted: logs carry HH:MM only,
# which is not reliable across day boundaries).
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

BOARD=".team/board.md"
OUT=".team/metrics.md"

read -r total dn <<<"$(awk -F'|' '
  /^[ \t]*\|/ && $0 !~ /----/ {
    id=$2; s=tolower($5); gsub(/^[ \t]+|[ \t]+$/, "", id); gsub(/^[ \t]+|[ \t]+$/, "", s)
    if (id ~ /^[0-9]+$/) { t++; if (s == "done") d++ }
  } END { print t+0, d+0 }' "$BOARD" 2>/dev/null)"

metrics="$(awk -F'|' '
  FILENAME ~ /\/log\// {
    role=FILENAME; sub(/.*\/log\//, "", role); sub(/\.md$/, "", role)
    line=$0
    while (match(line, /(CLAIM|DONE|BLOCKED) #[0-9]+/)) {
      tok=substr(line, RSTART, RLENGTH); line=substr(line, RSTART + RLENGTH)
      verb=tok; sub(/ .*/, "", verb)
      c[role "|" verb]++; roles[role]=1
    }
  }
  END { for (r in roles) printf "%s\t%d\t%d\t%d\n", r, c[r "|CLAIM"]+0, c[r "|DONE"]+0, c[r "|BLOCKED"]+0 }
' .team/log/*.md 2>/dev/null | sort)"

{
  echo "# Team metrics — generated $(team_now)"
  echo
  echo "Board progress: ${dn:-0}/${total:-0} done"
  echo
  echo "| Role | Claimed | Done | Blocked |"
  echo "|------|---------|------|---------|"
  if [ -n "$metrics" ]; then
    while IFS=$'\t' read -r r cl dn bl; do
      [ -n "$r" ] && printf '| %s | %s | %s | %s |\n' "$r" "$cl" "$dn" "$bl"
    done <<<"$metrics"
  fi
} > "$OUT"

cat "$OUT"
team_log_event lead metrics "progress ${dn:-0}/${total:-0}"
