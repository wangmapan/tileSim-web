/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
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
import { setLocale } from "../../src/i18n";

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/overview", name: "overview", component: { template: "<div />" } },
    { path: "/execution", name: "execution", component: { template: "<div />" } },
  ],
});

beforeEach(async () => {
  localStorage.clear();
  setLocale("zh-CN");
  closeGuidedHelp();
  document.body.innerHTML = "";
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  await router.push({ name: "overview" });
  await router.isReady();
});

afterEach(() => {
  closeGuidedHelp();
});

describe("guided help components", () => {
  it("renders plain-language purpose and a text-labeled key takeaway", () => {
    const wrapper = mount(PagePrimer, { props: { guide: guideRegistry.overview } });
    expect(wrapper.text()).toContain(guideRegistry.overview.title);
    expect(wrapper.text()).toContain("重点：");
    expect(wrapper.get("button").text()).toContain("开始逐步指引");
  });

  it("uses an ordered step list, aria-current, live updates, and restores focus on Escape", async () => {
    const Harness = defineComponent({
      components: { GuidedHelpHost },
      setup() {
        function start(event: MouseEvent) {
          openGuidedHelp("overview", event.currentTarget as HTMLElement);
        }
        return { start };
      },
      template: `
        <button id="guide-opener" type="button" @click="start">open</button>
        <section data-help-anchor="overview-status">status</section>
        <GuidedHelpHost default-guide-id="overview" />
      `,
    });
    const wrapper = mount(Harness, { attachTo: document.body, global: { plugins: [router] } });
    const opener = wrapper.get("#guide-opener");
    await opener.trigger("click");
    await nextTick();
    await nextTick();

    const panel = document.querySelector(".guided-step-panel");
    expect(panel).not.toBeNull();
    expect(panel?.querySelector("ol")).not.toBeNull();
    expect(panel?.querySelector('[aria-current="step"]')?.textContent).toContain("确认运行状态");
    expect(document.querySelector('[data-help-anchor="overview-status"]')?.getAttribute("data-help-active")).toBe(
      "true",
    );
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain("第 1 步");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();
    expect(document.querySelector(".guided-step-panel")).toBeNull();
    expect(document.activeElement).toBe(opener.element);
    wrapper.unmount();
  });

  it("exposes expandable terminology with aria state and closes it with Escape", async () => {
    const wrapper = mount(TermHelp, {
      props: { label: "术语解释", count: 2 },
      slots: { default: "<p>TTFT definition</p>" },
      attachTo: document.body,
    });
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
