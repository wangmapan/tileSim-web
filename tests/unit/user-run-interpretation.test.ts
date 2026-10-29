import { describe, expect, it } from "vitest";
import { fixtureCase } from "../helpers/fixtures";
import {
  buildUserRunInterpretationReport,
  captureUserRunInterpretationBinding,
  createUserRunInterpretationExport,
  renderUserRunInterpretationHtml,
  userRunInterpretationBindingMatches,
  type UserRunInterpretationContext,
} from "../../src/features/user-run-interpretation";
import type { ArtifactManifestResponse } from "../../src/contracts/bridge-api";
import type { ReportBundle } from "../../src/contracts/report-model";

const manifest: ArtifactManifestResponse = {
  schema_version: "tilesim.bridge.artifact_manifest.v2",
  api_version: "tilesim.bridge.api.v1",
  schema_set_revision: "sha256:test-schema",
  run_id: "run-interpretation",
  artifacts: [
    {
      artifact_id: "metrics",
      report_kind: "metrics",
      file_name: "metrics.json",
      media_type: "application/json",
      bytes: 123n,
      sha256: "a".repeat(64),
      schema_identity: "tilesim.metrics_report.v1",
      contract_status: "supported",
    },
  ],
  rejected_artifacts: [],
};

function context(fixtureId = "synthetic-s1-s6-complete"): UserRunInterpretationContext {
  const fixture = fixtureCase(fixtureId);
  return {
    bundle: fixture.reports as ReportBundle,
    inputs: fixture.inputs,
    runId: "run-interpretation",
    runName: "中文 <run>",
    artifactManifest: structuredClone(manifest),
    backendIdentity: "source-a|build-b|source-digest|build-digest",
    evidenceAgentBinding: {
      runId: "run-interpretation",
      backendIdentity: "source-a|build-b|source-digest|build-digest",
      schemaSetRevision: "sha256:test-schema",
      inputSnapshotDigest: "sha256:input-snapshot",
    },
    currentEvidenceAgentBinding: {
      runId: "run-interpretation",
      backendIdentity: "source-a|build-b|source-digest|build-digest",
      schemaSetRevision: "sha256:test-schema",
      inputSnapshotDigest: "sha256:input-snapshot",
    },
    generatedAt: "2026-10-25T00:00:00.000Z",
  };
}

describe("user run interpretation export", () => {
  it("keeps the local deterministic report separate from the full technical report", () => {
    const report = buildUserRunInterpretationReport(context());
    expect(report.schema_version).toBe("tilesim.web.user-run-interpretation.v1");
    expect(report.generator.simulation_recomputation).toBe(false);
    expect(report.key_results.length).toBeLessThanOrEqual(5);
    expect(report.findings.length).toBeLessThanOrEqual(3);
    expect(report.next_steps).toHaveLength(1);
    expect(report.next_steps[0].text).toContain("暂无有依据的后续建议");
    expect(report.binding.artifacts[0]).toMatchObject({
      artifact_id: "metrics",
      schema_identity: "tilesim.metrics_report.v1",
      sha256: "a".repeat(64),
      bytes: "123",
    });
  });

  it("uses backend-authored next_action and never guesses a cause from metrics", () => {
    const next = "请检查后端报告指定的资源配置。";
    const ctx = context();
    ctx.bundle.run!.next_action = next;
    ctx.bundle.run!.bottleneck_report = undefined;
    ctx.bundle.run!.cause = undefined;
    const report = buildUserRunInterpretationReport(ctx);
    expect(report.next_steps[0]).toMatchObject({
      text: next,
      source: "backend_report",
      conditional: false,
      source_paths: ["/run/next_action"],
    });
    expect(report.findings.some((item) => item.source === "backend_report")).toBe(false);
  });

  it("keeps missing metrics, provenance and incomplete runs explicit", () => {
    const ctx = context("boundary-expected-absence");
    ctx.bundle.metrics = null;
    ctx.bundle.validation = null;
    ctx.bundle.run!.status = "partial";
    const report = buildUserRunInterpretationReport(ctx);
    expect(report.attention_items.map((item) => item.text).join("\n")).toContain("不能当作 0");
    expect(report.attention_items.map((item) => item.text).join("\n")).toContain("不能据此声称真实系统验证");
    expect(report.attention_items.map((item) => item.text).join("\n")).toContain("不是 completed");
  });

  it("accepts only validator-shaped conditional recommendations with citations", () => {
    const ctx = context();
    ctx.validatedAgentResult = {
      state: "available_draft",
      detail: "completed",
      invalidClaimIds: [],
      response: {
        claims: [
          {
            claim_id: "claim-1",
            claim_kind: "conditional_recommendation",
            text: "如果后端确认该瓶颈，可在下一次实验中比较两个候选。",
            scope: { recommendation_semantics: "conditional_not_executed" },
            citations: [
              {
                schema_version: "tilesim.bridge.evidence_agent_citation.v1",
                run_id: "run-interpretation",
                artifact_id: "metrics",
                schema_identity: "tilesim.metrics_report.v1",
                sha256: "a".repeat(64),
                json_pointer: "/summary",
                subject: { kind: "run", id: "run-interpretation" },
                citation_role: "conditional_recommendation_basis",
                availability: "available",
              },
            ],
          },
          {
            claim_id: "claim-2",
            claim_kind: "help_text",
            text: "不要把这段帮助当成建议。",
            scope: { recommendation_semantics: "not_applicable" },
            citations: [],
          },
        ],
      } as never,
    };
    const report = buildUserRunInterpretationReport(ctx);
    expect(report.generation_status).toBe("deterministic_with_validated_agent_recommendation");
    expect(report.next_steps[0]).toMatchObject({ conditional: true, source: "validated_agent" });
    expect(report.next_steps[0].citations[0].artifact_id).toBe("metrics");
  });

  it("fences run, backend, revision and artifact identity changes", () => {
    const ctx = context();
    const binding = captureUserRunInterpretationBinding(ctx);
    expect(userRunInterpretationBindingMatches(binding, ctx)).toBe(true);
    ctx.runId = "other-run";
    expect(userRunInterpretationBindingMatches(binding, ctx)).toBe(false);
    ctx.runId = "run-interpretation";
    ctx.artifactManifest!.schema_set_revision = "sha256:other";
    ctx.schemaSetRevision = "sha256:test-schema";
    expect(userRunInterpretationBindingMatches(binding, ctx)).toBe(false);
    expect(() => createUserRunInterpretationExport(ctx)).toThrow("schema revision");
    ctx.artifactManifest!.schema_set_revision = "sha256:test-schema";
    ctx.artifactManifest!.run_id = "other-run";
    expect(() => createUserRunInterpretationExport(ctx)).toThrow("artifact manifest");
  });

  it("escapes HTML and embeds lossless values without artifact bodies", () => {
    const ctx = context();
    ctx.runName = '</script><img src=x onerror="alert(1)">';
    ctx.bundle.run!.summary.end_to_end_latency_us = "9007199254740993" as never;
    const exported = createUserRunInterpretationExport(ctx);
    expect(exported.filename).not.toMatch(/[<>:"/\\|?*]/);
    expect(exported.html).not.toContain('</script><img src=x onerror="alert(1)">');
    expect(exported.html).toContain("\\u003c");
    expect(exported.html).toContain("完整 artifact 正文未嵌入");
    expect(renderUserRunInterpretationHtml(exported.report)).toContain("tilesim-user-run-interpretation");
    if (exported.report.charts.some((chart) => ["bar", "stacked-bar", "scatter", "timeline"].includes(chart.kind))) {
      expect(exported.html).toContain("<svg");
    }
  });

  it("keeps unavailable and rejected evidence explicit without turning it into zero", () => {
    const unavailable = context();
    unavailable.artifactManifest = null;
    const report = buildUserRunInterpretationReport(unavailable);
    expect(report.evidence_status.manifest_status).toBe("unavailable");
    expect(report.attention_items.some((item) => item.text.includes("artifact manifest"))).toBe(true);

    const rejected = context();
    rejected.artifactManifest!.rejected_artifacts = [
      {
        artifact_id: "topology",
        file_name: "topology.json",
        reason: "unsupported_schema",
        schema_identity: "tilesim.unknown.v9",
        json_pointer: "",
      },
    ];
    expect(() => createUserRunInterpretationExport(rejected)).toThrow("不支持的 artifact schema");
    expect(buildUserRunInterpretationReport(rejected).evidence_status.unsupported_schema).toEqual(["topology"]);
  });

  it("does not include stale or refused agent output in recommendations or exports", () => {
    const ctx = context();
    ctx.validatedAgentResult = {
      state: "stale",
      detail: "stale",
      invalidClaimIds: ["claim-1"],
      response: { claims: [] },
    } as never;
    expect(buildUserRunInterpretationReport(ctx).next_steps[0].source).toBe("deterministic_boundary");
    expect(() => createUserRunInterpretationExport(ctx)).toThrow("Evidence Agent 结果已失效");
  });

  it("rejects an agent result when the current binding moved after validation", () => {
    const ctx = context();
    ctx.validatedAgentResult = {
      state: "available_draft",
      detail: "completed",
      invalidClaimIds: [],
      response: { claims: [] },
    } as never;
    ctx.currentEvidenceAgentBinding = { ...ctx.evidenceAgentBinding!, inputSnapshotDigest: "sha256:new" };
    expect(() => createUserRunInterpretationExport(ctx)).toThrow("Evidence Agent 当前绑定已变化");
  });
});
