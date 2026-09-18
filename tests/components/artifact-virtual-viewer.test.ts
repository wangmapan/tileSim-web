// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ArtifactVirtualViewer from "../../src/features/inspect-artifact/components/ArtifactVirtualViewer.vue";
import type { ArtifactVirtualLine } from "../../src/features/inspect-artifact/model/worker-contract";

function lines(count: number): ArtifactVirtualLine[] {
  return Array.from({ length: count }, (_, index) => ({
    lineNumber: index + 1,
    text: '"record_' + index + '": ' + index,
    pointer: "/record_" + index,
    truncated: false,
  }));
}

describe("ArtifactVirtualViewer", () => {
  it("keeps a 599,975-line artifact within the 300-row DOM budget", () => {
    const wrapper = mount(ArtifactVirtualViewer, {
      props: {
        totalLines: 599_975,
        lines: lines(120),
        activeLine: 5,
        showPointers: true,
        revision: 1,
      },
    });

    expect(wrapper.findAll(".artifact-virtual-line")).toHaveLength(120);
    expect(wrapper.findAll(".artifact-virtual-line").length).toBeLessThanOrEqual(300);
    expect(wrapper.find(".artifact-virtual-line--active").text()).toContain("record_4");
    expect(wrapper.emitted("requestWindow")?.[0]).toEqual([1, 120]);
    wrapper.unmount();
  });
});
