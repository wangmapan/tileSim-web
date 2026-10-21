// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AgentHarnessBatchPanel from "../../src/features/agent-harness/components/AgentHarnessBatchPanel.vue";

const provenance = {
  deployment_mode: "local_dev",
  source_mode: "synthetic_trace",
  claim_scope: "exploratory",
  production_status: "not_for_production",
};
const batch = {
  schema_identity: "tilesim.agent_harness.batch_session.v1",
  contract_revision: "2026-10-19.wpe.v1",
  batch_id: "batch-test",
  principal: "local-user",
  workspace_id: "local",
  input_snapshot_digest: `sha256:${"a".repeat(64)}`,
  schema_set_revision: `sha256:${"b".repeat(64)}`,
  backend_identity: {},
  policy_revision: "tilesim.agent_harness.local_batch.policy.v1",
  plan: {},
  candidate_set: [],
  objective: {},
  budget: {},
  concurrency_policy: {},
  stop_policy: {},
  approval_required: true,
  auto_execute: true,
  local_dev: true,
  state: "waiting_approval",
  provenance,
} as never;

describe("AgentHarnessBatchPanel", () => {
  it("shows local provenance and exposes the plan approval fence", async () => {
    const wrapper = mount(AgentHarnessBatchPanel, {
      props: {
        batches: [batch],
        detail: {
          batch,
          candidates: [
            { candidate_id: "candidate-1", candidate_digest: `sha256:${"c".repeat(64)}`, status: "waiting_approval" },
          ],
        } as never,
      },
    });
    expect(wrapper.attributes("data-provenance")).toContain("not_for_production");
    expect(wrapper.text()).toContain("批准批量计划");
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("批准"))!
      .trigger("click");
    expect(wrapper.emitted("approve")?.[0]).toEqual(["batch-test"]);
  });
});
