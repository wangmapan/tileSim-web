<script setup>
import { computed, ref, watch } from "vue";
import { GitCompareArrows, Pencil, RefreshCw, Search, X } from "@lucide/vue";
import ComparisonPanel from "../components/ComparisonPanel.vue";
import EmptyState from "../components/EmptyState.vue";
import ModalDialog from "../components/ModalDialog.vue";
import StatusPill from "../components/StatusPill.vue";
import { formatDate, formatNumber } from "../lib/format";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const { state, filteredRuns, loadHistory, openRun, toggleComparison, clearComparisons, renameRun, notify } =
  useDashboard();
const { t } = useI18n();
const renameTarget = ref(null);
const renameValue = ref("");
const completeCount = computed(() => state.history.runs.filter((run) => run.status === "completed").length);
const pageSize = 25;
const requestedPage = ref(1);
const pageCount = computed(() => Math.max(1, Math.ceil(filteredRuns.value.length / pageSize)));
const currentPage = computed(() => Math.min(requestedPage.value, pageCount.value));
const visibleRuns = computed(() =>
  filteredRuns.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize),
);
const historyPending = computed(() => state.history.loading || (state.bridge.checking && !state.bridge.connected));
watch(
  () => state.history.query,
  () => {
    requestedPage.value = 1;
  },
);
const inputModeLabels = { json: "JSON 输入", controls: "表单配置", legacy: "旧版输入" };

function inputModeLabel(value) {
  return t(inputModeLabels[value] || value || "旧版输入");
}

function beginRename(run) {
  renameTarget.value = run;
  renameValue.value = run.run_name || t("未命名实验");
}
async function submitRename() {
  const value = renameValue.value.trim();
  if (!value) return notify(t("实验名称不能为空。"), "danger");
  try {
    await renameRun(renameTarget.value.run_id, value);
    renameTarget.value = null;
  } catch (error) {
    notify(t("重命名失败：{message}", { message: error.message }), "danger");
  }
}
</script>

<template>
  <div class="view-stack history-view">
    <section class="history-toolbar" data-help-anchor="history-runs">
      <div class="search-field">
        <Search :size="17" aria-hidden="true" /><input
          v-model="state.history.query"
          type="search"
          :aria-label="t('搜索实验名称、运行 ID 或输入模式')"
          :placeholder="t('搜索实验名称、运行 ID 或输入模式')"
        />
      </div>
      <div
        v-if="state.history.runs.length || (!historyPending && state.bridge.connected && !state.history.error)"
        class="history-summary"
      >
        <span
          ><strong>{{ state.history.runs.length }}</strong> {{ t("本地运行") }}</span
        ><span
          ><strong>{{ completeCount }}</strong> {{ t("已完成") }}</span
        >
      </div>
      <button
        class="button button--secondary"
        :disabled="historyPending || !state.bridge.connected"
        @click="loadHistory({ refresh: true })"
      >
        <RefreshCw :size="16" aria-hidden="true" :class="{ spin: state.history.loading }" />{{ t("刷新") }}
      </button>
    </section>

    <div v-if="state.history.error" class="history-notice history-notice--error" role="alert">
      <strong>{{ t("运行记录加载失败") }}</strong>
      <span>{{ state.history.error }}</span>
      <small v-if="state.history.runs.length">{{ t("保留上次加载的记录；请刷新重试。") }}</small>
    </div>
    <div v-else-if="!state.bridge.connected && !historyPending" class="history-notice" role="status">
      <strong>{{ t("本地执行服务未连接") }}</strong>
      <span>{{ t("连接恢复后可刷新运行记录；已有记录暂不更新。") }}</span>
    </div>
    <p v-if="historyPending" class="history-loading" role="status">{{ t("正在加载运行记录…") }}</p>

    <article class="panel history-panel" data-help-anchor="history-open" :aria-busy="historyPending">
      <EmptyState
        v-if="!filteredRuns.length && !historyPending && state.bridge.connected && !state.history.error"
        :title="state.history.query.trim() ? '没有匹配的运行' : '尚无运行记录'"
        :description="
          state.history.query.trim()
            ? '试试其他名称、运行 ID 或输入模式。'
            : '创建一次实验，完成后在这里查看与对比结果。'
        "
        :action-label="state.history.query.trim() ? '' : '新建实验'"
        :action-to="state.history.query.trim() ? '' : '/experiment'"
      />
      <button
        v-if="!filteredRuns.length && state.history.query.trim()"
        class="text-button history-clear"
        @click="state.history.query = ''"
      >
        {{ t("清除搜索") }}
      </button>
      <div
        v-if="filteredRuns.length"
        class="history-table-scroll"
        role="region"
        :aria-label="t('运行记录')"
        tabindex="0"
      >
        <table class="history-table">
          <caption class="visually-hidden">
            {{
              t("运行记录")
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ t("实验与运行标识") }}</th>
              <th scope="col">{{ t("状态与输入") }}</th>
              <th scope="col">{{ t("端到端") }} <span>µs</span></th>
              <th scope="col">{{ t("吞吐") }} <span>req/s</span></th>
              <th scope="col">{{ t("操作") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="run in visibleRuns"
              :key="run.run_id"
              class="run-row"
              :class="{ selected: state.history.selected.includes(run.run_id) }"
            >
              <td>
                <button class="run-main" :disabled="run.status !== 'completed'" @click="openRun(run.run_id)">
                  <strong>{{ run.run_name || t("未命名实验") }}</strong
                  ><small>{{ run.run_id }}</small></button
                ><time class="run-created" :datetime="run.created_at">{{ formatDate(run.created_at) }}</time>
              </td>
              <td>
                <div class="run-kind">
                  <StatusPill :value="run.status || 'unknown'" /><small>{{ inputModeLabel(run.input_mode) }}</small>
                </div>
              </td>
              <td class="run-metric">
                <strong>{{ formatNumber(run.digest?.end_to_end_latency_us) }}</strong>
              </td>
              <td class="run-metric">
                <strong>{{ formatNumber(run.digest?.throughput_requests_per_second) }}</strong>
              </td>
              <td>
                <div class="run-actions" data-help-anchor="history-compare">
                  <button class="icon-button" :title="t('重命名')" @click="beginRename(run)">
                    <Pencil :size="16" /></button
                  ><button
                    class="button button--secondary button--small"
                    :disabled="run.status !== 'completed'"
                    :aria-pressed="state.history.selected.includes(run.run_id)"
                    @click="toggleComparison(run.run_id)"
                  >
                    <GitCompareArrows :size="15" />{{
                      state.history.selected.includes(run.run_id) ? t("已选择") : t("对比")
                    }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav v-if="pageCount > 1" class="history-pagination" :aria-label="t('运行记录分页')">
        <span>{{
          t("第 {page} / {pages} 页 · {count} 条匹配", {
            page: currentPage,
            pages: pageCount,
            count: filteredRuns.length,
          })
        }}</span>
        <button
          class="button button--secondary button--small"
          :disabled="currentPage === 1"
          @click="requestedPage = currentPage - 1"
        >
          {{ t("上一页") }}
        </button>
        <button
          class="button button--secondary button--small"
          :disabled="currentPage === pageCount"
          @click="requestedPage = currentPage + 1"
        >
          {{ t("下一页") }}
        </button>
      </nav>
    </article>

    <article v-if="state.history.selected.length" class="panel compare-shell" data-help-anchor="history-results">
      <header class="panel-header panel-header--row">
        <div>
          <p class="section-kicker">RUN COMPARISON</p>
          <h2>{{ t("两次运行对比") }}</h2>
          <p>{{ t("先选择基线 A，再选择变体 B。") }}</p>
        </div>
        <button v-if="state.history.selected.length" class="text-button" @click="clearComparisons">
          <X :size="15" />{{ t("清除选择") }}
        </button>
      </header>
      <ComparisonPanel />
    </article>

    <ModalDialog :open="Boolean(renameTarget)" :title="t('重命名实验')" @close="renameTarget = null">
      <form class="modal-form" @submit.prevent="submitRename">
        <label>{{ t("实验名称") }}<input v-model="renameValue" maxlength="80" autofocus /></label>
        <div>
          <button type="button" class="button button--ghost" @click="renameTarget = null">{{ t("取消") }}</button
          ><button type="submit" class="button button--primary">{{ t("保存") }}</button>
        </div>
      </form>
    </ModalDialog>
  </div>
</template>
