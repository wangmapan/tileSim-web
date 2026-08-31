import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const bridgeRoot = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.dirname(bridgeRoot);
const schemaRoot = path.join(bridgeRoot, "contracts", "schemas");
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const schemaNames = [
  "f6b-common.schema.json",
  "evidence-agent-citation.schema.json",
  "evidence-agent-request.schema.json",
  "evidence-agent-response.schema.json",
  "evidence-agent-descriptor.schema.json",
  "api-manifest.schema.json",
];
const schemas = schemaNames.map((name) => readJson(path.join(schemaRoot, name)));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
ajv.addKeyword({ keyword: "x-tilesim-schema-identity", schemaType: "string" });
ajv.addKeyword({ keyword: "x-tilesim-lossless-json-integer", schemaType: "string" });
ajv.addKeyword({ keyword: "tsType", schemaType: "string" });
ajv.addFormat("date-time", true);
for (const schema of schemas) ajv.addSchema(schema);

const validator = (name) => ajv.getSchema(`https://tilesim.local/contracts/${name}`);
const expectValid = (validate, value) => assert.equal(validate(value), true, JSON.stringify(validate.errors));
const expectInvalid = (validate, value) => assert.equal(validate(value), false, "Expected validation failure");

const python = process.env.PYTHON || "python";
const runtime = spawnSync(
  python,
  [
    "-c",
    [
      "import json,server",
      "d=server.evidence_agent.build_descriptor(server.SCHEMA_SET_REVISION)",
      "m=server.api_manifest()",
      "print(json.dumps({'descriptor':d,'manifest':m}))",
    ].join(";"),
  ],
  { cwd: bridgeRoot, encoding: "utf8" },
);
assert.equal(runtime.status, 0, runtime.stderr);
const generated = JSON.parse(runtime.stdout);
expectValid(validator("evidence-agent-descriptor.schema.json"), generated.descriptor);
expectValid(validator("api-manifest.schema.json"), generated.manifest);
assert.equal(generated.descriptor.availability, "unavailable");
assert.equal(generated.descriptor.degradation.reason_code, "provider_unavailable");
assert.equal(generated.descriptor.provider.configured, false);
assert.equal(generated.descriptor.digest_contract.canonicalization, "tilesim.bridge.canonical_json.v1");
assert.deepEqual(generated.descriptor.digest_contract.input_snapshot_material_fields, [
  "schema_version",
  "schema_set_revision",
  "run_id",
  "structured_report_schema_identity",
  "snapshot_reference",
  "artifact_allow_list",
]);

const revision = `sha256:${"1".repeat(64)}`;
const request = {
  schema_version: "tilesim.bridge.evidence_agent_request.v1",
  schema_set_revision: revision,
  run_id: "run-f9-schema",
  input_snapshot_digest: `sha256:${"2".repeat(64)}`,
  structured_report_schema_identity: "tilesim.web.structured-performance-report.v2",
  snapshot_reference: {
    schema_version: "tilesim.bridge.evidence_snapshot_reference.v1",
    artifact_manifest_schema_identity: "tilesim.bridge.artifact_manifest.v2",
    artifact_manifest_canonical_sha256: `sha256:${"3".repeat(64)}`,
    backend_identity: {
      source_revision: "source-revision",
      build_revision: "build-revision",
      source_state_digest: "source-state",
      build_state_digest: "build-state",
      versions_match: true,
      state_digests_match: true,
    },
    evidence_scope: {
      source_mode: "synthetic_trace",
      calibration_level: "uncalibrated",
      allowed_claim_scope: "synthetic_consistency_only",
      claim_scope_class: "synthetic_consistency",
      requested_fidelity: "des",
      resolved_fidelity: "des",
      execution_mode: "partitioned_des",
      canonical_flow: "S0 -> S1 -> S2 -> {S3,S4,S5} -> S6",
      resource_semantics_relation: "S3_S4_S5_peer",
      execution_host: "S7",
      validation_plane: "S8",
      output_plane: "S9",
      percentile_subject: {
        selection_semantics: "tie_no_single_request",
        selected_request_id: null,
        member_request_ids: ["request-a", "request-b"],
      },
      availability_states_present: [
        "available",
        "missing",
        "expected_absence",
        "not_covered",
        "unsupported_schema",
        "not_applicable",
      ],
    },
  },
  artifact_allow_list: [
    {
      run_id: "run-f9-schema",
      artifact_id: "week8-run-evidence",
      schema_identity: "tilesim.s7_run_bound_des_evidence.v1",
      sha256: "4".repeat(64),
      bytes: 9007199254740992,
      allowed_records: [{ json_pointer: "/stages/0", subject: { kind: "stage", id: "stage-a" } }],
    },
  ],
  locale: "zh-CN",
  task_kind: "explain_p99",
  client_request_id: "client-f9-schema",
  user_question: { content: "解释尾延迟。", trust_level: "untrusted_user_content" },
};
expectValid(validator("evidence-agent-request.schema.json"), request);
const unsafeRequest = structuredClone(request);
unsafeRequest.file_path = "D:/secret";
expectInvalid(validator("evidence-agent-request.schema.json"), unsafeRequest);

const response = {
  schema_version: "tilesim.bridge.evidence_agent_response.v1",
  schema_set_revision: revision,
  request_id: "agent-abcdef",
  client_request_id: request.client_request_id,
  run_id: request.run_id,
  input_snapshot_digest: request.input_snapshot_digest,
  completion_state: "refused",
  provider: {
    configured: false,
    provider_id: "not_configured",
    model_id: "not_configured",
    model_revision: "not_configured",
  },
  revisions: {
    prompt_template_revision: "tilesim.evidence_agent.prompt_template.v1",
    policy_revision: "tilesim.evidence_agent.read_only_policy.v1",
  },
  claims: [],
  refusal: { reason_code: "provider_unavailable", detail: "No production provider.", retryable: false },
  partial: false,
  truncated: false,
  degradation: { state: "unavailable", reason_code: "provider_unavailable" },
  audit_summary: {
    operations: ["verified_snapshot_read", "citation_resolution"],
    tool_invocation_count: 0,
    hidden_reasoning_returned: false,
  },
  generated_at: "2026-08-31T00:00:00Z",
  persistence: {
    mode: "run_local_terminal_metadata_only",
    retained_until: null,
    snapshot_payload_retained: false,
    user_question_retained: false,
  },
  staleness: {
    state: "current_at_generation",
    binding_fields: ["run_id", "input_snapshot_digest", "schema_set_revision", "backend_identity"],
  },
};
expectValid(validator("evidence-agent-response.schema.json"), response);
const answerLevelCitations = structuredClone(response);
answerLevelCitations.citations = [];
expectInvalid(validator("evidence-agent-response.schema.json"), answerLevelCitations);

const openapi = readJson(path.join(bridgeRoot, "contracts", "openapi.json"));
assert.equal(openapi.paths["/agent/evidence-capabilities"].get.operationId, "evidenceAgentCapabilities");
assert.equal(openapi.paths["/runs/{run_id}/agent/evidence-analyses"].post.operationId, "createEvidenceAnalysis");
assert.equal(openapi["x-tilesim-contract"].evidence_agent.execution_mode, "synchronous_terminal");

const catalog = readJson(path.join(webRoot, "tests", "fixtures", "f9-agent-evaluation-cases.json"));
const expectedCaseIds = new Set([
  "valid-cited-numeric-fact",
  "valid-reported-attribution",
  "valid-conditional-recommendation",
  "missing-citation",
  "dangling-json-pointer",
  "wrong-json-pointer-subject",
  "wrong-sha256",
  "wrong-run-id",
  "wrong-schema-identity",
  "duplicate-stable-id",
  "stale-schema-set-revision",
  "unsupported-response-schema",
  "legacy-compatibility-input",
  "p99-single-request",
  "p99-tie-no-single-request",
  "p99-not-applicable",
  "availability-zero-vs-missing",
  "availability-six-way-distinction",
  "uint64-over-max-safe-integer",
  "s3-s4-s5-peer-semantics",
  "reject-fake-s3-s4-s5-chain",
  "reject-s7-s9-causal-ranking",
  "synthetic-to-real-promotion",
  "compatibility-to-held-out-promotion",
  "requested-resolved-fidelity-confusion",
  "des-to-cycle-promotion",
  "cross-run-evidence-leakage",
  "stale-async-result",
  "backend-identity-change",
  "prompt-injection-in-report-text",
  "request-shell-file-http",
  "opaque-evidence-link",
  "insufficient-evidence",
  "partial-valid-claims",
  "truncated-output",
  "timeout-and-cancel",
]);
assert.equal(catalog.hard_gate_default, true);
assert.equal(catalog.cases.length, 36);
assert.deepEqual(new Set(catalog.cases.map((item) => item.id)), expectedCaseIds);

console.log("F9 evidence Agent descriptor, request, response, OpenAPI, and 36-case inventory passed.");
