#!/usr/bin/env bash
# Shared helpers for the team coordination scripts. SOURCE this file; do not run it.
#
# Provides:
#   team_now                              ISO-8601 local timestamp
#   team_log_event <role> <src> <text…>   append one line to .team/log/events.log
#   acquire_lock <lockdir> <role> <stale> [<tries>] [<wait>]   -> 0 ok / 1 timeout
#   release_lock <lockdir> [<role>]       remove the lock ONLY if we still own it
#
# Locking primitive: an atomic `mkdir` lock DIRECTORY. mkdir(2) is a kernel-atomic
# check-and-create, so exactly one of N racing callers wins — portable across Linux
# and macOS on a single shared working tree. The owner PID is written to <lock>/pid.
# Stale locks are detected by PID liveness (kill -0) with an age backstop, and broken
# ATOMICALLY via rename(2) so two waiters can never both break-and-acquire the same lock.

TEAM_EVENTS_LOG="${TEAM_EVENTS_LOG:-.team/log/events.log}"

team_now() { date '+%Y-%m-%dT%H:%M:%S'; }

team_log_event() {
  local role="$1" src="$2"; shift 2 || true
  # best-effort: never abort the caller just because logging failed
  printf '%s · %s · %s · %s\n' "$(team_now)" "$role" "$src" "$*" \
    >> "$TEAM_EVENTS_LOG" 2>/dev/null || true
}

_lock_pid()   { cat "$1/pid" 2>/dev/null || true; }
_lock_mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }
_proc_alive() { [ -n "$1" ] && kill -0 "$1" 2>/dev/null; }

acquire_lock() {
  local lock="$1" role="$2" stale="${3:-600}" tries="${4:-150}" wait="${5:-2}"
  local name pid age broken i
  name="$(basename "$lock")"
  for ((i = 0; i < tries; i++)); do
    if mkdir "$lock" 2>/dev/null; then
      printf '%s\n' "$BASHPID" > "$lock/pid"
      team_log_event "$role" lock "acquire $name"
      return 0
    fi
    # lock exists — break it only if the owner is dead OR it is older than the backstop
    pid="$(_lock_pid "$lock")"
    age=$(( $(date +%s) - $(_lock_mtime "$lock") ))
    if ! _proc_alive "$pid" || [ "$age" -gt "$stale" ]; then
      broken="${lock}.broken.$BASHPID.$RANDOM"
      if mv "$lock" "$broken" 2>/dev/null; then   # rename is atomic: only one waiter wins
        rm -rf "$broken" 2>/dev/null || true
        team_log_event "$role" lock "break-stale $name (pid=${pid:-?} age=${age}s)"
        continue
      fi
    fi
    echo "lock: '$name' held by '${pid:-?}' — waiting…" >&2
    sleep "$wait"
  done
  team_log_event "$role" lock "timeout $name"
  return 1
}

release_lock() {
  local lock="$1" role="${2:-?}"
  if [ "$(_lock_pid "$lock")" = "$BASHPID" ]; then   # only delete a lock we still hold
    rm -rf "$lock"
    team_log_event "$role" lock "release $(basename "$lock")"
  fi
}
