#!/usr/bin/env bash
# Self-contained test suite for the team coordination scripts.
# Builds a throwaway git sandbox per test group, runs the real scripts against it,
# and asserts behaviour. No external test framework needed (bats optional).
#   tests/run.sh
set -uo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pass=0; fail=0
SANDBOXES=()

ok() { printf '  \033[32mok\033[0m  %s\n' "$1"; pass=$((pass + 1)); }
no() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=$((fail + 1)); }
assert() { if eval "$1"; then ok "$2"; else no "$2  [$1]"; fi; }

cleanup() { for d in "${SANDBOXES[@]:-}"; do [ -n "$d" ] && rm -rf "$d" "$d"-*; done; }
trap cleanup EXIT

new_sandbox() {
  SB="$(mktemp -d)"; SANDBOXES+=("$SB")
  mkdir -p "$SB/scripts/lib" "$SB/.team/locks" "$SB/.team/log" "$SB/.team/roles" "$SB/lib"
  cp "$SRC/scripts/lib/lock.sh" "$SB/scripts/lib/"
  cp "$SRC/lib/state.mjs" "$SB/lib/"
  local s
  for s in team-commit team-exclusive team-health team-sync team-lint-log \
           team-resume team-lead-claim team-backup team-metrics team-worktrees \
           team-role team-handoff team-sections team-federate; do
    cp "$SRC/scripts/$s.sh" "$SB/scripts/"; chmod +x "$SB/scripts/$s.sh"
  done
  # Node helpers (snapshot/diff) — copy both the wrapper and the .mjs implementation
  for s in team-snapshot team-diff; do
    cp "$SRC/scripts/$s.sh"  "$SB/scripts/"; chmod +x "$SB/scripts/$s.sh"
    cp "$SRC/scripts/$s.mjs" "$SB/scripts/"
  done
  # a passing gate inside the sandbox (so team-commit's gate succeeds in isolation)
  printf '#!/usr/bin/env bash\nexit 0\n' > "$SB/scripts/team-check.sh"
  chmod +x "$SB/scripts/team-check.sh"
  : > "$SB/.team/locks/.gitkeep"
  local r
  for r in lead backend frontend quality; do
    printf '# role %s\n' "$r" > "$SB/.team/roles/$r.md"
    printf '# log %s\n' "$r" > "$SB/.team/log/$r.md"
  done
  cat > "$SB/.team/board.md" <<'EOF'
| #  | Task | Owner    | State | Notes |
|----|------|----------|--------|-------|
| 1  | a    | backend  | doing  | —     |
| 2  | b    | frontend | todo   | —     |
EOF
  ( cd "$SB" && git init -q && git config user.email t@t && git config user.name t \
      && git config commit.gpgsign false && git config tag.gpgsign false \
      && git add -A && git commit -qm init )
}

run() { OUT="$(cd "$SB" && "$@" 2>&1)"; RC=$?; }

echo "== lock / team-exclusive =="
new_sandbox
run scripts/team-exclusive.sh quality build -- bash -c 'echo hi'
assert '[ "$RC" -eq 0 ]'                                'exclusive: success returns 0'
assert 'printf "%s" "$OUT" | grep -q hi'               'exclusive: runs the command'
run scripts/team-exclusive.sh quality build -- bash -c 'exit 7'
assert '[ "$RC" -eq 7 ]'                                'exclusive: propagates exit code'
assert 'grep -q "start build" "$SB/.team/log/events.log"' 'exclusive: writes events.log'
assert '[ ! -e "$SB/.team/locks/build.lock" ]'         'exclusive: releases the lock'

echo "== stale-lock break =="
new_sandbox
mkdir -p "$SB/.team/locks/build.lock"; echo 999999 > "$SB/.team/locks/build.lock/pid"
run scripts/team-exclusive.sh quality build -- bash -c 'echo got'
assert '[ "$RC" -eq 0 ]'                                'lock: breaks a dead-PID stale lock'
assert 'printf "%s" "$OUT" | grep -q got'              'lock: proceeds after breaking'

echo "== team-commit =="
new_sandbox
( cd "$SB" && echo hello > file.txt )
run scripts/team-commit.sh backend "add file" file.txt
assert '[ "$RC" -eq 0 ]'                                'commit: returns 0'
assert '( cd "$SB" && git log -1 --pretty=%s | grep -q "\[backend\] add file" )' 'commit: [role] prefix'
( cd "$SB" && echo more >> file.txt )
run scripts/team-commit.sh --dry-run backend "do not commit" file.txt
assert '[ "$RC" -eq 0 ]'                                'dry-run: returns 0'
assert '! ( cd "$SB" && git log -1 --pretty=%s | grep -q "do not commit" )' 'dry-run: makes no commit'
assert '( cd "$SB" && git diff --cached --quiet )'     'dry-run: leaves nothing staged'

echo "== team-health =="
new_sandbox
touch -t 200001010000 "$SB/.team/log/backend.md"   # backend silent since year 2000
run scripts/team-health.sh
assert 'printf "%s" "$OUT" | grep -q "backend" '       'health: lists backend'
assert 'printf "%s\n" "$OUT" | grep -E "backend .*stale" >/dev/null' 'health: marks backend stale'
assert 'printf "%s" "$OUT" | grep -q "#1"'             'health: flags stale doing-task #1'

echo "== team-health deadlock =="
new_sandbox
cat > "$SB/.team/board.md" <<'EOF'
| #  | Task | Owner    | State  | Notes |
|----|------|----------|---------|-------|
| 1  | a    | backend  | blocked | —     |
EOF
run scripts/team-health.sh
assert 'printf "%s" "$OUT" | grep -qi "Deadlock: ⚠"'   'health: detects all-blocked deadlock'

echo "== team-sync =="
new_sandbox
printf '12:00 · backend · ✅ DONE #1 — proof\n' >> "$SB/.team/log/backend.md"
run scripts/team-sync.sh
assert 'printf "%s" "$OUT" | grep -q "#1"'             'sync: detects drift on #1'
assert 'printf "%s" "$OUT" | grep -qi "drift"'         'sync: labels it drift'
run scripts/team-sync.sh --strict
assert '[ "$RC" -eq 1 ]'                                'sync: --strict exits 1 on drift'
# no drift once the board agrees
new_sandbox
printf '12:00 · backend · 🛠 CLAIM #1 — start\n' >> "$SB/.team/log/backend.md"
run scripts/team-sync.sh --strict
assert '[ "$RC" -eq 0 ]'                                'sync: --strict exits 0 when aligned'

echo "== team-lint-log =="
new_sandbox
printf '12:00 · backend · 🤝 HANDOFF → @frontend · #2 · needs:api · do x\n' >> "$SB/.team/log/backend.md"
run scripts/team-lint-log.sh .team/log/backend.md
assert '[ "$RC" -eq 0 ]'                                'lint: well-formed handoff passes'
printf '12:01 · backend · 🤝 HANDOFF frontend do y\n' >> "$SB/.team/log/backend.md"
run scripts/team-lint-log.sh .team/log/backend.md
assert '[ "$RC" -ne 0 ]'                                'lint: malformed handoff fails'

echo "== team-resume =="
new_sandbox
printf '12:00 · backend · 🛠 CLAIM #1 — start\n' >> "$SB/.team/log/backend.md"
printf '12:30 · backend · ✅ DONE #1 — proof\n' >> "$SB/.team/log/backend.md"
printf '12:05 · frontend · ⛔ BLOCKED #2 — @backend/api\n' >> "$SB/.team/log/frontend.md"
run scripts/team-resume.sh
assert '[ "$RC" -eq 0 ]'                                'resume: returns 0'
assert 'printf "%s" "$OUT" | grep -q "#1"'             'resume: shows completed #1'
assert 'printf "%s" "$OUT" | grep -q "#2"'             'resume: shows open #2'
assert 'printf "%s" "$OUT" | grep -qi "Recent commits"' 'resume: includes git history'

echo "== team-lead-claim =="
new_sandbox
run scripts/team-lead-claim.sh lead
assert '[ "$RC" -eq 0 ]'                                'lead-claim: first claim ok'
assert 'grep -q "^lead " "$SB/.team/state/lead"'       'lead-claim: records role'
run scripts/team-lead-claim.sh quality
assert '[ "$RC" -ne 0 ]'                                'lead-claim: fresh different role refused'
run scripts/team-lead-claim.sh quality --force
assert '[ "$RC" -eq 0 ]'                                'lead-claim: --force overrides'
assert 'grep -q "^quality " "$SB/.team/state/lead"'    'lead-claim: --force updates holder'

echo "== team-backup =="
new_sandbox
run scripts/team-backup.sh
assert '[ "$RC" -eq 0 ]'                                'backup: create returns 0'
assert 'ls "$SB"/.team/backups/*.tgz >/dev/null 2>&1'  'backup: writes a snapshot'
( cd "$SB" && echo "| 9 | x | lead | done | — |" >> .team/board.md )
run scripts/team-backup.sh restore
assert '[ "$RC" -eq 0 ]'                                'backup: restore returns 0'
assert '! grep -q "| 9 |" "$SB/.team/board.md"'        'backup: restore reverts the board'

echo "== team-metrics =="
new_sandbox
printf '12:00 · backend · 🛠 CLAIM #1\n12:30 · backend · ✅ DONE #1\n' >> "$SB/.team/log/backend.md"
run scripts/team-metrics.sh
assert '[ "$RC" -eq 0 ]'                                'metrics: returns 0'
assert '[ -f "$SB/.team/metrics.md" ]'                 'metrics: writes metrics.md'
assert 'grep -qi "Board progress" "$SB/.team/metrics.md"' 'metrics: reports board progress'
assert 'printf "%s" "$OUT" | grep -q "backend"'        'metrics: per-role row for backend'

echo "== team-role =="
new_sandbox
run scripts/team-role.sh add devops "infra/**" "deploy/**"
assert '[ "$RC" -eq 0 ]'                                'role: add returns 0'
assert '[ -f "$SB/.team/roles/devops.md" ]'            'role: creates roles/devops.md'
assert '[ -f "$SB/.team/log/devops.md" ]'              'role: creates log/devops.md'
assert 'grep -q "infra/" "$SB/.team/roles/devops.md"'  'role: records the globs'
run scripts/team-role.sh add devops
assert '[ "$RC" -ne 0 ]'                                'role: add refuses duplicate'
run scripts/team-role.sh list
assert 'printf "%s" "$OUT" | grep -q "devops"'         'role: list shows devops'
run scripts/team-role.sh remove lead
assert '[ "$RC" -ne 0 ]'                                'role: refuses to remove a core role'
run scripts/team-role.sh remove devops
assert '[ "$RC" -eq 0 ]'                                'role: remove returns 0'
assert '[ ! -e "$SB/.team/roles/devops.md" ]'          'role: remove deletes the file'

echo "== team-handoff =="
new_sandbox
printf '12:00 · backend · 🛠 CLAIM #1 — start\n' >> "$SB/.team/log/backend.md"
run scripts/team-handoff.sh
assert '[ "$RC" -eq 0 ]'                                'handoff: returns 0'
assert 'printf "%s" "$OUT" | grep -q "TEAM HANDOFF BRIEFING"' 'handoff: prints the briefing header'
assert 'printf "%s" "$OUT" | grep -q "Throughput snapshot"' 'handoff: includes metrics section'
assert 'printf "%s" "$OUT" | grep -q "resume state"'   'handoff: includes resume section'

echo "== team-worktrees =="
new_sandbox
run scripts/team-worktrees.sh setup backend
assert '[ "$RC" -eq 0 ]'                                'worktrees: setup returns 0'
assert '[ -d "$SB-backend" ]'                          'worktrees: creates the worktree dir'
assert '( cd "$SB" && git show-ref --verify --quiet refs/heads/team/backend )' 'worktrees: creates the branch'
run scripts/team-worktrees.sh list
assert 'printf "%s" "$OUT" | grep -q "backend"'        'worktrees: list shows it'
run scripts/team-worktrees.sh teardown backend
assert '[ "$RC" -eq 0 ]'                                'worktrees: teardown returns 0'
assert '[ ! -d "$SB-backend" ]'                        'worktrees: teardown removes the dir'

echo "== team-sections =="
new_sandbox
cat > "$SB/.team/board.md" <<'EOF'
# Board

## Backend
| #  | Task | Owner    | State   | Notes |
|----|------|----------|---------|-------|
| 1  | api  | backend  | done    | —     |
| 2  | db   | backend  | doing   | —     |

## Frontend
| #  | Task | Owner    | State   | Notes |
|----|------|----------|---------|-------|
| 3  | ui   | frontend | todo    | —     |
EOF
run scripts/team-sections.sh
assert '[ "$RC" -eq 0 ]'                                'sections: returns 0'
assert 'printf "%s" "$OUT" | grep -q "^## Backend"'    'sections: shows Backend heading'
assert 'printf "%s" "$OUT" | grep -q "^## Frontend"'   'sections: shows Frontend heading'
assert 'printf "%s" "$OUT" | grep -q "done=1"'         'sections: counts Backend done correctly'
assert 'printf "%s" "$OUT" | grep -q "backend(2)"'     'sections: aggregates owners per section'

echo "== team-federate =="
new_sandbox
SB2="$(mktemp -d)"; SANDBOXES+=("$SB2")
mkdir -p "$SB2/.team"
cat > "$SB2/.team/board.md" <<'EOF'
| #  | Task | Owner | State | Notes |
|----|------|-------|-------|-------|
| 1  | x    | lead  | done  | —     |
EOF
run scripts/team-federate.sh "$SB" "$SB2"
assert '[ "$RC" -eq 0 ]'                                'federate: returns 0'
assert 'printf "%s" "$OUT" | grep -q "TOTAL"'          'federate: emits TOTAL row'
assert 'printf "%s" "$OUT" | grep -q "done=1"'         'federate: aggregates done count'
assert 'printf "%s" "$OUT" | grep -qE "REPO[[:space:]]+TOTAL"' 'federate: prints header'

echo "== team-snapshot + team-diff =="
new_sandbox
run scripts/team-snapshot.sh
assert '[ "$RC" -eq 0 ]'                                'snapshot: returns 0'
assert 'printf "%s" "$OUT" | head -c 1 | grep -q "{"'  'snapshot: emits JSON'
assert 'printf "%s" "$OUT" | grep -q "\"generatedAt\""' 'snapshot: has generatedAt'
assert 'printf "%s" "$OUT" | grep -q "\"counts\""'     'snapshot: has counts'
assert 'printf "%s" "$OUT" | grep -q "\"tasks\""'      'snapshot: has tasks'
assert 'printf "%s" "$OUT" | grep -q "\"roles\""'      'snapshot: has roles'
# capture snapshot A, mutate board, capture B, diff
( cd "$SB" && scripts/team-snapshot.sh > A.json )
sed -i 's/| 1  | a    | backend  | doing  | —     |/| 1  | a    | backend  | done   | —     |/' "$SB/.team/board.md"
( cd "$SB" && scripts/team-snapshot.sh > B.json )
run scripts/team-diff.sh A.json B.json
assert '[ "$RC" -eq 0 ]'                                'diff: returns 0'
assert 'printf "%s" "$OUT" | grep -q "#1"'             'diff: mentions changed task #1'
assert 'printf "%s" "$OUT" | grep -qE "doing.*->.*done"' 'diff: reports state transition'

echo "== team-init =="
TARGET="$(mktemp -d)"; SANDBOXES+=("$TARGET")
( cd "$TARGET" && git init -q && git config user.email t@t && git config user.name t \
    && git config commit.gpgsign false && git commit -q --allow-empty -m init ) >/dev/null
OUT="$(bash "$SRC/scripts/team-init.sh" "$TARGET" 2>&1)"; RC=$?
assert '[ "$RC" -eq 0 ]'                                'init: returns 0'
assert '[ -d "$TARGET/.team/roles" ]'                  'init: copies .team/'
assert '[ -x "$TARGET/scripts/team-commit.sh" ]'       'init: scripts are executable'
assert '[ -f "$TARGET/lib/state.mjs" ]'                'init: copies lib/state.mjs'
assert 'grep -q ".team/locks/\*" "$TARGET/.gitignore"' 'init: extends .gitignore'
OUT="$(bash "$SRC/scripts/team-init.sh" "$TARGET" 2>&1)"; RC=$?
assert '[ "$RC" -ne 0 ]'                                'init: refuses to overwrite an existing .team/'

echo "== team-demo =="
OUT="$(bash "$SRC/scripts/team-demo.sh" 2>&1)"; RC=$?
assert '[ "$RC" -eq 0 ]'                                'demo: returns 0'
assert 'printf "%s" "$OUT" | grep -q "team-health.sh"' 'demo: walks through team-health'
assert 'printf "%s" "$OUT" | grep -q "team-sync.sh"'   'demo: walks through team-sync'
assert 'printf "%s" "$OUT" | grep -q "team-snapshot.sh"' 'demo: walks through team-snapshot'

echo "== JSON Schema sanity =="
( cd "$SRC" && node tests/validate-schema.mjs > /tmp/_schema.out 2>&1 ); rc=$?
if [ "$rc" -eq 0 ]; then ok "schema: structural checks pass"; else no "schema: validate-schema.mjs failed (rc=$rc)"; sed 's/^/    /' /tmp/_schema.out; fi

echo "== test-site smoke (#4) =="
if [ -x "$SRC/test-site/tests/smoke.sh" ]; then
  if OUT="$(bash "$SRC/test-site/tests/smoke.sh" 2>&1)"; then
    ok "test-site smoke: returns 0"
    printf '%s\n' "$OUT" | sed 's/^/    /'
  else
    no "test-site smoke: failed"
    printf '%s\n' "$OUT" | sed 's/^/    /'
  fi
else
  echo "  - test-site smoke: not present yet"
fi

echo
echo "tests: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
