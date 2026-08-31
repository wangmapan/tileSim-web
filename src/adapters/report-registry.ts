import type { ErrorObject } from "ajv";
import {
  designSpace as validateDesignSpace,
  executionEnvelope as validateExecutionEnvelope,
  metrics as validateMetrics,
  run as validateRun,
  tail as validateTail,
  validation as validateValidation,
} from "../contracts/generated/report-validators.js";
import type { CompatibilityResult, ReportByKind, ReportKind } from "../contracts/report-model";
import { isLosslessInteger, losslessIntegerToBigInt } from "../contracts/lossless-json";

type JsonRecord = Record<string, unknown>;

const supportedContracts: Partial<Record<ReportKind, Set<string>>> = {
  run: new Set(["wind_tunnel.run.v1alpha1"]),
  metrics: new Set(["tilesim.metrics_report.v1"]),
  validation: new Set(["tilesim.validation_report.v1"]),
  tail: new Set(["tilesim.tail_cause_chain_report.v1"]),
  design_space: new Set(["design_space.report.v1alpha1", "tilesim.design_space_report.v1"]),
  execution_envelope: new Set(["tilesim.s7_execution_envelope.v1"]),
  run_bound_des_evidence: new Set(["tilesim.s7_run_bound_des_evidence.v1"]),
};
type StandaloneValidate = ((data: unknown) => boolean) & { errors?: ErrorObject[] | null };

const validators = {
  run: validateRun,
  metrics: validateMetrics,
  validation: validateValidation,
  tail: validateTail,
  design_space: validateDesignSpace,
  execution_envelope: validateExecutionEnvelope,
} as unknown as Partial<Record<ReportKind, StandaloneValidate>>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatValidationIssues(errors: ErrorObject[] | null | undefined): string[] {
  return (errors || []).map((error) => `${error.instancePath || "/"} ${error.message || "is invalid"}`);
}

export function reportSchemaIdentity(report: unknown): string {
  if (!isRecord(report)) return "";
  if (typeof report.contract_version === "string") return report.contract_version;
  return typeof report.schema_version === "string" ? report.schema_version : "";
}

function legacyShapeIssues(kind: ReportKind, report: JsonRecord): string[] {
  const issues: string[] = [];
  const requireRecord = (key: string) => {
    if (!isRecord(report[key])) issues.push(`/${key} must be an object`);
  };
  const requireArray = (key: string) => {
    if (!Array.isArray(report[key])) issues.push(`/${key} must be an array`);
  };
  if (kind === "run") requireRecord("summary");
  if (kind === "design_space") requireArray("ranking");
  if (kind === "execution_envelope") requireArray("stages");
  if (kind === "run_bound_des_evidence") issues.push("/schema_version must use the Week 8 versioned contract");
  for (const key of ["request_metrics", "resolution_entries", "checks", "cause_chain", "attribution_ranking"]) {
    if (report[key] !== undefined && !Array.isArray(report[key])) issues.push(`/${key} must be an array`);
  }
  return issues;
}

function f6bShapeIssues(kind: ReportKind, report: JsonRecord): string[] {
  const issues: string[] = [];
  if (typeof report.run_id !== "string" || !report.run_id) issues.push("/run_id must be a non-empty string");
  const requireArray = (key: string) => {
    if (!Array.isArray(report[key])) issues.push(`/${key} must be an array`);
  };
  if (kind === "metrics") {
    requireArray("request_metrics");
    requireArray("percentile_subjects");
    if (!isRecord(report.system_summary) || !Array.isArray(report.system_summary.phase_fabric_contributions))
      issues.push("/system_summary/phase_fabric_contributions must be an array");
    for (const [index, subject] of (Array.isArray(report.percentile_subjects)
      ? report.percentile_subjects
      : []
    ).entries()) {
      if (!isRecord(subject) || !isLosslessInteger(subject.value_ps))
        issues.push(`/percentile_subjects/${index}/value_ps must be a lossless integer`);
    }
  }
  if (kind === "tail") {
    requireArray("cause_chain");
    requireArray("attribution_ranking");
  }
  if (kind === "validation") requireArray("checks");
  if (kind === "execution_envelope") {
    requireArray("stages");
    requireArray("evidence_refs");
  }
  if (kind === "design_space") {
    requireArray("candidates");
    if (report.execution_scope !== "S6_only") issues.push("/execution_scope must be S6_only");
  }
  if (kind === "run_bound_des_evidence") {
    for (const key of ["fallback", "provenance", "state_summary", "differential", "stream", "checkpoint"])
      if (!isRecord(report[key])) issues.push(`/${key} must be an object`);
    const paths = [
      ["state_summary", "logical_time_ps"],
      ["state_summary", "partition_count"],
      ["state_summary", "committed_event_count"],
      ["state_summary", "pending_event_count"],
      ["state_summary", "stream_record_count"],
      ["state_summary", "total_stream_record_count"],
      ["stream", "record_count"],
      ["stream", "total_record_count"],
      ["checkpoint", "checkpoint_logical_time_ps"],
      ["checkpoint", "committed_event_count"],
      ["checkpoint", "pending_event_count"],
      ["checkpoint", "completed_identity_count"],
      ["checkpoint", "subject_version_count"],
    ] as const;
    for (const [parent, key] of paths) {
      if (!isRecord(report[parent]) || !isLosslessInteger(report[parent][key]))
        issues.push(`/${parent}/${key} must be a lossless integer`);
    }
  }
  return issues;
}

function normalizeF6BReport(kind: ReportKind, report: JsonRecord): JsonRecord {
  if (kind === "metrics") {
    const normalized: JsonRecord = {
      ...report,
      percentile_subjects: Array.isArray(report.percentile_subjects)
        ? report.percentile_subjects.map((subject) =>
            isRecord(subject) && isLosslessInteger(subject.value_ps)
              ? { ...subject, value_ps: losslessIntegerToBigInt(subject.value_ps) }
              : subject,
          )
        : report.percentile_subjects,
    };
    if (isRecord(normalized.system_summary) && Array.isArray(normalized.system_summary.fabric_domain_utilization)) {
      normalized.system_summary = {
        ...normalized.system_summary,
        fabric_domain_utilization: normalized.system_summary.fabric_domain_utilization.map((domain) => {
          if (!isRecord(domain)) return domain;
          const next = { ...domain };
          for (const key of ["record_count", "busy_time_ps", "observation_window_ps"])
            if (isLosslessInteger(next[key])) next[key] = losslessIntegerToBigInt(next[key]);
          return next;
        }),
      };
    }
    return normalized;
  }
  if (kind === "design_space" && Array.isArray(report.candidates)) {
    const normalized = structuredClone(report);
    if (isLosslessInteger(normalized.candidate_count))
      normalized.candidate_count = losslessIntegerToBigInt(normalized.candidate_count);
    const candidates = normalized.candidates;
    if (!Array.isArray(candidates)) return normalized;
    normalized.candidates = candidates.map((candidate) => {
      if (!isRecord(candidate) || !Array.isArray(candidate.executed_s6_knobs)) return candidate;
      return {
        ...candidate,
        executed_s6_knobs: candidate.executed_s6_knobs.map((knob) => {
          if (!isRecord(knob) || knob.value_type !== "uint64" || knob.availability !== "available") return knob;
          const next = { ...knob };
          for (const key of ["value", "requested_value", "resolved_value"])
            if (isLosslessInteger(next[key])) next[key] = losslessIntegerToBigInt(next[key]);
          return next;
        }),
      };
    });
    if (!Array.isArray(normalized.ranking)) normalized.ranking = normalized.candidates;
    return normalized;
  }
  if (kind !== "run_bound_des_evidence") return report;
  const next = structuredClone(report);
  const paths = [
    ["state_summary", "logical_time_ps"],
    ["state_summary", "partition_count"],
    ["state_summary", "committed_event_count"],
    ["state_summary", "pending_event_count"],
    ["state_summary", "stream_record_count"],
    ["state_summary", "total_stream_record_count"],
    ["stream", "record_count"],
    ["stream", "total_record_count"],
    ["checkpoint", "checkpoint_logical_time_ps"],
    ["checkpoint", "committed_event_count"],
    ["checkpoint", "pending_event_count"],
    ["checkpoint", "completed_identity_count"],
    ["checkpoint", "subject_version_count"],
  ] as const;
  for (const [parent, key] of paths) {
    const section = next[parent];
    if (isRecord(section) && isLosslessInteger(section[key])) section[key] = losslessIntegerToBigInt(section[key]);
  }
  return next;
}

export function reportCompatibility(kind: ReportKind, report: unknown): CompatibilityResult {
  if (!isRecord(report)) {
    return { status: "invalid_schema", schema: "", supported: false, issues: ["/ must be a JSON object"] };
  }
  const schema = reportSchemaIdentity(report);
  if (!schema) {
    const issues = legacyShapeIssues(kind, report);
    return issues.length
      ? { status: "invalid_schema", schema: "", supported: false, issues }
      : { status: "legacy_unversioned", schema: "", supported: true, issues: [] };
  }
  if (!supportedContracts[kind]?.has(schema)) {
    return { status: "unsupported_schema", schema, supported: false, issues: [] };
  }
  if (schema.startsWith("tilesim.")) {
    const issues = f6bShapeIssues(kind, report);
    return issues.length
      ? { status: "invalid_schema", schema, supported: false, issues }
      : { status: "supported", schema, supported: true, issues: [] };
  }
  const validator = validators[kind];
  if (!validator) return { status: "invalid_schema", schema, supported: false, issues: ["/ has no validator"] };
  if (!validator(report)) {
    return {
      status: "invalid_schema",
      schema,
      supported: false,
      issues: formatValidationIssues(validator.errors),
    };
  }
  return { status: "supported", schema, supported: true, issues: [] };
}

export interface AdaptedReport<K extends ReportKind> {
  compatibility: CompatibilityResult;
  report: ReportByKind[K] | null;
  raw: JsonRecord;
}

export function adaptReport<K extends ReportKind>(kind: K, raw: unknown): AdaptedReport<K> {
  const compatibility = reportCompatibility(kind, raw);
  const normalized = isRecord(raw) ? normalizeF6BReport(kind, raw) : {};
  return {
    compatibility,
    report: compatibility.supported ? (normalized as ReportByKind[K]) : null,
    raw: normalized,
  };
}
