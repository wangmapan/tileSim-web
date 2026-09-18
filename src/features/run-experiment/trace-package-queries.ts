import type { ApiManifestResponse, TracePackageCatalogResponse, TracePackageInspectResponse } from "../../lib/api";
import { bridgeApi } from "../../lib/api";
import { queryClient } from "../../lib/query-client";

export interface TracePackageQueryContext {
  backendIdentity: string;
  manifest: ApiManifestResponse;
}

function catalogKey(context: TracePackageQueryContext) {
  return [
    "trace-packages",
    "catalog",
    context.backendIdentity || "unknown",
    context.manifest.schema_set_revision,
  ] as const;
}

export function tracePackageBackendIdentity(identity: Record<string, unknown>): string {
  return [
    identity.source_revision,
    identity.build_revision,
    identity.source_state_digest,
    identity.build_state_digest,
    identity.deployment_ref,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("|");
}

export async function fetchTracePackageCatalog(
  context: TracePackageQueryContext,
  { refresh = false } = {},
): Promise<TracePackageCatalogResponse> {
  const key = catalogKey(context);
  if (refresh) await queryClient.invalidateQueries({ queryKey: key });
  return queryClient.fetchQuery({
    queryKey: key,
    staleTime: refresh ? 0 : 15_000,
    queryFn: () => bridgeApi.tracePackages(context.manifest),
  });
}

export function inspectTracePackage(
  packageId: string,
  manifestSha256: string,
  context: TracePackageQueryContext,
): Promise<TracePackageInspectResponse> {
  return queryClient.fetchQuery({
    queryKey: [...catalogKey(context), "inspect", packageId, manifestSha256],
    staleTime: 0,
    queryFn: () => bridgeApi.inspectTracePackage(packageId, context.manifest),
  });
}
