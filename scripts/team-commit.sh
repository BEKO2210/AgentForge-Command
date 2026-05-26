#!/usr/bin/env bash
# Serialize commits across agents sharing one working tree.
#   scripts/team-commit.sh [--dry-run] <role> "<message>" <path> [<path>...]
# Takes the commit lock, runs the green gate, stages ONLY the given paths,
# commits as "[role] message", releases the lock (even on failure). Never `git add -A`.
# --dry-run (or TEAM_DRY_RUN=1): run the gate + show what WOULD be committed, but don't.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

DRY_RUN="${TEAM_DRY_RUN:-0}"
if [ "${1:-}" = "--dry-run" ]; then DRY_RUN=1; shift; fi

ROLE="${1:?usage: team-commit.sh [--dry-run] <role> <message> <path...>}"; shift
MSG="${1:?commit message required}"; shift
[ "$#" -ge 1 ] || { echo "team-commit: pass at least one path (never -A)"; exit 1; }

LOCK=".team/locks/git.lock"
STALE=600

acquire_lock "$LOCK" "$ROLE" "$STALE" || { echo "team-commit: timed out waiting for git.lock"; exit 1; }
trap 'release_lock "$LOCK" "$ROLE"' EXIT INT TERM

if [ -x "$HERE/team-check.sh" ]; then
  echo "team-commit: running green gate…"
  "$HERE/team-check.sh"
fi

git add -- "$@"
if git diff --cached --quiet; then
  echo "team-commit: nothing staged in those paths — skipping."
  exit 0
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "team-commit: [dry-run] would commit as [$ROLE] $MSG"
  git diff --cached --stat
  git reset -q HEAD -- "$@"
  team_log_event "$ROLE" commit "dry-run: $MSG"
  exit 0
fi

git commit -m "[$ROLE] $MSG"
team_log_event "$ROLE" commit "committed: $MSG"
echo "team-commit: ✅ committed [$ROLE] $MSG"
