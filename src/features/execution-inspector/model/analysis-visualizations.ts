import type {
  AttributionItem,
  DesignSpaceReport,
  LosslessInteger,
  MetricsReport,
} from "../../../contracts/report-model";
import { isLosslessInteger, losslessIntegerToBigInt } from "../../../contracts/lossless-json";
import { t } from "../../../i18n";
import {
  attributionSource,
  fabricDomainSource,
  requestFabricContributionSource,
  requestMetricSource,
} from "./evidence-pointers";
import type { LayerVisualization, VisualizationRow } from "./types";

const palette = {
  primary: "#3f7868",
  queue: "#d89a45",
  congestion: "#bd6457",
  secondary: "#567fb0",
};

function localized(visualization: LayerVisualization): LayerVisualization {
  return {
    ...visualization,
    title: t(visualization.title),
    description: t(visualization.description),
    question: t(visualization.question),
    firstLook: t(visualization.firstLook),
    boundary: t(visualization.boundary),
    rationale: t(visualization.rationale),
    columns: visualization.columns.map((column) => t(column)),
    rawColumns: visualization.rawColumns?.map((column) => t(column)),
    series: visualization.series.map((series) => ({ ...series, name: t(series.name) })),
    emptyReason: visualization.emptyReason ? t(visualization.emptyReason) : undefined,
  };
}

function safePsToMicroseconds(value: LosslessInteger | undefined): number | null {
  if (!isLosslessInteger(value)) return null;
  const ps = losslessIntegerToBigInt(value);
  const integer = ps / 1_000_000n;
  const remainder = ps % 1_000_000n;
  if (integer > BigInt(Number.MAX_SAFE_INTEGER) || integer < BigInt(Number.MIN_SAFE_INTEGER)) return null;
  return Number(integer) + Number(remainder) / 1_000_000;
}

function rawLossless(value: LosslessInteger | undefined) {
  return isLosslessInteger(value) ? String(value) : "";
}

function unavailable(id: string, title: string, reason: string, boundary: string): LayerVisualization {
  return localized({
    id,
    kind: "none",
    title,
    description: "保留完整字段与缺失原因，不为不可用数据生成占位图。",
    question: "当前报告是否提供了足够且适合绘图的数据？",
    firstLook: "先看降级原因，再决定是否检查原始 artifact。",
    boundary,
    rationale: "缺少正式字段或数值超出安全显示范围时失败关闭。",
    unit: "",
    sourcePaths: [],
    derivation: "identity",
    columns: ["报告值"],
    series: [],
    rows: [],
    emptyReason: reason,
  });
}

export function buildRequestLatencyVisualization(metrics: MetricsReport | null | undefined): LayerVisualization {
  const requests = metrics?.request_metrics || [];
  const rows: VisualizationRow[] = requests.map((request) => ({
    label: request.request_id,
    values: [
      safePsToMicroseconds(request.ttft_ps),
      safePsToMicroseconds(request.tpot_ps),
      safePsToMicroseconds(request.end_to_end_latency_ps),
    ],
    rawValues: [rawLossless(request.ttft_ps), rawLossless(request.tpot_ps), rawLossless(request.end_to_end_latency_ps)],
    sourcePath: requestMetricSource(requests, request.request_id),
    status: request.status,
  }));
  if (!rows.length)
    return unavailable(
      "metrics-request-latency",
      "请求延迟比较",
      "没有 request_metrics；这不等于存在 0 µs 请求。",
      "boundary run 可以没有 TTFT/TPOT；missing、not applicable 与真实 0 必须分开。",
    );
  return localized({
    id: "metrics-request-latency",
    kind: "bar",
    title: "请求延迟比较",
    description: "并列比较每个请求的 TTFT、TPOT 与端到端延迟；图中换算为 µs，字段表保留精确 ps。",
    question: "哪些请求开始响应、连续生成或全部完成得更慢？",
    firstLook: "先找端到端最长的请求，再比较它的 TTFT 与 TPOT 构成。",
    boundary: "三项均直接来自 request_metrics；前端只做 ps→µs 显示换算，不计算分位数或补造缺失指标。",
    rationale: "请求是离散实体，同单位延迟适合分组水平条形图；不使用暗示时间趋势的折线图。",
    unit: "µs",
    sourcePaths: ["metrics:/request_metrics/*/{ttft_ps,tpot_ps,end_to_end_latency_ps}"],
    derivation: "unit_conversion",
    columns: ["TTFT", "TPOT", "端到端"],
    rawColumns: ["ttft_ps", "tpot_ps", "end_to_end_latency_ps"],
    rawUnit: "ps",
    series: [
      { name: "TTFT", color: palette.primary },
      { name: "TPOT", color: palette.secondary },
      { name: "端到端", color: palette.congestion },
    ],
    rows,
  });
}

export function buildFabricCompositionVisualizations(metrics: MetricsReport | null | undefined): LayerVisualization[] {
  const domains = metrics?.system_summary?.fabric_domain_utilization || [];
  const requests = metrics?.system_summary?.request_fabric_contributions || [];
  const domainRows: VisualizationRow[] = domains.map((domain, index) => ({
    label: domain.domain_id || `domain-${index + 1}`,
    values: [domain.runtime_us ?? null, domain.queue_delay_us ?? null, domain.congestion_delay_us ?? null],
    sourcePath: fabricDomainSource(domains, domain.domain_id),
  }));
  const requestRows: VisualizationRow[] = requests.map((request, index) => ({
    label: request.request_id || `request-${index + 1}`,
    values: [request.runtime_us ?? null, request.queue_delay_us ?? null, request.congestion_delay_us ?? null],
    sourcePath: requestFabricContributionSource(requests, request.request_id),
    status: request.dominant_delay_kind,
    detail: request.dominant_domain_id,
  }));
  const shared = {
    kind: "stacked-bar" as const,
    unit: "µs",
    derivation: "identity" as const,
    columns: ["Runtime", "Queue", "Congestion"],
    series: [
      { name: "Runtime", color: palette.primary },
      { name: "Queue", color: palette.queue },
      { name: "Congestion", color: palette.congestion },
    ],
  };
  return [
    domainRows.length
      ? {
          ...shared,
          id: "fabric-domain-composition",
          title: "通信域时间构成",
          description: "逐域并列显示后端报告的 runtime、queue 与 congestion 字段。",
          question: "每个通信域的执行、排队和拥塞时间分别有多少？",
          firstLook: "先看 queue 或 congestion 较突出的域，再与主导瓶颈和 topology 证据交叉检查。",
          boundary: "不把三个字段重新解释为完整端到端延迟；利用率与时间构成也不能单独证明因果。",
          rationale: "同一域内三个同单位后端字段适合堆叠比较，字段表保留每个原值。",
          sourcePaths: [
            "metrics:/system_summary/fabric_domain_utilization/*/{runtime_us,queue_delay_us,congestion_delay_us}",
          ],
          rows: domainRows,
        }
      : unavailable(
          "fabric-domain-composition",
          "通信域时间构成",
          "没有 fabric_domain_utilization 域记录。",
          "缺少域记录时不能从系统汇总或 request 记录反推出域构成。",
        ),
    requestRows.length
      ? {
          ...shared,
          id: "fabric-request-composition",
          title: "请求通信时间构成",
          description: "逐请求并列显示后端报告的 runtime、queue 与 congestion 字段。",
          question: "哪些请求把更多时间花在通信执行、排队或拥塞上？",
          firstLook: "先看 queue/congestion 较高的请求，再通过稳定 request_id 查看正式证据。",
          boundary: "只展示 request_fabric_contributions；dominant phase 仍以正式稳定 ID 连接，不按数值猜测。",
          rationale: "请求是离散实体，三个同单位字段适合堆叠水平条形图。",
          sourcePaths: [
            "metrics:/system_summary/request_fabric_contributions/*/{runtime_us,queue_delay_us,congestion_delay_us}",
          ],
          rows: requestRows,
        }
      : unavailable(
          "fabric-request-composition",
          "请求通信时间构成",
          "没有 request_fabric_contributions；这不等于每个请求贡献为 0。",
          "缺少请求贡献时不能从 phase 或域记录按名称、顺序或数值补造请求构成。",
        ),
  ].map(localized);
}

type ObjectiveSource = (candidateIndex: number, objectiveIndex: number) => string | null;
type CandidateSource = (candidateIndex: number) => string | null;

export function buildDesignSpaceVisualization(
  report: DesignSpaceReport | null | undefined,
  objectiveSource: ObjectiveSource = () => null,
  candidateSource: CandidateSource = () => null,
): LayerVisualization {
  const candidates = report?.candidates || report?.ranking || [];
  const objectiveOrder = [
    ...new Set(
      candidates.flatMap((candidate) => (candidate.objectives || []).map((objective) => objective.objective_id)),
    ),
  ];
  const availableCount = (objectiveId: string) =>
    candidates.filter((candidate) => {
      const objective = candidate.objectives?.find((item) => item.objective_id === objectiveId);
      return (
        objective?.availability === "available" &&
        typeof objective.value === "number" &&
        Number.isFinite(objective.value)
      );
    }).length;
  const usable = objectiveOrder.filter((objectiveId) => availableCount(objectiveId) > 0);
  if (!usable.length)
    return unavailable(
      "design-space-objectives",
      "正式 Objective 候选图",
      "没有正式 objectives 可绘制；前端不会用 projected 指标重建 Pareto。",
      "Pareto membership、dominance、rank 与 promotion reason 必须来自正式后端报告。",
    );
  const selected = usable.slice(0, 2);
  const rows = candidates.flatMap((candidate, candidateIndex) => {
    const resolved = selected.map((objectiveId) => {
      const objectiveIndex = candidate.objectives?.findIndex((item) => item.objective_id === objectiveId) ?? -1;
      const objective = objectiveIndex >= 0 ? candidate.objectives?.[objectiveIndex] : undefined;
      return { objective, sourcePath: objectiveIndex >= 0 ? objectiveSource(candidateIndex, objectiveIndex) : null };
    });
    if (!resolved.some(({ objective }) => objective?.availability === "available")) return [];
    return [
      {
        label: candidate.candidate_id,
        values: resolved.map(({ objective }) =>
          objective?.availability === "available" && typeof objective.value === "number" ? objective.value : null,
        ),
        valueSourcePaths: resolved.map(({ sourcePath }) => sourcePath),
        sourcePath: candidateSource(candidateIndex),
        status: candidate.pareto_member === true ? "pareto_member" : candidate.dominance_status || "not_evaluated",
        detail: `final_rank=${candidate.final_rank ?? "missing"}`,
      },
    ];
  });
  const columns = selected.map((objectiveId) => {
    const objective = candidates
      .flatMap((candidate) => candidate.objectives || [])
      .find((item) => item.objective_id === objectiveId);
    return `${objectiveId}${objective?.unit ? ` (${objective.unit})` : ""}`;
  });
  const completeRows = rows.filter((row) => row.values.every((value) => typeof value === "number"));
  const useScatter = selected.length === 2 && completeRows.length >= 2;
  return localized({
    id: "design-space-objectives",
    kind: useScatter ? "scatter" : "bar",
    title: "正式 Objective 候选图",
    description: useScatter
      ? "使用后端正式 objectives 的前两个可用维度定位候选，并原样标注 Pareto membership。"
      : "可配对的正式 objective 不足，降级为首个可用 objective 的候选条形图。",
    question: "候选在正式 objectives 上如何权衡，哪些被后端标记为 Pareto member？",
    firstLook: "先看标记为 pareto_member 的候选，再核对方向、单位、rank 与正式 objective evidence。",
    boundary: "前端不计算 Pareto、dominance、rank 或 promotion reason；当前 execution_scope 必须保持 S6_only。",
    rationale: useScatter
      ? "两个正式定量 objective 且至少两个完整候选适合散点比较；membership 仅使用报告标签。"
      : "正式双 objective 数据不足时不伪造二维关系，改用单 objective 条形图。",
    unit: useScatter ? columns.join(" / ") : columns[0]?.match(/\((.+)\)$/)?.[1] || "report unit",
    sourcePaths: ["design-space-report:/candidates/*/objectives/*", "design-space-report:/candidates/*/pareto_member"],
    derivation: "identity",
    columns: useScatter ? columns : columns.slice(0, 1),
    series: [{ name: "Candidate", color: palette.primary }],
    rows: (useScatter ? completeRows : rows).map((row) => ({
      ...row,
      values: useScatter ? row.values : row.values.slice(0, 1),
      valueSourcePaths: useScatter ? row.valueSourcePaths : row.valueSourcePaths?.slice(0, 1),
    })),
  });
}

export function buildAttributionVisualization(
  items: AttributionItem[],
  source: (item: AttributionItem) => string | null = (item) => attributionSource(items, item.attribution_id),
): LayerVisualization {
  const causalItems = items.filter((item) => /^S[0-6]$/.test(item.subsystem || ""));
  const rows = causalItems.map((item) => ({
    label: `${item.subsystem || "unknown"} · ${item.component_code || item.attribution_id || "unknown"}`,
    values: [safePsToMicroseconds(item.score_ps)],
    rawValues: [rawLossless(item.score_ps)],
    sourcePath: source(item),
    status: item.subsystem,
    detail: item.detail,
  }));
  if (!rows.length)
    return unavailable(
      "s9-causal-attribution",
      "S0–S6 延迟贡献",
      "没有 S0–S6 attribution_ranking 记录。",
      "S7 是执行宿主，S8/S9 是输出面；三者不能进入 latency causal ranking。",
    );
  return localized({
    id: "s9-causal-attribution",
    kind: "bar",
    title: "S0–S6 延迟贡献",
    description: "按报告顺序显示 S0–S6 attribution score；图中换算为 µs，字段表保留精确 ps。",
    question: "报告把当前尾延迟分数分配给了哪些 S0–S6 子系统记录？",
    firstLook: "先看分数较高的条目，再阅读其 detail 和正式 evidence pointer。",
    boundary: "只显示报告 ranking；不把 S7/S8/S9 输出记录混入，也不把排序当作真实系统因果证明。",
    rationale: "后端已给出有序离散贡献项，水平条形图便于比较且不改变正式 rank。",
    unit: "µs",
    sourcePaths: ["tail:/attribution_ranking/*/{rank,subsystem,score_ps,share}"],
    derivation: "unit_conversion",
    columns: ["score"],
    rawColumns: ["score_ps"],
    rawUnit: "ps",
    series: [{ name: "score", color: palette.congestion }],
    rows,
  });
}
