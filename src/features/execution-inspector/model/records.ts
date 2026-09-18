import type {
  MetricsReport,
  PhaseFabricContribution,
  RequestMetric,
  RuntimeTraceInput,
} from "../../../contracts/report-model";
import { fact, groupBy, list, sum, uniqueBy } from "./aggregations";
import { phaseRecordSource, requestFabricContributionSource, runtimeRequestSource } from "./evidence-pointers";
import type { ExecutionRecord } from "./types";

export function memoryRecords(rows: PhaseFabricContribution[]): ExecutionRecord[] {
  return uniqueBy(rows, (row) => row.memory_event_id).map((row) => ({
    id: row.memory_event_id || "unknown-memory-event",
    title: row.memory_operation || "memory event",
    subtitle: row.request_id,
    status: row.memory_match_status || "unknown",
    sourcePath: phaseRecordSource(rows, row, "memory_event_id") || undefined,
    facts: [
      fact("估算延迟", row.memory_latency_us, "µs"),
      fact("关联请求", row.request_id),
      fact("关联 collective", row.collective_id),
      fact("Fabric phase", row.phase_id),
    ],
  }));
}

export function deviceRecords(rows: PhaseFabricContribution[]): ExecutionRecord[] {
  return uniqueBy(rows, (row) => row.device_task_id).map((row) => ({
    id: row.device_task_id || "unknown-device-task",
    title: row.device_profile || "device task",
    subtitle: row.device_stream_id || row.request_id,
    status: row.device_match_status || "unknown",
    sourcePath: phaseRecordSource(rows, row, "device_task_id") || undefined,
    facts: [
      fact("设备延迟", row.device_latency_us, "µs"),
      fact("Stream occupancy", row.device_occupancy_ratio, "%ratio"),
      fact("竞争延迟", row.device_contention_delay_us, "µs"),
      fact("关联请求", row.request_id),
      fact("Fabric phase", row.phase_id),
    ],
  }));
}

export function collectiveRecords(rows: PhaseFabricContribution[]): ExecutionRecord[] {
  return [...groupBy(rows, (row) => row.collective_id)].map(([id, grouped]) => ({
    id,
    title: grouped[0].transfer_kind || "collective",
    subtitle: grouped[0].request_id,
    status: grouped.every((row) => row.resource_convergence_status === "complete") ? "complete" : "partial",
    sourcePath: phaseRecordSource(rows, grouped[0], "collective_id") || undefined,
    facts: [
      fact("Fabric phase 记录", grouped.length),
      fact("涉及域", list(grouped, "domain_id")),
      fact("总运行时间", sum(grouped, "runtime_us"), "µs"),
      fact("总排队延迟", sum(grouped, "queue_delay_us"), "µs"),
      fact("总拥塞延迟", sum(grouped, "congestion_delay_us"), "µs"),
      fact("Memory events", new Set(grouped.map((row) => row.memory_event_id).filter(Boolean)).size),
      fact("Device tasks", new Set(grouped.map((row) => row.device_task_id).filter(Boolean)).size),
    ],
  }));
}

export function runtimeRecords(
  input: RuntimeTraceInput | null,
  requestMetrics: RequestMetric[] | undefined,
): ExecutionRecord[] {
  const metrics = new Map((requestMetrics || []).map((request) => [request.request_id, request]));
  const inputRequests = input?.requests || [];
  return inputRequests.map((request) => {
    const result = metrics.get(request.request_id);
    return {
      id: request.request_id,
      title: `${request.phase || "request"} · ${request.model_id || "model unknown"}`,
      subtitle: `${request.collective_type || "无 collective"} · TP ${request.tp_degree ?? "—"}`,
      status: result?.status || "input",
      sourcePath: runtimeRequestSource(inputRequests, request.request_id) || undefined,
      facts: [
        fact("Prompt tokens", request.prompt_tokens),
        fact("Decode tokens", request.decode_tokens),
        fact("KV tokens", request.kv_tokens),
        fact("优先级", request.priority_class),
        fact("消息大小", request.message_size_bytes, "bytes"),
        fact("TTFT", result?.ttft_ps, "ps"),
        fact("TPOT", result?.tpot_ps, "ps"),
        fact("端到端", result?.end_to_end_latency_ps, "ps"),
        fact("Batch issues", result?.batch_issue_count),
      ],
    };
  });
}

export function fabricRecords(systemSummary: MetricsReport["system_summary"]): ExecutionRecord[] {
  const requests = systemSummary?.request_fabric_contributions || [];
  return requests.map((row) => ({
    id: row.request_id || "unknown-request",
    title: `主导域 ${row.dominant_domain_id || "unknown"}`,
    subtitle: row.dominant_delay_kind || "delay unknown",
    status: "reported",
    sourcePath: requestFabricContributionSource(requests, row.request_id) || undefined,
    facts: [
      fact("Fabric 记录", row.record_count),
      fact("运行时间", row.runtime_us, "µs"),
      fact("排队延迟", row.queue_delay_us, "µs"),
      fact("拥塞延迟", row.congestion_delay_us, "µs"),
      fact("排队占比", row.queue_delay_ratio, "%ratio"),
      fact("拥塞占比", row.congestion_delay_ratio, "%ratio"),
      fact("主导 collective", row.dominant_collective_id),
      fact("主导 phase", row.dominant_phase_id),
    ],
  }));
}
