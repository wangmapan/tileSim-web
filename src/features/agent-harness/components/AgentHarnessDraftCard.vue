<script setup lang="ts">
import { computed } from "vue";
import type {
  AgentHarnessApprovalV2,
  AgentHarnessDraftValidationReportV1,
  AgentHarnessExperimentDraftV2,
} from "../../../lib/api/agent-harness";
import {
  agentHarnessApprovalStatusLabel,
  agentHarnessDraftStatusLabel,
  agentHarnessValidationStatusLabel,
} from "../presentation";

const props = withDefaults(
  defineProps<{
    draft: AgentHarnessExperimentDraftV2;
    validation?: AgentHarnessDraftValidationReportV1 | null;
    approval?: AgentHarnessApprovalV2 | null;
  }>(),
  { validation: null, approval: null },
);

const hasRunSideEffect = computed(
  () =>
    props.draft.would_create_run !== false || Boolean(props.validation && props.validation.would_create_run !== false),
);
</script>

<template>
  <article class="agent-harness-draft-card" data-source="bridge-wpb" :data-status="draft.status">
    <header class="agent-harness-draft-card__header">
      <div>
        <p class="agent-harness-eyebrow">Agent Harness · WP-B</p>
        <h3>实验草案</h3>
      </div>
      <span class="agent-harness-draft-card__status" role="status">
        {{ agentHarnessDraftStatusLabel(draft.status) }}
      </span>
    </header>
    <p class="agent-harness-draft-card__notice" role="note">
      本阶段只保存草案、确定性校验和人工审批；不会创建 TileSim 运行。
    </p>
    <p v-if="hasRunSideEffect" class="agent-harness-draft-card__error" role="alert">
      已拒绝：服务端返回了不安全的运行副作用标记。
    </p>
    <dl class="agent-harness-draft-card__facts">
      <div>
        <dt>draft</dt>
        <dd>
          <code>{{ draft.draft_id }}</code>
        </dd>
      </div>
      <div>
        <dt>状态</dt>
        <dd>{{ agentHarnessDraftStatusLabel(draft.status) }}</dd>
      </div>
      <div>
        <dt>snapshot</dt>
        <dd>
          <code>{{ draft.input_snapshot_digest }}</code>
        </dd>
      </div>
      <div>
        <dt>参数目录</dt>
        <dd>
          <code>{{ draft.parameter_catalog_revision }}</code>
        </dd>
      </div>
      <div>
        <dt>validator</dt>
        <dd>
          <code>{{ draft.validator_revision }}</code>
        </dd>
      </div>
      <div>
        <dt>schema-set</dt>
        <dd>
          <code>{{ draft.schema_set_revision }}</code>
        </dd>
      </div>
      <div>
        <dt>有效期</dt>
        <dd>
          <time :datetime="draft.expires_at">{{ draft.expires_at }}</time>
        </dd>
      </div>
    </dl>
    <section v-if="draft.field_diffs.length" class="agent-harness-draft-card__section" aria-labelledby="draft-diffs">
      <h4 id="draft-diffs">参数差异</h4>
      <ul>
        <li v-for="(diff, index) in draft.field_diffs" :key="`${draft.draft_id}-diff-${index}`">
          <code>{{ String(diff.field_id || "field") }}</code>
          <span>{{ String(diff.json_pointer || "") }}</span>
          <span>{{ String(diff.change || "") }}</span>
        </li>
      </ul>
    </section>
    <section
      v-if="draft.assumptions.length"
      class="agent-harness-draft-card__section"
      aria-labelledby="draft-assumptions"
    >
      <h4 id="draft-assumptions">假设</h4>
      <ul>
        <li v-for="assumption in draft.assumptions" :key="assumption">{{ assumption }}</li>
      </ul>
    </section>
    <section
      v-if="draft.evidence_refs.length"
      class="agent-harness-draft-card__section"
      aria-labelledby="draft-evidence"
    >
      <h4 id="draft-evidence">证据引用</h4>
      <ul>
        <li v-for="reference in draft.evidence_refs" :key="reference">
          <code>{{ reference }}</code>
        </li>
      </ul>
    </section>
    <section
      v-if="draft.risk_flags.length || Object.keys(draft.budget_request).length"
      class="agent-harness-draft-card__section"
      aria-labelledby="draft-risk"
    >
      <h4 id="draft-risk">风险与预算</h4>
      <ul>
        <li v-for="risk in draft.risk_flags" :key="risk">{{ risk }}</li>
      </ul>
      <pre v-if="Object.keys(draft.budget_request).length">{{ JSON.stringify(draft.budget_request, null, 2) }}</pre>
    </section>
    <p v-if="validation" class="agent-harness-draft-card__binding" role="status">
      校验：{{ agentHarnessValidationStatusLabel(validation.status) }} · {{ validation.validation_id }}
    </p>
    <p v-if="approval" class="agent-harness-draft-card__binding" role="status">
      审批：{{ agentHarnessApprovalStatusLabel(approval.status) }} · {{ approval.approval_id }}（不会启动实验）
    </p>
  </article>
</template>

<style scoped>
.agent-harness-draft-card {
  display: grid;
  gap: 0.7rem;
  padding: 0.85rem;
  border: 1px solid var(--line-strong, #ccd5dc);
  border-radius: 0.7rem;
  background: var(--panel, #fff);
}
.agent-harness-draft-card__header,
.agent-harness-draft-card__facts > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}
.agent-harness-draft-card h3,
.agent-harness-draft-card h4,
.agent-harness-draft-card p {
  margin: 0;
}
.agent-harness-draft-card h3 {
  font-size: 0.95rem;
}
.agent-harness-draft-card h4 {
  font-size: 0.8rem;
}
.agent-harness-draft-card__notice,
.agent-harness-draft-card__binding {
  color: var(--muted, #687783);
  font-size: 0.78rem;
}
.agent-harness-draft-card__error {
  color: var(--danger, #a33131);
  font-weight: 600;
}
.agent-harness-draft-card__facts,
.agent-harness-draft-card__section {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  font-size: 0.76rem;
}
.agent-harness-draft-card__facts dt {
  color: var(--muted, #687783);
}
.agent-harness-draft-card__facts dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}
.agent-harness-draft-card__section ul {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding-left: 1.1rem;
}
.agent-harness-draft-card__section li {
  overflow-wrap: anywhere;
}
.agent-harness-draft-card pre {
  max-width: 100%;
  overflow: auto;
  margin: 0;
  padding: 0.45rem;
  background: var(--surface-muted, #f5f7f8);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
