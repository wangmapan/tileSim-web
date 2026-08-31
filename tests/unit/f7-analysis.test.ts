import { describe, expect, it } from "vitest";
import type { ArtifactManifestResponse } from "../../src/contracts/bridge-api";
import type { DesignSpaceReport, MetricsReport } from "../../src/contracts/report-model";
import { adaptReport } from "../../src/adapters/report-registry";
import { parseJsonLossless } from "../../src/contracts/lossless-json";
import {
  buildDesignSpaceAnalysis,
  buildF7Capabilities,
  buildFabricAnalysis,
  createDesignSpacePresentation,
  unresolvedCandidateKnobs,
} from "../../src/features/f7-analysis";
import { fixtureCase } from "../helpers/fixtures";

function manifest(): ArtifactManifestResponse {
  return {
    schema_version: "tilesim.bridge.artifact_manifest.v2",
    api_version: "tilesim.bridge.api.v1",
    schema_set_revision: `sha256:${"e".repeat(64)}`,
    run_id: "run-f7-test",
    artifacts: [
      {
        artifact_id: "metrics",
        report_kind: "metrics",
        file_name: "metrics.json",
        media_type: "application/json",
        bytes: 100,
        sha256: "a".repeat(64),
        schema_identity: "tilesim.metrics_report.v1",
        contract_status: "supported",
      },
      {
        artifact_id: "design-space",
        report_kind: "design_space",
        file_name: "design-space.json",
        media_type: "application/json",
        bytes: 200,
        sha256: "b".repeat(64),
        schema_identity: "design_space.report.v1alpha1",
        contract_status: "supported",
      },
    ],
    rejected_artifacts: [],
  };
}

function fixtureReports() {
  const fixture = fixtureCase("synthetic-s1-s6-complete");
  return {
    metrics: structuredClone(fixture.reports.metrics) as MetricsReport,
    designSpace: structuredClone(fixture.reports.design_space) as DesignSpaceReport,
  };
}

function formalManifest(): ArtifactManifestResponse {
  const value = manifest();
  value.schema_set_revision = `sha256:${"c".repeat(64)}`;
  value.artifacts[1] = {
    ...value.artifacts[1],
    schema_identity: "tilesim.design_space_report.v1",
  };
  value.artifacts.push({
    artifact_id: "input-topology",
    report_kind: null,
    file_name: "input-topology.json",
    media_type: "application/json",
    bytes: 300,
    sha256: "c".repeat(64),
    schema_identity: "tilesim.s6_topology_input.v1",
    contract_status: "supported",
  });
  return value;
}

function subject(kind: string, id: string) {
  const identityKey = {
    candidate: "candidate_id",
    objective: "objective_id",
    executed_s6_knob: "knob_id",
    fabric_domain: "fabric_domain_id",
  }[kind];
  return { kind, id, ...(identityKey ? { [identityKey]: id } : {}) };
}

function evidenceRef(
  artifactId: string,
  schemaIdentity: string,
  pointer: string,
  kind: string,
  id: string,
  availability = "available",
) {
  return {
    run_id: "run-f7-test",
    artifact_id: artifactId,
    schema_identity: schemaIdentity,
    json_pointer: pointer,
    availability,
    subject: subject(kind, id),
  };
}

function formalDesignSpace(): DesignSpaceReport {
  const candidate = (candidateId: string, index: number, paretoMember: boolean) => {
    const pointer = `/candidates/${index}`;
    const recordRef = evidenceRef("design-space", "tilesim.design_space_report.v1", pointer, "candidate", candidateId);
    return {
      candidate_id: candidateId,
      requested_fidelity: "analytical",
      resolved_fidelity: index ? "analytical" : "des",
      subject_refs: [subject("candidate", candidateId)],
      evidence_refs: [recordRef],
      navigation: {
        navigation_scope: "artifact_record",
        bridge_run_id: null,
        backend_run_instance_id: `backend-${candidateId}`,
        parent_run_id: "run-f7-test",
        candidate_id: candidateId,
        record_ref: structuredClone(recordRef),
      },
      pareto_front_id: "pareto-f7",
      objective_set_id: "objective-set-f7",
      pareto_member: paretoMember,
      dominated_by_candidate_ids: paretoMember ? [] : ["candidate-a"],
      dominates_candidate_ids: paretoMember ? ["candidate-b"] : [],
      dominance_status: paretoMember ? "non_dominated" : "dominated",
      dominance_reason_code: paretoMember ? "no_candidate_strictly_dominates" : "strict_objective_dominance",
      objectives: [
        ["p99_latency", "minimize", 10 + index, "us"],
        ["throughput", "maximize", 100 - index, "requests_per_second"],
      ].map(([objectiveId, direction, value, unit], objectiveIndex) => ({
        objective_id: objectiveId,
        metric_kind: objectiveId,
        direction,
        value,
        unit,
        availability: "available",
        evidence_ref: evidenceRef(
          "design-space",
          "tilesim.design_space_report.v1",
          `${pointer}/objectives/${objectiveIndex}`,
          "objective",
          `${candidateId}::${objectiveId}`,
        ),
      })),
      executed_s6_knobs: [
        {
          knob_id: "release_interval",
          subsystem: "S6",
          value_type: "uint64",
          value: 0n,
          unit: "ps",
          availability: "available",
          requested_value: 0n,
          resolved_value: 0n,
          source_ref: evidenceRef(
            "design-space",
            "tilesim.design_space_report.v1",
            `${pointer}/executed_s6_knobs/0/requested_value`,
            "executed_s6_knob",
            `${candidateId}::release_interval`,
          ),
          evidence_ref: evidenceRef(
            "design-space",
            "tilesim.design_space_report.v1",
            `${pointer}/executed_s6_knobs/0/resolved_value`,
            "executed_s6_knob",
            `${candidateId}::release_interval`,
          ),
        },
      ],
    };
  };
  const candidates = [candidate("candidate-a", 0, true), candidate("candidate-b", 1, false)];
  return {
    schema_version: "tilesim.design_space_report.v1",
    contract_version: "tilesim.design_space_report.v1",
    run_id: "run-f7-test",
    report_id: "design-space-f7",
    execution_scope: "S6_only",
    candidate_source_mode: "synthetic_trace",
    candidate_calibration_level: "uncalibrated",
    candidate_allowed_claim_scope: "exploratory_s6_only",
    provenance: {
      source_mode: "synthetic_trace",
      calibration_level: "uncalibrated",
      allowed_claim_scope: "exploratory_s6_only",
    },
    validation_lane: "synthetic_consistency",
    evidence_tier: "synthetic_consistency",
    claim_scope_summary: "synthetic S6-only consistency",
    pareto_front_id: "pareto-f7",
    objective_set_id: "objective-set-f7",
    candidate_count: 2n,
    candidates,
    ranking: candidates,
  } as DesignSpaceReport;
}

function formalTopology() {
  return {
    schema_version: "tilesim.s6_topology_input.v1",
    run_id: "run-f7-test",
    provenance: {
      source_mode: "synthetic_trace",
      calibration_level: "uncalibrated",
      allowed_claim_scope: "exploratory_s6_only",
    },
    topology: {
      topology_name: "f7-test",
      devices: [{ device_id: "gpu-0" }],
      module_bindings: [{ module_id: "fabric-0" }],
      domains: [
        {
          domain_id: "scale-up",
          domain_type: "scale_up",
          domain_kind: "scale_up",
          subject: subject("fabric_domain", "scale-up"),
          json_pointer: "/topology/domains/0",
          provenance: {
            source_mode: "synthetic_trace",
            calibration_level: "uncalibrated",
            allowed_claim_scope: "exploratory_s6_only",
          },
          member_devices: ["gpu-0"],
          module_binding: "fabric-0",
        },
      ],
    },
  };
}

describe("F7 metrics-backed analysis and contract gaps", () => {
  it("accepts the formal Pareto contract and exposes only exact artifact-record navigation", () => {
    const report = formalDesignSpace();
    const analysis = buildDesignSpaceAnalysis(report, formalManifest());
    expect(analysis).toMatchObject({
      availability: "available",
      paretoFrontId: "pareto-f7",
      objectiveSetId: "objective-set-f7",
      navigationScope: "artifact_record",
    });
    expect(analysis.candidates[0]).toMatchObject({
      availability: "available",
      evidence: { sourcePath: "design-space:/candidates/0" },
      candidate: {
        candidate_id: "candidate-a",
        pareto_member: true,
        navigation: { bridge_run_id: null, backend_run_instance_id: "backend-candidate-a" },
      },
    });
    expect(analysis.candidates[0].objectiveReferences[0].sourcePath).toBe("design-space:/candidates/0/objectives/0");
    expect(analysis.candidates[0].knobResolvedReferences[0].sourcePath).toBe(
      "design-space:/candidates/0/executed_s6_knobs/0/resolved_value",
    );
  });

  it("fails duplicate candidate IDs closed as ambiguous instead of selecting an array record", () => {
    const report = formalDesignSpace();
    report.candidates![1].candidate_id = "candidate-a";
    const analysis = buildDesignSpaceAnalysis(report, formalManifest());
    expect(analysis.availability).toBe("ambiguous_reference");
    expect(analysis.candidates.every((candidate) => candidate.availability === "ambiguous_reference")).toBe(true);
    expect(analysis.candidates.every((candidate) => candidate.evidence.sourcePath === null)).toBe(true);
  });

  it("rejects wrong candidate, objective, and knob Pointers independently", () => {
    const report = formalDesignSpace();
    report.candidates![0].navigation!.record_ref.json_pointer = "/candidates/1";
    report.candidates![1].objectives![0].evidence_ref.json_pointer = "/candidates/1/objectives/1";
    report.candidates![1].executed_s6_knobs![0].evidence_ref.json_pointer =
      "/candidates/1/executed_s6_knobs/0/requested_value";
    const analysis = buildDesignSpaceAnalysis(report, formalManifest());
    expect(analysis.availability).toBe("partial");
    expect(analysis.candidates[0].availability).toBe("invalid_reference");
    expect(analysis.candidates[0].evidence.sourcePath).toBeNull();
    expect(analysis.candidates[1].objectiveReferences[0].sourcePath).toBeNull();
    expect(analysis.candidates[1].knobResolvedReferences[0].sourcePath).toBeNull();
  });

  it("rejects dangling dominance and a backend instance masquerading as a Bridge run", () => {
    const dangling = formalDesignSpace();
    dangling.candidates![0].dominates_candidate_ids = ["candidate-missing"];
    expect(buildDesignSpaceAnalysis(dangling, formalManifest()).availability).toBe("invalid_reference");

    const fakeBridgeRun = formalDesignSpace();
    (fakeBridgeRun.candidates![0].navigation as { bridge_run_id: string | null }).bridge_run_id = "run-fake";
    const analysis = buildDesignSpaceAnalysis(fakeBridgeRun, formalManifest());
    expect(analysis.candidates[0].availability).toBe("invalid_reference");
    expect(analysis.candidates[0].evidence.sourcePath).toBeNull();
  });

  it("keeps uint64 knobs above Number.MAX_SAFE_INTEGER exact and distinguishes zero from not applicable", () => {
    const report = formalDesignSpace();
    const availableKnob = report.candidates![0].executed_s6_knobs![0];
    availableKnob.value = "__UINT64__";
    availableKnob.requested_value = "__UINT64__";
    availableKnob.resolved_value = "__UINT64__";
    const unavailableKnob = structuredClone(availableKnob);
    unavailableKnob.knob_id = "routing_policy";
    unavailableKnob.value_type = "string";
    unavailableKnob.availability = "not_applicable";
    unavailableKnob.value = null;
    unavailableKnob.requested_value = null;
    unavailableKnob.resolved_value = null;
    unavailableKnob.source_ref.subject = subject("executed_s6_knob", "candidate-a::routing_policy") as never;
    unavailableKnob.evidence_ref.subject = subject("executed_s6_knob", "candidate-a::routing_policy") as never;
    unavailableKnob.source_ref.json_pointer = "/candidates/0/executed_s6_knobs/1/requested_value";
    unavailableKnob.evidence_ref.json_pointer = "/candidates/0/executed_s6_knobs/1/resolved_value";
    unavailableKnob.source_ref.availability = "not_applicable";
    unavailableKnob.evidence_ref.availability = "not_applicable";
    report.candidates![0].executed_s6_knobs!.push(unavailableKnob);

    const rawText = JSON.stringify(report, (_key, value) => (typeof value === "bigint" ? Number(value) : value));
    const parsed = parseJsonLossless(rawText.replaceAll('"__UINT64__"', "9007199254740993"));
    const adapted = adaptReport("design_space", parsed).report!;
    const normalizedKnob = adapted.candidates![0].executed_s6_knobs![0];
    expect(normalizedKnob.value).toBe(9_007_199_254_740_993n);
    expect(normalizedKnob.requested_value).toBe(9_007_199_254_740_993n);
    expect(normalizedKnob.resolved_value).toBe(9_007_199_254_740_993n);
    expect(adapted.candidates![1].executed_s6_knobs![0].value).toBe(0n);
    const analysis = buildDesignSpaceAnalysis(adapted, formalManifest());
    expect(analysis.candidates[0].availability).toBe("partial");
    expect(adapted.candidates![0].executed_s6_knobs![1].availability).toBe("not_applicable");
    expect(adapted.candidates![0].executed_s6_knobs![1].value).toBeNull();
  });

  it("normalizes formal Fabric-domain uint64 counters and times to bigint", () => {
    const raw = parseJsonLossless(`{
      "schema_version":"tilesim.metrics_report.v1",
      "run_id":"run-f7-test",
      "request_metrics":[],
      "percentile_subjects":[],
      "system_summary":{
        "fabric_domain_utilization":[{
          "domain_id":"scale-up",
          "record_count":18446744073709551615,
          "busy_time_ps":9007199254740993,
          "observation_window_ps":18446744073709551615
        }],
        "phase_fabric_contributions":[]
      }
    }`);
    const adapted = adaptReport("metrics", raw).report!;
    const domain = adapted.system_summary!.fabric_domain_utilization![0];
    expect(domain.record_count).toBe(18_446_744_073_709_551_615n);
    expect(domain.busy_time_ps).toBe(9_007_199_254_740_993n);
    expect(domain.observation_window_ps).toBe(18_446_744_073_709_551_615n);
  });

  it("joins metrics to a unique topology domain through the formal EvidenceRef", () => {
    const { metrics } = fixtureReports();
    metrics.system_summary!.fabric_domain_utilization![0].topology_domain_ref = evidenceRef(
      "input-topology",
      "tilesim.s6_topology_input.v1",
      "/topology/domains/0",
      "fabric_domain",
      "scale-up",
    ) as never;
    const analysis = buildFabricAnalysis(metrics, formalManifest(), formalTopology());
    expect(analysis.topologyJoinAvailability).toBe("available");
    expect(analysis.domains[0]).toMatchObject({
      topologyAvailability: "available",
      topologyEvidence: { sourcePath: "input-topology:/topology/domains/0" },
      topologyDomain: {
        domain_id: "scale-up",
        domain_type: "scale_up",
        member_devices: ["gpu-0"],
        module_binding: "fabric-0",
      },
    });
  });

  it("rejects duplicate topology domains and wrong topology subject/run/schema bindings", () => {
    const { metrics } = fixtureReports();
    const reference = evidenceRef(
      "input-topology",
      "tilesim.s6_topology_input.v1",
      "/topology/domains/0",
      "fabric_domain",
      "scale-up",
    );
    metrics.system_summary!.fabric_domain_utilization![0].topology_domain_ref = reference as never;
    const duplicate = formalTopology();
    duplicate.topology.domains.push({
      ...structuredClone(duplicate.topology.domains[0]),
      json_pointer: "/topology/domains/1",
    });
    expect(buildFabricAnalysis(metrics, formalManifest(), duplicate).domains[0].topologyAvailability).toBe(
      "ambiguous_reference",
    );

    const wrongSubject = structuredClone(reference);
    (wrongSubject.subject as { fabric_domain_id?: string }).fabric_domain_id = "other";
    metrics.system_summary!.fabric_domain_utilization![0].topology_domain_ref = wrongSubject as never;
    expect(buildFabricAnalysis(metrics, formalManifest(), formalTopology()).domains[0].topologyAvailability).toBe(
      "invalid_reference",
    );

    const wrongRun = formalTopology();
    wrongRun.run_id = "run-other";
    expect(buildFabricAnalysis(metrics, formalManifest(), wrongRun).domains[0].topologyAvailability).toBe(
      "invalid_reference",
    );

    const wrongSchemaManifest = formalManifest();
    wrongSchemaManifest.artifacts.find((entry) => entry.artifact_id === "input-topology")!.schema_identity =
      "tilesim.s6_topology_input.v999";
    expect(buildFabricAnalysis(metrics, wrongSchemaManifest, formalTopology()).domains[0].topologyAvailability).toBe(
      "invalid_reference",
    );
  });

  it("does not upgrade synthetic provenance to held-out evidence", () => {
    const report = formalDesignSpace();
    report.validation_lane = "held_out_validation";
    report.evidence_tier = "held_out";
    expect(buildDesignSpaceAnalysis(report, formalManifest()).availability).toBe("invalid_reference");
  });

  it("creates exact evidence Pointers only after unique stable-ID matches", () => {
    const { metrics } = fixtureReports();
    const analysis = buildFabricAnalysis(metrics, manifest());
    expect(analysis.artifactAvailability).toBe("available");
    expect(analysis.domains[0]).toMatchObject({
      domain_id: "scale-up",
      availability: "available",
      evidence: {
        artifactId: "metrics",
        sha256: "a".repeat(64),
        sourcePath: "metrics:/system_summary/fabric_domain_utilization/0",
      },
    });
    expect(analysis.requests[0]).toMatchObject({
      request_id: "req-0",
      dominant_phase_id: "phase-0",
      availability: "available",
      evidence: { sourcePath: "metrics:/system_summary/request_fabric_contributions/0" },
      dominantPhase: { phase_id: "phase-0", collective_id: "collective-0" },
      dominantPhaseAvailability: "available",
      dominantPhaseEvidence: { sourcePath: "metrics:/system_summary/phase_fabric_contributions/0" },
    });
    expect(analysis.topologyJoinAvailability).toBe("artifact_identity_missing");
  });

  it("fails closed for duplicate domain and phase IDs instead of choosing an array position", () => {
    const { metrics } = fixtureReports();
    const summary = metrics.system_summary!;
    summary.fabric_domain_utilization!.push(structuredClone(summary.fabric_domain_utilization![0]));
    summary.phase_fabric_contributions!.push(structuredClone(summary.phase_fabric_contributions![0]));
    const analysis = buildFabricAnalysis(metrics, manifest());
    expect(analysis.domains.slice(0, 2).every((domain) => domain.availability === "ambiguous_reference")).toBe(true);
    expect(analysis.domains.slice(0, 2).every((domain) => domain.evidence.sourcePath === null)).toBe(true);
    expect(analysis.requests[0].dominantPhaseAvailability).toBe("ambiguous_reference");
    expect(analysis.requests[0].dominantPhase).toBeNull();
    expect(analysis.requests[0].dominantPhaseEvidence.sourcePath).toBeNull();
  });

  it("keeps backend ranking separate from blocked Pareto and candidate navigation", () => {
    const { designSpace } = fixtureReports();
    const capabilities = buildF7Capabilities(designSpace, manifest());
    expect(capabilities.map(({ key, availability }) => [key, availability])).toEqual([
      ["reported_ranking", "available"],
      ["pareto", "contract_gap"],
      ["candidate_navigation", "contract_gap"],
      ["executed_s6_knobs", "contract_gap"],
      ["topology_domain_join", "contract_gap"],
    ]);
    const navigation = capabilities.find((capability) => capability.key === "candidate_navigation")!;
    expect(navigation.sourcePath).toBeNull();
    expect(navigation.opaqueValues).toContain("CandidateRun:fixture-des-0");
    expect(navigation.opaqueValues).toContain("MetricsReport:fixture-metrics");
  });

  it("does not expose metrics Pointers when artifact identity is unsupported", () => {
    const { metrics } = fixtureReports();
    const rejected = manifest();
    rejected.artifacts = rejected.artifacts.filter((entry) => entry.artifact_id !== "metrics");
    rejected.rejected_artifacts.push({
      artifact_id: "metrics",
      file_name: "metrics.json",
      reason: "unsupported_schema",
      schema_identity: "tilesim.metrics_report.v999",
      json_pointer: "/schema_version",
    });
    const analysis = buildFabricAnalysis(metrics, rejected);
    expect(analysis.artifactAvailability).toBe("unsupported_schema");
    expect(analysis.domains[0].availability).toBe("unsupported_schema");
    expect(analysis.domains[0].evidence.sourcePath).toBeNull();
    expect(analysis.requests[0].evidence.sourcePath).toBeNull();
  });

  it("keeps candidate presentation deterministic and separate from the view", () => {
    const { designSpace } = fixtureReports();
    const candidate = designSpace.ranking[0];
    const presentation = createDesignSpacePresentation((source) => `translated:${source}`);

    expect(unresolvedCandidateKnobs(designSpace.ranking)).toEqual([
      "runtime_scheduler",
      "kv_policy",
      "device_profile",
      "moe_placement",
    ]);
    expect(presentation.metricValue(undefined)).toBe("—");
    expect(presentation.metricValue(10, "µs", false)).toBe("translated:不适用");
    expect(presentation.candidateLinks(candidate)).toContainEqual(["S9 metrics", "MetricsReport:fixture-metrics"]);
    expect(presentation.capabilityTitle(buildF7Capabilities(designSpace, manifest())[1])).toBe(
      "translated:Pareto membership",
    );
  });
});
