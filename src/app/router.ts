import { createRouter, createWebHistory, type RouteLocationRaw } from "vue-router";

export const routeViewIds = [
  "overview",
  "execution",
  "metrics",
  "fabric",
  "attribution",
  "validation",
  "evidence_agent",
  "evidence_lab",
  "design_space",
  "history",
  "experiment",
] as const;

export type RouteViewId = (typeof routeViewIds)[number];

const routeViewSet = new Set<string>(routeViewIds);

export function isRouteViewId(value: unknown): value is RouteViewId {
  return typeof value === "string" && routeViewSet.has(value);
}

function restoredEntryRoute(): RouteLocationRaw {
  const query = new URLSearchParams(window.location.search);
  const legacyView = query.get("view");
  let saved: { view?: unknown; runId?: unknown } | null = null;
  try {
    saved = JSON.parse(
      window.localStorage.getItem("tilesim-web.dashboard-state.v2") ||
        window.localStorage.getItem("tilesim-web.dashboard-state.v1") ||
        "null",
    );
  } catch {
    // A malformed legacy cache must not block application startup.
  }
  const name = isRouteViewId(legacyView) ? legacyView : isRouteViewId(saved?.view) ? saved.view : "overview";
  const linkedRunId = query.get("run");
  const runId =
    typeof linkedRunId === "string" && /^run-[\w-]+$/.test(linkedRunId)
      ? linkedRunId
      : typeof saved?.runId === "string" && /^run-[\w-]+$/.test(saved.runId)
        ? saved.runId
        : null;
  return { name, query: runId ? { run: runId } : undefined };
}

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: "/", redirect: restoredEntryRoute },
    { path: "/overview", name: "overview", component: () => import("../views/OverviewView.vue") },
    { path: "/execution", name: "execution", component: () => import("../views/ExecutionView.vue") },
    { path: "/metrics", name: "metrics", component: () => import("../views/MetricsView.vue") },
    { path: "/fabric", name: "fabric", component: () => import("../views/FabricView.vue") },
    { path: "/attribution", name: "attribution", component: () => import("../views/AttributionView.vue") },
    { path: "/validation", name: "validation", component: () => import("../views/ValidationView.vue") },
    { path: "/evidence-agent", name: "evidence_agent", component: () => import("../views/EvidenceAgentView.vue") },
    { path: "/evidence-lab", name: "evidence_lab", component: () => import("../views/Week7EvidenceView.vue") },
    { path: "/design-space", name: "design_space", component: () => import("../views/DesignSpaceView.vue") },
    { path: "/history", name: "history", component: () => import("../views/HistoryView.vue") },
    { path: "/experiment", name: "experiment", component: () => import("../views/ExperimentView.vue") },
    { path: "/:pathMatch(.*)*", redirect: { name: "overview" } },
  ],
});

export function routeForView(
  view: string,
  runId: string | null,
  evidenceRequestId: string | null = null,
): RouteLocationRaw {
  if (!isRouteViewId(view)) return { name: "overview" };
  if (view === "evidence_lab") return { name: view };
  return {
    name: view,
    query: runId ? { run: runId, ...(evidenceRequestId ? { evidence_request: evidenceRequestId } : {}) } : undefined,
  };
}
