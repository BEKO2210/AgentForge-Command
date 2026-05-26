#!/usr/bin/env bash
# Validate structured HANDOFF lines in agent logs (see .team/PROTOCOL.md § Handoffs).
#   scripts/team-lint-log.sh [<logfile>...]     (defaults to .team/log/*.md)
# A handoff line must name a target role (→ @role) and a task id (#id), e.g.:
#   12:00 · backend · 🤝 HANDOFF → @frontend · #2 · needs:auth-API · wire the login form
# Exit 0 if all handoffs are well-formed; exit 1 (and print offenders) otherwise.
set -uo pipefail

files=("$@")
if [ "${#files[@]}" -eq 0 ]; then
  files=(.team/log/*.md)
fi

rc=0
for f in "${files[@]}"; do
  [ -f "$f" ] || continue
  ln=0
  while IFS= read -r line || [ -n "$line" ]; do
    ln=$((ln + 1))
    case "$line" in
      *HANDOFF*) ;;
      *) continue ;;
    esac
    ok=1
    printf '%s' "$line" | grep -qE '→[[:space:]]*@[a-z][a-z0-9_-]*' || ok=0
    printf '%s' "$line" | grep -qE '#[0-9]+' || ok=0
    if [ "$ok" -ne 1 ]; then
      echo "$f:$ln: malformed HANDOFF (need '→ @role' and '#id'): $line"
      rc=1
    fi
  done < "$f"
done

if [ "$rc" -eq 0 ]; then
  echo "team-lint-log: handoffs OK"
fi
exit "$rc"
