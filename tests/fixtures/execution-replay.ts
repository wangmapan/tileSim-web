import type { ArtifactManifestEntry, ArtifactManifestResponse } from "../../src/contracts/bridge-api";

export const executionReplayFixtureRunId = "run-execution-replay-fixture";
export const executionReplayFixtureSchemaRevision = `sha256:${"e".repeat(64)}`;

export const executionReplayRuntimeEvents = {
  schema_version: "tilesim.s1_runtime_event_trace.v1",
  run_id: executionReplayFixtureRunId,
  events: [
    { kind: "arrival", event_time_ps: "9007199254740993123", request_id: "req-0", batch_id: "batch-0" },
    { kind: "admit", event_time_ps: "9007199254740993123", request_id: "req-0", batch_id: "batch-0" },
    { kind: "batch_issue", event_time_ps: "9007199254740994123", request_id: "req-0", batch_id: "batch-0" },
    { kind: "decode_step", event_time_ps: "9007199254740995123", request_id: "req-0", batch_id: "batch-0" },
    { kind: "kv_handoff", event_time_ps: "9007199254740996123", request_id: "req-0", state: "swap_ready" },
    { kind: "memory_backpressure", event_time_ps: "9007199254740997123", request_id: "req-0", state: "waiting" },
    { kind: "kv_grow", event_time_ps: "9007199254740998123", request_id: "req-0", bytes: "0" },
    { kind: "complete", event_time_ps: "9007199254740999123", request_id: "req-0", state: "completed" },
    { kind: "reject", event_time_ps: "9007199254741000123", request_id: "req-1", state: "rejected" },
  ],
} as const;

export const executionReplayEnvelopeFixture = {
  schema_version: "tilesim.s7_execution_envelope.v1",
  run_id: executionReplayFixtureRunId,
  start_time_ps: "9007199254740993000",
  end_time_ps: "9007199254741000200",
  stages: [
    { stage_id: "runtime", subsystem: "S1", start_time_ps: "9007199254740993000", end_time_ps: "9007199254740997000" },
    {
      stage_id: "completion",
      subsystem: "S2",
      start_time_ps: "9007199254740997000",
      end_time_ps: "9007199254741000200",
    },
  ],
} as const;

export const executionReplayPartialFixture = {
  schema_version: "tilesim.s7_execution_envelope.v1",
  run_id: executionReplayFixtureRunId,
  stages: [{ stage_id: "summary-only", subsystem: "S1", detail: "时间端点未报告" }],
} as const;

export const executionReplayTopologyFixture = {
  schema_version: "tilesim.s6_topology_input.v1",
  run_id: executionReplayFixtureRunId,
  topology: {
    devices: [
      { device_id: "gpu-0", device_type: "gpu" },
      { device_id: "gpu-1", device_type: "gpu" },
    ],
    domains: [{ domain_id: "fabric-0", member_devices: ["gpu-0", "gpu-1"] }],
    links: [],
  },
} as const;

function entry(
  artifactId: string,
  fileName: string,
  schemaIdentity: string,
  sha256: string,
  bytes: number | string,
  contentStatus: "ready" | "expected_absence" = "ready",
): ArtifactManifestEntry {
  return {
    artifact_id: artifactId,
    file_name: fileName,
    report_kind: null,
    media_type: "application/json",
    bytes,
    sha256,
    schema_identity: schemaIdentity,
    contract_status: "supported",
    content_status: contentStatus,
  } as ArtifactManifestEntry;
}

export const executionReplayFixtureManifest: ArtifactManifestResponse = {
  schema_version: "tilesim.bridge.artifact_manifest.v2",
  api_version: "tilesim.bridge.api.v1",
  schema_set_revision: executionReplayFixtureSchemaRevision,
  run_id: executionReplayFixtureRunId,
  artifacts: [
    entry("runtime-events", "runtime-events.json", "tilesim.s1_runtime_event_trace.v1", "a".repeat(64), 1024),
    entry("execution-envelope", "execution-envelope.json", "tilesim.s7_execution_envelope.v1", "b".repeat(64), 512),
    entry("input-topology", "input-topology.json", "tilesim.s6_topology_input.v1", "c".repeat(64), 256),
  ],
  rejected_artifacts: [],
};

export const executionReplayExpectedAbsenceManifest: ArtifactManifestResponse = {
  ...executionReplayFixtureManifest,
  artifacts: [
    entry(
      "runtime-events",
      "runtime-events.json",
      "tilesim.wind_tunnel_artifact_descriptor.v1",
      "d".repeat(64),
      180,
      "expected_absence",
    ),
  ],
};

export const executionReplayMissingPathFixture = {
  schema_version: "tilesim.request_attribution.v1",
  run_id: executionReplayFixtureRunId,
  evidence: { fabric: { timeline: [{ request_id: "req-0", actual_path: [], link_endpoints: {} }] } },
} as const;

export const executionReplayFabricRouteFixture = {
  schema_version: "tilesim.request_attribution.v1",
  run_id: executionReplayFixtureRunId,
  evidence: {
    fabric: {
      timeline: [
        {
          request_id: "req-0",
          phase_id: "phase-0",
          start_time_ps: "9007199254740993000",
          finish_time_ps: "9007199254740997000",
          actual_path: ["gpu-0", "switch-0", "gpu-1"],
          link_endpoints: {
            "link-0": { source: "gpu-0", destination: "switch-0" },
            "link-1": { source: "switch-0", destination: "gpu-1" },
          },
          execution_events: [
            { kind: "enqueue", link_id: "link-0", time_ps: "9007199254740993100" },
            { kind: "service_complete", link_id: "link-1", time_ps: "9007199254740996900" },
          ],
        },
      ],
    },
  },
} as const;

export const executionReplayFabricRouteTopologyFixture = {
  ...executionReplayTopologyFixture,
  topology: {
    ...executionReplayTopologyFixture.topology,
    devices: [...executionReplayTopologyFixture.topology.devices, { device_id: "switch-0", device_type: "switch" }],
    links: [
      { link_id: "link-0", src_device: "gpu-0", dst_device: "switch-0" },
      { link_id: "link-1", src_device: "switch-0", dst_device: "gpu-1" },
    ],
  },
} as const;

export const executionReplayFabricRouteEmptyLinksTopologyFixture = {
  ...executionReplayFabricRouteTopologyFixture,
  topology: {
    ...executionReplayFabricRouteTopologyFixture.topology,
    links: [],
  },
} as const;

export const executionReplayFabricRouteDirectionalTopologyFixture = {
  ...executionReplayFabricRouteTopologyFixture,
  topology: {
    ...executionReplayFabricRouteTopologyFixture.topology,
    links: executionReplayFabricRouteTopologyFixture.topology.links.map((link) => ({
      ...link,
      link_id: `${link.link_id}`,
    })),
  },
} as const;

export const executionReplayCollectiveStepsFixture = {
  schema_version: "tilesim.execution_replay.v1",
  run_id: executionReplayFixtureRunId,
  collective_steps: [
    {
      step_id: "collective-step-0",
      collective_id: "collective-0",
      phase_id: "phase-0",
      round: "0",
      chunk: "0",
      start_time_ps: "0",
      end_time_ps: "9007199254740993",
      source_device: "gpu-0",
      destination_device: "gpu-1",
      bytes: "0",
      dependencies: [],
    },
  ],
} as const;

export const executionReplayCollectiveStepMissingFieldFixture = {
  ...executionReplayCollectiveStepsFixture,
  collective_steps: [{ ...executionReplayCollectiveStepsFixture.collective_steps[0], bytes: undefined }],
} as const;

export const executionReplayRunMismatchFixture = {
  ...executionReplayRuntimeEvents,
  run_id: "run-from-another-experiment",
} as const;

export const executionReplayNotCoveredFixture = {
  schema_version: "tilesim.metrics_report.v1",
  run_id: executionReplayFixtureRunId,
  system_summary: { request_fabric_contributions: [] },
} as const;
