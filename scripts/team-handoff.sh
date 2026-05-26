#!/usr/bin/env bash
# Produce a self-contained briefing for a fresh Claude Code instance picking up the team.
# Combines durable memory + resume report + throughput snapshot into one paste-able doc.
#   scripts/team-handoff.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/lock.sh
. "$HERE/lib/lock.sh"

hr() { printf '%s\n' "==============================================="; }

hr; echo " TEAM HANDOFF BRIEFING — $(team_now)"; hr
echo
echo "## Durable memory (.team/memory.md)"
echo
if [ -f .team/memory.md ]; then cat .team/memory.md; else echo "(no memory.md yet)"; fi
echo
hr; echo " Current resume state"; hr
"$HERE/team-resume.sh" 2>/dev/null || true
echo
hr; echo " Throughput snapshot"; hr
"$HERE/team-metrics.sh" 2>/dev/null || true
echo
hr; echo " Next steps for the incoming session"; hr
cat <<'EOF'
1. The LEAD reads the above, runs scripts/team-sync.sh, and reconciles board.md.
2. Each agent re-reads .team/PROTOCOL.md and its role file, then re-CLAIMs the task
   it had open according to the resume state.
3. Then the team resumes normally — state nudges, gate-before-commit, lead-only push.
EOF
team_log_event lead handoff "briefing emitted"
