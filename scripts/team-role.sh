#!/usr/bin/env bash
# Add / list / remove team roles at runtime.
#   scripts/team-role.sh add <name> [<glob>...]   create roles/<name>.md + log/<name>.md
#   scripts/team-role.sh list                     list current (non-template) roles
#   scripts/team-role.sh remove <name>            delete role files (refuses core roles)
# Core roles (lead/backend/frontend/quality) are protected from removal.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

ROLES=".team/roles"; LOGS=".team/log"

upper() { printf '%s' "$1" | tr '[:lower:]' '[:upper:]'; }

cmd="${1:-}"; shift || true
case "$cmd" in
  add)
    name="${1:?usage: team-role.sh add <name> [<glob>...]}"; shift || true
    [[ "$name" =~ ^[a-z][a-z0-9_-]*$ ]] || { echo "team-role: name must match [a-z][a-z0-9_-]*" >&2; exit 1; }
    case "$name" in _*) echo "team-role: leading _ is reserved (templates)" >&2; exit 1 ;; esac
    rf="$ROLES/$name.md"; lf="$LOGS/$name.md"
    [ -e "$rf" ] && { echo "team-role: $rf already exists" >&2; exit 1; }
    globs=("$@")
    mkdir -p "$ROLES" "$LOGS"
    NAME="$(upper "$name")"
    {
      echo "# Role: $NAME — <one-line mission>"
      echo ""
      echo "**Mission:** <add a one-line mission>"
      echo ""
      echo "## You own"
      if [ "${#globs[@]}" -gt 0 ]; then
        for g in "${globs[@]}"; do echo "- \`$g\`"; done
      else
        echo "- <paths you own — set globs here>"
      fi
      echo ""
      echo "## You do NOT"
      echo "- <out-of-lane areas — hand them off via \`@role\` in your log>"
      echo ""
      echo "## Definition of done"
      echo "- <how you prove an item is done; tests, gate green, etc.>"
      echo ""
      echo "## On \`state\`"
      echo "Re-read board + logs → take your next unblocked row → implement → test →"
      echo "\`scripts/team-commit.sh $name \"…\" <paths>\` → log \`DONE #id — <proof>\`."
    } > "$rf"
    printf '# Log — %s (append only, newest at bottom)\n' "$name" > "$lf"
    echo "team-role: ✅ created $rf and $lf"
    cat <<EOM

----- start prompt for the $name agent (copy-paste) -----
You are the $NAME agent in a multi-agent team that shares this repo and coordinates ONLY
through the .team/ folder. Read .team/PROTOCOL.md and .team/roles/$name.md, then follow
them strictly. Work the board (.team/board.md): take your unblocked items, implement
them in your owned paths only, run scripts/team-check.sh, commit via
scripts/team-commit.sh $name "..." <paths>, and log every step in .team/log/$name.md.
On any nudge ("state"), continue autonomously — pick up the next item, don't just report.
----- end -----
EOM
    team_log_event lead role-add "added $name"
    ;;
  list)
    for f in "$ROLES"/*.md; do
      [ -e "$f" ] || continue
      n="$(basename "$f" .md)"; case "$n" in _*) continue ;; esac
      echo "$n"
    done
    ;;
  remove)
    name="${1:?usage: team-role.sh remove <name>}"
    case "$name" in
      lead|backend|frontend|quality) echo "team-role: cannot remove core role $name" >&2; exit 1 ;;
    esac
    rf="$ROLES/$name.md"; lf="$LOGS/$name.md"
    [ -e "$rf" ] || { echo "team-role: $name not found" >&2; exit 1; }
    rm -f "$rf" "$lf"
    team_log_event lead role-remove "removed $name"
    echo "team-role: ✅ removed $name"
    ;;
  *)
    echo "usage: team-role.sh {add|list|remove} ..." >&2; exit 1
    ;;
esac
