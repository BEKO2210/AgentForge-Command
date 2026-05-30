// Remove the throwaway git repo created for E2E worktree tests.
import fs from "node:fs";
export default async function globalTeardown() {
  const repo = process.env.AFC_E2E_REPO;
  if (repo) { try { fs.rmSync(repo, { recursive: true, force: true }); } catch { /* best effort */ } }
}
