/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import ExperimentCapabilityPanel from "../../src/features/run-experiment/ExperimentCapabilityPanel.vue";
import DesignSpaceInputPanel from "../../src/features/run-experiment/DesignSpaceInputPanel.vue";
import ExperimentInputPanel from "../../src/features/run-experiment/ExperimentInputPanel.vue";
import {
  buildExperimentSurface,
  createExperimentForm,
  experimentControlGroups,
} from "../../src/features/run-experiment";
import DesignSpaceView from "../../src/views/DesignSpaceView.vue";
import FabricView from "../../src/views/FabricView.vue";
import { useDashboard } from "../../src/store/dashboard";
import { fixtureCase } from "../helpers/fixtures";

const { applyBundle } = useDashboard();

function formalF7Ref(pointer: string, kind: string, id: string, artifactId = "design-space") {
  const identityKey = {
    candidate: "candidate_id",
    objective: "objective_id",
    executed_s6_knob: "knob_id",
    fabric_domain: "fabric_domain_id",
  }[kind];
  return {
    run_id: "run-f7-ui",
    artifact_id: artifactId,
    schema_identity:
      artifactId === "input-topology" ? "tilesim.s6_topology_input.v1" : "tilesim.design_space_report.v1",
    json_pointer: pointer,
    availability: "available",
    subject: { kind, id, ...(identityKey ? { [identityKey]: id } : {}) },
  };
}

function formalF7UiData() {
  const candidateRef = formalF7Ref("/candidates/0", "candidate", "candidate-a");
  const designSpace = {
    schema_version: "tilesim.design_space_report.v1",
    contract_version: "tilesim.design_space_report.v1",
    run_id: "run-f7-ui",
    report_id: "design-space-f7-ui",
    execution_scope: "S6_only",
    candidate_source_mode: "synthetic_trace",
    candidate_calibration_level: "uncalibrated",
    candidate_allowed_claim_scope: "exploratory_s6_only",
    provenance: {
      source_mode: "synthetic_trace",
      calibration_level: "uncalibrated",
      allowed_claim_scope: "exploratory_s6_only",
    },
    validation_lane: "synthetic_consistency",
    evidence_tier: "synthetic_consistency",
    claim_scope_summary: "Synthetic S6-only consistency; not held-out validation.",
    pareto_front_id: "pareto-f7-ui",
    objective_set_id: "objectives-f7-ui",
    candidate_count: 1n,
    candidates: [
      {
        candidate_id: "candidate-a",
        requested_fidelity: "analytical",
        resolved_fidelity: "des",
        subject_refs: [{ kind: "candidate", id: "candidate-a", candidate_id: "candidate-a" }],
        evidence_refs: [candidateRef],
        navigation: {
          navigation_scope: "artifact_record",
          bridge_run_id: null,
          backend_run_instance_id: "backend-candidate-a",
          parent_run_id: "run-f7-ui",
          candidate_id: "candidate-a",
          record_ref: candidateRef,
        },
        pareto_front_id: "pareto-f7-ui",
        objective_set_id: "objectives-f7-ui",
        pareto_member: true,
        dominated_by_candidate_ids: [],
        dominates_candidate_ids: [],
        dominance_status: "non_dominated",
        dominance_reason_code: "no_candidate_strictly_dominates",
        objectives: [
          {
            objective_id: "p99_latency",
            metric_kind: "p99_latency",
            direction: "minimize",
            value: 12.5,
            unit: "us",
            availability: "available",
            evidence_ref: formalF7Ref("/candidates/0/objectives/0", "objective", "candidate-a::p99_latency"),
          },
        ],
        executed_s6_knobs: [
          {
            knob_id: "release_interval",
            subsystem: "S6",
            value_type: "uint64",
            value: 9_007_199_254_740_993n,
            unit: "ps",
            availability: "available",
            requested_value: 9_007_199_254_740_993n,
            resolved_value: 9_007_199_254_740_993n,
            source_ref: formalF7Ref(
              "/candidates/0/executed_s6_knobs/0/requested_value",
              "executed_s6_knob",
              "candidate-a::release_interval",
            ),
            evidence_ref: formalF7Ref(
              "/candidates/0/executed_s6_knobs/0/resolved_value",
              "executed_s6_knob",
              "candidate-a::release_interval",
            ),
          },
        ],
      },
    ],
  };
  const topology = {
    schema_version: "tilesim.s6_topology_input.v1",
    run_id: "run-f7-ui",
    provenance: designSpace.provenance,
    topology: {
      topology_name: "f7-ui",
      devices: [{ device_id: "gpu-0" }],
      module_bindings: [{ module_id: "fabric-0" }],
      domains: [
        {
          domain_id: "scale-up",
          domain_type: "scale_up",
          domain_kind: "scale_up",
          subject: { kind: "fabric_domain", id: "scale-up", fabric_domain_id: "scale-up" },
          json_pointer: "/topology/domains/0",
          provenance: designSpace.provenance,
          member_devices: ["gpu-0"],
          module_binding: "fabric-0",
        },
      ],
    },
  };
  const manifest = {
    schema_version: "tilesim.bridge.artifact_manifest.v2",
    api_version: "tilesim.bridge.api.v1",
    schema_set_revision: `sha256:${"c".repeat(64)}`,
    run_id: "run-f7-ui",
    artifacts: [
      ["metrics", "metrics", "metrics.json", "tilesim.metrics_report.v1", "a"],
      ["design-space", "design_space", "design-space.json", "tilesim.design_space_report.v1", "b"],
      ["input-topology", null, "input-topology.json", "tilesim.s6_topology_input.v1", "c"],
    ].map(([artifact_id, report_kind, file_name, schema_identity, hash]) => ({
      artifact_id,
      report_kind,
      file_name,
      media_type: "application/json",
      bytes: 100,
      sha256: String(hash).repeat(64),
      schema_identity,
      contract_status: "supported",
    })),
    rejected_artifacts: [],
  };
  return { designSpace, topology, manifest };
}

beforeEach(() => localStorage.clear());

describe("Week 5 and Week 6 frontend integration", () => {
  it("shows the complete backend deployment identity and execution gate", () => {
    const wrapper = mount(ExperimentCapabilityPanel, {
      props: {
        surface: buildExperimentSurface(
          { scenarios: [{ scenario_id: "s1_des_example", label: "S1" }], fidelity_policies: ["des"] },
          { default_gpu_participation_mode: "gpu_free", cycle_scope: "S6", dependencies: {} },
        ),
        capabilities: {
          dependencies: {
            gpu_hardware: { available: false, reason: "no_gpu" },
            verilator_cycle: { available: true, version: "5.028" },
            astra_sim: { available: false, reason: "not_configured" },
          },
        },
        bridge: {
          identity: {
            execution_ready: true,
            versions_match: true,
            state_digests_match: true,
            deployment_mode: "local_worktree_snapshot",
            deployment_ref: "local:week6",
            backend_branch: "week6",
            source_revision: "1234567890abcdef",
            build_revision: "1234567890abcdef",
            source_state_digest: "a".repeat(64),
            build_state_digest: "a".repeat(64),
            deployed_at: "2026-08-25T23:00:00+08:00",
          },
        },
      },
    });
    expect(wrapper.text()).toContain("本地后端部署身份");
    expect(wrapper.text()).toContain("执行就绪");
    expect(wrapper.text()).toContain("local_worktree_snapshot");
    expect(wrapper.text()).toContain("week6");
    expect(wrapper.text()).toContain("1234567890ab");
    expect(wrapper.text()).toContain("实验编排契约");
    expect(wrapper.text()).toContain("experiment_descriptor_unavailable");
  });

  it("renders S0, S1, and S6 controls from one descriptor set with exact field Pointers", () => {
    const surface = buildExperimentSurface(
      {
        scenarios: [{ scenario_id: "s1_des_example", label: "S1" }],
        fidelity_policies: ["des"],
        input_modes: ["controls", "json"],
      },
      { default_gpu_participation_mode: "gpu_free", cycle_scope: "S6", dependencies: {} },
    );
    const wrapper = mount(ExperimentInputPanel, {
      props: {
        mode: "controls",
        runtimeJson: "",
        topologyJson: "",
        form: createExperimentForm(surface),
        surface,
        controlGroups: [...experimentControlGroups],
        fieldPath: "/overrides/fabric/scale_out_latency_us",
        "onUpdate:mode": () => undefined,
        "onUpdate:runtimeJson": () => undefined,
        "onUpdate:topologyJson": () => undefined,
      },
    });

    expect(wrapper.text()).toContain("S1 · 调度、批处理与 KV 准入");
    expect(wrapper.text()).toContain("S0 · 通信负载输入");
    expect(wrapper.text()).toContain("S6 · Scale-up 与 Scale-out");
    expect(wrapper.findAll("[data-field-path]")).toHaveLength(8);
    expect(
      wrapper.find('[data-field-path="/overrides/fabric/scale_out_latency_us"] input').attributes("aria-invalid"),
    ).toBe("true");
  });

  it("preflights custom manifest candidate and transfer budgets", () => {
    const manifest = {
      schema_version: "tilesim.design_space.s6_candidates.v1",
      candidates: [{ request_count: 8 }, { request_count: 8 }, { request_count: 8 }],
    };
    const wrapper = mount(DesignSpaceInputPanel, {
      props: { modelValue: JSON.stringify(manifest), "onUpdate:modelValue": () => undefined },
    });
    expect(wrapper.text()).toContain("自定义候选 manifest");
    expect(wrapper.text()).toContain("3 / 256 候选");
    expect(wrapper.text()).toContain("24 / 100,000 transfers");
  });

  it("renders candidate metrics, provenance, execution state, and attribution", () => {
    const fixture = fixtureCase("synthetic-s1-s6-complete");
    applyBundle(fixture.reports, { runName: fixture.id, inputs: fixture.inputs });
    const wrapper = mount(DesignSpaceView);
    expect(wrapper.text()).toContain("完整性能指标");
    expect(wrapper.text()).toContain("single_deterministic_run");
    expect(wrapper.text()).toContain("fixture-manifest#candidate-0");
    expect(wrapper.text()).toContain("tilesim.candidate.s6_common_state.v1");
    expect(wrapper.text()).toContain("unresolved_not_executed");
    expect(wrapper.text()).toContain("Only S6 Fabric parameters are executed.");
    expect(wrapper.text()).toContain("Fixture manifest passed strict S6 validation.");
    expect(wrapper.text()).toContain("Fabric 与设计空间契约状态");
    expect(wrapper.text()).toContain("Pareto membership");
    expect(wrapper.text()).toContain("contract gap");
    expect(wrapper.text()).toContain("不是可导航 EvidenceRef");
  });

  it("renders backend-reported Fabric hotspot and request contributions without a topology join", () => {
    const fixture = fixtureCase("synthetic-s1-s6-complete");
    applyBundle(fixture.reports, { runName: fixture.id, inputs: fixture.inputs });
    const wrapper = mount(FabricView);
    expect(wrapper.text()).toContain("Metrics-backed Fabric 证据");
    expect(wrapper.text()).toContain("后端报告的主导 Fabric 热点");
    expect(wrapper.text()).toContain("请求级 Fabric contribution");
    expect(wrapper.text()).toContain("req-0");
    expect(wrapper.text()).toContain("phase-0");
    expect(wrapper.text()).toContain("Topology → metrics domain：不可用");
    expect(wrapper.text()).toContain("artifact_identity_missing");
  });

  it("renders formal Pareto, artifact-record, uint64 knob, and topology evidence", () => {
    const fixture = fixtureCase("synthetic-s1-s6-complete");
    const formal = formalF7UiData();
    const metrics = structuredClone(fixture.reports.metrics);
    metrics.system_summary.fabric_domain_utilization[0].topology_domain_ref = formalF7Ref(
      "/topology/domains/0",
      "fabric_domain",
      "scale-up",
      "input-topology",
    );
    applyBundle(
      { ...fixture.reports, metrics, design_space: formal.designSpace },
      {
        runId: "run-f7-ui",
        runName: "F7 UI",
        inputs: { ...fixture.inputs, topology: formal.topology },
        artifactManifest: formal.manifest as never,
      },
    );

    const routerLinkStub = { template: '<a class="artifact-evidence-link"><slot /></a>' };
    const designWrapper = mount(DesignSpaceView, { global: { stubs: { RouterLink: routerLinkStub } } });
    expect(designWrapper.text()).toContain("Pareto 与 artifact-record 证据");
    expect(designWrapper.text()).toContain("pareto-f7-ui");
    expect(designWrapper.text()).toContain("backend-candidate-a");
    expect(designWrapper.text()).toContain("不是 Bridge run");
    expect(designWrapper.text()).toContain("9,007,199,254,740,993 ps");
    expect(designWrapper.findAll("a.artifact-evidence-link").length).toBeGreaterThan(2);

    const fabricWrapper = mount(FabricView, { global: { stubs: { RouterLink: routerLinkStub } } });
    expect(fabricWrapper.text()).toContain("Topology → metrics domain：正式契约已验证");
    expect(fabricWrapper.text()).toContain("scale_up / scale_up");
    expect(fabricWrapper.text()).toContain("gpu-0");
    expect(fabricWrapper.text()).toContain("fabric-0");
  });
});
