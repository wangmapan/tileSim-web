// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LightweightTaskCards from "../../src/features/lightweight-workbench/components/LightweightTaskCards.vue";
import { LIGHTWEIGHT_TASK_CATEGORIES } from "../../src/features/lightweight-workbench/components/task-catalog";

describe("legacy lightweight informational cards", () => {
  it("renders the compatibility card categories without expanding the setup flow", () => {
    const wrapper = mount(LightweightTaskCards);
    expect(wrapper.findAll(".lightweight-task-category")).toHaveLength(4);
    expect(LIGHTWEIGHT_TASK_CATEGORIES).toHaveLength(4);
    expect(LIGHTWEIGHT_TASK_CATEGORIES.every((category) => category.templates.length <= 2)).toBe(true);
    expect(wrapper.findAll(".lightweight-task-card")).toHaveLength(8);
    expect(wrapper.text()).toContain("适用人群");
    expect(wrapper.text()).toContain("预计耗时");
    expect(wrapper.text()).toContain("副作用");
  });

  it("labels every example card and emits a setup hint without side effects", async () => {
    const wrapper = mount(LightweightTaskCards);
    const examples = wrapper
      .findAll(".lightweight-task-card")
      .filter((card) => card.text().includes("吞吐优先") || card.text().includes("延迟优先"));
    expect(examples).toHaveLength(2);
    expect(wrapper.findAll(".lightweight-task-card__badge")).toHaveLength(2);
    expect(wrapper.text()).toContain("不代表真实结果或校准证据");

    await wrapper.find(".lightweight-task-card").trigger("click");
    const selected = wrapper.emitted("select")?.[0]?.[0] as { id: string; kind: string };
    expect(selected).toMatchObject({ id: "understand-flow", kind: "task" });
  });
});
