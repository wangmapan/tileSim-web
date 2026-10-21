<script setup lang="ts">
import { computed } from "vue";
import type { AgentHarnessStatusCardProps } from "../presentation";
import { agentHarnessAvailabilityLabel, agentHarnessStateLabel } from "../presentation";

const props = defineProps<AgentHarnessStatusCardProps>();
const stateLabel = computed(() =>
  props.projection.state ? agentHarnessStateLabel(props.projection.state) : "尚未开始",
);
const availabilityLabel = computed(() => agentHarnessAvailabilityLabel(props.projection.availability));
</script>

<template>
  <article class="agent-harness-status-card" data-source="fixture" :data-availability="props.projection.availability">
    <header>
      <div>
        <p class="agent-harness-eyebrow">{{ props.title || "Agent Harness 契约预览" }}</p>
        <h3>{{ stateLabel }}</h3>
      </div>
      <span class="agent-harness-status" role="status">{{ availabilityLabel }}</span>
    </header>
    <p class="agent-harness-notice">
      仅为 proposal-only fixture；不代表正式 v1 运行时或后端能力，不会创建真实 run，也不会持久化为服务端 operation。
    </p>
    <dl>
      <div>
        <dt>来源</dt>
        <dd>
          <code>{{ props.projection.source }}</code>
        </dd>
      </div>
      <div>
        <dt>operation</dt>
        <dd>
          <code>{{ props.projection.operation_id || "未创建" }}</code>
        </dd>
      </div>
      <div>
        <dt>事件</dt>
        <dd>{{ props.projection.event_count }} 个已接受，{{ props.projection.duplicate_event_ids.length }} 个重复</dd>
      </div>
    </dl>
    <p v-if="props.projection.error" class="agent-harness-error" role="alert">
      <strong>{{ props.projection.error.code }}</strong>
      <span>{{ props.projection.error.message }}</span>
    </p>
  </article>
</template>
