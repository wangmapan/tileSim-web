import type { ArtifactManifestResponse } from "../../lib/api";
import type { EvidenceQueryContext } from "../run-evidence";
import { fetchVerifiedArtifact, fetchVerifiedArtifactText, releaseVerifiedArtifactText } from "../run-evidence";
import { bridgeApi, rawArtifactUrl } from "../../lib/api";

export { rawArtifactUrl };
export {
  ARTIFACT_INDEX_WORKER_PROTOCOL,
  artifactIdentityKey,
  isArtifactIdentity,
  isArtifactWorkerRequest,
  isCurrentArtifactResponse,
} from "./model/worker-contract";
export type {
  ArtifactIdentity,
  ArtifactIndexReadyResponse,
  ArtifactLineMatch,
  ArtifactPointerResponse,
  ArtifactReadLinesResponse,
  ArtifactSearchResponse,
  ArtifactVirtualLine,
  ArtifactWorkerRequest,
  ArtifactWorkerResponse,
} from "./model/worker-contract";
export { ArtifactIndexWorkerClient } from "./client/artifact-index-client";
export { default as ArtifactVirtualViewer } from "./components/ArtifactVirtualViewer.vue";
export { artifactEvidenceRoute, parseArtifactEvidenceQuery, parseArtifactPointerSource } from "./model/evidence-link";
export type { ArtifactEvidenceTarget, ArtifactPointerSource } from "./model/evidence-link";

export async function inspectArtifact(
  runId: string,
  artifactId: string,
  manifest: ArtifactManifestResponse | null,
  context: EvidenceQueryContext,
) {
  const entry = manifest?.artifacts.find((candidate) => candidate.artifact_id === artifactId);
  return entry ? fetchVerifiedArtifact(runId, entry, context) : bridgeApi.getArtifact(runId, artifactId);
}

export async function inspectArtifactText(
  runId: string,
  artifactId: string,
  manifest: ArtifactManifestResponse | null,
  context: EvidenceQueryContext,
) {
  const entry = manifest?.artifacts.find((candidate) => candidate.artifact_id === artifactId);
  return entry ? fetchVerifiedArtifactText(runId, entry, context) : bridgeApi.getArtifactText(runId, artifactId);
}

export function releaseArtifactText(
  runId: string,
  artifactId: string,
  manifest: ArtifactManifestResponse | null,
  context: EvidenceQueryContext,
) {
  const entry = manifest?.artifacts.find((candidate) => candidate.artifact_id === artifactId);
  if (entry) releaseVerifiedArtifactText(runId, entry, context);
}
