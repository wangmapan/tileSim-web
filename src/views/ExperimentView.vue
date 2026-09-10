<script setup>
import { computed, onActivated, onBeforeUnmount, reactive, ref, watch } from "vue";
import { AlertCircle } from "@lucide/vue";
import {
  BridgeApiError,
  DesignSpaceInputPanel,
  ExperimentCapabilityPanel,
  ExperimentIdentityPanel,
  ExperimentInputPanel,
  ExperimentRequestError,
  ExperimentSubmitCard,
  TracePackageInputPanel,
  buildExperimentAgentContextPublication,
  buildExperimentRequestPreview,
  buildExperimentSurface,
  createExperimentForm,
  reconcileExperimentForm,
  resolveExperimentErrorPointer,
  resetExperimentControls,
  runExperiment,
  fetchTracePackageCatalog,
  inspectTracePackage,
  tracePackageBackendIdentity,
} from "../features/run-experiment";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const props = defineProps({
  agentContextPublisher: { type: Function, default: null },
});

const {
  state,
  applyBundle,
  setView,
  loadHistory,
  notify,
  fetchRunEvidence,
  updateExperimentSubmission,
  clearExperimentSubmission,
} = useDashboard();
const { t } = useI18n();
const mode = ref("controls");
const submitting = ref(false);
const runStatus = ref("");
const runtimeJson = ref("");
const topologyJson = ref("");
const designSpaceJson = ref("");
const tracePackageCatalog = ref(null);
const tracePackageCatalogStatus = ref("idle");
const tracePackageError = ref("");
const tracePackageInspectError = ref("");
const selectedTracePackageId = ref("");
const inspectingTracePackage = ref(false);
const fieldPath = ref("");
const submissionContractError = ref("");
const pendingSubmission = state.experimentSubmission;
let waitController = null;
const surface = computed(() =>
  buildExperimentSurface(
    state.catalog,
    state.capabilities,
    state.experiment.descriptor,
    state.experiment.status,
    state.experiment.error,
  ),
);
const form = reactive(createExperimentForm(surface.value));
let agentContextSequence = 0;
const selectedTracePackage = computed(
  () => tracePackageCatalog.value?.packages.find((item) => item.package_id === selectedTracePackageId.value) || null,
);
const tracePackageQueryContext = computed(() => {
  const manifest = state.bridge.manifest;
  if (!manifest || manifest.legacy_unversioned) return null;
  return {
    backendIdentity: tracePackageBackendIdentity(state.bridge.identity || {}),
    manifest,
  };
});
const requestPreview = computed(() =>
  buildExperimentRequestPreview({
    form,
    mode: mode.value,
    surface: surface.value,
    runtimeJson: runtimeJson.value,
    topologyJson: topologyJson.value,
    designSpaceJson: mode.value === "trace_package" ? "" : designSpaceJson.value,
    tracePackageId: selectedTracePackageId.value,
  }),
);
const displayFieldPath = computed(() => {
  const path = fieldPath.value || requestPreview.value.error?.fieldPath || "";
  return path ? resolveExperimentErrorPointer(surface.value, path)?.controlPointer || "" : "";
});
const canRun = computed(
  () =>
    state.bridge.available &&
    surface.value.canSubmit &&
    !submissionContractError.value &&
    requestPreview.value.request !== null &&
    (mode.value !== "trace_package" || selectedTracePackage.value?.submission_available === true) &&
    !submitting.value,
);

async function loadTracePackages(refresh = false) {
  const context = tracePackageQueryContext.value;
  if (!context) {
    tracePackageCatalog.value = null;
    tracePackageCatalogStatus.value = "error";
    tracePackageError.value = "trace_package_manifest_contract_unavailable";
    return;
  }
  tracePackageCatalogStatus.value = "loading";
  tracePackageError.value = "";
  try {
    const catalog = await fetchTracePackageCatalog(context, { refresh });
    tracePackageCatalog.value = catalog;
    tracePackageCatalogStatus.value = "success";
    if (!catalog.packages.some((item) => item.package_id === selectedTracePackageId.value)) {
      selectedTracePackageId.value =
        catalog.packages.find((item) => item.submission_available)?.package_id || catalog.packages[0]?.package_id || "";
    }
  } catch (error) {
    tracePackageCatalogStatus.value = "error";
    tracePackageError.value = error instanceof Error ? error.message : String(error);
  }
}

async function inspectSelectedTracePackage() {
  const item = selectedTracePackage.value;
  const context = tracePackageQueryContext.value;
  if (!item || !context) return;
  inspectingTracePackage.value = true;
  tracePackageInspectError.value = "";
  try {
    const result = await inspectTracePackage(item.package_id, item.manifest_sha256, context);
    tracePackageCatalog.value = {
      ...tracePackageCatalog.value,
      packages: tracePackageCatalog.value.packages.map((candidate) =>
        candidate.package_id === result.package.package_id ? result.package : candidate,
      ),
    };
  } catch (error) {
    tracePackageInspectError.value = error instanceof Error ? error.message : String(error);
  } finally {
    inspectingTracePackage.value = false;
  }
}

async function selectTracePackage(packageId) {
  selectedTracePackageId.value = packageId;
  await inspectSelectedTracePackage();
}

watch(
  surface,
  (nextSurface) => {
    reconcileExperimentForm(form, nextSurface);
    if (!nextSurface.inputModes.includes(mode.value)) mode.value = nextSurface.inputModes[0] || "controls";
  },
  { immediate: true },
);

watch(
  [mode, () => state.bridge.manifest?.schema_set_revision],
  ([nextMode]) => {
    if (nextMode === "trace_package") void loadTracePackages();
  },
  { immediate: true },
);

function publishAgentContext() {
  if (!props.agentContextPublisher) return;
  agentContextSequence += 1;
  props.agentContextPublisher(
    buildExperimentAgentContextPublication({
      form,
      surface: surface.value,
      mode: mode.value,
      contextRevision: `context:experiment:${state.runId || "no-run"}:${state.bridge.manifest?.schema_set_revision || "schema-unavailable"}:${agentContextSequence}`,
      runId: state.runId || null,
    }),
  );
}

watch([form, surface, mode, () => state.runId], publishAgentContext, { deep: true, immediate: true });
onActivated(publishAgentContext);

function resetControls() {
  resetExperimentControls(form, surface.value);
}

async function loadTemplate() {
  try {
    const template = await runExperiment.getTemplate(form.scenario_id);
    runtimeJson.value = JSON.stringify(template.runtime_trace, null, 2);
    topologyJson.value = JSON.stringify(template.topology, null, 2);
    notify(t("已加载当前场景模板。"), "positive");
  } catch (error) {
    notify(t("加载模板失败：{message}", { message: error.message }), "danger");
  }
}

function clearPendingSubmission() {
  clearExperimentSubmission();
}

async function submit() {
  waitController?.abort();
  const controller = new AbortController();
  waitController = controller;
  submitting.value = true;
  fieldPath.value = "";
  submissionContractError.value = "";
  runStatus.value = t("正在校验输入");
  let terminalStatus = "";
  try {
    const preview = requestPreview.value;
    if (!preview.request) throw preview.error || new ExperimentRequestError(t("请求不可提交。"), "");
    const payload = preview.request;
    const payloadText = JSON.stringify(payload);
    let created;
    if (pendingSubmission.payloadText === payloadText && pendingSubmission.runId) {
      created = { run_id: pendingSubmission.runId, run_name: form.run_name.trim() };
      runStatus.value = `${t("正在恢复任务")} · ${created.run_id}`;
    } else {
      if (pendingSubmission.payloadText !== payloadText || !pendingSubmission.idempotencyKey) {
        updateExperimentSubmission({
          payloadText,
          idempotencyKey: `run-${crypto.randomUUID()}`,
          runId: "",
        });
      }
      runStatus.value = t("正在提交受控模拟任务");
      try {
        created = await runExperiment.create(payload, pendingSubmission.idempotencyKey);
      } catch (error) {
        if (error instanceof BridgeApiError && error.status >= 400 && error.status < 500 && !error.retryable) {
          clearPendingSubmission();
        }
        throw error;
      }
      updateExperimentSubmission({ idempotencyKey: "", runId: created.run_id });
      runStatus.value = `${created.idempotent_replay ? t("已恢复") : t("任务已创建")} · ${created.run_id}`;
    }
    await runExperiment.wait(created.run_id, {
      signal: controller.signal,
      onStatus(run, transport) {
        terminalStatus = run.status === "completed" || run.status === "failed" ? run.status : "";
        if (!terminalStatus) {
          const label = run.status === "preparing" ? t("准备输入") : t("运行中");
          runStatus.value = `${label} · ${transport === "sse" ? t("实时状态") : t("轮询恢复")}`;
        }
      },
    });
    const { payload: reports, inputs, artifactManifest } = await fetchRunEvidence(created.run_id);
    applyBundle(reports.reports, {
      runId: created.run_id,
      runName: created.run_name || form.run_name || created.run_id,
      inputs,
      artifactManifest,
    });
    clearPendingSubmission();
    await loadHistory({ quiet: true });
    notify(t("模拟已完成，完整报告已载入。"), "positive");
    setView("overview");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    if (terminalStatus === "failed") clearPendingSubmission();
    const errorFieldPath =
      error instanceof BridgeApiError || error instanceof ExperimentRequestError ? error.fieldPath || "" : "";
    const errorTarget = errorFieldPath ? resolveExperimentErrorPointer(surface.value, errorFieldPath) : null;
    if (errorFieldPath && !errorTarget) {
      submissionContractError.value = `unknown_or_ambiguous_error_pointer: ${errorFieldPath}`;
      fieldPath.value = "";
    } else {
      fieldPath.value = errorTarget?.fieldPath || "";
    }
    const fieldPathLabel = errorFieldPath ? `（${errorFieldPath}）` : "";
    runStatus.value = t("运行失败：{message}{fieldPath}", { message: error.message, fieldPath: fieldPathLabel });
    notify(runStatus.value, "danger");
  } finally {
    if (waitController === controller) {
      submitting.value = false;
      waitController = null;
    }
  }
}

onBeforeUnmount(() => waitController?.abort());

async function loadJsonFile(event, target) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const value = JSON.parse(await file.text());
    if (target === "runtime") runtimeJson.value = JSON.stringify(value, null, 2);
    else if (target === "topology") topologyJson.value = JSON.stringify(value, null, 2);
    else designSpaceJson.value = JSON.stringify(value, null, 2);
  } catch (error) {
    notify(t("导入失败：{message}", { message: error.message }), "danger");
  } finally {
    event.target.value = "";
  }
}

async function loadBundle(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const value = JSON.parse(await file.text());
    if (!value.runtime_trace || !value.topology) throw new Error(t("输入包必须包含 runtime_trace 和 topology。"));
    runtimeJson.value = JSON.stringify(value.runtime_trace, null, 2);
    topologyJson.value = JSON.stringify(value.topology, null, 2);
    if (value.design_space_candidates) designSpaceJson.value = JSON.stringify(value.design_space_candidates, null, 2);
  } catch (error) {
    notify(t("导入输入包失败：{message}", { message: error.message }), "danger");
  } finally {
    event.target.value = "";
  }
}
</script>

<template>
  <div class="experiment-layout">
    <section class="experiment-main">
      <div v-if="!state.bridge.available" class="service-warning">
        <AlertCircle :size="19" />
        <div>
          <strong>{{ t("本地执行服务未连接") }}</strong>
          <p>{{ t(state.bridge.title) }}。{{ t("仍可编辑输入，版本同步后即可提交。") }}</p>
        </div>
      </div>
      <div v-if="surface.contractError || submissionContractError" class="service-warning">
        <AlertCircle :size="19" />
        <div>
          <strong>{{ t("契约错误，提交已关闭") }}</strong>
          <p>
            <code>{{ surface.contractError || submissionContractError }}</code>
          </p>
        </div>
      </div>

      <ExperimentIdentityPanel
        :form="form"
        :surface="surface"
        :field-path="displayFieldPath"
        data-help-anchor="experiment-identity"
      />
      <ExperimentInputPanel
        v-model:mode="mode"
        v-model:runtime-json="runtimeJson"
        v-model:topology-json="topologyJson"
        data-help-anchor="experiment-inputs"
        :form="form"
        :surface="surface"
        :control-groups="surface.controlGroups"
        :field-path="displayFieldPath"
        @reset-controls="resetControls"
        @load-template="loadTemplate"
        @load-bundle="loadBundle"
        @load-json-file="loadJsonFile"
      />
      <TracePackageInputPanel
        v-if="mode === 'trace_package'"
        :catalog="tracePackageCatalog"
        :status="tracePackageCatalogStatus"
        :error="tracePackageError"
        :inspect-error="tracePackageInspectError"
        :selected-package-id="selectedTracePackageId"
        :inspecting="inspectingTracePackage"
        :field-path="displayFieldPath"
        @select="selectTracePackage"
        @inspect="inspectSelectedTracePackage"
        @refresh="loadTracePackages(true)"
      />
      <DesignSpaceInputPanel
        v-else
        v-model="designSpaceJson"
        :field-path="displayFieldPath"
        @load-json-file="loadJsonFile"
      />
      <ExperimentCapabilityPanel
        data-help-anchor="experiment-capabilities"
        :capabilities="state.capabilities"
        :bridge="state.bridge"
        :surface="surface"
        :manifest="state.bridge.manifest"
      />
    </section>

    <ExperimentSubmitCard
      data-help-anchor="experiment-submit"
      :mode="mode"
      :form="form"
      :design-space-json="designSpaceJson"
      :can-run="canRun"
      :submitting="submitting"
      :run-status="runStatus"
      :request-preview="requestPreview"
      :surface="surface"
      :trace-package="selectedTracePackage"
      @submit="submit"
      @back="setView('overview')"
    />
  </div>
</template>
