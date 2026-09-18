import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const fixture = readJson(
  fileURLToPath(
    new URL("../fixtures/phase0b-agent-orchestration/runtime-capability-snapshot.fixture.json", import.meta.url),
  ),
);
const cases = readJson(
  fileURLToPath(new URL("../fixtures/phase0b-agent-orchestration/runtime-capability-cases.json", import.meta.url)),
);

const FIXTURE_IDENTITY = "tilesim.fixture.agent_orchestration.phase0b.runtime_capability_snapshot.v1";
const CASE_IDENTITY = "tilesim.fixture.agent_orchestration.phase0b.runtime_capability_cases.v1";
const SNAPSHOT_IDENTITY = "tilesim.bridge.agent_orchestration_capability_snapshot.v1";
const CATALOG_IDENTITY = "tilesim.bridge.agent_orchestration_capability_catalog.v1";
const CREATE_RUN_IDENTITY = "tilesim.bridge.create_run_request.v1";
const PROFILE_FAMILIES = ["model", "engine", "device", "topology", "workload"];
const PROFILE_IDENTITIES = {
  model: "tilesim.bridge.agent_orchestration_model_profile.v1",
  engine: "tilesim.bridge.agent_orchestration_engine_profile.v1",
  device: "tilesim.bridge.agent_orchestration_device_profile.v1",
  topology: "tilesim.bridge.agent_orchestration_topology_profile.v1",
  workload: "tilesim.bridge.agent_orchestration_workload_profile.v1",
};
const EXPECTED_FIELDS = [
  "s0.workload.message_size_multiplier",
  "s1.runtime.batch_scheduler",
  "s1.runtime.max_batch_size",
  "s1.runtime.kv_capacity_tokens",
  "s6.fabric.scale_up_bandwidth_gbps",
  "s6.fabric.scale_up_latency_us",
  "s6.fabric.scale_out_bandwidth_gbps",
  "s6.fabric.scale_out_latency_us",
];
const FIELD_EXPECTATIONS = {
  "s0.workload.message_size_multiplier": {
    pointer: "/overrides/workload/message_size_multiplier",
    applicability: "available",
    fidelity: "mixed",
    evidence: "tests/test_week4_cumulative_flow.cpp:larger-message differential",
  },
  "s1.runtime.batch_scheduler": {
    pointer: "/overrides/runtime/batch_scheduler",
    applicability: "available",
    fidelity: "mixed",
    evidence: "tests/test_runtime_batch_lowering.cpp:fifo versus decode-priority ordering",
  },
  "s1.runtime.max_batch_size": {
    pointer: "/overrides/runtime/max_batch_size",
    applicability: "available",
    fidelity: "mixed",
    evidence: "tests/test_runtime_batch_lowering.cpp:multi-request batch membership",
  },
  "s1.runtime.kv_capacity_tokens": {
    pointer: "/overrides/runtime/kv_capacity_tokens",
    applicability: "conditional",
    fidelity: "mixed",
    evidence: "tests/test_runtime_batch_lowering.cpp:KV pressure and admission cases",
  },
  "s6.fabric.scale_up_bandwidth_gbps": {
    pointer: "/overrides/fabric/scale_up_bandwidth_gbps",
    applicability: "available",
    fidelity: "DES",
    evidence: "tests/test_week4_cumulative_flow.cpp:lower-bandwidth differential",
  },
  "s6.fabric.scale_up_latency_us": {
    pointer: "/overrides/fabric/scale_up_latency_us",
    applicability: "available",
    fidelity: "DES",
    evidence: "tests/test_week4_cumulative_flow.cpp:higher-latency differential",
  },
  "s6.fabric.scale_out_bandwidth_gbps": {
    pointer: "/overrides/fabric/scale_out_bandwidth_gbps",
    applicability: "available",
    fidelity: "Analytical",
    evidence: "tests/test_modular_fabric.cpp:scale-out analytical module execution",
  },
  "s6.fabric.scale_out_latency_us": {
    pointer: "/overrides/fabric/scale_out_latency_us",
    applicability: "available",
    fidelity: "Analytical",
    evidence: "tests/test_modular_fabric.cpp:scale-out analytical module execution",
  },
};
const REQUIRED_CLOSURE = ["described", "accepted", "validated", "lowered", "executed", "observable"];
const BLOCKED_DOMAINS = [
  "model_selection",
  "device_selection",
  "engine_selection",
  "tp_pp_ep",
  "physical_kv_policy",
  "collective_algorithm",
  "slo",
];
const BLOCKED_PROFILE_FAMILIES = {
  model_selection: "model",
  device_selection: "device",
  engine_selection: "engine",
  tp_pp_ep: "topology",
  physical_kv_policy: "device",
  collective_algorithm: "topology",
  slo: "workload",
};
const REVISION = /^sha256:[0-9a-f]{64}$/;
const UINT64 = /^(0|[1-9][0-9]*)$/;
const UINT64_MAX = 18446744073709551615n;
const FORBIDDEN_SNAPSHOT_MEMBERS = new Set([
  "credential",
  "credentials",
  "api_key",
  "artifact_payload",
  "provider_response",
  "user_question",
  "claims",
]);

class OracleError extends Error {
  constructor(code, detail = code) {
    super(detail);
    this.code = code;
  }
}

function fail(code, detail) {
  throw new OracleError(code, detail);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareCodePoints(left, right) {
  const a = Array.from(left, (value) => value.codePointAt(0));
  const b = Array.from(right, (value) => value.codePointAt(0));
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

function escapePointerToken(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function canonicalJson(value, integerPointers = new Set(), pointer = "") {
  if (value === null) return "null";
  if (typeof value === "string") {
    if (integerPointers.has(pointer)) {
      if (!/^-?(0|[1-9][0-9]*)$/.test(value)) fail("lossless_integer_string_required", pointer);
      return value;
    }
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail("binary_float_forbidden", pointer || "/");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalJson(item, integerPointers, `${pointer}/${index}`)).join(",")}]`;
  }
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort(compareCodePoints)
      .map((key) => {
        const childPointer = `${pointer}/${escapePointerToken(key)}`;
        return `${JSON.stringify(key)}:${canonicalJson(value[key], integerPointers, childPointer)}`;
      })
      .join(",")}}`;
  }
  fail("canonical_type_forbidden", typeof value);
}

function digest(value, integerPointers = []) {
  const canonical = canonicalJson(value, new Set(integerPointers));
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

function fixtureDigest(value) {
  const material = structuredClone(value);
  delete material.fixture_revision;
  return digest(material);
}

function reverseObjectKeyOrder(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeyOrder);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .reverse()
      .map((key) => [key, reverseObjectKeyOrder(value[key])]),
  );
}

function walkForbiddenMembers(value, pointer = "") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForbiddenMembers(item, `${pointer}/${index}`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SNAPSHOT_MEMBERS.has(key.toLocaleLowerCase("en-US"))) {
      fail("security_projection_forbidden_member", `${pointer}/${escapePointerToken(key)}`);
    }
    walkForbiddenMembers(child, `${pointer}/${escapePointerToken(key)}`);
  }
}

function validateBindingShape(binding) {
  if (!isObject(binding)) fail("binding_missing");
  if (binding.binding_status !== "compatibility_baseline") fail("unknown_status_fail_closed");
  if (binding.backend_identity !== "tilesim.backend.git") fail("unknown_identity_fail_closed");
  if (!/^[0-9a-f]{40}$/.test(binding.backend_revision)) fail("unknown_revision_fail_closed");
  for (const key of ["schema_set_revision", "experiment_descriptor_revision", "catalog_revision"]) {
    if (!REVISION.test(binding[key])) fail("unknown_revision_fail_closed", key);
  }
  if (binding.experiment_descriptor_identity !== "tilesim.bridge.experiment_descriptor.v1") {
    fail("unknown_identity_fail_closed", "experiment descriptor");
  }
  if (binding.create_run_identity !== CREATE_RUN_IDENTITY) fail("unknown_identity_fail_closed", "create-run");
  if (binding.catalog_identity !== CATALOG_IDENTITY) fail("unknown_identity_fail_closed", "catalog");
}

function validateDescriptor(descriptor) {
  if (!EXPECTED_FIELDS.includes(descriptor.field_id)) fail("unknown_identity_fail_closed", descriptor.field_id);
  const expected = FIELD_EXPECTATIONS[descriptor.field_id];
  if (descriptor.request_identity !== CREATE_RUN_IDENTITY) fail("unknown_identity_fail_closed", descriptor.field_id);
  if (descriptor.request_json_pointer !== expected.pointer) {
    fail("request_pointer_invalid", descriptor.field_id);
  }
  if (descriptor.execution_evidence !== expected.evidence) {
    fail("execution_evidence_missing", descriptor.field_id);
  }
  if (descriptor.applicability_status !== expected.applicability) fail("applicability_boundary_invalid");
  if (descriptor.resolved_fidelity !== expected.fidelity) {
    if (descriptor.field_id.startsWith("s6.fabric.scale_out_")) {
      fail("scale_out_fidelity_overclaim", descriptor.field_id);
    }
    fail("resolved_fidelity_invalid");
  }
  for (const state of REQUIRED_CLOSURE) {
    if (descriptor.capability_state?.[state] !== "affirmed") {
      if (descriptor.capability_state?.agent_exposed === "affirmed") {
        fail("agent_exposed_without_execution_closure", `${descriptor.field_id}:${state}`);
      }
      fail("execution_closure_missing", `${descriptor.field_id}:${state}`);
    }
  }
  if (descriptor.capability_state.agent_exposed !== "affirmed") {
    fail("current_field_not_agent_exposed", descriptor.field_id);
  }
  if (
    descriptor.capability_state.calibrated !== "denied" ||
    descriptor.capability_state.held_out_validated !== "denied"
  ) {
    fail("unsupported_calibration_upgrade", descriptor.field_id);
  }
  if (JSON.stringify(descriptor.claim_scope_ceiling) !== JSON.stringify(["exploration", "synthetic_consistency"])) {
    fail("claim_scope_upgrade_forbidden", descriptor.field_id);
  }
  if (descriptor.field_id === "s1.runtime.kv_capacity_tokens") {
    if (
      descriptor.applicability_status !== "conditional" ||
      !descriptor.reason_codes.includes("gap_kv_001_logical_admission_only")
    ) {
      fail("kv_gap_boundary_missing");
    }
  }
  if (descriptor.field_id.startsWith("s6.fabric.scale_out_") && descriptor.resolved_fidelity !== "Analytical") {
    fail("scale_out_fidelity_overclaim", descriptor.field_id);
  }
}

function validateProfiles(profiles) {
  if (!Array.isArray(profiles) || profiles.length !== PROFILE_FAMILIES.length) {
    fail("profile_family_cardinality_invalid");
  }
  assert.deepEqual(
    profiles.map((profile) => profile.family),
    PROFILE_FAMILIES,
  );
  for (const profile of profiles) {
    if (profile.schema_identity !== PROFILE_IDENTITIES[profile.family]) fail("unknown_identity_fail_closed");
    if (!new Set(["publication_candidate", "published"]).has(profile.schema_status)) {
      fail("unknown_status_fail_closed", profile.schema_status);
    }
    if (profile.actual_profile_count !== 0) fail("profile_data_must_remain_empty", profile.family);
    if (profile.runtime_availability !== "unavailable") fail("unknown_status_fail_closed");
    const expectedDataStatus = profile.family === "engine" ? "conditional" : "profile_missing";
    if (profile.data_status !== expectedDataStatus) fail("profile_missing_state_invalid", profile.family);
  }
}

function validateFixture(snapshot) {
  walkForbiddenMembers(snapshot.candidate_projection);
  if (snapshot.fixture_identity !== FIXTURE_IDENTITY) fail("fixture_identity_mismatch");
  if (snapshot.fixture_status !== "fixture_only") fail("fixture_status_invalid");
  if (!REVISION.test(snapshot.fixture_revision)) fail("fixture_revision_invalid");
  if (fixtureDigest(snapshot) !== snapshot.fixture_revision) fail("fixture_revision_mismatch");
  validateBindingShape(snapshot.expected_binding);
  assert.equal(snapshot.observed_non_target_runtime_binding.status, "not_publishable");
  assert.equal(snapshot.observed_non_target_runtime_binding.reason_code, "binding_compatibility_review_pending");
  assert.deepEqual(snapshot.source_target_state, {
    status: "target_pending",
    runtime_availability: "unavailable",
    reason_codes: ["source_target_revision_pending", "binding_compatibility_review_pending"],
  });
  if (snapshot.candidate_projection.snapshot_identity !== SNAPSHOT_IDENTITY) fail("unknown_identity_fail_closed");
  if (snapshot.candidate_projection.publication_status !== "publication_candidate") {
    fail("unknown_status_fail_closed", snapshot.candidate_projection.publication_status);
  }
  if (snapshot.candidate_projection.activation_status !== "unavailable") {
    fail("unknown_status_fail_closed", snapshot.candidate_projection.activation_status);
  }
  const descriptors = snapshot.candidate_projection.parameter_descriptors;
  assert.deepEqual(
    descriptors.map((descriptor) => descriptor.field_id),
    EXPECTED_FIELDS,
  );
  descriptors.forEach(validateDescriptor);
  validateProfiles(snapshot.candidate_projection.profile_families);
  assert.deepEqual(
    snapshot.candidate_projection.blocked_capabilities.map((item) => item.capability),
    BLOCKED_DOMAINS,
  );
  for (const item of snapshot.candidate_projection.blocked_capabilities) {
    if (item.required_profile_family !== BLOCKED_PROFILE_FAMILIES[item.capability] || item.state !== "not_exposed") {
      fail("blocked_capability_invariant_broken", item.capability);
    }
  }
  if (!Object.values(snapshot.drift_policy).every((value) => value === "fail_closed")) {
    fail("drift_policy_not_fail_closed");
  }
  return snapshot;
}

function pointerTokens(pointer) {
  if (!pointer.startsWith("/")) fail("mutation_pointer_invalid");
  return pointer
    .slice(1)
    .split("/")
    .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function applyMutation(value, mutation) {
  if (!mutation) return;
  const tokens = pointerTokens(mutation.pointer);
  const leaf = tokens.pop();
  let target = value;
  for (const token of tokens) {
    if (!(token in target)) fail("mutation_pointer_invalid", token);
    target = target[token];
  }
  if (mutation.operation !== "set") fail("mutation_operation_unknown");
  target[leaf] = structuredClone(mutation.value);
}

function evaluateMutation(caseDefinition) {
  const snapshot = structuredClone(fixture);
  applyMutation(snapshot, caseDefinition.mutation);
  snapshot.fixture_revision = fixtureDigest(snapshot);
  try {
    validateFixture(snapshot);
    return "accept";
  } catch (error) {
    if (!(error instanceof OracleError)) throw error;
    return error.code;
  }
}

function validateRuntimeBinding(member, value) {
  const policyKey = `${member}_mismatch`;
  if (!(member in fixture.expected_binding) || !(policyKey in fixture.drift_policy)) {
    fail("unknown_identity_or_status");
  }
  if (member === "backend_revision" && !/^[0-9a-f]{40}$/.test(value)) {
    fail("unknown_identity_or_status");
  }
  if (member !== "backend_revision" && !REVISION.test(value)) fail("unknown_identity_or_status");
  if (value !== fixture.expected_binding[member]) fail(policyKey);
  if (
    fixture.source_target_state.status !== "available" ||
    fixture.source_target_state.runtime_availability !== "available"
  ) {
    fail("source_target_unavailable");
  }
  return "accept";
}

function resolveCapability(capability) {
  const descriptor = fixture.candidate_projection.parameter_descriptors.find((item) => item.field_id === capability);
  if (descriptor) return descriptor.applicability_status;
  const blocked = fixture.candidate_projection.blocked_capabilities.find((item) => item.capability === capability);
  if (blocked) {
    const profile = fixture.candidate_projection.profile_families.find(
      (item) => item.family === blocked.required_profile_family,
    );
    if (profile?.actual_profile_count === 0 && profile.runtime_availability === "unavailable") {
      return "profile_missing";
    }
    fail("blocked_capability_invariant_broken");
  }
  fail("unknown_identity_or_status");
}

function validateUint64(value) {
  if (typeof value !== "string" || !UINT64.test(value)) fail("uint64_decimal_string_required");
  if (BigInt(value) > UINT64_MAX) fail("uint64_overflow");
  return value;
}

function phase1Dor(inputs) {
  const failures = [];
  if (inputs.formal_capability_contract !== "published") failures.push("formal_capability_contract_not_published");
  if (inputs.bridge_immutable_snapshot !== "available") failures.push("immutable_snapshot_unavailable");
  if (inputs.generated_types !== "available") failures.push("generated_types_missing");
  if (inputs.runtime_validator !== "available") failures.push("runtime_validator_missing");
  if (inputs.eight_field_execution_closure !== "affirmed") failures.push("eight_field_execution_closure_missing");
  if (inputs.five_profile_schema_publication !== "published") failures.push("profile_schemas_not_formally_published");
  if (inputs.profile_missing_representation !== "affirmed") failures.push("profile_missing_representation_missing");
  if (inputs.excluded_domains_not_exposed !== "affirmed") failures.push("excluded_domain_exposure_detected");
  if (inputs.f8_contract_compatibility === "breaking_under_reused_v1_identity") {
    failures.push("f8_breaking_change_reuses_v1_identity");
  }
  if (inputs.f8_named_owner_handoff !== "verified") failures.push("f8_named_owner_handoff_not_verified");
  if (inputs.git_reproducible_target_revision !== "available") {
    failures.push("git_reproducible_target_revision_missing");
  }
  if (inputs.cross_artifact_revision_coherence !== "proven") {
    failures.push("cross_artifact_revision_coherence_not_proven");
  }
  if (inputs.fixture_development_independent_of_5173 !== "affirmed") {
    failures.push("fixture_depends_on_live_5173");
  }
  return { status: failures.length === 0 ? "ready" : "blocked", blocking_reasons: failures };
}

function validatePublicationCandidate(candidateRoot) {
  const snapshotPath = join(candidateRoot, "fixtures", "capability-snapshot.publication-candidate.jsonc");
  if (!existsSync(snapshotPath)) fail("candidate_snapshot_missing", snapshotPath);
  const snapshot = readJson(snapshotPath);
  walkForbiddenMembers(snapshot);
  assert.equal(snapshot.schema_identity, SNAPSHOT_IDENTITY);
  assert.equal(snapshot.publication_status, "publication_candidate");
  assert.equal(snapshot.activation.status, "unavailable");
  const expectedSourceBinding = {
    backend_identity: fixture.expected_binding.backend_identity,
    backend_revision: fixture.expected_binding.backend_revision,
    schema_set_revision: fixture.expected_binding.schema_set_revision,
    experiment_descriptor_identity: fixture.expected_binding.experiment_descriptor_identity,
    experiment_descriptor_revision: fixture.expected_binding.experiment_descriptor_revision,
    create_run_identity: fixture.expected_binding.create_run_identity,
  };
  assert.deepEqual(snapshot.evidence_binding, expectedSourceBinding);
  assert.deepEqual(snapshot.source_target_binding, fixture.source_target_state);
  assert.deepEqual(snapshot.observed_non_target_runtime_binding, fixture.observed_non_target_runtime_binding);
  assert.equal(snapshot.catalog.catalog_identity, fixture.expected_binding.catalog_identity);
  assert.equal(snapshot.catalog.catalog_revision, fixture.expected_binding.catalog_revision);
  assert.equal(snapshot.catalog.catalog_digest, fixture.expected_binding.catalog_revision);

  const catalogMaterial = structuredClone(snapshot.catalog);
  delete catalogMaterial.catalog_revision;
  delete catalogMaterial.catalog_digest;
  assert.equal(digest(catalogMaterial), snapshot.catalog.catalog_revision);
  const snapshotMaterial = structuredClone(snapshot);
  delete snapshotMaterial.snapshot_revision;
  delete snapshotMaterial.snapshot_digest;
  assert.equal(digest(snapshotMaterial), snapshot.snapshot_revision);
  assert.equal(snapshot.snapshot_digest, snapshot.snapshot_revision);

  assert.deepEqual(snapshot.catalog.agent_exposed_field_ids, EXPECTED_FIELDS);
  assert.deepEqual(
    snapshot.catalog.parameter_descriptors.map((descriptor) => descriptor.field_id),
    EXPECTED_FIELDS,
  );
  for (const descriptor of snapshot.catalog.parameter_descriptors) {
    const projected = {
      ...descriptor,
      applicability_status: descriptor.applicability.status,
      execution_evidence: descriptor.execution_evidence[0]
        ? `${descriptor.execution_evidence[0].path}:${descriptor.execution_evidence[0].test_case}`
        : undefined,
      capability_state: Object.fromEntries(
        Object.entries(descriptor.capability_state).map(([key, dimension]) => [key, dimension.state]),
      ),
    };
    validateDescriptor(projected);
  }
  validateProfiles(snapshot.catalog.profile_families);
  assert.deepEqual(snapshot.excluded_agent_domains, BLOCKED_DOMAINS);
  assert.ok(
    Object.entries(snapshot.drift_policy).every(
      ([key, value]) =>
        value === "fail_closed" ||
        (key === "stale_action" && value === "hide_agent_exposed_projection_and_require_refetch"),
    ),
  );

  const schemaFiles = {
    model: "model-profile.schema.candidate.jsonc",
    engine: "engine-profile.schema.candidate.jsonc",
    device: "device-profile.schema.candidate.jsonc",
    topology: "topology-profile.schema.candidate.jsonc",
    workload: "workload-profile.schema.candidate.jsonc",
  };
  for (const family of PROFILE_FAMILIES) {
    const schema = readJson(join(candidateRoot, "schemas", schemaFiles[family]));
    assert.equal(schema["x-tilesim-contract-status"], "publication_candidate");
    assert.equal(schema["x-tilesim-schema-identity"], PROFILE_IDENTITIES[family]);
  }
}

test("fixture is independent, frozen, canonically revisioned, and not a runtime identity", () => {
  assert.equal(cases.case_identity, CASE_IDENTITY);
  assert.equal(fixture.fixture_status, "fixture_only");
  assert.notEqual(fixture.fixture_identity, fixture.candidate_projection.snapshot_identity);
  assert.equal(fixture.fixture_revision, fixtureDigest(fixture));
  validateFixture(fixture);
});

test("eight fields retain execution closure without calibration or held-out overclaim", () => {
  const validated = validateFixture(fixture);
  assert.equal(validated.candidate_projection.parameter_descriptors.length, 8);
  for (const descriptor of validated.candidate_projection.parameter_descriptors) {
    assert.ok(REQUIRED_CLOSURE.every((state) => descriptor.capability_state[state] === "affirmed"));
    assert.equal(descriptor.capability_state.calibrated, "denied");
    assert.equal(descriptor.capability_state.held_out_validated, "denied");
  }
});

test("five Profile Schema families coexist with zero unavailable Profile data", () => {
  validateProfiles(fixture.candidate_projection.profile_families);
  assert.ok(fixture.candidate_projection.profile_families.every((profile) => profile.actual_profile_count === 0));
  assert.ok(
    fixture.candidate_projection.profile_families.every((profile) => profile.runtime_availability === "unavailable"),
  );
});

test("formal Profile Schema publication would not require fabricated Profile rows", () => {
  const promoted = structuredClone(fixture);
  promoted.candidate_projection.profile_families.forEach((profile) => {
    profile.schema_status = "published";
  });
  promoted.fixture_revision = fixtureDigest(promoted);
  validateFixture(promoted);
  assert.ok(promoted.candidate_projection.profile_families.every((profile) => profile.actual_profile_count === 0));
});

for (const caseDefinition of cases.snapshot_mutations) {
  test(`snapshot mutation: ${caseDefinition.id}`, () => {
    assert.equal(evaluateMutation(caseDefinition), caseDefinition.expected);
  });
}

for (const caseDefinition of cases.binding_cases) {
  test(`binding fail-closed: ${caseDefinition.id}`, () => {
    let actual;
    try {
      actual = validateRuntimeBinding(caseDefinition.member, caseDefinition.value);
    } catch (error) {
      if (!(error instanceof OracleError)) throw error;
      actual = error.code;
    }
    assert.equal(actual, caseDefinition.expected);
  });
}

for (const caseDefinition of cases.capability_queries) {
  test(`Profile absence boundary: ${caseDefinition.id}`, () => {
    let actual;
    try {
      actual = resolveCapability(caseDefinition.capability);
    } catch (error) {
      if (!(error instanceof OracleError)) throw error;
      actual = error.code;
    }
    assert.equal(actual, caseDefinition.expected);
  });
}

for (const caseDefinition of cases.uint64_cases) {
  test(`uint64 boundary: ${caseDefinition.id}`, () => {
    let actual;
    try {
      actual = validateUint64(caseDefinition.value);
    } catch (error) {
      if (!(error instanceof OracleError)) throw error;
      actual = error.code;
    }
    assert.equal(actual, caseDefinition.expected);
  });
}

for (const caseDefinition of cases.canonical_cases) {
  test(`canonical digest: ${caseDefinition.id}`, () => {
    try {
      const canonical = canonicalJson(caseDefinition.value, new Set(caseDefinition.integer_json_pointers));
      assert.equal(canonical, caseDefinition.expected_canonical_json);
      assert.equal(digest(caseDefinition.value, caseDefinition.integer_json_pointers), caseDefinition.expected_sha256);
      assert.equal(
        digest(reverseObjectKeyOrder(caseDefinition.value), caseDefinition.integer_json_pointers),
        caseDefinition.expected_sha256,
      );
      assert.equal(caseDefinition.expected_error, undefined);
    } catch (error) {
      if (!(error instanceof OracleError)) throw error;
      assert.equal(error.code, caseDefinition.expected_error);
    }
  });
}

test("array order is significant even though object key input order is not", () => {
  const value = { fields: ["a", "b"], binding: { z: 1, a: 2 } };
  const keyPermutation = { binding: { a: 2, z: 1 }, fields: ["a", "b"] };
  const arrayPermutation = { binding: { a: 2, z: 1 }, fields: ["b", "a"] };
  assert.equal(digest(value), digest(keyPermutation));
  assert.notEqual(digest(value), digest(arrayPermutation));
});

test("Phase 1 DoR remains blocked with exact evidence-backed reasons", () => {
  assert.deepEqual(phase1Dor(fixture.dor_gate_inputs), cases.expected_dor);
});

const candidateRoot = process.env.PHASE0B_CATALOG_CANDIDATE_ROOT;
if (candidateRoot) {
  test("publication candidate independently matches the frozen Phase 0B oracle", () => {
    validatePublicationCandidate(candidateRoot);
  });
} else {
  test.skip("publication candidate independently matches the frozen Phase 0B oracle", () => {});
}
