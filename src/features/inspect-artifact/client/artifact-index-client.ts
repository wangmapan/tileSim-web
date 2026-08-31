import {
  ARTIFACT_INDEX_WORKER_PROTOCOL,
  isCurrentArtifactResponse,
  type ArtifactIdentity,
  type ArtifactIndexReadyResponse,
  type ArtifactReadLinesResponse,
  type ArtifactPointerResponse,
  type ArtifactSearchResponse,
  type ArtifactWorkerRequest,
  type ArtifactWorkerResponse,
} from "../model/worker-contract";

interface PendingRequest {
  identity: ArtifactIdentity;
  resolve: (value: ArtifactWorkerResponse) => void;
  reject: (reason: unknown) => void;
}

let requestSequence = 0;

function requestId(prefix: string) {
  requestSequence += 1;
  return `${prefix}-${Date.now()}-${requestSequence}`;
}

function abortError() {
  return new DOMException("Artifact worker request was superseded.", "AbortError");
}

export class ArtifactIndexWorkerClient {
  private worker: Worker | null = null;
  private identity: ArtifactIdentity | null = null;
  private pending = new Map<string, PendingRequest>();
  private activeSearchId = "";

  private ensureWorker() {
    if (this.worker) return this.worker;
    this.worker = new Worker(new URL("../worker/artifact-index.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<ArtifactWorkerResponse>) => this.onMessage(event.data);
    this.worker.onerror = (event) => this.failAll(new Error(event.message || "Artifact worker failed."));
    return this.worker;
  }

  private onMessage(response: ArtifactWorkerResponse) {
    const pending = this.pending.get(response.requestId);
    if (!pending) return;
    this.pending.delete(response.requestId);
    if (!isCurrentArtifactResponse(response, { requestId: response.requestId, identity: pending.identity })) {
      pending.reject(new Error("Stale artifact worker response was rejected."));
      return;
    }
    if (response.kind === "error") pending.reject(new Error(response.message));
    else pending.resolve(response);
  }

  private send<T extends ArtifactWorkerResponse>(request: ArtifactWorkerRequest, transfer: Transferable[] = []) {
    const worker = this.ensureWorker();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(request.requestId, {
        identity: request.identity,
        resolve: (value) => resolve(value as T),
        reject,
      });
      worker.postMessage(request, transfer);
    });
  }

  private failAll(reason: unknown) {
    for (const pending of this.pending.values()) pending.reject(reason);
    this.pending.clear();
    this.activeSearchId = "";
  }

  private restart(identity: ArtifactIdentity) {
    this.failAll(abortError());
    this.worker?.terminate();
    this.worker = null;
    this.identity = identity;
  }

  async index(identity: ArtifactIdentity, rawText: string): Promise<ArtifactIndexReadyResponse> {
    this.restart(identity);
    const id = requestId("index");
    const payload = new TextEncoder().encode(rawText).buffer as ArrayBuffer;
    return this.send<ArtifactIndexReadyResponse>(
      { protocol: ARTIFACT_INDEX_WORKER_PROTOCOL, requestId: id, identity, kind: "index", payload, encoding: "utf-8" },
      [payload],
    );
  }

  async search(query: string, maxResults = 200): Promise<ArtifactSearchResponse> {
    if (!this.identity) throw new Error("No artifact has been indexed.");
    this.cancelSearch();
    const id = requestId("search");
    this.activeSearchId = id;
    try {
      return await this.send<ArtifactSearchResponse>({
        protocol: ARTIFACT_INDEX_WORKER_PROTOCOL,
        requestId: id,
        identity: this.identity,
        kind: "search",
        query,
        maxResults,
      });
    } finally {
      if (this.activeSearchId === id) this.activeSearchId = "";
    }
  }

  cancelSearch() {
    if (!this.activeSearchId || !this.identity) return;
    const targetRequestId = this.activeSearchId;
    const previous = this.pending.get(targetRequestId);
    previous?.reject(abortError());
    this.pending.delete(targetRequestId);
    this.ensureWorker().postMessage({
      protocol: ARTIFACT_INDEX_WORKER_PROTOCOL,
      requestId: requestId("cancel"),
      identity: this.identity,
      kind: "cancel",
      targetRequestId,
    } satisfies ArtifactWorkerRequest);
    this.activeSearchId = "";
  }

  async readLines(startLine: number, lineCount: number): Promise<ArtifactReadLinesResponse> {
    if (!this.identity) throw new Error("No artifact has been indexed.");
    const id = requestId("read-lines");
    return this.send<ArtifactReadLinesResponse>({
      protocol: ARTIFACT_INDEX_WORKER_PROTOCOL,
      requestId: id,
      identity: this.identity,
      kind: "read-lines",
      startLine,
      lineCount,
    });
  }

  async locatePointer(pointer: string): Promise<ArtifactPointerResponse> {
    if (!this.identity) throw new Error("No artifact has been indexed.");
    const id = requestId("locate-pointer");
    return this.send<ArtifactPointerResponse>({
      protocol: ARTIFACT_INDEX_WORKER_PROTOCOL,
      requestId: id,
      identity: this.identity,
      kind: "locate-pointer",
      pointer,
    });
  }

  dispose() {
    this.failAll(abortError());
    this.worker?.terminate();
    this.worker = null;
    this.identity = null;
  }
}
