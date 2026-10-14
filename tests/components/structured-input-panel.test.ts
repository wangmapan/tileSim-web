// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "../../src/i18n";
import ExperimentInputPanel from "../../src/features/run-experiment/ExperimentInputPanel.vue";
import RuntimeEngineForm from "../../src/features/run-experiment/RuntimeEngineForm.vue";

/**
 * These cover what the pure helpers cannot: the wiring between the panel and its
 * three blocks. Two contracted behaviours are pinned here in particular.
 *
 *  - The JSON input tab is untouched. It still shows exactly two textareas in
 *    the order runtime-then-topology, it never gains the structured blocks, and
 *    the shipped end-to-end specs keep typing straight into its textarea.
 *  - Growing the device inventory raises an explicit three-choice prompt instead of
 *    silently rewriting (or silently ignoring) the request participants.
 */

const runtimeTrace = {
  trace_name: "panel-trace",
  policy: { batch_scheduler: "fifo", max_batch_size: 4 },
  requests: [
    { request_id: "req_a", arrival_time_ps: 0, phase: "prefill", tp_degree: 2, participants: ["gpu0", "gpu1"] },
    { request_id: "req_b", arrival_time_ps: 10, phase: "decode", tp_degree: 2, participants: ["gpu0", "gpu1"] },
  ],
};

const topology = {
  topology: {
    devices: [
      { device_id: "gpu0", device_type: "GPU" },
      { device_id: "gpu1", device_type: "GPU" },
      { device_id: "gpu2", device_type: "GPU" },
      { device_id: "gpu3", device_type: "GPU" },
    ],
    module_bindings: [{ module_name: "su-module", module_kind: "scale_up", override_params: { bandwidth_gbps: 900 } }],
    domains: [
      {
        domain_id: "su0",
        domain_type: "scale_up",
        member_devices: ["gpu0", "gpu1", "gpu2", "gpu3"],
        module_binding: "su-module",
      },
    ],
    links: [{ src_device: "gpu2", dst_device: "gpu3", domain_id: "su0" }],
  },
};

function controlField(fieldId: string, requestJsonPointer: string) {
  return {
    fieldId,
    requestJsonPointer,
    available: true,
    applicableInputModes: ["controls"],
    applicableScenarios: ["s1_des_example"],
    label: fieldId,
    kind: "number",
  };
}

const knobGroups = [
  {
    subsystem: "S1",
    title: "S1 runtime",
    detail: "runtime knobs",
    fields: [
      controlField("max_batch_size", "/overrides/runtime/max_batch_size"),
      controlField("scale_up_bandwidth_gbps", "/overrides/fabric/scale_up_bandwidth_gbps"),
    ],
  },
];

const surface = { inputModes: ["controls", "json", "trace_package"] };

/**
 * `setValue` on an `input[type=number]` does not reliably deliver the value to a
 * `change` handler in this environment, so the DOM value is assigned directly and
 * the change event dispatched — which is what a real edit-and-blur produces.
 */
async function editNumber(
  control: { element: HTMLInputElement; trigger: (event: string) => Promise<void> },
  value: string,
) {
  control.element.value = value;
  await control.trigger("change");
}

function mountPanel(
  options: {
    mode?: string;
    structuredInput?: boolean;
    runtime?: string;
    topology?: string;
    withKnobs?: boolean;
    withScheduler?: boolean;
    fieldPath?: string;
    errorMessage?: string;
  } = {},
) {
  const form = reactive({ parameterValues: {} as Record<string, unknown> });
  const host = defineComponent({
    setup() {
      const mode = ref(options.mode ?? "controls");
      const structuredInput = ref(options.structuredInput ?? true);
      const pairingPending = ref(false);
      const runtimeJson = ref(options.runtime ?? JSON.stringify(runtimeTrace, null, 2));
      const topologyJson = ref(options.topology ?? JSON.stringify(topology, null, 2));
      const state = { mode, structuredInput, runtimeJson, topologyJson, form };
      return () =>
        h(ExperimentInputPanel, {
          mode: state.mode.value,
          "onUpdate:mode": (value: string) => (state.mode.value = value),
          structuredInput: state.structuredInput.value,
          "onUpdate:structuredInput": (value: boolean) => (state.structuredInput.value = value),
          pairingPending: pairingPending.value,
          "onUpdate:pairingPending": (value: boolean) => (pairingPending.value = value),
          runtimeJson: state.runtimeJson.value,
          "onUpdate:runtimeJson": (value: string) => (state.runtimeJson.value = value),
          topologyJson: state.topologyJson.value,
          "onUpdate:topologyJson": (value: string) => (state.topologyJson.value = value),
          form: state.form,
          surface,
          fieldPath: options.fieldPath,
          errorMessage: options.errorMessage,
          controlGroups: options.withScheduler
            ? [
                {
                  subsystem: "S1",
                  title: "Runtime",
                  detail: "",
                  fields: [
                    {
                      ...controlField("s1.runtime.batch_scheduler", "/overrides/runtime/batch_scheduler"),
                      kind: "select",
                      options: ["fifo", "decode_priority"],
                    },
                  ],
                },
              ]
            : options.withKnobs
              ? knobGroups
              : [],
        });
    },
  });
  const wrapper = mount(host);
  return { wrapper, form, panel: () => wrapper.getComponent(ExperimentInputPanel) };
}

describe("structured input panel", () => {
  afterEach(() => setLocale("zh-CN"));

  it("clears the dynamic engine's KV warning when the current draft is corrected", async () => {
    const trace = {
      engine_type: "vllm",
      engine_semantic_version: "vllm.0.6.semantic.v1",
      requested_features: [],
      policy: { kv_capacity_tokens: 1024, max_active_requests: 1, max_batch_size: 1 },
      requests: [
        {
          request_id: "r",
          phase: "request",
          prompt_tokens: 8,
          decode_tokens: 2,
          kv_tokens: 9,
          tp_degree: 1,
          participants: ["gpu0"],
        },
      ],
    };
    const wrapper = mount(RuntimeEngineForm, { props: { modelValue: JSON.stringify(trace) } });
    expect(wrapper.get('[role="alert"]').text()).toContain("/custom_inputs/runtime_trace/requests/0/kv_tokens");
    trace.requests[0].kv_tokens = 10;
    await wrapper.setProps({ modelValue: JSON.stringify(trace) });
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("locates an invalid KV field accessibly in both structured and JSON modes", () => {
    const path = "/custom_inputs/runtime_trace/requests/0/kv_tokens";
    const options = { fieldPath: path, errorMessage: "KV 预留须覆盖 prompt + decode。" };
    const structured = mountPanel(options).wrapper;
    const input = structured.get(`[data-input-path="${path}"] input`);
    expect(input.attributes("aria-invalid")).toBe("true");
    const errorId = input.attributes("aria-describedby");
    expect(structured.get(`#${errorId}`).text()).toContain(path);
    expect(structured.get(`#${errorId}`).text()).toContain("KV 预留");

    const json = mountPanel({ ...options, mode: "json" }).wrapper;
    const textarea = json.get(".json-grid textarea");
    expect(textarea.attributes("aria-invalid")).toBe("true");
    expect(textarea.attributes("aria-describedby")).toBe("runtime-json-error");
    expect(json.get("#runtime-json-error").text()).toContain(path);
  });

  it("leaves the JSON tab with exactly two textareas in order and no structured blocks", () => {
    const { wrapper } = mountPanel({ mode: "json" });
    const textareas = wrapper.findAll(".json-grid textarea");
    expect(textareas).toHaveLength(2);
    // Runtime first, topology second — the order the lightweight-pages spec
    // reads (`findAll("textarea")[0]/[1]`).
    expect(textareas[0].element.closest(".topology-editor")).toBeNull();
    expect(textareas[0].element.closest(".json-grid")).not.toBeNull();
    expect(textareas[1].element.closest(".topology-editor__json")).not.toBeNull();
    expect(wrapper.find(".structured-area").exists()).toBe(false);
    expect(wrapper.find(".structured-stack").exists()).toBe(false);
  });

  it("disables the generic scheduler control for a versioned dynamic engine and explains profile scheduling", () => {
    const runtime = JSON.stringify({
      engine_type: "vllm",
      engine_semantic_version: "vllm.0.6.semantic.v1",
      requested_features: [],
      policy: { kv_capacity_tokens: 1024, max_active_requests: 2, max_batch_size: 2 },
      requests: [
        {
          request_id: "r",
          phase: "request",
          prompt_tokens: 8,
          decode_tokens: 2,
          kv_tokens: 10,
          tp_degree: 1,
          participants: ["gpu0"],
        },
      ],
    });
    const { wrapper } = mountPanel({ runtime, withScheduler: true });
    expect(
      (wrapper.get('[data-field-id="s1.runtime.batch_scheduler"] select').element as HTMLSelectElement).disabled,
    ).toBe(true);
    expect(wrapper.text()).toContain("policy.batch_scheduler 不覆盖画像");
    wrapper.unmount();
  });

  it("shows the JSON tab's topology as a preview: graph plus JSON, no editing chrome", () => {
    const { wrapper } = mountPanel({ mode: "json" });
    expect(wrapper.find(".topology-editor--readonly").exists()).toBe(true);
    expect(wrapper.find(".topology-canvas").exists()).toBe(true);
    // The graph follows whatever the textarea says, so every editing affordance
    // is gone: no connect mode, no link properties, no domain chips, no module
    // bindings list — those live in the quick-control tab.
    expect(wrapper.text()).not.toContain("连接设备");
    expect(wrapper.find(".topology-domain-picker").exists()).toBe(false);
    expect(wrapper.find(".topology-module-bindings").exists()).toBe(false);
    expect(wrapper.find(".topology-domains").exists()).toBe(false);
    expect(wrapper.find(".topology-link-panel").exists()).toBe(false);
  });

  it("does not render the structured editors until the user switches them on", () => {
    const { wrapper } = mountPanel({ structuredInput: false });
    expect(wrapper.find(".structured-area").exists()).toBe(true);
    expect(wrapper.find(".structured-stack").exists()).toBe(false);
    expect(wrapper.find(".structured-entry-button").text()).toContain("用表单配置全部输入");
  });

  it("emits the hand-off request when the entry button is clicked", async () => {
    const { wrapper, panel } = mountPanel({ structuredInput: false });
    await wrapper.get(".structured-entry-button").trigger("click");
    expect(panel().emitted("use-structured-input")).toHaveLength(1);
  });

  it("emits the turn-off request once the editors are open", async () => {
    const { wrapper, panel } = mountPanel({ structuredInput: true });
    await wrapper.get(".structured-area__header .text-button").trigger("click");
    expect(panel().emitted("disable-structured-input")).toHaveLength(1);
  });

  it("shows the four blocks in the quick-control tab without adding a textarea", () => {
    const { wrapper } = mountPanel({ structuredInput: true });
    expect(wrapper.find(".structured-block--policy").exists()).toBe(true);
    expect(wrapper.find(".structured-block--requests").exists()).toBe(true);
    // Mouse-only: the quick-control tab owns no raw JSON box at all, so the
    // topology editor is mounted without its own textarea and stays editable.
    expect(wrapper.findAll(".structured-stack textarea")).toHaveLength(0);
    expect(wrapper.find(".json-grid").exists()).toBe(false);
    expect(wrapper.find(".topology-editor .topology-canvas").exists()).toBe(true);
    expect(wrapper.find(".topology-editor--readonly").exists()).toBe(false);
    expect(wrapper.find(".topology-editor .topology-module-bindings").exists()).toBe(true);
  });

  it("paints the run-policy block with the advanced keys only, never the knobs' own", () => {
    const { wrapper } = mountPanel({ structuredInput: true });
    const paths = wrapper
      .findAll(".structured-block--policy [data-input-path]")
      .map((node) => node.attributes("data-input-path"));
    // The eight keys the quick controls already own must not appear; the nine
    // the knobs cannot reach are visible without any extra click.
    for (const key of ["max_batch_size", "batch_scheduler", "kv_admission_watermark"]) {
      expect(paths).not.toContain(`/custom_inputs/runtime_trace/policy/${key}`);
    }
    expect(paths).toContain("/custom_inputs/runtime_trace/policy/prefill_starvation_threshold_ps");
    expect(paths).toContain("/custom_inputs/runtime_trace/policy/kv_fragmentation_overhead");
    expect(paths).toHaveLength(9);
  });

  it("shows backend defaults without writing omitted policy fields, then restores omission on clear", async () => {
    const { wrapper, panel } = mountPanel({ structuredInput: true });
    const expected: Record<string, [string, string]> = {
      prefill_starvation_threshold_ps: ["0", "0 ps"],
      pd_handoff_delay_ps: ["0", "0 ps"],
      pd_handoff_queue_service_ps: ["0", "0 ps"],
      kv_page_size_tokens: ["16", "16 tokens"],
      kv_fragmentation_overhead: ["0", "0"],
      fabric_backpressure_delay_us: ["0", "0 us"],
      fabric_backpressure_throttle_threshold_us: ["0", "0 us"],
      fabric_backpressure_prefill_batch_limit: ["1", "1"],
    };
    for (const [key, [placeholder, label]] of Object.entries(expected)) {
      const field = wrapper.get(`[data-input-path="/custom_inputs/runtime_trace/policy/${key}"]`);
      expect(field.get("input").attributes("placeholder")).toBe(placeholder);
      expect(field.text()).toContain(`后端默认 ${label}（未写入）`);
      expect((field.get("input").element as HTMLInputElement).value).toBe("");
    }
    const switchField = wrapper.get(
      '[data-input-path="/custom_inputs/runtime_trace/policy/fabric_backpressure_active"]',
    );
    expect(switchField.get('option[value=""]').text()).toBe("后端默认 false（省略字段）");
    expect(panel().emitted("update:runtimeJson")).toBeUndefined();

    const delay = wrapper.get<HTMLInputElement>(
      '[data-input-path="/custom_inputs/runtime_trace/policy/pd_handoff_delay_ps"] input',
    );
    await editNumber(delay, "42");
    let written = JSON.parse(panel().emitted("update:runtimeJson")?.at(-1)?.[0] as string);
    expect(written.policy.pd_handoff_delay_ps).toBe(42);
    expect("kv_page_size_tokens" in written.policy).toBe(false);
    expect(
      wrapper.get('[data-input-path="/custom_inputs/runtime_trace/policy/pd_handoff_delay_ps"]').text(),
    ).not.toContain("后端默认");

    await editNumber(delay, "");
    written = JSON.parse(panel().emitted("update:runtimeJson")?.at(-1)?.[0] as string);
    expect("pd_handoff_delay_ps" in written.policy).toBe(false);
    expect(delay.attributes("placeholder")).toBe("0");
  });

  it("collapses the advanced run-policy grid on demand", async () => {
    const { wrapper } = mountPanel({ structuredInput: true });
    await wrapper.get(".policy-advanced-toggle").trigger("click");
    expect(wrapper.findAll(".structured-block--policy [data-input-path]")).toHaveLength(0);
  });

  it("accepts a legal policy value", async () => {
    const { wrapper, panel } = mountPanel({ structuredInput: true });
    await editNumber(
      wrapper.get('[data-input-path="/custom_inputs/runtime_trace/policy/kv_fragmentation_overhead"] input'),
      "0.02",
    );
    const emitted = panel().emitted("update:runtimeJson")?.at(-1)?.[0] as string;
    expect(JSON.parse(emitted).policy.kv_fragmentation_overhead).toBe(0.02);
    expect(wrapper.find(".structured-note--error").exists()).toBe(false);
  });

  it("rejects an out-of-contract policy value instead of writing it", async () => {
    const { wrapper, panel } = mountPanel({ structuredInput: true });
    await editNumber(
      wrapper.get('[data-input-path="/custom_inputs/runtime_trace/policy/kv_fragmentation_overhead"] input'),
      "-1",
    );
    expect(wrapper.find(".structured-note--error").text()).toContain("超出契约范围");
    expect(wrapper.find(".structured-note--error").text()).toContain("0 ~ +∞");
    // Nothing was written: an invalid value must not reach the document.
    expect(panel().emitted("update:runtimeJson")).toBeUndefined();
  });

  it("mirrors an edited knob into the policy and removes the key when cleared", async () => {
    const { wrapper, form, panel } = mountPanel({ structuredInput: true, withKnobs: true });
    form.parameterValues.max_batch_size = 16;
    await nextTick();
    const written = panel().emitted("update:runtimeJson")?.at(-1)?.[0] as string;
    expect(JSON.parse(written).policy.max_batch_size).toBe(16);

    form.parameterValues.max_batch_size = undefined;
    await nextTick();
    const cleared = panel().emitted("update:runtimeJson")?.at(-1)?.[0] as string;
    // "未设置（省略字段）" means the key is omitted again, not set to null.
    expect("max_batch_size" in JSON.parse(cleared).policy).toBe(false);
    expect(wrapper.findAll(".structured-note--error")).toHaveLength(0);
  });

  it("mirrors a fabric knob into the matching module binding", async () => {
    const { form, panel } = mountPanel({ structuredInput: true, withKnobs: true });
    form.parameterValues.scale_up_bandwidth_gbps = 600;
    await nextTick();
    const topoJson = panel().emitted("update:topologyJson")?.at(-1)?.[0] as string;
    const bindings = JSON.parse(topoJson).topology.module_bindings;
    expect(bindings).toHaveLength(1);
    expect(bindings[0].override_params.bandwidth_gbps).toBe(600);
  });

  it("walks every changed knob without touching keys the user typed by hand", async () => {
    const { form, panel } = mountPanel({ structuredInput: true, withKnobs: true });
    form.parameterValues.max_batch_size = 32;
    await nextTick();
    const written = JSON.parse(panel().emitted("update:runtimeJson")?.at(-1)?.[0] as string);
    // batch_scheduler was never claimed by a knob in this fixture.
    expect(written.policy.batch_scheduler).toBe("fifo");
    expect(written.policy.max_batch_size).toBe(32);
  });

  it("asks how to treat requests when the device count changes", async () => {
    const { wrapper, panel } = mountPanel({ structuredInput: true });
    await editNumber(wrapper.get(".device-inventory__count input"), "8");

    const prompt = wrapper.get('.structured-note--warning[role="alert"]');
    expect(prompt.text()).toContain("8 张卡");
    expect(prompt.text()).toContain("同步 TP 与参与设备到新集合");
    expect(prompt.text()).toContain("清空参与设备，保留并行卡数");
    // Nothing changed on its own.
    expect(panel().emitted("update:runtimeJson")).toBeUndefined();
  });

  it("rewrites participants when the first pairing option is chosen", async () => {
    const { wrapper, panel } = mountPanel({ structuredInput: true });
    await editNumber(wrapper.get(".device-inventory__count input"), "8");
    await wrapper
      .findAll('.structured-note--warning[role="alert"] button')
      .find((button) => button.text().includes("同步 TP 与参与设备到新集合"))
      ?.trigger("click");

    const runtimeJson = panel().emitted("update:runtimeJson")?.at(-1)?.[0] as string;
    const requests = JSON.parse(runtimeJson).requests;
    expect(requests).toHaveLength(2);
    for (const row of requests) {
      expect(row.participants).toEqual(["gpu0", "gpu1", "gpu2", "gpu3", "gpu4", "gpu5", "gpu6", "gpu7"]);
      expect(row.tp_degree).toBe(8);
    }
    expect(wrapper.find('.structured-note--warning[role="alert"]').exists()).toBe(false);
  });

  it("can preserve the previous TP while keeping participants valid", async () => {
    const runtime = JSON.stringify(
      {
        ...runtimeTrace,
        requests: runtimeTrace.requests.map((request) => ({ ...request, participants: ["gpu3", "gpu2"] })),
      },
      null,
      2,
    );
    const { wrapper, panel } = mountPanel({ structuredInput: true, runtime });
    await editNumber(wrapper.get(".device-inventory__count input"), "8");
    await wrapper.findAll('.structured-note--warning[role="alert"] button').at(1)?.trigger("click");

    const requests = JSON.parse(panel().emitted("update:runtimeJson")?.at(-1)?.[0] as string).requests;
    for (const row of requests) {
      expect(row.tp_degree).toBe(2);
      expect(row.participants).toEqual(["gpu0", "gpu1"]);
    }
  });

  it("keeps the pairing prompt open when preserving TP cannot fit the smaller inventory", async () => {
    const runtime = JSON.stringify({
      ...runtimeTrace,
      requests: runtimeTrace.requests.map((request) => ({ ...request, tp_degree: 4 })),
    });
    const { wrapper } = mountPanel({ structuredInput: true, runtime });
    await editNumber(wrapper.get(".device-inventory__count input"), "2");
    const prompt = wrapper.get('.structured-note--warning[role="alert"]');
    await prompt.findAll("button").at(1)?.trigger("click");

    expect(wrapper.find('.structured-note--warning[role="alert"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("TP 必须在 1~2 之间");
  });

  it("clears participants when the second pairing option is chosen", async () => {
    const { wrapper, panel } = mountPanel({ structuredInput: true });
    await editNumber(wrapper.get(".device-inventory__count input"), "2");
    await wrapper
      .findAll('.structured-note--warning[role="alert"] button')
      .find((button) => button.text().includes("清空参与设备，保留并行卡数"))
      ?.trigger("click");

    const runtimeJson = panel().emitted("update:runtimeJson")?.at(-1)?.[0] as string;
    for (const row of JSON.parse(runtimeJson).requests) {
      expect("participants" in row).toBe(false);
      expect(row.tp_degree).toBe(2);
    }
  });

  it("warns when a deleted device was still referenced", async () => {
    const { wrapper, panel } = mountPanel({ structuredInput: true });
    const row = wrapper.findAll(".device-inventory-row")[2];
    await row.get("button.icon-button").trigger("click");
    const notice = wrapper.get('.structured-note--warning[role="status"]');
    expect(notice.text()).toContain("gpu2");
    expect(notice.text()).toContain("domains: su0");
    const topoJson = panel().emitted("update:topologyJson")?.at(-1)?.[0] as string;
    expect(JSON.parse(topoJson).topology.devices.map((device: { device_id: string }) => device.device_id)).toEqual([
      "gpu0",
      "gpu1",
      "gpu3",
    ]);
    expect(JSON.parse(topoJson).topology.links).toEqual([]);
  });

  it("refuses a device count below zero with an inline error", async () => {
    const { wrapper } = mountPanel({ structuredInput: true });
    await editNumber(wrapper.get(".device-inventory__count input"), "-2");
    expect(wrapper.get(".device-inventory .structured-note--error").text()).toContain("非负整数");
  });

  it("refuses a card count above the contract ceiling", async () => {
    const { wrapper } = mountPanel({ structuredInput: true });
    await editNumber(wrapper.get(".device-inventory__count input"), "1025");
    expect(wrapper.get(".device-inventory .structured-note--error").text()).toContain("1024");
  });

  it("adds exactly one device from the entry button and routes it through the pairing prompt", async () => {
    const { wrapper, panel } = mountPanel({ structuredInput: true });
    await wrapper.get(".device-inventory .structured-block__header .button").trigger("click");
    const topoJson = panel().emitted("update:topologyJson")?.at(-1)?.[0] as string;
    expect(JSON.parse(topoJson).topology.devices.map((device: { device_id: string }) => device.device_id)).toEqual([
      "gpu0",
      "gpu1",
      "gpu2",
      "gpu3",
      "gpu4",
    ]);
    // Adding a card must not silently change the request table either.
    expect(wrapper.get('.structured-note--warning[role="alert"]').text()).toContain("5 张卡");
  });

  it("hosts the domain list between the device inventory and the graph", () => {
    const { wrapper } = mountPanel({ structuredInput: true });
    const stack = wrapper.get(".structured-stack");
    expect(stack.find(".device-inventory").exists()).toBe(true);
    expect(stack.find(".domain-inventory").exists()).toBe(true);
    expect(stack.find(".topology-editor").exists()).toBe(true);
    // Same constraint the device inventory lives under: the graph must be a
    // sibling so it never nests inside a list block.
    expect(stack.find(".domain-inventory").element.parentElement).toBe(stack.element);
    expect(wrapper.findAll(".domain-inventory-row")).toHaveLength(1);
  });
});
