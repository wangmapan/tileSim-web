import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openPage(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "服务未启动" })).toBeVisible();
}

test("首屏给出状态、主要操作和下一步", async ({ page }) => {
  await openPage(page);
  await expect(page.getByRole("button", { name: "启动并打开" })).toBeVisible();
  await expect(page.getByText("建议下一步")).toBeVisible();
  await expect(page.getByText("a876859a44f6")).not.toBeVisible();
  await page.getByText("专业详情", { exact: true }).click();
  await expect(page.getByText("a876859a44f6").first()).toBeVisible();
});

test("鼠标滚轮、滚动条和键盘滚动均作用于主区域", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await openPage(page);
  await page.getByRole("button", { name: "环境诊断" }).click();
  await page.getByText("路径发现结果", { exact: true }).click();
  const main = page.getByRole("main");
  await main.focus();
  const initial = await main.evaluate((element) => element.scrollTop);
  await page.mouse.move(760, 420);
  await page.mouse.wheel(0, 420);
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBeGreaterThan(initial);
  await main.press("Home");
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBe(0);
  await main.press("PageDown");
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await main.press("End");
  const atEnd = await main.evaluate(
    (element) => Math.ceil(element.scrollTop + element.clientHeight) >= element.scrollHeight,
  );
  expect(atEnd).toBe(true);
});

test("Tab、Shift+Tab、Enter、Space 和 Escape 可完成导航与确认", async ({ page }) => {
  await openPage(page);
  await page.getByRole("button", { name: "启动与服务" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "启动已验证的本地版本" })).toBeVisible();
  const openButton = page.getByRole("button", { name: "只打开网页" });
  await openButton.focus();
  await page.keyboard.press("Space");
  await expect.poll(() => page.locator("html").getAttribute("data-fixture-opened")).toBe("true");
  const start = page.getByRole("button", { name: "启动并打开" });
  await start.click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "返回" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "确认继续" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "返回" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(start).toBeFocused();
  await start.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(openButton).toBeFocused();
});

test("修改型操作防重复提交并在完成后恢复焦点", async ({ page }) => {
  await openPage(page);
  const trigger = page.getByRole("button", { name: "启动并打开" });
  await trigger.click();
  await page.getByRole("button", { name: "确认继续" }).click();
  await expect(trigger).toBeDisabled();
  await expect(page.getByText("操作已完成。")).toBeVisible();
  await expect(trigger).toBeEnabled();
  await expect(trigger).toBeFocused();
});

test("表单错误聚焦第一个字段且模型 Key 不进入 DOM 或日志", async ({ page }) => {
  await openPage(page);
  await page.getByRole("button", { name: "模型服务" }).click();
  const baseUrl = page.locator("#model-base-url");
  await baseUrl.fill("http://provider.example.invalid");
  await page.getByRole("button", { name: "保存模型设置" }).click();
  await expect(baseUrl).toBeFocused();
  await expect(page.getByText("请填写 HTTPS 地址")).toBeVisible();

  const secret = "playwright-secret-never-render";
  await baseUrl.fill("https://provider.example.invalid/v1");
  await page.locator("#model-api-key").fill(secret);
  await page.getByRole("button", { name: "保存模型设置" }).click();
  await expect(page.locator("#model-api-key")).toHaveValue("");
  await expect(page.locator("body")).not.toContainText(secret);
  expect(await page.content()).not.toContain(secret);
  await expect(page.getByText("操作已完成。")).toBeVisible();
  await expect(page.getByRole("button", { name: "保存模型设置" })).toBeFocused();
  await page.getByRole("button", { name: "操作日志" }).click();
  await expect(page.locator("body")).not.toContainText(secret);
});

test("错误先给解决办法，并支持展开和复制脱敏详情", async ({ page }) => {
  await openPage(page);
  await page.getByRole("button", { name: "更新与部署" }).click();
  await page.locator("#backend-repository").fill("D:\\触发失败\\后端源码");
  await page.getByRole("button", { name: "更新并部署最新 main" }).click();
  await page.getByRole("button", { name: "确认继续" }).click();
  await expect(page.getByRole("heading", { name: "下一步怎么做" })).toBeVisible();
  await expect(page.getByText("检查部署目录并保留这些修改")).toBeVisible();
  await page.getByText("技术详情", { exact: true }).click();
  await expect(page.getByText("local changes; update aborted at <path>")).toBeVisible();
  await page.getByRole("button", { name: "复制技术详情" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
});

test("深浅主题和 reduced motion 均可识别", async ({ page }) => {
  await openPage(page);
  await page.getByRole("button", { name: "切换到深色主题" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expect(page.getByRole("button", { name: "切换到浅色主题" })).toBeVisible();
  const motion = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  expect(typeof motion).toBe("boolean");
});

test("诊断展示 Git、WSL、Node、WebView2 与中文路径", async ({ page }) => {
  await openPage(page);
  await page.getByRole("button", { name: "环境诊断" }).click();
  for (const label of ["Git", "WSL2", "内置 Node", "WebView2", "部署清单"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await page.getByText("路径发现结果").click();
  await expect(page.getByRole("main").getByText("D:\\工作区\\TileSim Web", { exact: true })).toBeVisible();
});

test("核心界面没有严重可访问性违规", async ({ page }) => {
  await openPage(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
