import { describe, expect, it } from "vitest";
import {
  normalizeReplayDocument,
  normalizeRuntimeEvents,
  normalizeFabricRoutes,
  normalizeTopologyInput,
  executionReplayQueryKey,
  sortReplayEvents,
  validateReplayBinding,
  nextPlaybackTime,
  nextStageTime,
  playbackTimes,
  intervalProgress,
} from "../../src/features/execution-replay";
import { eventState, stageState } from "../../src/features/execution-replay";
import { parseArtifactPointerSource } from "../../src/features/inspect-artifact";
import {
  executionReplayEnvelopeFixture,
  executionReplayExpectedAbsenceManifest,
  executionReplayFixtureRunId,
  executionReplayNotCoveredFixture,
  executionReplayRunMismatchFixture,
  executionReplayRuntimeEvents,
  executionReplayFabricRouteFixture,
  executionReplayFabricRouteTopologyFixture,
  executionReplayTopologyFixture,
  executionReplayFabricRouteEmptyLinksTopologyFixture,
  executionReplayCollectiveStepsFixture,
  executionReplayCollectiveStepMissingFieldFixture,
} from "../fixtures/execution-replay";

describe("execution replay model", () => {
  it("normalizes playback boundaries and does not wrap at either edge", () => {
    expect(nextPlaybackTime("10", ["30", "10", "20", "20", "invalid", "-1"], 1)).toBe("20");
    expect(nextPlaybackTime("10", ["30", "10", "20"], -1)).toBe("10");
    expect(nextPlaybackTime("30", ["30", "10", "20"], 1)).toBe("30");
    expect(nextPlaybackTime("not-a-time", ["10", "20"], 1)).toBe("not-a-time");
  });

  it("keeps stage boundaries lossless and sorted for single-step playback", () => {
    const stages = [
      {
        stageId: "b",
        label: "b",
        timing: { startPs: "30", endPs: "40" },
        sourcePath: "execution-envelope:/stages/1",
        sourceArtifact: "execution-envelope",
        availability: "available" as const,
      },
      {
        stageId: "a",
        label: "a",
        timing: { startPs: "10", endPs: "20" },
        sourcePath: "execution-envelope:/stages/0",
        sourceArtifact: "execution-envelope",
        availability: "available" as const,
      },
    ];
    expect(nextStageTime("20", stages, 1)).toBe("30");
    expect(nextStageTime("30", stages, -1)).toBe("20");
    expect(playbackTimes([], stages)).toEqual(["10", "20", "30", "40"]);
  });

  it("keeps topology flow progress accurate for 64-bit simulation times", () => {
    const start = 9_007_199_254_740_993_000n;
    const span = 1_000_000_000_000_000_000n;
    expect(
      intervalProgress(String(start + 300_000_000_000_000_000n), {
        startPs: String(start),
        endPs: String(start + span),
      }),
    ).toBeCloseTo(0.3, 6);
  });

  it("keeps lossless ps strings and stable order for equal timestamps", () => {
    const normalized = normalizeRuntimeEvents(executionReplayRuntimeEvents, executionReplayFixtureRunId);
    expect(normalized.availability).toBe("available");
    expect(normalized.events[0].timing).toEqual({ type: "instant", atPs: "9007199254740993123" });
    expect(parseArtifactPointerSource(normalized.events[0].sourcePath)).toEqual({
      artifactId: "runtime-events",
      pointer: "/events/0",
    });
    expect(parseArtifactPointerSource("execution-replay:/collective_steps/0")).toEqual({
      artifactId: "execution-replay",
      pointer: "/collective_steps/0",
    });
    expect(normalized.events.slice(0, 2).map((event) => event.kind)).toEqual(["arrival", "admit"]);
    expect(sortReplayEvents(normalized.events).map((event) => event.sourceIndex)).toEqual(
      normalized.events.map((event) => event.sourceIndex),
    );
  });

  it("does not expose unknown runtime function names as user-facing event labels", () => {
    const normalized = normalizeRuntimeEvents(
      {
        schema_version: "tilesim.s1_runtime_event_trace.v1",
        run_id: executionReplayFixtureRunId,
        events: [{ kind: "backend_internal_scheduler_step", event_time_ps: "10" }],
      },
      executionReplayFixtureRunId,
    );
    expect(normalized.events[0].label).toBe("运行期事件");
    expect(normalized.events[0].kind).toBe("backend_internal_scheduler_step");
  });

  it("binds replay queries to run, backend, schema revision, and artifact identity", () => {
    expect(
      executionReplayQueryKey({
        runId: "run-1",
        backendRevision: "backend-1",
        schemaSetRevision: "schema-1",
        artifactSha256: "request-attribution:sha|input-topology:sha",
      }),
    ).toEqual(["execution-replay", "run-1", "backend-1", "schema-1", "request-attribution:sha|input-topology:sha"]);
  });

  it("distinguishes point and interval boundaries without inventing duration", () => {
    const document = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      envelope: executionReplayEnvelopeFixture,
      runtimeEvents: executionReplayRuntimeEvents,
    });
    expect(document.stages[0].timing).toEqual({ startPs: "9007199254740993000", endPs: "9007199254740997000" });
    expect(document.events[0].timing.type).toBe("instant");
    expect(eventState(document.events[0], "9007199254740993123")).toBe("completed");
    expect(stageState(document.stages[0], "9007199254740994000")).toBe("active");
  });

  it("keeps Fabric-only interval evidence playable", () => {
    const document = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      fabricRoutes: {
        value: {
          schema_version: "tilesim.request_attribution.v1",
          run_id: executionReplayFixtureRunId,
          evidence: {
            fabric: {
              timeline: [{ route_id: "fabric-only", start_time_ps: "10", finish_time_ps: "20", execution_events: [] }],
            },
          },
        },
        artifactId: "request-attribution",
        sha256: "a".repeat(64),
        schemaIdentity: "tilesim.request_attribution.v1",
        availability: "available",
      },
    });
    expect(document.hasValidRange).toBe(true);
    expect(document.startPs).toBe("10");
    expect(document.endPs).toBe("20");
  });

  it("retains both boundaries for runtime interval evidence", () => {
    const document = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      runtimeEvents: {
        schema_version: "tilesim.s1_runtime_event_trace.v1",
        run_id: executionReplayFixtureRunId,
        events: [{ kind: "service_start", start_time_ps: "10", finish_time_ps: "20" }],
      },
    });
    expect(document.hasValidRange).toBe(true);
    expect(document.startPs).toBe("10");
    expect(document.endPs).toBe("20");
  });

  it("keeps trace provenance explicit without upgrading synthetic claims", () => {
    const document = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      envelope: {
        ...executionReplayEnvelopeFixture,
        trace_provenance: {
          source_mode: "synthetic_trace",
          calibration_level: "uncalibrated",
          allowed_claim_scope: "exploratory",
        },
      },
    });
    expect(document.traceProvenance).toEqual({
      sourceMode: "synthetic_trace",
      calibrationLevel: "uncalibrated",
      allowedClaimScope: "exploratory",
    });
    expect(
      normalizeReplayDocument({ runId: executionReplayFixtureRunId, envelope: executionReplayEnvelopeFixture })
        .traceProvenance,
    ).toEqual({ sourceMode: null, calibrationLevel: null, allowedClaimScope: null });
  });

  it("fails closed for unverified collective shapes and preserves canonical zero fields", () => {
    const unverified = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      fabricRoutes: {
        value: executionReplayCollectiveStepsFixture,
        artifactId: "request-attribution",
        sha256: "x",
        availability: "available",
      },
    });
    expect(unverified.collective.availability).toBe("missing");
    expect(unverified.collective.steps).toHaveLength(0);
    const canonical = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      collectiveSteps: {
        value: executionReplayCollectiveStepsFixture,
        artifactId: "execution-replay",
        sha256: "x",
        schemaIdentity: "tilesim.execution_replay.v1",
        availability: "available",
      },
    });
    expect(canonical.collective.steps[0]).toMatchObject({ round: "0", chunk: "0", bytes: "0" });
    expect(canonical.startPs).toBe("0");
    const incomplete = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      collectiveSteps: {
        value: executionReplayCollectiveStepMissingFieldFixture,
        artifactId: "execution-replay",
        sha256: "x",
        schemaIdentity: "tilesim.execution_replay.v1",
        availability: "available",
      },
    });
    expect(incomplete.collective.availability).toBe("unsupported_schema");
    expect(incomplete.collective.steps).toHaveLength(0);
  });

  it("keeps real zero and missing fields distinct", () => {
    const normalized = normalizeRuntimeEvents(
      {
        value: {
          schema_version: "tilesim.s1_runtime_event_trace.v1",
          run_id: executionReplayFixtureRunId,
          events: [{ kind: "kv_grow", event_time_ps: "0", bytes: "0" }],
        },
        artifactId: "runtime-events",
        sha256: "a".repeat(64),
        availability: "available",
      },
      executionReplayFixtureRunId,
    );
    expect(normalized.events[0].timing).toEqual({ type: "instant", atPs: "0" });
    expect(normalized.events[0].detail).toBeUndefined();
    const missing = normalizeRuntimeEvents(null, executionReplayFixtureRunId);
    expect(missing.availability).toBe("missing");
    expect(normalizeRuntimeEvents(executionReplayRunMismatchFixture, executionReplayFixtureRunId).availability).toBe(
      "unsupported_schema",
    );
    expect(
      normalizeRuntimeEvents({ events: [{ kind: "arrival", event_time_ps: "1" }] }, executionReplayFixtureRunId)
        .availability,
    ).toBe("unsupported_schema");
    const malformed = normalizeRuntimeEvents(
      {
        schema_version: "tilesim.s1_runtime_event_trace.v1",
        run_id: executionReplayFixtureRunId,
        events: [{ kind: "arrival", event_time_ps: "-1" }],
      },
      executionReplayFixtureRunId,
    );
    expect(malformed.events).toHaveLength(0);
    expect(malformed.availability).toBe("unsupported_schema");
    const duplicate = normalizeRuntimeEvents(
      {
        schema_version: "tilesim.s1_runtime_event_trace.v1",
        run_id: executionReplayFixtureRunId,
        events: [
          { event_id: "same", kind: "arrival", event_time_ps: "1" },
          { event_id: "same", kind: "complete", event_time_ps: "2" },
        ],
      },
      executionReplayFixtureRunId,
    );
    expect(duplicate.availability).toBe("partial");
    expect(new Set(duplicate.events.map((event) => event.eventId)).size).toBe(2);
  });

  it("marks explicit sequence gaps and non-monotonic source time as partial", () => {
    const normalized = normalizeRuntimeEvents(
      {
        schema_version: "tilesim.s1_runtime_event_trace.v1",
        run_id: executionReplayFixtureRunId,
        events: [
          { kind: "arrival", sequence: "0", event_time_ps: "20" },
          { kind: "admit", sequence: "2", event_time_ps: "10" },
        ],
      },
      executionReplayFixtureRunId,
    );
    expect(normalized.availability).toBe("partial");
    expect(normalized.events.map((event) => event.sequence)).toEqual(["0", "2"]);
    const document = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      runtimeEvents: {
        schema_version: "tilesim.s1_runtime_event_trace.v1",
        run_id: executionReplayFixtureRunId,
        events: [
          { kind: "arrival", event_time_ps: "20" },
          { kind: "admit", event_time_ps: "10" },
        ],
      },
    });
    expect(document.coverage.reasons.some((reason) => reason.includes("非单调"))).toBe(true);
  });

  it("normalizes directional reverse link ids without losing the reported path", () => {
    const normalized = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.request_attribution.v1",
          run_id: executionReplayFixtureRunId,
          evidence: {
            fabric: {
              timeline: [
                {
                  route_id: "reverse-route",
                  actual_path: ["gpu-0", "switch-0", "gpu-1"],
                  link_endpoints: {
                    "link-0::reverse": { source: "switch-0", destination: "gpu-0" },
                    "link-1::reverse": { source: "gpu-1", destination: "switch-0" },
                  },
                },
              ],
            },
          },
        },
        artifactId: "request-attribution",
        sha256: "a".repeat(64),
        schemaIdentity: "tilesim.request_attribution.v1",
        availability: "available",
      },
      executionReplayFixtureRunId,
      normalizeTopologyInput(executionReplayFabricRouteTopologyFixture, executionReplayFixtureRunId),
    );
    expect(normalized.routes[0]).toMatchObject({ state: "available", linkIds: ["link-0::reverse", "link-1::reverse"] });
  });

  it("preserves expected absence and rejects run or sha binding mismatches", () => {
    const expected = normalizeRuntimeEvents(
      { value: null, artifactId: "runtime-events", sha256: "d".repeat(64), availability: "expected_absence" },
      executionReplayFixtureRunId,
    );
    expect(expected.availability).toBe("expected_absence");
    expect(executionReplayExpectedAbsenceManifest.artifacts[0].content_status).toBe("expected_absence");
    expect(validateReplayBinding({ runId: executionReplayFixtureRunId, payload: { run_id: "other-run" } })).toEqual({
      ok: false,
      reason: "run_mismatch",
    });
    expect(
      validateReplayBinding({ runId: executionReplayFixtureRunId, expectedSha256: "a", artifact: { sha256: "b" } }),
    ).toEqual({ ok: false, reason: "sha_mismatch" });
    expect(validateReplayBinding({ runId: executionReplayFixtureRunId, expectedSha256: "a" })).toEqual({
      ok: false,
      reason: "sha_mismatch",
    });
    expect(
      validateReplayBinding({
        runId: executionReplayFixtureRunId,
        artifact: { artifact_id: "runtime-events", run_id: executionReplayFixtureRunId, sha256: "a" },
      }),
    ).toEqual({ ok: true });
    expect(
      validateReplayBinding({
        runId: executionReplayFixtureRunId,
        artifact: { run_id: executionReplayFixtureRunId, sha256: "a" },
      }),
    ).toEqual({ ok: false, reason: "artifact_mismatch" });
  });

  it("rejects schema drift and clears envelope stages on run mismatch", () => {
    expect(
      normalizeFabricRoutes(
        {
          value: { schema_version: "wrong.schema.v1", run_id: executionReplayFixtureRunId },
          artifactId: "x",
          sha256: "x",
          availability: "available",
        },
        executionReplayFixtureRunId,
      ).availability,
    ).toBe("unsupported_schema");
    const mismatched = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      envelope: { ...executionReplayEnvelopeFixture, run_id: "other-run" },
    });
    expect(mismatched.stages).toHaveLength(0);
    expect(mismatched.startPs).toBeNull();
    const wrongSchema = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      envelope: { ...executionReplayEnvelopeFixture, schema_version: "wrong.v1" },
    });
    expect(wrongSchema.stages).toHaveLength(0);
    expect(wrongSchema.startPs).toBeNull();
    expect(wrongSchema.coverage.status).toBe("unsupported_schema");
    expect(
      normalizeRuntimeEvents(
        { schema_version: "tilesim.s1_runtime_event_trace.v1", run_id: executionReplayFixtureRunId },
        executionReplayFixtureRunId,
      ).availability,
    ).toBe("unsupported_schema");
    expect(
      normalizeTopologyInput(
        { schema_version: "tilesim.s6_topology_input.v1", run_id: executionReplayFixtureRunId, topology: {} },
        executionReplayFixtureRunId,
      ).availability,
    ).toBe("unsupported_schema");
    const invalidLinkTopology = normalizeTopologyInput(
      {
        ...executionReplayFabricRouteTopologyFixture,
        topology: {
          ...executionReplayFabricRouteTopologyFixture.topology,
          links: [
            ...executionReplayFabricRouteTopologyFixture.topology.links,
            { link_id: "bad", src_device: "missing", dst_device: "gpu-0" },
          ],
        },
      },
      executionReplayFixtureRunId,
    );
    expect(invalidLinkTopology.availability).toBe("partial");
    expect(invalidLinkTopology.links.some((link) => link.id === "bad")).toBe(false);
    expect(
      normalizeFabricRoutes(executionReplayFabricRouteFixture, executionReplayFixtureRunId, invalidLinkTopology).state,
    ).toBe("partial");
    expect(
      normalizeTopologyInput(
        { ...executionReplayTopologyFixture, topology: { ...executionReplayTopologyFixture.topology, devices: [] } },
        executionReplayFixtureRunId,
      ).availability,
    ).toBe("partial");
    expect(
      normalizeTopologyInput(
        {
          ...executionReplayFabricRouteTopologyFixture,
          topology: {
            ...executionReplayFabricRouteTopologyFixture.topology,
            devices: [...executionReplayFabricRouteTopologyFixture.topology.devices, { device_id: "gpu-0" }],
          },
        },
        executionReplayFixtureRunId,
      ).availability,
    ).toBe("partial");
  });

  it("reports partial coverage when only an envelope is available", () => {
    const document = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      envelope: executionReplayEnvelopeFixture,
    });
    expect(document.coverage.status).toBe("partial");
    expect(document.coverage.runtimeEvents).toBe("missing");
    const notCovered = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      envelope: executionReplayEnvelopeFixture,
      metrics: executionReplayNotCoveredFixture,
    });
    expect(notCovered.coverage.phaseFabric).toBe("not_covered");
    const notCoveredOnly = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      metrics: executionReplayNotCoveredFixture,
    });
    expect(notCoveredOnly.coverage.status).toBe("not_covered");
  });

  it("keeps reported stages visible when runtime events are expected absent", () => {
    const document = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      envelope: executionReplayEnvelopeFixture,
      runtimeEvents: {
        value: null,
        artifactId: "runtime-events",
        sha256: "d".repeat(64),
        availability: "expected_absence",
      },
    });
    expect(document.stages.length).toBeGreaterThan(0);
    expect(document.coverage.runtimeEvents).toBe("expected_absence");
    expect(document.coverage.status).toBe("partial");
  });

  it("replays only complete backend-reported paths and keeps Fabric event time lossless", () => {
    const topology = normalizeTopologyInput(executionReplayFabricRouteTopologyFixture, executionReplayFixtureRunId);
    const normalized = normalizeFabricRoutes(executionReplayFabricRouteFixture, executionReplayFixtureRunId, topology);
    expect(normalized.availability).toBe("available");
    expect(normalized.state).toBe("available");
    expect(normalized.routes[0]).toMatchObject({
      actualPath: ["gpu-0", "switch-0", "gpu-1"],
      linkIds: ["link-0", "link-1"],
      timing: { startPs: "9007199254740993000", endPs: "9007199254740997000" },
    });
    expect(normalized.events[0].timing).toEqual({ type: "instant", atPs: "9007199254740993100" });
  });

  it("treats verified fine-grained replay as complete without legacy phase aggregates", () => {
    const document = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      envelope: executionReplayEnvelopeFixture,
      runtimeEvents: executionReplayRuntimeEvents,
      runtimeRequests: {
        value: { schema_version: "tilesim.s1_runtime_request_summaries.v1", run_id: executionReplayFixtureRunId },
        artifactId: "runtime-requests",
        sha256: "r".repeat(64),
        schemaIdentity: "tilesim.s1_runtime_request_summaries.v1",
        availability: "available",
      },
      topology: executionReplayFabricRouteTopologyFixture,
      fabricRoutes: {
        value: {
          schema_version: "tilesim.execution_replay.v1",
          run_id: executionReplayFixtureRunId,
          fabric: { timeline: executionReplayFabricRouteFixture.evidence.fabric.timeline },
          collective_steps: [
            {
              step_id: "step-0",
              collective_id: "collective-0",
              phase_id: "phase-0",
              round: 0,
              chunk: 0,
              start_time_ps: 10,
              end_time_ps: 20,
              source_device: "gpu-0",
              destination_device: "gpu-1",
              bytes: 1,
              dependencies: [],
            },
          ],
        },
        artifactId: "execution-replay",
        sha256: "f".repeat(64),
        schemaIdentity: "tilesim.execution_replay.v1",
        availability: "available",
      },
      collectiveSteps: {
        value: {
          schema_version: "tilesim.execution_replay.v1",
          run_id: executionReplayFixtureRunId,
          collective_steps: [
            {
              step_id: "step-0",
              collective_id: "collective-0",
              phase_id: "phase-0",
              round: 0,
              chunk: 0,
              start_time_ps: 10,
              end_time_ps: 20,
              source_device: "gpu-0",
              destination_device: "gpu-1",
              bytes: 1,
              dependencies: [],
            },
          ],
        },
        artifactId: "execution-replay",
        sha256: "f".repeat(64),
        schemaIdentity: "tilesim.execution_replay.v1",
        availability: "available",
      },
      metrics: executionReplayNotCoveredFixture,
    });
    expect(document.coverage.phaseFabric).toBe("not_covered");
    expect(document.coverage.status).toBe("available");
    expect(document.coverage.reasons).not.toContain("通信阶段只有聚合或未报告证据。");
  });

  it("replays Fabric routes published by the canonical execution-replay artifact", () => {
    const topology = normalizeTopologyInput(executionReplayFabricRouteTopologyFixture, executionReplayFixtureRunId);
    const normalized = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.execution_replay.v1",
          run_id: executionReplayFixtureRunId,
          fabric: { timeline: executionReplayFabricRouteFixture.evidence.fabric.timeline },
        },
        artifactId: "execution-replay",
        sha256: "f".repeat(64),
        schemaIdentity: "tilesim.execution_replay.v1",
        availability: "available",
      },
      executionReplayFixtureRunId,
      topology,
    );
    expect(normalized.availability).toBe("available");
    expect(normalized.routes[0]).toMatchObject({
      sourceArtifact: "execution-replay",
      sourcePath: "execution-replay:/fabric/timeline/0",
      actualPath: ["gpu-0", "switch-0", "gpu-1"],
      linkIds: ["link-0", "link-1"],
    });
    expect(normalized.events[0].sourcePath).toBe("execution-replay:/fabric/timeline/0/execution_events/0");
  });

  it("does not choose an arbitrary link when a path has parallel endpoint matches", () => {
    const parallel = {
      value: {
        ...executionReplayFabricRouteFixture,
        evidence: {
          fabric: {
            timeline: [
              {
                ...executionReplayFabricRouteFixture.evidence.fabric.timeline[0],
                link_endpoints: {
                  ...executionReplayFabricRouteFixture.evidence.fabric.timeline[0].link_endpoints,
                  "link-0-parallel": { source: "gpu-0", destination: "switch-0" },
                },
              },
            ],
          },
        },
      },
      artifactId: "request-attribution",
      sha256: "x",
      schemaIdentity: "tilesim.request_attribution.v1",
      availability: "available" as const,
    };
    const parallelTopology = normalizeTopologyInput(
      {
        ...executionReplayFabricRouteTopologyFixture,
        topology: {
          ...executionReplayFabricRouteTopologyFixture.topology,
          links: [
            ...executionReplayFabricRouteTopologyFixture.topology.links,
            { link_id: "link-0-parallel", src_device: "gpu-0", dst_device: "switch-0" },
          ],
        },
      },
      executionReplayFixtureRunId,
    );
    const normalized = normalizeFabricRoutes(parallel, executionReplayFixtureRunId, parallelTopology);
    expect(normalized.routes[0].actualPath).toEqual(["gpu-0", "switch-0", "gpu-1"]);
    expect(normalized.routes[0].linkIds).toEqual(["link-1"]);
    expect(normalized.routes[0].state).toBe("partial");
  });

  it("distinguishes no-path, partial, route unavailable, and topology identity mismatch", () => {
    const topology = normalizeTopologyInput(executionReplayFabricRouteTopologyFixture, executionReplayFixtureRunId);
    const noPath = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.request_attribution.v1",
          run_id: executionReplayFixtureRunId,
          evidence: { fabric: { timeline: [{ start_time_ps: "1", finish_time_ps: "2" }] } },
        },
        artifactId: "request-attribution",
        sha256: "x",
        availability: "available",
      },
      executionReplayFixtureRunId,
      topology,
    );
    expect(noPath.state).toBe("no_path");
    const partial = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.request_attribution.v1",
          run_id: executionReplayFixtureRunId,
          evidence: {
            fabric: {
              timeline: [
                {
                  actual_path: ["gpu-0", "switch-0", "gpu-1"],
                  link_endpoints: { "link-0": { source: "gpu-0", destination: "switch-0" } },
                },
              ],
            },
          },
        },
        artifactId: "request-attribution",
        sha256: "x",
        availability: "available",
      },
      executionReplayFixtureRunId,
      topology,
    );
    expect(partial.state).toBe("partial");
    const unavailable = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.request_attribution.v1",
          run_id: executionReplayFixtureRunId,
          evidence: { fabric: { timeline: [{ fallback_reason: "route_unavailable" }] } },
        },
        artifactId: "request-attribution",
        sha256: "x",
        availability: "available",
      },
      executionReplayFixtureRunId,
      topology,
    );
    expect(unavailable.state).toBe("route_unavailable");
    const mismatch = normalizeFabricRoutes(executionReplayFabricRouteFixture, executionReplayFixtureRunId, topology);
    mismatch.routes[0].actualPath[0] = "unknown-device";
    expect(
      normalizeFabricRoutes(
        { ...executionReplayFabricRouteFixture, evidence: executionReplayFabricRouteFixture.evidence },
        executionReplayFixtureRunId,
        normalizeTopologyInput(
          {
            ...executionReplayFabricRouteTopologyFixture,
            topology: {
              ...executionReplayFabricRouteTopologyFixture.topology,
              devices: executionReplayFabricRouteTopologyFixture.topology.devices.filter(
                (device) => device.device_id !== "gpu-0",
              ),
            },
          },
          executionReplayFixtureRunId,
        ),
      ).state,
    ).toBe("topology_identity_mismatch");

    const partialTopologyWithUnknownPath = normalizeTopologyInput(
      {
        ...executionReplayFabricRouteTopologyFixture,
        topology: {
          ...executionReplayFabricRouteTopologyFixture.topology,
          devices: [...executionReplayFabricRouteTopologyFixture.topology.devices, { device_id: "" }],
        },
      },
      executionReplayFixtureRunId,
    );
    expect(partialTopologyWithUnknownPath.availability).toBe("partial");
    expect(
      normalizeFabricRoutes(
        {
          ...executionReplayFabricRouteFixture,
          evidence: {
            ...executionReplayFabricRouteFixture.evidence,
            fabric: {
              timeline: [
                {
                  ...executionReplayFabricRouteFixture.evidence.fabric.timeline[0],
                  actual_path: ["gpu-0", "missing-device"],
                },
              ],
            },
          },
        },
        executionReplayFixtureRunId,
        partialTopologyWithUnknownPath,
      ).state,
    ).toBe("topology_identity_mismatch");

    const noLinks = normalizeFabricRoutes(
      executionReplayFabricRouteFixture,
      executionReplayFixtureRunId,
      normalizeTopologyInput(executionReplayFabricRouteEmptyLinksTopologyFixture, executionReplayFixtureRunId),
    );
    expect(noLinks.state).toBe("partial");

    const endpointMismatch = normalizeFabricRoutes(
      {
        ...executionReplayFabricRouteFixture,
        evidence: {
          ...executionReplayFabricRouteFixture.evidence,
          fabric: {
            timeline: [
              {
                ...executionReplayFabricRouteFixture.evidence.fabric.timeline[0],
                link_endpoints: {
                  "link-0": { source: "gpu-1", destination: "switch-0" },
                  "link-1": { source: "switch-0", destination: "gpu-1" },
                },
              },
            ],
          },
        },
      },
      executionReplayFixtureRunId,
      topology,
    );
    expect(endpointMismatch.state).toBe("topology_identity_mismatch");

    const emptyRow = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.request_attribution.v1",
          run_id: executionReplayFixtureRunId,
          evidence: { fabric: { timeline: [{}] } },
        },
        artifactId: "request-attribution",
        sha256: "x",
        schemaIdentity: "tilesim.request_attribution.v1",
        availability: "available",
      },
      executionReplayFixtureRunId,
      topology,
    );
    expect(emptyRow.routes[0].state).toBe("partial");
    expect(emptyRow.availability).toBe("partial");

    const directional = normalizeFabricRoutes(
      {
        ...executionReplayFabricRouteFixture,
        evidence: {
          ...executionReplayFabricRouteFixture.evidence,
          fabric: {
            timeline: [
              {
                ...executionReplayFabricRouteFixture.evidence.fabric.timeline[0],
                link_endpoints: {
                  "link-0::forward": { source: "gpu-0", destination: "switch-0" },
                  "link-1::forward": { source: "switch-0", destination: "gpu-1" },
                },
              },
            ],
          },
        },
      },
      executionReplayFixtureRunId,
      topology,
    );
    expect(directional.state).toBe("available");
  });

  it("accepts reverse traversal against a physical topology link", () => {
    const reverseTopology = normalizeTopologyInput(
      {
        schema_version: "tilesim.s6_topology_input.v1",
        run_id: executionReplayFixtureRunId,
        topology: {
          devices: [
            { device_id: "gpu-0", device_type: "gpu" },
            { device_id: "gpu-3", device_type: "gpu" },
          ],
          links: [{ link_id: "link-0", src_device: "gpu-0", dst_device: "gpu-3" }],
        },
      },
      executionReplayFixtureRunId,
    );
    const reverseRoute = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.execution_replay.v1",
          run_id: executionReplayFixtureRunId,
          fabric: {
            timeline: [
              {
                request_id: "reverse-request",
                actual_path: ["gpu-3", "gpu-0"],
                link_endpoints: { "link-0": { source: "gpu-3", destination: "gpu-0" } },
                start_time_ps: "10",
                finish_time_ps: "20",
              },
            ],
          },
        },
        artifactId: "execution-replay",
        sha256: "f".repeat(64),
        schemaIdentity: "tilesim.execution_replay.v1",
        availability: "available",
      },
      executionReplayFixtureRunId,
      reverseTopology,
    );
    expect(reverseRoute.state).toBe("available");
    expect(reverseRoute.availability).toBe("available");
    expect(reverseRoute.routes[0]).toMatchObject({ state: "available", linkIds: ["link-0"] });
  });

  it("does not collapse malformed actual_path entries into an invented direct hop", () => {
    const normalized = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.request_attribution.v1",
          run_id: executionReplayFixtureRunId,
          evidence: {
            fabric: {
              timeline: [
                {
                  request_id: "req-malformed",
                  actual_path: ["gpu-0", 7, "gpu-1"],
                  link_endpoints: {
                    "link-0": { source: "gpu-0", destination: "gpu-1" },
                  },
                },
              ],
            },
          },
        },
        artifactId: "request-attribution",
        sha256: "a".repeat(64),
        schemaIdentity: "tilesim.request_attribution.v1",
        availability: "available",
      },
      executionReplayFixtureRunId,
    );
    expect(normalized.routes[0]).toMatchObject({ state: "partial", actualPath: [], linkIds: [] });
  });

  it("distinguishes an empty path from a reported but incomplete single-node path", () => {
    const normalized = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.request_attribution.v1",
          run_id: executionReplayFixtureRunId,
          evidence: {
            fabric: {
              timeline: [{ request_id: "req-single-node", actual_path: ["gpu-0"] }],
            },
          },
        },
        artifactId: "request-attribution",
        sha256: "a".repeat(64),
        schemaIdentity: "tilesim.request_attribution.v1",
        availability: "available",
      },
      executionReplayFixtureRunId,
    );
    expect(normalized.routes[0]).toMatchObject({ state: "partial", actualPath: ["gpu-0"] });
  });

  it("marks null link_endpoints as malformed instead of treating them as an unreported path", () => {
    const normalized = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.request_attribution.v1",
          run_id: executionReplayFixtureRunId,
          evidence: { fabric: { timeline: [{ request_id: "req-null-links", link_endpoints: null }] } },
        },
        artifactId: "request-attribution",
        sha256: "a".repeat(64),
        schemaIdentity: "tilesim.request_attribution.v1",
        availability: "available",
      },
      executionReplayFixtureRunId,
    );
    expect(normalized.routes[0]).toMatchObject({ state: "partial", availability: "partial" });
  });

  it("marks a non-array execution_events field as partial instead of treating it as complete", () => {
    const normalized = normalizeFabricRoutes(
      {
        value: {
          ...executionReplayFabricRouteFixture,
          evidence: {
            fabric: {
              timeline: [
                {
                  ...executionReplayFabricRouteFixture.evidence.fabric.timeline[0],
                  execution_events: { kind: "service_complete" },
                },
              ],
            },
          },
        },
        artifactId: "request-attribution",
        sha256: "a".repeat(64),
        schemaIdentity: "tilesim.request_attribution.v1",
        availability: "available",
      },
      executionReplayFixtureRunId,
    );
    expect(normalized.routes[0]).toMatchObject({ state: "partial", availability: "partial" });
  });

  it("accepts a reported reverse traversal of an undirected physical topology link", () => {
    const topology = normalizeTopologyInput(
      {
        value: {
          schema_version: "tilesim.s6_topology_input.v1",
          run_id: executionReplayFixtureRunId,
          topology: {
            devices: [{ device_id: "gpu-0" }, { device_id: "gpu-1" }],
            links: [{ link_id: "link-0", src_device: "gpu-0", dst_device: "gpu-1" }],
          },
        },
        artifactId: "input-topology",
        sha256: "topology-sha",
        schemaIdentity: "tilesim.s6_topology_input.v1",
        availability: "available",
      },
      executionReplayFixtureRunId,
    );
    const normalized = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.execution_replay.v1",
          run_id: executionReplayFixtureRunId,
          fabric: {
            timeline: [
              {
                request_id: "req-reverse",
                actual_path: ["gpu-1", "gpu-0"],
                link_endpoints: { "link-0": { source: "gpu-1", destination: "gpu-0" } },
                execution_events: [],
              },
            ],
          },
        },
        artifactId: "execution-replay",
        sha256: "replay-sha",
        schemaIdentity: "tilesim.execution_replay.v1",
        availability: "available",
      },
      executionReplayFixtureRunId,
      topology,
    );
    expect(normalized.state).toBe("available");
    expect(normalized.availability).toBe("available");
    expect(normalized.routes[0]).toMatchObject({ state: "available", linkIds: ["link-0"] });
  });

  it("marks primitive Fabric timeline records as partial", () => {
    const normalized = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.request_attribution.v1",
          run_id: executionReplayFixtureRunId,
          evidence: { fabric: { timeline: [null] } },
        },
        artifactId: "request-attribution",
        sha256: "a".repeat(64),
        schemaIdentity: "tilesim.request_attribution.v1",
        availability: "available",
      },
      executionReplayFixtureRunId,
    );
    expect(normalized.routes[0]).toMatchObject({ state: "partial", availability: "partial" });
  });

  it("fails closed for malformed route boundaries and duplicate identities", () => {
    const topology = normalizeTopologyInput(executionReplayFabricRouteTopologyFixture, executionReplayFixtureRunId);
    const normalized = normalizeFabricRoutes(
      {
        value: {
          schema_version: "tilesim.request_attribution.v1",
          run_id: executionReplayFixtureRunId,
          evidence: {
            fabric: {
              timeline: [
                { route_id: "same", actual_path: ["gpu-0", null, "gpu-1"], link_endpoints: {} },
                { route_id: "same", actual_path: ["gpu-0", "switch-0", "gpu-1"], link_endpoints: {} },
              ],
            },
          },
        },
        artifactId: "request-attribution",
        sha256: "x",
        schemaIdentity: "tilesim.request_attribution.v1",
        availability: "available",
      },
      executionReplayFixtureRunId,
      topology,
    );
    expect(normalized.routes.map((route) => route.routeId)).toEqual(["same", "same#1"]);
    expect(normalized.routes.every((route) => route.state === "partial")).toBe(true);
  });

  it("rejects canonical collective payloads whose inner schema drifts", () => {
    const normalized = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      collectiveSteps: {
        value: { schema_version: "wrong.v1", run_id: executionReplayFixtureRunId, collective_steps: [] },
        artifactId: "execution-replay",
        sha256: "x",
        schemaIdentity: "tilesim.execution_replay.v1",
        availability: "available",
      },
    });
    expect(normalized.collective.availability).toBe("unsupported_schema");
    expect(normalized.collective.steps).toHaveLength(0);
  });

  it("keeps a canonical collective step when dependencies are explicitly unreported", () => {
    const normalized = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      collectiveSteps: {
        value: {
          schema_version: "tilesim.execution_replay.v1",
          run_id: executionReplayFixtureRunId,
          collective_steps: [
            {
              step_id: "step-without-dependencies",
              collective_id: "allreduce-0",
              phase_id: "phase-0",
              round: 0,
              chunk: 0,
              start_time_ps: 10,
              finish_time_ps: 20,
              source_device: "gpu-0",
              destination_device: "gpu-1",
              bytes: 128,
              dependencies: null,
            },
          ],
        },
        artifactId: "execution-replay",
        sha256: "x",
        schemaIdentity: "tilesim.execution_replay.v1",
        availability: "available",
      },
    });
    expect(normalized.collective.availability).toBe("available");
    expect(normalized.collective.steps).toHaveLength(1);
    expect(normalized.collective.steps[0].dependencies).toBeNull();
  });

  it("localizes reported collective phase labels while retaining the technical phase id", () => {
    const normalized = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      collectiveSteps: {
        value: {
          schema_version: "tilesim.execution_replay.v1",
          run_id: executionReplayFixtureRunId,
          collective_steps: [
            {
              step_id: "allgather-step",
              collective_id: "collective-0",
              phase_id: "phase-0",
              phase: "allgather",
              round: 0,
              chunk: 0,
              start_time_ps: 10,
              finish_time_ps: 20,
              source_device: "gpu-0",
              destination_device: "gpu-1",
              bytes: 128,
              dependencies: [],
            },
          ],
        },
        artifactId: "execution-replay",
        sha256: "x",
        schemaIdentity: "tilesim.execution_replay.v1",
        availability: "available",
      },
    });
    expect(normalized.collective.steps[0]).toMatchObject({
      phaseId: "phase-0",
      phaseLabel: "AllGather（全收集）",
    });
  });

  it("does not crash when an envelope contains malformed stage entries", () => {
    const normalized = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      envelope: { ...executionReplayEnvelopeFixture, stages: [null, "bad", executionReplayEnvelopeFixture.stages[0]] },
    });
    expect(normalized.stages).toHaveLength(3);
    expect(normalized.coverage.stages).toBe("partial");
  });

  it("keeps valid stages when one stage row is malformed", () => {
    const normalized = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      envelope: {
        ...executionReplayEnvelopeFixture,
        stages: [null, executionReplayEnvelopeFixture.stages[0]],
      },
    });
    expect(normalized.stages).toHaveLength(2);
    expect(normalized.coverage.stages).toBe("partial");
  });

  it("marks a reported stage without timing as partial coverage", () => {
    const normalized = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      envelope: {
        ...executionReplayEnvelopeFixture,
        stages: [{ stage_id: "stage-without-time", title: "阶段" }],
      },
    });
    expect(normalized.stages[0].availability).toBe("missing");
    expect(normalized.coverage.stages).toBe("partial");
  });

  it("localizes function-like execution stage names without losing the raw stage id", () => {
    const normalized = normalizeReplayDocument({
      runId: executionReplayFixtureRunId,
      envelope: {
        ...executionReplayEnvelopeFixture,
        stages: [
          { stage_id: "runtime_scheduler", subsystem: "S1" },
          { stage_kind: "allreduce", subsystem: "S5" },
          { stage_id: "opaque_backend_function", subsystem: "S6" },
        ],
      },
    });
    expect(normalized.stages.map((stage) => stage.label)).toEqual(["运行时调度", "AllReduce 集合通信", "网络与硬件"]);
    expect(normalized.stages[0].stageId).toBe("runtime_scheduler");
  });
});
