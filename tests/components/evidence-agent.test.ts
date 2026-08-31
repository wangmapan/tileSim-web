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
});
