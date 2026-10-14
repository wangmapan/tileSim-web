import { describe, expect, it } from "vitest";
import {
  buildExperimentRequest,
  buildExperimentRequestPreview,
  buildExperimentSurface,
  createExperimentForm,
} from "../../src/features/run-experiment";
import { createF8ExperimentDescriptor, f8Capabilities } from "../fixtures/experiment-descriptor";

/**
 * Where the quick-control tab sends its request.
 *
 * `overrides` carries scalars only — the contract forbids extra keys there and
 * the backend's overrides channel never reads request rows or device lists — so
 * the structured editors can only be effective on `custom_inputs`. The two are
 * mutually exclusive (`create-run-request.schema.json:24-30`), which makes this
 * an either/or decision rather than an addition, and the decision has to stay
 * invisible until the user actually opens the structured editors.
 */
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

const runtimeJson = JSON.stringify({
  policy: { batch_scheduler: "fifo" },
  requests: [{ request_id: "req_a", arrival_time_ps: 0, tp_degree: 2, participants: ["gpu0", "gpu1"] }],
});

const topologyJson = JSON.stringify({
  topology: {
    devices: [
      { device_id: "gpu0", device_type: "GPU" },
      { device_id: "gpu1", device_type: "GPU" },
    ],
    module_bindings: [{ module_name: "su-module", module_kind: "scale_up", override_params: { bandwidth_gbps: 900 } }],
    domains: [
      {
        domain_id: "su0",
        domain_type: "scale_up",
        member_devices: ["gpu0", "gpu1"],
        module_binding: "su-module",
      },
    ],
  },
});

function build(options: { structuredInput?: boolean; runtime?: string; topology?: string } = {}) {
  const experimentSurface = surface();
  return buildExperimentRequest({
    form: createExperimentForm(experimentSurface),
    mode: "controls",
    surface: experimentSurface,
    runtimeJson: options.runtime ?? runtimeJson,
    topologyJson: options.topology ?? topologyJson,
    designSpaceJson: "",
    structuredInput: options.structuredInput,
  });
}

describe("quick-control submission channel", () => {
  it("still produces overrides while the structured editors are closed", () => {
    const request = build();
    expect(request).not.toHaveProperty("custom_inputs");
    expect(request.custom_inputs).toBeUndefined();
  });

  it("produces custom_inputs once the structured editors are open", () => {
    const request = build({ structuredInput: true });
    expect(request).not.toHaveProperty("overrides");
    expect(request.custom_inputs).toMatchObject({
      runtime_trace: { policy: { batch_scheduler: "fifo" } },
      topology: { topology: { devices: [{ device_id: "gpu0" }, { device_id: "gpu1" }] } },
    });
  });

  it("refuses an empty structured document instead of sending a half-built request", () => {
    const preview = buildExperimentRequestPreview({
      form: createExperimentForm(surface()),
      mode: "controls",
      surface: surface(),
      runtimeJson: "",
      topologyJson: topologyJson,
      designSpaceJson: "",
      structuredInput: true,
    });
    expect(preview.request).toBeNull();
    expect(preview.error?.fieldPath).toBe("/custom_inputs/runtime_trace");
  });

  it("keeps the JSON tab on the same channel whichever way it is reached", () => {
    const request = buildExperimentRequest({
      form: createExperimentForm(surface()),
      mode: "json",
      surface: surface(),
      runtimeJson,
      topologyJson,
      designSpaceJson: "",
    });
    expect(request.custom_inputs).toBeDefined();
  });
});
