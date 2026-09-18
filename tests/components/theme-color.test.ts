/** @vitest-environment jsdom */
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import ThemeColorEditor from "../../src/components/ThemeColorEditor.vue";
import { setLocale } from "../../src/i18n";

const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  setLocale("zh-CN");
});
function editor() {
  const wrapper = mount(ThemeColorEditor, { props: { initialColor: "#3376a3", appearance: "light" } });
  wrappers.push(wrapper);
  return wrapper;
}
describe("RGB theme editor", () => {
  it("synchronizes HEX and RGB while keeping edits local until applied", async () => {
    const wrapper = editor();
    await wrapper.get('input[type="text"]').setValue("#D05A20");
    expect(wrapper.findAll('input[type="number"]').map((input) => (input.element as HTMLInputElement).value)).toEqual([
      "208",
      "90",
      "32",
    ]);
    expect(wrapper.emitted("apply")).toBeUndefined();
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("apply")).toEqual([["#d05a20"]]);
  });
  it("rejects invalid channels and hex without silently applying or clamping", async () => {
    const wrapper = editor();
    await wrapper.get('input[type="text"]').setValue("#abcd");
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    expect(wrapper.get('[role="alert"]').text()).toContain("HEX");
    await wrapper.get('input[type="text"]').setValue("#fff");
    const channels = wrapper.findAll('input[type="number"]');
    await channels[0].setValue("256");
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    await channels[1].setValue("100");
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    await channels[0].setValue("80");
    expect(wrapper.get("button").attributes("disabled")).toBeUndefined();
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("apply")).toEqual([["#5064ff"]]);
  });
  it("updates its preview for appearance changes and translates input labels", async () => {
    setLocale("en-US");
    const wrapper = editor();
    expect(wrapper.find('input[aria-label="Red (R)"]').exists()).toBe(true);
    const before = wrapper.get(".theme-button-sample").attributes("style");
    await wrapper.setProps({ appearance: "dark" });
    expect(wrapper.get(".theme-button-sample").attributes("style")).not.toBe(before);
  });
});
