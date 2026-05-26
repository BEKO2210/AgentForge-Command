#!/usr/bin/env bash
# Snapshot / restore the coordination state (board, protocol, roles, logs, memory).
# Guards against the "git is the only copy" single point of failure.
#   scripts/team-backup.sh                 create .team/backups/<ts>.tgz
#   scripts/team-backup.sh restore [file]  restore latest (or given) snapshot
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

DIR=".team/backups"; mkdir -p "$DIR"
cmd="${1:-create}"

case "$cmd" in
  create)
    ts="$(date '+%Y%m%d-%H%M%S')"
    out="$DIR/$ts.tgz"
    targets=()
    for p in .team/board.md .team/PROTOCOL.md .team/memory.md .team/roles .team/log; do
      [ -e "$p" ] && targets+=("$p")
    done
    tar czf "$out" --exclude='.team/locks' --exclude='.team/backups' "${targets[@]}"
    team_log_event lead backup "create $out"
    echo "team-backup: ✅ $out"
    ;;
  restore)
    file="${2:-}"
    if [ -z "$file" ]; then
      # newest snapshot — globs sort lexicographically; timestamps are ISO-like so newest = last
      shopt -s nullglob
      tgzs=("$DIR"/*.tgz)
      shopt -u nullglob
      [ "${#tgzs[@]}" -gt 0 ] && file="${tgzs[-1]}"
    fi
    if [ -z "$file" ] || [ ! -f "$file" ]; then
      echo "team-backup: no snapshot to restore" >&2; exit 1
    fi
    tar xzf "$file"
    team_log_event lead backup "restore $file"
    echo "team-backup: ✅ restored $file"
    ;;
  *)
    echo "usage: team-backup.sh [create|restore [file]]" >&2; exit 1
    ;;
esac
