import { afterEach, describe, expect, it, vi } from "vitest";
import catalogDocument from "../../bridge/contracts/agent_orchestration_capability/catalog-content.json";
import type { AgentOrchestrationCapabilitySnapshotResponse, ApiManifestResponse } from "../../src/contracts/bridge-api";
import {
  getAgentOrchestrationCapabilitySnapshot,
  validateAgentOrchestrationCapabilitySnapshot,
} from "../../src/lib/api/agent-orchestration-capabilities";

const schemaSetRevision = `sha256:${"1".repeat(64)}`;
const gitRevision = "a".repeat(40);
const catalog = catalogDocument;

function manifest(): ApiManifestResponse {
  return {
    schema_version: "tilesim.bridge.manifest.v1",
    api_version: "tilesim.bridge.api.v1",
    schema_set_revision: schemaSetRevision,
    error_schema_version: "tilesim.bridge.error.v1",
    artifact_manifest_schema_version: "tilesim.bridge.artifact_manifest.v2",
    known_report_schema_identities: {},
    experiment_descriptor: {
      endpoint: "GET /api/experiment-schema",
      schema_identity: "tilesim.bridge.experiment_descriptor.v1",
      create_run_schema_identity: "tilesim.bridge.create_run_request.v1",
    },
    trace_packages: {
      catalog_endpoint: "GET /api/trace-packages",
      inspect_endpoint: "POST /api/trace-packages/{package_id}/inspect",
      package_schema_identity: "tilesim.trace_package.v1alpha1",
      catalog_schema_identity: "tilesim.bridge.trace_package_catalog.v1",
      inspect_schema_identity: "tilesim.bridge.trace_package_inspect.v1",
      submission_source_modes: ["synthetic_trace"],
    },
    evidence_agent: {
      capability_endpoint: "GET /api/agent/evidence-capabilities",
      analysis_endpoint: "POST /api/runs/{run_id}/agent/evidence-analyses",
      descriptor_schema_identity: "tilesim.bridge.evidence_agent_descriptor.v2",
      descriptor_revision: "sha256:5f78ed33e20c131f672af53368c5ca950f41d63fd2e8f5301757d1f42debe357",
      request_schema_identity: "tilesim.bridge.evidence_agent_request.v1",
      response_schema_identity: "tilesim.bridge.evidence_agent_response.v1",
      citation_schema_identity: "tilesim.bridge.evidence_agent_citation.v1",
      snapshot_reference_schema_identity: "tilesim.bridge.evidence_snapshot_reference.v1",
      structured_report_schema_identity: "tilesim.web.structured-performance-report.v2",
      idempotency_header: "Idempotency-Key",
      execution_mode: "synchronous_terminal",
    },
    agent_orchestration_capability: {
      endpoint: "GET /api/agent/orchestration-capabilities",
      snapshot_schema_identity: "tilesim.bridge.agent_orchestration_capability_snapshot.v1",
      catalog_schema_identity: "tilesim.bridge.agent_orchestration_capability_catalog.v1",
      parameter_descriptor_schema_identity: "tilesim.bridge.agent_orchestration_parameter_descriptor.v1",
      profile_schema_identities: [
        "tilesim.bridge.agent_orchestration_model_profile.v1",
        "tilesim.bridge.agent_orchestration_engine_profile.v1",
        "tilesim.bridge.agent_orchestration_device_profile.v1",
        "tilesim.bridge.agent_orchestration_topology_profile.v1",
        "tilesim.bridge.agent_orchestration_workload_profile.v1",
      ],
      catalog_revision: catalog.catalog_revision,
      contract_package_revision: catalog.contract_package_revision,
    },
    run_creation: {
      idempotency_header: "Idempotency-Key",
      idempotency_required: true,
      payload_identity: "canonical_json_sha256",
    },
    run_events: {
      endpoint: "GET /api/runs/{run_id}/events",
      media_type: "text/event-stream",
      resume_header: "Last-Event-ID",
      event_ids: { active: "1", terminal: "2" },
    },
    endpoints: {
      agentOrchestrationCapabilities: "GET /api/agent/orchestration-capabilities",
    },
  };
}

function snapshot(): AgentOrchestrationCapabilitySnapshotResponse {
  return {
    schema_identity: "tilesim.bridge.agent_orchestration_capability_snapshot.v1",
    publication_status: "published",
    snapshot_id: "tilesim.agent-orchestration.capability-snapshot",
    snapshot_revision: `sha256:${"3".repeat(64)}`,
    snapshot_digest: `sha256:${"3".repeat(64)}`,
    canonicalization_identity: "tilesim.bridge.canonical_json.v1",
    catalog: structuredClone(catalog) as AgentOrchestrationCapabilitySnapshotResponse["catalog"],
    release_binding: {
      web_source_identity: "tilesim.web.git",
      web_source_revision: gitRevision,
      web_build_revision: gitRevision,
      backend_identity: "tilesim.backend.git",
      backend_revision: gitRevision,
      schema_set_revision: schemaSetRevision,
      experiment_descriptor_identity: "tilesim.bridge.experiment_descriptor.v1",
      experiment_descriptor_revision: `sha256:${"4".repeat(64)}`,
      create_run_identity: "tilesim.bridge.create_run_request.v1",
      catalog_revision: catalog.catalog_revision,
      contract_package_revision: catalog.contract_package_revision,
      nested_design_space_identities: [
        "tilesim.design_space.s6_candidates.v1",
        "tilesim.design_space.s6_candidates.v2",
      ],
      default_nested_design_space_identity: "tilesim.design_space.s6_candidates.v1",
    },
    drift_policy: {
      release_binding_mismatch: "fail_closed",
      catalog_revision_mismatch: "fail_closed",
      unknown_identity_or_status: "fail_closed",
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("Agent orchestration capability adapter", () => {
  it("accepts the generated snapshot contract and fetches only the read-only endpoint", async () => {
    const payload = snapshot();
    vi.stubGlobal("window", { location: { port: "5173" } });
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-tilesim-schema-set-revision": schemaSetRevision,
          },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAgentOrchestrationCapabilitySnapshot(manifest())).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/agent/orchestration-capabilities"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("fails closed for schema-set and catalog binding drift", () => {
    const stale = snapshot();
    stale.release_binding.schema_set_revision = `sha256:${"9".repeat(64)}`;
    expect(() => validateAgentOrchestrationCapabilitySnapshot(stale, manifest(), schemaSetRevision)).toThrowError(
      expect.objectContaining({
        code: "agent_orchestration_capability_schema_revision_mismatch",
      }),
    );

    const catalogDrift = snapshot();
    catalogDrift.catalog.catalog_revision = `sha256:${"8".repeat(64)}`;
    expect(() =>
      validateAgentOrchestrationCapabilitySnapshot(catalogDrift, manifest(), schemaSetRevision),
    ).toThrowError(
      expect.objectContaining({
        code: "agent_orchestration_capability_binding_mismatch",
      }),
    );
  });
});
