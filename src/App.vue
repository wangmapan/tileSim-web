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
import { createAgentContextRegistry, createPageContextRevisionKeeper } from "./entities/agent-context";
import { createAgentCommandRegistry, type AgentParameterReceipt } from "./entities/agent-command";
import { AgentCopilotEntry } from "./features/agent-copilot-shell";
import {
  assessParameterPlan,
  buildPhase1CapabilityProjection,
  describePlanValue,
  formalErrorBlock,
  intentOutputToTypedBlocks,
  markAgentBlocksStale,
  redactSingleTurnInstruction,
} from "./features/agent-copilot-integration";
import { compileIntent, resolveClarificationAnswer, type ClarificationAnswer } from "./features/agent-intent-compiler";
import {
  hasRecommendation,
  looksInterrogative,
  modelScenarioInstruction,
  modelScenarioRecommendation,
  parameterKeyOf,
  recommendScenarioPlan,
  type ExperimentAgentContextPublication,
} from "./features/run-experiment";
import {
  fetchAssistantModelCatalogue,
  fetchAssistantModelDescriptor,
  selectAssistantModel,
  streamAssistantChat,
  type AssistantChatMessage,
} from "./lib/api/assistant-model";
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
/**
 * The single downward channel to the page that owns the experiment form. The
 * sidebar never writes the form itself: it hands over resolved edits and shows
 * whatever receipt comes back.
 */
const agentCommandRegistry = createAgentCommandRegistry();
const agentContext = shallowRef<PageContextEnvelope | null>(null);
const agentCurrentValues = shallowRef<Readonly<Record<string, DraftFieldValue | null>>>({});
/**
 * Everything the current page can write, published by the experiment pages.
 * Empty on pages without a parameter surface, which is what keeps the
 * parameter-edit mode off there.
 */
const agentParameterCatalog = shallowRef<ExperimentAgentContextPublication["parameter_catalog"]>([]);
/**
 * The parameter-edit mode needs both a published catalogue and a mounted page
 * that registered a handler; either one missing must keep the entry point off.
 */
const agentCanEditParameters = computed(
  () => agentParameterCatalog.value.length > 0 && agentCommandRegistry.available(),
);
let agentEditSequence = 0;
let agentTurnSequence = 0;
const agentBlocks = shallowRef<readonly AgentTypedBlock[]>([]);
const agentPanelState = ref<AgentCopilotPanelState>("closed");
const agentPanelWidth = ref(420);
const agentStatus = ref("可以开始");
/**
 * The turns the panel has already answered, oldest first, as the user and the
 * assistant saw them. It is the panel's own memory: it is replayed to the
 * assistant model with the next sentence, so a follow-up such as 「再激进一点」
 * means something, and it is never stored anywhere else.
 */
const agentConversation = shallowRef<readonly AssistantChatMessage[]>([]);
/** True while a streamed answer is still arriving, which is what disables the send action. */
const agentStreaming = ref(false);
let agentStreamAbort: AbortController | null = null;
/**
 * The assistant model channel this Bridge publishes, and the identity it will answer with next.
 *
 * The channel is optional, so nothing here is read until the panel is actually opened, and a machine
 * without a channel keeps exactly the panel it had before: `agentModelChannel` stays false and the
 * model controls are never rendered. The chosen identity is session-scoped by design - the saved
 * configuration belongs to the launcher - and the panel says so next to the control.
 */
const agentModelChannel = ref(false);
const agentModelCatalogue = shallowRef<readonly string[]>([]);
const agentModelSelected = ref("");
const agentModelPending = ref(false);
let agentModelAbort: AbortController | null = null;
// Inputs of the last successful draft compilation, kept so an answered
// clarification can be rebound against exactly the revision that produced it.
const agentLastInstruction = shallowRef<string | null>(null);
const agentCapability = shallowRef<Phase1CapabilityProjection | null>(null);
/**
 * Holds the shell's own context revision steady while the projection it publishes is
 * unchanged. Every re-projection used to mint a new token, which is what made the
 * panel refuse a plan over a page that had not actually moved.
 */
const appContextRevision = createPageContextRevisionKeeper();

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
  // A re-projection of an unchanged page keeps the revision it already had: the panel
  // refuses a plan whose revision is gone, so minting a fresh token here would condemn a
  // plan over a re-projection that moved nothing. The content passed alongside the
  // prefix covers the parts of the envelope the prefix does not name.
  const { revision } = appContextRevision(
    `context:${routeName}:${routeRevision}:${contextRunId || "no-run"}:${schemaRevision}:${backendRevision}:${contextAvailability}`,
    [pageLabel, contextRunId, contextAvailability, isLightweightRoute.value, state.runName || ""],
  );
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
  // Pages without a parameter surface must not leave the previous page's
  // catalogue behind: the assistant would offer edits nothing can apply.
  agentParameterCatalog.value = [];
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
  agentParameterCatalog.value = publication.parameter_catalog;
  // The page declares its context on every touch of its inputs, which is not the
  // same as its content having changed. Replacing the registry entry with an
  // identical one would push a new object through every panel that reads it, so
  // the page's own publication is only forwarded when it is not the one already
  // standing: the same revision is the same content (the keeper guarantees it).
  const current = agentContextRegistry.current();
  if (
    current?.page_id === publication.context.page_id &&
    current.context_revision === publication.context.context_revision
  ) {
    return;
  }
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

/** How many turns the panel replays to the assistant model, and how many it keeps in memory. */
const MAXIMUM_AGENT_TURNS = 12;

/**
 * Opens one turn of the panel conversation with the user's own sentence.
 *
 * The returned number is the turn's identity: every block the answer produces
 * shares it, so the transcript keeps every turn while two answers of the same
 * shape can never collide on one block id.
 */
function openAgentTurn(instruction: string): number {
  agentTurnSequence += 1;
  agentBlocks.value = [
    ...agentBlocks.value,
    {
      block_type: "user_message",
      block_id: `user-message:${agentTurnSequence}`,
      text: instruction,
    },
  ];
  return agentTurnSequence;
}

/** Appends the blocks one turn produced, under that turn's identity. */
function appendAgentAnswerBlocks(turn: number, blocks: readonly AgentTypedBlock[]): void {
  agentBlocks.value = [
    ...agentBlocks.value,
    ...blocks.map((block) => ({ ...block, block_id: `${block.block_id}:${turn}` })),
  ];
}

/** Rewrites the answer block that is currently being written. */
function updateAgentAnswerBlock(
  blockId: string,
  patch: { text?: string; streaming?: boolean; model_id?: string; error?: string },
): void {
  agentBlocks.value = agentBlocks.value.map((block) =>
    block.block_type === "assistant_message" && block.block_id === blockId ? { ...block, ...patch } : block,
  );
}

function clipAgentText(text: string): string {
  return text.length > 2000 ? `${text.slice(0, 1999)}…` : text;
}

/**
 * Remembers one answered turn so the next sentence can build on it.
 *
 * A turn that produced no answer records only the user's half: an empty assistant
 * message would be replayed on the next request as if the panel had answered.
 * Oldest turns fall off first; the Bridge refuses an over-long transcript too.
 */
function recordAgentTurn(instruction: string, answer: string): void {
  const turns: AssistantChatMessage[] = [
    ...agentConversation.value,
    { role: "user", content: clipAgentText(instruction) },
  ];
  const trimmed = answer.trim();
  if (trimmed) turns.push({ role: "assistant", content: clipAgentText(trimmed) });
  agentConversation.value = turns.slice(-MAXIMUM_AGENT_TURNS);
}

/** The transcript replayed with the next sentence, leaving room for that sentence. */
function agentConversationForModel(): AssistantChatMessage[] {
  return agentConversation.value.slice(-(MAXIMUM_AGENT_TURNS - 4)).map((turn) => ({ ...turn }));
}

/**
 * The panel's current values, keyed the way the parameter catalogue names them.
 *
 * The Bridge accepts only short bare names and short values, so anything that does
 * not fit is left out rather than risking the whole request being refused.
 */
function agentPanelValues(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const entry of agentParameterCatalog.value) {
    const key = parameterKeyOf(entry.path);
    if (key in values || entry.current === null) continue;
    if (!/^[A-Za-z0-9_]{1,64}$/u.test(key) || entry.current.length > 120) continue;
    values[key] = entry.current;
    if (Object.keys(values).length >= 40) break;
  }
  return values;
}

/** The values of a plan, as one replayable line for the next turn's context. */
function planValueLine(settings: readonly { key: string; value: string }[]): string {
  return settings.length ? `方案：${settings.map((setting) => `${setting.key} = ${setting.value}`).join("；")}` : "";
}

/** Stops a streamed answer; the panel keeps whatever prose already arrived. */
function cancelAgentStream(): void {
  agentStreamAbort?.abort();
}

/**
 * Reads the model channel: first whether this Bridge publishes one, then which identities it serves.
 *
 * The descriptor is asked first because it is the published answer to "is there a channel here". A
 * machine without one is left alone entirely; a machine with one whose list could not be read keeps
 * the control visible with a way to try again, so a failed read is never mistaken for a missing
 * feature.
 */
async function loadAgentModels(): Promise<void> {
  if (agentModelPending.value) return;
  agentModelPending.value = true;
  const controller = new AbortController();
  agentModelAbort = controller;
  try {
    const descriptor = await fetchAssistantModelDescriptor({ signal: controller.signal });
    agentModelChannel.value = descriptor !== null;
    if (!descriptor) {
      agentModelCatalogue.value = [];
      agentModelSelected.value = "";
      return;
    }
    agentModelSelected.value = descriptor.provider.model_id;
    const catalogue = await fetchAssistantModelCatalogue({ signal: controller.signal });
    agentModelCatalogue.value = catalogue ? catalogue.models : [];
    if (catalogue?.selected_model) agentModelSelected.value = catalogue.selected_model;
  } finally {
    agentModelAbort = null;
    agentModelPending.value = false;
  }
}

/**
 * Switches the identity this Bridge answers with, for as long as that process stays up.
 *
 * The choice is shown at once, and a refused switch puts the previous identity back: a control that
 * silently kept a value the backend never accepted would be worse than one that never moved.
 */
async function switchAgentModel(model: string): Promise<void> {
  if (!model || model === agentModelSelected.value || agentModelPending.value) return;
  const previous = agentModelSelected.value;
  agentModelPending.value = true;
  agentModelSelected.value = model;
  try {
    const selection = await selectAssistantModel(model);
    if (!selection) {
      agentModelSelected.value = previous;
      agentStatus.value = "切换模型没有成功，仍使用原来的模型。";
      return;
    }
    agentModelSelected.value = selection.selected_model;
    agentStatus.value = `已改用 ${selection.selected_model}（本次运行有效）`;
  } finally {
    agentModelPending.value = false;
  }
}

// The channel is read the first time the panel is opened rather than on page load, so a page a user
// never opens the assistant on costs no extra request.
watch(agentPanelState, (value) => {
  if (value === "closed" || agentModelChannel.value || agentModelPending.value) return;
  void loadAgentModels();
});

onBeforeUnmount(() => {
  agentModelAbort?.abort();
});

/**
 * Asks the configured assistant model to answer this turn, and shows the answer
 * while it is being written.
 *
 * The sentence and the turns already shown travel together, so a follow-up that
 * only means something with the earlier turns attached - 「再激进一点」, 「为什么
 * 是 4?」 - is answered in context. On the first turn only a sentence the
 * deterministic paths would otherwise have to guess at is sent; once the panel is
 * in a conversation, any sentence that is not a plain `参数 = 值` goes there.
 *
 * When no channel is configured, the Bridge does not publish the route yet, or the
 * model returns nothing usable, the turn is withdrawn and this returns false, so
 * the local rule table answers instead and a machine without a model behaves
 * exactly as before.
 *
 * The answer is a proposal: the values reach the panel only after 应用到面板, and
 * nothing here writes a document or creates a run.
 */
async function planAgentModelRecommendation(instruction: string, context: PageContextEnvelope): Promise<boolean> {
  const catalog = agentParameterCatalog.value;
  if (!catalog.length) return false;
  const sentence = modelScenarioInstruction(instruction, catalog, agentConversation.value.length > 0);
  if (!sentence) return false;
  const messages: AssistantChatMessage[] = [
    ...agentConversationForModel(),
    { role: "user", content: clipAgentText(sentence) },
  ];

  const turn = openAgentTurn(sentence);
  const userBlockId = `user-message:${turn}`;
  const answerBlockId = `assistant-answer:${turn}`;
  agentBlocks.value = [
    ...agentBlocks.value,
    { block_type: "assistant_message", block_id: answerBlockId, text: "", streaming: true, model_id: "", error: "" },
  ];
  agentStatus.value = "模型正在回答…";

  const controller = new AbortController();
  agentStreamAbort = controller;
  agentStreaming.value = true;
  let answer = "";
  const outcome = await streamAssistantChat(
    { messages, panel_values: agentPanelValues() },
    {
      onAnswer: (text) => {
        answer = text;
        updateAgentAnswerBlock(answerBlockId, { text });
      },
      onPlan: (plan) => {
        const served = plan.served_model || plan.model_id;
        if (served) updateAgentAnswerBlock(answerBlockId, { model_id: served });
      },
    },
    { signal: controller.signal },
  );
  agentStreaming.value = false;
  agentStreamAbort = null;

  if (!outcome) {
    // No channel answered at all: withdraw the turn so the local rules take it
    // without leaving a question in the transcript that nothing replied to.
    agentBlocks.value = agentBlocks.value.filter(
      (block) => block.block_id !== userBlockId && block.block_id !== answerBlockId,
    );
    return false;
  }
  if (outcome.cancelled) {
    updateAgentAnswerBlock(answerBlockId, { streaming: false, error: "已停止这次回答。" });
    recordAgentTurn(sentence, answer);
    agentStatus.value = "回答已停止";
    return true;
  }

  const plan = outcome.plan;
  updateAgentAnswerBlock(answerBlockId, { streaming: false, error: outcome.failure });
  recordAgentTurn(sentence, answer || planValueLine(plan?.settings ?? []));

  if (plan && plan.answer_state !== "prose_only") {
    const recommendation = modelScenarioRecommendation({ ...plan, dropped: plan.dropped ?? [] }, catalog);
    if (recommendation) {
      agentEditSequence += 1;
      agentBlocks.value = [
        ...agentBlocks.value,
        {
          block_type: "parameter_edits",
          block_id: `parameter-edits:${agentEditSequence}`,
          edits: recommendation.plan.items,
          rejected: recommendation.plan.rejected,
          unknown: recommendation.plan.unknown,
          receipts: null,
          channelMoved: false,
          note: "",
          title: recommendation.title,
          rationale: recommendation.rationale,
          reasons: recommendation.reasons ?? {},
          plan_revision: context.context_revision,
        },
      ];
      agentStatus.value = `模型给了 ${recommendation.plan.items.length} 项建议，尚未写入面板`;
      return true;
    }
    updateAgentAnswerBlock(answerBlockId, { error: "模型给的参数方案没有读懂，可以让它再说一次。" });
  }
  agentStatus.value = outcome.failure ? "模型没有答完，可以重试或换个说法" : "回答完成；这次没有要写入的参数改动";
  return true;
}

/**
 * Reads one sentence against the parameters the current page published.
 *
 * A sentence is answered here when it described a built-in scenario or carried
 * its own `参数 = 值`. Anything else — a question, a request the frozen compiler
 * understands, something unsupported — is left to the read-only paths below, so
 * a single input box never silently changes what those flows already did.
 *
 * Returns whether the sentence was answered.
 */
function planAgentRecommendation(instruction: string, context: PageContextEnvelope): boolean {
  const catalog = agentParameterCatalog.value;
  if (!catalog.length) return false;
  const recommendation = recommendScenarioPlan(instruction, catalog);
  if (recommendation.tie.length > 1) {
    // Two plausible scenarios is exactly when guessing would write wrong values.
    const turn = openAgentTurn(instruction);
    appendAgentAnswerBlocks(turn, [
      {
        block_type: "explanation",
        block_id: "phase1-scenario-choice",
        title: "先选一个场景",
        body: `这句话同时像「${recommendation.tie
          .map((profile) => profile.title)
          .join("」和「")}」；请一次只描述一个场景，或直接写「参数 = 值」。`,
      },
    ]);
    agentStatus.value = "需要更具体的场景";
    return true;
  }
  if (!hasRecommendation(recommendation)) return false;
  const turn = openAgentTurn(instruction);
  agentEditSequence += 1;
  appendAgentAnswerBlocks(turn, [
    {
      block_type: "parameter_edits",
      block_id: `parameter-edits:${agentEditSequence}`,
      edits: recommendation.plan.items,
      rejected: recommendation.plan.rejected,
      unknown: recommendation.plan.unknown,
      receipts: null,
      channelMoved: false,
      note: "",
      title: recommendation.title,
      rationale: recommendation.rationale,
      reasons: recommendation.reasons ?? {},
      plan_revision: context.context_revision,
    },
  ]);
  recordAgentTurn(
    instruction,
    `${recommendation.title}。${recommendation.rationale}${planValueLine(
      recommendation.plan.items.map((item) => ({ key: parameterKeyOf(item.path), value: item.next })),
    )}`,
  );
  agentStatus.value = recommendation.plan.items.length
    ? `待确认 ${recommendation.plan.items.length} 项改动，尚未写入面板`
    : "这份推荐在当前页面没有可写入的项";
  return true;
}

async function submitAgentInstruction(payload: AgentCopilotSubmitPayload): Promise<void> {
  const context = agentContext.value;
  if (!context || payload.context_revision !== context.context_revision) {
    appendAgentAnswerBlocks(openAgentTurn(payload.instruction), [
      formalErrorBlock("context_stale", "页面上下文已经变化，本次请求未执行。"),
    ]);
    agentStatus.value = "上下文已变化";
    return;
  }
  const instruction = redactSingleTurnInstruction(payload.instruction);
  // One box, three possible readings, decided in this order: a described
  // scenario is answered by the assistant model when this Bridge has a channel
  // and by the local rule table otherwise; an explicit assignment answers with
  // the deterministic plan; everything else stays with the read-only paths below.
  if (await planAgentModelRecommendation(instruction, context)) return;
  if (planAgentRecommendation(instruction, context)) return;
  // A question, or a page that cannot carry a draft, is answered from the page
  // itself. That keeps read-only pages free of any capability round trip.
  if (looksInterrogative(instruction) || !context.allowed_purposes.includes("draft")) {
    appendAgentAnswerBlocks(openAgentTurn(instruction), [
      {
        block_type: "explanation",
        block_id: "phase1-page-explanation",
        title: context.display_label,
        body: context.allowed_purposes.includes("draft")
          ? "这里可以核对当前实验参数；描述一个场景会先给出推荐方案，确认后才写入面板。"
          : "这里可以说明当前页面状态；参数草案请在新建实验页生成。",
      },
    ]);
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
      appendAgentAnswerBlocks(openAgentTurn(instruction), [
        formalErrorBlock("context_stale", "页面上下文已经变化，本次请求未执行。"),
      ]);
      agentStatus.value = "上下文已变化";
      return;
    }
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
    appendAgentAnswerBlocks(openAgentTurn(instruction), intentOutputToTypedBlocks(output));
    recordAgentTurn(instruction, output.kind === "draft" ? output.draft.task_summary : "");
    agentStatus.value = output.kind === "draft" ? "草案已生成，尚未创建运行" : "只读处理完成";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendAgentAnswerBlocks(openAgentTurn(instruction), [formalErrorBlock("phase1_compiler_unavailable", message)]);
    agentStatus.value = "处理失败，主工作台未受影响";
  }
}

/**
 * Answers one clarification option (WP-2C-06). The option is bound back to the
 * instruction that produced the current clarification block, the deterministic
 * compiler runs again on the bound input, and the new result is appended to the
 * transcript below the question it answers. A rejected binding or a failed
 * recomputation is shown through the existing formal error block; the main
 * workspace is untouched and the previous draft is never presented as still valid.
 */
function answerAgentClarification(payload: ClarificationAnswer): void {
  const context = agentContext.value;
  const instruction = agentLastInstruction.value;
  const capability = agentCapability.value;
  // The newest clarification is the one the user just answered: older turns stay
  // in the transcript, so a plain `find` would bind the option to a stale question.
  const clarification =
    [...agentBlocks.value].reverse().find((block) => block.block_type === "clarification")?.questions ?? null;
  if (!context || !instruction || !capability || !clarification) {
    appendAgentAnswerBlocks(openAgentTurn("（选择了一个选项）"), [
      formalErrorBlock("phase1_clarification_binding_unavailable", "当前没有可绑定的澄清问题。"),
    ]);
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
    appendAgentAnswerBlocks(openAgentTurn("（选择了一个选项）"), [
      formalErrorBlock(outcome.code, "所选选项无法与当前澄清问题绑定，草案未更新；请重新描述要调整的字段和值。"),
    ]);
    agentStatus.value = "选项无法绑定，草案未更新";
    return;
  }
  agentLastInstruction.value = outcome.instruction;
  appendAgentAnswerBlocks(openAgentTurn("（按选项补充）"), intentOutputToTypedBlocks(outcome.output));
  recordAgentTurn(instruction, outcome.output.kind === "draft" ? outcome.output.draft.task_summary : "");
  agentStatus.value =
    outcome.output.kind === "draft"
      ? "已按所选选项重算草案，尚未创建运行"
      : outcome.output.kind === "clarification"
        ? "已按所选选项重算，仍需补充信息"
        : outcome.output.kind === "unsupported"
          ? "已按所选选项重算，当前能力不支持"
          : "已按所选选项重算，参数没有变化";
}

/**
 * Applies one parameter-edit plan through the page that owns the form.
 *
 * The sidebar never touches the form: it sends the resolved edits down the
 * command channel and renders whatever receipt comes back.
 *
 * Whether the plan is still good is decided by the addresses it names, not by
 * the page's revision token: a plan says "this address holds `previous`, write
 * `next`", so it is refused only when one of those addresses now holds
 * something else, or is gone from the page altogether. The token alone refused
 * plans over a page that had merely republished its envelope (a health check, a
 * re-projection of equal content), which is what made a plan the user had just
 * read permanently unapplicable.
 */
function applyAgentParameterEdits(blockId: string): void {
  const block = agentBlocks.value.find(
    (candidate): candidate is Extract<AgentTypedBlock, { block_type: "parameter_edits" }> =>
      candidate.block_type === "parameter_edits" && candidate.block_id === blockId,
  );
  if (!block || block.receipts) return;
  const assessment = assessParameterPlan({
    edits: block.edits,
    live: agentParameterCatalog.value,
    planRevision: block.plan_revision,
    currentRevision: agentContext.value?.context_revision ?? null,
  });
  if (!assessment.applicable) {
    const moved = assessment.moved;
    appendAgentAnswerBlocks(openAgentTurn("（按了应用到面板）"), [
      formalErrorBlock(
        "parameter_plan_stale",
        moved
          ? moved.missing
            ? `「${moved.label}」在当前面板上已经找不到了，这份改动没有写入。请重新描述一次。`
            : `「${moved.label}」现在是 ${describePlanValue(moved.current)}，这份改动是按 ${describePlanValue(moved.expected)} 写的，没有写入。请重新提交。`
          : "页面上下文已变化，这份改动没有写入。请重新提交。",
      ),
    ]);
    agentStatus.value = "改动已过期，未写入";
    return;
  }
  const result = agentCommandRegistry.apply(block.edits);
  const receipts: readonly AgentParameterReceipt[] = result.receipts.length
    ? result.receipts
    : block.edits.map((edit) => ({
        path: edit.path,
        label: edit.label,
        previous: edit.previous,
        next: edit.next,
        status: "rejected" as const,
        reason: result.note || "页面没有接受这项改动。",
      }));
  const appliedCount = receipts.filter((receipt) => receipt.status === "applied").length;
  // The page published something while this plan was on screen, but not the
  // values it addresses. Say so rather than let the user wonder whether the
  // applied values are the ones they just read.
  const republished = assessment.basis === "values";
  agentBlocks.value = agentBlocks.value.map((candidate) =>
    candidate.block_type === "parameter_edits" && candidate.block_id === blockId
      ? {
          ...candidate,
          receipts,
          channelMoved: result.channelMoved,
          note: [republished ? "页面在此期间刷新过一次，但这几项指向的值没有变，已按当前值写入。" : "", result.note]
            .filter(Boolean)
            .join(" "),
        }
      : candidate,
  );
  agentStatus.value = appliedCount ? `已写入 ${appliedCount} 项；没有创建运行` : "没有写入任何改动";
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
    // A different page is a different conversation: the turns already shown were
    // an answer about the parameters of the page the user has just left.
    cancelAgentStream();
    agentConversation.value = [];
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
  cancelAgentStream();
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
        v-bind="
          route.name === 'lightweight_prepare'
            ? { agentContextPublisher: publishExperimentAgentContext, agentCommandRegistry }
            : {}
        "
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
              v-bind="
                route.name === 'experiment'
                  ? { agentContextPublisher: publishExperimentAgentContext, agentCommandRegistry }
                  : {}
              "
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
    :allow-parameter-edit="agentCanEditParameters"
    :busy="agentStreaming"
    :model-channel="agentModelChannel"
    :model-catalogue="agentModelCatalogue"
    :model-selected="agentModelSelected"
    :model-pending="agentModelPending"
    @resize="agentPanelWidth = $event"
    @submit="submitAgentInstruction"
    @answer="answerAgentClarification"
    @apply="applyAgentParameterEdits"
    @cancel="cancelAgentStream"
    @select-model="switchAgentModel"
    @refresh-models="loadAgentModels"
  />
</template>
