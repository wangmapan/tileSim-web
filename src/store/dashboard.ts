import { parseJsonLossless } from "../contracts/lossless-json";
import { bundleReports } from "../lib/reports";
import type { ApplyBundleOptions } from "../entities/dashboard/types";
import { t } from "../i18n";
import { isWorkspaceView, navItems } from "../entities/navigation/model";
import { buildBridgeStatusPresentation, fetchBridgeBootstrap } from "../features/bridge-status";
import { persistDashboardSelection as persist, restoreDashboardSelection } from "./dashboard-persistence";
import { createDashboardRunCoordinator } from "./dashboard-runs";
import {
  currentTitle,
  dashboardView,
  errorMessage,
  evidence,
  filteredRuns,
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

const runs = createDashboardRunCoordinator({ applyBundle, setView });

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

async function importFiles(files: File[]) {
  const reports: unknown[] = [];
  for (const file of files) reports.push(parseJsonLossless(await file.text()));
  const bundle = bundleReports(reports);
  applyBundle(bundle, { runName: files.length > 1 ? t("导入的报告组合") : files[0].name });
  setView("overview");
  session.notify(t("已导入 {count} 份报告。", { count: files.length }), "positive");
}

async function synchronizeNavigation(view: string, requestedRunId: string | null) {
  const synchronizationRevision = ++routeSynchronizationRevision;
  session.setCurrentView(view);
  persist();
  if (view === "evidence_lab") return;
  if (view === "history") void runs.loadHistory();
  if (requestedRunId === state.runId) return;
  if (!requestedRunId) {
    workspace.resetDemo();
    persist();
    return;
  }
  if (!state.bridge.connected) return;

  state.busy = true;
  try {
    const { payload, inputs, artifactManifest } = await runs.fetchRunEvidence(requestedRunId);
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
  await runs.restoreRemoteState();
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
    loadHistory: runs.loadHistory,
    openRun: runs.openRun,
    toggleComparison: runs.toggleComparison,
    clearComparisons: runs.clearComparisons,
    renameRun: runs.renameRun,
    importFiles,
    fetchRunEvidence: runs.fetchRunEvidence,
    initialize,
    synchronizeNavigation,
    persist,
    updateExperimentSubmission: session.updateExperimentSubmission,
    clearExperimentSubmission: session.clearExperimentSubmission,
  };
}
