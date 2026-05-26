#!/usr/bin/env bash
# Self-running demo of the team coordination helpers — no Claude Code needed.
# Creates a throwaway repo with a populated .team/, drives a small sequence of state
# changes, and prints what each helper sees. Anyone who runs this can grasp the kit
# in under 30 seconds.
#   bash scripts/team-demo.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(cd "$HERE/.." && pwd)"

DEMO="$(mktemp -d)"
trap 'rm -rf "$DEMO"' EXIT

mkdir -p "$DEMO/.team/roles" "$DEMO/.team/log" "$DEMO/.team/locks"
: > "$DEMO/.team/locks/.gitkeep"
for r in lead backend frontend quality; do
  printf '# role %s\n' "$r" > "$DEMO/.team/roles/$r.md"
  printf '# Log — %s (append only, newest at bottom)\n' "$r" > "$DEMO/.team/log/$r.md"
done

cat > "$DEMO/.team/board.md" <<'EOF'
# Board — single source of truth (owned by LEAD)

| #  | Task                | Owner    | State    | Notes      |
|----|---------------------|----------|----------|------------|
| 1  | Scaffold API        | backend  | done     | JSON store |
| 2  | Auth endpoints      | backend  | done     | —          |
| 3  | Login UI            | frontend | doing    | —          |
| 4  | E2E test harness    | quality  | blocked  | @backend   |
| 5  | Rate limiting       | backend  | todo     | —          |
| 6  | Dark theme          | frontend | todo     | —          |
EOF

# Vary heartbeats: lead active now, others spread out.
touch -d "now"           "$DEMO/.team/log/lead.md"
touch -d "5 min ago"     "$DEMO/.team/log/backend.md"
touch -d "22 min ago"    "$DEMO/.team/log/frontend.md"
touch -d "50 min ago"    "$DEMO/.team/log/quality.md"

cd "$DEMO" || exit 1
( git init -q && git config user.email demo@demo && git config user.name demo \
  && git config commit.gpgsign false && git add -A && git commit -qm init ) 2>/dev/null || true

hr() { printf '\n\033[36m%s\033[0m\n' "==============================================="; }

hr; echo " demo · the board at this moment"; hr
cat .team/board.md

hr; echo " scripts/team-health.sh — liveness, stale tasks, deadlock"; hr
"$SRC/scripts/team-health.sh"

hr; echo " scripts/team-sections.sh — per-section breakdown (no sections yet → one main)"; hr
"$SRC/scripts/team-sections.sh"

hr; echo " scripts/team-sync.sh — does the board match the logs? (logs empty → yes)"; hr
"$SRC/scripts/team-sync.sh"

hr; echo " add log events for backend → now the logs say one thing, the board another"; hr
printf '12:00 · backend · 🛠 CLAIM #5 — start rate limiting\n'   >> .team/log/backend.md
printf '12:30 · backend · ✅ DONE #5 — token bucket\n'           >> .team/log/backend.md
printf '12:35 · backend · 🤝 HANDOFF → @frontend · #6 · needs:tokens · use the new endpoint\n' >> .team/log/backend.md
"$SRC/scripts/team-sync.sh"

hr; echo " scripts/team-lint-log.sh — handoff schema check"; hr
"$SRC/scripts/team-lint-log.sh" .team/log/backend.md

hr; echo " scripts/team-metrics.sh — throughput per role + board progress"; hr
"$SRC/scripts/team-metrics.sh"

hr; echo " scripts/team-snapshot.sh — full state as JSON (first 30 lines)"; hr
"$SRC/scripts/team-snapshot.sh" | head -30

hr; echo " demo done — sandbox at $DEMO was cleaned up"; hr
