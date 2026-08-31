import { describe, expect, it } from "vitest";
import {
  ARTIFACT_INDEX_WORKER_PROTOCOL,
  artifactIdentityKey,
  isArtifactWorkerRequest,
  isCurrentArtifactResponse,
  type ArtifactIdentity,
  type ArtifactWorkerResponse,
} from "../../src/features/inspect-artifact";

const identity: ArtifactIdentity = {
  runId: "run-f5a",
  artifactId: "metrics",
  sha256: "a".repeat(64),
  schemaIdentity: "metrics.report.v1alpha1",
};

describe("artifact index worker contract", () => {
  it("accepts bounded index, search, pointer, and cancellation requests", () => {
    const base = { protocol: ARTIFACT_INDEX_WORKER_PROTOCOL, requestId: "request-1", identity };
    expect(isArtifactWorkerRequest({ ...base, kind: "index", encoding: "utf-8", payload: new ArrayBuffer(16) })).toBe(
      true,
    );
    expect(isArtifactWorkerRequest({ ...base, kind: "search", query: "device_latency_us", maxResults: 100 })).toBe(
      true,
    );
    expect(isArtifactWorkerRequest({ ...base, kind: "locate-pointer", pointer: "/request_metrics/0" })).toBe(true);
    expect(isArtifactWorkerRequest({ ...base, kind: "read-lines", startLine: 1, lineCount: 300 })).toBe(true);
    expect(isArtifactWorkerRequest({ ...base, kind: "cancel", targetRequestId: "request-0" })).toBe(true);
  });

  it("fails closed for unbounded or identity-free work", () => {
    const base = { protocol: ARTIFACT_INDEX_WORKER_PROTOCOL, requestId: "request-1", identity };
    expect(isArtifactWorkerRequest({ ...base, kind: "search", query: "x", maxResults: 1001 })).toBe(false);
    expect(isArtifactWorkerRequest({ ...base, kind: "read-lines", startLine: 1, lineCount: 301 })).toBe(false);
    expect(isArtifactWorkerRequest({ ...base, kind: "read-lines", startLine: 0, lineCount: 10 })).toBe(false);
    expect(isArtifactWorkerRequest({ ...base, kind: "locate-pointer", pointer: "request_metrics/0" })).toBe(false);
    expect(isArtifactWorkerRequest({ ...base, kind: "index", encoding: "utf-8", payload: new ArrayBuffer(0) })).toBe(
      false,
    );
    expect(isArtifactWorkerRequest({ ...base, identity: { ...identity, sha256: "not-a-hash" }, kind: "cancel" })).toBe(
      false,
    );
  });

  it("rejects stale request and artifact results deterministically", () => {
    const response: ArtifactWorkerResponse = {
      protocol: ARTIFACT_INDEX_WORKER_PROTOCOL,
      requestId: "request-2",
      identity,
      kind: "index-ready",
      durationMs: 12,
      byteCount: 10,
      characterCount: 10,
      lineCount: 1,
      pointerCount: 1,
    };
    expect(isCurrentArtifactResponse(response, { requestId: "request-2", identity })).toBe(true);
    expect(isCurrentArtifactResponse(response, { requestId: "request-3", identity })).toBe(false);
    expect(
      isCurrentArtifactResponse(response, {
        requestId: "request-2",
        identity: { ...identity, artifactId: "validation" },
      }),
    ).toBe(false);
    expect(artifactIdentityKey({ ...identity, sha256: "A".repeat(64) })).toBe(artifactIdentityKey(identity));
  });
});
