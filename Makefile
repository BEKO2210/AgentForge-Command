# Convenience targets. The kit itself is shell — Make is just a memorable entry point.
.PHONY: help gate test demo init health sync snapshot metrics handoff mcp-test

help:
	@echo "Targets:"
	@echo "  make gate       run the full green gate (bash -n + shellcheck + tests)"
	@echo "  make test       run the bash test suite (tests/run.sh)"
	@echo "  make demo       30s self-running demo of the helpers (no Claude Code needed)"
	@echo "  make init       install the kit into a TARGET=... repo"
	@echo "  make health     run team-health.sh against the current repo"
	@echo "  make sync       run team-sync.sh against the current repo"
	@echo "  make snapshot   capture the current state as JSON"
	@echo "  make metrics    refresh team-metrics.sh"
	@echo "  make handoff    print a handoff briefing for a fresh session"
	@echo "  make mcp-test   run the MCP server smoke test (12 checks)"

gate:
	bash scripts/team-check.sh

test:
	bash tests/run.sh

demo:
	bash scripts/team-demo.sh

init:
	@[ -n "$(TARGET)" ] || { echo "usage: make init TARGET=/path/to/your/repo" >&2; exit 1; }
	bash scripts/team-init.sh "$(TARGET)"

health:
	bash scripts/team-health.sh

sync:
	bash scripts/team-sync.sh

snapshot:
	bash scripts/team-snapshot.sh

metrics:
	bash scripts/team-metrics.sh

handoff:
	bash scripts/team-handoff.sh

mcp-test:
	cd mcp && npm install --silent && node test.js
