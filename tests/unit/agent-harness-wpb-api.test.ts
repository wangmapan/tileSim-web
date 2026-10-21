import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_HARNESS_API_VERSION,
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
  createAgentHarnessDraft,
  createAgentHarnessDraftApproval,
  deleteAgentHarnessDraft,
  getAgentHarnessDraft,
  rejectAgentHarnessDraftApproval,
  validateAgentHarnessDraft,
} from "../../src/lib/api/agent-harness";
import { agentHarnessPaths, GeneratedAgentHarnessClient } from "../../src/contracts/generated/agent-harness";

const digest = (letter: string) => `sha256:${letter.repeat(64)}`;
const backend = { source_revision: "backend-test", build_revision: "build-test" };
const headers = {
  "content-type": "application/json",
  "x-tilesim-api-version": AGENT_HARNESS_API_VERSION,
  "x-tilesim-schema-set-revision": AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
};

function draft() {
  return {
    schema_identity: "tilesim.agent_harness.experiment_draft.v2",
    contract_revision: "2026-10-18.wpb.v1",
    draft_id: "draft-test",
    operation_id: "draft-op-test",
    principal: "local-user",
    workspace_id: "local-workspace",
    run_scope: "draft-only",
    input_snapshot_digest: digest("a"),
    schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
    backend_identity: backend,
    parameter_catalog_revision: "catalog-v1",
    validator_revision: "validator-v1",
    policy_revision: "tilesim.agent_harness.policy.v1",
    field_diffs: [{ field_id: "fidelity_policy", json_pointer: "/fidelity_policy", change: "replace" }],
    assumptions: ["No run is created in WP-B."],
    evidence_refs: ["baseline:catalog"],
    budget_request: { max_total_ms: 10 },
    risk_flags: ["manual_review"],
    status: "draft",
    created_at: "2026-10-18T00:00:00Z",
    expires_at: "2026-10-19T00:00:00Z",
    draft_digest: digest("b"),
    idempotency_key: "draft-key",
    would_create_run: false,
    create_run_request_digest: digest("c"),
  };
}

function validation() {
  return {
    schema_identity: "tilesim.agent_harness.draft_validation_report.v1",
    contract_revision: "2026-10-18.wpb.v1",
    draft_id: "draft-test",
    draft_digest: digest("b"),
    validation_id: "validation-test",
    principal: "local-user",
    workspace_id: "local-workspace",
    input_snapshot_digest: digest("a"),
    validator_revision: "validator-v1",
    schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
    backend_identity: backend,
    policy_revision: "tilesim.agent_harness.policy.v1",
    status: "valid",
    issues: [],
    field_results: [],
    unsupported_fields: [],
    stale_reasons: [],
    budget_estimate: {},
    risk_flags: [],
    would_create_run: false,
    validated_create_run_request_digest: digest("d"),
    created_at: "2026-10-18T00:00:01Z",
  };
}

function approval() {
  return {
    schema_identity: "tilesim.agent_harness.approval.v2",
    contract_revision: "2026-10-18.wpb.v1",
    approval_id: "approval-test",
    draft_id: "draft-test",
    draft_digest: digest("b"),
    validation_id: "validation-test",
    principal: "local-user",
    workspace_id: "local-workspace",
    policy_revision: "tilesim.agent_harness.policy.v1",
    schema_set_revision: AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
    backend_identity: backend,
    status: "approved",
    created_at: "2026-10-18T00:00:02Z",
    expires_at: "2026-10-19T00:00:00Z",
    approved_at: "2026-10-18T00:00:02Z",
    rejected_at: null,
    revoked_at: null,
    reason: null,
    approval_digest: digest("e"),
    single_use: true,
    consumed: false,
  };
}

function jsonResponse(payload: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { ...headers, ...extra } });
}

describe("Agent Harness WP-B draft/validation/approval adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("window", { location: { port: "5173" } });
  });

  it("uses the published draft endpoint and preserves run-free semantics", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ draft: draft(), would_create_run: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createAgentHarnessDraft({ workspace_id: "local-workspace" }, { idempotencyKey: "draft-key" }),
    ).resolves.toMatchObject({
      draft_id: "draft-test",
      would_create_run: false,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/agent/drafts", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/drafts",
      expect.objectContaining({
        headers: expect.objectContaining({ "Idempotency-Key": "draft-key" }),
      }),
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/runs"))).toBe(false);
  });

  it("fails closed when a draft response advertises a run side effect", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ draft: { ...draft(), would_create_run: true }, would_create_run: false })),
    );
    await expect(getAgentHarnessDraft("draft-test")).rejects.toMatchObject({ code: "unsafe_run_capability" });
  });

  it("validates the draft binding before accepting a validation report", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ draft: draft(), would_create_run: false }))
      .mockResolvedValueOnce(jsonResponse({ validation: validation(), would_create_run: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      validateAgentHarnessDraft(
        "draft-test",
        { create_run_request: { scenario_id: "s1" } },
        { idempotencyKey: "validate-key" },
      ),
    ).resolves.toMatchObject({ status: "valid" });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/agent/drafts/draft-test/validate");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
  });

  it("accepts approval only on the formal approval endpoint and supports rejection", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ draft: draft(), would_create_run: false }))
      .mockResolvedValueOnce(jsonResponse({ approval: approval(), would_create_run: false }))
      .mockResolvedValueOnce(
        jsonResponse({
          approval: { ...approval(), status: "rejected", rejected_at: "2026-10-18T00:00:03Z" },
          would_create_run: false,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createAgentHarnessDraftApproval(
        "draft-test",
        { validation_id: "validation-test", expires_at: "2026-10-19T00:00:00Z" },
        { idempotencyKey: "approval-key" },
      ),
    ).resolves.toMatchObject({ approval_id: "approval-test" });
    await expect(
      rejectAgentHarnessDraftApproval("draft-test", "approval-test", "manual review", { idempotencyKey: "reject-key" }),
    ).resolves.toMatchObject({ status: "rejected" });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/agent/drafts/draft-test/approvals");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/agent/drafts/draft-test/approvals/approval-test/reject");
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/api/runs"))).toBe(true);
  });

  it("accepts only the successor schema-set revision", async () => {
    const staleHeaders = { ...headers, "x-tilesim-schema-set-revision": "sha256:" + "0".repeat(64) };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ draft: draft(), would_create_run: false }, 200, staleHeaders)),
    );
    await expect(getAgentHarnessDraft("draft-test")).rejects.toMatchObject({
      code: "schema_revision_mismatch",
      fieldPath: "/schema_set_revision",
    });
  });

  it("fails closed on backend, snapshot and draft digest bindings", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ draft: draft(), would_create_run: false })));
    await expect(
      getAgentHarnessDraft("draft-test", { backend_identity: { source_revision: "other" } }),
    ).rejects.toMatchObject({ code: "backend_identity_mismatch" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ draft: draft(), would_create_run: false })));
    await expect(getAgentHarnessDraft("draft-test", { input_snapshot_digest: digest("z") })).rejects.toMatchObject({
      code: "snapshot_mismatch",
    });
    const mismatchedValidation = { ...validation(), draft_digest: digest("z") };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ validation: mismatchedValidation, would_create_run: false })),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ draft: draft(), would_create_run: false }))
      .mockResolvedValueOnce(jsonResponse({ validation: mismatchedValidation, would_create_run: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      validateAgentHarnessDraft("draft-test", {}, { idempotencyKey: "validate-digest" }),
    ).rejects.toMatchObject({ code: "draft_binding_mismatch" });
  });

  it("rejects unknown request fields instead of silently dropping them", async () => {
    await expect(
      createAgentHarnessDraft({ poison: "x" } as never, { idempotencyKey: "draft-poison" }),
    ).rejects.toMatchObject({ code: "unknown_field", fieldPath: "/poison" });
  });

  it("deletes a draft through the idempotent DELETE endpoint without run deletion", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ draft_id: "draft-test", deleted: true, would_create_run: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deleteAgentHarnessDraft("draft-test", "delete-key")).resolves.toMatchObject({ deleted: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent/drafts/draft-test",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { "Idempotency-Key": "delete-key" } });
  });

  it("keeps the draft SSE path generated from OpenAPI", () => {
    const client = new GeneratedAgentHarnessClient({ request: vi.fn() });
    expect(client.draftEventStream("draft/test")).toBe(agentHarnessPaths.draftEventStream("draft/test"));
    expect(client.draftEventStream("draft/test")).toContain("/agent/drafts/draft%2Ftest/events/stream");
  });
});
