<script setup lang="ts">
import { computed, reactive } from "vue";
import type { ExplorationPlanningState } from "../types";

const props = defineProps<{ planning: ExplorationPlanningState }>();
const emit = defineEmits<{
  confirm: [];
  clarify: [values: Record<string, unknown>];
  dismiss: [];
}>();

const plan = () => props.planning.plan;
const statusLabels: Record<string, string> = {
  needs_clarification: "需要补充信息",
  unsupported: "当前能力暂不支持",
  awaiting_confirmation: "等待确认",
  draft_ready: "草案已确认",
};
const valueText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
const questions = () => (Array.isArray(plan().questions) ? plan().questions : []) as unknown[];
const recommendations = () => (Array.isArray(plan().recommendations) ? plan().recommendations : []) as unknown[];
const unsupportedFields = () => (Array.isArray(plan().unsupported_fields) ? plan().unsupported_fields : []) as unknown[];
const questionText = (question: unknown): string => {
  if (typeof question === "string") return question;
  if (question && typeof question === "object") {
    const item = question as Record<string, unknown>;
    return String(item.prompt || item.field || "请补充规划信息");
  }
  return "请补充规划信息";
};
const recommendationText = (recommendation: unknown): string => {
  if (!recommendation || typeof recommendation !== "object") return valueText(recommendation);
  const item = recommendation as Record<string, unknown>;
  const field = item.field ? `${item.field}：` : "";
  const reason = item.reason ? `（理由：${item.reason}）` : "";
  return `${field}${valueText(item.value)}${reason}`;
};
const recommendationId = (recommendation: unknown, index: number): string => {
  if (recommendation && typeof recommendation === "object") {
    const id = (recommendation as Record<string, unknown>).recommendation_id;
    if (typeof id === "string" && id) return id;
  }
  return `recommendation-${index}`;
};
const serialise = (value: unknown): string => {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value ?? ""); }
};
const recommendationField = (value: unknown, fallback: string): string =>
  value && typeof value === "object" && typeof (value as Record<string, unknown>).field === "string"
    ? String((value as Record<string, unknown>).field)
    : fallback;
const recommendationValue = (value: unknown): unknown =>
  value && typeof value === "object" ? (value as Record<string, unknown>).value : value;
const inputs = reactive<Record<string, string>>({});
const editableRecommendations = computed(() => recommendations().map((item, index) => ({
  item,
  index,
  id: recommendationId(item, index),
})).filter(({ id }) => ["fixed-resources", "workload-scenarios", "primary-objective"].includes(id)));
const parseInput = (value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try { return JSON.parse(trimmed); } catch { return trimmed; }
};
function submitClarification(): void {
  const values: Record<string, unknown> = {};
  for (const { id } of editableRecommendations.value) {
    const value = parseInput(inputs[id] ?? "");
    if (value !== undefined) values[id] = value;
  }
  emit("clarify", values);
}
function updateInput(id: string, event: Event): void {
  const target = event.target;
  if (target instanceof HTMLTextAreaElement) inputs[id] = target.value;
}
</script>

<template>
  <section class="agent-exploration-planning-card" data-agent-exploration-planning>
    <header>
      <h3>自动探索规划</h3>
      <strong>{{ statusLabels[String(plan().status)] || "规划中" }}</strong>
    </header>
    <p v-if="plan().message">{{ plan().message }}</p>
    <div v-if="questions().length" class="agent-exploration-planning-card__group">
      <h4>需要确认</h4>
      <ol>
        <li v-for="(question, index) in questions()" :key="`question-${index}`">{{ questionText(question) }}</li>
      </ol>
    </div>
    <div v-if="recommendations().length" class="agent-exploration-planning-card__group">
      <h4>系统建议</h4>
      <ul>
        <li v-for="(recommendation, index) in recommendations()" :key="`recommendation-${index}`">
          {{ recommendationText(recommendation) }}
        </li>
      </ul>
      <p class="agent-exploration-planning-card__notice">建议值与用户输入分开记录；只有确认后才会写入实验草案。</p>
      <div v-if="plan().status === 'needs_clarification' && editableRecommendations.length" class="agent-exploration-planning-card__inputs">
        <label v-for="{ item, id } in editableRecommendations" :key="`input-${id}`">
          <span>{{ recommendationField(item, id) }}</span>
          <textarea
            :data-agent-exploration-recommendation-input="id"
            :placeholder="serialise(recommendationValue(item))"
            :value="inputs[id] || ''"
            rows="2"
            @input="updateInput(id, $event)"
          />
        </label>
        <button type="button" data-agent-exploration-plan-clarify @click="submitClarification">提交补充信息并重新规划</button>
      </div>
    </div>
    <div v-if="unsupportedFields().length" class="agent-exploration-planning-card__group">
      <h4>未开放能力</h4>
      <p>{{ unsupportedFields().map(valueText).join("、") }}</p>
      <p>当前可运行范围：固定资源下选择后端已发布部署候选，再探索批处理调度、最大批处理规模和 KV Cache。</p>
    </div>
    <div class="agent-exploration-planning-card__effects">
      确认前：不创建运行、不调用执行器、不占用实验槽位、不锁定实验页面。
    </div>
    <div class="agent-exploration-planning-card__actions">
      <button
        v-if="plan().status === 'awaiting_confirmation'"
        type="button"
        data-agent-exploration-plan-confirm
        @click="emit('confirm')"
      >
        确认建议并生成草案
      </button>
      <button v-if="plan().status !== 'draft_ready'" type="button" class="secondary" @click="emit('dismiss')">稍后补充</button>
    </div>
  </section>
</template>

<style scoped>
.agent-exploration-planning-card {
  display: grid;
  gap: 0.65rem;
  padding: 0.9rem;
  border: 1px solid color-mix(in srgb, var(--line-strong) 70%, #d4a72c);
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--panel) 92%, #f6e7b1);
}
.agent-exploration-planning-card header { display: flex; justify-content: space-between; gap: 0.5rem; }
.agent-exploration-planning-card h3, .agent-exploration-planning-card h4 { margin: 0; }
.agent-exploration-planning-card h4 { font-size: 0.78rem; }
.agent-exploration-planning-card p, .agent-exploration-planning-card ol, .agent-exploration-planning-card ul { margin: 0; }
.agent-exploration-planning-card ol, .agent-exploration-planning-card ul { padding-left: 1.2rem; }
.agent-exploration-planning-card__group { display: grid; gap: 0.25rem; }
.agent-exploration-planning-card__inputs { display: grid; gap: 0.45rem; }
.agent-exploration-planning-card__inputs label { display: grid; gap: 0.2rem; font-size: 0.78rem; }
.agent-exploration-planning-card__inputs textarea { width: 100%; resize: vertical; font: inherit; }
.agent-exploration-planning-card__notice, .agent-exploration-planning-card__effects { font-size: 0.78rem; color: var(--muted); }
.agent-exploration-planning-card__actions { display: flex; gap: 0.5rem; }
.agent-exploration-planning-card button.secondary { background: transparent; color: inherit; }
</style>
