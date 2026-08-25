<script setup>
import { computed, ref } from "vue";
import { Check, GitCompareArrows, Pencil, RefreshCw, Search, X } from "@lucide/vue";
import ComparisonPanel from "../components/ComparisonPanel.vue";
import EmptyState from "../components/EmptyState.vue";
import ModalDialog from "../components/ModalDialog.vue";
import StatusPill from "../components/StatusPill.vue";
import { formatDate, formatNumber } from "../lib/format";
import { useDashboard } from "../store/dashboard";

const { state, filteredRuns, loadHistory, openRun, toggleComparison, renameRun, notify } = useDashboard();
const renameTarget = ref(null);
const renameValue = ref("");
const completeCount = computed(() => state.history.runs.filter((run) => run.status === "completed").length);

function beginRename(run) {
  renameTarget.value = run;
  renameValue.value = run.run_name || "未命名实验";
}
async function submitRename() {
  const value = renameValue.value.trim();
  if (!value) return notify("实验名称不能为空。", "danger");
  try {
    await renameRun(renameTarget.value.run_id, value);
    renameTarget.value = null;
  } catch (error) {
    notify(`重命名失败：${error.message}`, "danger");
  }
}
</script>

<template>
  <div class="view-stack">
    <section class="history-toolbar">
      <div class="search-field">
        <Search :size="17" /><input
          v-model="state.history.query"
          type="search"
          placeholder="搜索实验名称、运行 ID 或输入模式"
        />
      </div>
      <div class="history-summary">
        <span
          ><strong>{{ state.history.runs.length }}</strong> 本地运行</span
        ><span
          ><strong>{{ completeCount }}</strong> 已完成</span
        >
      </div>
      <button class="button button--secondary" :disabled="state.history.loading" @click="loadHistory()">
        <RefreshCw :size="16" :class="{ spin: state.history.loading }" />刷新
      </button>
    </section>

    <article class="panel history-panel">
      <EmptyState
        v-if="!filteredRuns.length && !state.history.loading"
        title="没有匹配的运行"
        description="调整搜索条件，或先创建一次新实验。"
      />
      <div v-else class="run-list">
        <div
          v-for="run in filteredRuns"
          :key="run.run_id"
          class="run-row"
          :class="{ selected: state.history.selected.includes(run.run_id) }"
        >
          <button
            class="compare-check"
            :disabled="run.status !== 'completed'"
            :aria-label="state.history.selected.includes(run.run_id) ? '移出对比' : '加入对比'"
            @click="toggleComparison(run.run_id)"
          >
            <Check v-if="state.history.selected.includes(run.run_id)" :size="14" />
          </button>
          <button class="run-main" :disabled="run.status !== 'completed'" @click="openRun(run.run_id)">
            <strong>{{ run.run_name || "未命名实验" }}</strong
            ><small>{{ run.run_id }} · {{ formatDate(run.created_at) }}</small>
          </button>
          <div class="run-kind">
            <StatusPill :value="run.status || 'unknown'" /><small>{{ run.input_mode || "legacy" }}</small>
          </div>
          <div class="run-metric">
            <small>端到端</small><strong>{{ formatNumber(run.digest?.end_to_end_latency_us) }} <span>µs</span></strong>
          </div>
          <div class="run-metric">
            <small>吞吐</small
            ><strong>{{ formatNumber(run.digest?.throughput_requests_per_second) }} <span>req/s</span></strong>
          </div>
          <div class="run-actions">
            <button class="icon-button" title="重命名" @click="beginRename(run)"><Pencil :size="16" /></button
            ><button
              class="button button--small"
              :disabled="run.status !== 'completed'"
              @click="toggleComparison(run.run_id)"
            >
              <GitCompareArrows :size="15" />{{ state.history.selected.includes(run.run_id) ? "已选择" : "对比" }}
            </button>
          </div>
        </div>
      </div>
    </article>

    <article class="panel compare-shell">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">RUN COMPARISON</p>
          <h2>两次运行对比</h2>
          <p>先选择基线 A，再选择变体 B。</p>
        </div>
        <button v-if="state.history.selected.length" class="text-button" @click="state.history.selected = []">
          <X :size="15" />清除选择
        </button>
      </header>
      <ComparisonPanel />
    </article>

    <ModalDialog :open="Boolean(renameTarget)" title="重命名实验" @close="renameTarget = null">
      <form class="modal-form" @submit.prevent="submitRename">
        <label>实验名称<input v-model="renameValue" maxlength="80" autofocus /></label>
        <div>
          <button type="button" class="button button--ghost" @click="renameTarget = null">取消</button
          ><button type="submit" class="button button--primary">保存</button>
        </div>
      </form>
    </ModalDialog>
  </div>
</template>
