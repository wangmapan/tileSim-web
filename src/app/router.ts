import { createRouter, createWebHistory, type RouteLocationNormalized, type RouteLocationRaw } from "vue-router";

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

function firstQueryString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function restoredLegacyRoute(to: RouteLocationNormalized): RouteLocationRaw | true {
  const legacyView = firstQueryString(to.query.view);
  if (!isRouteViewId(legacyView)) return true;

  const query: Record<string, string> = {};
  const runId = firstQueryString(to.query.run);
  if (runId && /^run-[\w-]+$/.test(runId)) query.run = runId;

  for (const key of ["artifact_sha256", "schema_set_revision", "from"] as const) {
    const value = firstQueryString(to.query[key]);
    if (value) query[key] = value;
  }

  return {
    name: legacyView,
    query: Object.keys(query).length > 0 ? query : undefined,
  };
}

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: "/",
      name: "workbench_entry",
      component: () => import("../views/WorkbenchEntryView.vue"),
      meta: { layout: "entry" },
      beforeEnter: restoredLegacyRoute,
    },
    {
      path: "/overview",
      name: "overview",
      component: () => import("../views/OverviewView.vue"),
      meta: { workspace: "professional" },
    },
    {
      path: "/execution",
      name: "execution",
      component: () => import("../views/ExecutionView.vue"),
      meta: { workspace: "professional" },
    },
    {
      path: "/metrics",
      name: "metrics",
      component: () => import("../views/MetricsView.vue"),
      meta: { workspace: "professional" },
    },
    {
      path: "/fabric",
      name: "fabric",
      component: () => import("../views/FabricView.vue"),
      meta: { workspace: "professional" },
    },
    {
      path: "/attribution",
      name: "attribution",
      component: () => import("../views/AttributionView.vue"),
      meta: { workspace: "professional" },
    },
    {
      path: "/validation",
      name: "validation",
      component: () => import("../views/ValidationView.vue"),
      meta: { workspace: "professional" },
    },
    {
      path: "/evidence-agent",
      name: "evidence_agent",
      component: () => import("../views/EvidenceAgentView.vue"),
      meta: { workspace: "professional" },
    },
    {
      path: "/evidence-lab",
      name: "evidence_lab",
      component: () => import("../views/Week7EvidenceView.vue"),
      meta: { workspace: "professional" },
    },
    {
      path: "/design-space",
      name: "design_space",
      component: () => import("../views/DesignSpaceView.vue"),
      meta: { workspace: "professional" },
    },
    {
      path: "/history",
      name: "history",
      component: () => import("../views/HistoryView.vue"),
      meta: { workspace: "professional" },
    },
    {
      path: "/experiment",
      name: "experiment",
      component: () => import("../views/ExperimentView.vue"),
      meta: { workspace: "professional" },
    },
    {
      path: "/lightweight",
      name: "lightweight",
      component: () => import("../views/LightweightWorkbenchView.vue"),
      meta: { workspace: "lightweight" },
    },
    {
      path: "/lightweight/learn",
      name: "lightweight_learn",
      component: () => import("../views/LightweightWorkbenchView.vue"),
      meta: { workspace: "lightweight" },
    },
    {
      path: "/lightweight/tasks",
      name: "lightweight_tasks",
      component: () => import("../views/LightweightWorkbenchView.vue"),
      meta: { workspace: "lightweight" },
    },
    {
      path: "/lightweight/prepare",
      name: "lightweight_prepare",
      component: () => import("../views/LightweightWorkbenchView.vue"),
      meta: { workspace: "lightweight" },
    },
    {
      path: "/lightweight/results",
      name: "lightweight_results",
      component: () => import("../views/LightweightWorkbenchView.vue"),
      meta: { workspace: "lightweight" },
    },
    { path: "/lightweight-workbench", redirect: { name: "lightweight" } },
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
