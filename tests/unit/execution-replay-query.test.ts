import { nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactManifestResponse } from "../../src/contracts/bridge-api";
import { queryClient } from "../../src/lib/query-client";

const fetchVerifiedArtifact = vi.hoisted(() => vi.fn());
vi.mock("../../src/features/run-evidence", () => ({ fetchVerifiedArtifact }));

import { useExecutionReplayQuery } from "../../src/features/execution-replay/queries/useExecutionReplayQuery";
import {
  executionReplayCollectiveStepsFixture,
  executionReplayFabricRouteTopologyFixture,
  executionReplayTopologyFixture,
} from "../fixtures/execution-replay";

const runId = "run-query-fixture";
const manifest = {
  schema_version: "tilesim.bridge.artifact_manifest.v2",
  api_version: "tilesim.bridge.api.v1",
  schema_set_revision: "sha256:revision",
  run_id: runId,
  artifacts: ["runtime-events", "runtime-requests", "request-attribution"].map((artifact_id) => ({
    artifact_id,
    file_name: `${artifact_id}.json`,
    report_kind: null,
    media_type: "application/json",
    bytes: 32,
    sha256: `${artifact_id}`.padEnd(64, "0"),
    schema_identity:
      artifact_id === "request-attribution"
        ? "tilesim.request_attribution.v1"
        : artifact_id === "runtime-events"
          ? "tilesim.s1_runtime_event_trace.v1"
          : "tilesim.s1_runtime_request_summaries.v1",
    contract_status: "supported",
    content_status: "ready",
  })),
  rejected_artifacts: [],
} as unknown as ArtifactManifestResponse;

describe("execution replay query isolation", () => {
  beforeEach(() => {
    queryClient.clear();
    fetchVerifiedArtifact.mockReset();
    fetchVerifiedArtifact.mockImplementation(async (_run: string, entry: { artifact_id: string }) => {
      if (entry.artifact_id === "request-attribution") throw new Error("bridge 500");
      return { run_id: runId, events: [] };
    });
  });

  it("retains successful artifacts when one evidence fetch fails", async () => {
    const replay = useExecutionReplayQuery({
      runId: ref(runId),
      backendRevision: ref("backend"),
      schemaSetRevision: ref("schema"),
      artifactManifest: ref(manifest),
      bridgeManifest: ref(null),
      runtimeTrace: ref(null),
    });
    await vi.waitFor(() => expect(replay.result.value.loading).toBe(false));
    expect(replay.result.value.runtimeEvents?.availability).toBe("available");
    expect(replay.result.value.runtimeRequests?.availability).toBe("available");
    expect(replay.result.value.fabricRoutes?.availability).toBe("partial");
    expect(replay.result.value.error).toContain("bridge 500");
  });

  it("clears the previous run while the next artifact set is being verified", async () => {
    const run = ref(runId);
    const artifactManifest = ref(manifest);
    const replay = useExecutionReplayQuery({
      runId: run,
      backendRevision: ref("backend-stale-run"),
      schemaSetRevision: ref("schema"),
      artifactManifest,
      bridgeManifest: ref(null),
      runtimeTrace: ref(null),
    });
    await vi.waitFor(() => expect(replay.result.value.loading).toBe(false));
    expect(replay.result.value.runtimeEvents?.availability).toBe("available");

    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchVerifiedArtifact.mockImplementation(async () => {
      await pending;
      return { run_id: "run-next", events: [] };
    });
    run.value = "run-next";
    artifactManifest.value = { ...manifest, run_id: "run-next" };
    await nextTick();
    expect(replay.result.value.loading).toBe(true);
    expect(replay.result.value.runtimeEvents).toBeNull();
    expect(replay.result.value.fabricRoutes).toBeNull();
    release();
    await vi.waitFor(() => expect(replay.result.value.loading).toBe(false));
  });

  it("refreshes when a manifest entry changes in place", async () => {
    const inPlaceManifest = {
      ...manifest,
      artifacts: manifest.artifacts.map((entry) => ({ ...entry })),
    } as unknown as ArtifactManifestResponse;
    const artifactManifest = ref(inPlaceManifest);
    const replay = useExecutionReplayQuery({
      runId: ref(runId),
      backendRevision: ref("backend-in-place-manifest"),
      schemaSetRevision: ref("schema"),
      artifactManifest,
      bridgeManifest: ref(null),
      runtimeTrace: ref(null),
    });
    await vi.waitFor(() => expect(replay.result.value.loading).toBe(false));
    const before = fetchVerifiedArtifact.mock.calls.filter((call) => call[1].artifact_id === "runtime-events").length;
    artifactManifest.value.artifacts.find((entry) => entry.artifact_id === "runtime-events")!.sha256 = "e".repeat(64);
    await vi.waitFor(() =>
      expect(fetchVerifiedArtifact.mock.calls.filter((call) => call[1].artifact_id === "runtime-events").length).toBe(
        before + 1,
      ),
    );
    expect(replay.result.value.loading).toBe(false);
  });

  it("refreshes when the manifest run identity changes in place", async () => {
    const inPlaceManifest = {
      ...manifest,
      artifacts: manifest.artifacts.map((entry) => ({ ...entry })),
    } as unknown as ArtifactManifestResponse;
    const artifactManifest = ref(inPlaceManifest);
    const replay = useExecutionReplayQuery({
      runId: ref(runId),
      backendRevision: ref("backend-in-place-run"),
      schemaSetRevision: ref("schema"),
      artifactManifest,
      bridgeManifest: ref(null),
      runtimeTrace: ref(null),
    });
    await vi.waitFor(() => expect(replay.result.value.loading).toBe(false));
    artifactManifest.value.run_id = "different-run";
    await vi.waitFor(() => expect(replay.result.value.runtimeEvents?.availability).toBe("unsupported_schema"));
    expect(replay.result.value.loading).toBe(false);
  });

  it("does not fetch artifacts with malformed negative manifest bytes", async () => {
    const malformed = {
      ...manifest,
      artifacts: manifest.artifacts.map((entry) =>
        entry.artifact_id === "runtime-events" ? { ...entry, bytes: "-1" } : entry,
      ),
    } as unknown as ArtifactManifestResponse;
    const replay = useExecutionReplayQuery({
      runId: ref(runId),
      backendRevision: ref("backend-malformed"),
      schemaSetRevision: ref("schema"),
      artifactManifest: ref(malformed),
      bridgeManifest: ref(null),
      runtimeTrace: ref(null),
    });
    await vi.waitFor(() => expect(replay.result.value.loading).toBe(false));
    expect(replay.result.value.runtimeEvents?.availability).toBe("partial");
    expect(fetchVerifiedArtifact.mock.calls.some((call) => call[1].artifact_id === "runtime-events")).toBe(false);
  });

  it("fails closed before fetching an artifact with an unsupported manifest schema", async () => {
    const malformed = {
      ...manifest,
      artifacts: manifest.artifacts.map((entry) =>
        entry.artifact_id === "runtime-requests" ? { ...entry, schema_identity: "fixture.v1" } : entry,
      ),
    } as unknown as ArtifactManifestResponse;
    const replay = useExecutionReplayQuery({
      runId: ref(runId),
      backendRevision: ref("backend-schema-gate"),
      schemaSetRevision: ref("schema"),
      artifactManifest: ref(malformed),
      bridgeManifest: ref(null),
      runtimeTrace: ref(null),
    });
    await vi.waitFor(() => expect(replay.result.value.loading).toBe(false));
    expect(replay.result.value.runtimeRequests?.availability).toBe("unsupported_schema");
    expect(fetchVerifiedArtifact.mock.calls.some((call) => call[1].artifact_id === "runtime-requests")).toBe(false);
  });

  it("verifies expected-absence descriptors before exposing the absence state", async () => {
    const expectedAbsence = {
      ...manifest,
      artifacts: manifest.artifacts.map((entry) =>
        entry.artifact_id === "runtime-events"
          ? {
              ...entry,
              schema_identity: "tilesim.wind_tunnel_artifact_descriptor.v1",
              content_status: "expected_absence",
            }
          : entry,
      ),
    } as unknown as ArtifactManifestResponse;
    const descriptor = {
      schema_version: "tilesim.wind_tunnel_artifact_descriptor.v1",
      run_id: runId,
      artifact_id: "runtime_event_trace",
      state: "expected_absence",
      evidence_requirement: "runtime trace is not produced for this run",
      absence_reason: "not_expected_for_boundary",
      detail: "The selected execution boundary does not emit runtime trace.",
    };
    fetchVerifiedArtifact.mockImplementation(async (_run: string, entry: { artifact_id: string }) =>
      entry.artifact_id === "runtime-events" ? descriptor : { run_id: runId, events: [] },
    );
    const replay = useExecutionReplayQuery({
      runId: ref(runId),
      backendRevision: ref("backend-expected-absence"),
      schemaSetRevision: ref("schema"),
      artifactManifest: ref(expectedAbsence),
      bridgeManifest: ref(null),
      runtimeTrace: ref(null),
    });
    await vi.waitFor(() => expect(replay.result.value.loading).toBe(false));
    expect(replay.result.value.runtimeEvents?.availability).toBe("expected_absence");
    expect(replay.result.value.runtimeEvents?.value).toBeNull();
    expect(fetchVerifiedArtifact.mock.calls.some((call) => call[1].artifact_id === "runtime-events")).toBe(true);
  });

  it("reads the verified canonical execution-replay artifact independently", async () => {
    const canonical = {
      ...manifest,
      artifacts: [
        ...manifest.artifacts,
        {
          artifact_id: "execution-replay",
          file_name: "execution-replay.json",
          report_kind: null,
          media_type: "application/json",
          bytes: 128,
          sha256: "f".repeat(64),
          schema_identity: "tilesim.execution_replay.v1",
          contract_status: "supported",
          content_status: "ready",
        },
      ],
    } as unknown as ArtifactManifestResponse;
    fetchVerifiedArtifact.mockImplementation(async (_run: string, entry: { artifact_id: string }) =>
      entry.artifact_id === "execution-replay" ? executionReplayCollectiveStepsFixture : { run_id: runId, events: [] },
    );
    const replay = useExecutionReplayQuery({
      runId: ref(runId),
      backendRevision: ref("backend-canonical"),
      schemaSetRevision: ref("schema"),
      artifactManifest: ref(canonical),
      bridgeManifest: ref(null),
      runtimeTrace: ref(null),
    });
    await vi.waitFor(() => expect(replay.result.value.loading).toBe(false));
    expect(replay.result.value.collectiveSteps?.artifactId).toBe("execution-replay");
    expect(replay.queryKey.value.join("|")).toContain(`execution-replay:${"f".repeat(64)}`);
  });

  it("uses the same verified canonical artifact for Fabric routes when legacy attribution is absent", async () => {
    const canonical = {
      ...manifest,
      artifacts: [
        {
          artifact_id: "execution-replay",
          file_name: "execution-replay.json",
          report_kind: null,
          media_type: "application/json",
          bytes: 128,
          sha256: "f".repeat(64),
          schema_identity: "tilesim.execution_replay.v1",
          contract_status: "supported",
          content_status: "ready",
        },
        {
          artifact_id: "input-topology",
          file_name: "input-topology.json",
          report_kind: null,
          media_type: "application/json",
          bytes: 256,
          sha256: "c".repeat(64),
          schema_identity: "tilesim.s6_topology_input.v1",
          contract_status: "supported",
          content_status: "ready",
        },
      ],
    } as unknown as ArtifactManifestResponse;
    const canonicalWithFabric = {
      ...executionReplayCollectiveStepsFixture,
      run_id: runId,
      fabric: {
        timeline: [
          {
            route_id: "route-0",
            actual_path: ["gpu-0", "switch-0", "gpu-1"],
            link_endpoints: {
              "link-0": { source: "gpu-0", destination: "switch-0" },
              "link-1": { source: "switch-0", destination: "gpu-1" },
            },
            start_time_ps: "10",
            finish_time_ps: "20",
          },
        ],
      },
    };
    fetchVerifiedArtifact.mockImplementation(async (_run: string, entry: { artifact_id: string }) => {
      if (entry.artifact_id === "execution-replay") return canonicalWithFabric;
      if (entry.artifact_id === "input-topology") return executionReplayFabricRouteTopologyFixture;
      return { run_id: runId, events: [] };
    });
    const replay = useExecutionReplayQuery({
      runId: ref(runId),
      backendRevision: ref("backend-canonical-fabric"),
      schemaSetRevision: ref("schema"),
      artifactManifest: ref(canonical),
      bridgeManifest: ref(null),
      runtimeTrace: ref(null),
    });
    await vi.waitFor(() => expect(replay.result.value.loading).toBe(false));
    expect(replay.result.value.fabricRoutes?.artifactId).toBe("execution-replay");
    expect(replay.result.value.fabricRoutes?.value).toMatchObject({
      schema_version: "tilesim.execution_replay.v1",
      run_id: runId,
      fabric: { timeline: [{ route_id: "route-0", actual_path: ["gpu-0", "switch-0", "gpu-1"] }] },
    });
  });

  it("does not resurrect a legacy path when canonical replay explicitly reports no Fabric timeline", async () => {
    const canonical = {
      ...manifest,
      artifacts: [
        {
          artifact_id: "request-attribution",
          file_name: "request-attribution.json",
          report_kind: null,
          media_type: "application/json",
          bytes: 128,
          sha256: "a".repeat(64),
          schema_identity: "tilesim.request_attribution.v1",
          contract_status: "supported",
          content_status: "ready",
        },
        {
          artifact_id: "execution-replay",
          file_name: "execution-replay.json",
          report_kind: null,
          media_type: "application/json",
          bytes: 128,
          sha256: "f".repeat(64),
          schema_identity: "tilesim.execution_replay.v1",
          contract_status: "supported",
          content_status: "ready",
        },
      ],
    } as unknown as ArtifactManifestResponse;
    const legacyWithPath = {
      run_id: runId,
      schema_version: "tilesim.request_attribution.v1",
      evidence: {
        fabric: {
          timeline: [
            {
              request_id: "legacy-request",
              actual_path: ["gpu-0", "gpu-1"],
              link_endpoints: { "link-0": { source: "gpu-0", destination: "gpu-1" } },
              start_time_ps: 1,
              finish_time_ps: 2,
            },
          ],
        },
      },
    };
    const canonicalNoPath = {
      schema_version: "tilesim.execution_replay.v1",
      run_id: runId,
      start_time_ps: 0,
      finish_time_ps: 0,
      end_time_ps: 0,
      fabric: {
        scenario_name: "disconnected",
        end_to_end_latency_us: 0,
        timeline: [],
        module_stats: [],
        fallback_reasons: ["route_unavailable"],
        hotspots: [],
      },
      collective_steps: [],
    };
    fetchVerifiedArtifact.mockImplementation(async (_run: string, entry: { artifact_id: string }) => {
      if (entry.artifact_id === "request-attribution") return legacyWithPath;
      if (entry.artifact_id === "execution-replay") return canonicalNoPath;
      return { run_id: runId, events: [] };
    });
    const replay = useExecutionReplayQuery({
      runId: ref(runId),
      backendRevision: ref("backend-canonical-no-path"),
      schemaSetRevision: ref("schema"),
      artifactManifest: ref(canonical),
      bridgeManifest: ref(null),
      runtimeTrace: ref(null),
    });
    await vi.waitFor(() => expect(replay.result.value.loading).toBe(false));
    expect(replay.result.value.fabricRoutes?.artifactId).toBe("execution-replay");
    expect(replay.result.value.fabricRoutes?.value).toMatchObject({
      schema_version: "tilesim.execution_replay.v1",
      fabric: { timeline: [] },
    });
  });

  it("reads topology only through the verified manifest artifact", async () => {
    const topologyManifest = {
      ...manifest,
      artifacts: [
        ...manifest.artifacts,
        {
          artifact_id: "input-topology",
          file_name: "input-topology.json",
          report_kind: null,
          media_type: "application/json",
          bytes: 256,
          sha256: "c".repeat(64),
          schema_identity: "tilesim.s6_topology_input.v1",
          contract_status: "supported",
          content_status: "ready",
        },
      ],
    } as unknown as ArtifactManifestResponse;
    fetchVerifiedArtifact.mockImplementation(async (_run: string, entry: { artifact_id: string }) =>
      entry.artifact_id === "input-topology" ? executionReplayTopologyFixture : { run_id: runId, events: [] },
    );
    const replay = useExecutionReplayQuery({
      runId: ref(runId),
      backendRevision: ref("backend-topology"),
      schemaSetRevision: ref("schema"),
      artifactManifest: ref(topologyManifest),
      bridgeManifest: ref(null),
      runtimeTrace: ref(null),
    });
    await vi.waitFor(() => expect(replay.result.value.loading).toBe(false));
    expect(replay.result.value.topology?.artifactId).toBe("input-topology");
    expect(replay.result.value.topology?.sha256).toBe("c".repeat(64));
    expect(fetchVerifiedArtifact.mock.calls.some((call) => call[1].artifact_id === "input-topology")).toBe(true);
  });
});
