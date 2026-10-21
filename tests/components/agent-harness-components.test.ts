// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AgentHarnessStatusCard from "../../src/features/agent-harness/components/AgentHarnessStatusCard.vue";
import AgentHarnessOperationCard from "../../src/features/agent-harness/components/AgentHarnessOperationCard.vue";
import AgentHarnessToolTimeline from "../../src/features/agent-harness/components/AgentHarnessToolTimeline.vue";
import AgentHarnessTaskCenter from "../../src/features/agent-harness/components/AgentHarnessTaskCenter.vue";
import AgentHarnessOptimizationPanel from "../../src/features/agent-harness/components/AgentHarnessOptimizationPanel.vue";
import type { AgentHarnessOperationProjection } from "../../src/lib/api/agent-harness";
import { fixtureProjection, projectWorkflowEvents, type WorkflowEvent } from "../../src/entities/agent-orchestration";
import type { AgentHarnessTaskCenterItem } from "../../src/features/agent-harness/task-center";

const event = (sequence: number, state: WorkflowEvent["state"]): WorkflowEvent => ({
  schema_identity: "tilesim.agent_harness.workflow_event.v0",
  contract_revision: "2026-10-17.wpa.v0",
  publication_status: "proposal_non_published",
  operation_id: "op-component",
  turn_id: null,
  run_id: null,
  snapshot_digest: null,
  schema_set_revision: null,
  policy_revision: "fixture",
  event_id: `event-${sequence}`,
  sequence,
  event_kind: state === "running" ? "started" : state === "draft" ? "submitted" : state,
  state,
  transition_kind: "normal",
  occurred_at: "2026-10-17T00:00:00Z",
  payload_digest: `sha256:${String(sequence).padStart(64, "0")}`,
  dedupe_key: `event-${sequence}`,
  idempotency_key: "fixture",
  producer_revision: "fixture",
});

describe("Agent Harness fixture presentation", () => {
  it("keeps local optimization approval and provenance boundaries visible", () => {
    const provenance = {
      deployment_mode: "local_dev",
      source_mode: "synthetic_trace",
      claim_scope: "exploratory",
      production_status: "not_for_production",
    };
    const session = {
      schema_identity: "tilesim.agent_harness.optimization_session.v1",
      contract_revision: "2026-10-19.wpd.v1",
      session_id: "opt-component",
      principal: "local-user",
      workspace_id: "local",
      input_snapshot_digest: `sha256:${"a".repeat(64)}`,
      schema_set_revision: `sha256:${"b".repeat(64)}`,
      backend_identity: { backend_revision: "local" },
      policy_revision: "tilesim.agent_harness.local_optimization.policy.v1",
      objective: { metric_path: "/tail_latency_summary/ttft_ps/p95_ps", direction: "minimize" },
      constraints: [],
      budget: { max_iterations: 2 },
      base_config: { scenario_id: "s1_des_example" },
      local_dev: true,
      automatic_submission: false,
      state: "waiting_approval",
      current_iteration: 0,
      provenance,
    } as never;
    const candidate = {
      schema_identity: "tilesim.agent_harness.optimization_candidate.v1",
      contract_revision: "2026-10-19.wpd.v1",
      candidate_id: "candidate-component",
      session_id: "opt-component",
      candidate_digest: `sha256:${"c".repeat(64)}`,
      config: { scenario_id: "s1_des_example" },
      diff: { changed_fields: ["scenario_id"] },
      expected_side_effects: ["one bounded Stage-3 execution"],
      status: "waiting_approval",
      provenance,
    } as never;
    const wrapper = mount(AgentHarnessOptimizationPanel, {
      props: {
        sessions: [session],
        detail: {
          session,
          candidate,
          candidates: [candidate],
          iterations: [],
          events: [],
          checkpoint: null,
          approval: null,
          tool_invocations: [],
        },
        pending: false,
      },
    });
    expect(wrapper.attributes("data-provenance")).toContain("not_for_production");
    expect(wrapper.text()).toContain("每个候选都需要人工批准");
    expect(wrapper.text()).toContain("批准候选并提交");
    expect(wrapper.findAll("button")).toHaveLength(4);
  });

  it("accepts a nested metrics JSON Pointer in the browser form", async () => {
    const wrapper = mount(AgentHarnessOptimizationPanel, { props: { sessions: [], detail: null } });
    await wrapper.get("button").trigger("click");
    const pointer = wrapper.get('input[type="text"]');
    expect(pointer.attributes("pattern")).toBe("^/.*");
    expect((pointer.element as HTMLInputElement).checkValidity()).toBe(true);
  });

  it("labels a not-exposed fixture without implying a live queue", () => {
    const projection = fixtureProjection(projectWorkflowEvents([]), null);
    const wrapper = mount(AgentHarnessStatusCard, { props: { projection } });
    expect(wrapper.attributes("data-source")).toBe("fixture");
    expect(wrapper.attributes("data-availability")).toBe("not_exposed");
    expect(wrapper.text()).toContain("未暴露");
    expect(wrapper.text()).toContain("proposal-only fixture");
    expect(wrapper.text()).toContain("不会");
  });

  it("renders completed state and duplicate count from a deterministic projection", () => {
    const projection = fixtureProjection(
      projectWorkflowEvents([event(1, "submitted"), event(2, "queued"), event(3, "running"), event(4, "completed")]),
      "op-component",
    );
    const wrapper = mount(AgentHarnessStatusCard, { props: { projection, title: "测试任务" } });
    expect(wrapper.text()).toContain("测试任务");
    expect(wrapper.text()).toContain("已完成");
    expect(wrapper.text()).toContain("4 个已接受，0 个重复");
    expect(wrapper.get('[role="status"]').text()).toBe("已完成");
  });

  it("keeps formal v1 operation status separate from the proposal fixture", () => {
    const projection: AgentHarnessOperationProjection = {
      operation: null,
      events: [
        {
          schema_identity: "tilesim.agent_harness.workflow_event.v1",
          contract_revision: "2026-10-17.wpa.v1",
          operation_id: "op-component",
          turn_id: "turn-component",
          run_id: "run-component",
          snapshot_digest: "sha256:snapshot",
          workflow_state: "running",
          schema_set_revision: "sha256:29c1b985068c3f4be921fa48cebe5bbe3502079d3a13d263e6bcdbad4fc6ec73",
          policy_revision: "tilesim.agent_harness.policy.v1",
          backend_identity: {},
          created_at: "2026-10-17T00:00:00Z",
          updated_at: "2026-10-17T00:00:00Z",
          event_id: "event-formal-1",
          sequence: 1,
          parent_event_id: null,
          node: "worker",
          payload_digest: "sha256:event",
          terminal: false,
          idempotency_key: "idem-component",
        },
      ],
      state: "recovery_required",
      terminal: false,
      source: "polling",
      last_event_sequence: 4,
      duplicate_event_ids: [],
      rejected_event_ids: ["late"],
      late_event_ids: [],
      stale_reason: "schema_set_revision_changed",
      requires_recovery: true,
      error: null,
    };
    const wrapper = mount(AgentHarnessOperationCard, { props: { projection } });
    expect(wrapper.attributes("data-source")).toBe("bridge-v1");
    expect(wrapper.text()).toContain("需要恢复");
    expect(wrapper.text()).toContain("stale");
    expect(wrapper.text()).toContain("工作流事件");
    expect(wrapper.text()).toContain("worker");
    expect(wrapper.text()).not.toContain("proposal-only fixture");
  });

  it("renders read-only tool outcomes and does not expose write controls", () => {
    const wrapper = mount(AgentHarnessToolTimeline, {
      props: {
        items: [
          {
            id: "tool-1",
            tool_name: "query_verified_metrics",
            tool_revision: "1",
            outcome: "unknown_outcome",
            operation_id: "op-1",
            turn_id: "turn-1",
            run_id: "run-1",
            scope: "agent:read_evidence",
            started_at: "2026-10-17T00:00:00Z",
            finished_at: "2026-10-17T00:00:01Z",
            error_code: "tool_unknown_outcome",
            field_path: "/input/run_id",
            artifact_summary: "metrics · sha256:… · 1024 bytes",
            artifact_id: "metrics",
            artifact_schema: "tilesim.metrics.v1",
            artifact_sha256: "sha256:abc",
            artifact_bytes: "1024",
            artifact_pointer: "/records/0",
          },
        ],
      },
    });
    expect(wrapper.text()).toContain("结果未知，需要恢复");
    expect(wrapper.text()).toContain("tool_unknown_outcome");
    expect(wrapper.text()).toContain("2026-10-17T00:00:00Z");
    expect(wrapper.text()).toContain("tilesim.metrics.v1");
    expect(wrapper.text()).toContain("/records/0");
    expect(wrapper.findAll("button")).toHaveLength(0);
  });

  it("renders a read-only task center with unavailable write controls", () => {
    const item: AgentHarnessTaskCenterItem = {
      id: "task-1",
      title: "读取 run 状态",
      availability: "available",
      projection: {
        operation: null,
        events: [],
        state: "waiting_tool",
        terminal: false,
        source: "polling",
        last_event_sequence: 2,
        duplicate_event_ids: [],
        rejected_event_ids: [],
        late_event_ids: [],
        stale_reason: null,
        requires_recovery: false,
        error: null,
      },
      cancel: "not_exposed",
      approval: "not_exposed",
    };
    const wrapper = mount(AgentHarnessTaskCenter, { props: { items: [item] } });
    expect(wrapper.attributes("data-source")).toBe("bridge-v1");
    expect(wrapper.text()).toContain("读取 run 状态");
    expect(wrapper.text()).toContain("等待工具");
    expect(wrapper.text()).toContain("取消");
    expect(wrapper.text()).toContain("审批写入");
    expect(wrapper.text()).toContain("未暴露");
    expect(wrapper.findAll("button")).toHaveLength(0);
  });
});
