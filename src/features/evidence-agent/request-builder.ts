import type {
  ArtifactManifestResponse,
  EvidenceAgentDescriptorResponse,
  EvidenceAgentRequest,
  HealthResponse,
} from "../../contracts/bridge-api";
import type {
  AllowedRecord,
  ArtifactAllowListEntry,
  EvidenceScope,
  Subject,
} from "../../contracts/generated/bridge-contracts";
import { isLosslessInteger, losslessIntegerToBigInt } from "../../contracts/lossless-json";
import type { ReportBundle, RunInputs } from "../../contracts/report-model";
import type { StructuredPerformanceReport, StructuredRunBoundReference } from "../structured-report";
import { canonicalJson, sha256Prefixed } from "./canonical-json";
import { EvidenceAgentContractError } from "./errors";
import type { EvidenceArtifactRoots, PreparedEvidenceAgentRequest } from "./types";

const subjectKinds = new Set<Subject["kind"]>([
  "run",
  "request",
  "fabric_phase",
  "memory_event",
  "device_task",
  "collective",
  "cause",
  "attribution",
  "stage",
  "check",
  "candidate",
  "fabric_domain",
  "objective",
  "executed_s6_knob",
]);

const subjectFields: Partial<Record<Subject["kind"], string>> = {
  run: "run_id",
  request: "request_id",
  fabric_phase: "phase_id",
  memory_event: "memory_event_id",
  device_task: "device_task_id",
  collective: "collective_id",
  cause: "cause_id",
  attribution: "attribution_id",
  stage: "stage_id",
  check: "check_id",
  candidate: "candidate_id",
  fabric_domain: "domain_id",
  objective: "objective_id",
};

const availabilityStates = new Set<EvidenceScope["availability_states_present"][number]>([
  "available",
  "missing",
  "expected_absence",
  "not_covered",
  "unsupported_schema",
  "not_applicable",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function evidenceAgentBackendIdentity(identity: HealthResponse | null): string {
  if (!identity) return "";
  return [identity.source_revision, identity.build_revision, identity.source_state_digest, identity.build_state_digest]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("|");
}

function requiredIdentity(identity: HealthResponse, field: keyof HealthResponse): string {
  const value = identity[field];
  if (typeof value !== "string" || !value) throw new EvidenceAgentContractError("backend_identity_missing");
  return value;
}

function artifactRoots(bundle: ReportBundle, inputs: RunInputs): EvidenceArtifactRoots {
  return {
    "input-runtime-trace": inputs.runtime_trace,
    "input-topology": inputs.topology,
    "run-result": bundle.run,
    metrics: bundle.metrics,
    validation: bundle.validation,
    "tail-cause-chain": bundle.tail,
    "execution-envelope": bundle.execution_envelope,
    "design-space": bundle.design_space,
    "week8-run-evidence": bundle.run_bound_des_evidence,
  };
}

export function resolveEvidencePointer(root: unknown, pointer: string): unknown {
  if (!pointer.startsWith("/")) return undefined;
  let value = root;
  for (const token of pointer.slice(1).split("/")) {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(value)) {
      if (!/^(0|[1-9]\d*)$/.test(key)) return undefined;
      value = value[Number(key)];
    } else if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, key)) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return value;
}

export function recordCarriesEvidenceSubject(value: unknown, subject: Subject): boolean {
  if (!isRecord(value) || !subject.id) return false;
  const field = subjectFields[subject.kind];
  if (field && value[field] === subject.id) return true;
  if (isRecord(value.subject) && value.subject.kind === subject.kind && value.subject.id === subject.id) return true;
  return value.kind === subject.kind && value.id === subject.id;
}

function subjectIsUniqueInContainingCollection(root: unknown, pointer: string, subject: Subject): boolean {
  const separator = pointer.lastIndexOf("/");
  const parentPointer = separator > 0 ? pointer.slice(0, separator) : "";
  const parent = parentPointer ? resolveEvidencePointer(root, parentPointer) : root;
  return !Array.isArray(parent) || parent.filter((entry) => recordCarriesEvidenceSubject(entry, subject)).length === 1;
}

function exactSubject(reference: StructuredRunBoundReference, target: unknown): Subject | null {
  if (subjectKinds.has(reference.subject.kind as Subject["kind"])) {
    return { kind: reference.subject.kind as Subject["kind"], id: reference.subject.id };
  }
  if (reference.subject.kind === "cause_or_attribution" && isRecord(target)) {
    if (target.cause_id === reference.subject.id) return { kind: "cause", id: reference.subject.id };
    if (target.attribution_id === reference.subject.id) return { kind: "attribution", id: reference.subject.id };
  }
  return null;
}

function reportReferences(report: StructuredPerformanceReport): StructuredRunBoundReference[] {
  return [
    ...report.run_bound_evidence.percentile_subjects.flatMap((subject) =>
      subject.reference ? [subject.reference] : [],
    ),
    ...report.run_bound_evidence.nodes.flatMap((node) => node.references),
    ...(report.run_bound_evidence.week8_execution.reference
      ? [report.run_bound_evidence.week8_execution.reference]
      : []),
  ];
}

function collectAllowedRecords(
  report: StructuredPerformanceReport,
  manifest: ArtifactManifestResponse,
  roots: EvidenceArtifactRoots,
): Map<string, AllowedRecord[]> {
  const records = new Map<string, AllowedRecord[]>();
  const seen = new Set<string>();
  for (const reference of reportReferences(report)) {
    if (reference.run_id !== manifest.run_id || !reference.json_pointer.startsWith("/")) continue;
    const artifact = manifest.artifacts.find((entry) => entry.artifact_id === reference.artifact_id);
    if (
      !artifact ||
      artifact.contract_status !== "supported" ||
      artifact.schema_identity !== reference.schema_identity ||
      artifact.sha256 !== reference.sha256
    ) {
      continue;
    }
    const target = resolveEvidencePointer(roots[reference.artifact_id], reference.json_pointer);
    const subject = exactSubject(reference, target);
    if (
      !subject ||
      !recordCarriesEvidenceSubject(target, subject) ||
      !subjectIsUniqueInContainingCollection(roots[reference.artifact_id], reference.json_pointer, subject)
    )
      continue;
    const key = `${reference.artifact_id}\u0000${reference.json_pointer}\u0000${subject.kind}\u0000${subject.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const artifactRecords = records.get(reference.artifact_id) || [];
    artifactRecords.push({ json_pointer: reference.json_pointer, subject });
    records.set(reference.artifact_id, artifactRecords);
  }
  for (const [artifactId, artifactRecords] of records) {
    const identityPointers = new Map<string, Set<string>>();
    for (const record of artifactRecords) {
      const identity = `${record.subject.kind}\u0000${record.subject.id}`;
      const pointers = identityPointers.get(identity) || new Set<string>();
      pointers.add(record.json_pointer);
      identityPointers.set(identity, pointers);
    }
    if ([...identityPointers.values()].some((pointers) => pointers.size > 1)) {
      throw new EvidenceAgentContractError("ambiguous_reference", artifactId);
    }
  }
  return records;
}

function collectAvailabilityStates(
  value: unknown,
  states = new Set<EvidenceScope["availability_states_present"][number]>(),
) {
  if (typeof value === "string" && availabilityStates.has(value as never)) {
    states.add(value as EvidenceScope["availability_states_present"][number]);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectAvailabilityStates(entry, states));
  } else if (isRecord(value)) {
    Object.values(value).forEach((entry) => collectAvailabilityStates(entry, states));
  }
  return states;
}

function evidenceScope(report: StructuredPerformanceReport, selectedRequestId: string | null): EvidenceScope {
  const execution = report.run_bound_evidence.week8_execution;
  const sourceMode = report.evidence_boundary.source_mode;
  if (!sourceMode || !["real_trace", "synthetic_trace", "compatibility_harness_trace"].includes(sourceMode)) {
    throw new EvidenceAgentContractError("provenance_scope_missing");
  }
  if (!report.evidence_boundary.calibration_level || !report.evidence_boundary.allowed_claim_scope) {
    throw new EvidenceAgentContractError("provenance_scope_missing");
  }
  const requestedValue = execution.requested_fidelity?.toLowerCase();
  const resolvedValue = execution.resolved_fidelity?.toLowerCase();
  const modeValue = execution.execution_mode?.toLowerCase();
  const requestedFidelity =
    requestedValue === "des"
      ? "des"
      : requestedValue === "analytical"
        ? "analytical"
        : requestedValue === "default" || requestedValue === "policy_default"
          ? "policy_default"
          : null;
  const resolvedFidelity = ["analytical", "des", "mixed", "not_applicable"].includes(resolvedValue || "")
    ? (resolvedValue as EvidenceScope["resolved_fidelity"])
    : null;
  const executionMode = [
    "analytical",
    "des",
    "partitioned_des",
    "single_process_fallback",
    "mixed",
    "not_applicable",
  ].includes(modeValue || "")
    ? (modeValue as EvidenceScope["execution_mode"])
    : null;
  if (!requestedFidelity || !resolvedFidelity || !executionMode) {
    throw new EvidenceAgentContractError("fidelity_scope_missing");
  }
  const allowedClaimScope = report.evidence_boundary.allowed_claim_scope;
  const claimScopeClass: EvidenceScope["claim_scope_class"] =
    sourceMode === "compatibility_harness_trace"
      ? "compatibility_only"
      : sourceMode === "synthetic_trace"
        ? allowedClaimScope.includes("synthetic_consistency")
          ? "synthetic_consistency"
          : "exploratory"
        : report.evidence_boundary.validation_lane?.includes("held_out") && allowedClaimScope.includes("held_out")
          ? "held_out_validated"
          : "real_trace_calibrated";
  const percentile = report.run_bound_evidence.percentile_subjects.find(
    (subject) =>
      subject.percentile === 99 &&
      (!selectedRequestId ||
        subject.selected_request_id === selectedRequestId ||
        subject.member_request_ids.includes(selectedRequestId)),
  );
  return {
    source_mode: sourceMode as EvidenceScope["source_mode"],
    calibration_level: report.evidence_boundary.calibration_level,
    allowed_claim_scope: allowedClaimScope,
    claim_scope_class: claimScopeClass,
    requested_fidelity: requestedFidelity,
    resolved_fidelity: resolvedFidelity,
    execution_mode: executionMode,
    canonical_flow: "S0 -> S1 -> S2 -> {S3,S4,S5} -> S6",
    resource_semantics_relation: "S3_S4_S5_peer",
    execution_host: "S7",
    validation_plane: "S8",
    output_plane: "S9",
    percentile_subject: percentile
      ? {
          selection_semantics: percentile.selection_semantics,
          selected_request_id: percentile.selected_request_id,
          member_request_ids: [...percentile.member_request_ids],
        }
      : { selection_semantics: "missing", selected_request_id: null, member_request_ids: [] },
    availability_states_present: [...collectAvailabilityStates(report)].sort(),
  };
}

function canonicalManifest(manifest: ArtifactManifestResponse): Record<string, unknown> {
  return {
    ...manifest,
    artifacts: manifest.artifacts.map((entry) => {
      if (!isLosslessInteger(entry.bytes)) throw new EvidenceAgentContractError("artifact_byte_count_invalid");
      return { ...entry, bytes: losslessIntegerToBigInt(entry.bytes) };
    }),
  };
}

export interface BuildEvidenceAgentSnapshotOptions {
  runId: string;
  selectedRequestId: string | null;
  manifest: ArtifactManifestResponse;
  descriptor: EvidenceAgentDescriptorResponse;
  health: HealthResponse;
  structuredReport: StructuredPerformanceReport;
  bundle: ReportBundle;
  inputs: RunInputs;
}

export interface BuildEvidenceAgentRequestOptions extends BuildEvidenceAgentSnapshotOptions {
  locale: EvidenceAgentRequest["locale"];
  taskKind: EvidenceAgentRequest["task_kind"];
  question: string;
  clientRequestId: string;
}

async function buildEvidenceAgentSnapshot(options: BuildEvidenceAgentSnapshotOptions) {
  const { descriptor, manifest, runId } = options;
  if (manifest.run_id !== runId || manifest.schema_set_revision !== descriptor.schema_set_revision) {
    throw new EvidenceAgentContractError("run_binding_mismatch");
  }
  const roots = artifactRoots(options.bundle, options.inputs);
  const records = collectAllowedRecords(options.structuredReport, manifest, roots);
  const allowList = manifest.artifacts
    .filter((entry) => entry.contract_status === "supported" && (records.get(entry.artifact_id)?.length || 0) > 0)
    .map((entry): ArtifactAllowListEntry => ({
      run_id: runId,
      artifact_id: entry.artifact_id,
      schema_identity: entry.schema_identity,
      sha256: entry.sha256,
      bytes: losslessIntegerToBigInt(entry.bytes),
      allowed_records: records.get(entry.artifact_id) as ArtifactAllowListEntry["allowed_records"],
    }));
  if (!allowList.length) throw new EvidenceAgentContractError("insufficient_evidence");
  if (allowList.length > descriptor.limits.maximum_artifacts) {
    throw new EvidenceAgentContractError("maximum_artifacts_exceeded");
  }
  if (allowList.some((entry) => entry.allowed_records.length > descriptor.limits.maximum_records_per_artifact)) {
    throw new EvidenceAgentContractError("maximum_records_exceeded");
  }
  const artifactManifestCanonicalSha256 = await sha256Prefixed(canonicalJson(canonicalManifest(manifest)));
  const snapshotReference: EvidenceAgentRequest["snapshot_reference"] = {
    schema_version: "tilesim.bridge.evidence_snapshot_reference.v1",
    artifact_manifest_schema_identity: "tilesim.bridge.artifact_manifest.v2",
    artifact_manifest_canonical_sha256: artifactManifestCanonicalSha256,
    backend_identity: {
      source_revision: requiredIdentity(options.health, "source_revision"),
      build_revision: requiredIdentity(options.health, "build_revision"),
      source_state_digest: requiredIdentity(options.health, "source_state_digest"),
      build_state_digest: requiredIdentity(options.health, "build_state_digest"),
      versions_match: options.health.versions_match === true,
      state_digests_match: options.health.state_digests_match === true,
    },
    evidence_scope: evidenceScope(options.structuredReport, options.selectedRequestId),
  };
  if (!snapshotReference.backend_identity.versions_match || !snapshotReference.backend_identity.state_digests_match) {
    throw new EvidenceAgentContractError("backend_identity_mismatch");
  }
  const snapshotMaterialCandidates = {
    schema_version: "tilesim.bridge.evidence_agent_request.v1",
    schema_set_revision: descriptor.schema_set_revision,
    run_id: runId,
    structured_report_schema_identity: "tilesim.web.structured-performance-report.v2",
    snapshot_reference: snapshotReference,
    artifact_allow_list: allowList,
  };
  const digestContract = descriptor.digest_contract as unknown as {
    input_snapshot_material_fields: Array<keyof typeof snapshotMaterialCandidates>;
    excluded_untrusted_fields: string[];
  };
  const expectedExcluded = ["locale", "task_kind", "client_request_id", "user_question"];
  if (
    digestContract.input_snapshot_material_fields.length !== 6 ||
    digestContract.input_snapshot_material_fields.some((field) => !(field in snapshotMaterialCandidates)) ||
    canonicalJson(digestContract.excluded_untrusted_fields) !== canonicalJson(expectedExcluded)
  ) {
    throw new EvidenceAgentContractError("digest_contract_unsupported");
  }
  const snapshotMaterial = Object.fromEntries(
    digestContract.input_snapshot_material_fields.map((field) => [field, snapshotMaterialCandidates[field]]),
  ) as typeof snapshotMaterialCandidates;
  const inputSnapshotDigest = await sha256Prefixed(canonicalJson(snapshotMaterial));
  return { roots, snapshotMaterial, inputSnapshotDigest };
}

export async function buildEvidenceAgentSnapshotDigest(options: BuildEvidenceAgentSnapshotOptions): Promise<string> {
  return (await buildEvidenceAgentSnapshot(options)).inputSnapshotDigest;
}

export async function buildEvidenceAgentRequest(
  options: BuildEvidenceAgentRequestOptions,
): Promise<PreparedEvidenceAgentRequest> {
  const { descriptor, manifest, runId } = options;
  if (
    descriptor.availability !== "available" ||
    !descriptor.provider.configured ||
    !descriptor.availability_predicate.evaluated_available
  ) {
    throw new EvidenceAgentContractError(descriptor.degradation.reason_code || "provider_unavailable");
  }
  if (manifest.run_id !== runId || manifest.schema_set_revision !== descriptor.schema_set_revision) {
    throw new EvidenceAgentContractError("run_binding_mismatch");
  }
  if (
    !descriptor.supported_locales.includes(options.locale) ||
    !descriptor.supported_task_kinds.includes(options.taskKind)
  ) {
    throw new EvidenceAgentContractError("unsupported_agent_input");
  }
  const question = options.question.trim();
  if (!question || Array.from(question).length > descriptor.limits.maximum_question_characters) {
    throw new EvidenceAgentContractError("question_length_invalid");
  }
  const { inputSnapshotDigest, roots, snapshotMaterial } = await buildEvidenceAgentSnapshot(options);
  const request = {
    ...snapshotMaterial,
    input_snapshot_digest: inputSnapshotDigest,
    locale: options.locale,
    task_kind: options.taskKind,
    client_request_id: options.clientRequestId,
    user_question: { content: question, trust_level: "untrusted_user_content" as const },
  } as EvidenceAgentRequest;
  const canonicalText = canonicalJson(request);
  if (new TextEncoder().encode(canonicalText).byteLength > descriptor.limits.maximum_request_bytes) {
    throw new EvidenceAgentContractError("input_too_large");
  }
  return {
    request,
    canonicalText,
    payloadDigest: await sha256Prefixed(canonicalText),
    inputSnapshotDigest,
    artifactRoots: roots,
  };
}
