/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import TracePackageInputPanel from "../../src/features/run-experiment/TracePackageInputPanel.vue";
import type { TracePackageCatalogResponse } from "../../src/lib/api";

const revision = `sha256:${"1".repeat(64)}`;

function catalog(packages: TracePackageCatalogResponse["packages"] = []): TracePackageCatalogResponse {
  return {
    schema_version: "tilesim.bridge.trace_package_catalog.v1",
    trace_package_schema_identity: "tilesim.trace_package.v1alpha1",
    schema_set_revision: revision,
    backend_identity: {},
    capability: { available: true, reason: null },
    packages,
    discovery_errors: [],
  };
}

function item(packageId: string, sourceMode: "synthetic_trace" | "real_trace" | "compatibility_harness_trace") {
  return {
    package_id: packageId,
    producer: { name: "fixture", version: "0.1.0" },
    experiment_id: "experiment-1",
    physical_run_id: "physical-run-1",
    entry_boundary: "S1" as const,
    entry_trace_kind: "s1_runtime" as const,
    trace_provenance: {
      source_mode: sourceMode,
      calibration_level: "uncalibrated" as const,
      allowed_claim_scope: "exploratory" as const,
      source_id: "fixture",
      generation_path: "temporary fixture",
      capture_or_generation_time: "2026-09-03T00:00:00Z",
      upstream_tooling: "test",
      trace_kind: "trace_package" as const,
      notes: ["Not hardware evidence."] as [string, ...string[]],
    },
    manifest_sha256: `sha256:${"a".repeat(64)}`,
    inspect_status: "valid" as const,
    inspect_errors: [],
    submission_available: sourceMode === "synthetic_trace",
    unavailable_reason: sourceMode === "synthetic_trace" ? null : "source_mode_not_enabled_in_prototype",
    artifact_integrity: {
      complete: true,
      semantic_artifact_count: 6,
      semantic_roles: [
        "request",
        "batch",
        "iteration",
        "tile_execution",
        "kv_cache",
        "network_flow",
      ] as TracePackageCatalogResponse["packages"][number]["artifact_integrity"]["semantic_roles"],
      sha256_verified: true,
      entry_trace_verified: true,
    },
  };
}

const baseProps = {
  catalog: null,
  status: "idle" as const,
  error: "",
  inspectError: "",
  selectedPackageId: "",
  inspecting: false,
  fieldPath: "",
};

describe("TracePackageInputPanel", () => {
  it("renders loading, unavailable, error, and empty catalog states", async () => {
    const wrapper = mount(TracePackageInputPanel, { props: { ...baseProps, status: "loading" } });
    expect(wrapper.text()).toContain("正在发现和检查");

    await wrapper.setProps({
      status: "success",
      catalog: { ...catalog(), capability: { available: false, reason: "trace_package_root_not_configured" } },
    });
    expect(wrapper.text()).toContain("trace_package_root_not_configured");

    await wrapper.setProps({ status: "error", error: "network failed" });
    expect(wrapper.text()).toContain("network failed");

    await wrapper.setProps({ status: "success", error: "", catalog: catalog() });
    expect(wrapper.text()).toContain("没有可发现的 Trace package");
  });

  it("shows identity, provenance, integrity, and disables non-synthetic submission semantics", () => {
    const packages = [
      item("synthetic-package", "synthetic_trace"),
      item("real-package", "real_trace"),
      item("compatibility-package", "compatibility_harness_trace"),
    ];
    const wrapper = mount(TracePackageInputPanel, {
      props: {
        ...baseProps,
        status: "success",
        catalog: catalog(packages),
        selectedPackageId: "real-package",
      },
    });

    expect(wrapper.text()).toContain("experiment-1");
    expect(wrapper.text()).toContain("physical-run-1");
    expect(wrapper.text()).toContain("real_trace");
    expect(wrapper.text()).toContain("uncalibrated");
    expect(wrapper.text()).toContain("exploratory");
    expect(wrapper.text()).toContain("6/6");
    expect(wrapper.text()).toContain("首版仅开放 synthetic_trace");
    expect(wrapper.findAll(".trace-package-list .unavailable")).toHaveLength(2);
    expect(wrapper.findAll(".trace-package-list .available")).toHaveLength(1);
  });
});
