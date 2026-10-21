<script setup lang="ts">
import { computed } from "vue";
import type { AgentHarnessExecutionProjection } from "../../../lib/api/agent-harness";

const props = defineProps<{
  projection: AgentHarnessExecutionProjection;
  result?: Record<string, unknown> | null;
  pendingAction?: string | null;
}>();
const emit = defineEmits<{ cancel: []; retry: []; resume: [] }>();

const stateLabels: Record<string, string> = {
  submitted: "已提交",
  queued: "排队中",
  preparing: "准备中",
  running: "运行中",
  waiting_artifacts: "等待工件",
  completed: "已完成",
  failed: "失败",
  cancel_requested: "正在取消",
  cancelled: "已取消",
  retrying: "重试中",
  recovery_required: "需要恢复",
  manual_intervention_required: "需要人工介入",
};
const stateLabel = computed(() => stateLabels[props.projection.state] || props.projection.state);
const canCancel = computed(() =>
  ["submitted", "queued", "preparing", "running", "waiting_artifacts"].includes(props.projection.state),
);
const canRetry = computed(
  () =>
    props.projection.state === "failed" &&
    props.projection.execution.retryable &&
    !props.projection.execution.unknown_outcome,
);
const canResume = computed(() => props.projection.state === "recovery_required");
</script>

<template>
  <article class="agent-harness-execution-card" :data-state="projection.state" data-source="bridge-wpc">
    <header>
      <div>
        <p class="agent-harness-eyebrow">Agent Harness · WPC controlled execution</p>
        <h3>{{ stateLabel }}</h3>
      </div>
      <span role="status">{{
        projection.source === "sse" ? "SSE" : projection.source === "polling" ? "Polling" : "Snapshot"
      }}</span>
    </header>
    <p class="agent-harness-execution-card__boundary" role="note">
      local-dev · synthetic_trace · exploratory · not_for_production。真实 Provider acceptance 与 production review 仍
      pending。
    </p>
    <dl>
      <div>
        <dt>operation</dt>
        <dd>
          <code>{{ projection.execution.operation_id }}</code>
        </dd>
      </div>
      <div>
        <dt>run</dt>
        <dd>
          <code>{{ projection.execution.run_id || "未绑定" }}</code>
        </dd>
      </div>
      <div>
        <dt>事件</dt>
        <dd>{{ projection.events.length }} 个 · Last-Event-ID {{ projection.last_event_sequence }}</dd>
      </div>
      <div>
        <dt>draft / approval</dt>
        <dd>
          <code>{{ projection.execution.draft_id }}</code> / <code>{{ projection.execution.approval_id }}</code>
        </dd>
      </div>
    </dl>
    <p v-if="projection.error" class="agent-harness-execution-card__error" role="alert">
      <strong>{{ projection.error.code }}</strong> {{ projection.error.message }}
    </p>
    <p v-if="projection.requires_recovery" class="agent-harness-execution-card__error" role="alert">
      unknown outcome 或事件/身份不一致；不会自动重试，必须显式 resume 或 cancel。
    </p>
    <ol v-if="projection.events.length" class="agent-harness-execution-card__timeline" aria-label="执行事件时间线">
      <li v-for="event in projection.events" :key="event.event_id">
        <span>#{{ event.sequence }}</span
        ><code>{{ event.node }}</code
        ><span>{{ stateLabels[event.state] || event.state }}</span>
      </li>
    </ol>
    <div class="agent-harness-execution-card__actions" aria-label="执行操作">
      <button v-if="canCancel" type="button" :disabled="Boolean(pendingAction)" @click="emit('cancel')">
        {{ pendingAction === "cancel" ? "取消中…" : "取消" }}
      </button>
      <button v-if="canRetry" type="button" :disabled="Boolean(pendingAction)" @click="emit('retry')">
        {{ pendingAction === "retry" ? "重试中…" : "显式重试" }}
      </button>
      <button v-if="canResume" type="button" :disabled="Boolean(pendingAction)" @click="emit('resume')">
        {{ pendingAction === "resume" ? "恢复中…" : "显式恢复" }}
      </button>
    </div>
    <section v-if="result" class="agent-harness-execution-card__result" aria-label="结果引用">
      <h4>结果引用</h4>
      <p>run/artifact manifest 已通过 schema、run、SHA-256、bytes 和 provenance 绑定校验。</p>
      <code>{{ String(result.manifest_digest || "") }}</code>
    </section>
  </article>
</template>

<style scoped>
.agent-harness-execution-card {
  display: grid;
  gap: 0.65rem;
  padding: 0.85rem;
  border: 1px solid var(--line-strong, #ccd5dc);
  border-radius: 0.7rem;
  background: var(--panel, #fff);
}
.agent-harness-execution-card header,
.agent-harness-execution-card dl > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}
.agent-harness-execution-card h3,
.agent-harness-execution-card p,
.agent-harness-execution-card h4 {
  margin: 0;
}
.agent-harness-execution-card dl,
.agent-harness-execution-card__timeline {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  font-size: 0.75rem;
}
.agent-harness-execution-card dt {
  color: var(--muted, #687783);
}
.agent-harness-execution-card dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}
.agent-harness-execution-card__boundary {
  color: var(--muted, #687783);
  font-size: 0.76rem;
}
.agent-harness-execution-card__error {
  color: var(--danger, #a33131);
  font-size: 0.76rem;
}
.agent-harness-execution-card__timeline {
  list-style: none;
  padding: 0;
}
.agent-harness-execution-card__timeline li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.4rem;
}
.agent-harness-execution-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.agent-harness-execution-card__result {
  display: grid;
  gap: 0.25rem;
  font-size: 0.76rem;
}
.agent-harness-execution-card__result code {
  overflow-wrap: anywhere;
}
</style>
