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
    await page.locator(".mascot-body").first().waitFor();
    // Read the duration with an atomic query-then-measure inside the page: the
    // mascot SVG is re-rendered (innerHTML swap) on every state change, so a
    // resolved element handle can detach between waitFor() and evaluate() — and
    // getComputedStyle() on a detached node returns "" (the source of a rare
    // flake). expect.poll re-queries until the live node yields a stable value.
    await expect.poll(() => page.evaluate(() => {
      const el = document.querySelector(".mascot-body");
      return el ? getComputedStyle(el).animationDuration : null;
    })).toMatch(/^0m?s$/);  // 0s or 0ms — breathing animation is gated on no-preference
  });

  test("an open specialist drawer has no serious/critical axe violations (Run 1.4)", async ({ page }) => {
    await page.goto("/");
    await page.locator('.tcard[data-id="sentinel"] header[data-action="open"]').click();
    await page.locator("#drawer.open").waitFor({ timeout: 5000 });
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    if (serious.length) for (const v of serious) console.log(`  - ${v.id} (${v.impact}): ${v.help}`);
    expect(serious, serious.map((v) => v.id).join(", ")).toEqual([]);
  });

  test("prefers-contrast: more strengthens structural borders (Run 1.6)", async ({ page }) => {
    // Default look: read a card's border colour.
    await page.goto("/");
    const card = page.locator('.tcard[data-id="sentinel"]');
    await card.waitFor();
    const dflt = await card.evaluate((el) => getComputedStyle(el).borderTopColor);
    // Ask the OS for more contrast → the high-contrast block lifts the border.
    await page.emulateMedia({ contrast: "more" });
    const strong = await card.evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(strong).not.toEqual(dflt);
    // sanity: the strengthened border is genuinely brighter (higher channel sum)
    const sum = (rgb) => (rgb.match(/\d+/g) || []).slice(0, 3).reduce((a, b) => a + +b, 0);
    expect(sum(strong)).toBeGreaterThan(sum(dflt));
  });

  test("keyboard: Tab reaches a focusable control", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const tag = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    expect(["A", "BUTTON", "INPUT"]).toContain(tag);
  });
});
