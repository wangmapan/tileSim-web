// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DomainInventoryForm from "../../src/features/run-experiment/DomainInventoryForm.vue";

/**
 * The pure helpers are covered in `structured-input.test.ts`; this file covers
 * the wiring. Two behaviours are load-bearing:
 *
 *  - Every edit goes through the JSON text, so the emitted document — not some
 *    internal state — is what the assertions read.
 *  - A domain cannot be created without a module to bind, because the contract
 *    requires `module_binding` to be a non-empty string. Inventing a name would
 *    produce a schema-valid but semantically dead domain.
 */

const topology = {
  topology: {
    devices: [
      { device_id: "gpu0", device_type: "GPU" },
      { device_id: "gpu1", device_type: "GPU" },
    ],
    module_bindings: [
      { module_name: "su-module", module_kind: "scale_up" },
      { module_name: "so-module", module_kind: "scale_out" },
    ],
    domains: [{ domain_id: "su0", domain_type: "scale_up", member_devices: ["gpu0"], module_binding: "su-module" }],
    links: [{ src_device: "gpu0", dst_device: "gpu1", domain_id: "su0" }],
  },
};

type Document = typeof topology;

function mountForm(document: unknown = topology) {
  return mount(DomainInventoryForm, { props: { modelValue: JSON.stringify(document) } });
}

function lastDocument(wrapper: ReturnType<typeof mountForm>): Document | null {
  const emitted = wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string | undefined;
  return emitted ? (JSON.parse(emitted) as Document) : null;
}

function lastNotice(wrapper: ReturnType<typeof mountForm>) {
  return wrapper.emitted("notice")?.at(-1)?.[0] as { tone: string; message: string } | undefined;
}

function changeValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  element.value = value;
  return value;
}

describe("domain list block", () => {
  it("renders one row per domain with the labels in plain Chinese", () => {
    const wrapper = mountForm();
    expect(wrapper.findAll(".domain-inventory-row")).toHaveLength(1);
    expect((wrapper.get(".domain-inventory-row input[type='text']").element as HTMLInputElement).value).toBe("su0");
    expect((wrapper.findAll(".domain-inventory-row select")[0].element as HTMLSelectElement).value).toBe("scale_up");
    // The contract key survives as a tooltip so a backend Pointer still maps.
    expect(wrapper.get(".domain-inventory-row label").attributes("title")).toBe("domain_id");
    expect(wrapper.text()).toContain("机内高速互联（scale_up）");
  });

  it("adds an empty domain bound to a module of the matching kind", async () => {
    const wrapper = mountForm();
    await wrapper.get(".structured-block__header .button").trigger("click");
    const after = lastDocument(wrapper);
    expect(after?.topology.domains.map((entry) => entry.domain_id)).toEqual(["su0", "su1"]);
    expect(after?.topology.domains[1]).toEqual({
      domain_id: "su1",
      domain_type: "scale_up",
      member_devices: [],
      module_binding: "su-module",
    });
    expect(lastNotice(wrapper)?.message).toContain("su1");
    expect(wrapper.find(".domain-inventory .structured-note--error").exists()).toBe(false);
  });

  it("ticks a card into a domain without announcing it", async () => {
    const wrapper = mountForm();
    const box = wrapper.findAll(".domain-member-option input[type='checkbox']")[1];
    (box.element as HTMLInputElement).checked = true;
    await box.trigger("change");
    expect(lastDocument(wrapper)?.topology.domains[0].member_devices).toEqual(["gpu0", "gpu1"]);
    expect(wrapper.emitted("notice")).toBeUndefined();
  });

  it("ticks a card back out of a domain", async () => {
    const wrapper = mountForm();
    const box = wrapper.findAll(".domain-member-option input[type='checkbox']")[0];
    (box.element as HTMLInputElement).checked = false;
    await box.trigger("change");
    expect(lastDocument(wrapper)?.topology.domains[0].member_devices).toEqual([]);
  });

  it("renames a domain and rewrites the links that referenced it", async () => {
    const wrapper = mountForm();
    const input = wrapper.get(".domain-inventory-row input[type='text']");
    changeValue(input.element as HTMLInputElement, "su9");
    await input.trigger("change");
    const after = lastDocument(wrapper);
    expect(after?.topology.domains[0].domain_id).toBe("su9");
    expect(after?.topology.links[0].domain_id).toBe("su9");
  });

  it("warns when the domain type and the bound module kind disagree", async () => {
    const wrapper = mountForm();
    const select = wrapper.findAll(".domain-inventory-row select")[0];
    changeValue(select.element as HTMLSelectElement, "scale_out");
    await select.trigger("change");
    expect(lastDocument(wrapper)?.topology.domains[0].domain_type).toBe("scale_out");
    expect(lastNotice(wrapper)?.tone).toBe("warning");
  });

  it("removes a domain together with the links it owned", async () => {
    const wrapper = mountForm();
    await wrapper.get(".domain-inventory-row .icon-button").trigger("click");
    const after = lastDocument(wrapper);
    expect(after?.topology.domains).toEqual([]);
    expect(after?.topology.links).toEqual([]);
    expect(lastNotice(wrapper)?.tone).toBe("warning");
    expect(lastNotice(wrapper)?.message).toContain("1");
  });

  it("refuses to add a domain when there is no module to bind", async () => {
    const withoutModules = { topology: { ...topology.topology, module_bindings: [] } };
    const wrapper = mountForm(withoutModules);
    await wrapper.get(".structured-block__header .button").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.get(".domain-inventory .structured-note--error").text()).toContain("module_bindings");
  });

  it("refuses a rename onto an existing domain name", async () => {
    const twoDomains = JSON.parse(JSON.stringify(topology)) as Document;
    twoDomains.topology.domains.push({
      domain_id: "su1",
      domain_type: "scale_up",
      member_devices: [],
      module_binding: "su-module",
    });
    const wrapper = mountForm(twoDomains);
    const input = wrapper.findAll(".domain-inventory-row input[type='text']")[1];
    changeValue(input.element as HTMLInputElement, "su0");
    await input.trigger("change");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.get(".domain-inventory .structured-note--error").text()).toContain("已存在");
  });

  it("reports the optional domain fields it deliberately leaves to the raw JSON", () => {
    const wrapper = mountForm();
    const note = wrapper.get(".domain-inventory .structured-note--warning").text();
    expect(note).toContain("default_fidelity");
    expect(note).toContain("failure_policy");
  });
});
