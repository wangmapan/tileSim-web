<script setup lang="ts">
import { computed } from "vue";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import { eventState } from "../model/playback";
import { eventTime, executionSubsystemLabel } from "../model/normalize";
import type { ReplayDocument } from "../model/types";

const props = defineProps<{
  document: ReplayDocument;
  cursorPs: string | null;
  selectedEventId: string | null;
  selectedRouteId?: string | null;
  selectedFabricEventId?: string | null;
  selectedCollectiveStepId?: string | null;
  selectedStageId?: string | null;
  artifactShaById?: Record<string, string>;
}>();
// Details re-renders on every playback cursor update. Build identity maps once
// per document so an 8k-event replay does not rescan every evidence array for
// each field in the selected-details template.
const eventById = computed(() => new Map(props.document.events.map((event) => [event.eventId, event])));
const routeById = computed(() => new Map(props.document.routes.map((route) => [route.routeId, route])));
const fabricEventById = computed(() => new Map(props.document.fabricEvents.map((event) => [event.eventId, event])));
const collectiveStepById = computed(() => new Map(props.document.collective.steps.map((step) => [step.stepId, step])));
const stageById = computed(() => new Map(props.document.stages.map((stage) => [stage.stageId, stage])));
const selected = () => (props.selectedEventId ? eventById.value.get(props.selectedEventId) || null : null);
const selectedRoute = () => (props.selectedRouteId ? routeById.value.get(props.selectedRouteId) || null : null);
const selectedFabricEvent = () =>
  props.selectedFabricEventId ? fabricEventById.value.get(props.selectedFabricEventId) || null : null;
const selectedCollectiveStep = () =>
  props.selectedCollectiveStepId ? collectiveStepById.value.get(props.selectedCollectiveStepId) || null : null;
const selectedStage = () => (props.selectedStageId ? stageById.value.get(props.selectedStageId) || null : null);
const fabricEventTime = () => {
  const event = selectedFabricEvent();
  if (!event) return "";
  return event.timing.type === "instant" ? event.timing.atPs : `${event.timing.startPs} – ${event.timing.endPs}`;
};
const fabricEventTimeFor = (event: NonNullable<ReturnType<typeof selectedRoute>>["events"][number]) =>
  event.timing.type === "instant" ? event.timing.atPs : `${event.timing.startPs} – ${event.timing.endPs}`;
const sourceSha = (artifactId: string | undefined) => (artifactId ? props.artifactShaById?.[artifactId] || null : null);
const selectedSourceSha = () => {
  if (selectedFabricEvent()) return sourceSha(selectedFabricEvent()!.sourceArtifact);
  if (selectedCollectiveStep()) return sourceSha(selectedCollectiveStep()!.sourceArtifact);
  if (selectedStage()) return sourceSha(selectedStage()!.sourceArtifact);
  if (selectedRoute()) return sourceSha(selectedRoute()!.sourceArtifact);
  if (selected()) return sourceSha(selected()!.sourceArtifact);
  return null;
};
</script>

<template>
  <aside class="replay-details" aria-label="回放事件详情">
    <template v-if="selectedFabricEvent()">
      <div class="replay-details__heading">
        <span class="section-kicker">当前 Fabric 事件</span>
        <h3>{{ selectedFabricEvent()!.label }}</h3>
      </div>
      <dl class="replay-details__facts">
        <div>
          <dt>路径</dt>
          <dd>
            <code>{{ selectedFabricEvent()!.routeId }}</code>
          </dd>
        </div>
        <div v-if="selectedRoute()">
          <dt>实际路径</dt>
          <dd>
            <code>{{ selectedRoute()!.actualPath.join(" → ") || "后端未提供实际路径" }}</code>
          </dd>
        </div>
        <div>
          <dt>时间</dt>
          <dd>
            <code>{{ fabricEventTime() }} ps</code>
          </dd>
        </div>
        <div>
          <dt>链路</dt>
          <dd>
            <code>{{ selectedFabricEvent()!.linkId || "未报告" }}</code>
          </dd>
        </div>
      </dl>
      <details>
        <summary>查看事件证据</summary>
        <dl class="replay-details__evidence">
          <div>
            <dt>SHA-256</dt>
            <dd>
              <code>{{ selectedSourceSha() || "未报告" }}</code>
            </dd>
          </div>
          <div>
            <dt>Pointer</dt>
            <dd><ArtifactEvidenceLink :source-path="selectedFabricEvent()!.sourcePath" /></dd>
          </div>
        </dl>
      </details>
    </template>
    <template v-else-if="selectedCollectiveStep()">
      <div class="replay-details__heading">
        <span class="section-kicker">当前集合步骤</span>
        <h3>{{ selectedCollectiveStep()!.collectiveId }}</h3>
      </div>
      <dl class="replay-details__facts">
        <div>
          <dt>阶段</dt>
          <dd>
            <span>{{ selectedCollectiveStep()!.phaseLabel || selectedCollectiveStep()!.phaseId }}</span>
            <code>{{ selectedCollectiveStep()!.phaseId }}</code>
          </dd>
        </div>
        <div>
          <dt>round / chunk</dt>
          <dd>
            <code>{{ selectedCollectiveStep()!.round }} / {{ selectedCollectiveStep()!.chunk }}</code>
          </dd>
        </div>
        <div>
          <dt>时间</dt>
          <dd>
            <code
              >{{ selectedCollectiveStep()!.timing.startPs }} – {{ selectedCollectiveStep()!.timing.endPs }} ps</code
            >
          </dd>
        </div>
        <div>
          <dt>路径</dt>
          <dd>
            <code
              >{{ selectedCollectiveStep()!.sourceDevice }} → {{ selectedCollectiveStep()!.destinationDevice }}</code
            >
          </dd>
        </div>
        <div>
          <dt>bytes</dt>
          <dd>
            <code>{{ selectedCollectiveStep()!.bytes }}</code>
          </dd>
        </div>
        <div>
          <dt>依赖</dt>
          <dd>
            <code>
              {{
                selectedCollectiveStep()!.dependencies === null
                  ? "未报告"
                  : selectedCollectiveStep()!.dependencies!.length
                    ? selectedCollectiveStep()!.dependencies!.join(", ")
                    : "无依赖"
              }}
            </code>
          </dd>
        </div>
      </dl>
      <details>
        <summary>查看步骤证据</summary>
        <dl class="replay-details__evidence">
          <div>
            <dt>SHA-256</dt>
            <dd>
              <code>{{ selectedSourceSha() || "未报告" }}</code>
            </dd>
          </div>
          <div>
            <dt>Pointer</dt>
            <dd><ArtifactEvidenceLink :source-path="selectedCollectiveStep()!.sourcePath" /></dd>
          </div>
        </dl>
      </details>
    </template>
    <template v-else-if="selectedStage()">
      <div class="replay-details__heading">
        <span class="section-kicker">当前执行阶段</span>
        <h3>{{ selectedStage()!.label }}</h3>
      </div>
      <dl class="replay-details__facts">
        <div>
          <dt>阶段</dt>
          <dd>{{ selectedStage()!.label }}</dd>
        </div>
        <div>
          <dt>子系统</dt>
          <dd :title="selectedStage()!.subsystem || undefined">
            {{ executionSubsystemLabel(selectedStage()!.subsystem) }}
          </dd>
        </div>
        <div v-if="selectedStage()!.timing">
          <dt>时间</dt>
          <dd>
            <code>{{ selectedStage()!.timing!.startPs }} – {{ selectedStage()!.timing!.endPs }} ps</code>
          </dd>
        </div>
      </dl>
      <details>
        <summary>查看阶段证据</summary>
        <dl class="replay-details__evidence">
          <div>
            <dt>技术阶段标识</dt>
            <dd>
              <code>{{ selectedStage()!.stageId }}</code>
            </dd>
          </div>
          <div>
            <dt>SHA-256</dt>
            <dd>
              <code>{{ selectedSourceSha() || "未报告" }}</code>
            </dd>
          </div>
          <div>
            <dt>Pointer</dt>
            <dd><ArtifactEvidenceLink :source-path="selectedStage()!.sourcePath" /></dd>
          </div>
        </dl>
      </details>
    </template>
    <template v-else-if="selectedRoute()">
      <div class="replay-details__heading">
        <span class="section-kicker">当前路径</span>
        <h3>{{ selectedRoute()!.state === "available" ? "已报告物理路径" : "路径详情" }}</h3>
      </div>
      <dl class="replay-details__facts">
        <div>
          <dt>状态</dt>
          <dd>
            {{
              selectedRoute()!.state === "available"
                ? "路径已报告"
                : selectedRoute()!.state === "partial"
                  ? "路径部分报告"
                  : selectedRoute()!.state === "route_unavailable"
                    ? "路径不可用"
                    : selectedRoute()!.state === "topology_identity_mismatch"
                      ? "拓扑身份不一致"
                      : selectedRoute()!.hasInterval
                        ? "路径细节未报告"
                        : "后端未提供实际路径"
            }}
          </dd>
        </div>
        <div>
          <dt>实际路径</dt>
          <dd>
            <code>{{ selectedRoute()!.actualPath.join(" → ") || "后端未提供实际路径" }}</code>
          </dd>
        </div>
        <div>
          <dt>链路</dt>
          <dd>
            <code>{{ selectedRoute()!.linkIds.join(", ") || "未报告" }}</code>
          </dd>
        </div>
        <div v-if="selectedRoute()!.timing">
          <dt>开始 / 完成</dt>
          <dd>
            <code>{{ selectedRoute()!.timing!.startPs }} – {{ selectedRoute()!.timing!.endPs }} ps</code>
          </dd>
        </div>
        <div>
          <dt>Fabric 事件</dt>
          <dd>{{ selectedRoute()!.events.length ? `${selectedRoute()!.events.length} 个已报告事件` : "未报告" }}</dd>
        </div>
      </dl>
      <ul v-if="selectedRoute()!.events.length" class="replay-details__fabric-events">
        <li v-for="event in selectedRoute()!.events" :key="event.eventId">
          <span>{{ event.label }}</span>
          <code>{{ event.linkId || "link 未报告" }}</code>
          <code>{{ fabricEventTimeFor(event) }} ps</code>
          <ArtifactEvidenceLink :source-path="event.sourcePath" label="证据" />
        </li>
      </ul>
      <details>
        <summary>查看路径证据</summary>
        <dl class="replay-details__evidence">
          <div>
            <dt>SHA-256</dt>
            <dd>
              <code>{{ selectedSourceSha() || "未报告" }}</code>
            </dd>
          </div>
          <div>
            <dt>Pointer</dt>
            <dd><ArtifactEvidenceLink :source-path="selectedRoute()!.sourcePath" /></dd>
          </div>
        </dl>
      </details>
    </template>
    <template v-else-if="selected()">
      <div class="replay-details__heading">
        <span class="section-kicker">当前事件</span>
        <h3>{{ selected()!.label }}</h3>
      </div>
      <dl class="replay-details__facts">
        <div>
          <dt>状态</dt>
          <dd>
            {{
              eventState(selected()!, cursorPs || document.startPs || "0") === "active"
                ? "进行中"
                : eventState(selected()!, cursorPs || document.startPs || "0") === "completed"
                  ? "已发生"
                  : "待发生"
            }}
          </dd>
        </div>
        <div>
          <dt>模拟时间</dt>
          <dd>
            <code>{{ eventTime(selected()!) }} ps</code>
          </dd>
        </div>
        <div>
          <dt>请求 / 批次</dt>
          <dd>
            <code>{{ selected()!.requestId || "未报告" }}</code> / <code>{{ selected()!.batchId || "未报告" }}</code>
          </dd>
        </div>
        <div v-if="selected()!.state">
          <dt>当前状态</dt>
          <dd>{{ selected()!.state }}</dd>
        </div>
      </dl>
      <p v-if="selected()!.detail" class="replay-details__detail">{{ selected()!.detail }}</p>
      <details>
        <summary>查看数据与证据</summary>
        <dl class="replay-details__evidence">
          <div>
            <dt>sourcePath</dt>
            <dd>
              <code>{{ selected()!.sourcePath }}</code>
            </dd>
          </div>
          <div>
            <dt>技术事件类型</dt>
            <dd>
              <code>{{ selected()!.kind }}</code>
            </dd>
          </div>
          <div>
            <dt>schema</dt>
            <dd>
              <code>{{ selected()!.sourceSchema || "未报告" }}</code>
            </dd>
          </div>
          <div>
            <dt>SHA-256</dt>
            <dd>
              <code>{{ selectedSourceSha() || "未报告" }}</code>
            </dd>
          </div>
          <div>
            <dt>Pointer</dt>
            <dd><ArtifactEvidenceLink :source-path="selected()!.sourcePath" /></dd>
          </div>
        </dl>
      </details>
    </template>
    <p v-else class="panel-empty-copy">选择一个事件查看详情。阶段证据保留在时间轴中。</p>
  </aside>
</template>

<style scoped>
.replay-details {
  min-width: 0;
  padding: 18px 20px;
  border-left: 1px solid var(--line);
  background: var(--surface-subtle);
}

.replay-details__heading h3 {
  margin: 4px 0 14px;
  font-size: 17px;
}

.replay-details dl {
  display: grid;
  gap: 9px;
  margin: 0;
}

.replay-details__facts {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  box-shadow: var(--shadow-hairline);
}

.replay-details dl > div {
  display: grid;
  grid-template-columns: minmax(72px, 0.4fr) minmax(0, 1fr);
  gap: 10px;
}

.replay-details__facts > div + div {
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
}

.replay-details dt {
  color: var(--muted);
  font-size: var(--text-xs);
}

.replay-details dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--text-sm);
}

.replay-details__detail {
  color: var(--ink-soft);
  font-size: var(--text-sm);
}

.replay-details details {
  margin-top: 18px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.replay-details summary {
  cursor: pointer;
  color: var(--muted);
  font-size: var(--text-xs);
}

.replay-details__evidence {
  margin-top: 12px !important;
}

.replay-details__evidence code {
  overflow-wrap: anywhere;
}

.replay-details__fabric-events {
  display: grid;
  gap: 6px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}
.replay-details__fabric-events li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: 4px 8px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface);
  font-size: var(--text-xs);
  transition:
    border-color var(--motion-interaction) var(--ease-standard),
    background-color var(--motion-interaction) var(--ease-standard),
    transform var(--motion-interaction) var(--ease-emphasized);
}
.replay-details__fabric-events li:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
  transform: translateX(2px);
}
.replay-details__fabric-events li span {
  font-weight: 600;
}
.replay-details__fabric-events li code {
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
  .replay-details {
    border-top: 1px solid var(--line);
    border-left: 0;
  }
}
</style>
