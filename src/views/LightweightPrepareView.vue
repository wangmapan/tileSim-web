<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import {
  BridgeApiError,
  ExperimentCapabilityPanel,
  ExperimentIdentityPanel,
  ExperimentInputPanel,
  ExperimentRequestError,
  buildExperimentAgentContextPublication,
  buildExperimentRequestPreview,
  buildExperimentSurface,
  createExperimentForm,
  reconcileExperimentForm,
  runExperiment,
  type ExperimentFormState,
  type ExperimentAgentContextPublisher,
} from "../features/run-experiment";
import { useDashboard } from "../store/dashboard";
import { useLightweightStore } from "../stores/lightweight";
import { useI18n } from "../i18n";
import { preserveWorkbenchQuery } from "../features/lightweight-workbench";

const { state, notify, updateExperimentSubmission, clearExperimentSubmission } = useDashboard();
const lightweight = useLightweightStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const props = defineProps<{ agentContextPublisher?: ExperimentAgentContextPublisher }>();
const mode = ref<"controls" | "json" | "trace_package">(lightweight.draft.mode);
const runtimeJson = ref("");
const topologyJson = ref("");
const designSpaceJson = ref("");
const submitting = ref(false);
const errorMessage = ref("");
let agentContextSequence = 0;
const query = computed(() => preserveWorkbenchQuery(route.query));
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
const surface = computed(() =>
  buildExperimentSurface(
    state.catalog,
    state.capabilities,
    state.experiment.descriptor,
    state.experiment.status,
    state.experiment.error,
  ),
);

function createRestoredForm(): ExperimentFormState {
  const defaults = createExperimentForm(surface.value);
  const saved = lightweight.draft.form;
  if (!saved || typeof saved !== "object") return defaults;

  // Drafts are intentionally best-effort session state. Keep only fields
  // whose primitive shape is safe to hand to the canonical request builder;
  // reconcileExperimentForm below removes values that the current descriptor
  // no longer exposes.
  const scenarioId = typeof saved.scenario_id === "string" ? saved.scenario_id : defaults.scenario_id;
  const fidelityPolicy = typeof saved.fidelity_policy === "string" ? saved.fidelity_policy : defaults.fidelity_policy;
  const gpuParticipationMode =
    typeof saved.gpu_participation_mode === "string" ? saved.gpu_participation_mode : defaults.gpu_participation_mode;
  const runName = typeof saved.run_name === "string" ? saved.run_name : defaults.run_name;
  const parameterValues =
    saved.parameterValues && typeof saved.parameterValues === "object"
      ? { ...defaults.parameterValues, ...saved.parameterValues }
      : defaults.parameterValues;

  return {
    scenario_id: scenarioId,
    fidelity_policy: fidelityPolicy,
    gpu_participation_mode: gpuParticipationMode,
    run_name: runName,
    parameterValues,
  };
}

// Child panels expose the form through `defineModel`; keep the binding
// assignable so Vue does not compile a const-model update warning in the
// lightweight surface. The reactive object itself remains the single form
// state shared by preview, Agent context, draft persistence and submission.
let form = reactive(createRestoredForm());

watch(
  surface,
  (next) => {
    reconcileExperimentForm(form, next);
    // A persisted draft can outlive a capability/descriptor revision. Keep
    // the lightweight selector on a mode the current canonical surface
    // actually advertises instead of leaving a dead, un-submittable mode
    // selected after refresh.
    if (!next.inputModes.includes(mode.value)) mode.value = next.inputModes[0] || "controls";
  },
  { immediate: true },
);
watch([form, mode], () => lightweight.setDraft(form, mode.value), { deep: true });

function publishAgentContext(): void {
  if (!props.agentContextPublisher) return;
  agentContextSequence += 1;
  const rawQueryRunId = Array.isArray(route.query.run) ? route.query.run[0] : route.query.run;
  const queryRunId = typeof rawQueryRunId === "string" && /^run-[\w-]+$/.test(rawQueryRunId) ? rawQueryRunId : null;
  props.agentContextPublisher(
    buildExperimentAgentContextPublication({
      form,
      surface: surface.value,
      mode: mode.value,
      contextRevision: `context:lightweight_prepare:${queryRunId || "no-run"}:${state.bridge.manifest?.schema_set_revision || "schema-unavailable"}:${backendRevision.value}:${agentContextSequence}`,
      runId: queryRunId,
      pageAvailable: Boolean(
        state.bridge.connected && state.bridge.manifest && state.bridge.available && !state.bridge.checking,
      ),
      pageId: "lightweight-prepare",
      routeName: "lightweight_prepare",
      displayLabel: "轻量实验配置",
    }),
  );
}

watch(
  [
    form,
    surface,
    mode,
    () => route.query.run,
    () => state.bridge.manifest?.schema_set_revision,
    backendRevision,
    () => state.bridge.connected,
    () => state.bridge.available,
    () => state.bridge.checking,
  ],
  publishAgentContext,
  { deep: true, immediate: true },
);

const preview = computed(() =>
  buildExperimentRequestPreview({
    form,
    mode: mode.value,
    surface: surface.value,
    runtimeJson: runtimeJson.value,
    topologyJson: topologyJson.value,
    designSpaceJson: designSpaceJson.value,
    tracePackageId: "",
  }),
);
const canSubmit = computed(() => Boolean(state.bridge.available && preview.value.request && !submitting.value));
const unavailableFields = computed(() =>
  surface.value.controlGroups.flatMap((group) => group.fields).filter((field) => !field.available),
);
const advancedCount = computed(() =>
  Math.max(0, surface.value.controlGroups.flatMap((group) => group.fields).length - 4),
);

function inputEvent(event: Event, target: "runtime" | "topology") {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  void file.text().then((text) => (target === "runtime" ? (runtimeJson.value = text) : (topologyJson.value = text)));
  input.value = "";
}

async function loadTemplate() {
  try {
    const template = await runExperiment.getTemplate(form.scenario_id);
    runtimeJson.value = JSON.stringify(template.runtime_trace, null, 2);
    topologyJson.value = JSON.stringify(template.topology, null, 2);
    notify(t("已加载当前场景模板。"), "positive");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notify(t("加载模板失败：{message}", { message }), "danger");
  }
}

async function loadBundle(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const value = JSON.parse(await file.text());
    if (!value || typeof value !== "object" || !value.runtime_trace || !value.topology) {
      throw new Error(t("输入包必须包含 runtime_trace 和 topology。"));
    }
    runtimeJson.value = JSON.stringify(value.runtime_trace, null, 2);
    topologyJson.value = JSON.stringify(value.topology, null, 2);
    if (value.design_space_candidates) designSpaceJson.value = JSON.stringify(value.design_space_candidates, null, 2);
    notify(t("已导入完整输入包。"), "positive");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notify(t("导入输入包失败：{message}", { message }), "danger");
  } finally {
    input.value = "";
  }
}

async function submit() {
  errorMessage.value = "";
  if (!preview.value.request) {
    errorMessage.value = preview.value.error?.message || (t("请先修正表单错误。") as string);
    return;
  }
  submitting.value = true;
  try {
    const payload = preview.value.request;
    const payloadText = JSON.stringify(payload);
    let created: Awaited<ReturnType<typeof runExperiment.create>>;
    if (state.experimentSubmission.payloadText === payloadText && state.experimentSubmission.runId) {
      created = {
        run_id: state.experimentSubmission.runId,
        run_name: form.run_name || state.experimentSubmission.runId,
        idempotent_replay: true,
      };
    } else {
      if (state.experimentSubmission.payloadText !== payloadText || !state.experimentSubmission.idempotencyKey) {
        updateExperimentSubmission({
          payloadText,
          idempotencyKey: `lightweight-${crypto.randomUUID()}`,
          runId: "",
        });
      }
      try {
        created = await runExperiment.create(payload, state.experimentSubmission.idempotencyKey);
      } catch (error) {
        if (error instanceof BridgeApiError && error.status >= 400 && error.status < 500 && !error.retryable) {
          clearExperimentSubmission();
        }
        throw error;
      }
      updateExperimentSubmission({ idempotencyKey: "", runId: created.run_id });
    }
    const runId = created.run_id;
    const health = state.bridge.identity;
    lightweight.setRun({
      runId,
      runName: created.run_name || form.run_name || runId,
      payloadText: JSON.stringify(payload),
      artifactSha256: null,
      schemaSetRevision: state.bridge.manifest?.schema_set_revision || null,
      backendIdentity: health,
      requestedFidelity: form.fidelity_policy || null,
      resolvedFidelity: null,
      status: "preparing",
      stage: "preparing",
      error: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await router.push({ name: "lightweight_run", params: { runId }, query: query.value });
  } catch (error) {
    errorMessage.value =
      error instanceof BridgeApiError || error instanceof ExperimentRequestError ? error.message : String(error);
    notify(t("实验提交失败：{message}", { message: errorMessage.value }), "danger");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="lightweight-prepare" aria-labelledby="lightweight-prepare-title">
    <header class="lightweight-page__heading lightweight-prepare__heading">
      <p class="section-kicker">{{ t("新建实验") }}</p>
      <h1 id="lightweight-prepare-title">{{ t("配置一次可追溯的实验") }}</h1>
    </header>

    <section v-if="!state.bridge.available" class="lightweight-followup lightweight-followup--error" role="alert">
      <strong>{{ t("本地 Bridge 暂不可用") }}</strong
      ><span>{{ t("可以继续查看字段，但校验和提交会保持关闭。") }}</span>
    </section>
    <section v-if="errorMessage" class="lightweight-followup lightweight-followup--error" role="alert">
      {{ errorMessage }}
    </section>

    <section data-help-anchor="lightweight_prepare-identity">
      <ExperimentIdentityPanel v-model:form="form" :surface="surface" compact />
    </section>
    <section class="panel lightweight-source" data-help-anchor="lightweight_prepare-inputs">
      <header>
        <p class="section-kicker">{{ t("输入与 fidelity") }}</p>
        <h2>{{ t("输入来源") }}</h2>
      </header>
      <div class="field">
        <span>{{ t("trace 来源") }}</span>
        <ul class="lightweight-source-list">
          <li
            v-for="option in surface.sourceModeOptions"
            :key="option.value"
            :class="{ 'is-unavailable': !option.available }"
          >
            <strong>{{ option.value }}</strong>
            <span>{{ option.available ? option.claimScope : t("unavailable") }}</span>
            <small v-if="!option.available">{{ option.reason || t("当前契约未开放") }}</small>
          </li>
        </ul>
      </div>
    </section>
    <section>
      <ExperimentInputPanel
        v-model:form="form"
        v-model:mode="mode"
        v-model:runtime-json="runtimeJson"
        v-model:topology-json="topologyJson"
        :surface="surface"
        :control-groups="surface.controlGroups"
        compact
        @load-template="loadTemplate"
        @load-bundle="loadBundle"
        @load-json-file="inputEvent"
      />
      <ExperimentCapabilityPanel
        :capabilities="state.capabilities"
        :bridge="state.bridge"
        :surface="surface"
        :manifest="state.bridge.manifest || undefined"
        compact
      />
    </section>

    <details class="panel lightweight-advanced">
      <summary>{{ t("高级配置（默认收起）") }} · {{ t("已隐藏 {count} 项", { count: advancedCount }) }}</summary>
      <RouterLink class="button button--secondary" :to="{ name: 'experiment', query: query }">{{
        t("进入专业版继续编辑")
      }}</RouterLink>
      <label v-if="mode === 'json'" class="field"
        ><span>Design space JSON</span><textarea v-model="designSpaceJson" spellcheck="false" />
      </label>
    </details>

    <section
      class="panel lightweight-confirm"
      aria-labelledby="lightweight-confirm-title"
      data-help-anchor="lightweight_prepare-submit"
    >
      <div class="lightweight-confirm__header">
        <div>
          <p class="section-kicker">{{ t("校验与确认") }}</p>
          <h2 id="lightweight-confirm-title">{{ t("提交前摘要") }}</h2>
        </div>
        <span :class="['status-badge', preview.request ? 'status-badge--positive' : 'status-badge--warning']">{{
          preview.request ? t("校验通过") : t("待修正")
        }}</span>
      </div>
      <dl class="lightweight-confirm__grid">
        <div>
          <dt>{{ t("实验名称") }}</dt>
          <dd>{{ form.run_name || t("未命名实验") }}</dd>
        </div>
        <div>
          <dt>{{ t("输入来源") }}</dt>
          <dd>synthetic_trace · {{ t("compatibility only") }}</dd>
        </div>
        <div>
          <dt>{{ t("requested fidelity") }}</dt>
          <dd>{{ form.fidelity_policy || t("missing") }}</dd>
        </div>
        <div>
          <dt>{{ t("resolved fidelity") }}</dt>
          <dd>{{ t("提交后由后端确认") }}</dd>
        </div>
        <div>
          <dt>{{ t("结果类型") }}</dt>
          <dd>{{ t("以真实 report/schema 为准") }}</dd>
        </div>
        <div>
          <dt>{{ t("不可用项") }}</dt>
          <dd>{{ unavailableFields.length ? t("{count} 项已禁用", { count: unavailableFields.length }) : t("无") }}</dd>
        </div>
      </dl>
      <p class="lightweight-confirm__note">
        {{ t("提交会创建一个正式 run，并可能启动本地仿真；不会调用 Provider。") }}
      </p>
      <div class="lightweight-confirm__actions">
        <RouterLink class="button button--ghost" :to="{ name: 'lightweight', query }">{{ t("返回工作台") }}</RouterLink
        ><button class="button button--primary" :disabled="!canSubmit" @click="submit">
          {{ submitting ? t("正在提交…") : t("校验并提交实验") }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lightweight-prepare {
  display: grid;
  gap: 24px;
  max-width: 980px;
  padding-bottom: 24px;
}
.lightweight-prepare__heading {
  max-width: 720px;
}
.lightweight-source {
  display: grid;
  gap: 14px;
  padding: 20px;
}
.lightweight-source h2,
.lightweight-source .section-kicker {
  margin: 0;
}
.lightweight-source-list {
  display: grid;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.lightweight-source-list li {
  display: grid;
  grid-template-columns: minmax(150px, 0.8fr) 1fr;
  gap: 4px 12px;
  padding: 9px 11px;
  border: 1px solid var(--line);
  background: var(--surface-subtle);
}
.lightweight-source-list li span,
.lightweight-source-list li small {
  color: var(--muted);
}
.lightweight-source-list li small {
  grid-column: 1 / -1;
}
.lightweight-source-list li.is-unavailable {
  opacity: 0.72;
}
.lightweight-advanced {
  display: grid;
  gap: 12px;
  padding: 18px 20px;
}
.lightweight-advanced summary {
  cursor: pointer;
  font-weight: 700;
}
.lightweight-confirm {
  display: grid;
  gap: 18px;
  padding: 22px;
  border-color: var(--line-strong);
  box-shadow: 0 5px 18px color-mix(in srgb, var(--ink) 8%, transparent);
}
@media (min-width: 1100px) {
  .lightweight-confirm {
    position: sticky;
    z-index: 3;
    bottom: 16px;
  }
}
.lightweight-confirm__header,
.lightweight-confirm__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 4px;
  border-top: 1px solid var(--line);
}
.lightweight-confirm h2 {
  margin: 4px 0 0;
}
.lightweight-confirm__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin: 0;
}
.lightweight-confirm__grid div {
  padding-top: 10px;
  border-top: 1px solid var(--line);
}
.lightweight-confirm dt {
  color: var(--muted);
  font-size: var(--text-xs);
}
.lightweight-confirm dd {
  margin: 5px 0 0;
  font-weight: 650;
}
.lightweight-confirm__note {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-sm);
}
.status-badge {
  padding: 4px 9px;
  border-radius: 999px;
  font-size: var(--text-xs);
  font-weight: 700;
}
.status-badge--positive {
  color: var(--success-ink, var(--ink));
  background: var(--success-soft);
}
.status-badge--warning {
  color: var(--warning-ink, var(--ink));
  background: var(--warning-soft);
}
@media (max-width: 760px) {
  .lightweight-prepare {
    padding-bottom: 24px;
  }
  .lightweight-confirm__grid {
    grid-template-columns: 1fr 1fr;
  }
  .lightweight-confirm__actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }
}
</style>
