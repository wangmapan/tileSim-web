// @vitest-environment jsdom
import { mount, flushPromises } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../fixtures/operator-execution.json";
import { OperatorAuthoringPanel } from "../../src/features/kernel-authoring";
import { bridgeApi } from "../../src/lib/api";
import { queryClient } from "../../src/lib/query-client";
const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((c) => c.clear());
  queryClient.clear();
  vi.restoreAllMocks();
});
async function panel(status = "available", extra: Record<string, unknown> = {}) {
  vi.spyOn(bridgeApi, "operatorExecution").mockResolvedValue({
    schema_version: "tilesim.bridge.operator_execution.v1",
    schema_set_revision: "test",
    backend_identity: { versions_match: true, source_revision: "native-fixture" },
    modes: Object.fromEntries(
      ["kernel_strategy", "tilelang_source", "execution_partition"].map((k) => [
        k,
        { status, reason: "test-native-admission" },
      ]),
    ),
    ...fixture,
    ...extra,
  } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const wrapper = mount(OperatorAuthoringPanel, {
    props: {
      backendIdentity: "native-fixture",
      revision: "test",
      request: null,
      runtimeJson: JSON.stringify(fixture.custom_inputs.runtime_trace),
      topologyJson: JSON.stringify(fixture.custom_inputs.topology),
    },
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
  });
  await flushPromises();
  return wrapper;
}
describe("operator authoring modes", () => {
  it("rejects a descriptor for another backend deployment", async () => {
    const w = await panel("available", {
      backend_identity: { source_revision: "native-fixture", deployment_ref: "different" },
    });
    await w.get('input[value="kernel_strategy"]').setValue();
    expect(w.text()).toContain("backend identity changed");
    expect(w.emitted("change")?.at(-1)?.[1]).toBe(false);
    w.unmount();
  });

  it("cannot validate a new identity with an in-flight old receipt", async () => {
    const w = await panel();
    await w.get('input[value="kernel_strategy"]').setValue();
    await w.setProps({
      request: {
        scenario_id: "s1_des_example",
        fidelity_policy: "des",
        custom_inputs: fixture.custom_inputs,
        execution_input: fixture.examples.kernel_strategy,
      } as never,
    });
    let finish!: (value: never) => void;
    vi.spyOn(bridgeApi, "validateOperatorExecution").mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const clicked = w
      .findAll("button")
      .find((b) => b.text().includes("运行前校验"))!
      .trigger("click");
    await clicked;
    await w.setProps({ backendIdentity: "changed-deployment" });
    finish({ status: "available", config_sha256: "stale", sources: [] } as never);
    await flushPromises();
    expect(w.emitted("change")?.at(-1)?.[1]).toBe(false);
    expect(w.text()).not.toContain("当前请求已验证");
    w.unmount();
  });
  it("rejects unsupported descriptor revision and unavailable examples", async () => {
    const w = await panel("available", { schema_set_revision: "future" });
    await w.get('input[value="tilelang_source"]').setValue();
    expect(w.text()).toContain("unsupported_schema");
    expect(w.emitted("change")?.at(-1)?.[1]).toBe(false);
    w.unmount();
  });
  it("keeps empty backend examples explicit", async () => {
    const w = await panel("unavailable", { examples: null });
    await w.get('input[value="kernel_strategy"]').setValue();
    expect(w.text()).toContain("unavailable");
    expect(w.emitted("change")?.at(-1)?.[1]).toBe(false);
    w.unmount();
  });
  it("selects exact instances and disables unsupported collective policy", async () => {
    const w = await panel();
    await w.get('input[value="tilelang_source"]').setValue();
    const exact = w.findAll("label").find((e) => e.text() === "layer_1::attention_output")!;
    await exact.get("input").setValue(true);
    expect(
      (w.emitted("change")?.at(-1)?.[0] as { tilelang_kernels: { instances: string[] }[] }).tilelang_kernels[0]
        .instances,
    ).toContain("layer_1::attention_output");
    expect(w.get('option[value="tile_ready_allreduce"]').attributes("disabled")).toBeDefined();
    w.unmount();
  });
  it("starts with explicit default model mode", async () => {
    const w = await panel();
    expect(w.emitted("change")?.[0]).toEqual([null, true]);
    expect(w.text()).toContain("默认模型执行");
    w.unmount();
  });
  it.each([
    ["kernel_strategy", "Kernel 策略表"],
    ["tilelang_source", "源码未执行"],
    ["execution_partition", "拓扑排序预览"],
  ])("edits %s", async (mode, label) => {
    const w = await panel();
    await w.get(`input[value="${mode}"]`).setValue();
    expect(w.text()).toContain(label);
    expect(w.emitted("change")?.at(-1)?.[1]).toBe(false);
    w.unmount();
  });
  it("unavailable backend disables CLI validation", async () => {
    const w = await panel("unavailable");
    await w.get('input[value="kernel_strategy"]').setValue();
    const b = w.findAll("button").find((b) => b.text().includes("运行前校验"));
    expect(b?.attributes("disabled")).toBeDefined();
    w.unmount();
  });
  it("shows invalid advanced JSON and keeps submission closed", async () => {
    const w = await panel();
    await w.get('input[value="kernel_strategy"]').setValue();
    await w.get('textarea[aria-label="执行输入 JSON"]').setValue("{");
    expect(w.text()).toContain("/execution_input");
    expect(w.emitted("change")?.at(-1)?.[1]).toBe(false);
    w.unmount();
  });
  it("switching to default removes source input explicitly", async () => {
    const w = await panel();
    await w.get('input[value="tilelang_source"]').setValue();
    await w.get('input[value="default"]').setValue();
    expect(w.emitted("change")?.at(-1)).toEqual([null, true]);
    w.unmount();
  });
  it("invalid arguments JSON closes submission while retaining the last good structured document", async () => {
    const w = await panel();
    await w.get('input[value="tilelang_source"]').setValue();
    await w.setProps({
      request: {
        scenario_id: "s1_des_example",
        fidelity_policy: "des",
        execution_input: fixture.examples.tilelang_source,
        custom_inputs: fixture.custom_inputs,
      } as never,
    });
    vi.spyOn(bridgeApi, "validateOperatorExecution").mockResolvedValue({ status: "available", sources: [] } as never);
    await w
      .findAll("button")
      .find((b) => b.text().includes("运行前校验"))!
      .trigger("click");
    await flushPromises();
    expect(w.emitted("change")?.at(-1)?.[1]).toBe(true);
    await w.get('textarea[aria-label="TileLang arguments JSON"]').setValue("{");
    expect(w.emitted("change")?.at(-1)?.[1]).toBe(false);
    expect(w.text()).toContain("/tilelang_kernels/0/source/arguments");
    w.unmount();
  });
  it("displays source hash and invalidates validation when request changes", async () => {
    const w = await panel();
    await w.get('input[value="tilelang_source"]').setValue();
    const request = {
      scenario_id: "s1_des_example",
      fidelity_policy: "des",
      custom_inputs: fixture.custom_inputs,
      execution_input: fixture.examples.tilelang_source,
    };
    await w.setProps({ request: request as never });
    vi.spyOn(bridgeApi, "validateOperatorExecution").mockResolvedValue({
      status: "available",
      sources: [{ source_sha256: "reported-source-hash" }],
      config_sha256: "sha256:test",
      evidence_records: 1,
      claim_scope: "synthetic_consistency",
      cost_scope: "declared",
    } as never);
    await w
      .findAll("button")
      .find((b) => b.text().includes("运行前校验"))!
      .trigger("click");
    await flushPromises();
    expect(w.text()).toContain("reported-source-hash");
    expect(w.emitted("change")?.at(-1)?.[1]).toBe(true);
    await w.setProps({ request: { ...request, run_name: "changed" } as never });
    await flushPromises();
    expect(w.emitted("change")?.at(-1)?.[1]).toBe(false);
    w.unmount();
  });
});
