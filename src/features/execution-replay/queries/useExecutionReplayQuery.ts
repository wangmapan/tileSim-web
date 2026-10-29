import { computed, ref, unref, watch, type Ref } from "vue";
import type {
  ApiManifestResponse,
  ArtifactManifestEntry,
  ArtifactManifestResponse,
} from "../../../contracts/bridge-api";
import { losslessIntegerToBigInt } from "../../../contracts/lossless-json";
import type { RuntimeTraceInput } from "../../../contracts/report-model";
import { fetchVerifiedArtifact } from "../../run-evidence";
import { queryClient } from "../../../lib/query-client";
import type { ReplayArtifactPayload, ReplayAvailability } from "../model/types";

export const REPLAY_ARTIFACT_PARSE_LIMIT = 8_000_000n;
type ReplayArtifactId =
  "runtime-events" | "runtime-requests" | "request-attribution" | "execution-replay" | "input-topology";

const expectedSchemaIdentity: Record<ReplayArtifactId, string> = {
  "runtime-events": "tilesim.s1_runtime_event_trace.v1",
  "runtime-requests": "tilesim.s1_runtime_request_summaries.v1",
  "request-attribution": "tilesim.request_attribution.v1",
  // Canonical DES runs publish this artifact through the Bridge manifest. Keep
  // the identity explicit so legacy runs without it remain distinguishable
  // from a verified execution-replay document.
  "execution-replay": "tilesim.execution_replay.v1",
  "input-topology": "tilesim.s6_topology_input.v1",
};

export interface ExecutionReplayQueryOptions {
  runId: Ref<string | null>;
  backendRevision: Ref<string>;
  schemaSetRevision: Ref<string>;
  artifactManifest: Ref<ArtifactManifestResponse | null>;
  bridgeManifest: Ref<ApiManifestResponse | null>;
  runtimeTrace: Ref<RuntimeTraceInput | null>;
}

export interface ExecutionReplayQueryResult {
  runtimeEvents: ReplayArtifactPayload | null;
  runtimeRequests: ReplayArtifactPayload | null;
  fabricRoutes: ReplayArtifactPayload | null;
  collectiveSteps: ReplayArtifactPayload | null;
  topology: ReplayArtifactPayload | null;
  error: string;
  loading: boolean;
}

export function executionReplayQueryKey(options: {
  runId: string | null;
  backendRevision: string;
  schemaSetRevision: string;
  artifactSha256: string | null;
}) {
  return [
    "execution-replay",
    options.runId || "none",
    options.backendRevision || "unknown",
    options.schemaSetRevision || "unknown",
    options.artifactSha256 || "none",
  ] as const;
}

function manifestEntry(manifest: ArtifactManifestResponse | null, id: string): ArtifactManifestEntry | null {
  return manifest?.artifacts.find((entry) => entry.artifact_id === id) || null;
}

function manifestIdentity(manifest: ArtifactManifestResponse | null): string | null {
  if (!manifest) return null;
  return [
    manifest.schema_version,
    manifest.api_version,
    manifest.schema_set_revision,
    manifest.run_id,
    "execution-envelope",
    "runtime-events",
    "runtime-requests",
    "request-attribution",
    "execution-replay",
    "metrics",
    "input-topology",
  ]
    .map((id) => {
      const entry = manifestEntry(manifest, id);
      const rejectedState = manifest.rejected_artifacts.some((item) => item.artifact_id === id)
        ? "rejected"
        : "accepted";
      return `${id}:${entry?.sha256 || "missing"}:${entry?.bytes ?? "missing"}:${entry?.file_name || "missing"}:${entry?.report_kind || "none"}:${entry?.contract_status || "missing"}:${entry?.content_status || "missing"}:${entry?.schema_identity || "missing"}:${rejectedState}`;
    })
    .join("|");
}

function bridgeManifestIdentity(manifest: ApiManifestResponse | null): string | null {
  if (!manifest) return null;
  return [manifest.schema_version, manifest.api_version, manifest.schema_set_revision].join("|");
}

function rejected(manifest: ArtifactManifestResponse | null, id: string): ReplayAvailability | null {
  return manifest?.rejected_artifacts.some((entry) => entry.artifact_id === id) ? "unsupported_schema" : null;
}

async function readArtifact(
  runId: string | null,
  id: ReplayArtifactId,
  manifest: ArtifactManifestResponse | null,
  backendRevision: string,
  bridgeManifest: ApiManifestResponse | null,
): Promise<ReplayArtifactPayload> {
  if (!runId) return { value: null, artifactId: id, sha256: "", availability: "missing" };
  if (manifest && manifest.run_id !== runId)
    return { value: null, artifactId: id, sha256: "", availability: "unsupported_schema" };
  const rejectedState = rejected(manifest, id);
  if (rejectedState) return { value: null, artifactId: id, sha256: "", availability: rejectedState };
  const entry = manifestEntry(manifest, id);
  if (!entry) return { value: null, artifactId: id, sha256: "", availability: "missing" };
  const expectedAbsence = entry.content_status === "expected_absence";
  // Do not fetch an artifact whose manifest advertises a schema that this
  // feature cannot prove or normalize. In particular, request summaries feed
  // coverage labels even though they do not create replay events, so accepting
  // an unrelated schema there would falsely claim request evidence is present.
  if (!expectedAbsence && entry.schema_identity !== expectedSchemaIdentity[id]) {
    return {
      value: null,
      artifactId: id,
      sha256: entry.sha256,
      schemaIdentity: entry.schema_identity,
      availability: "unsupported_schema",
    };
  }
  let artifactBytes: bigint;
  try {
    artifactBytes = losslessIntegerToBigInt(entry.bytes);
  } catch {
    return {
      value: null,
      artifactId: id,
      sha256: entry.sha256,
      schemaIdentity: entry.schema_identity,
      availability: "partial",
    };
  }
  if (artifactBytes < 0n || artifactBytes > REPLAY_ARTIFACT_PARSE_LIMIT)
    return {
      value: null,
      artifactId: id,
      sha256: entry.sha256,
      schemaIdentity: entry.schema_identity,
      availability: "partial",
    };
  // Expected-absence entries are still fetched through the verified-artifact
  // path.  The shared verifier checks the descriptor's bytes, SHA, schema and
  // run binding; skipping that call would let a tampered descriptor look like
  // a trustworthy absence.  Keep the descriptor out of the replay model after
  // verification so it cannot be mistaken for evidence records.
  const value = await fetchVerifiedArtifact(runId, entry, { backendRevision, manifest: bridgeManifest });
  return {
    value: expectedAbsence ? null : value,
    artifactId: id,
    sha256: entry.sha256,
    schemaIdentity: entry.schema_identity,
    availability: expectedAbsence ? "expected_absence" : "available",
  };
}

export function useExecutionReplayQuery(options: ExecutionReplayQueryOptions) {
  const result = ref<ExecutionReplayQueryResult>({
    runtimeEvents: null,
    runtimeRequests: null,
    fabricRoutes: null,
    collectiveSteps: null,
    topology: null,
    error: "",
    loading: false,
  });
  const artifactIdentity = computed(() => manifestIdentity(options.artifactManifest.value));
  const bridgeIdentity = computed(() => bridgeManifestIdentity(options.bridgeManifest.value));
  // The replay document's primary identity is the canonical execution-replay
  // artifact. Keep the legacy runtime-events SHA only for pre-canonical runs;
  // otherwise a document containing Fabric/collective evidence would be
  // labelled with an unrelated artifact hash.
  const artifactSha = computed(
    () =>
      manifestEntry(options.artifactManifest.value, "execution-replay")?.sha256 ||
      manifestEntry(options.artifactManifest.value, "runtime-events")?.sha256 ||
      null,
  );
  let revision = 0;
  async function refresh() {
    const runId = unref(options.runId);
    const manifest = options.artifactManifest.value;
    const bridgeManifest = options.bridgeManifest.value;
    const backendRevision = options.backendRevision.value;
    const schemaSetRevision = options.schemaSetRevision.value;
    const artifactIdentityAtStart = manifestIdentity(manifest);
    const currentRevision = ++revision;
    // Do not render the previous run while a new manifest/artifact set is
    // being verified. Keeping it here can briefly show an old physical path
    // or topology under the new run identity. The settled results below still
    // preserve every artifact that succeeds in this refresh.
    result.value = {
      runtimeEvents: null,
      runtimeRequests: null,
      fabricRoutes: null,
      collectiveSteps: null,
      topology: null,
      loading: true,
      error: "",
    };
    try {
      const settled = await Promise.allSettled([
        queryClient.fetchQuery({
          queryKey: [
            ...executionReplayQueryKey({
              runId,
              backendRevision,
              schemaSetRevision,
              artifactSha256: artifactIdentityAtStart,
            }),
            "runtime-events",
          ],
          queryFn: () => readArtifact(runId, "runtime-events", manifest, backendRevision, bridgeManifest),
        }),
        queryClient.fetchQuery({
          queryKey: [
            ...executionReplayQueryKey({
              runId,
              backendRevision,
              schemaSetRevision,
              artifactSha256: artifactIdentityAtStart,
            }),
            "request-attribution",
          ],
          queryFn: () => readArtifact(runId, "request-attribution", manifest, backendRevision, bridgeManifest),
        }),
        queryClient.fetchQuery({
          queryKey: [
            ...executionReplayQueryKey({
              runId,
              backendRevision,
              schemaSetRevision,
              artifactSha256: artifactIdentityAtStart,
            }),
            "runtime-requests",
          ],
          queryFn: () => readArtifact(runId, "runtime-requests", manifest, backendRevision, bridgeManifest),
        }),
        queryClient.fetchQuery({
          queryKey: [
            ...executionReplayQueryKey({
              runId,
              backendRevision,
              schemaSetRevision,
              artifactSha256: artifactIdentityAtStart,
            }),
            "execution-replay",
          ],
          queryFn: () => readArtifact(runId, "execution-replay", manifest, backendRevision, bridgeManifest),
        }),
        queryClient.fetchQuery({
          queryKey: [
            ...executionReplayQueryKey({
              runId,
              backendRevision,
              schemaSetRevision,
              artifactSha256: artifactIdentityAtStart,
            }),
            "input-topology",
          ],
          queryFn: () => readArtifact(runId, "input-topology", manifest, backendRevision, bridgeManifest),
        }),
      ]);
      if (currentRevision !== revision) return;
      const payloadFromRejection = (id: ReplayArtifactId): ReplayArtifactPayload => {
        const entry = manifestEntry(manifest, id);
        return {
          value: null,
          artifactId: id,
          sha256: entry?.sha256 || "",
          schemaIdentity: entry?.schema_identity,
          availability: entry ? "partial" : "missing",
        };
      };
      const [eventsResult, fabricResult, requestsResult, collectiveResult, topologyResult] = settled;
      const events = eventsResult.status === "fulfilled" ? eventsResult.value : payloadFromRejection("runtime-events");
      const requestAttribution =
        fabricResult.status === "fulfilled" ? fabricResult.value : payloadFromRejection("request-attribution");
      const requests =
        requestsResult.status === "fulfilled" ? requestsResult.value : payloadFromRejection("runtime-requests");
      const collectiveSteps =
        collectiveResult.status === "fulfilled" ? collectiveResult.value : payloadFromRejection("execution-replay");
      // New runs publish Fabric hop evidence and collective round/chunk data in
      // one verified canonical artifact. Prefer that artifact whenever it is
      // present, even when its timeline is an explicitly empty no-path result:
      // falling back to an older request-attribution snapshot in that case can
      // resurrect stale paths that the current backend run did not report.
      // Older runs that predate the canonical artifact still use the legacy
      // request-attribution evidence as a compatibility fallback. No path is
      // ever inferred from topology or aggregate metrics.
      const canonicalReplayAdvertised =
        Boolean(manifestEntry(manifest, "execution-replay")) ||
        Boolean(manifest?.rejected_artifacts.some((entry) => entry.artifact_id === "execution-replay"));
      const fabricRoutes = canonicalReplayAdvertised
        ? collectiveSteps
        : requestAttribution.availability === "available"
          ? requestAttribution
          : requestAttribution;
      const topology =
        topologyResult.status === "fulfilled" ? topologyResult.value : payloadFromRejection("input-topology");
      const errors = settled
        .filter((item): item is PromiseRejectedResult => item.status === "rejected")
        .map((item) => (item.reason instanceof Error ? item.reason.message : String(item.reason)));
      result.value = {
        runtimeEvents: events,
        runtimeRequests: requests,
        fabricRoutes,
        collectiveSteps,
        topology,
        error: errors.join("；"),
        loading: false,
      };
    } catch (error) {
      if (currentRevision !== revision) return;
      const entry = manifestEntry(manifest, "runtime-events");
      result.value = {
        runtimeEvents: entry
          ? {
              value: null,
              artifactId: "runtime-events",
              sha256: entry.sha256,
              schemaIdentity: entry.schema_identity,
              availability: "partial",
            }
          : null,
        runtimeRequests: null,
        fabricRoutes: null,
        collectiveSteps: null,
        topology: null,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  watch(
    [
      options.runId,
      options.backendRevision,
      options.schemaSetRevision,
      // Track the manifest's semantic identity, not only its object
      // reference.  A cache/store may update an entry in place; relying on a
      // shallow ref watch would leave the old verified payload on screen.
      artifactIdentity,
      bridgeIdentity,
    ],
    refresh,
    { immediate: true },
  );
  return {
    result,
    artifactSha,
    queryKey: computed(() =>
      executionReplayQueryKey({
        runId: options.runId.value,
        backendRevision: options.backendRevision.value,
        schemaSetRevision: options.schemaSetRevision.value,
        artifactSha256: artifactIdentity.value,
      }),
    ),
    refresh,
  };
}
