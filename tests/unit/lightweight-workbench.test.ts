// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkbenchEntryView from "../../src/views/WorkbenchEntryView.vue";
import LightweightWorkbenchShell from "../../src/features/lightweight-workbench/components/LightweightWorkbenchShell.vue";
import WorkbenchModeSwitcher from "../../src/features/lightweight-workbench/components/WorkbenchModeSwitcher.vue";
import { router as appRouter } from "../../src/app/router";
import {
  WORKBENCH_MODE_STORAGE_KEY,
  createLightweightAgentAdapter,
  createLightweightContext,
  persistWorkbenchMode,
  readWorkbenchMode,
} from "../../src/features/lightweight-workbench";

const overviewSourceModules = import.meta.glob("../../src/views/OverviewView.vue", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const fieldIds = [
  ["s0.workload.message_size_multiplier", "number", "ratio", "/overrides/workload/message_size_multiplier"],
  ["s1.runtime.batch_scheduler", "enum", "policy", "/overrides/runtime/batch_scheduler"],
  ["s1.runtime.max_batch_size", "integer", "count", "/overrides/runtime/max_batch_size"],
  ["s1.runtime.kv_capacity_tokens", "integer", "tokens", "/overrides/runtime/kv_capacity_tokens"],
  ["s6.fabric.scale_up_bandwidth_gbps", "number", "Gbps", "/overrides/fabric/scale_up_bandwidth_gbps"],
  ["s6.fabric.scale_up_latency_us", "number", "us", "/overrides/fabric/scale_up_latency_us"],
  ["s6.fabric.scale_out_bandwidth_gbps", "number", "Gbps", "/overrides/fabric/scale_out_bandwidth_gbps"],
  ["s6.fabric.scale_out_latency_us", "number", "us", "/overrides/fabric/scale_out_latency_us"],
] as const;
const capability = {
  catalog_identity: "tilesim.bridge.agent_orchestration_capability_catalog.v1" as const,
  catalog_revision: `sha256:${"a".repeat(64)}`,
  capability_snapshot_revision: `sha256:${"b".repeat(64)}`,
  schema_set_revision: `sha256:${"c".repeat(64)}`,
  target_request_identity: "tilesim.bridge.create_run_request.v1" as const,
  fields: fieldIds.map(([field_id, value_type, canonical_unit, request_json_pointer]) => ({
    field_id,
    aliases: [
      field_id,
      field_id.split(".").at(-1)!,
      ...(field_id === "s1.runtime.max_batch_size" ? ["最大 batch size", "max batch size"] : []),
    ],
    value_type,
    canonical_unit,
    accepted_units: [canonical_unit],
    request_json_pointer,
    enum_values: field_id === "s1.runtime.batch_scheduler" ? ["fifo", "priority"] : [],
    minimum: value_type === "enum" ? null : "0",
    maximum: value_type === "enum" ? null : "1000000",
    integer_only: value_type === "integer",
    capability_state: "available" as const,
  })),
};

describe("lightweight workbench adapter", () => {
  beforeEach(() => window.localStorage.clear());
  it("uses the existing compiler and preserves a canonical draft projection", async () => {
    const adapter = createLightweightAgentAdapter({ context: createLightweightContext("ctx:1"), capability });
    const result = await adapter.submit("把最大 batch size 调整为 8");
    expect(result.status).toBe("draft");
    expect(result.fields[0]).toMatchObject({
      field_id: "s1.runtime.max_batch_size",
      proposed_value: "8",
      unit: "count",
      source: "user",
    });
  });
  it("keeps unsupported and unknown states fail-closed", async () => {
    const adapter = createLightweightAgentAdapter({ context: createLightweightContext("ctx:1"), capability });
    expect((await adapter.submit("把 TP 改成 8")).status).toBe("unsupported");
    expect((await adapter.submit("把 queue depth 改成 8")).status).toBe("unknown");
  });
  it("persists only a non-sensitive mode preference", () => {
    persistWorkbenchMode("lightweight");
    expect(window.localStorage.getItem(WORKBENCH_MODE_STORAGE_KEY)).toBe("lightweight");
    expect(readWorkbenchMode()).toBe("lightweight");
  });
});

describe("workbench entry route contract", () => {
  beforeEach(() => window.localStorage.clear());

  function testRouter() {
    return createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "workbench_entry", component: WorkbenchEntryView },
        { path: "/overview", name: "overview", component: { template: "<div>professional</div>" } },
        { path: "/lightweight", name: "lightweight", component: { template: "<div>lightweight</div>" } },
      ],
    });
  }

  it("keeps root as a neutral entry route and preserves the lightweight route family", () => {
    const root = appRouter.getRoutes().find((route) => route.path === "/");
    expect(root?.name).toBe("workbench_entry");
    expect(root?.redirect).toBeUndefined();
    expect(root?.meta.layout).toBe("entry");
    expect(appRouter.getRoutes().map((route) => route.path)).toEqual(
      expect.arrayContaining([
        "/lightweight",
        "/lightweight/learn",
        "/lightweight/tasks",
        "/lightweight/prepare",
        "/lightweight/results",
      ]),
    );
    expect(appRouter.resolve("/overview").name).toBe("overview");
    expect(appRouter.resolve("/lightweight").name).toBe("lightweight");
    expect(appRouter.getRoutes().find((route) => route.path === "/lightweight-workbench")?.redirect).toEqual({
      name: "lightweight",
    });
  });

  it("does not render the lightweight entry cards inside professional Overview", () => {
    const source = overviewSourceModules["../../src/views/OverviewView.vue"];
    expect(source).toBeTypeOf("string");
    expect(source).not.toContain("LightweightEntryCards");
    expect(source).not.toContain("showWorkbenchEntry");
  });

  it("keeps only the allowlisted query when restoring a legacy view route", async () => {
    const root = appRouter.getRoutes().find((route) => route.path === "/");
    expect(typeof root?.beforeEnter).toBe("function");
    const result = await (root?.beforeEnter as any)({
      query: {
        view: "overview",
        run: "run-demo-1",
        artifact_sha256: "sha256:artifact",
        schema_set_revision: "sha256:schema",
        from: "lightweight",
        unknown: "drop-me",
      },
    });
    expect(result).toEqual({
      name: "overview",
      query: {
        run: "run-demo-1",
        artifact_sha256: "sha256:artifact",
        schema_set_revision: "sha256:schema",
        from: "lightweight",
      },
    });
  });

  it("rejects an invalid legacy run and never forwards unknown query keys", async () => {
    const root = appRouter.getRoutes().find((route) => route.path === "/");
    const result = await (root?.beforeEnter as any)({
      query: {
        view: "overview",
        run: "not-a-run",
        artifact_sha256: "sha256:artifact",
        unknown: "drop-me",
      },
    });
    expect(result).toEqual({
      name: "overview",
      query: { artifact_sha256: "sha256:artifact" },
    });
  });

  it("renders two equal entry links without professional shell content", async () => {
    const router = testRouter();
    await router.push("/?run=run-demo-1");
    await router.isReady();
    const wrapper = mount(WorkbenchEntryView, { attachTo: document.body, global: { plugins: [router] } });

    const links = wrapper.findAll("a.workbench-choice-card__action");
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.element.tagName === "A")).toBe(true);
    expect(wrapper.find("h1").text()).toContain("选择适合你的工作台");
    expect(wrapper.find(".app-sidebar").exists()).toBe(false);
    expect(wrapper.find(".evidence-strip").exists()).toBe(false);
    expect(wrapper.find("form").exists()).toBe(false);
    expect((links[0].element as HTMLElement).tabIndex).toBeGreaterThanOrEqual(0);
    (links[0].element as HTMLElement).focus();
    expect(document.activeElement).toBe(links[0].element);
    wrapper.unmount();
  });

  it.each(["lightweight", "professional"] as const)("shows the entry page with a weak %s hint", async (mode) => {
    persistWorkbenchMode(mode);
    const router = testRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mount(WorkbenchEntryView, { attachTo: document.body, global: { plugins: [router] } });

    expect(wrapper.find("h1").exists()).toBe(true);
    expect(wrapper.text()).toContain(`上次使用：${mode === "lightweight" ? "轻量版" : "专业版"}`);
    expect(router.currentRoute.value.name).toBe("workbench_entry");
    wrapper.unmount();
  });

  it("records preference only after choosing an entry and carries a legal run query", async () => {
    const router = testRouter();
    await router.push("/?run=run-demo-1");
    await router.isReady();
    const wrapper = mount(WorkbenchEntryView, { attachTo: document.body, global: { plugins: [router] } });

    expect(window.localStorage.getItem(WORKBENCH_MODE_STORAGE_KEY)).toBeNull();
    const lightweightLink = wrapper.findAll("a.workbench-choice-card__action")[0];
    const lightweightHref = lightweightLink.attributes("href");
    expect(lightweightHref).toBe("/lightweight?run=run-demo-1");
    await lightweightLink.trigger("click", { button: 0 });
    expect(window.localStorage.getItem(WORKBENCH_MODE_STORAGE_KEY)).toBe("lightweight");
    await router.push(lightweightHref!);
    expect(router.currentRoute.value.fullPath).toBe("/lightweight?run=run-demo-1");
    wrapper.unmount();
  });

  it("records the professional preference when its entry is chosen", async () => {
    const router = testRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mount(WorkbenchEntryView, { attachTo: document.body, global: { plugins: [router] } });
    const professionalLink = wrapper.findAll("a.workbench-choice-card__action")[1];

    const professionalHref = professionalLink.attributes("href");
    expect(professionalHref).toBe("/overview");
    await professionalLink.trigger("click", { button: 0 });
    expect(window.localStorage.getItem(WORKBENCH_MODE_STORAGE_KEY)).toBe("professional");
    wrapper.unmount();
  });

  it("keeps navigation working when localStorage throws", async () => {
    const router = testRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mount(WorkbenchEntryView, { attachTo: document.body, global: { plugins: [router] } });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    const professionalLink = wrapper.findAll("a.workbench-choice-card__action")[1];
    await professionalLink.trigger("click", { button: 0 });
    await router.push(professionalLink.attributes("href")!);
    expect(router.currentRoute.value.name).toBe("overview");
    wrapper.unmount();
    setItem.mockRestore();
  });

  it("renders the independent lightweight shell with active URL navigation", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/lightweight",
          name: "lightweight",
          component: { template: "<div>start</div>" },
          meta: { workspace: "lightweight" },
        },
        {
          path: "/lightweight/learn",
          name: "lightweight_learn",
          component: { template: "<div>learn</div>" },
          meta: { workspace: "lightweight" },
        },
        {
          path: "/lightweight/tasks",
          name: "lightweight_tasks",
          component: { template: "<div>tasks</div>" },
          meta: { workspace: "lightweight" },
        },
        {
          path: "/lightweight/prepare",
          name: "lightweight_prepare",
          component: { template: "<div>prepare</div>" },
          meta: { workspace: "lightweight" },
        },
        {
          path: "/lightweight/results",
          name: "lightweight_results",
          component: { template: "<div>results</div>" },
          meta: { workspace: "lightweight" },
        },
        {
          path: "/overview",
          name: "overview",
          component: { template: "<div>professional</div>" },
          meta: { workspace: "professional" },
        },
      ],
    });
    await router.push(
      "/lightweight/tasks?run=run-demo-1&artifact_sha256=sha256:artifact&schema_set_revision=sha256:schema&from=lightweight&unknown=drop",
    );
    await router.isReady();
    const wrapper = mount(LightweightWorkbenchShell, {
      global: { plugins: [router] },
      slots: { default: "<p data-test='content'>placeholder</p>" },
    });
    expect(wrapper.find(".app-sidebar").exists()).toBe(false);
    expect(wrapper.find(".evidence-strip").exists()).toBe(false);
    expect(wrapper.find("[data-test='content']").exists()).toBe(true);
    expect(wrapper.findAll(".lightweight-shell__nav-link")).toHaveLength(5);
    expect(wrapper.find(".lightweight-shell__nav-link.is-active").text()).toContain("任务");
    const modeSwitch = wrapper.find(".workbench-mode-switcher");
    expect(modeSwitch.attributes("href")).toBe(
      "/overview?run=run-demo-1&artifact_sha256=sha256:artifact&schema_set_revision=sha256:schema&from=lightweight",
    );
    await modeSwitch.trigger("click", { button: 0 });
    expect(window.localStorage.getItem(WORKBENCH_MODE_STORAGE_KEY)).toBe("professional");
    wrapper.unmount();
  });

  it("preserves the allowlisted query when switching from professional to lightweight", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/overview",
          name: "overview",
          component: { template: "<div />" },
          meta: { workspace: "professional" },
        },
        {
          path: "/lightweight",
          name: "lightweight",
          component: { template: "<div />" },
          meta: { workspace: "lightweight" },
        },
      ],
    });
    await router.push("/overview?run=run-demo-1&artifact_sha256=sha256:artifact&unknown=drop");
    await router.isReady();
    const wrapper = mount(WorkbenchModeSwitcher, { global: { plugins: [router] } });
    expect(wrapper.attributes("href")).toBe("/lightweight?run=run-demo-1&artifact_sha256=sha256:artifact");
    await wrapper.trigger("click", { button: 0 });
    expect(window.localStorage.getItem(WORKBENCH_MODE_STORAGE_KEY)).toBe("lightweight");
    wrapper.unmount();
  });

  it("keeps mode switching available when localStorage throws", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/overview",
          name: "overview",
          component: { template: "<div />" },
          meta: { workspace: "professional" },
        },
        {
          path: "/lightweight",
          name: "lightweight",
          component: { template: "<div />" },
          meta: { workspace: "lightweight" },
        },
      ],
    });
    await router.push("/overview");
    await router.isReady();
    const wrapper = mount(WorkbenchModeSwitcher, { global: { plugins: [router] } });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    await wrapper.trigger("click", { button: 0 });
    await router.push(wrapper.attributes("href")!);
    expect(router.currentRoute.value.name).toBe("lightweight");
    wrapper.unmount();
    setItem.mockRestore();
  });
});
