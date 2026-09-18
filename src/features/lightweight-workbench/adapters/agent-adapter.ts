import {
  type AgentTypedBlock,
  type DraftField,
  type PageContextEnvelope,
  type Phase1CapabilityProjection,
} from "../../../entities/agent-orchestration";
import { compileIntent } from "../../agent-intent-compiler";
import {
  buildPhase1CapabilityProjection,
  formalErrorBlock,
  intentOutputToTypedBlocks,
  redactSingleTurnInstruction,
} from "../../agent-copilot-integration";
import type { LightweightAgentViewModel } from "../model";
import { LIGHTWEIGHT_LIMITATIONS } from "../model";
import type { ApiManifestResponse } from "../../../contracts/bridge-api";
import { getAgentOrchestrationCapabilitySnapshot } from "../../../lib/api/agent-orchestration-capabilities";

// The shared redactor covers the canonical credential forms used by the
// professional copilot.  The lightweight surface accepts free-form text, so
// apply a second, local pass for quoted/JSON-like values before anything is
// handed to the compiler.  This keeps sensitive prompt material out of typed
// blocks and the ephemeral result even when the user includes spaces or
// surrounding quotes in a credential value.
const LIGHTWEIGHT_SECRET_PATTERNS = [
  /\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}&]+)/giu,
  /\bBearer\s+[^\s,;}&]+/giu,
] as const;

function redactLightweightInstruction(instruction: string): string {
  let value = redactSingleTurnInstruction(instruction);
  for (const pattern of LIGHTWEIGHT_SECRET_PATTERNS) value = value.replace(pattern, "[REDACTED]");
  return value;
}

export interface LightweightAgentAdapter {
  submit(instruction: string): Promise<LightweightAgentViewModel>;
}

/**
 * A deliberately small in-memory failure adapter. Capability/bootstrap errors
 * are rendered as an unavailable state instead of being mistaken for an
 * unsupported user request. It has no Bridge, Provider, or run side effects.
 */
function unavailableAdapter(input: {
  context: PageContextEnvelope;
  code: string;
  capability?: Phase1CapabilityProjection | null;
}): LightweightAgentAdapter {
  const result: LightweightAgentViewModel = {
    status: "unavailable",
    summary: "当前 Agent 能力目录不可用，未生成草案。",
    blocks: [formalErrorBlock(input.code, "当前 Agent 能力目录不可用，未执行本次请求。")],
    fields: [],
    missing: [],
    limitations: [...LIGHTWEIGHT_LIMITATIONS],
    context: input.context,
    capability: input.capability ?? null,
  };
  return {
    async submit() {
      return result;
    },
  };
}

export async function createLightweightAgentAdapterFromManifest(input: {
  manifest: ApiManifestResponse;
  context: PageContextEnvelope;
  locale?: "zh-CN" | "en-US";
}): Promise<LightweightAgentAdapter> {
  try {
    const snapshot = await getAgentOrchestrationCapabilitySnapshot(input.manifest);
    const capability = buildPhase1CapabilityProjection(snapshot);
    return createLightweightAgentAdapter({ context: input.context, capability, locale: input.locale });
  } catch (error) {
    // Do not expose Bridge error text (which may contain request details) to
    // the lightweight surface. The public capability index is fail-closed.
    const code =
      error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : "agent_capability_unavailable";
    return unavailableAdapter({ context: input.context, code });
  }
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
    catalog_revision: field.catalog_revision,
    capability_snapshot_revision: field.capability_snapshot_revision,
    context_revision: field.context_revision,
  }));
}

export function createLightweightAgentAdapter(input: {
  context: PageContextEnvelope;
  capability: Phase1CapabilityProjection;
  currentValues?: Readonly<Record<string, import("../../../entities/agent-orchestration").DraftFieldValue | null>>;
  locale?: "zh-CN" | "en-US";
}): LightweightAgentAdapter {
  const capabilityUsable =
    input.capability.target_request_identity === "tilesim.bridge.create_run_request.v1" &&
    input.capability.fields.length === 8 &&
    input.capability.fields.every((field) => ["available", "conditional"].includes(field.capability_state));
  if (!capabilityUsable) {
    return unavailableAdapter({
      context: input.context,
      capability: input.capability,
      code: "capability_projection_unavailable",
    });
  }

  // Fingerprints provide repeat-submit idempotency without retaining the
  // complete (possibly sensitive) instruction in adapter state.
  let lastFingerprint: string | null = null;
  let lastResult: LightweightAgentViewModel | null = null;
  const fingerprint = (value: string): string => {
    let hash = 2166136261;
    for (const character of value) {
      hash ^= character.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 16777619);
    }
    return `${hash >>> 0}:${value.length}`;
  };

  return {
    async submit(instruction: string) {
      const redactedInstruction = redactLightweightInstruction(instruction);
      const key = fingerprint(redactedInstruction);
      if (lastFingerprint === key && lastResult) return lastResult;
      let output: ReturnType<typeof compileIntent>;
      try {
        // The phase-1 compiler accepts bounded integer descriptors. A
        // published uint64 descriptor is losslessly represented as an
        // integer for parsing; values remain decimal strings throughout the
        // typed draft and are never coerced to JavaScript Number.
        const compilerCapability = {
          ...input.capability,
          fields: input.capability.fields.map((field) =>
            (field as { value_type: string }).value_type === "uint64"
              ? {
                  ...field,
                  value_type: "integer" as const,
                  integer_only: true,
                  // uint64 is bounded by its lossless wire type, not by the
                  // fixture's small integer demonstration maximum.
                  maximum: "18446744073709551615",
                }
              : field,
          ),
        };
        output = compileIntent({
          contract_revision: "tilesim.web.agent_orchestration.phase1.local.v1",
          instruction: redactedInstruction,
          locale: input.locale || "zh-CN",
          capability: compilerCapability,
          current_values: input.currentValues || {},
          context: input.context,
        });
      } catch {
        const result: LightweightAgentViewModel = {
          status: "error",
          summary: "Agent 处理失败，未生成草案。",
          blocks: [formalErrorBlock("compiler_error", "Agent 处理失败，未执行任何写入操作。")],
          fields: [],
          missing: [],
          limitations: [...LIGHTWEIGHT_LIMITATIONS],
          context: input.context,
          capability: input.capability,
        };
        lastFingerprint = key;
        lastResult = result;
        return result;
      }
      const blocks = intentOutputToTypedBlocks(output);
      const draft = blocks.find((block) => block.block_type === "draft_summary");
      const validation = blocks.find((block) => block.block_type === "validation_result");
      const unsupported = blocks.find((block) => block.block_type === "unsupported");
      const clarification = blocks.find((block) => block.block_type === "clarification");
      const clarificationReasonCodes =
        clarification?.block_type === "clarification"
          ? clarification.questions.map((question) => question.reason_code)
          : [];
      const status =
        output.kind === "draft"
          ? output.draft.stale.state === "stale"
            ? "stale"
            : output.draft.validation.overall === "unknown"
              ? "unknown"
              : output.draft.validation.overall === "invalid"
                ? "validation_error"
                : "draft"
          : output.kind === "clarification"
            ? clarificationReasonCodes.some((reason) => reason.includes("missing"))
              ? "missing"
              : "clarification_required"
            : output.kind === "unsupported"
              ? output.result.reason_code.includes("stale")
                ? "stale"
                : output.result.reason_code.includes("unavailable") ||
                    output.result.reason_code.includes("not_available") ||
                    output.result.reason_code.includes("page_context")
                  ? "unavailable"
                  : output.result.reason_code === "unknown_field" || output.result.reason_code.includes("unknown")
                    ? "unknown"
                    : output.result.reason_code.includes("compiler_input") ||
                        output.result.reason_code.includes("invalid")
                      ? "error"
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
      const result: LightweightAgentViewModel = {
        status,
        summary,
        blocks,
        fields: fieldsFromBlocks(blocks),
        missing: clarification?.block_type === "clarification" ? clarification.questions.map((q) => q.prompt) : [],
        limitations: [...LIGHTWEIGHT_LIMITATIONS],
        context: input.context,
        capability: input.capability,
      };
      lastFingerprint = key;
      lastResult = result;
      return result;
    },
  };
}
