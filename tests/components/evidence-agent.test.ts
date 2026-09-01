/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it } from "vitest";
import EvidenceAgentPanel from "../../src/features/evidence-agent/components/EvidenceAgentPanel.vue";
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
    submissionError: "",
  };
}

async function routerPlugin() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/evidence-agent", name: "evidence_agent", component: { template: "<div />" } },
      { path: "/execution", name: "execution", component: { template: "<div />" } },
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

describe("F9 evidence Agent presentation", () => {
  it("shows the formal provider_unavailable state without a mock answer", async () => {
    const wrapper = mount(EvidenceAgentPanel, {
      props: props(false),
      global: { plugins: [pinia, await routerPlugin()] },
    });

    expect(wrapper.text()).toContain("Provider 未配置");
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
});
