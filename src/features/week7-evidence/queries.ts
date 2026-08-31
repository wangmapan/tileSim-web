import type {
  Week7CalibrationResponse,
  Week7EvidenceMapResponse,
  Week7OrchestrationResponse,
} from "../../contracts/bridge-api";
import { bridgeApi } from "../../lib/api";
import { queryClient } from "../../lib/query-client";

export interface Week7EvidenceQueryContext {
  backendIdentity: string;
  schemaRevision: string;
}

function queryKey(operation: string, context: Week7EvidenceQueryContext) {
  return [
    "week7-evidence",
    operation,
    context.backendIdentity || "unknown",
    context.schemaRevision || "unknown",
  ] as const;
}

async function fetchEvidenceMap(context: Week7EvidenceQueryContext, refresh: boolean) {
  const key = queryKey("evidence-map", context);
  if (refresh) await queryClient.invalidateQueries({ queryKey: key });
  return queryClient.fetchQuery<Week7EvidenceMapResponse>({
    queryKey: key,
    staleTime: refresh ? 0 : 5 * 60_000,
    queryFn: () => bridgeApi.week7EvidenceMap(),
  });
}

async function fetchCalibrationExample(context: Week7EvidenceQueryContext, refresh: boolean) {
  const key = queryKey("calibration-example", context);
  if (refresh) await queryClient.invalidateQueries({ queryKey: key });
  return queryClient.fetchQuery<Week7CalibrationResponse>({
    queryKey: key,
    staleTime: refresh ? 0 : 5 * 60_000,
    queryFn: () => bridgeApi.runWeek7CalibrationExample(),
  });
}

async function fetchOrchestrationExample(context: Week7EvidenceQueryContext, refresh: boolean) {
  const key = queryKey("orchestration-example", context);
  if (refresh) await queryClient.invalidateQueries({ queryKey: key });
  return queryClient.fetchQuery<Week7OrchestrationResponse>({
    queryKey: key,
    staleTime: refresh ? 0 : 5 * 60_000,
    queryFn: () => bridgeApi.runWeek7OrchestrationExample(),
  });
}

export interface Week7EvidenceBundle {
  evidenceMap: Week7EvidenceMapResponse;
  calibration: Week7CalibrationResponse;
  orchestration: Week7OrchestrationResponse;
}

export async function fetchWeek7Evidence(
  context: Week7EvidenceQueryContext,
  { refresh = false }: { refresh?: boolean } = {},
): Promise<Week7EvidenceBundle> {
  // The Bridge deliberately exposes a single Week 7 execution slot. Keep the
  // fixed workflows ordered so this client never races its own requests.
  const evidenceMap = await fetchEvidenceMap(context, refresh);
  const calibration = await fetchCalibrationExample(context, refresh);
  const orchestration = await fetchOrchestrationExample(context, refresh);
  return { evidenceMap, calibration, orchestration };
}
