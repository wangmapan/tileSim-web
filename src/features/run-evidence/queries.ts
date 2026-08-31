import { queryClient } from "../../lib/query-client";
import type { ApiManifestResponse, ArtifactManifestEntry, ArtifactManifestResponse } from "../../lib/api";
import { bridgeApi } from "../../lib/api";
import type { RunInputs, RuntimeTraceInput } from "../../contracts/report-model";

export interface EvidenceQueryContext {
  backendRevision: string;
  manifest: ApiManifestResponse | null;
}

function schemaRevision(context: EvidenceQueryContext) {
  return context.manifest?.schema_set_revision || "unknown";
}

function evidenceKey(runId: string, context: EvidenceQueryContext) {
  return ["run-evidence", runId, context.backendRevision || "unknown", schemaRevision(context)] as const;
}

function artifactEntry(manifest: ArtifactManifestResponse | null, artifactId: string) {
  return manifest?.artifacts.find((entry) => entry.artifact_id === artifactId) || null;
}

export async function fetchArtifactManifest(
  runId: string,
  context: EvidenceQueryContext,
): Promise<ArtifactManifestResponse | null> {
  if (context.manifest?.legacy_unversioned) return null;
  return queryClient.fetchQuery({
    queryKey: [...evidenceKey(runId, context), "manifest"],
    queryFn: () => bridgeApi.getArtifactManifest(runId, context.manifest?.schema_set_revision),
  });
}

export async function fetchVerifiedArtifact(
  runId: string,
  entry: ArtifactManifestEntry,
  context: EvidenceQueryContext,
) {
  return queryClient.fetchQuery({
    queryKey: [...evidenceKey(runId, context), "artifact", entry.artifact_id, entry.sha256],
    queryFn: () => bridgeApi.getVerifiedArtifact(runId, entry),
  });
}

export async function fetchVerifiedArtifactText(
  runId: string,
  entry: ArtifactManifestEntry,
  context: EvidenceQueryContext,
) {
  return queryClient.fetchQuery({
    queryKey: [...evidenceKey(runId, context), "artifact-text", entry.artifact_id, entry.sha256],
    queryFn: () => bridgeApi.getVerifiedArtifactText(runId, entry),
    gcTime: 30_000,
  });
}

export function releaseVerifiedArtifactText(
  runId: string,
  entry: ArtifactManifestEntry,
  context: EvidenceQueryContext,
) {
  queryClient.removeQueries({
    queryKey: [...evidenceKey(runId, context), "artifact-text", entry.artifact_id, entry.sha256],
    exact: true,
  });
}

async function fetchInputs(
  runId: string,
  manifest: ArtifactManifestResponse | null,
  context: EvidenceQueryContext,
): Promise<RunInputs> {
  const runtimeEntry = artifactEntry(manifest, "input-runtime-trace");
  const topologyEntry = artifactEntry(manifest, "input-topology");
  const [runtime, topology] = await Promise.allSettled([
    manifest
      ? runtimeEntry
        ? fetchVerifiedArtifact(runId, runtimeEntry, context)
        : Promise.reject(new Error("Runtime trace artifact is absent."))
      : bridgeApi.getArtifact(runId, "input-runtime-trace"),
    manifest
      ? topologyEntry
        ? fetchVerifiedArtifact(runId, topologyEntry, context)
        : Promise.reject(new Error("Topology artifact is absent."))
      : bridgeApi.getArtifact(runId, "input-topology"),
  ]);
  return {
    runtime_trace: runtime.status === "fulfilled" ? (runtime.value as RuntimeTraceInput) : null,
    topology: topology.status === "fulfilled" ? (topology.value as Record<string, unknown>) : null,
  };
}

export async function fetchRunEvidence(runId: string, context: EvidenceQueryContext) {
  const artifactManifest = await fetchArtifactManifest(runId, context);
  const artifactIdentity = artifactManifest?.artifacts.map((entry) => `${entry.artifact_id}:${entry.sha256}`).join("|");
  const [payload, inputs] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: [...evidenceKey(runId, context), "reports", artifactIdentity || "legacy"],
      queryFn: () =>
        artifactManifest ? bridgeApi.getVerifiedReports(runId, artifactManifest) : bridgeApi.getReports(runId),
    }),
    fetchInputs(runId, artifactManifest, context),
  ]);
  return { payload, inputs, artifactManifest };
}
