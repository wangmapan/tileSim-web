<script setup lang="ts">
import { computed } from "vue";
import type { AgentContextAttachmentStatus, PageContextEnvelope } from "../../entities/agent-context";

const props = defineProps<{
  context: PageContextEnvelope | null;
  attachmentStatus: AgentContextAttachmentStatus;
}>();

const availabilityLabel = computed(() => {
  if (!props.context) return "未附加页面上下文";
  if (props.attachmentStatus.state === "stale" || props.context.availability === "stale") return "上下文已变化";
  if (props.context.availability === "unavailable") return "上下文不可用";
  return "上下文可用";
});

const selectedLabel = computed(() => {
  const selected = props.context?.selected_entity;
  if (!selected) return "未选择对象";
  const resource = props.context?.resources.find(
    (entry) => entry.resource_type === selected.entity_type && entry.resource_id === selected.entity_id,
  );
  return resource?.display_label || selected.entity_id;
});
</script>

<template>
  <section class="agent-context-bar" aria-label="当前页面上下文">
    <div class="agent-context-bar__summary">
      <div>
        <span class="agent-context-bar__eyebrow">当前上下文</span>
        <strong>{{ context?.display_label || "尚未连接页面" }}</strong>
        <span>{{ selectedLabel }}</span>
      </div>
      <span
        class="agent-context-bar__availability"
        :data-state="attachmentStatus.state === 'stale' ? 'stale' : context?.availability || 'unavailable'"
      >
        {{ availabilityLabel }}
      </span>
    </div>

    <p v-if="attachmentStatus.state === 'stale'" class="agent-context-bar__stale" role="status" aria-live="polite">
      页面或选择已更新；现有内容仍按原上下文保留。重新提交后才会使用当前上下文。
    </p>

    <details v-if="context" class="agent-context-bar__details">
      <summary>上下文详情</summary>
      <dl>
        <div>
          <dt>页面</dt>
          <dd>{{ context.page_id }}</dd>
        </div>
        <div>
          <dt>路由</dt>
          <dd>{{ context.route_name }}</dd>
        </div>
        <div>
          <dt>context revision</dt>
          <dd>{{ context.context_revision }}</dd>
        </div>
        <div v-if="context.run_ref">
          <dt>run</dt>
          <dd>{{ context.run_ref.run_id }}</dd>
        </div>
        <div>
          <dt>可用引用</dt>
          <dd>{{ context.resources.length }}</dd>
        </div>
      </dl>
    </details>
  </section>
</template>

<style scoped>
.agent-context-bar {
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-subtle);
  color: var(--ink);
}

.agent-context-bar__summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.agent-context-bar__summary > div {
  display: grid;
  min-width: 0;
}

.agent-context-bar__eyebrow,
.agent-context-bar__summary > div > span:last-child {
  color: var(--muted);
  font-size: var(--text-micro);
}

.agent-context-bar__summary strong,
.agent-context-bar__summary > div > span:last-child,
.agent-context-bar__details dd {
  overflow-wrap: anywhere;
}

.agent-context-bar__availability {
  flex: none;
  padding: 2px 7px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--neutral-ink);
  font-size: var(--text-micro);
  white-space: nowrap;
}

.agent-context-bar__availability[data-state="available"] {
  border-color: color-mix(in srgb, var(--positive) 45%, var(--line));
  color: var(--positive-ink);
}

.agent-context-bar__availability[data-state="stale"] {
  border-color: color-mix(in srgb, var(--warning) 45%, var(--line));
  color: var(--warning-ink);
}

.agent-context-bar__stale {
  margin: 8px 0 0;
  color: var(--warning-ink);
  font-size: var(--text-xs);
  line-height: 1.45;
}

.agent-context-bar__details {
  margin-top: 7px;
  color: var(--muted);
  font-size: var(--text-micro);
}

.agent-context-bar__details summary {
  width: max-content;
  cursor: pointer;
}

.agent-context-bar__details dl {
  display: grid;
  gap: 4px;
  margin: 8px 0 0;
}

.agent-context-bar__details dl > div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 8px;
}

.agent-context-bar__details dt {
  color: var(--muted);
}

.agent-context-bar__details dd {
  min-width: 0;
  margin: 0;
  color: var(--ink-soft);
  font-family: var(--font-mono);
}
</style>
