import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(readFileSync(new URL("../fixtures/operator-execution.json", import.meta.url), "utf8"));

const bridge = process.env.TILESIM_OPERATOR_TEST_BRIDGE;
test.skip(!bridge, "Requires isolated native operator test harness; no mocked run execution");
test.use({ launchOptions: { executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" } });
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const response = await route.fetch({ url: bridge + url.pathname + url.search, timeout: 90000 });
    await route.fulfill({ response });
  });
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});
for (const [mode, label] of [
  ["kernel_strategy", "Kernel 策略配置"],
  ["tilelang_source", "TileLang 源码 Kernel"],
  ["execution_partition", "执行划分程序"],
]) {
  test(`native ${mode} create → evidence → shared replay`, async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/experiment");
    const panel = page.getByRole("region", { name: "算子与 Kernel", exact: true });
    await expect(panel.getByText("pending · 正在读取并探测后端能力")).toHaveCount(0, { timeout: 45000 });
    await panel.getByRole("radio", { name: label, exact: true }).check();
    await panel.getByRole("button", { name: "载入匹配的合成请求与拓扑示例" }).click();
    if (mode === "kernel_strategy") {
      await panel.getByRole("button", { name: "prefill/norm_qkv", exact: true }).click();
      await panel
        .getByLabel("/kernel_execution/operations/prefill~1norm_qkv/view", { exact: true })
        .selectOption("aggregate");
      await panel
        .getByLabel("/kernel_execution/operations/prefill~1norm_qkv/view", { exact: true })
        .selectOption("expanded");
    }
    if (mode === "tilelang_source")
      await panel.getByLabel("/tilelang_kernels/0/source/payload_mode", { exact: true }).selectOption("materialized");
    await expect(panel.getByRole("button", { name: "运行前校验（真实 CLI）" })).toBeEnabled();
    await panel.getByRole("button", { name: "运行前校验（真实 CLI）" }).focus();
    await page.keyboard.press("Enter");
    await expect(panel.getByText("available · 当前请求已验证")).toBeVisible({ timeout: 45000 });
    const responsePromise = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/runs" && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "运行 TileSim 模拟", exact: true }).focus();
    await page.keyboard.press("Enter");
    const response = await responsePromise;
    expect(response.status()).toBe(202);
    const run = await response.json();
    expect(run.run_id).toBeTruthy();
    await expect
      .poll(
        async () => {
          const r = await page.request.get(`${bridge}/api/runs/${run.run_id}`);
          return (await r.json()).status;
        },
        { timeout: 45000 },
      )
      .toBe("completed");
    await page.goto(`/execution?run=${run.run_id}`);
    await page.getByRole("button", { name: /^执行语义建模模块/ }).click();
    await page.locator(".execution-detail-disclosure > summary").click();
    const evidence = page.getByRole("region", { name: "算子 Kernel 执行片段证据", exact: true });
    await expect(evidence.getByRole("link", { name: "回放片段" }).first()).toBeVisible({ timeout: 45000 });
    if (mode !== "execution_partition")
      await evidence.getByRole("combobox").selectOption(mode === "kernel_strategy" ? "expanded" : "tilelang_source");
    await evidence.locator("tbody button").first().click();
    await expect(evidence.getByRole("region", { name: "执行片段详情" })).toBeVisible();
    if (mode === "kernel_strategy")
      await expect(evidence.getByRole("region", { name: "执行片段详情" })).toContainText(
        "modeled_synchronized_waves_not_measured_cta_timing",
      );
    for (const [width, theme] of [
      [1440, "light"],
      [1180, "dark"],
    ]) {
      await page.setViewportSize({ width, height: 1100 });
      if ((await page.locator("html").getAttribute("data-appearance")) !== theme)
        await page
          .getByRole("button", { name: theme === "dark" ? "切换到深色模式" : "切换到浅色模式", exact: true })
          .click();
      await evidence.getByRole("region", { name: "执行片段详情" }).scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `tmp/operator-fragment-${mode}-${width}-${theme}.png` });
    }
    await evidence.getByRole("link", { name: "回放片段" }).first().click();
    await expect(page).toHaveURL(/fragment=/);
    const replayUrl = new URL(page.url());
    await expect(evidence.locator("p").filter({ hasText: `共享回放游标：` }).first()).toContainText(
      `${replayUrl.searchParams.get("cursor_ps")} ps`,
    );
    await expect(evidence.getByRole("region", { name: "执行片段详情" })).toBeVisible();
    if (mode === "tilelang_source") {
      await evidence.getByText("TileLang CPU 语义结果 / 独立 timeline", { exact: true }).click();
      await expect(evidence.getByRole("region", { name: "TileLang CPU 语义结果" })).toContainText("completed");
      await expect(evidence.getByRole("region", { name: "TileLang CPU 语义结果" })).toContainText(
        "cpu_source_semantics_and_synthetic_consistency",
      );
    }
    await evidence.screenshot({ path: `tmp/operator-result-${mode}.png` });
    await evidence.getByRole("link", { name: "原始证据", exact: true }).first().click();
    await expect(page).toHaveURL(/raw-evidence/);
  });
}
test("native rejection does not create a run", async ({ page }) => {
  let createCount = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/runs" && request.method() === "POST") createCount++;
  });
  await page.goto("/experiment");
  const panel = page.getByRole("region", { name: "算子与 Kernel", exact: true });
  await panel.getByRole("radio", { name: "TileLang 源码 Kernel", exact: true }).check();
  await panel.getByRole("button", { name: "载入匹配的合成请求与拓扑示例" }).click();
  await panel.getByLabel("/tilelang_kernels/0/source/arguments/M", { exact: true }).fill("16");
  await panel.getByLabel("/tilelang_kernels/0/source/arguments/M", { exact: true }).press("Tab");
  await panel.getByRole("button", { name: "运行前校验（真实 CLI）" }).click();
  await expect(panel.getByRole("alert")).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole("button", { name: "运行 TileSim 模拟", exact: true })).toBeDisabled();
  expect(createCount).toBe(0);
  await panel.screenshot({ path: "tmp/operator-validation-error.png" });
});

test("native explicit TP2 source preserves ranks and finite admission evidence", async ({ page }) => {
  test.setTimeout(90000);
  const input = structuredClone(fixture.examples.tilelang_source);
  input.dense_execution.explicit_rank_execution = true;
  const selection = input.tilelang_kernels[0];
  Object.assign(selection.source.arguments, { K: 4, block_N: 4, use_persistent_primitive: true });
  Object.assign(selection, {
    rank_programs: { gpu0: structuredClone(selection.source), gpu1: structuredClone(selection.source) },
    output_policy: "tile_ready_allreduce",
    output_buffer_slots: 2,
    output_admission_policy: "safe_window_v1",
  });
  const custom = structuredClone(fixture.custom_inputs);
  Object.assign(custom.runtime_trace.requests[0], { tp_degree: 2, participants: ["gpu0", "gpu1"] });
  const response = await page.request.post(`${bridge}/api/runs`, {
    headers: { "Idempotency-Key": `operator-browser-tp2-${Date.now()}` },
    data: { scenario_id: "s1_des_example", fidelity_policy: "des", custom_inputs: custom, execution_input: input },
  });
  expect(response.status()).toBe(202);
  const run = await response.json();
  await expect
    .poll(async () => (await (await page.request.get(`${bridge}/api/runs/${run.run_id}`)).json()).status, {
      timeout: 45000,
    })
    .toBe("completed");
  await page.goto(`/execution?run=${run.run_id}`);
  await page.getByRole("button", { name: /^执行语义建模模块/ }).click();
  await page.locator(".execution-detail-disclosure > summary").click();
  const evidence = page.getByRole("region", { name: "算子 Kernel 执行片段证据", exact: true });
  await evidence.getByText("运行输入 / Kernel / source selection / provenance", { exact: true }).click();
  const sourceSummary = evidence.locator("summary").filter({ hasText: "output-gemm · prefill / attention_output" });
  await sourceSummary.click();
  await expect(evidence).toContainText('显式 Rank：["gpu0","gpu1"]');
  await expect(evidence).toContainText("safe_window_v1");
  await evidence.locator("tbody button").first().click();
  await expect(evidence.getByRole("region", { name: "执行片段详情" })).toContainText("tp_rank");
  await evidence.screenshot({ path: "tmp/operator-explicit-tp2-result.png" });
});

test("descriptor loading unavailable and unsupported states stay closed", async ({ page }) => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/operator-execution", async (route) => {
    await pending;
    const health = await (await page.request.get(`${bridge}/api/health`)).json();
    const manifest = await (await page.request.get(`${bridge}/api/manifest`)).json();
    await route.fulfill({
      json: {
        schema_version: "tilesim.bridge.operator_execution.v1",
        schema_set_revision: manifest.schema_set_revision,
        backend_identity: health,
        modes: Object.fromEntries(
          ["kernel_strategy", "tilelang_source", "execution_partition"].map((mode) => [
            mode,
            { status: "unavailable", reason: "视觉测试：当前后端不支持所选执行来源" },
          ]),
        ),
        examples: null,
        custom_inputs: null,
      },
    });
  });
  await page.goto("/experiment");
  const panel = page.getByRole("region", { name: "算子与 Kernel", exact: true });
  await expect(panel.getByText("pending · 正在读取并探测后端能力")).toBeVisible();
  await panel.screenshot({ path: "tmp/operator-pending.png" });
  release();
  await panel.getByRole("radio", { name: "Kernel 策略配置", exact: true }).check();
  await expect(panel).toContainText("视觉测试：当前后端不支持所选执行来源");
  await expect(page.getByRole("button", { name: "运行 TileSim 模拟", exact: true })).toBeDisabled();
  await panel.screenshot({ path: "tmp/operator-unavailable.png" });
  await page.unroute("**/api/operator-execution");
  await page.route("**/api/operator-execution", (route) =>
    route.fulfill({ json: { schema_version: "future", schema_set_revision: "future" } }),
  );
  await panel.getByRole("button", { name: "刷新能力", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("unsupported_schema");
  await panel.screenshot({ path: "tmp/operator-unsupported.png" });
  await expect(page.getByRole("button", { name: "运行 TileSim 模拟", exact: true })).toBeDisabled();
});
test("desktop light dark and keyboard fit", async ({ page }) => {
  await page.goto("/experiment");
  const panel = page.getByRole("region", { name: "算子与 Kernel", exact: true });
  await panel.getByRole("radio", { name: "Kernel 策略配置", exact: true }).check();
  await panel.getByRole("button", { name: "载入匹配的合成请求与拓扑示例" }).click();
  for (const width of [1440, 1180])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1100 });
      const actual = await page.locator("html").getAttribute("data-appearance");
      if (actual !== theme)
        await page
          .getByRole("button", { name: theme === "dark" ? "切换到深色模式" : "切换到浅色模式", exact: true })
          .click();
      await expect(page.locator("html")).toHaveAttribute("data-appearance", theme);
      await panel.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(panel.getByRole("radio", { name: "Kernel 策略配置", exact: true })).toBeInViewport();
      await panel.screenshot({ path: `tmp/operator-${width}-${theme}.png` });
    }
  for (const label of ["TileLang 源码 Kernel", "执行划分程序"]) {
    await panel.getByRole("radio", { name: label, exact: true }).focus();
    await page.keyboard.press("Space");
    if (label === "TileLang 源码 Kernel") {
      const source = panel.getByRole("textbox", { name: "TileLang 源码", exact: true });
      await source.focus();
      await page.keyboard.press("Tab");
    } else {
      await panel.getByRole("textbox", { name: "/program_id", exact: true }).fill("长中文执行划分名称".repeat(12));
      await panel.getByRole("textbox", { name: "/program_id", exact: true }).press("Tab");
    }
    for (const width of [1440, 1180])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 1100 });
        if ((await page.locator("html").getAttribute("data-appearance")) !== theme)
          await page
            .getByRole("button", { name: theme === "dark" ? "切换到深色模式" : "切换到浅色模式", exact: true })
            .click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await panel.screenshot({
          path: `tmp/operator-${label === "执行划分程序" ? "partition" : "source"}-${width}-${theme}.png`,
        });
      }
  }
});
