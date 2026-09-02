/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import EvidenceAgentPanel from "../../src/features/evidence-agent/components/EvidenceAgentPanel.vue";
import EvidenceAgentSubmissionLeaseNotice from "../../src/features/evidence-agent/components/EvidenceAgentSubmissionLeaseNotice.vue";
import {
  buildEvidenceAgentRequest,
  evidenceAgentBackendIdentity,
  validateEvidenceAgentResult,
} from "../../src/features/evidence-agent";
import { useEvidenceAgentStore } from "../../src/stores/evidence-agent";
import {
  createCompletedAgentResponse,
  createEvidenceAgentDescriptor,
  createF9RunContext,
  f9ApiManifest,
  f9Health,
  f9RequestId,
  f9RunId,
  f9SchemaRevision,
} from "../fixtures/evidence-agent";

let pinia = createPinia();

function props(configured: boolean) {
  const context = createF9RunContext();
  const store = useEvidenceAgentStore();
  return {
    descriptor: createEvidenceAgentDescriptor(configured),
    descriptorStatus: "supported" as const,
    descriptorError: "",
    runId: f9RunId,
    runName: "F9 fixture",
    selectedRequestId: f9RequestId,
    manifest: context.manifest,
    apiManifest: f9ApiManifest,
    health: f9Health,
    bundle: context.bundle,
    inputs: context.inputs,
    agentState: store.state,
    agentResult: store.result,
    pending: store.pending,
    prepared: store.prepared,
    submissionError: "",
  };
}

async function routerPlugin() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/evidence-agent", name: "evidence_agent", component: { template: "<div />" } },
      { path: "/execution", name: "execution", component: { template: "<div />" } },
      { path: "/experiment", name: "experiment", component: { template: "<div />" } },
    ],
  });
  await router.push("/evidence-agent");
  await router.isReady();
  return router;
}

beforeEach(() => {
  window.sessionStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
});

describe("Evidence Agent submission lease notice", () => {
  const pending = {
    runId: f9RunId,
    backendIdentity: evidenceAgentBackendIdentity(f9Health),
    schemaSetRevision: f9SchemaRevision,
    inputSnapshotDigest: `sha256:${"a".repeat(64)}`,
    payloadDigest: `sha256:${"b".repeat(64)}`,
    idempotencyKey: "agent-idempotency:component-lease",
    clientRequestId: "agent-client:component-lease",
  };

  it.each([
    ["terminal_result_not_retained", "无法恢复先前的 claims 终态", "明确放弃该终态并开始新分析"],
    ["idempotency_payload_mismatch", "幂等键已绑定到不同载荷", "明确放弃旧分析并开始新分析"],
  ] as const)("renders and explicitly discards the formal %s lease", async (agentState, heading, action) => {
    const wrapper = mount(EvidenceAgentSubmissionLeaseNotice, {
      props: { pending, agentState, mustDiscardBeforeSubmit: false },
      attachTo: document.body,
    });

    expect(wrapper.get('[role="status"]').text()).toContain(pending.idempotencyKey);
    expect(wrapper.get('[role="alert"]').text()).toContain(heading);
    expect(wrapper.get('[role="alert"] code').text()).toBe(agentState);
    const button = wrapper.get("button");
    expect(button.element.tagName).toBe("BUTTON");
    expect(button.attributes("disabled")).toBeUndefined();
    expect(button.text()).toContain(action);
    (button.element as HTMLButtonElement).focus();
    expect(document.activeElement).toBe(button.element);
    await button.trigger("click");
    expect(wrapper.emitted("discard")).toHaveLength(1);
    expect(pending.idempotencyKey).toBe("agent-idempotency:component-lease");
    wrapper.unmount();
  });

  it("keeps stale and restored-payload leases distinct without adding an alert", () => {
    const stale = mount(EvidenceAgentSubmissionLeaseNotice, {
      props: { pending, agentState: "stale", mustDiscardBeforeSubmit: false },
    });
    const restored = mount(EvidenceAgentSubmissionLeaseNotice, {
      props: { pending, agentState: "failed", mustDiscardBeforeSubmit: true },
    });

    expect(stale.text()).toContain("snapshot digest 已变化");
    expect(stale.get("button").text()).toContain("明确放弃当前分析");
    expect(stale.find('[role="alert"]').exists()).toBe(false);
    expect(restored.text()).toContain("刷新页面或编辑问题后");
    expect(restored.get("button").text()).toContain("放弃旧分析并开始新问题");
    expect(restored.find('[role="alert"]').exists()).toBe(false);
  });
});

describe("F9 evidence Agent presentation", () => {
  it("turns only descriptor-supported task kinds into plain-language cards and previews the frozen scope", async () => {
    const panelProps = props(true);
    panelProps.descriptor = {
      ...panelProps.descriptor,
      supported_task_kinds: ["explain_tail", "summarize_validation"],
    };
    const wrapper = mount(EvidenceAgentPanel, {
      props: panelProps,
      global: { plugins: [pinia, await routerPlugin()] },
    });

    const taskCards = wrapper.findAll('.evidence-agent-task-cards input[type="radio"]');
    expect(taskCards).toHaveLength(2);
    expect(taskCards.map((input) => input.attributes("value"))).toEqual(["explain_tail", "summarize_validation"]);
    expect(wrapper.get(".evidence-agent-task-cards").text()).toContain("解释尾延迟");
    expect(wrapper.get(".evidence-agent-task-cards").text()).toContain("总结验证边界");
    expect(wrapper.get(".evidence-agent-task-cards").text()).not.toContain("起草条件建议");
    expect(taskCards[0].attributes("checked")).toBeDefined();

    const preview = wrapper.get(".evidence-agent-submission-preview");
    expect(preview.text()).toContain(f9RequestId);
    expect(preview.text()).toMatch(/\d+ 个精确引用位置，来自 \d+ 份 artifact/);
    expect(preview.text()).toContain("仅为合成证据");
    expect(preview.text()).toContain("服务上限 30 秒");
    await preview.get(":scope > details > summary").trigger("click");
    expect(preview.text()).toContain("synthetic_trace");
    expect(preview.text()).toContain("requested_fidelity");
    expect(preview.text()).toContain("resolved_fidelity");
    expect(preview.text()).toContain("partitioned_des");
  });

  it("shows the formal provider_unavailable state without a mock answer", async () => {
    const wrapper = mount(EvidenceAgentPanel, {
      props: props(false),
      global: { plugins: [pinia, await routerPlugin()] },
    });

    expect(wrapper.text()).toContain("AI 解释当前不可用");
    expect(wrapper.text()).toContain("provider_unavailable");
    expect(wrapper.find("button").attributes("disabled")).toBeDefined();
    expect(wrapper.findAll(".evidence-agent-claims > li")).toHaveLength(0);
    expect(wrapper.text()).toContain("tilesim.bridge.evidence_agent_descriptor.v2");
    expect(wrapper.text()).toContain("redacted_terminal_metadata_only");
    expect(wrapper.text()).toContain("exact_terminal_replay");
    expect(wrapper.text()).toContain("terminal_result_not_retained");
    expect(wrapper.text()).toContain("forbidden");
    expect(wrapper.text()).toContain("S3 · S4 · S5");
    expect(wrapper.text()).toContain("S7");
    expect(wrapper.text()).toContain("S8 · S9");
    expect(wrapper.text()).toContain("exact_terminal_replay_from_redacted_record");
    expect(wrapper.findAll(".evidence-agent-retention-list li")).toHaveLength(7);
    expect(wrapper.findAll(".evidence-agent-retention-list li").every((item) => item.text().includes("禁止留存"))).toBe(
      true,
    );
    expect(wrapper.findAll(".evidence-agent-terminal-list li")).toHaveLength(5);
    expect(wrapper.find(".evidence-agent-terminal-list").text()).toContain("HTTP 409");
    expect(wrapper.find(".evidence-agent-terminal-list").text()).toContain("HTTP 502");
    expect(wrapper.find(".evidence-agent-terminal-list").text()).toContain("HTTP 503");
    expect(wrapper.find(".evidence-agent-terminal-list").text()).toContain("HTTP 504");
    expect(wrapper.find(".evidence-agent-terminal-list").text()).toContain("tilesim.bridge.error.v1");
    expect(wrapper.find(".evidence-agent-terminal-list").text()).toContain("tilesim.bridge.evidence_agent_response.v1");
    expect(wrapper.text()).not.toContain("[object Object]");
    expect(wrapper.get(".evidence-agent-identity-disclosure").attributes("open")).toBeUndefined();
    expect(wrapper.get(".evidence-agent-policy-disclosure").attributes("open")).toBeUndefined();
    const stackClasses = [...wrapper.get(".evidence-agent-stack").element.children].map((element) => element.className);
    expect(stackClasses.findIndex((value) => value.includes("evidence-agent-compose"))).toBeLessThan(
      stackClasses.findIndex((value) => value.includes("evidence-agent-policy-disclosure")),
    );
  });

  it("explains an unqueryable legacy run before the user can submit", async () => {
    const legacyProps = props(true);
    legacyProps.manifest = {
      ...legacyProps.manifest,
      artifacts: legacyProps.manifest.artifacts.map((artifact) =>
        artifact.artifact_id === "input-topology"
          ? artifact
          : { ...artifact, contract_status: "legacy_compatibility" as const },
      ),
    };
    const wrapper = mount(EvidenceAgentPanel, {
      props: legacyProps,
      global: { plugins: [pinia, await routerPlugin()] },
    });

    expect(wrapper.text()).toContain("当前实验不能用于提问");
    expect(wrapper.text()).toContain("这次实验没有生成正式 metrics 证据");
    expect(wrapper.text()).toContain("0/6 份引用依据可用");
    expect(wrapper.get("a.button--secondary").attributes("href")).toBe("/experiment");
    expect(wrapper.get("button.button:not(.button--secondary)").attributes("disabled")).toBeDefined();
  });

  it("renders only validated atomic citations as exact artifact navigation", async () => {
    const context = createF9RunContext();
    const descriptor = createEvidenceAgentDescriptor(true);
    const prepared = await buildEvidenceAgentRequest({
      runId: f9RunId,
      selectedRequestId: f9RequestId,
      manifest: context.manifest,
      descriptor,
      health: f9Health,
      structuredReport: context.structuredReport,
      bundle: context.bundle,
      inputs: context.inputs,
      locale: "zh-CN",
      taskKind: "explain_p99",
      question: "Explain the exact request.",
      clientRequestId: "agent-client:component",
    });
    const artifact = prepared.request.artifact_allow_list.find((entry) => entry.artifact_id === "metrics")!;
    const record = artifact.allowed_records.find((entry) => entry.subject.kind === "request")!;
    const response = createCompletedAgentResponse(prepared.inputSnapshotDigest, prepared.request.client_request_id, {
      schema_version: "tilesim.bridge.evidence_agent_citation.v1",
      run_id: f9RunId,
      artifact_id: artifact.artifact_id,
      schema_identity: artifact.schema_identity,
      sha256: artifact.sha256,
      json_pointer: record.json_pointer,
      subject: record.subject,
      citation_role: "direct_fact",
      availability: "available",
      value: { encoding: "decimal_string", numeric_kind: "uint64", decimal: "9007199254740993123" },
      unit: "ps",
    });
    const binding = {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: prepared.inputSnapshotDigest,
    };
    useEvidenceAgentStore().complete(validateEvidenceAgentResult(response, prepared, descriptor, binding), binding);
    const wrapper = mount(EvidenceAgentPanel, {
      props: props(true),
      global: { plugins: [pinia, await routerPlugin()] },
    });

    const link = wrapper.get(".evidence-agent-citations a");
    expect(link.attributes("href")).toContain("evidence_artifact=metrics");
    expect(link.attributes("href")).toContain(`evidence_sha=${artifact.sha256}`);
    expect(link.attributes("href")).toContain("evidence_pointer=/request_metrics/0");
    expect(wrapper.text()).toContain("9007199254740993123");
  });

  it("presents untouched atomic claims as findings, limitations, and next steps with technical identity on demand", async () => {
    const context = createF9RunContext();
    const descriptor = createEvidenceAgentDescriptor(true);
    const prepared = await buildEvidenceAgentRequest({
      runId: f9RunId,
      selectedRequestId: f9RequestId,
      manifest: context.manifest,
      descriptor,
      health: f9Health,
      structuredReport: context.structuredReport,
      bundle: context.bundle,
      inputs: context.inputs,
      locale: "zh-CN",
      taskKind: "explain_tail",
      question: "Keep every atomic claim unchanged.",
      clientRequestId: "agent-client:component-groups",
    });
    const artifact = prepared.request.artifact_allow_list.find((entry) => entry.artifact_id === "metrics")!;
    const record = artifact.allowed_records.find((entry) => entry.subject.kind === "request")!;
    const response = createCompletedAgentResponse(prepared.inputSnapshotDigest, prepared.request.client_request_id, {
      schema_version: "tilesim.bridge.evidence_agent_citation.v1",
      run_id: f9RunId,
      artifact_id: artifact.artifact_id,
      schema_identity: artifact.schema_identity,
      sha256: artifact.sha256,
      json_pointer: record.json_pointer,
      subject: record.subject,
      citation_role: "direct_fact",
      availability: "available",
    });
    const numeric = structuredClone(response.claims[0]);
    numeric.claim_id = "claim-original-finding";
    numeric.text = "Exact finding text from the validated response.";
    const limitation = structuredClone(numeric);
    limitation.claim_id = "claim-original-limitation";
    limitation.claim_kind = "validation_boundary";
    limitation.text = "Exact limitation text from the validated response.";
    const recommendation = structuredClone(numeric);
    recommendation.claim_id = "claim-original-next-step";
    recommendation.claim_kind = "conditional_recommendation";
    recommendation.text = "Exact conditional next-step text from the validated response.";
    recommendation.scope.recommendation_semantics = "conditional_not_executed";
    response.claims = [recommendation, numeric, limitation];
    const responseBeforePresentation = JSON.stringify(response);
    const binding = {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: prepared.inputSnapshotDigest,
    };
    useEvidenceAgentStore().complete(validateEvidenceAgentResult(response, prepared, descriptor, binding), binding);
    const wrapper = mount(EvidenceAgentPanel, {
      props: props(true),
      global: { plugins: [pinia, await routerPlugin()] },
    });

    expect(wrapper.get('[data-group="conclusion"] h3').text()).toBe("结论");
    expect(wrapper.get('[data-group="limitations"] h3').text()).toBe("限制");
    expect(wrapper.get('[data-group="next_steps"] h3').text()).toBe("下一步");
    expect(wrapper.get('[data-claim-kind="numeric_fact"]').attributes("data-original-index")).toBe("1");
    expect(wrapper.get('[data-claim-kind="validation_boundary"]').attributes("data-original-index")).toBe("2");
    expect(wrapper.get('[data-claim-kind="conditional_recommendation"]').attributes("data-original-index")).toBe("0");
    expect(wrapper.findAll(".evidence-agent-claim-text").map((entry) => entry.text())).toEqual([
      numeric.text,
      limitation.text,
      recommendation.text,
    ]);
    expect(JSON.stringify(response)).toBe(responseBeforePresentation);

    const evidence = wrapper.get('[data-claim-kind="numeric_fact"] .evidence-agent-claim-evidence');
    expect(evidence.attributes("open")).toBeUndefined();
    await evidence.get(":scope > summary").trigger("click");
    const link = evidence.get("a");
    expect(link.text()).toContain("打开原始证据 1");
    expect(link.attributes("href")).toContain("evidence_pointer=/request_metrics/0");
    const citationIdentity = evidence.get(".evidence-agent-citation-identity");
    expect(citationIdentity.attributes("open")).toBeUndefined();
    await citationIdentity.get(":scope > summary").trigger("click");
    expect(citationIdentity.text()).toContain(artifact.sha256);
    expect(citationIdentity.text()).toContain(record.json_pointer);
    expect(citationIdentity.text()).toContain(`${record.subject.kind} · ${record.subject.id}`);
  });

  it("shows valid claims and the unfinished boundary together for a partial response", async () => {
    const context = createF9RunContext();
    const descriptor = createEvidenceAgentDescriptor(true);
    const prepared = await buildEvidenceAgentRequest({
      runId: f9RunId,
      selectedRequestId: f9RequestId,
      manifest: context.manifest,
      descriptor,
      health: f9Health,
      structuredReport: context.structuredReport,
      bundle: context.bundle,
      inputs: context.inputs,
      locale: "zh-CN",
      taskKind: "explain_p99",
      question: "Explain the exact request.",
      clientRequestId: "agent-client:component-partial",
    });
    const artifact = prepared.request.artifact_allow_list.find((entry) => entry.artifact_id === "metrics")!;
    const record = artifact.allowed_records.find((entry) => entry.subject.kind === "request")!;
    const response = createCompletedAgentResponse(prepared.inputSnapshotDigest, prepared.request.client_request_id, {
      schema_version: "tilesim.bridge.evidence_agent_citation.v1",
      run_id: f9RunId,
      artifact_id: artifact.artifact_id,
      schema_identity: artifact.schema_identity,
      sha256: artifact.sha256,
      json_pointer: record.json_pointer,
      subject: record.subject,
      citation_role: "direct_fact",
      availability: "available",
      value: { encoding: "decimal_string", numeric_kind: "uint64", decimal: "42" },
      unit: "ps",
    });
    response.completion_state = "partial";
    response.partial = true;
    response.refusal = {
      reason_code: "insufficient_evidence",
      detail: "P99 is not defined for this request in the verified snapshot.",
      retryable: false,
    };
    const binding = {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: prepared.inputSnapshotDigest,
    };
    useEvidenceAgentStore().complete(validateEvidenceAgentResult(response, prepared, descriptor, binding), binding);

    const wrapper = mount(EvidenceAgentPanel, {
      props: props(true),
      global: { plugins: [pinia, await routerPlugin()] },
      attachTo: document.body,
    });

    await nextTick();

    expect(wrapper.get(".evidence-agent-state").text()).toBe("部分结果");
    expect(wrapper.get('.evidence-agent-result-boundary[data-state="partial"]').text()).toContain(
      "未完成部分不会由前端补写",
    );
    expect(wrapper.text()).toContain("部分问题缺少足够证据");
    expect(wrapper.text()).toContain("insufficient_evidence");
    expect(wrapper.findAll(".evidence-agent-claims > li")).toHaveLength(1);
    expect(wrapper.text()).toContain("42ps");
    expect(document.activeElement).toBe(wrapper.get(".evidence-agent-result h2").element);
    wrapper.unmount();
  });

  it("shows the cross-process recovery boundary without rotating the pending key", async () => {
    const store = useEvidenceAgentStore();
    const pending = store.begin(
      {
        runId: f9RunId,
        backendIdentity: evidenceAgentBackendIdentity(f9Health),
        schemaSetRevision: f9SchemaRevision,
        inputSnapshotDigest: `sha256:${"a".repeat(64)}`,
      },
      `sha256:${"b".repeat(64)}`,
      "agent-client:component-recovery",
    );
    store.fail("terminal_result_not_retained", "terminal_result_not_retained");
    const wrapper = mount(EvidenceAgentPanel, {
      props: props(true),
      global: { plugins: [pinia, await routerPlugin()] },
    });

    expect(wrapper.text()).toContain("terminal_result_not_retained");
    expect(wrapper.text()).toContain("不会自动调用 Provider");
    expect(wrapper.text()).toContain(pending.idempotencyKey);
    expect(wrapper.get("button.button:not(.button--secondary)").attributes("disabled")).toBeDefined();
    expect(wrapper.get("button.button--secondary").text()).toContain("明确放弃");
  });

  it("locks a server-reported idempotency payload mismatch until explicit discard", async () => {
    const store = useEvidenceAgentStore();
    const pending = store.begin(
      {
        runId: f9RunId,
        backendIdentity: evidenceAgentBackendIdentity(f9Health),
        schemaSetRevision: f9SchemaRevision,
        inputSnapshotDigest: `sha256:${"a".repeat(64)}`,
      },
      `sha256:${"b".repeat(64)}`,
      "agent-client:component-payload-mismatch",
    );
    store.fail("idempotency_payload_mismatch", "idempotency_payload_mismatch");
    const wrapper = mount(EvidenceAgentPanel, {
      props: props(true),
      global: { plugins: [pinia, await routerPlugin()] },
    });

    expect(wrapper.text()).toContain("idempotency_payload_mismatch");
    expect(wrapper.text()).toContain("不会自动换 key 调用 Provider");
    expect(wrapper.text()).toContain(pending.idempotencyKey);
    expect(wrapper.get("button.button:not(.button--secondary)").attributes("disabled")).toBeDefined();
    expect(wrapper.get("button.button--secondary").text()).toContain("明确放弃");
  });

  it("locks a stale pending analysis across all four binding dimensions", async () => {
    const store = useEvidenceAgentStore();
    const pending = store.begin(
      {
        runId: f9RunId,
        backendIdentity: evidenceAgentBackendIdentity(f9Health),
        schemaSetRevision: f9SchemaRevision,
        inputSnapshotDigest: `sha256:${"a".repeat(64)}`,
      },
      `sha256:${"b".repeat(64)}`,
      "agent-client:component-stale",
    );
    store.synchronize({
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: `sha256:${"c".repeat(64)}`,
    });
    const wrapper = mount(EvidenceAgentPanel, {
      props: props(true),
      global: { plugins: [pinia, await routerPlugin()] },
    });

    expect(wrapper.text()).toContain("run、backend、schema revision 或 snapshot digest 已变化");
    expect(wrapper.text()).toContain(pending.idempotencyKey);
    expect(wrapper.get("button.button:not(.button--secondary)").attributes("disabled")).toBeDefined();
    expect(wrapper.get("button.button--secondary").text()).toContain("明确放弃当前分析");
  });

  it("blocks a restored key when the complete canonical payload is no longer retained", async () => {
    const store = useEvidenceAgentStore();
    const pending = store.begin(
      {
        runId: f9RunId,
        backendIdentity: evidenceAgentBackendIdentity(f9Health),
        schemaSetRevision: f9SchemaRevision,
        inputSnapshotDigest: `sha256:${"a".repeat(64)}`,
      },
      `sha256:${"b".repeat(64)}`,
      "agent-client:component-restored",
    );
    store.fail("failed", "restored_without_payload");
    const wrapper = mount(EvidenceAgentPanel, {
      props: props(true),
      global: { plugins: [pinia, await routerPlugin()] },
      attachTo: document.body,
    });

    expect(wrapper.text()).toContain("刷新页面或编辑问题后");
    expect(wrapper.text()).toContain(pending.idempotencyKey);
    expect(wrapper.get("button.button:not(.button--secondary)").attributes("disabled")).toBeDefined();
    expect(wrapper.get("button.button--secondary").text()).toContain("放弃旧分析并开始新问题");
    await wrapper.get("button.button--secondary").trigger("click");
    expect(wrapper.emitted("discardPending")).toHaveLength(1);
    expect(document.activeElement).toBe(wrapper.get("textarea").element);
    wrapper.unmount();
  });

  it("allows exact in-memory replay but blocks submission after the question changes", async () => {
    const context = createF9RunContext();
    const descriptor = createEvidenceAgentDescriptor(true);
    const prepared = await buildEvidenceAgentRequest({
      runId: f9RunId,
      selectedRequestId: f9RequestId,
      manifest: context.manifest,
      descriptor,
      health: f9Health,
      structuredReport: context.structuredReport,
      bundle: context.bundle,
      inputs: context.inputs,
      locale: "zh-CN",
      taskKind: "explain_p99",
      question: "请解释当前 request 的 P99 与尾延迟证据边界。",
      clientRequestId: "agent-client:component-exact-replay",
    });
    const store = useEvidenceAgentStore();
    store.begin(
      {
        runId: f9RunId,
        backendIdentity: evidenceAgentBackendIdentity(f9Health),
        schemaSetRevision: f9SchemaRevision,
        inputSnapshotDigest: prepared.inputSnapshotDigest,
      },
      prepared.payloadDigest,
      prepared.request.client_request_id,
    );
    store.attachPrepared(prepared);
    store.fail("failed", "retryable_terminal");
    const wrapper = mount(EvidenceAgentPanel, {
      props: props(true),
      global: { plugins: [pinia, await routerPlugin()] },
    });
    const submit = wrapper.get("button.button:not(.button--secondary)");

    expect(submit.attributes("disabled")).toBeUndefined();
    await wrapper.get("textarea").setValue("这是一个需要新幂等键的新问题。");
    expect(submit.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("前端已阻止冲突提交");
  });
});
