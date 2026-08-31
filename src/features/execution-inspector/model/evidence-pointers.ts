import type {
  AttributionItem,
  CauseItem,
  ExecutionStage,
  FabricDomainUtilization,
  FidelityResolution,
  ImplementationEntry,
  PhaseFabricContribution,
  RequestFabricContribution,
  RequestMetric,
  RuntimeTraceInput,
  ValidationCheck,
} from "../../../contracts/report-model";

type RuntimeRequest = NonNullable<RuntimeTraceInput["requests"]>[number];

function uniqueStableRecordPointer<T>(
  records: T[],
  stableId: string | undefined,
  idOf: (record: T) => string | undefined,
  sourcePrefix: string,
): string | null {
  if (!stableId) return null;
  const matches = records
    .map((record, index) => ({ index, stableId: idOf(record) }))
    .filter((candidate) => candidate.stableId === stableId);
  return matches.length === 1 ? `${sourcePrefix}/${matches[0].index}` : null;
}

function withField(pointer: string | null, field: string | undefined): string | null {
  return pointer && field ? `${pointer}/${field}` : pointer;
}

export function runtimeRequestSource(
  requests: RuntimeRequest[],
  requestId: string | undefined,
  field?: string,
): string | null {
  return withField(
    uniqueStableRecordPointer(requests, requestId, (request) => request.request_id, "input-runtime-trace:/requests"),
    field,
  );
}

export function requestMetricSource(
  requests: RequestMetric[],
  requestId: string | undefined,
  field?: string,
): string | null {
  return withField(
    uniqueStableRecordPointer(requests, requestId, (request) => request.request_id, "metrics:/request_metrics"),
    field,
  );
}

export function phaseContributionSource(
  phases: PhaseFabricContribution[],
  identity: { field: "phase_id" | "memory_event_id" | "device_task_id" | "collective_id"; id: string | undefined },
  field?: string,
): string | null {
  return withField(
    uniqueStableRecordPointer(
      phases,
      identity.id,
      (phase) => phase[identity.field],
      "metrics:/system_summary/phase_fabric_contributions",
    ),
    field,
  );
}

export function phaseRecordSource(
  phases: PhaseFabricContribution[],
  phase: PhaseFabricContribution,
  preferredIdentity: "memory_event_id" | "device_task_id" | "collective_id",
  field?: string,
): string | null {
  return (
    phaseContributionSource(phases, { field: preferredIdentity, id: phase[preferredIdentity] }, field) ||
    phaseContributionSource(phases, { field: "phase_id", id: phase.phase_id }, field)
  );
}

export function requestFabricContributionSource(
  requests: RequestFabricContribution[],
  requestId: string | undefined,
  field?: string,
): string | null {
  return withField(
    uniqueStableRecordPointer(
      requests,
      requestId,
      (request) => request.request_id,
      "metrics:/system_summary/request_fabric_contributions",
    ),
    field,
  );
}

export function fabricDomainSource(
  domains: FabricDomainUtilization[],
  domainId: string | undefined,
  field?: string,
): string | null {
  return withField(
    uniqueStableRecordPointer(
      domains,
      domainId,
      (domain) => domain.domain_id,
      "metrics:/system_summary/fabric_domain_utilization",
    ),
    field,
  );
}

export function fidelityResolutionSource(
  entries: FidelityResolution[],
  subsystem: string | undefined,
  artifactId: "validation" | "metrics",
  field?: string,
): string | null {
  return withField(
    uniqueStableRecordPointer(entries, subsystem, (entry) => entry.subsystem, `${artifactId}:/resolution_entries`),
    field,
  );
}

export function implementationEntrySource(
  entries: ImplementationEntry[],
  subsystem: string | undefined,
  field?: string,
): string | null {
  return withField(
    uniqueStableRecordPointer(
      entries,
      subsystem,
      (entry) => entry.subsystem,
      "run-result:/multi_granularity_profile/entries",
    ),
    field,
  );
}

export function validationCheckSource(checks: ValidationCheck[], checkId: string | undefined): string | null {
  return uniqueStableRecordPointer(checks, checkId, (check) => check.check_id, "validation:/checks");
}

export function attributionSource(items: AttributionItem[], attributionId: string | undefined): string | null {
  return uniqueStableRecordPointer(
    items,
    attributionId,
    (item) => item.attribution_id,
    "tail-cause-chain:/attribution_ranking",
  );
}

export function executionStageSource(stages: ExecutionStage[], stageId: string | undefined): string | null {
  return uniqueStableRecordPointer(stages, stageId, (stage) => stage.stage_id, "execution-envelope:/stages");
}

export function causeSource(causes: CauseItem[], causeId: string | undefined): string | null {
  return uniqueStableRecordPointer(causes, causeId, (cause) => cause.cause_id, "tail-cause-chain:/cause_chain");
}
