import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function loadCatalog() {
  return JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/f9-agent-evaluation-cases.json"), "utf8"));
}

describe("F9 evidence Agent evaluation catalog", () => {
  it("stays explicitly contract-only until a production runtime contract exists", () => {
    const catalog = loadCatalog();

    expect(catalog.schema_version).toBe("tilesim.web.f9_evidence_agent_evaluation_catalog.v1");
    expect(catalog.status).toBe("contract_specification_only");
    expect(catalog.runtime_contract_available).toBe(false);
    expect(catalog.hard_gate_default).toBe(true);
  });

  it("provides unique, complete and deterministic case definitions", () => {
    const { cases } = loadCatalog();
    const ids = cases.map(({ id }) => id);

    expect(cases).toHaveLength(36);
    expect(new Set(ids).size).toBe(ids.length);
    for (const evaluationCase of cases) {
      expect(evaluationCase.id).toMatch(/^[a-z0-9-]+$/);
      expect(evaluationCase.category.length).toBeGreaterThan(0);
      expect(evaluationCase.mutation.length).toBeGreaterThan(0);
      expect(evaluationCase.expected_outcome.length).toBeGreaterThan(0);
      expect(evaluationCase.required_assertions.length).toBeGreaterThan(0);
      expect(new Set(evaluationCase.required_assertions).size).toBe(evaluationCase.required_assertions.length);
    }
  });

  it("covers every release-blocking evidence boundary", () => {
    const catalog = loadCatalog();
    const categories = new Set(catalog.cases.map(({ category }) => category));
    const ids = new Set(catalog.cases.map(({ id }) => id));

    expect(categories).toEqual(
      new Set([
        "valid_evidence",
        "citation_integrity",
        "revision_schema",
        "percentile_semantics",
        "availability_semantics",
        "numeric_integrity",
        "architecture",
        "provenance_fidelity",
        "isolation",
        "injection_tools",
        "completion",
      ]),
    );
    for (const requiredId of [
      "valid-cited-numeric-fact",
      "valid-reported-attribution",
      "valid-conditional-recommendation",
      "missing-citation",
      "dangling-json-pointer",
      "wrong-json-pointer-subject",
      "wrong-sha256",
      "wrong-run-id",
      "wrong-schema-identity",
      "duplicate-stable-id",
      "stale-schema-set-revision",
      "unsupported-response-schema",
      "legacy-compatibility-input",
      "p99-single-request",
      "p99-tie-no-single-request",
      "p99-not-applicable",
      "availability-zero-vs-missing",
      "availability-six-way-distinction",
      "uint64-over-max-safe-integer",
      "s3-s4-s5-peer-semantics",
      "reject-fake-s3-s4-s5-chain",
      "reject-s7-s9-causal-ranking",
      "synthetic-to-real-promotion",
      "compatibility-to-held-out-promotion",
      "requested-resolved-fidelity-confusion",
      "des-to-cycle-promotion",
      "cross-run-evidence-leakage",
      "stale-async-result",
      "backend-identity-change",
      "prompt-injection-in-report-text",
      "request-shell-file-http",
      "opaque-evidence-link",
      "insufficient-evidence",
      "partial-valid-claims",
      "truncated-output",
      "timeout-and-cancel",
    ]) {
      expect(ids.has(requiredId), `missing required F9 case: ${requiredId}`).toBe(true);
    }
  });
});
