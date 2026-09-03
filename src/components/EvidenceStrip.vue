<script setup lang="ts">
import { AlertTriangle, Beaker, ChevronDown, ChevronRight, ShieldCheck } from "@lucide/vue";
import { computed } from "vue";
import StatusPill from "./StatusPill.vue";
import { bundleIdentity } from "../lib/reports";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const { state, evidence, runSummary, setView } = useDashboard();
const { t } = useI18n();
const evidenceLimited = computed(
  () =>
    evidence.value.sourceMode !== "real_trace" ||
    evidence.value.calibration === "uncalibrated" ||
    evidence.value.claimScope === "exploratory",
);
</script>

<template>
  <section class="evidence-strip" :aria-label="t('当前报告上下文')">
    <div class="evidence-identity">
      <Beaker :size="18" />
      <div>
        <small>{{ t("当前实验") }}</small
        ><strong>{{ state.isDemo ? t("示例数据 · 未执行") : state.runName }}</strong>
      </div>
    </div>
    <div class="evidence-friendly-summary" :data-limited="evidenceLimited">
      <AlertTriangle v-if="evidenceLimited" :size="18" />
      <ShieldCheck v-else :size="18" />
      <span>
        <strong>{{ t(evidenceLimited ? "这是一份探索性结果" : "这份结果具备正式证据来源") }}</strong>
        <small>{{
          t(
            evidenceLimited
              ? "适合观察趋势和比较方案，不代表真实硬件表现。"
              : "仍请结合结果可信度页面确认可支持的结论。",
          )
        }}</small>
      </span>
    </div>
    <details class="evidence-technical-disclosure">
      <summary>{{ t("技术边界") }}<ChevronDown :size="15" /></summary>
      <div class="evidence-technical-content">
        <code>{{ bundleIdentity(state.bundle) }}</code>
        <div class="evidence-path">
          <span>{{ runSummary.range_label || t("边界未知") }}</span
          ><ChevronRight :size="14" /><span>{{ runSummary.host_path || t("宿主未知") }}</span>
        </div>
        <div class="evidence-tags">
          <StatusPill :value="evidence.sourceMode" />
          <StatusPill :value="evidence.calibration" />
          <StatusPill :value="evidence.claimScope" />
        </div>
        <button v-if="evidenceLimited" class="evidence-warning" @click="setView('validation')">
          <strong>{{ t("查看为什么结果受限") }}</strong
          ><ChevronRight :size="15" />
        </button>
      </div>
    </details>
  </section>
</template>
