import type { ExecutionStage, PhaseFabricContribution, ReportBundle, RunInputs } from "../../../contracts/report-model";
import { isLosslessInteger, losslessIntegerToBigInt } from "../../../contracts/lossless-json";
import { groupBy, uniqueBy } from "./aggregations";
import {
  executionStageSource,
  fabricDomainSource,
  fidelityResolutionSource,
  implementationEntrySource,
  phaseContributionSource,
  phaseRecordSource,
  requestFabricContributionSource,
  runtimeRequestSource,
} from "./evidence-pointers";
import type { LayerId, LayerVisualization, VisualizationRow } from "./types";

const colors = {
  runtime: "#3f7868",
  queue: "#d89a45",
  congestion: "#bd6457",
  latency: "#4d7f70",
  occupancy: "#567fb0",
};

function reading(question: string, firstLook: string, boundary: string) {
  return { question, firstLook, boundary };
}

function none(id: string, title: string, rationale: string, emptyReason: string): LayerVisualization {
  return {
    id,
    kind: "none",
    title,
    description: "保留字段表，不为缺少或不适合的数据生成图形。",
    ...reading(
      "当前报告是否提供了足够且适合绘图的数据？",
      "先看缺失或降级原因，再决定是否查看原始记录。",
      "没有数据时不补零、不插值，也不生成仅用于占位的图形。",
    ),
    rationale,
    unit: "",
    sourcePaths: [],
    derivation: "identity",
    columns: ["值"],
    series: [],
    rows: [],
    emptyReason,
  };
}

function matrix(id: string, title: string, description: string, rows: VisualizationRow[]): LayerVisualization {
  return {
    id,
    kind: "matrix",
    title,
    description,
    ...reading(
      "这些分类声明和状态字段分别是什么？",
      "先看报告值，再沿字段来源核对 provenance、fidelity 或实现状态。",
      "分类状态没有连续数值含义，不能据此计算距离、趋势或等级分数。",
    ),
    rationale: "这些字段是分类、声明或状态，不存在可比较的连续数量关系，因此使用字段矩阵。",
    unit: "",
    sourcePaths: [...new Set(rows.map((row) => row.sourcePath).filter((path): path is string => Boolean(path)))],
    derivation: "identity",
    columns: ["报告值"],
    series: [],
    rows,
  };
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function contributionRows<T extends { runtime_us?: number; queue_delay_us?: number; congestion_delay_us?: number }>(
  entries: ReadonlyArray<readonly [string, T]>,
  sourcePath: (index: number) => string | null,
): VisualizationRow[] {
  return entries
    .filter(([, row]) => finite(row.runtime_us) || finite(row.queue_delay_us) || finite(row.congestion_delay_us))
    .map(([label, row], index) => ({
      label,
      values: [row.runtime_us ?? null, row.queue_delay_us ?? null, row.congestion_delay_us ?? null],
      sourcePath: sourcePath(index),
    }));
}

function sumContribution(rows: PhaseFabricContribution[]) {
  const sum = (key: "runtime_us" | "queue_delay_us" | "congestion_delay_us") => {
    const values = rows.map((row) => row[key]).filter(finite);
    return values.length ? values.reduce((total, value) => total + value, 0) : undefined;
  };
  return {
    runtime_us: sum("runtime_us"),
    queue_delay_us: sum("queue_delay_us"),
    congestion_delay_us: sum("congestion_delay_us"),
  };
}

export function buildLayerVisualizations(id: LayerId, bundle: ReportBundle, inputs: RunInputs): LayerVisualization[] {
  const metrics = bundle.metrics;
  const system = metrics?.system_summary;
  const phases = system?.phase_fabric_contributions || [];

  if (id === "S0") {
    const provenance = bundle.validation?.trace_provenance || metrics?.trace_provenance;
    const provenanceBase = bundle.validation?.trace_provenance
      ? "validation:/trace_provenance"
      : "metrics:/trace_provenance";
    return [
      matrix("s0-provenance", "Trace 来源与声明边界", "直接呈现 provenance；不把来源模式或校准级别量化。", [
        {
          label: "source_mode",
          values: [provenance?.source_mode ?? null],
          sourcePath: `${provenanceBase}/source_mode`,
        },
        {
          label: "calibration_level",
          values: [provenance?.calibration_level ?? null],
          sourcePath: `${provenanceBase}/calibration_level`,
        },
        {
          label: "allowed_claim_scope",
          values: [provenance?.allowed_claim_scope ?? null],
          sourcePath: `${provenanceBase}/allowed_claim_scope`,
        },
        {
          label: "trace_kind",
          values: [provenance?.trace_kind ?? null],
          sourcePath: `${provenanceBase}/trace_kind`,
        },
      ]),
    ];
  }

  if (id === "S1") {
    const requests = inputs.runtime_trace?.requests || [];
    const rows = requests.map((request) => ({
      label: request.request_id,
      values: [request.prompt_tokens ?? null, request.decode_tokens ?? null, request.kv_tokens ?? null],
      sourcePath: runtimeRequestSource(requests, request.request_id),
    }));
    if (!rows.length)
      return [
        none(
          "s1-request-tokens",
          "请求 Token 构成",
          "请求间的离散数量适合分组水平条形图。",
          "没有 runtime trace 请求明细。",
        ),
      ];
    return [
      {
        id: "s1-request-tokens",
        kind: "bar",
        title: "请求 Token 构成",
        description: "逐请求比较 prompt、decode 与 KV token；横向条形图适合长请求 ID 和离散比较。",
        ...reading(
          "不同请求带来了多少 prompt、decode 与 KV token？",
          "先找总量较大的请求，再回到完整字段表核对三类 token。",
          "这里只比较后端输入数量，不推断调度、延迟或因果关系。",
        ),
        rationale: "请求是离散类别，不使用暗示连续趋势的折线图。",
        unit: "tokens",
        sourcePaths: ["input-runtime-trace:/requests/*/{prompt_tokens,decode_tokens,kv_tokens}"],
        derivation: "identity",
        columns: ["Prompt", "Decode", "KV"],
        series: [{ name: "Prompt" }, { name: "Decode" }, { name: "KV" }],
        rows,
      },
    ];
  }

  if (id === "S2") {
    const resolutionEntries = bundle.validation?.resolution_entries || metrics?.resolution_entries || [];
    const resolution = resolutionEntries.find((item) => item.subsystem === "S2");
    const resolutionArtifact = bundle.validation?.resolution_entries ? "validation" : "metrics";
    const implementationEntries = bundle.run?.multi_granularity_profile?.entries || [];
    const implementation = implementationEntries.find((item) => item.subsystem === "S2");
    return [
      matrix(
        "s2-fidelity",
        "Fidelity 解析矩阵",
        "并列展示 requested、resolved 与实现状态，避免把 Fidelity 当成连续等级分数。",
        [
          {
            label: "requested_fidelity",
            values: [resolution?.requested_fidelity ?? null],
            sourcePath: fidelityResolutionSource(resolutionEntries, "S2", resolutionArtifact, "requested_fidelity"),
          },
          {
            label: "actual_fidelity",
            values: [resolution?.actual_fidelity ?? null],
            sourcePath: fidelityResolutionSource(resolutionEntries, "S2", resolutionArtifact, "actual_fidelity"),
          },
          {
            label: "resolution",
            values: [resolution?.resolution ?? null],
            sourcePath: fidelityResolutionSource(resolutionEntries, "S2", resolutionArtifact, "resolution"),
          },
          {
            label: "effective_tier",
            values: [implementation?.effective_tier ?? null],
            sourcePath: implementationEntrySource(implementationEntries, "S2", "effective_tier"),
          },
          {
            label: "des_status",
            values: [implementation?.des_status ?? null],
            sourcePath: implementationEntrySource(implementationEntries, "S2", "des_status"),
          },
          {
            label: "cycle_status",
            values: [implementation?.cycle_status ?? null],
            sourcePath: implementationEntrySource(implementationEntries, "S2", "cycle_status"),
          },
        ],
      ),
    ];
  }

  if (id === "S3") {
    const unique = uniqueBy(phases, (row) => row.memory_event_id);
    const rows = unique
      .filter((row) => finite(row.memory_latency_us))
      .map((row, index) => ({
        label: row.memory_event_id || `memory-${index + 1}`,
        values: [row.memory_latency_us ?? null],
        sourcePath: phaseRecordSource(phases, row, "memory_event_id", "memory_latency_us"),
      }));
    if (!rows.length)
      return [
        none("s3-memory-latency", "Memory event 延迟", "事件延迟适合水平条形图。", "没有可用的 memory_latency_us。"),
      ];
    return [
      {
        id: "s3-memory-latency",
        kind: "bar",
        title: "Memory event 延迟",
        description: "按 memory_event_id 去重后比较估算延迟。",
        ...reading(
          "哪些 memory event 的报告延迟更高？",
          "先看最长条，再按 memory_event_id 回到完整记录。",
          "按稳定事件 ID 做展示级去重；不重算内存延迟，也不把 S3 与 S4/S5 串联。",
        ),
        rationale: "事件是离散类别，水平条形图能保留长 ID 并直接比较大小。",
        unit: "µs",
        sourcePaths: [
          "metrics:/system_summary/phase_fabric_contributions/*/{memory_event_id,memory_operation,memory_latency_us}",
        ],
        derivation: "display_group",
        columns: ["估算延迟"],
        series: [{ name: "估算延迟", color: colors.latency }],
        rows,
      },
    ];
  }

  if (id === "S4") {
    const unique = uniqueBy(phases, (row) => row.device_task_id);
    const complete = unique.filter((row) => finite(row.device_latency_us) && finite(row.device_occupancy_ratio));
    if (complete.length >= 3) {
      return [
        {
          id: "s4-latency-occupancy",
          kind: "scatter",
          title: "设备延迟与 Occupancy",
          description: "每个点代表一个 device_task_id；观察两个定量变量的分布关系，不推断因果。",
          ...reading(
            "设备任务的延迟与 occupancy 如何共同分布？",
            "先看远离主要点群的任务，再核对它的精确字段和证据。",
            "散点只显示报告变量的关系，不证明 occupancy 导致延迟。",
          ),
          rationale: "仅在至少 3 个完整样本时使用散点图；样本更少会退回延迟条形图。",
          unit: "µs / %",
          sourcePaths: [
            "metrics:/system_summary/phase_fabric_contributions/*/{device_task_id,device_latency_us,device_occupancy_ratio}",
          ],
          derivation: "display_group",
          columns: ["设备延迟 (µs)", "Occupancy"],
          series: [{ name: "Device task", color: colors.occupancy }],
          rows: complete.map((row) => ({
            label: row.device_task_id || "unknown-device-task",
            values: [row.device_latency_us ?? null, row.device_occupancy_ratio ?? null],
            sourcePath: phaseRecordSource(phases, row, "device_task_id"),
          })),
        },
      ];
    }
    const rows = unique
      .filter((row) => finite(row.device_latency_us))
      .map((row) => ({
        label: row.device_task_id || "unknown-device-task",
        values: [row.device_latency_us ?? null],
        sourcePath: phaseRecordSource(phases, row, "device_task_id", "device_latency_us"),
      }));
    if (!rows.length)
      return [
        none(
          "s4-device-latency",
          "Device task 延迟",
          "完整样本不足时使用延迟条形图。",
          "没有可用的 device_latency_us。",
        ),
      ];
    return [
      {
        id: "s4-device-latency",
        kind: "bar",
        title: "Device task 延迟",
        description: "完整 latency–occupancy 样本少于 3 个，自动降级为延迟比较。",
        ...reading(
          "现有设备任务中哪些报告延迟更高？",
          "先看最长条，再核对字段表中的完整任务记录。",
          "完整双变量样本少于 3 个，因此不展示也不推断 latency–occupancy 分布。",
        ),
        rationale: "少量样本不适合散点分布分析，水平条形图更诚实。",
        unit: "µs",
        sourcePaths: ["metrics:/system_summary/phase_fabric_contributions/*/{device_task_id,device_latency_us}"],
        derivation: "display_group",
        columns: ["设备延迟"],
        series: [{ name: "设备延迟", color: colors.latency }],
        rows,
      },
    ];
  }

  if (id === "S5") {
    const grouped = [...groupBy(phases, (row) => row.collective_id)].map(
      ([collectiveId, rows]) => [collectiveId, sumContribution(rows)] as const,
    );
    const rows = contributionRows(grouped, (index) =>
      phaseContributionSource(phases, { field: "collective_id", id: grouped[index][0] }),
    );
    if (!rows.length)
      return [
        none(
          "s5-collective-contribution",
          "Collective 时间构成",
          "同单位贡献字段适合堆叠水平条形图。",
          "没有 collective runtime/queue/congestion 明细。",
        ),
      ];
    return [
      {
        id: "s5-collective-contribution",
        kind: "stacked-bar",
        title: "Collective 时间构成",
        description: "按 collective 汇总 phase 的 runtime、queue 与 congestion 字段。",
        ...reading(
          "每个 collective 的 runtime、queue 与 congestion 报告构成是什么？",
          "先看 queue 和 congestion 占比较显眼的条目，再核对完整 phase 记录。",
          "只对同一 collective、同单位后端字段做显示级合计；不生成新的模拟指标。",
        ),
        rationale: "字段同为 µs 且按 collective 聚合；堆叠用于观察相对构成，不代表新的模拟指标。",
        unit: "µs",
        sourcePaths: [
          "metrics:/system_summary/phase_fabric_contributions/*/{collective_id,runtime_us,queue_delay_us,congestion_delay_us}",
        ],
        derivation: "display_sum",
        columns: ["Runtime", "Queue", "Congestion"],
        series: [
          { name: "Runtime", color: colors.runtime },
          { name: "Queue", color: colors.queue },
          { name: "Congestion", color: colors.congestion },
        ],
        rows,
      },
    ];
  }

  const visualizations: LayerVisualization[] = [];
  const requests = system?.request_fabric_contributions || [];
  const requestRows = contributionRows(
    requests.map((row, index) => [row.request_id || `request-${index + 1}`, row]),
    (index) => requestFabricContributionSource(requests, requests[index].request_id),
  );
  if (requestRows.length)
    visualizations.push({
      id: "s6-request-contribution",
      kind: "stacked-bar",
      title: "请求级 Fabric 时间构成",
      description: "逐请求对比 runtime、queue 和 congestion 字段。",
      ...reading(
        "每个请求的 Fabric runtime、queue 与 congestion 报告构成是什么？",
        "先看 queue 或 congestion 较高的请求，再进入它的正式 evidence pointer。",
        "三项均直接来自请求记录；前端不补造未报告贡献，也不推断主导原因。",
      ),
      rationale: "三个字段同为 µs；堆叠用于组成比较，原始值仍在下方表格中。",
      unit: "µs",
      sourcePaths: [
        "metrics:/system_summary/request_fabric_contributions/*/{request_id,runtime_us,queue_delay_us,congestion_delay_us}",
      ],
      derivation: "identity",
      columns: ["Runtime", "Queue", "Congestion"],
      series: [
        { name: "Runtime", color: colors.runtime },
        { name: "Queue", color: colors.queue },
        { name: "Congestion", color: colors.congestion },
      ],
      rows: requestRows,
    });
  const domains = system?.fabric_domain_utilization || [];
  const domainRows = domains
    .filter((row) => finite(row.utilization_ratio))
    .map((row, index) => ({
      label: row.domain_id || `domain-${index + 1}`,
      values: [row.utilization_ratio ?? null],
      sourcePath: fabricDomainSource(domains, row.domain_id, "utilization_ratio"),
    }));
  if (domainRows.length)
    visualizations.push({
      id: "s6-domain-utilization",
      kind: "bar",
      title: "Fabric 域利用率",
      description: "比较各 fabric domain 的报告利用率。",
      ...reading(
        "哪些 Fabric domain 的报告利用率更高？",
        "先看利用率较高的域，再与 queue/congestion 字段和 topology 证据一起判断。",
        "利用率是模拟报告值，不等同于真实集群链路计数器，也不单独证明拥塞。",
      ),
      rationale: "域是离散类别，水平条形图比饼图更容易比较相近比例。",
      unit: "%",
      sourcePaths: ["metrics:/system_summary/fabric_domain_utilization/*/{domain_id,utilization_ratio}"],
      derivation: "identity",
      columns: ["利用率"],
      series: [{ name: "利用率", color: colors.occupancy }],
      rows: domainRows,
    });
  return visualizations.length
    ? visualizations
    : [
        none(
          "s6-fabric",
          "Fabric 细分",
          "请求贡献和域利用率适合条形图。",
          "没有 request_fabric_contributions 或 fabric_domain_utilization。",
        ),
      ];
}

function scaledPs(delta: bigint): number | null {
  const integer = delta / 1_000n;
  const remainder = delta % 1_000n;
  if (integer > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(integer) + Number(remainder) / 1_000;
}

export function buildStageTimeline(stages: ExecutionStage[]): LayerVisualization {
  const valid = stages.flatMap((stage) => {
    if (!isLosslessInteger(stage.start_time_ps) || !isLosslessInteger(stage.end_time_ps)) return [];
    const start = losslessIntegerToBigInt(stage.start_time_ps);
    const end = losslessIntegerToBigInt(stage.end_time_ps);
    if (end < start) return [];
    return [{ stage, start, end }];
  });
  if (!valid.length)
    return none(
      "s7-stage-timeline",
      "S7 统一时间轴",
      "真实 start/end 区间适合 range bar。",
      "没有合法的 start_time_ps/end_time_ps 区间；负时长记录会失败关闭。",
    ) as LayerVisualization;
  const origin = valid.reduce((minimum, item) => (item.start < minimum ? item.start : minimum), valid[0].start);
  const rows = valid.flatMap(({ stage, start, end }) => {
    const offset = scaledPs(start - origin);
    const duration = scaledPs(end - start);
    if (offset === null || duration === null) return [];
    return [
      {
        label: `${stage.subsystem || "unknown"} · ${stage.stage_id}`,
        values: [offset, duration],
        rawValues: [String(stage.start_time_ps), String(stage.end_time_ps)],
        sourcePath: executionStageSource(stages, stage.stage_id),
      },
    ];
  });
  if (!rows.length)
    return none(
      "s7-stage-timeline",
      "S7 统一时间轴",
      "真实 start/end 区间适合 range bar。",
      "时间跨度超出可安全显示的数值范围，原始 ps 仍可在 JSON 中查看。",
    ) as LayerVisualization;
  return {
    id: "s7-stage-timeline",
    kind: "timeline",
    title: "S7 统一时间轴",
    description: "以最早阶段为零点展示相对开始位置和持续时间；表格保留原始 ps。",
    ...reading(
      "S0–S6 的已报告阶段如何落在 S7 的同一全局时间轴上？",
      "先看阶段顺序、重叠和持续时间，再查看精确 start/end ps。",
      "S7 是统一执行宿主，不是 latency causal ranking；非法或超安全范围的区间失败关闭。",
    ),
    rationale: "start/end 是真实时间区间，range bar 能同时显示顺序、重叠和持续时间。",
    unit: "ns",
    sourcePaths: ["execution-envelope:/stages/*/{start_time_ps,end_time_ps}"],
    derivation: "unit_conversion",
    columns: ["相对开始 (ns)", "持续时间 (ns)"],
    rawColumns: ["start_time_ps", "end_time_ps"],
    rawUnit: "ps",
    series: [{ name: "相对开始" }, { name: "持续时间", color: colors.runtime }],
    rows,
  };
}
