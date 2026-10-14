import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openPage(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "服务未启动" })).toBeVisible();
}

test("首屏给出状态、主要操作和下一步", async ({ page }) => {
  await openPage(page);
  await expect(page.getByRole("button", { name: "一键启动工作台" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新部署当前代码" })).toBeVisible();
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

test("Enter、Space 和 Escape 可完成导航与部署确认", async ({ page }) => {
  await openPage(page);
  await page.getByRole("button", { name: "部署设置", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "部署设置", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "概览" }).click();
  const deploy = page.getByRole("button", { name: "重新部署当前代码" });
  await deploy.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "返回" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "确认继续" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "返回" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(deploy).toBeFocused();
  await deploy.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "一键启动工作台" })).toBeFocused();
});

test("修改型操作防重复提交并在完成后恢复焦点", async ({ page }) => {
  await openPage(page);
  const trigger = page.getByRole("button", { name: "一键启动工作台" });
  await trigger.click();
  await expect(trigger).toBeDisabled();
  await expect(page.getByText("操作已完成。")).toBeVisible();
  await expect(trigger).toBeEnabled();
  await expect(trigger).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-fixture-opened", "true");
  await page.locator("html").evaluate((element) => delete (element as HTMLElement).dataset.fixtureOpened);
  await trigger.click();
  await expect(page.locator("html")).toHaveAttribute("data-fixture-opened", "true");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("启动显示持续计时、当前阶段和不伪造百分比的进度条", async ({ page }) => {
  await page.goto("/?fixture=slow");
  await page.getByRole("button", { name: "一键启动工作台" }).click();
  const progress = page.getByRole("region", { name: "操作进度" });
  await expect(progress).toContainText("启动工作台");
  await expect(progress.getByRole("progressbar")).toBeVisible();
  await expect(progress.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow", /./);
  await expect(progress).toContainText("验证部署");
  await expect(progress).toContainText("启动服务");
  await expect.poll(async () => progress.locator(".operation-progress__elapsed").textContent()).toMatch(/已用 [1-9]/);
  await expect(progress).toContainText("操作完成");
  await expect(progress.getByRole("progressbar")).toHaveCount(0);
});

test("重新部署默认显示快速复用路径，完整日志可达", async ({ page }) => {
  await page.goto("/?fixture=slow");
  await page.getByRole("button", { name: "重新部署当前代码" }).click();
  await page.getByRole("button", { name: "确认继续" }).click();
  const progress = page.getByRole("region", { name: "操作进度" });
  await expect(progress).toContainText("部署当前代码");
  await expect(progress.getByRole("progressbar")).toBeVisible();
  await expect(progress).toContainText("构建 Web");
  await expect(progress).toContainText("操作完成");
  await progress.getByRole("button", { name: "查看完整日志" }).click();
  await expect(page.getByRole("heading", { name: "操作日志", level: 2 })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("[fixture] building_web");
});

test("可显式要求本地部署完整验证", async ({ page }) => {
  await page.goto("/?fixture=slow");
  await page.getByRole("button", { name: "部署设置", exact: true }).click();
  await page.getByLabel("强制完整验证").check();
  await page.getByRole("button", { name: "概览" }).click();
  await page.getByRole("button", { name: "重新部署当前代码" }).click();
  await page.getByRole("button", { name: "确认继续" }).click();
  const progress = page.getByRole("region", { name: "操作进度" });
  await expect(progress).toContainText("构建后端");
  await expect(progress).toContainText("验证 Web");
  await expect(progress).toContainText("操作完成");
});

test("从部署设置底部发起远端更新时进度条回到可见区域", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("/?fixture=slow");
  await page.getByRole("button", { name: "部署设置", exact: true }).click();
  await page.getByText("高级操作：远端更新与停止服务").click();
  await page.getByRole("button", { name: "更新并部署最新 main" }).click();
  await page.getByRole("button", { name: "确认继续" }).click();
  const progress = page.getByRole("region", { name: "操作进度" });
  await expect(progress.getByRole("progressbar")).toBeVisible();
  await expect.poll(() => page.getByRole("main").evaluate((element) => element.scrollTop)).toBe(0);
  const box = await progress.boundingBox();
  expect(box?.y).toBeGreaterThan(50);
  expect(box?.y).toBeLessThan(600);
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
  await page.getByRole("button", { name: "部署设置", exact: true }).click();
  await page.locator("#backend-repository").fill("D:\\触发失败\\后端源码");
  await page.getByText("高级操作：远端更新与停止服务").click();
  await page.getByRole("button", { name: "更新并部署最新 main" }).click();
  await page.getByRole("button", { name: "确认继续" }).click();
  await expect(page.getByRole("heading", { name: "下一步怎么做" })).toBeVisible();
  await expect(page.getByText("检查部署目录并保留这些修改")).toBeVisible();
  await page.getByText("技术详情", { exact: true }).click();
  await expect(page.getByText("local changes; update aborted at <path>")).toBeVisible();
  await page.getByRole("button", { name: "复制技术详情" }).click();
  await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
});

test("本地部署是首屏操作，需确认且不会获取远端", async ({ page }) => {
  await openPage(page);
  const local = page.getByRole("button", { name: "重新部署当前代码" });
  await local.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("包括未提交改动");
  await expect(dialog).toContainText("不 fetch、不 push、不切换分支");
  await page.getByRole("button", { name: "返回" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(local).toBeFocused();
  await local.click();
  await page.getByRole("button", { name: "确认继续" }).click();
  await expect(page.getByText("操作已完成。")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-fixture-opened", "true");
  await page.getByRole("button", { name: "操作日志" }).click();
  await expect(page.getByRole("main")).not.toContainText("[fixture] fetching");
});

test("首次一键启动先确认本地部署，失败不打开网页", async ({ page }) => {
  await page.goto("/?fixture=no-manifest");
  await page.getByRole("button", { name: "一键启动工作台" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("部署当前本地工作树？");
  await page.getByRole("button", { name: "返回" }).click();
  await page.getByRole("button", { name: "部署设置", exact: true }).click();
  await page.locator("#backend-repository").fill("D:\\触发失败\\后端源码");
  await page.getByRole("button", { name: "概览" }).click();
  await page.getByRole("button", { name: "一键启动工作台" }).click();
  await page.getByRole("button", { name: "确认继续" }).click();
  await expect(page.getByRole("heading", { name: "下一步怎么做" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-fixture-opened", "true");
});

test("缺少后端目录时引导到设置并聚焦错误字段", async ({ page }) => {
  await openPage(page);
  await page.getByRole("button", { name: "部署设置", exact: true }).click();
  await page.locator("#backend-repository").fill("");
  await page.getByRole("button", { name: "概览" }).click();
  await page.getByRole("button", { name: "重新部署当前代码" }).click();
  await expect(page.locator("#backend-repository")).toBeFocused();
  await expect(page.getByText("请选择后端仓库目录。")).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
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
