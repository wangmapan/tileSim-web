import { parseJsonLossless } from "../contracts/lossless-json";
import { bundleReports, normalizeApiReports } from "../lib/reports";
import type { ApplyBundleOptions } from "../entities/dashboard/types";
import { t } from "../i18n";
import { isWorkspaceView, navItems } from "../entities/navigation/model";
import { buildBridgeStatusPresentation, fetchBridgeBootstrap } from "../features/bridge-status";
import { fetchRunEvidence as queryRunEvidence } from "../features/run-evidence";
import { fetchRunHistory, renameRun as renameRunMutation } from "../features/run-history";
import { persistDashboardSelection as persist, restoreDashboardSelection } from "./dashboard-persistence";
import {
  currentTitle,
  dashboardView,
  errorMessage,
  evidence,
  filteredRuns,
  queryContext,
  runSummary,
  session,
  state,
  workspace,
} from "./dashboard-state";

export { navItems };

let routeSynchronizationRevision = 0;
let navigateDashboard: ((view: string, runId: string | null, replace?: boolean) => void) | null = null;

export function configureDashboardNavigation(
  navigate: (view: string, runId: string | null, replace?: boolean) => void,
) {
  navigateDashboard = navigate;
}

function setView(view: string) {
  if (!isWorkspaceView(view)) return;
  state.mobileNavOpen = false;
  navigateDashboard?.(view, state.runId);
}

function applyBundle(value: unknown, options: ApplyBundleOptions = {}) {
  workspace.applyBundle(value, options);
  persist();
}

async function checkBridge({ refresh = true } = {}) {
  state.bridge.checking = true;
  try {
    const {
      manifest,
      health,
      catalog,
      capabilities,
      experimentDescriptor,
      experimentDescriptorStatus,
      experimentDescriptorError,
      evidenceAgentDescriptor,
      evidenceAgentDescriptorStatus,
      evidenceAgentDescriptorError,
    } = await fetchBridgeBootstrap({ refresh });
    state.bridge.identity = health;
    state.bridge.manifest = manifest;
    state.bridge.connected = true;
    const legacyApi = manifest.legacy_unversioned === true;
    Object.assign(state.bridge, buildBridgeStatusPresentation(health, legacyApi));
    Object.assign(state.catalog, catalog);
    Object.assign(state.capabilities, capabilities);
    state.experiment.descriptor = experimentDescriptor;
    state.experiment.status = experimentDescriptorStatus;
    state.experiment.error = experimentDescriptorError;
    state.evidenceAgent.descriptor = evidenceAgentDescriptor;
    state.evidenceAgent.status = evidenceAgentDescriptorStatus;
    state.evidenceAgent.error = evidenceAgentDescriptorError;
  } catch {
    Object.assign(state.bridge, {
      connected: false,
      available: false,
      synchronized: false,
      identity: null,
      manifest: null,
      title: "未连接本地服务",
      detail: "未连接本地执行服务",
    });
    state.experiment.descriptor = null;
    state.experiment.status = "contract_error";
    state.experiment.error = "bridge_bootstrap_failed";
    state.evidenceAgent.descriptor = null;
    state.evidenceAgent.status = "contract_error";
    state.evidenceAgent.error = "bridge_bootstrap_failed";
  } finally {
    state.bridge.checking = false;
  }
}

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

async function importFiles(files: File[]) {
  const reports: unknown[] = [];
  for (const file of files) reports.push(parseJsonLossless(await file.text()));
  const bundle = bundleReports(reports);
  applyBundle(bundle, { runName: files.length > 1 ? t("导入的报告组合") : files[0].name });
  setView("overview");
  session.notify(t("已导入 {count} 份报告。", { count: files.length }), "positive");
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

async function synchronizeNavigation(view: string, requestedRunId: string | null) {
  const synchronizationRevision = ++routeSynchronizationRevision;
  session.setCurrentView(view);
  persist();
  if (view === "evidence_lab") return;
  if (view === "history") void loadHistory();
  if (requestedRunId === state.runId) return;
  if (!requestedRunId) {
    workspace.resetDemo();
    persist();
    return;
  }
  if (!state.bridge.connected) return;

  state.busy = true;
  try {
    const { payload, inputs, artifactManifest } = await fetchRunEvidence(requestedRunId);
    if (synchronizationRevision !== routeSynchronizationRevision) return;
    const run = state.history.runs.find((item) => item.run_id === requestedRunId);
    applyBundle(payload.reports, {
      runId: requestedRunId,
      runName: run?.run_name || requestedRunId,
      inputs,
      artifactManifest,
    });
  } catch (error) {
    if (synchronizationRevision !== routeSynchronizationRevision) return;
    workspace.resetDemo();
    persist();
    navigateDashboard?.(view, null, true);
    session.notify(t("无法恢复链接中的运行：{message}", { message: errorMessage(error) }), "danger");
  } finally {
    if (synchronizationRevision === routeSynchronizationRevision) state.busy = false;
  }
}

async function initialize(
  initialNavigation: { view: string; runId: string | null } = { view: "overview", runId: null },
) {
  restoreDashboardSelection();
  session.setCurrentView(initialNavigation.view);
  await checkBridge({ refresh: false });
  if (!state.bridge.connected) return;
  await restoreRemoteState();
  await synchronizeNavigation(initialNavigation.view, initialNavigation.runId);
}

export function useDashboard() {
  return {
    state,
    evidence,
    runSummary,
    dashboardView,
    currentTitle,
    filteredRuns,
    setView,
    notify: session.notify,
    dismissToast: session.dismissToast,
    pauseToast: session.pauseToast,
    resumeToast: session.resumeToast,
    applyBundle,
    checkBridge,
    loadHistory,
    openRun,
    toggleComparison,
    clearComparisons,
    renameRun,
    importFiles,
    fetchRunEvidence,
    initialize,
    synchronizeNavigation,
    persist,
    updateExperimentSubmission: session.updateExperimentSubmission,
    clearExperimentSubmission: session.clearExperimentSubmission,
  };
}
