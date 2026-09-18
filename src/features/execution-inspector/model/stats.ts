import type {
  FidelityResolution,
  ImplementationEntry,
  PhaseFabricContribution,
  ReportBundle,
  RunInputs,
} from "../../../contracts/report-model";
import { list, max, stat, sum, uniqueBy } from "./aggregations";
import type { ExecutionRecord, ExecutionStat, LayerId } from "./types";

interface StatsContext {
  bundle: ReportBundle;
  inputs: RunInputs;
  rows: PhaseFabricContribution[];
  records: ExecutionRecord[];
  resolution: FidelityResolution | null;
  implementation: ImplementationEntry | null;
}

export function statsFor(id: LayerId, context: StatsContext): ExecutionStat[] {
  const { bundle, inputs, rows, records, resolution, implementation } = context;
  const run = bundle.run?.summary;
  const metrics = bundle.metrics;
  const summary = metrics?.summary;
  const system = metrics?.system_summary;
  const convergence = metrics?.resource_convergence;
  const provenance = bundle.validation?.trace_provenance || metrics?.trace_provenance;
  const policy = inputs.runtime_trace?.policy;

  if (id === "S0")
    return [
      stat("执行边界", run?.range_label || "—"),
      stat("来源模式", provenance?.source_mode || "unknown"),
      stat("校准级别", provenance?.calibration_level || "unknown"),
      stat("允许声明", provenance?.allowed_claim_scope || "unknown"),
      stat("Trace kind", provenance?.trace_kind || "unknown"),
      stat("S1 输入请求", inputs.runtime_trace?.requests?.length ?? "—"),
    ];
  if (id === "S1")
    return [
      stat("Runtime events", run?.runtime_event_count),
      stat("调度器", policy?.batch_scheduler || "—"),
      stat("最大 batch", policy?.max_batch_size),
      stat("最大活跃请求", policy?.max_active_requests),
      stat("KV 容量", policy?.kv_capacity_tokens, "tokens"),
      stat("完成请求", `${summary?.completed_request_count ?? "—"}/${summary?.request_count ?? "—"}`),
      stat("吞吐", summary?.throughput_requests_per_second, "req/s"),
      stat("Fabric 背压", policy?.fabric_backpressure_active === true ? "启用" : "已关闭"),
    ];
  if (id === "S2")
    return [
      stat("请求 fidelity", resolution?.requested_fidelity || "unknown"),
      stat("实际 fidelity", resolution?.actual_fidelity || "unknown"),
      stat("解析状态", resolution?.resolution || "unknown"),
      stat("有效层级", implementation?.effective_tier || "unknown"),
      stat("DES 状态", implementation?.des_status || "unknown"),
      stat("Cycle 状态", implementation?.cycle_status || "unknown"),
    ];
  if (id === "S3") {
    const latencyValues = records.map((record) => ({ value: record.facts[0].value }));
    return [
      stat("Memory events", records.length),
      stat("操作类型", list(rows, "memory_operation")),
      stat("总内存延迟", sum(latencyValues, "value"), "µs"),
      stat("最大内存延迟", max(rows, "memory_latency_us"), "µs"),
      stat("缺失匹配", convergence?.missing_memory_event_count),
      stat("汇合状态", convergence?.has_evidence ? "有证据" : "无证据"),
    ];
  }
  if (id === "S4") {
    const uniqueRows = uniqueBy(rows, (row) => row.device_task_id);
    return [
      stat("Device tasks", records.length),
      stat("设备 profile", list(rows, "device_profile")),
      stat("总设备延迟", sum(uniqueRows, "device_latency_us"), "µs"),
      stat("最大设备延迟", max(rows, "device_latency_us"), "µs"),
      stat("最大 occupancy", max(rows, "device_occupancy_ratio"), "%ratio"),
      stat("竞争延迟", max(rows, "device_contention_delay_us"), "µs", "单任务最大值"),
    ];
  }
  if (id === "S5")
    return [
      stat("Collectives", records.length),
      stat("Collective phases", convergence?.collective_phase_count),
      stat("已汇合请求", convergence?.converged_request_count),
      stat("缺失内存事件", convergence?.missing_memory_event_count),
      stat("缺失设备任务", convergence?.missing_device_task_count),
      stat("汇合状态", convergence?.has_evidence ? "完整" : "无证据"),
    ];
  return [
    stat("Fabric records", system?.fabric_record_count ?? run?.fabric_record_count),
    stat("活跃域", system?.active_fabric_domain_count),
    stat("总体利用率", system?.fabric_utilization_ratio, "%ratio"),
    stat("最大背压", system?.max_fabric_backpressure_delay_us, "µs"),
    stat("主导域", system?.dominant_fabric_backpressure_domain_id || "—"),
    stat("主导延迟", system?.dominant_fabric_backpressure_kind || "—"),
    stat("背压事件", system?.fabric_backpressure_event_count),
    stat("观测窗口", system?.fabric_observation_window_ps, "ps"),
  ];
}
