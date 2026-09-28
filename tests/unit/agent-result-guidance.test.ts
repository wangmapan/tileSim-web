import { describe, expect, it } from "vitest";
import type { ReportBundle } from "../../src/contracts/report-model";
import {
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

describe("小拓的只读报告整理与教学", () => {
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
});
