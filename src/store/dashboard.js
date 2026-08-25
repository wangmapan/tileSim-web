import { computed, reactive } from "vue";
import { bridgeApi } from "../lib/api";
import { bundleReports, evidenceSummary, normalizeApiReports } from "../lib/reports";
import { demoBundle } from "../data/demo";

const cacheKey = "tilesim-web.dashboard-state.v2";
const legacyCacheKey = "tilesim-web.dashboard-state.v1";

export const navItems = [
  { id: "overview", label: "运行概览", description: "结果与证据摘要" },
  { id: "metrics", label: "性能指标", description: "请求与尾延迟" },
  { id: "fabric", label: "Fabric 分析", description: "域、利用率与背压" },
  { id: "attribution", label: "尾延迟归因", description: "跨子系统贡献" },
  { id: "validation", label: "证据与验证", description: "来源与保真度" },
  { id: "history", label: "运行记录", description: "查找、打开与对比" },
];

const state = reactive({
  view: "overview",
  bundle: structuredClone(demoBundle),
  runId: null,
  runName: "内置示例",
  isDemo: true,
  bridge: {
    available: false,
    checking: true,
    synchronized: false,
    title: "正在检查后端",
    detail: "正在读取独立运行环境",
    identity: null,
  },
  history: { runs: [], loading: false, selected: [], comparisons: {}, query: "" },
  catalog: { scenarios: [], fidelity_policies: ["des", "default"] },
  capabilities: {
    default_gpu_participation_mode: "gpu_free",
    cycle_scope: "S6_hotspot_refinement_only",
    dependencies: {},
    run_surface: {},
  },
  busy: false,
  mobileNavOpen: false,
  toasts: [],
});

const evidence = computed(() => evidenceSummary(state.bundle));
const runSummary = computed(() => state.bundle.run?.summary || {});
const currentTitle = computed(() => navItems.find((item) => item.id === state.view)?.label || "新建实验");
const filteredRuns = computed(() => {
  const query = state.history.query.trim().toLowerCase();
  if (!query) return state.history.runs;
  return state.history.runs.filter((run) =>
    [run.run_name, run.run_id, run.status, run.input_mode].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(query),
    ),
  );
});

function persist() {
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
    /* Persistence is optional. */
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(cacheKey) || localStorage.getItem(legacyCacheKey);
    const saved = JSON.parse(raw || "null");
    if (!saved || typeof saved !== "object") return;
    const validViews = [...navItems.map((item) => item.id), "experiment"];
    if (validViews.includes(saved.view)) state.view = saved.view;
    if (typeof saved.runId === "string" && /^run-[\w-]+$/.test(saved.runId)) state.runId = saved.runId;
    const ids = saved.comparisonIds || [];
    if (Array.isArray(ids))
      state.history.selected = ids.filter((id) => typeof id === "string" && /^run-[\w-]+$/.test(id)).slice(0, 2);
  } catch {
    /* Ignore obsolete cache. */
  }
}

function setView(view) {
  state.view = view;
  state.mobileNavOpen = false;
  persist();
  if (view === "history") loadHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function notify(message, tone = "neutral") {
  const id = crypto.randomUUID();
  state.toasts.push({ id, message, tone });
  window.setTimeout(() => dismissToast(id), 4200);
}

function dismissToast(id) {
  const index = state.toasts.findIndex((toast) => toast.id === id);
  if (index >= 0) state.toasts.splice(index, 1);
}

function applyBundle(bundle, { runId = null, runName = "导入报告", isDemo = false } = {}) {
  state.bundle = normalizeApiReports(bundle);
  state.runId = runId;
  state.runName = runName;
  state.isDemo = isDemo;
  persist();
}

async function checkBridge() {
  state.bridge.checking = true;
  try {
    const [health, catalog, capabilities] = await Promise.all([
      bridgeApi.health(),
      bridgeApi.catalog(),
      bridgeApi.capabilities(),
    ]);
    state.bridge.identity = health;
    state.bridge.synchronized = Boolean(health.versions_match);
    state.bridge.available = Boolean(health.execution_ready);
    const source =
      health.source_revision && health.source_revision !== "unknown" ? health.source_revision.slice(0, 7) : "未知";
    const build =
      health.build_revision && health.build_revision !== "unknown" ? health.build_revision.slice(0, 7) : "未知";
    state.bridge.title = state.bridge.available
      ? "独立后端已同步"
      : health.cli_available && !health.versions_match
        ? "后端版本不一致"
        : "执行后端不可用";
    state.bridge.detail = `${health.deployment_ref || health.backend_branch || "未托管"} · 源码 ${source} / CLI ${build}`;
    state.catalog = catalog;
    state.capabilities = capabilities;
  } catch (error) {
    state.bridge.available = false;
    state.bridge.synchronized = false;
    state.bridge.identity = null;
    state.bridge.title = "未连接本地服务";
    state.bridge.detail = "未连接本地执行服务";
  } finally {
    state.bridge.checking = false;
  }
}

async function loadHistory({ quiet = false } = {}) {
  if (!state.bridge.available) return;
  state.history.loading = true;
  try {
    const payload = await bridgeApi.listRuns();
    state.history.runs = payload.runs || [];
  } catch (error) {
    if (!quiet) notify(`读取运行记录失败：${error.message}`, "danger");
  } finally {
    state.history.loading = false;
  }
}

async function openRun(runId) {
  state.busy = true;
  try {
    const payload = await bridgeApi.getReports(runId);
    const run = state.history.runs.find((item) => item.run_id === runId);
    applyBundle(payload.reports, { runId, runName: run?.run_name || runId });
    setView("overview");
    notify("已载入该次运行的完整证据包。", "positive");
  } catch (error) {
    notify(`打开运行失败：${error.message}`, "danger");
  } finally {
    state.busy = false;
  }
}

async function fetchComparison(runId) {
  const [reports, input] = await Promise.all([bridgeApi.getReports(runId), bridgeApi.getInput(runId)]);
  return { artifacts: normalizeApiReports(reports.reports), input: { runtime_trace: input } };
}

async function toggleComparison(runId) {
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
    notify(`无法加入对比：${error.message}`, "danger");
  }
}

async function renameRun(runId, name) {
  const payload = await bridgeApi.renameRun(runId, name);
  const run = state.history.runs.find((item) => item.run_id === runId);
  if (run) run.run_name = payload.run_name;
  if (state.runId === runId) state.runName = payload.run_name;
  notify("实验名称已更新。", "positive");
}

async function importFiles(files) {
  const reports = [];
  for (const file of files) reports.push(JSON.parse(await file.text()));
  const bundle = bundleReports(reports);
  applyBundle(bundle, { runName: files.length > 1 ? "导入的报告组合" : files[0].name });
  setView("overview");
  notify(`已导入 ${files.length} 份报告。`, "positive");
}

async function restoreRemoteState() {
  await loadHistory({ quiet: true });
  if (state.runId) {
    try {
      const payload = await bridgeApi.getReports(state.runId);
      const run = state.history.runs.find((item) => item.run_id === state.runId);
      applyBundle(payload.reports, { runId: state.runId, runName: run?.run_name || state.runId });
    } catch {
      state.runId = null;
      persist();
    }
  }
  const restored = [];
  for (const runId of state.history.selected) {
    try {
      state.history.comparisons[runId] = await fetchComparison(runId);
      restored.push(runId);
    } catch {
      /* Removed runs are omitted from comparison. */
    }
  }
  state.history.selected = restored;
}

async function initialize() {
  restore();
  const requestedView = new URLSearchParams(window.location.search).get("view");
  if ([...navItems.map((item) => item.id), "experiment"].includes(requestedView)) state.view = requestedView;
  await checkBridge();
  if (state.bridge.available) await restoreRemoteState();
}

export function useDashboard() {
  return {
    state,
    evidence,
    runSummary,
    currentTitle,
    filteredRuns,
    setView,
    notify,
    dismissToast,
    applyBundle,
    checkBridge,
    loadHistory,
    openRun,
    toggleComparison,
    renameRun,
    importFiles,
    initialize,
    persist,
  };
}
