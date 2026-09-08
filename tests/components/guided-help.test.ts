/** @vitest-environment jsdom */

import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeGuidedHelp,
  guideRegistry,
  GuidedHelpHost,
  PagePrimer,
  TermHelp,
  openGuidedHelp,
} from "../../src/features/guided-help";
import { routedGuideIds } from "../../src/features/guided-help/schema";
import { setLocale } from "../../src/i18n";

const router = createRouter({
  history: createMemoryHistory(),
  routes: routedGuideIds.map((name) => ({ path: "/" + name, name, component: { template: "<div />" } })),
});
const Harness = defineComponent({
  components: { GuidedHelpHost, PagePrimer },
  setup: () => ({ guide: guideRegistry.overview }),
  template:
    '<PagePrimer :guide="guide" /><details><section data-help-anchor="overview-status">status</section></details><GuidedHelpHost default-guide-id="overview" />',
});
const wrappers: ReturnType<typeof mount>[] = [];
async function openDocument() {
  const wrapper = mount(Harness, { attachTo: document.body, global: { plugins: [router] } });
  wrappers.push(wrapper);
  const trigger = wrapper.get(".page-primer-trigger");
  await trigger.trigger("click");
  await vi.dynamicImportSettled();
  await flushPromises();
  return { wrapper, trigger, panel: document.querySelector("dialog")! };
}

beforeEach(async () => {
  localStorage.clear();
  setLocale("zh-CN");
  closeGuidedHelp();
  document.body.innerHTML = "";
  document.body.style.overflow = "auto";
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  await router.push({
    name: "overview",
    query: { run: "run-9007199254740993", evidence_request: "req/0", evidence_pointer: "/old" },
  });
  await router.isReady();
});
afterEach(async () => {
  closeGuidedHelp();
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  await nextTick();
});

describe("help documentation", () => {
  it("opens directly from one opt-in button and restores focus and scrolling on cancel", async () => {
    const { trigger, panel } = await openDocument();
    expect(trigger.text()).toBe("页面帮助");
    expect(trigger.attributes("aria-haspopup")).toBe("dialog");
    expect(trigger.attributes("aria-expanded")).toBe("true");
    expect(panel.open).toBe(true);
    expect(panel.querySelectorAll("[data-guide-id]")).toHaveLength(13);
    for (const section of guideRegistry.overview.steps) expect(panel.textContent).toContain(section.body);
    expect(panel.textContent).toContain("术语与定义");
    expect(panel.textContent).toContain("适用范围与证据边界");
    expect(document.body.style.overflow).toBe("hidden");
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(document.querySelector("[data-help-active]")).toBeNull();
    panel.dispatchEvent(new Event("cancel", { cancelable: true }));
    await nextTick();
    await nextTick();
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger.element);
    expect(document.body.style.overflow).toBe("auto");
  });
  it("searches and changes topics without navigating or exposing unavailable anchors", async () => {
    const { panel } = await openDocument();
    const initial = router.currentRoute.value.fullPath;
    const search = panel.querySelector("input")!;
    search.value = "没有这个主题";
    search.dispatchEvent(new Event("input"));
    await nextTick();
    expect(panel.querySelector('[role="status"]')?.textContent).toContain("没有匹配");
    search.value = "";
    search.dispatchEvent(new Event("input"));
    await nextTick();
    (panel.querySelector('[data-guide-id="validation"]') as HTMLElement).click();
    await nextTick();
    await nextTick();
    expect(panel.querySelector("h1")?.textContent).toBe("结果可信度");
    expect(panel.querySelector('[aria-current="page"]')?.textContent).toContain("结果可信度");
    expect(panel.querySelectorAll(".help-documentation-locate")).toHaveLength(0);
    expect(router.currentRoute.value.fullPath).toBe(initial);
    const link = panel.querySelector(".help-documentation-related a")!;
    expect(link.getAttribute("href")).toContain("run=run-9007199254740993");
    expect(link.getAttribute("href")).toContain("evidence_request=req/0");
    expect(link.getAttribute("href")).not.toContain("evidence_pointer");
  });
  it("locates only existing sections on explicit request and opens their disclosure", async () => {
    const { panel } = await openDocument();
    expect(panel.querySelectorAll(".help-documentation-locate")).toHaveLength(1);
    (panel.querySelector(".help-documentation-locate") as HTMLElement).click();
    await nextTick();
    await nextTick();
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.querySelector("details")?.open).toBe(true);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
    expect(document.activeElement).toBe(document.querySelector('[data-help-anchor="overview-status"]'));
  });
  it("leaves no dialog or scroll lock after unmount or rapid cancellation", async () => {
    const { wrapper } = await openDocument();
    wrapper.unmount();
    expect(document.body.style.overflow).toBe("auto");
    expect(document.querySelector("dialog")).toBeNull();
    openGuidedHelp("overview");
    closeGuidedHelp();
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(document.querySelector("dialog")).toBeNull();
  });
  it("retains accessible standalone terminology disclosures", async () => {
    const wrapper = mount(TermHelp, {
      props: { label: "术语解释", count: 2 },
      slots: { default: "<p>TTFT definition</p>" },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    const trigger = wrapper.get("button");
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(trigger.attributes("aria-controls")).toBeTruthy();
    await trigger.trigger("click");
    expect(trigger.attributes("aria-expanded")).toBe("true");
    expect(wrapper.text()).toContain("TTFT definition");
    await trigger.trigger("keydown", { key: "Escape" });
    await nextTick();
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger.element);
  });
});
