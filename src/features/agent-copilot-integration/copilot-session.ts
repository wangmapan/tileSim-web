import type {
  AgentTypedBlock,
  CurrentSubsetExperimentDraft,
  IntentCompilerOutput,
  UnsupportedCapabilityResult,
} from "../../entities/agent-orchestration";

const secretPatterns = [
  /\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/giu,
  /\bBearer\s+[-A-Za-z0-9._~+/]+=*/giu,
] as const;

export function redactSingleTurnInstruction(instruction: string): string {
  let redacted = Array.from(instruction, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (codePoint < 32 && character !== "\n" && character !== "\t") || codePoint === 127 ? " " : character;
  })
    .join("")
    .trim();
  for (const pattern of secretPatterns) redacted = redacted.replace(pattern, "[REDACTED]");
  return redacted.slice(0, 2_000);
}

function explanationFor(output: IntentCompilerOutput): AgentTypedBlock {
  if (output.kind === "draft") {
    return {
      block_type: "explanation",
      block_id: "phase1-understanding",
      title: "理解结果",
      body: output.draft.task_summary,
    };
  }
  if (output.kind === "clarification") {
    return {
      block_type: "explanation",
      block_id: "phase1-understanding",
      title: "还需要确认",
      body: "我识别到了参数调整意图，但关键信息还不足以安全生成草案。",
    };
  }
  if (output.kind === "unsupported") {
    return {
      block_type: "explanation",
      block_id: "phase1-understanding",
      title: "能力范围",
      body: "这项请求超出当前已发布的八字段参数草案范围。",
    };
  }
  return {
    block_type: "explanation",
    block_id: "phase1-understanding",
    title: "未生成修改",
    body: "没有识别到可安全应用于当前八字段范围的参数变化。请明确字段、方向、数值和单位。",
  };
}

export function intentOutputToTypedBlocks(output: IntentCompilerOutput): AgentTypedBlock[] {
  const blocks: AgentTypedBlock[] = [explanationFor(output)];
  if (output.kind === "draft") {
    blocks.push({ block_type: "draft_summary", block_id: "phase1-draft", draft: output.draft });
    blocks.push({
      block_type: "validation_result",
      block_id: "phase1-validation",
      overall: output.draft.validation.overall,
      issues: output.draft.validation.issues,
    });
  } else if (output.kind === "clarification") {
    blocks.push({ block_type: "clarification", block_id: "phase1-clarification", questions: output.questions });
  } else if (output.kind === "unsupported") {
    blocks.push({ block_type: "unsupported", block_id: "phase1-unsupported", result: output.result });
  }
  return blocks;
}

export function formalErrorBlock(code: string, message: string): AgentTypedBlock {
  return {
    block_type: "formal_error",
    block_id: `phase1-error:${code}`,
    code,
    message,
    safe_next_action: "确认本地 Bridge 契约可用并刷新当前页面上下文后重试。",
  };
}

function staleDraft(draft: CurrentSubsetExperimentDraft, currentRevision: string): CurrentSubsetExperimentDraft {
  const stale = {
    state: "stale" as const,
    reason: "page_context_revision_changed" as const,
    expected_revision: draft.context_revision,
    current_revision: currentRevision,
  };
  return {
    ...draft,
    stale,
    fields: draft.fields.map((field) => ({ ...field, stale })),
    validation: { ...draft.validation, overall: "stale" },
  };
}

export function markAgentBlocksStale(blocks: readonly AgentTypedBlock[], currentRevision: string): AgentTypedBlock[] {
  return blocks.map((block) => {
    if (block.block_type === "draft_summary") {
      return { ...block, draft: staleDraft(block.draft, currentRevision) };
    }
    if (block.block_type === "validation_result") return { ...block, overall: "stale" };
    return block;
  });
}

export function unsupportedResultForUnavailableContext(reasonCode: string): UnsupportedCapabilityResult {
  return {
    status: "unsupported",
    reason_code: reasonCode,
    understood: [],
    unsupported_items: [{ text: reasonCode, capability: "page_context", gap_id: null }],
    safe_next_actions: ["返回实验配置页，并使用控件模式后重试。"],
  };
}
