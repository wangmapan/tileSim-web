/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import MetricsView from "../../src/views/MetricsView.vue";
import { useDashboard } from "../../src/store/dashboard";

const { applyBundle } = useDashboard();

beforeEach(() => localStorage.clear());

describe("request metric sample validity", () => {
  it("uses backend sample flags and keeps a reported zero distinct from unsampled values", () => {
    applyBundle({
      metrics: {
        report_id: "metrics-samples",
        summary: { request_count: 1, completed_request_count: 1, throughput_requests_per_second: 1 },
        tail_latency_summary: {
          ttft_ps: { sample_count: 1, p95_ps: 0, p99_ps: 0 },
          tpot_ps: { sample_count: 0, p95_ps: 0, p99_ps: 0 },
          end_to_end_latency_ps: { sample_count: 0, p95_ps: 0, p99_ps: 0 },
        },
        request_metrics: [
          {
            request_id: "r0",
            ttft_ps: 0,
            has_ttft_sample: true,
            tpot_ps: 0,
            has_tpot_sample: false,
            end_to_end_latency_ps: 0,
            has_end_to_end_latency_sample: false,
            kv_wait_ps: "9007199254740993",
            kv_remote_read_wait_ps: 4,
            kv_migration_wait_ps: 5,
            kv_pd_handoff_wait_ps: 6,
            kv_eviction_bytes: 7,
          },
          {
            request_id: "r-unavailable",
            ttft_ps: 1,
            has_ttft_sample: true,
            tpot_ps: 2,
            has_tpot_sample: true,
            has_end_to_end_latency_sample: true,
          },
        ],
      },
    });
    const wrapper = mount(MetricsView, {
      global: {
        stubs: {
          RequestEvidenceAction: true,
          RouterLink: { template: "<a><slot /></a>" },
          ArtifactEvidenceLink: true,
        },
      },
    });
    expect(wrapper.text()).toContain("0 ps");
    expect(wrapper.text()).toContain("有效样本");
    expect(wrapper.text()).toContain("未采样");
    expect(wrapper.text()).toContain("不可用");
    expect(wrapper.text()).toContain("9,007.2 s");
    expect(wrapper.text()).toContain("remote 4 ps");
    expect(wrapper.text()).toContain("evicted 7 bytes");
    expect(wrapper.text()).not.toContain("NaN");
  });

  it("labels inferred, fallback, synthetic, and uncalibrated values instead of presenting them as plain observations", () => {
    applyBundle({
      metrics: {
        report_id: "metrics-provenance",
        summary: { request_count: 1, completed_request_count: 1, throughput_requests_per_second: 1 },
        trace_provenance: { source_mode: "synthetic_trace", calibration_level: "uncalibrated" },
        request_metrics: [
          {
            request_id: "r-provenance",
            ttft_ps: 1,
            has_ttft_sample: true,
            ttft_ps_source: "inferred",
            tpot_ps: 2,
            has_tpot_sample: true,
            tpot_ps_source: "fallback",
            end_to_end_latency_ps: 3,
            has_end_to_end_latency_sample: true,
            device_profile_selection: "portable_fallback",
          },
        ],
      },
    });
    const wrapper = mount(MetricsView, {
      global: {
        stubs: {
          RequestEvidenceAction: true,
          RouterLink: { template: "<a><slot /></a>" },
          ArtifactEvidenceLink: true,
          ExecutionVisualizationPanel: true,
          ReportCoveragePanel: true,
        },
      },
    });
    expect(wrapper.text()).toContain("推断值 · 合成有效样本 · 未校准");
    expect(wrapper.text()).toContain("fallback 结果 · 合成有效样本 · 未校准");
    expect(wrapper.text()).toContain("可移植回退");
    expect(wrapper.text()).toContain("指标来源与声明范围");
  });

  it("labels a backend observed sample explicitly", () => {
    applyBundle({
      metrics: {
        report_id: "metrics-observed",
        summary: { request_count: 1, completed_request_count: 1, throughput_requests_per_second: 1 },
        request_metrics: [
          {
            request_id: "r-observed",
            ttft_ps: 4,
            has_ttft_sample: true,
            ttft_ps_source: "observed",
          },
        ],
      },
    });
    const wrapper = mount(MetricsView, {
      global: {
        stubs: {
          RequestEvidenceAction: true,
          RouterLink: { template: "<a><slot /></a>" },
          ArtifactEvidenceLink: true,
          ExecutionVisualizationPanel: true,
          ReportCoveragePanel: true,
        },
      },
    });
    expect(wrapper.text()).toContain("观测值");
  });

  it("keeps metrics provenance when validation exposes an empty provenance object", () => {
    applyBundle({
      metrics: {
        report_id: "metrics-provenance-fallback",
        summary: { request_count: 1, completed_request_count: 1, throughput_requests_per_second: 1 },
        trace_provenance: { source_mode: "synthetic_trace", calibration_level: "uncalibrated" },
        request_metrics: [{ request_id: "r-provenance-fallback", ttft_ps: 1, has_ttft_sample: true }],
      },
      validation: { report_id: "validation-empty", trace_provenance: {} },
    });
    const wrapper = mount(MetricsView, {
      global: {
        stubs: {
          RequestEvidenceAction: true,
          RouterLink: { template: "<a><slot /></a>" },
          ArtifactEvidenceLink: true,
          ExecutionVisualizationPanel: true,
          ReportCoveragePanel: true,
        },
      },
    });
    expect(wrapper.text()).toContain("合成有效样本");
    expect(wrapper.text()).toContain("未校准");
  });

  it("distinguishes device observations from modelled and inferred evidence", () => {
    applyBundle({
      metrics: {
        report_id: "metrics-device-provenance",
        summary: { request_count: 1, completed_request_count: 1, throughput_requests_per_second: 1 },
        request_metrics: [],
        system_summary: {
          device_metrics: [
            { device_id: "gpu-0", evidence_state: "observed", hardware_counter_state: "modelled" },
            { device_id: "gpu-1", evidence_state: "inferred", hardware_counter_state: "fallback" },
          ],
        },
      },
    });
    const wrapper = mount(MetricsView, {
      global: {
        stubs: {
          RequestEvidenceAction: true,
          RouterLink: { template: "<a><slot /></a>" },
          ArtifactEvidenceLink: true,
          ExecutionVisualizationPanel: true,
          ReportCoveragePanel: true,
        },
      },
    });
    expect(wrapper.text()).toContain("模型估算");
    expect(wrapper.text()).toContain("推断值");
    expect(wrapper.text()).toContain("fallback 结果");
  });

  it("shows modelled device activity, virtual fabric usage, and unmapped-task diagnostics", () => {
    applyBundle({
      metrics: {
        report_id: "metrics-gpu-free",
        summary: { request_count: 1, completed_request_count: 1, throughput_requests_per_second: 1 },
        request_metrics: [],
        resource_convergence: {
          has_evidence: true,
          summary: "device placement unresolved",
          missing_device_task_count: 4,
        },
        system_summary: {
          has_fabric_timeline: true,
          fabric_record_count: 2,
          active_fabric_domain_count: 1,
          fabric_utilization_ratio: 0,
          representative_device_task_count: 4,
          unmapped_device_task_count: 4,
          device_metrics: [
            {
              device_id: "gpu-0",
              evidence_state: "no_device_tasks",
              task_count: 0,
              modeled_memory_bytes: 0,
              service_time_ps: 0,
              active_time_ps: 0,
              observation_window_ps: 0,
              active_time_ratio: 0,
              hardware_counter_state: "not_collected",
            },
          ],
          fabric_domain_utilization: [
            {
              domain_id: "fabric-0",
              record_count: 2,
              busy_time_ps: 0,
              observation_window_ps: 10,
              utilization_ratio: 0,
              queue_delay_us: 0,
              congestion_delay_us: 0,
            },
          ],
        },
      },
    });
    const wrapper = mount(MetricsView, {
      global: {
        stubs: {
          RequestEvidenceAction: true,
          RouterLink: { template: "<a><slot /></a>" },
          ArtifactEvidenceLink: true,
          ExecutionVisualizationPanel: true,
          ReportCoveragePanel: true,
        },
      },
    });
    expect(wrapper.text()).toContain("仿真设备参与与拓扑通信");
    expect(wrapper.text()).toContain("代表性设备任务");
    expect(wrapper.text()).toContain("未映射设备任务");
    expect(wrapper.text()).toContain("设备归属需要后端修复");
    expect(wrapper.text()).toContain("当前每张卡的 0 不能解释为设备未参与");
    expect(wrapper.text()).toContain("模型显存");
    expect(wrapper.text()).toContain("虚拟 Fabric 域");
    expect(wrapper.text()).toContain("Fabric 利用率");
    expect(wrapper.text()).toContain("0 bytes");
    expect(wrapper.text()).toContain("0 ps");
    expect(wrapper.text()).toContain("未采集");
  });

  it("explains that no device-task rows are not the same as GPU participation being zero", () => {
    applyBundle({
      metrics: {
        report_id: "metrics-device-no-tasks",
        summary: { request_count: 1, completed_request_count: 1, throughput_requests_per_second: 1 },
        request_metrics: [],
        system_summary: {
          device_metrics: [
            { device_id: "gpu-0", evidence_state: "no_device_tasks", task_count: 0 },
            { device_id: "gpu-1", evidence_state: "no_device_tasks", task_count: 0 },
          ],
        },
      },
    });
    const wrapper = mount(MetricsView, {
      global: {
        stubs: {
          RequestEvidenceAction: true,
          RouterLink: { template: "<a><slot /></a>" },
          ArtifactEvidenceLink: true,
          ExecutionVisualizationPanel: true,
          ReportCoveragePanel: true,
        },
      },
    });
    expect(wrapper.text()).toContain("本次没有设备任务记录");
    expect(wrapper.text()).toContain("这里的 0 表示没有可归属的设备任务");
    expect(wrapper.find(".metrics-detail-disclosure").exists()).toBe(true);
    expect(wrapper.find(".metrics-detail-disclosure").attributes("open")).toBeUndefined();
  });
});
