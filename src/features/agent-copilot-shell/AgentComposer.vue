<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    disabledReason?: string;
    allowDraft?: boolean;
  }>(),
  { disabled: false, disabledReason: "", allowDraft: false },
);

const emit = defineEmits<{
  submit: [payload: { instruction: string; purpose: "explain" | "draft" }];
}>();

const instruction = ref("");
const purpose = ref<"explain" | "draft">("explain");
const composing = ref(false);
const textarea = ref<HTMLTextAreaElement | null>(null);
const maxLength = 4000;
const canSubmit = computed(
  () =>
    !props.disabled &&
    instruction.value.trim().length > 0 &&
    instruction.value.length <= maxLength &&
    (purpose.value !== "draft" || props.allowDraft),
);

watch(
  () => props.allowDraft,
  (allowed) => {
    if (!allowed && purpose.value === "draft") purpose.value = "explain";
  },
);

function submit(): void {
  if (!canSubmit.value || composing.value) return;
  emit("submit", { instruction: instruction.value.trim(), purpose: purpose.value });
  instruction.value = "";
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing || composing.value) return;
  event.preventDefault();
  submit();
}

async function focus(): Promise<void> {
  await nextTick();
  textarea.value?.focus();
}

defineExpose({ focus, value: instruction });
</script>

<template>
  <form class="agent-composer" aria-label="助手输入" @submit.prevent="submit">
    <div class="agent-composer__mode" aria-label="提问方式">
      <label>
        <input v-model="purpose" type="radio" value="explain" />
        <span>仅询问</span>
      </label>
      <label v-if="allowDraft">
        <input v-model="purpose" type="radio" value="draft" />
        <span>提出草案修改</span>
      </label>
    </div>
    <label class="agent-composer__field">
      <span class="agent-composer__label">描述你想理解或调整的内容</span>
      <textarea
        ref="textarea"
        v-model="instruction"
        rows="3"
        :maxlength="maxLength"
        :disabled="disabled"
        placeholder="例如：把最大 batch 调整为 8，并说明影响范围"
        @compositionstart="composing = true"
        @compositionend="composing = false"
        @keydown="onKeydown"
      ></textarea>
    </label>
    <div class="agent-composer__footer">
      <p aria-live="polite">{{ disabled ? disabledReason : "Enter 提交，Shift+Enter 换行" }}</p>
      <button type="submit" :disabled="!canSubmit">提交</button>
    </div>
  </form>
</template>

<style scoped>
.agent-composer {
  display: grid;
  gap: 8px;
  padding: 12px 14px 14px;
  border-top: 1px solid var(--line);
  background: var(--panel);
}

.agent-composer__mode {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--ink-soft);
  font-size: var(--text-xs);
}

.agent-composer__mode label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

.agent-composer__field {
  display: grid;
  gap: 5px;
}

.agent-composer__label {
  color: var(--muted);
  font-size: var(--text-xs);
}

.agent-composer textarea {
  width: 100%;
  min-height: 76px;
  max-height: 180px;
  resize: vertical;
  padding: 9px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--control-bg);
  line-height: 1.5;
}

.agent-composer textarea:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.agent-composer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.agent-composer__footer p {
  min-width: 0;
  margin: 0;
  color: var(--muted);
  font-size: var(--text-micro);
  line-height: 1.4;
}

.agent-composer button {
  min-height: 34px;
  padding: 6px 13px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-control);
  color: #fff;
  background: var(--accent);
  cursor: pointer;
  font-weight: 600;
}

.agent-composer button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

@media (max-width: 560px) {
  .agent-composer__footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
