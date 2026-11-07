<script setup lang="ts">
import { coverageLabel } from "../model/coverage";
import type { ReplayCoverage } from "../model/types";

defineProps<{ coverage: ReplayCoverage; compact?: boolean }>();
</script>

<template>
  <section class="replay-coverage-state" :class="{ 'is-compact': compact }" :data-status="coverage.status">
    <div class="replay-coverage-state__headline">
      <span class="section-kicker">证据边界</span>
      <strong>{{ coverageLabel(coverage.status) }}</strong>
    </div>
    <p v-if="!compact" class="replay-coverage-state__copy">
      回放只移动后端已报告的时间、设备和链路事实；未报告内容不会生成推断路径或动画。
    </p>
    <ul v-if="coverage.reasons.length && !compact" class="replay-coverage-state__reasons">
      <li v-for="reason in coverage.reasons" :key="reason">{{ reason }}</li>
    </ul>
  </section>
</template>

<style scoped>
.replay-coverage-state {
  display: grid;
  gap: 6px;
  padding: 11px 22px 13px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  background: var(--surface-subtle);
  font-size: var(--text-xs);
}
.replay-coverage-state__headline {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.replay-coverage-state__headline strong {
  color: var(--ink-soft);
}
.replay-coverage-state[data-status="available"] .replay-coverage-state__headline strong {
  color: var(--positive-ink);
}
.replay-coverage-state[data-status="unsupported_schema"] .replay-coverage-state__headline strong {
  color: var(--danger-ink);
}
.replay-coverage-state__copy,
.replay-coverage-state__reasons {
  margin: 0;
}
.replay-coverage-state__reasons {
  display: grid;
  gap: 3px;
  padding-left: 18px;
}
.replay-coverage-state.is-compact {
  display: inline-flex;
  padding: 5px 9px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--surface-muted);
  white-space: nowrap;
}
.replay-coverage-state.is-compact .section-kicker {
  display: none;
}
</style>
