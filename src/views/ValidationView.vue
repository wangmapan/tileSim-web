<script setup lang="ts">
import { AlertTriangle, Check, ChevronDown, CircleMinus, Layers3, ShieldCheck } from "@lucide/vue";
import EmptyState from "../components/EmptyState.vue";
import StatusPill from "../components/StatusPill.vue";
import { formatPercent, statusLabel } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";
import ArtifactEvidenceLink from "../components/ArtifactEvidenceLink.vue";
import { validationCheckSource } from "../features/execution-inspector";
const { state, evidence } = useDashboard();
const { t } = useI18n();

function gapLabel(gap: string) {
  if (gap === "Synthetic-trace validation cannot stand in for held-out real-trace fidelity claims.") {
    return t("合成数据检查不能替代使用独立真实数据进行的可信度验证。");
  }
  return gap;
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
      <article data-help-anchor="validation-provenance">
        <small>{{ t("数据来源") }}</small
        ><StatusPill :value="evidence.sourceMode" />
        <p>{{ t("说明输入是真实采集、合成生成还是兼容测试数据。") }}</p>
      </article>
      <article>
        <small>{{ t("校准状态") }}</small
        ><StatusPill :value="evidence.calibration" />
        <p>{{ t("说明结果是否与真实硬件测量对齐。") }}</p>
      </article>
      <article>
        <small>{{ t("可用范围") }}</small
        ><StatusPill :value="evidence.claimScope" />
        <p>{{ t("说明这些结果适合探索，还是可以支持更正式的判断。") }}</p>
      </article>
      <article>
        <small>{{ t("证据完整度") }}</small
        ><strong>{{ formatPercent(state.bundle.validation.completeness) }}</strong>
        <p>{{ t("表示需要的证据字段覆盖了多少，不是准确率。") }}</p>
      </article>
    </section>

    <section v-if="state.bundle.validation.open_gaps?.length" class="gap-panel" data-help-anchor="validation-gaps">
      <header>
        <AlertTriangle :size="19" />
        <div>
          <strong>{{ t("仍需注意") }}</strong>
          <p>{{ t("下面的问题尚未解决，因此本次结果只能支持有限结论。") }}</p>
        </div>
      </header>
      <ul>
        <li v-for="(gap, index) in state.bundle.validation.open_gaps" :key="gap">
          <span>{{ gapLabel(gap) }}</span
          ><ArtifactEvidenceLink :source-path="'validation:/open_gaps/' + index" />
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
          <p class="section-kicker">{{ t("专业详情") }}</p>
          <h2>{{ t("各环节实际使用的模拟精度") }}</h2>
          <p>{{ t("你选择的精度可能因环节能力而调整；展开后可查看每个环节最终使用的精度。") }}</p>
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
          <strong>{{ entry.subsystem }}</strong
          ><span>{{ statusLabel(entry.requested_fidelity) }}</span
          ><span class="fidelity-arrow">→</span><StatusPill :value="entry.actual_fidelity" />
          <p>{{ entry.detail }}</p>
          <ArtifactEvidenceLink :source-path="'validation:/resolution_entries/' + index" />
        </div>
      </div>
    </details>

    <details class="panel validation-disclosure">
      <summary>
        <div>
          <p class="section-kicker">{{ t("专业详情") }}</p>
          <h2>{{ t("逐项验证记录") }}</h2>
          <p>{{ t("按需查看逐项状态、说明和精确证据链接。") }}</p>
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
            <small>{{ check.subsystem }}</small
            ><strong>{{ check.check_id }}</strong>
            <p>{{ check.detail }}</p>
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
