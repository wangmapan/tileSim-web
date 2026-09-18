/** @vitest-environment jsdom */

import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HistoryView from "../../src/views/HistoryView.vue";
import { useDashboard } from "../../src/store/dashboard";
import { bridgeApi } from "../../src/lib/api";
import { queryClient } from "../../src/lib/query-client";
import { setLocale } from "../../src/i18n";

enableAutoUnmount(afterEach);
const dashboard = useDashboard();
const { state } = dashboard;
const sampleRun = {
  run_id: "run-history-fixture",
  run_name: "History fixture",
  status: "completed",
  input_mode: "controls",
  created_at: "2026-09-01T08:00:00Z",
};

beforeEach(() => {
  queryClient.clear();
  setLocale("zh-CN");
  Object.assign(state.history, { runs: [], selected: [], comparisons: {}, query: "", loading: false, error: "" });
  state.bridge.connected = true;
  state.bridge.checking = false;
});

afterEach(() => {
  vi.restoreAllMocks();
  queryClient.clear();
  setLocale("zh-CN");
});

describe("history workflow", () => {
  it("distinguishes loading, disconnected, empty, filtered, and failed states", async () => {
    state.history.loading = true;
    const wrapper = mount(HistoryView);
    expect(wrapper.get('[role="status"]').text()).toContain("正在加载运行记录");
    expect(wrapper.find(".empty-state").exists()).toBe(false);
    state.history.loading = false;
    state.bridge.connected = false;
    await flushPromises();
    expect(wrapper.text()).toContain("本地执行服务未连接");
    expect(wrapper.find(".empty-state").exists()).toBe(false);
    state.bridge.connected = true;
    await flushPromises();
    expect(wrapper.get(".empty-state").text()).toContain("尚无运行记录");
    await wrapper.get('input[type="search"]').setValue("no-match");
    expect(wrapper.get(".empty-state").text()).toContain("没有匹配的运行");
    await wrapper.get(".history-clear").trigger("click");
    expect(state.history.query).toBe("");
    state.history.error = "history fixture failure";
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("history fixture failure");
    expect(wrapper.find(".empty-state").exists()).toBe(false);
  });

  it("bounds rendered rows and resets pagination when filtering", async () => {
    state.history.runs = Array.from({ length: 60 }, (_, index) => ({ ...sampleRun, run_id: `run-${index}` }));
    const wrapper = mount(HistoryView);
    expect(wrapper.findAll(".run-row")).toHaveLength(25);
    await wrapper.get(".history-pagination button:last-child").trigger("click");
    expect(wrapper.findAll(".run-row")[0].text()).toContain("run-25");
    await wrapper.get('input[type="search"]').setValue("run-59");
    expect(wrapper.findAll(".run-row")).toHaveLength(1);
    expect(wrapper.find(".history-pagination").exists()).toBe(false);
    await wrapper.get('input[type="search"]').setValue("");
    expect(wrapper.findAll(".run-row")[0].text()).toContain("run-0");
  });

  it("preserves zero, missing values, units, and non-completed action restrictions", () => {
    state.history.runs = [
      { ...sampleRun, digest: { end_to_end_latency_us: 0 } },
      { ...sampleRun, run_id: "running-fixture", status: "running" },
    ];
    const wrapper = mount(HistoryView);
    expect(wrapper.get("thead").text()).toContain("µs");
    expect(wrapper.get("thead").text()).toContain("req/s");
    expect(wrapper.findAll(".run-metric strong").map((element) => element.text())).toEqual(["0", "—", "—", "—"]);
    expect(wrapper.findAll(".run-main")[1].attributes("disabled")).toBeDefined();
    expect(wrapper.findAll(".run-actions .button")[1].attributes("disabled")).toBeDefined();
    expect(wrapper.findAll(".run-actions .button")[0].attributes("aria-pressed")).toBe("false");
  });

  it("forces a fresh request on refresh and retains records after failure until a successful retry", async () => {
    const listRuns = vi.spyOn(bridgeApi, "listRuns").mockResolvedValue({ runs: [sampleRun] });
    await dashboard.loadHistory();
    await dashboard.loadHistory();
    expect(listRuns).toHaveBeenCalledTimes(1);
    const wrapper = mount(HistoryView);
    listRuns.mockRejectedValueOnce(new Error("fixture unavailable"));
    await wrapper.get(".history-toolbar > button").trigger("click");
    await flushPromises();
    expect(listRuns).toHaveBeenCalledTimes(2);
    expect(wrapper.get('[role="alert"]').text()).toContain("保留上次加载的记录");
    expect(wrapper.findAll(".run-row")).toHaveLength(1);
    await wrapper.get(".history-toolbar > button").trigger("click");
    await flushPromises();
    expect(listRuns).toHaveBeenCalledTimes(3);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("translates new empty-state and loading guidance", () => {
    setLocale("en-US");
    const wrapper = mount(HistoryView);
    expect(wrapper.get(".empty-state").text()).toContain("No runs yet");
    expect(wrapper.get('input[type="search"]').attributes("aria-label")).toContain("Search");
  });
});
