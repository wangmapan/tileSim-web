<script setup lang="ts">
import { computed, ref } from "vue";
import type { ReplayDocument } from "../model/types";
import type { ReplayLayerVisibility } from "../model/layers";
import type { ReplayMode } from "../model/modes";
import { collectiveParticipants, reportedNetworkRoutes } from "../model/modes";
import ReplayCollectivePanel from "./ReplayCollectivePanel.vue";
import ReplayModeTabs from "./ReplayModeTabs.vue";
import ReplayInspector from "./ReplayInspector.vue";
import ReplayTimeline from "./ReplayTimeline.vue";
import ReplayTopologyCanvas from "./ReplayTopologyCanvas.vue";
import ReplayTrackPanel from "./ReplayTrackPanel.vue";

const props = defineProps<{
  document: ReplayDocument;
  cursorPs: string | null;
  selectedEventId: string | null;
  selectedRouteId: string | null;
  selectedFabricEventId: string | null;
  selectedCollectiveStepId: string | null;
  selectedStageId: string | null;
  artifactShaById: Record<string, string>;
  visibleLayers: ReplayLayerVisibility;
  flowMotion?: boolean;
}>();
const emit = defineEmits<{
  "update:cursor": [cursorPs: string];
  selectEvent: [eventId: string];
  selectRoute: [routeId: string];
  selectFabricEvent: [eventId: string];
  selectCollectiveStep: [stepId: string];
  selectStage: [stageId: string];
}>();

const mode = ref<ReplayMode>("overview");
const participants = computed(() => collectiveParticipants(props.document));
const physicalRoutes = computed(() =>
  props.document.routes.filter((route) => route.actualPath.length >= 2 && route.state === "available"),
);
const networkRoutes = computed(() => reportedNetworkRoutes(props.document));
</script>

<template>
  <div class="replay-workspace" data-replay-workspace :data-mode="mode">
    <ReplayModeTabs v-model="mode" />

    <div v-if="mode === 'overview'" class="replay-workspace__overview" role="tabpanel" aria-label="执行概览">
      <ReplayTopologyCanvas
        :document="document"
        :selected-route-id="selectedRouteId"
        :selected-fabric-event-id="selectedFabricEventId"
        :selected-collective-step-id="selectedCollectiveStepId"
        :cursor-ps="cursorPs"
        :visible-layers="visibleLayers"
        :flow-motion="flowMotion"
        mode="overview"
        @select-route="emit('selectRoute', $event)"
      />
      <ReplayTrackPanel title="时间" description="拖动游标，拓扑上的圆点沿已报告路径移动。">
        <ReplayTimeline
          :document="document"
          :cursor-ps="cursorPs"
          :selected-event-id="selectedEventId"
          :selected-route-id="selectedRouteId"
          :selected-fabric-event-id="selectedFabricEventId"
          :selected-collective-step-id="selectedCollectiveStepId"
          :selected-stage-id="selectedStageId"
          :visible-layers="visibleLayers"
          mode="overview"
          @select-event="emit('selectEvent', $event)"
          @select-route="emit('selectRoute', $event)"
          @select-fabric-event="emit('selectFabricEvent', $event)"
          @select-collective-step="emit('selectCollectiveStep', $event)"
          @select-stage="emit('selectStage', $event)"
          @update:cursor="emit('update:cursor', $event)"
        />
      </ReplayTrackPanel>
      <details class="replay-workspace__more">
        <summary>证据详情</summary>
        <ReplayInspector
          :document="document"
          :cursor-ps="cursorPs"
          :selected-event-id="selectedEventId"
          :selected-route-id="selectedRouteId"
          :selected-fabric-event-id="selectedFabricEventId"
          :selected-collective-step-id="selectedCollectiveStepId"
          :selected-stage-id="selectedStageId"
          :artifact-sha-by-id="artifactShaById"
          :visible-layers="visibleLayers"
          @select-route="emit('selectRoute', $event)"
        />
      </details>
    </div>

    <div v-else-if="mode === 'collective'" class="replay-workspace__mode" role="tabpanel" aria-label="集合通信">
      <ReplayTopologyCanvas
        :document="document"
        :selected-route-id="selectedRouteId"
        :selected-fabric-event-id="selectedFabricEventId"
        :selected-collective-step-id="selectedCollectiveStepId"
        :cursor-ps="cursorPs"
        :visible-layers="visibleLayers"
        :flow-motion="flowMotion"
        mode="collective"
        @select-route="emit('selectRoute', $event)"
      />
      <p v-if="!physicalRoutes.length" class="replay-mode-empty replay-mode-empty--inset">
        真实路径未报告；集合参与者不会被当作物理链路。
      </p>
      <ReplayTrackPanel title="时间" description="拖动游标，拓扑上的圆点沿已报告的集合路径移动。">
        <ReplayTimeline
          :document="document"
          :cursor-ps="cursorPs"
          :selected-event-id="selectedEventId"
          :selected-route-id="selectedRouteId"
          :selected-fabric-event-id="selectedFabricEventId"
          :selected-collective-step-id="selectedCollectiveStepId"
          :selected-stage-id="selectedStageId"
          :visible-layers="visibleLayers"
          mode="collective"
          @select-event="emit('selectEvent', $event)"
          @select-route="emit('selectRoute', $event)"
          @select-fabric-event="emit('selectFabricEvent', $event)"
          @select-collective-step="emit('selectCollectiveStep', $event)"
          @select-stage="emit('selectStage', $event)"
          @update:cursor="emit('update:cursor', $event)"
        />
      </ReplayTrackPanel>
      <details class="replay-workspace__more">
        <summary>逻辑参与者 · {{ participants.length }} 个集合，与物理路径分开查看</summary>
        <section class="replay-mode-card replay-mode-card--collective">
          <div v-if="participants.length" class="replay-participant-grid">
            <article v-for="participant in participants" :key="participant.id" class="replay-participant-card">
              <header>
                <strong>{{ participant.id }}</strong
                ><span>{{ participant.stepCount }} 步</span>
              </header>
              <dl>
                <div>
                  <dt>发送方</dt>
                  <dd>
                    <code>{{ participant.sourceDevices.join("、") }}</code>
                  </dd>
                </div>
                <div>
                  <dt>接收方</dt>
                  <dd>
                    <code>{{ participant.destinationDevices.join("、") }}</code>
                  </dd>
                </div>
                <div>
                  <dt>bytes</dt>
                  <dd>
                    <code>{{ participant.bytes.join("、") }}</code>
                  </dd>
                </div>
              </dl>
            </article>
          </div>
          <p v-else class="replay-mode-empty">集合参与者未报告；不会从拓扑或阶段顺序推断参与者。</p>
        </section>
        <ReplayCollectivePanel
          :collective="document.collective"
          :selected-step-id="selectedCollectiveStepId"
          :visible="visibleLayers.collective"
          @select-step="emit('selectCollectiveStep', $event)"
        />
      </details>
      <details class="replay-workspace__more">
        <summary>证据详情</summary>
        <ReplayInspector
          :document="document"
          :cursor-ps="cursorPs"
          :selected-event-id="selectedEventId"
          :selected-route-id="selectedRouteId"
          :selected-fabric-event-id="selectedFabricEventId"
          :selected-collective-step-id="selectedCollectiveStepId"
          :selected-stage-id="selectedStageId"
          :artifact-sha-by-id="artifactShaById"
          :visible-layers="visibleLayers"
          @select-route="emit('selectRoute', $event)"
        />
      </details>
    </div>

    <div v-else class="replay-workspace__mode" role="tabpanel" aria-label="设备与链路">
      <ReplayTrackPanel title="网络时间线" description="网络模式仍使用同一游标；空间投影只标记真实路径事件。">
        <ReplayTimeline
          :document="document"
          :cursor-ps="cursorPs"
          :selected-event-id="selectedEventId"
          :selected-route-id="selectedRouteId"
          :selected-fabric-event-id="selectedFabricEventId"
          :selected-collective-step-id="null"
          :selected-stage-id="selectedStageId"
          :visible-layers="visibleLayers"
          mode="network"
          @select-event="emit('selectEvent', $event)"
          @select-route="emit('selectRoute', $event)"
          @select-fabric-event="emit('selectFabricEvent', $event)"
          @select-collective-step="emit('selectCollectiveStep', $event)"
          @select-stage="emit('selectStage', $event)"
          @update:cursor="emit('update:cursor', $event)"
        />
      </ReplayTrackPanel>
      <section class="replay-mode-card replay-mode-card--network">
        <header class="replay-mode-card__header">
          <div>
            <span class="section-kicker">空间投影</span>
            <h3>拓扑与实际路径</h3>
          </div>
          <span class="replay-mode-card__meta">仅显示 actual_path / execution_events</span>
        </header>
        <ReplayTopologyCanvas
          :document="document"
          :selected-route-id="selectedRouteId"
          :selected-fabric-event-id="selectedFabricEventId"
          :selected-collective-step-id="null"
          :cursor-ps="cursorPs"
          :visible-layers="visibleLayers"
          :flow-motion="flowMotion"
          mode="network"
          @select-route="emit('selectRoute', $event)"
        />
      </section>
      <div class="replay-network-grid">
        <section class="replay-mode-card">
          <header class="replay-mode-card__header">
            <div>
              <span class="section-kicker">路径状态</span>
              <h3>已报告执行事件</h3>
            </div>
            <span v-if="networkRoutes.length" class="replay-mode-card__meta">{{ networkRoutes.length }} 条</span>
          </header>
          <p v-if="networkRoutes.length" class="replay-mode-empty">
            {{ networkRoutes.length }} 条已报告路径画在上方拓扑里。点一条链路或时间标记查看单条事件。
          </p>
          <p v-else class="replay-mode-empty">actual_path 未报告；拓扑只作为上下文底图。</p>
        </section>
        <ReplayInspector
          :document="document"
          :cursor-ps="cursorPs"
          :selected-event-id="selectedEventId"
          :selected-route-id="selectedRouteId"
          :selected-fabric-event-id="selectedFabricEventId"
          :selected-collective-step-id="null"
          :selected-stage-id="selectedStageId"
          :artifact-sha-by-id="artifactShaById"
          @select-route="emit('selectRoute', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.replay-workspace {
  min-width: 0;
}
.replay-workspace__overview,
.replay-workspace__mode {
  min-width: 0;
}
.replay-workspace__more {
  border-top: 1px solid var(--line);
}
.replay-workspace__more summary {
  padding: 12px 22px;
  color: var(--ink-soft);
  cursor: pointer;
}
.replay-workspace__summary {
  min-width: 0;
  padding: 0 22px 12px;
}
.replay-summary-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  color: var(--muted);
  font-size: var(--text-xs);
}
.replay-summary-strip strong {
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.replay-mode-card {
  min-width: 0;
  padding: 18px 22px 22px;
  border-top: 1px solid var(--line);
  background: var(--surface-subtle);
}
.replay-mode-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.replay-mode-card__header h3 {
  margin: 4px 0 0;
  font-size: 16px;
}
.replay-mode-card__meta {
  color: var(--muted);
  font-size: var(--text-xs);
}
.replay-participant-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 8px;
}
.replay-participant-card {
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
}
.replay-participant-card header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--ink);
}
.replay-participant-card header span,
.replay-participant-card dt {
  color: var(--muted);
  font-size: 10px;
}
.replay-participant-card dl {
  display: grid;
  gap: 6px;
  margin: 11px 0 0;
}
.replay-participant-card dl div {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 6px;
}
.replay-participant-card dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}
.replay-mode-empty {
  margin: 0;
  padding: 10px 12px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-control);
  color: var(--muted);
  background: var(--surface);
  font-size: var(--text-sm);
}
.replay-mode-empty--inset {
  margin: 0 22px 12px;
}
.replay-network-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.6fr);
  align-items: start;
  gap: 0;
  border-top: 1px solid var(--line);
}
.replay-network-grid > .replay-mode-card {
  border-top: 0;
}
.replay-network-routes {
  display: grid;
  gap: 6px;
}
.replay-network-routes button {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 3px 10px;
  align-items: baseline;
  padding: 9px 10px;
  border: 1px solid var(--line);
  color: var(--ink);
  background: var(--surface);
  text-align: left;
  cursor: pointer;
}
.replay-network-routes button:hover,
.replay-network-routes button.is-selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.replay-network-routes code {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.replay-network-routes small {
  grid-column: 2;
  color: var(--muted);
  font-size: 10px;
}
@media (max-width: 900px) {
  .replay-network-grid {
    grid-template-columns: 1fr;
  }
}
</style>
