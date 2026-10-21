import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import proposalSchema from "../../docs/contracts/proposals/agent-harness/agent-harness-envelope.schema.proposal.json";

const baseOperation = {
  schema_identity: "tilesim.agent_harness.agent_operation.v0",
  contract_revision: "2026-10-17.wpa.v0",
  publication_status: "proposal_non_published",
  operation_id: "op-schema-test",
  turn_id: null,
  run_id: null,
  snapshot_digest: null,
  schema_set_revision: null,
  policy_revision: "policy-v0",
  state: "draft",
  state_revision: 0,
  workflow_revision: "workflow-v0",
  model_revision: null,
  idempotency_key: "agent-harness:schema-test",
  created_at: "2026-10-17T00:00:00Z",
  updated_at: "2026-10-17T00:00:00Z",
  terminal_at: null,
  outcome: null,
  cancellation_fence: null,
  source: "fixture",
  availability: "not_exposed",
  retention: {
    retention_class: "short_lived",
    expires_at: null,
    delete_state: "not_requested",
    delete_semantics: "not_exposed",
    forbidden_payloads: ["credential", "hidden_reasoning", "provider_raw_response", "unshown_evidence_payload"],
  },
};

describe("Agent Harness proposal schema", () => {
  it("validates a proposal envelope without adding it to the Bridge schema set", () => {
    const validate = new Ajv2020({ strict: false, validateFormats: false }).compile(proposalSchema);
    expect(validate(baseOperation)).toBe(true);
    expect(validate({ ...baseOperation, schema_identity: "tilesim.bridge.create_run_request.v1" })).toBe(false);
  });
});
