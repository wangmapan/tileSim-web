import { describe, expect, it } from "vitest";
import catalogDocument from "../../bridge/contracts/agent_orchestration_capability/catalog-content.json";
import type { AgentOrchestrationCapabilitySnapshotResponse } from "../../src/contracts/bridge-api";
import {
  buildPhase1CapabilityProjection,
  Phase1CapabilityProjectionError,
  redactSingleTurnInstruction,
} from "../../src/features/agent-copilot-integration";
import {
  buildExperimentAgentContextPublication,
  buildExperimentSurface,
  createExperimentForm,
} from "../../src/features/run-experiment";
import { createF8ExperimentDescriptor, f8Capabilities } from "../fixtures/experiment-descriptor";

const schemaSetRevision = `sha256:${"1".repeat(64)}`;

function snapshot(): AgentOrchestrationCapabilitySnapshotResponse {
  return {
    schema_identity: "tilesim.bridge.agent_orchestration_capability_snapshot.v1",
    publication_status: "published",
    snapshot_id: "tilesim.agent-orchestration.capability-snapshot",
    snapshot_revision: `sha256:${"2".repeat(64)}`,
    snapshot_digest: `sha256:${"2".repeat(64)}`,
    canonicalization_identity: "tilesim.bridge.canonical_json.v1",
    catalog: structuredClone(catalogDocument) as AgentOrchestrationCapabilitySnapshotResponse["catalog"],
    release_binding: {
      web_source_identity: "tilesim.web.git",
      web_source_revision: "a".repeat(40),
      web_build_revision: "a".repeat(40),
      backend_identity: "tilesim.backend.git",
      backend_revision: "b".repeat(40),
      schema_set_revision: schemaSetRevision,
      experiment_descriptor_identity: "tilesim.bridge.experiment_descriptor.v1",
      experiment_descriptor_revision: `sha256:${"3".repeat(64)}`,
      create_run_identity: "tilesim.bridge.create_run_request.v1",
      catalog_revision: catalogDocument.catalog_revision,
      contract_package_revision: catalogDocument.contract_package_revision,
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

describe("Phase 1 capability projection", () => {
  it("projects exactly the eight executed fields in the frozen pointer order", () => {
    const projection = buildPhase1CapabilityProjection(snapshot());
    expect(projection.fields).toHaveLength(8);
    expect(projection.target_request_identity).toBe("tilesim.bridge.create_run_request.v1");
    expect(projection.fields.map((field) => [field.field_id, field.request_json_pointer])).toEqual([
      ["s0.workload.message_size_multiplier", "/overrides/workload/message_size_multiplier"],
      ["s1.runtime.batch_scheduler", "/overrides/runtime/batch_scheduler"],
      ["s1.runtime.max_batch_size", "/overrides/runtime/max_batch_size"],
      ["s1.runtime.kv_capacity_tokens", "/overrides/runtime/kv_capacity_tokens"],
      ["s6.fabric.scale_up_bandwidth_gbps", "/overrides/fabric/scale_up_bandwidth_gbps"],
      ["s6.fabric.scale_up_latency_us", "/overrides/fabric/scale_up_latency_us"],
      ["s6.fabric.scale_out_bandwidth_gbps", "/overrides/fabric/scale_out_bandwidth_gbps"],
      ["s6.fabric.scale_out_latency_us", "/overrides/fabric/scale_out_latency_us"],
    ]);
    expect(projection.fields.filter((field) => field.capability_state === "available")).toHaveLength(7);
    expect(
      projection.fields.find((field) => field.field_id === "s1.runtime.kv_capacity_tokens")?.capability_state,
    ).toBe("conditional");
  });

  it("fails closed for an expanded field set, pointer drift, or missing execution closure", () => {
    const expanded = snapshot();
    expanded.catalog.agent_exposed_field_ids[0] = "s2.execution.tp_degree";
    expect(() => buildPhase1CapabilityProjection(expanded)).toThrowError(Phase1CapabilityProjectionError);

    const pointerDrift = snapshot();
    pointerDrift.catalog.parameter_descriptors[0].request_json_pointer = "/overrides/workload/other";
    expect(() => buildPhase1CapabilityProjection(pointerDrift)).toThrowError(
      expect.objectContaining({ code: "phase1_capability_descriptor_binding_mismatch" }),
    );

    const notExecuted = snapshot();
    notExecuted.catalog.parameter_descriptors[0].capability_state.executed.state = "denied";
    expect(() => buildPhase1CapabilityProjection(notExecuted)).toThrowError(
      expect.objectContaining({ code: "phase1_capability_execution_closure_missing" }),
    );
  });
});

describe("Phase 1 public page adapter and redaction", () => {
  it("publishes only typed read-only references while keeping form values in the separate compiler projection", () => {
    const surface = buildExperimentSurface(
      {
        scenarios: [{ scenario_id: "s1_des_example", label: "S1 → S6" }],
        fidelity_policies: ["default", "des"],
        input_modes: ["controls", "json"],
        design_space_modes: ["built_in_synthetic", "strict_s6_manifest"],
        gpu_participation_modes: ["gpu_free"],
      },
      f8Capabilities,
      createF8ExperimentDescriptor(),
      "supported",
    );
    const form = createExperimentForm(surface);
    form.parameterValues["s1.runtime.max_batch_size"] = 8;
    const publication = buildExperimentAgentContextPublication({
      form,
      surface,
      mode: "controls",
      contextRevision: "context:experiment:1",
      runId: "run-read-only",
    });

    expect(publication.context.resources).toHaveLength(8);
    expect(JSON.stringify(publication.context)).not.toContain("parameterValues");
    expect(publication.context).not.toHaveProperty("artifact");
    expect(publication.current_values["s1.runtime.max_batch_size"]).toEqual({
      value_type: "integer",
      serialized_value: "8",
    });
  });

  it("redacts common credentials without retaining the submitted instruction", () => {
    const result = redactSingleTurnInstruction("把 batch 改为 8; api_key=abc123; Bearer secret-token");
    expect(result).toContain("把 batch 改为 8");
    expect(result).not.toContain("abc123");
    expect(result).not.toContain("secret-token");
    expect(result.match(/\[REDACTED\]/g)).toHaveLength(2);
  });
});
