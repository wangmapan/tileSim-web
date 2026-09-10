<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { RouterView, useRoute } from "vue-router";
import AppHeader from "./components/AppHeader.vue";
import AppSidebar from "./components/AppSidebar.vue";
import EvidenceStrip from "./components/EvidenceStrip.vue";
import ToastStack from "./components/ToastStack.vue";
import UnsupportedSchemaView from "./views/UnsupportedSchemaView.vue";
import { useDashboard } from "./store/dashboard";
import { unsupportedSchemaReports } from "./lib/reports";
import { useI18n } from "./i18n";
import { useEvidenceSelectionStore } from "./stores/evidence-selection";
import { guideFor, GuidedHelpHost, PagePrimer, type GuideId } from "./features/guided-help";
import {
  PHASE1_LOCAL_CONTRACT_REVISION,
  type AgentCopilotPanelState,
  type AgentCopilotSubmitPayload,
  type AgentTypedBlock,
  type DraftFieldValue,
  type PageContextEnvelope,
} from "./entities/agent-orchestration";
import { createAgentContextRegistry } from "./entities/agent-context";
import { AgentCopilotEntry } from "./features/agent-copilot-shell";
import {
  buildPhase1CapabilityProjection,
  formalErrorBlock,
  intentOutputToTypedBlocks,
  markAgentBlocksStale,
  redactSingleTurnInstruction,
  unsupportedResultForUnavailableContext,
} from "./features/agent-copilot-integration";
import { compileIntent } from "./features/agent-intent-compiler";
import type { ExperimentAgentContextPublication } from "./features/run-experiment";
import { getAgentOrchestrationCapabilitySnapshot } from "./lib/api/agent-orchestration-capabilities";

const activeRoute = useRoute();
const { state, initialize, synchronizeNavigation } = useDashboard();
const unsupported = computed(() => unsupportedSchemaReports(state.bundle));
const rejectedUnsupported = computed(
  () => state.artifactManifest?.rejected_artifacts.filter((item) => item.reason === "unsupported_schema") || [],
);
const showUnsupported = computed(
  () =>
    (unsupported.value.length > 0 || rejectedUnsupported.value.length > 0) &&
    !["experiment", "history", "evidence_lab"].includes(state.view),
);
const { t, isEnglish } = useI18n();
const evidenceSelection = useEvidenceSelectionStore();
const currentGuideId = computed<GuideId>(() =>
  showUnsupported.value ? "unsupported_schema" : ((guideFor(state.view)?.id || "overview") as GuideId),
);
const currentGuide = computed(() => guideFor(currentGuideId.value));
const agentContextRegistry = createAgentContextRegistry();
const agentContext = shallowRef<PageContextEnvelope | null>(null);
const agentCurrentValues = shallowRef<Readonly<Record<string, DraftFieldValue | null>>>({});
const agentBlocks = shallowRef<readonly AgentTypedBlock[]>([]);
const agentPanelState = ref<AgentCopilotPanelState>("closed");
const agentPanelWidth = ref(420);
const agentStatus = ref("可以开始");
let appContextSequence = 0;

const unregisterAgentContext = agentContextRegistry.register("app-shell", genericPageContext());
const unsubscribeAgentContext = agentContextRegistry.subscribe((context) => {
  agentContext.value = context;
});

const agentDockStyle = computed(() => {
  const dockWidth =
    agentPanelState.value === "collapsed"
      ? 52
      : agentPanelState.value === "expanded"
        ? Math.min(760, Math.max(agentPanelWidth.value, 680))
        : agentPanelState.value === "open"
          ? agentPanelWidth.value
          : 0;
  return { "--agent-copilot-dock-width": `${dockWidth}px` };
});

function genericPageContext(): PageContextEnvelope {
  appContextSequence += 1;
  const routeName = typeof activeRoute.name === "string" ? activeRoute.name : "overview";
  const schemaRevision = state.bridge.manifest?.schema_set_revision || "schema-unavailable";
  const routeRevision = encodeURIComponent(activeRoute.fullPath || `/${routeName}`);
  const revision = `context:${routeName}:${routeRevision}:${state.runId || "no-run"}:${schemaRevision}:${appContextSequence}`;
  return {
    contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
    page_id: `page-${routeName}`,
    route_name: routeName,
    context_revision: revision,
    workspace_ref: null,
    run_ref: state.runId ? { run_id: state.runId, revision: state.runId } : null,
    selected_entity: null,
    resources: state.runId
      ? [
          {
            resource_type: "run",
            resource_id: state.runId,
            revision: state.runId,
            display_label: state.runName || state.runId,
            availability: "available",
          },
        ]
      : [],
    supported_actions: ["explain", "check_capability"],
    data_classification: state.runId ? "workspace_internal" : "public",
    allowed_purposes: ["explain"],
    expires_at: null,
    display_label: state.runId ? `${routeName} · ${state.runName || state.runId}` : routeName,
    availability: "available",
  };
}

function synchronizeAgentRouteContext(): void {
  agentCurrentValues.value = {};
  agentContextRegistry.update("app-shell", genericPageContext());
  agentContextRegistry.activate("app-shell");
}

function publishExperimentAgentContext(publication: ExperimentAgentContextPublication): void {
  if (activeRoute.name !== "experiment") return;
  agentCurrentValues.value = { ...publication.current_values };
  agentContextRegistry.update("app-shell", publication.context);
}

async function loadAgentCapability() {
  const manifest = state.bridge.manifest;
  if (!manifest) throw new Error("agent_orchestration_manifest_unavailable");
  const snapshot = await getAgentOrchestrationCapabilitySnapshot(manifest);
  return buildPhase1CapabilityProjection(snapshot);
}

async function submitAgentInstruction(payload: AgentCopilotSubmitPayload): Promise<void> {
  const context = agentContext.value;
  if (!context || payload.context_revision !== context.context_revision) {
    agentBlocks.value = [formalErrorBlock("context_stale", "页面上下文已经变化，本次请求未执行。")];
    agentStatus.value = "上下文已变化";
    return;
  }
  if (payload.purpose === "draft" && !context.allowed_purposes.includes("draft")) {
    agentBlocks.value = [
      {
        block_type: "unsupported",
        block_id: "phase1-context-unavailable",
        result: unsupportedResultForUnavailableContext("page_context_draft_not_allowed"),
      },
    ];
    agentStatus.value = "当前页面仅支持询问";
    return;
  }
  if (payload.purpose === "explain") {
    agentBlocks.value = [
      {
        block_type: "explanation",
        block_id: `phase1-page-explanation:${context.context_revision}`,
        title: context.display_label,
        body: context.allowed_purposes.includes("draft")
          ? "这里可以核对当前实验参数，并把正式能力目录中的八个字段整理为草案。"
          : "这里可以说明当前页面状态；参数草案请在新建实验页生成。",
      },
    ];
    agentStatus.value = "页面说明已就绪";
    return;
  }
  agentStatus.value = "正在确定性解析";
  try {
    const capability = await loadAgentCapability();
    const output = compileIntent({
      contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
      instruction: redactSingleTurnInstruction(payload.instruction),
      locale: isEnglish.value ? "en-US" : "zh-CN",
      capability,
      current_values: agentCurrentValues.value,
      context,
    });
    const blocks = intentOutputToTypedBlocks(output);
    agentBlocks.value = blocks;
    agentStatus.value = output.kind === "draft" ? "草案已生成，尚未创建运行" : "只读处理完成";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    agentBlocks.value = [formalErrorBlock("phase1_compiler_unavailable", message)];
    agentStatus.value = "处理失败，主工作台未受影响";
  }
}

function answerAgentClarification(): void {
  agentStatus.value = "请在输入框中补充选择后重新提交";
}

const requestedRunId = computed(() => navigationSnapshot().runId);
const navigationUnavailable = computed(
  () =>
    Boolean(requestedRunId.value) &&
    requestedRunId.value !== state.runId &&
    !state.busy &&
    !state.bridge.checking &&
    !state.bridge.connected,
);

function navigationSnapshot() {
  const value = Array.isArray(activeRoute.query.run) ? activeRoute.query.run[0] : activeRoute.query.run;
  return {
    view: typeof activeRoute.name === "string" ? activeRoute.name : "overview",
    runId: typeof value === "string" && /^run-[\w-]+$/.test(value) ? value : null,
  };
}

watch(
  () => activeRoute.fullPath,
  () => {
    synchronizeAgentRouteContext();
    const navigation = navigationSnapshot();
    void synchronizeNavigation(navigation.view, navigation.runId);
  },
);
watch(
  () => agentContext.value?.context_revision,
  (currentRevision, previousRevision) => {
    if (!currentRevision || !previousRevision || currentRevision === previousRevision || !agentBlocks.value.length)
      return;
    const hasDraft = agentBlocks.value.some(
      (block) => block.block_type === "draft_summary" || block.block_type === "validation_result",
    );
    agentBlocks.value = markAgentBlocksStale(agentBlocks.value, currentRevision);
    agentStatus.value = hasDraft ? "页面上下文已变化，现有草案已过期" : "页面上下文已变化，现有内容使用旧上下文";
  },
);
watch(
  () => [state.runId, activeRoute.query.evidence_request] as const,
  ([runId, requestId]) => evidenceSelection.synchronizeRoute(runId, requestId),
  { immediate: true },
);
onMounted(() => initialize(navigationSnapshot()));
onBeforeUnmount(() => {
  unsubscribeAgentContext();
  unregisterAgentContext();
});
</script>

<template>
  <div class="app-shell" :style="agentDockStyle" :data-agent-copilot-state="agentPanelState">
    <AppSidebar />
    <main class="app-main">
      <AppHeader>
        <PagePrimer v-if="currentGuide" :guide="currentGuide" />
      </AppHeader>
      <div class="workspace">
        <section v-if="navigationUnavailable" class="navigation-error" role="alert">
          <strong>{{ t("无法载入链接中的运行") }}</strong>
          <span>{{
            t("本地 Bridge 当前未连接，因此没有展示 {runId} 的证据；下方仍是先前已验证的内容。", {
              runId: requestedRunId || "—",
            })
          }}</span>
        </section>
        <EvidenceStrip v-if="!['experiment', 'evidence_lab', 'history'].includes(state.view)" />
        <RouterView v-slot="{ Component, route }">
          <KeepAlive include="ExperimentView">
            <component
              :is="showUnsupported ? UnsupportedSchemaView : Component"
              :key="String(route.name)"
              v-bind="route.name === 'experiment' ? { agentContextPublisher: publishExperimentAgentContext } : {}"
            />
          </KeepAlive>
        </RouterView>
      </div>
    </main>
    <GuidedHelpHost :default-guide-id="currentGuideId" />
    <AgentCopilotEntry
      v-model="agentPanelState"
      :context="agentContext"
      :blocks="agentBlocks"
      :current-task="agentContext?.display_label || '当前页面助手'"
      :status-label="agentStatus"
      :initial-width="agentPanelWidth"
      @resize="agentPanelWidth = $event"
      @submit="submitAgentInstruction"
      @answer="answerAgentClarification"
    />
    <ToastStack />
    <div v-if="state.busy" class="global-busy" role="status" :aria-label="t('正在载入')"><span></span></div>
  </div>
</template>
