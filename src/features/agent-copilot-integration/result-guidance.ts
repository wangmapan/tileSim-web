import type { ReportBundle } from "../../contracts/report-model";
import { formatNumber, formatPercent, formatPicoseconds, statusLabel } from "../../lib/format";

export interface GuidanceSection {
  title: string;
  body: string;
}

/** Only reorganizes values the current, verified report already contains. No metric is inferred. */
export function summarizeRunResult(bundle: ReportBundle, runId: string): GuidanceSection[] {
  const run = bundle.run;
  if (!run)
    return [
      {
        title: "报告尚未就绪",
        body: "当前运行没有可读取的运行报告。请先到结果页确认报告状态；这里不会用示例或旧运行补齐。",
      },
    ];
  const metrics = bundle.metrics;
  const summary = metrics?.summary;
  const p99 = metrics?.tail_latency_summary;
  const overview = [`运行 ${runId}：${statusLabel(run.status || "unknown")}。`];
  if (run.status && run.status !== "completed") {
    overview.push("运行未报告为已完成；下面仅列出报告已提供的值，不代表一次完整成功实验。");
  }
  if (summary?.completed_request_count !== undefined && summary.request_count !== undefined) {
    overview.push(
      `完成请求 ${formatNumber(summary.completed_request_count, 0)}/${formatNumber(summary.request_count, 0)}（/metrics/summary）。`,
    );
  }
  if (summary?.throughput_requests_per_second !== undefined) {
    overview.push(
      `吞吐 ${formatNumber(summary.throughput_requests_per_second)} req/s（/metrics/summary/throughput_requests_per_second）。`,
    );
  }
  if (p99?.ttft_ps?.p99_ps !== undefined) {
    overview.push(
      `TTFT P99 ${formatPicoseconds(p99.ttft_ps.p99_ps)}（/metrics/tail_latency_summary/ttft_ps/p99_ps）。`,
    );
  }
  if (p99?.tpot_ps?.p99_ps !== undefined) {
    overview.push(
      `TPOT P99 ${formatPicoseconds(p99.tpot_ps.p99_ps)}（/metrics/tail_latency_summary/tpot_ps/p99_ps）。`,
    );
  }

  const focus: string[] = [];
  if (run.bottleneck_report) {
    const bottleneck = run.bottleneck_report;
    focus.push(
      `后端报告的主要瓶颈：${bottleneck.title || bottleneck.primary_subsystem || "未命名"}（/run/bottleneck_report）。`,
    );
    if (bottleneck.detail) focus.push(`后端说明：${bottleneck.detail}`);
  } else {
    focus.push("后端未提供主要瓶颈报告；不能仅凭吞吐或 P99 猜测根因。");
  }
  if (run.cause) focus.push(`运行结论（后端原文）：${run.cause}（/run/cause）。`);
  if (run.next_action) focus.push(`下一步（后端原文）：${run.next_action}（/run/next_action）。`);

  const provenance = bundle.validation?.trace_provenance || metrics?.trace_provenance;
  const limits: string[] = [];
  if (provenance?.source_mode) limits.push(`Trace 来源：${statusLabel(provenance.source_mode)}`);
  if (provenance?.calibration_level) limits.push(`校准：${statusLabel(provenance.calibration_level)}`);
  if (provenance?.allowed_claim_scope) limits.push(`结论范围：${statusLabel(provenance.allowed_claim_scope)}`);
  const completeness = run.summary?.validation_completeness;
  if (completeness !== undefined) limits.push(`验证完整度 ${formatPercent(completeness)} 是字段覆盖，不是准确率`);
  const gaps = bundle.validation?.open_gaps?.length ?? 0;
  if (gaps) limits.push(`验证报告还有 ${gaps} 项开放缺口（/validation/open_gaps）`);
  if (!metrics) limits.push("性能指标报告缺失；吞吐和尾延迟未报告，不能当作 0");
  if (!provenance) limits.push("未找到 Trace 来源与校准声明，不能据此声称真实系统验证");
  if (!limits.length) limits.push("仍需结合原始证据判断可主张范围");

  return [
    { title: "运行结果速览", body: overview.join("\n") },
    { title: "先看这些重点", body: focus.join("\n") },
    {
      title: "可信范围与下一步",
      body: `${limits.join("；")}。\n可继续问“小拓，TTFT 和 TPOT 有什么区别？”或到结果可信度页核对原始证据。`,
    },
  ];
}

export function teachingForQuestion(instruction: string, bundle: ReportBundle | null): GuidanceSection | null {
  const text = instruction.toLowerCase();
  if (/ttft|首.{0,3}token|首字|首词/u.test(text)) {
    const value = bundle?.metrics?.tail_latency_summary?.ttft_ps?.p99_ps;
    return {
      title: "认识 TTFT",
      body: `TTFT 是从请求到首个输出 token 的等待时间，适合观察首响应体验。P99 是尾部百分位，不是平均值。${value === undefined ? "当前报告没有可引用的 TTFT P99。" : `当前报告的 TTFT P99 为 ${formatPicoseconds(value)}（/metrics/tail_latency_summary/ttft_ps/p99_ps）。`} 要解释变慢的原因，还需看调度、执行和通信证据。`,
    };
  }
  if (/tpot|逐.{0,3}token|输出速度|解码速度/u.test(text)) {
    const value = bundle?.metrics?.tail_latency_summary?.tpot_ps?.p99_ps;
    return {
      title: "认识 TPOT",
      body: `TPOT 是输出 token 之间的时间，反映持续生成的节奏；它与首 token 等待的 TTFT 不同。${value === undefined ? "当前报告没有可引用的 TPOT P99。" : `当前报告的 TPOT P99 为 ${formatPicoseconds(value)}（/metrics/tail_latency_summary/tpot_ps/p99_ps）。`} 比较配置时还要同时核对吞吐和样本范围。`,
    };
  }
  if (/p99|尾延迟|百分位/u.test(text)) {
    return {
      title: "怎么看 P99",
      body: "P99 表示约 99% 的有效样本不超过该值；它不是最慢请求，也不是平均延迟。先核对报告中的样本数和指标种类（TTFT、TPOT 或端到端），再查看慢请求原因与归因证据；缺少样本时不能推断尾延迟。",
    };
  }
  if (/吞吐|req\/s|每秒请求/u.test(text)) {
    const value = bundle?.metrics?.summary?.throughput_requests_per_second;
    return {
      title: "怎么看吞吐",
      body: `吞吐是单位时间完成的请求数。${value === undefined ? "当前报告没有可引用的吞吐值。" : `当前报告为 ${formatNumber(value)} req/s（/metrics/summary/throughput_requests_per_second）。`} 吞吐提高不代表尾延迟一定改善，应与 P99、完成请求数和证据范围一起看。`,
    };
  }
  if (/可信|校准|验证|合成|真实|准确/u.test(text)) {
    return {
      title: "怎样判断结果可信范围",
      body: "先查 Trace 来源、校准级别和允许的结论范围，再看验证报告的开放缺口、请求 fidelity 与实际解析 fidelity。验证完整度表示字段覆盖，不等于预测准确率；合成一致性也不是独立真实 Trace 验证。",
    };
  }
  if (/怎么(看|读|分析)|如何(看|读|分析)|教|学习|入门/u.test(text)) {
    return {
      title: "三步读懂实验结果",
      body: "① 先看运行状态、完成请求数和 Trace 来源，确认正在看哪次运行。② 再看吞吐、TTFT/TPOT P99，辨别首响应、持续生成与尾部样本。③ 最后读后端瓶颈报告、慢请求归因和验证缺口；缺失项保持“未报告”，不要当作零。可以接着问某个指标是什么意思。",
    };
  }
  return null;
}

export function wantsResultAnalysis(instruction: string): boolean {
  return (
    /(?:分析|总结|整理|解读|概览).{0,8}(?:实验结果|运行结果|报告|结果)|(?:实验结果|运行结果|报告|结果).{0,8}(?:分析|总结|整理|重点|解读)|为什么慢|主要瓶颈/u.test(
      instruction,
    ) && !/(?:配置|设置|调整|修改|改成|=)/u.test(instruction)
  );
}
