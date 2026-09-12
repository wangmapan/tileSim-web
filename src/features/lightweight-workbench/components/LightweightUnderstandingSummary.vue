<script setup lang="ts">
import type { LightweightAgentViewModel } from "../model";
defineProps<{ result: LightweightAgentViewModel | null }>();
</script>
<template>
  <section v-if="result" class="lightweight-summary" aria-labelledby="understanding-title">
    <div>
      <p class="section-kicker">第三步</p>
      <h2 id="understanding-title">Agent 理解了什么</h2>
      <p>{{ result.summary }}</p>
    </div>
    <div v-if="result.fields.length" class="lightweight-field-list">
      <div v-for="field in result.fields" :key="field.field_id" class="lightweight-field-row">
        <strong>{{ field.field_id }}</strong
        ><span>{{ field.original_value ?? "未设置" }} → {{ field.proposed_value }} {{ field.unit }}</span
        ><small>来源：{{ field.source }}<template v-if="field.stale"> · stale</template></small>
      </div>
    </div>
    <div v-if="result.missing.length" class="lightweight-callout" role="status">
      <strong>还需要确认</strong>
      <ul>
        <li v-for="item in result.missing" :key="item">{{ item }}</li>
      </ul>
    </div>
    <details v-if="result.blocks.length">
      <summary>查看专业详情</summary>
      <pre>{{ JSON.stringify(result.blocks, null, 2) }}</pre>
    </details>
  </section>
</template>
<style scoped>
.lightweight-summary {
  display: grid;
  gap: 14px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--panel);
}
.lightweight-summary h2 {
  margin: 0;
  font-size: 20px;
}
.lightweight-summary p {
  margin: 4px 0 0;
  color: var(--muted);
}
.lightweight-field-list {
  display: grid;
  gap: 8px;
}
.lightweight-field-row {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-subtle);
}
.lightweight-field-row strong {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  overflow-wrap: anywhere;
}
.lightweight-field-row span {
  font-variant-numeric: tabular-nums;
}
.lightweight-field-row small {
  color: var(--muted);
}
.lightweight-callout {
  padding: 12px;
  border: 1px solid var(--warning);
  border-radius: var(--radius-control);
  background: var(--warning-soft);
}
.lightweight-callout ul {
  margin: 6px 0 0;
  padding-left: 20px;
}
details {
  border-top: 1px solid var(--line);
  padding-top: 10px;
}
pre {
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  font: var(--text-xs)/1.45 var(--font-mono);
}
</style>
