import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const fixture = JSON.parse(
  fs.readFileSync(
    fileURLToPath(
      new URL("../fixtures/phase0-agent-orchestration/capability-profile-proposal.fixture.json", import.meta.url),
    ),
    "utf8",
  ),
);
const dataset = JSON.parse(
  fs.readFileSync(
    fileURLToPath(new URL("../fixtures/phase0-agent-orchestration/capability-profile-cases.json", import.meta.url)),
    "utf8",
  ),
);

const REVISION = /^sha256:[0-9a-f]{64}$/;
const DECIMAL = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const UINT64 = /^(0|[1-9][0-9]*)$/;
const UINT64_MAX = 18446744073709551615n;
const FIXTURE_IDENTITY = "tilesim.fixture.agent_orchestration.phase0.capability_profile_proposal.v0";
const CASE_IDENTITY = "tilesim.fixture.agent_orchestration.phase0.eval_cases.v0";
const PROFILE_FAMILIES = ["model", "engine", "device", "topology", "workload"];
const SUPPORT_STATES = new Set([
  "available",
  "conditional",
  "not_exposed",
  "unsupported",
  "unresolved_not_executed",
  "profile_missing",
  "calibration_missing",
  "temporarily_unavailable",
  "deprecated",
]);
const STATUS_KEYS = [
  "described",
  "accepted",
  "validated",
  "lowered",
  "executed",
  "observable",
  "calibrated",
  "held_out_validated",
  "ui_exposed",
  "agent_exposed",
];

class OracleError extends Error {
  constructor(code, detail) {
    super(detail);
    this.code = code;
  }
}

function fail(code, detail) {
  throw new OracleError(code, detail);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, code, detail) {
  if (!isObject(value)) fail(code, detail);
}

function requireRevision(value, code, detail) {
  if (typeof value !== "string" || !REVISION.test(value)) fail(code, detail);
}

function requireExactKeys(value, allowed, required = allowed) {
  requireObject(value, "object_required", "Expected an object.");
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unknown) fail("unknown_property", `Unknown property: ${unknown}`);
  const missing = required.find((key) => !(key in value));
  if (missing) fail("required_property_missing", `Missing property: ${missing}`);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function fixtureDigest(value) {
  const material = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "fixture_revision"));
  return `sha256:${crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(material)), "utf8")
    .digest("hex")}`;
}

function proposalDigest(value) {
  if (!Array.isArray(value.digest_material_fields)) {
    fail("digest_material_invalid", "Proposal digest_material_fields must be an array.");
  }
  if (
    value.digest_material_fields.includes("canonical_digest") ||
    new Set(value.digest_material_fields).size !== value.digest_material_fields.length
  ) {
    fail("digest_material_invalid", "Proposal digest material must be unique and exclude itself.");
  }
  const material = Object.fromEntries(
    value.digest_material_fields.map((key) => {
      if (!(key in value)) fail("digest_material_missing", key);
      return [key, value[key]];
    }),
  );
  return `sha256:${crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(material)), "utf8")
    .digest("hex")}`;
}

function normalizeAlias(value) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function pointerTokens(pointer) {
  if (typeof pointer !== "string" || !pointer.startsWith("/")) {
    fail("fixture_mutation_invalid", `Invalid mutation pointer: ${pointer}`);
  }
  return pointer
    .slice(1)
    .split("/")
    .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function applyMutation(target, mutation) {
  if (!mutation) return;
  const tokens = pointerTokens(mutation.pointer);
  const leaf = tokens.pop();
  let current = target;
  for (const token of tokens) {
    if (!(token in current)) fail("fixture_mutation_invalid", `Missing mutation parent: ${token}`);
    current = current[token];
  }
  if (mutation.operation === "set") {
    current[leaf] = structuredClone(mutation.value);
    return;
  }
  if (mutation.operation === "delete") {
    delete current[leaf];
    return;
  }
  if (mutation.operation === "append") {
    const destination = current[leaf];
    if (!Array.isArray(destination)) fail("fixture_mutation_invalid", "Append target is not an array.");
    destination.push(structuredClone(mutation.value));
    return;
  }
  fail("fixture_mutation_invalid", `Unknown mutation operation: ${mutation.operation}`);
}

function validateRegime(regime) {
  if (!regime) fail("valid_regime_missing", "Profile valid regime is required.");
  requireExactKeys(regime, ["scenarios", "requested_fidelity", "gpu_participation_modes", "source_modes"]);
  for (const key of ["scenarios", "requested_fidelity", "gpu_participation_modes", "source_modes"]) {
    if (!Array.isArray(regime[key]) || regime[key].length === 0) {
      fail("valid_regime_missing", `Valid regime ${key} must be non-empty.`);
    }
  }
}

function validateSource(source) {
  if (!source) fail("profile_source_missing", "Profile source is required.");
  requireExactKeys(source, ["kind", "identity", "revision"]);
  if (!source.kind || !source.identity) fail("profile_source_missing", "Profile source identity is incomplete.");
  requireRevision(source.revision, "profile_source_missing", "Profile source revision is invalid.");
}

function validateProfile(profile, evaluatedAt) {
  const required = [
    "profile_id",
    "family",
    "revision",
    "aliases",
    "owner_module",
    "lifecycle",
    "source",
    "valid_regime",
    "calibration",
    "held_out_validation",
    "facts",
  ];
  const unknown = Object.keys(profile).find((key) => !required.includes(key));
  if (unknown) fail("unknown_property", `Unknown profile property: ${unknown}`);
  if (!profile.source) fail("profile_source_missing", "Profile source is required.");
  if (!profile.valid_regime) fail("valid_regime_missing", "Profile valid regime is required.");
  const missing = required.find((key) => !(key in profile));
  if (missing) fail("required_property_missing", `Missing profile property: ${missing}`);
  if (!PROFILE_FAMILIES.includes(profile.family)) fail("profile_family_unknown", profile.family);
  requireRevision(profile.revision, "profile_revision_invalid", profile.profile_id);
  validateSource(profile.source);
  validateRegime(profile.valid_regime);
  requireExactKeys(profile.lifecycle, ["state", "expires_at"]);
  if (profile.lifecycle.state === "revoked") fail("profile_revoked", profile.profile_id);
  if (!new Set(["active", "expired", "revoked"]).has(profile.lifecycle.state)) {
    fail("profile_lifecycle_unknown", profile.lifecycle.state);
  }
  if (
    profile.lifecycle.state === "expired" ||
    (profile.lifecycle.expires_at && Date.parse(profile.lifecycle.expires_at) <= evaluatedAt)
  ) {
    fail("profile_expired", profile.profile_id);
  }
  requireExactKeys(profile.calibration, ["state", "receipt"]);
  if (!new Set(["uncalibrated", "calibrated"]).has(profile.calibration.state)) {
    fail("calibration_state_unknown", profile.calibration.state);
  }
  if (profile.calibration.state === "calibrated") {
    if (!profile.calibration.receipt) fail("calibration_receipt_missing", profile.profile_id);
    if (profile.calibration.receipt.issuer_class !== "trusted_calibration_registry") {
      fail("calibration_self_claim_forbidden", profile.profile_id);
    }
  }
  requireExactKeys(profile.held_out_validation, ["state", "receipt"]);
  if (!new Set(["unavailable", "validated"]).has(profile.held_out_validation.state)) {
    fail("held_out_state_unknown", profile.held_out_validation.state);
  }
  if (profile.held_out_validation.state === "validated") {
    if (!profile.held_out_validation.receipt) fail("held_out_receipt_missing", profile.profile_id);
    if (profile.held_out_validation.receipt.issuer_class !== "independent_held_out_registry") {
      fail("held_out_self_claim_forbidden", profile.profile_id);
    }
    if (profile.calibration.state !== "calibrated") {
      fail("held_out_requires_calibration", profile.profile_id);
    }
  }
}

function validateParameter(parameter) {
  requireExactKeys(parameter, [
    "field_id",
    "aliases",
    "owner_module",
    "value_type",
    "canonical_unit",
    "accepted_units",
    "constraints",
    "request_target",
    "lowering",
    "evidence_outputs",
    "status",
    "support",
    "sensitivity",
    "lifecycle",
    "source",
    "valid_regime",
  ]);
  requireExactKeys(parameter.status, STATUS_KEYS);
  for (const key of STATUS_KEYS) {
    if (typeof parameter.status[key] !== "boolean") fail("status_boolean_required", `${parameter.field_id}.${key}`);
  }
  if (!SUPPORT_STATES.has(parameter.support.state)) {
    fail("support_state_unknown", parameter.support.state);
  }
  if (parameter.sensitivity === "secret" && parameter.status.agent_exposed) {
    fail("secret_agent_exposure_forbidden", parameter.field_id);
  }
  if (parameter.status.agent_exposed) {
    const executionClosure = ["accepted", "validated", "lowered", "executed"].every((key) => parameter.status[key]);
    if (!executionClosure) fail("agent_exposed_without_execution", parameter.field_id);
  }
  if (parameter.status.executed || parameter.status.observable) {
    if (
      parameter.lowering.status !== "lowered" ||
      parameter.lowering.execution_evidence_refs.length === 0 ||
      parameter.evidence_outputs.length === 0
    ) {
      fail("execution_evidence_missing", parameter.field_id);
    }
  }
  if (parameter.status.held_out_validated && !parameter.status.calibrated) {
    fail("held_out_requires_calibration", parameter.field_id);
  }
  validateSource(parameter.source);
  validateRegime(parameter.valid_regime);
}

function validateSnapshot(snapshot) {
  requireExactKeys(snapshot, [
    "schema_version",
    "publication_status",
    "fixture_revision",
    "evaluated_at",
    "runtime_bindings",
    "catalog",
  ]);
  if (snapshot.schema_version !== FIXTURE_IDENTITY) fail("fixture_identity_mismatch", snapshot.schema_version);
  if (snapshot.publication_status !== "proposed_non_published_fixture") {
    fail("fixture_publication_status_invalid", snapshot.publication_status);
  }
  requireRevision(snapshot.fixture_revision, "fixture_revision_invalid", snapshot.fixture_revision);
  if (fixtureDigest(snapshot) !== snapshot.fixture_revision) {
    fail("fixture_revision_mismatch", "Fixture material does not match its canonical digest.");
  }
  requireExactKeys(snapshot.runtime_bindings, [
    "schema_set_revision",
    "experiment_descriptor_identity",
    "experiment_descriptor_revision",
    "create_run_schema_identity",
    "evidence_descriptor_identity",
    "evidence_descriptor_revision",
    "evidence_request_identity",
    "evidence_response_identity",
    "evidence_citation_identity",
    "evidence_snapshot_identity",
  ]);
  for (const key of ["schema_set_revision", "experiment_descriptor_revision", "evidence_descriptor_revision"]) {
    requireRevision(snapshot.runtime_bindings[key], "runtime_binding_revision_invalid", key);
  }
  requireExactKeys(snapshot.catalog, [
    "catalog_id",
    "catalog_revision",
    "policy_revision",
    "parameter_descriptors",
    "profiles",
    "combination",
  ]);
  requireRevision(snapshot.catalog.catalog_revision, "catalog_revision_invalid", "catalog_revision");
  requireRevision(snapshot.catalog.policy_revision, "policy_revision_invalid", "policy_revision");
  if (!Array.isArray(snapshot.catalog.parameter_descriptors)) fail("parameter_catalog_missing", "parameters");
  const fieldIds = new Set();
  for (const parameter of snapshot.catalog.parameter_descriptors) {
    if (fieldIds.has(parameter.field_id)) fail("duplicate_field_id", parameter.field_id);
    fieldIds.add(parameter.field_id);
    validateParameter(parameter);
  }
  if (!Array.isArray(snapshot.catalog.profiles)) fail("profile_catalog_missing", "profiles");
  const profileIds = new Set();
  const familyCounts = new Map(PROFILE_FAMILIES.map((family) => [family, 0]));
  const evaluatedAt = Date.parse(snapshot.evaluated_at);
  for (const profile of snapshot.catalog.profiles) {
    if (profileIds.has(profile.profile_id)) fail("duplicate_profile_id", profile.profile_id);
    profileIds.add(profile.profile_id);
    familyCounts.set(profile.family, (familyCounts.get(profile.family) ?? 0) + 1);
    validateProfile(profile, evaluatedAt);
  }
  for (const family of PROFILE_FAMILIES) {
    if (familyCounts.get(family) !== 1) fail("profile_family_cardinality_invalid", family);
  }
  return snapshot;
}

function resolveField(snapshot, query) {
  const normalized = normalizeAlias(query);
  const matches = snapshot.catalog.parameter_descriptors.filter(
    (parameter) =>
      normalizeAlias(parameter.field_id) === normalized ||
      parameter.aliases.some((alias) => normalizeAlias(alias) === normalized),
  );
  if (matches.length === 0) fail("unknown_field", query);
  if (matches.length > 1) fail("ambiguous_alias", query);
  return matches[0];
}

function resolveProfile(snapshot, query) {
  const normalized = normalizeAlias(query);
  const matches = snapshot.catalog.profiles.filter(
    (profile) =>
      normalizeAlias(profile.profile_id) === normalized ||
      profile.aliases.some((alias) => normalizeAlias(alias) === normalized),
  );
  if (matches.length === 0) fail("unknown_profile", query);
  if (matches.length > 1) fail("ambiguous_alias", query);
  return matches[0];
}

function parseRational(value) {
  if (typeof value !== "string" || !DECIMAL.test(value)) fail("decimal_string_required", String(value));
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(`${whole}${fraction}` || "0") * (negative ? -1n : 1n);
  return { numerator, denominator };
}

function gcd(left, right) {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function normalizeRational(value) {
  const divisor = gcd(value.numerator, value.denominator);
  return { numerator: value.numerator / divisor, denominator: value.denominator / divisor };
}

function compareRational(left, right) {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function rationalToString(value) {
  const normalized = normalizeRational(value);
  if (normalized.denominator === 1n) return normalized.numerator.toString();
  return `${normalized.numerator}/${normalized.denominator}`;
}

function validateValue(snapshot, caseDefinition) {
  const parameter = resolveField(snapshot, caseDefinition.field);
  if (parameter.value_type === "uint64") {
    if (typeof caseDefinition.input_value !== "string") {
      fail("uint64_lossless_string_required", parameter.field_id);
    }
    if (!UINT64.test(caseDefinition.input_value)) fail("uint64_invalid", caseDefinition.input_value);
    if (BigInt(caseDefinition.input_value) > UINT64_MAX) fail("value_above_maximum", parameter.field_id);
  }
  if (parameter.value_type === "int" && !/^-?(0|[1-9][0-9]*)$/.test(caseDefinition.input_value)) {
    fail("integer_required", String(caseDefinition.input_value));
  }
  const unit = parameter.accepted_units.find((entry) => entry.unit === caseDefinition.input_unit);
  if (!unit) fail("unit_unsupported", caseDefinition.input_unit);
  const input = parseRational(caseDefinition.input_value);
  const canonical = normalizeRational({
    numerator: input.numerator * BigInt(unit.numerator),
    denominator: input.denominator * BigInt(unit.denominator),
  });
  const minimum = parseRational(parameter.constraints.minimum);
  const maximum = parseRational(parameter.constraints.maximum);
  if (compareRational(canonical, minimum) < 0) fail("value_below_minimum", parameter.field_id);
  if (compareRational(canonical, maximum) > 0) fail("value_above_maximum", parameter.field_id);
  return { canonical: rationalToString(canonical), unit: parameter.canonical_unit };
}

function resolveCombination(snapshot) {
  const combination = snapshot.catalog.combination;
  requireExactKeys(combination, [
    "profile_refs",
    "scenario",
    "requested_fidelity",
    "gpu_participation_mode",
    "source_mode",
    "allowed_claim_scope",
  ]);
  const profiles = combination.profile_refs.map((reference) => {
    const profile = snapshot.catalog.profiles.find((candidate) => candidate.profile_id === reference.profile_id);
    if (!profile) fail("unknown_profile", reference.profile_id);
    if (profile.family !== reference.family) fail("profile_family_mismatch", reference.profile_id);
    if (profile.revision !== reference.revision) fail("profile_revision_mismatch", reference.profile_id);
    return profile;
  });
  for (const profile of profiles) {
    const regime = profile.valid_regime;
    if (
      !regime.scenarios.includes(combination.scenario) ||
      !regime.requested_fidelity.includes(combination.requested_fidelity) ||
      !regime.gpu_participation_modes.includes(combination.gpu_participation_mode) ||
      !regime.source_modes.includes(combination.source_mode)
    ) {
      fail("combination_unsupported", profile.profile_id);
    }
  }
  if (
    combination.source_mode === "synthetic_trace" &&
    combination.allowed_claim_scope !== "synthetic_consistency_only"
  ) {
    fail("claim_scope_upgrade_forbidden", combination.allowed_claim_scope);
  }
  return combination;
}

function evaluateCase(caseDefinition) {
  const snapshot = structuredClone(fixture);
  applyMutation(snapshot, caseDefinition.mutation);
  applyMutation(snapshot, caseDefinition.second_mutation);
  if (caseDefinition.mutation || caseDefinition.second_mutation) {
    snapshot.fixture_revision = fixtureDigest(snapshot);
  }
  try {
    validateSnapshot(snapshot);
    let result = null;
    if (caseDefinition.action === "resolve_field") result = resolveField(snapshot, caseDefinition.query);
    else if (caseDefinition.action === "resolve_profile") result = resolveProfile(snapshot, caseDefinition.query);
    else if (caseDefinition.action === "validate_binding") {
      if (caseDefinition.query !== snapshot.catalog.catalog_revision) {
        fail("catalog_revision_mismatch", caseDefinition.query);
      }
    } else if (caseDefinition.action === "validate_value") result = validateValue(snapshot, caseDefinition);
    else if (caseDefinition.action === "resolve_combination") result = resolveCombination(snapshot);
    else if (caseDefinition.action !== "validate_snapshot") fail("case_action_unknown", caseDefinition.action);
    return { accepted: true, canonical: result?.canonical ?? null };
  } catch (error) {
    if (!(error instanceof OracleError)) throw error;
    return { accepted: false, code: error.code };
  }
}

test("fixture is explicitly non-published and canonically revisioned", () => {
  assert.equal(fixture.schema_version, FIXTURE_IDENTITY);
  assert.equal(fixture.publication_status, "proposed_non_published_fixture");
  assert.equal(fixture.fixture_revision, fixtureDigest(fixture));
  assert.equal(fixture.runtime_bindings.create_run_schema_identity, "tilesim.bridge.create_run_request.v1");
  assert.equal(fixture.runtime_bindings.evidence_descriptor_identity, "tilesim.bridge.evidence_agent_descriptor.v2");
  assert.equal(fixture.runtime_bindings.evidence_request_identity, "tilesim.bridge.evidence_agent_request.v1");
  assert.equal(fixture.runtime_bindings.evidence_response_identity, "tilesim.bridge.evidence_agent_response.v1");
  assert.equal(fixture.runtime_bindings.evidence_citation_identity, "tilesim.bridge.evidence_agent_citation.v1");
  assert.equal(fixture.runtime_bindings.evidence_snapshot_identity, "tilesim.bridge.evidence_snapshot_reference.v1");
  validateSnapshot(fixture);
});

test("dataset inventory is unique, partitioned, and contains all mandated risk classes", () => {
  assert.equal(dataset.schema_version, CASE_IDENTITY);
  assert.equal(dataset.publication_status, "proposed_non_published_fixture");
  const ids = dataset.cases.map((caseDefinition) => caseDefinition.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    new Set(dataset.cases.map((caseDefinition) => caseDefinition.split)),
    new Set(["validation", "test", "held_out_adversarial"]),
  );
  for (const required of [
    "unknown-field",
    "unknown-profile",
    "ambiguous-field-alias",
    "profile-expired",
    "profile-revoked",
    "profile-revision-drift",
    "missing-profile-source",
    "missing-valid-regime",
    "calibration-self-claim",
    "held-out-self-claim",
    "uint64-maximum",
    "uint64-overflow",
    "unit-conversion-mbps",
    "minimum-boundary",
    "maximum-boundary",
    "cycle-combination-conflict",
    "unexecuted-agent-exposed",
  ]) {
    assert.ok(ids.includes(required), `Missing mandatory case: ${required}`);
  }
});

test("all proposal cases satisfy the deterministic fail-closed oracle", () => {
  for (const caseDefinition of dataset.cases) {
    const first = evaluateCase(caseDefinition);
    const second = evaluateCase(caseDefinition);
    assert.deepEqual(second, first, `${caseDefinition.id} was not deterministic`);
    if (caseDefinition.expected === "accepted") {
      assert.equal(first.accepted, true, `${caseDefinition.id}: ${first.code}`);
      if (caseDefinition.expected_canonical) {
        assert.equal(first.canonical, caseDefinition.expected_canonical, caseDefinition.id);
      }
    } else {
      assert.deepEqual(first, { accepted: false, code: caseDefinition.expected_code }, caseDefinition.id);
    }
  }
});

test("agent exposure is a strict subset of execution closure", () => {
  const validated = validateSnapshot(fixture);
  const exposed = validated.catalog.parameter_descriptors.filter((parameter) => parameter.status.agent_exposed);
  assert.ok(exposed.length > 0);
  for (const parameter of exposed) {
    assert.equal(parameter.status.accepted, true, parameter.field_id);
    assert.equal(parameter.status.validated, true, parameter.field_id);
    assert.equal(parameter.status.lowered, true, parameter.field_id);
    assert.equal(parameter.status.executed, true, parameter.field_id);
    assert.ok(parameter.lowering.execution_evidence_refs.length > 0, parameter.field_id);
    assert.ok(parameter.evidence_outputs.length > 0, parameter.field_id);
  }
  assert.equal(
    validated.catalog.parameter_descriptors.find(
      (parameter) => parameter.field_id === "s4.device.memory_capacity_bytes",
    ).status.agent_exposed,
    false,
  );
});

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const integratedProposalRoot = path.join(
  repositoryRoot,
  "bridge",
  "contracts",
  "proposals",
  "agent_orchestration_phase0",
);
const proposalRoot = process.env.PHASE0_CONTRACT_PROPOSAL_ROOT || integratedProposalRoot;
const proposalAvailable = fs.existsSync(path.join(proposalRoot, "fixtures", "valid"));

test(
  "independently cross-validates the Contract Agent proposal fixtures when available",
  { skip: proposalAvailable ? false : "proposal fixture is not integrated in this worktree" },
  () => {
    const readProposalJson = (...segments) => JSON.parse(fs.readFileSync(path.join(proposalRoot, ...segments), "utf8"));
    const validRoot = path.join(proposalRoot, "fixtures", "valid");
    const parameter = readProposalJson("fixtures", "valid", "parameter-descriptor.proposal.jsonc");
    const snapshot = readProposalJson("fixtures", "valid", "capability-snapshot.proposal.jsonc");
    const commonSchema = readProposalJson("schemas", "common.schema.proposal.jsonc");
    const reasonCodes = new Set(commonSchema.$defs.reasonCode.enum);
    const profileFiles = fs
      .readdirSync(validRoot)
      .filter((name) => name.endsWith("-profile.proposal.jsonc"))
      .sort();
    const profiles = profileFiles.map((name) => readProposalJson("fixtures", "valid", name));

    assert.equal(parameter.contract_status, "proposal_only");
    assert.match(parameter.schema_version, /^tilesim\.proposal\./);
    assert.equal(parameter.compatibility.successor_identity, null);
    assert.equal(parameter.compatibility.unknown_identity_behavior, "fail_closed");
    assert.equal(parameter.compatibility.unknown_revision_behavior, "fail_closed");
    assert.equal(parameter.canonical_digest, proposalDigest(parameter));
    assert.ok(reasonCodes.has(parameter.status_reason_code));

    const dimensions = parameter.dimensions;
    if (dimensions.agent_exposed.state === "affirmed") {
      for (const key of ["described", "accepted", "validated", "lowered", "executed", "observable"]) {
        assert.equal(dimensions[key].state, "affirmed", `agent_exposed closure: ${key}`);
        assert.ok(dimensions[key].evidence_refs.length > 0, `agent_exposed evidence: ${key}`);
      }
      assert.notEqual(parameter.sensitivity, "secret");
    }
    if (dimensions.executed.state === "affirmed") {
      assert.equal(dimensions.lowered.state, "affirmed");
    }
    if (dimensions.observable.state === "affirmed") {
      assert.equal(dimensions.executed.state, "affirmed");
      assert.ok(parameter.evidence_outputs.length > 0);
    }
    if (dimensions.held_out_validated.state === "affirmed") {
      assert.equal(dimensions.calibrated.state, "affirmed");
    }
    if (parameter.status === "unresolved_not_executed") {
      assert.ok(new Set(["unknown", "denied"]).has(dimensions.executed.state));
      assert.equal(dimensions.agent_exposed.state, "denied");
    }
    for (const dimension of Object.values(dimensions)) {
      assert.ok(reasonCodes.has(dimension.reason_code), dimension.reason_code);
      if (dimension.state === "affirmed") assert.ok(dimension.evidence_refs.length > 0);
    }

    assert.deepEqual(new Set(profiles.map((profile) => profile.profile_family)), new Set(PROFILE_FAMILIES));
    assert.equal(profiles.length, PROFILE_FAMILIES.length);
    for (const profile of profiles) {
      assert.equal(profile.contract_status, "proposal_only", profile.profile_id);
      assert.match(profile.schema_version, /^tilesim\.proposal\./);
      assert.equal(profile.compatibility.successor_identity, null, profile.profile_id);
      assert.equal(profile.compatibility.unknown_identity_behavior, "fail_closed", profile.profile_id);
      assert.equal(profile.compatibility.unknown_revision_behavior, "fail_closed", profile.profile_id);
      assert.ok(profile.sources.length > 0, profile.profile_id);
      assert.ok(profile.valid_regimes.length > 0, profile.profile_id);
      assert.equal(profile.canonical_digest, proposalDigest(profile), profile.profile_id);
      assert.ok(reasonCodes.has(profile.reason_code), profile.profile_id);
      for (const [key, value] of Object.entries(profile)) {
        if (!isObject(value) || !("knowledge_state" in value)) continue;
        if (value.knowledge_state === "known") {
          assert.notEqual(value.value, null, `${profile.profile_id}:${key}`);
          assert.ok(value.evidence_refs.length > 0, `${profile.profile_id}:${key}`);
        } else if (value.knowledge_state === "unknown") {
          assert.equal(value.value, null, `${profile.profile_id}:${key}`);
          assert.equal(value.field_class, "unknown", `${profile.profile_id}:${key}`);
        }
      }
    }

    assert.equal(snapshot.contract_status, "proposal_only");
    assert.match(snapshot.schema_version, /^tilesim\.proposal\./);
    assert.equal(snapshot.compatibility.successor_identity, null);
    assert.equal(snapshot.canonical_digest, proposalDigest(snapshot));
    assert.equal(snapshot.bindings.schema_set_revision, fixture.runtime_bindings.schema_set_revision);
    assert.equal(
      snapshot.bindings.experiment_descriptor_revision,
      fixture.runtime_bindings.experiment_descriptor_revision,
    );
    assert.equal(
      snapshot.bindings.evidence_agent_descriptor_revision,
      fixture.runtime_bindings.evidence_descriptor_revision,
    );
    assert.equal(snapshot.bindings.create_run_schema_identity, "tilesim.bridge.create_run_request.v1");
    assert.equal(snapshot.bindings.evidence_agent_request_identity, "tilesim.bridge.evidence_agent_request.v1");
    assert.equal(snapshot.bindings.evidence_agent_response_identity, "tilesim.bridge.evidence_agent_response.v1");
    assert.equal(snapshot.bindings.evidence_agent_citation_identity, "tilesim.bridge.evidence_agent_citation.v1");
    assert.equal(snapshot.bindings.evidence_agent_snapshot_identity, "tilesim.bridge.evidence_snapshot_reference.v1");

    const profileByFamily = new Map(profiles.map((profile) => [profile.profile_family, profile]));
    for (const family of PROFILE_FAMILIES) {
      for (const reference of snapshot.profiles[family]) {
        const profile = profileByFamily.get(family);
        assert.equal(reference.profile_id, profile.profile_id);
        assert.equal(reference.profile_revision, profile.profile_revision);
        assert.equal(reference.canonical_digest, profile.canonical_digest);
      }
    }
    const descriptorReference = snapshot.parameter_descriptors.find(
      (reference) => reference.field_id === parameter.field_id,
    );
    assert.ok(descriptorReference, parameter.field_id);
    assert.equal(descriptorReference.descriptor_revision, parameter.descriptor_revision);
    assert.equal(descriptorReference.canonical_digest, parameter.canonical_digest);
  },
);
