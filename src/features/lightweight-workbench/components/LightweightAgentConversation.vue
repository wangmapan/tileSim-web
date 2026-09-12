<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { Send, ShieldAlert } from "@lucide/vue";
import type { LightweightAgentAdapter } from "../adapters/agent-adapter";
import type { LightweightAgentViewModel } from "../model";

const props = defineProps<{ adapter: LightweightAgentAdapter | null; initialPrompt?: string }>();
const result = defineModel<LightweightAgentViewModel | null>({ default: null });
const promptModel = defineModel<string>("prompt", { default: "" });
const prompt = computed({
  get: () => promptModel.value || props.initialPrompt || "",
  set: (value: string) => (promptModel.value = value),
});
const busy = ref(false);
const textbox = ref<HTMLTextAreaElement | null>(null);
const statusText = computed(() => {
  if (busy.value) return "正在使用当前 Agent 整理草案…";
  if (!result.value) return "输入目标后，Agent 会先说明它理解了什么。";
  if (result.value.status === "clarification_required") return "还需要确认一项信息。";
  if (result.value.status === "unsupported" || result.value.status === "unknown") return "这项能力当前不可用。";
  if (result.value.status === "validation_error") return "草案需要修正。";
  return result.value.summary;
});
async function submit() {
  if (!props.adapter || !prompt.value.trim() || busy.value) return;
  busy.value = true;
  try {
    result.value = await props.adapter.submit(prompt.value);
  } finally {
    busy.value = false;
    await nextTick();
    textbox.value?.focus();
  }
}
</script>

<template>
  <section class="lightweight-conversation" aria-labelledby="lightweight-conversation-title">
    <div class="lightweight-conversation__heading">
      <div>
        <p class="section-kicker">第二步</p>
        <h2 id="lightweight-conversation-title">用普通语言告诉 Agent</h2>
      </div>
      <span class="lightweight-agent-badge">同一个 TileSim Agent</span>
    </div>
    <label class="sr-only" for="lightweight-prompt">描述你想完成的事情</label>
    <textarea
      id="lightweight-prompt"
      ref="textbox"
      v-model="prompt"
      rows="3"
      placeholder="例如：把最大 batch 调整为 8，并把横向扩展带宽改成 100 Gbps"
      @keydown.ctrl.enter="submit"
      @keydown.meta.enter="submit"
    ></textarea>
    <div class="lightweight-conversation__actions">
      <span role="status" aria-live="polite">{{ statusText }}</span
      ><button
        class="button button--primary"
        type="button"
        :disabled="!adapter || !prompt.trim() || busy"
        @click="submit"
      >
        <Send :size="16" aria-hidden="true" />提交
      </button>
    </div>
    <p class="lightweight-conversation__hint">Enter 不会意外提交中文输入法；使用 Ctrl/⌘ + Enter 或提交按钮。</p>
    <div v-if="!adapter" class="lightweight-inline-error" role="alert">
      <ShieldAlert :size="18" aria-hidden="true" /><span>当前 Agent 能力目录不可用，请确认本地 Bridge 后重试。</span>
    </div>
  </section>
</template>

<style scoped>
.lightweight-conversation {
  display: grid;
  gap: 12px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--panel);
}
.lightweight-conversation__heading,
.lightweight-conversation__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.lightweight-conversation h2 {
  margin: 0;
  font-size: 20px;
}
.lightweight-agent-badge {
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: var(--text-xs);
}
textarea {
  width: 100%;
  resize: vertical;
  padding: 12px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--ink);
  background: var(--control-bg);
}
.lightweight-conversation__actions span {
  color: var(--muted);
  font-size: var(--text-sm);
}
.lightweight-conversation__hint {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-xs);
}
.lightweight-inline-error {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--danger);
  border-radius: var(--radius-control);
  color: var(--danger-ink);
  background: var(--danger-soft);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 560px) {
  .lightweight-conversation__heading,
  .lightweight-conversation__actions {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
