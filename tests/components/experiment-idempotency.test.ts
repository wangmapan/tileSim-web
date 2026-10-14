/** @vitest-environment jsdom */

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExperimentView from "../../src/views/ExperimentView.vue";
import { useDashboard } from "../../src/store/dashboard";

const dashboard = useDashboard();

function errorResponse(status: number, retryable: boolean, code = `http_${status}`, fieldPath: string | null = null) {
  return {
    ok: false,
    status,
    headers: { get: () => "application/json" },
    text: async () =>
      JSON.stringify({
        error: { code, message: "submission failed", field_path: fieldPath, retryable },
      }),
  };
}

beforeEach(() => {
  dashboard.clearExperimentSubmission();
  dashboard.state.bridge.available = true;
  vi.stubGlobal("crypto", { randomUUID: () => "component-retry-key" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("experiment idempotency state", () => {
  it("keeps the key after a retryable or ambiguous server response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(503, true)));
    const wrapper = mount(ExperimentView);

    await wrapper.find("button.run-submit").trigger("click");
    await flushPromises();

    expect(dashboard.state.experimentSubmission.idempotencyKey).toBe("run-component-retry-key");
    wrapper.unmount();
  });

  it("clears the key after a definitive validation response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(400, false)));
    const wrapper = mount(ExperimentView);

    await wrapper.find("button.run-submit").trigger("click");
    await flushPromises();

    expect(dashboard.state.experimentSubmission).toEqual({ payloadText: "", idempotencyKey: "", runId: "" });
    wrapper.unmount();
  });

  it("labels Trace-package inspect rejection as intake rejection without a run", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(errorResponse(422, false, "trace_package_inspect_nonzero_exit", "/trace_package_id")),
    );
    const wrapper = mount(ExperimentView);

    await wrapper.find("button.run-submit").trigger("click");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain("输入在 intake 阶段被拒绝，尚未创建 run");
    expect(wrapper.get('[role="alert"]').text()).toContain("trace_package_inspect_nonzero_exit");
    expect(wrapper.get('[role="alert"]').text()).toContain("/trace_package_id");
    expect(wrapper.get('[role="alert"]').text()).toContain("没有运行状态或归因工件");
    wrapper.unmount();
  });
});
