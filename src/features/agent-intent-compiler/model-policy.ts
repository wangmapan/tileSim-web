import type { AgentIntentResponse } from "../../contracts/bridge-api";

/**
 * Deterministic policy projection for the model's closed-world intent output.
 * The model may describe risk and a suggested sequence, but it never grants
 * permission to perform a side effect.
 */
export interface AgentIntentPolicy {
  riskLevel: AgentIntentResponse["risk_level"];
  requiresUserConfirmation: boolean;
  hasExecutionStep: boolean;
  clarificationQuestions: readonly string[];
  shouldClarify: boolean;
}

export function deriveAgentIntentPolicy(
  response: {
    risk_level: AgentIntentResponse["risk_level"];
    requires_user_confirmation: boolean;
    suggested_steps: readonly { kind: string; [key: string]: unknown }[];
    clarification_questions: readonly string[];
  },
): AgentIntentPolicy {
  const hasExecutionStep = response.suggested_steps.some((step) => step.kind === "execute");
  const clarificationQuestions = response.clarification_questions.slice(0, 3);
  return {
    riskLevel: response.risk_level,
    // A model cannot waive confirmation for a risky or execution-shaped plan.
    requiresUserConfirmation:
      response.requires_user_confirmation || response.risk_level !== "low" || hasExecutionStep,
    hasExecutionStep,
    clarificationQuestions,
    shouldClarify: clarificationQuestions.length > 0,
  };
}
