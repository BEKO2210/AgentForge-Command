#!/usr/bin/env bash
# Git worktrees for stronger isolation: each non-lead agent gets its own checkout on its
# own branch, so there is no shared-working-tree contention. The lead integrates by merging
# the role branches. .team/ is shared through git (commit + merge), not a shared tree.
#   scripts/team-worktrees.sh setup [roles...]     create a worktree + branch per role
#   scripts/team-worktrees.sh list                 show worktrees
#   scripts/team-worktrees.sh sync [base]          merge <base> into the CURRENT worktree
#   scripts/team-worktrees.sh teardown [roles...]  remove the per-role worktrees
# Env: TEAM_WT_PREFIX (branch prefix, default "team").
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

ROOT="$(git rev-parse --show-toplevel)"
NAME="$(basename "$ROOT")"
PARENT="$(dirname "$ROOT")"
PREFIX="${TEAM_WT_PREFIX:-team}"
DEFAULT_ROLES="backend frontend quality"

base_branch() { git -C "$ROOT" rev-parse --abbrev-ref HEAD; }

cmd="${1:-}"; shift || true
case "$cmd" in
  setup)
    base="$(base_branch)"
    roles=("$@"); [ "${#roles[@]}" -gt 0 ] || read -r -a roles <<<"$DEFAULT_ROLES"
    for role in "${roles[@]}"; do
      wt="$PARENT/$NAME-$role"; br="$PREFIX/$role"
      if git -C "$ROOT" show-ref --verify --quiet "refs/heads/$br"; then
        echo "worktrees: branch $br already exists"
      else
        git -C "$ROOT" branch "$br" "$base"
      fi
      if [ -d "$wt" ]; then
        echo "worktrees: $wt already present"
      else
        git -C "$ROOT" worktree add "$wt" "$br"
        echo "worktrees: ✅ $role → $wt ($br)"
      fi
      team_log_event lead worktrees "setup $role -> $wt"
    done
    echo "Lead stays in $ROOT ($base). Integrate role work with: git merge $PREFIX/<role>"
    ;;
  list)
    git -C "$ROOT" worktree list
    ;;
  sync)
    base="${1:-$(base_branch)}"
    git merge --no-edit "$base"
    team_log_event "$(basename "$PWD")" worktrees "sync from $base"
    ;;
  teardown)
    roles=("$@"); [ "${#roles[@]}" -gt 0 ] || read -r -a roles <<<"$DEFAULT_ROLES"
    for role in "${roles[@]}"; do
      wt="$PARENT/$NAME-$role"
      if [ -d "$wt" ]; then
        git -C "$ROOT" worktree remove --force "$wt" && echo "worktrees: removed $wt"
      fi
      team_log_event lead worktrees "teardown $role"
    done
    git -C "$ROOT" worktree prune
    ;;
  *)
    echo "usage: team-worktrees.sh {setup|list|sync|teardown} [roles...]" >&2; exit 1
    ;;
esac
