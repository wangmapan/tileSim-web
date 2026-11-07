<script setup lang="ts">
import type { ExplorationDetail } from "../types";
import type { ExplorationPlanningState } from "../types";
import AgentExplorationAuthorizationCard from "./AgentExplorationAuthorizationCard.vue";
import AgentExplorationPlanningCard from "./AgentExplorationPlanningCard.vue";
import AgentExplorationProgress from "./AgentExplorationProgress.vue";
defineProps<{ detail: ExplorationDetail | null; planning?: ExplorationPlanningState | null }>();
defineEmits<{
  authorize: [];
  pause: [];
  resume: [];
  cancel: [];
  "planning-confirm": [];
  "planning-clarify": [values: Record<string, unknown>];
  "planning-dismiss": [];
}>();
</script>
<template>
  <div v-if="planning || detail" class="agent-exploration-panel">
    <AgentExplorationPlanningCard
      v-if="planning"
      :planning="planning"
      @confirm="$emit('planning-confirm')"
      @clarify="$emit('planning-clarify', $event)"
      @dismiss="$emit('planning-dismiss')"
    />
    <template v-if="detail">
    <AgentExplorationAuthorizationCard
      v-if="detail.session.state === 'waiting_authorization'"
      :session="detail.session"
      @authorize="$emit('authorize')"
    />
    <AgentExplorationProgress
      v-else
      :detail="detail"
      @pause="$emit('pause')"
      @resume="$emit('resume')"
      @cancel="$emit('cancel')"
    />
    </template>
  </div>
</template>
