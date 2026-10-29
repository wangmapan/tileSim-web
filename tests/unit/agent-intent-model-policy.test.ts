import { describe, expect, it } from "vitest";
import { deriveAgentIntentPolicy } from "../../src/features/agent-intent-compiler";

const base = {
  risk_level: "low" as const,
  requires_user_confirmation: false,
  suggested_steps: [] as never[],
  clarification_questions: [] as string[],
};

describe("model intent policy projection", () => {
  it("does not allow the model to waive confirmation for risky or execution-shaped steps", () => {
    expect(
      deriveAgentIntentPolicy({
        ...base,
        risk_level: "high",
        suggested_steps: [{ kind: "observe", description: "检查页面", page_id: "overview" }],
      }).requiresUserConfirmation,
    ).toBe(true);
    expect(
      deriveAgentIntentPolicy({
        ...base,
        suggested_steps: [{ kind: "execute", description: "执行实验", page_id: "experiment" }],
      }).hasExecutionStep,
    ).toBe(true);
  });

  it("turns bounded model clarification questions into a stop signal", () => {
    const policy = deriveAgentIntentPolicy({
      ...base,
      clarification_questions: ["要查看哪个运行？", "是否只读？", "第三个问题", "忽略这个"],
    });
    expect(policy.shouldClarify).toBe(true);
    expect(policy.clarificationQuestions).toEqual(["要查看哪个运行？", "是否只读？", "第三个问题"]);
  });
});
