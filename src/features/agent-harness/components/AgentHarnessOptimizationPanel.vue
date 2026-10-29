<script setup lang="ts">
import { computed } from "vue";
import { ref } from "vue";
import type {
  AgentHarnessOptimizationCandidate,
  AgentHarnessOptimizationDetail,
  AgentHarnessOptimizationSession,
} from "../../../lib/api/agent-harness";
import { optimizationStateLabel, OPTIMIZATION_PROVENANCE } from "../../../lib/api/agent-optimization";

const props = defineProps<{
  sessions?: readonly AgentHarnessOptimizationSession[];
  detail?: AgentHarnessOptimizationDetail | null;
  pending?: boolean;
  createPending?: boolean;
}>();
const emit = defineEmits<{
  approve: [sessionId: string, candidateId: string];
  pause: [sessionId: string];
  resume: [sessionId: string];
  retry: [sessionId: string];
  cancel: [sessionId: string];
  create: [payload: { objectivePath: string; direction: "minimize" | "maximize"; baseConfigText: string }];
}>();
const createOpen = ref(false);
const objectivePath = ref("/tail_latency_summary/ttft_ps/p95_ps");
const direction = ref<"minimize" | "maximize">("minimize");
const baseConfigText = ref(
  '{"scenario_id":"s1_des_example","fidelity_policy":"des","gpu_participation_mode":"gpu_free"}',
);
const sessions = computed(() => props.sessions || []);
const currentCandidate = computed<AgentHarnessOptimizationCandidate | null>(() => props.detail?.candidate || null);
const changedFields = computed(() => {
  const values = currentCandidate.value?.diff?.changed_fields;
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : [];
});
const expectedSideEffects = computed(() => {
  const values = currentCandidate.value?.expected_side_effects;
  return Array.isArray(values) ? values.map(String) : [];
});
const activeSession = computed(() => props.detail?.session || sessions.value[0] || null);
const state = computed(() => activeSession.value?.state || null);
const isWaitingApproval = computed(
  () => state.value === "waiting_approval" && currentCandidate.value?.status === "waiting_approval",
);
const isPaused = computed(() => state.value === "paused");
const hasActive = computed(() =>
  Boolean(
    activeSession.value &&
    !["completed", "failed", "cancelled", "recovery_required", "manual_intervention_required"].includes(
      String(state.value),
    ),
  ),
);
const canCancel = computed(() =>
  Boolean(activeSession.value && !["completed", "failed", "cancelled"].includes(String(state.value))),
);
const sessionErrorCode = computed(() => {
  const error = activeSession.value?.error;
  return error && typeof error === "object" && "code" in error ? String(error.code) : "";
});
const activeOperationId = computed(() => activeSession.value?.active_operation_id || "");
const latestEvaluation = computed(() => {
  const evaluations = props.detail?.evaluations;
  return Array.isArray(evaluations) && evaluations.length ? evaluations[evaluations.length - 1] : null;
});
const evaluationValue = computed(() => {
  const objective = latestEvaluation.value?.objective;
  return objective && typeof objective === "object" && "value" in objective ? String(objective.value) : "未读取";
});
</script>

<template>
  <section
    class="optimization-panel"
    aria-label="本地受控优化"
    data-provenance="local_dev synthetic_trace exploratory not_for_production"
  >
    <header class="optimization-panel__header">
      <div>
        <p class="optimization-panel__eyebrow">Agent Harness · Stage 4</p>
        <h3>本地受控优化</h3>
      </div>
      <span class="optimization-panel__mode">LOCAL DEV</span>
    </header>
    <p class="optimization-panel__notice">
      每个候选都需要人工批准；结果仅用于 synthetic / exploratory，不代表真实 Provider、硬件校准或生产验收。
    </p>

    <p v-if="!activeSession" class="optimization-panel__empty">
      暂无优化 session。创建 session 需要显式 local-dev 开关。
    </p>
    <div class="optimization-panel__create">
      <button type="button" :disabled="createPending" @click="createOpen = !createOpen">
        {{ createOpen ? "收起创建表单" : "创建本地优化 session" }}
      </button>
      <form v-if="createOpen" @submit.prevent="emit('create', { objectivePath, direction, baseConfigText })">
        <label>目标 JSON Pointer <input v-model="objectivePath" type="text" required pattern="^/.*" /></label>
        <label
          >方向
          <select v-model="direction">
            <option value="minimize">最小化</option>
            <option value="maximize">最大化</option>
          </select>
        </label>
        <label
          >候选基础配置（正式 run request JSON）
          <textarea v-model="baseConfigText" rows="4" required spellcheck="false" />
        </label>
        <small>配置会先经过正式参数 validator；保存的是 digest，不保存模型回答或 credential。</small>
        <button type="submit" :disabled="createPending">{{ createPending ? "创建中…" : "创建并等待人工批准" }}</button>
      </form>
    </div>
    <template v-if="activeSession">
      <div class="optimization-panel__identity">
        <div>
          <span>Session</span><code>{{ activeSession.session_id }}</code>
        </div>
        <div>
          <span>状态</span><strong :data-state="state">{{ optimizationStateLabel(state) }}</strong>
        </div>
        <div>
          <span>迭代</span
          ><strong
            >{{ activeSession.current_iteration ?? 0 }} / {{ activeSession.budget?.max_iterations ?? "—" }}</strong
          >
        </div>
        <div v-if="activeOperationId">
          <span>Operation</span><code>{{ activeOperationId }}</code>
        </div>
      </div>
      <div class="optimization-panel__boundary" role="status">
        <span v-for="label in Object.values(OPTIMIZATION_PROVENANCE)" :key="label">{{ label }}</span>
      </div>

      <article v-if="currentCandidate" class="optimization-panel__candidate">
        <header>
          <div>
            <span class="optimization-panel__eyebrow">当前候选</span>
            <h4>{{ currentCandidate.candidate_id }}</h4>
          </div>
          <span :data-state="currentCandidate.status">{{ currentCandidate.status }}</span>
        </header>
        <dl>
          <div>
            <dt>候选 digest</dt>
            <dd>
              <code>{{ currentCandidate.candidate_digest }}</code>
            </dd>
          </div>
          <div>
            <dt>变更字段</dt>
            <dd>{{ changedFields.join(", ") || "未声明" }}</dd>
          </div>
          <div>
            <dt>副作用</dt>
            <dd>{{ expectedSideEffects.join("；") }}</dd>
          </div>
        </dl>
        <div class="optimization-panel__actions">
          <button
            v-if="isWaitingApproval"
            type="button"
            :disabled="pending"
            @click="emit('approve', activeSession.session_id, currentCandidate.candidate_id)"
          >
            批准候选并提交
          </button>
          <button
            v-if="hasActive && !isPaused"
            type="button"
            :disabled="pending"
            @click="emit('pause', activeSession.session_id)"
          >
            暂停
          </button>
          <button v-if="isPaused" type="button" :disabled="pending" @click="emit('resume', activeSession.session_id)">
            恢复
          </button>
          <button
            v-if="state === 'failed'"
            type="button"
            :disabled="pending"
            @click="emit('retry', activeSession.session_id)"
          >
            显式重试
          </button>
          <button
            v-if="canCancel"
            type="button"
            class="optimization-panel__danger"
            :disabled="pending"
            @click="emit('cancel', activeSession.session_id)"
          >
            取消
          </button>
        </div>
      </article>

      <dl v-if="latestEvaluation" class="optimization-panel__evaluation">
        <div>
          <dt>已校验目标值</dt>
          <dd>{{ evaluationValue }}</dd>
        </div>
        <div>
          <dt>证据引用</dt>
          <dd>
            {{ Array.isArray(latestEvaluation.evidence) ? latestEvaluation.evidence.length : 0 }} 条（仅 digest /
            Pointer）
          </dd>
        </div>
      </dl>
      <dl v-if="props.detail?.tool_invocations?.length" class="optimization-panel__tools">
        <div v-for="tool in props.detail.tool_invocations" :key="String(tool.invocation_id)">
          <dt>{{ tool.tool_name }}</dt>
          <dd>{{ tool.outcome || "unknown" }} · {{ tool.result_digest || tool.error_code || "—" }}</dd>
        </div>
      </dl>

      <ol v-if="props.detail?.iterations?.length" class="optimization-panel__timeline" aria-label="优化迭代">
        <li v-for="iteration in props.detail.iterations" :key="String(iteration.iteration_id)">
          <span>{{ iteration.sequence }}</span>
          <div>
            <strong>{{ iteration.state }}</strong
            ><small>{{ iteration.candidate_id }}</small>
          </div>
        </li>
      </ol>
      <p v-if="sessionErrorCode" class="optimization-panel__error" role="alert">{{ sessionErrorCode }}</p>
    </template>
  </section>
</template>

<style scoped>
.optimization-panel {
  display: grid;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px solid var(--line-strong, #ccd5dc);
  border-radius: 0.75rem;
  background: var(--panel, #fff);
  color: var(--text, #18232d);
}
.optimization-panel__header,
.optimization-panel__candidate header,
.optimization-panel__identity {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
}
.optimization-panel__eyebrow {
  margin: 0;
  color: var(--muted, #687783);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.optimization-panel h3,
.optimization-panel h4 {
  margin: 0;
}
.optimization-panel h3 {
  font-size: 1rem;
}
.optimization-panel h4 {
  font-size: 0.82rem;
}
.optimization-panel__mode {
  color: var(--accent, #0b6b62);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
}
.optimization-panel__notice,
.optimization-panel__empty,
.optimization-panel__error {
  margin: 0;
  color: var(--muted, #687783);
  font-size: 0.76rem;
  line-height: 1.5;
}
.optimization-panel__create {
  display: grid;
  gap: 0.45rem;
}
.optimization-panel__create form {
  display: grid;
  gap: 0.45rem;
  padding: 0.65rem;
  border: 1px dashed var(--line-strong, #ccd5dc);
  border-radius: 0.45rem;
}
.optimization-panel__create label {
  display: grid;
  gap: 0.2rem;
  color: var(--muted, #687783);
  font-size: 0.68rem;
}
.optimization-panel__create input,
.optimization-panel__create select,
.optimization-panel__create textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--line, #d9e0e5);
  border-radius: 0.3rem;
  padding: 0.35rem;
  background: var(--panel, #fff);
  color: inherit;
  font: inherit;
  font-size: 0.74rem;
}
.optimization-panel__create small {
  color: var(--muted, #687783);
  font-size: 0.66rem;
  line-height: 1.4;
}
.optimization-panel__identity {
  display: grid;
  grid-template-columns: 1.4fr 0.8fr 0.8fr;
  padding: 0.65rem;
  border-top: 1px solid var(--line, #d9e0e5);
  border-bottom: 1px solid var(--line, #d9e0e5);
}
.optimization-panel__identity div {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.optimization-panel__identity span,
.optimization-panel dt {
  color: var(--muted, #687783);
  font-size: 0.68rem;
}
.optimization-panel code {
  font-size: 0.7rem;
  overflow-wrap: anywhere;
}
.optimization-panel__boundary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.optimization-panel__boundary span {
  padding: 0.18rem 0.4rem;
  border: 1px solid var(--line, #d9e0e5);
  border-radius: 999px;
  color: var(--muted, #687783);
  font-size: 0.66rem;
}
.optimization-panel__candidate {
  display: grid;
  gap: 0.65rem;
  padding: 0.7rem;
  border: 1px solid var(--line, #d9e0e5);
  border-radius: 0.55rem;
}
.optimization-panel__candidate header > span {
  font-size: 0.68rem;
  color: var(--muted, #687783);
}
.optimization-panel__candidate dl {
  display: grid;
  gap: 0.45rem;
  margin: 0;
}
.optimization-panel__candidate dl div {
  display: grid;
  grid-template-columns: 6rem 1fr;
  gap: 0.5rem;
}
.optimization-panel dd {
  margin: 0;
  font-size: 0.74rem;
  overflow-wrap: anywhere;
}
.optimization-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.optimization-panel button {
  min-height: 2rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--accent, #0b6b62);
  border-radius: 0.35rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 0.74rem;
}
.optimization-panel button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent, #0b6b62) 10%, transparent);
}
.optimization-panel button:disabled {
  cursor: wait;
  opacity: 0.55;
}
.optimization-panel__danger {
  border-color: var(--danger, #a33c3c) !important;
}
.optimization-panel__timeline {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.optimization-panel__timeline li {
  display: flex;
  gap: 0.55rem;
  align-items: baseline;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--line, #d9e0e5);
  font-size: 0.74rem;
}
.optimization-panel__timeline li > span {
  color: var(--muted, #687783);
}
.optimization-panel__timeline div {
  display: grid;
  gap: 0.1rem;
}
.optimization-panel__timeline small {
  color: var(--muted, #687783);
}
.optimization-panel__evaluation,
.optimization-panel__tools {
  display: grid;
  gap: 0.35rem;
  margin: 0;
}
.optimization-panel__evaluation div,
.optimization-panel__tools div {
  display: grid;
  grid-template-columns: 6rem 1fr;
  gap: 0.5rem;
}
@media (max-width: 700px) {
  .optimization-panel__identity {
    grid-template-columns: 1fr;
  }
  .optimization-panel__candidate dl div {
    grid-template-columns: 1fr;
    gap: 0.15rem;
  }
}
</style>
