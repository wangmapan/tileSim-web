<script setup>
import { AlertTriangle, Check, CircleMinus, Layers3, ShieldCheck } from "@lucide/vue";
import EmptyState from "../components/EmptyState.vue";
import StatusPill from "../components/StatusPill.vue";
import { formatPercent, statusLabel } from "../lib/format";
import { useDashboard } from "../store/dashboard";
const { state, evidence } = useDashboard();
</script>

<template>
  <EmptyState v-if="!state.bundle.validation" title="没有验证报告" />
  <div v-else class="view-stack">
    <section class="provenance-grid">
      <article>
        <small>TRACE SOURCE</small><StatusPill :value="evidence.sourceMode" />
        <p>数据来自哪里</p>
      </article>
      <article>
        <small>CALIBRATION</small><StatusPill :value="evidence.calibration" />
        <p>是否经过真实校准</p>
      </article>
      <article>
        <small>CLAIM SCOPE</small><StatusPill :value="evidence.claimScope" />
        <p>结果允许支持什么结论</p>
      </article>
      <article>
        <small>COMPLETENESS</small><strong>{{ formatPercent(state.bundle.validation.completeness) }}</strong>
        <p>证据字段覆盖程度</p>
      </article>
    </section>

    <article v-if="state.bundle.validation.resolution_entries?.length" class="panel">
      <header class="panel-header">
        <div>
          <p class="section-kicker">FIDELITY RESOLUTION</p>
          <h2>逐子系统实际保真度</h2>
          <p>请求的 fidelity 不等于每个子系统最终执行的 fidelity；以报告的实际解析结果为准。</p>
        </div>
        <Layers3 :size="21" />
      </header>
      <div class="fidelity-matrix">
        <div v-for="entry in state.bundle.validation.resolution_entries" :key="entry.subsystem" class="fidelity-row">
          <strong>{{ entry.subsystem }}</strong
          ><span>{{ statusLabel(entry.requested_fidelity) }}</span
          ><span class="fidelity-arrow">→</span><StatusPill :value="entry.actual_fidelity" />
          <p>{{ entry.detail }}</p>
        </div>
      </div>
    </article>

    <article class="panel">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">VALIDATION CHECKS</p>
          <h2>验证检查</h2>
        </div>
        <div class="panel-count">
          <ShieldCheck :size="16" />{{ state.bundle.validation.checks?.length || 0 }} checks
        </div>
      </header>
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
        </div>
      </div>
    </article>

    <section v-if="state.bundle.validation.open_gaps?.length" class="gap-panel">
      <header>
        <AlertTriangle :size="19" />
        <div>
          <strong>仍未关闭的证据缺口</strong>
          <p>这些限制会直接缩小本次运行可支持的结论。</p>
        </div>
      </header>
      <ul>
        <li v-for="gap in state.bundle.validation.open_gaps" :key="gap">{{ gap }}</li>
      </ul>
    </section>
  </div>
</template>
