// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ReplayModeTabs from "../../src/features/execution-replay/components/ReplayModeTabs.vue";
import ReplayWorkspace from "../../src/features/execution-replay/components/ReplayWorkspace.vue";
import ReplayTopologyCanvas from "../../src/features/execution-replay/components/ReplayTopologyCanvas.vue";
import { normalizeReplayDocument } from "../../src/features/execution-replay";
import {
  executionReplayCollectiveStepsFixture,
  executionReplayEnvelopeFixture,
  executionReplayFabricRouteFixture,
  executionReplayFabricRouteTopologyFixture,
  executionReplayRuntimeEvents,
} from "../fixtures/execution-replay";
import type { ReplayLayerVisibility } from "../../src/features/execution-replay/model/layers";

const visibility: ReplayLayerVisibility = {
  execution: true,
  request: false,
  scheduling: true,
  kv: true,
  device: true,
  collective: true,
  fabric: true,
  topology: true,
  output: false,
};

function documentFixture() {
  return normalizeReplayDocument({
    runId: "run-execution-replay-fixture",
    envelope: executionReplayEnvelopeFixture,
    runtimeEvents: executionReplayRuntimeEvents,
    fabricRoutes: executionReplayFabricRouteFixture,
    collectiveSteps: executionReplayCollectiveStepsFixture,
    topology: executionReplayFabricRouteTopologyFixture,
  });
}

describe("ReplayModeTabs", () => {
  it("keeps one selected mode and emits the next mode", async () => {
    const wrapper = mount(ReplayModeTabs, { props: { modelValue: "overview" } });
    await wrapper.get(".replay-mode-tabs__tab:nth-child(2)").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([["collective"]]);
  });
});

describe("ReplayWorkspace", () => {
  it("switches the information architecture without replacing the shared cursor", async () => {
    const wrapper = mount(ReplayWorkspace, {
      props: {
        document: documentFixture(),
        cursorPs: "9007199254740994000",
        selectedEventId: null,
        selectedRouteId: null,
        selectedFabricEventId: null,
        selectedCollectiveStepId: null,
        selectedStageId: null,
        artifactShaById: {},
        visibleLayers: visibility,
      },
    });

    expect(wrapper.get("[data-replay-workspace]").attributes("data-mode")).toBe("overview");
    expect(wrapper.get(".replay-workspace__overview h3").text()).toBe("当前路径");
    expect(wrapper.find(".replay-track--collective").exists()).toBe(false);
    await wrapper.get('[role="tab"]:nth-child(2)').trigger("click");
    expect(wrapper.get("[data-replay-workspace]").attributes("data-mode")).toBe("collective");
    expect(wrapper.get(".replay-topology h3").text()).toBe("集合路径");
    expect(wrapper.find(".replay-track--stages").exists()).toBe(false);
    const collective = wrapper.get('[role="tabpanel"]');
    expect(
      collective.get(".replay-topology").element.compareDocumentPosition(collective.get(".replay-timeline").element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(wrapper.text()).toContain("逻辑参与者");
    expect(wrapper.text()).toContain("与物理路径分开查看");
    expect(wrapper.find(".replay-inspector").exists()).toBe(true);
    expect(wrapper.find('[aria-label="时间游标"]').attributes("aria-valuetext")).toContain("9007199254740994000");

    await wrapper.get('[role="tab"]:nth-child(3)').trigger("click");
    expect(wrapper.get("[data-replay-workspace]").attributes("data-mode")).toBe("network");
    expect(wrapper.text()).toContain("仅显示 actual_path / execution_events");
    expect(wrapper.get(".replay-topology h3").text()).toBe("实际路径");
    expect(wrapper.find(".replay-network-routes").exists()).toBe(false);
    expect(wrapper.text()).toContain("画在上方拓扑里");
    expect(wrapper.findAll(".replay-topology__flow-token").length).toBeGreaterThan(0);
  });

  it("does not turn route timing into a physical flow without execution events", () => {
    const document = documentFixture();
    const routeOnlyDocument = {
      ...document,
      routes: document.routes.map((route) => ({ ...route, events: [] })),
      fabricEvents: [],
    };
    const wrapper = mount(ReplayTopologyCanvas, {
      props: {
        document: routeOnlyDocument,
        selectedRouteId: null,
        cursorPs: "9007199254740994000",
        mode: "overview",
      },
    });
    expect(wrapper.findAll(".replay-topology__flow-token")).toHaveLength(0);
    expect(wrapper.get(".replay-flow-readout").text()).toContain("未报告");
    expect(wrapper.get(".replay-route-row__state").text()).toBe("执行事件未报告");
  });
});
