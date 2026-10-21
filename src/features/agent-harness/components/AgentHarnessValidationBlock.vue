<script setup lang="ts">
import type { AgentHarnessDraftValidationReportV1 } from "../../../lib/api/agent-harness";
import { agentHarnessValidationStatusLabel } from "../presentation";

defineProps<{ validation: AgentHarnessDraftValidationReportV1 }>();
const emit = defineEmits<{ revalidate: [] }>();
</script>

<template>
  <section class="agent-harness-validation" :data-status="validation.status" aria-labelledby="validation-title">
    <header>
      <div>
        <p class="agent-harness-eyebrow">Deterministic validation</p>
        <h3 id="validation-title">确定性校验</h3>
      </div>
      <span role="status">{{ agentHarnessValidationStatusLabel(validation.status) }}</span>
    </header>
    <p class="agent-harness-validation__notice">校验只产生报告，不执行运行；<code>would_create_run = false</code>。</p>
    <dl>
      <div>
        <dt>validation</dt>
        <dd>
          <code>{{ validation.validation_id }}</code>
        </dd>
      </div>
      <div>
        <dt>validator</dt>
        <dd>
          <code>{{ validation.validator_revision }}</code>
        </dd>
      </div>
      <div>
        <dt>snapshot</dt>
        <dd>
          <code>{{ validation.input_snapshot_digest }}</code>
        </dd>
      </div>
    </dl>
    <section v-if="validation.issues.length" aria-labelledby="validation-issues">
      <h4 id="validation-issues">问题</h4>
      <ul>
        <li v-for="(issue, index) in validation.issues" :key="`${validation.validation_id}-issue-${index}`">
          <strong>{{ String(issue.code || "issue") }}</strong
          ><span v-if="issue.field_path">
            · <code>{{ String(issue.field_path) }}</code></span
          ><span> · {{ String(issue.message || "") }}</span>
        </li>
      </ul>
    </section>
    <section v-if="validation.field_results.length" aria-labelledby="validation-fields">
      <h4 id="validation-fields">字段结果</h4>
      <ul>
        <li v-for="field in validation.field_results" :key="String(field.field_id)">
          <code>{{ String(field.field_id) }}</code
          ><span v-if="field.json_pointer">
            · <code>{{ String(field.json_pointer) }}</code></span
          ><span> · {{ String(field.status) }}</span
          ><span v-if="field.reason"> · {{ String(field.reason) }}</span>
        </li>
      </ul>
    </section>
    <p v-if="validation.unsupported_fields.length">
      未支持字段：<code>{{ validation.unsupported_fields.join(", ") }}</code>
    </p>
    <p v-if="validation.stale_reasons.length">失效原因：{{ validation.stale_reasons.join("、") }}</p>
    <p v-if="validation.risk_flags.length">风险：{{ validation.risk_flags.join("、") }}</p>
    <pre v-if="Object.keys(validation.budget_estimate).length">
预算估计：{{ JSON.stringify(validation.budget_estimate, null, 2) }}</pre>
    <button type="button" @click="emit('revalidate')">重新校验</button>
  </section>
</template>

<style scoped>
.agent-harness-validation {
  display: grid;
  gap: 0.6rem;
  padding: 0.75rem;
  border: 1px solid var(--line, #d9e0e5);
  border-radius: 0.6rem;
}
.agent-harness-validation header,
.agent-harness-validation dl > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}
.agent-harness-validation h3,
.agent-harness-validation h4,
.agent-harness-validation p {
  margin: 0;
}
.agent-harness-validation h3 {
  font-size: 0.9rem;
}
.agent-harness-validation h4 {
  font-size: 0.78rem;
}
.agent-harness-validation__notice,
.agent-harness-validation p {
  color: var(--muted, #687783);
  font-size: 0.76rem;
}
.agent-harness-validation dl,
.agent-harness-validation section {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  font-size: 0.75rem;
}
.agent-harness-validation dt {
  color: var(--muted, #687783);
}
.agent-harness-validation dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}
.agent-harness-validation ul {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding-left: 1.1rem;
}
.agent-harness-validation li {
  overflow-wrap: anywhere;
}
.agent-harness-validation pre {
  overflow: auto;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
