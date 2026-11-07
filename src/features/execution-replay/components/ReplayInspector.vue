<script setup lang="ts">
import type { ReplayDocument } from "../model/types";
import type { ReplayLayerVisibility } from "../model/layers";
import ReplayDetailsPanel from "./ReplayDetailsPanel.vue";
import ReplayTopologyCanvas from "./ReplayTopologyCanvas.vue";

defineProps<{
  document: ReplayDocument;
  cursorPs: string | null;
  selectedEventId: string | null;
  selectedRouteId?: string | null;
  selectedFabricEventId?: string | null;
  selectedCollectiveStepId?: string | null;
  selectedStageId?: string | null;
  artifactShaById?: Record<string, string>;
  visibleLayers?: ReplayLayerVisibility;
  showTopology?: boolean;
  topologyOnly?: boolean;
}>();
const emit = defineEmits<{ selectRoute: [routeId: string] }>();
</script>

<template>
  <aside class="replay-inspector" :aria-label="showTopology ? '执行回放观察视图' : '回放证据检查器'">
    <div class="replay-inspector__heading">
      <div>
        <span class="section-kicker">证据检查器</span>
        <h3>{{ topologyOnly ? "设备与链路" : "当前选择" }}</h3>
      </div>
      <span class="replay-inspector__hint">与时间游标同步</span>
    </div>
    <ReplayTopologyCanvas
      v-if="showTopology || topologyOnly"
      :document="document"
      :selected-route-id="selectedRouteId || null"
      :selected-fabric-event-id="selectedFabricEventId"
      :selected-collective-step-id="selectedCollectiveStepId"
      :cursor-ps="cursorPs"
      :visible-layers="visibleLayers"
      @select-route="emit('selectRoute', $event)"
    />
    <ReplayDetailsPanel
      v-if="!topologyOnly"
      :document="document"
      :cursor-ps="cursorPs"
      :selected-event-id="selectedEventId"
      :selected-route-id="selectedRouteId"
      :selected-fabric-event-id="selectedFabricEventId"
      :selected-collective-step-id="selectedCollectiveStepId"
      :selected-stage-id="selectedStageId"
      :artifact-sha-by-id="artifactShaById"
    />
  </aside>
</template>

<style scoped>
.replay-inspector {
  min-width: 0;
  background: var(--surface-subtle);
}
.replay-inspector__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px 0;
}
.replay-inspector__heading h3 {
  margin: 4px 0 0;
  font-size: 15px;
}
.replay-inspector__hint {
  color: var(--muted);
  font-size: 10px;
}
.replay-inspector :deep(.replay-details),
.replay-inspector :deep(.replay-topology) {
  border-top: 0;
}
</style>
