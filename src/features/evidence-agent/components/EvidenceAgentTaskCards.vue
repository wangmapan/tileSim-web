<script setup lang="ts">
import type { EvidenceAgentRequest } from "../../../contracts/generated/bridge-contracts";
import { useI18n } from "../../../i18n";

type TaskKind = EvidenceAgentRequest["task_kind"];

defineProps<{
  supportedTaskKinds: TaskKind[];
  modelValue: TaskKind;
  disabled: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [taskKind: TaskKind] }>();
const { isEnglish } = useI18n();

const labels: Record<TaskKind, { zh: string; en: string }> = {
  explain_p99: {
    zh: "看懂 P99 请求",
    en: "Understand the P99 request",
  },
  explain_tail: {
    zh: "看懂尾延迟",
    en: "Understand tail latency",
  },
  summarize_validation: {
    zh: "判断结果可信度",
    en: "Assess result confidence",
  },
  draft_conditional_recommendations: {
    zh: "寻找下一步优化方向",
    en: "Find next optimization steps",
  },
};

function label(kind: TaskKind) {
  return labels[kind][isEnglish.value ? "en" : "zh"];
}
</script>

<template>
  <fieldset class="evidence-agent-task-picker" :disabled="disabled">
    <legend>{{ isEnglish ? "2. Choose what you want to learn" : "2. 选择你想了解的内容" }}</legend>
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
          <strong>{{ label(kind) }}</strong>
        </span>
      </label>
    </div>
  </fieldset>
</template>
