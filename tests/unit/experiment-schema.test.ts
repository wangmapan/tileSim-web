import { describe, expect, it } from "vitest";
import {
  ExperimentRequestError,
  buildExperimentRequest,
  buildExperimentRequestPreview,
  buildExperimentSurface,
  createExperimentForm,
  experimentControlGroups,
  resolveExperimentErrorPointer,
} from "../../src/features/run-experiment";
import { createF8ExperimentDescriptor, f8Capabilities } from "../fixtures/experiment-descriptor";

function formalSurface() {
  return buildExperimentSurface(
    {
      scenarios: [
        { scenario_id: "s1_des_example", label: "S1 → S6" },
        { scenario_id: "not_in_create_run_schema", label: "Unsupported" },
      ],
      fidelity_policies: ["des", "cycle"],
      input_modes: ["controls", "json", "opaque"],
      design_space_modes: ["built_in_synthetic", "strict_s6_manifest"],
      gpu_participation_modes: ["gpu_free", "gpu_in_loop"],
    },
    {
      default_gpu_participation_mode: "gpu_free",
      cycle_scope: "S6_hotspot_refinement_only",
      dependencies: {},
      run_surface: {
        gpu_participation_modes: ["gpu_free"],
        design_space_modes: ["built_in_synthetic", "strict_s6_manifest"],
      },
    },
  );
}

describe("F8 experiment schema adapter", () => {
  it("uses the formal descriptor without inventing defaults", () => {
    const descriptor = createF8ExperimentDescriptor();
    const surface = buildExperimentSurface(
      {
        scenarios: [{ scenario_id: "s1_des_example", label: "S1 → S6" }],
        fidelity_policies: ["default", "des"],
        input_modes: ["controls", "json"],
        design_space_modes: ["built_in_synthetic", "strict_s6_manifest"],
        gpu_participation_modes: ["gpu_free"],
      },
      f8Capabilities,
      descriptor,
      "supported",
    );
    const form = createExperimentForm(surface);
    const preview = buildExperimentRequestPreview({
      form,
      mode: "controls",
      surface,
      runtimeJson: "",
      topologyJson: "",
      designSpaceJson: "",
    });

    expect(surface.contractStatus).toBe("supported");
    expect(surface.controlGroups.flatMap((group) => group.fields)).toHaveLength(8);
    expect(
      surface.coverage
        .filter((item) => ["S2", "S3", "S4", "S5"].includes(item.subsystem))
        .every((item) => item.status === "not_exposed"),
    ).toBe(true);
    expect(surface.fidelityOptions.find((option) => option.value === "cycle")?.available).toBe(false);
    expect(surface.sourceModeOptions.find((option) => option.value === "synthetic_trace")?.available).toBe(true);
    expect(surface.sourceModeOptions.find((option) => option.value === "real_trace")?.available).toBe(false);
    expect(Object.values(form.parameterValues).every((value) => value === undefined)).toBe(true);
    expect(preview.request).not.toHaveProperty("overrides");
  });

  it("fails closed for duplicate IDs and does not guess unknown error Pointers", () => {
    const descriptor = createF8ExperimentDescriptor();
    descriptor.parameter_descriptors[1].field_id = descriptor.parameter_descriptors[0].field_id;
    const surface = buildExperimentSurface({}, f8Capabilities, descriptor, "supported");

    expect(surface.contractStatus).toBe("contract_error");
    expect(surface.contractError).toBe("duplicate_parameter_field_id");
    expect(surface.canSubmit).toBe(false);
    expect(resolveExperimentErrorPointer(surface, "/overrides/runtime/not_a_field")).toBeNull();
  });

  it("evaluates capability predicates structurally and rejects advertised drift", () => {
    const capabilities = structuredClone(f8Capabilities);
    capabilities.run_surface.override_parameter_field_ids =
      capabilities.run_surface.override_parameter_field_ids.filter(
        (fieldId) => fieldId !== "s6.fabric.scale_out_latency_us",
      );
    const surface = buildExperimentSurface({}, capabilities, createF8ExperimentDescriptor(), "supported");

    expect(surface.contractStatus).toBe("contract_error");
    expect(surface.contractError).toBe("parameter_descriptor_capability_mismatch");
  });

  it("rejects additional properties in the strict S6 design-space manifest", () => {
    const surface = formalSurface();
    const form = createExperimentForm(surface);
    const preview = buildExperimentRequestPreview({
      form,
      mode: "controls",
      surface,
      runtimeJson: "",
      topologyJson: "",
      designSpaceJson: JSON.stringify({
        schema_version: "tilesim.design_space.s6_candidates.v1",
        manifest_id: "manifest-1",
        source_mode: "synthetic_trace",
        calibration_level: "uncalibrated",
        allowed_claim_scope: "synthetic_consistency_only",
        unsupported: true,
        candidates: [],
      }),
    });

    expect(preview.request).toBeNull();
    expect(preview.error?.fieldPath).toBe("/design_space_candidates/unsupported");
  });

  it("intersects advertised options with the generated create-run schema", () => {
    const surface = formalSurface();

    expect(surface.scenarios).toEqual([{ value: "s1_des_example", label: "S1 → S6" }]);
    expect(surface.fidelityPolicies).toEqual(["des"]);
    expect(surface.gpuParticipationModes).toEqual(["gpu_free"]);
    expect(surface.inputModes).toEqual(["controls", "json"]);
    expect(surface.designSpaceModes).toEqual(["built_in_synthetic", "strict_s6_manifest"]);
    expect(surface.contractStatus).toBe("legacy_compatibility");
    expect(surface.contractGaps).toContain("experiment_descriptor_unavailable");
    expect(surface.canSubmit).toBe(true);
  });

  it("uses one descriptor set for controls, JSON Pointer validation, and request serialization", () => {
    const surface = formalSurface();
    const form = createExperimentForm(surface);
    form.parameterValues["s1.runtime.max_batch_size"] = 8;
    form.parameterValues["s6.fabric.scale_out_latency_us"] = 12.5;

    const request = buildExperimentRequest({
      form,
      mode: "controls",
      surface,
      runtimeJson: "",
      topologyJson: "",
      designSpaceJson: "",
    });

    expect(request).toMatchObject({
      scenario_id: "s1_des_example",
      fidelity_policy: "des",
      gpu_participation_mode: "gpu_free",
      overrides: {
        runtime: { batch_scheduler: "decode_priority", max_batch_size: 8, kv_capacity_tokens: 4096 },
        workload: { message_size_multiplier: 1 },
        fabric: {
          scale_up_bandwidth_gbps: 450,
          scale_up_latency_us: 0.8,
          scale_out_bandwidth_gbps: 200,
          scale_out_latency_us: 12.5,
        },
      },
    });
    expect(experimentControlGroups.flatMap((group) => group.fields).map((field) => field.requestJsonPointer)).toContain(
      "/overrides/fabric/scale_out_latency_us",
    );
  });

  it("makes the visible JSON request preview byte-equivalent to the submitted object", () => {
    const surface = formalSurface();
    const form = createExperimentForm(surface);
    const preview = buildExperimentRequestPreview({
      form,
      mode: "json",
      surface,
      runtimeJson: '{"trace_name":"trace-1","policy":{},"requests":[{"request_id":"request-1"}]}',
      topologyJson: '{"topology":{"devices":[],"module_bindings":[],"domains":[]}}',
      designSpaceJson: JSON.stringify({
        schema_version: "tilesim.design_space.s6_candidates.v1",
        manifest_id: "manifest-1",
        source_mode: "synthetic_trace",
        calibration_level: "uncalibrated",
        allowed_claim_scope: "synthetic_consistency_only",
        candidates: [
          {
            candidate_id: "candidate-1",
            name: "candidate-1",
            bandwidth_gbps: 100,
            latency_us: 1,
            oversubscription_factor: 1,
            request_count: 1,
            message_bytes: 1024,
            release_interval_ps: 0,
            uncertainty_score: 0,
            tail_risk: false,
            source_id: "fixture",
          },
        ],
      }),
    });

    expect(preview.error).toBeNull();
    expect(JSON.parse(preview.text)).toEqual(preview.request);
    expect(preview.request).toMatchObject({
      custom_inputs: {
        runtime_trace: { trace_name: "trace-1", policy: {}, requests: [{ request_id: "request-1" }] },
        topology: { topology: { devices: [], module_bindings: [], domains: [] } },
      },
      design_space_candidates: {
        schema_version: "tilesim.design_space.s6_candidates.v1",
        manifest_id: "manifest-1",
      },
    });
  });

  it("uses the same backend JSON Pointer for an invalid frontend control", () => {
    const surface = formalSurface();
    const form = createExperimentForm(surface);
    form.parameterValues["s6.fabric.scale_out_latency_us"] = 1000;

    expect(() =>
      buildExperimentRequest({
        form,
        mode: "controls",
        surface,
        runtimeJson: "",
        topologyJson: "",
        designSpaceJson: "",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ExperimentRequestError>>({
        fieldPath: "/overrides/fabric/scale_out_latency_us",
      }),
    );
  });

  it("fails closed when an input mode is not advertised", () => {
    const surface = formalSurface();
    surface.inputModes = ["controls"];
    const form = createExperimentForm(surface);
    const preview = buildExperimentRequestPreview({
      form,
      mode: "json",
      surface,
      runtimeJson: "{}",
      topologyJson: "{}",
      designSpaceJson: "",
    });

    expect(preview.request).toBeNull();
    expect(preview.error?.fieldPath).toBe("/input_mode");
  });
});
