import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fixtureCase } from "../helpers/fixtures";
import { createF8ExperimentDescriptor, f8Capabilities, f8SchemaRevision } from "../fixtures/experiment-descriptor";

const runId = "run-lightweight-l6";
const agentOrchestrationCatalog = JSON.parse(
  readFileSync(
    new URL("../../bridge/contracts/agent_orchestration_capability/catalog-content.json", import.meta.url),
    "utf8",
  ),
);

function agentOrchestrationSnapshot() {
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

function reportFixture() {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  fixture.reports.run = { ...fixture.reports.run, status: "completed", summary: { ...fixture.reports.run.summary } };
  fixture.reports.metrics = {
    ...fixture.reports.metrics,
    schema_version: "tilesim.metrics_report.v1",
    run_id: runId,
    percentile_subjects: fixture.reports.metrics.percentile_subjects || [],
  };
  fixture.reports.metrics.summary = {
    ...fixture.reports.metrics.summary,
    throughput_requests_per_second: fixture.reports.metrics.summary?.throughput_requests_per_second ?? 0,
  };
  fixture.reports.metrics.system_summary.fabric_utilization_ratio = 0;
  fixture.reports.metrics.system_summary.fabric_domain_utilization = [
    { domain_id: "fabric-0", utilization_ratio: 0 },
    { domain_id: "fabric-1", utilization_ratio: null },
  ];
  return fixture;
}

async function installApi(page, mode = "complete", options = {}) {
  const fixture = reportFixture();
  const capabilities = structuredClone(f8Capabilities);
  const descriptor = createF8ExperimentDescriptor();
  if (options.unavailableFieldId) {
    capabilities.run_surface.override_parameter_field_ids =
      capabilities.run_surface.override_parameter_field_ids.filter((fieldId) => fieldId !== options.unavailableFieldId);
    descriptor.parameter_descriptors = descriptor.parameter_descriptors.map((field) =>
      field.field_id === options.unavailableFieldId
        ? {
            ...field,
            available: false,
            unavailable_reason: "fixture capability unavailable",
            capability_predicate: { ...field.capability_predicate, evaluated_available: false },
          }
        : field,
    );
  }
  const runArtifactText = JSON.stringify({ ...fixture.reports.run, run_id: runId });
  const runArtifactSha = createHash("sha256").update(runArtifactText).digest("hex");
  const metricsArtifactText = JSON.stringify(fixture.reports.metrics);
  const metricsArtifactSha = createHash("sha256").update(metricsArtifactText).digest("hex");
  let statusCalls = 0;
  let postCount = 0;
  let agentCapabilityRequests = 0;
  let lastKey = null;
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let body;
    let status = 200;
    if (path === "/api/manifest") {
      body = {
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
          descriptor_revision: f8SchemaRevision,
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
          profile_schema_identities: [
            "tilesim.bridge.agent_orchestration_model_profile.v1",
            "tilesim.bridge.agent_orchestration_engine_profile.v1",
            "tilesim.bridge.agent_orchestration_device_profile.v1",
            "tilesim.bridge.agent_orchestration_topology_profile.v1",
            "tilesim.bridge.agent_orchestration_workload_profile.v1",
          ],
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
    } else if (path === "/api/health")
      body = {
        cli_available: true,
        execution_ready: true,
        versions_match: true,
        state_digests_match: true,
        source_revision: "fixture",
        build_revision: "fixture",
        source_state_digest: "fixture",
        build_state_digest: "fixture",
        deployment_ref: "fixture:l6",
      };
    else if (path === "/api/catalog")
      body = {
        scenarios: [{ scenario_id: "s1_des_example", label: "S1 → S6 synthetic runtime example" }],
        fidelity_policies: ["default", "des"],
        input_modes: ["controls", "json", "trace_package"],
        design_space_modes: ["built_in_synthetic"],
        gpu_participation_modes: ["gpu_free"],
      };
    else if (path === "/api/capabilities") body = capabilities;
    else if (path === "/api/experiment-schema") body = descriptor;
    else if (path === "/api/agent/evidence-capabilities")
      body = {
        schema_version: "tilesim.bridge.evidence_agent_descriptor.v2",
        descriptor_revision: f8SchemaRevision,
        provider: { configured: false, available: false },
      };
    else if (path === "/api/agent/orchestration-capabilities") {
      agentCapabilityRequests += 1;
      body = agentOrchestrationSnapshot();
    } else if (path === "/api/runs" && request.method() === "POST") {
      postCount += 1;
      lastKey = request.headers()["idempotency-key"];
      body = {
        run_id: runId,
        run_name: "L6 fixture run",
        status: "queued",
        input_mode: "controls",
        created_at: "2026-09-14T00:00:00Z",
        idempotent_replay: postCount > 1,
      };
      status = 202;
    } else if (path === `/api/runs/${runId}`) {
      statusCalls += 1;
      const states = mode === "failed" ? ["queued", "failed"] : ["queued", "preparing", "running", "completed"];
      const current = states[Math.min(statusCalls - 1, states.length - 1)];
      body = {
        run_id: runId,
        run_name: "L6 fixture run",
        status: current,
        fidelity_policy: "default",
        created_at: "2026-09-14T00:00:00Z",
        finished_at: current === "completed" ? "2026-09-14T00:00:04Z" : null,
        error: current === "failed" ? "fixture execution failed" : null,
      };
    } else if (path === `/api/runs/${runId}/reports`) body = { run_id: runId, reports: fixture.reports };
    else if (path === `/api/runs/${runId}/artifacts`)
      body = {
        schema_version: "tilesim.bridge.artifact_manifest.v2",
        api_version: "tilesim.bridge.api.v1",
        schema_set_revision: f8SchemaRevision,
        run_id: runId,
        artifacts: [
          {
            artifact_id: "run-result",
            report_kind: "run",
            file_name: "run-result.json",
            media_type: "application/json",
            bytes: Buffer.byteLength(runArtifactText),
            sha256: runArtifactSha,
            schema_identity: "wind_tunnel.run.v1alpha1",
            contract_status: "supported",
          },
          {
            artifact_id: "metrics",
            report_kind: "metrics",
            file_name: "metrics.json",
            media_type: "application/json",
            bytes: Buffer.byteLength(metricsArtifactText),
            sha256: metricsArtifactSha,
            schema_identity: "tilesim.metrics_report.v1",
            contract_status: "supported",
          },
        ],
        rejected_artifacts: [],
      };
    else if (path === `/api/runs/${runId}/files/run-result`) body = JSON.parse(runArtifactText);
    else if (path === `/api/runs/${runId}/files/metrics`) body = JSON.parse(metricsArtifactText);
    else if (path === "/api/runs") body = { runs: [] };
    else {
      status = 404;
      body = { error: "not found" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: { "X-TileSim-Schema-Set-Revision": f8SchemaRevision },
      body: JSON.stringify(body),
    });
  });
  return {
    fixture,
    getIdempotency: () => lastKey,
    getPostCount: () => postCount,
    getAgentCapabilityRequests: () => agentCapabilityRequests,
  };
}

test.describe("L6 lightweight formal-run closure", () => {
  test("start stays focused while legacy task and learning routes defer to page help", async ({ page }) => {
    await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, (route) => route.abort("connectionrefused"));
    await page.goto("/lightweight");
    await expect(page.getByRole("heading", { name: "开始或继续一次实验" })).toBeVisible();
    await page.goto("/lightweight/tasks?run=run-demo-1&task=understand-flow&unknown=drop");
    await expect(page).toHaveURL(/\/lightweight\/prepare\?run=run-demo-1$/);
    await expect(page.getByRole("heading", { name: "配置一次可追溯的实验" })).toBeVisible();
    await expect(page.locator(".lightweight-tasks-view")).toHaveCount(0);
    await page.goto("/lightweight/learn?run=run-demo-1&task=understand-flow&unknown=drop");
    await expect(page).toHaveURL(/\/lightweight\?run=run-demo-1$/);
    await page.getByRole("button", { name: "页面帮助" }).click();
    const help = page.locator("dialog.help-documentation");
    await expect(help).toBeVisible();
    await help.locator('button[data-guide-id="lightweight_results"]').click();
    await expect(help).toContainText("real_trace");
    await expect(help).toContainText("missing");
    await expect(page.locator("button", { hasText: "校验并提交实验" })).toHaveCount(0);
  });

  test("shared Agent opens once in lightweight prepare and drafts without creating a run", async ({ page }) => {
    const prohibitedRequests = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        (url.pathname === "/api/runs" && request.method() === "POST") ||
        url.pathname.includes("/agent/evidence-analyses")
      ) {
        prohibitedRequests.push(`${request.method()} ${url.pathname}`);
      }
    });
    const api = await installApi(page);

    await page.goto("/lightweight/prepare", { waitUntil: "networkidle" });
    const batchInput = page.locator('.field[data-field-id="s1.runtime.max_batch_size"] input');
    await expect(batchInput).toBeVisible();
    await batchInput.fill("4");

    await expect(page.locator(".agent-copilot-entry")).toHaveCount(1);
    // Lightweight setup keeps the operational form compact; explanatory
    // guidance is exposed through the top-right page-help dialog instead of
    // competing with the fields in the primary flow.
    await expect(page.locator(".lightweight-prepare .form-section-title p")).toHaveCount(0);
    await expect(page.locator(".lightweight-prepare .field-help")).toHaveCount(0);
    await page.getByRole("button", { name: "打开 TileSim 助手", exact: true }).click();
    const panel = page.locator("#tilesim-agent-copilot");
    await expect(panel).toHaveCount(1);
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("轻量实验配置");
    await expect(panel.getByRole("radio", { name: "提出草案修改" })).toBeVisible();
    await expect(page.locator(".lightweight-conversation")).toHaveCount(0);

    await panel.getByRole("radio", { name: "提出草案修改" }).check();
    await panel.getByRole("textbox", { name: "描述你想理解或调整的内容" }).fill("把最大 batch 调整为 8");
    await panel.getByRole("button", { name: "提交", exact: true }).click();

    await expect(panel).toContainText("这是草案，尚未创建运行。");
    await expect(panel).toContainText("4 → 8");
    expect(api.getAgentCapabilityRequests()).toBe(1);
    expect(api.getPostCount()).toBe(0);
    expect(prohibitedRequests).toEqual([]);

    const composer = panel.getByRole("textbox", { name: "描述你想理解或调整的内容" });
    await composer.fill("保留这段跨工作台输入");
    await panel.getByRole("button", { name: "收起", exact: true }).click();
    await page.getByRole("link", { name: "切换到专业工作台", exact: true }).click();
    await expect(page).toHaveURL(/\/overview/);
    await expect(page.locator(".agent-copilot-entry")).toHaveCount(1);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await panel.getByRole("button", { name: "展开 TileSim 助手", exact: true }).click();
    await expect(composer).toHaveValue("保留这段跨工作台输入");
    await expect(panel).toContainText("现有内容使用旧上下文");
    expect(api.getPostCount()).toBe(0);
    expect(prohibitedRequests).toEqual([]);
  });

  test("unavailable formal capability stays visible and keeps the shared Agent explain-only", async ({ page }) => {
    await installApi(page, "complete", { unavailableFieldId: "s1.runtime.max_batch_size" });
    await page.goto("/lightweight/prepare", { waitUntil: "networkidle" });

    const unavailableField = page.locator('.field[data-field-id="s1.runtime.max_batch_size"] input');
    await expect(unavailableField).toBeDisabled();
    await expect(page.locator('.field[data-field-id="s1.runtime.max_batch_size"]')).toContainText(
      "fixture capability unavailable",
    );

    await page.getByRole("button", { name: "打开 TileSim 助手", exact: true }).click();
    const panel = page.locator("#tilesim-agent-copilot");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("radio", { name: "仅询问" })).toBeVisible();
    await expect(panel.getByRole("radio", { name: "提出草案修改" })).toHaveCount(0);
  });

  test("shared Agent is available on lightweight run-bound pages with a read-only run context", async ({ page }) => {
    await installApi(page);
    await page.goto(`/lightweight/runs/${runId}`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: "打开 TileSim 助手", exact: true }).click();
    const panel = page.locator("#tilesim-agent-copilot");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(`轻量运行状态 · ${runId}`);
    await expect(panel).toContainText("上下文可用");
    await expect(panel.getByRole("radio", { name: "仅询问" })).toBeVisible();
    await expect(panel.getByRole("radio", { name: "提出草案修改" })).toHaveCount(0);

    await page.goto(`/lightweight/results?run=${runId}`, { waitUntil: "networkidle" });
    // A hard navigation intentionally resets the transient Agent shell state;
    // reopen the shared entry and verify that the new route publishes its own
    // run-bound context rather than reusing the previous page label.
    await page.getByRole("button", { name: "打开 TileSim 助手", exact: true }).click();
    const resultsPanel = page.locator("#tilesim-agent-copilot");
    await expect(resultsPanel).toContainText(`轻量结果摘要 · ${runId}`);
    await expect(resultsPanel.getByRole("radio", { name: "提出草案修改" })).toHaveCount(0);
  });

  test("new experiment → submit → status → real fixture results → professional round trip", async ({ page }) => {
    const api = await installApi(page);
    page.on("pageerror", (error) => console.log("L6 pageerror", error.message));
    page.on("console", (message) => message.type() === "error" && console.log("L6 console", message.text()));
    await page.goto("/", { waitUntil: "networkidle" });
    await page.locator("a.workbench-choice-card__action").first().click();
    await page.getByRole("link", { name: "新建实验" }).first().click();
    await expect(page).toHaveURL(/\/lightweight\/prepare/);
    await page.getByLabel(/实验名称/).fill("L6 fixture run");
    await expect(page.getByText("校验通过")).toBeVisible();
    const submit = page.getByRole("button", { name: /校验并提交实验/ });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(new RegExp(`/lightweight/runs/${runId}`));
    await expect(page.getByText(/排队中|准备中|运行中|已完成/).first()).toBeVisible();
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/lightweight/runs/${runId}`));
    await page.getByRole("button", { name: "刷新" }).click();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "刷新" }).click();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "刷新" }).click();
    await expect(page.getByText("已完成").first()).toBeVisible();
    await page.getByRole("link", { name: "查看结果" }).click();
    await expect(page).toHaveURL(/\/lightweight\/results/);
    await expect(page.getByText("0.0%").first()).toBeVisible();
    await expect(page.getByText("missing").first()).toBeVisible();
    await expect(page.getByText("synthetic_trace")).toBeVisible();
    await expect(page.getByText("演示数字")).toHaveCount(0);
    await page.getByRole("link", { name: /进入专业版/ }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/overview" && url.searchParams.get("run") === runId);
    await page.getByRole("button", { name: "打开 TileSim 助手", exact: true }).click();
    const professionalPanel = page.locator("#tilesim-agent-copilot");
    await expect(professionalPanel).toContainText(runId);
    await expect(professionalPanel.getByRole("radio", { name: "提出草案修改" })).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/lightweight\/results/);
    expect(api.getPostCount()).toBe(1);
    expect(api.getIdempotency()).toMatch(/^lightweight-/);
  });

  test("failed fixture run is explicit and does not present results", async ({ page }) => {
    await installApi(page, "failed");
    await page.goto("/lightweight", { waitUntil: "networkidle" });
    await page.goto(`/lightweight/runs/${runId}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "刷新" }).click();
    await expect(page.getByText("运行失败")).toBeVisible();
    await expect(page.getByText("fixture execution failed")).toBeVisible();
    await expect(page.getByRole("link", { name: "查看结果" })).toHaveCount(0);
  });
});
