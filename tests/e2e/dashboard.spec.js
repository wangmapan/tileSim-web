import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fixtureCase } from "../helpers/fixtures";
import { createF8ExperimentDescriptor, f8Capabilities, f8SchemaRevision } from "../fixtures/experiment-descriptor";
import { createEvidenceAgentDescriptor, f9DescriptorRevision } from "../fixtures/evidence-agent-descriptor";

const runId = "run-fixture-f1";
const agentOrchestrationCatalog = JSON.parse(
  readFileSync(
    new URL("../../bridge/contracts/agent_orchestration_capability/catalog-content.json", import.meta.url),
    "utf8",
  ),
);

function createAgentOrchestrationCapabilitySnapshot() {
  return {
    schema_identity: "tilesim.bridge.agent_orchestration_capability_snapshot.v1",
    publication_status: "published",
    snapshot_id: "tilesim.agent-orchestration.capability-snapshot",
    snapshot_revision: `sha256:${"2".repeat(64)}`,
    snapshot_digest: `sha256:${"2".repeat(64)}`,
    canonicalization_identity: "tilesim.bridge.canonical_json.v1",
    catalog: structuredClone(agentOrchestrationCatalog),
    release_binding: {
      web_source_identity: "tilesim.web.git",
      web_source_revision: "a".repeat(40),
      web_build_revision: "a".repeat(40),
      backend_identity: "tilesim.backend.git",
      backend_revision: "b".repeat(40),
      schema_set_revision: f8SchemaRevision,
      experiment_descriptor_identity: "tilesim.bridge.experiment_descriptor.v1",
      experiment_descriptor_revision: `sha256:${"3".repeat(64)}`,
      create_run_identity: "tilesim.bridge.create_run_request.v1",
      catalog_revision: agentOrchestrationCatalog.catalog_revision,
      contract_package_revision: agentOrchestrationCatalog.contract_package_revision,
      nested_design_space_identities: [
        "tilesim.design_space.s6_candidates.v1",
        "tilesim.design_space.s6_candidates.v2",
      ],
      default_nested_design_space_identity: "tilesim.design_space.s6_candidates.v1",
    },
    drift_policy: {
      release_binding_mismatch: "fail_closed",
      catalog_revision_mismatch: "fail_closed",
      unknown_identity_or_status: "fail_closed",
    },
  };
}

test("Phase 1 Agent copilot drafts only the eight-field subset without writing application state", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const visualOutput = path.resolve("runtime/visual-review/phase1-agent-copilot");
  await mkdir(visualOutput, { recursive: true });
  const prohibitedRequests = [];
  let capabilityRequests = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/agent/orchestration-capabilities") capabilityRequests += 1;
    if (
      (url.pathname === "/api/runs" && request.method() === "POST") ||
      url.pathname.includes("/agent/evidence-analyses")
    ) {
      prohibitedRequests.push(`${request.method()} ${url.pathname}`);
    }
  });
  const failures = await openFixture(page, fixture, "experiment");
  const batchInput = page.locator('.field[data-field-id="s1.runtime.max_batch_size"] input');
  await batchInput.fill("4");

  await page.getByRole("button", { name: "打开 TileSim 助手", exact: true }).click();
  const panel = page.locator("#tilesim-agent-copilot");
  await expect(panel).toBeVisible();
  await panel.getByRole("textbox", { name: "描述你想理解或调整的内容" }).fill("说明当前页面能做什么");
  await panel.getByRole("button", { name: "提交", exact: true }).click();
  await expect(panel).toContainText("这里可以核对当前实验参数");
  expect(capabilityRequests).toBe(0);

  const resizeHandle = panel.getByRole("separator", { name: "调整助手侧栏宽度" });
  await resizeHandle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(resizeHandle).toHaveAttribute("aria-valuenow", "436");
  await page.setViewportSize({ width: 1920, height: 900 });
  await panel.getByRole("button", { name: "展开", exact: true }).click();
  await expect(panel).toHaveAttribute("data-state", "expanded");
  const dockedBounds = await page.locator(".app-main").evaluate((main) => ({
    mainRight: main.getBoundingClientRect().right,
    panelLeft: document.querySelector("#tilesim-agent-copilot").getBoundingClientRect().left,
  }));
  expect(dockedBounds.mainRight).toBeLessThanOrEqual(dockedBounds.panelLeft + 1);
  await panel.press("Escape");
  await expect(panel).toHaveAttribute("data-state", "open");
  await panel.getByRole("button", { name: "收起", exact: true }).click();
  await expect(panel).toHaveAttribute("data-state", "collapsed");
  await panel.getByRole("button", { name: "展开 TileSim 助手", exact: true }).click();
  await expect(panel).toHaveAttribute("data-state", "open");
  await page.setViewportSize({ width: 1440, height: 900 });

  await panel.getByRole("radio", { name: "提出草案修改" }).check();
  await panel
    .getByRole("textbox", { name: "描述你想理解或调整的内容" })
    .fill("把最大 batch 调整为 8，把横向扩展网络带宽改为 100 Gbps per-link");
  await panel.getByRole("button", { name: "提交", exact: true }).click();

  await expect(panel).toContainText("这是草案，尚未创建运行。");
  expect(capabilityRequests).toBe(1);
  await expect(panel).toContainText("4 → 8");
  await expect(panel).toContainText("100 · Gbps");
  await expect(panel).toContainText("确定性校验：valid");
  const draftDetails = panel.locator('.agent-block[data-block-type="draft_summary"] details');
  await expect(draftDetails).not.toHaveAttribute("open", "");
  await expect(draftDetails.getByText("/overrides/runtime/max_batch_size", { exact: true })).not.toBeVisible();
  await draftDetails.locator("summary").click();
  await expect(draftDetails.getByText("/overrides/runtime/max_batch_size", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(visualOutput, "draft-1440-light.png"), fullPage: true });

  await batchInput.fill("6");
  await expect(panel).toContainText("现有内容使用旧上下文");
  await expect(panel).toContainText("确定性校验：stale");
  const originalUrl = new URL(page.url());
  await page.locator(".nav-link").first().click();
  await expect(page).toHaveURL(/\/overview\?run=run-fixture-f1/);
  await expect(panel).toContainText("现有内容使用旧上下文");
  await page.getByRole("button", { name: "新建实验", exact: true }).click();
  await expect(page).toHaveURL(/\/experiment\?run=run-fixture-f1/);
  await expect(batchInput).toHaveValue("6");
  expect(new URL(page.url()).searchParams.get("run")).toBe(originalUrl.searchParams.get("run"));

  await panel.getByRole("radio", { name: "提出草案修改" }).check();
  await panel.getByRole("textbox", { name: "描述你想理解或调整的内容" }).fill("把带宽改为 100");
  await panel.getByRole("button", { name: "提交", exact: true }).click();
  await expect(panel).toContainText("需要补充的信息");

  await panel.getByRole("radio", { name: "提出草案修改" }).check();
  await panel.getByRole("textbox", { name: "描述你想理解或调整的内容" }).fill("把 TP 改成 8");
  await panel.getByRole("button", { name: "提交", exact: true }).click();
  await expect(panel).toContainText("当前能力不支持");

  await page.getByRole("button", { name: "切换到深色模式", exact: true }).click();
  await expect(panel).toHaveCSS("background-color", "rgb(25, 26, 28)");
  for (const width of [1100, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoUnexpectedTextOverflow(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width !== 1440) {
      await page.screenshot({ path: path.join(visualOutput, `unsupported-${width}-dark.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 720, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(720);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  expect(
    await panel.evaluate((element) =>
      Math.max(...getComputedStyle(element).transitionDuration.split(",").map(parseFloat)),
    ),
  ).toBeLessThanOrEqual(0.001);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);

  const composer = panel.getByRole("textbox", { name: "描述你想理解或调整的内容" });
  await composer.fill("保留这段尚未提交的中文输入");
  await panel.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByRole("button", { name: "打开 TileSim 助手", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "打开 TileSim 助手", exact: true }).click();
  await expect(composer).toHaveValue("保留这段尚未提交的中文输入");

  expect(capabilityRequests).toBe(3);
  expect(prohibitedRequests).toEqual([]);
  expect(failures).toEqual([]);
});

test("Phase 1 Agent copilot fails closed when the formal field binding drifts", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const driftedSnapshot = createAgentOrchestrationCapabilitySnapshot();
  driftedSnapshot.catalog.parameter_descriptors[0].request_json_pointer = "/overrides/workload/drifted";
  const writes = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      (url.pathname === "/api/runs" && request.method() === "POST") ||
      url.pathname.includes("/agent/evidence-analyses")
    ) {
      writes.push(`${request.method()} ${url.pathname}`);
    }
  });
  const failures = await openFixture(page, fixture, "experiment", {
    agentOrchestrationSnapshot: driftedSnapshot,
  });
  await page.getByRole("button", { name: "打开 TileSim 助手", exact: true }).click();
  const panel = page.locator("#tilesim-agent-copilot");
  await panel.getByRole("radio", { name: "提出草案修改" }).check();
  await panel.getByRole("textbox", { name: "描述你想理解或调整的内容" }).fill("把消息大小倍率改为 2");
  await panel.getByRole("button", { name: "提交", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("当前结果无法继续处理");
  await expect(panel.locator('[data-block-type="draft_summary"]')).toHaveCount(0);
  await panel.locator("summary", { hasText: "错误详情" }).click();
  await expect(panel).toContainText("phase1_capability_descriptor_binding_mismatch");
  expect(writes).toEqual([]);
  expect(failures).toEqual([]);
});

test("request evidence rows preserve parallel resources and exact binding details", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const failures = await openFixture(page, fixture, "attribution");
  const panel = page.locator(".run-bound-evidence-panel");
  await expect(panel.locator(".run-bound-peer-group .run-bound-node header strong")).toHaveText([
    "KV Cache",
    "设备执行",
    "集合通信",
  ]);
  await expect(panel.locator(".run-bound-output-boundary")).toHaveText("以下记录不作为延迟因果来源。");
  const reference = panel.locator('.run-bound-node[data-module="S6"] a').first();
  const evidence = new URL(await reference.getAttribute("href"), "http://tilesim.local");
  expect(evidence.searchParams.get("run")).toBe(runId);
  expect(evidence.searchParams.get("evidence_sha")).toMatch(/^[a-f0-9]{64}$/);
  expect(evidence.searchParams.get("evidence_pointer")).toBe("/system_summary/phase_fabric_contributions/0");
  const rule = panel.locator('.run-bound-node[data-module="S6"] .run-bound-binding-rule');
  await expect(rule).not.toHaveAttribute("open", "");
  await rule.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(rule).toHaveAttribute("open", "");
  await expect(rule).toContainText("phase_id");
  const output = path.resolve("runtime/visual-review/batch11/after");
  await mkdir(output, { recursive: true });
  for (const width of [1440, 1100, 960, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoUnexpectedTextOverflow(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const positions = await panel
      .locator(".run-bound-peer-group .run-bound-node")
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(2);
  }
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.getByRole("button", { name: "切换到深色模式", exact: true }).click();
  await panel.locator(".week8-execution-panel > summary").click();
  await expect(panel.locator(".week8-execution-panel")).toContainText("partitioned_des");
  await expect(panel.locator(".week8-execution-panel")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.screenshot({ path: path.join(output, "evidence-fixture-1100-dark-expanded.png"), fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "切换到英文", exact: true }).click();
  await expect(panel.locator('.run-bound-node[data-module="S6"] header strong')).toHaveText("Network request phase");
  await expectNoUnexpectedTextOverflow(page);
  expect(failures).toEqual([]);
});

test("Agent result review keeps claim groups and exact evidence without nested cards", async ({ page }) => {
  const phase = process.env.TILESIM_AGENT_RESULT_REVIEW === "before" ? "before" : "after";
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const failures = await openFixture(page, fixture, "evidence_agent", {
    evidenceAgentConfigured: true,
    evidenceAgentHandler: async ({ request }) => {
      const response = createEvidenceAgentTerminal(request, "completed");
      const finding = response.claims[0];
      finding.text = "测试夹具：这一条陈述引用已校验的请求记录。";
      const limitation = structuredClone(finding);
      limitation.claim_id = "review-limitation";
      limitation.claim_kind = "validation_boundary";
      limitation.text = "测试夹具：合成证据不能替代真实留出验证。";
      const recommendation = structuredClone(finding);
      recommendation.claim_id = "review-next-step";
      recommendation.claim_kind = "conditional_recommendation";
      recommendation.scope.recommendation_semantics = "conditional_not_executed";
      recommendation.text = "测试夹具：建议仅供人工评估，未执行配置变更。";
      response.claims = [recommendation, finding, limitation];
      return { status: 200, body: response };
    },
  });
  await page.locator('[data-help-anchor="evidence_agent-request"] select').selectOption("req-0");
  await page.getByRole("button", { name: "生成解释", exact: true }).click();
  const result = page.locator(".evidence-agent-result");
  await expect(result.locator(".evidence-agent-claim-text")).toHaveCount(3);
  expect(
    await result
      .locator(".evidence-agent-claims > li")
      .evaluateAll((items) => items.map((item) => item.dataset.originalIndex)),
  ).toEqual(["1", "2", "0"]);
  const output = path.resolve("runtime/visual-review/batch10", phase);
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await result.screenshot({ path: path.join(output, "result-fixture-light.png") });
  const disclosure = result.locator(".evidence-agent-claim-evidence > summary").first();
  await disclosure.focus();
  await page.keyboard.press("Enter");
  const citation = result.locator(".evidence-agent-citations a").first();
  const target = new URL(await citation.getAttribute("href"), "http://tilesim.local");
  expect(target.searchParams.get("run")).toBe(runId);
  expect(target.searchParams.get("evidence_sha")).toMatch(/^[a-f0-9]{64}$/);
  expect(target.searchParams.get("evidence_pointer")).toMatch(/^\//);
  await result.locator(".evidence-agent-citation-identity > summary").first().click();
  await expect(result.locator(".evidence-agent-citation-identity").first()).toContainText(
    target.searchParams.get("evidence_sha"),
  );
  for (const width of [1440, 1100, 960, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoUnexpectedTextOverflow(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.getByRole("button", { name: "切换到深色模式" }).click();
  await result.screenshot({ path: path.join(output, "result-fixture-dark-expanded.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (phase === "after") {
    await expect(result.locator(".evidence-agent-claims > li").first()).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(result.locator(".evidence-agent-claims > li").first()).toHaveCSS("border-radius", "0px");
    await expect(result.locator(".section-kicker")).toHaveCount(0);
  }
  expect(failures).toEqual([]);
});

test("P99 table and shared brand stay legible without card styling or inferred navigation", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const failures = await openFixture(page, fixture, "attribution");
  const panel = page.locator(".percentile-subjects");
  await expect(panel.locator("tbody .percentile-value")).toHaveText("9,007,199,254,740,993,123");
  await expect(panel.locator("article")).toHaveCount(0);
  await expect(panel.locator("tbody tr")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const request = panel.getByRole("button", { name: "req-0", exact: true });
  await request.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/evidence_request=req-0/);
  const reference = panel.getByRole("link", { name: "原始记录", exact: true });
  const target = new URL(await reference.getAttribute("href"), "http://tilesim.local");
  expect(target.searchParams.get("run")).toBe(runId);
  expect(target.searchParams.get("evidence_pointer")).toBe("/percentile_subjects/0");
  expect(target.searchParams.get("evidence_sha")).toBe(
    artifactManifestEntries(fixture).find((entry) => entry.artifact_id === "metrics").sha256,
  );
  const summary = panel.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(panel.locator("details code").filter({ hasText: "nearest_rank_backend_selected" })).toBeVisible();
  await page.keyboard.press("Enter");
  const output = path.resolve("runtime/visual-review/batch9/after");
  await mkdir(output, { recursive: true });
  for (const width of [1440, 1100, 960, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.locator(".brand-mark")).not.toHaveCSS("mask-image", "none");
    await expect(page.locator(".brand-mark")).toHaveCSS("animation-name", "none");
    await page.screenshot({ path: path.join(output, `attribution-fixture-${width}-light.png`), fullPage: true });
  }
  const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(favicon).toContain("svg");
  expect(
    await page.evaluate(async (href) => {
      const image = new Image();
      image.src = href;
      await image.decode();
      return image.naturalWidth > 0;
    }, favicon),
  ).toBe(true);
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.getByRole("button", { name: "切换到英文" }).click();
  await page.getByRole("button", { name: /Switch to dark/ }).click();
  await expect(panel.getByRole("heading", { name: "Backend-selected P99 subjects" })).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: path.join(output, "attribution-fixture-1100-dark-en.png"), fullPage: true });
  expect(failures).toEqual([]);
});

test("Agent editor keeps task icons, evidence boundaries and submission visible without invoking a provider", async ({
  page,
}) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const failures = await openFixture(page, fixture, "evidence_agent", { evidenceAgentConfigured: true });
  const select = page.locator('[data-help-anchor="evidence_agent-request"] select');
  await select.selectOption("req-0");
  const submit = page.getByRole("button", { name: "生成解释", exact: true });
  await expect(submit).toBeEnabled();
  const output = path.resolve("runtime/visual-review/batch8/after");
  await mkdir(output, { recursive: true });
  for (const width of [1440, 1100, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await submit.boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
    await expect(page.locator('.evidence-agent-task-cards svg[aria-hidden="true"]')).toHaveCount(4);
    await expect(page.locator(".evidence-agent-submission-preview")).toContainText("仅为合成证据");
    await expectNoUnexpectedTextOverflow(page);
    await page.screenshot({ path: path.join(output, `agent-fixture-${width}-light.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "切换到英文" }).click();
  await page.setViewportSize({ width: 1100, height: 900 });
  const radios = page.locator(".evidence-agent-task-cards input");
  await radios.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(radios.nth(1)).toBeChecked();
  await page.getByRole("button", { name: /Switch to dark/ }).click();
  await expectNoUnexpectedTextOverflow(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: path.join(output, "agent-fixture-1100-dark-en.png"), fullPage: true });
  expect(failures).toEqual([]);
});

test("workbench keeps bounded real-value previews and accessible analysis paths", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const summary = fixture.reports.metrics.system_summary;
  const original = summary.fabric_domain_utilization[0];
  summary.fabric_domain_utilization = Array.from({ length: 40 }, (_, index) => ({
    ...original,
    domain_id: `domain-${index}-long-network-resource-identifier`,
    utilization_ratio: index === 0 ? 0 : 0.67,
  }));
  const chartRequests = [];
  page.on("request", (request) => {
    if (/ExecutionChart|chart-runtime|chart-renderer/.test(request.url())) chartRequests.push(request.url());
  });
  const failures = await openFixture(page, fixture, "overview");
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(page.locator(".overview-domain-list tr")).toHaveCount(6);
  await expect(page.locator(".overview-domain-list tr").first()).toContainText("0%");
  await expect(page.locator(".overview-domain-list tr").last()).toContainText("domain-5-");
  expect(chartRequests).toEqual([]);
  await page.getByRole("button", { name: "切换到英文" }).click();
  for (const appearance of ["light", "dark"]) {
    if (appearance === "dark") await page.getByRole("button", { name: /Switch to dark/ }).click();
    if (appearance === "dark")
      await expect(page.locator(".app-header")).toHaveCSS("background-color", "rgb(25, 26, 28)");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1100);
    await expect(
      page.locator(".overview-domain-list tr").first().locator(".utilization-measure__track > span"),
    ).toHaveCSS("width", "0px");
  }
  const network = page.getByRole("button", { name: "Inspect the network", exact: true });
  await network.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/fabric\?run=run-fixture-f1/);
  await expect(page.locator(".fabric-stage")).toBeVisible();
  await expect(page.locator(".fabric-domain-table tbody tr")).toHaveCount(25);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".fabric-stage .utilization-measure__track > span")).toHaveCSS("animation-name", "none");
  expect(failures).toEqual([]);
});

test("overview keeps a usable first-viewport comparison and keyboard route round trips", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const failures = await openFixture(page, fixture, "overview");
  for (const width of [1440, 1100, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await page.locator(".overview-domain-list tr").first().boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  for (const [label, route] of [
    ["查看执行过程", "execution"],
    ["查看性能指标", "metrics"],
    ["结果可信度", "validation"],
  ]) {
    const button = page.locator(".overview-analysis-index").getByRole("button", { name: label, exact: true });
    await expect(button).toHaveCount(1);
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/${route}\\?run=${runId}`));
    await page.locator(".app-sidebar").getByRole("button", { name: "运行概览", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/overview\\?run=${runId}`));
  }
  const summary = page.locator(".hero-technical-summary > summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".hero-technical-summary p")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator(".hero-technical-summary p")).not.toBeVisible();
  expect(failures).toEqual([]);
});

test("attribution pagination retains exact evidence and keyboard access in English", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const original = fixture.reports.tail.attribution_ranking[0];
  fixture.reports.tail.attribution_ranking = Array.from({ length: 60 }, (_, index) => ({
    ...original,
    attribution_id: `review-${index}`,
    component_code: `network-wait-${index}`,
    rank: 60 - index,
    share: index === 0 ? 0 : 0.25,
  }));
  const failures = await openFixture(page, fixture, "attribution");
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "尾延迟归因", exact: true }).click();
  await expect(page.locator(".ranking-row")).toHaveCount(25);
  await expect(page.locator(".rank-bar span").first()).toHaveCSS("width", "0px");
  const next = page.getByRole("navigation", { name: "贡献项分页" }).getByRole("button", { name: "下一页" });
  await next.focus();
  await page.keyboard.press("Enter");
  const firstRow = page.locator(".ranking-row").first();
  await expect(firstRow).toContainText("network-wait-25");
  await expect(firstRow.locator(".rank-index")).toHaveText("35");
  const evidence = new URL(
    await firstRow.locator("a.artifact-evidence-link").getAttribute("href"),
    "http://tilesim.local",
  );
  expect(evidence.searchParams.get("evidence_pointer")).toBe("/attribution_ranking/25");
  expect(evidence.searchParams.get("evidence_artifact")).toBe("tail-cause-chain");
  expect(evidence.searchParams.get("evidence_sha")).toBe(
    artifactManifestEntries(fixture).find((entry) => entry.artifact_id === "tail-cause-chain").sha256,
  );
  const layout = await page.evaluate(() => ({
    summaryBottom: document.querySelector(".attribution-primary-summary").getBoundingClientRect().bottom,
    chartTop: document.querySelector(".visualization-panel").getBoundingClientRect().top,
  }));
  expect(layout.summaryBottom).toBeLessThanOrEqual(layout.chartTop);
  await page.locator(".attribution-cause-disclosure > summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".cause-chain")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".cause-chain li").first()).toHaveCSS("animation-name", "none");
  await page.getByRole("button", { name: "切换到英文" }).click();
  for (const appearance of ["light", "dark"]) {
    if (appearance === "dark") await page.getByRole("button", { name: /Switch to dark/ }).click();
    await expect(page.getByRole("navigation", { name: "Contribution pagination" })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1100);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".attribution-audit > summary").click();
  await expect(page.locator(".attribution-audit-grid")).toHaveCSS("animation-name", "none");
  expect(failures).toEqual([]);
});

test("attribution research review captures evidence hierarchy across desktop appearances", async ({ page }) => {
  test.setTimeout(180000);
  const phase = process.env.TILESIM_ATTRIBUTION_REVIEW;
  const output = path.resolve("runtime/visual-review/batch4", phase === "before" ? "before" : "after");
  if (phase) await mkdir(output, { recursive: true });
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const failures = await openFixture(page, fixture, "attribution");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1100, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const appearance of ["light", "dark"]) {
      await page.evaluate((mode) => localStorage.setItem("tilesim-web.appearance.v1", mode), appearance);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(".evidence-strip")).toContainText("synthetic-s1-s6-complete");
      await page.getByRole("button", { name: /尾延迟归因/ }).click();
      await expect(page.locator(".execution-chart svg")).toHaveCount(1);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      if (phase)
        await page.screenshot({ path: path.join(output, `attribution-${width}-${appearance}.png`), fullPage: true });
      if (phase !== "before") {
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
      await page.locator(".attribution-audit > summary").click();
      await page.locator(".attribution-cause-disclosure > summary").click();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      if (phase)
        await page.screenshot({ path: path.join(output, `details-${width}-${appearance}.png`), fullPage: true });
      if (phase !== "before") expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  }
  expect(failures).toEqual([]);
});

test("fabric pagination retains exact report pointers and keyboard access in English", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const summary = fixture.reports.metrics.system_summary;
  const sourceDomain = summary.fabric_domain_utilization[0];
  const sourceRequest = summary.request_fabric_contributions[0];
  summary.fabric_domain_utilization = Array.from({ length: 60 }, (_, index) => ({
    ...sourceDomain,
    domain_id: `domain-${index}`,
  }));
  summary.request_fabric_contributions = Array.from({ length: 60 }, (_, index) => ({
    ...sourceRequest,
    request_id: `request-${index}`,
    dominant_phase_id: undefined,
  }));
  delete summary.dominant_fabric_backpressure_domain_id;
  const failures = await openFixture(page, fixture, "fabric");
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".fabric-hotspot-panel")).toContainText("主要通信瓶颈信息不完整");
  await expect(page.locator(".fabric-domain-table tbody tr")).toHaveCount(25);
  await expect(page.locator(".fabric-request-table tbody tr")).toHaveCount(25);
  await expect(page.locator(".domain-card")).toHaveCount(0);
  const domainNext = page.getByRole("navigation", { name: "通信范围明细分页" }).getByRole("button", { name: "下一页" });
  await domainNext.focus();
  await page.keyboard.press("Enter");
  const domainRow = page.locator(".fabric-domain-table tbody tr").first();
  await expect(domainRow).toContainText("domain-25");
  const evidenceUrl = new URL(
    await domainRow.locator("a.artifact-evidence-link").getAttribute("href"),
    "http://127.0.0.1:4173",
  );
  expect(evidenceUrl.searchParams.get("evidence_pointer")).toBe("/system_summary/fabric_domain_utilization/25");
  expect(evidenceUrl.searchParams.get("evidence_sha")).toMatch(/^[a-f0-9]{64}$/);
  const panel = page.locator(".analysis-visualization-stack .visualization-panel").first();
  await panel.locator(".visualization-data > summary").click();
  await expect(panel.locator("tbody tr")).toHaveCount(25);
  await expect(panel.locator(".visualization-table-scroll")).toHaveCSS("animation-name", "none");
  await panel.locator(".record-pager button").last().click();
  await expect(panel.locator("tbody tr").first()).toContainText("domain-25");
  await expect(panel.locator("tbody tr").first()).toContainText("metrics:/system_summary/fabric_domain_utilization/25");
  await panel.locator(".visualization-data > summary").click();
  await expect(panel.locator("tbody tr")).toHaveCount(0);
  await expect(panel.locator(".execution-chart svg")).toHaveCount(1);
  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.locator(".fabric-hotspot-panel")).toContainText(
    "Communication bottleneck information is incomplete",
  );
  await expect(page.getByRole("navigation", { name: "Request communication contribution pagination" })).toBeVisible();
  for (const appearance of ["light", "dark"]) {
    if (appearance === "dark") await page.getByRole("button", { name: /Switch to dark/ }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1100);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".fabric-domain-disclosure > summary").click();
  await expect(page.locator(".domain-grid")).toHaveCSS("animation-name", "none");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(failures).toEqual([]);
});

test("fabric review preserves readable evidence across desktop widths and appearances", async ({ page }) => {
  test.setTimeout(180000);
  const phase = process.env.TILESIM_FABRIC_REVIEW;
  const output = path.resolve("runtime/visual-review/batch3", phase === "before" ? "before" : "after");
  if (phase) await mkdir(output, { recursive: true });
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const failures = await openFixture(page, fixture, "fabric");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const width of [1100, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const appearance of ["light", "dark"]) {
      await page.evaluate((mode) => localStorage.setItem("tilesim-web.appearance.v1", mode), appearance);
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.locator(".analysis-visualization-stack .execution-chart svg")).toHaveCount(2, {
        timeout: 15_000,
      });
      if (phase)
        await page.screenshot({ path: path.join(output, `fabric-${width}-${appearance}.png`), fullPage: true });
      if (phase !== "before") {
        await expect(page.locator(".visualization-table-scroll")).toHaveCount(0);
        await expect(page.locator(".visualization-boundary")).toHaveCount(2);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
      await page.locator(".fabric-domain-disclosure > summary").click();
      await expect(page.locator(".domain-card").first()).toBeVisible();
      if (phase !== "before") await expect(page.locator(".domain-grid")).toHaveCSS("animation-name", "none");
      if (phase === "after") await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      if (phase)
        await page.screenshot({ path: path.join(output, `domains-${width}-${appearance}.png`), fullPage: true });
      if (phase !== "before") {
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
    }
  }
  expect(failures).toEqual([]);
});

test("workflow review captures history and trace evidence at desktop widths", async ({ page }) => {
  test.setTimeout(180000);
  const phase = process.env.TILESIM_WORKFLOW_REVIEW;
  const output = path.resolve("runtime/visual-review/batch2", phase === "before" ? "before" : "after");
  if (phase) await mkdir(output, { recursive: true });
  const failures = await openFixture(page, fixtureCase("synthetic-s1-s6-complete"), "history");
  await page.route("**/api/runs", (route) =>
    route.fulfill({
      json: {
        runs: ["completed", "running", "failed"].map((status, index) => ({
          run_id: `${runId}-${index}-long-identity-for-desktop-layout-verification`,
          run_name: index === 0 ? "网络等待对照实验 · synthetic consistency fixture" : `Fixture ${status}`,
          status,
          input_mode: "controls",
          created_at: "2026-09-01T08:00:00Z",
          digest: index === 0 ? { end_to_end_latency_us: 29229.1, throughput_requests_per_second: 102.64 } : {},
        })),
      },
    }),
  );
  for (const width of [1100, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const appearance of ["light", "dark"]) {
      await page.evaluate((mode) => localStorage.setItem("tilesim-web.appearance.v1", mode), appearance);
      for (const view of ["history", "experiment"]) {
        await page.goto(`/${view}`, { waitUntil: "networkidle" });
        if (view === "history") await expect(page.locator(".run-row")).toHaveCount(3);
        else {
          await page.getByRole("button", { name: "Trace package", exact: true }).click();
          await expect(page.locator(".trace-package-detail")).toContainText("synthetic_trace");
        }
        if (phase)
          await page.screenshot({ path: path.join(output, `${view}-${width}-${appearance}.png`), fullPage: true });
        if (phase !== "before") {
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        }
      }
    }
  }
  expect(failures).toEqual([]);
});
const tracePackageManifestSha256 = `sha256:${"a".repeat(64)}`;

test("history refresh exposes pending and retryable error states without hiding previous records", async ({ page }) => {
  const failures = await openFixture(page, fixtureCase("synthetic-s1-s6-complete"), "history", {
    expectedHttpStatuses: [503],
  });
  await expect(page.locator(".run-row")).toHaveCount(1);
  let releaseRequest;
  const pendingRequest = new Promise((resolve) => {
    releaseRequest = resolve;
  });
  let failed = true;
  let requests = 0;
  await page.route("**/api/runs", async (route) => {
    requests += 1;
    await pendingRequest;
    await route.fulfill({
      status: failed ? 503 : 200,
      json: failed
        ? { error: { code: "history_review_unavailable", message: "History fixture unavailable", retryable: true } }
        : { runs: [] },
    });
  });
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await expect(page.locator(".history-loading")).toBeVisible();
  await expect(page.locator(".history-panel")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".run-row")).toHaveCount(1);
  releaseRequest();
  await expect(page.locator(".history-notice[role=alert]")).toContainText("保留上次加载的记录");
  await expect(page.locator(".history-panel")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".run-row")).toHaveCount(1);
  failed = false;
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await expect(page.locator(".empty-state")).toContainText("尚无运行记录");
  await expect(page.locator(".history-notice[role=alert]")).toHaveCount(0);
  expect(requests).toBe(2);
  expect(failures).toEqual([]);
});

test("workflow controls remain keyboard accessible in English and both appearances", async ({ page }) => {
  const failures = await openFixture(page, fixtureCase("synthetic-s1-s6-complete"), "history");
  await expect(page.locator(".run-row")).toHaveCount(1);
  await page.getByRole("button", { name: "切换到英文" }).click();
  await page.setViewportSize({ width: 1100, height: 900 });
  const search = page.getByRole("searchbox");
  await expect(search).toHaveAccessibleName(/Search/);
  await search.fill("no-matching-run");
  await expect(page.locator(".empty-state")).toContainText("No matching runs");
  const clearSearch = page.getByRole("button", { name: "Clear search" });
  await clearSearch.focus();
  await page.keyboard.press("Enter");
  await expect(search).toHaveValue("");
  for (const appearance of ["light", "dark"]) {
    await page.evaluate((mode) => localStorage.setItem("tilesim-web.appearance.v1", mode), appearance);
    for (const view of ["history", "experiment"]) {
      await page.goto(`/${view}`, { waitUntil: "networkidle" });
      if (view === "experiment") {
        await page.getByRole("button", { name: "Trace package", exact: true }).click();
        const packageButton = page.locator(".trace-package-list").getByRole("button", { name: /real-package/ });
        await packageButton.focus();
        await page.keyboard.press("Enter");
        await expect(packageButton).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator(".trace-evidence-fields")).toContainText("real_trace");
        await expect(page.locator("button.run-submit")).toBeDisabled();
        await expect(page.locator(".trace-integrity-scope")).toHaveText(
          "Integrity checks do not establish calibration or validation.",
        );
      }
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1100);
    }
  }
  expect(failures).toEqual([]);
});

function tracePackageItem(packageId, sourceMode, { boundary = "S1", traceKind = "s1_runtime" } = {}) {
  const submissionAvailable = sourceMode === "synthetic_trace";
  return {
    package_id: packageId,
    producer: { name: "tilesim-trace-fixture", version: "0.1.0" },
    experiment_id: "experiment-trace-fixture",
    physical_run_id: `physical-${packageId}`,
    entry_boundary: boundary,
    entry_trace_kind: traceKind,
    trace_provenance: {
      source_mode: sourceMode,
      calibration_level: "uncalibrated",
      allowed_claim_scope: "exploratory",
      source_id: `fixture:${packageId}`,
      generation_path: "temporary synthetic E2E fixture",
      capture_or_generation_time: "2026-09-03T00:00:00Z",
      upstream_tooling: "playwright fixture",
      trace_kind: "trace_package",
      notes: ["Contract and flow consistency only; not hardware or held-out fidelity evidence."],
    },
    manifest_sha256: tracePackageManifestSha256,
    inspect_status: "valid",
    inspect_errors: [],
    submission_available: submissionAvailable,
    unavailable_reason: submissionAvailable ? null : "source_mode_not_enabled_in_prototype",
    artifact_integrity: {
      complete: true,
      semantic_artifact_count: 6,
      semantic_roles: ["request", "batch", "iteration", "tile_execution", "kv_cache", "network_flow"],
      sha256_verified: true,
      entry_trace_verified: true,
    },
  };
}

const tracePackageCatalog = {
  schema_version: "tilesim.bridge.trace_package_catalog.v1",
  trace_package_schema_identity: "tilesim.trace_package.v1alpha1",
  schema_set_revision: f8SchemaRevision,
  backend_identity: {
    source_revision: "fixture-source",
    build_revision: "fixture-source",
    source_state_digest: "fixture-source-state",
    build_state_digest: "fixture-source-state",
    versions_match: true,
    state_digests_match: true,
    deployment_ref: "fixture:f1",
  },
  capability: { available: true, reason: null },
  packages: [
    tracePackageItem("synthetic-package", "synthetic_trace"),
    tracePackageItem("real-package", "real_trace", { boundary: "S2", traceKind: "s2_execution" }),
    tracePackageItem("compatibility-package", "compatibility_harness_trace", {
      boundary: "S5",
      traceKind: "s5_collective",
    }),
  ],
  discovery_errors: [],
};

const week7EvidenceMap = {
  schema_version: "tilesim.s9.report_field_evidence_map.v1alpha1",
  status: "pass",
  rules: [
    {
      report_kind: "tail_cause_chain_report",
      field_path: "attribution_ranking.share",
      source_object: "TailAttributionRankRecord[].score_ps",
      computation_rule: "Normalize every positive score by the same total score.",
      validation_check: "attribution_share_conservation",
      allowed_claim: "A relative ranking, not unexplained wall time.",
    },
  ],
};

const week7Calibration = {
  schema_version: "tilesim.calibration.workflow_report.v1alpha1",
  report_id: "fixture-calibration-workflow",
  manifest_id: "week7-offline-calibration-assets-v1",
  status: "passed",
  evidence_tier: "offline_fixture_consistency",
  allowed_claim_scope: "workflow_consistency_only",
  scopes: [
    {
      subsystem: "S6",
      fit_scope: "link",
      input_unit: "predicted_us",
      observed_unit: "observed_us",
      operating_region: { fabric: "offline_reference", topology: "two_endpoint" },
      calibration_sample_count: 4,
      held_out_sample_count: 2,
      selected_model: { model_kind: "affine", slope: 1.02, intercept: 0.1, selection_mae: 0 },
      held_out_mae: 0,
      held_out_p95_relative_error: 0,
      held_out_max_relative_error: 0,
      relative_error_budget: 0.02,
      error_budget_passed: true,
      calibration_asset_ids: ["link_calibration_fixture_v1"],
      calibration_asset_sha256: ["39f5aa9d5f449ec33ab8494bd9c5bc9d436ae36ed9c7044fb6bd501495737159"],
      held_out_asset_ids: ["link_held_out_fixture_v1"],
      held_out_asset_sha256: ["797a483707454b4719df29873d4825d47404748ebfc5748314b879096d3d997c"],
    },
  ],
  errors: [],
};

const week7Orchestration = {
  schema_version: "tilesim.agent.orchestration_report.v1alpha1",
  intent_id: "week7-synthetic-s1-s6-example",
  status: "completed",
  run_instance_id: "week7-synthetic-s1-s6-example::fnv1a64:test",
  frozen_configuration_digest: "fnv1a64:test",
  simulation_result_status: "partial",
  simulation_result_digest: "fnv1a64:result",
  tool_calls: ["parse_intent", "validate_constraints", "freeze_configuration", "execute_range", "query_artifacts"].map(
    (tool_name, index) => ({
      sequence: index + 1,
      tool_name,
      status: "passed",
      input_digest: `fnv1a64:input-${index + 1}`,
      output_reference: index === 4 ? "artifact_count=4" : `output-${index + 1}`,
    }),
  ),
  artifact_results: [
    { artifact_id: "execution_envelope", state: "ready", payload_digest: "fnv1a64:execution" },
    { artifact_id: "metrics_report", state: "ready", payload_digest: "fnv1a64:metrics" },
  ],
  errors: [],
};

function artifactFor(fixture, artifact) {
  return {
    "input-runtime-trace": fixture.inputs.runtime_trace,
    "input-topology": fixture.inputs.topology,
    "run-result": fixture.reports.run
      ? { ...fixture.reports.run, summary: { ...fixture.reports.run.summary, run_id: runId } }
      : null,
    metrics: fixture.reports.metrics,
    validation: fixture.reports.validation,
    "tail-cause-chain": fixture.reports.tail,
    "execution-envelope": fixture.reports.execution_envelope,
    "design-space": fixture.reports.design_space,
    "week8-run-evidence": fixture.reports.run_bound_des_evidence,
  }[artifact];
}

function artifactManifestEntries(fixture) {
  const definitions = [
    ["input-runtime-trace", null],
    ["input-topology", null],
    ["run-result", "run"],
    ["metrics", "metrics"],
    ["validation", "validation"],
    ["tail-cause-chain", "tail"],
    ["execution-envelope", "execution_envelope"],
    ["design-space", "design_space"],
    ["week8-run-evidence", "run_bound_des_evidence"],
  ];
  return definitions.flatMap(([artifactId, reportKind]) => {
    const value = artifactFor(fixture, artifactId);
    if (value === undefined || value === null) return [];
    const body = JSON.stringify(value);
    return [
      {
        artifact_id: artifactId,
        report_kind: reportKind,
        file_name: `${artifactId}.json`,
        media_type: "application/json",
        bytes: Buffer.byteLength(body),
        sha256: createHash("sha256").update(body).digest("hex"),
        schema_identity: value.contract_version || value.schema_version || "",
        contract_status: [
          "wind_tunnel.run.v1alpha1",
          "design_space.report.v1alpha1",
          "tilesim.design_space_report.v1",
          "tilesim.s6_topology_input.v1",
          "tilesim.metrics_report.v1",
          "tilesim.validation_report.v1",
          "tilesim.tail_cause_chain_report.v1",
          "tilesim.s7_execution_envelope.v1",
          "tilesim.s7_run_bound_des_evidence.v1",
        ].includes(value.contract_version || value.schema_version || "")
          ? "supported"
          : "legacy_compatibility",
      },
    ];
  });
}

function addWeek8Contracts(fixture, linkedRequestId) {
  const requestSubject = { kind: "request", id: linkedRequestId, request_id: linkedRequestId };
  const requestEvidence = {
    run_id: runId,
    artifact_id: "metrics",
    schema_identity: "tilesim.metrics_report.v1",
    json_pointer: "/request_metrics/0",
    availability: "available",
    subject: requestSubject,
  };
  Object.assign(fixture.reports.metrics, {
    schema_version: "tilesim.metrics_report.v1",
    run_id: runId,
    percentile_subjects: [
      {
        metric_kind: "end_to_end_latency_ps",
        percentile: 99,
        value_ps: "9007199254740993123",
        selection_rule: "nearest_rank_backend_selected",
        selection_semantics: "single_request",
        selected_request_id: linkedRequestId,
        member_request_ids: [linkedRequestId],
        subject_refs: [requestSubject],
      },
    ],
  });
  fixture.reports.metrics.system_summary.phase_fabric_contributions.forEach((phase) => {
    phase.not_s5_collective = !phase.collective_id;
  });
  Object.assign(fixture.reports.execution_envelope, {
    schema_version: "tilesim.s7_execution_envelope.v1",
    run_id: runId,
    evidence_refs: [],
  });
  Object.assign(fixture.reports.execution_envelope.stages[0], {
    subject_refs: [requestSubject],
    evidence_refs: [requestEvidence],
  });
  Object.assign(fixture.reports.validation, {
    schema_version: "tilesim.validation_report.v1",
    run_id: runId,
  });
  Object.assign(fixture.reports.validation.checks[0], {
    subject_refs: [requestSubject],
    evidence_refs: [requestEvidence],
  });
  Object.assign(fixture.reports.tail, {
    schema_version: "tilesim.tail_cause_chain_report.v1",
    run_id: runId,
  });
  Object.assign(fixture.reports.tail.cause_chain[0], {
    cause_id: "cause-week8-e2e",
    subject_refs: [requestSubject],
    evidence_refs: [requestEvidence],
  });
  Object.assign(fixture.reports.tail.attribution_ranking[0], {
    attribution_id: "attribution-week8-e2e",
    subject_refs: [requestSubject],
    evidence_refs: [requestEvidence],
  });
  const provenance = {
    source_mode: "synthetic_trace",
    calibration_level: "uncalibrated",
    allowed_claim_scope: "synthetic_consistency",
  };
  fixture.reports.run_bound_des_evidence = {
    schema_version: "tilesim.s7_run_bound_des_evidence.v1",
    run_id: runId,
    requested_fidelity: "des",
    resolved_fidelity: "des",
    execution_mode: "partitioned_des",
    fallback: { policy: "single_process_reference", used: false, reason: "" },
    provenance,
    state_summary: {
      schema_version: "tilesim.simulation.partitioned_des_state_summary.v1",
      logical_time_ps: "9007199254740993123",
      partition_count: 2,
      committed_event_count: 151,
      pending_event_count: 0,
      stream_record_count: 2,
      total_stream_record_count: 2,
      stream_records_truncated: false,
      provenance,
    },
    differential: {
      compared: true,
      matched: true,
      partitioned_digest: "fixture-partitioned-digest",
      reference_digest: "fixture-reference-digest",
      mismatch_code: "",
    },
    stream: { record_count: 2, total_record_count: 2, truncated: false, records: [] },
    checkpoint: {
      archive_schema_identity: "tilesim.simulation.partitioned_des_checkpoint_archive.v1",
      archive_digest: "fixture-archive-digest",
      partition_configuration_digest: "fixture-partition-config-digest",
      checkpoint_logical_time_ps: "9007199254740993123",
      committed_event_count: 151,
      pending_event_count: 0,
      completed_identity_count: 1,
      subject_version_count: 1,
      payload_availability: "not_exposed",
      provenance,
    },
  };
}

function createEvidenceAgentTerminal(request, mode = "completed") {
  const descriptor = { ...createEvidenceAgentDescriptor(true), schema_set_revision: f8SchemaRevision };
  const artifact = request.artifact_allow_list.find((entry) => entry.allowed_records.length > 0);
  const record = artifact?.allowed_records[0];
  const citation =
    artifact && record
      ? {
          schema_version: "tilesim.bridge.evidence_agent_citation.v1",
          run_id: request.run_id,
          artifact_id: artifact.artifact_id,
          schema_identity: artifact.schema_identity,
          sha256: artifact.sha256,
          json_pointer: record.json_pointer,
          subject: record.subject,
          citation_role: "direct_fact",
          availability: "available",
        }
      : null;
  const scope = request.snapshot_reference.evidence_scope;
  const claims = citation
    ? [
        {
          claim_id: `claim-${mode}`,
          claim_kind: "numeric_fact",
          text: "This atomic claim is bound to the exact verified fixture record.",
          citations: [citation],
          scope: {
            source_mode: scope.source_mode,
            requested_fidelity: scope.requested_fidelity,
            resolved_fidelity: scope.resolved_fidelity,
            execution_mode: scope.execution_mode,
            resource_semantics_relation: "S3_S4_S5_peer",
            causal_subsystems: ["S1", "S6"],
            attribution_semantics: "not_applicable",
            recommendation_semantics: "not_applicable",
          },
        },
      ]
    : [];
  const terminal = {
    schema_version: "tilesim.bridge.evidence_agent_response.v1",
    schema_set_revision: f8SchemaRevision,
    request_id: `agent-fixture-${mode}`,
    client_request_id: request.client_request_id,
    run_id: request.run_id,
    input_snapshot_digest: request.input_snapshot_digest,
    completion_state: mode,
    provider: descriptor.provider,
    revisions: descriptor.revisions,
    claims,
    refusal: null,
    partial: mode === "partial",
    truncated: mode === "truncated",
    degradation: { state: "none", reason_code: "none" },
    audit_summary: {
      operations: ["verified_snapshot_read", "citation_resolution"],
      tool_invocation_count: 2,
      hidden_reasoning_returned: false,
    },
    generated_at: "2026-08-31T00:00:00.000Z",
    persistence: {
      mode: "run_local_terminal_metadata_only",
      retained_until: null,
      snapshot_payload_retained: false,
      user_question_retained: false,
    },
    staleness: {
      state: mode === "stale" ? "stale" : "current_at_generation",
      binding_fields: ["run_id", "input_snapshot_digest", "schema_set_revision", "backend_identity"],
    },
  };
  if (mode === "stale") terminal.completion_state = "completed";
  const reasonByMode = {
    failed: "unsupported_schema",
    refused: "insufficient_evidence",
    provider_unavailable: "provider_unavailable",
    timeout: "timeout",
    cancelled: "cancelled",
  };
  if (reasonByMode[mode]) {
    terminal.completion_state = mode === "provider_unavailable" ? "refused" : mode;
    terminal.claims = [];
    terminal.refusal = {
      reason_code: reasonByMode[mode],
      detail: `fixture_${reasonByMode[mode]}`,
      retryable: ["provider_unavailable", "timeout"].includes(mode),
    };
    terminal.degradation = { state: reasonByMode[mode], reason_code: reasonByMode[mode] };
  }
  return terminal;
}

function addFormalF7Contracts(fixture) {
  const provenance = {
    source_mode: "synthetic_trace",
    calibration_level: "uncalibrated",
    allowed_claim_scope: "exploratory_s6_only",
  };
  const subject = (kind, id, identityKey) => ({ kind, id, [identityKey]: id });
  const reference = (pointer, kind, id, artifactId = "design-space") => ({
    run_id: runId,
    artifact_id: artifactId,
    schema_identity:
      artifactId === "input-topology" ? "tilesim.s6_topology_input.v1" : "tilesim.design_space_report.v1",
    json_pointer: pointer,
    availability: "available",
    subject: subject(
      kind,
      id,
      {
        candidate: "candidate_id",
        objective: "objective_id",
        executed_s6_knob: "knob_id",
        fabric_domain: "fabric_domain_id",
      }[kind],
    ),
  });
  const candidateId = "candidate-formal-f7";
  const candidateRef = reference("/candidates/0", "candidate", candidateId);
  fixture.reports.design_space = {
    schema_version: "tilesim.design_space_report.v1",
    contract_version: "tilesim.design_space_report.v1",
    run_id: runId,
    report_id: "design-space-formal-f7",
    execution_scope: "S6_only",
    candidate_source_mode: "synthetic_trace",
    candidate_calibration_level: "uncalibrated",
    candidate_allowed_claim_scope: "exploratory_s6_only",
    provenance,
    validation_lane: "synthetic_consistency",
    evidence_tier: "synthetic_consistency",
    claim_scope_summary: "Synthetic S6-only consistency; not held-out validation.",
    pareto_front_id: "pareto-formal-f7",
    objective_set_id: "objectives-formal-f7",
    candidate_count: 1,
    candidates: [
      {
        candidate_id: candidateId,
        requested_fidelity: "analytical",
        resolved_fidelity: "des",
        subject_refs: [subject("candidate", candidateId, "candidate_id")],
        evidence_refs: [candidateRef],
        navigation: {
          navigation_scope: "artifact_record",
          bridge_run_id: null,
          backend_run_instance_id: "backend-formal-f7",
          parent_run_id: runId,
          candidate_id: candidateId,
          record_ref: candidateRef,
        },
        pareto_front_id: "pareto-formal-f7",
        objective_set_id: "objectives-formal-f7",
        pareto_member: true,
        dominated_by_candidate_ids: [],
        dominates_candidate_ids: [],
        dominance_status: "non_dominated",
        dominance_reason_code: "no_candidate_strictly_dominates",
        objectives: [
          {
            objective_id: "p99_latency",
            metric_kind: "p99_latency",
            direction: "minimize",
            value: 12.5,
            unit: "us",
            availability: "available",
            evidence_ref: reference("/candidates/0/objectives/0", "objective", `${candidateId}::p99_latency`),
          },
          {
            objective_id: "throughput",
            metric_kind: "throughput",
            direction: "maximize",
            value: 128,
            unit: "requests_per_second",
            availability: "available",
            evidence_ref: reference("/candidates/0/objectives/1", "objective", `${candidateId}::throughput`),
          },
        ],
        executed_s6_knobs: [
          {
            knob_id: "release_interval",
            subsystem: "S6",
            value_type: "uint64",
            value: "9007199254740993",
            unit: "ps",
            availability: "available",
            requested_value: "9007199254740993",
            resolved_value: "9007199254740993",
            source_ref: reference(
              "/candidates/0/executed_s6_knobs/0/requested_value",
              "executed_s6_knob",
              `${candidateId}::release_interval`,
            ),
            evidence_ref: reference(
              "/candidates/0/executed_s6_knobs/0/resolved_value",
              "executed_s6_knob",
              `${candidateId}::release_interval`,
            ),
          },
        ],
      },
    ],
  };
  fixture.inputs.topology = {
    schema_version: "tilesim.s6_topology_input.v1",
    run_id: runId,
    provenance,
    topology: {
      topology_name: "formal-f7-topology",
      devices: [{ device_id: "gpu-0" }],
      module_bindings: [{ module_id: "fabric-0" }],
      domains: [
        {
          domain_id: "scale-up",
          domain_type: "scale_up",
          domain_kind: "scale_up",
          subject: subject("fabric_domain", "scale-up", "fabric_domain_id"),
          json_pointer: "/topology/domains/0",
          provenance,
          member_devices: ["gpu-0"],
          module_binding: "fabric-0",
        },
      ],
    },
  };
  fixture.reports.metrics.system_summary.fabric_domain_utilization[0].topology_domain_ref = reference(
    "/topology/domains/0",
    "fabric_domain",
    "scale-up",
    "input-topology",
  );
}

async function installFixtureApi(
  page,
  fixture,
  {
    evidenceAgentConfigured = false,
    evidenceAgentHandler = null,
    tracePackageRunHandler = null,
    agentOrchestrationSnapshot = null,
  } = {},
) {
  let week7OperationActive = false;
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let payload;
    const week7Payload = {
      "/api/week7/evidence-map": week7EvidenceMap,
      "/api/week7/calibration-example": week7Calibration,
      "/api/week7/orchestration-example": week7Orchestration,
    }[path];
    if (week7Payload) {
      if (week7OperationActive) {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "week7_capacity_reached",
              message: "Another Week 7 evidence operation is active.",
              field_path: null,
              retryable: true,
            },
            request_id: "fixture-week7-capacity",
          }),
        });
        return;
      }
      week7OperationActive = true;
      try {
        await new Promise((resolve) => setTimeout(resolve, 25));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(week7Payload) });
      } finally {
        week7OperationActive = false;
      }
      return;
    }
    if (path === "/api/manifest") {
      payload = {
        schema_version: "tilesim.bridge.manifest.v1",
        api_version: "tilesim.bridge.api.v1",
        schema_set_revision: f8SchemaRevision,
        error_schema_version: "tilesim.bridge.error.v1",
        artifact_manifest_schema_version: "tilesim.bridge.artifact_manifest.v2",
        known_report_schema_identities: {},
        experiment_descriptor: {
          endpoint: "GET /api/experiment-schema",
          schema_identity: "tilesim.bridge.experiment_descriptor.v1",
          create_run_schema_identity: "tilesim.bridge.create_run_request.v1",
        },
        trace_packages: {
          catalog_endpoint: "GET /api/trace-packages",
          inspect_endpoint: "POST /api/trace-packages/{package_id}/inspect",
          package_schema_identity: "tilesim.trace_package.v1alpha1",
          catalog_schema_identity: "tilesim.bridge.trace_package_catalog.v1",
          inspect_schema_identity: "tilesim.bridge.trace_package_inspect.v1",
          submission_source_modes: ["synthetic_trace"],
        },
        evidence_agent: {
          capability_endpoint: "GET /api/agent/evidence-capabilities",
          analysis_endpoint: "POST /api/runs/{run_id}/agent/evidence-analyses",
          descriptor_schema_identity: "tilesim.bridge.evidence_agent_descriptor.v2",
          descriptor_revision: f9DescriptorRevision,
          request_schema_identity: "tilesim.bridge.evidence_agent_request.v1",
          response_schema_identity: "tilesim.bridge.evidence_agent_response.v1",
          citation_schema_identity: "tilesim.bridge.evidence_agent_citation.v1",
          snapshot_reference_schema_identity: "tilesim.bridge.evidence_snapshot_reference.v1",
          structured_report_schema_identity: "tilesim.web.structured-performance-report.v2",
          idempotency_header: "Idempotency-Key",
          execution_mode: "synchronous_terminal",
        },
        agent_orchestration_capability: {
          endpoint: "GET /api/agent/orchestration-capabilities",
          snapshot_schema_identity: "tilesim.bridge.agent_orchestration_capability_snapshot.v1",
          catalog_schema_identity: "tilesim.bridge.agent_orchestration_capability_catalog.v1",
          parameter_descriptor_schema_identity: "tilesim.bridge.agent_orchestration_parameter_descriptor.v1",
          catalog_revision: agentOrchestrationCatalog.catalog_revision,
          contract_package_revision: agentOrchestrationCatalog.contract_package_revision,
        },
        endpoints: {},
        run_creation: {
          idempotency_header: "Idempotency-Key",
          idempotency_required: true,
          payload_identity: "canonical_json_sha256",
        },
        run_events: {
          endpoint: "GET /api/runs/{run_id}/events",
          media_type: "text/event-stream",
          resume_header: "Last-Event-ID",
          event_ids: { active: "1", terminal: "2" },
        },
      };
    } else if (path === "/api/health") {
      payload = {
        cli_available: true,
        execution_ready: true,
        versions_match: true,
        state_digests_match: true,
        source_revision: "fixture-source",
        build_revision: "fixture-source",
        source_state_digest: "fixture-source-state",
        build_state_digest: "fixture-source-state",
        deployment_ref: "fixture:f1",
      };
    } else if (path === "/api/catalog") {
      payload = {
        scenarios: [{ scenario_id: "s1_des_example", label: "S1 → S6 synthetic runtime example" }],
        fidelity_policies: ["des", "default"],
        input_modes: ["controls", "json", "trace_package"],
        design_space_modes: ["built_in_synthetic", "strict_s6_manifest"],
        gpu_participation_modes: ["gpu_free"],
      };
    } else if (path === "/api/capabilities") {
      payload = f8Capabilities;
    } else if (path === "/api/experiment-schema") {
      payload = createF8ExperimentDescriptor();
    } else if (path === "/api/trace-packages") {
      payload = tracePackageCatalog;
    } else if (path === "/api/trace-packages/synthetic-package/inspect" && route.request().method() === "POST") {
      payload = {
        schema_version: "tilesim.bridge.trace_package_inspect.v1",
        trace_package_schema_identity: "tilesim.trace_package.v1alpha1",
        schema_set_revision: f8SchemaRevision,
        backend_identity: tracePackageCatalog.backend_identity,
        package: tracePackageCatalog.packages[0],
      };
    } else if (path === "/api/agent/evidence-capabilities") {
      payload = { ...createEvidenceAgentDescriptor(evidenceAgentConfigured), schema_set_revision: f8SchemaRevision };
    } else if (path === "/api/agent/orchestration-capabilities") {
      payload = agentOrchestrationSnapshot || createAgentOrchestrationCapabilitySnapshot();
    } else if (
      path === `/api/runs/${runId}/agent/evidence-analyses` &&
      route.request().method() === "POST" &&
      evidenceAgentHandler
    ) {
      const result = await evidenceAgentHandler({
        request: route.request().postDataJSON(),
        idempotencyKey: route.request().headers()["idempotency-key"],
      });
      await route.fulfill({
        status: result.status,
        contentType: "application/json",
        headers: { "X-TileSim-Schema-Set-Revision": f8SchemaRevision },
        body: JSON.stringify(result.body),
      });
      return;
    } else if (path === "/api/runs" && route.request().method() === "POST" && tracePackageRunHandler) {
      await tracePackageRunHandler({
        request: route.request().postDataJSON(),
        idempotencyKey: route.request().headers()["idempotency-key"],
      });
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          run_id: runId,
          run_name: "Trace package E2E",
          status: "running",
          input_mode: "trace_package",
          created_at: "2026-09-03T00:00:00Z",
          idempotent_replay: false,
        }),
      });
      return;
    } else if (path === `/api/runs/${runId}/events` && tracePackageRunHandler) {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          "id: 2",
          "event: run",
          `data: ${JSON.stringify({
            run_id: runId,
            run_name: "Trace package E2E",
            status: "completed",
            input_mode: "trace_package",
            created_at: "2026-09-03T00:00:00Z",
            finished_at: "2026-09-03T00:00:01Z",
          })}`,
          "",
          "",
        ].join("\n"),
      });
      return;
    } else if (path === "/api/runs") {
      payload = {
        runs: [
          {
            run_id: runId,
            run_name: fixture.id,
            status: "completed",
            input_mode: "fixture",
            created_at: "2026-08-27T00:00:00Z",
          },
        ],
      };
    } else if (path === `/api/runs/${runId}/reports`) {
      payload = { run_id: runId, reports: fixture.reports };
    } else if (path === `/api/runs/${runId}/artifacts`) {
      payload = {
        schema_version: "tilesim.bridge.artifact_manifest.v2",
        api_version: "tilesim.bridge.api.v1",
        schema_set_revision: f8SchemaRevision,
        run_id: runId,
        artifacts: artifactManifestEntries(fixture),
        rejected_artifacts: [],
      };
    } else if (path.startsWith(`/api/runs/${runId}/files/`)) {
      const artifact = decodeURIComponent(path.slice(`/api/runs/${runId}/files/`.length));
      payload = artifactFor(fixture, artifact);
      if (payload === undefined || payload === null) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "missing" }),
        });
        return;
      }
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "unknown" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: [
        "/api/experiment-schema",
        "/api/trace-packages",
        "/api/trace-packages/synthetic-package/inspect",
        "/api/agent/evidence-capabilities",
        "/api/agent/orchestration-capabilities",
      ].includes(path)
        ? { "X-TileSim-Schema-Set-Revision": f8SchemaRevision }
        : {},
      body: JSON.stringify(payload),
    });
  });
}

async function openFixture(page, fixture, view = "execution", apiOptions = {}) {
  const browserFailures = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      browserFailures.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserFailures.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500 && !apiOptions.expectedHttpStatuses?.includes(response.status())) {
      browserFailures.push(`response: ${response.status()} ${response.url()}`);
    }
  });
  await installFixtureApi(page, fixture, apiOptions);
  await page.addInitScript(
    ({ id, initialView }) => {
      localStorage.setItem(
        "tilesim-web.dashboard-state.v2",
        JSON.stringify({ view: initialView, runId: id, comparisonIds: [] }),
      );
    },
    { id: runId, initialView: view },
  );
  const path =
    view === "design_space"
      ? "design-space"
      : view === "evidence_lab"
        ? "evidence-lab"
        : view === "evidence_agent"
          ? "evidence-agent"
          : view;
  await page.goto(`/${path}?run=${runId}`, { waitUntil: "domcontentloaded" });
  return browserFailures;
}

async function expectNoUnexpectedTextOverflow(page) {
  const offenders = await page.locator("body *").evaluateAll((elements) =>
    elements
      .filter((element) => {
        if (!(element instanceof HTMLElement) || element.clientWidth === 0) return false;
        if (element.matches("pre, select, .artifact-line-pointer") || element.closest("pre")) return false;
        let scrollContainer = element.parentElement;
        while (scrollContainer && scrollContainer !== document.body) {
          if (["auto", "scroll"].includes(getComputedStyle(scrollContainer).overflowX)) return false;
          scrollContainer = scrollContainer.parentElement;
        }
        const style = getComputedStyle(element);
        if (style.clip !== "auto") return false;
        if (["auto", "scroll"].includes(style.overflowX)) return false;
        return element.scrollWidth > element.clientWidth + 1;
      })
      .slice(0, 20)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: element.className,
        text: element.textContent.trim().slice(0, 100),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
  );
  expect(offenders).toEqual([]);
}

test("synthetic evidence view is stable, accessible, and field-complete", async ({ page }, testInfo) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture);
  await expect(page.getByRole("heading", { name: "请求执行路线" })).toBeVisible();
  await expect(page.locator(".flow-node")).toHaveCount(7);
  await expect(page.locator(".execution-current-selection")).toHaveCount(0);
  await expect(page.locator(".run-bound-evidence-panel")).toHaveCount(0);
  await expect(page.locator(".stage-list li")).toHaveCount(3);
  await expect(page.locator('.visualization-panel[data-chart-kind="bar"] .execution-chart svg')).toBeVisible();
  await page.locator(".flow-node").filter({ hasText: "S5" }).click();
  await expect(page.locator(".flow-node").filter({ hasText: "S5" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#execution-layer-detail h2")).toHaveText("集合通信语义模块");
  await expect(page.locator('.visualization-panel[data-chart-kind="stacked-bar"] .execution-chart svg')).toBeVisible();
  await expect(
    page.locator('.visualization-panel[data-chart-kind="stacked-bar"] .visualization-caption'),
  ).toBeVisible();
  await page.locator(".flow-node--fabric").click();
  await expect(page.locator(".layer-visualizations .visualization-panel")).toHaveCount(2);
  await expect(page.locator(".layer-visualizations .visualization-empty")).toHaveCount(0);
  await expect(page.locator(".visualization-panel > footer").first()).toContainText("request_fabric_contributions");
  await expect(page.locator(".evidence-warning")).toContainText("查看为什么结果受限");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );

  await page.locator(".json-artifact-panel").evaluate((element) => (element.open = true));
  await page.locator(".json-artifact-panel select").selectOption("metrics");
  await expect(page.locator(".json-artifact-meta")).toContainText("Worker 已索引");
  await page.locator(".json-artifact-panel select").evaluate((select) => {
    select.value = "validation";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    select.value = "metrics";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator(".artifact-line-text").filter({ hasText: "device_latency_us" }).first()).toBeVisible();
  await page.locator(".json-search-field input").fill("device_latency_us");
  await expect(page.locator(".artifact-line-text").filter({ hasText: "device_latency_us" }).first()).toBeVisible();
  await expect(page.locator(".json-artifact-meta")).toContainText("个匹配行");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);

  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  expect(browserFailures).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`synthetic-evidence-${testInfo.project.name}.png`, { fullPage: true });
});

test("semantic glossary stays bilingual and traceable across the five primary result pages", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  fixture.reports.validation.trace_provenance.trace_kind = "future_trace_kind";
  fixture.reports.metrics.trace_provenance.trace_kind = "future_trace_kind";
  const browserFailures = await openFixture(page, fixture, "execution");
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.getByRole("button", { name: "切换到深色模式" }).click();

  await page.locator(".flow-node").filter({ hasText: "S0" }).click();
  const provenance = page.locator('.visualization-panel[data-chart-kind="matrix"]');
  await expect(provenance).toContainText("输入来源模式");
  await expect(provenance).toContainText("人工生成 Trace");
  await expect(provenance).toContainText("由生成器产生，不是真实采集");
  await expect(provenance).toContainText("技术字段：source_mode = synthetic_trace");
  await expect(provenance).toContainText("未识别值");
  await expect(provenance).toContainText("trace_kind = future_trace_kind");

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(provenance).toContainText("Input source mode");
  await expect(provenance).toContainText("Synthetic trace");
  await expect(provenance).toContainText("Technical field: source_mode = synthetic_trace");
  await expect(provenance).not.toContainText("source mode = synthetic trace");

  await page.goto(`/metrics?run=${runId}`, { waitUntil: "domcontentloaded" });
  const metricsDetails = page.locator(".visualization-data").first();
  await metricsDetails.locator("summary").click();
  await expect(metricsDetails).toContainText("Field presentation method");
  await expect(metricsDetails).toContainText("Technical field: derivation = unit_conversion");

  await page.goto(`/fabric?run=${runId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Longest communication wait" })).toBeVisible();
  const fabricDetails = page.locator(".visualization-data").first();
  await fabricDetails.locator("summary").click();
  await expect(fabricDetails).toContainText("Field presentation method");

  await page.goto(`/attribution?run=${runId}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Tail-latency attribution" }).click();
  await expect(page.locator(".attribution-ranking-panel")).toContainText(
    "Backend original: Fixture queue contribution.",
  );
  await page.locator(".attribution-cause-disclosure summary").click();
  await expect(page.locator(".cause-chain")).toContainText("Runtime batching wait");
  await expect(page.locator(".cause-chain")).toContainText("cause_code = runtime_batching_delay");
  await expect(page.locator(".cause-chain")).toContainText("Backend original: Request waited before its first batch.");

  await page.goto(`/validation?run=${runId}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".provenance-grid")).toContainText("Input source mode");
  await expect(page.locator(".provenance-grid")).toContainText("Calibration level");
  await expect(page.locator(".provenance-grid")).toContainText("Allowed claim scope");
  await expect(page.locator(".provenance-grid")).toContainText("Technical field: calibration_level = uncalibrated");
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("desktop routes preserve run deep links and browser history", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "execution");
  await expect(page.locator(".evidence-strip")).toContainText("synthetic-s1-s6-complete");
  await expect(page).toHaveURL(new RegExp(`/execution\\?run=${runId}$`));
  await page.getByRole("button", { name: /性能指标/ }).click();
  await expect(page).toHaveURL(new RegExp(`/metrics\\?run=${runId}$`));
  await expect(page.getByRole("heading", { name: "请求级结果" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/execution\\?run=${runId}$`));
  await expect(page.getByRole("heading", { name: "请求执行路线" })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`/execution\\?run=${runId}$`));
  await expect(page.getByRole("heading", { name: "请求执行路线" })).toBeVisible();
  expect(browserFailures).toEqual([]);
});

test("F6B request evidence stays run-bound across peer resources and S7-S9 pages", async ({ page }, testInfo) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const longRequestId = `req-${"长请求-LongRequest-".repeat(18)}`;
  fixture.inputs.runtime_trace.requests[0].request_id = longRequestId;
  fixture.reports.metrics.request_metrics[0].request_id = longRequestId;
  fixture.reports.metrics.system_summary.request_fabric_contributions[0].request_id = longRequestId;
  fixture.reports.metrics.system_summary.phase_fabric_contributions.forEach((phase) => {
    phase.request_id = longRequestId;
  });
  fixture.reports.tail.explained_entity.id = longRequestId;
  addWeek8Contracts(fixture, longRequestId);
  const browserFailures = await openFixture(page, fixture, "attribution");

  const panel = page.locator(".run-bound-evidence-panel");
  await expect(panel.getByRole("heading", { name: "请求证据链" })).toBeVisible();
  await expect(panel.locator("select")).toHaveValue(longRequestId);
  await expect.poll(() => new URL(page.url()).searchParams.get("evidence_request")).toBe(longRequestId);
  await expect(panel.locator(".run-bound-peer-group .run-bound-node")).toHaveCount(3);
  await expect(panel.locator(".run-bound-peer-group .run-bound-node").nth(0)).toContainText("S3");
  await expect(panel.locator(".run-bound-peer-group .run-bound-node").nth(1)).toContainText("S4");
  await expect(panel.locator(".run-bound-peer-group .run-bound-node").nth(2)).toContainText("S5");
  await expect(panel.locator(".run-bound-output-node").filter({ hasText: "S7" })).toContainText("已绑定");
  await expect(panel.locator(".run-bound-output-node").filter({ hasText: "S8" })).toContainText("已绑定");
  await expect(panel.locator(".run-bound-output-node").filter({ hasText: "S9" })).toContainText("已绑定");
  await expect(panel.locator(".week8-execution-panel")).toContainText("执行详情");
  await panel.locator(".week8-execution-panel summary").click();
  await expect(panel.locator(".week8-execution-panel")).toContainText("partitioned_des");
  await expect(panel.locator(".week8-execution-panel")).toContainText("synthetic_trace");
  await panel.locator(".week8-execution-panel summary").click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`request-evidence-${testInfo.project.name}.png`, { fullPage: true });

  await panel.getByRole("link", { name: "执行过程" }).click();
  await expect(page).toHaveURL(/\/execution\?/);
  expect(new URL(page.url()).searchParams.get("run")).toBe(runId);
  expect(new URL(page.url()).searchParams.get("evidence_request")).toBe(longRequestId);
  await expect(page.locator(".run-bound-evidence-panel")).toHaveCount(0);

  await page.getByRole("button", { name: /^性能指标$/ }).click();
  await expect(page.locator(".run-bound-evidence-panel")).toHaveCount(0);
  await page.getByRole("button", { name: /^结果可信度$/ }).click();
  await expect(page.locator(".run-bound-evidence-panel")).toHaveCount(0);
  await page.getByRole("button", { name: /^慢请求原因$/ }).click();
  await expect(page.locator(".run-bound-evidence-panel")).toHaveCount(1);
  await expect(page.locator(".run-bound-evidence-panel select")).toHaveValue(longRequestId);

  await page.locator(".run-bound-evidence-panel select").focus();
  await expect(page.locator(".run-bound-evidence-panel select")).toBeFocused();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("heading", { name: "Request evidence chain" })).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".run-bound-evidence-panel select")).toHaveValue(longRequestId);
  expect(
    await page
      .locator(".run-bound-page-links a")
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration)),
  ).toBeLessThanOrEqual(0.001);
  expect(browserFailures).toEqual([]);
});

test("F9B read-only Agent exposes formal provider unavailability without mock claims", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const browserFailures = await openFixture(page, fixture, "evidence_agent");

  await expect(page.getByRole("heading", { name: "AI 解释" })).toBeVisible();
  await expect(page.locator(".evidence-agent-unavailable")).toContainText("provider_unavailable");
  await expect(page.getByRole("button", { name: "生成解释" })).toBeDisabled();
  await expect(page.locator(".evidence-agent-claims > li")).toHaveCount(0);
  await expect(page.locator(".evidence-agent-policy-disclosure")).not.toHaveAttribute("open", "");
  await page.locator(".evidence-agent-policy-disclosure > summary").click();
  await expect(page.locator(".evidence-agent-policy-disclosure")).toHaveAttribute("open", "");
  await expect(page.locator(".evidence-agent-identity-grid")).toContainText(
    "tilesim.bridge.evidence_agent_descriptor.v2",
  );
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("redacted_terminal_metadata_only");
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("terminal_result_not_retained");
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("forbidden");
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("verified_snapshot_read");
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("S3 · S4 · S5");
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("S8 · S9");
  await expect(page.locator(".evidence-agent-retention-list li")).toHaveCount(7);
  await expect(page.locator(".evidence-agent-retention-list li")).toHaveText([
    /用户问题.*禁止留存/,
    /snapshot payload.*禁止留存/,
    /artifact payload.*禁止留存/,
    /Provider raw response.*禁止留存/,
    /validated model claims.*禁止留存/,
    /credential.*禁止留存/,
    /hidden reasoning.*禁止留存/,
  ]);
  await expect(page.locator(".evidence-agent-terminal-list li")).toHaveCount(5);
  for (const status of ["HTTP 409", "HTTP 502", "HTTP 503", "HTTP 504"]) {
    await expect(page.locator(".evidence-agent-terminal-list")).toContainText(status);
  }
  await expect(page.locator(".evidence-agent-terminal-list")).toContainText("tilesim.bridge.error.v1");
  await expect(page.locator(".evidence-agent-terminal-list")).toContainText(
    "tilesim.bridge.evidence_agent_response.v1",
  );
  await expect(page.locator(".evidence-agent-terminal-list")).toContainText("field_path=/headers/Idempotency-Key");
  await expect(page.locator(".evidence-agent-terminal-list")).toContainText("retryable=false");
  await expect(page.locator(".evidence-agent-terminal-list")).toContainText(
    "completion_state=refused · reason_code=provider_unavailable",
  );
  const requestSelect = page.locator(".evidence-agent-compose select").first();
  await requestSelect.focus();
  await expect(requestSelect).toBeFocused();
  await requestSelect.selectOption("req-0");
  await expect(requestSelect).toHaveValue("req-0");
  await expect.poll(() => new URL(page.url()).searchParams.get("evidence_request")).toBe("req-0");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("heading", { name: "AI explanation" })).toBeVisible();
  await expect(page.locator(".evidence-agent-unavailable")).toContainText("provider_unavailable");
  await expect(page.getByText("Replay and terminal recovery", { exact: true })).toBeVisible();
  await expect(
    page.locator(".evidence-agent-contract-grid").getByText("Metadata-only retention", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Formal HTTP terminals", { exact: true })).toBeVisible();
  await expect(page.getByText("Provider unavailable", { exact: true })).toBeVisible();
  await expect(page.locator(".evidence-agent-retention-list li").first()).toContainText("Retention prohibited");
  await expectNoUnexpectedTextOverflow(page);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(
    await page
      .locator(".evidence-agent-contract-card")
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration)),
  ).toBeLessThanOrEqual(0.001);
  expect(browserFailures).toEqual([]);
});

test("Evidence Agent validates citations, terminal states, stale isolation, and recovery boundaries", async ({
  page,
}) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const submissions = [];
  const browserFailures = await openFixture(page, fixture, "evidence_agent", {
    evidenceAgentConfigured: true,
    expectedHttpStatuses: [409, 502, 503, 504],
    evidenceAgentHandler: async ({ request, idempotencyKey }) => {
      const mode = request.user_question.content;
      submissions.push({ mode, idempotencyKey, taskKind: request.task_kind });
      if (mode === "recovery") {
        return {
          status: 409,
          body: {
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "terminal_result_not_retained",
              message: "The prior claims terminal was intentionally not retained.",
              field_path: "/headers/Idempotency-Key",
              retryable: false,
            },
            request_id: "fixture-terminal-result-not-retained",
          },
        };
      }
      if (mode === "server-mismatch") {
        return {
          status: 409,
          body: {
            schema_version: "tilesim.bridge.error.v1",
            error: {
              code: "idempotency_payload_mismatch",
              message: "The key is already bound to a different canonical payload.",
              field_path: "/headers/Idempotency-Key",
              retryable: false,
            },
            request_id: "fixture-idempotency-payload-mismatch",
          },
        };
      }
      const status = { failed: 502, provider_unavailable: 503, timeout: 504 }[mode] || 200;
      return { status, body: createEvidenceAgentTerminal(request, mode) };
    },
  });

  await page.locator(".evidence-agent-compose select").first().selectOption("req-0");
  const taskRadios = page.locator('.evidence-agent-task-cards input[type="radio"]');
  await expect(taskRadios).toHaveCount(4);
  await expect(taskRadios.first()).toBeChecked();
  await taskRadios.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(taskRadios.nth(1)).toBeChecked();
  const preview = page.locator(".evidence-agent-submission-preview");
  await expect(preview).toContainText("req-0");
  await expect(preview).toContainText(/\d+ 个精确引用位置，来自 \d+ 份工件/);
  await expect(preview).toContainText("仅为合成证据");
  await expect(preview).toContainText("服务上限 30 秒");
  await preview.locator(":scope > details > summary").click();
  await expect(preview).toContainText("synthetic_trace");
  await expect(preview).toContainText("requested_fidelity");
  await expect(preview).toContainText("resolved_fidelity");
  const question = page.locator(".evidence-agent-question textarea");
  const submit = page.getByRole("button", { name: "生成解释" });

  await question.fill("completed");
  await submit.click();
  await expect(page.locator(".evidence-agent-state").last()).toHaveText("解释已生成，待确认");
  await expect(page.locator(".evidence-agent-claims > li")).toHaveCount(1);
  const claimEvidence = page.locator(".evidence-agent-claim-evidence");
  await expect(claimEvidence).not.toHaveAttribute("open", "");
  await claimEvidence.locator(":scope > summary").click();
  await expect(page.locator(".evidence-agent-citations a")).toHaveAttribute("href", /evidence_pointer=(%2F|\/)/);
  const citationIdentity = page.locator(".evidence-agent-citation-identity");
  await expect(citationIdentity).not.toHaveAttribute("open", "");
  await citationIdentity.locator(":scope > summary").click();
  await expect(citationIdentity).toContainText("json_pointer");
  await expect(citationIdentity).toContainText("subject");
  await expect(citationIdentity).toContainText("sha256");
  const completedSubmission = submissions.at(-1);
  expect(completedSubmission.taskKind).toBe("explain_tail");
  await submit.click();
  await expect.poll(() => submissions.filter((entry) => entry.mode === "completed").length).toBe(2);
  expect(submissions.at(-1).idempotencyKey).toBe(completedSubmission.idempotencyKey);
  const completedReplayCount = submissions.length;
  await question.fill("different canonical payload");
  await expect(submit).toBeDisabled();
  await expect(page.getByText(/前端已阻止冲突提交/)).toBeVisible();
  expect(submissions).toHaveLength(completedReplayCount);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(sessionStorage.getItem("tilesim-web.evidence-agent-submission.v1") || "null")),
    )
    .toMatchObject({ idempotencyKey: completedSubmission.idempotencyKey });
  await page.getByRole("button", { name: "放弃旧分析并开始新问题" }).click();
  await expect(question).toBeFocused();

  await question.fill("stale");
  await submit.click();
  await expect(page.getByText("结果与当前证据绑定不再匹配")).toBeVisible();
  await expect(page.locator(".evidence-agent-claims > li")).toHaveCount(0);
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: "明确放弃当前分析并开始新分析" }).click();

  for (const [mode, label, boundary] of [
    ["partial", "部分结果", "未完成部分不会由前端补写"],
    ["refused", "已拒答", "服务已正式拒答"],
    ["truncated", "输出已截断", "不能视为完整回答"],
    ["failed", "生成失败", "正式 HTTP 502 EvidenceAgentResponse"],
    ["provider_unavailable", "AI 服务暂不可用", "正式 HTTP 503 EvidenceAgentResponse"],
    ["timeout", "请求超时", "正式 HTTP 504 EvidenceAgentResponse"],
  ]) {
    await question.fill(mode);
    await submit.click();
    await expect(page.locator(".evidence-agent-state").last()).toHaveText(label);
    await expect(page.locator(`.evidence-agent-result-boundary[data-state="${mode}"]`)).toContainText(boundary);
    await page.getByRole("button", { name: "明确放弃当前分析并开始新分析" }).click();
  }

  await question.fill("recovery");
  await submit.click();
  await expect(page.getByText("无法恢复先前的 claims 终态")).toBeVisible();
  await expect(page.locator(".evidence-agent-unavailable code")).toHaveText("terminal_result_not_retained");
  await expect(submit).toBeDisabled();
  const recoverySubmission = submissions.at(-1);
  expect(recoverySubmission.mode).toBe("recovery");
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(sessionStorage.getItem("tilesim-web.evidence-agent-submission.v1") || "null")),
    )
    .toMatchObject({ idempotencyKey: recoverySubmission.idempotencyKey });
  await page.waitForTimeout(150);
  expect(submissions.filter((entry) => entry.mode === "recovery")).toHaveLength(1);

  const discardUnretained = page.getByRole("button", { name: "明确放弃该终态并开始新分析" });
  await discardUnretained.focus();
  await expect(discardUnretained).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(question).toBeFocused();
  await expect(submit).toBeEnabled();
  await expect(page.getByText("无法恢复先前的 claims 终态")).toHaveCount(0);

  await question.fill("server-mismatch");
  await submit.click();
  await expect(page.getByText("幂等键已绑定到不同载荷")).toBeVisible();
  await expect(page.locator(".evidence-agent-unavailable code")).toHaveText("idempotency_payload_mismatch");
  await expect(submit).toBeDisabled();
  const serverMismatchSubmission = submissions.at(-1);
  expect(serverMismatchSubmission.mode).toBe("server-mismatch");
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(sessionStorage.getItem("tilesim-web.evidence-agent-submission.v1") || "null")),
    )
    .toMatchObject({ idempotencyKey: serverMismatchSubmission.idempotencyKey });
  await page.waitForTimeout(150);
  expect(submissions.filter((entry) => entry.mode === "server-mismatch")).toHaveLength(1);
  const discardMismatch = page.getByRole("button", { name: "明确放弃旧分析并开始新分析" });
  await discardMismatch.focus();
  await expect(discardMismatch).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(question).toBeFocused();
  await expect(submit).toBeEnabled();
  await expect(page.getByText("幂等键已绑定到不同载荷")).toHaveCount(0);
  expect(browserFailures).toEqual([]);
});

test("Week 7 evidence chain exposes calibration, lineage, and deterministic orchestration", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "execution");

  await page.getByRole("button", { name: /校准与追踪/ }).click();
  await expect(page).toHaveURL(/\/evidence-lab$/);
  await expect(page.getByRole("heading", { name: "离线校准工作流" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "报告字段证据血缘" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "固定工具调用编排" })).toBeVisible();
  await expect(page.locator(".week7-section").first()).not.toHaveAttribute("open", "");
  await page.locator(".week7-section").first().locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".week7-timeline li")).toHaveCount(5);
  await expect(page.getByText("offline_fixture_consistency")).toBeVisible();
  await expect(page.getByText("workflow_consistency_only")).toBeVisible();
  await page.locator(".week7-section").nth(2).locator(":scope > summary").click();
  await expect(page.getByText("partial", { exact: true })).toBeVisible();
  await expect(page.getByText("H100")).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);

  await page.getByRole("button", { name: /性能指标/ }).click();
  await expect(page).toHaveURL(new RegExp(`/metrics\\?run=${runId}$`));
  await expect(page.getByRole("heading", { name: "请求级结果" })).toBeVisible();
  await page.getByRole("button", { name: /校准与追踪/ }).click();
  await expect(page).toHaveURL(/\/evidence-lab$/);
  await expect(page.getByRole("heading", { name: "离线校准工作流" })).toBeVisible();

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("heading", { name: "Offline calibration workflow" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Report-field evidence lineage" })).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/evidence-lab$/);
  await expect(page.getByRole("heading", { name: "Fixed tool-call orchestration" })).toBeVisible();
  expect(browserFailures).toEqual([]);
});

test("disconnected deep links never claim that an unavailable run is loaded", async ({ page }) => {
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, (route) => route.abort("connectionrefused"));
  await page.goto("/execution?run=run-unavailable", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("alert")).toContainText("run-unavailable");
  await expect(page.getByRole("alert")).toContainText("没有展示");
  await expect(page.locator(".evidence-identity strong")).not.toContainText("run-unavailable");
});

test("overview exposes only artifacts present in the trusted manifest", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const expected = artifactManifestEntries(fixture);
  await openFixture(page, fixture, "overview");
  await page.locator(".artifact-disclosure summary").click();

  await expect(page.locator(".artifact-disclosure .artifact-link")).toHaveCount(expected.length);
  await expect(page.locator('.artifact-link[href*="/files/metadata"]')).toHaveCount(0);
  await expect(page.locator('.artifact-link[href*="/files/design-space"]')).toHaveCount(1);
});

test("hash-bound evidence links locate JSON Pointers and survive reload", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "metrics");
  const evidenceLink = page.getByRole("link", { name: "吞吐证据" });
  await expect(evidenceLink).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);
  await evidenceLink.click();

  await expect(page).toHaveURL(/\/execution\?run=run-fixture-f1&evidence_artifact=metrics/);
  await expect(page.locator(".json-artifact-panel")).toHaveAttribute("open", "");
  await expect(page.locator(".artifact-evidence-target")).toContainText("/summary/throughput_requests_per_second");
  await expect(page.locator(".artifact-virtual-line--active")).toContainText("throughput_requests_per_second");

  await page.goBack();
  await expect(page).toHaveURL(/\/metrics\?run=run-fixture-f1$/);
  await page.goForward();
  await expect(page.locator(".artifact-evidence-target")).toContainText("/summary/throughput_requests_per_second");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".artifact-evidence-target")).toContainText("/summary/throughput_requests_per_second");
  await expect(page.locator(".artifact-virtual-line--active")).toContainText("throughput_requests_per_second");

  await page.getByRole("button", { name: /结果可信度/ }).click();
  await expect(page.locator(".validation-disclosure").first()).not.toHaveAttribute("open", "");
  await page.locator(".validation-disclosure").filter({ hasText: "逐项验证记录" }).locator("summary").click();
  await expect(page.locator(".check-row .artifact-evidence-link").first()).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);
  await page.getByRole("button", { name: /慢请求原因/ }).click();
  await page.getByRole("button", { name: "尾延迟归因", exact: true }).click();
  await expect(page.locator(".ranking-row .artifact-evidence-link")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "归因守恒与传播审计" })).toBeVisible();
  await expect(page.locator(".attribution-audit-grid")).toHaveCount(0);
  await page.locator(".attribution-audit > summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".attribution-audit")).toContainText("partial_attribution");
  await expect(page.locator(".attribution-audit")).toContainText("required_propagation_node_missing_or_unresolved");
  await expectNoUnexpectedTextOverflow(page);

  await page.goto(
    "/execution?run=run-fixture-f1&evidence_artifact=metrics&evidence_sha=" +
      "b".repeat(64) +
      "&evidence_pointer=%2Fsummary%2Fthroughput_requests_per_second",
  );
  await expect(page.locator(".json-artifact-empty--error")).toContainText("SHA-256");
  expect(browserFailures).toEqual([]);
});

test("analysis charts keep complete tables and bind selected points to the current run artifact identity", async ({
  page,
}) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "metrics");
  const panel = page.locator(".visualization-panel").filter({ hasText: "请求延迟比较" }).first();
  await expect(panel.locator(".visualization-reading-protocol")).toHaveCount(0);
  await expect(panel.locator(".visualization-caption")).toContainText("TTFT");
  await expect(panel.locator(".execution-chart svg")).toBeVisible();
  await panel.locator(".visualization-data > summary").click();
  await expect(panel.locator(".visualization-table-scroll tbody tr")).toHaveCount(
    fixture.reports.metrics.request_metrics.length,
  );
  await expect(panel.locator(".visualization-contract")).toContainText("unit_conversion");
  await expect(panel.locator(".visualization-table-scroll")).toContainText(
    `ttft_ps: ${fixture.reports.metrics.request_metrics[0].ttft_ps} ps`,
  );

  const endToEndMarks = panel.locator('.execution-chart svg path[fill="#bd6457"]');
  await expect(endToEndMarks).toHaveCount(fixture.reports.metrics.request_metrics.length + 1);
  const selectedMark = endToEndMarks.first();
  await expect.poll(async () => (await selectedMark.boundingBox())?.width || 0).toBeGreaterThan(100);
  await selectedMark.scrollIntoViewIfNeeded();
  await selectedMark.click();
  const selectedLink = panel.locator(".visualization-selection a.artifact-evidence-link").first();
  await expect(selectedLink).toBeVisible();
  const target = new URL(await selectedLink.getAttribute("href"), "http://tilesim.local");
  const metricsArtifact = artifactManifestEntries(fixture).find((entry) => entry.artifact_id === "metrics");
  expect(target.searchParams.get("run")).toBe(runId);
  expect(target.searchParams.get("evidence_artifact")).toBe("metrics");
  expect(target.searchParams.get("evidence_sha")).toBe(metricsArtifact.sha256);
  expect(target.searchParams.get("evidence_pointer")).toBe("/request_metrics/0");
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("S0-S6 attribution chart and S7-S9 output records remain visibly partitioned", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  fixture.reports.tail.attribution_ranking.push(
    { attribution_id: "host-s7", rank: 2, subsystem: "S7", component_code: "host", score_ps: 3, share: 0.2 },
    {
      attribution_id: "validation-s8",
      rank: 3,
      subsystem: "S8",
      component_code: "validation",
      score_ps: 2,
      share: 0.1,
    },
    { attribution_id: "output-s9", rank: 4, subsystem: "S9", component_code: "output", score_ps: 1, share: 0.1 },
  );
  const browserFailures = await openFixture(page, fixture, "attribution");
  await page.getByRole("button", { name: "尾延迟归因", exact: true }).click();
  const causalPanel = page.locator(".visualization-panel").filter({ hasText: "S0–S6 延迟贡献" });
  await causalPanel.locator(".visualization-data > summary").click();
  await expect(causalPanel.locator(".visualization-table-scroll tbody tr")).toHaveCount(1);
  await expect(causalPanel.locator(".visualization-table-scroll tbody tr")).toContainText("S6");
  await expect(page.locator(".attribution-output-plane tbody tr")).toHaveCount(3);
  await expect(page.locator(".attribution-output-plane tbody")).toContainText("S7");
  await expect(page.locator(".attribution-output-plane tbody")).toContainText("S8");
  await expect(page.locator(".attribution-output-plane tbody")).toContainText("S9");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("a missing evidence Pointer remains visible as a persistent error", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const metrics = artifactManifestEntries(fixture).find((entry) => entry.artifact_id === "metrics");
  await installFixtureApi(page, fixture);
  await page.goto(
    `/execution?run=${runId}&evidence_artifact=metrics&evidence_sha=${metrics.sha256}&evidence_pointer=%2Fnot-present`,
  );

  await expect(page.locator(".json-artifact-alert")).toContainText("/not-present");
  await expect(page.locator(".artifact-virtual-viewer")).toBeVisible();
});

test("Week 6 design space exposes complete candidate evidence without desktop overflow", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "design_space");
  await expect(page.getByRole("heading", { name: "方案排名" })).toBeVisible();
  await expect(page.locator(".candidate-detail")).toHaveCount(1);
  await expect(page.locator(".candidate-detail").first()).toContainText("fixture-manifest#candidate-0");
  await expect(page.locator(".candidate-detail").first()).toContainText("single_deterministic_run");
  await expect(page.locator(".candidate-attribution")).toContainText("Only S6 Fabric parameters are executed.");
  await expect(page.getByRole("heading", { name: "Fabric 与设计空间契约状态" })).toBeVisible();
  await expect(page.locator(".f7-capability-grid")).toContainText("Pareto membership");
  await expect(page.locator(".f7-capability-grid")).toContainText("contract gap");
  await expect(page.locator(".candidate-opaque-warning")).toContainText("不是可导航 EvidenceRef");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(browserFailures).toEqual([]);
});

test("F7 formal contract exposes Pareto, artifact-record, knob, and topology evidence", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addFormalF7Contracts(fixture);
  const browserFailures = await openFixture(page, fixture, "design_space");
  await expect(page.getByRole("heading", { name: "Pareto 与 artifact-record 证据" })).toBeVisible();
  await expect(page.locator(".f7-formal-summary")).toContainText("pareto-formal-f7");
  await expect(page.locator(".candidate-detail").first()).toContainText("backend-formal-f7");
  await expect(page.locator(".candidate-detail").first()).toContainText("9,007,199,254,740,993 ps");
  const objectiveChart = page.locator(".visualization-panel").filter({ hasText: "正式 Objective 候选图" });
  await expect(objectiveChart).toHaveAttribute("data-chart-kind", "bar");
  await expect(objectiveChart.locator(".visualization-reading-protocol")).toHaveCount(0);
  await expect(objectiveChart.locator(".visualization-caption")).toContainText("可配对的正式 objective 不足");
  await objectiveChart.locator(".visualization-data > summary").click();
  await expect(objectiveChart.locator(".visualization-table-scroll tbody")).toContainText("pareto_member");
  await expect(objectiveChart.locator(".visualization-contract")).toContainText("identity");
  const candidateTargets = await page
    .locator(".candidate-detail a.artifact-evidence-link")
    .evaluateAll((links) => links.map((link) => new URL(link.href).searchParams.get("evidence_pointer")));
  expect(candidateTargets).toContain("/candidates/0");
  expect(candidateTargets).toContain("/candidates/0/objectives/0");
  expect(candidateTargets).toContain("/candidates/0/executed_s6_knobs/0/requested_value");
  expect(candidateTargets).toContain("/candidates/0/executed_s6_knobs/0/resolved_value");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  const designAxe = await new AxeBuilder({ page }).analyze();
  expect(designAxe.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);

  await page.goto(`/fabric?run=${runId}`);
  await expect(page.locator(".fabric-topology-gap")).toContainText("正式契约已验证");
  await expect(page.locator(".domain-card")).toHaveCount(0);
  await page.locator(".fabric-domain-disclosure > summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".domain-topology-contract")).toContainText("gpu-0");
  const topologyTarget = await page
    .locator(".domain-topology-contract a.artifact-evidence-link")
    .first()
    .getAttribute("href");
  expect(new URL(topologyTarget, "http://tilesim.local").searchParams.get("evidence_pointer")).toBe(
    "/topology/domains/0",
  );
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("F7 Fabric view preserves backend order and exact metrics evidence", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  addWeek8Contracts(fixture, "req-0");
  const browserFailures = await openFixture(page, fixture, "fabric");
  await expect(page.getByRole("heading", { name: "当前主要通信瓶颈" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "请求级 Fabric contribution" })).toBeVisible();
  await expect(page.locator(".analysis-visualization-stack .visualization-panel")).toHaveCount(2);
  await expect(page.locator(".analysis-visualization-stack .execution-chart svg")).toHaveCount(2);
  await expect(page.locator(".analysis-visualization-stack .visualization-reading-protocol")).toHaveCount(0);
  await expect(page.locator(".analysis-visualization-stack .visualization-caption")).toHaveCount(2);
  await expect(page.locator(".fabric-contract-strip")).not.toHaveAttribute("open", "");
  await expect(page.locator(".fabric-domain-disclosure")).not.toHaveAttribute("open", "");
  await page.locator(".fabric-domain-disclosure summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".fabric-domain-disclosure")).toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  const requestRow = page.locator(".fabric-request-table tbody tr").first();
  await expect(requestRow).toContainText("req-0");
  await expect(requestRow).toContainText("phase-0");
  await expect(requestRow).toContainText("collective-0");
  const targets = await requestRow.locator("a.artifact-evidence-link").evaluateAll((links) =>
    links.map((link) => {
      const url = new URL(link.href);
      return {
        artifact: url.searchParams.get("evidence_artifact"),
        pointer: url.searchParams.get("evidence_pointer"),
        sha: url.searchParams.get("evidence_sha"),
      };
    }),
  );
  expect(targets.map(({ artifact, pointer }) => ({ artifact, pointer }))).toEqual([
    { artifact: "metrics", pointer: "/system_summary/request_fabric_contributions/0" },
    { artifact: "metrics", pointer: "/system_summary/phase_fabric_contributions/0" },
  ]);
  expect(targets.every(({ sha }) => /^[a-f0-9]{64}$/.test(sha || ""))).toBe(true);
  expect(new Set(targets.map(({ sha }) => sha)).size).toBe(1);
  await expect(page.locator(".fabric-topology-gap")).toContainText("artifact_identity_missing");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("language switch updates the desktop workspace and survives reload", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "execution");
  await expect(page.getByRole("heading", { name: "请求执行路线" })).toBeVisible();

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("heading", { name: "Request execution path" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to Chinese" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: /Performance metrics/ }).click();
  await expect(page.getByRole("heading", { name: "Per-request results" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Request latency comparison" })).toBeVisible();
  await expect(page.locator(".visualization-reading-protocol")).toHaveCount(0);
  await expect(page.locator(".visualization-caption").first()).toContainText("TTFT");
  await page.getByRole("button", { name: /Result confidence/ }).click();
  await expect(page.getByRole("heading", { name: "Simulation detail actually used by each stage" })).toBeVisible();
  await page.locator(".new-run-button").click();
  await expect(page.getByRole("heading", { name: "Review and run" })).toBeVisible();
  await page.getByRole("button", { name: /Execution flow/ }).click();
  await expect(page.getByRole("heading", { name: "Request execution path" })).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Request execution path" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expectNoUnexpectedTextOverflow(page);

  await page.getByRole("button", { name: "Switch to Chinese" }).click();
  await expect(page.getByRole("heading", { name: "请求执行路线" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  expect(browserFailures).toEqual([]);
});

test("light blue theme is the desktop default and the theme choice survives reload", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "experiment");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "blue");
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "light");
  await expect(page.getByRole("button", { name: "切换到深色模式" })).toBeVisible();
  await expect(page.getByRole("button", { name: "设置主题颜色" })).toBeVisible();
  expect(
    await page.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--canvas").trim()),
  ).toBe("#ffffff");
  await expect(page.locator(".capability-panel")).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);

  const spacing = await page.locator(".capability-panel").evaluate((panel) => {
    const grid = panel.querySelector(".capability-grid");
    const identity = panel.querySelector(".backend-identity-panel");
    const panelBox = panel.getBoundingClientRect();
    const gridBox = grid.getBoundingClientRect();
    const identityBox = identity.getBoundingClientRect();
    return {
      gridInset: gridBox.left - panelBox.left,
      identityInset: identityBox.left - panelBox.left,
    };
  });
  expect(spacing.gridInset).toBeGreaterThanOrEqual(24);
  expect(spacing.identityInset).toBeGreaterThanOrEqual(24);

  await page.getByRole("button", { name: "设置主题颜色" }).click();
  const themePanel = page.getByRole("dialog", { name: "主题颜色", exact: true });
  await expect(themePanel).toBeVisible();
  await expect(themePanel.getByRole("option")).toHaveCount(0);
  await expect(themePanel.getByRole("listbox")).toHaveCount(0);
  await expect(themePanel.getByRole("textbox", { name: "HEX 颜色" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(themePanel.getByRole("spinbutton", { name: "红色（R）" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "设置主题颜色" })).toBeFocused();
  await page.getByRole("button", { name: "设置主题颜色" }).click();
  await themePanel.getByRole("textbox", { name: "HEX 颜色" }).fill("#27695a");
  await themePanel.getByRole("button", { name: "应用自定义颜色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
  await page.getByRole("button", { name: "设置主题颜色" }).click();
  await expect(themePanel.getByRole("textbox", { name: "HEX 颜色" })).toHaveValue("#27695a");
  await themePanel.getByRole("textbox", { name: "HEX 颜色" }).fill("#397f75");
  await themePanel.getByRole("button", { name: "应用自定义颜色" }).click();
  await page.getByRole("button", { name: "设置主题颜色" }).click();
  await themePanel.getByRole("button", { name: "重置颜色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blue");
  expect(browserFailures).toEqual([]);
});

test("F8 experiment builder binds schema options, request preview, and exact error Pointers", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "experiment");

  await expect(page.locator(".capability-disclosure")).not.toHaveAttribute("open", "");
  await page.locator(".capability-disclosure > summary").click();
  await expect(page.locator(".capability-disclosure")).toHaveAttribute("open", "");
  await expect(page.locator(".experiment-schema-panel")).toBeVisible();
  await expect(page.locator(".experiment-schema-panel")).toContainText("实验编排契约");
  await expect(page.locator(".experiment-schema-panel")).toContainText("supported");
  await expect(page.locator(".experiment-schema-panel")).toContainText("S3=not_exposed");
  await expect(page.locator("[data-field-path]")).toHaveCount(8);
  await expect(page.locator(".schema-control-group .field-help code")).toHaveCount(0);

  const latency = page.locator('[data-field-path="/overrides/fabric/scale_out_latency_us"] input');
  await latency.fill("1000");
  await expect(latency).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".schema-control-group .field-help code")).toHaveCount(2);
  await expect(page.locator("button.run-submit")).toBeDisabled();
  await page.locator(".experiment-request-preview summary").click();
  await expect(page.locator(".request-preview-error code")).toHaveText("/overrides/fabric/scale_out_latency_us");

  await latency.fill("4");
  await page.locator('[data-field-path="/overrides/runtime/batch_scheduler"] select').selectOption("decode_priority");
  const request = JSON.parse((await page.locator(".experiment-request-preview pre").textContent()) || "{}");
  expect(request.overrides.fabric.scale_out_latency_us).toBe(4);
  expect(request.overrides.runtime.batch_scheduler).toBe("decode_priority");
  expect(request.fidelity_policy).toBe("des");
  await expect(page.locator("button.run-submit")).toBeEnabled();

  await page.getByRole("button", { name: "JSON 输入" }).click();
  await expect(page.locator(".request-preview-error code")).toHaveText("/custom_inputs/runtime_trace");
  await expect(page.locator("button.run-submit")).toBeDisabled();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("Trace package mode exposes inspected provenance without promoting synthetic evidence", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const submittedRequests = [];
  const browserFailures = await openFixture(page, fixture, "experiment", {
    tracePackageRunHandler: ({ request, idempotencyKey }) => {
      submittedRequests.push({ request, idempotencyKey });
    },
  });

  const traceMode = page.getByRole("button", { name: "Trace package" });
  await traceMode.focus();
  await expect(traceMode).toBeFocused();
  await page.keyboard.press("Enter");

  const panel = page.locator(".trace-package-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("synthetic-package", { exact: true }).first()).toBeVisible();
  await expect(panel).toContainText("tilesim-trace-fixture");
  await expect(panel).toContainText("experiment-trace-fixture");
  await expect(panel).toContainText("physical-synthetic-package");
  await expect(panel).toContainText("s1_runtime");
  await expect(panel).toContainText("synthetic_trace");
  await expect(panel).toContainText("uncalibrated");
  await expect(panel).toContainText("exploratory");
  await expect(panel).toContainText("6/6");
  await expect(panel.locator(".trace-package-list .available")).toHaveCount(1);
  await expect(panel.locator(".trace-package-list .unavailable")).toHaveCount(2);
  await expect(page.locator("button.run-submit")).toBeEnabled();

  await panel.locator(".trace-package-list button").filter({ hasText: "real-package" }).click();
  await expect(panel).toContainText("real_trace");
  await expect(panel).toContainText("首版仅开放 synthetic_trace，不构成校准或留出验证证据。");
  await expect(page.locator("button.run-submit")).toBeDisabled();

  await panel.locator(".trace-package-list button").filter({ hasText: "synthetic-package" }).click();
  await panel.getByRole("button", { name: "重新检查" }).click();
  await expect(page.locator("button.run-submit")).toBeEnabled();
  await page.locator(".experiment-request-preview summary").click();
  const request = JSON.parse((await page.locator(".experiment-request-preview pre").textContent()) || "{}");
  expect(request.trace_package_id).toBe("synthetic-package");
  expect(request).not.toHaveProperty("overrides");
  expect(request).not.toHaveProperty("custom_inputs");
  expect(request).not.toHaveProperty("design_space_candidates");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);

  await page.locator("button.run-submit").click();
  await expect(page.getByRole("heading", { name: "运行摘要", exact: true })).toBeVisible();
  expect(submittedRequests).toHaveLength(1);
  expect(submittedRequests[0].request.trace_package_id).toBe("synthetic-package");
  expect(submittedRequests[0].request).not.toHaveProperty("overrides");
  expect(submittedRequests[0].request).not.toHaveProperty("custom_inputs");
  expect(submittedRequests[0].request).not.toHaveProperty("design_space_candidates");
  expect(submittedRequests[0].idempotencyKey).toMatch(/^run-/);
  expect(browserFailures).toEqual([]);
});

test("dark appearance preserves palette, chart readability, accessibility, and desktop layout", async ({
  page,
}, testInfo) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "execution");
  await page.getByRole("button", { name: "切换到深色模式" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "blue");
  await expect(page.getByRole("button", { name: "切换到浅色模式" })).toBeVisible();
  await expect(page.locator('.execution-chart svg path[fill="#70b9e2"]').first()).toBeVisible();
  expect(
    await page.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--canvas").trim()),
  ).toBe("#191a1c");
  await expect
    .poll(() =>
      page.locator(".execution-chart svg text").evaluateAll((items) => items.map((item) => item.getAttribute("fill"))),
    )
    .toContain("#9b9fa5");

  await page.getByRole("button", { name: "设置主题颜色" }).click();
  await page.getByRole("textbox", { name: "HEX 颜色" }).fill("#397f75");
  await page.getByRole("button", { name: "应用自定义颜色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");

  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(page.getByRole("heading", { name: "Request execution path" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(browserFailures).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`dark-evidence-${testInfo.project.name}.png`, { fullPage: true });

  await page.locator(".new-run-button").click();
  await expect(page.getByRole("heading", { name: "Review and run" })).toBeVisible();
  await expect(page.locator(".field input").first()).toBeVisible();
  expect(
    await page
      .locator(".field input")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe("rgb(255, 255, 255)");
  const experimentResults = await new AxeBuilder({ page }).analyze();
  expect(experimentResults.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
});

test("desktop motion is restrained and reduced-motion removes decorative transitions", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "execution");
  await expect(page.getByRole("heading", { name: "请求执行路线" })).toBeVisible();

  const flowNode = page.locator(".execution-flow > .flow-node").first();
  const defaultMotion = await flowNode.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationIterationCount: style.animationIterationCount,
    };
  });
  expect(defaultMotion.animationName).toBe("none");
  expect(parseFloat(defaultMotion.animationDuration)).toBeLessThanOrEqual(0.4);
  expect(defaultMotion.animationIterationCount).toBe("1");
  await flowNode.hover();
  await expect.poll(() => flowNode.evaluate((element) => getComputedStyle(element).transform)).toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "请求执行路线" })).toBeVisible();

  const surfaceMotion = await page
    .locator(".view-stack > *")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationDuration: style.animationDuration,
        animationDelay: style.animationDelay,
        transitionDuration: style.transitionDuration,
      };
    });
  expect(parseFloat(surfaceMotion.animationDuration)).toBeLessThanOrEqual(0.001);
  expect(surfaceMotion.animationDelay).toBe("0s");
  expect(
    await page
      .locator(".execution-flow > .flow-node")
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).animationDuration)),
  ).toBeLessThanOrEqual(0.001);

  await page.getByRole("button", { name: "设置主题颜色" }).click();
  const themeList = page.getByRole("dialog", { name: "主题颜色", exact: true });
  await expect(themeList).toBeVisible();
  expect(
    await themeList.evaluate((element) =>
      getComputedStyle(element)
        .transitionDuration.split(",")
        .every((duration) => parseFloat(duration) <= 0.001),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");

  await expectNoUnexpectedTextOverflow(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(browserFailures).toEqual([]);
});

test("rename modal traps focus, closes with Escape, and restores its trigger", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  await openFixture(page, fixture, "history");
  await expect(page.locator(".compare-shell")).toHaveCount(0);
  const compareTrigger = page.getByRole("button", { name: "对比", exact: true }).first();
  await expect(compareTrigger).toBeVisible();
  await compareTrigger.click();
  await expect(page.locator(".compare-shell")).toBeVisible();
  const trigger = page.locator('button[title="重命名"]').first();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "重命名实验" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("input")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("structured performance report exports a readable and machine-readable S0-S9 document", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整技术报告" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("synthetic-s1-s6-complete-structured-performance-report.html");
  const stream = await download.createReadStream();
  let html = "";
  for await (const chunk of stream) html += chunk.toString();
  expect(html).toContain("TILESIM STRUCTURED PERFORMANCE REPORT");
  expect(html).toContain('id="s0"');
  expect(html).toContain('id="s9"');
  expect(html).toContain('id="appendix"');
  expect(html).toContain('id="tilesim-structured-report"');
  expect(html).toContain("not_generated");
  expect(html).toContain("required_propagation_node_missing_or_unresolved");
  await expect(page.locator(".toast--positive")).toContainText("已导出");
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: fixture.id })).toBeVisible();
  await expect(page.getByRole("heading", { name: "完整性能证据明细" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("unknown schema fails closed to the complete raw report", async ({ page }, testInfo) => {
  const fixture = fixtureCase("unknown-run-schema");
  const browserFailures = await openFixture(page, fixture);
  await expect(page.getByRole("alert")).toContainText("结构化视图尚未适配该报告版本");
  await expect(page.getByRole("alert")).toContainText("wind_tunnel.run.v999");
  await page.locator(".json-artifact-panel").evaluate((element) => (element.open = true));
  await expect(page.locator(".artifact-line-text").filter({ hasText: "must-remain-visible" })).toBeVisible();
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`unknown-schema-${testInfo.project.name}.png`, { fullPage: true });
});

test("held-out provenance is retained without a synthetic warning", async ({ page }) => {
  const fixture = fixtureCase("held-out-s1-s6");
  const browserFailures = await openFixture(page, fixture);
  await expect(page.locator(".evidence-tags")).toContainText("真实采集数据");
  await expect(page.locator(".evidence-tags")).toContainText("held out validated");
  await expect(page.locator(".evidence-tags")).toContainText("held out validation");
  await expect(page.locator(".evidence-warning")).toHaveCount(0);
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});

test("boundary metrics remain unavailable rather than becoming zero", async ({ page }) => {
  const boundary = fixtureCase("boundary-expected-absence");
  const boundaryFailures = await openFixture(page, boundary, "metrics");
  const unavailableMetrics = page.locator('[data-help-anchor="metrics-summary"] .stat-card strong');
  await expect(unavailableMetrics).toHaveText(["不适用", "不适用", "不适用", "不适用"]);
  for (const metric of await unavailableMetrics.all()) await expect(metric).toBeVisible();
  await expect(page.getByText("0/0 请求完成")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await expectNoUnexpectedTextOverflow(page);
  expect(boundaryFailures).toEqual([]);
});

test("legacy bundles remain readable without invented optional artifacts", async ({ page }) => {
  const legacy = fixtureCase("legacy-missing-optional");
  const legacyFailures = await openFixture(page, legacy, "overview");
  await page.locator(".evidence-technical-disclosure > summary").click();
  await expect(page.locator(".evidence-technical-content code")).toContainText("fixture-legacy::events");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expectNoUnexpectedTextOverflow(page);
  expect(legacyFailures).toEqual([]);
});

test("help documentation is keyboard-complete, bilingual, accessible, and reduced-motion safe", async ({ page }) => {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  const browserFailures = await openFixture(page, fixture, "overview");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    window.__guidedHelpScrollBehaviors = [];
    Element.prototype.scrollIntoView = function (options) {
      window.__guidedHelpScrollBehaviors.push(options?.behavior || "auto");
    };
  });
  const start = page.getByRole("button", { name: "页面帮助", exact: true });
  await start.focus();
  await page.keyboard.press("Enter");
  const panel = page.locator("dialog.help-documentation");
  await expect(panel).toBeVisible();
  await expect(panel.locator("[data-guide-id]")).toHaveCount(13);
  await expect(panel.getByRole("button", { name: "关闭帮助" })).toBeFocused();
  expect(await page.evaluate(() => window.__guidedHelpScrollBehaviors)).toEqual([]);
  await expect(page.locator("[data-help-active]")).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  expect(await panel.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  const originalUrl = page.url();
  for (const id of [
    "overview",
    "experiment",
    "history",
    "execution",
    "metrics",
    "fabric",
    "attribution",
    "design_space",
    "validation",
    "evidence_agent",
    "evidence_lab",
    "raw_evidence",
    "unsupported_schema",
  ]) {
    await panel.locator('[data-guide-id="' + id + '"]').click();
    await expect(panel.locator('[aria-current="page"]')).toHaveAttribute("data-guide-id", id);
    await expect(panel.getByRole("heading", { name: "适用范围与证据边界", exact: true })).toBeAttached();
    expect(page.url()).toBe(originalUrl);
    if (id !== "overview") await expect(panel.locator(".help-documentation-locate")).toHaveCount(0);
  }
  const search = panel.getByRole("searchbox");
  await search.fill("no-such-topic");
  await expect(panel.getByRole("status")).toContainText("没有匹配");
  await search.fill("TTFT");
  await expect(panel.locator('[data-guide-id="metrics"]')).toBeVisible();
  await search.fill("");
  await panel.locator('[data-guide-id="overview"]').click();
  await panel.getByRole("button", { name: "术语与定义", exact: true }).click();
  expect(await page.evaluate(() => window.__guidedHelpScrollBehaviors)).toEqual(["auto"]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expectNoUnexpectedTextOverflow(page);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(start).toBeFocused();
  await start.click();
  await panel.locator(".help-documentation-locate").first().click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator('[data-help-anchor="overview-status"]')).toBeFocused();
  await page.getByRole("button", { name: "切换到英文" }).click();
  await page.getByRole("button", { name: "Page help", exact: true }).click();
  await expect(panel).toHaveAttribute("lang", "en");
  await expect(panel.getByRole("heading", { name: "Terms and definitions", exact: true })).toBeAttached();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(browserFailures).toEqual([]);
});

test("raw and unsupported evidence guides remain available at fail-closed boundaries", async ({ page }) => {
  const fixture = fixtureCase("unknown-run-schema");
  const browserFailures = await openFixture(page, fixture);
  await expect(page.getByRole("alert")).toContainText("结构化视图尚未适配该报告版本");
  await page.getByRole("button", { name: "页面帮助", exact: true }).click();
  const panel = page.locator("dialog.help-documentation");
  await expect(panel.getByRole("heading", { name: "报告兼容性", exact: true })).toBeVisible();
  await expect(panel).toContainText("Schema");
  await page.keyboard.press("Escape");
  await page.locator(".json-artifact-panel > summary").click();
  await page.getByRole("button", { name: "原始证据帮助", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "原始证据", exact: true })).toBeVisible();
  await expect(panel).toContainText("uint64");
  await expect(panel.locator("[data-guide-id]")).toHaveCount(13);
  await expect(page.locator("[data-help-active]")).toHaveCount(0);
  await expectNoUnexpectedTextOverflow(page);
  expect(browserFailures).toEqual([]);
});
