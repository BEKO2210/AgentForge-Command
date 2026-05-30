// Playwright E2E — drives the real cockpit HTML/JS in Harness Mode.
// Proves the UI the server-side suites can't see: load, harness dispatch,
// specialist cards, drawer, spawn modal, auto-enter toggle.
import { test, expect } from "@playwright/test";

test.describe("AgentForge cockpit", () => {
  test("loads Mission Control with Atlas in harness mode", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".brand")).toContainText("FORGE");
    await expect(page.locator(".lead-panel")).toBeVisible();
    await expect(page.getByText("ATLAS PRIME").first()).toBeVisible();
    // Harness badge proves we're NOT pretending to run a live LLM.
    await expect(page.getByText("TEST HARNESS").first()).toBeVisible();
  });

  test("renders the specialist grid", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator(".tcard[data-id]");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(8);
    await expect(page.locator('.tcard[data-id="sentinel"] .name')).toContainText(/sentinel/i);
  });

  test("Atlas dispatches the swarm in harness", async ({ page }) => {
    await page.goto("/");
    await page.locator("#broadcast-input").fill("run a swarm check across sentinel and aurora");
    await page.locator("#broadcast-input").press("Enter");
    // The dispatch list fills with addressed specialists (real routing chain).
    await expect(page.locator(".dispatch-list .dsp-id").first()).toBeVisible({ timeout: 15000 });
    // Atlas's answer streams into his panel.
    await expect(page.locator("#atlas-answer-scroll .a-line").first()).toBeVisible();
  });

  test("specialist drawer opens and closes with Escape", async ({ page }) => {
    await page.goto("/");
    await page.locator('.tcard[data-id="sentinel"]').click();
    const drawer = page.locator("#drawer");
    await expect(drawer).toHaveClass(/open/, { timeout: 5000 });
    await page.keyboard.press("Escape");
    await expect(drawer).not.toHaveClass(/open/);
  });

  test("spawn-builder modal opens", async ({ page }) => {
    await page.goto("/");
    await page.locator("#new-agent").click();
    await expect(page.locator("#modal-backdrop")).toBeVisible();
  });

  test("auto-enter toggle flips its pressed state", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator('.tcard[data-id="sentinel"] .auto-toggle');
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  test("orphaned-session banner offers a relaunch (reattach UI)", async ({ page }) => {
    await page.goto("/");
    const banner = page.locator("#orphaned-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("orphaned");
    await expect(banner.locator('[data-relaunch="forge"]')).toBeVisible();
  });

  test("broadcast bar: empty dispatch errors, typing clears it + counts (Run 1.3)", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("#broadcast-input");
    const error = page.locator("#broadcast-error");
    const count = page.locator("#broadcast-count");
    await expect(input).toHaveAttribute("maxlength", "255");
    // empty (whitespace) Enter → error shown, no dispatch
    await input.fill("   ");
    await input.press("Enter");
    await expect(error).toBeVisible();
    await expect(input).toHaveClass(/error/);
    // typing clears the error and updates the counter
    await input.fill("check the build");
    await expect(error).toBeHidden();
    await expect(count).toHaveText("15/255");
  });

  test("card opener is keyboard-focusable and hover lifts the card (Run 1.2)", async ({ page }) => {
    await page.goto("/");
    const opener = page.locator('.tcard[data-id="sentinel"] header[data-action="open"]');
    await expect(opener).toHaveAttribute("tabindex", "0");
    await expect(opener).toHaveAttribute("aria-label", /sentinel/i);
    const card = page.locator('.tcard[data-id="sentinel"]');
    const flat = await card.evaluate((el) => getComputedStyle(el).transform);
    await card.hover();
    await page.waitForTimeout(250);
    const lifted = await card.evaluate((el) => getComputedStyle(el).transform);
    // hover applies translateY(-3px) → transform matrix changes from the resting state
    expect(lifted).not.toEqual(flat);
  });

  test("worktree badge + drawer git-status after launching a specialist", async ({ page }) => {
    await page.goto("/");
    await page.locator('.tcard[data-id="sentinel"] [data-action="launch-pty"]').click();
    const badge = page.locator('.tcard[data-id="sentinel"] [data-worktree]');
    await expect(badge).toBeVisible({ timeout: 12000 });
    await expect(badge).toContainText("agentforge/sentinel");
    // Open the drawer → the worktree git-status panel resolves (no error).
    await page.locator('.tcard[data-id="sentinel"] header[data-action="open"]').click();
    const gs = page.locator("#drawer [data-git-status]");
    await expect(gs).toBeVisible();
    await expect(gs).not.toHaveText("loading git status…", { timeout: 6000 });
    // Run 1.4: status is rendered as coloured lines (or the clean marker),
    // not raw text — a fresh worktree has no changes → ".gs-clean".
    await expect(gs.locator(".gs-clean, .gs-line").first()).toBeVisible();
  });
});
