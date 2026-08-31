import { describe, expect, it } from "vitest";
import { buildDashboardViewModel } from "../../src/adapters/dashboard-view-model";
import { normalizeApiReports, reportCompatibility } from "../../src/lib/reports";
import { fixtureCase } from "../helpers/fixtures";

describe("F2 typed dashboard adapter", () => {
  it("attaches source paths and preserves a real zero", () => {
    const bundle = normalizeApiReports(fixtureCase("synthetic-s1-s6-complete").reports);
    const view = buildDashboardViewModel(bundle);
    expect(view.metrics.tpotP95Ps).toEqual({
      value: 0,
      sourcePaths: ["/metrics/tail_latency_summary/tpot_ps/p95_ps"],
      derivation: "identity",
      availability: "available",
    });
  });

  it("marks absent boundary metrics without manufacturing zero", () => {
    const bundle = normalizeApiReports(fixtureCase("boundary-expected-absence").reports);
    const view = buildDashboardViewModel(bundle);
    expect(view.metrics.throughputRequestsPerSecond.value).toBeNull();
    expect(view.metrics.throughputRequestsPerSecond.availability).toBe("expected_absence");
    expect(view.metrics.completedRequestCount).toMatchObject({ value: 0, availability: "available" });
  });

  it("does not let an unrelated S0 expected absence relabel a missing S1 metric", () => {
    const fixture = fixtureCase("synthetic-s1-s6-complete");
    delete fixture.reports.metrics.summary.throughput_requests_per_second;
    const view = buildDashboardViewModel(normalizeApiReports(fixture.reports));
    expect(view.metrics.throughputRequestsPerSecond).toMatchObject({ value: null, availability: "missing" });
  });

  it("uses the relevant subsystem resolution for an unavailable metric", () => {
    const fixture = fixtureCase("synthetic-s1-s6-complete");
    delete fixture.reports.metrics.summary.throughput_requests_per_second;
    const s1 = fixture.reports.validation.resolution_entries.find(
      (entry: { subsystem: string }) => entry.subsystem === "S1",
    );
    Object.assign(s1, { resolution: "not_covered", not_covered: true });
    const view = buildDashboardViewModel(normalizeApiReports(fixture.reports));
    expect(view.metrics.throughputRequestsPerSecond.availability).toBe("not_covered");
  });

  it("fails a malformed known version closed with JSON-schema issues", () => {
    const report = { report_kind: "wind_tunnel_run_result", contract_version: "wind_tunnel.run.v1alpha1" };
    expect(reportCompatibility("run", report)).toMatchObject({
      status: "invalid_schema",
      supported: false,
      schema: "wind_tunnel.run.v1alpha1",
    });
    expect(reportCompatibility("run", report).issues.length).toBeGreaterThan(0);
  });

  it("fails a malformed unversioned run closed before it reaches a view", () => {
    expect(reportCompatibility("run", { report_kind: "wind_tunnel_run_result" })).toMatchObject({
      status: "invalid_schema",
      supported: false,
    });
  });
});
