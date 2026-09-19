import { computed, reactive } from "vue";
import { defineStore } from "pinia";
import type { ApiRun, ArtifactManifestResponse, HealthResponse } from "../lib/api";
import type { ReportBundle, RunInputs } from "../contracts/report-model";
import { appPinia } from "./pinia";

export interface LightweightExperimentForm {
  scenario_id: string;
  fidelity_policy: string;
  gpu_participation_mode: string;
  run_name: string;
  parameterValues: Record<string, string | number | boolean | null | undefined>;
}

export interface LightweightRunContext {
  runId: string;
  runName: string;
  payloadText: string;
  artifactSha256: string | null;
  schemaSetRevision: string | null;
  backendIdentity: HealthResponse | null;
  requestedFidelity: string | null;
  resolvedFidelity: string | null;
  status: ApiRun["status"] | string;
  stage: string | null;
  error: string | null;
  startedAt: string | null;
  updatedAt: string | null;
}

const initialRun: LightweightRunContext | null = null;

export const useLightweightStore = defineStore("lightweight", () => {
  const draft = reactive<{ form: LightweightExperimentForm | null; mode: "controls" | "json" | "trace_package" }>({
    form: null,
    mode: "controls",
  });
  const run = reactive<{ value: LightweightRunContext | null }>({ value: initialRun });
  const reports = reactive<{
    bundle: ReportBundle | null;
    inputs: RunInputs | null;
    artifactManifest: ArtifactManifestResponse | null;
  }>({
    bundle: null,
    inputs: null,
    artifactManifest: null,
  });
  const currentRunId = computed(() => run.value?.runId || null);

  function setDraft(form: LightweightExperimentForm, mode: "controls" | "json" | "trace_package") {
    draft.form = form;
    draft.mode = mode;
  }
  function setRun(value: LightweightRunContext | null) {
    run.value = value;
  }
  function updateRun(value: Partial<LightweightRunContext>) {
    if (run.value) Object.assign(run.value, value);
  }
  function setReports(value: {
    bundle: ReportBundle;
    inputs?: RunInputs | null;
    artifactManifest?: ArtifactManifestResponse | null;
  }) {
    reports.bundle = value.bundle;
    reports.inputs = value.inputs || null;
    reports.artifactManifest = value.artifactManifest || null;
  }
  return { draft, run, reports, currentRunId, setDraft, setRun, updateRun, setReports };
});

export const lightweightStore = useLightweightStore(appPinia);
