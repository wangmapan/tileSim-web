// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AgentHarnessExecutionCard from "../../src/features/agent-harness/components/AgentHarnessExecutionCard.vue";
import type { AgentHarnessExecutionProjection } from "../../src/lib/api/agent-harness";

const projection = {
  execution: {
    schema_identity: "tilesim.agent_harness.execution_operation.v1",
    contract_revision: "2026-10-18.wpc.v1",
    execution_id: "execution-1",
    operation_id: "operation-1",
    draft_id: "draft-1",
    approval_id: "approval-1",
    validation_id: "validation-1",
    draft_digest: "sha256:" + "a".repeat(64),
    approval_digest: "sha256:" + "b".repeat(64),
    input_snapshot_digest: "sha256:" + "c".repeat(64),
    schema_set_revision: "sha256:" + "d".repeat(64),
    backend_identity: { backend_revision: "local" },
    policy_revision: "tilesim.agent_harness.policy.v1",
    workflow_revision: "2026-10-18.wpc.v1",
    idempotency_key: "key",
    request_digest: "sha256:" + "e".repeat(64),
    principal: "local-user",
    workspace_id: "local-workspace",
    run_id: null,
    state: "recovery_required",
    created_at: "2026-10-19T00:00:00Z",
    updated_at: "2026-10-19T00:00:00Z",
    attempt_count: 1,
    retryable: false,
    unknown_outcome: true,
    cancellation_fence: null,
    result: null,
    error: null,
  },
  operation: {},
  events: [],
  state: "recovery_required",
  terminal: false,
  source: "polling",
  last_event_sequence: 2,
  duplicate_event_ids: [],
  rejected_event_ids: [],
  late_event_ids: [],
  stale_reason: null,
  requires_recovery: true,
  error: null,
} as unknown as AgentHarnessExecutionProjection;

describe("Stage 3B execution card", () => {
  it("keeps local-dev boundary visible and exposes explicit recovery actions", () => {
    const wrapper = mount(AgentHarnessExecutionCard, { props: { projection } });
    expect(wrapper.text()).toContain("local-dev");
    expect(wrapper.text()).toContain("not_for_production");
    expect(wrapper.text()).toContain("显式恢复");
  });

  it("renders only the verified result reference supplied by the adapter", () => {
    const wrapper = mount(AgentHarnessExecutionCard, {
      props: {
        projection: { ...projection, state: "completed", terminal: true, requires_recovery: false },
        result: { manifest_digest: "sha256:" + "f".repeat(64) },
      },
    });
    expect(wrapper.get('[aria-label="结果引用"]').text()).toContain("sha256:" + "f".repeat(64));
  });
});
