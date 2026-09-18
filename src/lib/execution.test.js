import { describe, expect, it } from "vitest";
import { buildExecutionResult } from "../features/execution-inspector";

describe("execution result adapter", () => {
  const inputs = {
    runtime_trace: {
      policy: { batch_scheduler: "decode_priority", max_batch_size: 2, kv_capacity_tokens: 4096 },
      requests: [
        {
          request_id: "req-1",
          model_id: "llama3-8b",
          phase: "decode",
          prompt_tokens: 32,
          decode_tokens: 4,
          kv_tokens: 16,
          collective_type: "AllReduce",
          tp_degree: 4,
        },
      ],
    },
  };
  const bundle = {
    run: {
      summary: { runtime_event_count: 12, fabric_record_count: 2 },
      multi_granularity_profile: {
        entries: [
          { subsystem: "S2", effective_tier: "analytical", evidence: "Lowering evidence", gap: "No DES tier" },
          { subsystem: "S4", effective_tier: "des", evidence: "Task ordering", gap: "Cycle planned" },
        ],
      },
    },
    validation: {
      resolution_entries: [
        { subsystem: "S0", resolution: "expected_absence", expected_absence: true },
        { subsystem: "S2", actual_fidelity: "analytical", resolution: "covered" },
        { subsystem: "S3", actual_fidelity: "analytical", resolution: "covered" },
      ],
      checks: [{ check_id: "memory_order", subsystem: "S3", status: "pass", detail: "ordered" }],
    },
    execution_envelope: { stages: [{ subsystem: "S1", detail: "Observed 12 runtime events." }] },
    tail: { attribution_ranking: [{ rank: 1, subsystem: "S4", component_code: "device", share: 0.4 }] },
    metrics: {
      summary: { request_count: 1, completed_request_count: 1 },
      request_metrics: [{ request_id: "req-1", status: "completed", ttft_ps: 100, batch_issue_count: 4 }],
      resource_convergence: {
        has_evidence: true,
        collective_phase_count: 2,
        converged_request_count: 1,
        missing_memory_event_count: 0,
        missing_device_task_count: 0,
      },
      system_summary: {
        fabric_record_count: 2,
        request_fabric_contributions: [
          { request_id: "req-1", record_count: 2, runtime_us: 12, dominant_domain_id: "so0" },
        ],
        phase_fabric_contributions: [
          {
            request_id: "req-1",
            phase_id: "phase-1",
            collective_id: "collective-1",
            memory_event_id: "memory-1",
            memory_operation: "kv_growth",
            memory_match_status: "matched",
            memory_latency_us: 1.5,
            device_task_id: "device-1",
            device_profile: "analytical_default",
            device_match_status: "matched",
            device_latency_us: 3.5,
            device_occupancy_ratio: 0.25,
            domain_id: "so0",
            runtime_us: 8,
            queue_delay_us: 2,
            congestion_delay_us: 1,
            resource_convergence_status: "complete",
          },
          {
            request_id: "req-1",
            phase_id: "phase-2",
            collective_id: "collective-1",
            memory_event_id: "memory-1",
            memory_latency_us: 1.5,
            device_task_id: "device-1",
            device_latency_us: 3.5,
            domain_id: "su0",
            runtime_us: 4,
            queue_delay_us: 1,
            congestion_delay_us: 0.5,
            resource_convergence_status: "complete",
          },
        ],
      },
    },
  };

  it("deduplicates S3/S4 evidence, groups S5, and keeps request-level S6 contributions", () => {
    const result = buildExecutionResult(bundle, inputs);
    expect(result.layers.find((layer) => layer.id === "S3").records).toHaveLength(1);
    expect(result.layers.find((layer) => layer.id === "S4").records).toHaveLength(1);
    expect(result.layers.find((layer) => layer.id === "S5").records).toHaveLength(1);
    expect(result.layers.find((layer) => layer.id === "S5").records[0].facts[0].value).toBe(2);
    expect(result.layers.find((layer) => layer.id === "S6").records).toHaveLength(1);
  });

  it("merges S1 request input with its output metrics", () => {
    const layer = buildExecutionResult(bundle, inputs).layers.find((item) => item.id === "S1");
    expect(layer.records[0]).toMatchObject({ id: "req-1", status: "completed" });
    expect(layer.records[0].facts.find((fact) => fact.label === "TTFT").value).toBe(100);
    expect(layer.stats.find((metric) => metric.label === "调度器").value).toBe("decode_priority");
  });

  it("calculates readable S3 and S4 summaries from unique records", () => {
    const result = buildExecutionResult(bundle, inputs);
    const s3 = result.layers.find((layer) => layer.id === "S3");
    const s4 = result.layers.find((layer) => layer.id === "S4");
    expect(s3.stats.find((metric) => metric.label === "总内存延迟").value).toBe(1.5);
    expect(s3.stats.find((metric) => metric.label === "最大内存延迟").value).toBe(1.5);
    expect(s4.stats.find((metric) => metric.label === "总设备延迟").value).toBe(3.5);
    expect(s4.stats.find((metric) => metric.label === "最大 occupancy").value).toBe(0.25);
    expect(s4.implementation.evidence).toBe("Task ordering");
  });

  it("keeps expected absence and declaration-only evidence distinct", () => {
    const result = buildExecutionResult(bundle, inputs);
    expect(result.layers.find((layer) => layer.id === "S0").evidenceState).toBe("expected_absence");
    expect(result.layers.find((layer) => layer.id === "S2").evidenceState).toBe("declaration_only");
    expect(result.layers.find((layer) => layer.id === "S3").evidenceState).toBe("reported");
  });

  it("attaches validation and attribution to their owning subsystem", () => {
    const result = buildExecutionResult(bundle, inputs);
    expect(result.layers.find((layer) => layer.id === "S3").checks[0].check_id).toBe("memory_order");
    expect(result.layers.find((layer) => layer.id === "S4").attribution[0].component_code).toBe("device");
  });

  it("degrades safely when optional inputs are absent", () => {
    const s1 = buildExecutionResult(bundle).layers.find((layer) => layer.id === "S1");
    expect(s1.records).toEqual([]);
    expect(s1.stats.find((metric) => metric.label === "调度器").value).toBe("—");
  });
});
