import { parseJsonLossless } from "../contracts/lossless-json";
import { bundleReports } from "../lib/reports";
import type { ApplyBundleOptions } from "../entities/dashboard/types";
import { t } from "../i18n";
import { isWorkspaceView, navItems } from "../entities/navigation/model";
import { buildBridgeStatusPresentation, fetchBridgeBootstrap } from "../features/bridge-status";
import { persistDashboardSelection as persist, restoreDashboardSelection } from "./dashboard-persistence";
import { createDashboardRunCoordinator } from "./dashboard-runs";
import {
  acquireNavigationBusy,
  currentTitle,
  dashboardView,
  errorMessage,
  evidence,
  filteredRuns,
  releaseBusy,
  runSummary,
  session,
  state,
  workspace,
} from "./dashboard-state";

export { navItems };

let routeSynchronizationRevision = 0;
let navigateDashboard: ((view: string, runId: string | null, replace?: boolean) => void) | null = null;
// Bootstrap is shared by the app shell and run-bound lightweight pages. A
// direct deep link mounts the child view before App.vue's onMounted hook, so
// keep one in-flight promise that both callers can await. Without this gate a
// child could request status/evidence before the manifest and schema context
// had been established and accidentally take the legacy API path.
let bridgeCheckPromise: Promise<boolean> | null = null;

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

function checkBridge({ refresh = true } = {}): Promise<boolean> {
  if (bridgeCheckPromise) return bridgeCheckPromise;

  const operation = (async () => {
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
      // Keep the public state intentionally terse; callers only need the
      // disconnected boundary. The original error is not exposed because it
      // may contain transport details or credentials.
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
    return state.bridge.connected;
  })();

  bridgeCheckPromise = operation;
  void operation.then(
    () => {
      if (bridgeCheckPromise === operation) bridgeCheckPromise = null;
    },
    () => {
      if (bridgeCheckPromise === operation) bridgeCheckPromise = null;
    },
  );
  return operation;
}

/**
 * Resolve the shared Bridge bootstrap before a run-bound page reads status or
 * evidence. A connected flag without a manifest is not sufficient: that is
 * the transient state in which the evidence adapter would otherwise fall
 * back to its unversioned/legacy endpoint. The returned boolean is about a
 * completed bootstrap, not capability availability.
 */
async function ensureBridgeReady(): Promise<boolean> {
  if (state.bridge.checking || bridgeCheckPromise) return checkBridge({ refresh: false });
  if (state.bridge.connected && state.bridge.manifest) return true;
  return checkBridge({ refresh: false });
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
  // Acquiring the shared busy flag here is what makes this navigation the newest owner: the previous
  // synchronization's claim is revoked, so an early return below releases the orphan flag it left
  // behind (`DEF-BUSY-RACE-001`), while a superseded request can no longer write `state.busy` at all.
  const busyClaim = acquireNavigationBusy(synchronizationRevision);
  try {
    if (view === "evidence_lab") return;
    if (view === "history") void runs.loadHistory();
    if (requestedRunId === state.runId) return;
    if (!requestedRunId) {
      workspace.resetDemo();
      persist();
      return;
    }
    if (!state.bridge.connected) return;

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
    }
  } finally {
    releaseBusy(busyClaim);
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
    ensureBridgeReady,
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
