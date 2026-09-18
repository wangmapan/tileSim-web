/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import EvidenceNode from "../../src/features/run-bound-evidence/components/EvidenceNode.vue";
import type { RunBoundEvidenceNode } from "../../src/features/run-bound-evidence/types";
import { setLocale } from "../../src/i18n";

function nodeFixture(): RunBoundEvidenceNode {
  return {
    subsystem: "S6",
    title: "Fabric request phase",
    availability: "available",
    detail: "request_id 精确匹配；保留原始关联规则。",
    entityIds: ["request-exact", "phase-exact"],
    references: [
      {
        artifactId: "metrics",
        schemaIdentity: "tilesim.metrics_report.v1",
        sha256: "a".repeat(64),
        jsonPointer: "/system_summary/phase_fabric_contributions/0",
        sourcePath: "metrics:/system_summary/phase_fabric_contributions/0",
        entityKind: "fabric_phase",
        entityId: "phase-exact",
        label: "S6 phase",
      },
    ],
  };
}

function renderNode(node: RunBoundEvidenceNode, output = false) {
  return mount(EvidenceNode, {
    props: { node, statusLabel: node.availability, output },
    global: {
      stubs: {
        ArtifactEvidenceLink: {
          props: ["sourcePath", "label"],
          template: '<a :data-source="sourcePath">{{ label }}</a>',
        },
      },
    },
  });
}

afterEach(() => setLocale("zh-CN"));

describe("evidence node presentation", () => {
  it("uses semantic headings without changing identifiers, rules or reference paths", async () => {
    const node = nodeFixture();
    const original = JSON.stringify(node);
    const wrapper = renderNode(node);
    expect(wrapper.find("header strong").text()).toBe("网络请求阶段");
    expect(wrapper.find("header span").text()).toBe("S6");
    expect(wrapper.findAll("code").map((entry) => entry.text())).toEqual(node.entityIds);
    expect(wrapper.find("a").attributes("data-source")).toBe(node.references[0].sourcePath);
    expect(wrapper.find(".run-bound-binding-rule").attributes("open")).toBeUndefined();
    expect(wrapper.find(".run-bound-binding-rule p").text()).toBe(node.detail);
    setLocale("en-US");
    await wrapper.vm.$nextTick();
    expect(wrapper.find("header strong").text()).toBe("Network request phase");
    expect(wrapper.find("summary").text()).toBe("Binding rule");
    expect(JSON.stringify(node)).toBe(original);
    wrapper.unmount();
  });

  it.each<RunBoundEvidenceNode["availability"]>([
    "partial",
    "run_scope_only",
    "not_applicable",
    "missing",
    "ambiguous_reference",
    "invalid_reference",
    "artifact_identity_missing",
    "unsupported_schema",
    "legacy_compatibility",
    "contract_gap",
  ])("keeps %s reasons outside collapsed details", (availability) => {
    const node = { ...nodeFixture(), availability };
    const wrapper = renderNode(node);
    expect(wrapper.find(".run-bound-node-reason").text()).toBe(node.detail);
    expect(wrapper.find(".run-bound-node-reason").element.closest("details")).toBeNull();
    expect(wrapper.find(".run-bound-binding-rule").exists()).toBe(false);
    expect(wrapper.find("header small").text()).toBe(availability);
    wrapper.unmount();
  });

  it("preserves output preview limits, order and all remaining references", () => {
    const node = nodeFixture();
    node.subsystem = "S9";
    node.entityIds = Array.from({ length: 6 }, (_, index) => `source-${index}`);
    node.references = Array.from({ length: 5 }, (_, index) => ({
      ...node.references[0],
      sourcePath: `tail:/cause_chain/${index}`,
    }));
    const wrapper = renderNode(node, true);
    expect(wrapper.findAll(".run-bound-node-content > code")).toHaveLength(3);
    expect(wrapper.findAll(".run-bound-node-content > .run-bound-reference-list a")).toHaveLength(2);
    expect(wrapper.find(".run-bound-output-more summary").text()).toContain("6 项");
    expect(wrapper.findAll("code").map((entry) => entry.text())).toEqual(node.entityIds);
    expect(wrapper.findAll("a").map((entry) => entry.attributes("data-source"))).toEqual(
      node.references.map((entry) => entry.sourcePath),
    );
    wrapper.unmount();
  });
});
