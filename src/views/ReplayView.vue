<script setup lang="ts">
import EmptyState from "../components/EmptyState.vue";
import { ExecutionReplayPanel } from "../features/execution-replay";
import { evidenceAgentBackendIdentity } from "../features/evidence-agent";
import { useDashboard } from "../store/dashboard";
import { computed } from "vue";

const { state } = useDashboard();
const hasResult = computed(() =>
  Boolean(
    state.runId ||
    state.artifactManifest ||
    state.bundle.run ||
    state.bundle.metrics ||
    state.bundle.validation ||
    state.bundle.execution_envelope,
  ),
);
</script>

<template>
  <EmptyState
    v-if="!hasResult"
    title="还没有可回放的执行记录"
    description="请先打开一次已完成的实验，或运行一个新实验。"
    action-label="新建实验"
    action-to="/experiment"
  />
  <div v-else class="view-stack replay-view">
    <section class="replay-view-intro" aria-labelledby="replay-view-title" data-help-anchor="replay-overview">
      <div>
        <p class="section-kicker">执行回放</p>
        <h2 id="replay-view-title">沿时间轴查看已报告执行证据</h2>
        <p>播放、逐步检查路径、设备通信和集合步骤；所有动画均以当前运行已验证的记录为准。</p>
      </div>
      <span v-if="state.runId" class="replay-view-run">{{ state.runName || state.runId }}</span>
    </section>
    <ExecutionReplayPanel
      :run-id="state.runId"
      :bundle="state.bundle"
      :inputs="state.inputs"
      :artifact-manifest="state.artifactManifest"
      :backend-identity="(state.bridge.identity && evidenceAgentBackendIdentity(state.bridge.identity)) || 'unknown'"
      :schema-set-revision="state.bridge.manifest?.schema_set_revision || 'unknown'"
      :bridge-manifest="state.bridge.manifest"
    />
  </div>
</template>

<style scoped>
.replay-view {
  gap: 18px;
}

.replay-view-intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  min-width: 0;
  padding: 2px 2px 0;
}

.replay-view-intro > div {
  min-width: 0;
}

.replay-view-intro h2 {
  margin: 3px 0 0;
  font-size: clamp(1.1rem, 1.6vw, 1.45rem);
}

.replay-view-intro p:last-child {
  max-width: 760px;
  margin: 7px 0 0;
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: 1.55;
}

.replay-view-run {
  max-width: min(34vw, 360px);
  padding: 6px 9px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  color: var(--muted);
  background: var(--surface-muted);
  font: 650 var(--text-xs) var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .replay-view-intro {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .replay-view-run {
    max-width: 100%;
  }
}
</style>
