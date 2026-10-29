import type { AgentTypedBlock } from "../../entities/agent-orchestration";
import type { AgentFlowState } from "../../lib/api/agent-flow";

type AgentFlowBlock = Extract<AgentTypedBlock, { block_type: "agent_flow" }>;

function evidenceStatus(state: AgentFlowState): AgentFlowBlock["evidence_status"] {
  const value = state.evidence && typeof state.evidence.status === "string" ? state.evidence.status : "missing";
  if (
    value === "validated" ||
    value === "deterministic_fallback" ||
    value === "partial" ||
    value === "truncated" ||
    value === "provider_unavailable"
  )
    return value;
  return "missing";
}

function reportStatus(state: AgentFlowState): AgentFlowBlock["report_status"] {
  const value = state.report && typeof state.report.status === "string" ? state.report.status : "not_started";
  if (value === "ready" || value === "ready_with_limitations" || value === "not_applicable") return value;
  return "not_started";
}

function detailFor(state: AgentFlowState): string {
  if (state.status === "waiting_user" && state.terminal_reason?.startsWith("observer_stopped:"))
    return "流程观察已停止，当前身份或契约无法继续校验；未伪造服务端终态，请重新发起。";
  if (state.status === "refused") return "当前请求被安全边界拒绝；不会创建运行、修改配置或调用执行接口。";
  if (state.status === "stale") return "页面、运行或 schema 身份已变化，流程已停止。请重新发起。";
  if (state.status === "cancelled") return "流程已取消，未产生执行副作用。";
  if (state.status === "failed") return state.terminal_reason || "流程失败；请检查当前证据和绑定后重试。";
  if (state.status === "completed") return "流程已完成；结果仍受当前证据状态和生产边界限制。";
  if (state.status === "draft_ready") return "草案已准备；尚未写入配置，也不会创建运行。";
  if (state.pending_action) return "流程暂停等待人工确认，继续前会重新校验完整身份绑定。";
  return "流程正在按只读、可审计步骤推进。";
}

function clarificationOptions(state: AgentFlowState, allowConfigurationDraft: boolean) {
  const options: Array<{
    intent: "explain" | "configuration_draft" | "existing_run_analysis" | "user_report";
    label: string;
  }> = [
    { intent: "explain", label: "说明当前页面" },
    ...(allowConfigurationDraft ? [{ intent: "configuration_draft" as const, label: "生成配置草案" }] : []),
  ];
  if (state.binding.run_id && state.binding.run_context_revision && state.binding.artifact_bindings.length) {
    options.push(
      { intent: "existing_run_analysis", label: "分析当前结果" },
      { intent: "user_report", label: "整理结果解读报告" },
    );
  }
  return options;
}

export function agentFlowStateToTypedBlock(
  state: AgentFlowState,
  blockId = `agent-flow:${state.flow_id}`,
  title = "只读助手流程",
  options: { allowConfigurationDraft?: boolean } = {},
): AgentFlowBlock {
  return {
    block_type: "agent_flow",
    block_id: blockId,
    flow_id: state.flow_id,
    event_sequence: state.event_sequence,
    page_id: state.current_page || null,
    context_revision: state.current_context_revision || null,
    status: state.status,
    phase: state.node,
    title,
    detail: detailFor(state),
    pending_action: state.pending_action
      ? {
          action: state.pending_action,
          prompt:
            state.pending_action === "confirm_report"
              ? "是否继续整理当前结果报告？"
              : state.pending_action === "confirm_draft"
                ? "是否生成只读配置草案？"
                : state.pending_action === "confirm_navigation"
                  ? "是否打开助手建议的目标页面？"
                  : "请补充当前流程需要的意图信息。",
          reason: "确认后 Bridge 会重新校验 flow、run、backend、schema、input 和 artifact binding。",
          ...(state.pending_action === "clarify_intent"
            ? { intent_options: clarificationOptions(state, options.allowConfigurationDraft === true) }
            : {}),
        }
      : null,
    evidence_status: evidenceStatus(state),
    report_status: reportStatus(state),
    terminal_reason: state.terminal_reason,
    navigation: state.last_navigation_observation
      ? {
          target_page: state.last_navigation_observation.target_page,
          actual_page: state.last_navigation_observation.actual_page,
          page_correct: state.last_navigation_observation.page_correct,
          current_page_capabilities: state.last_navigation_observation.current_page_capabilities,
          current_run_id: state.last_navigation_observation.current_run_id,
          current_context_revision: state.last_navigation_observation.current_context_revision,
          failure_type: state.last_navigation_observation.failure_type,
          retry_allowed: state.last_navigation_observation.retry_allowed,
          visited_pages: state.last_navigation_observation.visited_pages,
          navigation_attempts: state.last_navigation_observation.navigation_attempts,
        }
      : null,
    binding: state.binding,
  };
}
