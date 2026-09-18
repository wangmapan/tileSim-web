import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import baseline from "../../bridge/contracts/proposals/agent_orchestration_phase2a/current-formal-baseline.json";
import canonicalVectors from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/canonical/canonical-vectors.json";
import compatibilityMatrix from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/compatibility-matrix.json";
import profileBindingCases from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/invalid/profile-binding-cases.json";
import schemaNegativeCases from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/invalid/schema-negative-cases.json";
import staleValidationCases from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/invalid/stale-validation-report.json";
import semanticCases from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/semantic-cases.json";
import calculatorReceiptFixture from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/valid/calculator-receipt.json";
import deviceProfileFixture from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/valid/device-profile.json";
import engineProfileFixture from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/valid/engine-profile.json";
import retentionFixture from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/valid/idempotency-retention-policy.json";
import modelProfileFixture from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/valid/model-profile.json";
import profileBindingFixture from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/valid/profile-binding.json";
import runIntakeFixture from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/valid/run-intake.json";
import topologyProfileFixture from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/valid/topology-profile.json";
import typedReceiptCases from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/valid/typed-receipt-cases.json";
import validationReportFixture from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/valid/validation-report.json";
import workloadProfileFixture from "../../bridge/contracts/proposals/agent_orchestration_phase2a/fixtures/valid/workload-profile.json";
import manifest from "../../bridge/contracts/proposals/agent_orchestration_phase2a/proposal-manifest.json";
import calculatorReceiptSchema from "../../bridge/contracts/proposals/agent_orchestration_phase2a/schemas/calculator-receipt.schema.proposal.json";
import commonSchema from "../../bridge/contracts/proposals/agent_orchestration_phase2a/schemas/common.schema.proposal.json";
import deviceProfileSchema from "../../bridge/contracts/proposals/agent_orchestration_phase2a/schemas/device-profile.schema.proposal.json";
import engineProfileSchema from "../../bridge/contracts/proposals/agent_orchestration_phase2a/schemas/engine-profile.schema.proposal.json";
import retentionSchema from "../../bridge/contracts/proposals/agent_orchestration_phase2a/schemas/idempotency-retention-policy.schema.proposal.json";
import modelProfileSchema from "../../bridge/contracts/proposals/agent_orchestration_phase2a/schemas/model-profile.schema.proposal.json";
import profileBindingSchema from "../../bridge/contracts/proposals/agent_orchestration_phase2a/schemas/profile-binding.schema.proposal.json";
import runIntakeSchema from "../../bridge/contracts/proposals/agent_orchestration_phase2a/schemas/run-intake.schema.proposal.json";
import topologyProfileSchema from "../../bridge/contracts/proposals/agent_orchestration_phase2a/schemas/topology-profile.schema.proposal.json";
import validationReportSchema from "../../bridge/contracts/proposals/agent_orchestration_phase2a/schemas/validation-report.schema.proposal.json";
import workloadProfileSchema from "../../bridge/contracts/proposals/agent_orchestration_phase2a/schemas/workload-profile.schema.proposal.json";
import catalog from "../../bridge/contracts/agent_orchestration_capability/catalog-content.json";
import createRunSchema from "../../bridge/contracts/schemas/create-run-request.schema.json";
import nestedV2Schema from "../../bridge/contracts/schemas/design-space-candidates-v2.schema.json";
import nestedV1Schema from "../../bridge/contracts/schemas/design-space-candidates.schema.json";
import { canonicalJson, sha256Prefixed } from "../../src/features/evidence-agent/canonical-json";
import frozenCurrentSubset from "../fixtures/phase1-agent-orchestration/frozen-current-subset.json";

const schemaByFile = {
  "model-profile.schema.proposal.json": modelProfileSchema,
  "engine-profile.schema.proposal.json": engineProfileSchema,
  "device-profile.schema.proposal.json": deviceProfileSchema,
  "topology-profile.schema.proposal.json": topologyProfileSchema,
  "workload-profile.schema.proposal.json": workloadProfileSchema,
  "profile-binding.schema.proposal.json": profileBindingSchema,
  "run-intake.schema.proposal.json": runIntakeSchema,
  "calculator-receipt.schema.proposal.json": calculatorReceiptSchema,
  "validation-report.schema.proposal.json": validationReportSchema,
  "idempotency-retention-policy.schema.proposal.json": retentionSchema,
} as const;

const fixtureByFile = {
  "model-profile.json": modelProfileFixture.contract,
  "engine-profile.json": engineProfileFixture.contract,
  "device-profile.json": deviceProfileFixture.contract,
  "topology-profile.json": topologyProfileFixture.contract,
  "workload-profile.json": workloadProfileFixture.contract,
  "profile-binding.json": profileBindingFixture.contract,
  "run-intake.json": runIntakeFixture.contract,
  "calculator-receipt.json": calculatorReceiptFixture.contract,
  "validation-report.json": validationReportFixture.contract,
  "idempotency-retention-policy.json": retentionFixture.contract,
} as const;

function clone(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function mutate(target: Record<string, unknown>, operation: string, pointer: string, value?: unknown): void {
  const tokens = pointer
    .slice(1)
    .split("/")
    .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
  let parent = target;
  for (const token of tokens.slice(0, -1)) parent = parent[token] as Record<string, unknown>;
  const key = tokens.at(-1)!;
  if (operation === "remove") delete parent[key];
  else parent[key] = value;
}

describe("Phase 2A contract proposal", () => {
  const schemas = Object.values(schemaByFile);
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  ajv.addSchema(commonSchema);
  for (const schema of schemas) ajv.addSchema(schema);

  it("strictly validates every positive and negative Schema fixture", () => {
    for (const [schemaFile, fixtureFile] of Object.entries({
      "model-profile.schema.proposal.json": "model-profile.json",
      "engine-profile.schema.proposal.json": "engine-profile.json",
      "device-profile.schema.proposal.json": "device-profile.json",
      "topology-profile.schema.proposal.json": "topology-profile.json",
      "workload-profile.schema.proposal.json": "workload-profile.json",
      "profile-binding.schema.proposal.json": "profile-binding.json",
      "run-intake.schema.proposal.json": "run-intake.json",
      "calculator-receipt.schema.proposal.json": "calculator-receipt.json",
      "validation-report.schema.proposal.json": "validation-report.json",
      "idempotency-retention-policy.schema.proposal.json": "idempotency-retention-policy.json",
    }) as [keyof typeof schemaByFile, keyof typeof fixtureByFile][]) {
      const schema = schemaByFile[schemaFile];
      const validate = ajv.getSchema(schema.$id)!;
      expect(validate(fixtureByFile[fixtureFile]), `${schemaFile}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
    for (const testCase of schemaNegativeCases.cases) {
      const value = clone(fixtureByFile[testCase.base_fixture as keyof typeof fixtureByFile]);
      mutate(value, testCase.operation, testCase.pointer, testCase.value);
      const schema = schemaByFile[testCase.schema as keyof typeof schemaByFile];
      const validate = ajv.getSchema(schema.$id)!;
      expect(validate(value), testCase.case_id).toBe(false);
    }
  });

  it("accepts all seven typed receipt identities and rejects mismatches", () => {
    const validate = ajv.getSchema(calculatorReceiptSchema.$id)!;
    for (const testCase of typedReceiptCases.cases) {
      const value = {
        ...calculatorReceiptFixture.contract,
        receipt_type: testCase.receipt_type,
        receipt_identity: testCase.receipt_identity,
      };
      expect(validate(value), testCase.receipt_type).toBe(true);
      expect(validate({ ...value, receipt_identity: "tilesim.invalid.receipt.v1" }), testCase.receipt_type).toBe(false);
    }
  });

  it("rejects synthetic calibration and held-out self-promotion", () => {
    const validate = ajv.getSchema(workloadProfileSchema.$id)!;
    const base = workloadProfileFixture.contract;
    expect(validate({ ...base, calibration_status: "calibrated" })).toBe(false);
    expect(validate({ ...base, held_out_validation_status: "validated" })).toBe(false);
    expect(validate({ ...base, allowed_claim_scope: "real_calibrated_validation" })).toBe(false);
  });

  it("matches the Python canonical vectors and enforces lossless uint64 boundaries", async () => {
    for (const vector of canonicalVectors.vectors) {
      expect(canonicalJson(vector.value)).toBe(vector.expected_canonical_json);
      expect(await sha256Prefixed(canonicalJson(vector.value))).toBe(vector.expected_sha256);
    }
    const uint64 = /^(0|[1-9][0-9]{0,19})$/u;
    const maximum = 18_446_744_073_709_551_615n;
    for (const testCase of canonicalVectors.uint64_cases) {
      const accepted =
        typeof testCase.value === "string" && uint64.test(testCase.value) && BigInt(testCase.value) <= maximum;
      expect(accepted, JSON.stringify(testCase)).toBe(testCase.expected === "accept");
    }
    for (const fixture of [
      modelProfileFixture,
      engineProfileFixture,
      deviceProfileFixture,
      topologyProfileFixture,
      workloadProfileFixture,
    ]) {
      const material = clone(fixture.contract);
      const expected = material.canonical_digest;
      delete material.profile_revision;
      delete material.canonical_digest;
      expect(await sha256Prefixed(canonicalJson(material))).toBe(expected);
    }
    for (const [contract, digestField] of [
      [profileBindingFixture.contract, "binding_digest"],
      [runIntakeFixture.contract, "canonical_digest"],
      [validationReportFixture.contract, "report_digest"],
    ] as const) {
      const material = clone(contract);
      const expected = material[digestField];
      delete material[digestField];
      expect(await sha256Prefixed(canonicalJson(material))).toBe(expected);
    }
  });

  it("fails closed on identities/revisions and keeps proposal schemas content-addressed", async () => {
    const known = new Map(manifest.contracts.map((contract) => [contract.identity, contract.schema_revision]));
    const resolveContract = (identity: string, revision: string): string => {
      if (!known.has(identity)) return "unknown_contract_identity";
      return known.get(identity) === revision ? "accepted" : "unknown_contract_revision";
    };
    expect(await sha256Prefixed(canonicalJson(commonSchema))).toBe(manifest.shared_schema.schema_revision);
    for (const contract of manifest.contracts) {
      const schemaFile = contract.schema_file.split("/").at(-1)! as keyof typeof schemaByFile;
      const schema = schemaByFile[schemaFile];
      expect(schema["x-tilesim-schema-identity"]).toBe(contract.identity);
      expect(await sha256Prefixed(canonicalJson(schema))).toBe(contract.schema_revision);
      expect(resolveContract(contract.identity, contract.schema_revision)).toBe("accepted");
      expect(resolveContract(contract.identity, `sha256:${"0".repeat(64)}`)).toBe("unknown_contract_revision");
    }
    expect(resolveContract("tilesim.unknown.v999", `sha256:${"0".repeat(64)}`)).toBe("unknown_contract_identity");
  });

  it("keeps compatibility, stale, idempotency, and redaction semantics total", () => {
    expect(compatibilityMatrix.cases).toHaveLength(12);
    expect(new Set(compatibilityMatrix.cases.map((item) => item.scenario)).size).toBe(12);
    expect(compatibilityMatrix.cases.every((item) => item.expected && Object.hasOwn(item, "error_code"))).toBe(true);
    expect(semanticCases.profile_binding_fail_closed).toHaveLength(10);
    expect(semanticCases.stale_triggers).toHaveLength(8);
    expect(semanticCases.idempotency_cases).toHaveLength(6);
    expect(new Set(semanticCases.forbidden_persistence)).toEqual(
      new Set(["credential", "hidden_reasoning", "raw_provider_response"]),
    );
    expect(profileBindingCases.cases.map((item) => item.expected_error)).toEqual(
      semanticCases.profile_binding_fail_closed.map((item) => item.error_code),
    );
    expect(staleValidationCases.cases.map((item) => item.mutation)).toEqual(semanticCases.stale_triggers);
    expect(staleValidationCases.cases.every((item) => item.expected_error === "validation_report_stale")).toBe(true);
  });

  it("detects current formal-contract drift", () => {
    expect(frozenCurrentSubset.local_contract_revision).toBe(baseline.phase1_local_identity);
    expect(frozenCurrentSubset.schema_set_revision).toBe(baseline.schema_set_revision);
    expect(frozenCurrentSubset.catalog_revision).toBe(baseline.capability_catalog.revision);
    expect(frozenCurrentSubset.contract_package_revision).toBe(baseline.capability_catalog.contract_package_revision);
    expect(frozenCurrentSubset.experiment_descriptor_revision).toBe(baseline.experiment_descriptor.revision);
    expect(catalog.schema_identity).toBe(baseline.capability_catalog.identity);
    expect(catalog.catalog_revision).toBe(baseline.capability_catalog.revision);
    expect(catalog.contract_package_revision).toBe(baseline.capability_catalog.contract_package_revision);
    for (const [family, [identity, revision]] of Object.entries(baseline.profile_v1)) {
      const profile = catalog.profile_families.find((item) => item.family === family)!;
      expect([profile.schema_identity, profile.schema_revision]).toEqual([identity, revision]);
      expect(profile.actual_profile_count).toBe(0);
      expect(profile.runtime_availability).toBe("unavailable");
    }
    expect(createRunSchema["x-tilesim-schema-identity"]).toBe(baseline.create_run_identity);
    expect([nestedV1Schema["x-tilesim-schema-identity"], nestedV2Schema["x-tilesim-schema-identity"]]).toEqual(
      baseline.nested_design_space_identities,
    );
  });
});
