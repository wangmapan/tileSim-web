// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { describe, expect, it } from "vitest";
import RuntimeEngineForm from "../../src/features/run-experiment/RuntimeEngineForm.vue";
import {
  readExperimentInputDraft,
  saveExperimentInputDraft,
} from "../../src/features/run-experiment/input-draft-session";
import { createRunRequest } from "../../src/contracts/generated/experiment-validators.js";
import {
  buildExperimentRequestPreview,
  buildExperimentSurface,
  buildParameterCatalog,
  createExperimentForm,
  applyParameterEdits,
} from "../../src/features/run-experiment";
import {
  dynamicEngineIssue,
  engineModeOf,
  RUN_ENGINE_PROFILES,
} from "../../src/features/run-experiment/runtime-engine";

const topology = {
  topology: { devices: [{ device_id: "gpu0", device_type: "GPU" }], module_bindings: [], domains: [] },
};
const row = {
  request_id: "r",
  phase: "request",
  arrival_time_ps: 0,
  prompt_tokens: 8,
  decode_tokens: 2,
  kv_tokens: 10,
  tp_degree: 1,
  participants: ["gpu0"],
};
const policy = {
  kv_capacity_tokens: 1024,
  max_active_requests: 2,
  max_batch_size: 2,
  batch_scheduler: "decode_priority",
};
const generic = { policy, requests: [{ ...row, phase: "prefill" }] };

function surfaceAndForm() {
  const surface = buildExperimentSurface(
    {
      scenarios: [{ scenario_id: "s1_des_example", label: "S1 → S6" }],
      fidelity_policies: ["des"],
      input_modes: ["controls", "json"],
      gpu_participation_modes: ["gpu_free"],
    },
    { run_surface: { gpu_participation_modes: ["gpu_free"] } },
  );
  return { surface, form: createExperimentForm(surface) };
}

function preview(runtime: object) {
  const { surface, form } = surfaceAndForm();
  form.fidelity_policy = "des";
  return buildExperimentRequestPreview({
    form,
    surface,
    mode: "json",
    runtimeJson: JSON.stringify(runtime),
    topologyJson: JSON.stringify(topology),
    designSpaceJson: "",
  });
}

describe("published runtime engine closure", () => {
  it("keeps legacy omitted identity and the old replay request unchanged", () => {
    const result = preview(generic);
    expect(result.error).toBeNull();
    expect(result.request?.custom_inputs?.runtime_trace as object).toEqual(generic);
    expect(engineModeOf(generic)).toBe("generic");
  });

  it.each(Object.entries(RUN_ENGINE_PROFILES))("submits the tested %s dynamic pair", (engine, profile) => {
    const runtime = {
      policy,
      requests: [row],
      engine_type: engine,
      engine_semantic_version: profile.version,
      requested_features: [],
    };
    expect(dynamicEngineIssue(runtime)).toBeNull();
    expect(preview(runtime).error).toBeNull();
    expect(createRunRequest(preview(runtime).request)).toBe(true);
    expect(engineModeOf(runtime)).toBe("dynamic");
  });

  it("rejects wrong version, feature, mixing, KV, participants and provenance at fields", () => {
    const runtime = {
      policy,
      requests: [row],
      engine_type: "vllm",
      engine_semantic_version: "vllm.0.6.semantic.v1",
      requested_features: [] as string[],
    };
    expect(preview({ ...runtime, engine_semantic_version: "vllm.0.6.tilesim_pd.v1" }).error?.fieldPath).toContain(
      "engine_semantic_version",
    );
    expect(preview({ ...runtime, requested_features: ["prefix_cache"] }).error?.fieldPath).toContain(
      "requested_features",
    );
    expect(
      preview({ ...runtime, requests: [row, { ...row, request_id: "observed", phase: "decode" }] }).error?.fieldPath,
    ).toContain("phase");
    expect(preview({ ...runtime, requests: [{ ...row, kv_tokens: 9 }] }).error?.fieldPath).toBe(
      "/custom_inputs/runtime_trace/requests/0/kv_tokens",
    );
    expect(preview({ ...runtime, requests: [{ ...row, participants: [] }] }).error?.fieldPath).toBe(
      "/custom_inputs/runtime_trace/requests/0/participants",
    );
    expect(
      preview({
        ...runtime,
        trace_provenance: {
          source_mode: "synthetic_trace",
          calibration_level: "partially_calibrated",
          allowed_claim_scope: "exploratory",
        },
      }).error?.fieldPath,
    ).toContain("calibration_level");
  });

  it("keeps engine identity, phase and features out of scalar suggestions; rolls back invalid KV edits", () => {
    const { surface, form } = surfaceAndForm();
    const runtime = {
      policy,
      requests: [row],
      engine_type: "vllm",
      engine_semantic_version: "vllm.0.6.semantic.v1",
      requested_features: [],
    };
    const runtimeJson = JSON.stringify(runtime);
    const catalog = buildParameterCatalog({ surface, form, runtimeJson, topologyJson: JSON.stringify(topology) });
    const paths = catalog.map((entry) => entry.path);
    expect(paths).not.toContain("runtime_trace/engine_semantic_version");
    expect(paths).not.toContain("runtime_trace/requested_features");
    expect(paths).not.toContain("runtime_trace/requests[0]/phase");
    expect(paths).not.toContain("runtime_trace/policy/batch_scheduler");
    expect(catalog.find((entry) => entry.path === "run_name")?.maxLength).toBe(80);
    const outcome = applyParameterEdits({
      runtimeJson,
      topologyJson: JSON.stringify(topology),
      items: [
        {
          path: "runtime_trace/requests[0]/kv_tokens",
          target: "runtime_trace",
          value: 9,
          old_value: 10,
          label: "kv_tokens",
        } as never,
        {
          path: "runtime_trace/policy/max_batch_size",
          target: "runtime_trace",
          value: 3,
          old_value: 2,
          label: "max_batch_size",
        } as never,
      ],
    });
    expect(outcome.applied).toEqual([]);
    expect(outcome.runtimeJson).toBe(runtimeJson);
    expect(outcome.rejected[0].reason).toContain("回滚");
    const scheduler = applyParameterEdits({
      runtimeJson,
      topologyJson: JSON.stringify(topology),
      items: [{ path: "overrides/runtime/batch_scheduler", target: "control", value: "fifo" } as never],
    });
    expect(scheduler.applied).toEqual([]);
    expect(scheduler.rejected[0].reason).toContain("画像调度");
  });

  it("rejects zero policy boundaries and dual workload size units in the generated contract", () => {
    const base = {
      scenario_id: "s1_des_example",
      fidelity_policy: "des",
      gpu_participation_mode: "gpu_free",
      custom_inputs: { runtime_trace: generic, topology },
    };
    for (const field of ["kv_capacity_tokens", "max_active_requests", "max_batch_size", "kv_admission_watermark"]) {
      expect(
        createRunRequest({
          ...base,
          custom_inputs: { ...base.custom_inputs, runtime_trace: { ...generic, policy: { ...policy, [field]: 0 } } },
        }),
      ).toBe(false);
    }
    expect(
      createRunRequest({
        ...base,
        custom_inputs: {
          ...base.custom_inputs,
          topology: {
            ...topology,
            workload: { requests: [{ request_id: "r", message_size_bytes: 1024, message_size_mb: 1 }] },
          },
        },
      }),
    ).toBe(false);
  });

  it("shows scheduling semantics and restores a versioned draft after remount without converting replay", async () => {
    const runtime = JSON.stringify({
      policy,
      requests: [row],
      engine_type: "sglang",
      engine_semantic_version: "sglang.0.4.semantic.v1",
      requested_features: [],
    });
    const Host = defineComponent({
      setup() {
        const value = ref(runtime);
        return () =>
          h(RuntimeEngineForm, {
            modelValue: value.value,
            "onUpdate:modelValue": (next: string) => {
              value.value = next;
            },
          });
      },
    });
    const wrapper = mount(Host);
    expect((wrapper.get("[data-engine-mode]").element as HTMLSelectElement).value).toBe("dynamic");
    expect(wrapper.text()).toContain("policy.batch_scheduler");
    await wrapper.get("[data-engine-mode]").setValue("replay");
    expect(wrapper.get('[role="alert"]').text()).toContain("不会把动态请求改写");
    wrapper.unmount();
    const restored = mount(RuntimeEngineForm, { props: { modelValue: runtime } });
    await nextTick();
    expect((restored.get("[data-engine-profile]").element as HTMLSelectElement).value).toBe("sglang");
    restored.unmount();
  });

  it("selects observed replay without rewriting its phase or order", async () => {
    let latest = JSON.stringify(generic);
    const wrapper = mount(RuntimeEngineForm, {
      props: {
        modelValue: latest,
        "onUpdate:modelValue": (value: string) => {
          latest = value;
        },
      },
    });
    await wrapper.get("[data-engine-mode]").setValue("replay");
    expect(JSON.parse(latest)).toMatchObject({
      engine_type: "vllm",
      engine_semantic_version: "vllm.0.6.semantic.v1",
      requests: generic.requests,
    });
    expect(JSON.parse(latest).requested_features).toEqual([]);
    wrapper.unmount();
  });

  it("recovers only a same-schema tab draft", () => {
    const draft = {
      mode: "json" as const,
      structuredInput: false,
      runtimeJson: JSON.stringify(generic),
      topologyJson: JSON.stringify(topology),
    };
    saveExperimentInputDraft("revision-a", draft);
    expect(readExperimentInputDraft("revision-a")).toEqual(draft);
    expect(readExperimentInputDraft("revision-b")).toBeNull();
    sessionStorage.clear();
  });
});
