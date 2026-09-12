import {
  type AgentTypedBlock,
  type DraftField,
  type PageContextEnvelope,
  type Phase1CapabilityProjection,
} from "../../../entities/agent-orchestration";
import { compileIntent } from "../../agent-intent-compiler";
import {
  buildPhase1CapabilityProjection,
  intentOutputToTypedBlocks,
  redactSingleTurnInstruction,
} from "../../agent-copilot-integration";
import type { LightweightAgentViewModel } from "../model";
import { LIGHTWEIGHT_LIMITATIONS } from "../model";
import type { ApiManifestResponse } from "../../../contracts/bridge-api";
import { getAgentOrchestrationCapabilitySnapshot } from "../../../lib/api/agent-orchestration-capabilities";

export interface LightweightAgentAdapter {
  submit(instruction: string): Promise<LightweightAgentViewModel>;
}

export async function createLightweightAgentAdapterFromManifest(input: {
  manifest: ApiManifestResponse;
  context: PageContextEnvelope;
  locale?: "zh-CN" | "en-US";
}): Promise<LightweightAgentAdapter> {
  const snapshot = await getAgentOrchestrationCapabilitySnapshot(input.manifest);
  const capability = buildPhase1CapabilityProjection(snapshot);
  return createLightweightAgentAdapter({ context: input.context, capability, locale: input.locale });
}

function fieldsFromBlocks(blocks: readonly AgentTypedBlock[]) {
  const draftBlock = blocks.find((block) => block.block_type === "draft_summary");
  if (draftBlock?.block_type !== "draft_summary") return [];
  return draftBlock.draft.fields.map((field: DraftField) => ({
    field_id: field.field_id,
    original_value: field.original_value?.serialized_value ?? null,
    proposed_value: field.proposed_value.serialized_value,
    unit: field.unit,
    source: field.value_source,
    validation: field.validation_issues,
    stale: field.stale.state === "stale",
  }));
}

export function createLightweightAgentAdapter(input: {
  context: PageContextEnvelope;
  capability: Phase1CapabilityProjection;
  currentValues?: Readonly<Record<string, import("../../../entities/agent-orchestration").DraftFieldValue | null>>;
  locale?: "zh-CN" | "en-US";
}): LightweightAgentAdapter {
  return {
    async submit(instruction: string) {
      const output = compileIntent({
        contract_revision: "tilesim.web.agent_orchestration.phase1.local.v1",
        instruction: redactSingleTurnInstruction(instruction),
        locale: input.locale || "zh-CN",
        capability: input.capability,
        current_values: input.currentValues || {},
        context: input.context,
      });
      const blocks = intentOutputToTypedBlocks(output);
      const draft = blocks.find((block) => block.block_type === "draft_summary");
      const validation = blocks.find((block) => block.block_type === "validation_result");
      const unsupported = blocks.find((block) => block.block_type === "unsupported");
      const clarification = blocks.find((block) => block.block_type === "clarification");
      const status =
        output.kind === "draft"
          ? output.draft.stale.state === "stale"
            ? "stale"
            : output.draft.validation.overall === "invalid"
              ? "validation_error"
              : "draft"
          : output.kind === "clarification"
            ? "clarification_required"
            : output.kind === "unsupported"
              ? output.result.reason_code === "unknown_field" || output.result.reason_code.includes("unknown")
                ? "unknown"
                : "unsupported"
              : "idle";
      const summary =
        draft?.block_type === "draft_summary"
          ? draft.draft.task_summary
          : clarification?.block_type === "clarification"
            ? "还需要一点信息才能安全生成草案。"
            : unsupported?.block_type === "unsupported"
              ? "这项请求当前不可用，但可以继续处理已发布的八个参数。"
              : validation?.block_type === "validation_result"
                ? `确定性校验：${validation.overall}`
                : "没有生成修改。";
      return {
        status,
        summary,
        blocks,
        fields: fieldsFromBlocks(blocks),
        missing: clarification?.block_type === "clarification" ? clarification.questions.map((q) => q.prompt) : [],
        limitations: [...LIGHTWEIGHT_LIMITATIONS],
        context: input.context,
        capability: input.capability,
      };
    },
  };
}
