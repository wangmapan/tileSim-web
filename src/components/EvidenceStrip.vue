<script setup lang="ts">
import { AlertTriangle, Beaker, ChevronRight } from "@lucide/vue";
import StatusPill from "./StatusPill.vue";
import { bundleIdentity } from "../lib/reports";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const { state, evidence, runSummary, setView } = useDashboard();
const { t } = useI18n();
</script>

<template>
  <section class="evidence-strip" :aria-label="t('当前报告上下文')">
    <div class="evidence-identity">
      <Beaker :size="18" />
      <div>
        <small>{{ state.isDemo ? t("示例数据 · 未执行") : state.runName }}</small
        ><strong>{{ bundleIdentity(state.bundle) }}</strong>
      </div>
    </div>
    <div class="evidence-path">
      <span>{{ runSummary.range_label || t("边界未知") }}</span
      ><ChevronRight :size="14" /><span>{{ runSummary.host_path || t("宿主未知") }}</span>
    </div>
    <div class="evidence-context-actions">
      <div class="evidence-tags">
        <StatusPill :value="evidence.sourceMode" />
        <StatusPill :value="evidence.calibration" />
        <StatusPill :value="evidence.claimScope" />
      </div>
      <button
        v-if="evidence.sourceMode !== 'real_trace'"
        class="evidence-warning"
        :aria-label="`${t('证据边界受限')}：${t('当前结论不能替代真实留出验证')}`"
        @click="setView('validation')"
      >
        <AlertTriangle :size="15" />
        <strong>{{ t("证据边界受限") }}</strong>
        <ChevronRight :size="15" />
      </button>
    </div>
  </section>
</template>
