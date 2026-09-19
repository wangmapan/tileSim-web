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

/**
 * `state.busy` is a cross-module flag: it renders the global spinner (`App.vue:330`), it suppresses
 * the "run cannot be restored" banner (`App.vue:244`) and it is re-exported here (`:22`). Two
 * independent producers report global loading through it — the newest route synchronization
 * (`store/dashboard.ts`) and every in-flight `openRun()` (`store/dashboard-runs.ts`). Writing the
 * flag directly therefore lets one producer clear the other producer's loading state.
 *
 * The flag is owned through claim tokens instead: `state.busy` mirrors the set of active claims and
 * is only written when that set crosses the empty boundary. This is what keeps a superseded
 * navigation from writing a flag it no longer owns (`DEF-BUSY-RACE-001`).
 */
export type BusyOwnerKind = "navigation" | "run_open";

export interface BusyClaim {
  readonly kind: BusyOwnerKind;
  /** Route synchronization revision that acquired the claim; `null` for run opens. */
  readonly revision: number | null;
}

const busyClaims = new Set<BusyClaim>();

function syncBusyFlag() {
  const busy = busyClaims.size > 0;
  if (state.busy !== busy) state.busy = busy;
}

function addBusyClaim(kind: BusyOwnerKind, revision: number | null): BusyClaim {
  const claim: BusyClaim = { kind, revision };
  busyClaims.add(claim);
  syncBusyFlag();
  return claim;
}

/**
 * Acquire the busy flag for the newest route synchronization. Every earlier navigation claim is
 * revoked here, so an earlier synchronization that is still in flight can never write `state.busy`
 * again; its later `releaseBusy` is a no-op. A navigation that reaches an early return therefore
 * releases a flag that was left behind by an earlier synchronization, instead of leaking it.
 */
export function acquireNavigationBusy(revision: number): BusyClaim {
  for (const claim of [...busyClaims]) {
    if (claim.kind === "navigation") busyClaims.delete(claim);
  }
  return addBusyClaim("navigation", revision);
}

/** Acquire the busy flag for a run open. Navigation claims never revoke a run open claim. */
export function acquireRunBusy(): BusyClaim {
  return addBusyClaim("run_open", null);
}

/** Release a claim. Returns `false` when the claim was already revoked (superseded). */
export function releaseBusy(claim: BusyClaim): boolean {
  if (!busyClaims.delete(claim)) return false;
  syncBusyFlag();
  return true;
}

/** Number of active busy claims; lets tests detect claim leaks. */
export function busyClaimCount(): number {
  return busyClaims.size;
}

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
