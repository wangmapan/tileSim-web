import { computed, reactive, toRef } from "vue";
import type { EvidenceQueryContext } from "../features/run-evidence";
import { useBridgeStore } from "../stores/bridge";
import { useHistoryStore } from "../stores/history";
import { useSessionStore } from "../stores/session";
import { useWorkspaceStore } from "../stores/workspace";
import { appPinia } from "../stores/pinia";

export const workspace = useWorkspaceStore(appPinia);
export const session = useSessionStore(appPinia);
export const bridgeStore = useBridgeStore(appPinia);
export const historyStore = useHistoryStore(appPinia);

export const state = reactive({
  bundle: toRef(workspace, "bundle"),
  inputs: toRef(workspace, "inputs"),
  artifactManifest: toRef(workspace, "artifactManifest"),
  runId: toRef(workspace, "runId"),
  runName: toRef(workspace, "runName"),
  isDemo: toRef(workspace, "isDemo"),
  view: toRef(session, "view"),
  busy: toRef(session, "busy"),
  mobileNavOpen: toRef(session, "mobileNavOpen"),
  toasts: session.toasts,
  experimentSubmission: session.experimentSubmission,
  bridge: bridgeStore.bridge,
  catalog: bridgeStore.catalog,
  capabilities: bridgeStore.capabilities,
  experiment: bridgeStore.experiment,
  evidenceAgent: bridgeStore.evidenceAgent,
  history: historyStore.history,
});

export const evidence = computed(() => workspace.evidence);
export const runSummary = computed(() => workspace.runSummary);
export const dashboardView = computed(() => workspace.dashboardView);
export const currentTitle = computed(() => session.currentTitle);
export const filteredRuns = computed(() => historyStore.filteredRuns);

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function queryContext(): EvidenceQueryContext {
  const identity = state.bridge.identity;
  const backendRevision = [
    identity?.source_revision,
    identity?.build_revision,
    identity?.source_state_digest,
    identity?.build_state_digest,
    identity?.deployment_ref,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("|");
  return { backendRevision, manifest: state.bridge.manifest };
}
