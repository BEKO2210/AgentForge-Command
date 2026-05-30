// Playwright + axe-core — backs the README's accessibility claims.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("AgentForge accessibility", () => {
  test("Mission Control has no serious/critical axe violations", async ({ page }) => {
    await page.goto("/");
    await page.locator(".lead-panel").waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    if (serious.length) {
      console.log("axe serious/critical violations:");
      for (const v of serious) console.log(`  - ${v.id} (${v.impact}): ${v.help} [${v.nodes.length} node(s)]`);
    }
    expect(serious, serious.map((v) => v.id).join(", ")).toEqual([]);
  });

  test("prefers-reduced-motion: reduce disables mascot animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.locator(".lead-panel").waitFor();        // full render
    const body = page.locator(".mascot-body").first();
    await body.waitFor();
    const dur = await body.evaluate((el) => getComputedStyle(el).animationDuration);
    // Under reduce, the breathing animation (gated on no-preference) is absent.
    expect(["0s", "0ms"]).toContain(dur);
  });

  test("keyboard: Tab reaches a focusable control", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const tag = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    expect(["A", "BUTTON", "INPUT"]).toContain(tag);
  });
});
