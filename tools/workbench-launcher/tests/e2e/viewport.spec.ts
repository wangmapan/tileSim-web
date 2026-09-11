import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 800, height: 600 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`${viewport.width}x${viewport.height} 无横向裁切且主要操作可达`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "启动并打开" })).toBeVisible();
    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      main: document.querySelector("main")?.getBoundingClientRect().toJSON(),
      status: document.querySelector(".statusbar")?.getBoundingClientRect().toJSON(),
    }));
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    expect(metrics.main.x).toBeGreaterThanOrEqual(0);
    expect(metrics.main.right).toBeLessThanOrEqual(viewport.width);
    expect(metrics.status.bottom).toBeLessThanOrEqual(viewport.height);
  });
}

for (const scale of [1.5, 2]) {
  test(`${scale * 100}% device scale 保持布局和焦点`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: scale,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(baseURL ?? "http://127.0.0.1:4187");
    const action = page.getByRole("button", { name: "启动并打开" });
    await expect(action).toBeVisible();
    await action.focus();
    await expect(action).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
    await context.close();
  });
}
