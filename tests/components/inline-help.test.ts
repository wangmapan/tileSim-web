// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import InlineHelp from "../../src/components/InlineHelp.vue";

describe("InlineHelp", () => {
  it("renders an accessible question-mark trigger and tooltip text", () => {
    const wrapper = mount(InlineHelp, { props: { text: "说明这项配置的作用" } });
    const trigger = wrapper.get("button.inline-help__trigger");

    expect(trigger.attributes("type")).toBe("button");
    expect(trigger.attributes("aria-label")).toBe("查看说明");
    expect(trigger.attributes("title")).toBeUndefined();
    expect(trigger.attributes("aria-describedby")).toBe(wrapper.get('[role="tooltip"]').attributes("id"));
    expect(wrapper.get('[role="tooltip"]').text()).toBe("说明这项配置的作用");
    expect(wrapper.find(".inline-help__trigger svg").exists()).toBe(true);
  });

  it("allows callers to provide a field-specific accessible label", () => {
    const wrapper = mount(InlineHelp, { props: { text: "范围：0 到 64", label: "查看字段范围" } });
    expect(wrapper.get("button").attributes("aria-label")).toBe("查看字段范围");
    expect(wrapper.get("button").attributes("title")).toBeUndefined();
  });

  it("supports edge-aligned bubbles without changing the trigger semantics", () => {
    const wrapper = mount(InlineHelp, { props: { text: "边界说明", placement: "end" } });

    expect(wrapper.get('[role="tooltip"]').classes()).toContain("inline-help__bubble--end");
    expect(wrapper.get("button").attributes("aria-describedby")).toBe(wrapper.get('[role="tooltip"]').attributes("id"));
  });

  it("supports passive help when rendered inside a disclosure summary", () => {
    const wrapper = mount(InlineHelp, { props: { text: "摘要说明", interactive: false } });

    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.get('[role="img"]').attributes("aria-describedby")).toBe(
      wrapper.get('[role="tooltip"]').attributes("id"),
    );
  });
});
