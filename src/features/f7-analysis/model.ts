import type { ArtifactManifestResponse } from "../../contracts/bridge-api";
import type { S6TopologyInputV1 } from "../../contracts/generated/bridge-contracts";
import type {
  DesignSpaceReport,
  EvidenceRef,
  FabricDomainUtilization,
  MetricsReport,
  PhaseFabricContribution,
  RequestFabricContribution,
} from "../../contracts/report-model";

export type F7Availability =
  | "available"
  | "partial"
  | "run_scope_only"
  | "missing"
  | "ambiguous_reference"
  | "artifact_identity_missing"
  | "unsupported_schema"
  | "legacy_compatibility"
  | "invalid_reference"
  | "contract_gap";

export interface F7EvidenceIdentity {
  runId: string | null;
  artifactId: string;
  schemaIdentity: string | null;
  sha256: string | null;
  sourcePath: string | null;
}

export interface FabricDomainEvidence extends FabricDomainUtilization {
  availability: F7Availability;
  evidence: F7EvidenceIdentity;
  topologyAvailability: F7Availability;
  topologyEvidence: F7EvidenceIdentity;
  topologyDomain: TopologyDomain | null;
}

export interface FabricRequestEvidence extends RequestFabricContribution {
  availability: F7Availability;
  evidence: F7EvidenceIdentity;
  dominantPhase: PhaseFabricContribution | null;
  dominantPhaseAvailability: F7Availability;
  dominantPhaseEvidence: F7EvidenceIdentity;
}

export interface FabricAnalysisModel {
  artifactAvailability: F7Availability;
  artifactEvidence: F7EvidenceIdentity;
  summary: MetricsReport["system_summary"] | null;
  domains: FabricDomainEvidence[];
  requests: FabricRequestEvidence[];
  topologyJoinAvailability: F7Availability;
}

export type TopologyInput = S6TopologyInputV1;
export type TopologyDomain = S6TopologyInputV1["topology"]["domains"][number];

export interface F7CandidateEvidence {
  candidate: DesignSpaceReport["ranking"][number];
  availability: F7Availability;
  evidence: F7EvidenceIdentity;
  objectiveReferences: F7EvidenceIdentity[];
  knobRequestedReferences: F7EvidenceIdentity[];
  knobResolvedReferences: F7EvidenceIdentity[];
}

export interface F7DesignSpaceAnalysis {
  availability: F7Availability;
  artifactEvidence: F7EvidenceIdentity;
  paretoFrontId: string | null;
  objectiveSetId: string | null;
  navigationScope: "artifact_record" | null;
  candidates: F7CandidateEvidence[];
}

export interface F7Capability {
  key: "reported_ranking" | "pareto" | "candidate_navigation" | "executed_s6_knobs" | "topology_domain_join";
  availability: F7Availability;
  sourcePath: string | null;
  opaqueValues: string[];
}

function artifactIdentity(
  manifest: ArtifactManifestResponse | null,
  artifactId: string,
  sourcePath: string | null = null,
  expectedSchemaIdentity?: string,
): { availability: F7Availability; evidence: F7EvidenceIdentity } {
  const rejected = manifest?.rejected_artifacts.find((entry) => entry.artifact_id === artifactId);
  if (rejected) {
    return {
      availability: rejected.reason === "unsupported_schema" ? "unsupported_schema" : "invalid_reference",
      evidence: {
        runId: manifest?.run_id || null,
        artifactId,
        schemaIdentity: rejected.schema_identity || null,
        sha256: null,
        sourcePath: null,
      },
    };
  }
  const entry = manifest?.artifacts.find((artifact) => artifact.artifact_id === artifactId);
  if (!manifest || !entry || !entry.sha256 || !entry.schema_identity) {
    return {
      availability: "artifact_identity_missing",
      evidence: {
        runId: manifest?.run_id || null,
        artifactId,
        schemaIdentity: entry?.schema_identity || null,
        sha256: entry?.sha256 || null,
        sourcePath: null,
      },
    };
  }
  if (expectedSchemaIdentity && entry.schema_identity !== expectedSchemaIdentity) {
    return {
      availability: entry.contract_status === "legacy_compatibility" ? "legacy_compatibility" : "invalid_reference",
      evidence: {
        runId: manifest.run_id,
        artifactId,
        schemaIdentity: entry.schema_identity,
        sha256: entry.sha256,
        sourcePath: null,
      },
    };
  }
  const availability: F7Availability =
    entry.contract_status === "supported"
      ? "available"
      : entry.contract_status === "legacy_compatibility"
        ? "legacy_compatibility"
        : "contract_gap";
  return {
    availability,
    evidence: {
      runId: manifest.run_id,
      artifactId,
      schemaIdentity: entry.schema_identity,
      sha256: entry.sha256,
      sourcePath: availability === "available" ? sourcePath : null,
    },
  };
}

function isTopologyInput(value: unknown): value is TopologyInput {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.schema_version !== "tilesim.s6_topology_input.v1" || typeof record.run_id !== "string") return false;
  const topology = record.topology;
  return Boolean(
    topology && typeof topology === "object" && Array.isArray((topology as { domains?: unknown }).domains),
  );
}

function validReference(
  referenceValue: EvidenceRef | undefined,
  expected: {
    runId: string;
    artifactId: string;
    schemaIdentity: string;
    pointer: string;
    kind: string;
    id: string;
  },
  expectedAvailability = "available",
): boolean {
  return Boolean(
    referenceValue &&
    referenceValue.availability === expectedAvailability &&
    referenceValue.run_id === expected.runId &&
    referenceValue.artifact_id === expected.artifactId &&
    referenceValue.schema_identity === expected.schemaIdentity &&
    referenceValue.json_pointer === expected.pointer &&
    referenceValue.subject.kind === expected.kind &&
    referenceValue.subject.id === expected.id,
  );
}

function topologyDomainFromReference(
  topology: TopologyInput,
  referenceValue: EvidenceRef | undefined,
  manifestRunId: string,
): { availability: F7Availability; domain: TopologyDomain | null; pointer: string | null } {
  if (!referenceValue) return { availability: "missing", domain: null, pointer: null };
  const domainMatch = uniqueField(topology.topology.domains, "domain_id", referenceValue.subject.id);
  if (domainMatch.state !== "available") return { availability: domainMatch.state, domain: null, pointer: null };
  const domain = topology.topology.domains[domainMatch.index];
  const pointer = `/topology/domains/${domainMatch.index}`;
  const valid =
    domain &&
    domain.json_pointer === pointer &&
    referenceValue.json_pointer === pointer &&
    domain.domain_id === referenceValue.subject.id &&
    domain.subject.kind === "fabric_domain" &&
    domain.subject.id === referenceValue.subject.id &&
    domain.subject.fabric_domain_id === referenceValue.subject.id &&
    referenceValue.subject.fabric_domain_id === referenceValue.subject.id &&
    validReference(referenceValue, {
      runId: manifestRunId,
      artifactId: "input-topology",
      schemaIdentity: "tilesim.s6_topology_input.v1",
      pointer,
      kind: "fabric_domain",
      id: referenceValue.subject.id,
    });
  return valid
    ? { availability: "available", domain, pointer }
    : { availability: "invalid_reference", domain: null, pointer: null };
}

function uniqueField<T>(records: T[], field: keyof T, value: unknown): { state: F7Availability; index: number } {
  if (typeof value !== "string" || !value) return { state: "missing", index: -1 };
  const indexes: number[] = [];
  records.forEach((record, index) => {
    if (record[field] === value) indexes.push(index);
  });
  if (indexes.length === 1) return { state: "available", index: indexes[0] };
  return { state: indexes.length ? "ambiguous_reference" : "missing", index: -1 };
}

function evidenceAt(
  base: ReturnType<typeof artifactIdentity>,
  sourcePath: string,
  availability: F7Availability,
): F7EvidenceIdentity {
  return {
    ...base.evidence,
    sourcePath: base.availability === "available" && availability === "available" ? sourcePath : null,
  };
}

export function buildFabricAnalysis(
  metrics: MetricsReport | null,
  manifest: ArtifactManifestResponse | null,
  topologyValue: Record<string, unknown> | null = null,
): FabricAnalysisModel {
  const artifact = artifactIdentity(manifest, "metrics", "metrics:/system_summary", "tilesim.metrics_report.v1");
  const topologyArtifact = artifactIdentity(manifest, "input-topology", null, "tilesim.s6_topology_input.v1");
  const topology = isTopologyInput(topologyValue) ? topologyValue : null;
  const summary = metrics?.system_summary || null;
  const domainRecords = summary?.fabric_domain_utilization || [];
  const requestRecords = summary?.request_fabric_contributions || [];
  const phaseRecords = summary?.phase_fabric_contributions || [];
  const domains = domainRecords.map((domain, index): FabricDomainEvidence => {
    const match = uniqueField(domainRecords, "domain_id", domain.domain_id);
    const availability = artifact.availability === "available" ? match.state : artifact.availability;
    const topologyMatch =
      topologyArtifact.availability !== "available"
        ? { availability: topologyArtifact.availability, domain: null, pointer: null }
        : !topology
          ? { availability: "missing" as const, domain: null, pointer: null }
          : !manifest || topology.run_id !== manifest.run_id
            ? { availability: "invalid_reference" as const, domain: null, pointer: null }
            : topologyDomainFromReference(topology, domain.topology_domain_ref, manifest.run_id);
    return {
      ...domain,
      availability,
      evidence: evidenceAt(artifact, `metrics:/system_summary/fabric_domain_utilization/${index}`, availability),
      topologyAvailability: topologyMatch.availability,
      topologyEvidence: evidenceAt(
        topologyArtifact,
        topologyMatch.pointer ? `input-topology:${topologyMatch.pointer}` : "",
        topologyMatch.availability,
      ),
      topologyDomain: topologyMatch.domain,
    };
  });
  const requests = requestRecords.map((request, index): FabricRequestEvidence => {
    const requestMatch = uniqueField(requestRecords, "request_id", request.request_id);
    const availability = artifact.availability === "available" ? requestMatch.state : artifact.availability;
    const phaseMatch = uniqueField(phaseRecords, "phase_id", request.dominant_phase_id);
    const dominantPhaseAvailability = artifact.availability === "available" ? phaseMatch.state : artifact.availability;
    return {
      ...request,
      availability,
      evidence: evidenceAt(artifact, `metrics:/system_summary/request_fabric_contributions/${index}`, availability),
      dominantPhase: phaseMatch.index >= 0 ? phaseRecords[phaseMatch.index] : null,
      dominantPhaseAvailability,
      dominantPhaseEvidence: evidenceAt(
        artifact,
        phaseMatch.index >= 0 ? `metrics:/system_summary/phase_fabric_contributions/${phaseMatch.index}` : "",
        dominantPhaseAvailability,
      ),
    };
  });
  return {
    artifactAvailability: artifact.availability,
    artifactEvidence: artifact.evidence,
    summary,
    domains,
    requests,
    topologyJoinAvailability:
      domains.length && domains.every((domain) => domain.topologyAvailability === "available")
        ? "available"
        : domains.some((domain) => domain.topologyAvailability === "available")
          ? "partial"
          : topologyArtifact.availability === "available"
            ? "invalid_reference"
            : topologyArtifact.availability,
  };
}

function opaqueCandidateValues(report: DesignSpaceReport): string[] {
  return report.ranking.flatMap((candidate) =>
    [
      candidate.des_refinement_link,
      candidate.validation_link,
      candidate.metrics_link,
      candidate.tail_attribution_link,
    ].filter((value): value is string => typeof value === "string" && Boolean(value)),
  );
}

function isExactUint64(value: unknown): boolean {
  try {
    if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0;
    if (typeof value === "string" && !/^\d+$/.test(value)) return false;
    const integer = BigInt(value as bigint | string);
    return integer >= 0n && integer <= 18_446_744_073_709_551_615n;
  } catch {
    return false;
  }
}

export function buildDesignSpaceAnalysis(
  report: DesignSpaceReport | null,
  manifest: ArtifactManifestResponse | null,
): F7DesignSpaceAnalysis {
  const artifact = artifactIdentity(manifest, "design-space", null, "tilesim.design_space_report.v1");
  const empty = (availability: F7Availability): F7DesignSpaceAnalysis => ({
    availability,
    artifactEvidence: artifact.evidence,
    paretoFrontId: null,
    objectiveSetId: null,
    navigationScope: null,
    candidates: [],
  });
  if (!report) return empty("missing");
  if (report.schema_version !== "tilesim.design_space_report.v1") return empty("legacy_compatibility");
  if (!manifest || report.run_id !== manifest.run_id) return empty("invalid_reference");
  if (artifact.availability !== "available") return empty(artifact.availability);

  const candidates = report.candidates || [];
  const candidateIds = candidates.map((candidate) => candidate.candidate_id);
  const duplicateCandidateIds = new Set(candidateIds).size !== candidateIds.length;
  const countMatches = (() => {
    try {
      return BigInt(report.candidate_count ?? -1) === BigInt(candidates.length);
    } catch {
      return false;
    }
  })();
  const provenanceValid =
    report.execution_scope === "S6_only" &&
    report.provenance?.source_mode === report.candidate_source_mode &&
    report.provenance?.calibration_level === report.candidate_calibration_level &&
    report.provenance?.allowed_claim_scope === report.candidate_allowed_claim_scope &&
    (report.provenance?.source_mode !== "synthetic_trace" ||
      (report.validation_lane === "synthetic_consistency" && report.evidence_tier === "synthetic_consistency"));
  const dominanceGraphValid = candidates.every((candidate) => {
    const dominatedBy = candidate.dominated_by_candidate_ids || [];
    const dominates = candidate.dominates_candidate_ids || [];
    return (
      new Set(dominatedBy).size === dominatedBy.length &&
      new Set(dominates).size === dominates.length &&
      [...dominatedBy, ...dominates].every((id) => id !== candidate.candidate_id && candidateIds.includes(id))
    );
  });
  const reportValid =
    countMatches &&
    provenanceValid &&
    !duplicateCandidateIds &&
    dominanceGraphValid &&
    Boolean(report.pareto_front_id) &&
    Boolean(report.objective_set_id);

  const results = candidates.map((candidate, candidateIndex): F7CandidateEvidence => {
    const pointer = `/candidates/${candidateIndex}`;
    const candidateId = candidate.candidate_id;
    const expected = {
      runId: manifest.run_id,
      artifactId: "design-space",
      schemaIdentity: "tilesim.design_space_report.v1",
      pointer,
      kind: "candidate",
      id: candidateId,
    };
    const candidateRefs = (candidate.evidence_refs || []).filter(
      (entry) => entry.subject.kind === "candidate" && entry.subject.id === candidateId,
    );
    const candidateRef = candidateRefs.length === 1 ? candidateRefs[0] : undefined;
    const subjectRefs = (candidate.subject_refs || []).filter(
      (entry) => entry.kind === "candidate" && entry.id === candidateId && entry.candidate_id === candidateId,
    );
    const navigation = candidate.navigation;
    const candidateRecordValid =
      reportValid &&
      candidateRefs.length === 1 &&
      subjectRefs.length === 1 &&
      validReference(candidateRef, expected) &&
      navigation?.navigation_scope === "artifact_record" &&
      navigation.bridge_run_id === null &&
      Boolean(navigation.backend_run_instance_id) &&
      navigation.parent_run_id === manifest.run_id &&
      navigation.candidate_id === candidateId &&
      validReference(navigation.record_ref, expected) &&
      candidate.pareto_front_id === report.pareto_front_id &&
      candidate.objective_set_id === report.objective_set_id &&
      ["analytical", "des"].includes(candidate.requested_fidelity || "") &&
      ["analytical", "des"].includes(candidate.resolved_fidelity || "");
    let referencesValid = candidateRecordValid;
    let hasUnavailableData = false;

    const objectiveIds = (candidate.objectives || []).map((objective) => objective.objective_id);
    const objectiveReferences = (candidate.objectives || []).map((objective, objectiveIndex) => {
      const objectivePointer = `${pointer}/objectives/${objectiveIndex}`;
      const objectiveId = `${candidateId}::${objective.objective_id}`;
      const valueValid =
        objective.availability === "available"
          ? typeof objective.value === "number" && Number.isFinite(objective.value)
          : objective.value === null;
      const semanticsValid =
        (objective.metric_kind !== "p99_latency" || (objective.direction === "minimize" && objective.unit === "us")) &&
        (objective.metric_kind !== "throughput" ||
          (objective.direction === "maximize" && objective.unit === "requests_per_second"));
      const valid =
        new Set(objectiveIds).size === objectiveIds.length &&
        valueValid &&
        semanticsValid &&
        validReference(
          objective.evidence_ref,
          { ...expected, pointer: objectivePointer, kind: "objective", id: objectiveId },
          objective.availability,
        );
      if (!valid) referencesValid = false;
      if (objective.availability !== "available") hasUnavailableData = true;
      return evidenceAt(artifact, `design-space:${objectivePointer}`, valid ? "available" : "invalid_reference");
    });

    const knobIds = (candidate.executed_s6_knobs || []).map((knob) => knob.knob_id);
    const knobRequestedReferences: F7EvidenceIdentity[] = [];
    const knobResolvedReferences: F7EvidenceIdentity[] = [];
    (candidate.executed_s6_knobs || []).forEach((knob, knobIndex) => {
      const knobId = `${candidateId}::${knob.knob_id}`;
      const base = `${pointer}/executed_s6_knobs/${knobIndex}`;
      const idsUnique = new Set(knobIds).size === knobIds.length;
      const valuesValid =
        knob.availability === "available"
          ? [knob.value, knob.requested_value, knob.resolved_value].every((value) => value !== null) &&
            (knob.value_type !== "uint64" ||
              [knob.value, knob.requested_value, knob.resolved_value].every((value) => isExactUint64(value)))
          : knob.value === null && knob.requested_value === null && knob.resolved_value === null;
      const sourceValid =
        idsUnique &&
        valuesValid &&
        knob.subsystem === "S6" &&
        validReference(
          knob.source_ref,
          { ...expected, pointer: `${base}/requested_value`, kind: "executed_s6_knob", id: knobId },
          knob.availability,
        );
      const resolvedValid =
        idsUnique &&
        valuesValid &&
        validReference(
          knob.evidence_ref,
          { ...expected, pointer: `${base}/resolved_value`, kind: "executed_s6_knob", id: knobId },
          knob.availability,
        );
      if (!sourceValid || !resolvedValid) referencesValid = false;
      if (knob.availability !== "available") hasUnavailableData = true;
      knobRequestedReferences.push(
        evidenceAt(artifact, `design-space:${base}/requested_value`, sourceValid ? "available" : "invalid_reference"),
      );
      knobResolvedReferences.push(
        evidenceAt(artifact, `design-space:${base}/resolved_value`, resolvedValid ? "available" : "invalid_reference"),
      );
    });

    const availability: F7Availability = duplicateCandidateIds
      ? "ambiguous_reference"
      : !referencesValid
        ? "invalid_reference"
        : hasUnavailableData
          ? "partial"
          : "available";
    return {
      candidate,
      availability,
      evidence: evidenceAt(artifact, `design-space:${pointer}`, candidateRecordValid ? "available" : availability),
      objectiveReferences,
      knobRequestedReferences,
      knobResolvedReferences,
    };
  });

  const availability: F7Availability = !reportValid
    ? duplicateCandidateIds
      ? "ambiguous_reference"
      : "invalid_reference"
    : results.length && results.every((candidate) => candidate.availability === "available")
      ? "available"
      : "partial";
  return {
    availability,
    artifactEvidence: artifact.evidence,
    paretoFrontId: report.pareto_front_id || null,
    objectiveSetId: report.objective_set_id || null,
    navigationScope: "artifact_record",
    candidates: results,
  };
}

export function buildF7Capabilities(
  report: DesignSpaceReport | null,
  manifest: ArtifactManifestResponse | null,
  metrics: MetricsReport | null = null,
  topology: Record<string, unknown> | null = null,
): F7Capability[] {
  const formal = buildDesignSpaceAnalysis(report, manifest);
  if (formal.candidates.length) {
    const fabric = buildFabricAnalysis(metrics, manifest, topology);
    const availability = formal.availability;
    return [
      {
        key: "reported_ranking",
        availability,
        sourcePath: availability === "available" ? "design-space:/candidates" : null,
        opaqueValues: [],
      },
      {
        key: "pareto",
        availability,
        sourcePath: availability === "available" ? "design-space:/candidates" : null,
        opaqueValues: [],
      },
      {
        key: "candidate_navigation",
        availability,
        sourcePath: availability === "available" ? "design-space:/candidates" : null,
        opaqueValues: [],
      },
      {
        key: "executed_s6_knobs",
        availability,
        sourcePath: availability === "available" ? "design-space:/candidates" : null,
        opaqueValues: [],
      },
      {
        key: "topology_domain_join",
        availability: fabric.topologyJoinAvailability,
        sourcePath: null,
        opaqueValues: [],
      },
    ];
  }
  const designArtifact = artifactIdentity(manifest, "design-space", "design-space:/ranking");
  const rankingAvailability: F7Availability = !report
    ? "missing"
    : designArtifact.availability === "available"
      ? "available"
      : designArtifact.availability;
  const opaqueValues = report ? opaqueCandidateValues(report) : [];
  return [
    {
      key: "reported_ranking",
      availability: rankingAvailability,
      sourcePath: rankingAvailability === "available" ? "design-space:/ranking" : null,
      opaqueValues: [],
    },
    { key: "pareto", availability: "contract_gap", sourcePath: null, opaqueValues: [] },
    { key: "candidate_navigation", availability: "contract_gap", sourcePath: null, opaqueValues },
    { key: "executed_s6_knobs", availability: "contract_gap", sourcePath: null, opaqueValues: [] },
    { key: "topology_domain_join", availability: "contract_gap", sourcePath: null, opaqueValues: [] },
  ];
}
