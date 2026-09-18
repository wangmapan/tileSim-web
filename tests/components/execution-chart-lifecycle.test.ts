/** @vitest-environment jsdom */

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayerVisualization } from "../../src/features/execution-inspector/model/types";
import ExecutionChart from "../../src/features/execution-inspector/charts/ExecutionChart.vue";

const mocks = vi.hoisted(() => ({
  chart: { on: vi.fn(), setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() },
  init: vi.fn(),
  observe: vi.fn(),
  disconnect: vi.fn(),
  mutation: vi.fn(),
}));
vi.mock("echarts/core", () => ({ init: mocks.init, use: vi.fn() }));
vi.mock("echarts/charts", () => ({ BarChart: {}, ScatterChart: {} }));
vi.mock("echarts/components", () => ({ GridComponent: {}, LegendComponent: {}, TooltipComponent: {} }));
vi.mock("echarts/renderers", () => ({ SVGRenderer: {} }));
vi.mock("../../src/features/execution-inspector/charts/chart-options", () => ({ chartOption: vi.fn(() => ({})) }));

const visualization: LayerVisualization = {
  id: "lifecycle",
  kind: "bar",
  title: "请求延迟",
  description: "测试夹具",
  question: "",
  firstLook: "",
  boundary: "synthetic consistency",
  rationale: "",
  unit: "µs",
  sourcePaths: [],
  derivation: "identity",
  columns: ["延迟"],
  series: [{ name: "延迟" }],
  rows: [{ label: "request", values: [0] }],
};

let mutationCallback: () => void;
let resizeCallback: () => void;
let nextFrame: number;
const frames = new Map<number, FrameRequestCallback>();

beforeEach(() => {
  vi.clearAllMocks();
  frames.clear();
  nextFrame = 0;
  mocks.init.mockReturnValue(mocks.chart);
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        mocks.mutation();
        mutationCallback = callback;
      }
      observe = mocks.observe;
      disconnect = mocks.disconnect;
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeCallback = callback;
      }
      observe = mocks.observe;
      disconnect = mocks.disconnect;
    },
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      nextFrame += 1;
      frames.set(nextFrame, callback);
      return nextFrame;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((frame: number) => frames.delete(frame)),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("execution chart lifetime", () => {
  it("does not initialize or subscribe after unmount during the mounted await", async () => {
    const wrapper = mount(ExecutionChart, { props: { visualization } });
    wrapper.unmount();
    await flushPromises();
    expect(mocks.init).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.observe).not.toHaveBeenCalled();
  });

  it("coalesces appearance and resize notifications within a frame", async () => {
    const wrapper = mount(ExecutionChart, { props: { visualization } });
    try {
      await flushPromises();
      expect(mocks.init).toHaveBeenCalledTimes(1);
      mocks.chart.setOption.mockClear();
      mutationCallback();
      mutationCallback();
      resizeCallback();
      resizeCallback();
      expect(frames.size).toBe(1);
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(0));
      expect(mocks.chart.setOption).toHaveBeenCalledTimes(1);
      expect(mocks.chart.resize).toHaveBeenCalledTimes(1);
    } finally {
      wrapper.unmount();
    }
  });

  it("disconnects both observers and cancels queued work before disposal", async () => {
    const wrapper = mount(ExecutionChart, { props: { visualization } });
    await flushPromises();
    mutationCallback();
    wrapper.unmount();
    expect(mocks.disconnect).toHaveBeenCalledTimes(2);
    expect(mocks.chart.dispose).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    const renderCount = mocks.chart.setOption.mock.calls.length;
    mutationCallback();
    resizeCallback();
    expect(frames.size).toBe(0);
    expect(mocks.chart.setOption).toHaveBeenCalledTimes(renderCount);
  });
});
