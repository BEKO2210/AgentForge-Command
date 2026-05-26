#!/usr/bin/env bash
# The green gate — EDIT this for your project. Every commit must pass it.
# Keep it FAST (lint + unit). Leave slow build/e2e to the quality agent's sign-off
# (run those via team-exclusive.sh so they don't collide).
set -euo pipefail

# --- pick / replace for your stack ---
#   npm run lint && npm test
#   pnpm lint && pnpm test
#   yarn lint && yarn test
#   ruff check . && pytest -q
#   go vet ./... && go test ./...
#   cargo clippy -- -D warnings && cargo test

# --- gate for THIS repo (the kit itself is a Bash project) ---
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

# 1) syntax-check every shell script (bash -n is always available)
while IFS= read -r f; do
  bash -n "$f"
done < <(find "$ROOT/scripts" -name '*.sh' -type f)

# 2) shellcheck if it is installed (optional, stronger)
# Severity 'warning' catches real bugs; info/style suggestions don't fail the gate.
if command -v shellcheck >/dev/null 2>&1; then
  # shellcheck disable=SC2046
  shellcheck -x -S warning $(find "$ROOT/scripts" -name '*.sh' -type f)
fi

# 3) run the test suite
if [ -x "$ROOT/tests/run.sh" ]; then
  "$ROOT/tests/run.sh"
fi

echo "team-check: ✅ green"
