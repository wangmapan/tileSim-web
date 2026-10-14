// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import type { DOMWrapper } from "@vue/test-utils";
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

describe("TopologyGraphEditor module list", () => {
  afterEach(() => setLocale("zh-CN"));

  /** `setValue` on a text input is unreliable; write and dispatch `change` directly. */
  async function editText(control: Omit<DOMWrapper<Element>, "exists">, value: string) {
    (control.element as HTMLInputElement).value = value;
    await control.trigger("change");
  }

  const withTopology = (patch: Record<string, unknown>): string =>
    JSON.stringify({ ...topology, topology: { ...topology.topology, ...patch } });

  it("adds a placeholder module and says the name has to be replaced", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    await wrapper.get(".topology-module-bindings > header button").trigger("click");
    const value = wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string;
    expect(JSON.parse(value).topology.module_bindings).toEqual([
      { module_name: "m", module_kind: "scale_up" },
      { module_name: "model_1", module_kind: "scale_up" },
    ]);
    expect(wrapper.get(".topology-module-bindings [role='status']").text()).toContain("占位符");
  });

  it("renames a module and keeps the domain binding in sync", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    await editText(wrapper.get(".topology-module-binding__meta input"), "m2");
    const value = wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string;
    const parsed = JSON.parse(value);
    expect(parsed.topology.module_bindings[0].module_name).toBe("m2");
    expect(parsed.topology.domains[0].module_binding).toBe("m2");
    expect(wrapper.get(".topology-module-bindings [role='status']").text()).toContain("1 个域");
  });

  it("writes the optional module version and lets it be cleared again", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    const version = wrapper.findAll(".topology-module-binding__meta input")[1];
    await editText(version, "1.2.3");
    const written = wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string;
    expect(JSON.parse(written).topology.module_bindings[0].module_version).toBe("1.2.3");
    await wrapper.setProps({ modelValue: written });
    await editText(wrapper.findAll(".topology-module-binding__meta input")[1], "");
    const cleared = wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string;
    expect("module_version" in JSON.parse(cleared).topology.module_bindings[0]).toBe(false);
  });

  it("warns when a module kind stops matching the domains that bind it", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    await wrapper.get(".topology-module-bindings select").setValue("scale_out");
    const value = wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string;
    expect(JSON.parse(value).topology.module_bindings[0].module_kind).toBe("scale_out");
    expect(wrapper.get(".topology-module-bindings [role='status']").text()).toContain("类型对不上");
  });

  it("refuses to delete a module a domain still binds and names that domain", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: JSON.stringify(topology) } });
    await wrapper.get(".topology-module-binding .icon-button").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.get(".topology-module-bindings [role='status']").text()).toContain("还被这些域绑定：d");
  });

  it("deletes a module that no domain binds", async () => {
    const wrapper = mount(TopologyGraphEditor, {
      props: {
        modelValue: withTopology({
          module_bindings: [...topology.topology.module_bindings, { module_name: "spare", module_kind: "scale_out" }],
        }),
      },
    });
    await wrapper.findAll(".topology-module-binding")[1].get(".icon-button").trigger("click");
    const value = wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string;
    expect(
      JSON.parse(value).topology.module_bindings.map((entry: { module_name: string }) => entry.module_name),
    ).toEqual(["m"]);
    expect(wrapper.get(".topology-module-bindings [role='status']").text()).toContain("已删除模型");
  });

  it("keeps the module list visible when it is empty so domains can still be added", () => {
    const wrapper = mount(TopologyGraphEditor, {
      props: { modelValue: withTopology({ module_bindings: [], domains: [] }) },
    });
    expect(wrapper.get(".topology-module-bindings").text()).toContain("还没有网络模型");
    expect(wrapper.get(".topology-module-bindings > header button").text()).toContain("新增模型");
  });
});

/**
 * The JSON tab mounts this editor as a preview: the graph is the response to the
 * textarea, and the textarea is the only way in. These cases pin that split so a
 * later change cannot quietly hand the preview back its editing powers.
 */
describe("TopologyGraphEditor preview mode", () => {
  afterEach(() => setLocale("zh-CN"));

  const withLink = JSON.stringify({
    ...topology,
    topology: { ...topology.topology, links: [{ src_device: "a", dst_device: "b", domain_id: "d" }] },
  });

  it("draws the graph but offers no way to change it", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: withLink, readOnly: true } });
    expect(wrapper.find(".topology-editor--readonly").exists()).toBe(true);
    expect(wrapper.findAll(".topology-device")).toHaveLength(2);
    expect(wrapper.findAll(".topology-link")).toHaveLength(1);

    // The chrome that only exists to edit is gone, not merely disabled.
    expect(wrapper.text()).not.toContain("连接设备");
    expect(wrapper.find(".topology-module-bindings").exists()).toBe(false);
    expect(wrapper.find(".topology-domains").exists()).toBe(false);
    expect(wrapper.find(".topology-domain-picker").exists()).toBe(false);

    // A click no longer opens the link properties, and the graph is not
    // focusable, so the keyboard route to a link cannot be reached either.
    await wrapper.get(".topology-link").trigger("click");
    expect(wrapper.find(".topology-link-panel").exists()).toBe(false);
    expect(wrapper.get(".topology-link").attributes("tabindex")).toBe("-1");
    await wrapper.get(".topology-device").trigger("keydown", { key: "Enter" });
    await wrapper.findAll(".topology-device")[1].trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("keeps the preview in step with the JSON it is handed", async () => {
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: withLink, readOnly: true } });
    await wrapper.setProps({
      modelValue: JSON.stringify({
        ...topology,
        topology: {
          ...topology.topology,
          devices: [{ device_id: "a" }],
          domains: [{ ...topology.topology.domains[0], member_devices: ["a"] }],
          links: [],
        },
      }),
    });
    expect(wrapper.findAll(".topology-device")).toHaveLength(1);
    expect(wrapper.findAll(".topology-link")).toHaveLength(0);
  });

  it("reads in English under the English locale", () => {
    setLocale("en-US");
    const wrapper = mount(TopologyGraphEditor, { props: { modelValue: withLink, readOnly: true } });
    expect(wrapper.get(".topology-editor__toolbar small").text()).toContain("Read-only preview");
    expect(wrapper.find(".topology-module-bindings").exists()).toBe(false);
  });

  it("hides the JSON box for the quick-control tab while keeping the backend pointer visible", async () => {
    const wrapper = mount(TopologyGraphEditor, {
      props: {
        modelValue: JSON.stringify(topology),
        showJson: false,
        fieldPath: "/custom_inputs/topology/topology/links",
      },
    });
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(wrapper.get(".topology-editor__error").text()).toContain("/custom_inputs/topology/topology/links");
    // Hiding the box must not turn the quick-control tab into a preview.
    expect(wrapper.find(".topology-editor--readonly").exists()).toBe(false);
    await wrapper.get("button.button--secondary").trigger("click");
    expect(wrapper.find(".topology-domain-picker").exists()).toBe(true);
  });
});
