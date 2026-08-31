// Generated from the F8 Bridge JSON Schemas. Do not edit by hand.

export const createRunRequestSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/create-run-request.schema.json",
  "x-tilesim-schema-identity": "tilesim.bridge.create_run_request.v1",
  title: "CreateRunRequest",
  type: "object",
  additionalProperties: false,
  required: ["scenario_id"],
  properties: {
    scenario_id: {
      enum: ["s1_des_example"],
    },
    fidelity_policy: {
      enum: ["default", "des"],
      default: "des",
    },
    gpu_participation_mode: {
      const: "gpu_free",
      default: "gpu_free",
    },
    run_name: {
      type: ["string", "null"],
      maxLength: 80,
    },
    overrides: {
      $ref: "run-overrides.schema.json",
    },
    custom_inputs: {
      $ref: "custom-run-inputs.schema.json",
    },
    design_space_candidates: {
      $ref: "design-space-candidates.schema.json",
    },
  },
  allOf: [
    {
      not: {
        properties: {
          overrides: {},
          custom_inputs: {},
        },
        required: ["overrides", "custom_inputs"],
      },
    },
  ],
} as const;
export const experimentDescriptorSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/experiment-descriptor.schema.json",
  "x-tilesim-schema-identity": "tilesim.bridge.experiment_descriptor.v1",
  title: "ExperimentDescriptorResponse",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "schema_set_revision",
    "descriptor_id",
    "descriptor_revision",
    "create_run_schema_identity",
    "scenarios",
    "requested_fidelity_options",
    "gpu_participation_modes",
    "input_modes",
    "design_space_modes",
    "source_mode_options",
    "parameter_groups",
    "subsystem_parameter_coverage",
    "parameter_descriptors",
    "resolved_fidelity_source",
  ],
  properties: {
    schema_version: {
      const: "tilesim.bridge.experiment_descriptor.v1",
    },
    schema_set_revision: {
      $ref: "#/$defs/revision",
    },
    descriptor_id: {
      type: "string",
      minLength: 1,
    },
    descriptor_revision: {
      $ref: "#/$defs/revision",
    },
    create_run_schema_identity: {
      const: "tilesim.bridge.create_run_request.v1",
    },
    scenarios: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["scenario_id", "label", "available", "unavailable_reason"],
        properties: {
          scenario_id: {
            type: "string",
            minLength: 1,
          },
          label: {
            type: "string",
            minLength: 1,
          },
          available: {
            type: "boolean",
          },
          unavailable_reason: {
            type: ["string", "null"],
          },
        },
      },
    },
    requested_fidelity_options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fidelity_policy", "requested_tier", "available", "unavailable_reason", "capability_predicate"],
        properties: {
          fidelity_policy: {
            enum: ["default", "des", "cycle"],
          },
          requested_tier: {
            enum: ["policy_default", "DES", "Cycle"],
          },
          available: {
            type: "boolean",
          },
          unavailable_reason: {
            type: ["string", "null"],
          },
          capability_predicate: {
            oneOf: [
              {
                $ref: "#/$defs/capabilityPredicate",
              },
              {
                type: "null",
              },
            ],
          },
        },
      },
    },
    gpu_participation_modes: {
      $ref: "#/$defs/gpuOptions",
    },
    input_modes: {
      $ref: "#/$defs/inputOptions",
    },
    design_space_modes: {
      $ref: "#/$defs/designSpaceOptions",
    },
    source_mode_options: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "source_mode",
          "available",
          "unavailable_reason",
          "allowed_claim_scope",
          "calibration_requirement",
          "applicable_input_modes",
          "capability_predicate",
        ],
        properties: {
          source_mode: {
            enum: ["real_trace", "synthetic_trace", "compatibility_harness_trace"],
          },
          available: {
            type: "boolean",
          },
          unavailable_reason: {
            type: ["string", "null"],
          },
          allowed_claim_scope: {
            type: "string",
            minLength: 1,
          },
          calibration_requirement: {
            type: "string",
            minLength: 1,
          },
          applicable_input_modes: {
            type: "array",
            items: {
              enum: ["controls", "json"],
            },
            uniqueItems: true,
          },
          capability_predicate: {
            oneOf: [
              {
                $ref: "#/$defs/capabilityPredicate",
              },
              {
                type: "null",
              },
            ],
          },
        },
      },
    },
    parameter_groups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["group_id", "subsystem", "display_order", "status"],
        properties: {
          group_id: {
            type: "string",
            minLength: 1,
          },
          subsystem: {
            $ref: "#/$defs/subsystem",
          },
          display_order: {
            type: "integer",
            minimum: 0,
          },
          status: {
            enum: ["exposed", "not_exposed", "unsupported"],
          },
        },
      },
    },
    subsystem_parameter_coverage: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["subsystem", "status", "parameter_field_ids", "reason"],
        properties: {
          subsystem: {
            $ref: "#/$defs/subsystem",
          },
          status: {
            enum: ["exposed", "not_exposed", "unsupported"],
          },
          parameter_field_ids: {
            type: "array",
            items: {
              type: "string",
              minLength: 1,
            },
            uniqueItems: true,
          },
          reason: {
            type: ["string", "null"],
          },
        },
      },
    },
    parameter_descriptors: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: {
        $ref: "#/$defs/parameterDescriptor",
      },
    },
    resolved_fidelity_source: {
      const: "run_execution_envelope_and_validation_reports",
    },
  },
  $defs: {
    revision: {
      type: "string",
      pattern: "^sha256:[0-9a-f]{64}$",
    },
    subsystem: {
      enum: ["S0", "S1", "S2", "S3", "S4", "S5", "S6"],
    },
    capabilityPredicate: {
      type: "object",
      additionalProperties: false,
      required: ["capability_path", "operator", "expected_value", "evaluated_available"],
      properties: {
        capability_path: {
          type: "string",
          pattern: "^/",
        },
        operator: {
          enum: ["equals", "contains"],
        },
        expected_value: {
          type: ["string", "boolean"],
        },
        evaluated_available: {
          type: "boolean",
        },
      },
    },
    gpuOptions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["gpu_participation_mode", "available", "unavailable_reason"],
        properties: {
          gpu_participation_mode: {
            const: "gpu_free",
          },
          available: {
            type: "boolean",
          },
          unavailable_reason: {
            type: ["string", "null"],
          },
        },
      },
    },
    inputOptions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["input_mode", "available", "unavailable_reason"],
        properties: {
          input_mode: {
            enum: ["controls", "json"],
          },
          available: {
            type: "boolean",
          },
          unavailable_reason: {
            type: ["string", "null"],
          },
        },
      },
    },
    designSpaceOptions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["design_space_mode", "available", "unavailable_reason"],
        properties: {
          design_space_mode: {
            enum: ["built_in_synthetic", "strict_s6_manifest"],
          },
          available: {
            type: "boolean",
          },
          unavailable_reason: {
            type: ["string", "null"],
          },
        },
      },
    },
    parameterDescriptor: {
      type: "object",
      additionalProperties: false,
      required: [
        "field_id",
        "subsystem",
        "group_id",
        "display_order",
        "request_json_pointer",
        "value_type",
        "enum_values",
        "minimum",
        "maximum",
        "minimum_inclusive",
        "maximum_inclusive",
        "integer_only",
        "step",
        "unit",
        "required",
        "explicit_default_available",
        "capability_predicate",
        "available",
        "unavailable_reason",
        "applicable_input_modes",
        "applicable_scenarios",
      ],
      properties: {
        field_id: {
          type: "string",
          pattern: "^s[0-6]\\.",
        },
        subsystem: {
          $ref: "#/$defs/subsystem",
        },
        group_id: {
          type: "string",
          minLength: 1,
        },
        display_order: {
          type: "integer",
          minimum: 0,
        },
        request_json_pointer: {
          type: "string",
          pattern: "^/overrides/",
        },
        value_type: {
          enum: ["integer", "number", "boolean", "string", "enum"],
        },
        enum_values: {
          type: "array",
          items: {
            type: "string",
          },
          uniqueItems: true,
        },
        minimum: {
          type: ["integer", "number", "null"],
        },
        maximum: {
          type: ["integer", "number", "null"],
        },
        minimum_inclusive: {
          type: "boolean",
        },
        maximum_inclusive: {
          type: "boolean",
        },
        integer_only: {
          type: "boolean",
        },
        step: {
          type: ["integer", "number", "null"],
        },
        unit: {
          type: "string",
          minLength: 1,
        },
        required: {
          type: "boolean",
        },
        explicit_default_available: {
          type: "boolean",
        },
        default_value: {
          type: ["integer", "number", "boolean", "string", "null"],
        },
        capability_predicate: {
          $ref: "#/$defs/capabilityPredicate",
        },
        available: {
          type: "boolean",
        },
        unavailable_reason: {
          type: ["string", "null"],
        },
        applicable_input_modes: {
          type: "array",
          items: {
            enum: ["controls", "json"],
          },
          uniqueItems: true,
        },
        applicable_scenarios: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
          uniqueItems: true,
        },
      },
    },
  },
} as const;
export const designSpaceCandidatesSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/design-space-candidates.schema.json",
  "x-tilesim-schema-identity": "tilesim.design_space.s6_candidates.v1",
  title: "Strict S6-only design-space candidate manifest",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "manifest_id", "source_mode", "calibration_level", "allowed_claim_scope", "candidates"],
  properties: {
    schema_version: {
      const: "tilesim.design_space.s6_candidates.v1",
    },
    manifest_id: {
      type: "string",
      minLength: 1,
      maxLength: 160,
    },
    source_mode: {
      const: "synthetic_trace",
    },
    calibration_level: {
      enum: ["uncalibrated", "partially_calibrated"],
    },
    allowed_claim_scope: {
      enum: [
        "exploratory",
        "exploratory_s6_only",
        "synthetic_consistency",
        "synthetic_consistency_only",
        "workflow_consistency_only",
      ],
    },
    candidates: {
      type: "array",
      minItems: 1,
      maxItems: 256,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "candidate_id",
          "name",
          "bandwidth_gbps",
          "latency_us",
          "oversubscription_factor",
          "request_count",
          "message_bytes",
          "release_interval_ps",
          "uncertainty_score",
          "tail_risk",
          "source_id",
        ],
        properties: {
          candidate_id: {
            type: "string",
            minLength: 1,
            maxLength: 512,
          },
          name: {
            type: "string",
            minLength: 1,
            maxLength: 512,
          },
          bandwidth_gbps: {
            type: "number",
            minimum: 0.000001,
            maximum: 100000,
          },
          latency_us: {
            type: "number",
            minimum: 0,
            maximum: 1000000,
          },
          oversubscription_factor: {
            type: "number",
            minimum: 0.000001,
            maximum: 1000000,
          },
          request_count: {
            type: "integer",
            minimum: 1,
            maximum: 100000,
          },
          message_bytes: {
            type: "integer",
            minimum: 1,
            maximum: 9007199254740991,
          },
          release_interval_ps: {
            type: "integer",
            minimum: 0,
            maximum: 9007199254740991,
          },
          uncertainty_score: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          tail_risk: {
            type: "boolean",
          },
          promotion_hint: {
            type: "string",
            maxLength: 160,
          },
          source_id: {
            type: "string",
            minLength: 1,
            maxLength: 512,
          },
        },
      },
    },
  },
} as const;
