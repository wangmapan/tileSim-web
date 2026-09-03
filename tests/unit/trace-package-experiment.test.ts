import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildExperimentRequest,
  buildExperimentSurface,
  createExperimentForm,
  fetchTracePackageCatalog,
  resolveExperimentErrorPointer,
} from "../../src/features/run-experiment";
import { bridgeApi, type TracePackageCatalogResponse } from "../../src/lib/api";
import { queryClient } from "../../src/lib/query-client";
import { createF8ExperimentDescriptor, f8Capabilities } from "../fixtures/experiment-descriptor";

const revision = `sha256:${"1".repeat(64)}`;

function surface() {
  return buildExperimentSurface(
    {
      scenarios: [{ scenario_id: "s1_des_example", label: "S1 → S6" }],
      fidelity_policies: ["default", "des"],
      input_modes: ["controls", "json", "trace_package"],
      design_space_modes: ["built_in_synthetic", "strict_s6_manifest"],
      gpu_participation_modes: ["gpu_free"],
    },
    f8Capabilities,
    createF8ExperimentDescriptor(),
    "supported",
  );
}

const catalog: TracePackageCatalogResponse = {
  schema_version: "tilesim.bridge.trace_package_catalog.v1",
  trace_package_schema_identity: "tilesim.trace_package.v1alpha1",
  schema_set_revision: revision,
  backend_identity: {},
  capability: { available: true, reason: null },
  packages: [],
  discovery_errors: [],
};

afterEach(() => {
  queryClient.clear();
  vi.restoreAllMocks();
});

describe("Trace-package experiment mode", () => {
  it("serializes only trace_package_id and maps schema errors to the package control", () => {
    const experimentSurface = surface();
    const form = createExperimentForm(experimentSurface);
    const request = buildExperimentRequest({
      form,
      mode: "trace_package",
      surface: experimentSurface,
      runtimeJson: "",
      topologyJson: "",
      designSpaceJson: "",
      tracePackageId: "synthetic-package",
    });

    expect(request).toMatchObject({
      scenario_id: "s1_des_example",
      trace_package_id: "synthetic-package",
    });
    expect(request).not.toHaveProperty("overrides");
    expect(request).not.toHaveProperty("custom_inputs");
    expect(request).not.toHaveProperty("design_space_candidates");
    expect(resolveExperimentErrorPointer(experimentSurface, "/trace_package_id")).toEqual({
      fieldPath: "/trace_package_id",
      controlPointer: "/trace_package_id",
      fieldId: null,
    });
  });

  it("rejects package and design-space mixing at the exact Pointer", () => {
    const experimentSurface = surface();
    const form = createExperimentForm(experimentSurface);
    expect(() =>
      buildExperimentRequest({
        form,
        mode: "trace_package",
        surface: experimentSurface,
        runtimeJson: "",
        topologyJson: "",
        designSpaceJson: "{}",
        tracePackageId: "synthetic-package",
      }),
    ).toThrowError(expect.objectContaining({ fieldPath: "/design_space_candidates" }));
  });

  it("keys catalog server state by backend identity and schema-set revision", async () => {
    const tracePackages = vi.spyOn(bridgeApi, "tracePackages").mockResolvedValue(catalog);
    const manifest = {
      schema_set_revision: revision,
    } as Parameters<typeof fetchTracePackageCatalog>[0]["manifest"];

    await fetchTracePackageCatalog({ backendIdentity: "backend-a", manifest });
    await fetchTracePackageCatalog({ backendIdentity: "backend-a", manifest });
    await fetchTracePackageCatalog({ backendIdentity: "backend-b", manifest });

    expect(tracePackages).toHaveBeenCalledTimes(2);
  });
});
