import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  "overview",
  "experiment",
  "history",
  "execution",
  "fabric",
  "metrics",
  "validation",
  "attribution",
  "design-space",
  "evidence-agent",
  "evidence-lab",
];

test("offline desktop review preserves demo boundaries across routes and appearances", async ({ page }) => {
  test.setTimeout(180000);
  const phase = process.env.TILESIM_VISUAL_PHASE;
  const output = path.resolve("runtime/visual-review", phase === "before" ? "before" : "after");
  if (phase) await mkdir(output, { recursive: true });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, (route) => route.abort("connectionrefused"));
  await page.goto("/overview", { waitUntil: "networkidle" });
  for (const width of [1440, 1920, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    for (const appearance of ["light", "dark"]) {
      await page.evaluate((mode) => {
        localStorage.clear();
        localStorage.setItem("tilesim-web.appearance.v1", mode);
        localStorage.setItem("tilesim-web.theme.v1", "blue");
      }, appearance);
      for (const route of routes) {
        await page.goto(`/${route}`, { waitUntil: "networkidle" });
        await expect(page.locator("h1")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-appearance", appearance);
        await expect(page.locator(".bridge-card")).toContainText("未连接");
        if (phase) {
          await page.screenshot({ path: path.join(output, `${route}-${width}-${appearance}.png`), fullPage: true });
        }
        if (phase !== "before") {
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
            `${route}/${width}/${appearance}`,
          ).toBeLessThanOrEqual(width);
          if (route === "overview") {
            await expect(page.locator(".evidence-identity")).toContainText("示例数据");
            expect(
              await page
                .locator(".hero-measure strong")
                .evaluate((element) => element.scrollWidth <= element.clientWidth),
            ).toBe(true);
          }
        }
      }
    }
  }
  expect(errors).toEqual([]);
});

test("documentation and report import remain keyboard accessible in both languages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const chartRequests = [];
  page.on("request", (request) => {
    if (/ExecutionChart|chart-runtime|chart-renderer/.test(request.url())) chartRequests.push(request.url());
  });
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, (route) => route.abort("connectionrefused"));
  await page.goto("/overview", { waitUntil: "networkidle" });
  expect(chartRequests).toEqual([]);
  const trigger = page.getByRole("button", { name: "页面帮助", exact: true });
  const panel = page.locator("dialog.help-documentation");
  await expect(panel).toHaveCount(0);
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await expect(panel.locator("h1")).toHaveText("运行概览");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  const importButton = page.getByRole("button", { name: "导入报告", exact: true });
  await importButton.focus();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  const chooser = await chooserPromise;
  expect(chooser.isMultiple()).toBe(true);
  await chooser.setFiles([]);
  await expect(importButton).toBeFocused();
  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("button", { name: "Import reports", exact: true })).toBeVisible();
  for (const width of [960, 1100, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      const current = await page.locator("html").getAttribute("data-appearance");
      if (current !== theme) await page.getByRole("button", { name: /Switch to (dark|light)/ }).click();
      await page.getByRole("button", { name: "Page help", exact: true }).click();
      await expect(panel).toHaveAttribute("lang", "en");
      await expect(panel.getByRole("heading", { name: "Terms and definitions", exact: true })).toBeAttached();
      expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.keyboard.press("Escape");
    }
  }
  expect(chartRequests).toEqual([]);
});
