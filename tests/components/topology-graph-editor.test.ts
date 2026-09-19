// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "../../src/i18n";
import TopologyGraphEditor from "../../src/features/run-experiment/TopologyGraphEditor.vue";

const topology = {
  scenario_name: "demo",
  topology: {
    devices: [{ device_id: "a" }, { device_id: "b" }],
    module_bindings: [{ module_name: "m", module_kind: "scale_up" }],
    domains: [{ domain_id: "d", domain_type: "scale_up", member_devices: ["a", "b"], module_binding: "m" }],
    links: [],
  },
  workload: { requests: [] },
};

describe("TopologyGraphEditor", () => {
  afterEach(() => setLocale("zh-CN"));

  it("renders canonical envelope and keyboard-connects without layout coordinates", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    expect(wrapper.findAll(".topology-device")).toHaveLength(2);
    expect(wrapper.findAll(".topology-membership")).toHaveLength(2);
    expect(wrapper.findAll(".topology-domain-node")).toHaveLength(1);
    expect(wrapper.text()).toContain("d · scale_up · 2 个设备");
    await wrapper.get("button.button--secondary").trigger("click");
    await wrapper.get("select").setValue("d");
    const nodes = wrapper.findAll(".topology-device");
    await nodes[0].trigger("keydown", { key: "Enter" });
    await nodes[1].trigger("keydown", { key: "Enter" });
    const emitted = wrapper.emitted("update:modelValue") || [];
    const value = emitted.at(-1)?.[0] as string;
    expect(JSON.parse(value)).toEqual(expect.objectContaining({ scenario_name: "demo", workload: { requests: [] } }));
    expect(JSON.parse(value).topology.links).toEqual([{ src_device: "a", dst_device: "b", domain_id: "d" }]);
    expect(value).not.toContain("x");
  });

  it("keeps a clicked source armed until a second device click completes the link", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    await wrapper.get("button.button--secondary").trigger("click");
    await wrapper.get("select").setValue("d");
    const nodes = wrapper.findAll(".topology-device");
    await nodes[0].trigger("pointerdown", { pointerId: 1 });
    await nodes[0].trigger("pointerup", { pointerId: 1 });
    expect(wrapper.findAll(".topology-device.pending")).toHaveLength(1);
    await nodes[1].trigger("pointerdown", { pointerId: 1 });
    await nodes[1].trigger("pointerup", { pointerId: 1 });
    const value = wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string;
    expect(JSON.parse(value).topology.links).toEqual([{ src_device: "a", dst_device: "b", domain_id: "d" }]);
  });

  it("fails closed for invalid JSON and does not render editable nodes", () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: '{"topology":' } });
    expect(wrapper.find('[role="alert"]').text()).toContain("JSON");
    expect(wrapper.findAll(".topology-device")).toHaveLength(0);
    expect(wrapper.find("textarea").attributes("aria-invalid")).toBe("true");
  });

  it("edits and deletes a selected edge while retaining envelope shape", async () => {
    const value = JSON.stringify({
      ...topology,
      topology: { ...topology.topology, links: [{ src_device: "a", dst_device: "b", domain_id: "d" }] },
    });
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: value } });
    await wrapper.find(".topology-link").trigger("click");
    const inputs = wrapper.findAll(".topology-link-panel input");
    await inputs[0].setValue("12");
    const edited = wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string;
    expect(JSON.parse(edited).topology.links[0].bandwidth_gbps).toBe(12);
    await wrapper.setProps({ modelValue: edited });
    expect(wrapper.find(".topology-link-panel").exists()).toBe(true);
    await wrapper.get(".topology-link-panel .button--danger").trigger("click");
    expect(JSON.parse(wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string).topology.links).toEqual([]);
  });

  it("selects and removes an edge from the keyboard", async () => {
    const value = JSON.stringify({
      ...topology,
      topology: { ...topology.topology, links: [{ src_device: "a", dst_device: "b", domain_id: "d" }] },
    });
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: value } });
    await wrapper.find(".topology-link").trigger("keydown", { key: "Enter" });
    expect(wrapper.find(".topology-link-panel").exists()).toBe(true);
    await wrapper.find(".topology-link").trigger("keydown", { key: "Delete" });
    expect(JSON.parse(wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string).topology.links).toEqual([]);
  });

  it("marks a backend topology pointer without requiring a caller-side default", () => {
    const wrapper = mount(TopologyGraphEditor, {
      props: { modelValue: JSON.stringify(topology), fieldPath: "/custom_inputs/topology/topology/links" },
    });
    expect(wrapper.get("textarea").attributes("aria-invalid")).toBe("true");
    expect(wrapper.find('[id^="topology-json-editor-error-"]').text()).toContain(
      "/custom_inputs/topology/topology/links",
    );
  });

  it("reflows read-only domain anchors when device rows change", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    const initialTransform = wrapper.get(".topology-domain-node").attributes("transform");
    const expandedDevices = Array.from({ length: 8 }, (_, index) => ({ device_id: `gpu-${index}` }));
    await wrapper.setProps({
      modelValue: JSON.stringify({
        ...topology,
        topology: {
          ...topology.topology,
          devices: expandedDevices,
          domains: [{ ...topology.topology.domains[0], member_devices: expandedDevices.map((item) => item.device_id) }],
          links: [],
        },
      }),
    });
    const nextTransform = wrapper.get(".topology-domain-node").attributes("transform");
    expect(nextTransform).not.toBe(initialTransform);
    expect(nextTransform).toMatch(/,440\)/);
  });

  it("rejects a dangling domain member instead of silently omitting it", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    await wrapper.setProps({
      modelValue: JSON.stringify({
        ...topology,
        topology: {
          ...topology.topology,
          domains: [{ ...topology.topology.domains[0], member_devices: ["a", "missing"] }],
        },
      }),
    });
    expect(wrapper.findAll(".topology-device")).toHaveLength(0);
    expect(wrapper.find('[role="alert"]').text()).toContain("不存在");
  });

  it("does not delete a selected link when Delete is pressed on a control", async () => {
    const value = JSON.stringify({
      ...topology,
      topology: { ...topology.topology, links: [{ src_device: "a", dst_device: "b", domain_id: "d" }] },
    });
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: value } });
    await wrapper.find(".topology-link").trigger("click");
    await wrapper.get(".topology-link-panel .button--danger").trigger("keydown", { key: "Delete" });
    expect(wrapper.find(".topology-link").exists()).toBe(true);
  });

  it("cancels a pending source when the parent replaces the JSON", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    await wrapper.get("button.button--secondary").trigger("click");
    await wrapper.get("select").setValue("d");
    await wrapper.findAll(".topology-device")[0].trigger("pointerdown", { pointerId: 1 });
    await wrapper.findAll(".topology-device")[0].trigger("pointerup", { pointerId: 1 });
    expect(wrapper.findAll(".topology-device.pending")).toHaveLength(1);
    await wrapper.setProps({ modelValue: JSON.stringify({ ...topology, scenario_name: "replacement" }) });
    expect(wrapper.findAll(".topology-device.pending")).toHaveLength(0);
  });

  it("scopes JSON editor ids per instance", () => {
    const first = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    const second = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    expect(first.get("textarea").attributes("id")).not.toBe(second.get("textarea").attributes("id"));
  });

  it("treats reverse links in the same domain as the same physical connection", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    await wrapper.get("button.button--secondary").trigger("click");
    await wrapper.get("select").setValue("d");
    const nodes = wrapper.findAll(".topology-device");
    await nodes[0].trigger("keydown", { key: "Enter" });
    await nodes[1].trigger("keydown", { key: "Enter" });
    const first = wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string;
    await wrapper.setProps({ modelValue: first });
    await nodes[1].trigger("keydown", { key: "Enter" });
    await nodes[0].trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("update:modelValue")).toHaveLength(1);
  });

  it("translates editor chrome and accessibility labels with the app locale", () => {
    setLocale("en-US");
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    expect(wrapper.attributes("aria-label")).toBe("Network topology visual editor");
    expect(wrapper.get("button.button--secondary").text()).toContain("Connect devices");
    expect(wrapper.get(".topology-editor__legend").attributes("aria-label")).toBe("Topology legend");
    expect(wrapper.get(".topology-device").attributes("aria-label")).toContain("Device a");
  });
});
