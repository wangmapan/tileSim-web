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
  previewParameterEdits,
  buildExperimentAgentContextPublication,
  buildExperimentRequestPreview,
  buildExperimentSurface,
  createExperimentForm,
  reconcileExperimentForm,
  resolveExperimentErrorPointer,
  resetExperimentControls,
  readExperimentInputDraft,
  saveExperimentInputDraft,
  runExperiment,
  templateHydrationRequestIsCurrent,
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
/** The experiment page opens with the complete structured input surface. */
const structuredInput = ref(true);
const pairingPending = ref(false);
let inputDraftRestored = false;
const inputDraftRevision = ref("");
const inputDraftStale = ref(false);
const inputDraftStaleRevision = ref("");
watch(
  () => state.bridge.manifest?.schema_set_revision,
  (revision) => {
    if (!revision) return;
    if (inputDraftRevision.value && inputDraftRevision.value !== revision) {
      inputDraftStale.value = true;
      inputDraftStaleRevision.value = revision;
      invalidateTemplateRequest();
      return;
    }
    if (inputDraftRestored) return;
    inputDraftRestored = true;
    inputDraftRevision.value = revision;
    // Never overwrite input already typed while the manifest was loading.
    if (runtimeJson.value || topologyJson.value || mode.value !== "controls") return;
    const saved = readExperimentInputDraft(revision);
    if (!saved) return;
    mode.value = saved.mode;
    runtimeJson.value = saved.runtimeJson;
    topologyJson.value = saved.topologyJson;
  },
  { immediate: true },
);
watch(
  [mode, runtimeJson, topologyJson, () => state.bridge.manifest?.schema_set_revision],
  ([currentMode, currentRuntime, currentTopology, revision]) => {
    if (
      revision &&
      !inputDraftStale.value &&
      inputDraftRevision.value === revision &&
      (currentMode === "controls" || currentMode === "json")
    )
      saveExperimentInputDraft(revision, {
        mode: currentMode,
        runtimeJson: currentRuntime,
        topologyJson: currentTopology,
      });
  },
);
const tracePackageCatalog = ref(null);
const tracePackageCatalogStatus = ref("idle");
const tracePackageError = ref("");
const tracePackageInspectError = ref("");
const selectedTracePackageId = ref("");
const inspectingTracePackage = ref(false);
const fieldPath = ref("");
const submissionContractError = ref("");
const intakeRejection = ref(null);
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
    // A JSON-capable surface owns the structured channel from the first
    // render, so an empty or partial document is rejected by the request
    // builder instead of silently falling back to scalar overrides. On a
    // controls-only surface, stale structured text is still passed through so
    // the builder can fail closed rather than drop it.
    structuredInput:
      structuredInput.value &&
      (surface.value.inputModes.includes("json") || Boolean(runtimeJson.value.trim() || topologyJson.value.trim())),
  }),
);
const displayFieldPath = computed(() => {
  const path = fieldPath.value || requestPreview.value.error?.fieldPath || "";
  return path ? resolveExperimentErrorPointer(surface.value, path)?.controlPointer || "" : "";
});
// Keep the exact nested Pointer for the editors. The coarse control pointer
// above is only for panels without per-request controls.
const inputFieldPath = computed(() => {
  const path = fieldPath.value || requestPreview.value.error?.fieldPath || "";
  return path && resolveExperimentErrorPointer(surface.value, path) ? path : "";
});
const inputErrorMessage = computed(() =>
  fieldPath.value ? runStatus.value : requestPreview.value.error?.message || "",
);
const canRun = computed(
  () =>
    state.bridge.available &&
    surface.value.canSubmit &&
    !submissionContractError.value &&
    !inputDraftStale.value &&
    requestPreview.value.request !== null &&
    (mode.value !== "trace_package" || selectedTracePackage.value?.submission_available === true) &&
    !pairingPending.value &&
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

let agentTemplateLoadKey = "";
let agentTemplateLoadPromise = null;
let templateRequestToken = 0;
let activeTemplateController = null;
let inputMutationToken = 0;
let experimentMounted = true;
let applyingTemplate = false;

watch(
  [runtimeJson, topologyJson],
  () => {
    if (applyingTemplate) return;
    inputMutationToken += 1;
    if (activeTemplateController) {
      templateRequestToken += 1;
      activeTemplateController.abort();
      activeTemplateController = null;
      agentTemplateLoadPromise = null;
    }
  },
  { flush: "sync" },
);

// Scalar controls are user input too.  The automatic template request can be
// in flight before the first control is touched; without fencing this object,
// its response could hydrate the JSON documents afterwards and project the
// template's value back over the user's edit.
watch(
  () => form.parameterValues,
  () => {
    if (applyingTemplate) return;
    inputMutationToken += 1;
    if (activeTemplateController) {
      templateRequestToken += 1;
      activeTemplateController.abort();
      activeTemplateController = null;
      agentTemplateLoadPromise = null;
    }
  },
  { deep: true, flush: "sync" },
);

function currentTemplateContext() {
  const manifest = state.bridge.manifest;
  return {
    scenarioId: form.scenario_id,
    schemaRevision: manifest?.schema_set_revision || "",
    mode: mode.value,
    inputToken: inputMutationToken,
  };
}

function clearTemplateRequest(controller, token) {
  if (activeTemplateController !== controller || templateRequestToken !== token) return;
  activeTemplateController = null;
  agentTemplateLoadPromise = null;
}

function invalidateTemplateRequest() {
  templateRequestToken += 1;
  activeTemplateController?.abort();
  activeTemplateController = null;
  agentTemplateLoadPromise = null;
}

function fenceTemplateForUserInput() {
  if (applyingTemplate) return;
  inputMutationToken += 1;
  invalidateTemplateRequest();
}

async function requestExperimentTemplate(explicit) {
  const context = currentTemplateContext();
  const key = `${context.scenarioId}:${context.schemaRevision}`;
  if (!explicit && agentTemplateLoadKey === key) return { stale: false, loaded: false };
  if (agentTemplateLoadPromise && !explicit) return agentTemplateLoadPromise;
  if (explicit && activeTemplateController) {
    invalidateTemplateRequest();
  }
  const token = ++templateRequestToken;
  const controller = new AbortController();
  activeTemplateController = controller;
  const promise = (async () => {
    let loaded = false;
    try {
      const template = await runExperiment.getTemplate(context.scenarioId);
      if (
        !templateHydrationRequestIsCurrent(
          { token, controller, ...context },
          {
            mounted: experimentMounted,
            token: templateRequestToken,
            controller: activeTemplateController,
            scenarioId: form.scenario_id,
            schemaRevision: state.bridge.manifest?.schema_set_revision || "",
            mode: mode.value,
            inputToken: inputMutationToken,
          },
        )
      )
        return { stale: true, loaded: false };
      if (!template || template.runtime_trace === undefined || template.topology === undefined) {
        throw new Error(t("模板没有返回完整 runtime_trace 和 topology。"));
      }
      applyingTemplate = true;
      try {
        runtimeJson.value = JSON.stringify(template.runtime_trace, null, 2);
        topologyJson.value = JSON.stringify(template.topology, null, 2);
      } finally {
        applyingTemplate = false;
      }
      loaded = true;
      agentTemplateLoadKey = key;
      inputDraftStale.value = false;
      inputDraftStaleRevision.value = "";
      inputDraftRevision.value = context.schemaRevision;
      return { stale: false, loaded: true };
    } catch (error) {
      if (controller.signal.aborted || !experimentMounted) return { stale: true, loaded: false };
      if (!explicit) return { stale: false, loaded: false };
      throw error;
    } finally {
      if (!loaded && agentTemplateLoadKey === key) agentTemplateLoadKey = "";
      clearTemplateRequest(controller, token);
    }
  })();
  agentTemplateLoadPromise = promise;
  return promise;
}

/**
 * Give the Agent a real structured scenario to reason about on first entry.
 * This is context hydration only: it never opens the editor, changes the
 * submission mode, or creates a run. A partially entered draft always wins.
 */
async function ensureAgentStructuredContext() {
  const manifest = state.bridge.manifest;
  const hasScalarDraft = Object.values(form.parameterValues || {}).some(
    (value) => value !== undefined && value !== null && value !== "",
  );
  if (
    !inputDraftRestored ||
    !state.bridge.connected ||
    !state.bridge.available ||
    state.bridge.checking ||
    !manifest ||
    surface.value.contractStatus === "contract_error" ||
    !surface.value.inputModes.includes("json") ||
    (mode.value !== "controls" && mode.value !== "json") ||
    hasScalarDraft ||
    runtimeJson.value.trim() ||
    topologyJson.value.trim()
  ) {
    return;
  }
  const key = `${form.scenario_id}:${manifest.schema_set_revision}`;
  if (agentTemplateLoadKey === key) return;
  if (agentTemplateLoadPromise) return agentTemplateLoadPromise;
  if (runtimeJson.value.trim() || topologyJson.value.trim()) return;
  return requestExperimentTemplate(false);
}

watch(mode, () => invalidateTemplateRequest());
watch(
  () => form.scenario_id,
  (next, previous) => {
    if (next !== previous) {
      agentTemplateLoadKey = "";
      invalidateTemplateRequest();
    }
  },
);

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
  void ensureAgentStructuredContext();
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
function applyAgentParameterEdits(edits, structuredInputs) {
  const outcome = applyParameterEdits({
    items: edits,
    runtimeJson: runtimeJson.value,
    topologyJson: topologyJson.value,
    structuredInputs,
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
  if (structuredInputs && outcome.rejected.length === 0) {
    receipts.push({
      path: "custom_inputs",
      label: "完整 synthetic runtime_trace + topology",
      previous: "当前输入",
      next: "助手生成的 JSON",
      status: "applied",
      reason: "仅写入草案，没有创建运行。",
    });
  }
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

function previewAgentParameterEdits(edits, structuredInputs) {
  return previewParameterEdits({
    items: edits,
    runtimeJson: runtimeJson.value,
    topologyJson: topologyJson.value,
    structuredInputs,
  });
}

const unregisterAgentCommands = props.agentCommandRegistry?.register(
  AGENT_COMMAND_PROVIDER_ID,
  applyAgentParameterEdits,
  previewAgentParameterEdits,
);
onBeforeUnmount(() => unregisterAgentCommands?.());

function resetControls() {
  resetExperimentControls(form, surface.value);
}

async function loadTemplate() {
  try {
    const result = await requestExperimentTemplate(true);
    if (result.stale || !result.loaded) return;
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
  intakeRejection.value = null;
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
          // The Agent event endpoint is a bounded replay of durable events. It
          // closes after the available cursor is drained; the query layer then
          // continues with durable polling. Calling this "live status" would
          // overstate the transport semantics (and imply an open monitor).
          runStatus.value = `${label} · ${transport === "sse" ? t("事件回放") : t("轮询恢复")}`;
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
    if (
      error instanceof BridgeApiError &&
      error.status === 422 &&
      error.code === "trace_package_inspect_nonzero_exit"
    ) {
      intakeRejection.value = {
        code: error.code,
        fieldPath: error.fieldPath || "/trace_package_id",
        message: error.message,
      };
    }
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
    runStatus.value = intakeRejection.value
      ? t("输入在 intake 阶段被拒绝，尚未创建 run")
      : t("运行失败：{message}{fieldPath}", { message: error.message, fieldPath: fieldPathLabel });
    notify(runStatus.value, "danger");
  } finally {
    if (waitController === controller) {
      submitting.value = false;
      waitController = null;
    }
  }
}

onBeforeUnmount(() => {
  experimentMounted = false;
  waitController?.abort();
  templateRequestToken += 1;
  activeTemplateController?.abort();
  activeTemplateController = null;
  agentTemplateLoadPromise = null;
});

async function loadJsonFile(event, target) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const value = JSON.parse(await file.text());
    if (target === "runtime") runtimeJson.value = JSON.stringify(value, null, 2);
    else if (target === "topology") topologyJson.value = JSON.stringify(value, null, 2);
    else designSpaceJson.value = JSON.stringify(value, null, 2);
    if (target === "runtime" || target === "topology") {
      inputDraftRevision.value = state.bridge.manifest?.schema_set_revision || inputDraftRevision.value;
      inputDraftStale.value = false;
      inputDraftStaleRevision.value = "";
    }
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
    inputDraftRevision.value = state.bridge.manifest?.schema_set_revision || inputDraftRevision.value;
    inputDraftStale.value = false;
    inputDraftStaleRevision.value = "";
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
      <div v-if="state.bridge.available && (surface.contractError || submissionContractError)" class="service-warning">
        <AlertCircle :size="19" />
        <div>
          <strong>{{ t("契约错误，提交已关闭") }}</strong>
          <p>
            <code>{{ surface.contractError || submissionContractError }}</code>
          </p>
        </div>
      </div>
      <div v-if="intakeRejection" class="service-warning" role="alert">
        <AlertCircle :size="19" />
        <div>
          <strong>{{ t("输入在 intake 阶段被拒绝，尚未创建 run") }}</strong>
          <p>
            <code>{{ intakeRejection.code }}</code>
            · {{ t("字段路径") }} <code>{{ intakeRejection.fieldPath }}</code>
          </p>
          <p>{{ intakeRejection.message }}</p>
          <p>{{ t("请修正 Trace package 后重试；本次没有运行状态或归因工件可读取。") }}</p>
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
        v-model:pairing-pending="pairingPending"
        data-help-anchor="experiment-inputs"
        :form="form"
        :surface="surface"
        :control-groups="surface.controlGroups"
        :model-ids="state.catalog?.model_ids || []"
        :field-path="inputFieldPath"
        :error-message="inputErrorMessage"
        :draft-stale="inputDraftStale"
        :draft-stale-revision="inputDraftStaleRevision"
        @reset-controls="resetControls"
        @load-template="loadTemplate"
        @load-bundle="loadBundle"
        @load-json-file="loadJsonFile"
        @input-mutation="fenceTemplateForUserInput"
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
      <ExperimentSubmitCard
        data-help-anchor="experiment-submit"
        :can-run="canRun"
        :submitting="submitting"
        :run-status="runStatus"
        @submit="submit"
      />
      <details class="experiment-request-preview" hidden aria-hidden="true">
        <summary>{{ t("查看等价 JSON request") }}</summary>
        <pre v-if="requestPreview.text" tabindex="0" role="region" :aria-label="t('等价 JSON request')">{{
          requestPreview.text
        }}</pre>
        <p v-else class="request-preview-error">
          <code>{{ requestPreview.error?.fieldPath || "contract_gap" }}</code>
          {{ requestPreview.error?.message || t("请求不可提交。") }}
        </p>
      </details>
    </section>
  </div>
</template>
