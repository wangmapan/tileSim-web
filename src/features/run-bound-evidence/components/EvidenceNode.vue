<script setup lang="ts">
import { computed } from "vue";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import { useI18n } from "../../../i18n";
import type { RunBoundEvidenceNode } from "../types";

const props = defineProps<{ node: RunBoundEvidenceNode; statusLabel: string; output?: boolean }>();
const { t, isEnglish } = useI18n();
const titles: Record<RunBoundEvidenceNode["subsystem"], [string, string]> = {
  S1: ["运行时请求", "Runtime request"],
  S3: ["KV Cache", "KV Cache"],
  S4: ["设备执行", "Device execution"],
  S5: ["集合通信", "Collective communication"],
  S6: ["网络请求阶段", "Network request phase"],
  S7: ["统一仿真执行", "Simulation execution"],
  S8: ["校准与验证", "Calibration and validation"],
  S9: ["指标与归因", "Metrics and attribution"],
};
const title = computed(() => titles[props.node.subsystem][isEnglish.value ? 1 : 0]);
const visibleIdCount = computed(() => (props.output ? 3 : props.node.entityIds.length));
const visibleReferenceCount = computed(() => (props.output ? 2 : props.node.references.length));
const hiddenCount = computed(
  () =>
    Math.max(0, props.node.entityIds.length - visibleIdCount.value) +
    Math.max(0, props.node.references.length - visibleReferenceCount.value),
);
</script>

<template>
  <article :class="output ? 'run-bound-output-node' : 'run-bound-node'" :data-module="node.subsystem">
    <header>
      <span>{{ node.subsystem }}</span
      ><strong>{{ title }}</strong>
      <small :class="`availability--${node.availability}`">{{ statusLabel }}</small>
    </header>
    <div class="run-bound-node-content">
      <p v-if="node.availability !== 'available'" class="run-bound-node-reason">{{ t(node.detail) }}</p>
      <code v-for="id in node.entityIds.slice(0, visibleIdCount)" :key="id">{{ id }}</code>
      <div class="run-bound-reference-list">
        <ArtifactEvidenceLink
          v-for="item in node.references.slice(0, visibleReferenceCount)"
          :key="item.sourcePath"
          :source-path="item.sourcePath"
          :label="item.label"
        />
      </div>
      <details v-if="hiddenCount" class="run-bound-output-more">
        <summary>{{ t("展开完整证据（{count} 项）", { count: hiddenCount }) }}</summary>
        <code v-for="id in node.entityIds.slice(visibleIdCount)" :key="id">{{ id }}</code>
        <div class="run-bound-reference-list">
          <ArtifactEvidenceLink
            v-for="item in node.references.slice(visibleReferenceCount)"
            :key="item.sourcePath"
            :source-path="item.sourcePath"
            :label="item.label"
          />
        </div>
      </details>
      <details v-if="node.availability === 'available'" class="run-bound-binding-rule">
        <summary>{{ isEnglish ? "Binding rule" : "关联规则" }}</summary>
        <p>{{ t(node.detail) }}</p>
      </details>
    </div>
  </article>
</template>
