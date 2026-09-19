// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it } from "vitest";
import LightweightWorkbenchShell from "../../src/features/lightweight-workbench/components/LightweightWorkbenchShell.vue";
import LightweightTaskCards from "../../src/features/lightweight-workbench/components/LightweightTaskCards.vue";
import { LIGHTWEIGHT_TASK_CATEGORIES } from "../../src/features/lightweight-workbench/components/task-catalog";
import LightweightLearningCards from "../../src/features/lightweight-workbench/components/LightweightLearningCards.vue";
import LightweightOnboarding from "../../src/features/lightweight-workbench/components/LightweightOnboarding.vue";
import LightweightEmptyState from "../../src/features/lightweight-workbench/components/LightweightEmptyState.vue";
import LightweightHelpPanel from "../../src/features/lightweight-workbench/components/LightweightHelpPanel.vue";
import { preserveWorkbenchQuery } from "../../src/features/lightweight-workbench";
import { hasEnglishTranslation, setLocale } from "../../src/i18n";

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/lightweight", name: "lightweight", component: { template: "<div />" } },
      {
        path: "/lightweight/learn",
        name: "lightweight_learn",
        redirect: (to) => ({ name: "lightweight", query: preserveWorkbenchQuery(to.query) }),
      },
      {
        path: "/lightweight/tasks",
        name: "lightweight_tasks",
        redirect: (to) => ({ name: "lightweight_prepare", query: preserveWorkbenchQuery(to.query) }),
      },
      { path: "/lightweight/prepare", name: "lightweight_prepare", component: { template: "<div />" } },
      { path: "/lightweight/results", name: "lightweight_results", component: { template: "<div />" } },
      { path: "/lightweight/status", name: "lightweight_status", component: { template: "<div />" } },
      { path: "/overview", name: "overview", component: { template: "<div />" } },
    ],
  });
}

describe("lightweight workbench accessibility", () => {
  beforeEach(() => setLocale("zh-CN"));

  it("exposes a labelled navigation landmark and one active URL link", async () => {
    const router = makeRouter();
    await router.push("/lightweight/prepare");
    await router.isReady();
    const wrapper = mount(LightweightWorkbenchShell, {
      global: { plugins: [router] },
      slots: { default: "<p>配置内容</p>" },
    });

    const nav = wrapper.find("aside[aria-label='轻量工作台导航'] nav");
    expect(nav.exists()).toBe(true);
    const links = wrapper.findAll("a.lightweight-shell__nav-link");
    expect(links).toHaveLength(3);
    expect(links.every((link) => link.attributes("href"))).toBe(true);
    expect(wrapper.findAll("a.lightweight-shell__nav-link.is-active")).toHaveLength(1);
    expect(wrapper.find("a.lightweight-shell__nav-link.is-active").text()).toContain("新建实验");

    expect(wrapper.find("button.page-primer-trigger").exists()).toBe(true);
    expect(wrapper.find(".lightweight-shell__help").exists()).toBe(false);
    wrapper.unmount();
  });

  it("keeps legacy informational cards keyboard-focusable with explicit labels", () => {
    const wrapper = mount(LightweightTaskCards);
    const buttons = wrapper.findAll("button");
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.length).toBeLessThanOrEqual(8);
    for (const button of buttons) {
      expect(button.attributes("type")).toBe("button");
      expect(button.text().trim()).not.toBe("");
      expect((button.element as HTMLButtonElement).tabIndex).toBeGreaterThanOrEqual(0);
    }
    wrapper.unmount();
  });

  it("keeps lightweight and shared-Agent boundary copy available in English", () => {
    const required = [
      "轻量工作台",
      "页面帮助",
      "运行 · 当前阶段",
      "不会调用 Provider",
      "可提交正式 run",
      "示例 · 非真实结果",
      "尚无可读取的运行",
      "尚无当前页面草案",
    ];
    for (const source of required) expect(hasEnglishTranslation(source)).toBe(true);
  });

  it("renders legacy card copy through the English workstream catalog", () => {
    setLocale("en-US");
    const tasks = mount(LightweightTaskCards);
    expect(tasks.text()).toContain("Estimated time");
    expect(tasks.text()).toContain("Informational card");
    expect(tasks.text()).toContain("example");
    const learning = mount(LightweightLearningCards);
    expect(learning.text()).toContain("Latency and throughput");
    tasks.unmount();
    learning.unmount();
  });

  it("owns English translations for every compatibility-card label", () => {
    const copy = LIGHTWEIGHT_TASK_CATEGORIES.flatMap((category) => [
      category.title,
      category.description,
      ...category.templates.flatMap((template) => [
        template.title,
        template.summary,
        template.audience,
        template.duration,
        template.artifacts,
        template.sideEffects,
        ...(template.exampleLabel ? [template.exampleLabel] : []),
      ]),
    ]);
    const missing = [...new Set(copy)].filter((source) => !hasEnglishTranslation(source));
    expect(missing).toEqual([]);
  });

  it("keeps compatibility concept, onboarding, empty-state and help regions labelled", async () => {
    const learning = mount(LightweightLearningCards);
    expect(learning.find("section.lightweight-learning[aria-labelledby='lightweight-learning-title']").exists()).toBe(
      true,
    );
    expect(learning.findAll("article").length).toBeGreaterThan(0);

    const onboarding = mount(LightweightOnboarding);
    expect(onboarding.find("section.lightweight-onboarding").exists()).toBe(true);
    expect(onboarding.find("#lightweight-onboarding-title").exists()).toBe(true);
    const skip = onboarding.find("button.lightweight-onboarding__skip");
    expect(skip.attributes("type")).toBe("button");
    await skip.trigger("click");
    expect(onboarding.text()).toContain("已跳过首次引导");
    const reopen = onboarding.find("button.lightweight-onboarding__reopen-button");
    expect(reopen.attributes("type")).toBe("button");
    await reopen.trigger("click");
    expect(onboarding.find("button.lightweight-onboarding__skip").exists()).toBe(true);

    for (const kind of ["bridge", "run", "draft"] as const) {
      const empty = mount(LightweightEmptyState, { props: { kind } });
      expect(empty.find("section.lightweight-empty-state[role='status'][aria-live='polite']").exists()).toBe(true);
      expect(empty.find("h2").text().trim()).not.toBe("");
      expect(empty.find("p:not(.section-kicker)").text().trim()).not.toBe("");
      empty.unmount();
    }
    const empty = mount(LightweightEmptyState, { props: { kind: "run" } });
    expect(empty.text()).toContain("还没有可查看的运行");

    const help = mount(LightweightHelpPanel);
    expect(help.find("details.lightweight-help-panel summary").exists()).toBe(true);
    expect(help.find("summary").element.tagName).toBe("SUMMARY");
    learning.unmount();
    onboarding.unmount();
    empty.unmount();
    help.unmount();
  });

  it("redirects removed learning and task entries while retaining only supported context", async () => {
    const router = makeRouter();
    await router.push(
      "/lightweight/tasks?run=run-demo-1&artifact_sha256=sha256:artifact&schema_set_revision=sha256:schema&from=lightweight&task=understand-flow&unknown=drop",
    );
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("lightweight_prepare");
    expect(router.currentRoute.value.query).toEqual({
      run: "run-demo-1",
      artifact_sha256: "sha256:artifact",
      schema_set_revision: "sha256:schema",
      from: "lightweight",
    });

    await router.push("/lightweight/learn?run=run-demo-1&task=old-tutorial");
    expect(router.currentRoute.value.name).toBe("lightweight");
    expect(router.currentRoute.value.query).toEqual({ run: "run-demo-1" });
  });

  it("maps the legacy status alias to the lightweight run help topic", async () => {
    const router = makeRouter();
    await router.push("/lightweight/status?run=run-demo-1");
    await router.isReady();
    const wrapper = mount(LightweightWorkbenchShell, {
      global: { plugins: [router] },
      slots: { default: "<p>状态内容</p>" },
    });
    expect(wrapper.find("button.page-primer-trigger").exists()).toBe(true);
    expect(wrapper.find('[data-help-anchor="lightweight_run-primer"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
