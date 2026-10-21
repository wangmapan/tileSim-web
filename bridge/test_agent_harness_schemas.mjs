import Ajv2020 from "ajv/dist/2020.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "bridge/contracts/schemas/agent-harness");
const ajv = new Ajv2020({ allErrors: true, strict: false });
const files = [
  "common",
  "agent-operation",
  "agent-turn",
  "workflow-event",
  "checkpoint",
  "tool-call",
  "tool-result",
  "experiment-draft",
  "approval",
  "experiment-draft-v2",
  "draft-validation-report",
  "approval-v2",
  "execution-request",
  "execution-operation",
  "execution-event",
  "execution-result-reference",
  "execution-mutation-request",
  "study",
  "candidate",
  "error",
];
for (const file of files) {
  const value = JSON.parse(await readFile(resolve(root, `${file}.schema.json`), "utf8"));
  ajv.addSchema(value);
}
for (const file of files.slice(1, -1)) {
  const schema = JSON.parse(await readFile(resolve(root, `${file}.schema.json`), "utf8"));
  if (!ajv.getSchema(schema.$id)) throw new Error(`missing compiled schema ${schema.$id}`);
}
const common = {
  contract_revision: "2026-10-17.wpa.v1",
  operation_id: "op-test",
  turn_id: "turn-test",
  run_id: null,
  snapshot_digest: null,
  workflow_state: "queued",
  schema_set_revision: "sha256:test",
  policy_revision: "tilesim.agent_harness.policy.v1",
  backend_identity: { source_revision: "test" },
  created_at: "2026-10-17T00:00:00Z",
  updated_at: "2026-10-17T00:00:00Z",
};
const valid = {
  ...common,
  schema_identity: "tilesim.agent_harness.agent_operation.v1",
  idempotency_key: "idem",
  request_digest: "sha256:x",
  principal: "local-user",
  operation_kind: "read_only",
  queue_delay_ms: 0,
  attempt_count: 0,
  checkpoint_id: null,
  last_error: null,
  cancellation_fence: null,
  lease: {},
  retention: {},
};
if (!ajv.getSchema("tilesim.agent_harness.agent_operation.v1")(valid)) throw new Error("valid operation rejected");
const invalid = { ...valid, untrusted_raw_provider_response: "forbidden" };
if (ajv.getSchema("tilesim.agent_harness.agent_operation.v1")(invalid)) throw new Error("unknown field accepted");
const executionRequest = {
  schema_identity: "tilesim.agent_harness.execution_request.v1",
  contract_revision: "2026-10-18.wpc.v1",
  draft_id: "draft-test",
  approval_id: "approval-test",
  validation_id: "validation-test",
  draft_digest: "sha256:" + "a".repeat(64),
  approval_digest: "sha256:" + "b".repeat(64),
  input_snapshot_digest: "sha256:" + "c".repeat(64),
  schema_set_revision: "sha256:" + "d".repeat(64),
  backend_identity: { source_revision: "test" },
  policy_revision: "tilesim.agent_harness.policy.v1",
  workflow_revision: "2026-10-18.wpc.v1",
  create_run_request: { scenario_id: "s1_des_example" },
  create_run_request_digest: "sha256:" + "e".repeat(64),
  idempotency_key: "execution-test",
};
if (!ajv.getSchema("tilesim.agent_harness.execution_request.v1")(executionRequest))
  throw new Error("valid execution request rejected");
if (ajv.getSchema("tilesim.agent_harness.execution_request.v1")({ ...executionRequest, credential: "forbidden" }))
  throw new Error("execution unknown field accepted");
console.log("Agent Harness schema contract passed");
