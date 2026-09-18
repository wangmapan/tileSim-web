import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openOffline(page) {
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, (route) => route.abort("connectionrefused"));
  await page.goto("/overview", { waitUntil: "networkidle" });
}

test("RGB spectrum edits are opt-in, keyboard accessible, persistent and independent of appearance", async ({
  page,
}) => {
  const errors = [];
  const charts = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/ExecutionChart|chart-runtime|chart-renderer/.test(request.url())) charts.push(request.url());
  });
  await openOffline(page);
  const opener = page.locator(".theme-toggle");
  await opener.click();
  const editor = page.getByRole("dialog", { name: "主题颜色", exact: true });
  const original = await page
    .locator("html")
    .evaluate((element) => getComputedStyle(element).getPropertyValue("--accent"));
  const originalWarning = await page
    .locator("html")
    .evaluate((element) => getComputedStyle(element).getPropertyValue("--warning"));
  const url = page.url();
  const originalSidebar = await page
    .locator(".app-sidebar")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const originalHeader = await page
    .locator(".app-header")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await editor.getByRole("textbox", { name: "HEX 颜色" }).fill("#d05a20");
  await expect(editor.getByRole("spinbutton", { name: "红色（R）" })).toHaveValue("208");
  expect(await page.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--accent"))).toBe(
    original,
  );
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(editor.getByRole("textbox", { name: "HEX 颜色" })).toHaveValue("#3376a3");
  const area = await editor.locator(".theme-color-plane").boundingBox();
  await page.mouse.move(area.x + area.width * 0.6, area.y + 30);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width * 0.8, area.y + 80, { steps: 5 });
  await page.mouse.up();
  const picked = await editor.getByRole("textbox", { name: "HEX 颜色" }).inputValue();
  expect(picked).not.toBe("#3376a3");
  await editor.getByRole("slider", { name: "色相", exact: true }).focus();
  await page.keyboard.press("Home");
  expect(await editor.getByRole("textbox", { name: "HEX 颜色" }).inputValue()).not.toBe(picked);
  await editor.getByRole("textbox", { name: "HEX 颜色" }).fill("bad-color");
  await expect(editor.getByRole("button", { name: "应用自定义颜色" })).toBeDisabled();
  await expect(editor.getByRole("alert")).toBeVisible();
  await editor.getByRole("textbox", { name: "HEX 颜色" }).fill("#d05a20");
  await editor.getByRole("button", { name: "应用自定义颜色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
  await expect(opener).toBeFocused();
  expect(page.url()).toBe(url);
  expect(await page.locator(".app-sidebar").evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
    originalSidebar,
  );
  expect(await page.locator(".app-header").evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
    originalHeader,
  );
  const activeBackground = await page
    .locator(".nav-link.active")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(activeBackground).toBe(
    await page.locator(".new-run-button").evaluate((element) => getComputedStyle(element).backgroundColor),
  );
  expect(await page.evaluate(() => localStorage.getItem("tilesim-web.custom-color.v1"))).toBe("#d05a20");
  expect(
    await page.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--warning")),
  ).toBe(originalWarning);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
  await page.getByRole("button", { name: /切换到深色/ }).click();
  await opener.click();
  await expect(editor.getByRole("textbox", { name: "HEX 颜色" })).toHaveValue("#d05a20");
  await expect(editor.getByRole("option")).toHaveCount(0);
  await expect(editor.getByRole("listbox")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await editor.getByRole("button", { name: "重置颜色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blue");
  expect(await page.locator("html").evaluate((element) => element.style.getPropertyValue("--accent"))).toBe("");
  expect(charts).toEqual([]);
  expect(errors).toEqual([]);
});

test("custom colors retain contrast at desktop widths in both languages and themes", async ({ page }) => {
  test.setTimeout(90000);
  await openOffline(page);
  const opener = page.locator(".theme-toggle");
  for (const width of [960, 1100, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ["light", "dark"]) {
      if ((await page.locator("html").getAttribute("data-appearance")) !== mode)
        await page.locator(".appearance-toggle").click();
      await opener.click();
      await page.locator('.theme-color-fields input[type="text"]').fill(mode === "light" ? "#ffff00" : "#000000");
      await page.locator(".theme-color-apply").click();
      await opener.click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(await page.locator(".theme-menu").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.keyboard.press("Escape");
    }
    if (width === 1100) await page.getByRole("button", { name: "切换到英文" }).click();
  }
  await opener.click();
  await expect(page.getByRole("button", { name: "Apply custom color" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Red (R)" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    localStorage.setItem("tilesim-web.theme.v1", "custom");
    localStorage.setItem("tilesim-web.custom-color.v1", "url(invalid)");
  });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blue");
});
