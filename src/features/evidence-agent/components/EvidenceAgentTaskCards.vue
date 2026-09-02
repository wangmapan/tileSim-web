<script setup lang="ts">
import type { EvidenceAgentRequest } from "../../../contracts/generated/bridge-contracts";
import { useI18n } from "../../../i18n";
import { evidenceAgentTaskLabels } from "../presentation";

type TaskKind = EvidenceAgentRequest["task_kind"];

defineProps<{
  supportedTaskKinds: TaskKind[];
  modelValue: TaskKind;
  disabled: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [taskKind: TaskKind] }>();
const { isEnglish, t } = useI18n();

const descriptions: Record<TaskKind, { zh: string; en: string }> = {
  explain_p99: {
    zh: "解释后端已报告的 P99 请求和证据边界，不自行选择新的 P99。",
    en: "Explain the backend-reported P99 request and its evidence boundary without selecting a new P99.",
  },
  explain_tail: {
    zh: "解释已报告的尾延迟证据，不创建新的因果排序。",
    en: "Explain reported tail-latency evidence without creating a new causal ranking.",
  },
  summarize_validation: {
    zh: "总结验证、来源和 fidelity 限制，不把 S8 当作延迟原因。",
    en: "Summarize validation, provenance, and fidelity limits without treating S8 as a latency cause.",
  },
  draft_conditional_recommendations: {
    zh: "只基于引用事实起草条件建议，不声称未执行的改进结果。",
    en: "Draft conditional suggestions from cited facts without claiming an unexecuted improvement.",
  },
};

function description(kind: TaskKind) {
  return descriptions[kind][isEnglish.value ? "en" : "zh"];
}
</script>

<template>
  <fieldset class="evidence-agent-task-picker" :disabled="disabled">
    <legend>{{ t("任务类型") }}</legend>
    <div class="evidence-agent-task-cards">
      <label v-for="kind in supportedTaskKinds" :key="kind" :data-selected="modelValue === kind">
        <input
          type="radio"
          name="evidence-agent-task-kind"
          :value="kind"
          :checked="modelValue === kind"
          @change="emit('update:modelValue', kind)"
        />
        <span>
          <strong>{{ t(evidenceAgentTaskLabels[kind]) }}</strong>
          <small>{{ description(kind) }}</small>
          <details>
            <summary>{{ t("专业详情") }}</summary>
            <code>{{ kind }}</code>
          </details>
        </span>
      </label>
    </div>
  </fieldset>
</template>
