import { describe, expect, it } from "vitest";
import {
  agentFlowRefetchInterval,
  agentFlowStateToTypedBlock,
  shouldRetryAgentFlowQuery,
} from "../../src/features/agent-flow";
import { BridgeApiError } from "../../src/lib/api/errors";
import type { AgentFlowState } from "../../src/lib/api/agent-flow";

function state(overrides: Partial<AgentFlowState> = {}): AgentFlowState {
  return {
    schema_identity: "tilesim.agent_flow.state.v1",
    contract_revision: "2026-10-28.flow.v2",
    flow_id: "flow-test",
    session_id: "session-test",
    principal: "local-user",
    workspace_id: "local-workspace",
    intent: "user_report",
    status: "waiting_user",
    node: "await_user_confirmation",
    event_sequence: 1,
    binding: {
      session_id: "session-test",
      flow_id: "flow-test",
      run_id: "run-test",
      run_context_revision: "ctx-1",
      backend_identity: { backend: "fixture" },
      schema_set_revision: "sha256:e55441d53139a6014b4a2a78c457d77b3c7e919069b9214dc40ad5568cdb08db",
      input_snapshot_digest: null,
      artifact_bindings: [],
    },
    pending_action: "confirm_report",
    approval: null,
    authorization: null,
    validation: null,
    evidence: { status: "partial" },
    report: { status: "ready_with_limitations" },
    terminal_reason: null,
    checkpoint_id: "checkpoint-test",
    created_at: "2026-10-25T00:00:00Z",
    updated_at: "2026-10-25T00:00:01Z",
    ...overrides,
  };
}

describe("agent flow presentation", () => {
  it("keeps partial evidence and approval visible in the typed block", () => {
    const block = agentFlowStateToTypedBlock(state());
    expect(block.pending_action?.action).toBe("confirm_report");
    expect(block.evidence_status).toBe("partial");
    expect(block.report_status).toBe("ready_with_limitations");
  });

  it("projects durable navigation observations without inventing a route", () => {
    const block = agentFlowStateToTypedBlock(
      state({
        last_navigation_observation: {
          target_page: "metrics",
          actual_page: "fabric",
          page_correct: false,
          current_page_capabilities: ["fabric", "run_bound"],
          current_run_id: "run-test",
          current_context_revision: "ctx-1",
          failure_type: "page_mismatch",
          retry_allowed: true,
          visited_pages: ["metrics", "fabric"],
          navigation_attempts: 2,
        },
      }),
    );
    expect(block.navigation?.target_page).toBe("metrics");
    expect(block.navigation?.visited_pages).toEqual(["metrics", "fabric"]);
    expect(block.navigation?.navigation_attempts).toBe(2);
  });

  it("gives durable navigation one explicit confirmation prompt", () => {
    const block = agentFlowStateToTypedBlock(
      state({
        intent: "navigation",
        pending_action: "confirm_navigation",
        binding: { ...state().binding, run_id: null, run_context_revision: null, artifact_bindings: [] },
      }),
    );
    expect(block.pending_action?.action).toBe("confirm_navigation");
    expect(block.pending_action?.prompt).toBe("是否打开助手建议的目标页面？");
  });

  it("maps unknown evidence to missing instead of implying validation", () => {
    const block = agentFlowStateToTypedBlock(state({ evidence: { status: "unknown" } }));
    expect(block.evidence_status).toBe("missing");
    expect(block.detail).toContain("重新校验");
  });

  it("renders stale and refused as terminal safety states", () => {
    expect(agentFlowStateToTypedBlock(state({ status: "stale", pending_action: null })).detail).toContain("已变化");
    expect(agentFlowStateToTypedBlock(state({ status: "refused", pending_action: null })).detail).toContain("拒绝");
  });

  it("does not offer a configuration draft outside a page that publishes draft capability", () => {
    const pending = state({
      pending_action: "clarify_intent",
      binding: { ...state().binding, run_id: null, run_context_revision: null, artifact_bindings: [] },
    });
    const readOnly = agentFlowStateToTypedBlock(pending);
    expect(readOnly.pending_action?.intent_options?.map((option) => option.intent)).toEqual(["explain"]);
    const draftPage = agentFlowStateToTypedBlock(pending, undefined, undefined, { allowConfigurationDraft: true });
    expect(draftPage.pending_action?.intent_options?.map((option) => option.intent)).toEqual([
      "explain",
      "configuration_draft",
    ]);
  });

  it("stops query polling for terminal and non-retryable identity failures", () => {
    expect(agentFlowRefetchInterval({ state: { data: state({ status: "completed" }) } })).toBe(false);
    expect(
      agentFlowRefetchInterval({
        state: { error: new BridgeApiError("stale", { status: 409, code: "schema_revision_mismatch" }) },
      }),
    ).toBe(false);
    expect(
      agentFlowRefetchInterval({
        state: { error: new BridgeApiError("busy", { status: 503, code: "temporarily_unavailable", retryable: true }) },
      }),
    ).toBe(2_000);
  });

  it("only treats transport failures and explicitly retryable Bridge errors as retryable", () => {
    expect(shouldRetryAgentFlowQuery(new TypeError("network down"))).toBe(true);
    expect(shouldRetryAgentFlowQuery(new Error("malformed flow payload"))).toBe(false);
    expect(shouldRetryAgentFlowQuery(new BridgeApiError("denied", { status: 403, code: "flow_access_denied" }))).toBe(
      false,
    );
  });
});
