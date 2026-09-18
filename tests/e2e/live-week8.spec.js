import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const liveBaseUrl = process.env.TILESIM_LIVE_BASE_URL;
const liveRunId = process.env.TILESIM_LIVE_RUN_ID;
const liveRequestId = process.env.TILESIM_LIVE_REQUEST_ID;

function observeBrowserFailures(page) {
  const failures = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) =>
    failures.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ""}`),
  );
  return failures;
}

test("deployed Week 8 Bridge closes the request-bound F6B chain", async ({ page }) => {
  test.skip(!liveBaseUrl || !liveRunId || !liveRequestId, "Live Week 8 Bridge coordinates were not provided.");

  const browserFailures = observeBrowserFailures(page);

  await page.goto(
    `${liveBaseUrl}/attribution?run=${encodeURIComponent(liveRunId)}&evidence_request=${encodeURIComponent(liveRequestId)}`,
    { waitUntil: "domcontentloaded" },
  );
  const panel = page.locator(".run-bound-evidence-panel");
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel).toContainText("partitioned_des", { timeout: 30_000 });
  await expect(panel.locator(".run-bound-identity-strip")).toContainText("版本化 contract");
  await expect(panel.locator('.percentile-subjects [aria-current="true"]')).not.toHaveCount(0);

  const states = await panel.locator(".run-bound-node, .run-bound-output-node").evaluateAll((nodes) =>
    nodes.map((node) => ({
      subsystem: node.querySelector("header span")?.textContent?.trim() || "",
      className: node.querySelector('small[class*="availability--"]')?.className || "",
    })),
  );
  expect(states.map((state) => state.subsystem)).toEqual(["S1", "S3", "S4", "S5", "S6", "S7", "S8", "S9"]);
  expect(states.every((state) => state.className.includes("availability--available"))).toBe(true);

  const evidenceHrefs = await panel
    .locator("a.artifact-evidence-link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") || ""));
  expect(evidenceHrefs.length).toBeGreaterThan(0);
  for (const href of evidenceHrefs) {
    const target = new URL(href, liveBaseUrl);
    expect(target.searchParams.get("evidence_sha")).toMatch(/^[a-f0-9]{64}$/);
    expect(target.searchParams.has("evidence_pointer")).toBe(true);
  }

  const week8 = panel.locator(".week8-execution-panel");
  await week8.locator("summary").click();
  await expect(week8).toContainText("partitioned_des");
  await expect(week8).toContainText("synthetic_trace");
  await expect(week8).toContainText("single_process_reference");

  expect(
    await page
      .locator(".execution-chart")
      .evaluateAll((charts) => charts.some((chart) => chart.outerHTML.includes("NaN"))),
  ).toBe(false);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(browserFailures).toEqual([]);
});

test("deployed Week 8 Bridge serves metrics-backed F7 Fabric evidence", async ({ page }) => {
  test.skip(!liveBaseUrl || !liveRunId, "Live Week 8 Bridge coordinates were not provided.");

  const browserFailures = observeBrowserFailures(page);

  await page.goto(`${liveBaseUrl}/fabric?run=${encodeURIComponent(liveRunId)}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "当前主要通信瓶颈" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "请求级 Fabric contribution" })).toBeVisible();
  await expect(page.locator(".fabric-request-table tbody tr")).not.toHaveCount(0);
  const targets = await page.locator(".fabric-request-table a.artifact-evidence-link").evaluateAll((links) =>
    links.map((link) => {
      const url = new URL(link.href);
      return {
        artifact: url.searchParams.get("evidence_artifact"),
        pointer: url.searchParams.get("evidence_pointer"),
        sha: url.searchParams.get("evidence_sha"),
      };
    }),
  );
  expect(targets.length).toBeGreaterThan(0);
  expect(targets.every(({ artifact }) => artifact === "metrics")).toBe(true);
  expect(targets.every(({ pointer }) => pointer?.startsWith("/system_summary/"))).toBe(true);
  expect(targets.every(({ sha }) => /^[a-f0-9]{64}$/.test(sha || ""))).toBe(true);
  await expect(page.locator(".fabric-topology-gap")).toContainText("正式契约已验证");
  await page.locator(".fabric-domain-disclosure > summary").click();
  await expect(page.locator(".domain-topology-contract a.artifact-evidence-link").first()).toBeVisible();
  const topologyTargets = await page
    .locator(".domain-topology-contract a.artifact-evidence-link")
    .evaluateAll((links) =>
      links.map((link) => {
        const url = new URL(link.href);
        return {
          artifact: url.searchParams.get("evidence_artifact"),
          pointer: url.searchParams.get("evidence_pointer"),
          sha: url.searchParams.get("evidence_sha"),
        };
      }),
    );
  expect(topologyTargets.length).toBeGreaterThan(0);
  expect(topologyTargets.every(({ artifact }) => artifact === "input-topology")).toBe(true);
  expect(topologyTargets.every(({ pointer }) => /^\/topology\/domains\/\d+$/.test(pointer || ""))).toBe(true);
  expect(topologyTargets.every(({ sha }) => /^[a-f0-9]{64}$/.test(sha || ""))).toBe(true);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(browserFailures).toEqual([]);
});

test("deployed Week 8 Bridge serves formal F7 design-space evidence", async ({ page }) => {
  test.skip(!liveBaseUrl || !liveRunId, "Live Week 8 Bridge coordinates were not provided.");

  const browserFailures = observeBrowserFailures(page);
  await page.goto(`${liveBaseUrl}/design-space?run=${encodeURIComponent(liveRunId)}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByRole("heading", { name: "Pareto 与 artifact-record 证据" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".f7-formal-summary")).toContainText("artifact_record");
  await expect(page.locator(".candidate-detail")).not.toHaveCount(0);
  const targets = await page.locator(".candidate-detail a.artifact-evidence-link").evaluateAll((links) =>
    links.map((link) => {
      const url = new URL(link.href);
      return {
        artifact: url.searchParams.get("evidence_artifact"),
        pointer: url.searchParams.get("evidence_pointer"),
        sha: url.searchParams.get("evidence_sha"),
      };
    }),
  );
  expect(targets.some(({ pointer }) => /^\/candidates\/\d+$/.test(pointer || ""))).toBe(true);
  expect(targets.some(({ pointer }) => /^\/candidates\/\d+\/objectives\/\d+$/.test(pointer || ""))).toBe(true);
  expect(
    targets.some(({ pointer }) =>
      /^\/candidates\/\d+\/executed_s6_knobs\/\d+\/(requested_value|resolved_value)$/.test(pointer || ""),
    ),
  ).toBe(true);
  expect(targets.every(({ artifact }) => artifact === "design-space")).toBe(true);
  expect(targets.every(({ sha }) => /^[a-f0-9]{64}$/.test(sha || ""))).toBe(true);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(browserFailures).toEqual([]);
});

test("deployed Week 8 Bridge exposes the formal F8 schema-driven experiment surface", async ({ page, request }) => {
  test.skip(!liveBaseUrl, "Live Week 8 Bridge base URL was not provided.");

  const browserFailures = observeBrowserFailures(page);
  const manifestResponse = await request.get(`${liveBaseUrl}/api/manifest`);
  const descriptorResponse = await request.get(`${liveBaseUrl}/api/experiment-schema`);
  expect(manifestResponse.ok()).toBe(true);
  expect(descriptorResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  const descriptor = await descriptorResponse.json();
  expect(descriptor.schema_set_revision).toBe(manifest.schema_set_revision);
  await page.goto(`${liveBaseUrl}/experiment`, { waitUntil: "domcontentloaded" });

  await page.locator(".capability-disclosure > summary").click();
  const schemaPanel = page.locator(".experiment-schema-panel");
  await expect(schemaPanel).toBeVisible({ timeout: 30_000 });
  await expect(schemaPanel).toContainText(manifest.schema_set_revision, { timeout: 30_000 });
  await expect(schemaPanel).toContainText(descriptor.descriptor_revision);
  await expect(schemaPanel).toContainText("controls · json");
  await expect(schemaPanel).toContainText("built_in_synthetic · strict_s6_manifest");
  await expect(schemaPanel).toContainText("supported");
  await expect(schemaPanel).toContainText("S3=not_exposed");
  await expect(schemaPanel).toContainText("real_trace=unavailable");
  await expect(page.locator("[data-field-path]")).toHaveCount(8);

  const latency = page.locator('[data-field-path="/overrides/fabric/scale_out_latency_us"] input');
  await latency.fill("1000");
  await expect(latency).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("button.run-submit")).toBeDisabled();
  await page.locator(".experiment-request-preview summary").click();
  await expect(page.locator(".request-preview-error code")).toHaveText("/overrides/fabric/scale_out_latency_us");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(browserFailures).toEqual([]);
});

test("deployed Bridge exposes the F9 descriptor v2 and reports authenticated Provider availability truthfully", async ({
  page,
  request,
}) => {
  test.skip(!liveBaseUrl || !liveRunId, "Live F9 Bridge coordinates were not provided.");

  const manifestResponse = await request.get(`${liveBaseUrl}/api/manifest`);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifestResponse.headers()["x-tilesim-schema-set-revision"]).toBe(manifest.schema_set_revision);
  expect(manifest.evidence_agent).toMatchObject({
    descriptor_schema_identity: "tilesim.bridge.evidence_agent_descriptor.v2",
    descriptor_revision: "sha256:5f78ed33e20c131f672af53368c5ca950f41d63fd2e8f5301757d1f42debe357",
    request_schema_identity: "tilesim.bridge.evidence_agent_request.v1",
    response_schema_identity: "tilesim.bridge.evidence_agent_response.v1",
  });

  const descriptorResponse = await request.get(`${liveBaseUrl}/api/agent/evidence-capabilities`);
  expect(descriptorResponse.ok()).toBe(true);
  const descriptor = await descriptorResponse.json();
  expect(descriptor).toMatchObject({
    schema_version: "tilesim.bridge.evidence_agent_descriptor.v2",
    schema_set_revision: manifest.schema_set_revision,
  });
  if (descriptor.availability === "available") {
    expect(descriptor.provider).toMatchObject({
      configured: true,
      provider_id: "tilesim_newapi_openai_v1",
      model_id: "gpt-5.6-sol",
      model_revision: "gpt-5.6-sol",
    });
  } else {
    expect(descriptor).toMatchObject({
      availability: "unavailable",
      degradation: { reason_code: "provider_unavailable" },
      provider: { configured: false },
    });
  }
  expect(descriptor.execution.retry.same_key_same_canonical_payload.provider_reinvocation).toBe("forbidden");
  expect(descriptor.execution.terminal_recovery.claims_bearing_terminal).toMatchObject({
    outcome: "error",
    http_status: 409,
    code: "terminal_result_not_retained",
    field_path: "/headers/Idempotency-Key",
    retryable: false,
  });
  expect(Object.values(descriptor.persistence.payload_retention)).toEqual([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);

  const browserFailures = observeBrowserFailures(page);
  await page.goto(`${liveBaseUrl}/evidence-agent?run=${encodeURIComponent(liveRunId)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "AI 解释" })).toBeVisible({ timeout: 30_000 });
  if (descriptor.availability === "available") {
    await expect(page.locator(".evidence-agent-unavailable")).toHaveCount(0, { timeout: 30_000 });
  } else {
    await expect(page.locator(".evidence-agent-unavailable")).toContainText("provider_unavailable");
    await expect(page.getByRole("button", { name: "生成解释" })).toBeDisabled();
  }
  await page.locator(".evidence-agent-policy-disclosure > summary").click();
  await expect(page.locator(".evidence-agent-contract-grid")).toContainText("terminal_result_not_retained");
  await expect(page.locator(".evidence-agent-retention-list li")).toHaveCount(7);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  expect(browserFailures).toEqual([]);
});

test("deployed semantic glossary remains bilingual, traceable, and readable at both desktop widths", async ({
  page,
}) => {
  test.skip(!liveBaseUrl || !liveRunId, "Live Bridge coordinates were not provided.");
  test.setTimeout(120_000);

  const browserFailures = observeBrowserFailures(page);
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto(`${liveBaseUrl}/execution?run=${encodeURIComponent(liveRunId)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "请求执行路线" })).toBeVisible({ timeout: 30_000 });
  await page.locator(".flow-node").filter({ hasText: "S0" }).click();
  const provenance = page.locator('.visualization-panel[data-chart-kind="matrix"]');
  await expect(provenance).toContainText("输入来源模式");
  await expect(provenance).toContainText("人工生成 Trace");
  await expect(provenance).toContainText("技术字段：source_mode = synthetic_trace");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );

  await page.getByRole("button", { name: "切换到深色模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await page.getByRole("button", { name: "切换到英文" }).click();
  await expect(provenance).toContainText("Input source mode");
  await expect(provenance).toContainText("Synthetic trace");
  await expect(provenance).toContainText("Technical field: source_mode = synthetic_trace");

  await page.goto(`${liveBaseUrl}/metrics?run=${encodeURIComponent(liveRunId)}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Per-request results" })).toBeVisible({ timeout: 30_000 });
  const metricsDetails = page.locator(".visualization-data").first();
  await metricsDetails.locator("summary").click();
  await expect(metricsDetails).toContainText("Technical field: derivation = unit_conversion");

  await page.goto(`${liveBaseUrl}/validation?run=${encodeURIComponent(liveRunId)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".provenance-grid")).toContainText("Input source mode", { timeout: 30_000 });
  await expect(page.locator(".provenance-grid")).toContainText("Technical field: calibration_level = uncalibrated");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "light");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  expect(browserFailures).toEqual([]);
});
