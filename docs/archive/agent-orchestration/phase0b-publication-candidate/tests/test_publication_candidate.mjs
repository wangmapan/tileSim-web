import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromWeb = createRequire("D:/tileSim-web/package.json");
const Ajv2020 = requireFromWeb("ajv/dist/2020").default;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function compareCodePoints(left, right) {
  const a = Array.from(left, (value) => value.codePointAt(0));
  const b = Array.from(right, (value) => value.codePointAt(0));
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

function canonicalJson(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value))
      throw new TypeError("candidate canonical JSON forbids unsafe numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort(compareCodePoints)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new TypeError(`unsupported canonical value: ${typeof value}`);
}

function digest(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

const schemaRoot = join(root, "schemas");
const schemas = readdirSync(schemaRoot)
  .filter((name) => name.endsWith(".schema.candidate.jsonc"))
  .map((name) => readJson(join(schemaRoot, name)));
assert.equal(schemas.length, 8);
assert.ok(
  schemas.every(
    (schema) => schema["x-tilesim-contract-status"] === "publication_candidate",
  ),
);

const ajv = new Ajv2020({ allErrors: true, strict: false });
for (const schema of schemas) ajv.addSchema(schema);
const validate = ajv.getSchema(
  "https://tilesim.local/publication-candidates/agent-orchestration-phase0b/capability-snapshot.schema.json",
);
assert.ok(validate);

const fixturePath = join(
  root,
  "fixtures",
  "capability-snapshot.publication-candidate.jsonc",
);
const snapshot = readJson(fixturePath);
assert.equal(validate(snapshot), true, JSON.stringify(validate.errors));

const catalogMaterial = structuredClone(snapshot.catalog);
delete catalogMaterial.catalog_revision;
delete catalogMaterial.catalog_digest;
const expectedCatalogDigest = digest(catalogMaterial);
assert.equal(snapshot.catalog.catalog_revision, expectedCatalogDigest);
assert.equal(snapshot.catalog.catalog_digest, expectedCatalogDigest);

const schemaDocuments = Object.fromEntries(
  readdirSync(schemaRoot)
    .filter((name) => name.endsWith(".schema.candidate.jsonc"))
    .sort()
    .map((name) => [name, readJson(join(schemaRoot, name))]),
);
assert.equal(
  snapshot.catalog.contract_package_revision,
  digest(schemaDocuments),
);
const schemaByIdentity = new Map(
  schemas
    .filter((schema) => schema["x-tilesim-schema-identity"])
    .map((schema) => [schema["x-tilesim-schema-identity"], schema]),
);
const parameterSchema = schemaByIdentity.get(
  snapshot.catalog.parameter_descriptor_schema_identity,
);
assert.ok(parameterSchema);
assert.equal(
  snapshot.catalog.parameter_descriptor_schema_revision,
  digest(parameterSchema),
);
assert.equal(
  snapshot.catalog.parameter_descriptor_schema_digest,
  digest(parameterSchema),
);
for (const family of snapshot.catalog.profile_families) {
  const schema = schemaByIdentity.get(family.schema_identity);
  assert.ok(schema, family.family);
  assert.equal(family.schema_revision, digest(schema), family.family);
  assert.equal(family.schema_digest, digest(schema), family.family);
}

const snapshotMaterial = structuredClone(snapshot);
delete snapshotMaterial.snapshot_revision;
delete snapshotMaterial.snapshot_digest;
const expectedSnapshotDigest = digest(snapshotMaterial);
assert.equal(snapshot.snapshot_revision, expectedSnapshotDigest);
assert.equal(snapshot.snapshot_digest, expectedSnapshotDigest);

const expectedFields = [
  "s0.workload.message_size_multiplier",
  "s1.runtime.batch_scheduler",
  "s1.runtime.max_batch_size",
  "s1.runtime.kv_capacity_tokens",
  "s6.fabric.scale_up_bandwidth_gbps",
  "s6.fabric.scale_up_latency_us",
  "s6.fabric.scale_out_bandwidth_gbps",
  "s6.fabric.scale_out_latency_us",
];
assert.deepEqual(snapshot.catalog.agent_exposed_field_ids, expectedFields);
assert.deepEqual(
  snapshot.catalog.parameter_descriptors.map(
    (descriptor) => descriptor.field_id,
  ),
  expectedFields,
);
for (const descriptor of snapshot.catalog.parameter_descriptors) {
  for (const dimension of [
    "described",
    "accepted",
    "validated",
    "lowered",
    "executed",
    "observable",
    "agent_exposed",
  ]) {
    assert.equal(
      descriptor.capability_state[dimension].state,
      "affirmed",
      `${descriptor.field_id}:${dimension}`,
    );
  }
  assert.equal(
    descriptor.capability_state.calibrated.state,
    "denied",
    descriptor.field_id,
  );
  assert.equal(
    descriptor.capability_state.held_out_validated.state,
    "denied",
    descriptor.field_id,
  );
  assert.ok(descriptor.execution_evidence.length > 0, descriptor.field_id);
  assert.deepEqual(descriptor.claim_scope_ceiling, [
    "exploration",
    "synthetic_consistency",
  ]);
}

const kv = snapshot.catalog.parameter_descriptors.find(
  (item) => item.field_id === "s1.runtime.kv_capacity_tokens",
);
assert.equal(kv.applicability.status, "conditional");
assert.ok(kv.reason_codes.includes("gap_kv_001_logical_admission_only"));
for (const fieldId of [
  "s6.fabric.scale_out_bandwidth_gbps",
  "s6.fabric.scale_out_latency_us",
]) {
  const descriptor = snapshot.catalog.parameter_descriptors.find(
    (item) => item.field_id === fieldId,
  );
  assert.equal(descriptor.resolved_fidelity, "Analytical");
  assert.ok(descriptor.reason_codes.includes("resolved_scale_out_analytical"));
}

assert.deepEqual(
  snapshot.catalog.profile_families.map((item) => item.family),
  ["model", "engine", "device", "topology", "workload"],
);
assert.ok(
  snapshot.catalog.profile_families.every(
    (item) => item.actual_profile_count === 0,
  ),
);
assert.ok(
  snapshot.catalog.profile_families.every(
    (item) => item.runtime_availability === "unavailable",
  ),
);
assert.equal(
  snapshot.catalog.profile_families.find((item) => item.family === "engine")
    .data_status,
  "conditional",
);

assert.equal(snapshot.activation.status, "unavailable");
assert.ok(
  snapshot.activation.reason_codes.includes("identity_approval_pending"),
);
assert.ok(
  snapshot.activation.reason_codes.includes(
    "binding_compatibility_review_pending",
  ),
);
assert.equal(snapshot.source_target_binding.status, "target_pending");
assert.equal(
  snapshot.source_target_binding.runtime_availability,
  "unavailable",
);
assert.ok(
  snapshot.source_target_binding.reason_codes.includes(
    "source_target_revision_pending",
  ),
);
for (const forbiddenTargetField of [
  "backend_identity",
  "backend_revision",
  "schema_set_revision",
  "experiment_descriptor_identity",
  "experiment_descriptor_revision",
  "create_run_identity",
]) {
  assert.equal(
    Object.hasOwn(snapshot.source_target_binding, forbiddenTargetField),
    false,
    `pending source target must not claim ${forbiddenTargetField}`,
  );
}
assert.deepEqual(snapshot.excluded_agent_domains, [
  "model_selection",
  "device_selection",
  "engine_selection",
  "tp_pp_ep",
  "physical_kv_policy",
  "collective_algorithm",
  "slo",
]);
assert.ok(
  Object.values(snapshot.drift_policy).every(
    (value) =>
      value === "fail_closed" ||
      value === "hide_agent_exposed_projection_and_require_refetch",
  ),
);

const unknownStatus = structuredClone(snapshot);
unknownStatus.catalog.profile_families[0].data_status = "llm_assumed_available";
assert.equal(
  validate(unknownStatus),
  false,
  "unknown support status must fail closed",
);
const missingExecutionEvidence = structuredClone(snapshot);
delete missingExecutionEvidence.catalog.parameter_descriptors[0]
  .execution_evidence;
assert.equal(
  validate(missingExecutionEvidence),
  false,
  "agent field without execution evidence must fail closed",
);
const fabricatedProfile = structuredClone(snapshot);
fabricatedProfile.catalog.profile_families[0].actual_profile_count = 1;
assert.equal(
  validate(fabricatedProfile),
  false,
  "candidate must not fabricate actual Profile data",
);

const serialized = JSON.stringify(snapshot);
for (const forbidden of [
  "credential",
  "api_key",
  "provider_response",
  "user_question",
  "claims",
  "artifact_payload",
]) {
  assert.equal(serialized.includes(forbidden), false, forbidden);
}

console.log(
  `Phase 0B publication candidate passed: ${schemas.length} schemas, ${expectedFields.length} agent fields, 5 empty Profile families.`,
);
