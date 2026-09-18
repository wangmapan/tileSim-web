import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createF8ExperimentDescriptor, f8Capabilities, f8SchemaRevision } from "../fixtures/experiment-descriptor";
import { createEvidenceAgentDescriptor, f9DescriptorRevision } from "../fixtures/evidence-agent-descriptor";

const agentOrchestrationCatalog = JSON.parse(
  readFileSync(
    new URL("../../bridge/contracts/agent_orchestration_capability/catalog-content.json", import.meta.url),
    "utf8",
  ),
);

const topologyEnvelope = {
  scenario_name: "topology-pointer-e2e",
  provenance: {
    source_mode: "synthetic_trace",
    calibration_level: "uncalibrated",
    allowed_claim_scope: "exploratory_s6_only",
  },
  topology: {
    topology_name: "pointer-e2e-topology",
    devices: [
      { device_id: "gpu-0", device_type: "gpu" },
      { device_id: "gpu-1", device_type: "gpu" },
      { device_id: "gpu-2", device_type: "gpu" },
    ],
    module_bindings: [{ module_name: "fabric-0", module_kind: "scale_up" }],
    domains: [
      {
        domain_id: "fabric-0",
        domain_type: "scale_up",
        member_devices: ["gpu-0", "gpu-1", "gpu-2"],
        module_binding: "fabric-0",
      },
    ],
    links: [],
  },
  workload: { requests: [] },
};

function manifest() {
  return {
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
}

async function installTopologyApi(page) {
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let status = 200;
    let body;
    if (path === "/api/manifest") body = manifest();
    else if (path === "/api/health") {
      body = {
        cli_available: true,
        execution_ready: true,
        versions_match: true,
        state_digests_match: true,
        source_revision: "topology-pointer-fixture",
        build_revision: "topology-pointer-fixture",
        source_state_digest: "topology-pointer-fixture",
        build_state_digest: "topology-pointer-fixture",
        deployment_ref: "fixture:topology-pointer",
      };
    } else if (path === "/api/catalog") {
      body = {
        scenarios: [{ scenario_id: "s1_des_example", label: "S1 → S6 synthetic runtime example" }],
        fidelity_policies: ["default", "des"],
        input_modes: ["controls", "json", "trace_package"],
        design_space_modes: ["built_in_synthetic", "strict_s6_manifest"],
        gpu_participation_modes: ["gpu_free"],
      };
    } else if (path === "/api/capabilities") body = f8Capabilities;
    else if (path === "/api/experiment-schema") body = createF8ExperimentDescriptor();
    else if (path === "/api/agent/evidence-capabilities") body = createEvidenceAgentDescriptor(false);
    else if (path === "/api/runs") body = { runs: [] };
    else {
      status = 404;
      body = { error: "fixture route not found" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: { "X-TileSim-Schema-Set-Revision": f8SchemaRevision },
      body: JSON.stringify(body),
    });
  });
}

function node(page, deviceId) {
  return page.locator(".topology-device").filter({ hasText: deviceId });
}

async function center(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, `expected a visible topology node for ${await locator.getAttribute("aria-label")}`).not.toBeNull();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function assertNoLayoutCoordinates(value) {
  if (Array.isArray(value)) {
    for (const item of value) assertNoLayoutCoordinates(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  expect(value).not.toHaveProperty("x");
  expect(value).not.toHaveProperty("y");
  for (const child of Object.values(value)) assertNoLayoutCoordinates(child);
}

test.describe("topology graph pointer editing", () => {
  test("dragging layout, creating/editing/deleting links, and reverse duplicate protection stay in JSON contract", async ({
    page,
  }) => {
    await installTopologyApi(page);
    await page.goto("/experiment", { waitUntil: "networkidle" });

    await expect(page.getByRole("button", { name: "JSON 输入", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "JSON 输入", exact: true }).click();
    const editor = page.locator(".topology-editor");
    await expect(editor).toBeVisible();
    const json = editor.locator(".topology-editor__json textarea");
    const initialJson = JSON.stringify(topologyEnvelope, null, 2);
    await json.fill(initialJson);
    await expect(editor.locator(".topology-device")).toHaveCount(3);

    // Device layout is local editor state: moving a node changes its SVG transform,
    // but must not emit a different request JSON value.
    const firstNode = node(editor, "gpu-0");
    const beforeTransform = await firstNode.getAttribute("transform");
    const beforeJson = await json.inputValue();
    const firstPoint = await center(firstNode);
    await page.mouse.move(firstPoint.x, firstPoint.y);
    await page.mouse.down();
    await page.mouse.move(firstPoint.x + 90, firstPoint.y + 35, { steps: 5 });
    await page.mouse.up();
    await expect(firstNode).not.toHaveAttribute("transform", beforeTransform);
    await expect(json).toHaveValue(beforeJson);
    assertNoLayoutCoordinates(JSON.parse(await json.inputValue()));

    // Drag-connect gpu-0 -> gpu-1 in the selected domain.
    await editor.getByRole("button", { name: "连接设备", exact: true }).click();
    await editor.getByRole("combobox", { name: "选择连接 domain" }).selectOption("fabric-0");
    const sourcePoint = await center(node(editor, "gpu-0"));
    const targetPoint = await center(node(editor, "gpu-1"));
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 8 });
    await page.mouse.up();
    await expect(editor.locator(".topology-link")).toHaveCount(1);
    let requestValue = JSON.parse(await json.inputValue());
    expect(requestValue.topology.links).toEqual([{ src_device: "gpu-0", dst_device: "gpu-1", domain_id: "fabric-0" }]);
    await expect(editor.locator(".topology-link text").first()).toHaveText("fabric-0");

    // The opposite direction is the same physical link and must not be appended.
    await (await node(editor, "gpu-1")).click();
    await (await node(editor, "gpu-0")).click();
    await expect(editor.locator(".topology-link")).toHaveCount(1);
    requestValue = JSON.parse(await json.inputValue());
    expect(requestValue.topology.links).toHaveLength(1);

    // A click-to-connect gesture creates another undirected edge as well.
    await node(editor, "gpu-1").click();
    await node(editor, "gpu-2").click();
    await expect(editor.locator(".topology-link")).toHaveCount(2);
    requestValue = JSON.parse(await json.inputValue());
    expect(requestValue.topology.links).toEqual([
      { src_device: "gpu-0", dst_device: "gpu-1", domain_id: "fabric-0" },
      { src_device: "gpu-1", dst_device: "gpu-2", domain_id: "fabric-0" },
    ]);

    // The newly-created edge is selected by the editor; edit it through the panel.
    await expect(editor.locator(".topology-link-panel")).toBeVisible();
    const bandwidth = editor.locator('.topology-link-panel input[type="number"]').first();
    await bandwidth.fill("400");
    await expect(json).toHaveValue(/bandwidth_gbps/);
    requestValue = JSON.parse(await json.inputValue());
    expect(requestValue.topology.links[1]).toEqual(
      expect.objectContaining({ bandwidth_gbps: 400, src_device: "gpu-1", dst_device: "gpu-2" }),
    );
    await editor.getByRole("button", { name: "删除连接", exact: true }).click();
    await expect(editor.locator(".topology-link")).toHaveCount(1);
    await editor.locator(".topology-link").press("Enter");
    await editor.getByRole("button", { name: "删除连接", exact: true }).click();
    await expect(editor.locator(".topology-link")).toHaveCount(0);
    requestValue = JSON.parse(await json.inputValue());
    expect(requestValue.topology.links).toEqual([]);
    assertNoLayoutCoordinates(requestValue);
  });
});
