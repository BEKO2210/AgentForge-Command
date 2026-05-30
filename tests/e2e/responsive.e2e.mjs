// Playwright — responsive layout (Run 1.7). Proves the cockpit reflows without
// horizontal scrollbars across phone→desktop, and that touch devices get real
// 44px tap targets (the pointer: coarse block), not just CSS that says so.
import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "small phone", width: 320, height: 640 },
  { name: "phone",       width: 375, height: 812 },
  { name: "tablet",      width: 768, height: 1024 },
  { name: "laptop",      width: 1280, height: 800 },
  { name: "desktop",     width: 1680, height: 1050 },
];

test.describe("AgentForge responsive", () => {
  for (const vp of VIEWPORTS) {
    test(`no horizontal scroll at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await page.locator(".lead-panel").waitFor();
      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        // 1px of tolerance for sub-pixel rounding.
        return de.scrollWidth - de.clientWidth;
      });
      expect(overflow, `horizontal overflow of ${overflow}px at ${vp.width}`).toBeLessThanOrEqual(1);
    });
  }

  test("the swarm grid is single-column on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const cols = await page.locator(".grid").first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(cols).toBe(1);
  });
});

test.describe("AgentForge touch ergonomics", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a coarse pointer reports and per-card buttons clear 44px (Run 1.7)", async ({ page }) => {
    await page.goto("/");
    const coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
    expect(coarse, "Chromium should report pointer: coarse under touch emulation").toBeTruthy();
    const btn = page.locator(".tcard .card-btn").first();
    await btn.waitFor();
    const { minH, h } = await btn.evaluate((el) => ({
      minH: getComputedStyle(el).minHeight,
      h: el.getBoundingClientRect().height,
    }));
    // The CSS commits to a 44px target; mobile emulation renders it at ~43.9
    // CSS px due to sub-pixel device scaling, so round the measured box.
    expect(minH).toBe("44px");
    expect(Math.round(h)).toBeGreaterThanOrEqual(44);
  });
});
