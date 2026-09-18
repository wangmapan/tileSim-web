import {
  buildArtifactTextIndex,
  ArtifactIndexError,
  artifactLineMatch,
  artifactLineWindow,
  searchArtifactTextIndex,
} from "../model/artifact-index";
import {
  ARTIFACT_INDEX_WORKER_PROTOCOL,
  artifactIdentityKey,
  isArtifactWorkerRequest,
  type ArtifactIdentity,
  type ArtifactWorkerErrorResponse,
  type ArtifactWorkerRequest,
  type ArtifactWorkerResponse,
} from "../model/worker-contract";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: ArtifactWorkerResponse): void;
};
const cancelled = new Set<string>();
let activeIndex: ReturnType<typeof buildArtifactTextIndex> | null = null;
let activeIdentityKey = "";

function duration(start: number) {
  return Number((performance.now() - start).toFixed(3));
}

function errorResponse(request: ArtifactWorkerRequest, error: unknown, start: number): ArtifactWorkerErrorResponse {
  const known = error instanceof ArtifactIndexError ? error : null;
  const aborted = error instanceof DOMException && error.name === "AbortError";
  return {
    protocol: ARTIFACT_INDEX_WORKER_PROTOCOL,
    requestId: request.requestId,
    identity: request.identity,
    kind: "error",
    durationMs: duration(start),
    code: aborted ? "cancelled" : known?.code || "internal_error",
    message: error instanceof Error ? error.message : String(error),
    retryable: aborted,
  };
}

function sameActiveIdentity(identity: ArtifactIdentity) {
  return activeIndex && activeIdentityKey === artifactIdentityKey(identity);
}

async function handle(request: ArtifactWorkerRequest) {
  const start = performance.now();
  try {
    if (request.kind === "cancel") {
      cancelled.add(request.targetRequestId);
      scope.postMessage({
        protocol: ARTIFACT_INDEX_WORKER_PROTOCOL,
        requestId: request.requestId,
        identity: request.identity,
        kind: "cancelled",
        durationMs: duration(start),
        targetRequestId: request.targetRequestId,
      });
      return;
    }
    if (request.kind === "index") {
      const rawText = new TextDecoder(request.encoding).decode(request.payload);
      const nextIndex = buildArtifactTextIndex(rawText, request.identity.schemaIdentity);
      if (cancelled.delete(request.requestId)) throw new DOMException("Artifact indexing was cancelled.", "AbortError");
      activeIndex = nextIndex;
      activeIdentityKey = artifactIdentityKey(request.identity);
      scope.postMessage({
        protocol: ARTIFACT_INDEX_WORKER_PROTOCOL,
        requestId: request.requestId,
        identity: request.identity,
        kind: "index-ready",
        durationMs: duration(start),
        byteCount: request.payload.byteLength,
        characterCount: nextIndex.formattedText.length,
        lineCount: nextIndex.lineOffsets.length,
        pointerCount: nextIndex.pointerToLine.size,
      });
      return;
    }
    if (!sameActiveIdentity(request.identity)) throw new Error("The requested artifact is not indexed.");
    if (request.kind === "search") {
      const result = await searchArtifactTextIndex(activeIndex!, request.query, request.maxResults, () =>
        cancelled.has(request.requestId),
      );
      cancelled.delete(request.requestId);
      scope.postMessage({
        protocol: ARTIFACT_INDEX_WORKER_PROTOCOL,
        requestId: request.requestId,
        identity: request.identity,
        kind: "search-results",
        durationMs: duration(start),
        query: request.query,
        ...result,
      });
      return;
    }
    if (request.kind === "read-lines") {
      const lines = artifactLineWindow(activeIndex!, request.startLine, request.lineCount);
      scope.postMessage({
        protocol: ARTIFACT_INDEX_WORKER_PROTOCOL,
        requestId: request.requestId,
        identity: request.identity,
        kind: "line-window",
        durationMs: duration(start),
        startLine: lines[0]?.lineNumber ?? request.startLine,
        lineCount: lines.length,
        lines,
      });
      return;
    }
    const lineNumber = activeIndex!.pointerToLine.get(request.pointer);
    scope.postMessage({
      protocol: ARTIFACT_INDEX_WORKER_PROTOCOL,
      requestId: request.requestId,
      identity: request.identity,
      kind: "pointer-result",
      durationMs: duration(start),
      pointer: request.pointer,
      match: lineNumber ? artifactLineMatch(activeIndex!, lineNumber) : null,
    });
  } catch (error) {
    cancelled.delete(request.requestId);
    scope.postMessage(errorResponse(request, error, start));
  }
}

scope.onmessage = (event) => {
  if (!isArtifactWorkerRequest(event.data)) return;
  void handle(event.data);
};
