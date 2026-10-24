<script setup lang="ts">
import { computed } from "vue";
import ArtifactEvidenceLink from "../../../components/ArtifactEvidenceLink.vue";
import InlineHelp from "../../../components/InlineHelp.vue";
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
const summaries: Record<RunBoundEvidenceNode["subsystem"], [string, string]> = {
  S1: ["已关联当前请求的运行输入与指标。", "The runtime input and request metrics are linked to this request."],
  S3: ["已关联当前请求使用的 KV Cache 资源。", "The KV Cache resource for this request is linked."],
  S4: ["已关联当前请求对应的设备执行记录。", "The device execution record for this request is linked."],
  S5: ["已关联当前请求涉及的集合通信记录。", "The collective communication record for this request is linked."],
  S6: ["已定位当前请求的网络阶段。", "The network phase for this request is identified."],
  S7: ["已匹配当前请求的仿真执行记录。", "The simulation execution record for this request is matched."],
  S8: ["已匹配当前请求的校准与验证结果。", "The calibration and validation result for this request is matched."],
  S9: ["已匹配当前请求的指标与归因记录。", "The metric and attribution record for this request is matched."],
};
const summary = computed(() => {
  if (props.node.availability === "available") return summaries[props.node.subsystem][isEnglish.value ? 1 : 0];
  if (props.node.availability === "not_applicable")
    return isEnglish.value ? "This module does not apply to this request." : "该模块不适用于当前请求。";
  if (props.node.availability === "partial" || props.node.availability === "run_scope_only")
    return isEnglish.value ? "Only part of the supporting evidence is available." : "目前只找到部分支持证据。";
  if (props.node.availability === "legacy_compatibility")
    return isEnglish.value ? "Only a compatibility record is available." : "当前只有兼容记录。";
  return isEnglish.value ? "No verifiable record is available for this request." : "当前请求没有可验证的记录。";
});
const hasTechnicalDetails = computed(() =>
  Boolean(props.node.entityIds.length || props.node.references.length || props.node.detail),
);
</script>

<template>
  <article :class="output ? 'run-bound-output-node' : 'run-bound-node'" :data-module="node.subsystem">
    <header>
      <strong>{{ title }}</strong>
      <small :class="`availability--${node.availability}`">{{ statusLabel }}</small>
      <InlineHelp :text="t(node.detail)" :label="t('查看 {title} 的技术说明', { title })" />
    </header>
    <div class="run-bound-node-content">
      <p class="run-bound-node-summary">{{ summary }}</p>
      <details v-if="hasTechnicalDetails" class="run-bound-technical-details">
        <summary>{{ isEnglish ? "View technical details" : "查看技术详情" }}</summary>
        <div class="run-bound-technical-section">
          <span>{{ isEnglish ? "Module identifier" : "模块标识" }}</span>
          <code>{{ node.subsystem }}</code>
        </div>
        <div v-if="node.entityIds.length" class="run-bound-technical-section">
          <span>{{ t("内部标识") }}</span>
          <code v-for="id in node.entityIds" :key="id">{{ id }}</code>
        </div>
        <div v-if="node.references.length" class="run-bound-technical-section">
          <span>{{ t("来源证据") }}</span>
          <div class="run-bound-reference-list">
            <ArtifactEvidenceLink
              v-for="item in node.references"
              :key="item.sourcePath"
              :source-path="item.sourcePath"
              :label="item.label"
            />
          </div>
        </div>
        <p class="run-bound-technical-note">{{ t(node.detail) }}</p>
      </details>
    </div>
  </article>
</template>
