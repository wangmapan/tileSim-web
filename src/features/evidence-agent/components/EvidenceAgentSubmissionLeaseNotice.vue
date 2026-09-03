<script setup lang="ts">
import { CircleSlash2 } from "@lucide/vue";
import type { EvidenceAgentUiState, RetainedEvidenceAgentSubmission } from "../../../entities/evidence-agent";
import { useI18n } from "../../../i18n";

defineProps<{
  pending: RetainedEvidenceAgentSubmission;
  agentState: EvidenceAgentUiState;
  mustDiscardBeforeSubmit: boolean;
}>();
const emit = defineEmits<{ discard: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="evidence-agent-pending" role="status">
    <code>{{ pending.idempotencyKey }}</code>
    <span v-if="agentState === 'terminal_result_not_retained'">
      {{
        t(
          "Bridge 重启后未保留先前 claims 终态；原 Idempotency-Key 已锁定，前端不会换 key、重调 Provider 或标记为已恢复。",
        )
      }}
    </span>
    <span v-else-if="agentState === 'idempotency_payload_mismatch'">
      {{
        t(
          "Bridge 已拒绝同一 Idempotency-Key 下的不同 canonical payload；原 key 保持锁定，不会自动重试或调用 Provider。",
        )
      }}
    </span>
    <span v-else-if="agentState === 'stale'">
      {{
        t(
          "当前 run、backend、schema revision 或 snapshot digest 已变化；旧 Idempotency-Key 保持锁定，需显式放弃后才能开始新分析。",
        )
      }}
    </span>
    <span v-else-if="mustDiscardBeforeSubmit">
      {{
        t(
          "当前表单不是旧 Idempotency-Key 对应的完整 canonical payload；这通常发生在刷新页面或编辑问题后。前端已阻止冲突提交，请先显式放弃旧分析。",
        )
      }}
    </span>
    <span v-else>{{ t("仅同一 canonical payload 可复用该 Idempotency-Key。") }}</span>
    <button class="button button--secondary" :disabled="agentState === 'submitting'" @click="emit('discard')">
      {{
        agentState === "terminal_result_not_retained"
          ? t("明确放弃该终态并开始新分析")
          : agentState === "idempotency_payload_mismatch"
            ? t("明确放弃旧分析并开始新分析")
            : agentState === "stale"
              ? t("明确放弃当前分析并开始新分析")
              : mustDiscardBeforeSubmit
                ? t("放弃旧分析并开始新问题")
                : t("明确放弃当前分析并开始新分析")
      }}
    </button>
  </div>
  <div v-if="agentState === 'idempotency_payload_mismatch'" class="evidence-agent-unavailable" role="alert">
    <CircleSlash2 :size="20" />
    <div>
      <strong>{{ t("幂等键已绑定到不同载荷") }}</strong>
      <p>{{ t("当前请求不会以该 key 重试，也不会自动换 key 调用 Provider；只有显式放弃后才能创建新的分析请求。") }}</p>
      <code>idempotency_payload_mismatch</code>
    </div>
  </div>
  <div v-if="agentState === 'terminal_result_not_retained'" class="evidence-agent-unavailable" role="alert">
    <CircleSlash2 :size="20" />
    <div>
      <strong>{{ t("无法恢复先前的 claims 终态") }}</strong>
      <p>
        {{
          t(
            "当前 metadata-only 留存无法跨 Bridge 进程重放完整模型结果。不会自动调用 Provider；只有显式放弃后才能创建新的分析请求。",
          )
        }}
      </p>
      <code>terminal_result_not_retained</code>
    </div>
  </div>
</template>
