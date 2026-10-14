/** @vitest-environment jsdom */

import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import RuntimeEvidencePanel from "../../src/features/execution-inspector/components/RuntimeEvidencePanel.vue";
import type { ArtifactManifestResponse } from "../../src/lib/api";

const fetchVerifiedArtifact = vi.hoisted(() => vi.fn());
vi.mock("../../src/features/run-evidence", () => ({ fetchVerifiedArtifact }));
enableAutoUnmount(afterEach);
afterEach(() => fetchVerifiedArtifact.mockReset());

const hash = "a".repeat(64);
function manifest(artifactId = "runtime-events", overrides: Record<string, unknown> = {}): ArtifactManifestResponse {
  const names: Record<string, string> = {
    "runtime-events": "runtime-events.json",
    "runtime-summary": "runtime-summary.json",
    "runtime-requests": "runtime-requests.json",
  };
  return {
    schema_version: "tilesim.bridge.artifact_manifest.v2",
    api_version: "tilesim.bridge.api.v1",
    schema_set_revision: `sha256:${hash}`,
    run_id: "run-evidence",
    artifacts: [
      {
        artifact_id: artifactId,
        report_kind: null,
        file_name: names[artifactId],
        media_type: "application/json",
        bytes: 4096,
        sha256: hash,
        schema_identity: "tilesim.s1_runtime_event_trace.v1",
        contract_status: "supported",
        content_status: "ready",
        ...overrides,
      },
    ],
    rejected_artifacts: [],
  } as ArtifactManifestResponse;
}

function panel(artifactManifest: ArtifactManifestResponse | null = manifest()) {
  return mount(RuntimeEvidencePanel, {
    props: { runId: "run-evidence", artifactManifest, backendRevision: "test-revision", bridgeManifest: null },
    global: { stubs: { ArtifactEvidenceLink: { template: "<span class='evidence-link' />" } } },
  });
}

describe("runtime evidence panel", () => {
  it("reads only on request, pages backend events, and retains exact uint64 text", async () => {
    fetchVerifiedArtifact.mockResolvedValue({
      schema_version: "tilesim.s1_runtime_event_trace.v1",
      run_id: "run-evidence",
      events: Array.from({ length: 27 }, (_, i) => ({
        event_time_ps: i === 0 ? "9007199254740993" : String(i),
        kind: "arrival",
        logical_step: i,
        request_id: `r${i}`,
        batch_id: "batch",
        batch_request_ids: [`r${i}`],
      })),
    });
    const wrapper = panel();
    expect(fetchVerifiedArtifact).not.toHaveBeenCalled();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(fetchVerifiedArtifact).toHaveBeenCalledWith(
      "run-evidence",
      expect.objectContaining({ artifact_id: "runtime-events", sha256: hash }),
      expect.objectContaining({ backendRevision: "test-revision" }),
    );
    expect(wrapper.text()).toContain("9007199254740993");
    expect(wrapper.findAll("tbody tr")).toHaveLength(25);
    const next = wrapper.findAll("button").find((button) => button.text().includes("下一页"));
    expect(next).toBeTruthy();
    await next!.trigger("click");
    expect(wrapper.findAll("tbody tr")).toHaveLength(2);
    expect(wrapper.text()).toContain("r26");
  });

  it("distinguishes descriptor, rejection, unrequested, and oversize without eager downloads", async () => {
    const wrapper = panel(null);
    expect(wrapper.text()).toContain("没有可信工件清单");
    await wrapper.setProps({
      artifactManifest: manifest("runtime-events", {
        schema_identity: "tilesim.wind_tunnel_artifact_descriptor.v1",
        content_status: "expected_absence",
        bytes: 200,
      }),
    });
    fetchVerifiedArtifact.mockResolvedValue({
      state: "expected_absence",
      absence_reason: "not_expected_for_boundary",
      detail: "not runtime",
    });
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("期望缺席描述符");
    expect(wrapper.text()).toContain("not runtime");
    const rejected = {
      ...manifest(),
      artifacts: [],
      rejected_artifacts: [
        {
          artifact_id: "runtime-events",
          file_name: "runtime-events.json",
          reason: "unsupported_schema",
          schema_identity: "unknown",
          json_pointer: "/schema_version",
        },
      ],
    } as ArtifactManifestResponse;
    await wrapper.setProps({ artifactManifest: rejected });
    expect(wrapper.text()).toContain("unsupported_schema");
    expect(wrapper.text()).toContain("/schema_version");
    await wrapper.setProps({ artifactManifest: { ...manifest(), artifacts: [], rejected_artifacts: [] } });
    expect(wrapper.text()).toContain("未请求此工件");
    await wrapper.setProps({ artifactManifest: manifest("runtime-events", { bytes: 8_000_001 }) });
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("大工件不在此页解析");
    expect(fetchVerifiedArtifact).toHaveBeenCalledTimes(1);
  });

  it("resets content on run change and exposes verified-read errors", async () => {
    fetchVerifiedArtifact.mockResolvedValueOnce({ events: [] }).mockRejectedValueOnce(new Error("hash mismatch"));
    const wrapper = panel();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("事件集合为空");
    await wrapper.setProps({ runId: "other-run" });
    expect(wrapper.text()).not.toContain("事件集合为空");
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("hash mismatch");
  });
});
