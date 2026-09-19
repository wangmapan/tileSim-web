// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkbenchEntryView from "../../src/views/WorkbenchEntryView.vue";
import LightweightWorkbenchShell from "../../src/features/lightweight-workbench/components/LightweightWorkbenchShell.vue";
import WorkbenchModeSwitcher from "../../src/features/lightweight-workbench/components/WorkbenchModeSwitcher.vue";
import LightweightUnderstandingSummary from "../../src/features/lightweight-workbench/components/LightweightUnderstandingSummary.vue";
import LightweightRunSummary from "../../src/features/lightweight-workbench/components/LightweightRunSummary.vue";
import type { ReportBundle } from "../../src/contracts/report-model";
import { restoredLegacyRoute, routeForView, router as appRouter } from "../../src/app/router";
import { setLocale } from "../../src/i18n";
import { emitLightweightTelemetry, LIGHTWEIGHT_TELEMETRY_EVENT } from "../../src/features/lightweight-workbench";
import {
  WORKBENCH_MODE_STORAGE_KEY,
  createLightweightAgentAdapter,
  createLightweightContext,
  persistWorkbenchMode,
  preserveWorkbenchQuery,
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

describe("shared Agent draft adapter used by the lightweight workbench", () => {
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
      catalog_revision: capability.catalog_revision,
      capability_snapshot_revision: capability.capability_snapshot_revision,
      context_revision: "ctx:1",
    });
  });
  it("keeps unsupported and unknown states fail-closed", async () => {
    const adapter = createLightweightAgentAdapter({ context: createLightweightContext("ctx:1"), capability });
    expect((await adapter.submit("把 TP 改成 8")).status).toBe("unsupported");
    expect((await adapter.submit("把 queue depth 改成 8")).status).toBe("unknown");
  });
  it("keeps uint64 draft values as decimal strings and redacts secrets without persistence", async () => {
    const uint64Capability = {
      ...capability,
      fields: capability.fields.map((field) =>
        field.field_id === "s1.runtime.max_batch_size"
          ? { ...field, value_type: "uint64" as const, maximum: "18446744073709551615" }
          : field,
      ),
    };
    const adapter = createLightweightAgentAdapter({
      context: createLightweightContext("ctx:uint64"),
      // The published Phase 1 projection type is intentionally bounded; the
      // adapter accepts a lossless uint64 descriptor at this boundary.
      capability: uint64Capability as unknown as typeof capability,
    });
    const result = await adapter.submit("把最大 batch size 调整为 9007199254740993; api_key=do-not-store");
    expect(result.status).toBe("draft");
    expect(result.fields[0]).toMatchObject({
      field_id: "s1.runtime.max_batch_size",
      proposed_value: "9007199254740993",
    });
    expect(JSON.stringify(result)).not.toContain("do-not-store");
    expect(window.localStorage.getItem(WORKBENCH_MODE_STORAGE_KEY)).toBeNull();
  });

  it("does not promote validation failures into a draft success", async () => {
    const adapter = createLightweightAgentAdapter({ context: createLightweightContext("ctx:invalid"), capability });
    const result = await adapter.submit("把最大 batch size 调整为 1000001");
    expect(result.status).toBe("validation_error");
    expect(result.blocks.some((block) => block.block_type === "validation_result")).toBe(true);
  });
  it("persists only a non-sensitive mode preference", () => {
    persistWorkbenchMode("lightweight");
    expect(window.localStorage.getItem(WORKBENCH_MODE_STORAGE_KEY)).toBe("lightweight");
    expect(readWorkbenchMode()).toBe("lightweight");
  });
});

describe("shared Agent result presentation and side-effect boundary", () => {
  const context = createLightweightContext("ctx:ui");
  const result = (status: import("../../src/features/lightweight-workbench").LightweightResultStatus) => ({
    status,
    summary: "读取到的摘要",
    blocks: [],
    fields: [],
    missing: status === "missing" ? ["请补充 batch"] : [],
    limitations: ["Agent 只生成本地草案；正式 run 由工作台校验后提交。"],
    context,
    capability: null,
  });

  it.each(["draft", "validation_error", "stale", "unknown", "unsupported", "unavailable", "error"] as const)(
    "renders an explicit %s state without exposing raw payload",
    (status) => {
      const wrapper = mount(LightweightUnderstandingSummary, { props: { result: result(status) } });
      expect(wrapper.text()).toContain(status === "draft" ? "草案" : status === "stale" ? "内容已过期" : "限制");
      expect(wrapper.text()).not.toContain("JSON.stringify");
      wrapper.unmount();
    },
  );

  it("renders missing clarification separately from limitations", () => {
    const wrapper = mount(LightweightUnderstandingSummary, { props: { result: result("missing") } });
    expect(wrapper.text()).toContain("还需要确认");
    expect(wrapper.text()).toContain("请补充 batch");
    expect(wrapper.text()).toContain("下一步");
    wrapper.unmount();
  });
});

describe("lightweight run handoff", () => {
  const bundle = {
    run: {
      report_kind: "wind_tunnel_run_result",
      contract_version: "wind_tunnel.run.v1alpha1",
      status: "completed",
      summary: { trace_name: "trace-demo", range_label: "S1->S6" },
    },
    metrics: null,
    validation: null,
    tail: null,
    design_space: null,
    execution_envelope: null,
    run_bound_des_evidence: null,
    unsupported: {},
    compatibility: { run: { status: "supported", schema: "wind_tunnel.run.v1alpha1", supported: true, issues: [] } },
  } as unknown as ReportBundle;

  function routerFor() {
    return createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/lightweight/results", name: "lightweight_results", component: LightweightRunSummary },
        { path: "/overview", name: "overview", component: { template: "<div />" } },
      ],
    });
  }

  it("renders a verified summary and preserves the professional handoff query", async () => {
    const router = routerFor();
    await router.push(
      "/lightweight/results?run=run-demo-1&artifact_sha256=sha256:artifact&schema_set_revision=sha256:schema&from=lightweight",
    );
    await router.isReady();
    const wrapper = mount(LightweightRunSummary, {
      props: {
        bundle,
        runId: "run-demo-1",
        requestedRunId: "run-demo-1",
        artifactManifest: {
          schema_version: "tilesim.bridge.artifact_manifest.v2",
          api_version: "tilesim.bridge.api.v1",
          schema_set_revision: "sha256:schema",
          run_id: "run-demo-1",
          artifacts: [
            {
              artifact_id: "metrics",
              report_kind: "metrics",
              file_name: "metrics.json",
              media_type: "application/json",
              bytes: 1,
              sha256: "sha256:artifact",
              schema_identity: "metrics",
              contract_status: "supported",
            },
          ],
          rejected_artifacts: [],
        },
        bridgeConnected: true,
        bridgeChecking: false,
      },
      global: { plugins: [router] },
    });
    expect(wrapper.text()).toContain("已有 run 摘要");
    expect(wrapper.text()).toContain("trace-demo");
    expect(wrapper.find("a").attributes("href")).toContain("/overview?run=run-demo-1");
    wrapper.unmount();
  });

  it("fails closed for schema mismatch and invalid run query", async () => {
    const router = routerFor();
    await router.push("/lightweight/results?run=not-a-run&schema_set_revision=sha256:other");
    await router.isReady();
    const wrapper = mount(LightweightRunSummary, {
      props: {
        bundle,
        runId: null,
        requestedRunId: null,
        artifactManifest: null,
        bridgeConnected: true,
        bridgeChecking: false,
      },
      global: { plugins: [router] },
    });
    expect(wrapper.text()).toContain("run 链接无效");
    wrapper.unmount();
  });

  it("fails closed when the evidence manifest is absent or belongs to another run", async () => {
    const router = routerFor();
    await router.push("/lightweight/results?run=run-demo-1");
    await router.isReady();
    const props = {
      bundle,
      runId: "run-demo-1",
      requestedRunId: "run-demo-1",
      bridgeConnected: true,
      bridgeChecking: false,
    } as const;
    const missingManifest = mount(LightweightRunSummary, {
      props: { ...props, artifactManifest: null },
      global: { plugins: [router] },
    });
    expect(missingManifest.find("[data-state]").attributes("data-state")).toBe("not_covered");
    missingManifest.unmount();

    const mismatchedManifest = mount(LightweightRunSummary, {
      props: {
        ...props,
        artifactManifest: {
          schema_version: "tilesim.bridge.artifact_manifest.v2",
          api_version: "tilesim.bridge.api.v1",
          schema_set_revision: "sha256:schema",
          run_id: "run-other",
          artifacts: [],
          rejected_artifacts: [],
        },
      },
      global: { plugins: [router] },
    });
    expect(mismatchedManifest.find("[data-state]").attributes("data-state")).toBe("stale");
    mismatchedManifest.unmount();
  });

  it("does not promote legacy compatibility artifacts to an available summary", async () => {
    const router = routerFor();
    await router.push("/lightweight/results?run=run-demo-1");
    await router.isReady();
    const wrapper = mount(LightweightRunSummary, {
      props: {
        bundle,
        runId: "run-demo-1",
        requestedRunId: "run-demo-1",
        bridgeConnected: true,
        bridgeChecking: false,
        artifactManifest: {
          schema_version: "tilesim.bridge.artifact_manifest.v2",
          api_version: "tilesim.bridge.api.v1",
          schema_set_revision: "sha256:schema",
          run_id: "run-demo-1",
          artifacts: [
            {
              artifact_id: "metrics",
              report_kind: "metrics",
              file_name: "metrics.json",
              media_type: "application/json",
              bytes: 1,
              sha256: "sha256:legacy",
              schema_identity: "metrics",
              contract_status: "legacy_compatibility",
            },
          ],
          rejected_artifacts: [],
        },
      },
      global: { plugins: [router] },
    });
    expect(wrapper.find("[data-state]").attributes("data-state")).toBe("unsupported");
    expect(wrapper.find(".lightweight-run-summary__facts").exists()).toBe(false);
    wrapper.unmount();
  });

  it.each([
    ["stale", { schema_set_revision: "sha256:other" }, "run-demo-1"],
    ["unsupported", {}, "run-demo-1"],
    ["not_covered", {}, "run-demo-1"],
  ] as const)("exposes the %s boundary without a success summary", async (status, query, runId) => {
    const router = routerFor();
    await router.push({ path: "/lightweight/results", query: { run: runId, ...query } });
    await router.isReady();
    const boundaryBundle =
      status === "unsupported"
        ? ({
            ...bundle,
            compatibility: { run: { status: "unsupported_schema", schema: "x", supported: false, issues: [] } },
          } as ReportBundle)
        : status === "not_covered"
          ? ({ ...bundle, run: null } as ReportBundle)
          : bundle;
    const wrapper = mount(LightweightRunSummary, {
      props: {
        bundle: boundaryBundle,
        runId,
        requestedRunId: runId,
        artifactManifest: {
          schema_version: "tilesim.bridge.artifact_manifest.v2",
          api_version: "tilesim.bridge.api.v1",
          schema_set_revision: "sha256:schema",
          run_id: runId,
          artifacts: [],
          rejected_artifacts: [],
        },
        bridgeConnected: true,
        bridgeChecking: false,
      },
      global: { plugins: [router] },
    });
    expect(wrapper.find(".lightweight-run-summary__state").attributes("data-state")).toBe(status);
    expect(wrapper.find(".lightweight-run-summary__facts").exists()).toBe(false);
    wrapper.unmount();
  });

  it("keeps lightweight route navigation available when a run cannot be restored", () => {
    expect(routeForView("lightweight", null)).toEqual({ name: "lightweight" });
  });
});

describe("workbench entry route contract", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocale("zh-CN");
  });

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
    const result = restoredLegacyRoute({
      query: {
        view: "overview",
        run: "run-demo-1",
        artifact_sha256: "sha256:artifact",
        schema_set_revision: "sha256:schema",
        from: "lightweight",
        unknown: "drop-me",
      },
    } as unknown as RouteLocationNormalized);
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
    const result = restoredLegacyRoute({
      query: {
        view: "overview",
        run: "not-a-run",
        artifact_sha256: "sha256:artifact",
        unknown: "drop-me",
      },
    } as unknown as RouteLocationNormalized);
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

  it("renders the neutral entry copy in English without changing its route contract", async () => {
    setLocale("en-US");
    const router = testRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mount(WorkbenchEntryView, { attachTo: document.body, global: { plugins: [router] } });

    expect(wrapper.find("h1").text()).toBe("Choose the right workbench");
    expect(wrapper.findAll("a.workbench-choice-card__action")[0].text()).toContain("Enter Lightweight");
    expect(wrapper.findAll("a.workbench-choice-card__action")[1].text()).toContain("Enter Professional");
    expect(router.currentRoute.value.name).toBe("workbench_entry");
    wrapper.unmount();
  });

  it("emits only redacted choice telemetry and never includes route query values", async () => {
    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    window.addEventListener(LIGHTWEIGHT_TELEMETRY_EVENT, listener);
    const router = testRouter();
    await router.push("/?run=run-sensitive-1");
    await router.isReady();
    const wrapper = mount(WorkbenchEntryView, { attachTo: document.body, global: { plugins: [router] } });
    await wrapper.findAll("a.workbench-choice-card__action")[0].trigger("click", { button: 0 });
    const detail = events.at(-1)?.detail as Record<string, unknown>;
    expect(detail).toMatchObject({ event: "workbench_selected", mode: "lightweight", source: "root" });
    expect(JSON.stringify(detail)).not.toContain("run-sensitive-1");
    expect(detail).not.toHaveProperty("query");
    emitLightweightTelemetry("workbench_selected", {
      mode: "lightweight",
      source: "root",
      prompt: "credential=must-not-ship",
    } as never);
    const unsafeDetail = events.at(-1)?.detail as Record<string, unknown>;
    expect(JSON.stringify(unsafeDetail)).not.toContain("must-not-ship");
    expect(unsafeDetail).not.toHaveProperty("prompt");
    wrapper.unmount();
    window.removeEventListener(LIGHTWEIGHT_TELEMETRY_EVENT, listener);
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
          redirect: (to) => ({ name: "lightweight", query: preserveWorkbenchQuery(to.query) }),
        },
        {
          path: "/lightweight/tasks",
          name: "lightweight_tasks",
          redirect: (to) => ({ name: "lightweight_prepare", query: preserveWorkbenchQuery(to.query) }),
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
    expect(wrapper.findAll(".lightweight-shell__nav-link")).toHaveLength(3);
    expect(wrapper.find(".lightweight-shell__nav-link.is-active").text()).toContain("新建实验");
    expect(router.currentRoute.value.query).toEqual({
      run: "run-demo-1",
      artifact_sha256: "sha256:artifact",
      schema_set_revision: "sha256:schema",
      from: "lightweight",
    });
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
