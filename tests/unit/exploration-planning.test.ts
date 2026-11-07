import { describe, expect, it } from "vitest";
import { formatExplorationPlanningMessage, planExplorationPreflight } from "../../src/features/agent-exploration";
import type { PageContextEnvelope } from "../../src/entities/agent-orchestration";

const baseContext = (overrides: Partial<PageContextEnvelope> = {}): PageContextEnvelope => ({
  contract_revision: "tilesim.web.agent_orchestration.phase1.local.v1",
  page_id: "run-experiment",
  route_name: "experiment",
  context_revision: "ctx-1",
  workspace_ref: null,
  run_ref: null,
  selected_entity: null,
  resources: [],
  supported_actions: ["explain", "configure_current_subset", "check_capability"],
  data_classification: "workspace_internal",
  allowed_purposes: ["explain", "draft"],
  expires_at: null,
  display_label: "实验配置",
  availability: "available",
  ...overrides,
});

describe("deployment exploration planning", () => {
  it("asks at most three questions for an underspecified request", () => {
    const result = planExplorationPreflight(baseContext(), { exploration_objective: null });
    expect(result.status).toBe("needs_clarification");
    expect(result.questions).toHaveLength(3);
    expect(formatExplorationPlanningMessage(result)).toContain("不会生成实验草案");
  });

  it("does not treat recommendation text as request values", () => {
    const result = planExplorationPreflight(baseContext(), { exploration_objective: null });
    expect(result.recommendations[0]?.value).toContain("确认");
    expect(result.status).toBe("needs_clarification");
  });

  it("accepts a fixed resource and explicit objective as a ready planning input", () => {
    const result = planExplorationPreflight(
      baseContext({
        run_request: { model_id: "m", engine: "e", gpu_type: "A100", gpu_count: 4, scenario_id: "s1" },
      }),
      { exploration_objective: { metric_path: "/latency/end_to_end/p99", direction: "minimize" } },
    );
    expect(result.status).toBe("ready");
  });
});
