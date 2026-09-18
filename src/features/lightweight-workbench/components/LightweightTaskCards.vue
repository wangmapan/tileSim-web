<script setup lang="ts">
import { LIGHTWEIGHT_TASK_CATEGORIES, type LightweightTaskTemplate } from "./task-catalog";
import { useI18n } from "../../../i18n";
import { emitLightweightTelemetry } from "../telemetry";

const emit = defineEmits<{ select: [template: LightweightTaskTemplate] }>();
const { t } = useI18n();

function selectTemplate(template: LightweightTaskTemplate): void {
  emitLightweightTelemetry("lightweight_task_selected", { task_id: template.id, example: template.kind === "example" });
  emit("select", template);
}
</script>

<template>
  <section
    class="lightweight-task-cards"
    aria-labelledby="lightweight-task-title"
    data-help-anchor="lightweight_tasks-cards"
  >
    <div>
      <h2 id="lightweight-task-title">{{ t("你想完成什么？") }}</h2>
    </div>
    <div class="lightweight-task-category-grid">
      <article v-for="category in LIGHTWEIGHT_TASK_CATEGORIES" :key="category.id" class="lightweight-task-category">
        <header class="lightweight-task-category__header">
          <h3>{{ t(category.title) }}</h3>
          <p>{{ t(category.description) }}</p>
        </header>
        <div class="lightweight-task-template-list">
          <button
            v-for="template in category.templates"
            :key="template.id"
            type="button"
            class="lightweight-task-card"
            @click="selectTemplate(template)"
          >
            <span class="lightweight-task-card__title-row">
              <strong>{{ t(template.title) }}</strong>
              <span v-if="template.kind === 'example'" class="lightweight-task-card__badge">{{ t("example") }}</span>
            </span>
            <span class="lightweight-task-card__summary">{{ t(template.summary) }}</span>
            <dl class="lightweight-task-card__meta">
              <div>
                <dt>{{ t("适用人群") }}</dt>
                <dd>{{ t(template.audience) }}</dd>
              </div>
              <div>
                <dt>{{ t("预计耗时") }}</dt>
                <dd>{{ t(template.duration) }}</dd>
              </div>
              <div>
                <dt>{{ t("运行") }}</dt>
                <dd>{{ template.readonly ? t("仅查看") : t("可提交正式 run") }}</dd>
              </div>
              <div>
                <dt>{{ t("产物") }}</dt>
                <dd>{{ t(template.artifacts) }}</dd>
              </div>
              <div>
                <dt>{{ t("副作用") }}</dt>
                <dd>{{ t(template.sideEffects) }}</dd>
              </div>
            </dl>
            <span v-if="template.exampleLabel" class="lightweight-task-card__example-note">{{
              t(template.exampleLabel)
            }}</span>
            <span class="lightweight-task-card__action">{{ t("选择任务 →") }}</span>
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.lightweight-task-cards {
  display: grid;
  gap: 14px;
}
.lightweight-task-cards h2 {
  margin: 0;
  font-size: 20px;
}
.lightweight-task-category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.lightweight-task-category {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--surface-subtle);
}
.lightweight-task-category__header {
  display: grid;
  gap: 4px;
}
.lightweight-task-category__header h3 {
  margin: 0;
  font-size: 18px;
}
.lightweight-task-category__header p {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: 1.45;
}
.lightweight-task-template-list {
  display: grid;
  gap: 10px;
}
.lightweight-task-card {
  display: grid;
  gap: 8px;
  width: 100%;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  color: var(--ink);
  background: var(--panel);
  text-align: left;
  cursor: pointer;
}
.lightweight-task-card:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.lightweight-task-card:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
}
.lightweight-task-card__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.lightweight-task-card__title-row strong {
  line-height: 1.35;
}
.lightweight-task-card__badge {
  flex: 0 0 auto;
  padding: 2px 6px;
  border: 1px solid var(--warning);
  border-radius: 999px;
  color: var(--warning-ink, var(--ink));
  background: var(--warning-soft);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.lightweight-task-card__summary,
.lightweight-task-card__example-note {
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: 1.45;
}
.lightweight-task-card__meta {
  display: grid;
  gap: 5px;
  margin: 0;
  font-size: var(--text-xs);
}
.lightweight-task-card__meta div {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 7px;
}
.lightweight-task-card__meta dt {
  color: var(--muted);
}
.lightweight-task-card__meta dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.lightweight-task-card__example-note {
  padding-top: 7px;
  border-top: 1px dashed var(--line);
  color: var(--warning-ink, var(--muted));
}
.lightweight-task-card__action {
  color: var(--accent);
  font-size: var(--text-sm);
  font-weight: 650;
}
@media (max-width: 600px) {
  .lightweight-task-category-grid {
    grid-template-columns: 1fr;
  }
}
</style>
