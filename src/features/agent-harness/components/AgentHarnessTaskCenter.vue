<script setup lang="ts">
import { computed } from "vue";
import AgentHarnessOperationCard from "./AgentHarnessOperationCard.vue";
import AgentHarnessToolTimeline from "./AgentHarnessToolTimeline.vue";
import AgentHarnessDraftCard from "./AgentHarnessDraftCard.vue";
import AgentHarnessValidationBlock from "./AgentHarnessValidationBlock.vue";
import AgentHarnessApprovalBlock from "./AgentHarnessApprovalBlock.vue";
import AgentHarnessExecutionCard from "./AgentHarnessExecutionCard.vue";
import type { AgentHarnessDraftTaskCenterItem, AgentHarnessTaskCenterItem } from "../task-center";
import type { AgentHarnessExecutionTaskCenterItem } from "../task-center";
import { agentHarnessAvailabilityLabel } from "../presentation";

const props = withDefaults(
  defineProps<{
    items?: readonly AgentHarnessTaskCenterItem[];
    drafts?: readonly AgentHarnessDraftTaskCenterItem[];
    executions?: readonly AgentHarnessExecutionTaskCenterItem[];
  }>(),
  {
    items: () => [],
    drafts: () => [],
    executions: () => [],
  },
);

const emit = defineEmits<{
  cancel: [operationId: string];
  retry: [operationId: string];
  resume: [operationId: string];
}>();
const countLabel = computed(
  () => `${props.items.length} 个观察任务 · ${props.executions.length} 个执行 · ${props.drafts.length} 个草案`,
);
</script>

<template>
  <section class="agent-harness-task-center" aria-label="Agent Harness 任务中心" data-source="bridge-v1">
    <header class="agent-harness-task-center__header">
      <div>
        <p class="agent-harness-eyebrow">Agent Harness</p>
        <h3>任务中心</h3>
      </div>
      <span role="status">{{ countLabel }}</span>
    </header>
    <p class="agent-harness-task-center__notice">
      任务状态、事件和控制动作均来自正式 Bridge WPC；浏览器不维护 operation store。执行结果仅属于 local-dev synthetic
      exploratory，不代表生产验收。
    </p>
    <p v-if="!items.length && !drafts.length && !executions.length" class="agent-harness-task-center__empty">
      当前没有可显示的 operation 或草案。
    </p>
    <ol v-if="items.length" class="agent-harness-task-center__list">
      <li v-for="item in items" :key="item.id" class="agent-harness-task-center__item">
        <header>
          <h4>{{ item.title }}</h4>
          <span class="agent-harness-task-center__availability" :data-availability="item.availability">
            {{ agentHarnessAvailabilityLabel(item.availability) }}
          </span>
        </header>
        <p v-if="item.unavailableReason" class="agent-harness-task-center__reason" role="status">
          {{ item.unavailableReason }}
        </p>
        <AgentHarnessOperationCard v-if="item.projection" :projection="item.projection" />
        <p v-else class="agent-harness-task-center__reason" role="status">
          尚未读取 operation snapshot；不会用本地状态补造任务进度。
        </p>
        <AgentHarnessToolTimeline :items="item.toolTimeline" />
        <dl class="agent-harness-task-center__controls" aria-label="任务控制能力">
          <div>
            <dt>取消</dt>
            <dd>{{ item.cancel === "not_exposed" ? "未暴露" : "不可用" }}</dd>
          </div>
          <div>
            <dt>审批写入</dt>
            <dd>{{ item.approval === "not_exposed" ? "未暴露" : "不可用" }}</dd>
          </div>
        </dl>
      </li>
    </ol>
    <ol v-if="executions.length" class="agent-harness-task-center__list" aria-label="受控执行任务">
      <li v-for="item in executions" :key="item.id" class="agent-harness-task-center__item">
        <p v-if="item.unavailableReason" class="agent-harness-task-center__reason" role="status">
          {{ item.unavailableReason }}
        </p>
        <AgentHarnessExecutionCard
          v-if="item.projection"
          :projection="item.projection"
          :result="item.result"
          :pending-action="item.pendingAction"
          @cancel="emit('cancel', item.id)"
          @retry="emit('retry', item.id)"
          @resume="emit('resume', item.id)"
        />
      </li>
    </ol>
    <ol v-if="props.drafts.length" class="agent-harness-task-center__list" aria-label="实验草案与审批">
      <li v-for="item in props.drafts" :key="item.id" class="agent-harness-task-center__item">
        <p v-if="item.unavailableReason" class="agent-harness-task-center__reason" role="status">
          {{ item.unavailableReason }}
        </p>
        <AgentHarnessDraftCard :draft="item.draft" :validation="item.validation" :approval="item.approval" />
        <AgentHarnessValidationBlock v-if="item.validation" :validation="item.validation" />
        <AgentHarnessApprovalBlock :approval="item.approval" />
      </li>
    </ol>
  </section>
</template>

<style scoped>
.agent-harness-task-center {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--line-strong, #ccd5dc);
  border-radius: 0.7rem;
  background: var(--panel, #fff);
}
.agent-harness-task-center__header,
.agent-harness-task-center__item > header,
.agent-harness-task-center__controls > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}
.agent-harness-task-center__header h3,
.agent-harness-task-center__item h4 {
  margin: 0;
}
.agent-harness-task-center__header h3 {
  font-size: 0.95rem;
}
.agent-harness-task-center__item h4 {
  font-size: 0.82rem;
}
.agent-harness-task-center__notice,
.agent-harness-task-center__empty,
.agent-harness-task-center__reason,
.agent-harness-task-center__controls {
  margin: 0;
  font-size: 0.75rem;
}
.agent-harness-task-center__notice,
.agent-harness-task-center__empty,
.agent-harness-task-center__reason {
  color: var(--muted, #687783);
}
.agent-harness-task-center__list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.agent-harness-task-center__item {
  display: grid;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.65rem;
  border: 1px solid var(--line, #d9e0e5);
  border-radius: 0.55rem;
}
.agent-harness-task-center__availability {
  flex: 0 0 auto;
  overflow-wrap: anywhere;
}
.agent-harness-task-center__availability[data-availability="not_exposed"],
.agent-harness-task-center__availability[data-availability="unavailable"] {
  color: var(--muted, #687783);
}
.agent-harness-task-center__controls {
  display: grid;
  gap: 0.25rem;
}
.agent-harness-task-center__controls dt {
  color: var(--muted, #687783);
}
.agent-harness-task-center__controls dd {
  margin: 0;
}
@media (max-width: 1024px) {
  .agent-harness-task-center__item > header,
  .agent-harness-task-center__controls > div {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.15rem;
  }
}
</style>
