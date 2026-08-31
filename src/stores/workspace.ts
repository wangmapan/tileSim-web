import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { buildDashboardViewModel } from "../adapters/dashboard-view-model";
import { demoBundle } from "../data/demo";
import { evidenceSummary, normalizeApiReports } from "../lib/reports";
import type { ArtifactManifestResponse } from "../lib/api";
import type { ReportBundle, RunInputs } from "../contracts/report-model";
import type { ApplyBundleOptions } from "../entities/dashboard/types";

export const useWorkspaceStore = defineStore("workspace", () => {
  const bundle = ref<ReportBundle>(normalizeApiReports(structuredClone(demoBundle)));
  const inputs = ref<RunInputs>({ runtime_trace: null, topology: null });
  const artifactManifest = ref<ArtifactManifestResponse | null>(null);
  const runId = ref<string | null>(null);
  const runName = ref("内置示例");
  const isDemo = ref(true);

  const evidence = computed(() => evidenceSummary(bundle.value));
  const runSummary = computed(() => bundle.value.run?.summary || {});
  const dashboardView = computed(() => buildDashboardViewModel(bundle.value));

  function applyBundle(
    value: unknown,
    {
      runId: nextRunId = null,
      runName: nextRunName = "导入报告",
      isDemo: nextIsDemo = false,
      inputs: nextInputs = null,
      artifactManifest: nextManifest = null,
    }: ApplyBundleOptions = {},
  ) {
    bundle.value = normalizeApiReports(value);
    inputs.value = nextInputs || { runtime_trace: null, topology: null };
    artifactManifest.value = nextManifest;
    runId.value = nextRunId;
    runName.value = nextRunName;
    isDemo.value = nextIsDemo;
  }

  function resetDemo() {
    applyBundle(structuredClone(demoBundle), { runName: "内置示例", isDemo: true });
  }

  return {
    bundle,
    inputs,
    artifactManifest,
    runId,
    runName,
    isDemo,
    evidence,
    runSummary,
    dashboardView,
    applyBundle,
    resetDemo,
  };
});
