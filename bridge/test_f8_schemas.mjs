import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const bridgeRoot = path.dirname(fileURLToPath(import.meta.url));
const schemaRoot = path.join(bridgeRoot, "contracts", "schemas");
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const readSchema = (name) => readJson(path.join(schemaRoot, name));

const schemas = [
  "run-overrides.schema.json",
  "runtime-trace-input.schema.json",
  "topology-request-input.schema.json",
  "custom-run-inputs.schema.json",
  "design-space-candidates.schema.json",
  "create-run-request.schema.json",
  "experiment-descriptor.schema.json",
  "trace-package-catalog.schema.json",
  "trace-package-inspect.schema.json",
].map(readSchema);
const schemaByName = Object.fromEntries(schemas.map((schema) => [path.basename(new URL(schema.$id).pathname), schema]));

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
ajv.addKeyword({ keyword: "x-tilesim-schema-identity", schemaType: "string" });
for (const schema of schemas) ajv.addSchema(schema);

const validateCreateRun = ajv.getSchema("https://tilesim.local/contracts/create-run-request.schema.json");
const validateDescriptor = ajv.getSchema("https://tilesim.local/contracts/experiment-descriptor.schema.json");
const validateCandidates = ajv.getSchema("https://tilesim.local/contracts/design-space-candidates.schema.json");
const validateTracePackageCatalog = ajv.getSchema("https://tilesim.local/contracts/trace-package-catalog.schema.json");
const validateTracePackageInspect = ajv.getSchema("https://tilesim.local/contracts/trace-package-inspect.schema.json");
const expectValid = (validator, value) => {
  assert.equal(validator(value), true, JSON.stringify(validator.errors));
};
const expectInvalid = (validator, value) => {
  assert.equal(validator(value), false, "Expected Draft 2020-12 validation to fail.");
};

const validOverrideRequest = {
  scenario_id: "s1_des_example",
  fidelity_policy: "des",
  gpu_participation_mode: "gpu_free",
  overrides: {
    workload: { message_size_multiplier: 1.25 },
    runtime: {
      batch_scheduler: "decode_priority",
      max_batch_size: 4,
      kv_capacity_tokens: 4096,
    },
    fabric: {
      scale_up_bandwidth_gbps: 450,
      scale_up_latency_us: 0.8,
      scale_out_bandwidth_gbps: 200,
      scale_out_latency_us: 4,
    },
  },
};
expectValid(validateCreateRun, validOverrideRequest);
const unknownOverride = structuredClone(validOverrideRequest);
unknownOverride.overrides.fabric.cycle_window = 100;
expectInvalid(validateCreateRun, unknownOverride);
const fractionalInteger = structuredClone(validOverrideRequest);
fractionalInteger.overrides.runtime.max_batch_size = 1.5;
expectInvalid(validateCreateRun, fractionalInteger);

const validCustomRequest = {
  scenario_id: "s1_des_example",
  custom_inputs: {
    runtime_trace: {
      trace_name: "f8",
      trace_provenance: {
        source_mode: "synthetic_trace",
        calibration_level: "uncalibrated",
        allowed_claim_scope: "synthetic_consistency_only",
      },
      policy: { batch_scheduler: "decode_priority" },
      requests: [{ request_id: "request-f8", phase: "decode" }],
    },
    topology: {
      scenario_name: "f8",
      provenance: {
        source_mode: "synthetic_trace",
        calibration_level: "uncalibrated",
        allowed_claim_scope: "synthetic_consistency_only",
      },
      topology: { devices: [], module_bindings: [], domains: [] },
    },
  },
};
expectValid(validateCreateRun, validCustomRequest);
const mixedInputs = structuredClone(validCustomRequest);
mixedInputs.overrides = {};
expectInvalid(validateCreateRun, mixedInputs);
const upgradedSource = structuredClone(validCustomRequest);
upgradedSource.custom_inputs.runtime_trace.trace_provenance.source_mode = "real_trace";
expectInvalid(validateCreateRun, upgradedSource);

const validTracePackageRequest = {
  scenario_id: "s1_des_example",
  trace_package_id: "synthetic-package",
};
expectValid(validateCreateRun, validTracePackageRequest);
for (const field of ["overrides", "custom_inputs", "design_space_candidates"]) {
  const mixed = structuredClone(validTracePackageRequest);
  mixed[field] = field === "custom_inputs" ? validCustomRequest.custom_inputs : {};
  expectInvalid(validateCreateRun, mixed);
}

const validCandidates = {
  schema_version: "tilesim.design_space.s6_candidates.v1",
  manifest_id: "f8-candidates",
  source_mode: "synthetic_trace",
  calibration_level: "uncalibrated",
  allowed_claim_scope: "exploratory_s6_only",
  candidates: [
    {
      candidate_id: "candidate-a",
      name: "Candidate A",
      bandwidth_gbps: 400,
      latency_us: 1,
      oversubscription_factor: 1,
      request_count: 8,
      message_bytes: 1048576,
      release_interval_ps: 100000,
      uncertainty_score: 0.2,
      tail_risk: false,
      source_id: "f8#candidate-a",
    },
  ],
};
expectValid(validateCandidates, validCandidates);
const realCandidates = structuredClone(validCandidates);
realCandidates.source_mode = "real_trace";
expectInvalid(validateCandidates, realCandidates);
const upgradedCalibration = structuredClone(validCandidates);
upgradedCalibration.calibration_level = "held_out_validated";
expectInvalid(validateCandidates, upgradedCalibration);

const python = process.env.PYTHON || "python";
const descriptorProcess = spawnSync(
  python,
  [
    "-c",
    "import json,server; print(json.dumps(server.build_experiment_descriptor(server.SCHEMA_SET_REVISION, server.runtime_capabilities())))",
  ],
  { cwd: bridgeRoot, encoding: "utf8" },
);
assert.equal(descriptorProcess.status, 0, descriptorProcess.stderr);
const descriptor = JSON.parse(descriptorProcess.stdout);
expectValid(validateDescriptor, descriptor);

const fieldIds = descriptor.parameter_descriptors.map((field) => field.field_id);
const pointers = descriptor.parameter_descriptors.map((field) => field.request_json_pointer);
assert.equal(new Set(fieldIds).size, 8);
assert.equal(new Set(pointers).size, 8);
assert.deepEqual(
  new Set(descriptor.parameter_descriptors.map((field) => field.subsystem)),
  new Set(["S0", "S1", "S6"]),
);
assert.equal(descriptor.input_modes.find((item) => item.input_mode === "trace_package").available, true);

const tracePackageItem = {
  package_id: "synthetic-package",
  manifest_sha256: `sha256:${"a".repeat(64)}`,
  inspect_status: "valid",
  inspect_errors: [],
  submission_available: true,
  unavailable_reason: null,
  artifact_integrity: {
    complete: true,
    semantic_artifact_count: 6,
    semantic_roles: ["request", "batch", "iteration", "tile_execution", "kv_cache", "network_flow"],
    sha256_verified: true,
    entry_trace_verified: true,
  },
};
const tracePackageCatalog = {
  schema_version: "tilesim.bridge.trace_package_catalog.v1",
  trace_package_schema_identity: "tilesim.trace_package.v1alpha1",
  schema_set_revision: `sha256:${"1".repeat(64)}`,
  backend_identity: {},
  capability: { available: true, reason: null },
  packages: [tracePackageItem],
  discovery_errors: [],
};
expectValid(validateTracePackageCatalog, tracePackageCatalog);
expectValid(validateTracePackageInspect, {
  schema_version: "tilesim.bridge.trace_package_inspect.v1",
  trace_package_schema_identity: "tilesim.trace_package.v1alpha1",
  schema_set_revision: tracePackageCatalog.schema_set_revision,
  backend_identity: {},
  package: tracePackageItem,
});

const runOverrides = schemaByName["run-overrides.schema.json"];
for (const field of descriptor.parameter_descriptors) {
  const [, root, section, key] = field.request_json_pointer.split("/");
  assert.equal(root, "overrides");
  const property = runOverrides.properties[section].properties[key];
  assert.ok(property, `Pointer does not resolve: ${field.request_json_pointer}`);
  assert.deepEqual(field.enum_values, property.enum || []);
  assert.equal(field.minimum, property.minimum ?? null);
  assert.equal(field.maximum, property.maximum ?? null);
  assert.equal(field.integer_only, property.type === "integer");
}

const coverage = Object.fromEntries(descriptor.subsystem_parameter_coverage.map((item) => [item.subsystem, item]));
for (const subsystem of ["S3", "S4", "S5"]) {
  assert.equal(coverage[subsystem].status, "not_exposed");
  assert.deepEqual(coverage[subsystem].parameter_field_ids, []);
}
assert.equal(descriptor.requested_fidelity_options.find((item) => item.fidelity_policy === "cycle").available, false);
assert.deepEqual(
  descriptor.source_mode_options.filter((item) => item.available).map((item) => item.source_mode),
  ["synthetic_trace"],
);

const openapi = readJson(path.join(bridgeRoot, "contracts", "openapi.json"));
assert.equal(openapi.paths["/experiment-schema"].get.operationId, "experimentSchema");
assert.equal(openapi.paths["/trace-packages"].get.operationId, "tracePackages");
assert.equal(openapi.paths["/trace-packages/{package_id}/inspect"].post.operationId, "inspectTracePackage");
for (const field of ["input_modes", "design_space_modes", "gpu_participation_modes"]) {
  assert.ok(openapi.components.schemas.CatalogResponse.required.includes(field));
}
const runSurface = openapi.components.schemas.CapabilitiesResponse.properties.run_surface;
assert.equal(runSurface.additionalProperties, false);
for (const field of [
  "override_parameter_field_ids",
  "cycle_hotspot_request_available",
  "real_trace_submission_available",
  "compatibility_harness_submission_available",
]) {
  assert.ok(runSurface.required.includes(field));
}

console.log("F8 descriptor, create-run, design-space, and OpenAPI contract cases passed.");
