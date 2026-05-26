#!/usr/bin/env bash
# Report agent liveness, stale tasks, and deadlock from the .team/ files.
#   scripts/team-health.sh
# Heartbeat = mtime of each .team/log/<role>.md (agents "log every step", so a fresh
# append means the agent is alive). No process list needed — works across sessions.
# Env: TEAM_ACTIVE_SECS (default 900 = 15m), TEAM_STALE_SECS (default 1800 = 30m).
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

ACTIVE="${TEAM_ACTIVE_SECS:-900}"
STALE="${TEAM_STALE_SECS:-1800}"
BOARD=".team/board.md"
now="$(date +%s)"
problems=0

human() { local s="$1"; if [ "$s" -lt 0 ]; then echo "never"; elif [ "$s" -lt 3600 ]; then echo "$((s / 60))m"; else echo "$((s / 3600))h$((s % 3600 / 60))m"; fi; }
age_of() { local f="$1"; if [ -e "$f" ]; then echo $(( now - $(_lock_mtime "$f") )); else echo -1; fi; }
norm() { printf '%s' "$1" | tr -d ' @' | tr '[:upper:]' '[:lower:]'; }

echo "Team health @ $(team_now)"
for rf in .team/roles/*.md; do
  [ -e "$rf" ] || continue
  role="$(basename "$rf" .md)"
  case "$role" in _*) continue ;; esac
  a="$(age_of ".team/log/$role.md")"
  if   [ "$a" -lt 0 ];       then st="no-log"; mark="⚠"; problems=$((problems + 1))
  elif [ "$a" -lt "$ACTIVE" ]; then st="active"; mark=""
  elif [ "$a" -lt "$STALE" ];  then st="idle";   mark=""
  else                            st="stale";  mark="⚠"; problems=$((problems + 1)); fi
  printf '  %-10s %-7s (last log %s ago) %s\n' "$role" "$st" "$(human "$a")" "$mark"
done

echo "Stale tasks (doing, owner silent > $(human "$STALE")):"
found=0
while IFS=$'\t' read -r id owner; do
  [ -n "$id" ] || continue
  o="$(norm "$owner")"
  case "$o" in "" | "—" | "-") continue ;; esac
  a="$(age_of ".team/log/$o.md")"
  if [ "$a" -ge "$STALE" ] || [ "$a" -lt 0 ]; then
    printf '  #%-3s owner=%-10s silent %s ⚠\n' "$id" "$o" "$(human "$a")"
    found=$((found + 1)); problems=$((problems + 1))
  fi
done < <(awk -F'|' '
  /^[ \t]*\|/ && $0 !~ /----/ {
    id=$2; ow=$4; st=tolower($5)
    gsub(/^[ \t]+|[ \t]+$/, "", id); gsub(/^[ \t]+|[ \t]+$/, "", ow); gsub(/^[ \t]+|[ \t]+$/, "", st)
    if (st == "doing" && id ~ /^[0-9]+$/) print id "\t" ow
  }' "$BOARD" 2>/dev/null)
[ "$found" -eq 0 ] && echo "  none"

# Deadlock: blocked work remains, but nothing is in progress and nothing is pick-up-able.
read -r todo doing blocked dn <<<"$(awk -F'|' '
  /^[ \t]*\|/ && $0 !~ /----/ {
    s=tolower($5); gsub(/^[ \t]+|[ \t]+$/, "", s)
    if (s == "todo") t++; else if (s == "doing") d++; else if (s == "blocked") b++; else if (s == "done") n++
  } END { print t+0, d+0, b+0, n+0 }' "$BOARD" 2>/dev/null)"
if [ "${blocked:-0}" -gt 0 ] && [ "${doing:-0}" -eq 0 ] && [ "${todo:-0}" -eq 0 ]; then
  echo "Deadlock: ⚠ all remaining work is blocked ($blocked blocked, 0 doing, 0 todo)"
  team_log_event lead health "deadlock: $blocked blocked / 0 doing / 0 todo"
  problems=$((problems + 1))
else
  echo "Deadlock: none"
fi
: "${dn:=0}"   # 'done' count is parsed for completeness; not reported separately

[ "$problems" -gt 0 ] && team_log_event lead health "report: $problems issue(s)"
exit 0
