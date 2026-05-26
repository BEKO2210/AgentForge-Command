#!/usr/bin/env bash
# One-command setup. Drops the kit into a target repo so users don't have to copy
# files by hand.
#   bash /path/to/kit/scripts/team-init.sh             # target = current directory
#   bash /path/to/kit/scripts/team-init.sh /path/repo  # explicit target
# Refuses to overwrite an existing .team/. After running, edit team-check.sh and the
# role globs as the README's Quickstart describes.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(cd "$HERE/.." && pwd)"
TARGET="${1:-$(pwd)}"
TARGET="$(cd "$TARGET" && pwd)"

echo "team-init: kit at $SRC"
echo "team-init: target $TARGET"

[ -d "$TARGET/.git" ] || { echo "team-init: $TARGET is not a git repo" >&2; exit 1; }
[ -e "$TARGET/.team" ] && { echo "team-init: $TARGET/.team already exists — refusing" >&2; exit 1; }

cp -r "$SRC/.team" "$TARGET/.team"
mkdir -p "$TARGET/scripts"
cp -r "$SRC/scripts/." "$TARGET/scripts/"
mkdir -p "$TARGET/lib"
cp "$SRC/lib/state.mjs" "$TARGET/lib/"
chmod +x "$TARGET/scripts/"*.sh "$TARGET/scripts/lib/"*.sh 2>/dev/null || true

[ -f "$TARGET/.gitignore" ] || : > "$TARGET/.gitignore"
if ! grep -q '\.team/locks/\*' "$TARGET/.gitignore" 2>/dev/null; then
  {
    echo ""
    echo "# 4-Agent Team Kit runtime artifacts"
    echo ".team/locks/*"
    echo "!.team/locks/.gitkeep"
    echo ".team/log/events.log"
    echo ".team/state/"
    echo ".team/backups/"
    echo ".team/snapshots/"
    echo ".team/metrics.md"
  } >> "$TARGET/.gitignore"
fi

cat <<'EOF'

team-init: ✅ kit installed.

Next steps:
  1. $EDITOR scripts/team-check.sh   # set your real lint+test command
  2. $EDITOR .team/roles/*.md         # adjust globs to your repo
  3. Open 4 terminals in this repo, run 'claude' in each, paste PROMPTS.md blocks.
  4. Give the LEAD your goal.

Helpers worth knowing:
  scripts/team-health.sh    scripts/team-sync.sh    scripts/team-resume.sh
  scripts/team-snapshot.sh  scripts/team-handoff.sh scripts/team-demo.sh
EOF
