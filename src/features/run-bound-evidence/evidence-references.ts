import type { EvidenceRef, ReportBundle, SubjectRef } from "../../contracts/report-model";
import type { ArtifactManifestEntry, ArtifactManifestResponse } from "../../lib/api";
import type { BuildContext, RunBoundAvailability, RunBoundEvidenceNode, RunBoundReference, UniqueMatch } from "./types";

export function uniqueMatch<T>(values: T[], predicate: (value: T) => boolean): UniqueMatch<T> {
  const matches: Array<{ value: T; index: number }> = [];
  values.forEach((value, index) => {
    if (predicate(value)) matches.push({ value, index });
  });
  if (matches.length === 1) return { state: "available", ...matches[0] };
  return { state: matches.length ? "ambiguous_reference" : "missing", value: null, index: -1 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function artifactEntry(
  manifest: ArtifactManifestResponse | null,
  artifactId: string,
): ArtifactManifestEntry | null {
  return manifest?.artifacts.find((entry) => entry.artifact_id === artifactId) || null;
}

function rejectedArtifact(manifest: ArtifactManifestResponse | null, artifactId: string) {
  return manifest?.rejected_artifacts.find((entry) => entry.artifact_id === artifactId) || null;
}

export function artifactAvailability(
  manifest: ArtifactManifestResponse | null,
  artifactId: string,
): Exclude<RunBoundAvailability, "available" | "partial"> | null {
  const entry = artifactEntry(manifest, artifactId);
  if (!entry) {
    const rejected = rejectedArtifact(manifest, artifactId);
    if (rejected?.reason === "unsupported_schema") return "unsupported_schema";
    return rejected ? "invalid_reference" : "artifact_identity_missing";
  }
  if (entry.contract_status === "legacy_compatibility") return "legacy_compatibility";
  if (entry.contract_status === "not_applicable") return "not_applicable";
  return null;
}

export function reference(
  manifest: ArtifactManifestResponse | null,
  artifactId: string,
  jsonPointer: string,
  entityKind: string,
  entityId: string,
  label: string,
): RunBoundReference {
  const entry = artifactEntry(manifest, artifactId);
  return {
    artifactId,
    schemaIdentity: entry?.schema_identity || "",
    sha256: entry?.sha256 || null,
    jsonPointer,
    sourcePath: `${artifactId}:${jsonPointer}`,
    entityKind,
    entityId,
    label,
  };
}

export function identityAware(
  manifest: ArtifactManifestResponse | null,
  artifactIds: string[],
  availability: "available" | "partial",
): RunBoundAvailability {
  for (const artifactId of artifactIds) {
    const degraded = artifactAvailability(manifest, artifactId);
    if (degraded) return degraded;
  }
  return availability;
}

export function unavailableNode(
  subsystem: RunBoundEvidenceNode["subsystem"],
  title: string,
  availability: RunBoundAvailability,
  detail: string,
): RunBoundEvidenceNode {
  return { subsystem, title, availability, detail, entityIds: [], references: [] };
}

export function reportForArtifact(bundle: ReportBundle, artifactId: string): unknown {
  if (artifactId === "metrics") return bundle.metrics;
  if (artifactId === "tail-cause-chain") return bundle.tail;
  if (artifactId === "execution-envelope") return bundle.execution_envelope;
  if (artifactId === "validation") return bundle.validation;
  if (artifactId === "week8-run-evidence") return bundle.run_bound_des_evidence;
  return null;
}

function resolveJsonPointer(root: unknown, pointer: string): unknown {
  if (pointer === "") return root;
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

const subjectIdFields: Partial<Record<SubjectRef["kind"], keyof SubjectRef>> = {
  request: "request_id",
  fabric_phase: "phase_id",
  memory_event: "memory_event_id",
  device_task: "device_task_id",
  collective: "collective_id",
  cause: "cause_id",
  attribution: "attribution_id",
  stage: "stage_id",
  check: "check_id",
};

export function subjectId(subject: SubjectRef): string {
  const field = subjectIdFields[subject.kind];
  return (field && typeof subject[field] === "string" ? subject[field] : subject.id) || "";
}

function recordCarriesSubject(value: unknown, subject: SubjectRef): boolean {
  if (!isRecord(value)) return false;
  const field = subjectIdFields[subject.kind];
  const id = subjectId(subject);
  return Boolean(
    id &&
    ((field && value[field] === id) ||
      (value.kind === subject.kind && value.id === id) ||
      (subject.kind === "run" && value.run_id === id)),
  );
}

export function structuredReference(
  context: BuildContext,
  evidence: EvidenceRef,
  label: string,
): { availability: RunBoundAvailability; reference: RunBoundReference | null; detail: string } {
  if (evidence.availability === "not_applicable") {
    return { availability: "not_applicable", reference: null, detail: "后端明确标记该 EvidenceRef 不适用。" };
  }
  if (evidence.run_id !== context.runId) {
    return { availability: "invalid_reference", reference: null, detail: "EvidenceRef 的 run_id 与当前运行不一致。" };
  }
  const entry = artifactEntry(context.manifest, evidence.artifact_id);
  if (!entry) {
    const rejected = rejectedArtifact(context.manifest, evidence.artifact_id);
    return {
      availability:
        rejected?.reason === "unsupported_schema"
          ? "unsupported_schema"
          : rejected
            ? "invalid_reference"
            : "artifact_identity_missing",
      reference: null,
      detail: "EvidenceRef 指向的 artifact 不在已验证清单中。",
    };
  }
  if (entry.contract_status !== "supported" || entry.schema_identity !== evidence.schema_identity) {
    return {
      availability: entry.contract_status === "legacy_compatibility" ? "legacy_compatibility" : "invalid_reference",
      reference: null,
      detail: "EvidenceRef 的 schema identity 与 artifact manifest 不一致。",
    };
  }
  const target = resolveJsonPointer(reportForArtifact(context.bundle, evidence.artifact_id), evidence.json_pointer);
  if (target === undefined)
    return { availability: "invalid_reference", reference: null, detail: "EvidenceRef 的 JSON Pointer 无法解析。" };
  if (!recordCarriesSubject(target, evidence.subject))
    return { availability: "invalid_reference", reference: null, detail: "Pointer 目标不包含声明的 subject ID。" };
  return {
    availability:
      evidence.availability === "partial"
        ? "partial"
        : evidence.availability === "run_scope_only"
          ? "run_scope_only"
          : "available",
    reference: reference(
      context.manifest,
      evidence.artifact_id,
      evidence.json_pointer,
      evidence.subject.kind,
      subjectId(evidence.subject),
      label,
    ),
    detail: "EvidenceRef 已通过 run、schema、JSON Pointer 与 subject ID 校验。",
  };
}

export function subjectMatchesRequest(subject: SubjectRef, requestId: string): boolean {
  return (subject.kind === "request" && subjectId(subject) === requestId) || subject.request_id === requestId;
}

export function uniqueStrings(values: string[]): boolean {
  return new Set(values).size === values.length;
}
