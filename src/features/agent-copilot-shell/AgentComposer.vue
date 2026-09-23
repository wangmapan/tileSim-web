<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

/**
 * One box, one behaviour: the sentence is read as a scenario description, an
 * explicit `参数 = 值`, or a question, and the panel decides what that means.
 * The old "仅询问 / 提出草案修改 / 直接改参数" switch is gone on purpose — a user
 * should not have to know which internal path answers their sentence.
 *
 * While the assistant model is answering, the box stays editable (the next
 * sentence can be typed) but the send action becomes 停止, so a long answer is
 * never something the user has to sit through.
 */
const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    disabledReason?: string;
    /** True while a streamed answer is still arriving. */
    busy?: boolean;
  }>(),
  { disabled: false, disabledReason: "", busy: false },
);

const emit = defineEmits<{ submit: [payload: { instruction: string }]; cancel: [] }>();

const instruction = ref("");
const composing = ref(false);
const textarea = ref<HTMLTextAreaElement | null>(null);
const maxLength = 4000;
const canSubmit = computed(
  () => !props.disabled && !props.busy && instruction.value.trim().length > 0 && instruction.value.length <= maxLength,
);

function submit(): void {
  if (!canSubmit.value || composing.value) return;
  emit("submit", { instruction: instruction.value.trim() });
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
    <label class="agent-composer__field">
      <span class="agent-composer__label">描述你想理解或调整的内容</span>
      <textarea
        ref="textarea"
        v-model="instruction"
        rows="3"
        :maxlength="maxLength"
        :disabled="disabled"
        placeholder="描述你要跑的场景，例如：低延迟在线服务；也可以直接写「最大 batch = 32」"
        @compositionstart="composing = true"
        @compositionend="composing = false"
        @keydown="onKeydown"
      ></textarea>
    </label>
    <div class="agent-composer__footer">
      <p aria-live="polite">
        {{
          disabled
            ? disabledReason
            : busy
              ? "模型正在回答；可以直接停止，也可以先写下一句"
              : "Enter 提交 · 描述场景会先给一份推荐方案，确认后才写入面板"
        }}
      </p>
      <button v-if="busy" type="button" class="agent-composer__stop" @click="emit('cancel')">停止</button>
      <button v-else type="submit" :disabled="!canSubmit">提交</button>
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

/* 停止 is a secondary action: it must not read as the primary 提交 button. */
.agent-composer .agent-composer__stop {
  border-color: var(--line-strong);
  color: var(--ink);
  background: var(--panel);
}

@media (max-width: 560px) {
  .agent-composer__footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
