// Playwright config — drives the real cockpit in Harness Mode (no API key).
// Only files under tests/e2e/ are Playwright tests; the node:assert suites
// (tests/*-suite.mjs) are run by tests/run.sh, never by Playwright.
import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A throwaway git repo so worktree creation during E2E never touches the real
// project repo. Created once when the config loads; removed by globalTeardown.
const E2E_REPO = fs.mkdtempSync(path.join(os.tmpdir(), "afc-e2e-repo-"));
const g = (args) => execFileSync("git", args, { cwd: E2E_REPO, stdio: "pipe" });
try {
  g(["init", "-q", "-b", "main"]);
  g(["config", "user.email", "e2e@t.t"]);
  g(["config", "user.name", "e2e"]);
  g(["config", "commit.gpgsign", "false"]);
  fs.writeFileSync(path.join(E2E_REPO, "README.md"), "e2e seed\n");
  g(["add", "-A"]);
  g(["commit", "-q", "--no-gpg-sign", "-m", "seed"]);
} catch { /* git unavailable → worktrees auto-disable, other tests still run */ }
// Seed one orphaned session so the "orphaned sessions" banner is testable.
try {
  fs.mkdirSync(path.join(E2E_REPO, ".team"), { recursive: true });
  fs.writeFileSync(path.join(E2E_REPO, ".team", "sessions.json"),
    JSON.stringify({ sessions: [{ id: "forge", cmd: "bash", cwd: E2E_REPO, branch: "agentforge/forge", status: "running" }] }));
} catch { /* best effort */ }
process.env.AFC_E2E_REPO = E2E_REPO;

const PORT = process.env.E2E_PORT || "4173";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 30 * 1000,
  expect: { timeout: 8000 },
  reporter: process.env.CI ? "list" : "line",
  globalTeardown: "./tests/e2e/global-teardown.mjs",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: "node gui/server.js",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 30 * 1000,
    env: {
      PORT,
      AGENTFORGE_HARNESS: "1",   // TEST HARNESS badge + offline Atlas routing
      TEST_CMD: "bash",          // PTYs run bash, no Claude CLI needed
      REPO_DIR: E2E_REPO,        // worktrees land here, not the project repo
      ANTHROPIC_API_KEY: "",
      FORGE_PULSE: "0",
      AGENTFORGE_WORKTREE_CLEANUP: "1", // keep the e2e repo tidy between runs
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
