import { describe, expect, it } from "vitest";
import {
  artifactEvidenceRoute,
  parseArtifactEvidenceQuery,
  parseArtifactPointerSource,
} from "../../src/features/inspect-artifact";

describe("artifact evidence links", () => {
  it("maps only exact report source paths to canonical artifacts and pointers", () => {
    expect(parseArtifactPointerSource("metrics:/request_metrics/4/ttft_ps")).toEqual({
      artifactId: "metrics",
      pointer: "/request_metrics/4/ttft_ps",
    });
    expect(parseArtifactPointerSource("/tail/cause_chain/0")).toEqual({
      artifactId: "tail-cause-chain",
      pointer: "/cause_chain/0",
    });
    expect(parseArtifactPointerSource("/execution_envelope/stages/2")).toEqual({
      artifactId: "execution-envelope",
      pointer: "/stages/2",
    });
    expect(parseArtifactPointerSource("metrics:/request_metrics/*/ttft_ps")).toBeNull();
    expect(parseArtifactPointerSource("metrics:/request_metrics/0 + validation:/checks/0")).toBeNull();
  });

  it("round-trips a hash-bound deep link and rejects tampered identities", () => {
    const target = {
      runId: "run-fixture-f1",
      artifactId: "metrics",
      sha256: "A".repeat(64),
      pointer: "/summary/throughput_requests_per_second",
    };
    const route = artifactEvidenceRoute(target) as { query: Record<string, string> };
    expect(parseArtifactEvidenceQuery(route.query)).toEqual({ ...target, sha256: "a".repeat(64) });
    expect(parseArtifactEvidenceQuery({ ...route.query, evidence_sha: "not-a-hash" })).toBeNull();
    expect(parseArtifactEvidenceQuery({ ...route.query, evidence_pointer: "summary/value" })).toBeNull();
  });
});
