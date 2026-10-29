import { describe, expect, it } from "vitest";
import appSource from "../../src/App.vue?raw";
import sessionSource from "../../src/stores/agent-sessions.ts?raw";
import phaseContractsSource from "../../src/entities/agent-orchestration/phase1-contracts.ts?raw";
import querySource from "../../src/features/agent-flow/queries.ts?raw";
import { agentFlowRefetchInterval } from "../../src/features/agent-flow/queries";
import { BridgeApiError } from "../../src/lib/api/errors";
import { isUnsupportedExecutionRequest } from "../../src/features/agent-intent-compiler";

describe("App Agent Flow lifecycle wiring", () => {
  it("uses current capability-led new-session guidance without promising execution", () => {
    expect(appSource).toContain('task: "capabilities" | "configure" | "analyze"');
    expect(appSource).toContain('appendGuidance("（了解助手能做什么）"');
    expect(appSource).toContain("助手不会自动创建运行、调用真实 Provider");
    expect(appSource).not.toContain('task: "configure" | "analyze" | "learn"');
  });

  it("routes explicit execution requests to the fail-closed flow intent", () => {
    expect(isUnsupportedExecutionRequest("创建运行")).toBe(true);
    expect(isUnsupportedExecutionRequest("请执行实验")).toBe(true);
    expect(isUnsupportedExecutionRequest("配置一个 16 请求的草案")).toBe(false);
    expect(appSource).toContain('startAgentFlowForInstruction(instruction, context, "unsupported_execution")');
    expect(appSource).toContain("模型识别到仿真执行意图");
    expect(appSource).toContain('formalErrorBlock("intent_unavailable"');
    expect(appSource).not.toContain("flowIntentForInstruction(instruction");
    expect(appSource).not.toContain("createRun(");
  });

  it("owns start, typed-block projection, SSE/poll fallback and resume at the app boundary", () => {
    expect(appSource).toContain('from "./features/agent-flow"');
    expect(appSource).toContain("createAgentFlow");
    expect(appSource).toContain("agentFlowStateToTypedBlock");
    expect(appSource).toContain("observeAgentFlowEvents");
    expect(appSource).toContain("getAgentFlow");
    expect(appSource).toContain("resumeAgentFlow");
    expect(appSource).toContain('@flow-resume="resumeAgentFlowFromBlock"');
    expect(appSource).toContain("clearAgentFlowObserver");
  });

  it("persists an agent_flow typed block through the bounded session cache", () => {
    expect(sessionSource).toContain('"agent_flow"');
    expect(sessionSource).toContain("sanitizePersistedValue");
  });

  it("stops observer affordances on typed non-retryable flow errors", () => {
    expect(appSource).toContain("function shouldRetryAgentFlowObserver");
    expect(appSource).toContain("error.retryable || error.status >= 500");
    expect(appSource).toContain("pending_action: null");
    expect(appSource).toContain("observer_stopped:");
    expect(appSource).toContain("stopAgentFlowObserver(error)");
    expect(appSource).toContain("已恢复流程的身份或契约无法继续校验");
  });

  it("does not keep query polling a terminal or contract-invalid flow", () => {
    expect(querySource).toContain("function agentFlowRefetchInterval");
    expect(querySource).toContain("TERMINAL_FLOW_STATUSES.has(query.state.data.status)");
    expect(querySource).toContain("!shouldRetryAgentFlowQuery(query.state.error)");
    expect(querySource).toContain("refetchInterval: (query)");
  });

  it("classifies query polling failures without retrying stale identities", () => {
    expect(agentFlowRefetchInterval({ state: { data: { status: "completed" } as never } })).toBe(false);
    expect(
      agentFlowRefetchInterval({
        state: {
          error: new BridgeApiError("stale", { status: 409, code: "schema_revision_mismatch" }),
        },
      }),
    ).toBe(false);
    expect(
      agentFlowRefetchInterval({
        state: {
          error: new BridgeApiError("temporarily unavailable", { status: 503, code: "backend_unavailable" }),
        },
      }),
    ).toBe(2_000);
    expect(agentFlowRefetchInterval({ state: { error: new TypeError("Failed to fetch") } })).toBe(2_000);
  });

  it("keeps a completed flow terminal when report export fails and shows a local retry notice", () => {
    expect(appSource).toContain("annotateAgentFlowBlock");
    expect(appSource).toContain("结果解读报告导出失败");
    expect(appSource).toContain("流程不会重复恢复");
  });

  it("fences duplicate typed-block resume clicks while the durable mutation is pending", () => {
    expect(appSource).toContain("const agentFlowResumePending = ref(false)");
    expect(appSource).toContain("if (agentFlowResumePending.value) return;");
    expect(appSource).toContain("agentFlowResumePending.value = true");
    expect(appSource).toContain("agentFlowResumePending.value = false");
  });

  it("reuses one bounded resume idempotency key after a lost response and clears it after success/context change", () => {
    expect(appSource).toContain("const agentFlowResumeKey = shallowRef<AgentFlowResumeIdempotencyState | null>(null)");
    expect(appSource).toContain("agentFlowResumeIdempotencyState(request, agentFlowResumeKey.value)");
    expect(appSource).toContain("resumeAgentFlow(flow.flow_id, request, resumeKey.key)");
    expect(appSource).toContain("agentFlowResumeKey.value = null");
    expect(appSource).toContain("The SSE observer may have accepted the terminal event");
    expect(appSource).toContain("The durable mutation has succeeded");
    expect(appSource).toContain("if (flowIsTerminal(state)) agentFlowResumeKey.value = null");
  });

  it("continues verified result analysis after the read-only existing-run flow completes", () => {
    expect(appSource).toContain('recognizedIntent.intent === "existing_run_analysis"');
    expect(appSource).toContain('startAgentFlowForInstruction(instruction, context, "existing_run_analysis", reportRequest)');
    expect(appSource).toContain("await presentResultAnalysis(instruction, report)");
    expect(phaseContractsSource).toContain("user_goal?: string");
    expect(appSource).toContain("persisted.user_goal || null");
  });

  it("keeps the readable page explanation after the explain flow completes", () => {
    expect(appSource).toContain('recognizedIntent.intent === "explain"');
    expect(appSource).toContain('body: "我会基于当前页面已发布的能力和证据回答，不会把解释当作已执行的操作。"');
    expect(appSource).toContain('formalErrorBlock("explain_unavailable"');
  });

  it("rehydrates a pending flow after route changes fence its old observer", () => {
    expect(appSource).toContain("synchronizeAgentRouteContext();\n    const navigation = navigationSnapshot();");
    expect(appSource).toContain("agentNavigationReady\n        .then(() => nextTick())");
    expect(appSource).toContain("restoreAgentFlowFromSession();");
    expect(appSource).toContain("routeRestoreToken !== agentRouteRestoreToken");
    expect(appSource).toContain("contextRevision !== (agentContext.value?.context_revision || null)");
    expect(appSource).toContain("persisted.page_id !== currentPageId");
    expect(appSource).toContain("persisted.context_revision !== contextRevision");
  });

  it("waits for initial bootstrap before restoring a run-bound flow", () => {
    expect(appSource).toContain("initialize({ ...navigation, runId: navigation.runId || state.runId })");
    expect(appSource).toContain(".then(() => nextTick())");
    expect(appSource).toContain("const routePath = activeRoute.fullPath;");
    expect(appSource).toContain("routeRestoreToken === agentRouteRestoreToken");
  });

  it("revalidates a persisted pending flow before exposing resume controls", () => {
    expect(appSource).toContain("function restoreAgentFlowFromSession");
    expect(appSource).toContain("getAgentFlow(persisted.flow_id, binding)");
    expect(appSource).toContain("restoreAgentFlowFromSession();");
    expect(appSource).toContain("已恢复流程的身份或契约无法继续校验");
  });

  it("rehydrates an in-flight flow even before it exposes a user action", () => {
    expect(appSource).toContain("!flowIsTerminal(block as unknown as AgentFlowState),");
    expect(appSource).not.toContain(
      "!flowIsTerminal(block as unknown as AgentFlowState) &&\n        Boolean(block.pending_action)",
    );
  });

  it("fences a persisted run-bound flow against a changed current run before GET restore", () => {
    expect(appSource).toContain("const currentRun = agentContext.value?.run_ref || null");
    expect(appSource).toContain("persisted.binding.run_id !== currentRun.run_id");
    expect(appSource).toContain("persisted.binding.run_context_revision !== currentRun.revision");
    expect(appSource).toContain("当前页面的运行身份已变化，流程已停止");
  });

  it("keeps run-bound flow start and resume on the published run_ref identity during deep-link bootstrap", () => {
    expect(appSource).toContain("const flowRunId = context.run_ref?.run_id || null");
    expect(appSource).toContain(
      "if (runBound && (!flowRunId || (state.runId && state.runId !== flowRunId))) return null",
    );
    expect(appSource).toContain(
      "run_context_revision: runBound ? context.run_ref?.revision || context.context_revision : null",
    );
    expect(appSource).toContain("persisted.binding.run_context_revision !== currentRun.revision");
  });

  it("fails closed when a page envelope names an unpublished route", () => {
    expect(appSource).toContain(
      "const currentPage = agentPageDirectory.find((page) => page.route_name === context.route_name);",
    );
    expect(appSource).toContain("if (!currentPage) return null;");
    expect(appSource).toContain(
      "const flowPage = agentPageDirectory.find((page) => page.route_name === context.route_name);",
    );
    expect(appSource).toContain("if (!flowPage) return null;");
    expect(appSource).not.toContain("|| agentPageDirectory[0]");
  });

  it("fences a delayed flow start against session, route, or context changes", () => {
    expect(appSource).toContain("const flowSessionId = agentActiveSessionId.value");
    expect(appSource).toContain("const flowRoutePath = activeRoute.fullPath");
    expect(appSource).toContain("const flowContextRevision = context.context_revision");
    expect(appSource).toContain("const flowToken = agentFlowToken.value");
    expect(appSource).toContain("if (!flowStillBelongsToContext()) return null;");
    expect(appSource).toContain("const flow = await createAgentFlow(request);");
    expect(appSource).toContain("if (!flowStillBelongsToContext()) return null;\n    agentFlowInstruction.value");
  });

  it("does not apply a late model intent response to a changed session or page", () => {
    expect(appSource).toContain("const submitSessionId = agentActiveSessionId.value");
    expect(appSource).toContain("const submitRoutePath = activeRoute.fullPath");
    expect(appSource).toContain("const submitContextRevision = context.context_revision");
    expect(appSource).toContain("const submitStillCurrent = () =>");
    expect(appSource).toContain("if (!submitStillCurrent()) return;\n  if (!recognizedIntent");
  });

  it("does not publish a late navigation observation into another session", () => {
    expect(appSource).toContain("const navigationSessionId = agentActiveSessionId.value");
    expect(appSource).toContain("const ownsNavigationBlock = () =>");
    expect(appSource).toContain('candidate.status === "running"');
    expect(appSource).toContain("if (!ownsNavigationBlock()) return;");
  });

  it("keeps navigation on one user-facing proposal while durable state stays observable", () => {
    expect(appSource).toContain(
      "if (!navigationPlan) updateAgentFlowBlock(flow, instruction);\n    else agentFlowState.value = flow;",
    );
    expect(appSource).toContain('observeAgentFlow(flow, intent !== "navigation")');
    expect(appSource).toContain("scheduleAgentFlowPoll(flowId, binding, token, projectBlock)");
    expect(appSource).toContain("if (projectBlock) updateAgentFlowBlock(flow);");
    expect(appSource).toContain("updateAgentNavigationBlock(flow);");
    expect(appSource).toContain("observeAgentFlow(response.flow, false)");
    expect(appSource).toContain("onObservation: async (observation)");
    expect(appSource).toContain("persistNavigationObservation(observation)");
    expect(appSource).toContain("reconcile the durable cursor first");
    expect(appSource).toContain("matchesObservation");
    expect(appSource).toContain("let latestNavigationFlow = navigationFlow");
    expect(appSource).toContain("revokeAgentFlowAuthorization(revokeFlow.flow_id, revokeRequest, key)");
    expect(appSource).toContain('@navigation-cancel="cancelAgentNavigation"');
    expect(appSource).toContain("agentNavigationGeneration");
    expect(appSource).toContain("agentNavigationAbort?.abort()");
  });

  it("rehydrates persisted navigation through its durable flow identity", () => {
    expect(appSource).toContain("const persistedNavigation = [...agentBlocks.value]");
    expect(appSource).toContain("getAgentFlow(persistedNavigation.flow_id, binding)");
    expect(appSource).toContain("observeAgentFlow(flow, false)");
    expect(appSource).toContain("导航流程已恢复；点击上方按钮继续打开页面");
  });

  it("keeps the single navigation card synchronized when SSE or polling observes a durable transition", () => {
    expect(appSource).toContain("function updateAgentNavigationBlock(flow: AgentFlowState, notice?: string)");
    expect(appSource).toContain("updateAgentNavigationBlock(event.state)");
    expect(appSource).toContain("updateAgentNavigationBlock(state)");
    expect(appSource).toMatch(/flow\.status === "completed"\s*\?\s*"succeeded"/u);
  });

  it("keeps a retryable navigation interrupt actionable and closes it on observer identity failure", () => {
    expect(appSource).toContain('flow.status === "waiting_user" && flow.pending_action === "confirm_navigation"');
    expect(appSource).toContain(
      'response.flow.status === "waiting_user" && response.flow.pending_action === "confirm_navigation"',
    );
    expect(appSource).toContain("助手流程身份或观察通道无法继续校验");
    expect(appSource).toContain('status: "stale"');
    expect(appSource).toContain("if (!shouldRetryAgentFlowObserver(error)) stopAgentFlowObserver(error, false);");
  });

  it("replays a lost navigation revoke with the same key and reconciles durable cancellation", () => {
    expect(appSource).toContain("let response: Awaited<ReturnType<typeof revokeAgentFlowAuthorization>>;");
    expect(appSource).toContain("Replay the exact request with the same idempotency key once");
    expect(appSource).toContain(
      "response = await revokeAgentFlowAuthorization(revokeFlow.flow_id, revokeRequest, key);",
    );
    expect(appSource).toContain("const reconciled = await getAgentFlow(revokeFlow.flow_id, revokeFlow.binding);");
    expect(appSource).toContain('reconciled.status !== "cancelled"');
    expect(appSource).toContain('reconciled.authorization?.status !== "revoked"');
    expect(appSource).toContain('action: "revoke_authorization"');
  });

  it("reconciles a lost successful navigation observation before marking it stale", () => {
    expect(appSource).toContain("The successful browser observation is a durable mutation too");
    expect(appSource).toContain("const reconciled = await getAgentFlow(latestNavigationFlow.flow_id, latestNavigationFlow.binding);");
    expect(appSource).toContain("const observed = reconciled.last_navigation_observation;");
    expect(appSource).toContain("reconciled.event_sequence > latestNavigationFlow.event_sequence");
  });

  it("fails closed when a restored navigation cursor cannot be validated", () => {
    expect(appSource).toContain("let result: Awaited<ReturnType<typeof recoverAgentNavigation>>;");
    expect(appSource).toContain("已恢复的导航游标无法校验，未继续页面跳转");
  });

  it("does not leave a persisted navigation card pending when its durable flow changed intent or action", () => {
    expect(appSource).toContain('if (flow.intent !== "navigation")');
    expect(appSource).toContain('if (flow.pending_action !== "confirm_navigation")');
    expect(appSource).toContain("已恢复的流程已不再等待页面导航确认，未继续跳转");
    expect(appSource).toContain('status: flow.status === "failed" ? "failed" : "stale"');
  });

  it("fences persisted navigation against page context and Bridge identity drift before showing a resume action", () => {
    expect(appSource).toContain("const currentSchemaRevision = state.bridge.manifest?.schema_set_revision || null");
    expect(appSource).toContain("const currentBackendIdentity = flowBackendIdentity();");
    expect(appSource).toContain("const bindingMatchesCurrent =");
    expect(appSource).toContain("const pageContextMatchesCurrent =");
    expect(appSource).toContain("当前页面、上下文或 Bridge 身份已变化，未恢复导航");
  });

  it("does not append a stale result explanation after the page changes", () => {
    expect(appSource).toContain("const presentationSessionId = agentActiveSessionId.value");
    expect(appSource).toContain("const presentationRoutePath = activeRoute.fullPath");
    expect(appSource).toContain("const presentationContextRevision = agentContext.value?.context_revision");
    expect(appSource).toContain("if (!presentationStillCurrent()) return;");
  });

  it("binds each navigation proposal to its originating turn", () => {
    expect(appSource).toContain('block_id: "agent-navigation-proposal:" + turn');
    expect(appSource).not.toContain('block_id: "agent-navigation-proposal",');
  });

  it("waits for the new page envelope before recording navigation", () => {
    expect(appSource).toContain("expectedRunId: navigationRunBound ? context.run_ref?.run_id || null : null");
    expect(appSource).toContain("await agentNavigationReady;");
    expect(appSource).toContain("agentNavigationTransitionActive = true;");
    expect(appSource).toContain("agentNavigationTransitionActive = false;");
    expect(appSource).toContain("await nextTick();\n      agentNavigationTransitionActive = false;");
    expect(appSource).toContain("const preservingApprovedNavigation =");
    expect(appSource).toContain("if (!preservingApprovedNavigation) {");
  });

  it("updates navigation blocks by id after concurrent transcript inserts", () => {
    expect(appSource).toContain('candidate.block_id === blockId && candidate.block_type === "agent_navigation"');
    expect(appSource).not.toContain('candidateIndex === index && candidate.block_type === "agent_navigation"');
  });

  it("forces navigation cancellation when the user switches or deletes a session", () => {
    expect(appSource).toContain("function createAgentSession(): void {");
    expect(appSource).toContain("function selectAgentSession(sessionId: string): void {");
    expect(appSource).toContain("function deleteAgentSession(sessionId: string): void {");
    expect(appSource).toContain("function clearAllAgentSessions(): void {");
    expect(appSource.match(/clearAgentFlowObserver\(true\);/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("does not carry an old run context revision without a current run id", () => {
    expect(appSource).toContain("const currentRunId = runBound ? contextRun?.run_id || null : null");
    expect(appSource).toContain("run_id: currentRunId");
    expect(appSource).toContain("run_context_revision: currentRunId ? contextRun?.revision || null : null");
    expect(appSource).toContain("Never carry a stale revision when the current run identity is absent");
  });

  it("checks the live page context before the navigation executor starts", () => {
    expect(appSource).toContain("const currentPageId = agentPageDirectory.find");
    expect(appSource).toContain("navigationFlow.current_context_revision !== context.context_revision");
    expect(appSource).toContain("未执行旧导航；请重新描述目标");
  });

  it("keeps navigation bound to the published page run and refuses run-bound targets without one", () => {
    expect(appSource).toContain("expectedRunId: navigationRunBound ? context.run_ref?.run_id || null : null");
    expect(appSource).toContain("routeForView(pageId, context.run_ref?.run_id || null)");
    expect(appSource).toContain("const requiresRunBinding = block.target_pages.some(");
    expect(appSource).toContain("目标页面需要已验证的运行身份");
    expect(appSource).not.toContain("expectedRunId: state.runId || context.run_ref?.run_id || null");
    expect(appSource).not.toContain("routeForView(pageId, state.runId || context.run_ref?.run_id || null)");
  });

  it("does not fence an unbound navigation to a backend-global page against a dropped run query", () => {
    expect(appSource).toContain("const navigationRunBound = navigationFlow.binding.run_id !== null;");
    expect(appSource).toContain("expectedArtifactBindings: navigationRunBound ? navigationFlow.binding.artifact_bindings : undefined");
    expect(appSource).toContain("artifact_bindings: flowArtifactBindings(),");
  });

  it("waits for initial dashboard synchronization before restoring persisted flows", () => {
    expect(appSource).not.toMatch(
      /onMounted\(\(\) => \{\s*dashboardInitialized\.value = true;\s*restoreAgentFlowFromSession\(\);/u,
    );
    expect(appSource).toContain("initialize({ ...navigation, runId: navigation.runId || state.runId })");
    expect(appSource).toContain("// synchronization has published the current run and schema identity.");
    expect(appSource).toContain("        restoreAgentFlowFromSession();");
  });

  it("defers persisted flow restore when a session is selected during navigation bootstrap", () => {
    expect(appSource).toContain("let agentNavigationReady: Promise<unknown> = Promise.resolve();");
    expect(appSource).toContain("agentNavigationReady\n      .then(() => nextTick())");
    expect(appSource).toContain("agentActiveSessionId.value !== sessionId");
    expect(appSource).toContain("selectedRouteToken !== agentRouteRestoreToken");
    expect(appSource).toContain(
      "agentNavigationReady = initialize({ ...navigation, runId: navigation.runId || state.runId });",
    );
  });

  it("fences cancellation immediately instead of waiting for the reader to settle", () => {
    expect(appSource).toContain("agentStreamToken += 1");
    expect(appSource).toContain("agentStreamAbort = null");
    expect(appSource).toContain("agentStreaming.value = false");
    expect(appSource).toContain('error: block.error || "已停止这次回答。"');
    expect(appSource).toContain("clearAgentFlowObserver();");
    expect(appSource).toContain("const ownsCancel = () =>");
  });
});
