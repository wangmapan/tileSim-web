<script setup lang="ts">
import { computed } from "vue";
import type { AgentHarnessOperationProjection } from "../../../lib/api/agent-harness";
import { agentHarnessAvailabilityLabel, agentHarnessStateLabel } from "../presentation";

const props = defineProps<{ projection: AgentHarnessOperationProjection; title?: string }>();
const stateLabel = computed(() =>
  props.projection.state ? agentHarnessStateLabel(props.projection.state) : "尚未开始",
);
const currentNode = computed(() => {
  const events = props.projection.events;
  return events.length ? events[events.length - 1].node : "—";
});
const attemptCount = computed(() => props.projection.operation?.attempt_count ?? 0);
const availability = computed(() => {
  if (props.projection.stale_reason) return "rejected" as const;
  if (props.projection.requires_recovery) return "failed" as const;
  if (props.projection.terminal && props.projection.state === "completed") return "completed" as const;
  if (props.projection.terminal && props.projection.state === "cancelled") return "cancelled" as const;
  return "available" as const;
});
</script>

<template>
  <article class="agent-harness-operation-card" data-source="bridge-v1" :data-availability="availability">
    <header>
      <div>
        <p class="agent-harness-eyebrow">{{ title || "Agent Harness 只读任务" }}</p>
        <h3>{{ stateLabel }}</h3>
      </div>
      <span class="agent-harness-status" role="status">{{ agentHarnessAvailabilityLabel(availability) }}</span>
    </header>
    <p class="agent-harness-notice">正式 v1 只读观察；不会创建运行、修改实验或开放写工具。</p>
    <dl>
      <div>
        <dt>operation</dt>
        <dd>
          <code>{{ projection.operation?.operation_id || "—" }}</code>
        </dd>
      </div>
      <div>
        <dt>turn</dt>
        <dd>
          <code>{{ projection.operation?.turn_id || "—" }}</code>
        </dd>
      </div>
      <div>
        <dt>run</dt>
        <dd>
          <code>{{ projection.operation?.run_id || "未绑定" }}</code>
        </dd>
      </div>
      <div>
        <dt>node</dt>
        <dd>
          <code>{{ currentNode }}</code>
        </dd>
      </div>
      <div>
        <dt>attempts</dt>
        <dd>{{ attemptCount }}</dd>
      </div>
      <div>
        <dt>事件</dt>
        <dd>{{ projection.events.length }} 个，已读到 sequence {{ projection.last_event_sequence }}</dd>
      </div>
    </dl>
    <p v-if="projection.stale_reason" class="agent-harness-error" role="alert">
      <strong>stale</strong><span>{{ projection.stale_reason }}；需要重新读取当前 operation。</span>
    </p>
    <p v-else-if="projection.requires_recovery" class="agent-harness-error" role="alert">
      <strong>recovery_required</strong><span>事件顺序或结果不完整，不能自动重试。</span>
    </p>
    <p v-else-if="projection.error" class="agent-harness-error" role="alert">
      <strong>{{ projection.error.code }}</strong
      ><span>{{ projection.error.message }}</span>
    </p>
    <section v-if="projection.events.length" class="agent-harness-event-log" aria-label="工作流事件">
      <h4>工作流事件</h4>
      <ol>
        <li v-for="event in projection.events" :key="event.event_id">
          <span>#{{ event.sequence }}</span>
          <code>{{ event.node }}</code>
          <span>{{ agentHarnessStateLabel(event.workflow_state) }}</span>
          <time :datetime="event.created_at">{{ event.created_at }}</time>
          <span v-if="event.terminal">终态</span>
        </li>
      </ol>
    </section>
  </article>
</template>

<style scoped>
.agent-harness-operation-card {
  display: grid;
  gap: 0.65rem;
  margin: 0.65rem 0;
  padding: 0.85rem;
  border: 1px solid var(--line-strong, #ccd5dc);
  border-radius: 0.7rem;
  background: var(--panel, #fff);
}
.agent-harness-operation-card header,
.agent-harness-operation-card dl > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}
.agent-harness-operation-card h3 {
  margin: 0;
  font-size: 0.95rem;
}
.agent-harness-operation-card p {
  margin: 0;
  font-size: 0.78rem;
}
.agent-harness-operation-card dl {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  font-size: 0.75rem;
}
.agent-harness-operation-card dt {
  color: var(--muted, #687783);
}
.agent-harness-operation-card dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}
.agent-harness-operation-card code {
  overflow-wrap: anywhere;
}
.agent-harness-operation-card .agent-harness-error {
  display: grid;
  gap: 0.2rem;
  color: var(--danger, #a33131);
}
.agent-harness-event-log {
  display: grid;
  gap: 0.35rem;
}
.agent-harness-event-log h4 {
  margin: 0;
  font-size: 0.78rem;
}
.agent-harness-event-log ol {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.72rem;
}
.agent-harness-event-log li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr) auto;
  gap: 0.35rem;
  align-items: baseline;
  min-width: 0;
}
.agent-harness-event-log time {
  overflow-wrap: anywhere;
  color: var(--muted, #687783);
}
@media (max-width: 1024px) {
  .agent-harness-event-log li {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .agent-harness-event-log time {
    grid-column: 2 / -1;
  }
}
</style>
