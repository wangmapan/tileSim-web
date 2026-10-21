import { describe, expect, it } from "vitest";
import {
  AGENT_HARNESS_SCHEMA_IDENTITIES,
  approvalFreshness,
  createAgentHarnessFixtureAdapter,
  projectWorkflowEvents,
  staleReasonForBinding,
  type WorkflowEvent,
} from "../../src/entities/agent-orchestration";
import manifest from "../fixtures/agent-harness/phase0-evaluation-manifest.json";

const meta = {
  schema_identity: AGENT_HARNESS_SCHEMA_IDENTITIES.workflow_event,
  contract_revision: "2026-10-17.wpa.v0" as const,
  publication_status: "proposal_non_published" as const,
  operation_id: "op-fixture",
  turn_id: null,
  run_id: null,
  snapshot_digest: null,
  schema_set_revision: null,
  policy_revision: "policy-fixture-v0",
};

function event(
  sequence: number,
  state: WorkflowEvent["state"],
  eventId = `event-${sequence}`,
  transition_kind: WorkflowEvent["transition_kind"] = "normal",
): WorkflowEvent {
  return {
    ...meta,
    event_id: eventId,
    sequence,
    event_kind: state === "running" ? "started" : state,
    state,
    transition_kind,
    occurred_at: `2026-10-17T00:00:0${sequence}Z`,
    payload_digest: `sha256:${String(sequence).padStart(64, "0")}`,
    dedupe_key: `op-fixture:${sequence}`,
    idempotency_key: "agent-harness:fixture",
    producer_revision: "fixture-producer-v0",
  } as WorkflowEvent;
}

describe("Agent Harness proposal contract", () => {
  it("keeps the ten proposed object identities plus the error envelope outside the Bridge schema set", () => {
    expect(Object.keys(AGENT_HARNESS_SCHEMA_IDENTITIES)).toHaveLength(11);
    expect(Object.values(AGENT_HARNESS_SCHEMA_IDENTITIES).every((identity) => identity.endsWith(".v0"))).toBe(true);
    expect(manifest.publication_status).toBe("proposal_non_published");
    expect(manifest.agent_harness_schema_set_scope).toBe("not_in_bridge_schema_set");
  });

  it("keeps evaluation splits disjoint and covers every Phase 0 failure class", () => {
    const splitEntries = Object.entries(manifest.splits).flatMap(([split, ids]) => ids.map((id) => ({ id, split })));
    expect(new Set(splitEntries.map((entry) => entry.id)).size).toBe(splitEntries.length);
    expect(manifest.cases).toHaveLength(19);
    expect(new Set(manifest.cases.map((entry) => entry.id))).toEqual(new Set(splitEntries.map((entry) => entry.id)));
    expect(manifest.cases.filter((entry) => entry.split === "held-out-adversarial")).toHaveLength(4);
    expect(manifest.cases.every((entry) => entry.side_effects === 0)).toBe(true);
  });

  it("deduplicates at-least-once events and reaches completed", () => {
    const projection = projectWorkflowEvents([
      event(1, "submitted"),
      event(2, "queued"),
      event(2, "queued", "event-2-duplicate"),
      event(3, "running"),
      event(4, "completed"),
    ]);
    expect(projection.state).toBe("completed");
    expect(projection.accepted_events.map((item) => item.sequence)).toEqual([1, 2, 3, 4]);
    expect(projection.duplicate_event_ids).toEqual([]);
    expect(projection.rejected_event_ids).toContain("event-2-duplicate");
  });

  it("does not let a cancelled operation be overwritten by a late result", () => {
    const projection = projectWorkflowEvents([
      event(1, "submitted"),
      event(2, "queued"),
      event(3, "running"),
      event(4, "cancelled", "event-4", "cancel"),
      event(5, "completed"),
    ]);
    expect(projection.state).toBe("cancelled");
    expect(projection.late_event_ids).toEqual(["event-5"]);
    expect(projection.requires_recovery).toBe(false);
  });

  it("fails closed when a duplicate event id carries a different payload digest", () => {
    const conflicting = event(2, "queued", "event-2");
    conflicting.payload_digest = "sha256:conflicting";
    const projection = projectWorkflowEvents([event(1, "submitted"), event(2, "queued"), conflicting]);
    expect(projection.state).toBe("recovery_required");
    expect(projection.rejected_event_ids).toContain("event-2");
    expect(projection.sequence_conflict).toBe(true);
  });

  it("requires recovery for an out-of-order sequence and never rewinds a terminal state", () => {
    const outOfOrder = projectWorkflowEvents([event(1, "submitted"), event(3, "running"), event(2, "queued")]);
    expect(outOfOrder.state).toBe("recovery_required");
    expect(outOfOrder.out_of_order_event_ids).toEqual(["event-2"]);

    const terminal = projectWorkflowEvents([
      event(1, "submitted"),
      event(2, "queued"),
      event(3, "running"),
      event(4, "completed"),
      event(5, "running"),
    ]);
    expect(terminal.state).toBe("completed");
    expect(terminal.rejected_event_ids).toContain("event-5");
  });

  it("marks approvals stale or expired without creating a run", () => {
    const current = { draft_digest: "sha256:draft", policy_revision: "policy-v2" };
    expect(
      approvalFreshness(
        {
          state: "approved",
          expires_at: "2026-10-18T00:00:00Z",
          draft_digest: "sha256:draft",
          policy_revision: "policy-v2",
        },
        current,
        new Date("2026-10-17T00:00:00Z"),
      ),
    ).toBe("approved");
    expect(
      approvalFreshness(
        {
          state: "approved",
          expires_at: "2026-10-16T00:00:00Z",
          draft_digest: "sha256:draft",
          policy_revision: "policy-v2",
        },
        current,
        new Date("2026-10-17T00:00:00Z"),
      ),
    ).toBe("expired");
    expect(
      approvalFreshness(
        {
          state: "approved",
          expires_at: "2026-10-18T00:00:00Z",
          draft_digest: "sha256:old",
          policy_revision: "policy-v2",
        },
        current,
        new Date("2026-10-17T00:00:00Z"),
      ),
    ).toBe("stale");
    expect(
      staleReasonForBinding(
        {
          schema_set_revision: "schema-a",
          run_id: "run-a",
          snapshot_digest: "snap-a",
          policy_revision: "policy-a",
          workflow_revision: "workflow-a",
        },
        {
          schema_set_revision: "schema-b",
          run_id: "run-a",
          snapshot_digest: "snap-a",
          policy_revision: "policy-a",
          workflow_revision: "workflow-a",
        },
      ),
    ).toBe("schema_revision_changed");
  });

  it("keeps the fixture adapter read-only and marks an unknown operation not exposed", () => {
    const adapter = createAgentHarnessFixtureAdapter({
      source: "fixture",
      publication_status: "proposal_non_published",
      operations: [],
      events: [],
    });
    const projection = adapter.projectOperation("missing-operation");
    expect(projection.availability).toBe("not_exposed");
    expect(projection.operation_id).toBeNull();
    expect(Object.keys(adapter)).toEqual(["getOperation", "projectOperation", "projectEvents"]);
  });
});
