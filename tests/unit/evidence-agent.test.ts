/** @vitest-environment jsdom */

import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildEvidenceAgentRequest,
  buildEvidenceAgentSnapshotDigest,
  canonicalJson,
  evidenceAgentBackendIdentity,
  evidenceAgentFailure,
  validateEvidenceAgentResult,
} from "../../src/features/evidence-agent";
import { BridgeApiError } from "../../src/lib/api";
import { useEvidenceAgentStore } from "../../src/stores/evidence-agent";
import {
  createCompletedAgentResponse,
  createEvidenceAgentDescriptor,
  createF9RunContext,
  f9Health,
  f9RequestId,
  f9RunId,
  f9SchemaRevision,
} from "../fixtures/evidence-agent";

async function preparedRequest() {
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
    question: "Explain the cited P99 request.",
    clientRequestId: "agent-client:test-request",
  });
  return { ...context, descriptor, prepared };
}

function firstCitation(prepared: Awaited<ReturnType<typeof preparedRequest>>["prepared"]) {
  const artifact = prepared.request.artifact_allow_list.find((entry) => entry.artifact_id === "metrics")!;
  const record = artifact.allowed_records.find((entry) => entry.subject.kind === "request")!;
  return {
    schema_version: "tilesim.bridge.evidence_agent_citation.v1" as const,
    run_id: f9RunId,
    artifact_id: artifact.artifact_id,
    schema_identity: artifact.schema_identity,
    sha256: artifact.sha256,
    json_pointer: record.json_pointer,
    subject: record.subject,
    citation_role: "direct_fact" as const,
    availability: "available" as const,
    value: { encoding: "decimal_string" as const, numeric_kind: "uint64" as const, decimal: "9007199254740993123" },
    unit: "ps",
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  setActivePinia(createPinia());
});

describe("F9 canonical JSON and request binding", () => {
  it("sorts keys by Unicode code point, preserves arrays and emits bigint as an integer token", () => {
    expect(canonicalJson({ "😀": 2n, a: [3n, "汉字"], "�": 1n })).toBe('{"a":[3,"汉字"],"�":1,"😀":2}');
    expect(() => canonicalJson({ value: Number.NaN })).toThrow("NaN");
    expect(() => canonicalJson({ value: Number.MAX_SAFE_INTEGER + 1 })).toThrow("lossless");
  });

  it("builds a supported-only run-bound allow-list and lossless canonical digests", async () => {
    const { prepared, descriptor, manifest, structuredReport, bundle, inputs } = await preparedRequest();

    expect(prepared.request.schema_set_revision).toBe(f9SchemaRevision);
    expect(prepared.request.snapshot_reference.backend_identity).toMatchObject({
      versions_match: true,
      state_digests_match: true,
    });
    expect(prepared.request.snapshot_reference.evidence_scope).toMatchObject({
      source_mode: "synthetic_trace",
      requested_fidelity: "des",
      resolved_fidelity: "des",
      execution_mode: "partitioned_des",
      resource_semantics_relation: "S3_S4_S5_peer",
      execution_host: "S7",
      validation_plane: "S8",
      output_plane: "S9",
    });
    expect(prepared.request.artifact_allow_list.every((entry) => entry.run_id === f9RunId)).toBe(true);
    expect(prepared.request.artifact_allow_list.every((entry) => entry.allowed_records.length > 0)).toBe(true);
    expect(prepared.canonicalText).toContain('"bytes":9007199254740993123');
    expect(prepared.inputSnapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(prepared.payloadDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    await expect(
      buildEvidenceAgentSnapshotDigest({
        runId: f9RunId,
        selectedRequestId: f9RequestId,
        manifest,
        descriptor,
        health: f9Health,
        structuredReport,
        bundle,
        inputs,
      }),
    ).resolves.toBe(prepared.inputSnapshotDigest);
  });

  it("fails closed when the provider is unavailable", async () => {
    const context = createF9RunContext();
    await expect(
      buildEvidenceAgentRequest({
        runId: f9RunId,
        selectedRequestId: f9RequestId,
        manifest: context.manifest,
        descriptor: createEvidenceAgentDescriptor(false),
        health: f9Health,
        structuredReport: context.structuredReport,
        bundle: context.bundle,
        inputs: context.inputs,
        locale: "zh-CN",
        taskKind: "explain_p99",
        question: "Explain.",
        clientRequestId: "agent-client:unavailable",
      }),
    ).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("preserves a backend-declared P99 tie without selecting one request", async () => {
    const context = createF9RunContext();
    const subject = context.structuredReport.run_bound_evidence.percentile_subjects[0];
    subject.selection_semantics = "tie_no_single_request";
    subject.selected_request_id = null;
    subject.member_request_ids = [f9RequestId, "req-f9-tied"];
    const prepared = await buildEvidenceAgentRequest({
      runId: f9RunId,
      selectedRequestId: f9RequestId,
      manifest: context.manifest,
      descriptor: createEvidenceAgentDescriptor(true),
      health: f9Health,
      structuredReport: context.structuredReport,
      bundle: context.bundle,
      inputs: context.inputs,
      locale: "zh-CN",
      taskKind: "explain_p99",
      question: "Explain the tie.",
      clientRequestId: "agent-client:p99-tie",
    });

    expect(prepared.request.snapshot_reference.evidence_scope.percentile_subject).toEqual({
      selection_semantics: "tie_no_single_request",
      selected_request_id: null,
      member_request_ids: [f9RequestId, "req-f9-tied"],
    });
  });

  it("rejects duplicate stable subjects at different Pointers", async () => {
    const context = createF9RunContext();
    const s1 = context.structuredReport.run_bound_evidence.nodes.find((node) => node.subsystem === "S1")!;
    const requestReference = s1.references.find((reference) => reference.artifact_id === "metrics")!;
    s1.references.push({ ...requestReference, json_pointer: "/system_summary/phase_fabric_contributions/0" });

    await expect(
      buildEvidenceAgentRequest({
        runId: f9RunId,
        selectedRequestId: f9RequestId,
        manifest: context.manifest,
        descriptor: createEvidenceAgentDescriptor(true),
        health: f9Health,
        structuredReport: context.structuredReport,
        bundle: context.bundle,
        inputs: context.inputs,
        locale: "zh-CN",
        taskKind: "explain_p99",
        question: "Explain.",
        clientRequestId: "agent-client:duplicate",
      }),
    ).rejects.toMatchObject({ code: "ambiguous_reference" });
  });
});

describe("F9 atomic claim and citation validation", () => {
  it("accepts an exact citation while retaining uint64 decimal text", async () => {
    const { prepared, descriptor } = await preparedRequest();
    const response = createCompletedAgentResponse(
      prepared.inputSnapshotDigest,
      prepared.request.client_request_id,
      firstCitation(prepared),
    );
    const result = validateEvidenceAgentResult(response, prepared, descriptor, {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: prepared.inputSnapshotDigest,
    });

    expect(result.state).toBe("available_draft");
    expect(result.response.claims[0].citations[0].value?.decimal).toBe("9007199254740993123");
  });

  it.each([
    [
      "missing_citation",
      (response: ReturnType<typeof createCompletedAgentResponse>) => (response.claims[0].citations = []),
    ],
    [
      "citation_identity_mismatch",
      (response: ReturnType<typeof createCompletedAgentResponse>) =>
        (response.claims[0].citations[0].run_id = "run-wrong"),
    ],
    [
      "citation_not_allowed",
      (response: ReturnType<typeof createCompletedAgentResponse>) =>
        (response.claims[0].citations[0].artifact_id = "wrong-artifact"),
    ],
    [
      "citation_not_allowed",
      (response: ReturnType<typeof createCompletedAgentResponse>) =>
        (response.claims[0].citations[0].schema_identity = "tilesim.wrong.v1"),
    ],
    [
      "citation_not_allowed",
      (response: ReturnType<typeof createCompletedAgentResponse>) =>
        (response.claims[0].citations[0].sha256 = "f".repeat(64)),
    ],
    [
      "citation_not_resolvable",
      (response: ReturnType<typeof createCompletedAgentResponse>) =>
        (response.claims[0].citations[0].json_pointer = "/request_metrics/99"),
    ],
    [
      "citation_not_resolvable",
      (response: ReturnType<typeof createCompletedAgentResponse>) =>
        (response.claims[0].citations[0].subject.id = "req-wrong-subject"),
    ],
    [
      "claim_scope_mismatch",
      (response: ReturnType<typeof createCompletedAgentResponse>) =>
        (response.claims[0].scope.source_mode = "real_trace"),
    ],
  ])("rejects %s without a fallback citation", async (code, mutate) => {
    const { prepared, descriptor } = await preparedRequest();
    const response = createCompletedAgentResponse(
      prepared.inputSnapshotDigest,
      prepared.request.client_request_id,
      firstCitation(prepared),
    );
    mutate(response);
    expect(() =>
      validateEvidenceAgentResult(response, prepared, descriptor, {
        runId: f9RunId,
        backendIdentity: evidenceAgentBackendIdentity(f9Health),
        schemaSetRevision: f9SchemaRevision,
        inputSnapshotDigest: prepared.inputSnapshotDigest,
      }),
    ).toThrowError(expect.objectContaining({ code }));
  });

  it.each([
    ["run", { runId: "run-new" }],
    ["backend", { backendIdentity: "different-backend" }],
    ["schema revision", { schemaSetRevision: `sha256:${"d".repeat(64)}` }],
    ["snapshot digest", { inputSnapshotDigest: `sha256:${"e".repeat(64)}` }],
  ])("hides a late response after a %s switch", async (_label, changedBinding) => {
    const { prepared, descriptor } = await preparedRequest();
    const response = createCompletedAgentResponse(
      prepared.inputSnapshotDigest,
      prepared.request.client_request_id,
      firstCitation(prepared),
    );
    const binding = {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: prepared.inputSnapshotDigest,
      ...changedBinding,
    };
    expect(validateEvidenceAgentResult(response, prepared, descriptor, binding).state).toBe("stale");
  });

  it("rejects invalid claims even when the response is stale", async () => {
    const { prepared, descriptor } = await preparedRequest();
    const response = createCompletedAgentResponse(
      prepared.inputSnapshotDigest,
      prepared.request.client_request_id,
      firstCitation(prepared),
    );
    response.staleness.state = "stale";
    response.claims[0].citations = [];

    expect(() =>
      validateEvidenceAgentResult(response, prepared, descriptor, {
        runId: f9RunId,
        backendIdentity: evidenceAgentBackendIdentity(f9Health),
        schemaSetRevision: f9SchemaRevision,
        inputSnapshotDigest: prepared.inputSnapshotDigest,
      }),
    ).toThrowError(expect.objectContaining({ code: "missing_citation" }));
  });

  it("rejects a terminal reason that contradicts its completion state", async () => {
    const { prepared, descriptor } = await preparedRequest();
    const response = createCompletedAgentResponse(
      prepared.inputSnapshotDigest,
      prepared.request.client_request_id,
      firstCitation(prepared),
    );
    response.completion_state = "failed";
    response.claims = [];
    response.refusal = { reason_code: "provider_unavailable", detail: "contradictory", retryable: false };

    expect(() =>
      validateEvidenceAgentResult(response, prepared, descriptor, {
        runId: f9RunId,
        backendIdentity: evidenceAgentBackendIdentity(f9Health),
        schemaSetRevision: f9SchemaRevision,
        inputSnapshotDigest: prepared.inputSnapshotDigest,
      }),
    ).toThrowError(expect.objectContaining({ code: "completion_state_invalid" }));
  });

  it.each([
    ["partial", "partial", true, false, null],
    ["truncated", "truncated", false, true, null],
    ["failed", "failed", false, false, "unsupported_schema"],
    ["timeout", "timeout", false, false, "timeout"],
    ["cancelled", "cancelled", false, false, "cancelled"],
    ["concurrency_limit", "refused", false, false, "concurrency_limit"],
  ] as const)(
    "maps %s without presenting it as complete",
    async (expected, completion, partial, truncated, refusal) => {
      const { prepared, descriptor } = await preparedRequest();
      const response = createCompletedAgentResponse(
        prepared.inputSnapshotDigest,
        prepared.request.client_request_id,
        firstCitation(prepared),
      );
      response.completion_state = completion;
      response.partial = partial;
      response.truncated = truncated;
      if (refusal) {
        response.claims = [];
        response.refusal = { reason_code: refusal, detail: refusal, retryable: refusal === "timeout" };
      }
      const result = validateEvidenceAgentResult(response, prepared, descriptor, {
        runId: f9RunId,
        backendIdentity: evidenceAgentBackendIdentity(f9Health),
        schemaSetRevision: f9SchemaRevision,
        inputSnapshotDigest: prepared.inputSnapshotDigest,
      });

      expect(result.state).toBe(expected);
      expect(result.state).not.toBe("available_draft");
    },
  );

  it("preserves zero and missing as different citation states", async () => {
    const { prepared, descriptor } = await preparedRequest();
    const response = createCompletedAgentResponse(prepared.inputSnapshotDigest, prepared.request.client_request_id, {
      ...firstCitation(prepared),
      availability: "available",
      value: { encoding: "decimal_string", numeric_kind: "uint64", decimal: "0" },
      unit: "count",
    });
    const zeroResult = validateEvidenceAgentResult(response, prepared, descriptor, {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: prepared.inputSnapshotDigest,
    });
    const missingResponse = structuredClone(response);
    missingResponse.claims[0].citations[0].availability = "missing";
    delete missingResponse.claims[0].citations[0].value;
    delete missingResponse.claims[0].citations[0].unit;
    const missingResult = validateEvidenceAgentResult(missingResponse, prepared, descriptor, {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: prepared.inputSnapshotDigest,
    });

    expect(zeroResult.response.claims[0].citations[0].value?.decimal).toBe("0");
    expect(missingResult.response.claims[0].citations[0].availability).toBe("missing");
    expect(missingResult.response.claims[0].citations[0].value).toBeUndefined();
  });

  it("rejects a numeric value attached to a non-available citation", async () => {
    const { prepared, descriptor } = await preparedRequest();
    const response = createCompletedAgentResponse(prepared.inputSnapshotDigest, prepared.request.client_request_id, {
      ...firstCitation(prepared),
      availability: "missing",
    });

    expect(() =>
      validateEvidenceAgentResult(response, prepared, descriptor, {
        runId: f9RunId,
        backendIdentity: evidenceAgentBackendIdentity(f9Health),
        schemaSetRevision: f9SchemaRevision,
        inputSnapshotDigest: prepared.inputSnapshotDigest,
      }),
    ).toThrowError(expect.objectContaining({ code: "citation_availability_value_mismatch" }));
  });
});

describe("F9 idempotency recovery store", () => {
  it("reuses only the same payload and rejects a different payload without rotating the key", () => {
    const store = useEvidenceAgentStore();
    const binding = {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: `sha256:${"a".repeat(64)}`,
    };
    const first = store.begin(binding, `sha256:${"b".repeat(64)}`, "agent-client:recovery");
    const replay = store.begin(binding, `sha256:${"b".repeat(64)}`, "agent-client:recovery");

    expect(replay.idempotencyKey).toBe(first.idempotencyKey);
    let mismatch: unknown;
    try {
      store.begin(binding, `sha256:${"c".repeat(64)}`, "agent-client:other");
    } catch (error) {
      mismatch = error;
    }
    expect(mismatch).toEqual(expect.objectContaining({ code: "idempotency_payload_mismatch" }));
    const failure = evidenceAgentFailure(mismatch);
    store.fail(failure.state, failure.code);
    expect(failure).toMatchObject({ state: "idempotency_payload_mismatch" });
    expect(store.pending?.idempotencyKey).toBe(first.idempotencyKey);
    expect(store.state).toBe("idempotency_payload_mismatch");
  });

  it("keeps a completed analysis on the same key until explicit discard", async () => {
    const { prepared, descriptor } = await preparedRequest();
    const binding = {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: prepared.inputSnapshotDigest,
    };
    const store = useEvidenceAgentStore();
    const pending = store.begin(binding, prepared.payloadDigest, prepared.request.client_request_id);
    const response = createCompletedAgentResponse(
      prepared.inputSnapshotDigest,
      prepared.request.client_request_id,
      firstCitation(prepared),
    );
    store.complete(validateEvidenceAgentResult(response, prepared, descriptor, binding), binding);

    expect(store.pending?.idempotencyKey).toBe(pending.idempotencyKey);
    store.synchronize({ ...binding, inputSnapshotDigest: "" });
    expect(store.state).toBe("stale");
    store.synchronize(binding);
    expect(store.state).toBe("available_draft");
    const replay = store.begin(binding, prepared.payloadDigest, prepared.request.client_request_id);
    expect(replay.idempotencyKey).toBe(pending.idempotencyKey);

    store.discardPending();
    const next = store.begin(binding, prepared.payloadDigest, prepared.request.client_request_id);
    expect(next.idempotencyKey).not.toBe(pending.idempotencyKey);
  });

  it("does not release a key after a non-retryable contract failure", () => {
    const store = useEvidenceAgentStore();
    const binding = {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: `sha256:${"a".repeat(64)}`,
    };
    const pending = store.begin(binding, `sha256:${"b".repeat(64)}`, "agent-client:contract-failure");
    const failure = evidenceAgentFailure(new Error("invalid terminal"));

    store.fail(failure.state, failure.code);

    expect(store.state).toBe("contract_error");
    expect(store.pending?.idempotencyKey).toBe(pending.idempotencyKey);
    expect(() => store.begin(binding, `sha256:${"c".repeat(64)}`, "agent-client:replacement")).toThrowError(
      expect.objectContaining({ code: "idempotency_payload_mismatch" }),
    );

    store.discardPending();
    const next = store.begin(binding, `sha256:${"c".repeat(64)}`, "agent-client:replacement");
    expect(next.idempotencyKey).not.toBe(pending.idempotencyKey);
  });

  it("ignores a discarded submission's late completion and failure after a replacement begins", async () => {
    const { prepared, descriptor } = await preparedRequest();
    const originalBinding = {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: prepared.inputSnapshotDigest,
    };
    const replacementBinding = { ...originalBinding, runId: "run-replacement" };
    const store = useEvidenceAgentStore();
    const original = store.begin(originalBinding, prepared.payloadDigest, prepared.request.client_request_id);
    const response = createCompletedAgentResponse(
      prepared.inputSnapshotDigest,
      prepared.request.client_request_id,
      firstCitation(prepared),
    );
    const lateResult = validateEvidenceAgentResult(response, prepared, descriptor, replacementBinding);

    store.synchronize(replacementBinding);
    expect(store.state).toBe("stale");
    store.discardPending();
    const replacement = store.begin(
      replacementBinding,
      `sha256:${"c".repeat(64)}`,
      "agent-client:replacement-after-discard",
    );

    expect(store.complete(lateResult, originalBinding, original.idempotencyKey)).toBe(false);
    expect(store.fail("contract_error", "late_failure", original.idempotencyKey)).toBe(false);
    expect(store.pending?.idempotencyKey).toBe(replacement.idempotencyKey);
    expect(store.state).toBe("submitting");
    expect(store.result).toBeNull();
  });

  it.each([
    ["run", { runId: "run-new" }],
    ["backend", { backendIdentity: "backend-new" }],
    ["schema revision", { schemaSetRevision: `sha256:${"d".repeat(64)}` }],
    ["snapshot digest", { inputSnapshotDigest: `sha256:${"e".repeat(64)}` }],
  ])("marks a pending analysis stale when the %s changes and keeps its key", (_label, changedBinding) => {
    const store = useEvidenceAgentStore();
    const binding = {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: `sha256:${"a".repeat(64)}`,
    };
    const pending = store.begin(binding, `sha256:${"b".repeat(64)}`, "agent-client:stale");
    const currentBinding = { ...binding, ...changedBinding };

    store.synchronize(currentBinding);

    expect(store.state).toBe("stale");
    expect(store.pending?.idempotencyKey).toBe(pending.idempotencyKey);
    expect(() => store.begin(currentBinding, `sha256:${"c".repeat(64)}`, "agent-client:stale-new")).toThrowError(
      expect.objectContaining({ code: "idempotency_payload_mismatch" }),
    );
    expect(store.pending?.idempotencyKey).toBe(pending.idempotencyKey);

    store.discardPending();
    const next = store.begin(currentBinding, `sha256:${"c".repeat(64)}`, "agent-client:stale-new");
    expect(next.idempotencyKey).not.toBe(pending.idempotencyKey);
  });

  it("preserves the original key after terminal_result_not_retained until explicit discard", () => {
    const store = useEvidenceAgentStore();
    const binding = {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: `sha256:${"a".repeat(64)}`,
    };
    const pending = store.begin(binding, `sha256:${"b".repeat(64)}`, "agent-client:retention-gap");
    const failure = evidenceAgentFailure(
      new BridgeApiError("not retained", {
        status: 409,
        code: "terminal_result_not_retained",
        retryable: false,
      }),
    );
    store.fail(failure.state, failure.code);

    expect(failure).toMatchObject({
      state: "terminal_result_not_retained",
    });
    expect(store.pending?.idempotencyKey).toBe(pending.idempotencyKey);
    expect(store.state).toBe("terminal_result_not_retained");

    store.discardPending();
    expect(store.pending).toBeNull();
    expect(store.state).toBe("idle");
  });

  it("preserves the original key after idempotency_payload_mismatch until explicit discard", () => {
    const store = useEvidenceAgentStore();
    const binding = {
      runId: f9RunId,
      backendIdentity: evidenceAgentBackendIdentity(f9Health),
      schemaSetRevision: f9SchemaRevision,
      inputSnapshotDigest: `sha256:${"a".repeat(64)}`,
    };
    const pending = store.begin(binding, `sha256:${"b".repeat(64)}`, "agent-client:payload-mismatch");
    const failure = evidenceAgentFailure(
      new BridgeApiError("mismatch", {
        status: 409,
        code: "idempotency_payload_mismatch",
        retryable: false,
      }),
    );
    store.fail(failure.state, failure.code);

    expect(failure).toMatchObject({
      state: "idempotency_payload_mismatch",
    });
    expect(store.pending?.idempotencyKey).toBe(pending.idempotencyKey);
    expect(store.state).toBe("idempotency_payload_mismatch");

    store.discardPending();
    expect(store.pending).toBeNull();
    expect(store.state).toBe("idle");
  });
});
