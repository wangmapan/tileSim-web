<script setup lang="ts">
import { computed, ref } from "vue";
import type { AgentHarnessBatchDetail, AgentHarnessBatchSession } from "../../../contracts/generated/agent-harness";

const props = withDefaults(
  defineProps<{
    batches?: readonly AgentHarnessBatchSession[];
    detail?: AgentHarnessBatchDetail | null;
    pending?: boolean;
    createPending?: boolean;
  }>(),
  { batches: () => [], detail: null, pending: false, createPending: false },
);
const emit = defineEmits<{
  create: [payload: { candidateSetText: string; objectivePath: string; direction: "minimize" | "maximize" }];
  approve: [batchId: string];
  start: [batchId: string];
  pause: [batchId: string];
  resume: [batchId: string];
  retry: [batchId: string];
  cancel: [batchId: string];
}>();
const createOpen = ref(false);
const objectivePath = ref("/tail_latency_summary/ttft_ps/p95_ps");
const direction = ref<"minimize" | "maximize">("minimize");
const candidateSetText = ref(
  '[{"scenario_id":"s1_des_example","fidelity_policy":"des","gpu_participation_mode":"gpu_free"}]',
);
const activeBatch = computed(() => props.detail?.batch || props.batches[0] || null);
const state = computed(() => activeBatch.value?.state || "unavailable");
const candidates = computed(() => props.detail?.candidates || []);
const counts = computed(() => {
  const values = { completed: 0, failed: 0, recovery_required: 0, cancelled: 0 };
  for (const candidate of candidates.value) {
    if (candidate.status in values) values[candidate.status as keyof typeof values] += 1;
  }
  return values;
});
const stopReason = computed(() => {
  const summary = props.detail?.summary || activeBatch.value?.summary;
  const reason = summary && typeof summary === "object" ? summary.stop_reason : null;
  return reason && typeof reason === "object" && "reason" in reason ? String(reason.reason) : "";
});
const summary = computed(() => (props.detail?.summary || activeBatch.value?.summary) as Record<string, unknown> | null);
const bestCandidate = computed(() => {
  const id = summary.value?.best_candidate_id;
  return candidates.value.find((candidate) => candidate.candidate_id === id) || null;
});
const bestValue = computed(() => {
  const value = summary.value?.best_value;
  return typeof value === "number" ? String(value) : "未读取";
});
function candidateObjective(candidate: AgentHarnessBatchDetail["candidates"][number]): string {
  const objective = candidate.result?.objective;
  if (!objective || typeof objective !== "object") return "";
  const value = "value" in objective ? objective.value : "";
  const status = "status" in objective ? objective.status : "";
  return `${String(value)} (${String(status)})`;
}
const canCancel = computed(() =>
  Boolean(activeBatch.value && !["completed", "failed", "cancelled"].includes(String(state.value))),
);
function submitCreate() {
  emit("create", {
    candidateSetText: candidateSetText.value,
    objectivePath: objectivePath.value,
    direction: direction.value,
  });
}
</script>

<template>
  <section
    class="batch-panel"
    aria-label="本地批量实验"
    data-provenance="local_dev synthetic_trace exploratory not_for_production"
  >
    <header class="batch-panel__header">
      <div>
        <p>Agent Harness · Stage 5</p>
        <h3>本地批量实验</h3>
      </div>
      <span>LOCAL DEV · 单并发</span>
    </header>
    <p class="batch-panel__notice">
      批量计划需人工批准；每个 run 仍经过正式 execution endpoint。结果仅为 synthetic / exploratory，不代表生产验收。
    </p>
    <button type="button" :disabled="createPending" @click="createOpen = !createOpen">
      {{ createOpen ? "收起计划" : "创建批量计划" }}
    </button>
    <form v-if="createOpen" class="batch-panel__form" @submit.prevent="submitCreate">
      <label>目标 JSON Pointer <input v-model="objectivePath" required pattern="^/.*" /></label>
      <label
        >方向
        <select v-model="direction">
          <option value="minimize">最小化</option>
          <option value="maximize">最大化</option>
        </select></label
      >
      <label>候选配置 JSON 数组 <textarea v-model="candidateSetText" rows="4" required spellcheck="false" /></label>
      <button type="submit" :disabled="createPending">{{ createPending ? "创建中…" : "创建并等待批准" }}</button>
    </form>
    <p v-if="!activeBatch" class="batch-panel__empty">
      暂无 batch。服务端不可用时不会用 fixture 或 localStorage 补造状态。
    </p>
    <template v-else>
      <dl class="batch-panel__identity">
        <div>
          <dt>Batch</dt>
          <dd>
            <code>{{ activeBatch.batch_id }}</code>
          </dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd :data-state="state">{{ state }}</dd>
        </div>
        <div>
          <dt>候选</dt>
          <dd>{{ candidates.length }}</dd>
        </div>
        <div>
          <dt>完成/失败/恢复</dt>
          <dd>{{ counts.completed }} / {{ counts.failed }} / {{ counts.recovery_required }}</dd>
        </div>
        <div>
          <dt>最佳目标值</dt>
          <dd>{{ bestValue }}</dd>
        </div>
      </dl>
      <div class="batch-panel__boundary">
        <span>local_dev</span><span>synthetic_trace</span><span>exploratory</span><span>not_for_production</span>
      </div>
      <ol class="batch-panel__candidates">
        <li v-for="candidate in candidates" :key="candidate.candidate_id">
          <code>{{ candidate.candidate_id }}</code
          ><span>{{ candidate.status }}</span
          ><small>{{ candidate.candidate_digest }}</small>
          <small v-if="candidate.operation_id">operation: {{ candidate.operation_id }}</small>
          <small v-if="candidate.run_id">run: {{ candidate.run_id }}</small>
          <small v-if="candidate.artifact_manifest_digest">artifact: {{ candidate.artifact_manifest_digest }}</small>
          <small v-if="candidate.result?.objective">objective: {{ candidateObjective(candidate) }}</small>
        </li>
      </ol>
      <p v-if="bestCandidate" class="batch-panel__notice">
        当前最佳候选：<code>{{ bestCandidate.candidate_id }}</code> · 已验证目标值 {{ bestValue }}
      </p>
      <p v-if="detail?.checkpoint" class="batch-panel__notice">
        checkpoint：<code>{{ detail.checkpoint.checkpoint_id }}</code> · 事件
        {{ detail.checkpoint.last_event_sequence }}
      </p>
      <div class="batch-panel__actions">
        <button
          v-if="state === 'waiting_approval'"
          type="button"
          :disabled="pending"
          @click="emit('approve', activeBatch.batch_id)"
        >
          批准批量计划
        </button>
        <button
          v-if="state === 'validated' || (state === 'waiting_approval' && activeBatch.approval?.status === 'approved')"
          type="button"
          :disabled="pending"
          @click="emit('start', activeBatch.batch_id)"
        >
          开始
        </button>
        <button
          v-if="state === 'running' || state === 'queued'"
          type="button"
          :disabled="pending"
          @click="emit('pause', activeBatch.batch_id)"
        >
          暂停
        </button>
        <button
          v-if="state === 'paused'"
          type="button"
          :disabled="pending"
          @click="emit('resume', activeBatch.batch_id)"
        >
          恢复
        </button>
        <button
          v-if="state === 'failed'"
          type="button"
          :disabled="pending"
          @click="emit('retry', activeBatch.batch_id)"
        >
          显式重试
        </button>
        <button v-if="canCancel" type="button" :disabled="pending" @click="emit('cancel', activeBatch.batch_id)">
          取消
        </button>
      </div>
      <p v-if="stopReason" class="batch-panel__notice">停止原因：{{ stopReason }}</p>
    </template>
  </section>
</template>

<style scoped>
.batch-panel {
  display: grid;
  gap: 0.65rem;
  padding: 1rem;
  border: 1px solid var(--line-strong, #ccd5dc);
  border-radius: 0.75rem;
  background: var(--panel, #fff);
  color: var(--text, #18232d);
}
.batch-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
}
.batch-panel__header p {
  margin: 0;
  color: var(--muted, #687783);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.batch-panel h3 {
  margin: 0;
  font-size: 1rem;
}
.batch-panel__header span {
  color: var(--accent, #0b6b62);
  font-size: 0.68rem;
}
.batch-panel__notice,
.batch-panel__empty {
  margin: 0;
  color: var(--muted, #687783);
  font-size: 0.76rem;
  line-height: 1.5;
}
.batch-panel__form {
  display: grid;
  gap: 0.45rem;
  padding: 0.65rem;
  border: 1px dashed var(--line-strong, #ccd5dc);
  border-radius: 0.45rem;
}
.batch-panel__form label {
  display: grid;
  gap: 0.2rem;
  color: var(--muted, #687783);
  font-size: 0.68rem;
}
.batch-panel__form input,
.batch-panel__form select,
.batch-panel__form textarea {
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
.batch-panel__identity {
  display: grid;
  grid-template-columns: 1.5fr 0.8fr 0.6fr 1fr;
  gap: 0.5rem;
  margin: 0;
  padding: 0.6rem 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.batch-panel__identity div {
  min-width: 0;
}
.batch-panel dt {
  color: var(--muted, #687783);
  font-size: 0.66rem;
}
.batch-panel dd {
  margin: 0.2rem 0 0;
  font-size: 0.73rem;
  overflow-wrap: anywhere;
}
.batch-panel__boundary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.batch-panel__boundary span {
  padding: 0.16rem 0.38rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted, #687783);
  font-size: 0.64rem;
}
.batch-panel__candidates {
  display: grid;
  gap: 0.35rem;
  padding: 0;
  margin: 0;
  list-style: none;
}
.batch-panel__candidates li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.2rem 0.5rem;
  padding: 0.45rem;
  border: 1px solid var(--line);
  border-radius: 0.4rem;
  font-size: 0.7rem;
}
.batch-panel__candidates small {
  grid-column: 1 / -1;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.batch-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.batch-panel button {
  min-height: 30px;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--line-strong, #ccd5dc);
  border-radius: 0.35rem;
  background: var(--surface-muted, #f5f7f8);
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
}
.batch-panel button:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>
