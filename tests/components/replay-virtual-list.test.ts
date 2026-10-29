// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { h } from "vue";
import ReplayVirtualList from "../../src/features/execution-replay/components/ReplayVirtualList.vue";
import ReplayCollectivePanel from "../../src/features/execution-replay/components/ReplayCollectivePanel.vue";

describe("ReplayVirtualList", () => {
  it("mounts a bounded window while keeping the complete scroll size", () => {
    const total = 2_001;
    const wrapper = mount(ReplayVirtualList, {
      props: { total, rowHeight: 40, maxHeight: 320, ariaLabel: "全部证据" },
      slots: {
        default: ({ startIndex, endIndex, topSpacerHeight, bottomSpacerHeight }) =>
          h(
            "div",
            {
              class: "window",
              "data-start": startIndex,
              "data-end": endIndex,
              "data-top": topSpacerHeight,
              "data-bottom": bottomSpacerHeight,
            },
            Array.from({ length: endIndex - startIndex }, (_, index) =>
              h("span", { class: "row" }, String(startIndex + index)),
            ),
          ),
      },
    });
    const viewport = wrapper.get(".replay-virtual-list");
    expect(viewport.attributes("aria-label")).toBe("全部证据");
    expect(viewport.attributes("aria-setsize")).toBe(String(total));
    expect(
      Number(viewport.get(".window").attributes("data-end")) - Number(viewport.get(".window").attributes("data-start")),
    ).toBeLessThan(40);
    expect(wrapper.findAll(".row").length).toBeLessThan(40);
  });

  it("exposes keyboard scrolling without changing the total row count", async () => {
    const wrapper = mount(ReplayVirtualList, {
      props: { total: 500, rowHeight: 32, maxHeight: 160 },
      slots: {
        default: ({ startIndex, endIndex }) =>
          h("div", { class: "window", "data-start": startIndex, "data-end": endIndex }),
      },
    });
    const viewport = wrapper.get(".replay-virtual-list");
    await viewport.trigger("keydown", { key: "End" });
    expect(viewport.attributes("aria-setsize")).toBe("500");
    expect(Number(viewport.get(".window").attributes("data-start"))).toBeGreaterThan(400);
  });

  it("keeps a large collective artifact scrollable without mounting every row", async () => {
    const steps = Array.from({ length: 2_001 }, (_, index) => ({
      stepId: `step-${index}`,
      collectiveId: "collective-0",
      phaseId: "allreduce",
      phaseLabel: "AllReduce（全归约）",
      round: String(index),
      chunk: "0",
      timing: { startPs: String(index), endPs: String(index + 1) },
      sourceDevice: "gpu-0",
      destinationDevice: "gpu-1",
      bytes: "1",
      dependencies: [],
      sourcePath: `execution-replay:/collective_steps/${index}`,
      sourceArtifact: "execution-replay",
      availability: "available" as const,
    }));
    const wrapper = mount(ReplayCollectivePanel, {
      props: {
        collective: {
          availability: "available",
          supported: true,
          steps,
          sourcePath: "execution-replay:/collective_steps",
          sourceArtifact: "execution-replay",
          reason: "",
        },
        selectedStepId: null,
      },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".replay-virtual-list").attributes("role")).toBe("region");
    expect(wrapper.get(".replay-collective__table").attributes("aria-rowcount")).toBe("2001");
    expect(wrapper.findAll("tbody tr").length).toBeLessThan(40);
    expect(wrapper.text()).toContain("2001 个已报告步骤");
  });
});
