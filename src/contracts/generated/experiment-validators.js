// Generated Ajv standalone F8 validators. Do not edit by hand.
"use strict";
export const createRunRequest = validate20;
const schema31 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/create-run-request.schema.json",
  "x-tilesim-schema-identity": "tilesim.bridge.create_run_request.v1",
  title: "CreateRunRequest",
  type: "object",
  additionalProperties: false,
  required: ["scenario_id"],
  properties: {
    scenario_id: { enum: ["s1_des_example"] },
    fidelity_policy: { enum: ["default", "des"], default: "des" },
    gpu_participation_mode: { const: "gpu_free", default: "gpu_free" },
    run_name: { type: ["string", "null"], maxLength: 80 },
    overrides: { $ref: "run-overrides.schema.json" },
    custom_inputs: { $ref: "custom-run-inputs.schema.json" },
    design_space_candidates: { $ref: "design-space-candidates.schema.json" },
  },
  allOf: [{ not: { properties: { overrides: {}, custom_inputs: {} }, required: ["overrides", "custom_inputs"] } }],
};
const schema32 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/run-overrides.schema.json",
  "x-tilesim-schema-identity": "tilesim.bridge.run_overrides.v1",
  title: "TileSim controlled S0/S1/S6 run overrides",
  type: "object",
  additionalProperties: false,
  properties: {
    runtime: {
      type: "object",
      additionalProperties: false,
      properties: {
        batch_scheduler: { enum: ["fifo", "decode_priority", "fabric_backpressure_aware"] },
        max_batch_size: { type: "integer", minimum: 1, maximum: 64 },
        kv_capacity_tokens: { type: "integer", minimum: 256, maximum: 1000000 },
      },
    },
    workload: {
      type: "object",
      additionalProperties: false,
      properties: { message_size_multiplier: { type: "number", minimum: 0.25, maximum: 8 } },
    },
    fabric: {
      type: "object",
      additionalProperties: false,
      properties: {
        scale_up_bandwidth_gbps: { type: "number", minimum: 25, maximum: 2000 },
        scale_up_latency_us: { type: "number", minimum: 0.05, maximum: 100 },
        scale_out_bandwidth_gbps: { type: "number", minimum: 10, maximum: 2000 },
        scale_out_latency_us: { type: "number", minimum: 0.1, maximum: 500 },
      },
    },
  },
};
const schema39 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/design-space-candidates.schema.json",
  "x-tilesim-schema-identity": "tilesim.design_space.s6_candidates.v1",
  title: "Strict S6-only design-space candidate manifest",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "manifest_id", "source_mode", "calibration_level", "allowed_claim_scope", "candidates"],
  properties: {
    schema_version: { const: "tilesim.design_space.s6_candidates.v1" },
    manifest_id: { type: "string", minLength: 1, maxLength: 160 },
    source_mode: { const: "synthetic_trace" },
    calibration_level: { enum: ["uncalibrated", "partially_calibrated"] },
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
          candidate_id: { type: "string", minLength: 1, maxLength: 512 },
          name: { type: "string", minLength: 1, maxLength: 512 },
          bandwidth_gbps: { type: "number", minimum: 0.000001, maximum: 100000 },
          latency_us: { type: "number", minimum: 0, maximum: 1000000 },
          oversubscription_factor: { type: "number", minimum: 0.000001, maximum: 1000000 },
          request_count: { type: "integer", minimum: 1, maximum: 100000 },
          message_bytes: { type: "integer", minimum: 1, maximum: 9007199254740991 },
          release_interval_ps: { type: "integer", minimum: 0, maximum: 9007199254740991 },
          uncertainty_score: { type: "number", minimum: 0, maximum: 1 },
          tail_risk: { type: "boolean" },
          promotion_hint: { type: "string", maxLength: 160 },
          source_id: { type: "string", minLength: 1, maxLength: 512 },
        },
      },
    },
  },
};
import func1 from "ajv/dist/runtime/ucs2length";
const func4 = Object.prototype.hasOwnProperty;
const schema33 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/custom-run-inputs.schema.json",
  "x-tilesim-schema-identity": "tilesim.bridge.custom_run_inputs.v1",
  title: "Controlled custom inputs for the hosted S1 to S6 path",
  type: "object",
  additionalProperties: false,
  required: ["runtime_trace", "topology"],
  properties: {
    runtime_trace: { $ref: "runtime-trace-input.schema.json" },
    topology: { $ref: "topology-request-input.schema.json" },
  },
};
const schema34 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/runtime-trace-input.schema.json",
  "x-tilesim-schema-identity": "tilesim.bridge.s1_runtime_trace_input.v1",
  title: "Controlled S1 runtime trace request input",
  type: "object",
  additionalProperties: false,
  required: ["policy", "requests"],
  properties: {
    trace_name: { type: "string", minLength: 1, maxLength: 256 },
    trace_provenance: {
      type: "object",
      additionalProperties: false,
      required: ["source_mode", "calibration_level", "allowed_claim_scope"],
      properties: {
        source_mode: { const: "synthetic_trace" },
        calibration_level: { enum: ["uncalibrated", "partially_calibrated"] },
        allowed_claim_scope: {
          enum: [
            "exploratory",
            "exploratory_s6_only",
            "synthetic_consistency",
            "synthetic_consistency_only",
            "workflow_consistency_only",
          ],
        },
        source_id: { type: "string", maxLength: 512 },
        generation_path: { type: "string", maxLength: 512 },
        capture_or_generation_time: { type: "string", maxLength: 160 },
        upstream_tooling: { type: "string", maxLength: 160 },
        trace_kind: { type: "string", maxLength: 160 },
        notes: { type: "array", items: { type: "string", maxLength: 512 }, maxItems: 64 },
      },
    },
    policy: {
      type: "object",
      additionalProperties: false,
      properties: {
        kv_capacity_tokens: { type: "integer", minimum: 0, maximum: 9007199254740991 },
        initial_kv_tokens: { type: "integer", minimum: 0, maximum: 9007199254740991 },
        max_active_requests: { type: "integer", minimum: 0, maximum: 1024 },
        max_batch_size: { type: "integer", minimum: 0, maximum: 1024 },
        batch_scheduler: { enum: ["fifo", "decode_priority", "fabric_backpressure_aware"] },
        prefill_starvation_threshold_ps: { type: "integer", minimum: 0, maximum: 9007199254740991 },
        pd_handoff_delay_ps: { type: "integer", minimum: 0, maximum: 9007199254740991 },
        pd_handoff_queue_service_ps: { type: "integer", minimum: 0, maximum: 9007199254740991 },
        kv_page_size_tokens: { type: "integer", minimum: 0, maximum: 9007199254740991 },
        kv_fragmentation_overhead: { type: "number", minimum: 0 },
        kv_admission_watermark: { type: "number", minimum: 0, maximum: 1 },
        fabric_backpressure_active: { type: "boolean" },
        fabric_backpressure_delay_us: { type: "number", minimum: 0 },
        fabric_backpressure_throttle_threshold_us: { type: "number", minimum: 0 },
        fabric_backpressure_prefill_batch_limit: { type: "integer", minimum: 0, maximum: 1024 },
        long_context_threshold_tokens: { type: "integer", minimum: 0, maximum: 9007199254740991 },
        decode_penalty_per_threshold: { type: "number", minimum: 0 },
      },
    },
    requests: {
      type: "array",
      minItems: 1,
      maxItems: 1024,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["request_id"],
        properties: {
          request_id: { type: "string", minLength: 1, maxLength: 256 },
          model_id: { type: "string", maxLength: 256 },
          arrival_time_ps: { type: "integer", minimum: 0, maximum: 9007199254740991 },
          phase: { enum: ["prefill", "decode"] },
          prompt_tokens: { type: "integer", minimum: 0, maximum: 9007199254740991 },
          decode_tokens: { type: "integer", minimum: 0, maximum: 9007199254740991 },
          kv_tokens: { type: "integer", minimum: 0, maximum: 9007199254740991 },
          priority_class: { type: "integer" },
          tp_degree: { type: "integer", minimum: 1, maximum: 1024 },
          participants: { type: "array", items: { type: "string", minLength: 1 }, maxItems: 1024 },
          collective_type: { type: "string", maxLength: 160 },
          message_size_bytes: { type: "integer", minimum: 0, maximum: 9007199254740991 },
          placement_group_id: { type: "string", maxLength: 256 },
          disaggregation_group_id: { type: "string", maxLength: 256 },
          kv_handoff_id: { type: "string", maxLength: 256 },
        },
      },
    },
  },
};
const schema35 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/topology-request-input.schema.json",
  "x-tilesim-schema-identity": "tilesim.bridge.s6_topology_request_input.v1",
  title: "Controlled pre-materialization S6 topology request input",
  type: "object",
  additionalProperties: false,
  required: ["topology"],
  properties: {
    scenario_name: { type: "string", minLength: 1, maxLength: 256 },
    provenance: {
      type: "object",
      additionalProperties: false,
      required: ["source_mode", "calibration_level", "allowed_claim_scope"],
      properties: {
        source_mode: { const: "synthetic_trace" },
        calibration_level: { enum: ["uncalibrated", "partially_calibrated"] },
        allowed_claim_scope: {
          enum: [
            "exploratory",
            "exploratory_s6_only",
            "synthetic_consistency",
            "synthetic_consistency_only",
            "workflow_consistency_only",
          ],
        },
      },
    },
    topology: {
      type: "object",
      additionalProperties: false,
      required: ["devices", "module_bindings", "domains"],
      properties: {
        topology_name: { type: "string", minLength: 1, maxLength: 256 },
        routing_policies: { $ref: "#/$defs/stringMap" },
        transport_policies: { $ref: "#/$defs/stringMap" },
        calibration_profiles: { $ref: "#/$defs/stringMap" },
        devices: {
          type: "array",
          maxItems: 1024,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["device_id"],
            properties: {
              device_id: { type: "string", minLength: 1, maxLength: 256 },
              device_type: { type: "string", maxLength: 160 },
              group_id: { type: "string", maxLength: 256 },
            },
          },
        },
        links: {
          type: "array",
          maxItems: 100000,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["src_device", "dst_device", "domain_id"],
            properties: {
              src_device: { type: "string", minLength: 1, maxLength: 256 },
              dst_device: { type: "string", minLength: 1, maxLength: 256 },
              domain_id: { type: "string", minLength: 1, maxLength: 256 },
              bandwidth_gbps: { type: "number", minimum: 0, maximum: 100000 },
              latency_us: { type: "number", minimum: 0, maximum: 1000000 },
            },
          },
        },
        module_bindings: {
          type: "array",
          maxItems: 64,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["module_name", "module_kind"],
            properties: {
              module_name: { type: "string", minLength: 1, maxLength: 256 },
              module_version: { type: "string", maxLength: 80 },
              module_kind: { enum: ["scale_up", "scale_out"] },
              config_profile: { type: "string", maxLength: 160 },
              override_params: {
                type: "object",
                additionalProperties: false,
                properties: {
                  bandwidth_gbps: { type: "number", exclusiveMinimum: 0, maximum: 100000 },
                  latency_us: { type: "number", minimum: 0, maximum: 1000000 },
                  queue_factor: { type: "number", minimum: 0, maximum: 1000000 },
                  oversubscription_factor: { type: "number", minimum: 1, maximum: 1000000 },
                },
              },
            },
          },
        },
        domains: {
          type: "array",
          maxItems: 64,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["domain_id", "domain_type", "member_devices", "module_binding"],
            properties: {
              domain_id: { type: "string", minLength: 1, maxLength: 256 },
              domain_type: { enum: ["scale_up", "scale_out"] },
              member_devices: { type: "array", items: { type: "string", minLength: 1 }, maxItems: 1024 },
              module_binding: { type: "string", minLength: 1, maxLength: 256 },
              default_fidelity: { enum: ["analytical", "des"] },
              failure_policy: { enum: ["fallback", "fail_closed"] },
            },
          },
        },
      },
    },
    workload: {
      type: "object",
      additionalProperties: false,
      required: ["requests"],
      properties: {
        requests: {
          type: "array",
          maxItems: 100000,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["request_id"],
            properties: {
              request_id: { type: "string", minLength: 1, maxLength: 256 },
              batch_id: { type: "string", maxLength: 256 },
              phase: { enum: ["prefill", "decode"] },
              collective_type: { type: "string", maxLength: 160 },
              message_size_bytes: { type: "integer", minimum: 0, maximum: 9007199254740991 },
              message_size_mb: { type: "number", minimum: 0 },
              tp_degree: { type: "integer", minimum: 1, maximum: 1024 },
              participants: { type: "array", items: { type: "string", minLength: 1 }, maxItems: 1024 },
              release_time_ps: { type: "integer", minimum: 0, maximum: 9007199254740991 },
              memory_latency_ps: { type: "integer", minimum: 0, maximum: 9007199254740991 },
              device_latency_ps: { type: "integer", minimum: 0, maximum: 9007199254740991 },
            },
          },
        },
      },
    },
  },
  $defs: { stringMap: { type: "object", additionalProperties: { type: ["string", "number", "boolean"] } } },
};
const schema36 = { type: "object", additionalProperties: { type: ["string", "number", "boolean"] } };
function validate22(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/topology-request-input.schema.json" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.topology === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "topology" },
        message: "must have required property '" + "topology" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "scenario_name" || key0 === "provenance" || key0 === "topology" || key0 === "workload")) {
        const err1 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.scenario_name !== undefined) {
      let data0 = data.scenario_name;
      if (typeof data0 === "string") {
        if (func1(data0) > 256) {
          const err2 = {
            instancePath: instancePath + "/scenario_name",
            schemaPath: "#/properties/scenario_name/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (func1(data0) < 1) {
          const err3 = {
            instancePath: instancePath + "/scenario_name",
            schemaPath: "#/properties/scenario_name/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = {
          instancePath: instancePath + "/scenario_name",
          schemaPath: "#/properties/scenario_name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.provenance !== undefined) {
      let data1 = data.provenance;
      if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
        if (data1.source_mode === undefined) {
          const err5 = {
            instancePath: instancePath + "/provenance",
            schemaPath: "#/properties/provenance/required",
            keyword: "required",
            params: { missingProperty: "source_mode" },
            message: "must have required property '" + "source_mode" + "'",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (data1.calibration_level === undefined) {
          const err6 = {
            instancePath: instancePath + "/provenance",
            schemaPath: "#/properties/provenance/required",
            keyword: "required",
            params: { missingProperty: "calibration_level" },
            message: "must have required property '" + "calibration_level" + "'",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (data1.allowed_claim_scope === undefined) {
          const err7 = {
            instancePath: instancePath + "/provenance",
            schemaPath: "#/properties/provenance/required",
            keyword: "required",
            params: { missingProperty: "allowed_claim_scope" },
            message: "must have required property '" + "allowed_claim_scope" + "'",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        for (const key1 in data1) {
          if (!(key1 === "source_mode" || key1 === "calibration_level" || key1 === "allowed_claim_scope")) {
            const err8 = {
              instancePath: instancePath + "/provenance",
              schemaPath: "#/properties/provenance/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
          }
        }
        if (data1.source_mode !== undefined) {
          if ("synthetic_trace" !== data1.source_mode) {
            const err9 = {
              instancePath: instancePath + "/provenance/source_mode",
              schemaPath: "#/properties/provenance/properties/source_mode/const",
              keyword: "const",
              params: { allowedValue: "synthetic_trace" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
        if (data1.calibration_level !== undefined) {
          let data3 = data1.calibration_level;
          if (!(data3 === "uncalibrated" || data3 === "partially_calibrated")) {
            const err10 = {
              instancePath: instancePath + "/provenance/calibration_level",
              schemaPath: "#/properties/provenance/properties/calibration_level/enum",
              keyword: "enum",
              params: { allowedValues: schema35.properties.provenance.properties.calibration_level.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err10];
            } else {
              vErrors.push(err10);
            }
            errors++;
          }
        }
        if (data1.allowed_claim_scope !== undefined) {
          let data4 = data1.allowed_claim_scope;
          if (!(
            data4 === "exploratory" ||
            data4 === "exploratory_s6_only" ||
            data4 === "synthetic_consistency" ||
            data4 === "synthetic_consistency_only" ||
            data4 === "workflow_consistency_only"
          )) {
            const err11 = {
              instancePath: instancePath + "/provenance/allowed_claim_scope",
              schemaPath: "#/properties/provenance/properties/allowed_claim_scope/enum",
              keyword: "enum",
              params: { allowedValues: schema35.properties.provenance.properties.allowed_claim_scope.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err11];
            } else {
              vErrors.push(err11);
            }
            errors++;
          }
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/provenance",
          schemaPath: "#/properties/provenance/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.topology !== undefined) {
      let data5 = data.topology;
      if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
        if (data5.devices === undefined) {
          const err13 = {
            instancePath: instancePath + "/topology",
            schemaPath: "#/properties/topology/required",
            keyword: "required",
            params: { missingProperty: "devices" },
            message: "must have required property '" + "devices" + "'",
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (data5.module_bindings === undefined) {
          const err14 = {
            instancePath: instancePath + "/topology",
            schemaPath: "#/properties/topology/required",
            keyword: "required",
            params: { missingProperty: "module_bindings" },
            message: "must have required property '" + "module_bindings" + "'",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (data5.domains === undefined) {
          const err15 = {
            instancePath: instancePath + "/topology",
            schemaPath: "#/properties/topology/required",
            keyword: "required",
            params: { missingProperty: "domains" },
            message: "must have required property '" + "domains" + "'",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        for (const key2 in data5) {
          if (!(
            key2 === "topology_name" ||
            key2 === "routing_policies" ||
            key2 === "transport_policies" ||
            key2 === "calibration_profiles" ||
            key2 === "devices" ||
            key2 === "links" ||
            key2 === "module_bindings" ||
            key2 === "domains"
          )) {
            const err16 = {
              instancePath: instancePath + "/topology",
              schemaPath: "#/properties/topology/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
        }
        if (data5.topology_name !== undefined) {
          let data6 = data5.topology_name;
          if (typeof data6 === "string") {
            if (func1(data6) > 256) {
              const err17 = {
                instancePath: instancePath + "/topology/topology_name",
                schemaPath: "#/properties/topology/properties/topology_name/maxLength",
                keyword: "maxLength",
                params: { limit: 256 },
                message: "must NOT have more than 256 characters",
              };
              if (vErrors === null) {
                vErrors = [err17];
              } else {
                vErrors.push(err17);
              }
              errors++;
            }
            if (func1(data6) < 1) {
              const err18 = {
                instancePath: instancePath + "/topology/topology_name",
                schemaPath: "#/properties/topology/properties/topology_name/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
            }
          } else {
            const err19 = {
              instancePath: instancePath + "/topology/topology_name",
              schemaPath: "#/properties/topology/properties/topology_name/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err19];
            } else {
              vErrors.push(err19);
            }
            errors++;
          }
        }
        if (data5.routing_policies !== undefined) {
          let data7 = data5.routing_policies;
          if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
            for (const key3 in data7) {
              let data8 = data7[key3];
              if (typeof data8 !== "string" && !(typeof data8 == "number") && typeof data8 !== "boolean") {
                const err20 = {
                  instancePath:
                    instancePath + "/topology/routing_policies/" + key3.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath: "#/$defs/stringMap/additionalProperties/type",
                  keyword: "type",
                  params: { type: schema36.additionalProperties.type },
                  message: "must be string,number,boolean",
                };
                if (vErrors === null) {
                  vErrors = [err20];
                } else {
                  vErrors.push(err20);
                }
                errors++;
              }
            }
          } else {
            const err21 = {
              instancePath: instancePath + "/topology/routing_policies",
              schemaPath: "#/$defs/stringMap/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          }
        }
        if (data5.transport_policies !== undefined) {
          let data9 = data5.transport_policies;
          if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
            for (const key4 in data9) {
              let data10 = data9[key4];
              if (typeof data10 !== "string" && !(typeof data10 == "number") && typeof data10 !== "boolean") {
                const err22 = {
                  instancePath:
                    instancePath + "/topology/transport_policies/" + key4.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath: "#/$defs/stringMap/additionalProperties/type",
                  keyword: "type",
                  params: { type: schema36.additionalProperties.type },
                  message: "must be string,number,boolean",
                };
                if (vErrors === null) {
                  vErrors = [err22];
                } else {
                  vErrors.push(err22);
                }
                errors++;
              }
            }
          } else {
            const err23 = {
              instancePath: instancePath + "/topology/transport_policies",
              schemaPath: "#/$defs/stringMap/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
        if (data5.calibration_profiles !== undefined) {
          let data11 = data5.calibration_profiles;
          if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
            for (const key5 in data11) {
              let data12 = data11[key5];
              if (typeof data12 !== "string" && !(typeof data12 == "number") && typeof data12 !== "boolean") {
                const err24 = {
                  instancePath:
                    instancePath + "/topology/calibration_profiles/" + key5.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath: "#/$defs/stringMap/additionalProperties/type",
                  keyword: "type",
                  params: { type: schema36.additionalProperties.type },
                  message: "must be string,number,boolean",
                };
                if (vErrors === null) {
                  vErrors = [err24];
                } else {
                  vErrors.push(err24);
                }
                errors++;
              }
            }
          } else {
            const err25 = {
              instancePath: instancePath + "/topology/calibration_profiles",
              schemaPath: "#/$defs/stringMap/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
        }
        if (data5.devices !== undefined) {
          let data13 = data5.devices;
          if (Array.isArray(data13)) {
            if (data13.length > 1024) {
              const err26 = {
                instancePath: instancePath + "/topology/devices",
                schemaPath: "#/properties/topology/properties/devices/maxItems",
                keyword: "maxItems",
                params: { limit: 1024 },
                message: "must NOT have more than 1024 items",
              };
              if (vErrors === null) {
                vErrors = [err26];
              } else {
                vErrors.push(err26);
              }
              errors++;
            }
            const len0 = data13.length;
            for (let i0 = 0; i0 < len0; i0++) {
              let data14 = data13[i0];
              if (data14 && typeof data14 == "object" && !Array.isArray(data14)) {
                if (data14.device_id === undefined) {
                  const err27 = {
                    instancePath: instancePath + "/topology/devices/" + i0,
                    schemaPath: "#/properties/topology/properties/devices/items/required",
                    keyword: "required",
                    params: { missingProperty: "device_id" },
                    message: "must have required property '" + "device_id" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err27];
                  } else {
                    vErrors.push(err27);
                  }
                  errors++;
                }
                for (const key6 in data14) {
                  if (!(key6 === "device_id" || key6 === "device_type" || key6 === "group_id")) {
                    const err28 = {
                      instancePath: instancePath + "/topology/devices/" + i0,
                      schemaPath: "#/properties/topology/properties/devices/items/additionalProperties",
                      keyword: "additionalProperties",
                      params: { additionalProperty: key6 },
                      message: "must NOT have additional properties",
                    };
                    if (vErrors === null) {
                      vErrors = [err28];
                    } else {
                      vErrors.push(err28);
                    }
                    errors++;
                  }
                }
                if (data14.device_id !== undefined) {
                  let data15 = data14.device_id;
                  if (typeof data15 === "string") {
                    if (func1(data15) > 256) {
                      const err29 = {
                        instancePath: instancePath + "/topology/devices/" + i0 + "/device_id",
                        schemaPath: "#/properties/topology/properties/devices/items/properties/device_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err29];
                      } else {
                        vErrors.push(err29);
                      }
                      errors++;
                    }
                    if (func1(data15) < 1) {
                      const err30 = {
                        instancePath: instancePath + "/topology/devices/" + i0 + "/device_id",
                        schemaPath: "#/properties/topology/properties/devices/items/properties/device_id/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err30];
                      } else {
                        vErrors.push(err30);
                      }
                      errors++;
                    }
                  } else {
                    const err31 = {
                      instancePath: instancePath + "/topology/devices/" + i0 + "/device_id",
                      schemaPath: "#/properties/topology/properties/devices/items/properties/device_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err31];
                    } else {
                      vErrors.push(err31);
                    }
                    errors++;
                  }
                }
                if (data14.device_type !== undefined) {
                  let data16 = data14.device_type;
                  if (typeof data16 === "string") {
                    if (func1(data16) > 160) {
                      const err32 = {
                        instancePath: instancePath + "/topology/devices/" + i0 + "/device_type",
                        schemaPath: "#/properties/topology/properties/devices/items/properties/device_type/maxLength",
                        keyword: "maxLength",
                        params: { limit: 160 },
                        message: "must NOT have more than 160 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err32];
                      } else {
                        vErrors.push(err32);
                      }
                      errors++;
                    }
                  } else {
                    const err33 = {
                      instancePath: instancePath + "/topology/devices/" + i0 + "/device_type",
                      schemaPath: "#/properties/topology/properties/devices/items/properties/device_type/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err33];
                    } else {
                      vErrors.push(err33);
                    }
                    errors++;
                  }
                }
                if (data14.group_id !== undefined) {
                  let data17 = data14.group_id;
                  if (typeof data17 === "string") {
                    if (func1(data17) > 256) {
                      const err34 = {
                        instancePath: instancePath + "/topology/devices/" + i0 + "/group_id",
                        schemaPath: "#/properties/topology/properties/devices/items/properties/group_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err34];
                      } else {
                        vErrors.push(err34);
                      }
                      errors++;
                    }
                  } else {
                    const err35 = {
                      instancePath: instancePath + "/topology/devices/" + i0 + "/group_id",
                      schemaPath: "#/properties/topology/properties/devices/items/properties/group_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err35];
                    } else {
                      vErrors.push(err35);
                    }
                    errors++;
                  }
                }
              } else {
                const err36 = {
                  instancePath: instancePath + "/topology/devices/" + i0,
                  schemaPath: "#/properties/topology/properties/devices/items/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                };
                if (vErrors === null) {
                  vErrors = [err36];
                } else {
                  vErrors.push(err36);
                }
                errors++;
              }
            }
          } else {
            const err37 = {
              instancePath: instancePath + "/topology/devices",
              schemaPath: "#/properties/topology/properties/devices/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err37];
            } else {
              vErrors.push(err37);
            }
            errors++;
          }
        }
        if (data5.links !== undefined) {
          let data18 = data5.links;
          if (Array.isArray(data18)) {
            if (data18.length > 100000) {
              const err38 = {
                instancePath: instancePath + "/topology/links",
                schemaPath: "#/properties/topology/properties/links/maxItems",
                keyword: "maxItems",
                params: { limit: 100000 },
                message: "must NOT have more than 100000 items",
              };
              if (vErrors === null) {
                vErrors = [err38];
              } else {
                vErrors.push(err38);
              }
              errors++;
            }
            const len1 = data18.length;
            for (let i1 = 0; i1 < len1; i1++) {
              let data19 = data18[i1];
              if (data19 && typeof data19 == "object" && !Array.isArray(data19)) {
                if (data19.src_device === undefined) {
                  const err39 = {
                    instancePath: instancePath + "/topology/links/" + i1,
                    schemaPath: "#/properties/topology/properties/links/items/required",
                    keyword: "required",
                    params: { missingProperty: "src_device" },
                    message: "must have required property '" + "src_device" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err39];
                  } else {
                    vErrors.push(err39);
                  }
                  errors++;
                }
                if (data19.dst_device === undefined) {
                  const err40 = {
                    instancePath: instancePath + "/topology/links/" + i1,
                    schemaPath: "#/properties/topology/properties/links/items/required",
                    keyword: "required",
                    params: { missingProperty: "dst_device" },
                    message: "must have required property '" + "dst_device" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err40];
                  } else {
                    vErrors.push(err40);
                  }
                  errors++;
                }
                if (data19.domain_id === undefined) {
                  const err41 = {
                    instancePath: instancePath + "/topology/links/" + i1,
                    schemaPath: "#/properties/topology/properties/links/items/required",
                    keyword: "required",
                    params: { missingProperty: "domain_id" },
                    message: "must have required property '" + "domain_id" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err41];
                  } else {
                    vErrors.push(err41);
                  }
                  errors++;
                }
                for (const key7 in data19) {
                  if (!(
                    key7 === "src_device" ||
                    key7 === "dst_device" ||
                    key7 === "domain_id" ||
                    key7 === "bandwidth_gbps" ||
                    key7 === "latency_us"
                  )) {
                    const err42 = {
                      instancePath: instancePath + "/topology/links/" + i1,
                      schemaPath: "#/properties/topology/properties/links/items/additionalProperties",
                      keyword: "additionalProperties",
                      params: { additionalProperty: key7 },
                      message: "must NOT have additional properties",
                    };
                    if (vErrors === null) {
                      vErrors = [err42];
                    } else {
                      vErrors.push(err42);
                    }
                    errors++;
                  }
                }
                if (data19.src_device !== undefined) {
                  let data20 = data19.src_device;
                  if (typeof data20 === "string") {
                    if (func1(data20) > 256) {
                      const err43 = {
                        instancePath: instancePath + "/topology/links/" + i1 + "/src_device",
                        schemaPath: "#/properties/topology/properties/links/items/properties/src_device/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err43];
                      } else {
                        vErrors.push(err43);
                      }
                      errors++;
                    }
                    if (func1(data20) < 1) {
                      const err44 = {
                        instancePath: instancePath + "/topology/links/" + i1 + "/src_device",
                        schemaPath: "#/properties/topology/properties/links/items/properties/src_device/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err44];
                      } else {
                        vErrors.push(err44);
                      }
                      errors++;
                    }
                  } else {
                    const err45 = {
                      instancePath: instancePath + "/topology/links/" + i1 + "/src_device",
                      schemaPath: "#/properties/topology/properties/links/items/properties/src_device/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err45];
                    } else {
                      vErrors.push(err45);
                    }
                    errors++;
                  }
                }
                if (data19.dst_device !== undefined) {
                  let data21 = data19.dst_device;
                  if (typeof data21 === "string") {
                    if (func1(data21) > 256) {
                      const err46 = {
                        instancePath: instancePath + "/topology/links/" + i1 + "/dst_device",
                        schemaPath: "#/properties/topology/properties/links/items/properties/dst_device/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err46];
                      } else {
                        vErrors.push(err46);
                      }
                      errors++;
                    }
                    if (func1(data21) < 1) {
                      const err47 = {
                        instancePath: instancePath + "/topology/links/" + i1 + "/dst_device",
                        schemaPath: "#/properties/topology/properties/links/items/properties/dst_device/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err47];
                      } else {
                        vErrors.push(err47);
                      }
                      errors++;
                    }
                  } else {
                    const err48 = {
                      instancePath: instancePath + "/topology/links/" + i1 + "/dst_device",
                      schemaPath: "#/properties/topology/properties/links/items/properties/dst_device/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err48];
                    } else {
                      vErrors.push(err48);
                    }
                    errors++;
                  }
                }
                if (data19.domain_id !== undefined) {
                  let data22 = data19.domain_id;
                  if (typeof data22 === "string") {
                    if (func1(data22) > 256) {
                      const err49 = {
                        instancePath: instancePath + "/topology/links/" + i1 + "/domain_id",
                        schemaPath: "#/properties/topology/properties/links/items/properties/domain_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err49];
                      } else {
                        vErrors.push(err49);
                      }
                      errors++;
                    }
                    if (func1(data22) < 1) {
                      const err50 = {
                        instancePath: instancePath + "/topology/links/" + i1 + "/domain_id",
                        schemaPath: "#/properties/topology/properties/links/items/properties/domain_id/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err50];
                      } else {
                        vErrors.push(err50);
                      }
                      errors++;
                    }
                  } else {
                    const err51 = {
                      instancePath: instancePath + "/topology/links/" + i1 + "/domain_id",
                      schemaPath: "#/properties/topology/properties/links/items/properties/domain_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err51];
                    } else {
                      vErrors.push(err51);
                    }
                    errors++;
                  }
                }
                if (data19.bandwidth_gbps !== undefined) {
                  let data23 = data19.bandwidth_gbps;
                  if (typeof data23 == "number") {
                    if (data23 > 100000 || isNaN(data23)) {
                      const err52 = {
                        instancePath: instancePath + "/topology/links/" + i1 + "/bandwidth_gbps",
                        schemaPath: "#/properties/topology/properties/links/items/properties/bandwidth_gbps/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 100000 },
                        message: "must be <= 100000",
                      };
                      if (vErrors === null) {
                        vErrors = [err52];
                      } else {
                        vErrors.push(err52);
                      }
                      errors++;
                    }
                    if (data23 < 0 || isNaN(data23)) {
                      const err53 = {
                        instancePath: instancePath + "/topology/links/" + i1 + "/bandwidth_gbps",
                        schemaPath: "#/properties/topology/properties/links/items/properties/bandwidth_gbps/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err53];
                      } else {
                        vErrors.push(err53);
                      }
                      errors++;
                    }
                  } else {
                    const err54 = {
                      instancePath: instancePath + "/topology/links/" + i1 + "/bandwidth_gbps",
                      schemaPath: "#/properties/topology/properties/links/items/properties/bandwidth_gbps/type",
                      keyword: "type",
                      params: { type: "number" },
                      message: "must be number",
                    };
                    if (vErrors === null) {
                      vErrors = [err54];
                    } else {
                      vErrors.push(err54);
                    }
                    errors++;
                  }
                }
                if (data19.latency_us !== undefined) {
                  let data24 = data19.latency_us;
                  if (typeof data24 == "number") {
                    if (data24 > 1000000 || isNaN(data24)) {
                      const err55 = {
                        instancePath: instancePath + "/topology/links/" + i1 + "/latency_us",
                        schemaPath: "#/properties/topology/properties/links/items/properties/latency_us/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 1000000 },
                        message: "must be <= 1000000",
                      };
                      if (vErrors === null) {
                        vErrors = [err55];
                      } else {
                        vErrors.push(err55);
                      }
                      errors++;
                    }
                    if (data24 < 0 || isNaN(data24)) {
                      const err56 = {
                        instancePath: instancePath + "/topology/links/" + i1 + "/latency_us",
                        schemaPath: "#/properties/topology/properties/links/items/properties/latency_us/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err56];
                      } else {
                        vErrors.push(err56);
                      }
                      errors++;
                    }
                  } else {
                    const err57 = {
                      instancePath: instancePath + "/topology/links/" + i1 + "/latency_us",
                      schemaPath: "#/properties/topology/properties/links/items/properties/latency_us/type",
                      keyword: "type",
                      params: { type: "number" },
                      message: "must be number",
                    };
                    if (vErrors === null) {
                      vErrors = [err57];
                    } else {
                      vErrors.push(err57);
                    }
                    errors++;
                  }
                }
              } else {
                const err58 = {
                  instancePath: instancePath + "/topology/links/" + i1,
                  schemaPath: "#/properties/topology/properties/links/items/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                };
                if (vErrors === null) {
                  vErrors = [err58];
                } else {
                  vErrors.push(err58);
                }
                errors++;
              }
            }
          } else {
            const err59 = {
              instancePath: instancePath + "/topology/links",
              schemaPath: "#/properties/topology/properties/links/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err59];
            } else {
              vErrors.push(err59);
            }
            errors++;
          }
        }
        if (data5.module_bindings !== undefined) {
          let data25 = data5.module_bindings;
          if (Array.isArray(data25)) {
            if (data25.length > 64) {
              const err60 = {
                instancePath: instancePath + "/topology/module_bindings",
                schemaPath: "#/properties/topology/properties/module_bindings/maxItems",
                keyword: "maxItems",
                params: { limit: 64 },
                message: "must NOT have more than 64 items",
              };
              if (vErrors === null) {
                vErrors = [err60];
              } else {
                vErrors.push(err60);
              }
              errors++;
            }
            const len2 = data25.length;
            for (let i2 = 0; i2 < len2; i2++) {
              let data26 = data25[i2];
              if (data26 && typeof data26 == "object" && !Array.isArray(data26)) {
                if (data26.module_name === undefined) {
                  const err61 = {
                    instancePath: instancePath + "/topology/module_bindings/" + i2,
                    schemaPath: "#/properties/topology/properties/module_bindings/items/required",
                    keyword: "required",
                    params: { missingProperty: "module_name" },
                    message: "must have required property '" + "module_name" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err61];
                  } else {
                    vErrors.push(err61);
                  }
                  errors++;
                }
                if (data26.module_kind === undefined) {
                  const err62 = {
                    instancePath: instancePath + "/topology/module_bindings/" + i2,
                    schemaPath: "#/properties/topology/properties/module_bindings/items/required",
                    keyword: "required",
                    params: { missingProperty: "module_kind" },
                    message: "must have required property '" + "module_kind" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err62];
                  } else {
                    vErrors.push(err62);
                  }
                  errors++;
                }
                for (const key8 in data26) {
                  if (!(
                    key8 === "module_name" ||
                    key8 === "module_version" ||
                    key8 === "module_kind" ||
                    key8 === "config_profile" ||
                    key8 === "override_params"
                  )) {
                    const err63 = {
                      instancePath: instancePath + "/topology/module_bindings/" + i2,
                      schemaPath: "#/properties/topology/properties/module_bindings/items/additionalProperties",
                      keyword: "additionalProperties",
                      params: { additionalProperty: key8 },
                      message: "must NOT have additional properties",
                    };
                    if (vErrors === null) {
                      vErrors = [err63];
                    } else {
                      vErrors.push(err63);
                    }
                    errors++;
                  }
                }
                if (data26.module_name !== undefined) {
                  let data27 = data26.module_name;
                  if (typeof data27 === "string") {
                    if (func1(data27) > 256) {
                      const err64 = {
                        instancePath: instancePath + "/topology/module_bindings/" + i2 + "/module_name",
                        schemaPath:
                          "#/properties/topology/properties/module_bindings/items/properties/module_name/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err64];
                      } else {
                        vErrors.push(err64);
                      }
                      errors++;
                    }
                    if (func1(data27) < 1) {
                      const err65 = {
                        instancePath: instancePath + "/topology/module_bindings/" + i2 + "/module_name",
                        schemaPath:
                          "#/properties/topology/properties/module_bindings/items/properties/module_name/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err65];
                      } else {
                        vErrors.push(err65);
                      }
                      errors++;
                    }
                  } else {
                    const err66 = {
                      instancePath: instancePath + "/topology/module_bindings/" + i2 + "/module_name",
                      schemaPath: "#/properties/topology/properties/module_bindings/items/properties/module_name/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err66];
                    } else {
                      vErrors.push(err66);
                    }
                    errors++;
                  }
                }
                if (data26.module_version !== undefined) {
                  let data28 = data26.module_version;
                  if (typeof data28 === "string") {
                    if (func1(data28) > 80) {
                      const err67 = {
                        instancePath: instancePath + "/topology/module_bindings/" + i2 + "/module_version",
                        schemaPath:
                          "#/properties/topology/properties/module_bindings/items/properties/module_version/maxLength",
                        keyword: "maxLength",
                        params: { limit: 80 },
                        message: "must NOT have more than 80 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err67];
                      } else {
                        vErrors.push(err67);
                      }
                      errors++;
                    }
                  } else {
                    const err68 = {
                      instancePath: instancePath + "/topology/module_bindings/" + i2 + "/module_version",
                      schemaPath:
                        "#/properties/topology/properties/module_bindings/items/properties/module_version/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err68];
                    } else {
                      vErrors.push(err68);
                    }
                    errors++;
                  }
                }
                if (data26.module_kind !== undefined) {
                  let data29 = data26.module_kind;
                  if (!(data29 === "scale_up" || data29 === "scale_out")) {
                    const err69 = {
                      instancePath: instancePath + "/topology/module_bindings/" + i2 + "/module_kind",
                      schemaPath: "#/properties/topology/properties/module_bindings/items/properties/module_kind/enum",
                      keyword: "enum",
                      params: {
                        allowedValues:
                          schema35.properties.topology.properties.module_bindings.items.properties.module_kind.enum,
                      },
                      message: "must be equal to one of the allowed values",
                    };
                    if (vErrors === null) {
                      vErrors = [err69];
                    } else {
                      vErrors.push(err69);
                    }
                    errors++;
                  }
                }
                if (data26.config_profile !== undefined) {
                  let data30 = data26.config_profile;
                  if (typeof data30 === "string") {
                    if (func1(data30) > 160) {
                      const err70 = {
                        instancePath: instancePath + "/topology/module_bindings/" + i2 + "/config_profile",
                        schemaPath:
                          "#/properties/topology/properties/module_bindings/items/properties/config_profile/maxLength",
                        keyword: "maxLength",
                        params: { limit: 160 },
                        message: "must NOT have more than 160 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err70];
                      } else {
                        vErrors.push(err70);
                      }
                      errors++;
                    }
                  } else {
                    const err71 = {
                      instancePath: instancePath + "/topology/module_bindings/" + i2 + "/config_profile",
                      schemaPath:
                        "#/properties/topology/properties/module_bindings/items/properties/config_profile/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err71];
                    } else {
                      vErrors.push(err71);
                    }
                    errors++;
                  }
                }
                if (data26.override_params !== undefined) {
                  let data31 = data26.override_params;
                  if (data31 && typeof data31 == "object" && !Array.isArray(data31)) {
                    for (const key9 in data31) {
                      if (!(
                        key9 === "bandwidth_gbps" ||
                        key9 === "latency_us" ||
                        key9 === "queue_factor" ||
                        key9 === "oversubscription_factor"
                      )) {
                        const err72 = {
                          instancePath: instancePath + "/topology/module_bindings/" + i2 + "/override_params",
                          schemaPath:
                            "#/properties/topology/properties/module_bindings/items/properties/override_params/additionalProperties",
                          keyword: "additionalProperties",
                          params: { additionalProperty: key9 },
                          message: "must NOT have additional properties",
                        };
                        if (vErrors === null) {
                          vErrors = [err72];
                        } else {
                          vErrors.push(err72);
                        }
                        errors++;
                      }
                    }
                    if (data31.bandwidth_gbps !== undefined) {
                      let data32 = data31.bandwidth_gbps;
                      if (typeof data32 == "number") {
                        if (data32 > 100000 || isNaN(data32)) {
                          const err73 = {
                            instancePath:
                              instancePath + "/topology/module_bindings/" + i2 + "/override_params/bandwidth_gbps",
                            schemaPath:
                              "#/properties/topology/properties/module_bindings/items/properties/override_params/properties/bandwidth_gbps/maximum",
                            keyword: "maximum",
                            params: { comparison: "<=", limit: 100000 },
                            message: "must be <= 100000",
                          };
                          if (vErrors === null) {
                            vErrors = [err73];
                          } else {
                            vErrors.push(err73);
                          }
                          errors++;
                        }
                        if (data32 <= 0 || isNaN(data32)) {
                          const err74 = {
                            instancePath:
                              instancePath + "/topology/module_bindings/" + i2 + "/override_params/bandwidth_gbps",
                            schemaPath:
                              "#/properties/topology/properties/module_bindings/items/properties/override_params/properties/bandwidth_gbps/exclusiveMinimum",
                            keyword: "exclusiveMinimum",
                            params: { comparison: ">", limit: 0 },
                            message: "must be > 0",
                          };
                          if (vErrors === null) {
                            vErrors = [err74];
                          } else {
                            vErrors.push(err74);
                          }
                          errors++;
                        }
                      } else {
                        const err75 = {
                          instancePath:
                            instancePath + "/topology/module_bindings/" + i2 + "/override_params/bandwidth_gbps",
                          schemaPath:
                            "#/properties/topology/properties/module_bindings/items/properties/override_params/properties/bandwidth_gbps/type",
                          keyword: "type",
                          params: { type: "number" },
                          message: "must be number",
                        };
                        if (vErrors === null) {
                          vErrors = [err75];
                        } else {
                          vErrors.push(err75);
                        }
                        errors++;
                      }
                    }
                    if (data31.latency_us !== undefined) {
                      let data33 = data31.latency_us;
                      if (typeof data33 == "number") {
                        if (data33 > 1000000 || isNaN(data33)) {
                          const err76 = {
                            instancePath:
                              instancePath + "/topology/module_bindings/" + i2 + "/override_params/latency_us",
                            schemaPath:
                              "#/properties/topology/properties/module_bindings/items/properties/override_params/properties/latency_us/maximum",
                            keyword: "maximum",
                            params: { comparison: "<=", limit: 1000000 },
                            message: "must be <= 1000000",
                          };
                          if (vErrors === null) {
                            vErrors = [err76];
                          } else {
                            vErrors.push(err76);
                          }
                          errors++;
                        }
                        if (data33 < 0 || isNaN(data33)) {
                          const err77 = {
                            instancePath:
                              instancePath + "/topology/module_bindings/" + i2 + "/override_params/latency_us",
                            schemaPath:
                              "#/properties/topology/properties/module_bindings/items/properties/override_params/properties/latency_us/minimum",
                            keyword: "minimum",
                            params: { comparison: ">=", limit: 0 },
                            message: "must be >= 0",
                          };
                          if (vErrors === null) {
                            vErrors = [err77];
                          } else {
                            vErrors.push(err77);
                          }
                          errors++;
                        }
                      } else {
                        const err78 = {
                          instancePath:
                            instancePath + "/topology/module_bindings/" + i2 + "/override_params/latency_us",
                          schemaPath:
                            "#/properties/topology/properties/module_bindings/items/properties/override_params/properties/latency_us/type",
                          keyword: "type",
                          params: { type: "number" },
                          message: "must be number",
                        };
                        if (vErrors === null) {
                          vErrors = [err78];
                        } else {
                          vErrors.push(err78);
                        }
                        errors++;
                      }
                    }
                    if (data31.queue_factor !== undefined) {
                      let data34 = data31.queue_factor;
                      if (typeof data34 == "number") {
                        if (data34 > 1000000 || isNaN(data34)) {
                          const err79 = {
                            instancePath:
                              instancePath + "/topology/module_bindings/" + i2 + "/override_params/queue_factor",
                            schemaPath:
                              "#/properties/topology/properties/module_bindings/items/properties/override_params/properties/queue_factor/maximum",
                            keyword: "maximum",
                            params: { comparison: "<=", limit: 1000000 },
                            message: "must be <= 1000000",
                          };
                          if (vErrors === null) {
                            vErrors = [err79];
                          } else {
                            vErrors.push(err79);
                          }
                          errors++;
                        }
                        if (data34 < 0 || isNaN(data34)) {
                          const err80 = {
                            instancePath:
                              instancePath + "/topology/module_bindings/" + i2 + "/override_params/queue_factor",
                            schemaPath:
                              "#/properties/topology/properties/module_bindings/items/properties/override_params/properties/queue_factor/minimum",
                            keyword: "minimum",
                            params: { comparison: ">=", limit: 0 },
                            message: "must be >= 0",
                          };
                          if (vErrors === null) {
                            vErrors = [err80];
                          } else {
                            vErrors.push(err80);
                          }
                          errors++;
                        }
                      } else {
                        const err81 = {
                          instancePath:
                            instancePath + "/topology/module_bindings/" + i2 + "/override_params/queue_factor",
                          schemaPath:
                            "#/properties/topology/properties/module_bindings/items/properties/override_params/properties/queue_factor/type",
                          keyword: "type",
                          params: { type: "number" },
                          message: "must be number",
                        };
                        if (vErrors === null) {
                          vErrors = [err81];
                        } else {
                          vErrors.push(err81);
                        }
                        errors++;
                      }
                    }
                    if (data31.oversubscription_factor !== undefined) {
                      let data35 = data31.oversubscription_factor;
                      if (typeof data35 == "number") {
                        if (data35 > 1000000 || isNaN(data35)) {
                          const err82 = {
                            instancePath:
                              instancePath +
                              "/topology/module_bindings/" +
                              i2 +
                              "/override_params/oversubscription_factor",
                            schemaPath:
                              "#/properties/topology/properties/module_bindings/items/properties/override_params/properties/oversubscription_factor/maximum",
                            keyword: "maximum",
                            params: { comparison: "<=", limit: 1000000 },
                            message: "must be <= 1000000",
                          };
                          if (vErrors === null) {
                            vErrors = [err82];
                          } else {
                            vErrors.push(err82);
                          }
                          errors++;
                        }
                        if (data35 < 1 || isNaN(data35)) {
                          const err83 = {
                            instancePath:
                              instancePath +
                              "/topology/module_bindings/" +
                              i2 +
                              "/override_params/oversubscription_factor",
                            schemaPath:
                              "#/properties/topology/properties/module_bindings/items/properties/override_params/properties/oversubscription_factor/minimum",
                            keyword: "minimum",
                            params: { comparison: ">=", limit: 1 },
                            message: "must be >= 1",
                          };
                          if (vErrors === null) {
                            vErrors = [err83];
                          } else {
                            vErrors.push(err83);
                          }
                          errors++;
                        }
                      } else {
                        const err84 = {
                          instancePath:
                            instancePath +
                            "/topology/module_bindings/" +
                            i2 +
                            "/override_params/oversubscription_factor",
                          schemaPath:
                            "#/properties/topology/properties/module_bindings/items/properties/override_params/properties/oversubscription_factor/type",
                          keyword: "type",
                          params: { type: "number" },
                          message: "must be number",
                        };
                        if (vErrors === null) {
                          vErrors = [err84];
                        } else {
                          vErrors.push(err84);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err85 = {
                      instancePath: instancePath + "/topology/module_bindings/" + i2 + "/override_params",
                      schemaPath:
                        "#/properties/topology/properties/module_bindings/items/properties/override_params/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    };
                    if (vErrors === null) {
                      vErrors = [err85];
                    } else {
                      vErrors.push(err85);
                    }
                    errors++;
                  }
                }
              } else {
                const err86 = {
                  instancePath: instancePath + "/topology/module_bindings/" + i2,
                  schemaPath: "#/properties/topology/properties/module_bindings/items/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                };
                if (vErrors === null) {
                  vErrors = [err86];
                } else {
                  vErrors.push(err86);
                }
                errors++;
              }
            }
          } else {
            const err87 = {
              instancePath: instancePath + "/topology/module_bindings",
              schemaPath: "#/properties/topology/properties/module_bindings/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err87];
            } else {
              vErrors.push(err87);
            }
            errors++;
          }
        }
        if (data5.domains !== undefined) {
          let data36 = data5.domains;
          if (Array.isArray(data36)) {
            if (data36.length > 64) {
              const err88 = {
                instancePath: instancePath + "/topology/domains",
                schemaPath: "#/properties/topology/properties/domains/maxItems",
                keyword: "maxItems",
                params: { limit: 64 },
                message: "must NOT have more than 64 items",
              };
              if (vErrors === null) {
                vErrors = [err88];
              } else {
                vErrors.push(err88);
              }
              errors++;
            }
            const len3 = data36.length;
            for (let i3 = 0; i3 < len3; i3++) {
              let data37 = data36[i3];
              if (data37 && typeof data37 == "object" && !Array.isArray(data37)) {
                if (data37.domain_id === undefined) {
                  const err89 = {
                    instancePath: instancePath + "/topology/domains/" + i3,
                    schemaPath: "#/properties/topology/properties/domains/items/required",
                    keyword: "required",
                    params: { missingProperty: "domain_id" },
                    message: "must have required property '" + "domain_id" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err89];
                  } else {
                    vErrors.push(err89);
                  }
                  errors++;
                }
                if (data37.domain_type === undefined) {
                  const err90 = {
                    instancePath: instancePath + "/topology/domains/" + i3,
                    schemaPath: "#/properties/topology/properties/domains/items/required",
                    keyword: "required",
                    params: { missingProperty: "domain_type" },
                    message: "must have required property '" + "domain_type" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err90];
                  } else {
                    vErrors.push(err90);
                  }
                  errors++;
                }
                if (data37.member_devices === undefined) {
                  const err91 = {
                    instancePath: instancePath + "/topology/domains/" + i3,
                    schemaPath: "#/properties/topology/properties/domains/items/required",
                    keyword: "required",
                    params: { missingProperty: "member_devices" },
                    message: "must have required property '" + "member_devices" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err91];
                  } else {
                    vErrors.push(err91);
                  }
                  errors++;
                }
                if (data37.module_binding === undefined) {
                  const err92 = {
                    instancePath: instancePath + "/topology/domains/" + i3,
                    schemaPath: "#/properties/topology/properties/domains/items/required",
                    keyword: "required",
                    params: { missingProperty: "module_binding" },
                    message: "must have required property '" + "module_binding" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err92];
                  } else {
                    vErrors.push(err92);
                  }
                  errors++;
                }
                for (const key10 in data37) {
                  if (!(
                    key10 === "domain_id" ||
                    key10 === "domain_type" ||
                    key10 === "member_devices" ||
                    key10 === "module_binding" ||
                    key10 === "default_fidelity" ||
                    key10 === "failure_policy"
                  )) {
                    const err93 = {
                      instancePath: instancePath + "/topology/domains/" + i3,
                      schemaPath: "#/properties/topology/properties/domains/items/additionalProperties",
                      keyword: "additionalProperties",
                      params: { additionalProperty: key10 },
                      message: "must NOT have additional properties",
                    };
                    if (vErrors === null) {
                      vErrors = [err93];
                    } else {
                      vErrors.push(err93);
                    }
                    errors++;
                  }
                }
                if (data37.domain_id !== undefined) {
                  let data38 = data37.domain_id;
                  if (typeof data38 === "string") {
                    if (func1(data38) > 256) {
                      const err94 = {
                        instancePath: instancePath + "/topology/domains/" + i3 + "/domain_id",
                        schemaPath: "#/properties/topology/properties/domains/items/properties/domain_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err94];
                      } else {
                        vErrors.push(err94);
                      }
                      errors++;
                    }
                    if (func1(data38) < 1) {
                      const err95 = {
                        instancePath: instancePath + "/topology/domains/" + i3 + "/domain_id",
                        schemaPath: "#/properties/topology/properties/domains/items/properties/domain_id/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err95];
                      } else {
                        vErrors.push(err95);
                      }
                      errors++;
                    }
                  } else {
                    const err96 = {
                      instancePath: instancePath + "/topology/domains/" + i3 + "/domain_id",
                      schemaPath: "#/properties/topology/properties/domains/items/properties/domain_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err96];
                    } else {
                      vErrors.push(err96);
                    }
                    errors++;
                  }
                }
                if (data37.domain_type !== undefined) {
                  let data39 = data37.domain_type;
                  if (!(data39 === "scale_up" || data39 === "scale_out")) {
                    const err97 = {
                      instancePath: instancePath + "/topology/domains/" + i3 + "/domain_type",
                      schemaPath: "#/properties/topology/properties/domains/items/properties/domain_type/enum",
                      keyword: "enum",
                      params: {
                        allowedValues:
                          schema35.properties.topology.properties.domains.items.properties.domain_type.enum,
                      },
                      message: "must be equal to one of the allowed values",
                    };
                    if (vErrors === null) {
                      vErrors = [err97];
                    } else {
                      vErrors.push(err97);
                    }
                    errors++;
                  }
                }
                if (data37.member_devices !== undefined) {
                  let data40 = data37.member_devices;
                  if (Array.isArray(data40)) {
                    if (data40.length > 1024) {
                      const err98 = {
                        instancePath: instancePath + "/topology/domains/" + i3 + "/member_devices",
                        schemaPath: "#/properties/topology/properties/domains/items/properties/member_devices/maxItems",
                        keyword: "maxItems",
                        params: { limit: 1024 },
                        message: "must NOT have more than 1024 items",
                      };
                      if (vErrors === null) {
                        vErrors = [err98];
                      } else {
                        vErrors.push(err98);
                      }
                      errors++;
                    }
                    const len4 = data40.length;
                    for (let i4 = 0; i4 < len4; i4++) {
                      let data41 = data40[i4];
                      if (typeof data41 === "string") {
                        if (func1(data41) < 1) {
                          const err99 = {
                            instancePath: instancePath + "/topology/domains/" + i3 + "/member_devices/" + i4,
                            schemaPath:
                              "#/properties/topology/properties/domains/items/properties/member_devices/items/minLength",
                            keyword: "minLength",
                            params: { limit: 1 },
                            message: "must NOT have fewer than 1 characters",
                          };
                          if (vErrors === null) {
                            vErrors = [err99];
                          } else {
                            vErrors.push(err99);
                          }
                          errors++;
                        }
                      } else {
                        const err100 = {
                          instancePath: instancePath + "/topology/domains/" + i3 + "/member_devices/" + i4,
                          schemaPath:
                            "#/properties/topology/properties/domains/items/properties/member_devices/items/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        };
                        if (vErrors === null) {
                          vErrors = [err100];
                        } else {
                          vErrors.push(err100);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err101 = {
                      instancePath: instancePath + "/topology/domains/" + i3 + "/member_devices",
                      schemaPath: "#/properties/topology/properties/domains/items/properties/member_devices/type",
                      keyword: "type",
                      params: { type: "array" },
                      message: "must be array",
                    };
                    if (vErrors === null) {
                      vErrors = [err101];
                    } else {
                      vErrors.push(err101);
                    }
                    errors++;
                  }
                }
                if (data37.module_binding !== undefined) {
                  let data42 = data37.module_binding;
                  if (typeof data42 === "string") {
                    if (func1(data42) > 256) {
                      const err102 = {
                        instancePath: instancePath + "/topology/domains/" + i3 + "/module_binding",
                        schemaPath:
                          "#/properties/topology/properties/domains/items/properties/module_binding/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err102];
                      } else {
                        vErrors.push(err102);
                      }
                      errors++;
                    }
                    if (func1(data42) < 1) {
                      const err103 = {
                        instancePath: instancePath + "/topology/domains/" + i3 + "/module_binding",
                        schemaPath:
                          "#/properties/topology/properties/domains/items/properties/module_binding/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err103];
                      } else {
                        vErrors.push(err103);
                      }
                      errors++;
                    }
                  } else {
                    const err104 = {
                      instancePath: instancePath + "/topology/domains/" + i3 + "/module_binding",
                      schemaPath: "#/properties/topology/properties/domains/items/properties/module_binding/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err104];
                    } else {
                      vErrors.push(err104);
                    }
                    errors++;
                  }
                }
                if (data37.default_fidelity !== undefined) {
                  let data43 = data37.default_fidelity;
                  if (!(data43 === "analytical" || data43 === "des")) {
                    const err105 = {
                      instancePath: instancePath + "/topology/domains/" + i3 + "/default_fidelity",
                      schemaPath: "#/properties/topology/properties/domains/items/properties/default_fidelity/enum",
                      keyword: "enum",
                      params: {
                        allowedValues:
                          schema35.properties.topology.properties.domains.items.properties.default_fidelity.enum,
                      },
                      message: "must be equal to one of the allowed values",
                    };
                    if (vErrors === null) {
                      vErrors = [err105];
                    } else {
                      vErrors.push(err105);
                    }
                    errors++;
                  }
                }
                if (data37.failure_policy !== undefined) {
                  let data44 = data37.failure_policy;
                  if (!(data44 === "fallback" || data44 === "fail_closed")) {
                    const err106 = {
                      instancePath: instancePath + "/topology/domains/" + i3 + "/failure_policy",
                      schemaPath: "#/properties/topology/properties/domains/items/properties/failure_policy/enum",
                      keyword: "enum",
                      params: {
                        allowedValues:
                          schema35.properties.topology.properties.domains.items.properties.failure_policy.enum,
                      },
                      message: "must be equal to one of the allowed values",
                    };
                    if (vErrors === null) {
                      vErrors = [err106];
                    } else {
                      vErrors.push(err106);
                    }
                    errors++;
                  }
                }
              } else {
                const err107 = {
                  instancePath: instancePath + "/topology/domains/" + i3,
                  schemaPath: "#/properties/topology/properties/domains/items/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                };
                if (vErrors === null) {
                  vErrors = [err107];
                } else {
                  vErrors.push(err107);
                }
                errors++;
              }
            }
          } else {
            const err108 = {
              instancePath: instancePath + "/topology/domains",
              schemaPath: "#/properties/topology/properties/domains/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err108];
            } else {
              vErrors.push(err108);
            }
            errors++;
          }
        }
      } else {
        const err109 = {
          instancePath: instancePath + "/topology",
          schemaPath: "#/properties/topology/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err109];
        } else {
          vErrors.push(err109);
        }
        errors++;
      }
    }
    if (data.workload !== undefined) {
      let data45 = data.workload;
      if (data45 && typeof data45 == "object" && !Array.isArray(data45)) {
        if (data45.requests === undefined) {
          const err110 = {
            instancePath: instancePath + "/workload",
            schemaPath: "#/properties/workload/required",
            keyword: "required",
            params: { missingProperty: "requests" },
            message: "must have required property '" + "requests" + "'",
          };
          if (vErrors === null) {
            vErrors = [err110];
          } else {
            vErrors.push(err110);
          }
          errors++;
        }
        for (const key11 in data45) {
          if (!(key11 === "requests")) {
            const err111 = {
              instancePath: instancePath + "/workload",
              schemaPath: "#/properties/workload/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key11 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err111];
            } else {
              vErrors.push(err111);
            }
            errors++;
          }
        }
        if (data45.requests !== undefined) {
          let data46 = data45.requests;
          if (Array.isArray(data46)) {
            if (data46.length > 100000) {
              const err112 = {
                instancePath: instancePath + "/workload/requests",
                schemaPath: "#/properties/workload/properties/requests/maxItems",
                keyword: "maxItems",
                params: { limit: 100000 },
                message: "must NOT have more than 100000 items",
              };
              if (vErrors === null) {
                vErrors = [err112];
              } else {
                vErrors.push(err112);
              }
              errors++;
            }
            const len5 = data46.length;
            for (let i5 = 0; i5 < len5; i5++) {
              let data47 = data46[i5];
              if (data47 && typeof data47 == "object" && !Array.isArray(data47)) {
                if (data47.request_id === undefined) {
                  const err113 = {
                    instancePath: instancePath + "/workload/requests/" + i5,
                    schemaPath: "#/properties/workload/properties/requests/items/required",
                    keyword: "required",
                    params: { missingProperty: "request_id" },
                    message: "must have required property '" + "request_id" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err113];
                  } else {
                    vErrors.push(err113);
                  }
                  errors++;
                }
                for (const key12 in data47) {
                  if (!func4.call(schema35.properties.workload.properties.requests.items.properties, key12)) {
                    const err114 = {
                      instancePath: instancePath + "/workload/requests/" + i5,
                      schemaPath: "#/properties/workload/properties/requests/items/additionalProperties",
                      keyword: "additionalProperties",
                      params: { additionalProperty: key12 },
                      message: "must NOT have additional properties",
                    };
                    if (vErrors === null) {
                      vErrors = [err114];
                    } else {
                      vErrors.push(err114);
                    }
                    errors++;
                  }
                }
                if (data47.request_id !== undefined) {
                  let data48 = data47.request_id;
                  if (typeof data48 === "string") {
                    if (func1(data48) > 256) {
                      const err115 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/request_id",
                        schemaPath: "#/properties/workload/properties/requests/items/properties/request_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err115];
                      } else {
                        vErrors.push(err115);
                      }
                      errors++;
                    }
                    if (func1(data48) < 1) {
                      const err116 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/request_id",
                        schemaPath: "#/properties/workload/properties/requests/items/properties/request_id/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err116];
                      } else {
                        vErrors.push(err116);
                      }
                      errors++;
                    }
                  } else {
                    const err117 = {
                      instancePath: instancePath + "/workload/requests/" + i5 + "/request_id",
                      schemaPath: "#/properties/workload/properties/requests/items/properties/request_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err117];
                    } else {
                      vErrors.push(err117);
                    }
                    errors++;
                  }
                }
                if (data47.batch_id !== undefined) {
                  let data49 = data47.batch_id;
                  if (typeof data49 === "string") {
                    if (func1(data49) > 256) {
                      const err118 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/batch_id",
                        schemaPath: "#/properties/workload/properties/requests/items/properties/batch_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err118];
                      } else {
                        vErrors.push(err118);
                      }
                      errors++;
                    }
                  } else {
                    const err119 = {
                      instancePath: instancePath + "/workload/requests/" + i5 + "/batch_id",
                      schemaPath: "#/properties/workload/properties/requests/items/properties/batch_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err119];
                    } else {
                      vErrors.push(err119);
                    }
                    errors++;
                  }
                }
                if (data47.phase !== undefined) {
                  let data50 = data47.phase;
                  if (!(data50 === "prefill" || data50 === "decode")) {
                    const err120 = {
                      instancePath: instancePath + "/workload/requests/" + i5 + "/phase",
                      schemaPath: "#/properties/workload/properties/requests/items/properties/phase/enum",
                      keyword: "enum",
                      params: {
                        allowedValues: schema35.properties.workload.properties.requests.items.properties.phase.enum,
                      },
                      message: "must be equal to one of the allowed values",
                    };
                    if (vErrors === null) {
                      vErrors = [err120];
                    } else {
                      vErrors.push(err120);
                    }
                    errors++;
                  }
                }
                if (data47.collective_type !== undefined) {
                  let data51 = data47.collective_type;
                  if (typeof data51 === "string") {
                    if (func1(data51) > 160) {
                      const err121 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/collective_type",
                        schemaPath:
                          "#/properties/workload/properties/requests/items/properties/collective_type/maxLength",
                        keyword: "maxLength",
                        params: { limit: 160 },
                        message: "must NOT have more than 160 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err121];
                      } else {
                        vErrors.push(err121);
                      }
                      errors++;
                    }
                  } else {
                    const err122 = {
                      instancePath: instancePath + "/workload/requests/" + i5 + "/collective_type",
                      schemaPath: "#/properties/workload/properties/requests/items/properties/collective_type/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err122];
                    } else {
                      vErrors.push(err122);
                    }
                    errors++;
                  }
                }
                if (data47.message_size_bytes !== undefined) {
                  let data52 = data47.message_size_bytes;
                  if (!(typeof data52 == "number" && !(data52 % 1) && !isNaN(data52))) {
                    const err123 = {
                      instancePath: instancePath + "/workload/requests/" + i5 + "/message_size_bytes",
                      schemaPath: "#/properties/workload/properties/requests/items/properties/message_size_bytes/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err123];
                    } else {
                      vErrors.push(err123);
                    }
                    errors++;
                  }
                  if (typeof data52 == "number") {
                    if (data52 > 9007199254740991 || isNaN(data52)) {
                      const err124 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/message_size_bytes",
                        schemaPath:
                          "#/properties/workload/properties/requests/items/properties/message_size_bytes/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 9007199254740991 },
                        message: "must be <= 9007199254740991",
                      };
                      if (vErrors === null) {
                        vErrors = [err124];
                      } else {
                        vErrors.push(err124);
                      }
                      errors++;
                    }
                    if (data52 < 0 || isNaN(data52)) {
                      const err125 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/message_size_bytes",
                        schemaPath:
                          "#/properties/workload/properties/requests/items/properties/message_size_bytes/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err125];
                      } else {
                        vErrors.push(err125);
                      }
                      errors++;
                    }
                  }
                }
                if (data47.message_size_mb !== undefined) {
                  let data53 = data47.message_size_mb;
                  if (typeof data53 == "number") {
                    if (data53 < 0 || isNaN(data53)) {
                      const err126 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/message_size_mb",
                        schemaPath:
                          "#/properties/workload/properties/requests/items/properties/message_size_mb/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err126];
                      } else {
                        vErrors.push(err126);
                      }
                      errors++;
                    }
                  } else {
                    const err127 = {
                      instancePath: instancePath + "/workload/requests/" + i5 + "/message_size_mb",
                      schemaPath: "#/properties/workload/properties/requests/items/properties/message_size_mb/type",
                      keyword: "type",
                      params: { type: "number" },
                      message: "must be number",
                    };
                    if (vErrors === null) {
                      vErrors = [err127];
                    } else {
                      vErrors.push(err127);
                    }
                    errors++;
                  }
                }
                if (data47.tp_degree !== undefined) {
                  let data54 = data47.tp_degree;
                  if (!(typeof data54 == "number" && !(data54 % 1) && !isNaN(data54))) {
                    const err128 = {
                      instancePath: instancePath + "/workload/requests/" + i5 + "/tp_degree",
                      schemaPath: "#/properties/workload/properties/requests/items/properties/tp_degree/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err128];
                    } else {
                      vErrors.push(err128);
                    }
                    errors++;
                  }
                  if (typeof data54 == "number") {
                    if (data54 > 1024 || isNaN(data54)) {
                      const err129 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/tp_degree",
                        schemaPath: "#/properties/workload/properties/requests/items/properties/tp_degree/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 1024 },
                        message: "must be <= 1024",
                      };
                      if (vErrors === null) {
                        vErrors = [err129];
                      } else {
                        vErrors.push(err129);
                      }
                      errors++;
                    }
                    if (data54 < 1 || isNaN(data54)) {
                      const err130 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/tp_degree",
                        schemaPath: "#/properties/workload/properties/requests/items/properties/tp_degree/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 1 },
                        message: "must be >= 1",
                      };
                      if (vErrors === null) {
                        vErrors = [err130];
                      } else {
                        vErrors.push(err130);
                      }
                      errors++;
                    }
                  }
                }
                if (data47.participants !== undefined) {
                  let data55 = data47.participants;
                  if (Array.isArray(data55)) {
                    if (data55.length > 1024) {
                      const err131 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/participants",
                        schemaPath: "#/properties/workload/properties/requests/items/properties/participants/maxItems",
                        keyword: "maxItems",
                        params: { limit: 1024 },
                        message: "must NOT have more than 1024 items",
                      };
                      if (vErrors === null) {
                        vErrors = [err131];
                      } else {
                        vErrors.push(err131);
                      }
                      errors++;
                    }
                    const len6 = data55.length;
                    for (let i6 = 0; i6 < len6; i6++) {
                      let data56 = data55[i6];
                      if (typeof data56 === "string") {
                        if (func1(data56) < 1) {
                          const err132 = {
                            instancePath: instancePath + "/workload/requests/" + i5 + "/participants/" + i6,
                            schemaPath:
                              "#/properties/workload/properties/requests/items/properties/participants/items/minLength",
                            keyword: "minLength",
                            params: { limit: 1 },
                            message: "must NOT have fewer than 1 characters",
                          };
                          if (vErrors === null) {
                            vErrors = [err132];
                          } else {
                            vErrors.push(err132);
                          }
                          errors++;
                        }
                      } else {
                        const err133 = {
                          instancePath: instancePath + "/workload/requests/" + i5 + "/participants/" + i6,
                          schemaPath:
                            "#/properties/workload/properties/requests/items/properties/participants/items/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        };
                        if (vErrors === null) {
                          vErrors = [err133];
                        } else {
                          vErrors.push(err133);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err134 = {
                      instancePath: instancePath + "/workload/requests/" + i5 + "/participants",
                      schemaPath: "#/properties/workload/properties/requests/items/properties/participants/type",
                      keyword: "type",
                      params: { type: "array" },
                      message: "must be array",
                    };
                    if (vErrors === null) {
                      vErrors = [err134];
                    } else {
                      vErrors.push(err134);
                    }
                    errors++;
                  }
                }
                if (data47.release_time_ps !== undefined) {
                  let data57 = data47.release_time_ps;
                  if (!(typeof data57 == "number" && !(data57 % 1) && !isNaN(data57))) {
                    const err135 = {
                      instancePath: instancePath + "/workload/requests/" + i5 + "/release_time_ps",
                      schemaPath: "#/properties/workload/properties/requests/items/properties/release_time_ps/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err135];
                    } else {
                      vErrors.push(err135);
                    }
                    errors++;
                  }
                  if (typeof data57 == "number") {
                    if (data57 > 9007199254740991 || isNaN(data57)) {
                      const err136 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/release_time_ps",
                        schemaPath:
                          "#/properties/workload/properties/requests/items/properties/release_time_ps/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 9007199254740991 },
                        message: "must be <= 9007199254740991",
                      };
                      if (vErrors === null) {
                        vErrors = [err136];
                      } else {
                        vErrors.push(err136);
                      }
                      errors++;
                    }
                    if (data57 < 0 || isNaN(data57)) {
                      const err137 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/release_time_ps",
                        schemaPath:
                          "#/properties/workload/properties/requests/items/properties/release_time_ps/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err137];
                      } else {
                        vErrors.push(err137);
                      }
                      errors++;
                    }
                  }
                }
                if (data47.memory_latency_ps !== undefined) {
                  let data58 = data47.memory_latency_ps;
                  if (!(typeof data58 == "number" && !(data58 % 1) && !isNaN(data58))) {
                    const err138 = {
                      instancePath: instancePath + "/workload/requests/" + i5 + "/memory_latency_ps",
                      schemaPath: "#/properties/workload/properties/requests/items/properties/memory_latency_ps/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err138];
                    } else {
                      vErrors.push(err138);
                    }
                    errors++;
                  }
                  if (typeof data58 == "number") {
                    if (data58 > 9007199254740991 || isNaN(data58)) {
                      const err139 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/memory_latency_ps",
                        schemaPath:
                          "#/properties/workload/properties/requests/items/properties/memory_latency_ps/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 9007199254740991 },
                        message: "must be <= 9007199254740991",
                      };
                      if (vErrors === null) {
                        vErrors = [err139];
                      } else {
                        vErrors.push(err139);
                      }
                      errors++;
                    }
                    if (data58 < 0 || isNaN(data58)) {
                      const err140 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/memory_latency_ps",
                        schemaPath:
                          "#/properties/workload/properties/requests/items/properties/memory_latency_ps/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err140];
                      } else {
                        vErrors.push(err140);
                      }
                      errors++;
                    }
                  }
                }
                if (data47.device_latency_ps !== undefined) {
                  let data59 = data47.device_latency_ps;
                  if (!(typeof data59 == "number" && !(data59 % 1) && !isNaN(data59))) {
                    const err141 = {
                      instancePath: instancePath + "/workload/requests/" + i5 + "/device_latency_ps",
                      schemaPath: "#/properties/workload/properties/requests/items/properties/device_latency_ps/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err141];
                    } else {
                      vErrors.push(err141);
                    }
                    errors++;
                  }
                  if (typeof data59 == "number") {
                    if (data59 > 9007199254740991 || isNaN(data59)) {
                      const err142 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/device_latency_ps",
                        schemaPath:
                          "#/properties/workload/properties/requests/items/properties/device_latency_ps/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 9007199254740991 },
                        message: "must be <= 9007199254740991",
                      };
                      if (vErrors === null) {
                        vErrors = [err142];
                      } else {
                        vErrors.push(err142);
                      }
                      errors++;
                    }
                    if (data59 < 0 || isNaN(data59)) {
                      const err143 = {
                        instancePath: instancePath + "/workload/requests/" + i5 + "/device_latency_ps",
                        schemaPath:
                          "#/properties/workload/properties/requests/items/properties/device_latency_ps/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err143];
                      } else {
                        vErrors.push(err143);
                      }
                      errors++;
                    }
                  }
                }
              } else {
                const err144 = {
                  instancePath: instancePath + "/workload/requests/" + i5,
                  schemaPath: "#/properties/workload/properties/requests/items/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                };
                if (vErrors === null) {
                  vErrors = [err144];
                } else {
                  vErrors.push(err144);
                }
                errors++;
              }
            }
          } else {
            const err145 = {
              instancePath: instancePath + "/workload/requests",
              schemaPath: "#/properties/workload/properties/requests/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err145];
            } else {
              vErrors.push(err145);
            }
            errors++;
          }
        }
      } else {
        const err146 = {
          instancePath: instancePath + "/workload",
          schemaPath: "#/properties/workload/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err146];
        } else {
          vErrors.push(err146);
        }
        errors++;
      }
    }
  } else {
    const err147 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err147];
    } else {
      vErrors.push(err147);
    }
    errors++;
  }
  validate22.errors = vErrors;
  return errors === 0;
}
validate22.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate21(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/custom-run-inputs.schema.json" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate21.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.runtime_trace === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "runtime_trace" },
        message: "must have required property '" + "runtime_trace" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.topology === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "topology" },
        message: "must have required property '" + "topology" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "runtime_trace" || key0 === "topology")) {
        const err2 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.runtime_trace !== undefined) {
      let data0 = data.runtime_trace;
      if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
        if (data0.policy === undefined) {
          const err3 = {
            instancePath: instancePath + "/runtime_trace",
            schemaPath: "runtime-trace-input.schema.json/required",
            keyword: "required",
            params: { missingProperty: "policy" },
            message: "must have required property '" + "policy" + "'",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (data0.requests === undefined) {
          const err4 = {
            instancePath: instancePath + "/runtime_trace",
            schemaPath: "runtime-trace-input.schema.json/required",
            keyword: "required",
            params: { missingProperty: "requests" },
            message: "must have required property '" + "requests" + "'",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        for (const key1 in data0) {
          if (!(key1 === "trace_name" || key1 === "trace_provenance" || key1 === "policy" || key1 === "requests")) {
            const err5 = {
              instancePath: instancePath + "/runtime_trace",
              schemaPath: "runtime-trace-input.schema.json/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors++;
          }
        }
        if (data0.trace_name !== undefined) {
          let data1 = data0.trace_name;
          if (typeof data1 === "string") {
            if (func1(data1) > 256) {
              const err6 = {
                instancePath: instancePath + "/runtime_trace/trace_name",
                schemaPath: "runtime-trace-input.schema.json/properties/trace_name/maxLength",
                keyword: "maxLength",
                params: { limit: 256 },
                message: "must NOT have more than 256 characters",
              };
              if (vErrors === null) {
                vErrors = [err6];
              } else {
                vErrors.push(err6);
              }
              errors++;
            }
            if (func1(data1) < 1) {
              const err7 = {
                instancePath: instancePath + "/runtime_trace/trace_name",
                schemaPath: "runtime-trace-input.schema.json/properties/trace_name/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err7];
              } else {
                vErrors.push(err7);
              }
              errors++;
            }
          } else {
            const err8 = {
              instancePath: instancePath + "/runtime_trace/trace_name",
              schemaPath: "runtime-trace-input.schema.json/properties/trace_name/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
          }
        }
        if (data0.trace_provenance !== undefined) {
          let data2 = data0.trace_provenance;
          if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
            if (data2.source_mode === undefined) {
              const err9 = {
                instancePath: instancePath + "/runtime_trace/trace_provenance",
                schemaPath: "runtime-trace-input.schema.json/properties/trace_provenance/required",
                keyword: "required",
                params: { missingProperty: "source_mode" },
                message: "must have required property '" + "source_mode" + "'",
              };
              if (vErrors === null) {
                vErrors = [err9];
              } else {
                vErrors.push(err9);
              }
              errors++;
            }
            if (data2.calibration_level === undefined) {
              const err10 = {
                instancePath: instancePath + "/runtime_trace/trace_provenance",
                schemaPath: "runtime-trace-input.schema.json/properties/trace_provenance/required",
                keyword: "required",
                params: { missingProperty: "calibration_level" },
                message: "must have required property '" + "calibration_level" + "'",
              };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
            }
            if (data2.allowed_claim_scope === undefined) {
              const err11 = {
                instancePath: instancePath + "/runtime_trace/trace_provenance",
                schemaPath: "runtime-trace-input.schema.json/properties/trace_provenance/required",
                keyword: "required",
                params: { missingProperty: "allowed_claim_scope" },
                message: "must have required property '" + "allowed_claim_scope" + "'",
              };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
            for (const key2 in data2) {
              if (!func4.call(schema34.properties.trace_provenance.properties, key2)) {
                const err12 = {
                  instancePath: instancePath + "/runtime_trace/trace_provenance",
                  schemaPath: "runtime-trace-input.schema.json/properties/trace_provenance/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key2 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err12];
                } else {
                  vErrors.push(err12);
                }
                errors++;
              }
            }
            if (data2.source_mode !== undefined) {
              if ("synthetic_trace" !== data2.source_mode) {
                const err13 = {
                  instancePath: instancePath + "/runtime_trace/trace_provenance/source_mode",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/trace_provenance/properties/source_mode/const",
                  keyword: "const",
                  params: { allowedValue: "synthetic_trace" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err13];
                } else {
                  vErrors.push(err13);
                }
                errors++;
              }
            }
            if (data2.calibration_level !== undefined) {
              let data4 = data2.calibration_level;
              if (!(data4 === "uncalibrated" || data4 === "partially_calibrated")) {
                const err14 = {
                  instancePath: instancePath + "/runtime_trace/trace_provenance/calibration_level",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/trace_provenance/properties/calibration_level/enum",
                  keyword: "enum",
                  params: { allowedValues: schema34.properties.trace_provenance.properties.calibration_level.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err14];
                } else {
                  vErrors.push(err14);
                }
                errors++;
              }
            }
            if (data2.allowed_claim_scope !== undefined) {
              let data5 = data2.allowed_claim_scope;
              if (!(
                data5 === "exploratory" ||
                data5 === "exploratory_s6_only" ||
                data5 === "synthetic_consistency" ||
                data5 === "synthetic_consistency_only" ||
                data5 === "workflow_consistency_only"
              )) {
                const err15 = {
                  instancePath: instancePath + "/runtime_trace/trace_provenance/allowed_claim_scope",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/trace_provenance/properties/allowed_claim_scope/enum",
                  keyword: "enum",
                  params: { allowedValues: schema34.properties.trace_provenance.properties.allowed_claim_scope.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err15];
                } else {
                  vErrors.push(err15);
                }
                errors++;
              }
            }
            if (data2.source_id !== undefined) {
              let data6 = data2.source_id;
              if (typeof data6 === "string") {
                if (func1(data6) > 512) {
                  const err16 = {
                    instancePath: instancePath + "/runtime_trace/trace_provenance/source_id",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/trace_provenance/properties/source_id/maxLength",
                    keyword: "maxLength",
                    params: { limit: 512 },
                    message: "must NOT have more than 512 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err16];
                  } else {
                    vErrors.push(err16);
                  }
                  errors++;
                }
              } else {
                const err17 = {
                  instancePath: instancePath + "/runtime_trace/trace_provenance/source_id",
                  schemaPath: "runtime-trace-input.schema.json/properties/trace_provenance/properties/source_id/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err17];
                } else {
                  vErrors.push(err17);
                }
                errors++;
              }
            }
            if (data2.generation_path !== undefined) {
              let data7 = data2.generation_path;
              if (typeof data7 === "string") {
                if (func1(data7) > 512) {
                  const err18 = {
                    instancePath: instancePath + "/runtime_trace/trace_provenance/generation_path",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/trace_provenance/properties/generation_path/maxLength",
                    keyword: "maxLength",
                    params: { limit: 512 },
                    message: "must NOT have more than 512 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err18];
                  } else {
                    vErrors.push(err18);
                  }
                  errors++;
                }
              } else {
                const err19 = {
                  instancePath: instancePath + "/runtime_trace/trace_provenance/generation_path",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/trace_provenance/properties/generation_path/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err19];
                } else {
                  vErrors.push(err19);
                }
                errors++;
              }
            }
            if (data2.capture_or_generation_time !== undefined) {
              let data8 = data2.capture_or_generation_time;
              if (typeof data8 === "string") {
                if (func1(data8) > 160) {
                  const err20 = {
                    instancePath: instancePath + "/runtime_trace/trace_provenance/capture_or_generation_time",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/trace_provenance/properties/capture_or_generation_time/maxLength",
                    keyword: "maxLength",
                    params: { limit: 160 },
                    message: "must NOT have more than 160 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err20];
                  } else {
                    vErrors.push(err20);
                  }
                  errors++;
                }
              } else {
                const err21 = {
                  instancePath: instancePath + "/runtime_trace/trace_provenance/capture_or_generation_time",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/trace_provenance/properties/capture_or_generation_time/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err21];
                } else {
                  vErrors.push(err21);
                }
                errors++;
              }
            }
            if (data2.upstream_tooling !== undefined) {
              let data9 = data2.upstream_tooling;
              if (typeof data9 === "string") {
                if (func1(data9) > 160) {
                  const err22 = {
                    instancePath: instancePath + "/runtime_trace/trace_provenance/upstream_tooling",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/trace_provenance/properties/upstream_tooling/maxLength",
                    keyword: "maxLength",
                    params: { limit: 160 },
                    message: "must NOT have more than 160 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err22];
                  } else {
                    vErrors.push(err22);
                  }
                  errors++;
                }
              } else {
                const err23 = {
                  instancePath: instancePath + "/runtime_trace/trace_provenance/upstream_tooling",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/trace_provenance/properties/upstream_tooling/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err23];
                } else {
                  vErrors.push(err23);
                }
                errors++;
              }
            }
            if (data2.trace_kind !== undefined) {
              let data10 = data2.trace_kind;
              if (typeof data10 === "string") {
                if (func1(data10) > 160) {
                  const err24 = {
                    instancePath: instancePath + "/runtime_trace/trace_provenance/trace_kind",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/trace_provenance/properties/trace_kind/maxLength",
                    keyword: "maxLength",
                    params: { limit: 160 },
                    message: "must NOT have more than 160 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err24];
                  } else {
                    vErrors.push(err24);
                  }
                  errors++;
                }
              } else {
                const err25 = {
                  instancePath: instancePath + "/runtime_trace/trace_provenance/trace_kind",
                  schemaPath: "runtime-trace-input.schema.json/properties/trace_provenance/properties/trace_kind/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err25];
                } else {
                  vErrors.push(err25);
                }
                errors++;
              }
            }
            if (data2.notes !== undefined) {
              let data11 = data2.notes;
              if (Array.isArray(data11)) {
                if (data11.length > 64) {
                  const err26 = {
                    instancePath: instancePath + "/runtime_trace/trace_provenance/notes",
                    schemaPath: "runtime-trace-input.schema.json/properties/trace_provenance/properties/notes/maxItems",
                    keyword: "maxItems",
                    params: { limit: 64 },
                    message: "must NOT have more than 64 items",
                  };
                  if (vErrors === null) {
                    vErrors = [err26];
                  } else {
                    vErrors.push(err26);
                  }
                  errors++;
                }
                const len0 = data11.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  let data12 = data11[i0];
                  if (typeof data12 === "string") {
                    if (func1(data12) > 512) {
                      const err27 = {
                        instancePath: instancePath + "/runtime_trace/trace_provenance/notes/" + i0,
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/trace_provenance/properties/notes/items/maxLength",
                        keyword: "maxLength",
                        params: { limit: 512 },
                        message: "must NOT have more than 512 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err27];
                      } else {
                        vErrors.push(err27);
                      }
                      errors++;
                    }
                  } else {
                    const err28 = {
                      instancePath: instancePath + "/runtime_trace/trace_provenance/notes/" + i0,
                      schemaPath:
                        "runtime-trace-input.schema.json/properties/trace_provenance/properties/notes/items/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err28];
                    } else {
                      vErrors.push(err28);
                    }
                    errors++;
                  }
                }
              } else {
                const err29 = {
                  instancePath: instancePath + "/runtime_trace/trace_provenance/notes",
                  schemaPath: "runtime-trace-input.schema.json/properties/trace_provenance/properties/notes/type",
                  keyword: "type",
                  params: { type: "array" },
                  message: "must be array",
                };
                if (vErrors === null) {
                  vErrors = [err29];
                } else {
                  vErrors.push(err29);
                }
                errors++;
              }
            }
          } else {
            const err30 = {
              instancePath: instancePath + "/runtime_trace/trace_provenance",
              schemaPath: "runtime-trace-input.schema.json/properties/trace_provenance/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err30];
            } else {
              vErrors.push(err30);
            }
            errors++;
          }
        }
        if (data0.policy !== undefined) {
          let data13 = data0.policy;
          if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
            for (const key3 in data13) {
              if (!func4.call(schema34.properties.policy.properties, key3)) {
                const err31 = {
                  instancePath: instancePath + "/runtime_trace/policy",
                  schemaPath: "runtime-trace-input.schema.json/properties/policy/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key3 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err31];
                } else {
                  vErrors.push(err31);
                }
                errors++;
              }
            }
            if (data13.kv_capacity_tokens !== undefined) {
              let data14 = data13.kv_capacity_tokens;
              if (!(typeof data14 == "number" && !(data14 % 1) && !isNaN(data14))) {
                const err32 = {
                  instancePath: instancePath + "/runtime_trace/policy/kv_capacity_tokens",
                  schemaPath: "runtime-trace-input.schema.json/properties/policy/properties/kv_capacity_tokens/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err32];
                } else {
                  vErrors.push(err32);
                }
                errors++;
              }
              if (typeof data14 == "number") {
                if (data14 > 9007199254740991 || isNaN(data14)) {
                  const err33 = {
                    instancePath: instancePath + "/runtime_trace/policy/kv_capacity_tokens",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/kv_capacity_tokens/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 9007199254740991 },
                    message: "must be <= 9007199254740991",
                  };
                  if (vErrors === null) {
                    vErrors = [err33];
                  } else {
                    vErrors.push(err33);
                  }
                  errors++;
                }
                if (data14 < 0 || isNaN(data14)) {
                  const err34 = {
                    instancePath: instancePath + "/runtime_trace/policy/kv_capacity_tokens",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/kv_capacity_tokens/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err34];
                  } else {
                    vErrors.push(err34);
                  }
                  errors++;
                }
              }
            }
            if (data13.initial_kv_tokens !== undefined) {
              let data15 = data13.initial_kv_tokens;
              if (!(typeof data15 == "number" && !(data15 % 1) && !isNaN(data15))) {
                const err35 = {
                  instancePath: instancePath + "/runtime_trace/policy/initial_kv_tokens",
                  schemaPath: "runtime-trace-input.schema.json/properties/policy/properties/initial_kv_tokens/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err35];
                } else {
                  vErrors.push(err35);
                }
                errors++;
              }
              if (typeof data15 == "number") {
                if (data15 > 9007199254740991 || isNaN(data15)) {
                  const err36 = {
                    instancePath: instancePath + "/runtime_trace/policy/initial_kv_tokens",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/initial_kv_tokens/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 9007199254740991 },
                    message: "must be <= 9007199254740991",
                  };
                  if (vErrors === null) {
                    vErrors = [err36];
                  } else {
                    vErrors.push(err36);
                  }
                  errors++;
                }
                if (data15 < 0 || isNaN(data15)) {
                  const err37 = {
                    instancePath: instancePath + "/runtime_trace/policy/initial_kv_tokens",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/initial_kv_tokens/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err37];
                  } else {
                    vErrors.push(err37);
                  }
                  errors++;
                }
              }
            }
            if (data13.max_active_requests !== undefined) {
              let data16 = data13.max_active_requests;
              if (!(typeof data16 == "number" && !(data16 % 1) && !isNaN(data16))) {
                const err38 = {
                  instancePath: instancePath + "/runtime_trace/policy/max_active_requests",
                  schemaPath: "runtime-trace-input.schema.json/properties/policy/properties/max_active_requests/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err38];
                } else {
                  vErrors.push(err38);
                }
                errors++;
              }
              if (typeof data16 == "number") {
                if (data16 > 1024 || isNaN(data16)) {
                  const err39 = {
                    instancePath: instancePath + "/runtime_trace/policy/max_active_requests",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/max_active_requests/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 1024 },
                    message: "must be <= 1024",
                  };
                  if (vErrors === null) {
                    vErrors = [err39];
                  } else {
                    vErrors.push(err39);
                  }
                  errors++;
                }
                if (data16 < 0 || isNaN(data16)) {
                  const err40 = {
                    instancePath: instancePath + "/runtime_trace/policy/max_active_requests",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/max_active_requests/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err40];
                  } else {
                    vErrors.push(err40);
                  }
                  errors++;
                }
              }
            }
            if (data13.max_batch_size !== undefined) {
              let data17 = data13.max_batch_size;
              if (!(typeof data17 == "number" && !(data17 % 1) && !isNaN(data17))) {
                const err41 = {
                  instancePath: instancePath + "/runtime_trace/policy/max_batch_size",
                  schemaPath: "runtime-trace-input.schema.json/properties/policy/properties/max_batch_size/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err41];
                } else {
                  vErrors.push(err41);
                }
                errors++;
              }
              if (typeof data17 == "number") {
                if (data17 > 1024 || isNaN(data17)) {
                  const err42 = {
                    instancePath: instancePath + "/runtime_trace/policy/max_batch_size",
                    schemaPath: "runtime-trace-input.schema.json/properties/policy/properties/max_batch_size/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 1024 },
                    message: "must be <= 1024",
                  };
                  if (vErrors === null) {
                    vErrors = [err42];
                  } else {
                    vErrors.push(err42);
                  }
                  errors++;
                }
                if (data17 < 0 || isNaN(data17)) {
                  const err43 = {
                    instancePath: instancePath + "/runtime_trace/policy/max_batch_size",
                    schemaPath: "runtime-trace-input.schema.json/properties/policy/properties/max_batch_size/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err43];
                  } else {
                    vErrors.push(err43);
                  }
                  errors++;
                }
              }
            }
            if (data13.batch_scheduler !== undefined) {
              let data18 = data13.batch_scheduler;
              if (!(data18 === "fifo" || data18 === "decode_priority" || data18 === "fabric_backpressure_aware")) {
                const err44 = {
                  instancePath: instancePath + "/runtime_trace/policy/batch_scheduler",
                  schemaPath: "runtime-trace-input.schema.json/properties/policy/properties/batch_scheduler/enum",
                  keyword: "enum",
                  params: { allowedValues: schema34.properties.policy.properties.batch_scheduler.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err44];
                } else {
                  vErrors.push(err44);
                }
                errors++;
              }
            }
            if (data13.prefill_starvation_threshold_ps !== undefined) {
              let data19 = data13.prefill_starvation_threshold_ps;
              if (!(typeof data19 == "number" && !(data19 % 1) && !isNaN(data19))) {
                const err45 = {
                  instancePath: instancePath + "/runtime_trace/policy/prefill_starvation_threshold_ps",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/policy/properties/prefill_starvation_threshold_ps/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err45];
                } else {
                  vErrors.push(err45);
                }
                errors++;
              }
              if (typeof data19 == "number") {
                if (data19 > 9007199254740991 || isNaN(data19)) {
                  const err46 = {
                    instancePath: instancePath + "/runtime_trace/policy/prefill_starvation_threshold_ps",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/prefill_starvation_threshold_ps/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 9007199254740991 },
                    message: "must be <= 9007199254740991",
                  };
                  if (vErrors === null) {
                    vErrors = [err46];
                  } else {
                    vErrors.push(err46);
                  }
                  errors++;
                }
                if (data19 < 0 || isNaN(data19)) {
                  const err47 = {
                    instancePath: instancePath + "/runtime_trace/policy/prefill_starvation_threshold_ps",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/prefill_starvation_threshold_ps/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err47];
                  } else {
                    vErrors.push(err47);
                  }
                  errors++;
                }
              }
            }
            if (data13.pd_handoff_delay_ps !== undefined) {
              let data20 = data13.pd_handoff_delay_ps;
              if (!(typeof data20 == "number" && !(data20 % 1) && !isNaN(data20))) {
                const err48 = {
                  instancePath: instancePath + "/runtime_trace/policy/pd_handoff_delay_ps",
                  schemaPath: "runtime-trace-input.schema.json/properties/policy/properties/pd_handoff_delay_ps/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err48];
                } else {
                  vErrors.push(err48);
                }
                errors++;
              }
              if (typeof data20 == "number") {
                if (data20 > 9007199254740991 || isNaN(data20)) {
                  const err49 = {
                    instancePath: instancePath + "/runtime_trace/policy/pd_handoff_delay_ps",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/pd_handoff_delay_ps/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 9007199254740991 },
                    message: "must be <= 9007199254740991",
                  };
                  if (vErrors === null) {
                    vErrors = [err49];
                  } else {
                    vErrors.push(err49);
                  }
                  errors++;
                }
                if (data20 < 0 || isNaN(data20)) {
                  const err50 = {
                    instancePath: instancePath + "/runtime_trace/policy/pd_handoff_delay_ps",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/pd_handoff_delay_ps/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err50];
                  } else {
                    vErrors.push(err50);
                  }
                  errors++;
                }
              }
            }
            if (data13.pd_handoff_queue_service_ps !== undefined) {
              let data21 = data13.pd_handoff_queue_service_ps;
              if (!(typeof data21 == "number" && !(data21 % 1) && !isNaN(data21))) {
                const err51 = {
                  instancePath: instancePath + "/runtime_trace/policy/pd_handoff_queue_service_ps",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/policy/properties/pd_handoff_queue_service_ps/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err51];
                } else {
                  vErrors.push(err51);
                }
                errors++;
              }
              if (typeof data21 == "number") {
                if (data21 > 9007199254740991 || isNaN(data21)) {
                  const err52 = {
                    instancePath: instancePath + "/runtime_trace/policy/pd_handoff_queue_service_ps",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/pd_handoff_queue_service_ps/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 9007199254740991 },
                    message: "must be <= 9007199254740991",
                  };
                  if (vErrors === null) {
                    vErrors = [err52];
                  } else {
                    vErrors.push(err52);
                  }
                  errors++;
                }
                if (data21 < 0 || isNaN(data21)) {
                  const err53 = {
                    instancePath: instancePath + "/runtime_trace/policy/pd_handoff_queue_service_ps",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/pd_handoff_queue_service_ps/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err53];
                  } else {
                    vErrors.push(err53);
                  }
                  errors++;
                }
              }
            }
            if (data13.kv_page_size_tokens !== undefined) {
              let data22 = data13.kv_page_size_tokens;
              if (!(typeof data22 == "number" && !(data22 % 1) && !isNaN(data22))) {
                const err54 = {
                  instancePath: instancePath + "/runtime_trace/policy/kv_page_size_tokens",
                  schemaPath: "runtime-trace-input.schema.json/properties/policy/properties/kv_page_size_tokens/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err54];
                } else {
                  vErrors.push(err54);
                }
                errors++;
              }
              if (typeof data22 == "number") {
                if (data22 > 9007199254740991 || isNaN(data22)) {
                  const err55 = {
                    instancePath: instancePath + "/runtime_trace/policy/kv_page_size_tokens",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/kv_page_size_tokens/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 9007199254740991 },
                    message: "must be <= 9007199254740991",
                  };
                  if (vErrors === null) {
                    vErrors = [err55];
                  } else {
                    vErrors.push(err55);
                  }
                  errors++;
                }
                if (data22 < 0 || isNaN(data22)) {
                  const err56 = {
                    instancePath: instancePath + "/runtime_trace/policy/kv_page_size_tokens",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/kv_page_size_tokens/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err56];
                  } else {
                    vErrors.push(err56);
                  }
                  errors++;
                }
              }
            }
            if (data13.kv_fragmentation_overhead !== undefined) {
              let data23 = data13.kv_fragmentation_overhead;
              if (typeof data23 == "number") {
                if (data23 < 0 || isNaN(data23)) {
                  const err57 = {
                    instancePath: instancePath + "/runtime_trace/policy/kv_fragmentation_overhead",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/kv_fragmentation_overhead/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err57];
                  } else {
                    vErrors.push(err57);
                  }
                  errors++;
                }
              } else {
                const err58 = {
                  instancePath: instancePath + "/runtime_trace/policy/kv_fragmentation_overhead",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/policy/properties/kv_fragmentation_overhead/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err58];
                } else {
                  vErrors.push(err58);
                }
                errors++;
              }
            }
            if (data13.kv_admission_watermark !== undefined) {
              let data24 = data13.kv_admission_watermark;
              if (typeof data24 == "number") {
                if (data24 > 1 || isNaN(data24)) {
                  const err59 = {
                    instancePath: instancePath + "/runtime_trace/policy/kv_admission_watermark",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/kv_admission_watermark/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 1 },
                    message: "must be <= 1",
                  };
                  if (vErrors === null) {
                    vErrors = [err59];
                  } else {
                    vErrors.push(err59);
                  }
                  errors++;
                }
                if (data24 < 0 || isNaN(data24)) {
                  const err60 = {
                    instancePath: instancePath + "/runtime_trace/policy/kv_admission_watermark",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/kv_admission_watermark/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err60];
                  } else {
                    vErrors.push(err60);
                  }
                  errors++;
                }
              } else {
                const err61 = {
                  instancePath: instancePath + "/runtime_trace/policy/kv_admission_watermark",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/policy/properties/kv_admission_watermark/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err61];
                } else {
                  vErrors.push(err61);
                }
                errors++;
              }
            }
            if (data13.fabric_backpressure_active !== undefined) {
              if (typeof data13.fabric_backpressure_active !== "boolean") {
                const err62 = {
                  instancePath: instancePath + "/runtime_trace/policy/fabric_backpressure_active",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/policy/properties/fabric_backpressure_active/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                };
                if (vErrors === null) {
                  vErrors = [err62];
                } else {
                  vErrors.push(err62);
                }
                errors++;
              }
            }
            if (data13.fabric_backpressure_delay_us !== undefined) {
              let data26 = data13.fabric_backpressure_delay_us;
              if (typeof data26 == "number") {
                if (data26 < 0 || isNaN(data26)) {
                  const err63 = {
                    instancePath: instancePath + "/runtime_trace/policy/fabric_backpressure_delay_us",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/fabric_backpressure_delay_us/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err63];
                  } else {
                    vErrors.push(err63);
                  }
                  errors++;
                }
              } else {
                const err64 = {
                  instancePath: instancePath + "/runtime_trace/policy/fabric_backpressure_delay_us",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/policy/properties/fabric_backpressure_delay_us/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err64];
                } else {
                  vErrors.push(err64);
                }
                errors++;
              }
            }
            if (data13.fabric_backpressure_throttle_threshold_us !== undefined) {
              let data27 = data13.fabric_backpressure_throttle_threshold_us;
              if (typeof data27 == "number") {
                if (data27 < 0 || isNaN(data27)) {
                  const err65 = {
                    instancePath: instancePath + "/runtime_trace/policy/fabric_backpressure_throttle_threshold_us",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/fabric_backpressure_throttle_threshold_us/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err65];
                  } else {
                    vErrors.push(err65);
                  }
                  errors++;
                }
              } else {
                const err66 = {
                  instancePath: instancePath + "/runtime_trace/policy/fabric_backpressure_throttle_threshold_us",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/policy/properties/fabric_backpressure_throttle_threshold_us/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err66];
                } else {
                  vErrors.push(err66);
                }
                errors++;
              }
            }
            if (data13.fabric_backpressure_prefill_batch_limit !== undefined) {
              let data28 = data13.fabric_backpressure_prefill_batch_limit;
              if (!(typeof data28 == "number" && !(data28 % 1) && !isNaN(data28))) {
                const err67 = {
                  instancePath: instancePath + "/runtime_trace/policy/fabric_backpressure_prefill_batch_limit",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/policy/properties/fabric_backpressure_prefill_batch_limit/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err67];
                } else {
                  vErrors.push(err67);
                }
                errors++;
              }
              if (typeof data28 == "number") {
                if (data28 > 1024 || isNaN(data28)) {
                  const err68 = {
                    instancePath: instancePath + "/runtime_trace/policy/fabric_backpressure_prefill_batch_limit",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/fabric_backpressure_prefill_batch_limit/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 1024 },
                    message: "must be <= 1024",
                  };
                  if (vErrors === null) {
                    vErrors = [err68];
                  } else {
                    vErrors.push(err68);
                  }
                  errors++;
                }
                if (data28 < 0 || isNaN(data28)) {
                  const err69 = {
                    instancePath: instancePath + "/runtime_trace/policy/fabric_backpressure_prefill_batch_limit",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/fabric_backpressure_prefill_batch_limit/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err69];
                  } else {
                    vErrors.push(err69);
                  }
                  errors++;
                }
              }
            }
            if (data13.long_context_threshold_tokens !== undefined) {
              let data29 = data13.long_context_threshold_tokens;
              if (!(typeof data29 == "number" && !(data29 % 1) && !isNaN(data29))) {
                const err70 = {
                  instancePath: instancePath + "/runtime_trace/policy/long_context_threshold_tokens",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/policy/properties/long_context_threshold_tokens/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err70];
                } else {
                  vErrors.push(err70);
                }
                errors++;
              }
              if (typeof data29 == "number") {
                if (data29 > 9007199254740991 || isNaN(data29)) {
                  const err71 = {
                    instancePath: instancePath + "/runtime_trace/policy/long_context_threshold_tokens",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/long_context_threshold_tokens/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 9007199254740991 },
                    message: "must be <= 9007199254740991",
                  };
                  if (vErrors === null) {
                    vErrors = [err71];
                  } else {
                    vErrors.push(err71);
                  }
                  errors++;
                }
                if (data29 < 0 || isNaN(data29)) {
                  const err72 = {
                    instancePath: instancePath + "/runtime_trace/policy/long_context_threshold_tokens",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/long_context_threshold_tokens/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err72];
                  } else {
                    vErrors.push(err72);
                  }
                  errors++;
                }
              }
            }
            if (data13.decode_penalty_per_threshold !== undefined) {
              let data30 = data13.decode_penalty_per_threshold;
              if (typeof data30 == "number") {
                if (data30 < 0 || isNaN(data30)) {
                  const err73 = {
                    instancePath: instancePath + "/runtime_trace/policy/decode_penalty_per_threshold",
                    schemaPath:
                      "runtime-trace-input.schema.json/properties/policy/properties/decode_penalty_per_threshold/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err73];
                  } else {
                    vErrors.push(err73);
                  }
                  errors++;
                }
              } else {
                const err74 = {
                  instancePath: instancePath + "/runtime_trace/policy/decode_penalty_per_threshold",
                  schemaPath:
                    "runtime-trace-input.schema.json/properties/policy/properties/decode_penalty_per_threshold/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err74];
                } else {
                  vErrors.push(err74);
                }
                errors++;
              }
            }
          } else {
            const err75 = {
              instancePath: instancePath + "/runtime_trace/policy",
              schemaPath: "runtime-trace-input.schema.json/properties/policy/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err75];
            } else {
              vErrors.push(err75);
            }
            errors++;
          }
        }
        if (data0.requests !== undefined) {
          let data31 = data0.requests;
          if (Array.isArray(data31)) {
            if (data31.length > 1024) {
              const err76 = {
                instancePath: instancePath + "/runtime_trace/requests",
                schemaPath: "runtime-trace-input.schema.json/properties/requests/maxItems",
                keyword: "maxItems",
                params: { limit: 1024 },
                message: "must NOT have more than 1024 items",
              };
              if (vErrors === null) {
                vErrors = [err76];
              } else {
                vErrors.push(err76);
              }
              errors++;
            }
            if (data31.length < 1) {
              const err77 = {
                instancePath: instancePath + "/runtime_trace/requests",
                schemaPath: "runtime-trace-input.schema.json/properties/requests/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              if (vErrors === null) {
                vErrors = [err77];
              } else {
                vErrors.push(err77);
              }
              errors++;
            }
            const len1 = data31.length;
            for (let i1 = 0; i1 < len1; i1++) {
              let data32 = data31[i1];
              if (data32 && typeof data32 == "object" && !Array.isArray(data32)) {
                if (data32.request_id === undefined) {
                  const err78 = {
                    instancePath: instancePath + "/runtime_trace/requests/" + i1,
                    schemaPath: "runtime-trace-input.schema.json/properties/requests/items/required",
                    keyword: "required",
                    params: { missingProperty: "request_id" },
                    message: "must have required property '" + "request_id" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err78];
                  } else {
                    vErrors.push(err78);
                  }
                  errors++;
                }
                for (const key4 in data32) {
                  if (!func4.call(schema34.properties.requests.items.properties, key4)) {
                    const err79 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1,
                      schemaPath: "runtime-trace-input.schema.json/properties/requests/items/additionalProperties",
                      keyword: "additionalProperties",
                      params: { additionalProperty: key4 },
                      message: "must NOT have additional properties",
                    };
                    if (vErrors === null) {
                      vErrors = [err79];
                    } else {
                      vErrors.push(err79);
                    }
                    errors++;
                  }
                }
                if (data32.request_id !== undefined) {
                  let data33 = data32.request_id;
                  if (typeof data33 === "string") {
                    if (func1(data33) > 256) {
                      const err80 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/request_id",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/request_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err80];
                      } else {
                        vErrors.push(err80);
                      }
                      errors++;
                    }
                    if (func1(data33) < 1) {
                      const err81 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/request_id",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/request_id/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err81];
                      } else {
                        vErrors.push(err81);
                      }
                      errors++;
                    }
                  } else {
                    const err82 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/request_id",
                      schemaPath:
                        "runtime-trace-input.schema.json/properties/requests/items/properties/request_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err82];
                    } else {
                      vErrors.push(err82);
                    }
                    errors++;
                  }
                }
                if (data32.model_id !== undefined) {
                  let data34 = data32.model_id;
                  if (typeof data34 === "string") {
                    if (func1(data34) > 256) {
                      const err83 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/model_id",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/model_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err83];
                      } else {
                        vErrors.push(err83);
                      }
                      errors++;
                    }
                  } else {
                    const err84 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/model_id",
                      schemaPath: "runtime-trace-input.schema.json/properties/requests/items/properties/model_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err84];
                    } else {
                      vErrors.push(err84);
                    }
                    errors++;
                  }
                }
                if (data32.arrival_time_ps !== undefined) {
                  let data35 = data32.arrival_time_ps;
                  if (!(typeof data35 == "number" && !(data35 % 1) && !isNaN(data35))) {
                    const err85 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/arrival_time_ps",
                      schemaPath:
                        "runtime-trace-input.schema.json/properties/requests/items/properties/arrival_time_ps/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err85];
                    } else {
                      vErrors.push(err85);
                    }
                    errors++;
                  }
                  if (typeof data35 == "number") {
                    if (data35 > 9007199254740991 || isNaN(data35)) {
                      const err86 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/arrival_time_ps",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/arrival_time_ps/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 9007199254740991 },
                        message: "must be <= 9007199254740991",
                      };
                      if (vErrors === null) {
                        vErrors = [err86];
                      } else {
                        vErrors.push(err86);
                      }
                      errors++;
                    }
                    if (data35 < 0 || isNaN(data35)) {
                      const err87 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/arrival_time_ps",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/arrival_time_ps/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err87];
                      } else {
                        vErrors.push(err87);
                      }
                      errors++;
                    }
                  }
                }
                if (data32.phase !== undefined) {
                  let data36 = data32.phase;
                  if (!(data36 === "prefill" || data36 === "decode")) {
                    const err88 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/phase",
                      schemaPath: "runtime-trace-input.schema.json/properties/requests/items/properties/phase/enum",
                      keyword: "enum",
                      params: { allowedValues: schema34.properties.requests.items.properties.phase.enum },
                      message: "must be equal to one of the allowed values",
                    };
                    if (vErrors === null) {
                      vErrors = [err88];
                    } else {
                      vErrors.push(err88);
                    }
                    errors++;
                  }
                }
                if (data32.prompt_tokens !== undefined) {
                  let data37 = data32.prompt_tokens;
                  if (!(typeof data37 == "number" && !(data37 % 1) && !isNaN(data37))) {
                    const err89 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/prompt_tokens",
                      schemaPath:
                        "runtime-trace-input.schema.json/properties/requests/items/properties/prompt_tokens/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err89];
                    } else {
                      vErrors.push(err89);
                    }
                    errors++;
                  }
                  if (typeof data37 == "number") {
                    if (data37 > 9007199254740991 || isNaN(data37)) {
                      const err90 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/prompt_tokens",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/prompt_tokens/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 9007199254740991 },
                        message: "must be <= 9007199254740991",
                      };
                      if (vErrors === null) {
                        vErrors = [err90];
                      } else {
                        vErrors.push(err90);
                      }
                      errors++;
                    }
                    if (data37 < 0 || isNaN(data37)) {
                      const err91 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/prompt_tokens",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/prompt_tokens/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err91];
                      } else {
                        vErrors.push(err91);
                      }
                      errors++;
                    }
                  }
                }
                if (data32.decode_tokens !== undefined) {
                  let data38 = data32.decode_tokens;
                  if (!(typeof data38 == "number" && !(data38 % 1) && !isNaN(data38))) {
                    const err92 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/decode_tokens",
                      schemaPath:
                        "runtime-trace-input.schema.json/properties/requests/items/properties/decode_tokens/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err92];
                    } else {
                      vErrors.push(err92);
                    }
                    errors++;
                  }
                  if (typeof data38 == "number") {
                    if (data38 > 9007199254740991 || isNaN(data38)) {
                      const err93 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/decode_tokens",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/decode_tokens/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 9007199254740991 },
                        message: "must be <= 9007199254740991",
                      };
                      if (vErrors === null) {
                        vErrors = [err93];
                      } else {
                        vErrors.push(err93);
                      }
                      errors++;
                    }
                    if (data38 < 0 || isNaN(data38)) {
                      const err94 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/decode_tokens",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/decode_tokens/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err94];
                      } else {
                        vErrors.push(err94);
                      }
                      errors++;
                    }
                  }
                }
                if (data32.kv_tokens !== undefined) {
                  let data39 = data32.kv_tokens;
                  if (!(typeof data39 == "number" && !(data39 % 1) && !isNaN(data39))) {
                    const err95 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/kv_tokens",
                      schemaPath: "runtime-trace-input.schema.json/properties/requests/items/properties/kv_tokens/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err95];
                    } else {
                      vErrors.push(err95);
                    }
                    errors++;
                  }
                  if (typeof data39 == "number") {
                    if (data39 > 9007199254740991 || isNaN(data39)) {
                      const err96 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/kv_tokens",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/kv_tokens/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 9007199254740991 },
                        message: "must be <= 9007199254740991",
                      };
                      if (vErrors === null) {
                        vErrors = [err96];
                      } else {
                        vErrors.push(err96);
                      }
                      errors++;
                    }
                    if (data39 < 0 || isNaN(data39)) {
                      const err97 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/kv_tokens",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/kv_tokens/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err97];
                      } else {
                        vErrors.push(err97);
                      }
                      errors++;
                    }
                  }
                }
                if (data32.priority_class !== undefined) {
                  let data40 = data32.priority_class;
                  if (!(typeof data40 == "number" && !(data40 % 1) && !isNaN(data40))) {
                    const err98 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/priority_class",
                      schemaPath:
                        "runtime-trace-input.schema.json/properties/requests/items/properties/priority_class/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err98];
                    } else {
                      vErrors.push(err98);
                    }
                    errors++;
                  }
                }
                if (data32.tp_degree !== undefined) {
                  let data41 = data32.tp_degree;
                  if (!(typeof data41 == "number" && !(data41 % 1) && !isNaN(data41))) {
                    const err99 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/tp_degree",
                      schemaPath: "runtime-trace-input.schema.json/properties/requests/items/properties/tp_degree/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err99];
                    } else {
                      vErrors.push(err99);
                    }
                    errors++;
                  }
                  if (typeof data41 == "number") {
                    if (data41 > 1024 || isNaN(data41)) {
                      const err100 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/tp_degree",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/tp_degree/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 1024 },
                        message: "must be <= 1024",
                      };
                      if (vErrors === null) {
                        vErrors = [err100];
                      } else {
                        vErrors.push(err100);
                      }
                      errors++;
                    }
                    if (data41 < 1 || isNaN(data41)) {
                      const err101 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/tp_degree",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/tp_degree/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 1 },
                        message: "must be >= 1",
                      };
                      if (vErrors === null) {
                        vErrors = [err101];
                      } else {
                        vErrors.push(err101);
                      }
                      errors++;
                    }
                  }
                }
                if (data32.participants !== undefined) {
                  let data42 = data32.participants;
                  if (Array.isArray(data42)) {
                    if (data42.length > 1024) {
                      const err102 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/participants",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/participants/maxItems",
                        keyword: "maxItems",
                        params: { limit: 1024 },
                        message: "must NOT have more than 1024 items",
                      };
                      if (vErrors === null) {
                        vErrors = [err102];
                      } else {
                        vErrors.push(err102);
                      }
                      errors++;
                    }
                    const len2 = data42.length;
                    for (let i2 = 0; i2 < len2; i2++) {
                      let data43 = data42[i2];
                      if (typeof data43 === "string") {
                        if (func1(data43) < 1) {
                          const err103 = {
                            instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/participants/" + i2,
                            schemaPath:
                              "runtime-trace-input.schema.json/properties/requests/items/properties/participants/items/minLength",
                            keyword: "minLength",
                            params: { limit: 1 },
                            message: "must NOT have fewer than 1 characters",
                          };
                          if (vErrors === null) {
                            vErrors = [err103];
                          } else {
                            vErrors.push(err103);
                          }
                          errors++;
                        }
                      } else {
                        const err104 = {
                          instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/participants/" + i2,
                          schemaPath:
                            "runtime-trace-input.schema.json/properties/requests/items/properties/participants/items/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        };
                        if (vErrors === null) {
                          vErrors = [err104];
                        } else {
                          vErrors.push(err104);
                        }
                        errors++;
                      }
                    }
                  } else {
                    const err105 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/participants",
                      schemaPath:
                        "runtime-trace-input.schema.json/properties/requests/items/properties/participants/type",
                      keyword: "type",
                      params: { type: "array" },
                      message: "must be array",
                    };
                    if (vErrors === null) {
                      vErrors = [err105];
                    } else {
                      vErrors.push(err105);
                    }
                    errors++;
                  }
                }
                if (data32.collective_type !== undefined) {
                  let data44 = data32.collective_type;
                  if (typeof data44 === "string") {
                    if (func1(data44) > 160) {
                      const err106 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/collective_type",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/collective_type/maxLength",
                        keyword: "maxLength",
                        params: { limit: 160 },
                        message: "must NOT have more than 160 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err106];
                      } else {
                        vErrors.push(err106);
                      }
                      errors++;
                    }
                  } else {
                    const err107 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/collective_type",
                      schemaPath:
                        "runtime-trace-input.schema.json/properties/requests/items/properties/collective_type/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err107];
                    } else {
                      vErrors.push(err107);
                    }
                    errors++;
                  }
                }
                if (data32.message_size_bytes !== undefined) {
                  let data45 = data32.message_size_bytes;
                  if (!(typeof data45 == "number" && !(data45 % 1) && !isNaN(data45))) {
                    const err108 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/message_size_bytes",
                      schemaPath:
                        "runtime-trace-input.schema.json/properties/requests/items/properties/message_size_bytes/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err108];
                    } else {
                      vErrors.push(err108);
                    }
                    errors++;
                  }
                  if (typeof data45 == "number") {
                    if (data45 > 9007199254740991 || isNaN(data45)) {
                      const err109 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/message_size_bytes",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/message_size_bytes/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 9007199254740991 },
                        message: "must be <= 9007199254740991",
                      };
                      if (vErrors === null) {
                        vErrors = [err109];
                      } else {
                        vErrors.push(err109);
                      }
                      errors++;
                    }
                    if (data45 < 0 || isNaN(data45)) {
                      const err110 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/message_size_bytes",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/message_size_bytes/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err110];
                      } else {
                        vErrors.push(err110);
                      }
                      errors++;
                    }
                  }
                }
                if (data32.placement_group_id !== undefined) {
                  let data46 = data32.placement_group_id;
                  if (typeof data46 === "string") {
                    if (func1(data46) > 256) {
                      const err111 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/placement_group_id",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/placement_group_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err111];
                      } else {
                        vErrors.push(err111);
                      }
                      errors++;
                    }
                  } else {
                    const err112 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/placement_group_id",
                      schemaPath:
                        "runtime-trace-input.schema.json/properties/requests/items/properties/placement_group_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err112];
                    } else {
                      vErrors.push(err112);
                    }
                    errors++;
                  }
                }
                if (data32.disaggregation_group_id !== undefined) {
                  let data47 = data32.disaggregation_group_id;
                  if (typeof data47 === "string") {
                    if (func1(data47) > 256) {
                      const err113 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/disaggregation_group_id",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/disaggregation_group_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err113];
                      } else {
                        vErrors.push(err113);
                      }
                      errors++;
                    }
                  } else {
                    const err114 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/disaggregation_group_id",
                      schemaPath:
                        "runtime-trace-input.schema.json/properties/requests/items/properties/disaggregation_group_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err114];
                    } else {
                      vErrors.push(err114);
                    }
                    errors++;
                  }
                }
                if (data32.kv_handoff_id !== undefined) {
                  let data48 = data32.kv_handoff_id;
                  if (typeof data48 === "string") {
                    if (func1(data48) > 256) {
                      const err115 = {
                        instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/kv_handoff_id",
                        schemaPath:
                          "runtime-trace-input.schema.json/properties/requests/items/properties/kv_handoff_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 256 },
                        message: "must NOT have more than 256 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err115];
                      } else {
                        vErrors.push(err115);
                      }
                      errors++;
                    }
                  } else {
                    const err116 = {
                      instancePath: instancePath + "/runtime_trace/requests/" + i1 + "/kv_handoff_id",
                      schemaPath:
                        "runtime-trace-input.schema.json/properties/requests/items/properties/kv_handoff_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err116];
                    } else {
                      vErrors.push(err116);
                    }
                    errors++;
                  }
                }
              } else {
                const err117 = {
                  instancePath: instancePath + "/runtime_trace/requests/" + i1,
                  schemaPath: "runtime-trace-input.schema.json/properties/requests/items/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                };
                if (vErrors === null) {
                  vErrors = [err117];
                } else {
                  vErrors.push(err117);
                }
                errors++;
              }
            }
          } else {
            const err118 = {
              instancePath: instancePath + "/runtime_trace/requests",
              schemaPath: "runtime-trace-input.schema.json/properties/requests/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err118];
            } else {
              vErrors.push(err118);
            }
            errors++;
          }
        }
      } else {
        const err119 = {
          instancePath: instancePath + "/runtime_trace",
          schemaPath: "runtime-trace-input.schema.json/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err119];
        } else {
          vErrors.push(err119);
        }
        errors++;
      }
    }
    if (data.topology !== undefined) {
      if (
        !validate22(data.topology, {
          instancePath: instancePath + "/topology",
          parentData: data,
          parentDataProperty: "topology",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err120 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err120];
    } else {
      vErrors.push(err120);
    }
    errors++;
  }
  validate21.errors = vErrors;
  return errors === 0;
}
validate21.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate20(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/create-run-request.schema.json" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs2 = errors;
  const _errs3 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (
      (data.overrides === undefined && (missing0 = "overrides")) ||
      (data.custom_inputs === undefined && (missing0 = "custom_inputs"))
    ) {
      const err0 = {};
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
  }
  var valid1 = _errs3 === errors;
  if (valid1) {
    const err1 = {
      instancePath,
      schemaPath: "#/allOf/0/not",
      keyword: "not",
      params: {},
      message: "must NOT be valid",
    };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
  } else {
    errors = _errs2;
    if (vErrors !== null) {
      if (_errs2) {
        vErrors.length = _errs2;
      } else {
        vErrors = null;
      }
    }
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.scenario_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "scenario_id" },
        message: "must have required property '" + "scenario_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "scenario_id" ||
        key0 === "fidelity_policy" ||
        key0 === "gpu_participation_mode" ||
        key0 === "run_name" ||
        key0 === "overrides" ||
        key0 === "custom_inputs" ||
        key0 === "design_space_candidates"
      )) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.scenario_id !== undefined) {
      if (!(data.scenario_id === "s1_des_example")) {
        const err4 = {
          instancePath: instancePath + "/scenario_id",
          schemaPath: "#/properties/scenario_id/enum",
          keyword: "enum",
          params: { allowedValues: schema31.properties.scenario_id.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.fidelity_policy !== undefined) {
      let data1 = data.fidelity_policy;
      if (!(data1 === "default" || data1 === "des")) {
        const err5 = {
          instancePath: instancePath + "/fidelity_policy",
          schemaPath: "#/properties/fidelity_policy/enum",
          keyword: "enum",
          params: { allowedValues: schema31.properties.fidelity_policy.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.gpu_participation_mode !== undefined) {
      if ("gpu_free" !== data.gpu_participation_mode) {
        const err6 = {
          instancePath: instancePath + "/gpu_participation_mode",
          schemaPath: "#/properties/gpu_participation_mode/const",
          keyword: "const",
          params: { allowedValue: "gpu_free" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.run_name !== undefined) {
      let data3 = data.run_name;
      if (typeof data3 !== "string" && data3 !== null) {
        const err7 = {
          instancePath: instancePath + "/run_name",
          schemaPath: "#/properties/run_name/type",
          keyword: "type",
          params: { type: schema31.properties.run_name.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
      if (typeof data3 === "string") {
        if (func1(data3) > 80) {
          const err8 = {
            instancePath: instancePath + "/run_name",
            schemaPath: "#/properties/run_name/maxLength",
            keyword: "maxLength",
            params: { limit: 80 },
            message: "must NOT have more than 80 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      }
    }
    if (data.overrides !== undefined) {
      let data4 = data.overrides;
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
        for (const key1 in data4) {
          if (!(key1 === "runtime" || key1 === "workload" || key1 === "fabric")) {
            const err9 = {
              instancePath: instancePath + "/overrides",
              schemaPath: "run-overrides.schema.json/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
        if (data4.runtime !== undefined) {
          let data5 = data4.runtime;
          if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
            for (const key2 in data5) {
              if (!(key2 === "batch_scheduler" || key2 === "max_batch_size" || key2 === "kv_capacity_tokens")) {
                const err10 = {
                  instancePath: instancePath + "/overrides/runtime",
                  schemaPath: "run-overrides.schema.json/properties/runtime/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key2 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err10];
                } else {
                  vErrors.push(err10);
                }
                errors++;
              }
            }
            if (data5.batch_scheduler !== undefined) {
              let data6 = data5.batch_scheduler;
              if (!(data6 === "fifo" || data6 === "decode_priority" || data6 === "fabric_backpressure_aware")) {
                const err11 = {
                  instancePath: instancePath + "/overrides/runtime/batch_scheduler",
                  schemaPath: "run-overrides.schema.json/properties/runtime/properties/batch_scheduler/enum",
                  keyword: "enum",
                  params: { allowedValues: schema32.properties.runtime.properties.batch_scheduler.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err11];
                } else {
                  vErrors.push(err11);
                }
                errors++;
              }
            }
            if (data5.max_batch_size !== undefined) {
              let data7 = data5.max_batch_size;
              if (!(typeof data7 == "number" && !(data7 % 1) && !isNaN(data7))) {
                const err12 = {
                  instancePath: instancePath + "/overrides/runtime/max_batch_size",
                  schemaPath: "run-overrides.schema.json/properties/runtime/properties/max_batch_size/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err12];
                } else {
                  vErrors.push(err12);
                }
                errors++;
              }
              if (typeof data7 == "number") {
                if (data7 > 64 || isNaN(data7)) {
                  const err13 = {
                    instancePath: instancePath + "/overrides/runtime/max_batch_size",
                    schemaPath: "run-overrides.schema.json/properties/runtime/properties/max_batch_size/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 64 },
                    message: "must be <= 64",
                  };
                  if (vErrors === null) {
                    vErrors = [err13];
                  } else {
                    vErrors.push(err13);
                  }
                  errors++;
                }
                if (data7 < 1 || isNaN(data7)) {
                  const err14 = {
                    instancePath: instancePath + "/overrides/runtime/max_batch_size",
                    schemaPath: "run-overrides.schema.json/properties/runtime/properties/max_batch_size/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 1 },
                    message: "must be >= 1",
                  };
                  if (vErrors === null) {
                    vErrors = [err14];
                  } else {
                    vErrors.push(err14);
                  }
                  errors++;
                }
              }
            }
            if (data5.kv_capacity_tokens !== undefined) {
              let data8 = data5.kv_capacity_tokens;
              if (!(typeof data8 == "number" && !(data8 % 1) && !isNaN(data8))) {
                const err15 = {
                  instancePath: instancePath + "/overrides/runtime/kv_capacity_tokens",
                  schemaPath: "run-overrides.schema.json/properties/runtime/properties/kv_capacity_tokens/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err15];
                } else {
                  vErrors.push(err15);
                }
                errors++;
              }
              if (typeof data8 == "number") {
                if (data8 > 1000000 || isNaN(data8)) {
                  const err16 = {
                    instancePath: instancePath + "/overrides/runtime/kv_capacity_tokens",
                    schemaPath: "run-overrides.schema.json/properties/runtime/properties/kv_capacity_tokens/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 1000000 },
                    message: "must be <= 1000000",
                  };
                  if (vErrors === null) {
                    vErrors = [err16];
                  } else {
                    vErrors.push(err16);
                  }
                  errors++;
                }
                if (data8 < 256 || isNaN(data8)) {
                  const err17 = {
                    instancePath: instancePath + "/overrides/runtime/kv_capacity_tokens",
                    schemaPath: "run-overrides.schema.json/properties/runtime/properties/kv_capacity_tokens/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 256 },
                    message: "must be >= 256",
                  };
                  if (vErrors === null) {
                    vErrors = [err17];
                  } else {
                    vErrors.push(err17);
                  }
                  errors++;
                }
              }
            }
          } else {
            const err18 = {
              instancePath: instancePath + "/overrides/runtime",
              schemaPath: "run-overrides.schema.json/properties/runtime/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err18];
            } else {
              vErrors.push(err18);
            }
            errors++;
          }
        }
        if (data4.workload !== undefined) {
          let data9 = data4.workload;
          if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
            for (const key3 in data9) {
              if (!(key3 === "message_size_multiplier")) {
                const err19 = {
                  instancePath: instancePath + "/overrides/workload",
                  schemaPath: "run-overrides.schema.json/properties/workload/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key3 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err19];
                } else {
                  vErrors.push(err19);
                }
                errors++;
              }
            }
            if (data9.message_size_multiplier !== undefined) {
              let data10 = data9.message_size_multiplier;
              if (typeof data10 == "number") {
                if (data10 > 8 || isNaN(data10)) {
                  const err20 = {
                    instancePath: instancePath + "/overrides/workload/message_size_multiplier",
                    schemaPath:
                      "run-overrides.schema.json/properties/workload/properties/message_size_multiplier/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 8 },
                    message: "must be <= 8",
                  };
                  if (vErrors === null) {
                    vErrors = [err20];
                  } else {
                    vErrors.push(err20);
                  }
                  errors++;
                }
                if (data10 < 0.25 || isNaN(data10)) {
                  const err21 = {
                    instancePath: instancePath + "/overrides/workload/message_size_multiplier",
                    schemaPath:
                      "run-overrides.schema.json/properties/workload/properties/message_size_multiplier/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0.25 },
                    message: "must be >= 0.25",
                  };
                  if (vErrors === null) {
                    vErrors = [err21];
                  } else {
                    vErrors.push(err21);
                  }
                  errors++;
                }
              } else {
                const err22 = {
                  instancePath: instancePath + "/overrides/workload/message_size_multiplier",
                  schemaPath: "run-overrides.schema.json/properties/workload/properties/message_size_multiplier/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err22];
                } else {
                  vErrors.push(err22);
                }
                errors++;
              }
            }
          } else {
            const err23 = {
              instancePath: instancePath + "/overrides/workload",
              schemaPath: "run-overrides.schema.json/properties/workload/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
        if (data4.fabric !== undefined) {
          let data11 = data4.fabric;
          if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
            for (const key4 in data11) {
              if (!(
                key4 === "scale_up_bandwidth_gbps" ||
                key4 === "scale_up_latency_us" ||
                key4 === "scale_out_bandwidth_gbps" ||
                key4 === "scale_out_latency_us"
              )) {
                const err24 = {
                  instancePath: instancePath + "/overrides/fabric",
                  schemaPath: "run-overrides.schema.json/properties/fabric/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key4 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err24];
                } else {
                  vErrors.push(err24);
                }
                errors++;
              }
            }
            if (data11.scale_up_bandwidth_gbps !== undefined) {
              let data12 = data11.scale_up_bandwidth_gbps;
              if (typeof data12 == "number") {
                if (data12 > 2000 || isNaN(data12)) {
                  const err25 = {
                    instancePath: instancePath + "/overrides/fabric/scale_up_bandwidth_gbps",
                    schemaPath:
                      "run-overrides.schema.json/properties/fabric/properties/scale_up_bandwidth_gbps/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 2000 },
                    message: "must be <= 2000",
                  };
                  if (vErrors === null) {
                    vErrors = [err25];
                  } else {
                    vErrors.push(err25);
                  }
                  errors++;
                }
                if (data12 < 25 || isNaN(data12)) {
                  const err26 = {
                    instancePath: instancePath + "/overrides/fabric/scale_up_bandwidth_gbps",
                    schemaPath:
                      "run-overrides.schema.json/properties/fabric/properties/scale_up_bandwidth_gbps/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 25 },
                    message: "must be >= 25",
                  };
                  if (vErrors === null) {
                    vErrors = [err26];
                  } else {
                    vErrors.push(err26);
                  }
                  errors++;
                }
              } else {
                const err27 = {
                  instancePath: instancePath + "/overrides/fabric/scale_up_bandwidth_gbps",
                  schemaPath: "run-overrides.schema.json/properties/fabric/properties/scale_up_bandwidth_gbps/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err27];
                } else {
                  vErrors.push(err27);
                }
                errors++;
              }
            }
            if (data11.scale_up_latency_us !== undefined) {
              let data13 = data11.scale_up_latency_us;
              if (typeof data13 == "number") {
                if (data13 > 100 || isNaN(data13)) {
                  const err28 = {
                    instancePath: instancePath + "/overrides/fabric/scale_up_latency_us",
                    schemaPath: "run-overrides.schema.json/properties/fabric/properties/scale_up_latency_us/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 100 },
                    message: "must be <= 100",
                  };
                  if (vErrors === null) {
                    vErrors = [err28];
                  } else {
                    vErrors.push(err28);
                  }
                  errors++;
                }
                if (data13 < 0.05 || isNaN(data13)) {
                  const err29 = {
                    instancePath: instancePath + "/overrides/fabric/scale_up_latency_us",
                    schemaPath: "run-overrides.schema.json/properties/fabric/properties/scale_up_latency_us/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0.05 },
                    message: "must be >= 0.05",
                  };
                  if (vErrors === null) {
                    vErrors = [err29];
                  } else {
                    vErrors.push(err29);
                  }
                  errors++;
                }
              } else {
                const err30 = {
                  instancePath: instancePath + "/overrides/fabric/scale_up_latency_us",
                  schemaPath: "run-overrides.schema.json/properties/fabric/properties/scale_up_latency_us/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err30];
                } else {
                  vErrors.push(err30);
                }
                errors++;
              }
            }
            if (data11.scale_out_bandwidth_gbps !== undefined) {
              let data14 = data11.scale_out_bandwidth_gbps;
              if (typeof data14 == "number") {
                if (data14 > 2000 || isNaN(data14)) {
                  const err31 = {
                    instancePath: instancePath + "/overrides/fabric/scale_out_bandwidth_gbps",
                    schemaPath:
                      "run-overrides.schema.json/properties/fabric/properties/scale_out_bandwidth_gbps/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 2000 },
                    message: "must be <= 2000",
                  };
                  if (vErrors === null) {
                    vErrors = [err31];
                  } else {
                    vErrors.push(err31);
                  }
                  errors++;
                }
                if (data14 < 10 || isNaN(data14)) {
                  const err32 = {
                    instancePath: instancePath + "/overrides/fabric/scale_out_bandwidth_gbps",
                    schemaPath:
                      "run-overrides.schema.json/properties/fabric/properties/scale_out_bandwidth_gbps/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 10 },
                    message: "must be >= 10",
                  };
                  if (vErrors === null) {
                    vErrors = [err32];
                  } else {
                    vErrors.push(err32);
                  }
                  errors++;
                }
              } else {
                const err33 = {
                  instancePath: instancePath + "/overrides/fabric/scale_out_bandwidth_gbps",
                  schemaPath: "run-overrides.schema.json/properties/fabric/properties/scale_out_bandwidth_gbps/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err33];
                } else {
                  vErrors.push(err33);
                }
                errors++;
              }
            }
            if (data11.scale_out_latency_us !== undefined) {
              let data15 = data11.scale_out_latency_us;
              if (typeof data15 == "number") {
                if (data15 > 500 || isNaN(data15)) {
                  const err34 = {
                    instancePath: instancePath + "/overrides/fabric/scale_out_latency_us",
                    schemaPath: "run-overrides.schema.json/properties/fabric/properties/scale_out_latency_us/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 500 },
                    message: "must be <= 500",
                  };
                  if (vErrors === null) {
                    vErrors = [err34];
                  } else {
                    vErrors.push(err34);
                  }
                  errors++;
                }
                if (data15 < 0.1 || isNaN(data15)) {
                  const err35 = {
                    instancePath: instancePath + "/overrides/fabric/scale_out_latency_us",
                    schemaPath: "run-overrides.schema.json/properties/fabric/properties/scale_out_latency_us/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0.1 },
                    message: "must be >= 0.1",
                  };
                  if (vErrors === null) {
                    vErrors = [err35];
                  } else {
                    vErrors.push(err35);
                  }
                  errors++;
                }
              } else {
                const err36 = {
                  instancePath: instancePath + "/overrides/fabric/scale_out_latency_us",
                  schemaPath: "run-overrides.schema.json/properties/fabric/properties/scale_out_latency_us/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err36];
                } else {
                  vErrors.push(err36);
                }
                errors++;
              }
            }
          } else {
            const err37 = {
              instancePath: instancePath + "/overrides/fabric",
              schemaPath: "run-overrides.schema.json/properties/fabric/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err37];
            } else {
              vErrors.push(err37);
            }
            errors++;
          }
        }
      } else {
        const err38 = {
          instancePath: instancePath + "/overrides",
          schemaPath: "run-overrides.schema.json/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
    }
    if (data.custom_inputs !== undefined) {
      if (
        !validate21(data.custom_inputs, {
          instancePath: instancePath + "/custom_inputs",
          parentData: data,
          parentDataProperty: "custom_inputs",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
        errors = vErrors.length;
      }
    }
    if (data.design_space_candidates !== undefined) {
      let data17 = data.design_space_candidates;
      if (data17 && typeof data17 == "object" && !Array.isArray(data17)) {
        if (data17.schema_version === undefined) {
          const err39 = {
            instancePath: instancePath + "/design_space_candidates",
            schemaPath: "design-space-candidates.schema.json/required",
            keyword: "required",
            params: { missingProperty: "schema_version" },
            message: "must have required property '" + "schema_version" + "'",
          };
          if (vErrors === null) {
            vErrors = [err39];
          } else {
            vErrors.push(err39);
          }
          errors++;
        }
        if (data17.manifest_id === undefined) {
          const err40 = {
            instancePath: instancePath + "/design_space_candidates",
            schemaPath: "design-space-candidates.schema.json/required",
            keyword: "required",
            params: { missingProperty: "manifest_id" },
            message: "must have required property '" + "manifest_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err40];
          } else {
            vErrors.push(err40);
          }
          errors++;
        }
        if (data17.source_mode === undefined) {
          const err41 = {
            instancePath: instancePath + "/design_space_candidates",
            schemaPath: "design-space-candidates.schema.json/required",
            keyword: "required",
            params: { missingProperty: "source_mode" },
            message: "must have required property '" + "source_mode" + "'",
          };
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
        if (data17.calibration_level === undefined) {
          const err42 = {
            instancePath: instancePath + "/design_space_candidates",
            schemaPath: "design-space-candidates.schema.json/required",
            keyword: "required",
            params: { missingProperty: "calibration_level" },
            message: "must have required property '" + "calibration_level" + "'",
          };
          if (vErrors === null) {
            vErrors = [err42];
          } else {
            vErrors.push(err42);
          }
          errors++;
        }
        if (data17.allowed_claim_scope === undefined) {
          const err43 = {
            instancePath: instancePath + "/design_space_candidates",
            schemaPath: "design-space-candidates.schema.json/required",
            keyword: "required",
            params: { missingProperty: "allowed_claim_scope" },
            message: "must have required property '" + "allowed_claim_scope" + "'",
          };
          if (vErrors === null) {
            vErrors = [err43];
          } else {
            vErrors.push(err43);
          }
          errors++;
        }
        if (data17.candidates === undefined) {
          const err44 = {
            instancePath: instancePath + "/design_space_candidates",
            schemaPath: "design-space-candidates.schema.json/required",
            keyword: "required",
            params: { missingProperty: "candidates" },
            message: "must have required property '" + "candidates" + "'",
          };
          if (vErrors === null) {
            vErrors = [err44];
          } else {
            vErrors.push(err44);
          }
          errors++;
        }
        for (const key5 in data17) {
          if (!(
            key5 === "schema_version" ||
            key5 === "manifest_id" ||
            key5 === "source_mode" ||
            key5 === "calibration_level" ||
            key5 === "allowed_claim_scope" ||
            key5 === "candidates"
          )) {
            const err45 = {
              instancePath: instancePath + "/design_space_candidates",
              schemaPath: "design-space-candidates.schema.json/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key5 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err45];
            } else {
              vErrors.push(err45);
            }
            errors++;
          }
        }
        if (data17.schema_version !== undefined) {
          if ("tilesim.design_space.s6_candidates.v1" !== data17.schema_version) {
            const err46 = {
              instancePath: instancePath + "/design_space_candidates/schema_version",
              schemaPath: "design-space-candidates.schema.json/properties/schema_version/const",
              keyword: "const",
              params: { allowedValue: "tilesim.design_space.s6_candidates.v1" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err46];
            } else {
              vErrors.push(err46);
            }
            errors++;
          }
        }
        if (data17.manifest_id !== undefined) {
          let data19 = data17.manifest_id;
          if (typeof data19 === "string") {
            if (func1(data19) > 160) {
              const err47 = {
                instancePath: instancePath + "/design_space_candidates/manifest_id",
                schemaPath: "design-space-candidates.schema.json/properties/manifest_id/maxLength",
                keyword: "maxLength",
                params: { limit: 160 },
                message: "must NOT have more than 160 characters",
              };
              if (vErrors === null) {
                vErrors = [err47];
              } else {
                vErrors.push(err47);
              }
              errors++;
            }
            if (func1(data19) < 1) {
              const err48 = {
                instancePath: instancePath + "/design_space_candidates/manifest_id",
                schemaPath: "design-space-candidates.schema.json/properties/manifest_id/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err48];
              } else {
                vErrors.push(err48);
              }
              errors++;
            }
          } else {
            const err49 = {
              instancePath: instancePath + "/design_space_candidates/manifest_id",
              schemaPath: "design-space-candidates.schema.json/properties/manifest_id/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err49];
            } else {
              vErrors.push(err49);
            }
            errors++;
          }
        }
        if (data17.source_mode !== undefined) {
          if ("synthetic_trace" !== data17.source_mode) {
            const err50 = {
              instancePath: instancePath + "/design_space_candidates/source_mode",
              schemaPath: "design-space-candidates.schema.json/properties/source_mode/const",
              keyword: "const",
              params: { allowedValue: "synthetic_trace" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err50];
            } else {
              vErrors.push(err50);
            }
            errors++;
          }
        }
        if (data17.calibration_level !== undefined) {
          let data21 = data17.calibration_level;
          if (!(data21 === "uncalibrated" || data21 === "partially_calibrated")) {
            const err51 = {
              instancePath: instancePath + "/design_space_candidates/calibration_level",
              schemaPath: "design-space-candidates.schema.json/properties/calibration_level/enum",
              keyword: "enum",
              params: { allowedValues: schema39.properties.calibration_level.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err51];
            } else {
              vErrors.push(err51);
            }
            errors++;
          }
        }
        if (data17.allowed_claim_scope !== undefined) {
          let data22 = data17.allowed_claim_scope;
          if (!(
            data22 === "exploratory" ||
            data22 === "exploratory_s6_only" ||
            data22 === "synthetic_consistency" ||
            data22 === "synthetic_consistency_only" ||
            data22 === "workflow_consistency_only"
          )) {
            const err52 = {
              instancePath: instancePath + "/design_space_candidates/allowed_claim_scope",
              schemaPath: "design-space-candidates.schema.json/properties/allowed_claim_scope/enum",
              keyword: "enum",
              params: { allowedValues: schema39.properties.allowed_claim_scope.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err52];
            } else {
              vErrors.push(err52);
            }
            errors++;
          }
        }
        if (data17.candidates !== undefined) {
          let data23 = data17.candidates;
          if (Array.isArray(data23)) {
            if (data23.length > 256) {
              const err53 = {
                instancePath: instancePath + "/design_space_candidates/candidates",
                schemaPath: "design-space-candidates.schema.json/properties/candidates/maxItems",
                keyword: "maxItems",
                params: { limit: 256 },
                message: "must NOT have more than 256 items",
              };
              if (vErrors === null) {
                vErrors = [err53];
              } else {
                vErrors.push(err53);
              }
              errors++;
            }
            if (data23.length < 1) {
              const err54 = {
                instancePath: instancePath + "/design_space_candidates/candidates",
                schemaPath: "design-space-candidates.schema.json/properties/candidates/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              if (vErrors === null) {
                vErrors = [err54];
              } else {
                vErrors.push(err54);
              }
              errors++;
            }
            const len0 = data23.length;
            for (let i0 = 0; i0 < len0; i0++) {
              let data24 = data23[i0];
              if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
                if (data24.candidate_id === undefined) {
                  const err55 = {
                    instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                    schemaPath: "design-space-candidates.schema.json/properties/candidates/items/required",
                    keyword: "required",
                    params: { missingProperty: "candidate_id" },
                    message: "must have required property '" + "candidate_id" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err55];
                  } else {
                    vErrors.push(err55);
                  }
                  errors++;
                }
                if (data24.name === undefined) {
                  const err56 = {
                    instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                    schemaPath: "design-space-candidates.schema.json/properties/candidates/items/required",
                    keyword: "required",
                    params: { missingProperty: "name" },
                    message: "must have required property '" + "name" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err56];
                  } else {
                    vErrors.push(err56);
                  }
                  errors++;
                }
                if (data24.bandwidth_gbps === undefined) {
                  const err57 = {
                    instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                    schemaPath: "design-space-candidates.schema.json/properties/candidates/items/required",
                    keyword: "required",
                    params: { missingProperty: "bandwidth_gbps" },
                    message: "must have required property '" + "bandwidth_gbps" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err57];
                  } else {
                    vErrors.push(err57);
                  }
                  errors++;
                }
                if (data24.latency_us === undefined) {
                  const err58 = {
                    instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                    schemaPath: "design-space-candidates.schema.json/properties/candidates/items/required",
                    keyword: "required",
                    params: { missingProperty: "latency_us" },
                    message: "must have required property '" + "latency_us" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err58];
                  } else {
                    vErrors.push(err58);
                  }
                  errors++;
                }
                if (data24.oversubscription_factor === undefined) {
                  const err59 = {
                    instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                    schemaPath: "design-space-candidates.schema.json/properties/candidates/items/required",
                    keyword: "required",
                    params: { missingProperty: "oversubscription_factor" },
                    message: "must have required property '" + "oversubscription_factor" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err59];
                  } else {
                    vErrors.push(err59);
                  }
                  errors++;
                }
                if (data24.request_count === undefined) {
                  const err60 = {
                    instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                    schemaPath: "design-space-candidates.schema.json/properties/candidates/items/required",
                    keyword: "required",
                    params: { missingProperty: "request_count" },
                    message: "must have required property '" + "request_count" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err60];
                  } else {
                    vErrors.push(err60);
                  }
                  errors++;
                }
                if (data24.message_bytes === undefined) {
                  const err61 = {
                    instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                    schemaPath: "design-space-candidates.schema.json/properties/candidates/items/required",
                    keyword: "required",
                    params: { missingProperty: "message_bytes" },
                    message: "must have required property '" + "message_bytes" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err61];
                  } else {
                    vErrors.push(err61);
                  }
                  errors++;
                }
                if (data24.release_interval_ps === undefined) {
                  const err62 = {
                    instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                    schemaPath: "design-space-candidates.schema.json/properties/candidates/items/required",
                    keyword: "required",
                    params: { missingProperty: "release_interval_ps" },
                    message: "must have required property '" + "release_interval_ps" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err62];
                  } else {
                    vErrors.push(err62);
                  }
                  errors++;
                }
                if (data24.uncertainty_score === undefined) {
                  const err63 = {
                    instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                    schemaPath: "design-space-candidates.schema.json/properties/candidates/items/required",
                    keyword: "required",
                    params: { missingProperty: "uncertainty_score" },
                    message: "must have required property '" + "uncertainty_score" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err63];
                  } else {
                    vErrors.push(err63);
                  }
                  errors++;
                }
                if (data24.tail_risk === undefined) {
                  const err64 = {
                    instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                    schemaPath: "design-space-candidates.schema.json/properties/candidates/items/required",
                    keyword: "required",
                    params: { missingProperty: "tail_risk" },
                    message: "must have required property '" + "tail_risk" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err64];
                  } else {
                    vErrors.push(err64);
                  }
                  errors++;
                }
                if (data24.source_id === undefined) {
                  const err65 = {
                    instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                    schemaPath: "design-space-candidates.schema.json/properties/candidates/items/required",
                    keyword: "required",
                    params: { missingProperty: "source_id" },
                    message: "must have required property '" + "source_id" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err65];
                  } else {
                    vErrors.push(err65);
                  }
                  errors++;
                }
                for (const key6 in data24) {
                  if (!func4.call(schema39.properties.candidates.items.properties, key6)) {
                    const err66 = {
                      instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/additionalProperties",
                      keyword: "additionalProperties",
                      params: { additionalProperty: key6 },
                      message: "must NOT have additional properties",
                    };
                    if (vErrors === null) {
                      vErrors = [err66];
                    } else {
                      vErrors.push(err66);
                    }
                    errors++;
                  }
                }
                if (data24.candidate_id !== undefined) {
                  let data25 = data24.candidate_id;
                  if (typeof data25 === "string") {
                    if (func1(data25) > 512) {
                      const err67 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/candidate_id",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/candidate_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 512 },
                        message: "must NOT have more than 512 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err67];
                      } else {
                        vErrors.push(err67);
                      }
                      errors++;
                    }
                    if (func1(data25) < 1) {
                      const err68 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/candidate_id",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/candidate_id/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err68];
                      } else {
                        vErrors.push(err68);
                      }
                      errors++;
                    }
                  } else {
                    const err69 = {
                      instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/candidate_id",
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/properties/candidate_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err69];
                    } else {
                      vErrors.push(err69);
                    }
                    errors++;
                  }
                }
                if (data24.name !== undefined) {
                  let data26 = data24.name;
                  if (typeof data26 === "string") {
                    if (func1(data26) > 512) {
                      const err70 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/name",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/name/maxLength",
                        keyword: "maxLength",
                        params: { limit: 512 },
                        message: "must NOT have more than 512 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err70];
                      } else {
                        vErrors.push(err70);
                      }
                      errors++;
                    }
                    if (func1(data26) < 1) {
                      const err71 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/name",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/name/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err71];
                      } else {
                        vErrors.push(err71);
                      }
                      errors++;
                    }
                  } else {
                    const err72 = {
                      instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/name",
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/properties/name/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err72];
                    } else {
                      vErrors.push(err72);
                    }
                    errors++;
                  }
                }
                if (data24.bandwidth_gbps !== undefined) {
                  let data27 = data24.bandwidth_gbps;
                  if (typeof data27 == "number") {
                    if (data27 > 100000 || isNaN(data27)) {
                      const err73 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/bandwidth_gbps",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/bandwidth_gbps/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 100000 },
                        message: "must be <= 100000",
                      };
                      if (vErrors === null) {
                        vErrors = [err73];
                      } else {
                        vErrors.push(err73);
                      }
                      errors++;
                    }
                    if (data27 < 0.000001 || isNaN(data27)) {
                      const err74 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/bandwidth_gbps",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/bandwidth_gbps/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0.000001 },
                        message: "must be >= 0.000001",
                      };
                      if (vErrors === null) {
                        vErrors = [err74];
                      } else {
                        vErrors.push(err74);
                      }
                      errors++;
                    }
                  } else {
                    const err75 = {
                      instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/bandwidth_gbps",
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/properties/bandwidth_gbps/type",
                      keyword: "type",
                      params: { type: "number" },
                      message: "must be number",
                    };
                    if (vErrors === null) {
                      vErrors = [err75];
                    } else {
                      vErrors.push(err75);
                    }
                    errors++;
                  }
                }
                if (data24.latency_us !== undefined) {
                  let data28 = data24.latency_us;
                  if (typeof data28 == "number") {
                    if (data28 > 1000000 || isNaN(data28)) {
                      const err76 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/latency_us",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/latency_us/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 1000000 },
                        message: "must be <= 1000000",
                      };
                      if (vErrors === null) {
                        vErrors = [err76];
                      } else {
                        vErrors.push(err76);
                      }
                      errors++;
                    }
                    if (data28 < 0 || isNaN(data28)) {
                      const err77 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/latency_us",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/latency_us/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err77];
                      } else {
                        vErrors.push(err77);
                      }
                      errors++;
                    }
                  } else {
                    const err78 = {
                      instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/latency_us",
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/properties/latency_us/type",
                      keyword: "type",
                      params: { type: "number" },
                      message: "must be number",
                    };
                    if (vErrors === null) {
                      vErrors = [err78];
                    } else {
                      vErrors.push(err78);
                    }
                    errors++;
                  }
                }
                if (data24.oversubscription_factor !== undefined) {
                  let data29 = data24.oversubscription_factor;
                  if (typeof data29 == "number") {
                    if (data29 > 1000000 || isNaN(data29)) {
                      const err79 = {
                        instancePath:
                          instancePath + "/design_space_candidates/candidates/" + i0 + "/oversubscription_factor",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/oversubscription_factor/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 1000000 },
                        message: "must be <= 1000000",
                      };
                      if (vErrors === null) {
                        vErrors = [err79];
                      } else {
                        vErrors.push(err79);
                      }
                      errors++;
                    }
                    if (data29 < 0.000001 || isNaN(data29)) {
                      const err80 = {
                        instancePath:
                          instancePath + "/design_space_candidates/candidates/" + i0 + "/oversubscription_factor",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/oversubscription_factor/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0.000001 },
                        message: "must be >= 0.000001",
                      };
                      if (vErrors === null) {
                        vErrors = [err80];
                      } else {
                        vErrors.push(err80);
                      }
                      errors++;
                    }
                  } else {
                    const err81 = {
                      instancePath:
                        instancePath + "/design_space_candidates/candidates/" + i0 + "/oversubscription_factor",
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/properties/oversubscription_factor/type",
                      keyword: "type",
                      params: { type: "number" },
                      message: "must be number",
                    };
                    if (vErrors === null) {
                      vErrors = [err81];
                    } else {
                      vErrors.push(err81);
                    }
                    errors++;
                  }
                }
                if (data24.request_count !== undefined) {
                  let data30 = data24.request_count;
                  if (!(typeof data30 == "number" && !(data30 % 1) && !isNaN(data30))) {
                    const err82 = {
                      instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/request_count",
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/properties/request_count/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err82];
                    } else {
                      vErrors.push(err82);
                    }
                    errors++;
                  }
                  if (typeof data30 == "number") {
                    if (data30 > 100000 || isNaN(data30)) {
                      const err83 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/request_count",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/request_count/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 100000 },
                        message: "must be <= 100000",
                      };
                      if (vErrors === null) {
                        vErrors = [err83];
                      } else {
                        vErrors.push(err83);
                      }
                      errors++;
                    }
                    if (data30 < 1 || isNaN(data30)) {
                      const err84 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/request_count",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/request_count/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 1 },
                        message: "must be >= 1",
                      };
                      if (vErrors === null) {
                        vErrors = [err84];
                      } else {
                        vErrors.push(err84);
                      }
                      errors++;
                    }
                  }
                }
                if (data24.message_bytes !== undefined) {
                  let data31 = data24.message_bytes;
                  if (!(typeof data31 == "number" && !(data31 % 1) && !isNaN(data31))) {
                    const err85 = {
                      instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/message_bytes",
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/properties/message_bytes/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err85];
                    } else {
                      vErrors.push(err85);
                    }
                    errors++;
                  }
                  if (typeof data31 == "number") {
                    if (data31 > 9007199254740991 || isNaN(data31)) {
                      const err86 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/message_bytes",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/message_bytes/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 9007199254740991 },
                        message: "must be <= 9007199254740991",
                      };
                      if (vErrors === null) {
                        vErrors = [err86];
                      } else {
                        vErrors.push(err86);
                      }
                      errors++;
                    }
                    if (data31 < 1 || isNaN(data31)) {
                      const err87 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/message_bytes",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/message_bytes/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 1 },
                        message: "must be >= 1",
                      };
                      if (vErrors === null) {
                        vErrors = [err87];
                      } else {
                        vErrors.push(err87);
                      }
                      errors++;
                    }
                  }
                }
                if (data24.release_interval_ps !== undefined) {
                  let data32 = data24.release_interval_ps;
                  if (!(typeof data32 == "number" && !(data32 % 1) && !isNaN(data32))) {
                    const err88 = {
                      instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/release_interval_ps",
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/properties/release_interval_ps/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err88];
                    } else {
                      vErrors.push(err88);
                    }
                    errors++;
                  }
                  if (typeof data32 == "number") {
                    if (data32 > 9007199254740991 || isNaN(data32)) {
                      const err89 = {
                        instancePath:
                          instancePath + "/design_space_candidates/candidates/" + i0 + "/release_interval_ps",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/release_interval_ps/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 9007199254740991 },
                        message: "must be <= 9007199254740991",
                      };
                      if (vErrors === null) {
                        vErrors = [err89];
                      } else {
                        vErrors.push(err89);
                      }
                      errors++;
                    }
                    if (data32 < 0 || isNaN(data32)) {
                      const err90 = {
                        instancePath:
                          instancePath + "/design_space_candidates/candidates/" + i0 + "/release_interval_ps",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/release_interval_ps/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err90];
                      } else {
                        vErrors.push(err90);
                      }
                      errors++;
                    }
                  }
                }
                if (data24.uncertainty_score !== undefined) {
                  let data33 = data24.uncertainty_score;
                  if (typeof data33 == "number") {
                    if (data33 > 1 || isNaN(data33)) {
                      const err91 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/uncertainty_score",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/uncertainty_score/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 1 },
                        message: "must be <= 1",
                      };
                      if (vErrors === null) {
                        vErrors = [err91];
                      } else {
                        vErrors.push(err91);
                      }
                      errors++;
                    }
                    if (data33 < 0 || isNaN(data33)) {
                      const err92 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/uncertainty_score",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/uncertainty_score/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 0 },
                        message: "must be >= 0",
                      };
                      if (vErrors === null) {
                        vErrors = [err92];
                      } else {
                        vErrors.push(err92);
                      }
                      errors++;
                    }
                  } else {
                    const err93 = {
                      instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/uncertainty_score",
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/properties/uncertainty_score/type",
                      keyword: "type",
                      params: { type: "number" },
                      message: "must be number",
                    };
                    if (vErrors === null) {
                      vErrors = [err93];
                    } else {
                      vErrors.push(err93);
                    }
                    errors++;
                  }
                }
                if (data24.tail_risk !== undefined) {
                  if (typeof data24.tail_risk !== "boolean") {
                    const err94 = {
                      instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/tail_risk",
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/properties/tail_risk/type",
                      keyword: "type",
                      params: { type: "boolean" },
                      message: "must be boolean",
                    };
                    if (vErrors === null) {
                      vErrors = [err94];
                    } else {
                      vErrors.push(err94);
                    }
                    errors++;
                  }
                }
                if (data24.promotion_hint !== undefined) {
                  let data35 = data24.promotion_hint;
                  if (typeof data35 === "string") {
                    if (func1(data35) > 160) {
                      const err95 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/promotion_hint",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/promotion_hint/maxLength",
                        keyword: "maxLength",
                        params: { limit: 160 },
                        message: "must NOT have more than 160 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err95];
                      } else {
                        vErrors.push(err95);
                      }
                      errors++;
                    }
                  } else {
                    const err96 = {
                      instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/promotion_hint",
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/properties/promotion_hint/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err96];
                    } else {
                      vErrors.push(err96);
                    }
                    errors++;
                  }
                }
                if (data24.source_id !== undefined) {
                  let data36 = data24.source_id;
                  if (typeof data36 === "string") {
                    if (func1(data36) > 512) {
                      const err97 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/source_id",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/source_id/maxLength",
                        keyword: "maxLength",
                        params: { limit: 512 },
                        message: "must NOT have more than 512 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err97];
                      } else {
                        vErrors.push(err97);
                      }
                      errors++;
                    }
                    if (func1(data36) < 1) {
                      const err98 = {
                        instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/source_id",
                        schemaPath:
                          "design-space-candidates.schema.json/properties/candidates/items/properties/source_id/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err98];
                      } else {
                        vErrors.push(err98);
                      }
                      errors++;
                    }
                  } else {
                    const err99 = {
                      instancePath: instancePath + "/design_space_candidates/candidates/" + i0 + "/source_id",
                      schemaPath:
                        "design-space-candidates.schema.json/properties/candidates/items/properties/source_id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err99];
                    } else {
                      vErrors.push(err99);
                    }
                    errors++;
                  }
                }
              } else {
                const err100 = {
                  instancePath: instancePath + "/design_space_candidates/candidates/" + i0,
                  schemaPath: "design-space-candidates.schema.json/properties/candidates/items/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                };
                if (vErrors === null) {
                  vErrors = [err100];
                } else {
                  vErrors.push(err100);
                }
                errors++;
              }
            }
          } else {
            const err101 = {
              instancePath: instancePath + "/design_space_candidates/candidates",
              schemaPath: "design-space-candidates.schema.json/properties/candidates/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err101];
            } else {
              vErrors.push(err101);
            }
            errors++;
          }
        }
      } else {
        const err102 = {
          instancePath: instancePath + "/design_space_candidates",
          schemaPath: "design-space-candidates.schema.json/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err102];
        } else {
          vErrors.push(err102);
        }
        errors++;
      }
    }
  } else {
    const err103 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err103];
    } else {
      vErrors.push(err103);
    }
    errors++;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const experimentDescriptor = validate25;
const schema40 = {
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
    schema_version: { const: "tilesim.bridge.experiment_descriptor.v1" },
    schema_set_revision: { $ref: "#/$defs/revision" },
    descriptor_id: { type: "string", minLength: 1 },
    descriptor_revision: { $ref: "#/$defs/revision" },
    create_run_schema_identity: { const: "tilesim.bridge.create_run_request.v1" },
    scenarios: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["scenario_id", "label", "available", "unavailable_reason"],
        properties: {
          scenario_id: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1 },
          available: { type: "boolean" },
          unavailable_reason: { type: ["string", "null"] },
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
          fidelity_policy: { enum: ["default", "des", "cycle"] },
          requested_tier: { enum: ["policy_default", "DES", "Cycle"] },
          available: { type: "boolean" },
          unavailable_reason: { type: ["string", "null"] },
          capability_predicate: { oneOf: [{ $ref: "#/$defs/capabilityPredicate" }, { type: "null" }] },
        },
      },
    },
    gpu_participation_modes: { $ref: "#/$defs/gpuOptions" },
    input_modes: { $ref: "#/$defs/inputOptions" },
    design_space_modes: { $ref: "#/$defs/designSpaceOptions" },
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
          source_mode: { enum: ["real_trace", "synthetic_trace", "compatibility_harness_trace"] },
          available: { type: "boolean" },
          unavailable_reason: { type: ["string", "null"] },
          allowed_claim_scope: { type: "string", minLength: 1 },
          calibration_requirement: { type: "string", minLength: 1 },
          applicable_input_modes: { type: "array", items: { enum: ["controls", "json"] }, uniqueItems: true },
          capability_predicate: { oneOf: [{ $ref: "#/$defs/capabilityPredicate" }, { type: "null" }] },
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
          group_id: { type: "string", minLength: 1 },
          subsystem: { $ref: "#/$defs/subsystem" },
          display_order: { type: "integer", minimum: 0 },
          status: { enum: ["exposed", "not_exposed", "unsupported"] },
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
          subsystem: { $ref: "#/$defs/subsystem" },
          status: { enum: ["exposed", "not_exposed", "unsupported"] },
          parameter_field_ids: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
          reason: { type: ["string", "null"] },
        },
      },
    },
    parameter_descriptors: { type: "array", minItems: 8, maxItems: 8, items: { $ref: "#/$defs/parameterDescriptor" } },
    resolved_fidelity_source: { const: "run_execution_envelope_and_validation_reports" },
  },
  $defs: {
    revision: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    subsystem: { enum: ["S0", "S1", "S2", "S3", "S4", "S5", "S6"] },
    capabilityPredicate: {
      type: "object",
      additionalProperties: false,
      required: ["capability_path", "operator", "expected_value", "evaluated_available"],
      properties: {
        capability_path: { type: "string", pattern: "^/" },
        operator: { enum: ["equals", "contains"] },
        expected_value: { type: ["string", "boolean"] },
        evaluated_available: { type: "boolean" },
      },
    },
    gpuOptions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["gpu_participation_mode", "available", "unavailable_reason"],
        properties: {
          gpu_participation_mode: { const: "gpu_free" },
          available: { type: "boolean" },
          unavailable_reason: { type: ["string", "null"] },
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
          input_mode: { enum: ["controls", "json"] },
          available: { type: "boolean" },
          unavailable_reason: { type: ["string", "null"] },
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
          design_space_mode: { enum: ["built_in_synthetic", "strict_s6_manifest"] },
          available: { type: "boolean" },
          unavailable_reason: { type: ["string", "null"] },
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
        field_id: { type: "string", pattern: "^s[0-6]\\." },
        subsystem: { $ref: "#/$defs/subsystem" },
        group_id: { type: "string", minLength: 1 },
        display_order: { type: "integer", minimum: 0 },
        request_json_pointer: { type: "string", pattern: "^/overrides/" },
        value_type: { enum: ["integer", "number", "boolean", "string", "enum"] },
        enum_values: { type: "array", items: { type: "string" }, uniqueItems: true },
        minimum: { type: ["integer", "number", "null"] },
        maximum: { type: ["integer", "number", "null"] },
        minimum_inclusive: { type: "boolean" },
        maximum_inclusive: { type: "boolean" },
        integer_only: { type: "boolean" },
        step: { type: ["integer", "number", "null"] },
        unit: { type: "string", minLength: 1 },
        required: { type: "boolean" },
        explicit_default_available: { type: "boolean" },
        default_value: { type: ["integer", "number", "boolean", "string", "null"] },
        capability_predicate: { $ref: "#/$defs/capabilityPredicate" },
        available: { type: "boolean" },
        unavailable_reason: { type: ["string", "null"] },
        applicable_input_modes: { type: "array", items: { enum: ["controls", "json"] }, uniqueItems: true },
        applicable_scenarios: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
      },
    },
  },
};
const schema41 = { type: "string", pattern: "^sha256:[0-9a-f]{64}$" };
const schema43 = {
  type: "object",
  additionalProperties: false,
  required: ["capability_path", "operator", "expected_value", "evaluated_available"],
  properties: {
    capability_path: { type: "string", pattern: "^/" },
    operator: { enum: ["equals", "contains"] },
    expected_value: { type: ["string", "boolean"] },
    evaluated_available: { type: "boolean" },
  },
};
const schema44 = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["gpu_participation_mode", "available", "unavailable_reason"],
    properties: {
      gpu_participation_mode: { const: "gpu_free" },
      available: { type: "boolean" },
      unavailable_reason: { type: ["string", "null"] },
    },
  },
};
const schema45 = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["input_mode", "available", "unavailable_reason"],
    properties: {
      input_mode: { enum: ["controls", "json"] },
      available: { type: "boolean" },
      unavailable_reason: { type: ["string", "null"] },
    },
  },
};
const schema46 = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["design_space_mode", "available", "unavailable_reason"],
    properties: {
      design_space_mode: { enum: ["built_in_synthetic", "strict_s6_manifest"] },
      available: { type: "boolean" },
      unavailable_reason: { type: ["string", "null"] },
    },
  },
};
const schema48 = { enum: ["S0", "S1", "S2", "S3", "S4", "S5", "S6"] };
import func0 from "ajv/dist/runtime/equal";
const pattern4 = new RegExp("^sha256:[0-9a-f]{64}$", "u");
const pattern6 = new RegExp("^/", "u");
const schema50 = {
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
    field_id: { type: "string", pattern: "^s[0-6]\\." },
    subsystem: { $ref: "#/$defs/subsystem" },
    group_id: { type: "string", minLength: 1 },
    display_order: { type: "integer", minimum: 0 },
    request_json_pointer: { type: "string", pattern: "^/overrides/" },
    value_type: { enum: ["integer", "number", "boolean", "string", "enum"] },
    enum_values: { type: "array", items: { type: "string" }, uniqueItems: true },
    minimum: { type: ["integer", "number", "null"] },
    maximum: { type: ["integer", "number", "null"] },
    minimum_inclusive: { type: "boolean" },
    maximum_inclusive: { type: "boolean" },
    integer_only: { type: "boolean" },
    step: { type: ["integer", "number", "null"] },
    unit: { type: "string", minLength: 1 },
    required: { type: "boolean" },
    explicit_default_available: { type: "boolean" },
    default_value: { type: ["integer", "number", "boolean", "string", "null"] },
    capability_predicate: { $ref: "#/$defs/capabilityPredicate" },
    available: { type: "boolean" },
    unavailable_reason: { type: ["string", "null"] },
    applicable_input_modes: { type: "array", items: { enum: ["controls", "json"] }, uniqueItems: true },
    applicable_scenarios: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
  },
};
const pattern8 = new RegExp("^s[0-6]\\.", "u");
const pattern9 = new RegExp("^/overrides/", "u");
function validate26(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate26.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.field_id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "field_id" },
        message: "must have required property '" + "field_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.subsystem === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "subsystem" },
        message: "must have required property '" + "subsystem" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.group_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "group_id" },
        message: "must have required property '" + "group_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.display_order === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "display_order" },
        message: "must have required property '" + "display_order" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.request_json_pointer === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "request_json_pointer" },
        message: "must have required property '" + "request_json_pointer" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.value_type === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "value_type" },
        message: "must have required property '" + "value_type" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.enum_values === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "enum_values" },
        message: "must have required property '" + "enum_values" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.minimum === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "minimum" },
        message: "must have required property '" + "minimum" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.maximum === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "maximum" },
        message: "must have required property '" + "maximum" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.minimum_inclusive === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "minimum_inclusive" },
        message: "must have required property '" + "minimum_inclusive" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.maximum_inclusive === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "maximum_inclusive" },
        message: "must have required property '" + "maximum_inclusive" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.integer_only === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "integer_only" },
        message: "must have required property '" + "integer_only" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.step === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "step" },
        message: "must have required property '" + "step" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.unit === undefined) {
      const err13 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "unit" },
        message: "must have required property '" + "unit" + "'",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.required === undefined) {
      const err14 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "required" },
        message: "must have required property '" + "required" + "'",
      };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    if (data.explicit_default_available === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "explicit_default_available" },
        message: "must have required property '" + "explicit_default_available" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.capability_predicate === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "capability_predicate" },
        message: "must have required property '" + "capability_predicate" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    if (data.available === undefined) {
      const err17 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "available" },
        message: "must have required property '" + "available" + "'",
      };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    if (data.unavailable_reason === undefined) {
      const err18 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "unavailable_reason" },
        message: "must have required property '" + "unavailable_reason" + "'",
      };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    if (data.applicable_input_modes === undefined) {
      const err19 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "applicable_input_modes" },
        message: "must have required property '" + "applicable_input_modes" + "'",
      };
      if (vErrors === null) {
        vErrors = [err19];
      } else {
        vErrors.push(err19);
      }
      errors++;
    }
    if (data.applicable_scenarios === undefined) {
      const err20 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "applicable_scenarios" },
        message: "must have required property '" + "applicable_scenarios" + "'",
      };
      if (vErrors === null) {
        vErrors = [err20];
      } else {
        vErrors.push(err20);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func4.call(schema50.properties, key0)) {
        const err21 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.field_id !== undefined) {
      let data0 = data.field_id;
      if (typeof data0 === "string") {
        if (!pattern8.test(data0)) {
          const err22 = {
            instancePath: instancePath + "/field_id",
            schemaPath: "#/properties/field_id/pattern",
            keyword: "pattern",
            params: { pattern: "^s[0-6]\\." },
            message: 'must match pattern "' + "^s[0-6]\\." + '"',
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      } else {
        const err23 = {
          instancePath: instancePath + "/field_id",
          schemaPath: "#/properties/field_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.subsystem !== undefined) {
      let data1 = data.subsystem;
      if (!(
        data1 === "S0" ||
        data1 === "S1" ||
        data1 === "S2" ||
        data1 === "S3" ||
        data1 === "S4" ||
        data1 === "S5" ||
        data1 === "S6"
      )) {
        const err24 = {
          instancePath: instancePath + "/subsystem",
          schemaPath: "#/$defs/subsystem/enum",
          keyword: "enum",
          params: { allowedValues: schema48.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.group_id !== undefined) {
      let data2 = data.group_id;
      if (typeof data2 === "string") {
        if (func1(data2) < 1) {
          const err25 = {
            instancePath: instancePath + "/group_id",
            schemaPath: "#/properties/group_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
      } else {
        const err26 = {
          instancePath: instancePath + "/group_id",
          schemaPath: "#/properties/group_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.display_order !== undefined) {
      let data3 = data.display_order;
      if (!(typeof data3 == "number" && !(data3 % 1) && !isNaN(data3))) {
        const err27 = {
          instancePath: instancePath + "/display_order",
          schemaPath: "#/properties/display_order/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
      if (typeof data3 == "number") {
        if (data3 < 0 || isNaN(data3)) {
          const err28 = {
            instancePath: instancePath + "/display_order",
            schemaPath: "#/properties/display_order/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
      }
    }
    if (data.request_json_pointer !== undefined) {
      let data4 = data.request_json_pointer;
      if (typeof data4 === "string") {
        if (!pattern9.test(data4)) {
          const err29 = {
            instancePath: instancePath + "/request_json_pointer",
            schemaPath: "#/properties/request_json_pointer/pattern",
            keyword: "pattern",
            params: { pattern: "^/overrides/" },
            message: 'must match pattern "' + "^/overrides/" + '"',
          };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
      } else {
        const err30 = {
          instancePath: instancePath + "/request_json_pointer",
          schemaPath: "#/properties/request_json_pointer/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
    }
    if (data.value_type !== undefined) {
      let data5 = data.value_type;
      if (!(
        data5 === "integer" ||
        data5 === "number" ||
        data5 === "boolean" ||
        data5 === "string" ||
        data5 === "enum"
      )) {
        const err31 = {
          instancePath: instancePath + "/value_type",
          schemaPath: "#/properties/value_type/enum",
          keyword: "enum",
          params: { allowedValues: schema50.properties.value_type.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err31];
        } else {
          vErrors.push(err31);
        }
        errors++;
      }
    }
    if (data.enum_values !== undefined) {
      let data6 = data.enum_values;
      if (Array.isArray(data6)) {
        const len0 = data6.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (typeof data6[i0] !== "string") {
            const err32 = {
              instancePath: instancePath + "/enum_values/" + i0,
              schemaPath: "#/properties/enum_values/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
        }
        let i1 = data6.length;
        let j0;
        if (i1 > 1) {
          const indices0 = {};
          for (; i1--;) {
            let item0 = data6[i1];
            if (typeof item0 !== "string") {
              continue;
            }
            if (typeof indices0[item0] == "number") {
              j0 = indices0[item0];
              const err33 = {
                instancePath: instancePath + "/enum_values",
                schemaPath: "#/properties/enum_values/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i1, j: j0 },
                message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err33];
              } else {
                vErrors.push(err33);
              }
              errors++;
              break;
            }
            indices0[item0] = i1;
          }
        }
      } else {
        const err34 = {
          instancePath: instancePath + "/enum_values",
          schemaPath: "#/properties/enum_values/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err34];
        } else {
          vErrors.push(err34);
        }
        errors++;
      }
    }
    if (data.minimum !== undefined) {
      let data8 = data.minimum;
      if (!(typeof data8 == "number") && data8 !== null) {
        const err35 = {
          instancePath: instancePath + "/minimum",
          schemaPath: "#/properties/minimum/type",
          keyword: "type",
          params: { type: schema50.properties.minimum.type },
          message: "must be integer,number,null",
        };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
    }
    if (data.maximum !== undefined) {
      let data9 = data.maximum;
      if (!(typeof data9 == "number") && data9 !== null) {
        const err36 = {
          instancePath: instancePath + "/maximum",
          schemaPath: "#/properties/maximum/type",
          keyword: "type",
          params: { type: schema50.properties.maximum.type },
          message: "must be integer,number,null",
        };
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
    }
    if (data.minimum_inclusive !== undefined) {
      if (typeof data.minimum_inclusive !== "boolean") {
        const err37 = {
          instancePath: instancePath + "/minimum_inclusive",
          schemaPath: "#/properties/minimum_inclusive/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
    }
    if (data.maximum_inclusive !== undefined) {
      if (typeof data.maximum_inclusive !== "boolean") {
        const err38 = {
          instancePath: instancePath + "/maximum_inclusive",
          schemaPath: "#/properties/maximum_inclusive/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
    }
    if (data.integer_only !== undefined) {
      if (typeof data.integer_only !== "boolean") {
        const err39 = {
          instancePath: instancePath + "/integer_only",
          schemaPath: "#/properties/integer_only/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      }
    }
    if (data.step !== undefined) {
      let data13 = data.step;
      if (!(typeof data13 == "number") && data13 !== null) {
        const err40 = {
          instancePath: instancePath + "/step",
          schemaPath: "#/properties/step/type",
          keyword: "type",
          params: { type: schema50.properties.step.type },
          message: "must be integer,number,null",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
    if (data.unit !== undefined) {
      let data14 = data.unit;
      if (typeof data14 === "string") {
        if (func1(data14) < 1) {
          const err41 = {
            instancePath: instancePath + "/unit",
            schemaPath: "#/properties/unit/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
      } else {
        const err42 = {
          instancePath: instancePath + "/unit",
          schemaPath: "#/properties/unit/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err42];
        } else {
          vErrors.push(err42);
        }
        errors++;
      }
    }
    if (data.required !== undefined) {
      if (typeof data.required !== "boolean") {
        const err43 = {
          instancePath: instancePath + "/required",
          schemaPath: "#/properties/required/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err43];
        } else {
          vErrors.push(err43);
        }
        errors++;
      }
    }
    if (data.explicit_default_available !== undefined) {
      if (typeof data.explicit_default_available !== "boolean") {
        const err44 = {
          instancePath: instancePath + "/explicit_default_available",
          schemaPath: "#/properties/explicit_default_available/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err44];
        } else {
          vErrors.push(err44);
        }
        errors++;
      }
    }
    if (data.default_value !== undefined) {
      let data17 = data.default_value;
      if (
        !(typeof data17 == "number") &&
        typeof data17 !== "boolean" &&
        typeof data17 !== "string" &&
        data17 !== null
      ) {
        const err45 = {
          instancePath: instancePath + "/default_value",
          schemaPath: "#/properties/default_value/type",
          keyword: "type",
          params: { type: schema50.properties.default_value.type },
          message: "must be integer,number,boolean,string,null",
        };
        if (vErrors === null) {
          vErrors = [err45];
        } else {
          vErrors.push(err45);
        }
        errors++;
      }
    }
    if (data.capability_predicate !== undefined) {
      let data18 = data.capability_predicate;
      if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
        if (data18.capability_path === undefined) {
          const err46 = {
            instancePath: instancePath + "/capability_predicate",
            schemaPath: "#/$defs/capabilityPredicate/required",
            keyword: "required",
            params: { missingProperty: "capability_path" },
            message: "must have required property '" + "capability_path" + "'",
          };
          if (vErrors === null) {
            vErrors = [err46];
          } else {
            vErrors.push(err46);
          }
          errors++;
        }
        if (data18.operator === undefined) {
          const err47 = {
            instancePath: instancePath + "/capability_predicate",
            schemaPath: "#/$defs/capabilityPredicate/required",
            keyword: "required",
            params: { missingProperty: "operator" },
            message: "must have required property '" + "operator" + "'",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
        if (data18.expected_value === undefined) {
          const err48 = {
            instancePath: instancePath + "/capability_predicate",
            schemaPath: "#/$defs/capabilityPredicate/required",
            keyword: "required",
            params: { missingProperty: "expected_value" },
            message: "must have required property '" + "expected_value" + "'",
          };
          if (vErrors === null) {
            vErrors = [err48];
          } else {
            vErrors.push(err48);
          }
          errors++;
        }
        if (data18.evaluated_available === undefined) {
          const err49 = {
            instancePath: instancePath + "/capability_predicate",
            schemaPath: "#/$defs/capabilityPredicate/required",
            keyword: "required",
            params: { missingProperty: "evaluated_available" },
            message: "must have required property '" + "evaluated_available" + "'",
          };
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        for (const key1 in data18) {
          if (!(
            key1 === "capability_path" ||
            key1 === "operator" ||
            key1 === "expected_value" ||
            key1 === "evaluated_available"
          )) {
            const err50 = {
              instancePath: instancePath + "/capability_predicate",
              schemaPath: "#/$defs/capabilityPredicate/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err50];
            } else {
              vErrors.push(err50);
            }
            errors++;
          }
        }
        if (data18.capability_path !== undefined) {
          let data19 = data18.capability_path;
          if (typeof data19 === "string") {
            if (!pattern6.test(data19)) {
              const err51 = {
                instancePath: instancePath + "/capability_predicate/capability_path",
                schemaPath: "#/$defs/capabilityPredicate/properties/capability_path/pattern",
                keyword: "pattern",
                params: { pattern: "^/" },
                message: 'must match pattern "' + "^/" + '"',
              };
              if (vErrors === null) {
                vErrors = [err51];
              } else {
                vErrors.push(err51);
              }
              errors++;
            }
          } else {
            const err52 = {
              instancePath: instancePath + "/capability_predicate/capability_path",
              schemaPath: "#/$defs/capabilityPredicate/properties/capability_path/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err52];
            } else {
              vErrors.push(err52);
            }
            errors++;
          }
        }
        if (data18.operator !== undefined) {
          let data20 = data18.operator;
          if (!(data20 === "equals" || data20 === "contains")) {
            const err53 = {
              instancePath: instancePath + "/capability_predicate/operator",
              schemaPath: "#/$defs/capabilityPredicate/properties/operator/enum",
              keyword: "enum",
              params: { allowedValues: schema43.properties.operator.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err53];
            } else {
              vErrors.push(err53);
            }
            errors++;
          }
        }
        if (data18.expected_value !== undefined) {
          let data21 = data18.expected_value;
          if (typeof data21 !== "string" && typeof data21 !== "boolean") {
            const err54 = {
              instancePath: instancePath + "/capability_predicate/expected_value",
              schemaPath: "#/$defs/capabilityPredicate/properties/expected_value/type",
              keyword: "type",
              params: { type: schema43.properties.expected_value.type },
              message: "must be string,boolean",
            };
            if (vErrors === null) {
              vErrors = [err54];
            } else {
              vErrors.push(err54);
            }
            errors++;
          }
        }
        if (data18.evaluated_available !== undefined) {
          if (typeof data18.evaluated_available !== "boolean") {
            const err55 = {
              instancePath: instancePath + "/capability_predicate/evaluated_available",
              schemaPath: "#/$defs/capabilityPredicate/properties/evaluated_available/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err55];
            } else {
              vErrors.push(err55);
            }
            errors++;
          }
        }
      } else {
        const err56 = {
          instancePath: instancePath + "/capability_predicate",
          schemaPath: "#/$defs/capabilityPredicate/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err56];
        } else {
          vErrors.push(err56);
        }
        errors++;
      }
    }
    if (data.available !== undefined) {
      if (typeof data.available !== "boolean") {
        const err57 = {
          instancePath: instancePath + "/available",
          schemaPath: "#/properties/available/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err57];
        } else {
          vErrors.push(err57);
        }
        errors++;
      }
    }
    if (data.unavailable_reason !== undefined) {
      let data24 = data.unavailable_reason;
      if (typeof data24 !== "string" && data24 !== null) {
        const err58 = {
          instancePath: instancePath + "/unavailable_reason",
          schemaPath: "#/properties/unavailable_reason/type",
          keyword: "type",
          params: { type: schema50.properties.unavailable_reason.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err58];
        } else {
          vErrors.push(err58);
        }
        errors++;
      }
    }
    if (data.applicable_input_modes !== undefined) {
      let data25 = data.applicable_input_modes;
      if (Array.isArray(data25)) {
        const len1 = data25.length;
        for (let i2 = 0; i2 < len1; i2++) {
          let data26 = data25[i2];
          if (!(data26 === "controls" || data26 === "json")) {
            const err59 = {
              instancePath: instancePath + "/applicable_input_modes/" + i2,
              schemaPath: "#/properties/applicable_input_modes/items/enum",
              keyword: "enum",
              params: { allowedValues: schema50.properties.applicable_input_modes.items.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err59];
            } else {
              vErrors.push(err59);
            }
            errors++;
          }
        }
        let i3 = data25.length;
        let j1;
        if (i3 > 1) {
          outer0: for (; i3--;) {
            for (j1 = i3; j1--;) {
              if (func0(data25[i3], data25[j1])) {
                const err60 = {
                  instancePath: instancePath + "/applicable_input_modes",
                  schemaPath: "#/properties/applicable_input_modes/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i3, j: j1 },
                  message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err60];
                } else {
                  vErrors.push(err60);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err61 = {
          instancePath: instancePath + "/applicable_input_modes",
          schemaPath: "#/properties/applicable_input_modes/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err61];
        } else {
          vErrors.push(err61);
        }
        errors++;
      }
    }
    if (data.applicable_scenarios !== undefined) {
      let data27 = data.applicable_scenarios;
      if (Array.isArray(data27)) {
        const len2 = data27.length;
        for (let i4 = 0; i4 < len2; i4++) {
          let data28 = data27[i4];
          if (typeof data28 === "string") {
            if (func1(data28) < 1) {
              const err62 = {
                instancePath: instancePath + "/applicable_scenarios/" + i4,
                schemaPath: "#/properties/applicable_scenarios/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err62];
              } else {
                vErrors.push(err62);
              }
              errors++;
            }
          } else {
            const err63 = {
              instancePath: instancePath + "/applicable_scenarios/" + i4,
              schemaPath: "#/properties/applicable_scenarios/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err63];
            } else {
              vErrors.push(err63);
            }
            errors++;
          }
        }
        let i5 = data27.length;
        let j2;
        if (i5 > 1) {
          const indices1 = {};
          for (; i5--;) {
            let item1 = data27[i5];
            if (typeof item1 !== "string") {
              continue;
            }
            if (typeof indices1[item1] == "number") {
              j2 = indices1[item1];
              const err64 = {
                instancePath: instancePath + "/applicable_scenarios",
                schemaPath: "#/properties/applicable_scenarios/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i5, j: j2 },
                message: "must NOT have duplicate items (items ## " + j2 + " and " + i5 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err64];
              } else {
                vErrors.push(err64);
              }
              errors++;
              break;
            }
            indices1[item1] = i5;
          }
        }
      } else {
        const err65 = {
          instancePath: instancePath + "/applicable_scenarios",
          schemaPath: "#/properties/applicable_scenarios/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err65];
        } else {
          vErrors.push(err65);
        }
        errors++;
      }
    }
  } else {
    const err66 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err66];
    } else {
      vErrors.push(err66);
    }
    errors++;
  }
  validate26.errors = vErrors;
  return errors === 0;
}
validate26.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate25(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/experiment-descriptor.schema.json" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate25.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_version === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_version" },
        message: "must have required property '" + "schema_version" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.schema_set_revision === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_set_revision" },
        message: "must have required property '" + "schema_set_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.descriptor_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "descriptor_id" },
        message: "must have required property '" + "descriptor_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.descriptor_revision === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "descriptor_revision" },
        message: "must have required property '" + "descriptor_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.create_run_schema_identity === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "create_run_schema_identity" },
        message: "must have required property '" + "create_run_schema_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.scenarios === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "scenarios" },
        message: "must have required property '" + "scenarios" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.requested_fidelity_options === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "requested_fidelity_options" },
        message: "must have required property '" + "requested_fidelity_options" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.gpu_participation_modes === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "gpu_participation_modes" },
        message: "must have required property '" + "gpu_participation_modes" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.input_modes === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "input_modes" },
        message: "must have required property '" + "input_modes" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.design_space_modes === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "design_space_modes" },
        message: "must have required property '" + "design_space_modes" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.source_mode_options === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_mode_options" },
        message: "must have required property '" + "source_mode_options" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.parameter_groups === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "parameter_groups" },
        message: "must have required property '" + "parameter_groups" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.subsystem_parameter_coverage === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "subsystem_parameter_coverage" },
        message: "must have required property '" + "subsystem_parameter_coverage" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.parameter_descriptors === undefined) {
      const err13 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "parameter_descriptors" },
        message: "must have required property '" + "parameter_descriptors" + "'",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.resolved_fidelity_source === undefined) {
      const err14 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "resolved_fidelity_source" },
        message: "must have required property '" + "resolved_fidelity_source" + "'",
      };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func4.call(schema40.properties, key0)) {
        const err15 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.schema_version !== undefined) {
      if ("tilesim.bridge.experiment_descriptor.v1" !== data.schema_version) {
        const err16 = {
          instancePath: instancePath + "/schema_version",
          schemaPath: "#/properties/schema_version/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.experiment_descriptor.v1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.schema_set_revision !== undefined) {
      let data1 = data.schema_set_revision;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err17 = {
            instancePath: instancePath + "/schema_set_revision",
            schemaPath: "#/$defs/revision/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = {
          instancePath: instancePath + "/schema_set_revision",
          schemaPath: "#/$defs/revision/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.descriptor_id !== undefined) {
      let data2 = data.descriptor_id;
      if (typeof data2 === "string") {
        if (func1(data2) < 1) {
          const err19 = {
            instancePath: instancePath + "/descriptor_id",
            schemaPath: "#/properties/descriptor_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = {
          instancePath: instancePath + "/descriptor_id",
          schemaPath: "#/properties/descriptor_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.descriptor_revision !== undefined) {
      let data3 = data.descriptor_revision;
      if (typeof data3 === "string") {
        if (!pattern4.test(data3)) {
          const err21 = {
            instancePath: instancePath + "/descriptor_revision",
            schemaPath: "#/$defs/revision/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      } else {
        const err22 = {
          instancePath: instancePath + "/descriptor_revision",
          schemaPath: "#/$defs/revision/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.create_run_schema_identity !== undefined) {
      if ("tilesim.bridge.create_run_request.v1" !== data.create_run_schema_identity) {
        const err23 = {
          instancePath: instancePath + "/create_run_schema_identity",
          schemaPath: "#/properties/create_run_schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.create_run_request.v1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.scenarios !== undefined) {
      let data5 = data.scenarios;
      if (Array.isArray(data5)) {
        const len0 = data5.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data6 = data5[i0];
          if (data6 && typeof data6 == "object" && !Array.isArray(data6)) {
            if (data6.scenario_id === undefined) {
              const err24 = {
                instancePath: instancePath + "/scenarios/" + i0,
                schemaPath: "#/properties/scenarios/items/required",
                keyword: "required",
                params: { missingProperty: "scenario_id" },
                message: "must have required property '" + "scenario_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err24];
              } else {
                vErrors.push(err24);
              }
              errors++;
            }
            if (data6.label === undefined) {
              const err25 = {
                instancePath: instancePath + "/scenarios/" + i0,
                schemaPath: "#/properties/scenarios/items/required",
                keyword: "required",
                params: { missingProperty: "label" },
                message: "must have required property '" + "label" + "'",
              };
              if (vErrors === null) {
                vErrors = [err25];
              } else {
                vErrors.push(err25);
              }
              errors++;
            }
            if (data6.available === undefined) {
              const err26 = {
                instancePath: instancePath + "/scenarios/" + i0,
                schemaPath: "#/properties/scenarios/items/required",
                keyword: "required",
                params: { missingProperty: "available" },
                message: "must have required property '" + "available" + "'",
              };
              if (vErrors === null) {
                vErrors = [err26];
              } else {
                vErrors.push(err26);
              }
              errors++;
            }
            if (data6.unavailable_reason === undefined) {
              const err27 = {
                instancePath: instancePath + "/scenarios/" + i0,
                schemaPath: "#/properties/scenarios/items/required",
                keyword: "required",
                params: { missingProperty: "unavailable_reason" },
                message: "must have required property '" + "unavailable_reason" + "'",
              };
              if (vErrors === null) {
                vErrors = [err27];
              } else {
                vErrors.push(err27);
              }
              errors++;
            }
            for (const key1 in data6) {
              if (!(
                key1 === "scenario_id" ||
                key1 === "label" ||
                key1 === "available" ||
                key1 === "unavailable_reason"
              )) {
                const err28 = {
                  instancePath: instancePath + "/scenarios/" + i0,
                  schemaPath: "#/properties/scenarios/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key1 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err28];
                } else {
                  vErrors.push(err28);
                }
                errors++;
              }
            }
            if (data6.scenario_id !== undefined) {
              let data7 = data6.scenario_id;
              if (typeof data7 === "string") {
                if (func1(data7) < 1) {
                  const err29 = {
                    instancePath: instancePath + "/scenarios/" + i0 + "/scenario_id",
                    schemaPath: "#/properties/scenarios/items/properties/scenario_id/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err29];
                  } else {
                    vErrors.push(err29);
                  }
                  errors++;
                }
              } else {
                const err30 = {
                  instancePath: instancePath + "/scenarios/" + i0 + "/scenario_id",
                  schemaPath: "#/properties/scenarios/items/properties/scenario_id/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err30];
                } else {
                  vErrors.push(err30);
                }
                errors++;
              }
            }
            if (data6.label !== undefined) {
              let data8 = data6.label;
              if (typeof data8 === "string") {
                if (func1(data8) < 1) {
                  const err31 = {
                    instancePath: instancePath + "/scenarios/" + i0 + "/label",
                    schemaPath: "#/properties/scenarios/items/properties/label/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err31];
                  } else {
                    vErrors.push(err31);
                  }
                  errors++;
                }
              } else {
                const err32 = {
                  instancePath: instancePath + "/scenarios/" + i0 + "/label",
                  schemaPath: "#/properties/scenarios/items/properties/label/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err32];
                } else {
                  vErrors.push(err32);
                }
                errors++;
              }
            }
            if (data6.available !== undefined) {
              if (typeof data6.available !== "boolean") {
                const err33 = {
                  instancePath: instancePath + "/scenarios/" + i0 + "/available",
                  schemaPath: "#/properties/scenarios/items/properties/available/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                };
                if (vErrors === null) {
                  vErrors = [err33];
                } else {
                  vErrors.push(err33);
                }
                errors++;
              }
            }
            if (data6.unavailable_reason !== undefined) {
              let data10 = data6.unavailable_reason;
              if (typeof data10 !== "string" && data10 !== null) {
                const err34 = {
                  instancePath: instancePath + "/scenarios/" + i0 + "/unavailable_reason",
                  schemaPath: "#/properties/scenarios/items/properties/unavailable_reason/type",
                  keyword: "type",
                  params: { type: schema40.properties.scenarios.items.properties.unavailable_reason.type },
                  message: "must be string,null",
                };
                if (vErrors === null) {
                  vErrors = [err34];
                } else {
                  vErrors.push(err34);
                }
                errors++;
              }
            }
          } else {
            const err35 = {
              instancePath: instancePath + "/scenarios/" + i0,
              schemaPath: "#/properties/scenarios/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err35];
            } else {
              vErrors.push(err35);
            }
            errors++;
          }
        }
      } else {
        const err36 = {
          instancePath: instancePath + "/scenarios",
          schemaPath: "#/properties/scenarios/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
    }
    if (data.requested_fidelity_options !== undefined) {
      let data11 = data.requested_fidelity_options;
      if (Array.isArray(data11)) {
        const len1 = data11.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data12 = data11[i1];
          if (data12 && typeof data12 == "object" && !Array.isArray(data12)) {
            if (data12.fidelity_policy === undefined) {
              const err37 = {
                instancePath: instancePath + "/requested_fidelity_options/" + i1,
                schemaPath: "#/properties/requested_fidelity_options/items/required",
                keyword: "required",
                params: { missingProperty: "fidelity_policy" },
                message: "must have required property '" + "fidelity_policy" + "'",
              };
              if (vErrors === null) {
                vErrors = [err37];
              } else {
                vErrors.push(err37);
              }
              errors++;
            }
            if (data12.requested_tier === undefined) {
              const err38 = {
                instancePath: instancePath + "/requested_fidelity_options/" + i1,
                schemaPath: "#/properties/requested_fidelity_options/items/required",
                keyword: "required",
                params: { missingProperty: "requested_tier" },
                message: "must have required property '" + "requested_tier" + "'",
              };
              if (vErrors === null) {
                vErrors = [err38];
              } else {
                vErrors.push(err38);
              }
              errors++;
            }
            if (data12.available === undefined) {
              const err39 = {
                instancePath: instancePath + "/requested_fidelity_options/" + i1,
                schemaPath: "#/properties/requested_fidelity_options/items/required",
                keyword: "required",
                params: { missingProperty: "available" },
                message: "must have required property '" + "available" + "'",
              };
              if (vErrors === null) {
                vErrors = [err39];
              } else {
                vErrors.push(err39);
              }
              errors++;
            }
            if (data12.unavailable_reason === undefined) {
              const err40 = {
                instancePath: instancePath + "/requested_fidelity_options/" + i1,
                schemaPath: "#/properties/requested_fidelity_options/items/required",
                keyword: "required",
                params: { missingProperty: "unavailable_reason" },
                message: "must have required property '" + "unavailable_reason" + "'",
              };
              if (vErrors === null) {
                vErrors = [err40];
              } else {
                vErrors.push(err40);
              }
              errors++;
            }
            if (data12.capability_predicate === undefined) {
              const err41 = {
                instancePath: instancePath + "/requested_fidelity_options/" + i1,
                schemaPath: "#/properties/requested_fidelity_options/items/required",
                keyword: "required",
                params: { missingProperty: "capability_predicate" },
                message: "must have required property '" + "capability_predicate" + "'",
              };
              if (vErrors === null) {
                vErrors = [err41];
              } else {
                vErrors.push(err41);
              }
              errors++;
            }
            for (const key2 in data12) {
              if (!(
                key2 === "fidelity_policy" ||
                key2 === "requested_tier" ||
                key2 === "available" ||
                key2 === "unavailable_reason" ||
                key2 === "capability_predicate"
              )) {
                const err42 = {
                  instancePath: instancePath + "/requested_fidelity_options/" + i1,
                  schemaPath: "#/properties/requested_fidelity_options/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key2 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err42];
                } else {
                  vErrors.push(err42);
                }
                errors++;
              }
            }
            if (data12.fidelity_policy !== undefined) {
              let data13 = data12.fidelity_policy;
              if (!(data13 === "default" || data13 === "des" || data13 === "cycle")) {
                const err43 = {
                  instancePath: instancePath + "/requested_fidelity_options/" + i1 + "/fidelity_policy",
                  schemaPath: "#/properties/requested_fidelity_options/items/properties/fidelity_policy/enum",
                  keyword: "enum",
                  params: {
                    allowedValues: schema40.properties.requested_fidelity_options.items.properties.fidelity_policy.enum,
                  },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err43];
                } else {
                  vErrors.push(err43);
                }
                errors++;
              }
            }
            if (data12.requested_tier !== undefined) {
              let data14 = data12.requested_tier;
              if (!(data14 === "policy_default" || data14 === "DES" || data14 === "Cycle")) {
                const err44 = {
                  instancePath: instancePath + "/requested_fidelity_options/" + i1 + "/requested_tier",
                  schemaPath: "#/properties/requested_fidelity_options/items/properties/requested_tier/enum",
                  keyword: "enum",
                  params: {
                    allowedValues: schema40.properties.requested_fidelity_options.items.properties.requested_tier.enum,
                  },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err44];
                } else {
                  vErrors.push(err44);
                }
                errors++;
              }
            }
            if (data12.available !== undefined) {
              if (typeof data12.available !== "boolean") {
                const err45 = {
                  instancePath: instancePath + "/requested_fidelity_options/" + i1 + "/available",
                  schemaPath: "#/properties/requested_fidelity_options/items/properties/available/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                };
                if (vErrors === null) {
                  vErrors = [err45];
                } else {
                  vErrors.push(err45);
                }
                errors++;
              }
            }
            if (data12.unavailable_reason !== undefined) {
              let data16 = data12.unavailable_reason;
              if (typeof data16 !== "string" && data16 !== null) {
                const err46 = {
                  instancePath: instancePath + "/requested_fidelity_options/" + i1 + "/unavailable_reason",
                  schemaPath: "#/properties/requested_fidelity_options/items/properties/unavailable_reason/type",
                  keyword: "type",
                  params: {
                    type: schema40.properties.requested_fidelity_options.items.properties.unavailable_reason.type,
                  },
                  message: "must be string,null",
                };
                if (vErrors === null) {
                  vErrors = [err46];
                } else {
                  vErrors.push(err46);
                }
                errors++;
              }
            }
            if (data12.capability_predicate !== undefined) {
              let data17 = data12.capability_predicate;
              const _errs37 = errors;
              let valid9 = false;
              let passing0 = null;
              const _errs38 = errors;
              if (data17 && typeof data17 == "object" && !Array.isArray(data17)) {
                if (data17.capability_path === undefined) {
                  const err47 = {
                    instancePath: instancePath + "/requested_fidelity_options/" + i1 + "/capability_predicate",
                    schemaPath: "#/$defs/capabilityPredicate/required",
                    keyword: "required",
                    params: { missingProperty: "capability_path" },
                    message: "must have required property '" + "capability_path" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err47];
                  } else {
                    vErrors.push(err47);
                  }
                  errors++;
                }
                if (data17.operator === undefined) {
                  const err48 = {
                    instancePath: instancePath + "/requested_fidelity_options/" + i1 + "/capability_predicate",
                    schemaPath: "#/$defs/capabilityPredicate/required",
                    keyword: "required",
                    params: { missingProperty: "operator" },
                    message: "must have required property '" + "operator" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err48];
                  } else {
                    vErrors.push(err48);
                  }
                  errors++;
                }
                if (data17.expected_value === undefined) {
                  const err49 = {
                    instancePath: instancePath + "/requested_fidelity_options/" + i1 + "/capability_predicate",
                    schemaPath: "#/$defs/capabilityPredicate/required",
                    keyword: "required",
                    params: { missingProperty: "expected_value" },
                    message: "must have required property '" + "expected_value" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err49];
                  } else {
                    vErrors.push(err49);
                  }
                  errors++;
                }
                if (data17.evaluated_available === undefined) {
                  const err50 = {
                    instancePath: instancePath + "/requested_fidelity_options/" + i1 + "/capability_predicate",
                    schemaPath: "#/$defs/capabilityPredicate/required",
                    keyword: "required",
                    params: { missingProperty: "evaluated_available" },
                    message: "must have required property '" + "evaluated_available" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err50];
                  } else {
                    vErrors.push(err50);
                  }
                  errors++;
                }
                for (const key3 in data17) {
                  if (!(
                    key3 === "capability_path" ||
                    key3 === "operator" ||
                    key3 === "expected_value" ||
                    key3 === "evaluated_available"
                  )) {
                    const err51 = {
                      instancePath: instancePath + "/requested_fidelity_options/" + i1 + "/capability_predicate",
                      schemaPath: "#/$defs/capabilityPredicate/additionalProperties",
                      keyword: "additionalProperties",
                      params: { additionalProperty: key3 },
                      message: "must NOT have additional properties",
                    };
                    if (vErrors === null) {
                      vErrors = [err51];
                    } else {
                      vErrors.push(err51);
                    }
                    errors++;
                  }
                }
                if (data17.capability_path !== undefined) {
                  let data18 = data17.capability_path;
                  if (typeof data18 === "string") {
                    if (!pattern6.test(data18)) {
                      const err52 = {
                        instancePath:
                          instancePath + "/requested_fidelity_options/" + i1 + "/capability_predicate/capability_path",
                        schemaPath: "#/$defs/capabilityPredicate/properties/capability_path/pattern",
                        keyword: "pattern",
                        params: { pattern: "^/" },
                        message: 'must match pattern "' + "^/" + '"',
                      };
                      if (vErrors === null) {
                        vErrors = [err52];
                      } else {
                        vErrors.push(err52);
                      }
                      errors++;
                    }
                  } else {
                    const err53 = {
                      instancePath:
                        instancePath + "/requested_fidelity_options/" + i1 + "/capability_predicate/capability_path",
                      schemaPath: "#/$defs/capabilityPredicate/properties/capability_path/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err53];
                    } else {
                      vErrors.push(err53);
                    }
                    errors++;
                  }
                }
                if (data17.operator !== undefined) {
                  let data19 = data17.operator;
                  if (!(data19 === "equals" || data19 === "contains")) {
                    const err54 = {
                      instancePath:
                        instancePath + "/requested_fidelity_options/" + i1 + "/capability_predicate/operator",
                      schemaPath: "#/$defs/capabilityPredicate/properties/operator/enum",
                      keyword: "enum",
                      params: { allowedValues: schema43.properties.operator.enum },
                      message: "must be equal to one of the allowed values",
                    };
                    if (vErrors === null) {
                      vErrors = [err54];
                    } else {
                      vErrors.push(err54);
                    }
                    errors++;
                  }
                }
                if (data17.expected_value !== undefined) {
                  let data20 = data17.expected_value;
                  if (typeof data20 !== "string" && typeof data20 !== "boolean") {
                    const err55 = {
                      instancePath:
                        instancePath + "/requested_fidelity_options/" + i1 + "/capability_predicate/expected_value",
                      schemaPath: "#/$defs/capabilityPredicate/properties/expected_value/type",
                      keyword: "type",
                      params: { type: schema43.properties.expected_value.type },
                      message: "must be string,boolean",
                    };
                    if (vErrors === null) {
                      vErrors = [err55];
                    } else {
                      vErrors.push(err55);
                    }
                    errors++;
                  }
                }
                if (data17.evaluated_available !== undefined) {
                  if (typeof data17.evaluated_available !== "boolean") {
                    const err56 = {
                      instancePath:
                        instancePath +
                        "/requested_fidelity_options/" +
                        i1 +
                        "/capability_predicate/evaluated_available",
                      schemaPath: "#/$defs/capabilityPredicate/properties/evaluated_available/type",
                      keyword: "type",
                      params: { type: "boolean" },
                      message: "must be boolean",
                    };
                    if (vErrors === null) {
                      vErrors = [err56];
                    } else {
                      vErrors.push(err56);
                    }
                    errors++;
                  }
                }
              } else {
                const err57 = {
                  instancePath: instancePath + "/requested_fidelity_options/" + i1 + "/capability_predicate",
                  schemaPath: "#/$defs/capabilityPredicate/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                };
                if (vErrors === null) {
                  vErrors = [err57];
                } else {
                  vErrors.push(err57);
                }
                errors++;
              }
              var _valid0 = _errs38 === errors;
              if (_valid0) {
                valid9 = true;
                passing0 = 0;
              }
              const _errs49 = errors;
              if (data17 !== null) {
                const err58 = {
                  instancePath: instancePath + "/requested_fidelity_options/" + i1 + "/capability_predicate",
                  schemaPath:
                    "#/properties/requested_fidelity_options/items/properties/capability_predicate/oneOf/1/type",
                  keyword: "type",
                  params: { type: "null" },
                  message: "must be null",
                };
                if (vErrors === null) {
                  vErrors = [err58];
                } else {
                  vErrors.push(err58);
                }
                errors++;
              }
              var _valid0 = _errs49 === errors;
              if (_valid0 && valid9) {
                valid9 = false;
                passing0 = [passing0, 1];
              } else {
                if (_valid0) {
                  valid9 = true;
                  passing0 = 1;
                }
              }
              if (!valid9) {
                const err59 = {
                  instancePath: instancePath + "/requested_fidelity_options/" + i1 + "/capability_predicate",
                  schemaPath: "#/properties/requested_fidelity_options/items/properties/capability_predicate/oneOf",
                  keyword: "oneOf",
                  params: { passingSchemas: passing0 },
                  message: "must match exactly one schema in oneOf",
                };
                if (vErrors === null) {
                  vErrors = [err59];
                } else {
                  vErrors.push(err59);
                }
                errors++;
              } else {
                errors = _errs37;
                if (vErrors !== null) {
                  if (_errs37) {
                    vErrors.length = _errs37;
                  } else {
                    vErrors = null;
                  }
                }
              }
            }
          } else {
            const err60 = {
              instancePath: instancePath + "/requested_fidelity_options/" + i1,
              schemaPath: "#/properties/requested_fidelity_options/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err60];
            } else {
              vErrors.push(err60);
            }
            errors++;
          }
        }
      } else {
        const err61 = {
          instancePath: instancePath + "/requested_fidelity_options",
          schemaPath: "#/properties/requested_fidelity_options/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err61];
        } else {
          vErrors.push(err61);
        }
        errors++;
      }
    }
    if (data.gpu_participation_modes !== undefined) {
      let data22 = data.gpu_participation_modes;
      if (Array.isArray(data22)) {
        const len2 = data22.length;
        for (let i2 = 0; i2 < len2; i2++) {
          let data23 = data22[i2];
          if (data23 && typeof data23 == "object" && !Array.isArray(data23)) {
            if (data23.gpu_participation_mode === undefined) {
              const err62 = {
                instancePath: instancePath + "/gpu_participation_modes/" + i2,
                schemaPath: "#/$defs/gpuOptions/items/required",
                keyword: "required",
                params: { missingProperty: "gpu_participation_mode" },
                message: "must have required property '" + "gpu_participation_mode" + "'",
              };
              if (vErrors === null) {
                vErrors = [err62];
              } else {
                vErrors.push(err62);
              }
              errors++;
            }
            if (data23.available === undefined) {
              const err63 = {
                instancePath: instancePath + "/gpu_participation_modes/" + i2,
                schemaPath: "#/$defs/gpuOptions/items/required",
                keyword: "required",
                params: { missingProperty: "available" },
                message: "must have required property '" + "available" + "'",
              };
              if (vErrors === null) {
                vErrors = [err63];
              } else {
                vErrors.push(err63);
              }
              errors++;
            }
            if (data23.unavailable_reason === undefined) {
              const err64 = {
                instancePath: instancePath + "/gpu_participation_modes/" + i2,
                schemaPath: "#/$defs/gpuOptions/items/required",
                keyword: "required",
                params: { missingProperty: "unavailable_reason" },
                message: "must have required property '" + "unavailable_reason" + "'",
              };
              if (vErrors === null) {
                vErrors = [err64];
              } else {
                vErrors.push(err64);
              }
              errors++;
            }
            for (const key4 in data23) {
              if (!(key4 === "gpu_participation_mode" || key4 === "available" || key4 === "unavailable_reason")) {
                const err65 = {
                  instancePath: instancePath + "/gpu_participation_modes/" + i2,
                  schemaPath: "#/$defs/gpuOptions/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key4 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err65];
                } else {
                  vErrors.push(err65);
                }
                errors++;
              }
            }
            if (data23.gpu_participation_mode !== undefined) {
              if ("gpu_free" !== data23.gpu_participation_mode) {
                const err66 = {
                  instancePath: instancePath + "/gpu_participation_modes/" + i2 + "/gpu_participation_mode",
                  schemaPath: "#/$defs/gpuOptions/items/properties/gpu_participation_mode/const",
                  keyword: "const",
                  params: { allowedValue: "gpu_free" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err66];
                } else {
                  vErrors.push(err66);
                }
                errors++;
              }
            }
            if (data23.available !== undefined) {
              if (typeof data23.available !== "boolean") {
                const err67 = {
                  instancePath: instancePath + "/gpu_participation_modes/" + i2 + "/available",
                  schemaPath: "#/$defs/gpuOptions/items/properties/available/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                };
                if (vErrors === null) {
                  vErrors = [err67];
                } else {
                  vErrors.push(err67);
                }
                errors++;
              }
            }
            if (data23.unavailable_reason !== undefined) {
              let data26 = data23.unavailable_reason;
              if (typeof data26 !== "string" && data26 !== null) {
                const err68 = {
                  instancePath: instancePath + "/gpu_participation_modes/" + i2 + "/unavailable_reason",
                  schemaPath: "#/$defs/gpuOptions/items/properties/unavailable_reason/type",
                  keyword: "type",
                  params: { type: schema44.items.properties.unavailable_reason.type },
                  message: "must be string,null",
                };
                if (vErrors === null) {
                  vErrors = [err68];
                } else {
                  vErrors.push(err68);
                }
                errors++;
              }
            }
          } else {
            const err69 = {
              instancePath: instancePath + "/gpu_participation_modes/" + i2,
              schemaPath: "#/$defs/gpuOptions/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err69];
            } else {
              vErrors.push(err69);
            }
            errors++;
          }
        }
      } else {
        const err70 = {
          instancePath: instancePath + "/gpu_participation_modes",
          schemaPath: "#/$defs/gpuOptions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err70];
        } else {
          vErrors.push(err70);
        }
        errors++;
      }
    }
    if (data.input_modes !== undefined) {
      let data27 = data.input_modes;
      if (Array.isArray(data27)) {
        const len3 = data27.length;
        for (let i3 = 0; i3 < len3; i3++) {
          let data28 = data27[i3];
          if (data28 && typeof data28 == "object" && !Array.isArray(data28)) {
            if (data28.input_mode === undefined) {
              const err71 = {
                instancePath: instancePath + "/input_modes/" + i3,
                schemaPath: "#/$defs/inputOptions/items/required",
                keyword: "required",
                params: { missingProperty: "input_mode" },
                message: "must have required property '" + "input_mode" + "'",
              };
              if (vErrors === null) {
                vErrors = [err71];
              } else {
                vErrors.push(err71);
              }
              errors++;
            }
            if (data28.available === undefined) {
              const err72 = {
                instancePath: instancePath + "/input_modes/" + i3,
                schemaPath: "#/$defs/inputOptions/items/required",
                keyword: "required",
                params: { missingProperty: "available" },
                message: "must have required property '" + "available" + "'",
              };
              if (vErrors === null) {
                vErrors = [err72];
              } else {
                vErrors.push(err72);
              }
              errors++;
            }
            if (data28.unavailable_reason === undefined) {
              const err73 = {
                instancePath: instancePath + "/input_modes/" + i3,
                schemaPath: "#/$defs/inputOptions/items/required",
                keyword: "required",
                params: { missingProperty: "unavailable_reason" },
                message: "must have required property '" + "unavailable_reason" + "'",
              };
              if (vErrors === null) {
                vErrors = [err73];
              } else {
                vErrors.push(err73);
              }
              errors++;
            }
            for (const key5 in data28) {
              if (!(key5 === "input_mode" || key5 === "available" || key5 === "unavailable_reason")) {
                const err74 = {
                  instancePath: instancePath + "/input_modes/" + i3,
                  schemaPath: "#/$defs/inputOptions/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key5 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err74];
                } else {
                  vErrors.push(err74);
                }
                errors++;
              }
            }
            if (data28.input_mode !== undefined) {
              let data29 = data28.input_mode;
              if (!(data29 === "controls" || data29 === "json")) {
                const err75 = {
                  instancePath: instancePath + "/input_modes/" + i3 + "/input_mode",
                  schemaPath: "#/$defs/inputOptions/items/properties/input_mode/enum",
                  keyword: "enum",
                  params: { allowedValues: schema45.items.properties.input_mode.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err75];
                } else {
                  vErrors.push(err75);
                }
                errors++;
              }
            }
            if (data28.available !== undefined) {
              if (typeof data28.available !== "boolean") {
                const err76 = {
                  instancePath: instancePath + "/input_modes/" + i3 + "/available",
                  schemaPath: "#/$defs/inputOptions/items/properties/available/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                };
                if (vErrors === null) {
                  vErrors = [err76];
                } else {
                  vErrors.push(err76);
                }
                errors++;
              }
            }
            if (data28.unavailable_reason !== undefined) {
              let data31 = data28.unavailable_reason;
              if (typeof data31 !== "string" && data31 !== null) {
                const err77 = {
                  instancePath: instancePath + "/input_modes/" + i3 + "/unavailable_reason",
                  schemaPath: "#/$defs/inputOptions/items/properties/unavailable_reason/type",
                  keyword: "type",
                  params: { type: schema45.items.properties.unavailable_reason.type },
                  message: "must be string,null",
                };
                if (vErrors === null) {
                  vErrors = [err77];
                } else {
                  vErrors.push(err77);
                }
                errors++;
              }
            }
          } else {
            const err78 = {
              instancePath: instancePath + "/input_modes/" + i3,
              schemaPath: "#/$defs/inputOptions/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err78];
            } else {
              vErrors.push(err78);
            }
            errors++;
          }
        }
      } else {
        const err79 = {
          instancePath: instancePath + "/input_modes",
          schemaPath: "#/$defs/inputOptions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err79];
        } else {
          vErrors.push(err79);
        }
        errors++;
      }
    }
    if (data.design_space_modes !== undefined) {
      let data32 = data.design_space_modes;
      if (Array.isArray(data32)) {
        const len4 = data32.length;
        for (let i4 = 0; i4 < len4; i4++) {
          let data33 = data32[i4];
          if (data33 && typeof data33 == "object" && !Array.isArray(data33)) {
            if (data33.design_space_mode === undefined) {
              const err80 = {
                instancePath: instancePath + "/design_space_modes/" + i4,
                schemaPath: "#/$defs/designSpaceOptions/items/required",
                keyword: "required",
                params: { missingProperty: "design_space_mode" },
                message: "must have required property '" + "design_space_mode" + "'",
              };
              if (vErrors === null) {
                vErrors = [err80];
              } else {
                vErrors.push(err80);
              }
              errors++;
            }
            if (data33.available === undefined) {
              const err81 = {
                instancePath: instancePath + "/design_space_modes/" + i4,
                schemaPath: "#/$defs/designSpaceOptions/items/required",
                keyword: "required",
                params: { missingProperty: "available" },
                message: "must have required property '" + "available" + "'",
              };
              if (vErrors === null) {
                vErrors = [err81];
              } else {
                vErrors.push(err81);
              }
              errors++;
            }
            if (data33.unavailable_reason === undefined) {
              const err82 = {
                instancePath: instancePath + "/design_space_modes/" + i4,
                schemaPath: "#/$defs/designSpaceOptions/items/required",
                keyword: "required",
                params: { missingProperty: "unavailable_reason" },
                message: "must have required property '" + "unavailable_reason" + "'",
              };
              if (vErrors === null) {
                vErrors = [err82];
              } else {
                vErrors.push(err82);
              }
              errors++;
            }
            for (const key6 in data33) {
              if (!(key6 === "design_space_mode" || key6 === "available" || key6 === "unavailable_reason")) {
                const err83 = {
                  instancePath: instancePath + "/design_space_modes/" + i4,
                  schemaPath: "#/$defs/designSpaceOptions/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key6 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err83];
                } else {
                  vErrors.push(err83);
                }
                errors++;
              }
            }
            if (data33.design_space_mode !== undefined) {
              let data34 = data33.design_space_mode;
              if (!(data34 === "built_in_synthetic" || data34 === "strict_s6_manifest")) {
                const err84 = {
                  instancePath: instancePath + "/design_space_modes/" + i4 + "/design_space_mode",
                  schemaPath: "#/$defs/designSpaceOptions/items/properties/design_space_mode/enum",
                  keyword: "enum",
                  params: { allowedValues: schema46.items.properties.design_space_mode.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err84];
                } else {
                  vErrors.push(err84);
                }
                errors++;
              }
            }
            if (data33.available !== undefined) {
              if (typeof data33.available !== "boolean") {
                const err85 = {
                  instancePath: instancePath + "/design_space_modes/" + i4 + "/available",
                  schemaPath: "#/$defs/designSpaceOptions/items/properties/available/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                };
                if (vErrors === null) {
                  vErrors = [err85];
                } else {
                  vErrors.push(err85);
                }
                errors++;
              }
            }
            if (data33.unavailable_reason !== undefined) {
              let data36 = data33.unavailable_reason;
              if (typeof data36 !== "string" && data36 !== null) {
                const err86 = {
                  instancePath: instancePath + "/design_space_modes/" + i4 + "/unavailable_reason",
                  schemaPath: "#/$defs/designSpaceOptions/items/properties/unavailable_reason/type",
                  keyword: "type",
                  params: { type: schema46.items.properties.unavailable_reason.type },
                  message: "must be string,null",
                };
                if (vErrors === null) {
                  vErrors = [err86];
                } else {
                  vErrors.push(err86);
                }
                errors++;
              }
            }
          } else {
            const err87 = {
              instancePath: instancePath + "/design_space_modes/" + i4,
              schemaPath: "#/$defs/designSpaceOptions/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err87];
            } else {
              vErrors.push(err87);
            }
            errors++;
          }
        }
      } else {
        const err88 = {
          instancePath: instancePath + "/design_space_modes",
          schemaPath: "#/$defs/designSpaceOptions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err88];
        } else {
          vErrors.push(err88);
        }
        errors++;
      }
    }
    if (data.source_mode_options !== undefined) {
      let data37 = data.source_mode_options;
      if (Array.isArray(data37)) {
        if (data37.length > 3) {
          const err89 = {
            instancePath: instancePath + "/source_mode_options",
            schemaPath: "#/properties/source_mode_options/maxItems",
            keyword: "maxItems",
            params: { limit: 3 },
            message: "must NOT have more than 3 items",
          };
          if (vErrors === null) {
            vErrors = [err89];
          } else {
            vErrors.push(err89);
          }
          errors++;
        }
        if (data37.length < 3) {
          const err90 = {
            instancePath: instancePath + "/source_mode_options",
            schemaPath: "#/properties/source_mode_options/minItems",
            keyword: "minItems",
            params: { limit: 3 },
            message: "must NOT have fewer than 3 items",
          };
          if (vErrors === null) {
            vErrors = [err90];
          } else {
            vErrors.push(err90);
          }
          errors++;
        }
        const len5 = data37.length;
        for (let i5 = 0; i5 < len5; i5++) {
          let data38 = data37[i5];
          if (data38 && typeof data38 == "object" && !Array.isArray(data38)) {
            if (data38.source_mode === undefined) {
              const err91 = {
                instancePath: instancePath + "/source_mode_options/" + i5,
                schemaPath: "#/properties/source_mode_options/items/required",
                keyword: "required",
                params: { missingProperty: "source_mode" },
                message: "must have required property '" + "source_mode" + "'",
              };
              if (vErrors === null) {
                vErrors = [err91];
              } else {
                vErrors.push(err91);
              }
              errors++;
            }
            if (data38.available === undefined) {
              const err92 = {
                instancePath: instancePath + "/source_mode_options/" + i5,
                schemaPath: "#/properties/source_mode_options/items/required",
                keyword: "required",
                params: { missingProperty: "available" },
                message: "must have required property '" + "available" + "'",
              };
              if (vErrors === null) {
                vErrors = [err92];
              } else {
                vErrors.push(err92);
              }
              errors++;
            }
            if (data38.unavailable_reason === undefined) {
              const err93 = {
                instancePath: instancePath + "/source_mode_options/" + i5,
                schemaPath: "#/properties/source_mode_options/items/required",
                keyword: "required",
                params: { missingProperty: "unavailable_reason" },
                message: "must have required property '" + "unavailable_reason" + "'",
              };
              if (vErrors === null) {
                vErrors = [err93];
              } else {
                vErrors.push(err93);
              }
              errors++;
            }
            if (data38.allowed_claim_scope === undefined) {
              const err94 = {
                instancePath: instancePath + "/source_mode_options/" + i5,
                schemaPath: "#/properties/source_mode_options/items/required",
                keyword: "required",
                params: { missingProperty: "allowed_claim_scope" },
                message: "must have required property '" + "allowed_claim_scope" + "'",
              };
              if (vErrors === null) {
                vErrors = [err94];
              } else {
                vErrors.push(err94);
              }
              errors++;
            }
            if (data38.calibration_requirement === undefined) {
              const err95 = {
                instancePath: instancePath + "/source_mode_options/" + i5,
                schemaPath: "#/properties/source_mode_options/items/required",
                keyword: "required",
                params: { missingProperty: "calibration_requirement" },
                message: "must have required property '" + "calibration_requirement" + "'",
              };
              if (vErrors === null) {
                vErrors = [err95];
              } else {
                vErrors.push(err95);
              }
              errors++;
            }
            if (data38.applicable_input_modes === undefined) {
              const err96 = {
                instancePath: instancePath + "/source_mode_options/" + i5,
                schemaPath: "#/properties/source_mode_options/items/required",
                keyword: "required",
                params: { missingProperty: "applicable_input_modes" },
                message: "must have required property '" + "applicable_input_modes" + "'",
              };
              if (vErrors === null) {
                vErrors = [err96];
              } else {
                vErrors.push(err96);
              }
              errors++;
            }
            if (data38.capability_predicate === undefined) {
              const err97 = {
                instancePath: instancePath + "/source_mode_options/" + i5,
                schemaPath: "#/properties/source_mode_options/items/required",
                keyword: "required",
                params: { missingProperty: "capability_predicate" },
                message: "must have required property '" + "capability_predicate" + "'",
              };
              if (vErrors === null) {
                vErrors = [err97];
              } else {
                vErrors.push(err97);
              }
              errors++;
            }
            for (const key7 in data38) {
              if (!(
                key7 === "source_mode" ||
                key7 === "available" ||
                key7 === "unavailable_reason" ||
                key7 === "allowed_claim_scope" ||
                key7 === "calibration_requirement" ||
                key7 === "applicable_input_modes" ||
                key7 === "capability_predicate"
              )) {
                const err98 = {
                  instancePath: instancePath + "/source_mode_options/" + i5,
                  schemaPath: "#/properties/source_mode_options/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key7 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err98];
                } else {
                  vErrors.push(err98);
                }
                errors++;
              }
            }
            if (data38.source_mode !== undefined) {
              let data39 = data38.source_mode;
              if (!(
                data39 === "real_trace" ||
                data39 === "synthetic_trace" ||
                data39 === "compatibility_harness_trace"
              )) {
                const err99 = {
                  instancePath: instancePath + "/source_mode_options/" + i5 + "/source_mode",
                  schemaPath: "#/properties/source_mode_options/items/properties/source_mode/enum",
                  keyword: "enum",
                  params: { allowedValues: schema40.properties.source_mode_options.items.properties.source_mode.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err99];
                } else {
                  vErrors.push(err99);
                }
                errors++;
              }
            }
            if (data38.available !== undefined) {
              if (typeof data38.available !== "boolean") {
                const err100 = {
                  instancePath: instancePath + "/source_mode_options/" + i5 + "/available",
                  schemaPath: "#/properties/source_mode_options/items/properties/available/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                };
                if (vErrors === null) {
                  vErrors = [err100];
                } else {
                  vErrors.push(err100);
                }
                errors++;
              }
            }
            if (data38.unavailable_reason !== undefined) {
              let data41 = data38.unavailable_reason;
              if (typeof data41 !== "string" && data41 !== null) {
                const err101 = {
                  instancePath: instancePath + "/source_mode_options/" + i5 + "/unavailable_reason",
                  schemaPath: "#/properties/source_mode_options/items/properties/unavailable_reason/type",
                  keyword: "type",
                  params: { type: schema40.properties.source_mode_options.items.properties.unavailable_reason.type },
                  message: "must be string,null",
                };
                if (vErrors === null) {
                  vErrors = [err101];
                } else {
                  vErrors.push(err101);
                }
                errors++;
              }
            }
            if (data38.allowed_claim_scope !== undefined) {
              let data42 = data38.allowed_claim_scope;
              if (typeof data42 === "string") {
                if (func1(data42) < 1) {
                  const err102 = {
                    instancePath: instancePath + "/source_mode_options/" + i5 + "/allowed_claim_scope",
                    schemaPath: "#/properties/source_mode_options/items/properties/allowed_claim_scope/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err102];
                  } else {
                    vErrors.push(err102);
                  }
                  errors++;
                }
              } else {
                const err103 = {
                  instancePath: instancePath + "/source_mode_options/" + i5 + "/allowed_claim_scope",
                  schemaPath: "#/properties/source_mode_options/items/properties/allowed_claim_scope/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err103];
                } else {
                  vErrors.push(err103);
                }
                errors++;
              }
            }
            if (data38.calibration_requirement !== undefined) {
              let data43 = data38.calibration_requirement;
              if (typeof data43 === "string") {
                if (func1(data43) < 1) {
                  const err104 = {
                    instancePath: instancePath + "/source_mode_options/" + i5 + "/calibration_requirement",
                    schemaPath: "#/properties/source_mode_options/items/properties/calibration_requirement/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err104];
                  } else {
                    vErrors.push(err104);
                  }
                  errors++;
                }
              } else {
                const err105 = {
                  instancePath: instancePath + "/source_mode_options/" + i5 + "/calibration_requirement",
                  schemaPath: "#/properties/source_mode_options/items/properties/calibration_requirement/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err105];
                } else {
                  vErrors.push(err105);
                }
                errors++;
              }
            }
            if (data38.applicable_input_modes !== undefined) {
              let data44 = data38.applicable_input_modes;
              if (Array.isArray(data44)) {
                const len6 = data44.length;
                for (let i6 = 0; i6 < len6; i6++) {
                  let data45 = data44[i6];
                  if (!(data45 === "controls" || data45 === "json")) {
                    const err106 = {
                      instancePath: instancePath + "/source_mode_options/" + i5 + "/applicable_input_modes/" + i6,
                      schemaPath: "#/properties/source_mode_options/items/properties/applicable_input_modes/items/enum",
                      keyword: "enum",
                      params: {
                        allowedValues:
                          schema40.properties.source_mode_options.items.properties.applicable_input_modes.items.enum,
                      },
                      message: "must be equal to one of the allowed values",
                    };
                    if (vErrors === null) {
                      vErrors = [err106];
                    } else {
                      vErrors.push(err106);
                    }
                    errors++;
                  }
                }
                let i7 = data44.length;
                let j0;
                if (i7 > 1) {
                  outer0: for (; i7--;) {
                    for (j0 = i7; j0--;) {
                      if (func0(data44[i7], data44[j0])) {
                        const err107 = {
                          instancePath: instancePath + "/source_mode_options/" + i5 + "/applicable_input_modes",
                          schemaPath:
                            "#/properties/source_mode_options/items/properties/applicable_input_modes/uniqueItems",
                          keyword: "uniqueItems",
                          params: { i: i7, j: j0 },
                          message: "must NOT have duplicate items (items ## " + j0 + " and " + i7 + " are identical)",
                        };
                        if (vErrors === null) {
                          vErrors = [err107];
                        } else {
                          vErrors.push(err107);
                        }
                        errors++;
                        break outer0;
                      }
                    }
                  }
                }
              } else {
                const err108 = {
                  instancePath: instancePath + "/source_mode_options/" + i5 + "/applicable_input_modes",
                  schemaPath: "#/properties/source_mode_options/items/properties/applicable_input_modes/type",
                  keyword: "type",
                  params: { type: "array" },
                  message: "must be array",
                };
                if (vErrors === null) {
                  vErrors = [err108];
                } else {
                  vErrors.push(err108);
                }
                errors++;
              }
            }
            if (data38.capability_predicate !== undefined) {
              let data46 = data38.capability_predicate;
              const _errs102 = errors;
              let valid30 = false;
              let passing1 = null;
              const _errs103 = errors;
              if (data46 && typeof data46 == "object" && !Array.isArray(data46)) {
                if (data46.capability_path === undefined) {
                  const err109 = {
                    instancePath: instancePath + "/source_mode_options/" + i5 + "/capability_predicate",
                    schemaPath: "#/$defs/capabilityPredicate/required",
                    keyword: "required",
                    params: { missingProperty: "capability_path" },
                    message: "must have required property '" + "capability_path" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err109];
                  } else {
                    vErrors.push(err109);
                  }
                  errors++;
                }
                if (data46.operator === undefined) {
                  const err110 = {
                    instancePath: instancePath + "/source_mode_options/" + i5 + "/capability_predicate",
                    schemaPath: "#/$defs/capabilityPredicate/required",
                    keyword: "required",
                    params: { missingProperty: "operator" },
                    message: "must have required property '" + "operator" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err110];
                  } else {
                    vErrors.push(err110);
                  }
                  errors++;
                }
                if (data46.expected_value === undefined) {
                  const err111 = {
                    instancePath: instancePath + "/source_mode_options/" + i5 + "/capability_predicate",
                    schemaPath: "#/$defs/capabilityPredicate/required",
                    keyword: "required",
                    params: { missingProperty: "expected_value" },
                    message: "must have required property '" + "expected_value" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err111];
                  } else {
                    vErrors.push(err111);
                  }
                  errors++;
                }
                if (data46.evaluated_available === undefined) {
                  const err112 = {
                    instancePath: instancePath + "/source_mode_options/" + i5 + "/capability_predicate",
                    schemaPath: "#/$defs/capabilityPredicate/required",
                    keyword: "required",
                    params: { missingProperty: "evaluated_available" },
                    message: "must have required property '" + "evaluated_available" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err112];
                  } else {
                    vErrors.push(err112);
                  }
                  errors++;
                }
                for (const key8 in data46) {
                  if (!(
                    key8 === "capability_path" ||
                    key8 === "operator" ||
                    key8 === "expected_value" ||
                    key8 === "evaluated_available"
                  )) {
                    const err113 = {
                      instancePath: instancePath + "/source_mode_options/" + i5 + "/capability_predicate",
                      schemaPath: "#/$defs/capabilityPredicate/additionalProperties",
                      keyword: "additionalProperties",
                      params: { additionalProperty: key8 },
                      message: "must NOT have additional properties",
                    };
                    if (vErrors === null) {
                      vErrors = [err113];
                    } else {
                      vErrors.push(err113);
                    }
                    errors++;
                  }
                }
                if (data46.capability_path !== undefined) {
                  let data47 = data46.capability_path;
                  if (typeof data47 === "string") {
                    if (!pattern6.test(data47)) {
                      const err114 = {
                        instancePath:
                          instancePath + "/source_mode_options/" + i5 + "/capability_predicate/capability_path",
                        schemaPath: "#/$defs/capabilityPredicate/properties/capability_path/pattern",
                        keyword: "pattern",
                        params: { pattern: "^/" },
                        message: 'must match pattern "' + "^/" + '"',
                      };
                      if (vErrors === null) {
                        vErrors = [err114];
                      } else {
                        vErrors.push(err114);
                      }
                      errors++;
                    }
                  } else {
                    const err115 = {
                      instancePath:
                        instancePath + "/source_mode_options/" + i5 + "/capability_predicate/capability_path",
                      schemaPath: "#/$defs/capabilityPredicate/properties/capability_path/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err115];
                    } else {
                      vErrors.push(err115);
                    }
                    errors++;
                  }
                }
                if (data46.operator !== undefined) {
                  let data48 = data46.operator;
                  if (!(data48 === "equals" || data48 === "contains")) {
                    const err116 = {
                      instancePath: instancePath + "/source_mode_options/" + i5 + "/capability_predicate/operator",
                      schemaPath: "#/$defs/capabilityPredicate/properties/operator/enum",
                      keyword: "enum",
                      params: { allowedValues: schema43.properties.operator.enum },
                      message: "must be equal to one of the allowed values",
                    };
                    if (vErrors === null) {
                      vErrors = [err116];
                    } else {
                      vErrors.push(err116);
                    }
                    errors++;
                  }
                }
                if (data46.expected_value !== undefined) {
                  let data49 = data46.expected_value;
                  if (typeof data49 !== "string" && typeof data49 !== "boolean") {
                    const err117 = {
                      instancePath:
                        instancePath + "/source_mode_options/" + i5 + "/capability_predicate/expected_value",
                      schemaPath: "#/$defs/capabilityPredicate/properties/expected_value/type",
                      keyword: "type",
                      params: { type: schema43.properties.expected_value.type },
                      message: "must be string,boolean",
                    };
                    if (vErrors === null) {
                      vErrors = [err117];
                    } else {
                      vErrors.push(err117);
                    }
                    errors++;
                  }
                }
                if (data46.evaluated_available !== undefined) {
                  if (typeof data46.evaluated_available !== "boolean") {
                    const err118 = {
                      instancePath:
                        instancePath + "/source_mode_options/" + i5 + "/capability_predicate/evaluated_available",
                      schemaPath: "#/$defs/capabilityPredicate/properties/evaluated_available/type",
                      keyword: "type",
                      params: { type: "boolean" },
                      message: "must be boolean",
                    };
                    if (vErrors === null) {
                      vErrors = [err118];
                    } else {
                      vErrors.push(err118);
                    }
                    errors++;
                  }
                }
              } else {
                const err119 = {
                  instancePath: instancePath + "/source_mode_options/" + i5 + "/capability_predicate",
                  schemaPath: "#/$defs/capabilityPredicate/type",
                  keyword: "type",
                  params: { type: "object" },
                  message: "must be object",
                };
                if (vErrors === null) {
                  vErrors = [err119];
                } else {
                  vErrors.push(err119);
                }
                errors++;
              }
              var _valid1 = _errs103 === errors;
              if (_valid1) {
                valid30 = true;
                passing1 = 0;
              }
              const _errs114 = errors;
              if (data46 !== null) {
                const err120 = {
                  instancePath: instancePath + "/source_mode_options/" + i5 + "/capability_predicate",
                  schemaPath: "#/properties/source_mode_options/items/properties/capability_predicate/oneOf/1/type",
                  keyword: "type",
                  params: { type: "null" },
                  message: "must be null",
                };
                if (vErrors === null) {
                  vErrors = [err120];
                } else {
                  vErrors.push(err120);
                }
                errors++;
              }
              var _valid1 = _errs114 === errors;
              if (_valid1 && valid30) {
                valid30 = false;
                passing1 = [passing1, 1];
              } else {
                if (_valid1) {
                  valid30 = true;
                  passing1 = 1;
                }
              }
              if (!valid30) {
                const err121 = {
                  instancePath: instancePath + "/source_mode_options/" + i5 + "/capability_predicate",
                  schemaPath: "#/properties/source_mode_options/items/properties/capability_predicate/oneOf",
                  keyword: "oneOf",
                  params: { passingSchemas: passing1 },
                  message: "must match exactly one schema in oneOf",
                };
                if (vErrors === null) {
                  vErrors = [err121];
                } else {
                  vErrors.push(err121);
                }
                errors++;
              } else {
                errors = _errs102;
                if (vErrors !== null) {
                  if (_errs102) {
                    vErrors.length = _errs102;
                  } else {
                    vErrors = null;
                  }
                }
              }
            }
          } else {
            const err122 = {
              instancePath: instancePath + "/source_mode_options/" + i5,
              schemaPath: "#/properties/source_mode_options/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err122];
            } else {
              vErrors.push(err122);
            }
            errors++;
          }
        }
      } else {
        const err123 = {
          instancePath: instancePath + "/source_mode_options",
          schemaPath: "#/properties/source_mode_options/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err123];
        } else {
          vErrors.push(err123);
        }
        errors++;
      }
    }
    if (data.parameter_groups !== undefined) {
      let data51 = data.parameter_groups;
      if (Array.isArray(data51)) {
        const len7 = data51.length;
        for (let i8 = 0; i8 < len7; i8++) {
          let data52 = data51[i8];
          if (data52 && typeof data52 == "object" && !Array.isArray(data52)) {
            if (data52.group_id === undefined) {
              const err124 = {
                instancePath: instancePath + "/parameter_groups/" + i8,
                schemaPath: "#/properties/parameter_groups/items/required",
                keyword: "required",
                params: { missingProperty: "group_id" },
                message: "must have required property '" + "group_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err124];
              } else {
                vErrors.push(err124);
              }
              errors++;
            }
            if (data52.subsystem === undefined) {
              const err125 = {
                instancePath: instancePath + "/parameter_groups/" + i8,
                schemaPath: "#/properties/parameter_groups/items/required",
                keyword: "required",
                params: { missingProperty: "subsystem" },
                message: "must have required property '" + "subsystem" + "'",
              };
              if (vErrors === null) {
                vErrors = [err125];
              } else {
                vErrors.push(err125);
              }
              errors++;
            }
            if (data52.display_order === undefined) {
              const err126 = {
                instancePath: instancePath + "/parameter_groups/" + i8,
                schemaPath: "#/properties/parameter_groups/items/required",
                keyword: "required",
                params: { missingProperty: "display_order" },
                message: "must have required property '" + "display_order" + "'",
              };
              if (vErrors === null) {
                vErrors = [err126];
              } else {
                vErrors.push(err126);
              }
              errors++;
            }
            if (data52.status === undefined) {
              const err127 = {
                instancePath: instancePath + "/parameter_groups/" + i8,
                schemaPath: "#/properties/parameter_groups/items/required",
                keyword: "required",
                params: { missingProperty: "status" },
                message: "must have required property '" + "status" + "'",
              };
              if (vErrors === null) {
                vErrors = [err127];
              } else {
                vErrors.push(err127);
              }
              errors++;
            }
            for (const key9 in data52) {
              if (!(key9 === "group_id" || key9 === "subsystem" || key9 === "display_order" || key9 === "status")) {
                const err128 = {
                  instancePath: instancePath + "/parameter_groups/" + i8,
                  schemaPath: "#/properties/parameter_groups/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key9 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err128];
                } else {
                  vErrors.push(err128);
                }
                errors++;
              }
            }
            if (data52.group_id !== undefined) {
              let data53 = data52.group_id;
              if (typeof data53 === "string") {
                if (func1(data53) < 1) {
                  const err129 = {
                    instancePath: instancePath + "/parameter_groups/" + i8 + "/group_id",
                    schemaPath: "#/properties/parameter_groups/items/properties/group_id/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err129];
                  } else {
                    vErrors.push(err129);
                  }
                  errors++;
                }
              } else {
                const err130 = {
                  instancePath: instancePath + "/parameter_groups/" + i8 + "/group_id",
                  schemaPath: "#/properties/parameter_groups/items/properties/group_id/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err130];
                } else {
                  vErrors.push(err130);
                }
                errors++;
              }
            }
            if (data52.subsystem !== undefined) {
              let data54 = data52.subsystem;
              if (!(
                data54 === "S0" ||
                data54 === "S1" ||
                data54 === "S2" ||
                data54 === "S3" ||
                data54 === "S4" ||
                data54 === "S5" ||
                data54 === "S6"
              )) {
                const err131 = {
                  instancePath: instancePath + "/parameter_groups/" + i8 + "/subsystem",
                  schemaPath: "#/$defs/subsystem/enum",
                  keyword: "enum",
                  params: { allowedValues: schema48.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err131];
                } else {
                  vErrors.push(err131);
                }
                errors++;
              }
            }
            if (data52.display_order !== undefined) {
              let data55 = data52.display_order;
              if (!(typeof data55 == "number" && !(data55 % 1) && !isNaN(data55))) {
                const err132 = {
                  instancePath: instancePath + "/parameter_groups/" + i8 + "/display_order",
                  schemaPath: "#/properties/parameter_groups/items/properties/display_order/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err132];
                } else {
                  vErrors.push(err132);
                }
                errors++;
              }
              if (typeof data55 == "number") {
                if (data55 < 0 || isNaN(data55)) {
                  const err133 = {
                    instancePath: instancePath + "/parameter_groups/" + i8 + "/display_order",
                    schemaPath: "#/properties/parameter_groups/items/properties/display_order/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err133];
                  } else {
                    vErrors.push(err133);
                  }
                  errors++;
                }
              }
            }
            if (data52.status !== undefined) {
              let data56 = data52.status;
              if (!(data56 === "exposed" || data56 === "not_exposed" || data56 === "unsupported")) {
                const err134 = {
                  instancePath: instancePath + "/parameter_groups/" + i8 + "/status",
                  schemaPath: "#/properties/parameter_groups/items/properties/status/enum",
                  keyword: "enum",
                  params: { allowedValues: schema40.properties.parameter_groups.items.properties.status.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err134];
                } else {
                  vErrors.push(err134);
                }
                errors++;
              }
            }
          } else {
            const err135 = {
              instancePath: instancePath + "/parameter_groups/" + i8,
              schemaPath: "#/properties/parameter_groups/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err135];
            } else {
              vErrors.push(err135);
            }
            errors++;
          }
        }
      } else {
        const err136 = {
          instancePath: instancePath + "/parameter_groups",
          schemaPath: "#/properties/parameter_groups/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err136];
        } else {
          vErrors.push(err136);
        }
        errors++;
      }
    }
    if (data.subsystem_parameter_coverage !== undefined) {
      let data57 = data.subsystem_parameter_coverage;
      if (Array.isArray(data57)) {
        if (data57.length > 7) {
          const err137 = {
            instancePath: instancePath + "/subsystem_parameter_coverage",
            schemaPath: "#/properties/subsystem_parameter_coverage/maxItems",
            keyword: "maxItems",
            params: { limit: 7 },
            message: "must NOT have more than 7 items",
          };
          if (vErrors === null) {
            vErrors = [err137];
          } else {
            vErrors.push(err137);
          }
          errors++;
        }
        if (data57.length < 7) {
          const err138 = {
            instancePath: instancePath + "/subsystem_parameter_coverage",
            schemaPath: "#/properties/subsystem_parameter_coverage/minItems",
            keyword: "minItems",
            params: { limit: 7 },
            message: "must NOT have fewer than 7 items",
          };
          if (vErrors === null) {
            vErrors = [err138];
          } else {
            vErrors.push(err138);
          }
          errors++;
        }
        const len8 = data57.length;
        for (let i9 = 0; i9 < len8; i9++) {
          let data58 = data57[i9];
          if (data58 && typeof data58 == "object" && !Array.isArray(data58)) {
            if (data58.subsystem === undefined) {
              const err139 = {
                instancePath: instancePath + "/subsystem_parameter_coverage/" + i9,
                schemaPath: "#/properties/subsystem_parameter_coverage/items/required",
                keyword: "required",
                params: { missingProperty: "subsystem" },
                message: "must have required property '" + "subsystem" + "'",
              };
              if (vErrors === null) {
                vErrors = [err139];
              } else {
                vErrors.push(err139);
              }
              errors++;
            }
            if (data58.status === undefined) {
              const err140 = {
                instancePath: instancePath + "/subsystem_parameter_coverage/" + i9,
                schemaPath: "#/properties/subsystem_parameter_coverage/items/required",
                keyword: "required",
                params: { missingProperty: "status" },
                message: "must have required property '" + "status" + "'",
              };
              if (vErrors === null) {
                vErrors = [err140];
              } else {
                vErrors.push(err140);
              }
              errors++;
            }
            if (data58.parameter_field_ids === undefined) {
              const err141 = {
                instancePath: instancePath + "/subsystem_parameter_coverage/" + i9,
                schemaPath: "#/properties/subsystem_parameter_coverage/items/required",
                keyword: "required",
                params: { missingProperty: "parameter_field_ids" },
                message: "must have required property '" + "parameter_field_ids" + "'",
              };
              if (vErrors === null) {
                vErrors = [err141];
              } else {
                vErrors.push(err141);
              }
              errors++;
            }
            if (data58.reason === undefined) {
              const err142 = {
                instancePath: instancePath + "/subsystem_parameter_coverage/" + i9,
                schemaPath: "#/properties/subsystem_parameter_coverage/items/required",
                keyword: "required",
                params: { missingProperty: "reason" },
                message: "must have required property '" + "reason" + "'",
              };
              if (vErrors === null) {
                vErrors = [err142];
              } else {
                vErrors.push(err142);
              }
              errors++;
            }
            for (const key10 in data58) {
              if (!(
                key10 === "subsystem" ||
                key10 === "status" ||
                key10 === "parameter_field_ids" ||
                key10 === "reason"
              )) {
                const err143 = {
                  instancePath: instancePath + "/subsystem_parameter_coverage/" + i9,
                  schemaPath: "#/properties/subsystem_parameter_coverage/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key10 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err143];
                } else {
                  vErrors.push(err143);
                }
                errors++;
              }
            }
            if (data58.subsystem !== undefined) {
              let data59 = data58.subsystem;
              if (!(
                data59 === "S0" ||
                data59 === "S1" ||
                data59 === "S2" ||
                data59 === "S3" ||
                data59 === "S4" ||
                data59 === "S5" ||
                data59 === "S6"
              )) {
                const err144 = {
                  instancePath: instancePath + "/subsystem_parameter_coverage/" + i9 + "/subsystem",
                  schemaPath: "#/$defs/subsystem/enum",
                  keyword: "enum",
                  params: { allowedValues: schema48.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err144];
                } else {
                  vErrors.push(err144);
                }
                errors++;
              }
            }
            if (data58.status !== undefined) {
              let data60 = data58.status;
              if (!(data60 === "exposed" || data60 === "not_exposed" || data60 === "unsupported")) {
                const err145 = {
                  instancePath: instancePath + "/subsystem_parameter_coverage/" + i9 + "/status",
                  schemaPath: "#/properties/subsystem_parameter_coverage/items/properties/status/enum",
                  keyword: "enum",
                  params: {
                    allowedValues: schema40.properties.subsystem_parameter_coverage.items.properties.status.enum,
                  },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err145];
                } else {
                  vErrors.push(err145);
                }
                errors++;
              }
            }
            if (data58.parameter_field_ids !== undefined) {
              let data61 = data58.parameter_field_ids;
              if (Array.isArray(data61)) {
                const len9 = data61.length;
                for (let i10 = 0; i10 < len9; i10++) {
                  let data62 = data61[i10];
                  if (typeof data62 === "string") {
                    if (func1(data62) < 1) {
                      const err146 = {
                        instancePath:
                          instancePath + "/subsystem_parameter_coverage/" + i9 + "/parameter_field_ids/" + i10,
                        schemaPath:
                          "#/properties/subsystem_parameter_coverage/items/properties/parameter_field_ids/items/minLength",
                        keyword: "minLength",
                        params: { limit: 1 },
                        message: "must NOT have fewer than 1 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err146];
                      } else {
                        vErrors.push(err146);
                      }
                      errors++;
                    }
                  } else {
                    const err147 = {
                      instancePath:
                        instancePath + "/subsystem_parameter_coverage/" + i9 + "/parameter_field_ids/" + i10,
                      schemaPath:
                        "#/properties/subsystem_parameter_coverage/items/properties/parameter_field_ids/items/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err147];
                    } else {
                      vErrors.push(err147);
                    }
                    errors++;
                  }
                }
                let i11 = data61.length;
                let j1;
                if (i11 > 1) {
                  const indices0 = {};
                  for (; i11--;) {
                    let item0 = data61[i11];
                    if (typeof item0 !== "string") {
                      continue;
                    }
                    if (typeof indices0[item0] == "number") {
                      j1 = indices0[item0];
                      const err148 = {
                        instancePath: instancePath + "/subsystem_parameter_coverage/" + i9 + "/parameter_field_ids",
                        schemaPath:
                          "#/properties/subsystem_parameter_coverage/items/properties/parameter_field_ids/uniqueItems",
                        keyword: "uniqueItems",
                        params: { i: i11, j: j1 },
                        message: "must NOT have duplicate items (items ## " + j1 + " and " + i11 + " are identical)",
                      };
                      if (vErrors === null) {
                        vErrors = [err148];
                      } else {
                        vErrors.push(err148);
                      }
                      errors++;
                      break;
                    }
                    indices0[item0] = i11;
                  }
                }
              } else {
                const err149 = {
                  instancePath: instancePath + "/subsystem_parameter_coverage/" + i9 + "/parameter_field_ids",
                  schemaPath: "#/properties/subsystem_parameter_coverage/items/properties/parameter_field_ids/type",
                  keyword: "type",
                  params: { type: "array" },
                  message: "must be array",
                };
                if (vErrors === null) {
                  vErrors = [err149];
                } else {
                  vErrors.push(err149);
                }
                errors++;
              }
            }
            if (data58.reason !== undefined) {
              let data63 = data58.reason;
              if (typeof data63 !== "string" && data63 !== null) {
                const err150 = {
                  instancePath: instancePath + "/subsystem_parameter_coverage/" + i9 + "/reason",
                  schemaPath: "#/properties/subsystem_parameter_coverage/items/properties/reason/type",
                  keyword: "type",
                  params: { type: schema40.properties.subsystem_parameter_coverage.items.properties.reason.type },
                  message: "must be string,null",
                };
                if (vErrors === null) {
                  vErrors = [err150];
                } else {
                  vErrors.push(err150);
                }
                errors++;
              }
            }
          } else {
            const err151 = {
              instancePath: instancePath + "/subsystem_parameter_coverage/" + i9,
              schemaPath: "#/properties/subsystem_parameter_coverage/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err151];
            } else {
              vErrors.push(err151);
            }
            errors++;
          }
        }
      } else {
        const err152 = {
          instancePath: instancePath + "/subsystem_parameter_coverage",
          schemaPath: "#/properties/subsystem_parameter_coverage/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err152];
        } else {
          vErrors.push(err152);
        }
        errors++;
      }
    }
    if (data.parameter_descriptors !== undefined) {
      let data64 = data.parameter_descriptors;
      if (Array.isArray(data64)) {
        if (data64.length > 8) {
          const err153 = {
            instancePath: instancePath + "/parameter_descriptors",
            schemaPath: "#/properties/parameter_descriptors/maxItems",
            keyword: "maxItems",
            params: { limit: 8 },
            message: "must NOT have more than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err153];
          } else {
            vErrors.push(err153);
          }
          errors++;
        }
        if (data64.length < 8) {
          const err154 = {
            instancePath: instancePath + "/parameter_descriptors",
            schemaPath: "#/properties/parameter_descriptors/minItems",
            keyword: "minItems",
            params: { limit: 8 },
            message: "must NOT have fewer than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err154];
          } else {
            vErrors.push(err154);
          }
          errors++;
        }
        const len10 = data64.length;
        for (let i12 = 0; i12 < len10; i12++) {
          if (
            !validate26(data64[i12], {
              instancePath: instancePath + "/parameter_descriptors/" + i12,
              parentData: data64,
              parentDataProperty: i12,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err155 = {
          instancePath: instancePath + "/parameter_descriptors",
          schemaPath: "#/properties/parameter_descriptors/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err155];
        } else {
          vErrors.push(err155);
        }
        errors++;
      }
    }
    if (data.resolved_fidelity_source !== undefined) {
      if ("run_execution_envelope_and_validation_reports" !== data.resolved_fidelity_source) {
        const err156 = {
          instancePath: instancePath + "/resolved_fidelity_source",
          schemaPath: "#/properties/resolved_fidelity_source/const",
          keyword: "const",
          params: { allowedValue: "run_execution_envelope_and_validation_reports" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err156];
        } else {
          vErrors.push(err156);
        }
        errors++;
      }
    }
  } else {
    const err157 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err157];
    } else {
      vErrors.push(err157);
    }
    errors++;
  }
  validate25.errors = vErrors;
  return errors === 0;
}
validate25.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const designSpaceCandidates = validate28;
function validate28(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/design-space-candidates.schema.json" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate28.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_version === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_version" },
        message: "must have required property '" + "schema_version" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.manifest_id === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "manifest_id" },
        message: "must have required property '" + "manifest_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.source_mode === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_mode" },
        message: "must have required property '" + "source_mode" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.calibration_level === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calibration_level" },
        message: "must have required property '" + "calibration_level" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.allowed_claim_scope === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "allowed_claim_scope" },
        message: "must have required property '" + "allowed_claim_scope" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.candidates === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "candidates" },
        message: "must have required property '" + "candidates" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "schema_version" ||
        key0 === "manifest_id" ||
        key0 === "source_mode" ||
        key0 === "calibration_level" ||
        key0 === "allowed_claim_scope" ||
        key0 === "candidates"
      )) {
        const err6 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.schema_version !== undefined) {
      if ("tilesim.design_space.s6_candidates.v1" !== data.schema_version) {
        const err7 = {
          instancePath: instancePath + "/schema_version",
          schemaPath: "#/properties/schema_version/const",
          keyword: "const",
          params: { allowedValue: "tilesim.design_space.s6_candidates.v1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.manifest_id !== undefined) {
      let data1 = data.manifest_id;
      if (typeof data1 === "string") {
        if (func1(data1) > 160) {
          const err8 = {
            instancePath: instancePath + "/manifest_id",
            schemaPath: "#/properties/manifest_id/maxLength",
            keyword: "maxLength",
            params: { limit: 160 },
            message: "must NOT have more than 160 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (func1(data1) < 1) {
          const err9 = {
            instancePath: instancePath + "/manifest_id",
            schemaPath: "#/properties/manifest_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/manifest_id",
          schemaPath: "#/properties/manifest_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.source_mode !== undefined) {
      if ("synthetic_trace" !== data.source_mode) {
        const err11 = {
          instancePath: instancePath + "/source_mode",
          schemaPath: "#/properties/source_mode/const",
          keyword: "const",
          params: { allowedValue: "synthetic_trace" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.calibration_level !== undefined) {
      let data3 = data.calibration_level;
      if (!(data3 === "uncalibrated" || data3 === "partially_calibrated")) {
        const err12 = {
          instancePath: instancePath + "/calibration_level",
          schemaPath: "#/properties/calibration_level/enum",
          keyword: "enum",
          params: { allowedValues: schema39.properties.calibration_level.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.allowed_claim_scope !== undefined) {
      let data4 = data.allowed_claim_scope;
      if (!(
        data4 === "exploratory" ||
        data4 === "exploratory_s6_only" ||
        data4 === "synthetic_consistency" ||
        data4 === "synthetic_consistency_only" ||
        data4 === "workflow_consistency_only"
      )) {
        const err13 = {
          instancePath: instancePath + "/allowed_claim_scope",
          schemaPath: "#/properties/allowed_claim_scope/enum",
          keyword: "enum",
          params: { allowedValues: schema39.properties.allowed_claim_scope.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.candidates !== undefined) {
      let data5 = data.candidates;
      if (Array.isArray(data5)) {
        if (data5.length > 256) {
          const err14 = {
            instancePath: instancePath + "/candidates",
            schemaPath: "#/properties/candidates/maxItems",
            keyword: "maxItems",
            params: { limit: 256 },
            message: "must NOT have more than 256 items",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (data5.length < 1) {
          const err15 = {
            instancePath: instancePath + "/candidates",
            schemaPath: "#/properties/candidates/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        const len0 = data5.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data6 = data5[i0];
          if (data6 && typeof data6 == "object" && !Array.isArray(data6)) {
            if (data6.candidate_id === undefined) {
              const err16 = {
                instancePath: instancePath + "/candidates/" + i0,
                schemaPath: "#/properties/candidates/items/required",
                keyword: "required",
                params: { missingProperty: "candidate_id" },
                message: "must have required property '" + "candidate_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err16];
              } else {
                vErrors.push(err16);
              }
              errors++;
            }
            if (data6.name === undefined) {
              const err17 = {
                instancePath: instancePath + "/candidates/" + i0,
                schemaPath: "#/properties/candidates/items/required",
                keyword: "required",
                params: { missingProperty: "name" },
                message: "must have required property '" + "name" + "'",
              };
              if (vErrors === null) {
                vErrors = [err17];
              } else {
                vErrors.push(err17);
              }
              errors++;
            }
            if (data6.bandwidth_gbps === undefined) {
              const err18 = {
                instancePath: instancePath + "/candidates/" + i0,
                schemaPath: "#/properties/candidates/items/required",
                keyword: "required",
                params: { missingProperty: "bandwidth_gbps" },
                message: "must have required property '" + "bandwidth_gbps" + "'",
              };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
            }
            if (data6.latency_us === undefined) {
              const err19 = {
                instancePath: instancePath + "/candidates/" + i0,
                schemaPath: "#/properties/candidates/items/required",
                keyword: "required",
                params: { missingProperty: "latency_us" },
                message: "must have required property '" + "latency_us" + "'",
              };
              if (vErrors === null) {
                vErrors = [err19];
              } else {
                vErrors.push(err19);
              }
              errors++;
            }
            if (data6.oversubscription_factor === undefined) {
              const err20 = {
                instancePath: instancePath + "/candidates/" + i0,
                schemaPath: "#/properties/candidates/items/required",
                keyword: "required",
                params: { missingProperty: "oversubscription_factor" },
                message: "must have required property '" + "oversubscription_factor" + "'",
              };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
            }
            if (data6.request_count === undefined) {
              const err21 = {
                instancePath: instancePath + "/candidates/" + i0,
                schemaPath: "#/properties/candidates/items/required",
                keyword: "required",
                params: { missingProperty: "request_count" },
                message: "must have required property '" + "request_count" + "'",
              };
              if (vErrors === null) {
                vErrors = [err21];
              } else {
                vErrors.push(err21);
              }
              errors++;
            }
            if (data6.message_bytes === undefined) {
              const err22 = {
                instancePath: instancePath + "/candidates/" + i0,
                schemaPath: "#/properties/candidates/items/required",
                keyword: "required",
                params: { missingProperty: "message_bytes" },
                message: "must have required property '" + "message_bytes" + "'",
              };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors++;
            }
            if (data6.release_interval_ps === undefined) {
              const err23 = {
                instancePath: instancePath + "/candidates/" + i0,
                schemaPath: "#/properties/candidates/items/required",
                keyword: "required",
                params: { missingProperty: "release_interval_ps" },
                message: "must have required property '" + "release_interval_ps" + "'",
              };
              if (vErrors === null) {
                vErrors = [err23];
              } else {
                vErrors.push(err23);
              }
              errors++;
            }
            if (data6.uncertainty_score === undefined) {
              const err24 = {
                instancePath: instancePath + "/candidates/" + i0,
                schemaPath: "#/properties/candidates/items/required",
                keyword: "required",
                params: { missingProperty: "uncertainty_score" },
                message: "must have required property '" + "uncertainty_score" + "'",
              };
              if (vErrors === null) {
                vErrors = [err24];
              } else {
                vErrors.push(err24);
              }
              errors++;
            }
            if (data6.tail_risk === undefined) {
              const err25 = {
                instancePath: instancePath + "/candidates/" + i0,
                schemaPath: "#/properties/candidates/items/required",
                keyword: "required",
                params: { missingProperty: "tail_risk" },
                message: "must have required property '" + "tail_risk" + "'",
              };
              if (vErrors === null) {
                vErrors = [err25];
              } else {
                vErrors.push(err25);
              }
              errors++;
            }
            if (data6.source_id === undefined) {
              const err26 = {
                instancePath: instancePath + "/candidates/" + i0,
                schemaPath: "#/properties/candidates/items/required",
                keyword: "required",
                params: { missingProperty: "source_id" },
                message: "must have required property '" + "source_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err26];
              } else {
                vErrors.push(err26);
              }
              errors++;
            }
            for (const key1 in data6) {
              if (!func4.call(schema39.properties.candidates.items.properties, key1)) {
                const err27 = {
                  instancePath: instancePath + "/candidates/" + i0,
                  schemaPath: "#/properties/candidates/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key1 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err27];
                } else {
                  vErrors.push(err27);
                }
                errors++;
              }
            }
            if (data6.candidate_id !== undefined) {
              let data7 = data6.candidate_id;
              if (typeof data7 === "string") {
                if (func1(data7) > 512) {
                  const err28 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/candidate_id",
                    schemaPath: "#/properties/candidates/items/properties/candidate_id/maxLength",
                    keyword: "maxLength",
                    params: { limit: 512 },
                    message: "must NOT have more than 512 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err28];
                  } else {
                    vErrors.push(err28);
                  }
                  errors++;
                }
                if (func1(data7) < 1) {
                  const err29 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/candidate_id",
                    schemaPath: "#/properties/candidates/items/properties/candidate_id/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err29];
                  } else {
                    vErrors.push(err29);
                  }
                  errors++;
                }
              } else {
                const err30 = {
                  instancePath: instancePath + "/candidates/" + i0 + "/candidate_id",
                  schemaPath: "#/properties/candidates/items/properties/candidate_id/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err30];
                } else {
                  vErrors.push(err30);
                }
                errors++;
              }
            }
            if (data6.name !== undefined) {
              let data8 = data6.name;
              if (typeof data8 === "string") {
                if (func1(data8) > 512) {
                  const err31 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/name",
                    schemaPath: "#/properties/candidates/items/properties/name/maxLength",
                    keyword: "maxLength",
                    params: { limit: 512 },
                    message: "must NOT have more than 512 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err31];
                  } else {
                    vErrors.push(err31);
                  }
                  errors++;
                }
                if (func1(data8) < 1) {
                  const err32 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/name",
                    schemaPath: "#/properties/candidates/items/properties/name/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err32];
                  } else {
                    vErrors.push(err32);
                  }
                  errors++;
                }
              } else {
                const err33 = {
                  instancePath: instancePath + "/candidates/" + i0 + "/name",
                  schemaPath: "#/properties/candidates/items/properties/name/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err33];
                } else {
                  vErrors.push(err33);
                }
                errors++;
              }
            }
            if (data6.bandwidth_gbps !== undefined) {
              let data9 = data6.bandwidth_gbps;
              if (typeof data9 == "number") {
                if (data9 > 100000 || isNaN(data9)) {
                  const err34 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/bandwidth_gbps",
                    schemaPath: "#/properties/candidates/items/properties/bandwidth_gbps/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 100000 },
                    message: "must be <= 100000",
                  };
                  if (vErrors === null) {
                    vErrors = [err34];
                  } else {
                    vErrors.push(err34);
                  }
                  errors++;
                }
                if (data9 < 0.000001 || isNaN(data9)) {
                  const err35 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/bandwidth_gbps",
                    schemaPath: "#/properties/candidates/items/properties/bandwidth_gbps/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0.000001 },
                    message: "must be >= 0.000001",
                  };
                  if (vErrors === null) {
                    vErrors = [err35];
                  } else {
                    vErrors.push(err35);
                  }
                  errors++;
                }
              } else {
                const err36 = {
                  instancePath: instancePath + "/candidates/" + i0 + "/bandwidth_gbps",
                  schemaPath: "#/properties/candidates/items/properties/bandwidth_gbps/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err36];
                } else {
                  vErrors.push(err36);
                }
                errors++;
              }
            }
            if (data6.latency_us !== undefined) {
              let data10 = data6.latency_us;
              if (typeof data10 == "number") {
                if (data10 > 1000000 || isNaN(data10)) {
                  const err37 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/latency_us",
                    schemaPath: "#/properties/candidates/items/properties/latency_us/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 1000000 },
                    message: "must be <= 1000000",
                  };
                  if (vErrors === null) {
                    vErrors = [err37];
                  } else {
                    vErrors.push(err37);
                  }
                  errors++;
                }
                if (data10 < 0 || isNaN(data10)) {
                  const err38 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/latency_us",
                    schemaPath: "#/properties/candidates/items/properties/latency_us/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err38];
                  } else {
                    vErrors.push(err38);
                  }
                  errors++;
                }
              } else {
                const err39 = {
                  instancePath: instancePath + "/candidates/" + i0 + "/latency_us",
                  schemaPath: "#/properties/candidates/items/properties/latency_us/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err39];
                } else {
                  vErrors.push(err39);
                }
                errors++;
              }
            }
            if (data6.oversubscription_factor !== undefined) {
              let data11 = data6.oversubscription_factor;
              if (typeof data11 == "number") {
                if (data11 > 1000000 || isNaN(data11)) {
                  const err40 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/oversubscription_factor",
                    schemaPath: "#/properties/candidates/items/properties/oversubscription_factor/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 1000000 },
                    message: "must be <= 1000000",
                  };
                  if (vErrors === null) {
                    vErrors = [err40];
                  } else {
                    vErrors.push(err40);
                  }
                  errors++;
                }
                if (data11 < 0.000001 || isNaN(data11)) {
                  const err41 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/oversubscription_factor",
                    schemaPath: "#/properties/candidates/items/properties/oversubscription_factor/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0.000001 },
                    message: "must be >= 0.000001",
                  };
                  if (vErrors === null) {
                    vErrors = [err41];
                  } else {
                    vErrors.push(err41);
                  }
                  errors++;
                }
              } else {
                const err42 = {
                  instancePath: instancePath + "/candidates/" + i0 + "/oversubscription_factor",
                  schemaPath: "#/properties/candidates/items/properties/oversubscription_factor/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err42];
                } else {
                  vErrors.push(err42);
                }
                errors++;
              }
            }
            if (data6.request_count !== undefined) {
              let data12 = data6.request_count;
              if (!(typeof data12 == "number" && !(data12 % 1) && !isNaN(data12))) {
                const err43 = {
                  instancePath: instancePath + "/candidates/" + i0 + "/request_count",
                  schemaPath: "#/properties/candidates/items/properties/request_count/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err43];
                } else {
                  vErrors.push(err43);
                }
                errors++;
              }
              if (typeof data12 == "number") {
                if (data12 > 100000 || isNaN(data12)) {
                  const err44 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/request_count",
                    schemaPath: "#/properties/candidates/items/properties/request_count/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 100000 },
                    message: "must be <= 100000",
                  };
                  if (vErrors === null) {
                    vErrors = [err44];
                  } else {
                    vErrors.push(err44);
                  }
                  errors++;
                }
                if (data12 < 1 || isNaN(data12)) {
                  const err45 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/request_count",
                    schemaPath: "#/properties/candidates/items/properties/request_count/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 1 },
                    message: "must be >= 1",
                  };
                  if (vErrors === null) {
                    vErrors = [err45];
                  } else {
                    vErrors.push(err45);
                  }
                  errors++;
                }
              }
            }
            if (data6.message_bytes !== undefined) {
              let data13 = data6.message_bytes;
              if (!(typeof data13 == "number" && !(data13 % 1) && !isNaN(data13))) {
                const err46 = {
                  instancePath: instancePath + "/candidates/" + i0 + "/message_bytes",
                  schemaPath: "#/properties/candidates/items/properties/message_bytes/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err46];
                } else {
                  vErrors.push(err46);
                }
                errors++;
              }
              if (typeof data13 == "number") {
                if (data13 > 9007199254740991 || isNaN(data13)) {
                  const err47 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/message_bytes",
                    schemaPath: "#/properties/candidates/items/properties/message_bytes/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 9007199254740991 },
                    message: "must be <= 9007199254740991",
                  };
                  if (vErrors === null) {
                    vErrors = [err47];
                  } else {
                    vErrors.push(err47);
                  }
                  errors++;
                }
                if (data13 < 1 || isNaN(data13)) {
                  const err48 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/message_bytes",
                    schemaPath: "#/properties/candidates/items/properties/message_bytes/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 1 },
                    message: "must be >= 1",
                  };
                  if (vErrors === null) {
                    vErrors = [err48];
                  } else {
                    vErrors.push(err48);
                  }
                  errors++;
                }
              }
            }
            if (data6.release_interval_ps !== undefined) {
              let data14 = data6.release_interval_ps;
              if (!(typeof data14 == "number" && !(data14 % 1) && !isNaN(data14))) {
                const err49 = {
                  instancePath: instancePath + "/candidates/" + i0 + "/release_interval_ps",
                  schemaPath: "#/properties/candidates/items/properties/release_interval_ps/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err49];
                } else {
                  vErrors.push(err49);
                }
                errors++;
              }
              if (typeof data14 == "number") {
                if (data14 > 9007199254740991 || isNaN(data14)) {
                  const err50 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/release_interval_ps",
                    schemaPath: "#/properties/candidates/items/properties/release_interval_ps/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 9007199254740991 },
                    message: "must be <= 9007199254740991",
                  };
                  if (vErrors === null) {
                    vErrors = [err50];
                  } else {
                    vErrors.push(err50);
                  }
                  errors++;
                }
                if (data14 < 0 || isNaN(data14)) {
                  const err51 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/release_interval_ps",
                    schemaPath: "#/properties/candidates/items/properties/release_interval_ps/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err51];
                  } else {
                    vErrors.push(err51);
                  }
                  errors++;
                }
              }
            }
            if (data6.uncertainty_score !== undefined) {
              let data15 = data6.uncertainty_score;
              if (typeof data15 == "number") {
                if (data15 > 1 || isNaN(data15)) {
                  const err52 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/uncertainty_score",
                    schemaPath: "#/properties/candidates/items/properties/uncertainty_score/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 1 },
                    message: "must be <= 1",
                  };
                  if (vErrors === null) {
                    vErrors = [err52];
                  } else {
                    vErrors.push(err52);
                  }
                  errors++;
                }
                if (data15 < 0 || isNaN(data15)) {
                  const err53 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/uncertainty_score",
                    schemaPath: "#/properties/candidates/items/properties/uncertainty_score/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err53];
                  } else {
                    vErrors.push(err53);
                  }
                  errors++;
                }
              } else {
                const err54 = {
                  instancePath: instancePath + "/candidates/" + i0 + "/uncertainty_score",
                  schemaPath: "#/properties/candidates/items/properties/uncertainty_score/type",
                  keyword: "type",
                  params: { type: "number" },
                  message: "must be number",
                };
                if (vErrors === null) {
                  vErrors = [err54];
                } else {
                  vErrors.push(err54);
                }
                errors++;
              }
            }
            if (data6.tail_risk !== undefined) {
              if (typeof data6.tail_risk !== "boolean") {
                const err55 = {
                  instancePath: instancePath + "/candidates/" + i0 + "/tail_risk",
                  schemaPath: "#/properties/candidates/items/properties/tail_risk/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                };
                if (vErrors === null) {
                  vErrors = [err55];
                } else {
                  vErrors.push(err55);
                }
                errors++;
              }
            }
            if (data6.promotion_hint !== undefined) {
              let data17 = data6.promotion_hint;
              if (typeof data17 === "string") {
                if (func1(data17) > 160) {
                  const err56 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/promotion_hint",
                    schemaPath: "#/properties/candidates/items/properties/promotion_hint/maxLength",
                    keyword: "maxLength",
                    params: { limit: 160 },
                    message: "must NOT have more than 160 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err56];
                  } else {
                    vErrors.push(err56);
                  }
                  errors++;
                }
              } else {
                const err57 = {
                  instancePath: instancePath + "/candidates/" + i0 + "/promotion_hint",
                  schemaPath: "#/properties/candidates/items/properties/promotion_hint/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err57];
                } else {
                  vErrors.push(err57);
                }
                errors++;
              }
            }
            if (data6.source_id !== undefined) {
              let data18 = data6.source_id;
              if (typeof data18 === "string") {
                if (func1(data18) > 512) {
                  const err58 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/source_id",
                    schemaPath: "#/properties/candidates/items/properties/source_id/maxLength",
                    keyword: "maxLength",
                    params: { limit: 512 },
                    message: "must NOT have more than 512 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err58];
                  } else {
                    vErrors.push(err58);
                  }
                  errors++;
                }
                if (func1(data18) < 1) {
                  const err59 = {
                    instancePath: instancePath + "/candidates/" + i0 + "/source_id",
                    schemaPath: "#/properties/candidates/items/properties/source_id/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err59];
                  } else {
                    vErrors.push(err59);
                  }
                  errors++;
                }
              } else {
                const err60 = {
                  instancePath: instancePath + "/candidates/" + i0 + "/source_id",
                  schemaPath: "#/properties/candidates/items/properties/source_id/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err60];
                } else {
                  vErrors.push(err60);
                }
                errors++;
              }
            }
          } else {
            const err61 = {
              instancePath: instancePath + "/candidates/" + i0,
              schemaPath: "#/properties/candidates/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err61];
            } else {
              vErrors.push(err61);
            }
            errors++;
          }
        }
      } else {
        const err62 = {
          instancePath: instancePath + "/candidates",
          schemaPath: "#/properties/candidates/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err62];
        } else {
          vErrors.push(err62);
        }
        errors++;
      }
    }
  } else {
    const err63 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err63];
    } else {
      vErrors.push(err63);
    }
    errors++;
  }
  validate28.errors = vErrors;
  return errors === 0;
}
validate28.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
