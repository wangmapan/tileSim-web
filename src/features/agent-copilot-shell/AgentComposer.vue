<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

/**
 * One box, one behaviour: the sentence is handed to the configured assistant
 * model, which decides whether it is a scenario description, an explicit
 * `参数 = 值`, or a question. The browser does not infer a plan from keywords.
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
      <span class="agent-composer__label">直接告诉我你想做什么</span>
      <textarea
        ref="textarea"
        v-model="instruction"
        rows="3"
        :maxlength="maxLength"
        :disabled="disabled"
        placeholder="例如：帮我准备一个低延迟场景，或把最大 batch 调整为 32"
        @compositionstart="composing = true"
        @compositionend="composing = false"
        @keydown="onKeydown"
      ></textarea>
    </label>
    <div class="agent-composer__footer">
      <p>
        {{
          disabled
            ? disabledReason
            : busy
              ? "正在回答；可以停止，也可以先写下一个问题"
              : "Enter 提交 · 助手会先给出建议，需要时再请你确认"
        }}
      </p>
      <button v-if="busy" type="button" class="agent-composer__stop" @click="emit('cancel')">停止</button>
      <button v-else type="submit" :disabled="!canSubmit">提交</button>
    </div>
  </form>
</template>

<style scoped>
.agent-composer {
  position: relative;
  display: grid;
  gap: 8px;
  padding: 12px 14px 13px;
  border-top: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel) 88%, var(--surface-muted));
  box-shadow: 0 -8px 24px -22px color-mix(in srgb, var(--ink) 68%, transparent);
}

.agent-composer::before {
  position: absolute;
  top: -1px;
  left: 14px;
  width: 42px;
  height: 3px;
  border-radius: 0 0 999px 999px;
  background: var(--accent);
  content: "";
}

.agent-composer__field {
  display: grid;
  gap: 5px;
}

.agent-composer__label {
  color: var(--accent-ink);
  font-size: var(--text-xs);
  font-weight: 700;
}

.agent-composer textarea {
  width: 100%;
  min-height: 82px;
  max-height: 180px;
  resize: vertical;
  padding: 11px 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--line-strong));
  border-radius: 9px;
  color: var(--ink);
  background: var(--control-bg);
  line-height: 1.5;
  box-shadow: inset 0 1px 2px rgb(18 29 39 / 4%);
  transition:
    border-color var(--motion-interaction) var(--ease-standard),
    box-shadow var(--motion-interaction) var(--ease-standard),
    background-color var(--motion-interaction) var(--ease-standard);
}

.agent-composer textarea:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow:
    var(--ring),
    inset 0 1px 2px rgb(18 29 39 / 4%);
  transform: translateY(-1px);
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
  min-height: 36px;
  padding: 6px 15px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  color: #fff;
  background: var(--accent);
  cursor: pointer;
  font-weight: 600;
  box-shadow: 0 4px 12px -8px color-mix(in srgb, var(--accent) 82%, transparent);
  transition:
    background-color var(--motion-interaction) var(--ease-standard),
    border-color var(--motion-interaction) var(--ease-standard),
    transform var(--motion-interaction) var(--ease-emphasized),
    box-shadow var(--motion-interaction) var(--ease-standard);
}

.agent-composer button:not(:disabled):hover {
  border-color: var(--accent-hover);
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 7px 16px -9px color-mix(in srgb, var(--accent) 84%, transparent);
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

.agent-composer .agent-composer__stop:not(:disabled):hover {
  color: var(--danger-ink);
  border-color: color-mix(in srgb, var(--danger) 40%, var(--line));
  background: var(--danger-soft);
}

@media (max-width: 560px) {
  .agent-composer__footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
