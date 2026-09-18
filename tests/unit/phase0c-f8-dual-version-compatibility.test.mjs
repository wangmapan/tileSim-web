import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const fixturePath = fileURLToPath(
  new URL("../fixtures/phase0c-compatibility/f8-dual-version-cases.json", import.meta.url),
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const V1 = "tilesim.design_space.s6_candidates.v1";
const V2 = "tilesim.design_space.s6_candidates.v2";
const CREATE_RUN_V1 = "tilesim.bridge.create_run_request.v1";
const MAX_TRANSFERS = 100000;
const PROMOTION_THRESHOLD = 0.7;

class OracleError extends Error {
  constructor(code, detail = code) {
    super(detail);
    this.code = code;
  }
}

function fail(code, detail) {
  throw new OracleError(code, detail);
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (!Number.isSafeInteger(value) && !Number.isFinite(value))) {
      fail("non_finite_number");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  fail("unsupported_canonical_type");
}

function payloadDigest(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function pointerTokens(pointer) {
  return pointer
    .slice(1)
    .split("/")
    .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function setPointer(value, pointer, replacement) {
  const tokens = pointerTokens(pointer);
  const leaf = tokens.pop();
  let current = value;
  for (const token of tokens) current = current[token];
  current[leaf] = structuredClone(replacement);
}

function buildManifest(identity, mutation = null) {
  const manifest = {
    schema_version: identity,
    manifest_id: "phase0c-compatibility",
    source_mode: "synthetic_trace",
    calibration_level: "uncalibrated",
    allowed_claim_scope: "exploratory",
    candidates: [structuredClone(fixture.base_candidate)],
  };
  if (!mutation) return manifest;
  if (mutation.pointer) {
    setPointer(manifest, mutation.pointer, mutation.value);
  } else if (mutation.operation === "append_risk_distinct_candidate") {
    manifest.candidates.push({
      ...structuredClone(manifest.candidates[0]),
      candidate_id: "candidate-b",
      name: "Candidate B",
      source_id: "phase0c#candidate-b",
      uncertainty_score: 0.9,
      tail_risk: true,
    });
  } else if (mutation.operation === "promoted_request_count") {
    manifest.candidates[0].request_count = mutation.value;
    manifest.candidates[0].uncertainty_score = PROMOTION_THRESHOLD;
  } else {
    fail("unknown_fixture_mutation");
  }
  return manifest;
}

function sixInputKey(candidate) {
  return JSON.stringify([
    candidate.bandwidth_gbps,
    candidate.latency_us,
    candidate.oversubscription_factor,
    candidate.request_count,
    candidate.message_bytes,
    candidate.release_interval_ps,
  ]);
}

function v1InputKey(candidate) {
  return JSON.stringify([
    candidate.bandwidth_gbps,
    candidate.latency_us,
    candidate.oversubscription_factor,
    candidate.request_count,
    candidate.message_bytes,
    candidate.release_interval_ps,
    candidate.uncertainty_score,
    candidate.tail_risk,
  ]);
}

function resolveIdentity(manifest) {
  if (!("schema_version" in manifest)) return V1;
  if (manifest.schema_version === V1 || manifest.schema_version === V2) return manifest.schema_version;
  fail("unknown_nested_identity");
}

function validateManifest(manifest, fidelityPolicy = "des") {
  const identity = resolveIdentity(manifest);
  const candidates = manifest.candidates;
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 256) {
    fail("candidate_cardinality_invalid");
  }
  if (manifest.source_mode !== "synthetic_trace") fail("source_mode_rejected");
  if (identity === V1) {
    if (!new Set(["uncalibrated", "partially_calibrated"]).has(manifest.calibration_level)) {
      fail("v1_calibration_rejected");
    }
    if (
      !new Set([
        "exploratory",
        "exploratory_s6_only",
        "synthetic_consistency",
        "synthetic_consistency_only",
        "workflow_consistency_only",
      ]).has(manifest.allowed_claim_scope)
    ) {
      fail("v1_claim_scope_rejected");
    }
  } else {
    if (manifest.calibration_level !== "uncalibrated") fail("v2_calibration_rejected");
    if (manifest.allowed_claim_scope !== "exploratory") fail("v2_claim_scope_rejected");
  }

  const seenIds = new Set();
  const seenInputs = new Set();
  let total = 0;
  let promoted = 0;
  let topKReserve = 0;
  for (const candidate of candidates) {
    if (seenIds.has(candidate.candidate_id)) fail("duplicate_candidate_id");
    seenIds.add(candidate.candidate_id);
    const minimumOversubscription = identity === V1 ? 0.000001 : 1;
    if (
      typeof candidate.oversubscription_factor !== "number" ||
      candidate.oversubscription_factor < minimumOversubscription
    ) {
      fail(`${identity === V1 ? "v1" : "v2"}_oversubscription_rejected`);
    }
    if (!Number.isInteger(candidate.request_count) || candidate.request_count < 1) {
      fail("request_count_rejected");
    }
    total += candidate.request_count;
    if (total > MAX_TRANSFERS) fail("base_transfer_budget_rejected");
    const key = identity === V1 ? v1InputKey(candidate) : sixInputKey(candidate);
    if (seenInputs.has(key)) fail(`${identity === V1 ? "v1" : "v2"}_duplicate_inputs`);
    seenInputs.add(key);
    if (identity === V2) {
      if (candidate.uncertainty_score >= PROMOTION_THRESHOLD || candidate.tail_risk) {
        promoted += candidate.request_count;
      } else {
        topKReserve = Math.max(topKReserve, candidate.request_count);
      }
    }
  }
  if (identity === V2 && fidelityPolicy === "des" && total + promoted + topKReserve > MAX_TRANSFERS) {
    fail("v2_des_aggregate_budget_rejected");
  }
  if (!("schema_version" in manifest)) manifest.schema_version = V1;
  return { identity, manifest };
}

function outcome(action) {
  try {
    const value = action();
    return { status: "accept", value };
  } catch (error) {
    if (!(error instanceof OracleError)) throw error;
    return { status: "reject", code: error.code };
  }
}

function failureRecord(caseDefinition, oldResult, newResult, expected) {
  return JSON.stringify({
    case_id: caseDefinition.case_id,
    old_result: oldResult,
    new_result: newResult,
    expected_compatibility: expected,
    owning_implementation: caseDefinition.owner,
    blocking: caseDefinition.blocking,
  });
}

function assertCompatibility(caseDefinition, oldResult, newResult, expectedOld, expectedNew) {
  assert.equal(
    oldResult,
    expectedOld,
    failureRecord(caseDefinition, oldResult, newResult, `${expectedOld} -> ${expectedNew}`),
  );
  assert.equal(
    newResult,
    expectedNew,
    failureRecord(caseDefinition, oldResult, newResult, `${expectedOld} -> ${expectedNew}`),
  );
}

function buildRunRequest(version, mutation = null) {
  return {
    scenario_id: "s1_des_example",
    fidelity_policy: "des",
    gpu_participation_mode: "gpu_free",
    design_space_candidates: buildManifest(version === "v1" ? V1 : V2, mutation),
  };
}

class IdempotencyLedger {
  constructor() {
    this.records = new Map();
  }

  retain(key, request, nestedIdentity) {
    this.records.set(key, {
      digest: payloadDigest(request),
      nestedIdentity,
      response: { run_id: `run-${key}`, nested_identity: nestedIdentity },
    });
  }

  submit(key, request) {
    const digest = payloadDigest(request);
    const retained = this.records.get(key);
    if (retained) {
      if (retained.digest !== digest) return { status: 409, code: "idempotency_payload_mismatch" };
      return { status: 200, replay: true, ...retained.response };
    }
    const validated = validateManifest(request.design_space_candidates, request.fidelity_policy);
    const response = {
      run_id: `run-${key}`,
      nested_identity: validated.identity,
    };
    this.records.set(key, { digest, nestedIdentity: validated.identity, response });
    return { status: 202, replay: false, ...response };
  }
}

function runPythonProbe(root, requests) {
  const code = String.raw`
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
sys.path.insert(0, str(root / "bridge"))
from contracts.run_request import validate_run_request
requests = json.loads(sys.stdin.read())
results = []
for request in requests:
    try:
        command = validate_run_request(
            request,
            scenario_ids={"s1_des_example"},
            fidelity_policies={"default", "des"},
            gpu_participation_modes={"gpu_free"},
            capabilities=None,
        )
        manifest = command.design_space_candidates
        identity = None if manifest is None else manifest.get("schema_version")
        explicit = getattr(command, "design_space_schema_identity", None)
        results.append({"status": "accept", "identity": explicit or identity})
    except Exception as error:
        results.append({
            "status": "reject",
            "type": type(error).__name__,
            "field_path": getattr(error, "field_path", None),
            "message": str(error),
        })
print(json.dumps(results, ensure_ascii=False))
`;
  const completed = spawnSync(process.env.PYTHON || "python", ["-c", code, root], {
    input: JSON.stringify(requests),
    encoding: "utf8",
    cwd: root,
  });
  assert.equal(completed.status, 0, completed.stderr);
  return JSON.parse(completed.stdout);
}

function schemaIdentitySet(root) {
  const schemaRoot = join(root, "bridge", "contracts", "schemas");
  const identities = new Set();
  for (const name of readdirSync(schemaRoot)) {
    if (!name.endsWith(".schema.json")) continue;
    const schema = JSON.parse(readFileSync(join(schemaRoot, name), "utf8"));
    const identity = schema["x-tilesim-schema-identity"];
    if (identity === V1 || identity === V2) identities.add(identity);
  }
  return [...identities].sort();
}

function scanGeneratedVersionSet(root) {
  const files = [
    join(root, "src", "contracts", "generated", "create-run-schema.ts"),
    join(root, "src", "contracts", "generated", "experiment-validators.js"),
    join(root, "src", "contracts", "generated", "bridge-contracts.ts"),
  ];
  const text = files
    .filter(existsSync)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  return [V1, V2].filter((identity) => text.includes(identity));
}

function validateDescriptorRevision(observed) {
  if (observed !== fixture.publication_invariants.fixture_known_descriptor_revision) {
    fail("unknown_descriptor_revision");
  }
}

function validateSchemaUnion(root) {
  const schemaRoot = join(root, "bridge", "contracts", "schemas");
  const createRun = JSON.parse(readFileSync(join(schemaRoot, "create-run-request.schema.json"), "utf8"));
  assert.equal(createRun["x-tilesim-schema-identity"], CREATE_RUN_V1);
  const nested = createRun.properties.design_space_candidates;
  assert.deepEqual(nested.oneOf.map((item) => item.$ref).sort(), [
    "design-space-candidates-v2.schema.json",
    "design-space-candidates.schema.json",
  ]);
  const v1 = JSON.parse(readFileSync(join(schemaRoot, "design-space-candidates.schema.json"), "utf8"));
  const v2 = JSON.parse(readFileSync(join(schemaRoot, "design-space-candidates-v2.schema.json"), "utf8"));
  assert.equal(v1["x-tilesim-schema-identity"], V1);
  assert.equal(v2["x-tilesim-schema-identity"], V2);
  assert.equal(v1.required.includes("schema_version"), false);
  assert.equal(v2.required.includes("schema_version"), true);
  assert.equal(v1.properties.schema_version.const, V1);
  assert.equal(v2.properties.schema_version.const, V2);
}

function readDescriptor(root) {
  const code = String.raw`
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
sys.path.insert(0, str(root / "bridge"))
import server
print(json.dumps(server.build_experiment_descriptor(server.SCHEMA_SET_REVISION, server.runtime_capabilities())))
`;
  const completed = spawnSync(process.env.PYTHON || "python", ["-c", code, root], {
    encoding: "utf8",
    cwd: join(root, "bridge"),
  });
  assert.equal(completed.status, 0, completed.stderr);
  return JSON.parse(completed.stdout);
}

function findVersionDeclaration(descriptor) {
  const options = descriptor.design_space_candidate_schema_options;
  if (!Array.isArray(options)) fail("descriptor_version_declaration_missing");
  return {
    versions: options.map((item) => item.schema_identity).sort(),
    defaultVersion: descriptor.default_design_space_candidate_schema_identity,
    omittedDefaults: options.filter((item) => item.default_when_omitted).map((item) => item.schema_identity),
  };
}

test("fixture freezes top-level create-run v1 and a fixed nested v1 default", () => {
  assert.equal(fixture.fixture_status, "fixture_only");
  assert.equal(fixture.top_level_create_run_identity, CREATE_RUN_V1);
  assert.deepEqual(fixture.nested_contract, {
    v1: V1,
    v2: V2,
    default_when_omitted: V1,
    default_rule: "fixed_default_never_payload_inference",
  });
});

for (const caseDefinition of fixture.legacy_cases) {
  test(`old client -> new server v1: ${caseDefinition.case_id}`, () => {
    const oldResult = outcome(() =>
      validateManifest(buildManifest(V1, caseDefinition.mutation), caseDefinition.fidelity_policy),
    ).status;
    const newV1 = outcome(() =>
      validateManifest(buildManifest(V1, caseDefinition.mutation), caseDefinition.fidelity_policy),
    ).status;
    const newV2 = outcome(() =>
      validateManifest(buildManifest(V2, caseDefinition.mutation), caseDefinition.fidelity_policy),
    ).status;
    assertCompatibility(caseDefinition, oldResult, newV1, caseDefinition.old_head, caseDefinition.new_v1);
    assert.equal(newV2, caseDefinition.new_v2, failureRecord(caseDefinition, oldResult, newV2, caseDefinition.new_v2));
  });
}

for (const caseDefinition of fixture.strict_v2_cases) {
  test(`new v2 strict rule: ${caseDefinition.case_id}`, () => {
    const actual = outcome(() =>
      validateManifest(buildManifest(V2, caseDefinition.mutation), caseDefinition.fidelity_policy),
    ).status;
    assert.equal(
      actual,
      caseDefinition.expected,
      failureRecord(caseDefinition, "not_applicable", actual, caseDefinition.expected),
    );
  });
}

test("omitted nested identity always resolves to v1 without payload inference", () => {
  for (const caseDefinition of fixture.routing_cases.filter((item) => item.identity === null)) {
    const manifest = buildManifest(V1);
    delete manifest.schema_version;
    if (caseDefinition.legacy_payload) manifest.allowed_claim_scope = "exploratory_s6_only";
    const resolved = validateManifest(manifest);
    assert.equal(resolved.identity, V1, failureRecord(caseDefinition, null, resolved.identity, V1));
  }
});

test("old server rejects v2 identity and never downgrades it", () => {
  const caseDefinition = fixture.routing_cases.find((item) => item.case_id === "P0C-NEW-V2-TO-OLD-SERVER-REJECT");
  const result = outcome(() => {
    if (buildManifest(V2).schema_version !== V1) fail("unknown_nested_identity");
  });
  assert.deepEqual(result, { status: "reject", code: "unknown_nested_identity" }, failureRecord(caseDefinition));
});

test("unknown nested identity and descriptor revision fail closed", () => {
  const unknown = fixture.routing_cases.find((item) => item.case_id === "P0C-UNKNOWN-NESTED-IDENTITY");
  const result = outcome(() => validateManifest(buildManifest(unknown.identity)));
  assert.deepEqual(result, { status: "reject", code: "unknown_nested_identity" });
  const revision = fixture.routing_cases.find((item) => item.case_id === "P0C-UNKNOWN-DESCRIPTOR-REVISION");
  const revisionResult = outcome(() => validateDescriptorRevision(revision.revision));
  assert.deepEqual(revisionResult, { status: "reject", code: "unknown_descriptor_revision" });
});

test("v1 and v2 identical business fields retain distinct identity and digest", () => {
  const v1 = buildRunRequest("v1");
  const v2 = buildRunRequest("v2");
  assert.notEqual(v1.design_space_candidates.schema_version, v2.design_space_candidates.schema_version);
  assert.notEqual(canonicalJson(v1), canonicalJson(v2));
  assert.notEqual(payloadDigest(v1), payloadDigest(v2));
});

for (const caseDefinition of fixture.idempotency_cases) {
  test(`idempotency: ${caseDefinition.case_id}`, () => {
    const ledger = new IdempotencyLedger();
    const key = "phase0c-key";
    const first = buildRunRequest(caseDefinition.first_version);
    if (caseDefinition.legacy_payload) {
      first.design_space_candidates.allowed_claim_scope = "exploratory_s6_only";
    }
    if (caseDefinition.retained) ledger.retain(key, first, V1);
    else ledger.submit(key, first);

    if (caseDefinition.new_key) {
      const response = ledger.submit("phase0c-new-key", first);
      assert.deepEqual(
        { status: response.status, identity: response.nested_identity },
        { status: 202, identity: V1 },
        failureRecord(caseDefinition),
      );
      return;
    }

    const second = buildRunRequest(caseDefinition.second_version || caseDefinition.first_version);
    if (caseDefinition.second_change)
      setPointer(second, caseDefinition.second_change.pointer, caseDefinition.second_change.value);
    const response = ledger.submit(key, second);
    if (caseDefinition.expected === "409_idempotency_payload_mismatch") {
      assert.deepEqual(
        { status: response.status, code: response.code },
        { status: 409, code: "idempotency_payload_mismatch" },
        failureRecord(caseDefinition),
      );
    } else {
      assert.equal(response.status, 200, failureRecord(caseDefinition));
      assert.equal(response.replay, true, failureRecord(caseDefinition));
      assert.equal(response.nested_identity, V1, failureRecord(caseDefinition));
    }
  });
}

const implementationRoot = process.env.PHASE0C_F8_ROOT;
if (implementationRoot) {
  test("production v1/v2 validators match all independent compatibility cases", () => {
    const requests = [];
    const expected = [];
    for (const caseDefinition of fixture.legacy_cases) {
      for (const [identity, status] of [
        [V1, caseDefinition.new_v1],
        [V2, caseDefinition.new_v2],
      ]) {
        requests.push({
          ...buildRunRequest(identity === V1 ? "v1" : "v2", caseDefinition.mutation),
          fidelity_policy: caseDefinition.fidelity_policy || "des",
        });
        expected.push({ caseDefinition, identity, status });
      }
    }
    for (const caseDefinition of fixture.strict_v2_cases) {
      requests.push({
        ...buildRunRequest("v2", caseDefinition.mutation),
        fidelity_policy: caseDefinition.fidelity_policy || "des",
      });
      expected.push({ caseDefinition, identity: V2, status: caseDefinition.expected });
    }
    const actual = runPythonProbe(implementationRoot, requests);
    actual.forEach((result, index) => {
      assert.equal(
        result.status,
        expected[index].status,
        failureRecord(expected[index].caseDefinition, "fixture_oracle", result, expected[index].status),
      );
      if (result.status === "accept") assert.equal(result.identity, expected[index].identity);
    });
  });

  test("production default is fixed v1 and unknown identities fail closed", () => {
    const omittedLegacy = buildRunRequest("v1");
    delete omittedLegacy.design_space_candidates.schema_version;
    omittedLegacy.design_space_candidates.allowed_claim_scope = "exploratory_s6_only";
    const omittedStrict = buildRunRequest("v1");
    delete omittedStrict.design_space_candidates.schema_version;
    const unknown = buildRunRequest("v1");
    unknown.design_space_candidates.schema_version = "tilesim.design_space.s6_candidates.v999";
    const results = runPythonProbe(implementationRoot, [omittedLegacy, omittedStrict, unknown]);
    assert.deepEqual(
      results.map((item) => [item.status, item.identity]),
      [
        ["accept", V1],
        ["accept", V1],
        ["reject", undefined],
      ],
    );
  });

  test("old HEAD server formally rejects v2 without downgrade", () => {
    const oldRoot = process.env.PHASE0C_OLD_ROOT || resolve(fileURLToPath(new URL("../..", import.meta.url)));
    const [result] = runPythonProbe(oldRoot, [buildRunRequest("v2")]);
    assert.equal(result.status, "reject");
    assert.equal(result.field_path, "/design_space_candidates/schema_version");
  });

  test("descriptor, schemas, and default version agree", () => {
    const expectedVersions = [V1, V2];
    assert.deepEqual(schemaIdentitySet(implementationRoot), expectedVersions);
    const declaration = findVersionDeclaration(readDescriptor(implementationRoot));
    assert.deepEqual(declaration.versions, expectedVersions);
    assert.equal(declaration.defaultVersion, V1);
    assert.deepEqual(declaration.omittedDefaults, [V1]);
  });

  test("bridge/test_f8_schemas retains old fixture semantics and passes", () => {
    const runner = join(implementationRoot, "bridge", "test_f8_schemas.mjs");
    const text = readFileSync(runner, "utf8");
    for (const value of ["partially_calibrated", "exploratory_s6_only", "0.5"]) {
      assert.ok(text.includes(value), `legacy fixture removed: ${value}`);
    }
    const completed = spawnSync(process.execPath, [runner], {
      cwd: implementationRoot,
      encoding: "utf8",
    });
    assert.equal(completed.status, 0, completed.stderr || completed.stdout);
  });
} else {
  test.skip("production v1/v2 validators match all independent compatibility cases", () => {});
  test.skip("production default is fixed v1 and unknown identities fail closed", () => {});
  test.skip("old HEAD server formally rejects v2 without downgrade", () => {});
  test.skip("descriptor, schemas, and default version agree", () => {});
  test.skip("bridge/test_f8_schemas retains old fixture semantics and passes", () => {});
}

const integrationRoot = process.env.PHASE0C_INTEGRATION_ROOT;
if (integrationRoot) {
  test("generated clients publish the same v1/v2 set as schemas and descriptor", () => {
    assert.deepEqual(scanGeneratedVersionSet(integrationRoot), [V1, V2]);
    validateSchemaUnion(integrationRoot);
    const declaration = findVersionDeclaration(readDescriptor(integrationRoot));
    assert.deepEqual(declaration.versions, [V1, V2]);
    assert.equal(declaration.defaultVersion, V1);
    assert.deepEqual(declaration.omittedDefaults, [V1]);
  });
} else {
  test.skip("generated clients publish the same v1/v2 set as schemas and descriptor", () => {});
}
