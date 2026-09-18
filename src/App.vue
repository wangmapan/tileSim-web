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
  type Phase1CapabilityProjection,
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
import { compileIntent, resolveClarificationAnswer, type ClarificationAnswer } from "./features/agent-intent-compiler";
import type { ExperimentAgentContextPublication } from "./features/run-experiment";
import { getAgentOrchestrationCapabilitySnapshot } from "./lib/api/agent-orchestration-capabilities";
import { LightweightWorkbenchShell } from "./features/lightweight-workbench";

const activeRoute = useRoute();
const { state, initialize, synchronizeNavigation, ensureBridgeReady } = useDashboard();
const isEntryRoute = computed(() => activeRoute.meta.layout === "entry");
const isLightweightRoute = computed(() => activeRoute.meta.workspace === "lightweight");
const dashboardInitialized = ref(false);
const unsupported = computed(() => unsupportedSchemaReports(state.bundle));
const rejectedUnsupported = computed(
  () => state.artifactManifest?.rejected_artifacts.filter((item) => item.reason === "unsupported_schema") || [],
);
const showUnsupported = computed(
  () =>
    (unsupported.value.length > 0 || rejectedUnsupported.value.length > 0) &&
    !["experiment", "history", "evidence_lab", "lightweight"].includes(state.view),
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
// Inputs of the last successful draft compilation, kept so an answered
// clarification can be rebound against exactly the revision that produced it.
const agentLastInstruction = shallowRef<string | null>(null);
const agentCapability = shallowRef<Phase1CapabilityProjection | null>(null);
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
  const lightweightRunId = isLightweightRoute.value ? lightweightAgentRunId() : null;
  const contextRunId = isLightweightRoute.value ? lightweightRunId : state.runId;
  const bridgeReady = Boolean(state.bridge.connected && state.bridge.manifest && state.bridge.available);
  const contextAvailability: PageContextEnvelope["availability"] = bridgeReady
    ? "available"
    : state.bridge.checking
      ? "stale"
      : "unavailable";
  const pageLabel =
    (
      {
        lightweight: "轻量工作台",
        lightweight_prepare: "轻量实验配置",
        lightweight_run: "轻量运行状态",
        // `/lightweight/status` is a legacy alias for the run view. Keep its
        // shared Agent context label aligned with the canonical run route so
        // the assistant never exposes an internal route name to users.
        lightweight_status: "轻量运行状态",
        lightweight_results: "轻量结果摘要",
      } as Record<string, string>
    )[routeName] || routeName;
  const schemaRevision = state.bridge.manifest?.schema_set_revision || "schema-unavailable";
  const backendRevision =
    [
      state.bridge.identity?.source_revision,
      state.bridge.identity?.build_revision,
      state.bridge.identity?.source_state_digest,
      state.bridge.identity?.build_state_digest,
      state.bridge.identity?.deployment_ref,
    ]
      .filter(Boolean)
      .join("|") || "backend-unavailable";
  const routeRevision = encodeURIComponent(activeRoute.fullPath || `/${routeName}`);
  const revision = `context:${routeName}:${routeRevision}:${contextRunId || "no-run"}:${schemaRevision}:${backendRevision}:${contextAvailability}:${appContextSequence}`;
  return {
    contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
    page_id: `page-${routeName}`,
    route_name: routeName,
    context_revision: revision,
    workspace_ref: null,
    run_ref: contextRunId ? { run_id: contextRunId, revision: contextRunId } : null,
    selected_entity: null,
    resources: contextRunId
      ? [
          {
            resource_type: "run",
            resource_id: contextRunId,
            revision: contextRunId,
            display_label: isLightweightRoute.value ? contextRunId : state.runName || contextRunId,
            availability: contextAvailability,
          },
        ]
      : [],
    supported_actions: contextAvailability === "available" ? ["explain", "check_capability"] : ["explain"],
    data_classification: contextRunId ? "workspace_internal" : "public",
    allowed_purposes: ["explain"],
    expires_at: null,
    display_label: contextRunId
      ? `${pageLabel} · ${isLightweightRoute.value ? contextRunId : state.runName || contextRunId}`
      : pageLabel,
    availability: contextAvailability,
  };
}

function lightweightAgentRunId(): string | null {
  const routeParam = Array.isArray(activeRoute.params.runId) ? activeRoute.params.runId[0] : activeRoute.params.runId;
  const queryValue = Array.isArray(activeRoute.query.run) ? activeRoute.query.run[0] : activeRoute.query.run;
  const value = typeof routeParam === "string" ? routeParam : queryValue;
  return typeof value === "string" && /^run-[\w-]+$/.test(value) ? value : null;
}

function synchronizeAgentRouteContext(): void {
  agentCurrentValues.value = {};
  agentContextRegistry.update("app-shell", genericPageContext());
  agentContextRegistry.activate("app-shell");
}

function refreshAgentContextAfterBridgeChange(): void {
  // The experiment pages publish a richer form context through this same
  // registry provider. Their surface watcher will refresh that publication
  // when bootstrap changes; do not overwrite it with the generic route
  // projection while the descriptor is settling.
  if (["experiment", "lightweight_prepare"].includes(String(activeRoute.name))) return;
  synchronizeAgentRouteContext();
}

function publishExperimentAgentContext(publication: ExperimentAgentContextPublication): void {
  if (!["experiment", "lightweight_prepare"].includes(String(activeRoute.name))) return;
  agentCurrentValues.value = { ...publication.current_values };
  agentContextRegistry.update("app-shell", publication.context);
}

async function loadAgentCapability() {
  // The shared Agent is available in the lightweight shell too. A direct
  // prepare deep link can open the panel before App.vue's Bridge bootstrap;
  // wait for the same readiness gate used by run-bound pages before reading
  // the capability snapshot.
  if (!(await ensureBridgeReady())) throw new Error("bridge_unavailable");
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
  const submittedRoute = activeRoute.fullPath;
  try {
    const capability = await loadAgentCapability();
    const latestContext = agentContextRegistry.current();
    if (
      !latestContext ||
      activeRoute.fullPath !== submittedRoute ||
      latestContext.context_revision !== context.context_revision ||
      latestContext.availability !== "available" ||
      (state.bridge.manifest?.schema_set_revision &&
        capability.schema_set_revision !== state.bridge.manifest.schema_set_revision)
    ) {
      agentBlocks.value = [formalErrorBlock("context_stale", "页面上下文已经变化，本次请求未执行。")];
      agentStatus.value = "上下文已变化";
      return;
    }
    const instruction = redactSingleTurnInstruction(payload.instruction);
    const output = compileIntent({
      contract_revision: PHASE1_LOCAL_CONTRACT_REVISION,
      instruction,
      locale: isEnglish.value ? "en-US" : "zh-CN",
      capability,
      current_values: agentCurrentValues.value,
      context,
    });
    agentLastInstruction.value = instruction;
    agentCapability.value = capability;
    const blocks = intentOutputToTypedBlocks(output);
    agentBlocks.value = blocks;
    agentStatus.value = output.kind === "draft" ? "草案已生成，尚未创建运行" : "只读处理完成";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    agentBlocks.value = [formalErrorBlock("phase1_compiler_unavailable", message)];
    agentStatus.value = "处理失败，主工作台未受影响";
  }
}

/**
 * Answers one clarification option (WP-2C-06). The option is bound back to the
 * instruction that produced the current clarification block, the deterministic
 * compiler runs again on the bound input, and the sidebar blocks are replaced
 * with the new result. A rejected binding or a failed recomputation is shown
 * through the existing formal error block; the main workspace is untouched and
 * the previous draft is never presented as still valid.
 */
function answerAgentClarification(payload: ClarificationAnswer): void {
  const context = agentContext.value;
  const instruction = agentLastInstruction.value;
  const capability = agentCapability.value;
  const clarification = agentBlocks.value.find((block) => block.block_type === "clarification")?.questions ?? null;
  if (!context || !instruction || !capability || !clarification) {
    agentBlocks.value = [formalErrorBlock("phase1_clarification_binding_unavailable", "当前没有可绑定的澄清问题。")];
    agentStatus.value = "选项无法绑定，草案未更新";
    return;
  }
  const outcome = resolveClarificationAnswer({
    questions: clarification,
    answer: payload,
    instruction,
    capability,
    current_values: agentCurrentValues.value,
    locale: isEnglish.value ? "en-US" : "zh-CN",
    context,
  });
  if (!outcome.ok) {
    agentBlocks.value = [
      formalErrorBlock(outcome.code, "所选选项无法与当前澄清问题绑定，草案未更新；请重新描述要调整的字段和值。"),
    ];
    agentStatus.value = "选项无法绑定，草案未更新";
    return;
  }
  agentLastInstruction.value = outcome.instruction;
  agentBlocks.value = intentOutputToTypedBlocks(outcome.output);
  agentStatus.value =
    outcome.output.kind === "draft"
      ? "已按所选选项重算草案，尚未创建运行"
      : outcome.output.kind === "clarification"
        ? "已按所选选项重算，仍需补充信息"
        : outcome.output.kind === "unsupported"
          ? "已按所选选项重算，当前能力不支持"
          : "已按所选选项重算，参数没有变化";
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
    view:
      activeRoute.meta.workspace === "lightweight"
        ? "lightweight"
        : typeof activeRoute.name === "string"
          ? activeRoute.name
          : "overview",
    runId: typeof value === "string" && /^run-[\w-]+$/.test(value) ? value : null,
  };
}

watch(
  () => activeRoute.fullPath,
  () => {
    if (isEntryRoute.value) return;
    synchronizeAgentRouteContext();
    if (isLightweightRoute.value) {
      // The lightweight shell owns its URL navigation, but a changed legal
      // run deep link still needs the existing read-only evidence restore.
      // Never reset the professional workspace merely because a lightweight
      // section has no run query; only an explicit new run triggers loading.
      if (!state.bridge.connected) {
        void ensureBridgeReady();
      }
      // Run-bound lightweight views restore their own state through the
      // lightweight store/query adapters. Do not ask the professional
      // dashboard coordinator to reconcile the same URL; that coordinator
      // would treat the lightweight run as foreign and redirect to /lightweight.
      return;
    }
    const navigation = navigationSnapshot();
    if (!dashboardInitialized.value) {
      dashboardInitialized.value = true;
      void initialize({ ...navigation, runId: navigation.runId || state.runId });
    } else {
      void synchronizeNavigation(navigation.view, navigation.runId);
    }
  },
);
const bridgeContextSignature = computed(() =>
  [
    state.bridge.connected,
    state.bridge.checking,
    state.bridge.available,
    state.bridge.manifest?.schema_set_revision || "",
    state.bridge.identity?.source_revision || "",
    state.bridge.identity?.build_revision || "",
    state.bridge.identity?.source_state_digest || "",
    state.bridge.identity?.build_state_digest || "",
    state.bridge.identity?.deployment_ref || "",
  ].join("|"),
);
watch(bridgeContextSignature, () => {
  if (isEntryRoute.value) return;
  refreshAgentContextAfterBridgeChange();
});
watch(
  () => [state.runId, state.runName] as const,
  () => {
    if (isEntryRoute.value) return;
    // Experiment pages publish the richer typed form envelope themselves.
    // Every other professional route uses the generic envelope, which must
    // be refreshed after asynchronous deep-link restoration updates the
    // dashboard run identity.
    if (["experiment", "lightweight_prepare"].includes(String(activeRoute.name))) return;
    synchronizeAgentRouteContext();
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
onMounted(() => {
  if (isEntryRoute.value) {
    // Keep the neutral entry page independent from Bridge/capability bootstrap.
    // Professional and run-bound routes perform their existing initialization
    // when the user explicitly enters a workspace.
    return;
  }
  if (isLightweightRoute.value) {
    // Lightweight content is local-only, but direct result/deep links still
    // need the existing Bridge health state to distinguish "no run" from
    // "Bridge unavailable". This does not create a run or call a Provider.
    void ensureBridgeReady();
    return;
  }
  dashboardInitialized.value = true;
  const navigation = navigationSnapshot();
  void initialize({ ...navigation, runId: navigation.runId || state.runId });
});
onBeforeUnmount(() => {
  unsubscribeAgentContext();
  unregisterAgentContext();
});
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <component :is="Component" v-if="isEntryRoute" :key="String(route.name)" />
    <LightweightWorkbenchShell
      v-else-if="isLightweightRoute"
      :style="agentDockStyle"
      :data-agent-copilot-state="agentPanelState"
    >
      <component
        :is="Component"
        :key="route.fullPath"
        v-bind="route.name === 'lightweight_prepare' ? { agentContextPublisher: publishExperimentAgentContext } : {}"
      />
    </LightweightWorkbenchShell>
    <div v-else class="app-shell" :style="agentDockStyle" :data-agent-copilot-state="agentPanelState">
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
          <KeepAlive include="ExperimentView">
            <component
              :is="showUnsupported ? UnsupportedSchemaView : Component"
              :key="String(route.name)"
              v-bind="route.name === 'experiment' ? { agentContextPublisher: publishExperimentAgentContext } : {}"
            />
          </KeepAlive>
        </div>
      </main>
      <GuidedHelpHost :default-guide-id="currentGuideId" scope="professional" />
      <ToastStack />
      <div v-if="state.busy" class="global-busy" role="status" :aria-label="t('正在载入')"><span></span></div>
    </div>
  </RouterView>
  <AgentCopilotEntry
    v-if="!isEntryRoute"
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
</template>
