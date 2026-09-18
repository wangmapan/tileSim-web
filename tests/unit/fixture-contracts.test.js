import { describe, expect, it } from "vitest";
import { buildExecutionResult } from "../../src/features/execution-inspector";
import { setLocale } from "../../src/i18n";
import {
  bundleIdentity,
  evidenceSummary,
  isCompleteBundle,
  normalizeApiReports,
  reportCompatibility,
  unsupportedSchemaReports,
} from "../../src/lib/reports";
import { fieldAudit, fixtureCase, fixtureCatalog, jsonPointer } from "../helpers/fixtures";

describe("F1 report fixtures", () => {
  it("loads five provenance-distinct regression cases", () => {
    expect(fixtureCatalog().cases.map((item) => item.id)).toEqual([
      "synthetic-s1-s6-complete",
      "held-out-s1-s6",
      "boundary-expected-absence",
      "legacy-missing-optional",
      "unknown-run-schema",
    ]);
  });

  it.each(["synthetic-s1-s6-complete", "held-out-s1-s6", "legacy-missing-optional"])(
    "preserves evidence boundaries for %s",
    (id) => {
      const fixture = fixtureCase(id);
      const bundle = normalizeApiReports(fixture.reports);
      const evidence = evidenceSummary(bundle);
      expect(evidence).toMatchObject({
        sourceMode: fixture.expected.source_mode,
        lane: fixture.expected.validation_lane,
        claimScope: fixture.expected.claim_scope,
      });
      if (fixture.expected.evidence_tier) expect(evidence.tier).toBe(fixture.expected.evidence_tier);
      expect(isCompleteBundle(bundle)).toBe(fixture.expected.complete_bundle);
    },
  );

  it("keeps actual zero separate from unavailable boundary metrics", () => {
    const fixture = fixtureCase("boundary-expected-absence");
    const bundle = normalizeApiReports(fixture.reports);
    expect(bundle.metrics.summary.rejected_request_count).toBe(0);
    expect(bundle.metrics.summary.throughput_requests_per_second).toBeUndefined();
    expect(bundle.metrics.tail_latency_summary).toBeUndefined();
    expect(isCompleteBundle(bundle)).toBe(false);
  });

  it("localizes visualization fallback details in English", () => {
    const fixture = fixtureCase("boundary-expected-absence");
    setLocale("en-US");
    try {
      const result = buildExecutionResult(normalizeApiReports(fixture.reports), fixture.inputs);
      const s1Fallback = result.layers.find((layer) => layer.id === "S1").visualizations[0];
      expect(s1Fallback.rationale).toBe("Discrete request quantities suit grouped horizontal bar charts.");
      expect(s1Fallback.emptyReason).toBe("No runtime trace request details.");
      expect(`${s1Fallback.rationale} ${s1Fallback.emptyReason}`).not.toMatch(/[\u3400-\u9fff]/u);
    } finally {
      setLocale("zh-CN");
    }
  });

  it("preserves legacy four-report bundles without inventing optional reports", () => {
    const bundle = normalizeApiReports(fixtureCase("legacy-missing-optional").reports);
    expect(isCompleteBundle(bundle)).toBe(true);
    expect(bundle.execution_envelope).toBeNull();
    expect(bundle.design_space).toBeNull();
  });

  it("fails structured interpretation closed for an unknown explicit schema", () => {
    const fixture = fixtureCase("unknown-run-schema");
    const bundle = normalizeApiReports(fixture.reports);
    const unsupported = unsupportedSchemaReports(bundle);
    expect(bundle.run).toBeNull();
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0]).toMatchObject({
      kind: fixture.expected.unsupported_kind,
      schema: fixture.expected.unsupported_schema,
      status: "unsupported_schema",
      supported: false,
    });
    expect(unsupported[0].report.future_contract_field).toBe(fixture.expected.unknown_field);
    expect(bundleIdentity(bundle)).toBe("fixture-unknown::events");
    expect(reportCompatibility("run", unsupported[0].report).supported).toBe(false);
  });
});

describe("F1 field audit", () => {
  it("matches identity and array-length mappings", () => {
    const fixture = fixtureCase(fieldAudit().fixture_id);
    for (const entry of fieldAudit().entries) {
      if (!["identity", "identity_preserve_zero", "array_length"].includes(entry.derivation)) continue;
      const source = jsonPointer(fixture.reports[entry.artifact], entry.json_pointer);
      const actual = entry.derivation === "array_length" ? source.length : source;
      expect(actual, entry.ui_field).toEqual(entry.expected);
    }
  });

  it("matches the S3/S4/S5 deduplication rules used by the execution adapter", () => {
    const fixture = fixtureCase(fieldAudit().fixture_id);
    const result = buildExecutionResult(normalizeApiReports(fixture.reports), fixture.inputs);
    const layers = new Map(result.layers.map((layer) => [layer.id, layer]));
    expect(layers.get("S3").records).toHaveLength(fixture.expected.memory_events);
    expect(layers.get("S4").records).toHaveLength(fixture.expected.device_tasks);
    expect(layers.get("S5").records).toHaveLength(fixture.expected.collectives);
  });
});
