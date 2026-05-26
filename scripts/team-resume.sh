#!/usr/bin/env bash
# Reconstruct team state after a crash/restart so the LEAD can resync the board.
#   scripts/team-resume.sh
# Reads the append-only logs (the authority) + git history and prints a briefing.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

now="$(date +%s)"
human() { local s="$1"; if [ "$s" -lt 0 ]; then echo never; elif [ "$s" -lt 3600 ]; then echo "$((s / 60))m"; else echo "$((s / 3600))h$((s % 3600 / 60))m"; fi; }
age_of() { local f="$1"; if [ -e "$f" ]; then echo $(( now - $(_lock_mtime "$f") )); else echo -1; fi; }

echo "Resume briefing @ $(team_now)"
echo
echo "Per-agent last activity:"
for rf in .team/roles/*.md; do
  [ -e "$rf" ] || continue
  role="$(basename "$rf" .md)"; case "$role" in _*) continue ;; esac
  lf=".team/log/$role.md"
  last="$(tail -n1 "$lf" 2>/dev/null)"
  printf '  %-10s (%s ago)  %s\n' "$role" "$(human "$(age_of "$lf")")" "${last:-—}"
done

echo
echo "Task state folded from logs (authority):"
awk -F'|' '
  FILENAME ~ /\/log\// {
    role = FILENAME; sub(/.*\/log\//, "", role); sub(/\.md$/, "", role)
    line = $0
    while (match(line, /(CLAIM|DONE|BLOCKED) #[0-9]+/)) {
      tok = substr(line, RSTART, RLENGTH); line = substr(line, RSTART + RLENGTH)
      verb = tok; sub(/ .*/, "", verb); id = tok; sub(/.*#/, "", id)
      p = (verb == "DONE") ? 3 : (verb == "BLOCKED") ? 2 : 1
      if (p >= rank[id]) { rank[id] = p; state[id] = (verb == "DONE") ? "done" : (verb == "BLOCKED") ? "blocked" : "doing" }
      if (verb == "CLAIM") owner[id] = role
      seen[id] = 1
    }
  }
  END {
    open = 0; done = 0
    print "  open:"
    for (id in seen) if (state[id] != "done") { print "    #" id "  " state[id] "  (owner=" owner[id] ")"; open++ }
    if (open == 0) print "    (none)"
    print "  completed:"
    for (id in seen) if (state[id] == "done") { print "    #" id "  done  (owner=" owner[id] ")"; done++ }
    if (done == 0) print "    (none)"
  }
' .team/log/*.md 2>/dev/null

echo
echo "Recent commits:"
git log --oneline -n 10 2>/dev/null | sed 's/^/  /' || echo "  (no git history)"

echo
echo "Next: LEAD reconciles board.md from the above, then run scripts/team-sync.sh to verify."
