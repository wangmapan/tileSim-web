<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight } from "@lucide/vue";
import { RouterLink, useRoute } from "vue-router";
import { LightweightLearningCards, preserveWorkbenchQuery } from "../features/lightweight-workbench";
import { useI18n } from "../i18n";

const route = useRoute();
const { t } = useI18n();
const query = computed(() => preserveWorkbenchQuery(route.query));
</script>

<template>
  <div class="lightweight-learn-view" aria-labelledby="lightweight-learn-title">
    <header class="lightweight-page__heading">
      <p class="section-kicker">{{ t("学习") }}</p>
      <h1 id="lightweight-learn-title">{{ t("理解字段和结果边界") }}</h1>
      <p>{{ t("这里是可选参考，不是运行前置步骤；你可以随时回到配置或结果页面。") }}</p>
    </header>

    <LightweightLearningCards />

    <section class="lightweight-learn-grid" aria-label="状态与证据说明">
      <article class="panel lightweight-learn-card">
        <p class="section-kicker">{{ t("运行状态") }}</p>
        <h2>{{ t("状态告诉你下一步") }}</h2>
        <dl>
          <div>
            <dt>queued / preparing</dt>
            <dd>{{ t("等待或准备执行") }}</dd>
          </div>
          <div>
            <dt>running</dt>
            <dd>{{ t("后端正在执行") }}</dd>
          </div>
          <div>
            <dt>completed</dt>
            <dd>{{ t("可以读取结果") }}</dd>
          </div>
          <div>
            <dt>failed / unavailable</dt>
            <dd>{{ t("查看原因并按契约处理") }}</dd>
          </div>
          <div>
            <dt>incomplete</dt>
            <dd>{{ t("报告字段不足，不能补造结论") }}</dd>
          </div>
        </dl>
      </article>
      <article class="panel lightweight-learn-card">
        <p class="section-kicker">{{ t("证据边界") }}</p>
        <h2>{{ t("来源和 fidelity 要分开看") }}</h2>
        <ul>
          <li>{{ t("requested fidelity 是请求意图，resolved fidelity 只能由后端报告确认。") }}</li>
          <li>{{ t("real_trace、synthetic_trace 和 compatibility_harness_trace 不会互相升级。") }}</li>
          <li>{{ t("0 是合法数值；missing、not covered、stale 和 unsupported 各自代表不同边界。") }}</li>
        </ul>
      </article>
    </section>

    <nav class="lightweight-learn-actions" aria-label="学习后的下一步">
      <RouterLink class="button button--primary" :to="{ name: 'lightweight_prepare', query }">
        {{ t("去配置实验") }} <ArrowRight :size="16" />
      </RouterLink>
      <RouterLink class="text-link" :to="{ name: 'lightweight', query }">{{ t("回到开始") }}</RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.lightweight-learn-view {
  display: grid;
  gap: 24px;
  max-width: 1080px;
}
.lightweight-learn-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.lightweight-learn-card {
  display: grid;
  gap: 14px;
  padding: 22px;
}
.lightweight-learn-card h2 {
  margin: 0;
  font-size: 20px;
}
.lightweight-learn-card dl,
.lightweight-learn-card ul {
  display: grid;
  gap: 10px;
  margin: 0;
}
.lightweight-learn-card dl div {
  display: grid;
  grid-template-columns: minmax(130px, 0.65fr) minmax(0, 1fr);
  gap: 12px;
  padding-top: 9px;
  border-top: 1px solid var(--line);
}
.lightweight-learn-card dt {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
.lightweight-learn-card dd {
  margin: 0;
}
.lightweight-learn-card li {
  line-height: 1.55;
}
.lightweight-learn-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.text-link {
  color: var(--accent);
  font-weight: 700;
  text-decoration: none;
}
@media (max-width: 760px) {
  .lightweight-learn-grid {
    grid-template-columns: 1fr;
  }
}
</style>
