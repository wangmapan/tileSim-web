import { queryClient } from "../../lib/query-client";
import { bridgeApi } from "../../lib/api";
import type { EvidenceQueryContext } from "../run-evidence";

function historyKey(context: EvidenceQueryContext) {
  return [
    "run-history",
    context.backendRevision || "unknown",
    context.manifest?.schema_set_revision || "unknown",
  ] as const;
}

export async function fetchRunHistory(context: EvidenceQueryContext, { refresh = false } = {}) {
  if (refresh) await queryClient.invalidateQueries({ queryKey: historyKey(context) });
  return queryClient.fetchQuery({
    queryKey: historyKey(context),
    staleTime: refresh ? 0 : 10_000,
    queryFn: () => bridgeApi.listRuns(),
  });
}

export async function renameRun(runId: string, name: string, context: EvidenceQueryContext) {
  const result = await bridgeApi.renameRun(runId, name);
  await queryClient.invalidateQueries({ queryKey: historyKey(context) });
  return result;
}
