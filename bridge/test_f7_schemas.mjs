import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const bridgeRoot = path.dirname(fileURLToPath(import.meta.url));
const schemaRoot = path.join(bridgeRoot, "contracts", "schemas");
const readSchema = (name) => JSON.parse(fs.readFileSync(path.join(schemaRoot, name), "utf8"));

const commonSchema = readSchema("f6b-common.schema.json");
const designSpaceSchema = readSchema("design-space-report.schema.json");
const topologySchema = readSchema("topology-input.schema.json");
const metricsSchema = readSchema("metrics-report.schema.json");

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
ajv.addKeyword({ keyword: "tsType", schemaType: "string" });
ajv.addKeyword({ keyword: "x-tilesim-lossless-json-integer", schemaType: "string" });
ajv.addSchema(commonSchema);
const validateDesignSpace = ajv.compile(designSpaceSchema);
const validateTopology = ajv.compile(topologySchema);
const validateMetrics = ajv.compile(metricsSchema);

const runId = "run-f7-schema";
const subject = (kind, id, typedField) => ({ kind, id, [typedField]: id });
const evidence = (artifactId, schemaIdentity, jsonPointer, subjectValue, availability = "available") => ({
  run_id: runId,
  artifact_id: artifactId,
  schema_identity: schemaIdentity,
  json_pointer: jsonPointer,
  availability,
  subject: subjectValue,
});
const clone = (value) => structuredClone(value);
const expectValid = (validator, value) => {
  assert.equal(validator(value), true, JSON.stringify(validator.errors));
};
const expectInvalid = (validator, value) => {
  assert.equal(validator(value), false, "Expected schema validation to fail.");
};

const candidateSubject = subject("candidate", "candidate-a", "candidate_id");
const objectiveSubject = subject("objective", "candidate-a::p99_latency", "objective_id");
const knobSubject = subject("executed_s6_knob", "candidate-a::release_interval", "knob_id");
const candidateRef = evidence("design-space", "tilesim.design_space_report.v1", "/candidates/0", candidateSubject);
const validDesignSpace = {
  schema_version: "tilesim.design_space_report.v1",
  contract_version: "tilesim.design_space_report.v1",
  run_id: runId,
  report_id: "design-space-f7",
  execution_scope: "S6_only",
  provenance: {
    source_mode: "synthetic_trace",
    calibration_level: "uncalibrated",
    allowed_claim_scope: "exploratory_s6_only",
  },
  validation_lane: "synthetic_consistency",
  evidence_tier: "synthetic_consistency",
  claim_scope_summary: "synthetic S6-only consistency",
  pareto_front_id: "pareto-f7",
  objective_set_id: "objectives-f7",
  candidate_count: 1,
  candidates: [
    {
      candidate_id: "candidate-a",
      requested_fidelity: "analytical",
      resolved_fidelity: "analytical",
      subject_refs: [candidateSubject],
      evidence_refs: [candidateRef],
      navigation: {
        navigation_scope: "artifact_record",
        bridge_run_id: null,
        backend_run_instance_id: "backend-candidate-a",
        parent_run_id: runId,
        candidate_id: "candidate-a",
        record_ref: candidateRef,
      },
      pareto_front_id: "pareto-f7",
      objective_set_id: "objectives-f7",
      pareto_member: true,
      dominated_by_candidate_ids: [],
      dominates_candidate_ids: [],
      dominance_status: "non_dominated",
      dominance_reason_code: "no_candidate_strictly_dominates",
      objectives: [
        {
          objective_id: "p99_latency",
          metric_kind: "p99_latency",
          direction: "minimize",
          value: 12.5,
          unit: "us",
          availability: "available",
          evidence_ref: evidence(
            "design-space",
            "tilesim.design_space_report.v1",
            "/candidates/0/objectives/0",
            objectiveSubject,
          ),
        },
      ],
      executed_s6_knobs: [
        {
          knob_id: "release_interval",
          subsystem: "S6",
          value_type: "uint64",
          value: 0,
          unit: "ps",
          availability: "available",
          requested_value: 0,
          resolved_value: 0,
          source_ref: evidence(
            "design-space",
            "tilesim.design_space_report.v1",
            "/candidates/0/executed_s6_knobs/0/requested_value",
            knobSubject,
          ),
          evidence_ref: evidence(
            "design-space",
            "tilesim.design_space_report.v1",
            "/candidates/0/executed_s6_knobs/0/resolved_value",
            knobSubject,
          ),
        },
      ],
    },
  ],
};
expectValid(validateDesignSpace, validDesignSpace);

const invalidDirection = clone(validDesignSpace);
invalidDirection.candidates[0].objectives[0].direction = "sideways";
expectInvalid(validateDesignSpace, invalidDirection);
const missingUnit = clone(validDesignSpace);
delete missingUnit.candidates[0].objectives[0].unit;
expectInvalid(validateDesignSpace, missingUnit);
const invalidUint64 = clone(validDesignSpace);
invalidUint64.candidates[0].executed_s6_knobs[0].value = -1;
expectInvalid(validateDesignSpace, invalidUint64);
const absentKnobWithValue = clone(validDesignSpace);
Object.assign(absentKnobWithValue.candidates[0].executed_s6_knobs[0], {
  availability: "not_applicable",
  value: 0,
  requested_value: null,
  resolved_value: null,
});
expectInvalid(validateDesignSpace, absentKnobWithValue);

const domainSubject = subject("fabric_domain", "so0", "fabric_domain_id");
const provenance = {
  source_mode: "synthetic_trace",
  calibration_level: "uncalibrated",
  allowed_claim_scope: "exploratory_s6_only",
};
const validTopology = {
  schema_version: "tilesim.s6_topology_input.v1",
  run_id: runId,
  provenance,
  topology: {
    topology_name: "f7-schema",
    devices: [],
    module_bindings: [],
    domains: [
      {
        domain_id: "so0",
        domain_type: "scale_out",
        domain_kind: "scale_out",
        subject: domainSubject,
        json_pointer: "/topology/domains/0",
        provenance,
      },
    ],
  },
};
expectValid(validateTopology, validTopology);
const topologyWithoutSubject = clone(validTopology);
delete topologyWithoutSubject.topology.domains[0].subject;
expectInvalid(validateTopology, topologyWithoutSubject);

const validMetrics = {
  schema_version: "tilesim.metrics_report.v1",
  run_id: runId,
  request_metrics: [],
  percentile_subjects: [],
  system_summary: {
    fabric_domain_utilization: [
      {
        domain_id: "so0",
        record_count: 0,
        busy_time_ps: 0,
        observation_window_ps: 0,
        subject_refs: [domainSubject],
        topology_domain_ref: evidence(
          "input-topology",
          "tilesim.s6_topology_input.v1",
          "/topology/domains/0",
          domainSubject,
        ),
      },
    ],
    phase_fabric_contributions: [],
  },
};
expectValid(validateMetrics, validMetrics);
const metricsWithoutTopologyRef = clone(validMetrics);
delete metricsWithoutTopologyRef.system_summary.fabric_domain_utilization[0].topology_domain_ref;
expectInvalid(validateMetrics, metricsWithoutTopologyRef);

console.log("F7 Draft 2020-12 schema positive/negative cases passed.");
