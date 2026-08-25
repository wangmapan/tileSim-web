<script setup>
import { Braces, GitCommitHorizontal, Target } from "@lucide/vue";
import EmptyState from "../components/EmptyState.vue";
import { formatNumber, formatPercent } from "../lib/format";
import { useDashboard } from "../store/dashboard";
const { state } = useDashboard();
</script>

<template>
  <EmptyState v-if="!state.bundle.tail?.attribution_ranking" title="没有尾延迟归因报告" />
  <div v-else class="view-stack">
    <section class="attribution-intro">
      <div>
        <p class="section-kicker">EXPLAINED ENTITY</p>
        <div class="entity-id">
          <Target :size="21" /><strong>{{ state.bundle.tail.explained_entity?.id || "unknown" }}</strong>
        </div>
        <p>当前尾部请求的跨子系统解释对象。</p>
      </div>
      <dl>
        <div>
          <dt>Confidence</dt>
          <dd>{{ formatPercent(state.bundle.tail.confidence) }}</dd>
        </div>
        <div>
          <dt>Completeness</dt>
          <dd>{{ formatPercent(state.bundle.tail.completeness) }}</dd>
        </div>
      </dl>
    </section>

    <article v-if="state.bundle.tail.cause_chain?.length" class="panel">
      <header class="panel-header">
        <div>
          <p class="section-kicker">CAUSE CHAIN</p>
          <h2>共享时间轴上的原因链</h2>
          <p>这是报告提供的有序解释，不应单独视为现实因果证明。</p>
        </div>
      </header>
      <ol class="cause-chain">
        <li v-for="(cause, index) in state.bundle.tail.cause_chain" :key="`${cause.subsystem}-${index}`">
          <span>{{ index + 1 }}</span>
          <div>
            <small>{{ cause.subsystem }}</small
            ><strong>{{ cause.title || cause.cause_code }}</strong>
            <p>{{ cause.evidence }}</p>
          </div>
          <GitCommitHorizontal :size="18" />
        </li>
      </ol>
    </article>

    <article class="panel">
      <header class="panel-header">
        <div>
          <p class="section-kicker">ATTRIBUTION RANKING</p>
          <h2>贡献排序</h2>
          <p>按报告中的 picosecond 证据排序。</p>
        </div>
      </header>
      <div class="ranking-list">
        <div
          v-for="item in state.bundle.tail.attribution_ranking"
          :key="`${item.rank}-${item.subsystem}`"
          class="ranking-row"
        >
          <span class="rank-index">{{ String(item.rank).padStart(2, "0") }}</span>
          <div class="rank-copy">
            <small>{{ item.subsystem }}</small
            ><strong>{{ item.component_code }}</strong>
            <p>{{ item.detail }}</p>
          </div>
          <div class="rank-bar"><span :style="{ width: `${Math.max((item.share || 0) * 100, 1)}%` }"></span></div>
          <div class="rank-score">
            <strong>{{ formatPercent(item.share) }}</strong
            ><small>{{ formatNumber(item.score_ps) }} ps</small>
          </div>
        </div>
      </div>
    </article>

    <div class="scope-callout">
      <Braces :size="18" />
      <p><strong>解释边界</strong>未覆盖的系统行为应继续保留为 unresolved gap；归因排序不能替代真实系统实验。</p>
    </div>
  </div>
</template>
