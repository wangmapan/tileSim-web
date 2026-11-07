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
  "optimization-session",
  "optimization-authorization-request",
  "optimization-authorization",
  "optimization-authorization-response",
  "exploration-provenance",
  "exploration-budget",
  "exploration-objective",
  "exploration-parameter-grant",
  "exploration-session",
  "exploration-candidate",
  "exploration-iteration",
  "exploration-evaluation",
  "exploration-checkpoint",
  "exploration-summary",
  "exploration-event",
  "exploration-stop-reason",
  "exploration-authorization-request",
  "exploration-authorization",
  "exploration-authorization-response",
  "exploration-model-context",
  "exploration-model-candidate",
];
for (const file of files) {
  const value = JSON.parse(await readFile(resolve(root, `${file}.schema.json`), "utf8"));
  ajv.addSchema(value);
  ajv.addSchema(value, `${file}.schema.json`);
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
const authBudget = {
  max_rounds: 5,
  max_runs: 5,
  max_seconds: 900,
  max_failures: 2,
  max_model_calls: 24,
  max_tool_calls_per_round: 4,
  max_navigation_attempts: 4,
  max_run_creations: 1,
  max_execution_time_ms: 900000,
};
const auth = {
  schema_identity: "tilesim.agent_harness.optimization_authorization.v1",
  contract_revision: "2026-10-28.wpf.v1",
  authorization_id: "authz-schema-test",
  session_id: "opt-schema-test",
  principal: "local-user",
  workspace_id: "local",
  schema_set_revision: "sha256:" + "a".repeat(64),
  backend_identity: { source_revision: "test" },
  input_snapshot_digest: "sha256:" + "b".repeat(64),
  autonomy_level: "bounded_autonomous",
  budget: authBudget,
  parameter_grants: [],
  objective: { metric_path: "/metrics/p95_ps", direction: "minimize", minimum_improvement: 0, plateau_rounds: 3 },
  tool_allowlist: ["query_verified_metrics"],
  allowed_pages: ["overview"],
  allowed_actions: ["analyze"],
  protected: {
    source_mode: "synthetic_trace",
    claim_scope: "exploratory",
    schema_set_revision: "sha256:" + "a".repeat(64),
    backend_identity: { source_revision: "test" },
  },
  status: "active",
  issued_by: "local-user",
  issued_at: "2026-10-28T00:00:00Z",
  expires_at: "2026-10-28T01:00:00Z",
  revoked_at: null,
  provenance: {
    deployment_mode: "local_dev",
    source_mode: "synthetic_trace",
    claim_scope: "exploratory",
    production_status: "not_for_production",
  },
  authorization_digest: "sha256:" + "c".repeat(64),
};
if (!ajv.getSchema("tilesim.agent_harness.optimization_authorization.v1")(auth))
  throw new Error("valid authorization envelope rejected: " + JSON.stringify(ajv.getSchema("tilesim.agent_harness.optimization_authorization.v1").errors));
if (ajv.getSchema("tilesim.agent_harness.optimization_authorization.v1")({ ...auth, untrusted_raw_provider_response: true }))
  throw new Error("authorization unknown field accepted");
if (ajv.getSchema("tilesim.agent_harness.optimization_authorization.v1")({ ...auth, budget: { ...authBudget, max_model_calls: 0 } }))
  throw new Error("zero model-call budget accepted");

const explorationBudget = {
  max_rounds: 10,
  max_runs: 10,
  max_concurrency: 1,
  max_no_improvement: 3,
  max_failures: 2,
  max_execution_time_ms: 900000,
  max_model_calls: 24,
  max_tool_calls_per_round: 4,
};
const explorationProvenance = {
  deployment_mode: "local_dev",
  source_mode: "synthetic_trace",
  claim_scope: "exploratory",
  production_status: "not_for_production",
};
const explorationContext = {
  context_revision: "ctx-1",
  input_snapshot_digest: "sha256:" + "b".repeat(64),
  schema_set_revision: "sha256:" + "a".repeat(64),
  backend_identity: { source_revision: "test" },
  parameter_catalog_revision: "catalog-1",
};
const explorationGrant = { pointer: "/request_count", min: 1, max: 32, step: 1, kind: "int" };
const explorationObjective = { metric_path: "/metrics/p95", direction: "minimize", minimum_improvement: 0, plateau_rounds: 3 };
const explorationSession = {
  schema_identity: "tilesim.agent_harness.exploration_session.v2",
  contract_revision: "2026-10-29.wpg.v2",
  session_id: "explore-schema-test",
  task_type: "explore_experiment",
  principal: "local-user",
  workspace_id: "local",
  run_id: null,
  context_revision: explorationContext.context_revision,
  run_context_revision: null,
  input_snapshot_digest: explorationContext.input_snapshot_digest,
  schema_set_revision: explorationContext.schema_set_revision,
  backend_identity: explorationContext.backend_identity,
  parameter_catalog_revision: explorationContext.parameter_catalog_revision,
  base_config: { request_count: 8, batch_size: 2 },
  policy_revision: "tilesim.agent_harness.serial_exploration.policy.v2",
  objective: explorationObjective,
  parameter_grants: [explorationGrant],
  budget: explorationBudget,
  allowed_pages: ["experiment", "execution", "metrics"],
  allowed_actions: ["navigate", "analyze", "execute", "report"],
  state: "waiting_authorization",
  current_page_id: "experiment",
  current_round: 0,
  run_count: 0,
  failure_count: 0,
  no_improvement_count: 0,
  active_run_id: null,
  best_candidate_id: null,
  authorization_id: null,
  authorization_digest: null,
  context_lock: { page_ids: ["experiment", "execution", "metrics"], context_revision: "ctx-1", input_snapshot_digest: explorationContext.input_snapshot_digest, locked: true },
  local_dev: true,
  automatic_submission: true,
  provenance: explorationProvenance,
  stop_reason: null,
  created_at: "2026-10-29T00:00:00Z",
  updated_at: "2026-10-29T00:00:00Z",
};
if (!ajv.getSchema("tilesim.agent_harness.exploration_session.v2")(explorationSession))
  throw new Error("valid exploration session rejected: " + JSON.stringify(ajv.getSchema("tilesim.agent_harness.exploration_session.v2").errors));
if (ajv.getSchema("tilesim.agent_harness.exploration_session.v2")({ ...explorationSession, automatic_submission: false }))
  throw new Error("exploration session accepted manual automatic_submission semantics");
if (ajv.getSchema("tilesim.agent_harness.exploration_budget.v2")({ ...explorationBudget, max_concurrency: 2 }))
  throw new Error("parallel exploration budget accepted");
if (ajv.getSchema("tilesim.agent_harness.exploration_session.v2")({ ...explorationSession, allowed_pages: ["https://evil.invalid"] }))
  throw new Error("unpublished exploration page accepted");
if (ajv.getSchema("tilesim.agent_harness.exploration_session.v2")({ ...explorationSession, allowed_actions: ["open_url"] }))
  throw new Error("unpublished exploration action accepted");
console.log("Agent Harness schema contract passed");
