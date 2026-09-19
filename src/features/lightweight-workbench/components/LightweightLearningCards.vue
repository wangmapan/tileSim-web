<script setup lang="ts">
import { useI18n } from "../../../i18n";

const { t } = useI18n();

export interface LearningCard {
  id: string;
  title: string;
  summary: string;
  takeaway: string;
}

withDefaults(
  defineProps<{
    cards?: readonly LearningCard[];
  }>(),
  {
    cards: () => [
      {
        id: "workload",
        title: "工作负载是什么？",
        summary: "工作负载描述系统要处理的请求形态，例如消息大小和到达节奏。",
        takeaway: "先说清楚要处理什么，再讨论系统怎样处理。",
      },
      {
        id: "latency",
        title: "延迟与吞吐",
        summary: "延迟关注一次请求等多久，吞吐关注一段时间内完成多少请求。",
        takeaway: "两者可能互相牵制，结果应结合目标和证据阅读。",
      },
      {
        id: "evidence",
        title: "结果从哪里来？",
        summary: "这张说明卡只展示已有、合法且可验证的数据，不会补造指标。",
        takeaway: "看见 unavailable、unknown 或 stale 时，应把它当作边界而不是结论。",
      },
    ],
  },
);
</script>

<template>
  <section class="lightweight-learning" aria-labelledby="lightweight-learning-title">
    <div class="lightweight-learning__heading">
      <div>
        <p class="section-kicker">{{ t("概念卡") }}</p>
        <h2 id="lightweight-learning-title">{{ t("先建立一张共同的地图") }}</h2>
      </div>
      <span class="lightweight-learning__meta">{{ t("说明卡 · 约 3 分钟") }}</span>
    </div>
    <div class="lightweight-learning__grid">
      <article v-for="card in cards" :key="card.id" class="lightweight-learning__card">
        <h3>{{ t(card.title) }}</h3>
        <p>{{ t(card.summary) }}</p>
        <p class="lightweight-learning__takeaway">
          <strong>{{ t("记住：") }}</strong
          >{{ t(card.takeaway) }}
        </p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.lightweight-learning {
  display: grid;
  gap: 20px;
  padding: clamp(20px, 3vw, 30px);
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  background: var(--panel);
}
.lightweight-learning__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}
.lightweight-learning h2 {
  margin: 0;
  font-size: clamp(21px, 3vw, 28px);
  letter-spacing: -0.02em;
}
.lightweight-learning__meta {
  color: var(--muted);
  font-size: var(--text-sm);
  white-space: nowrap;
}
.lightweight-learning__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.lightweight-learning__card {
  display: grid;
  gap: 9px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-subtle);
}
.lightweight-learning__card h3 {
  margin: 0;
  font-size: 17px;
}
.lightweight-learning__card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}
.lightweight-learning__takeaway {
  padding-top: 8px;
  border-top: 1px solid var(--line);
  font-size: var(--text-sm);
}
.lightweight-learning__takeaway strong {
  color: var(--ink);
}
@media (max-width: 760px) {
  .lightweight-learning__heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
  .lightweight-learning__grid {
    grid-template-columns: 1fr;
  }
}
</style>
