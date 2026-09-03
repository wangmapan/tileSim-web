import { normalizeApiReports } from "../lib/reports";
import { t } from "../i18n";
import { fetchRunEvidence as queryRunEvidence } from "../features/run-evidence";
import { fetchRunHistory, renameRun as renameRunMutation } from "../features/run-history";
import type { ApplyBundleOptions } from "../entities/dashboard/types";
import { persistDashboardSelection as persist } from "./dashboard-persistence";
import { errorMessage, queryContext, session, state } from "./dashboard-state";

interface DashboardRunCoordinatorOptions {
  applyBundle: (value: unknown, options?: ApplyBundleOptions) => void;
  setView: (view: string) => void;
}

export function createDashboardRunCoordinator({ applyBundle, setView }: DashboardRunCoordinatorOptions) {
  async function fetchRunEvidence(runId: string) {
    return queryRunEvidence(runId, queryContext());
  }

  async function loadHistory({ quiet = false, refresh = false }: { quiet?: boolean; refresh?: boolean } = {}) {
    if (!state.bridge.connected) return;
    state.history.loading = true;
    try {
      const payload = await fetchRunHistory(queryContext(), { refresh });
      state.history.runs = payload.runs || [];
    } catch (error) {
      if (!quiet) session.notify(t("读取运行记录失败：{message}", { message: errorMessage(error) }), "danger");
    } finally {
      state.history.loading = false;
    }
  }

  async function openRun(runId: string) {
    state.busy = true;
    try {
      const { payload, inputs, artifactManifest } = await fetchRunEvidence(runId);
      const run = state.history.runs.find((item) => item.run_id === runId);
      applyBundle(payload.reports, { runId, runName: run?.run_name || runId, inputs, artifactManifest });
      setView("overview");
      session.notify(t("已载入该次运行的完整证据包。"), "positive");
    } catch (error) {
      session.notify(t("打开运行失败：{message}", { message: errorMessage(error) }), "danger");
    } finally {
      state.busy = false;
    }
  }

  async function fetchComparison(runId: string) {
    const { payload, inputs } = await fetchRunEvidence(runId);
    return {
      artifacts: normalizeApiReports(payload.reports),
      input: { runtime_trace: inputs.runtime_trace },
    };
  }

  async function toggleComparison(runId: string) {
    const index = state.history.selected.indexOf(runId);
    if (index >= 0) {
      state.history.selected.splice(index, 1);
      persist();
      return;
    }
    try {
      if (!state.history.comparisons[runId]) state.history.comparisons[runId] = await fetchComparison(runId);
      if (state.history.selected.length === 2) state.history.selected.shift();
      state.history.selected.push(runId);
      persist();
    } catch (error) {
      session.notify(t("无法加入对比：{message}", { message: errorMessage(error) }), "danger");
    }
  }

  function clearComparisons() {
    state.history.selected = [];
    persist();
  }

  async function renameRun(runId: string, name: string) {
    const payload = await renameRunMutation(runId, name, queryContext());
    const run = state.history.runs.find((item) => item.run_id === runId);
    if (run) run.run_name = payload.run_name;
    if (state.runId === runId) state.runName = payload.run_name;
    session.notify(t("实验名称已更新。"), "positive");
  }

  async function restoreRemoteState() {
    await loadHistory({ quiet: true });
    if (state.runId) {
      try {
        const { payload, inputs, artifactManifest } = await fetchRunEvidence(state.runId);
        const run = state.history.runs.find((item) => item.run_id === state.runId);
        applyBundle(payload.reports, {
          runId: state.runId,
          runName: run?.run_name || state.runId,
          inputs,
          artifactManifest,
        });
      } catch {
        state.runId = null;
        persist();
      }
    }
    const selected = [...state.history.selected];
    const restoredComparisons = await Promise.all(
      selected.map(async (runId) => {
        try {
          return { runId, comparison: await fetchComparison(runId) };
        } catch {
          return null;
        }
      }),
    );
    const restored = [];
    for (const entry of restoredComparisons) {
      if (entry) {
        state.history.comparisons[entry.runId] = entry.comparison;
        restored.push(entry.runId);
      }
    }
    state.history.selected = restored;
  }

  return {
    fetchRunEvidence,
    loadHistory,
    openRun,
    toggleComparison,
    clearComparisons,
    renameRun,
    restoreRemoteState,
  };
}
