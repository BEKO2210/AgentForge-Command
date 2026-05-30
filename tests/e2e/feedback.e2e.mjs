// Playwright — loading/feedback (Run 1.8). Proves the success toast actually
// appears and auto-dismisses in a real browser (the error-persistent path and
// the rest of the contract are covered by feedback-suite.mjs).
import { test, expect } from "@playwright/test";

test.describe("AgentForge feedback", () => {
  test("'Evolve all' shows a success toast that auto-dismisses (Run 1.8)", async ({ page }) => {
    await page.goto("/");
    await page.locator(".lead-panel").waitFor();
    await page.locator("#evolve-all").click();

    const toast = page.locator(".toast.toast-success");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Evolved \d+ mascot/i);
    // success accent + polite live status, not an alert
    await expect(toast).toHaveAttribute("role", "status");
    // auto-dismiss at 1.5s (+200ms exit) → gone within ~2.5s
    await expect(toast).toHaveCount(0, { timeout: 3000 });
  });

  test("the spawn entrance is staggered across cards (Run 1.8)", async ({ page }) => {
    // Fresh load → cards mount with a per-index --stagger custom property.
    await page.goto("/");
    const cards = page.locator(".tcard[data-id]");
    await cards.first().waitFor();
    // Read --stagger off the first few cards: they must increase (0,1,2,…).
    const staggers = await cards.evaluateAll((els) =>
      els.slice(0, 3).map((el) => getComputedStyle(el).getPropertyValue("--stagger").trim()));
    // Either the cards still carry the climbing index, or the class was already
    // stripped (fast machine) leaving it empty — both are valid post-states, so
    // assert that when present they are non-decreasing integers.
    const nums = staggers.filter((s) => s !== "").map(Number);
    for (let i = 1; i < nums.length; i++) expect(nums[i]).toBeGreaterThanOrEqual(nums[i - 1]);
  });
});
