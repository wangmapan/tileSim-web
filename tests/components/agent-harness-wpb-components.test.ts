// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AgentHarnessApprovalBlock from "../../src/features/agent-harness/components/AgentHarnessApprovalBlock.vue";
import AgentHarnessDraftCard from "../../src/features/agent-harness/components/AgentHarnessDraftCard.vue";
import AgentHarnessValidationBlock from "../../src/features/agent-harness/components/AgentHarnessValidationBlock.vue";
import AgentHarnessTaskCenter from "../../src/features/agent-harness/components/AgentHarnessTaskCenter.vue";
import type { AgentHarnessDraftTaskCenterItem } from "../../src/features/agent-harness/task-center";
import type {
  AgentHarnessApprovalV2,
  AgentHarnessDraftValidationReportV1,
  AgentHarnessExperimentDraftV2,
} from "../../src/lib/api/agent-harness";
import { AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION } from "../../src/contracts/generated/agent-harness";

const digest = (letter: string) => `sha256:${letter.repeat(64)}`;
const backend = { source_revision: "backend-test" };
const draft: AgentHarnessExperimentDraftV2 = {
  schema_identity: "tilesim.agent_harness.experiment_draft.v2",
  contract_revision: "2026-10-18.wpb.v1",
  draft_id: "draft-ui",
  operation_id: "operation-ui",
  principal: "local-user",
  workspace_id: "local-workspace",
  run_scope: "draft-only",
  input_snapshot_digest: digest("a"),
  schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
  backend_identity: backend,
  parameter_catalog_revision: "catalog-v1",
  validator_revision: "validator-v1",
  policy_revision: "tilesim.agent_harness.policy.v1",
  field_diffs: [{ field_id: "fidelity", json_pointer: "/fidelity", change: "replace" }],
  assumptions: ["人工确认后才可进入后续阶段"],
  evidence_refs: ["catalog:baseline"],
  budget_request: { max_total_ms: 100 },
  risk_flags: ["manual_review"],
  status: "draft",
  created_at: "2026-10-18T00:00:00Z",
  expires_at: "2026-10-19T00:00:00Z",
  draft_digest: digest("b"),
  idempotency_key: "draft-ui-key",
  would_create_run: false,
};
const validation: AgentHarnessDraftValidationReportV1 = {
  schema_identity: "tilesim.agent_harness.draft_validation_report.v1",
  contract_revision: "2026-10-18.wpb.v1",
  draft_id: "draft-ui",
  draft_digest: digest("b"),
  validation_id: "validation-ui",
  principal: "local-user",
  workspace_id: "local-workspace",
  input_snapshot_digest: digest("a"),
  validator_revision: "validator-v1",
  schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
  backend_identity: backend,
  policy_revision: "tilesim.agent_harness.policy.v1",
  status: "invalid",
  issues: [{ code: "invalid_value", severity: "error", message: "需要检查参数", field_path: "/fidelity" }],
  field_results: [{ field_id: "fidelity", json_pointer: "/fidelity", status: "invalid", reason: "不支持" }],
  unsupported_fields: [],
  stale_reasons: [],
  budget_estimate: {},
  risk_flags: [],
  would_create_run: false,
  validated_create_run_request_digest: digest("c"),
  created_at: "2026-10-18T00:00:01Z",
};
const approval: AgentHarnessApprovalV2 = {
  schema_identity: "tilesim.agent_harness.approval.v2",
  contract_revision: "2026-10-18.wpb.v1",
  approval_id: "approval-ui",
  draft_id: "draft-ui",
  draft_digest: digest("b"),
  validation_id: "validation-ui",
  principal: "local-user",
  workspace_id: "local-workspace",
  policy_revision: "tilesim.agent_harness.policy.v1",
  schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
  backend_identity: backend,
  status: "revoked",
  created_at: "2026-10-18T00:00:00Z",
  expires_at: "2026-10-19T00:00:00Z",
  approved_at: "2026-10-18T00:00:00Z",
  rejected_at: null,
  revoked_at: "2026-10-18T00:00:02Z",
  reason: "scope changed",
  approval_digest: digest("d"),
  single_use: true,
  consumed: false,
};

describe("Agent Harness WP-B presentation", () => {
  it("shows draft provenance, diff and explicit run-free notice", () => {
    const wrapper = mount(AgentHarnessDraftCard, { props: { draft, validation, approval } });
    expect(wrapper.text()).toContain("实验草案");
    expect(wrapper.text()).toContain("参数差异");
    expect(wrapper.text()).toContain("/fidelity");
    expect(wrapper.text()).toContain("不会创建 TileSim 运行");
    expect(wrapper.text()).toContain("已撤销");
  });

  it("renders deterministic issues and keeps revalidate as an explicit event", async () => {
    const wrapper = mount(AgentHarnessValidationBlock, { props: { validation } });
    expect(wrapper.text()).toContain("参数非法");
    expect(wrapper.text()).toContain("invalid_value");
    expect(wrapper.text()).toContain("/fidelity");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("revalidate")).toHaveLength(1);
  });

  it("does not hide revoked approval and keeps approval actions gated", () => {
    const wrapper = mount(AgentHarnessApprovalBlock, { props: { approval, canAct: true } });
    expect(wrapper.text()).toContain("已撤销");
    expect(wrapper.text()).toContain("不会启动实验");
    expect(wrapper.findAll("button")).toHaveLength(0);
  });

  it("exposes only explicit reject/revoke actions for an approved approval", async () => {
    const wrapper = mount(AgentHarnessApprovalBlock, {
      props: { approval: { ...approval, status: "approved", revoked_at: null }, canAct: true },
    });
    expect(wrapper.findAll("button")).toHaveLength(2);
    await wrapper.findAll("button")[0].trigger("click");
    await wrapper.findAll("button")[1].trigger("click");
    expect(wrapper.emitted("reject")).toHaveLength(1);
    expect(wrapper.emitted("revoke")).toHaveLength(1);
  });

  it("renders server-backed drafts in the task center without inventing an operation", () => {
    const item: AgentHarnessDraftTaskCenterItem = { id: draft.draft_id, draft, validation, approval };
    const wrapper = mount(AgentHarnessTaskCenter, { props: { drafts: [item] } });
    expect(wrapper.text()).toContain("实验草案");
    expect(wrapper.text()).toContain("确定性校验");
    expect(wrapper.text()).toContain("人工审批");
    expect(wrapper.text()).toContain("不会创建 TileSim 运行");
    expect(wrapper.text()).not.toContain("当前没有可显示的 operation 或草案");
  });
});
