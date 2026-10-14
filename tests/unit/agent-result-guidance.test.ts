import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactManifestResponse } from "../../src/contracts/bridge-api";
import type { ReportBundle } from "../../src/contracts/report-model";
import type { EvidenceQueryContext } from "../../src/features/run-evidence";

const { fetchVerifiedArtifact } = vi.hoisted(() => ({ fetchVerifiedArtifact: vi.fn() }));
vi.mock("../../src/features/run-evidence", () => ({ fetchVerifiedArtifact }));

import {
  buildCompleteResultAnalysisContext,
  buildResultAnalysisContext,
  canUseResultAnalysisRoute,
  summarizeRunResult,
  teachingForQuestion,
  wantsResultAnalysis,
} from "../../src/features/agent-copilot-integration";

function bundle(run: Record<string, unknown> | null, metrics: Record<string, unknown> | null): ReportBundle {
  return {
    run: run as ReportBundle["run"],
    metrics: metrics as ReportBundle["metrics"],
    validation: null,
    tail: null,
    design_space: null,
    execution_envelope: null,
    run_bound_des_evidence: null,
    unsupported: {},
    compatibility: {},
  };
}

function manifest(overrides: Partial<ArtifactManifestResponse> = {}): ArtifactManifestResponse {
  return {
    schema_version: "tilesim.bridge.artifact_manifest.v2",
    api_version: "tilesim.bridge.api.v1",
    schema_set_revision: "schema:test",
    run_id: "run-123",
    artifacts: [
      {
        artifact_id: "metrics",
        report_kind: "metrics",
        file_name: "metrics.json",
        media_type: "application/json",
        bytes: 120,
        sha256: "a".repeat(64),
        schema_identity: "tilesim.metrics_report.v1",
        contract_status: "supported",
      },
    ],
    rejected_artifacts: [],
    ...overrides,
  };
}

const evidenceQueryContext: EvidenceQueryContext = { backendRevision: "backend:test", manifest: null };

beforeEach(() => fetchVerifiedArtifact.mockReset());

describe("小拓的只读报告整理与教学", () => {
  it("仅允许结果/只读路由使用结果分析，即使全局存在旧报告", () => {
    expect(canUseResultAnalysisRoute("lightweight_results")).toBe(true);
    expect(canUseResultAnalysisRoute("overview")).toBe(true);
    expect(canUseResultAnalysisRoute("experiment")).toBe(false);
    expect(canUseResultAnalysisRoute("lightweight_prepare")).toBe(false);
    expect(canUseResultAnalysisRoute("lightweight_run")).toBe(false);
  });

  it("只引用报告已有指标及后端原文，不把缺失值补为零", () => {
    const result = summarizeRunResult(
      bundle(
        {
          status: "completed",
          summary: { validation_completeness: 0.75 },
          bottleneck_report: { title: "通信等待", detail: "跨节点集合通信" },
          cause: "后端归因原文",
          next_action: "后端建议原文",
        },
        {
          summary: { request_count: 4, completed_request_count: 3, throughput_requests_per_second: 0 },
          tail_latency_summary: { ttft_ps: { p99_ps: "9007199254740993000" } },
        },
      ),
      "run-123",
    );
    expect(result).toHaveLength(3);
    expect(result[0].body).toContain("完成请求 3/4");
    expect(result[0].body).toContain("吞吐 0 req/s");
    expect(result[0].body).toContain("TTFT P99");
    expect(result[0].body).not.toContain("TPOT P99");
    expect(result[1].body).toContain("后端归因原文");
    expect(result[1].body).toContain("后端建议原文");
    expect(result[2].body).toContain("不是准确率");
  });

  it("缺失报告、缺失指标与不完整运行均明示边界", () => {
    expect(summarizeRunResult(bundle(null, null), "run-123")[0].title).toBe("报告尚未就绪");
    const result = summarizeRunResult(bundle({ status: "failed", summary: {} }, null), "run-123");
    expect(result[0].body).toContain("未报告为已完成");
    expect(result[1].body).toContain("不能仅凭吞吐或 P99 猜测根因");
    expect(result[2].body).toContain("不能当作 0");
  });

  it("按问题解释概念，不在无报告时编造当前数值", () => {
    expect(teachingForQuestion("教我看 TTFT", null)?.body).toContain("没有可引用的 TTFT P99");
    expect(teachingForQuestion("P99 是平均值吗", null)?.body).toContain("不是平均延迟");
    expect(teachingForQuestion("怎么看实验结果", null)?.title).toContain("三步");
    expect(wantsResultAnalysis("帮我分析实验结果，指出重点")).toBe(true);
    expect(wantsResultAnalysis("整理结果，指出重点")).toBe(true);
    expect(wantsResultAnalysis("把配置设置为 16 并分析报告")).toBe(false);
  });

  it("只把确定性摘要和证据路径投影给结果分析模型", () => {
    const context = buildResultAnalysisContext(
      bundle({ status: "completed" }, { summary: { throughput_requests_per_second: 12 } }),
      "run-123",
    );
    expect(context.run_id).toBe("run-123");
    expect(context.sections.map((section) => section.title)).toContain("运行结果速览");
    expect(context.evidence_paths).toContain("/metrics/summary/throughput_requests_per_second");
  });

  it("逐一读取 manifest 中的全部 artifact，并保留 rejected 条目和覆盖统计", async () => {
    const currentManifest = manifest({
      artifacts: [
        manifest().artifacts[0],
        {
          artifact_id: "trace",
          report_kind: "runtime_trace",
          file_name: "trace.json",
          media_type: "application/json",
          bytes: 90,
          sha256: "b".repeat(64),
          schema_identity: "tilesim.runtime_trace.v1",
          contract_status: "legacy_compatibility",
        },
        {
          artifact_id: "not-applicable",
          report_kind: null,
          file_name: "none.json",
          media_type: "application/json",
          bytes: 0,
          sha256: "c".repeat(64),
          schema_identity: "",
          contract_status: "not_applicable",
        },
      ],
      rejected_artifacts: [
        {
          artifact_id: "broken",
          file_name: "broken.json",
          reason: "unsupported_schema",
          schema_identity: "tilesim.unknown.v1",
          json_pointer: "/",
        },
      ],
    });
    fetchVerifiedArtifact.mockImplementation(async (...args: unknown[]) => {
      const entry = args[1] as { artifact_id: string } | undefined;
      if (entry?.artifact_id === "trace") return { events: [{ stage: "prefill" }] };
      return { summary: { throughput_requests_per_second: 12 } };
    });

    const context = await buildCompleteResultAnalysisContext(
      bundle({ status: "completed" }, { summary: { throughput_requests_per_second: 12 } }),
      "run-123",
      currentManifest,
      evidenceQueryContext,
    );

    expect(fetchVerifiedArtifact).toHaveBeenCalledTimes(2);
    expect(fetchVerifiedArtifact.mock.calls.map(([runId, entry]) => [runId, entry.artifact_id])).toEqual(
      expect.arrayContaining([
        ["run-123", "metrics"],
        ["run-123", "trace"],
      ]),
    );
    expect(context.evidence).toMatchObject({
      manifest_status: "verified",
      artifact_count: 3,
      full_content_count: 2,
      summary_only_count: 0,
      unavailable_count: 0,
      rejected_count: 1,
    });
    expect(context.evidence.artifacts.find((entry) => entry.artifact_id === "not-applicable")?.content_status).toBe(
      "not_applicable",
    );
    expect(context.evidence.artifacts.find((entry) => entry.artifact_id === "not-applicable")?.schema_identity).toBe(
      "not_applicable",
    );
    expect(context.evidence.rejected_artifacts[0]).toMatchObject({ artifact_id: "broken", json_pointer: "/" });
  });

  it("报告读取阶段只播报真实 artifact 计数和整理阶段", async () => {
    const progress: string[] = [];
    fetchVerifiedArtifact.mockImplementation(async () => ({ summary: { ok: true } }));
    await buildCompleteResultAnalysisContext(
      bundle({ status: "completed" }, null),
      "run-123",
      manifest({
        artifacts: [
          manifest().artifacts[0],
          { ...manifest().artifacts[0], artifact_id: "trace", file_name: "trace.json" },
        ],
      }),
      evidenceQueryContext,
      (state) => progress.push(`${state.stage}:${state.completed}/${state.total}`),
    );
    expect(progress[0]).toBe("reading_evidence:0/2");
    expect(progress).toContain("reading_evidence:1/2");
    expect(progress).toContain("reading_evidence:2/2");
    expect(progress.at(-1)).toBe("assembling_context:2/2");
  });

  it("没有可用查询上下文时显式标记 unavailable，run 不匹配时不读取任何 artifact", async () => {
    const currentManifest = manifest();
    const failed = await buildCompleteResultAnalysisContext(
      bundle({ status: "completed" }, null),
      "run-123",
      currentManifest,
      null,
    );
    expect(failed.evidence).toMatchObject({ artifact_count: 1, unavailable_count: 1, full_content_count: 0 });
    expect(failed.evidence.artifacts[0]).toMatchObject({
      content_status: "unavailable",
      omission_reason: "verification_failed",
    });

    fetchVerifiedArtifact.mockClear();
    const mismatch = await buildCompleteResultAnalysisContext(
      bundle({ status: "completed" }, null),
      "different-run",
      currentManifest,
      evidenceQueryContext,
    );
    expect(mismatch.evidence.manifest_status).toBe("run_mismatch");
    expect(fetchVerifiedArtifact).not.toHaveBeenCalled();
  });

  it("证据总量超过模型预算时保留所有身份并降级部分全文为摘要", async () => {
    const artifacts = Array.from({ length: 20 }, (_, index) => ({
      artifact_id: `artifact-${index}`,
      report_kind: "fixture",
      file_name: `artifact-${index}.json`,
      media_type: "application/json" as const,
      bytes: 10_000,
      sha256: String(index).padStart(64, "0"),
      schema_identity: "tilesim.fixture.v1",
      contract_status: "supported" as const,
    }));
    fetchVerifiedArtifact.mockImplementation(async () => ({ payload: "x".repeat(10_000) }));
    const context = await buildCompleteResultAnalysisContext(
      bundle({ status: "completed" }, null),
      "run-123",
      manifest({ artifacts }),
      evidenceQueryContext,
    );
    const serializedContentCharacters = context.evidence.artifacts.reduce(
      (total, entry) => total + (entry.content === undefined ? 0 : JSON.stringify(entry.content).length),
      0,
    );
    expect(context.evidence.artifact_count).toBe(20);
    expect(context.evidence.full_content_count).toBeGreaterThan(0);
    expect(context.evidence.summary_only_count).toBeGreaterThan(0);
    expect(context.evidence.unavailable_count).toBe(0);
    expect(serializedContentCharacters).toBeLessThanOrEqual(150_000);
  });

  it("超过 8 MB 的真实 manifest 条目只保留身份与未读取原因", async () => {
    const events = {
      ...manifest().artifacts[0],
      artifact_id: "runtime-events",
      file_name: "runtime-events.json",
      schema_identity: "tilesim.s1_runtime_event_trace.v1",
      bytes: 9_689_193,
      sha256: "56cc5c6724ae1cd56c490037bced1f398dd553645ddc5e337bc4c17096b6b54a",
    };
    const attribution = {
      ...events,
      artifact_id: "request-attribution",
      file_name: "request-attribution.json",
      schema_identity: "tilesim.request_attribution.v1",
      bytes: 23_550_164,
      sha256: "cebddbfd1abd41e474216477548cea6e4b628273752fe0e3a3e526a85d7ac7b4",
    };
    fetchVerifiedArtifact.mockClear();
    const context = await buildCompleteResultAnalysisContext(
      bundle({ status: "completed" }, null),
      "run-123",
      manifest({ artifacts: [events, attribution] }),
      evidenceQueryContext,
    );
    expect(fetchVerifiedArtifact).not.toHaveBeenCalled();
    expect(context.evidence).toMatchObject({
      artifact_count: 2,
      full_content_count: 0,
      summary_only_count: 0,
      unavailable_count: 2,
    });
    expect(context.evidence.artifacts).toEqual([
      expect.objectContaining({
        artifact_id: "runtime-events",
        schema_identity: events.schema_identity,
        bytes: "9689193",
        sha256: events.sha256,
        content_status: "unavailable",
        omission_reason: "too_large_for_model_context",
      }),
      expect.objectContaining({
        artifact_id: "request-attribution",
        schema_identity: attribution.schema_identity,
        bytes: "23550164",
        sha256: attribution.sha256,
        content_status: "unavailable",
        omission_reason: "too_large_for_model_context",
      }),
    ]);
    expect(context.evidence.artifacts.every((entry) => entry.content === undefined)).toBe(true);
  });
});
