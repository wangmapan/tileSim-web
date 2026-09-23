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
  applyParameterEdits,
  buildExperimentAgentContextPublication,
  buildExperimentRequestPreview,
  buildExperimentSurface,
  createExperimentForm,
  enterStructuredInput,
  reconcileExperimentForm,
  resolveExperimentErrorPointer,
  resetExperimentControls,
  runExperiment,
  fetchTracePackageCatalog,
  inspectTracePackage,
  tracePackageBackendIdentity,
} from "../features/run-experiment";
import { UNPUBLISHED_CONTEXT_REVISION, createPageContextRevisionKeeper } from "../entities/agent-context";
import { useDashboard } from "../store/dashboard";
import { useI18n } from "../i18n";

const props = defineProps({
  agentContextPublisher: { type: Function, default: null },
  /** Downward channel for assistant parameter edits; owned by App.vue. */
  agentCommandRegistry: { type: Object, default: null },
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
/** Off by default: the quick-control tab keeps its overrides path until asked. */
const structuredInput = ref(false);
const tracePackageCatalog = ref(null);
const tracePackageCatalogStatus = ref("idle");
const tracePackageError = ref("");
const tracePackageInspectError = ref("");
const selectedTracePackageId = ref("");
const inspectingTracePackage = ref(false);
const fieldPath = ref("");
const submissionContractError = ref("");
const pendingSubmission = state.experimentSubmission;
const backendRevision = computed(
  () =>
    [
      state.bridge.identity?.source_revision,
      state.bridge.identity?.build_revision,
      state.bridge.identity?.source_state_digest,
      state.bridge.identity?.build_state_digest,
      state.bridge.identity?.deployment_ref,
    ]
      .filter(Boolean)
      .join("|") || "backend-unavailable",
);
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
// Experiment panels use `defineModel`; an assignable binding avoids Vue's
// const-model compiler warning while retaining one reactive canonical form.
let form = reactive(createExperimentForm(surface.value));
/** Holds this page's context revision steady while its published content is unchanged. */
const agentContextRevision = createPageContextRevisionKeeper();
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
    structuredInput: structuredInput.value,
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

const AGENT_COMMAND_PROVIDER_ID = "experiment";

function publishAgentContext() {
  if (!props.agentContextPublisher) return;
  // `onActivated` calls this too, so a kept-alive view re-declares itself the
  // live page whenever it comes back into view — the handler and the catalogue
  // are then describing the same form again.
  props.agentCommandRegistry?.activate(AGENT_COMMAND_PROVIDER_ID);
  const build = (contextRevision) =>
    buildExperimentAgentContextPublication({
      form,
      surface: surface.value,
      mode: mode.value,
      contextRevision,
      runId: state.runId || null,
      pageAvailable: Boolean(
        state.bridge.connected && state.bridge.manifest && state.bridge.available && !state.bridge.checking,
      ),
      runtimeJson: runtimeJson.value,
      topologyJson: topologyJson.value,
    });
  // The watcher below fires whenever one of its inputs is touched, which is not
  // the same as this page having changed. The keeper keeps the revision steady
  // across those firings, so a plan read moments earlier is not refused — but it
  // is still this function's job to *declare* the context every time: the shell
  // also publishes a generic projection under the same provider id, and this
  // view is kept alive, so returning to it must put the form's own context back
  // rather than leave the parameter-free projection in place.
  const { revision } = agentContextRevision(
    `context:experiment:${state.runId || "no-run"}:${state.bridge.manifest?.schema_set_revision || "schema-unavailable"}:${backendRevision.value}`,
    build(UNPUBLISHED_CONTEXT_REVISION),
  );
  props.agentContextPublisher(build(revision));
}

watch(
  [
    form,
    surface,
    mode,
    runtimeJson,
    topologyJson,
    () => state.runId,
    () => state.bridge.manifest?.schema_set_revision,
    backendRevision,
    () => state.bridge.connected,
    () => state.bridge.available,
    () => state.bridge.checking,
  ],
  publishAgentContext,
  { deep: true, immediate: true },
);
onActivated(publishAgentContext);

/**
 * Writes the assistant's resolved edits into this view's own state.
 *
 * Knobs and the four top-level fields land in the reactive form; everything
 * else is patched into the two `custom_inputs` documents, which is also why an
 * edit that lands there has to open the structured channel — the scalar
 * `overrides` channel never carries requests, devices or topology.
 */
function applyAgentParameterEdits(edits) {
  const outcome = applyParameterEdits({
    items: edits,
    runtimeJson: runtimeJson.value,
    topologyJson: topologyJson.value,
  });
  const receipts = [];
  outcome.applied.forEach((item) => {
    if (item.target === "control" && item.fieldId) {
      form.parameterValues[item.fieldId] = item.value;
    } else if (item.target === "form") {
      if (item.path === "run_name") form.run_name = String(item.value);
      else if (item.path === "scenario_id") form.scenario_id = String(item.value);
      else if (item.path === "fidelity_policy") form.fidelity_policy = String(item.value);
      else if (item.path === "gpu_participation_mode") form.gpu_participation_mode = String(item.value);
    }
    receipts.push({
      path: item.path,
      label: item.label,
      previous: item.previous,
      next: item.next,
      status: "applied",
      reason: "",
    });
  });
  outcome.rejected.forEach((item) => {
    receipts.push({
      path: item.raw,
      label: item.raw,
      previous: null,
      next: "",
      status: "rejected",
      reason: item.reason,
    });
  });
  runtimeJson.value = outcome.runtimeJson;
  topologyJson.value = outcome.topologyJson;
  const channelMoved = outcome.requiresStructuredInput && !structuredInput.value;
  if (channelMoved) structuredInput.value = true;
  const applied = receipts.filter((item) => item.status === "applied").length;
  return {
    receipts,
    channelMoved,
    note: applied ? `已写入 ${applied} 项参数，没有创建运行。` : "没有参数被写入，请检查被拒的原因。",
  };
}

const unregisterAgentCommands = props.agentCommandRegistry?.register(
  AGENT_COMMAND_PROVIDER_ID,
  applyAgentParameterEdits,
);
onBeforeUnmount(() => unregisterAgentCommands?.());

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

/**
 * R2: hand the quick-control values over to the structured editors that open
 * underneath them. A failed template load aborts the hand-off, so the tab is
 * never left claiming a channel it has no document for.
 */
async function useStructuredInput() {
  const result = await enterStructuredInput({
    runtimeJson: runtimeJson.value,
    topologyJson: topologyJson.value,
    fields: surface.value.controlGroups.flatMap((group) => group.fields),
    parameterValues: form.parameterValues,
    loadTemplate: () => runExperiment.getTemplate(form.scenario_id),
  });
  if (!result.ok) {
    notify(t("加载模板失败：{message}", { message: result.message }), "danger");
    return;
  }
  runtimeJson.value = result.runtimeJson;
  topologyJson.value = result.topologyJson;
  structuredInput.value = true;
  result.notes.forEach((note) => notify(note.message, note.impedes ? "warning" : "positive"));
}

function disableStructuredInput() {
  structuredInput.value = false;
  notify(t("已停用结构化编辑，本次提交改回 overrides。"), "neutral");
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
        v-model:structured-input="structuredInput"
        data-help-anchor="experiment-inputs"
        :form="form"
        :surface="surface"
        :control-groups="surface.controlGroups"
        :field-path="displayFieldPath"
        @reset-controls="resetControls"
        @load-template="loadTemplate"
        @load-bundle="loadBundle"
        @load-json-file="loadJsonFile"
        @use-structured-input="useStructuredInput"
        @disable-structured-input="disableStructuredInput"
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
