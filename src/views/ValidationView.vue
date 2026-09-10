<script setup lang="ts">
import { AlertTriangle, Check, ChevronDown, CircleMinus, Layers3, ShieldCheck } from "@lucide/vue";
import EmptyState from "../components/EmptyState.vue";
import StatusPill from "../components/StatusPill.vue";
import { formatPercent } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";
import ArtifactEvidenceLink from "../components/ArtifactEvidenceLink.vue";
import { validationCheckSource } from "../features/execution-inspector";
import {
  backendExplanationPresentation,
  executionLayerName,
  semanticFieldPresentation,
} from "../features/execution-inspector";
const { state, evidence } = useDashboard();
const { t } = useI18n();

function semanticField(field: string, value: unknown) {
  return semanticFieldPresentation(field, value);
}

function backendExplanation(value: string | null | undefined) {
  return backendExplanationPresentation(value);
}
</script>

<template>
  <EmptyState
    v-if="!state.bundle.validation"
    title="还没有可信度信息"
    description="请先打开一次已完成的实验，页面会说明结果来源和限制。"
    action-label="新建实验"
    action-to="/experiment"
  />
  <div v-else class="view-stack">
    <section class="provenance-grid" data-help-anchor="validation-scope">
      <article data-help-anchor="validation-provenance" class="provenance-semantic">
        <small>{{ semanticField("source_mode", evidence.sourceMode).fieldLabel }}</small>
        <strong>{{ semanticField("source_mode", evidence.sourceMode).valueLabel }}</strong>
        <p v-if="semanticField('source_mode', evidence.sourceMode).valueDescription">
          {{ semanticField("source_mode", evidence.sourceMode).valueDescription }}
        </p>
        <code>{{ semanticField("source_mode", evidence.sourceMode).technicalText }}</code>
      </article>
      <article
        v-for="item in [
          { field: 'calibration_level', value: evidence.calibration },
          { field: 'allowed_claim_scope', value: evidence.claimScope },
        ]"
        :key="item.field"
        class="provenance-semantic"
      >
        <small>{{ semanticField(item.field, item.value).fieldLabel }}</small>
        <strong>{{ semanticField(item.field, item.value).valueLabel }}</strong>
        <p v-if="semanticField(item.field, item.value).valueDescription">
          {{ semanticField(item.field, item.value).valueDescription }}
        </p>
        <code>{{ semanticField(item.field, item.value).technicalText }}</code>
      </article>
      <article>
        <small>{{ t("证据完整度") }}</small
        ><strong>{{ formatPercent(state.bundle.validation.completeness) }}</strong>
        <p>{{ t("字段覆盖，非准确率") }}</p>
      </article>
    </section>

    <section v-if="state.bundle.validation.open_gaps?.length" class="gap-panel" data-help-anchor="validation-gaps">
      <header>
        <AlertTriangle :size="19" />
        <div>
          <strong>{{ t("未闭合的证据缺口") }}</strong>
        </div>
      </header>
      <ul>
        <li v-for="(gap, index) in state.bundle.validation.open_gaps" :key="gap">
          <span>
            <small>{{ backendExplanation(gap).label }}</small>
            {{ backendExplanation(gap).text }}
            <code v-if="backendExplanation(gap).mapped">{{ t("后端原文") }}: {{ gap }}</code>
          </span>
          <ArtifactEvidenceLink :source-path="'validation:/open_gaps/' + index" />
        </li>
      </ul>
    </section>

    <details
      v-if="state.bundle.validation.resolution_entries?.length"
      class="panel validation-disclosure"
      data-help-anchor="validation-fidelity"
    >
      <summary>
        <div>
          <h2>{{ t("各环节实际使用的模拟精度") }}</h2>
          <p>{{ t("请求精度 → 实际精度") }}</p>
        </div>
        <span>{{ t("{count} 个环节", { count: state.bundle.validation.resolution_entries.length }) }}</span>
        <span class="validation-summary-icons"><Layers3 :size="21" /><ChevronDown :size="17" /></span>
      </summary>
      <div class="fidelity-matrix">
        <div
          v-for="(entry, index) in state.bundle.validation.resolution_entries"
          :key="entry.subsystem"
          class="fidelity-row"
        >
          <strong class="fidelity-module">
            <span>{{ executionLayerName(entry.subsystem) }}</span>
            <code>{{ entry.subsystem }}</code>
          </strong>
          <span class="fidelity-value">
            <b>{{ semanticField("requested_fidelity", entry.requested_fidelity).valueLabel }}</b>
            <code>requested_fidelity = {{ entry.requested_fidelity || "—" }}</code>
          </span>
          <span class="fidelity-arrow">→</span>
          <span class="fidelity-value">
            <b>{{ semanticField("actual_fidelity", entry.actual_fidelity).valueLabel }}</b>
            <code>actual_fidelity = {{ entry.actual_fidelity || "—" }}</code>
          </span>
          <p>
            <small>{{ backendExplanation(entry.detail).label }}</small>
            {{ backendExplanation(entry.detail).text }}
            <code v-if="backendExplanation(entry.detail).mapped">{{ t("后端原文") }}: {{ entry.detail }}</code>
          </p>
          <ArtifactEvidenceLink :source-path="'validation:/resolution_entries/' + index" />
        </div>
      </div>
    </details>

    <details class="panel validation-disclosure">
      <summary>
        <div>
          <h2>{{ t("逐项验证记录") }}</h2>
        </div>
        <div class="panel-count">
          <ShieldCheck :size="16" />{{ t("{count} 项检查", { count: state.bundle.validation.checks?.length || 0 }) }}
        </div>
        <span class="validation-summary-icons"><ChevronDown :size="17" /></span>
      </summary>
      <div class="check-list">
        <div
          v-for="check in state.bundle.validation.checks || []"
          :key="check.check_id"
          class="check-row"
          :class="`check-row--${check.status}`"
        >
          <div class="check-icon">
            <Check v-if="check.status === 'pass'" :size="16" /><CircleMinus v-else :size="16" />
          </div>
          <div>
            <small>{{ executionLayerName(check.subsystem) }} · {{ check.subsystem }}</small
            ><strong>{{ check.check_id }}</strong>
            <p>
              <small>{{ backendExplanation(check.detail).label }}</small>
              {{ backendExplanation(check.detail).text }}
              <code v-if="backendExplanation(check.detail).mapped">{{ t("后端原文") }}: {{ check.detail }}</code>
            </p>
          </div>
          <StatusPill :value="check.status" />
          <ArtifactEvidenceLink
            :source-path="validationCheckSource(state.bundle.validation.checks || [], check.check_id)"
          />
        </div>
      </div>
    </details>
  </div>
</template>
