export const ARTIFACT_INDEX_WORKER_PROTOCOL = "tilesim.artifact-index.worker.v1" as const;

export interface ArtifactIdentity {
  runId: string;
  artifactId: string;
  sha256: string;
  schemaIdentity: string;
}

interface WorkerMessageBase {
  protocol: typeof ARTIFACT_INDEX_WORKER_PROTOCOL;
  requestId: string;
  identity: ArtifactIdentity;
}

export interface ArtifactIndexRequest extends WorkerMessageBase {
  kind: "index";
  payload: ArrayBuffer;
  encoding: "utf-8";
}

export interface ArtifactSearchRequest extends WorkerMessageBase {
  kind: "search";
  query: string;
  maxResults: number;
}

export interface ArtifactPointerRequest extends WorkerMessageBase {
  kind: "locate-pointer";
  pointer: string;
}

export interface ArtifactReadLinesRequest extends WorkerMessageBase {
  kind: "read-lines";
  startLine: number;
  lineCount: number;
}

export interface ArtifactCancelRequest extends WorkerMessageBase {
  kind: "cancel";
  targetRequestId: string;
}

export type ArtifactWorkerRequest =
  | ArtifactIndexRequest
  | ArtifactSearchRequest
  | ArtifactPointerRequest
  | ArtifactReadLinesRequest
  | ArtifactCancelRequest;

export interface ArtifactVirtualLine {
  lineNumber: number;
  text: string;
  pointer: string | null;
  truncated: boolean;
}

export interface ArtifactLineMatch {
  lineNumber: number;
  startOffset: number;
  endOffset: number;
  preview: string;
  pointer: string | null;
}

interface WorkerResponseBase extends WorkerMessageBase {
  durationMs: number;
}

export interface ArtifactIndexReadyResponse extends WorkerResponseBase {
  kind: "index-ready";
  byteCount: number;
  characterCount: number;
  lineCount: number;
  pointerCount: number;
}

export interface ArtifactReadLinesResponse extends WorkerResponseBase {
  kind: "line-window";
  startLine: number;
  lineCount: number;
  lines: ArtifactVirtualLine[];
}

export interface ArtifactSearchResponse extends WorkerResponseBase {
  kind: "search-results";
  query: string;
  matches: ArtifactLineMatch[];
  totalMatches: number;
  truncated: boolean;
}

export interface ArtifactPointerResponse extends WorkerResponseBase {
  kind: "pointer-result";
  pointer: string;
  match: ArtifactLineMatch | null;
}

export interface ArtifactCancelledResponse extends WorkerResponseBase {
  kind: "cancelled";
  targetRequestId: string;
}

export interface ArtifactWorkerErrorResponse extends WorkerResponseBase {
  kind: "error";
  code:
    "invalid_request" | "parse_failed" | "schema_identity_mismatch" | "index_failed" | "cancelled" | "internal_error";
  message: string;
  retryable: boolean;
}

export type ArtifactWorkerResponse =
  | ArtifactIndexReadyResponse
  | ArtifactReadLinesResponse
  | ArtifactSearchResponse
  | ArtifactPointerResponse
  | ArtifactCancelledResponse
  | ArtifactWorkerErrorResponse;

const sha256Pattern = /^[a-f0-9]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isArtifactIdentity(value: unknown): value is ArtifactIdentity {
  if (!isRecord(value)) return false;
  return (
    typeof value.runId === "string" &&
    value.runId.length > 0 &&
    typeof value.artifactId === "string" &&
    value.artifactId.length > 0 &&
    typeof value.sha256 === "string" &&
    sha256Pattern.test(value.sha256) &&
    typeof value.schemaIdentity === "string"
  );
}

function hasValidBase(value: Record<string, unknown>): boolean {
  return (
    value.protocol === ARTIFACT_INDEX_WORKER_PROTOCOL &&
    typeof value.requestId === "string" &&
    value.requestId.length > 0 &&
    isArtifactIdentity(value.identity)
  );
}

export function isArtifactWorkerRequest(value: unknown): value is ArtifactWorkerRequest {
  if (!isRecord(value) || !hasValidBase(value)) return false;
  if (value.kind === "index") {
    return value.encoding === "utf-8" && value.payload instanceof ArrayBuffer && value.payload.byteLength > 0;
  }
  if (value.kind === "search") {
    return (
      typeof value.query === "string" &&
      value.query.trim().length > 0 &&
      Number.isInteger(value.maxResults) &&
      Number(value.maxResults) >= 1 &&
      Number(value.maxResults) <= 1000
    );
  }
  if (value.kind === "locate-pointer") {
    return typeof value.pointer === "string" && (value.pointer === "" || value.pointer.startsWith("/"));
  }
  if (value.kind === "read-lines") {
    return (
      Number.isInteger(value.startLine) &&
      Number(value.startLine) >= 1 &&
      Number.isInteger(value.lineCount) &&
      Number(value.lineCount) >= 1 &&
      Number(value.lineCount) <= 300
    );
  }
  return value.kind === "cancel" && typeof value.targetRequestId === "string" && value.targetRequestId.length > 0;
}

export function artifactIdentityKey(identity: ArtifactIdentity): string {
  return [identity.runId, identity.artifactId, identity.sha256.toLowerCase(), identity.schemaIdentity].join("::");
}

export function isCurrentArtifactResponse(
  response: ArtifactWorkerResponse,
  expected: { requestId: string; identity: ArtifactIdentity },
): boolean {
  return (
    response.protocol === ARTIFACT_INDEX_WORKER_PROTOCOL &&
    response.requestId === expected.requestId &&
    artifactIdentityKey(response.identity) === artifactIdentityKey(expected.identity)
  );
}
