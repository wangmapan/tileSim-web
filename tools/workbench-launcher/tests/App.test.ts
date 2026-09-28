import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.vue";

function button(wrapper: VueWrapper, label: string) {
  const match = wrapper
    .findAll("button")
    .find((item) => item.attributes("aria-label") === label || item.text().trim() === label);
  if (!match) throw new Error(`button not found: ${label}`);
  return match;
}

async function mountApp() {
  const wrapper = mount(App, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

describe("TileSim workbench launcher", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-appearance");
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("shows the first-screen status, action and next step", async () => {
    const wrapper = await mountApp();
    expect(wrapper.text()).toContain("服务未启动");
    expect(wrapper.text()).toContain("建议下一步");
    expect(button(wrapper, "一键启动工作台").exists()).toBe(true);
    expect(button(wrapper, "重新部署当前代码").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("启动与服务");
    wrapper.unmount();
  });

  it("focuses the first invalid model field", async () => {
    const wrapper = await mountApp();
    await button(wrapper, "模型服务").trigger("click");
    await wrapper.get("#model-base-url").setValue("http://provider.example.invalid");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.get("#model-base-url").element);
    expect(wrapper.text()).toContain("请填写 HTTPS 地址");
    wrapper.unmount();
  });

  it("clears the API key immediately and never renders it", async () => {
    vi.useFakeTimers();
    const wrapper = await mountApp();
    await button(wrapper, "模型服务").trigger("click");
    const secret = "fixture-secret-must-not-render";
    await wrapper.get("#model-api-key").setValue(secret);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect((wrapper.get("#model-api-key").element as HTMLInputElement).value).toBe("");
    expect(wrapper.text()).not.toContain(secret);
    expect(wrapper.html()).not.toContain(secret);
    await vi.runAllTimersAsync();
    await flushPromises();
    await button(wrapper, "操作日志").trigger("click");
    expect(wrapper.text()).not.toContain(secret);
    wrapper.unmount();
  });

  it("restores focus to the triggering action after completion", async () => {
    vi.useFakeTimers();
    const wrapper = await mountApp();
    const trigger = button(wrapper, "一键启动工作台");
    await trigger.trigger("click");
    await flushPromises();
    await vi.runAllTimersAsync();
    await flushPromises();
    expect(document.activeElement).toBe(trigger.element);
    wrapper.unmount();
  });

  it("persists only the non-sensitive theme preference", async () => {
    const wrapper = await mountApp();
    await wrapper.get("button[aria-label='切换到深色主题']").trigger("click");
    expect(document.documentElement.dataset.appearance).toBe("dark");
    expect(localStorage.getItem("tilesim.launcher.theme")).toBe("dark");
    expect(Object.keys(localStorage)).toEqual(["tilesim.launcher.theme"]);
    wrapper.unmount();
  });

  it("keeps the local deployment primary and remote update in advanced operations", async () => {
    const wrapper = await mountApp();
    await button(wrapper, "重新部署当前代码").trigger("click");
    expect(wrapper.text()).toContain("部署当前本地工作树？");
    expect(wrapper.text()).toContain("不 fetch、不 push、不切换分支");
    expect(wrapper.text()).toContain("未提交改动");
    await button(wrapper, "返回").trigger("click");
    expect(wrapper.text()).not.toContain("部署当前本地工作树？");
    await button(wrapper, "部署设置").trigger("click");
    expect(wrapper.findAll("details").some((item) => item.text().includes("更新并部署最新 main"))).toBe(true);
    wrapper.unmount();
  });
});
