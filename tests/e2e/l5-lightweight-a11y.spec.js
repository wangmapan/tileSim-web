import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("L5 lightweight workbench visual and accessibility gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, (route) => route.abort("connectionrefused"));
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("neutral entry stays balanced and overflow-free at desktop sizes", async ({ page }) => {
    for (const viewport of [
      { width: 800, height: 600 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "networkidle" });
      await expect(page.locator(".workbench-entry")).toBeVisible();
      const cards = page.locator(".workbench-choice-card");
      await expect(cards).toHaveCount(2);
      const widths = await cards.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().width),
      );
      expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const violations = (await new AxeBuilder({ page }).include(".workbench-entry").analyze()).violations;
      expect(violations).toEqual([]);
    }
  });

  test("keyboard focus and reduced motion remain usable at 200 percent zoom", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    const links = page.locator(".workbench-choice-card__action");
    await links.first().focus();
    await expect(links.first()).toBeFocused();
    const outline = await links.first().evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth * 2)).toBe(true);
    await links.first().press("Enter");
    await expect(page).toHaveURL(/\/lightweight$/);
  });

  test("lightweight navigation remains operable at a 200 percent equivalent viewport", async ({ page }) => {
    // A 400 CSS-pixel viewport approximates a 200% browser zoom on an 800px desktop window.
    await page.setViewportSize({ width: 400, height: 600 });
    await page.goto("/lightweight", { waitUntil: "networkidle" });
    const nav = page.locator(".lightweight-shell__nav");
    await expect(nav).toBeVisible();
    await expect(nav.locator("a")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const help = page.getByRole("button", { name: "页面帮助" });
    await help.focus();
    await expect(help).toBeFocused();
    expect(await help.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    await help.press("Enter");
    await expect(page.locator("dialog.help-documentation")).toBeVisible();
    await expect(page.locator("dialog.help-documentation")).toContainText("轻量版");
    await expect(page.locator('dialog.help-documentation [data-guide-id^="lightweight"]')).toHaveCount(4);
    await expect(page.locator('dialog.help-documentation [data-guide-id="overview"]')).toHaveCount(0);
    await expect(page.locator(".lightweight-shell__help")).toHaveCount(0);
  });

  test("lightweight shell stays separate and supports themes", async ({ page }) => {
    for (const appearance of ["light", "dark"]) {
      await page.goto("/lightweight", { waitUntil: "networkidle" });
      await page.evaluate((mode) => localStorage.setItem("tilesim-web.appearance.v1", mode), appearance);
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("data-appearance", appearance);
      await expect(page.locator(".lightweight-shell")).toBeVisible();
      await expect(page.locator(".app-shell")).toHaveCount(0);
      await expect(page.locator(".app-sidebar, .evidence-strip")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const violations = (await new AxeBuilder({ page }).include(".lightweight-shell").analyze()).violations;
      expect(violations).toEqual([]);
    }
  });

  test("shared Agent dock reserves the lightweight work surface on narrow desktop widths", async ({ page }) => {
    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 760, height: 900 },
      { width: 1600, height: 900 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/lightweight/prepare", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "打开 TileSim 助手", exact: true }).click();
      const bounds = await page.evaluate(() => {
        const rect = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const value = element.getBoundingClientRect();
          return { left: value.left, right: value.right, width: value.width };
        };
        return {
          shell: rect(".lightweight-shell"),
          content: rect(".lightweight-shell__content"),
          panel: rect(".agent-copilot-shell"),
          actions: rect(".agent-copilot-shell__header-actions"),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });
      expect(bounds.shell).not.toBeNull();
      expect(bounds.content).not.toBeNull();
      expect(bounds.panel).not.toBeNull();
      expect(bounds.actions).not.toBeNull();
      expect(bounds.panel.left).toBeGreaterThanOrEqual(bounds.shell.right - 1);
      expect(bounds.content.right).toBeLessThanOrEqual(bounds.panel.left);
      expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.innerWidth);
      expect(
        await page
          .locator(".agent-copilot-shell__header-actions button")
          .evaluateAll((buttons) => buttons.every((button) => getComputedStyle(button).whiteSpace === "nowrap")),
      ).toBe(true);
    }
  });
});
