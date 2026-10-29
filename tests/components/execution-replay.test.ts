// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ExecutionReplayPanel from "../../src/features/execution-replay/components/ExecutionReplayPanel.vue";
import { executionReplayEnvelopeFixture, executionReplayRuntimeEvents } from "../fixtures/execution-replay";
import type { ReportBundle, RunInputs } from "../../src/contracts/report-model";
import ReplayControls from "../../src/features/execution-replay/components/ReplayControls.vue";
import ReplayTimeline from "../../src/features/execution-replay/components/ReplayTimeline.vue";
import ReplayTopologyCanvas from "../../src/features/execution-replay/components/ReplayTopologyCanvas.vue";
import ReplayCollectivePanel from "../../src/features/execution-replay/components/ReplayCollectivePanel.vue";
import ReplayDetailsPanel from "../../src/features/execution-replay/components/ReplayDetailsPanel.vue";
import { normalizeReplayDocument } from "../../src/features/execution-replay";
import {
  executionReplayFabricRouteFixture,
  executionReplayFabricRouteTopologyFixture,
  executionReplayTopologyFixture,
  executionReplayCollectiveStepsFixture,
} from "../fixtures/execution-replay";
import { DEFAULT_REPLAY_SPEED } from "../../src/features/execution-replay/model/speed";

describe("ReplayControls", () => {
  it("emits playback and stepping controls", async () => {
    const wrapper = mount(ReplayControls, {
      props: {
        isPlaying: false,
        speed: DEFAULT_REPLAY_SPEED,
        canPlay: true,
        canStep: true,
        reducedMotion: false,
        cursorPs: "0",
      },
    });
    await wrapper.get(".replay-controls__play").trigger("click");
    await wrapper.get("button:nth-of-type(3)").trigger("click");
    await wrapper.get("select").setValue("0.00025");
    expect(wrapper.get("select").classes()).toContain("replay-speed__select");
    expect(wrapper.get("select").attributes("aria-label")).toBe("播放速度");
    expect(wrapper.emitted("toggle")).toHaveLength(1);
    expect(wrapper.emitted("next")).toHaveLength(1);
    expect(wrapper.emitted("update:speed")).toEqual([[0.00025]]);
  });

  it("announces reduced-motion mode without adding an animation", () => {
    const wrapper = mount(ReplayControls, {
      props: {
        isPlaying: false,
        speed: DEFAULT_REPLAY_SPEED,
        canPlay: true,
        canStep: true,
        reducedMotion: true,
        cursorPs: "0",
      },
    });
    expect(wrapper.get(".replay-reduced-motion").text()).toContain("减少动态效果");
  });

  it("disables stage stepping when the replay has no stage evidence", () => {
    const wrapper = mount(ReplayControls, {
      props: {
        isPlaying: false,
        speed: DEFAULT_REPLAY_SPEED,
        canPlay: true,
        canStep: true,
        canStepStage: false,
        reducedMotion: false,
        cursorPs: "0",
      },
    });
    expect(wrapper.get('button[title="跳到上一阶段"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('button[title="跳到下一阶段"]').attributes("disabled")).toBeDefined();
  });

  it("does not offer playback when all reported rows lack valid timing", async () => {
    const bundle = {
      run: null,
      metrics: null,
      validation: null,
      tail: null,
      design_space: null,
      execution_envelope: { ...executionReplayEnvelopeFixture, stages: [null] },
      run_bound_des_evidence: null,
      unsupported: {},
      compatibility: {},
    } as unknown as ReportBundle;
    const wrapper = mount(ExecutionReplayPanel, {
      props: {
        runId: "run-execution-replay-fixture",
        bundle,
        inputs: { runtime_trace: null, topology: null } as unknown as RunInputs,
        artifactManifest: null,
        backendIdentity: "fixture-backend",
        schemaSetRevision: "fixture-schema",
        bridgeManifest: null,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".replay-controls__play").attributes("disabled")).toBeDefined();
    expect(wrapper.get(".replay-coverage-status").text()).toContain("0 条已报告证据");
    wrapper.unmount();
  });

  it("keeps the selected slow rate when the parent handles the namespaced update event", async () => {
    const bundle = {
      run: null,
      metrics: null,
      validation: null,
      tail: null,
      design_space: null,
      execution_envelope: executionReplayEnvelopeFixture,
      run_bound_des_evidence: null,
      unsupported: {},
      compatibility: {},
    } as unknown as ReportBundle;
    const wrapper = mount(ExecutionReplayPanel, {
      props: {
        runId: "run-execution-replay-fixture",
        bundle,
        inputs: { runtime_trace: null, topology: null } as unknown as RunInputs,
        artifactManifest: null,
        backendIdentity: "fixture-backend",
        schemaSetRevision: "fixture-schema",
        bridgeManifest: null,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await wrapper.vm.$nextTick();

    const select = wrapper.get("select");
    await select.setValue("0.00005");
    await wrapper.vm.$nextTick();
    expect((select.element as HTMLSelectElement).value).toBe("0.00005");

    // A normal playback command must not restore the default rate.
    await wrapper.get(".replay-controls__play").trigger("click");
    await wrapper.vm.$nextTick();
    expect((wrapper.get("select").element as HTMLSelectElement).value).toBe("0.00005");
    wrapper.unmount();
  });

  it("does not start playback when a disclosure summary receives the Space key", async () => {
    const bundle = {
      run: null,
      metrics: null,
      validation: null,
      tail: null,
      design_space: null,
      execution_envelope: executionReplayEnvelopeFixture,
      run_bound_des_evidence: null,
      unsupported: {},
      compatibility: {},
    } as unknown as ReportBundle;
    const wrapper = mount(ExecutionReplayPanel, {
      props: {
        runId: "run-execution-replay-fixture",
        bundle,
        inputs: { runtime_trace: null, topology: null } as unknown as RunInputs,
        artifactManifest: null,
        backendIdentity: "fixture-backend",
        schemaSetRevision: "fixture-schema",
        bridgeManifest: null,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await wrapper.vm.$nextTick();
    const summary = wrapper.find(".replay-coverage-note summary");
    expect(summary.exists()).toBe(true);
    await summary.trigger("keydown", { key: " " });
    expect(wrapper.get(".replay-controls__play").text()).toContain("播放");
    wrapper.unmount();
  });

  it("advances the cursor with next-step and supports keyboard navigation", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    const bundle = {
      run: null,
      metrics: null,
      validation: null,
      tail: null,
      design_space: null,
      execution_envelope: executionReplayEnvelopeFixture,
      run_bound_des_evidence: null,
      unsupported: {},
      compatibility: {},
    } as unknown as ReportBundle;
    const inputs = {
      runtime_trace: { events: executionReplayRuntimeEvents.events },
      topology: null,
    } as unknown as RunInputs;
    const wrapper = mount(ExecutionReplayPanel, {
      props: {
        runId: "run-execution-replay-fixture",
        bundle,
        inputs,
        artifactManifest: null,
        backendIdentity: "fixture-backend",
        schemaSetRevision: "fixture-schema",
        bridgeManifest: null,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await wrapper.vm.$nextTick();
    const readout = () => wrapper.get(".replay-cursor-readout").text();
    const initial = readout();
    await wrapper.get(".replay-controls").findAll("button")[2].trigger("click");
    expect(readout()).not.toBe(initial);
    const afterClick = readout();
    await wrapper.get(".replay-controls").findAll("button")[2].trigger("keydown", { key: "ArrowRight" });
    expect(readout()).toBe(afterClick);
    await wrapper.trigger("keydown", { key: "ArrowRight" });
    expect(readout()).not.toBe(initial);
    await wrapper.get(".replay-controls__play").trigger("click");
    expect(wrapper.get(".replay-controls__play").text()).toContain("暂停");
    await wrapper.get(".replay-controls__play").trigger("click");
    expect(wrapper.get(".replay-controls__play").text()).toContain("播放");
    expect(cancelAnimationFrame).toHaveBeenCalled();
    wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it("restarts from the beginning when playback is started at the end", async () => {
    let scheduled: ((timestamp: number) => void) | undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
      scheduled = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const bundle = {
      run: null,
      metrics: null,
      validation: null,
      tail: null,
      design_space: null,
      execution_envelope: executionReplayEnvelopeFixture,
      run_bound_des_evidence: null,
      unsupported: {},
      compatibility: {},
    } as unknown as ReportBundle;
    const wrapper = mount(ExecutionReplayPanel, {
      props: {
        runId: "run-execution-replay-fixture",
        bundle,
        inputs: { runtime_trace: null, topology: null } as unknown as RunInputs,
        artifactManifest: null,
        backendIdentity: "fixture-backend",
        schemaSetRevision: "fixture-schema",
        bridgeManifest: null,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await wrapper.vm.$nextTick();
    await wrapper.trigger("keydown", { key: "End" });
    const endReadout = wrapper.get(".replay-cursor-readout").text();
    await wrapper.get(".replay-controls__play").trigger("click");
    await wrapper.vm.$nextTick();
    expect(endReadout).not.toBe(wrapper.get(".replay-cursor-readout").text());
    expect(wrapper.get(".replay-cursor-readout").text()).toContain("9007199254740993000 ps");
    expect(wrapper.get(".replay-controls__play").text()).toContain("暂停");
    expect(scheduled).toBeDefined();
    wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it("accumulates fractional frame time instead of stalling at slow speed", async () => {
    let scheduled: ((timestamp: number) => void) | undefined;
    let frameId = 0;
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
      scheduled = callback;
      frameId += 1;
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    const bundle = {
      run: null,
      metrics: null,
      validation: null,
      tail: null,
      design_space: null,
      execution_envelope: executionReplayEnvelopeFixture,
      run_bound_des_evidence: null,
      unsupported: {},
      compatibility: {},
    } as unknown as ReportBundle;
    const wrapper = mount(ExecutionReplayPanel, {
      props: {
        runId: "run-execution-replay-fixture",
        bundle,
        inputs: { runtime_trace: null, topology: null } as unknown as RunInputs,
        artifactManifest: null,
        backendIdentity: "fixture-backend",
        schemaSetRevision: "fixture-schema",
        bridgeManifest: null,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await wrapper.vm.$nextTick();
    await wrapper.get("select").setValue(String(DEFAULT_REPLAY_SPEED));
    const initial = wrapper.get(".replay-cursor-readout").text();
    await wrapper.get(".replay-controls__play").trigger("click");
    expect(scheduled).toBeDefined();
    // Enough wall-clock frames at 1/2000 speed produce one whole playback
    // millisecond. The cursor must advance even though each frame is
    // sub-millisecond.
    // The cursor must advance even though each individual frame is sub-millisecond.
    for (let timestamp = 1000; timestamp <= 3001; timestamp += 1) scheduled!(timestamp);
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".replay-cursor-readout").text()).not.toBe(initial);
    wrapper.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("ReplayTimeline", () => {
  it("keeps stage evidence links outside the stage activation control", async () => {
    const wrapper = mount(ReplayTimeline, {
      props: {
        document: {
          runId: "run-replay",
          backendIdentity: "backend",
          schemaSetRevision: "schema",
          artifactSha256: "sha",
          startPs: "0",
          endPs: "100",
          hasValidRange: true,
          stages: [
            {
              stageId: "stage-1",
              label: "runtime event window",
              timing: { startPs: "0", endPs: "100" },
              sourcePath: "execution-envelope:/stages/0",
              sourceArtifact: "execution-envelope",
              availability: "available",
            },
          ],
          events: [],
          topology: {
            availability: "missing",
            nodes: [],
            links: [],
            sourcePath: "input-topology:/topology",
            sourceArtifact: "input-topology",
          },
          routes: [],
          fabricEvents: [],
          fabricRouteState: "no_path",
          coverage: {
            status: "available",
            stages: "available",
            runtimeEvents: "missing",
            requestSummaries: "missing",
            phaseFabric: "missing",
            fabricRoutes: "missing",
            topology: "missing",
            collectiveSteps: "missing",
            reasons: [],
          },
          collective: {
            availability: "missing",
            supported: false,
            steps: [],
            sourcePath: "request-attribution:/evidence/collective_steps",
            sourceArtifact: "request-attribution",
            reason: "collective round/chunk 未报告。",
          },
          traceProvenance: { sourceMode: null, calibrationLevel: null, allowedClaimScope: null },
        },
        cursorPs: "0",
        selectedEventId: null,
      },
      global: {
        stubs: {
          ArtifactEvidenceLink: {
            props: ["sourcePath", "label"],
            template: '<a class="artifact-evidence-link" :href="sourcePath">{{ label }}</a>',
          },
        },
      },
    });

    const stage = wrapper.get(".replay-marker--stage");
    expect(stage.element.tagName).toBe("BUTTON");
    expect(stage.attributes("role")).toBeUndefined();
    expect(stage.attributes("aria-pressed")).toBe("false");
    expect(stage.text()).toBe("runtime event window");
    expect(stage.find(".artifact-evidence-link").exists()).toBe(false);
    expect(wrapper.find(".replay-stage-evidence").exists()).toBe(true);
    await stage.trigger("click");
    expect(wrapper.emitted("update:cursor")).toEqual([["0"]]);
  });

  it("keeps large evidence accessible without mounting thousands of timeline controls", async () => {
    const document = {
      ...normalizeReplayDocument({
        runId: "run-execution-replay-fixture",
        runtimeEvents: {
          schema_version: "tilesim.s1_runtime_event_trace.v1",
          run_id: "run-execution-replay-fixture",
          events: Array.from({ length: 2001 }, (_, index) => ({
            event_id: `event-${index}`,
            kind: "arrival",
            event_time_ps: String(index),
          })),
        },
      }),
      startPs: "0",
      endPs: "2000",
      hasValidRange: true,
    };
    const wrapper = mount(ReplayTimeline, {
      props: { document, cursorPs: "0", selectedEventId: null },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    expect(wrapper.findAll(".replay-marker--event")).toHaveLength(0);
    expect(wrapper.find(".replay-timeline__limit").text()).toContain("原始证据未被截断");
    expect(wrapper.get(".replay-large-evidence__count").text()).toContain("2001");
    expect(wrapper.get(".replay-large-evidence__viewport").attributes("aria-label")).toContain("2001");
    expect(wrapper.get(".replay-large-evidence").attributes("open")).toBeUndefined();
    await wrapper.get(".replay-large-evidence__summary").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".replay-large-evidence").attributes("open")).toBeDefined();
  });

  it("does not invent positions when the global time range is unavailable", () => {
    const document = normalizeReplayDocument({
      runId: "run-execution-replay-fixture",
      runtimeEvents: {
        schema_version: "tilesim.s1_runtime_event_trace.v1",
        run_id: "run-execution-replay-fixture",
        events: [{ event_id: "instant-only", kind: "arrival", event_time_ps: "7" }],
      },
    });
    const wrapper = mount(ReplayTimeline, {
      props: { document, cursorPs: "7", selectedEventId: null },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    expect(wrapper.findAll(".replay-marker--event")).toHaveLength(0);
    expect(wrapper.text()).toContain("无法映射到全局时间轴");
    expect(wrapper.find(".replay-untimed").exists()).toBe(true);
  });
});

describe("ReplayTopologyCanvas", () => {
  it("selects a complete backend path and does not highlight partial paths", async () => {
    const document = normalizeReplayDocument({
      runId: "run-execution-replay-fixture",
      topology: executionReplayFabricRouteTopologyFixture,
      fabricRoutes: executionReplayFabricRouteFixture,
    });
    const wrapper = mount(ReplayTopologyCanvas, {
      props: { document, selectedRouteId: null },
      global: {
        stubs: { ArtifactEvidenceLink: { template: "<span />" } },
      },
    });
    expect(wrapper.get("#replay-topology-route-list").attributes("open")).toBeUndefined();
    await wrapper.get(".replay-route-row__select").trigger("click");
    expect(wrapper.emitted("selectRoute")).toEqual([["req-0-0"]]);
    expect(wrapper.get("#replay-topology-route-list > [role='list']").element.tagName).toBe("DIV");
    expect(wrapper.get("#replay-topology-route-list > [role='list'] > [role='listitem']")).toBeDefined();
    expect(wrapper.get(".replay-route-row__select").attributes("aria-label")).toContain("路径已报告");
    await wrapper.setProps({ selectedRouteId: "req-0-0" });
    expect(wrapper.get("#replay-topology-route-list").attributes("open")).toBeDefined();
    expect(wrapper.get(".replay-route-row__select").attributes("aria-pressed")).toBe("true");
    expect(wrapper.findAll(".replay-topology__nodes g.is-highlighted")).toHaveLength(3);
    expect(wrapper.findAll(".replay-topology__links line.is-highlighted")).toHaveLength(2);
    expect(wrapper.get(".replay-topology__svg").attributes("focusable")).toBe("false");
    expect(wrapper.get(".replay-topology__svg").attributes("aria-describedby")).toBe("replay-topology-description");
    await wrapper.setProps({
      document: { ...document, topology: { ...document.topology, availability: "partial" } },
    });
    expect(wrapper.find(".replay-topology__availability").text()).toContain("部分报告");
    const directedDocument = {
      ...document,
      topology: {
        ...document.topology,
        links: document.topology.links.map((link) => ({ ...link, id: `${link.id}::forward` })),
      },
      routes: document.routes.map((route) => ({
        ...route,
        linkIds: route.linkIds.map((linkId) => `${linkId}::forward`),
      })),
    };
    await wrapper.setProps({ document: directedDocument });
    expect(wrapper.findAll(".replay-topology__links line.is-highlighted")).toHaveLength(2);
  });

  it("follows the simulation cursor over reported route intervals", async () => {
    const document = normalizeReplayDocument({
      runId: "run-execution-replay-fixture",
      topology: executionReplayFabricRouteTopologyFixture,
      fabricRoutes: executionReplayFabricRouteFixture,
    });
    const wrapper = mount(ReplayTopologyCanvas, {
      props: { document, selectedRouteId: null, cursorPs: "9007199254740994000" },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    expect(wrapper.findAll(".replay-topology__nodes g.is-active")).toHaveLength(3);
    expect(wrapper.findAll(".replay-topology__links line.is-active")).toHaveLength(2);
    await wrapper.setProps({ cursorPs: "9007199254740998000" });
    expect(wrapper.findAll(".replay-topology__nodes g.is-active")).toHaveLength(0);
    expect(wrapper.findAll(".replay-topology__links line.is-active")).toHaveLength(0);
  });

  it("highlights the backend route joined by a selected collective phase", () => {
    const baseDocument = normalizeReplayDocument({
      runId: "run-execution-replay-fixture",
      topology: executionReplayFabricRouteTopologyFixture,
      fabricRoutes: executionReplayFabricRouteFixture,
    });
    const document = {
      ...baseDocument,
      collective: {
        availability: "available" as const,
        supported: true,
        sourcePath: "execution-replay:/collective_steps",
        sourceArtifact: "execution-replay",
        reason: "",
        steps: [
          {
            stepId: "collective-step-0",
            collectiveId: "collective-0",
            phaseId: "phase-0",
            round: "0",
            chunk: "0",
            timing: { startPs: "0", endPs: "100" },
            sourceDevice: "gpu-0",
            destinationDevice: "gpu-1",
            bytes: "1",
            dependencies: [],
            sourcePath: "execution-replay:/collective_steps/0",
            sourceArtifact: "execution-replay",
            availability: "available" as const,
          },
        ],
      },
    };
    const wrapper = mount(ReplayTopologyCanvas, {
      props: { document, selectedRouteId: null, selectedCollectiveStepId: "collective-step-0" },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    expect(wrapper.findAll(".replay-topology__nodes g.is-highlighted")).toHaveLength(3);
    expect(wrapper.findAll(".replay-topology__links line.is-highlighted")).toHaveLength(2);
  });

  it("shows the reported flow payload and only renders a token for verified route links", () => {
    const baseDocument = normalizeReplayDocument({
      runId: "run-execution-replay-fixture",
      topology: executionReplayFabricRouteTopologyFixture,
      fabricRoutes: executionReplayFabricRouteFixture,
    });
    const routeTiming = baseDocument.routes[0].timing!;
    const document = {
      ...baseDocument,
      collective: {
        availability: "available" as const,
        supported: true,
        sourcePath: "execution-replay:/collective_steps",
        sourceArtifact: "execution-replay",
        reason: "",
        steps: [
          {
            stepId: "collective-step-flow",
            collectiveId: "allgather-0",
            phaseId: "phase-0",
            round: "2",
            chunk: "3",
            timing: routeTiming,
            sourceDevice: "gpu-0",
            destinationDevice: "gpu-1",
            bytes: "4096",
            dependencies: [],
            sourcePath: "execution-replay:/collective_steps/0",
            sourceArtifact: "execution-replay",
            availability: "available" as const,
          },
        ],
      },
    };
    const cursor = String((BigInt(routeTiming.startPs) + BigInt(routeTiming.endPs)) / 2n);
    const wrapper = mount(ReplayTopologyCanvas, {
      props: { document, selectedRouteId: null, selectedCollectiveStepId: "collective-step-flow", cursorPs: cursor },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    expect(wrapper.get(".replay-flow-readout").text()).toContain("4096 bytes");
    expect(wrapper.get(".replay-flow-readout").text()).toContain("gpu-0 → gpu-1");
    expect(wrapper.find(".replay-topology__flow-token").exists()).toBe(true);

    const noLinksDocument = {
      ...document,
      topology: { ...document.topology, links: [] },
    };
    return wrapper.setProps({ document: noLinksDocument }).then(() => {
      expect(wrapper.find(".replay-flow-readout").text()).toContain("4096 bytes");
      expect(wrapper.find(".replay-topology__flow-token").exists()).toBe(false);
    });
  });

  it("keeps dense topology nodes inside a dynamic canvas and skips orphan links", () => {
    const document = normalizeReplayDocument({
      runId: "run-execution-replay-fixture",
      topology: executionReplayFabricRouteTopologyFixture,
      fabricRoutes: executionReplayFabricRouteFixture,
    });
    const nodes = Array.from({ length: 16 }, (_, index) => ({
      id: `device-${index}`,
      label: `very-long-device-name-${index}`,
      deviceType: "gpu",
      sourcePath: `input-topology:/topology/devices/${index}`,
    }));
    const wrapper = mount(ReplayTopologyCanvas, {
      props: {
        document: {
          ...document,
          topology: {
            ...document.topology,
            nodes,
            links: [
              { id: "valid", source: "device-0", destination: "device-1", sourcePath: "topology:/links/0" },
              { id: "orphan", source: "missing", destination: "device-1", sourcePath: "topology:/links/1" },
            ],
          },
        },
        selectedRouteId: null,
      },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    const viewBox = wrapper.get(".replay-topology__svg").attributes("viewBox")!.split(" ").map(Number);
    expect(viewBox[3]).toBeGreaterThan(300);
    expect(wrapper.findAll(".replay-topology__links line")).toHaveLength(1);
    expect(wrapper.get(".replay-topology__nodes text").text()).toContain("very-long-device-…");
  });
});

describe("ExecutionReplayPanel layout", () => {
  it("keeps the topology observation rail beside the timeline and collective list below it", async () => {
    const wrapper = mount(ExecutionReplayPanel, {
      props: {
        runId: "run-execution-replay-fixture",
        bundle: {
          run: null,
          metrics: null,
          validation: null,
          tail: null,
          design_space: null,
          execution_envelope: executionReplayEnvelopeFixture,
          run_bound_des_evidence: null,
          unsupported: {},
          compatibility: {},
        } as unknown as ReportBundle,
        inputs: { runtime_trace: null, topology: executionReplayTopologyFixture } as unknown as RunInputs,
        artifactManifest: null,
        backendIdentity: "fixture-backend",
        schemaSetRevision: "fixture-schema",
        bridgeManifest: null,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".replay-main-grid > .replay-side-column").exists()).toBe(true);
    expect(wrapper.get(".replay-main-grid > .replay-side-column").attributes("aria-label")).toBe("执行回放观察视图");
    expect(wrapper.find(".replay-main-grid .replay-topology").exists()).toBe(true);
    expect(wrapper.find(".replay-main-grid .replay-details").exists()).toBe(true);
    expect(wrapper.find(".replay-evidence-grid .replay-collective").exists()).toBe(true);
    wrapper.unmount();
  });
});

describe("ReplayTimeline Fabric events", () => {
  it("selects a reported Fabric event independently from the route", async () => {
    const document = normalizeReplayDocument({
      runId: "run-execution-replay-fixture",
      topology: executionReplayFabricRouteTopologyFixture,
      fabricRoutes: executionReplayFabricRouteFixture,
    });
    const wrapper = mount(ReplayTimeline, {
      props: {
        document,
        cursorPs: "0",
        selectedRouteId: "req-0-0",
        selectedEventId: null,
        selectedFabricEventId: null,
      },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    await wrapper.get(".replay-marker--fabric-event").trigger("click");
    expect(wrapper.emitted("selectFabricEvent")).toEqual([["req-0-0-event-0"]]);
    expect(wrapper.emitted("selectRoute")).toBeUndefined();
  });
});

describe("ReplayCollectivePanel", () => {
  it("keeps no dependencies distinct from unreported dependencies", async () => {
    const wrapper = mount(ReplayCollectivePanel, {
      props: {
        collective: {
          availability: "available",
          supported: true,
          sourcePath: "execution-replay:/collective_steps",
          sourceArtifact: "execution-replay",
          reason: "",
          steps: [
            {
              stepId: "step-0",
              collectiveId: "collective-0",
              phaseId: "phase-0",
              round: "0",
              chunk: "0",
              timing: { startPs: "0", endPs: "1" },
              sourceDevice: "gpu-0",
              destinationDevice: "gpu-1",
              bytes: "0",
              dependencies: [],
              sourcePath: "execution-replay:/collective_steps/0",
              sourceArtifact: "execution-replay",
              availability: "available",
            },
            {
              stepId: "step-1",
              collectiveId: "collective-0",
              phaseId: "phase-0",
              round: "0",
              chunk: "1",
              timing: { startPs: "1", endPs: "2" },
              sourceDevice: "gpu-0",
              destinationDevice: "gpu-1",
              bytes: "1",
              dependencies: null,
              sourcePath: "execution-replay:/collective_steps/1",
              sourceArtifact: "execution-replay",
              availability: "available",
            },
          ],
        },
        selectedStepId: null,
      },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    expect(wrapper.get(".replay-collective").attributes("open")).toBeUndefined();
    await wrapper.get(".replay-collective__summary").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("无依赖");
    expect(wrapper.text()).toContain("未报告");
    const stepButton = wrapper.get(".replay-collective__step");
    expect(stepButton.attributes("aria-pressed")).toBe("false");
    expect(wrapper.get("tbody tr").attributes("aria-selected")).toBe("false");
    expect(wrapper.get("tbody td").attributes("aria-label")).toBe("集合 / 阶段：collective-0 phase-0");
  });

  it("does not present a verified empty collective artifact as missing evidence", () => {
    const wrapper = mount(ReplayCollectivePanel, {
      props: {
        collective: {
          availability: "available",
          supported: true,
          sourcePath: "execution-replay:/collective_steps",
          sourceArtifact: "execution-replay",
          reason: "后端已报告 canonical collective step。",
          steps: [],
        },
        selectedStepId: null,
      },
    });
    expect(wrapper.get("h3").text()).toBe("集合步骤（无记录）");
    expect(wrapper.text()).toContain("已验证 · 无步骤");
    expect(wrapper.text()).toContain("后端已验证当前运行没有集合步骤。");
    expect(wrapper.text()).not.toContain("未报告 / 不支持");
  });

  it("keeps expected absence and not-covered collective states distinct", () => {
    const expectedAbsence = mount(ReplayCollectivePanel, {
      props: {
        collective: {
          availability: "expected_absence",
          supported: false,
          sourcePath: "execution-replay:/collective_steps",
          sourceArtifact: "execution-replay",
          reason: "后端明确声明当前运行没有 collective step artifact。",
          steps: [],
        },
        selectedStepId: null,
      },
    });
    expect(expectedAbsence.get(".replay-collective__availability").text()).toBe("预期缺省");
    expect(expectedAbsence.get(".replay-collective__empty").text()).toBe(
      "后端明确声明当前运行没有 collective step artifact。",
    );

    const notCovered = mount(ReplayCollectivePanel, {
      props: {
        collective: {
          availability: "not_covered",
          supported: false,
          sourcePath: "execution-replay:/collective_steps",
          sourceArtifact: "execution-replay",
          reason: "当前后端未发布 canonical collective artifact。",
          steps: [],
        },
        selectedStepId: null,
      },
    });
    expect(notCovered.get(".replay-collective__availability").text()).toBe("未覆盖");
    expect(notCovered.get(".replay-collective__empty").text()).toBe("当前后端未发布 canonical collective artifact。");
  });
});

describe("ReplayDetailsPanel provenance", () => {
  it("uses the selected source artifact SHA instead of runtime-events SHA", () => {
    const document = normalizeReplayDocument({
      runId: "run-execution-replay-fixture",
      topology: executionReplayFabricRouteTopologyFixture,
      fabricRoutes: executionReplayFabricRouteFixture,
    });
    const wrapper = mount(ReplayDetailsPanel, {
      props: {
        document,
        cursorPs: "0",
        selectedEventId: null,
        selectedRouteId: "req-0-0",
        artifactShaById: { "runtime-events": "a".repeat(64), "request-attribution": "b".repeat(64) },
      },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    expect(wrapper.text()).toContain("b".repeat(64));
    expect(wrapper.text()).not.toContain("a".repeat(64));
    const stageDocument = normalizeReplayDocument({
      runId: "run-execution-replay-fixture",
      envelope: executionReplayEnvelopeFixture,
    });
    const stageWrapper = mount(ReplayDetailsPanel, {
      props: {
        document: stageDocument,
        cursorPs: "0",
        selectedEventId: null,
        selectedStageId: "runtime",
        artifactShaById: { "execution-envelope": "c".repeat(64), "runtime-events": "a".repeat(64) },
      },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    expect(stageWrapper.text()).toContain("c".repeat(64));
    expect(stageWrapper.text()).not.toContain("a".repeat(64));
    const stageDetails = stageWrapper.findAll("dt");
    expect(stageDetails.find((entry) => entry.text() === "阶段")?.element.nextElementSibling?.textContent).toBe(
      "运行时调度",
    );
    expect(
      stageDetails.find((entry) => entry.text() === "技术阶段标识")?.element.nextElementSibling?.textContent,
    ).toContain("runtime");
    expect(stageWrapper.get("summary").text()).toBe("查看阶段证据");
    expect(stageWrapper.get("details").attributes("open")).toBeUndefined();

    const fabricWrapper = mount(ReplayDetailsPanel, {
      props: {
        document,
        cursorPs: "0",
        selectedEventId: null,
        selectedFabricEventId: "req-0-0-event-0",
        artifactShaById: { "request-attribution": "b".repeat(64) },
      },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    expect(fabricWrapper.get("summary").text()).toBe("查看事件证据");
    expect(fabricWrapper.get("details").attributes("open")).toBeUndefined();

    const collectiveDocument = normalizeReplayDocument({
      runId: "run-execution-replay-fixture",
      collectiveSteps: {
        value: executionReplayCollectiveStepsFixture,
        artifactId: "execution-replay",
        sha256: "c".repeat(64),
        schemaIdentity: "tilesim.execution_replay.v1",
        availability: "available",
      },
    });
    const collectiveWrapper = mount(ReplayDetailsPanel, {
      props: {
        document: collectiveDocument,
        cursorPs: "0",
        selectedEventId: null,
        selectedCollectiveStepId: "collective-step-0",
        artifactShaById: { "execution-replay": "c".repeat(64) },
      },
      global: { stubs: { ArtifactEvidenceLink: { template: "<span />" } } },
    });
    expect(collectiveWrapper.get("summary").text()).toBe("查看步骤证据");
    expect(collectiveWrapper.get("details").attributes("open")).toBeUndefined();
  });
});
