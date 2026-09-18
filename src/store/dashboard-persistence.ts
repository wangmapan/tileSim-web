import { state } from "./dashboard-state";

const cacheKey = "tilesim-web.dashboard-state.v2";
const legacyCacheKey = "tilesim-web.dashboard-state.v1";

export function persistDashboardSelection() {
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        view: state.view,
        runId: state.runId,
        comparisonIds: state.history.selected.slice(0, 2),
      }),
    );
  } catch {
    // Persistence is optional.
  }
}

export function restoreDashboardSelection() {
  try {
    const raw = localStorage.getItem(cacheKey) || localStorage.getItem(legacyCacheKey);
    const saved = JSON.parse(raw || "null");
    const ids = saved?.comparisonIds || [];
    if (Array.isArray(ids)) {
      state.history.selected = ids
        .filter((id: unknown) => typeof id === "string" && /^run-[\w-]+$/.test(id))
        .slice(0, 2);
    }
  } catch {
    // Ignore obsolete cache.
  }
}
