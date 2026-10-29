// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { setLocale } from "../../src/i18n";
import TopologyGraphEditor from "../../src/features/run-experiment/TopologyGraphEditor.vue";
import type { TopologyDocument } from "../../src/features/run-experiment/topology-graph";

type TestTopologyEnvelope = { scenario_name: string; topology: TopologyDocument; workload: { requests: unknown[] } };

const topology: TestTopologyEnvelope = {
  scenario_name: "demo",
  topology: {
    devices: [
      { device_id: "gpu0", device_type: "GPU" },
      { device_id: "gpu1", device_type: "GPU" },
      { device_id: "gpu2", device_type: "GPU" },
      { device_id: "gpu3", device_type: "GPU" },
    ],
    module_bindings: [{ module_name: "m", module_kind: "scale_up" }],
    domains: [
      {
        domain_id: "su0",
        domain_type: "scale_up",
        member_devices: ["gpu0", "gpu1", "gpu2", "gpu3"],
        module_binding: "m",
      },
    ],
    links: [],
  },
  workload: { requests: [] },
};

const mountEditor = (value = topology, props: Record<string, unknown> = {}) =>
  mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(value), ...props } });

describe("TopologyGraphEditor", () => {
  afterEach(() => setLocale("zh-CN"));

  it("shows every GPU on the primary canvas without relation/domain nodes", () => {
    const wrapper = mountEditor();
    expect(wrapper.findAll(".topology-device")).toHaveLength(4);
    expect(wrapper.find(".topology-direct-canvas").exists()).toBe(true);
    expect(wrapper.find("[data-zoom-out]").exists()).toBe(true);
    expect(wrapper.find("[data-zoom-in]").exists()).toBe(true);
    expect(wrapper.find(".topology-view-more").exists()).toBe(false);
    expect(wrapper.find(".topology-domain-node").exists()).toBe(false);
    expect(wrapper.find(".topology-membership").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("空白区域可平移画布");
  });

  it("zooms only the graph scene without changing the canvas viewport or topology JSON", async () => {
    const wrapper = mountEditor();
    const svg = wrapper.get(".topology-canvas");
    expect(wrapper.findAll("[data-zoom-select]")).toHaveLength(1);
    expect((wrapper.get("[data-zoom-select]").element as HTMLSelectElement).value).toBe("1");
    await wrapper.get("[data-zoom-in]").trigger("click");
    expect((wrapper.get("[data-zoom-select]").element as HTMLSelectElement).value).toBe("1.1");
    expect(wrapper.get(".topology-scene").attributes("transform")).toContain("scale(1.1)");
    expect(svg.attributes("style")).toContain("width: 100%");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.find("[data-zoom-reset]").exists()).toBe(false);
    await wrapper.get("[data-view-reset]").trigger("click");
    expect((wrapper.get("[data-zoom-select]").element as HTMLSelectElement).value).toBe("1");
  });

  it("offers direct zoom levels down to 10%", async () => {
    const wrapper = mountEditor();
    const select = wrapper.get("[data-zoom-select]");
    expect(select.findAll("option")).toHaveLength(30);
    await select.setValue("0.1");
    expect((select.element as HTMLSelectElement).value).toBe("0.1");
    expect(wrapper.get(".topology-scene").attributes("transform")).toContain("scale(0.1)");
    expect(wrapper.get(".topology-canvas").attributes("style")).toContain("width: 100%");
    expect(wrapper.get("[data-zoom-out]").attributes("disabled")).toBeDefined();
  });

  it("pans the fixed workspace without changing card coordinates or topology JSON", async () => {
    const wrapper = mountEditor();
    const svg = wrapper.get(".topology-canvas");
    Object.defineProperty(svg.element, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 760, height: 520, right: 760, bottom: 520 }),
    });
    const devices = wrapper.findAll(".topology-device");
    const firstBefore = devices[0].attributes("transform");
    const pointer = (type: string, clientX: number, clientY: number) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperties(event, {
        pointerId: { value: 8 },
        pointerType: { value: "mouse" },
        button: { value: 0 },
        clientX: { value: clientX },
        clientY: { value: clientY },
      });
      return event;
    };
    wrapper.get(".topology-canvas__background").element.dispatchEvent(pointer("pointerdown", 100, 120));
    svg.element.dispatchEvent(pointer("pointermove", 160, 150));
    await nextTick();
    expect(wrapper.get(".topology-scene").attributes("transform")).toContain("translate(60 170)");
    expect(wrapper.findAll(".topology-device")[0].attributes("transform")).toBe(firstBefore);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    svg.element.dispatchEvent(pointer("pointerup", 160, 150));
    await wrapper.get("[data-view-reset]").trigger("click");
    expect(wrapper.get(".topology-scene").attributes("transform")).toContain("translate(0 140)");
  });

  it("draws existing links on the same canvas", () => {
    const value = structuredClone(topology);
    value.topology.links = [
      { link_id: "l-gpu0-gpu1", src_device: "gpu0", dst_device: "gpu1", domain_id: "su0" },
      { src_device: "gpu2", dst_device: "gpu3", domain_id: "su0" },
    ];
    const wrapper = mountEditor(value);
    expect(wrapper.findAll(".topology-link")).toHaveLength(2);
    expect(wrapper.findAll(".topology-link--inside")).toHaveLength(2);
    expect(wrapper.text()).toContain("l-gpu0-gpu1");
    expect(wrapper.find(".topology-summary").text()).toContain("2");
    expect(wrapper.text()).not.toContain("关系图（辅助）");
    expect(wrapper.text()).not.toContain("仿真域内连接");
    expect(wrapper.text()).not.toContain("仿真跨域连接");
  });

  it("adds a link by dragging from one GPU to another and chooses the shared domain", async () => {
    const wrapper = mountEditor();
    const nodes = wrapper.findAll(".topology-device");
    await nodes[0].trigger("pointerdown", { pointerId: 1 });
    expect(wrapper.findAll(".topology-device.pending")).toHaveLength(1);
    await nodes[1].trigger("pointerup", { pointerId: 1 });
    const value = JSON.parse(wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string);
    expect(value.topology.links).toEqual([{ src_device: "gpu0", dst_device: "gpu1", domain_id: "su0" }]);
  });

  it("dragging the same pair again removes the link", async () => {
    const value = structuredClone(topology);
    value.topology.links = [{ src_device: "gpu0", dst_device: "gpu1", domain_id: "su0" }];
    const wrapper = mountEditor(value);
    const nodes = wrapper.findAll(".topology-device");
    await nodes[0].trigger("pointerdown", { pointerId: 1 });
    await nodes[1].trigger("pointerup", { pointerId: 1 });
    const emitted = wrapper.emitted("update:modelValue") || [];
    expect(JSON.parse(emitted.at(-1)?.[0] as string).topology.links).toEqual([]);
  });

  it("marks a link between separate domains as cross-domain communication", () => {
    const value = structuredClone(topology);
    value.topology.domains = [
      { ...topology.topology.domains[0], domain_id: "su0", member_devices: ["gpu0", "gpu1"] },
      {
        ...topology.topology.domains[0],
        domain_id: "so1",
        domain_type: "scale_out",
        member_devices: ["gpu2", "gpu3"],
      },
    ];
    value.topology.links = [{ src_device: "gpu0", dst_device: "gpu2", domain_id: "so1" }];
    const wrapper = mountEditor(value);
    expect(wrapper.findAll(".topology-link--cross")).toHaveLength(1);
    expect(wrapper.text()).toContain("虚线：跨域通信");
    expect(wrapper.get(".topology-link").attributes("aria-label")).toContain("跨域通信");
    expect(wrapper.get(".topology-link__kind").text()).toContain("跨域通信 · so1");
    expect(wrapper.findAll(".topology-device__domain")[0].text()).toContain("su0");
  });

  it("uses the explicit domain type for the communication label", () => {
    const value = structuredClone(topology);
    value.topology.domains[0].member_devices = ["gpu0"];
    value.topology.links = [{ src_device: "gpu0", dst_device: "gpu1", domain_id: "su0" }];
    const wrapper = mountEditor(value);
    expect(wrapper.findAll(".topology-link--inside")).toHaveLength(1);
    expect(wrapper.findAll(".topology-link--cross")).toHaveLength(0);
    expect(wrapper.get(".topology-link__kind").text()).toContain("域内通信 · su0");
  });

  it("prefers the cross-domain fabric for cards in different groups", async () => {
    const value = structuredClone(topology);
    value.topology.devices = value.topology.devices.map((device, index) => ({
      ...device,
      group_id: index < 2 ? "node0" : "node1",
    }));
    value.topology.domains = [
      { ...topology.topology.domains[0], domain_id: "su0", member_devices: ["gpu0", "gpu1", "gpu2", "gpu3"] },
      {
        ...topology.topology.domains[0],
        domain_id: "so0",
        domain_type: "scale_out",
        member_devices: ["gpu0", "gpu1", "gpu2", "gpu3"],
      },
    ];
    const wrapper = mountEditor(value);
    const nodes = wrapper.findAll(".topology-device");
    await nodes[0].trigger("pointerdown", { pointerId: 1 });
    await nodes[2].trigger("pointerup", { pointerId: 1 });
    const emitted = wrapper.emitted("update:modelValue") || [];
    expect(JSON.parse(emitted.at(-1)?.[0] as string).topology.links).toEqual([
      { src_device: "gpu0", dst_device: "gpu2", domain_id: "so0" },
    ]);
  });

  it("keeps connection attributes editable without mixing them into the graph", async () => {
    const value = structuredClone(topology);
    value.topology.links = [{ src_device: "gpu0", dst_device: "gpu1", domain_id: "su0" }];
    const wrapper = mountEditor(value);
    await wrapper.find(".topology-link").trigger("click");
    expect(wrapper.find(".topology-link-panel").exists()).toBe(true);
    await wrapper.find(".topology-link-panel input[type='number']").setValue("450");
    const edited = JSON.parse(wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string);
    expect(edited.topology.links[0].bandwidth_gbps).toBe(450);
  });

  it("does not allow JSON preview to edit by pointer or keyboard", async () => {
    const value = structuredClone(topology);
    value.topology.links = [{ src_device: "gpu0", dst_device: "gpu1", domain_id: "su0" }];
    const wrapper = mountEditor(value, { readOnly: true });
    expect(wrapper.find(".topology-editor--readonly").exists()).toBe(true);
    expect(wrapper.findAll(".topology-device")).toHaveLength(4);
    await wrapper.findAll(".topology-device")[0].trigger("pointerdown", { pointerId: 1 });
    await wrapper.findAll(".topology-device")[1].trigger("pointerup", { pointerId: 1 });
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.find(".topology-link-panel").exists()).toBe(false);
  });

  it("preserves the envelope and exposes the backend pointer in quick-control mode", () => {
    const wrapper = mountEditor(topology, { showJson: false, fieldPath: "/custom_inputs/topology/topology/links" });
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(wrapper.find(".topology-editor__error").text()).toContain("/custom_inputs/topology/topology/links");
  });

  it("keeps module bindings visible without an advanced disclosure", () => {
    const wrapper = mountEditor();
    expect(wrapper.find(".topology-model-settings").exists()).toBe(true);
    expect(wrapper.find(".topology-model-settings summary").exists()).toBe(false);
    expect(wrapper.find(".topology-module-binding").exists()).toBe(true);
  });

  it("arranges cards by domain without changing the topology JSON", async () => {
    const value = structuredClone(topology);
    value.topology.domains = [
      { ...topology.topology.domains[0], domain_id: "su0", member_devices: ["gpu0", "gpu1"] },
      { ...topology.topology.domains[0], domain_id: "su1", member_devices: ["gpu2", "gpu3"] },
    ];
    const source = JSON.stringify(value);
    const wrapper = mountEditor(value);
    await wrapper.get(".topology-arrange-button").trigger("click");
    const transforms = wrapper.findAll(".topology-device").map((node) => node.attributes("transform") || "");
    const coordinates = transforms.map((transform) => transform.match(/translate\(([^,]+),([^)]+)\)/));
    expect(coordinates[0]?.[2]).toBe(coordinates[1]?.[2]);
    expect(coordinates[2]?.[2]).toBe(coordinates[3]?.[2]);
    expect(coordinates[0]?.[1]).not.toBe(coordinates[1]?.[1]);
    expect(coordinates[2]?.[1]).not.toBe(coordinates[3]?.[1]);
    expect(coordinates[0]?.[1]).not.toBe(coordinates[2]?.[1]);
    expect(wrapper.find("textarea").element.value).toBe(source);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.get(".topology-direct-canvas").attributes("data-arrangement-applied")).toBe("true");
  });

  it("requires confirmation before clearing the canvas and preserves network models", async () => {
    const wrapper = mountEditor();
    await wrapper.get("[data-clear-canvas]").trigger("click");
    expect(wrapper.find("[data-clear-confirm]").exists()).toBe(true);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();

    await wrapper.get("[data-clear-cancel]").trigger("click");
    expect(wrapper.find("[data-clear-confirm]").exists()).toBe(false);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();

    await wrapper.get("[data-clear-canvas]").trigger("click");
    await wrapper.get("[data-clear-confirm]").trigger("click");
    const cleared = JSON.parse(wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string);
    expect(cleared.topology.devices).toEqual([]);
    expect(cleared.topology.domains).toEqual([]);
    expect(cleared.topology.links).toEqual([]);
    expect(cleared.topology.module_bindings).toEqual(topology.topology.module_bindings);
    expect(wrapper.emitted("device-count-change")?.at(-1)?.[0]).toEqual({ ids: [] });
  });

  it("keeps one-click arrangement available inside fullscreen", async () => {
    const wrapper = mountEditor();
    expect(wrapper.find("[data-fullscreen-arrange]").exists()).toBe(false);
    const editorRegion = wrapper.get(".topology-direct-canvas").element;
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: editorRegion });
    document.dispatchEvent(new Event("fullscreenchange"));
    await nextTick();

    expect(wrapper.find("[data-fullscreen-arrange]").exists()).toBe(true);
    await wrapper.get("[data-fullscreen-arrange]").trigger("click");
    expect(wrapper.get(".topology-direct-canvas").attributes("data-arrangement-applied")).toBe("true");

    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    document.dispatchEvent(new Event("fullscreenchange"));
  });

  it("uses a compact grid for a large single-domain group", async () => {
    const wrapper = mountEditor();
    await wrapper.get(".topology-arrange-button").trigger("click");
    const coordinates = wrapper.findAll(".topology-device").map((node) => {
      const match = (node.attributes("transform") || "").match(/translate\(([^,]+),([^)]+)\)/);
      return { x: match?.[1], y: match?.[2] };
    });
    expect(new Set(coordinates.map(({ x }) => x)).size).toBe(2);
    expect(new Set(coordinates.map(({ y }) => y)).size).toBe(2);
  });

  it("packs multiple domain groups by width and keeps a scrollable canvas for larger inputs", async () => {
    const value = structuredClone(topology);
    value.topology.devices = Array.from({ length: 10 }, (_, index) => ({
      device_id: `gpu${index}`,
      device_type: "GPU",
      ...(index < 5 ? { group_id: "node0" } : { group_id: "node1" }),
    }));
    value.topology.domains = [
      { ...topology.topology.domains[0], domain_id: "su0", member_devices: ["gpu0", "gpu1", "gpu2", "gpu3"] },
      { ...topology.topology.domains[0], domain_id: "su1", member_devices: ["gpu4", "gpu5", "gpu6", "gpu7"] },
    ];
    const wrapper = mountEditor(value);
    await wrapper.get(".topology-arrange-button").trigger("click");
    const coordinates = wrapper.findAll(".topology-device").map((node) => {
      const match = (node.attributes("transform") || "").match(/translate\(([^,]+),([^)]+)\)/);
      return { x: Number(match?.[1]), y: Number(match?.[2]) };
    });
    expect(wrapper.find(".topology-canvas-scroll").exists()).toBe(true);
    expect(new Set(coordinates.slice(0, 4).map(({ y }) => y)).size).toBe(2);
    expect(new Set(coordinates.slice(4, 8).map(({ y }) => y)).size).toBe(2);
    expect(Math.min(...coordinates.slice(8).map(({ y }) => y))).toBeGreaterThan(
      Math.max(...coordinates.slice(0, 8).map(({ y }) => y)),
    );
    expect(coordinates.slice(8).every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it("leaves a clear gap for a vertical cross-domain link label", async () => {
    const value = structuredClone(topology);
    value.topology.domains = [
      { ...topology.topology.domains[0], domain_id: "su0", member_devices: ["gpu0", "gpu1", "gpu2", "gpu3"] },
      {
        ...topology.topology.domains[0],
        domain_id: "so0",
        domain_type: "scale_out",
        member_devices: ["gpu0", "gpu1", "gpu2", "gpu3"],
      },
    ];
    value.topology.links = [{ src_device: "gpu0", dst_device: "gpu2", domain_id: "so0" }];
    const wrapper = mountEditor(value);
    await wrapper.get(".topology-arrange-button").trigger("click");
    const badge = wrapper.get(".topology-link__badge");
    const badgeY = Number(badge.attributes("transform")?.match(/,\s*([^)]+)\)/)?.[1]);
    expect(badgeY).toBeGreaterThan(122);
    expect(badgeY).toBeLessThan(230);
  });

  it("separates labels for parallel links that share the same endpoints", async () => {
    const value = structuredClone(topology);
    value.topology.domains = [
      { ...topology.topology.domains[0], domain_id: "su0", member_devices: ["gpu0", "gpu1"] },
      { ...topology.topology.domains[0], domain_id: "su1", member_devices: ["gpu0", "gpu1"] },
    ];
    value.topology.links = [
      { src_device: "gpu0", dst_device: "gpu1", domain_id: "su0" },
      { src_device: "gpu0", dst_device: "gpu1", domain_id: "su1" },
    ];
    const wrapper = mountEditor(value);
    await wrapper.get(".topology-arrange-button").trigger("click");
    const transforms = wrapper.findAll(".topology-link__badge").map((node) => node.attributes("transform"));
    expect(transforms).toHaveLength(2);
    expect(transforms[0]).not.toBe(transforms[1]);
  });

  it("drops the arranged state and clamps old positions when the topology shape changes", async () => {
    const wrapper = mountEditor();
    await wrapper.get(".topology-arrange-button").trigger("click");
    expect(wrapper.get(".topology-direct-canvas").attributes("data-arrangement-applied")).toBe("true");

    const next = structuredClone(topology);
    next.topology.devices = [{ device_id: "gpu0", device_type: "GPU" }];
    next.topology.domains[0].member_devices = ["gpu0"];
    await wrapper.setProps({ modelValue: JSON.stringify(next) });

    expect(wrapper.get(".topology-direct-canvas").attributes("data-arrangement-applied")).toBeUndefined();
    const transform = wrapper.get(".topology-device").attributes("transform") || "";
    const coordinates = transform.match(/translate\(([^,]+),([^)]+)\)/);
    expect(Number(coordinates?.[1])).toBeGreaterThanOrEqual(62);
    expect(Number(coordinates?.[2])).toBeLessThanOrEqual(204);
  });

  it("merges overlapping domains into one visual group without duplicating cards", async () => {
    const value = structuredClone(topology);
    value.topology.domains = [
      { ...topology.topology.domains[0], domain_id: "su0", member_devices: ["gpu0", "gpu1"] },
      { ...topology.topology.domains[0], domain_id: "so0", domain_type: "scale_out", member_devices: ["gpu1", "gpu2"] },
    ];
    const wrapper = mountEditor(value);
    await wrapper.get(".topology-arrange-button").trigger("click");
    expect(wrapper.findAll(".topology-device")).toHaveLength(4);
    const transforms = wrapper.findAll(".topology-device").map((node) => node.attributes("transform") || "");
    const coordinates = transforms.map((transform) => transform.match(/translate\(([^,]+),([^)]+)\)/));
    expect(coordinates[0]?.[2]).toBe(coordinates[1]?.[2]);
    expect(coordinates[0]?.[1]).toBe(coordinates[2]?.[1]);
    expect(coordinates[0]?.[1]).not.toBe(coordinates[1]?.[1]);
    expect(coordinates[2]?.[2]).not.toBe(coordinates[0]?.[2]);
    expect(coordinates[3]?.[2]).toBe(coordinates[0]?.[2]);
  });

  it("hides the arrangement action in JSON preview mode", () => {
    const wrapper = mountEditor(topology, { readOnly: true });
    expect(wrapper.find(".topology-arrange-button").exists()).toBe(false);
  });

  it("supports English labels", () => {
    setLocale("en-US");
    const wrapper = mountEditor();
    expect(wrapper.get(".topology-editor__toolbar strong").text()).toBe("Topology links");
    expect(wrapper.text()).not.toContain("Drag the empty workspace to pan");
  });
});
