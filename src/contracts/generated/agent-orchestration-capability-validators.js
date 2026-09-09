// Generated Ajv standalone Agent orchestration capability validators. Do not edit by hand.
/* eslint-disable @typescript-eslint/no-unused-vars */
"use strict";
export const agentOrchestrationCapabilityCatalog = validate20;
const schema31 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-capability/v1/capability-catalog.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_capability_catalog.v1",
  title: "AgentOrchestrationCapabilityCatalog",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "publication_status",
    "catalog_id",
    "catalog_revision",
    "catalog_digest",
    "contract_package_revision",
    "parameter_descriptor_schema_identity",
    "parameter_descriptor_schema_revision",
    "parameter_descriptor_schema_digest",
    "parameter_descriptors",
    "profile_families",
    "profile_records",
    "agent_exposed_field_ids",
    "not_exposed_capabilities",
    "claim_scope_ceiling",
  ],
  properties: {
    schema_identity: { const: "tilesim.bridge.agent_orchestration_capability_catalog.v1" },
    publication_status: { const: "published" },
    catalog_id: { $ref: "common.schema.json#/$defs/stableId" },
    catalog_revision: { $ref: "common.schema.json#/$defs/sha256" },
    catalog_digest: { $ref: "common.schema.json#/$defs/sha256" },
    contract_package_revision: { $ref: "common.schema.json#/$defs/sha256" },
    parameter_descriptor_schema_identity: { const: "tilesim.bridge.agent_orchestration_parameter_descriptor.v1" },
    parameter_descriptor_schema_revision: { $ref: "common.schema.json#/$defs/sha256" },
    parameter_descriptor_schema_digest: { $ref: "common.schema.json#/$defs/sha256" },
    parameter_descriptors: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: { $ref: "parameter-descriptor.schema.json" },
    },
    profile_families: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: { $ref: "common.schema.json#/$defs/profileAvailability" },
    },
    profile_records: {
      type: "object",
      additionalProperties: false,
      required: ["model", "engine", "device", "topology", "workload"],
      properties: {
        model: { type: "array", maxItems: 0 },
        engine: { type: "array", maxItems: 0 },
        device: { type: "array", maxItems: 0 },
        topology: { type: "array", maxItems: 0 },
        workload: { type: "array", maxItems: 0 },
      },
    },
    agent_exposed_field_ids: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: { $ref: "common.schema.json#/$defs/stableId" },
      uniqueItems: true,
    },
    not_exposed_capabilities: {
      type: "array",
      minItems: 9,
      maxItems: 9,
      items: { $ref: "common.schema.json#/$defs/notExposedCapability" },
    },
    claim_scope_ceiling: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      prefixItems: [{ const: "exploration" }, { const: "synthetic_consistency" }],
    },
  },
};
const schema33 = { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" };
const schema34 = { type: "string", pattern: "^sha256:[0-9a-f]{64}$" };
const schema56 = {
  type: "object",
  additionalProperties: false,
  required: ["capability_id", "state", "reason_code"],
  properties: {
    capability_id: {
      enum: [
        "model_selection",
        "device_selection",
        "engine_selection",
        "tensor_parallel_degree",
        "pipeline_parallel_degree",
        "expert_parallel_degree",
        "physical_kv_policy",
        "collective_algorithm",
        "slo",
      ],
    },
    state: { const: "not_exposed" },
    reason_code: { const: "not_exposed_to_agent" },
  },
};
const func1 = Object.prototype.hasOwnProperty;
import func0 from "ajv/dist/runtime/equal";
const pattern4 = new RegExp("^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$", "u");
const pattern5 = new RegExp("^sha256:[0-9a-f]{64}$", "u");
const schema39 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-capability/v1/parameter-descriptor.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_parameter_descriptor.v1",
  title: "AgentOrchestrationParameterDescriptor",
  type: "object",
  additionalProperties: false,
  required: [
    "field_id",
    "owner_module",
    "value_type",
    "canonical_unit",
    "accepted_units",
    "constraints",
    "applicability",
    "request_identity",
    "request_json_pointer",
    "lowering_stage",
    "execution_evidence",
    "capability_state",
    "reason_codes",
    "claim_scope_ceiling",
    "resolved_fidelity",
  ],
  properties: {
    field_id: { $ref: "common.schema.json#/$defs/stableId" },
    owner_module: { $ref: "common.schema.json#/$defs/ownerModule" },
    value_type: { enum: ["number", "integer", "enum"] },
    canonical_unit: { $ref: "common.schema.json#/$defs/stableId" },
    accepted_units: {
      type: "array",
      minItems: 1,
      items: { $ref: "common.schema.json#/$defs/stableId" },
      uniqueItems: true,
    },
    constraints: {
      type: "object",
      minProperties: 1,
      additionalProperties: false,
      properties: {
        minimum: { type: "string", pattern: "^[0-9]+(?:\\.[0-9]+)?$" },
        maximum: { type: "string", pattern: "^[0-9]+(?:\\.[0-9]+)?$" },
        step: { type: "string", pattern: "^[0-9]+(?:\\.[0-9]+)?$" },
        enum: { type: "array", minItems: 1, items: { $ref: "common.schema.json#/$defs/stableId" }, uniqueItems: true },
      },
    },
    applicability: {
      type: "object",
      additionalProperties: false,
      required: ["status", "conditions"],
      properties: {
        status: { enum: ["available", "conditional"] },
        conditions: { type: "array", minItems: 1, items: { type: "string", minLength: 1 }, uniqueItems: true },
      },
    },
    request_identity: { const: "tilesim.bridge.create_run_request.v1" },
    request_json_pointer: { type: "string", pattern: "^/" },
    lowering_stage: { type: "string", minLength: 1 },
    execution_evidence: { type: "array", minItems: 1, items: { $ref: "common.schema.json#/$defs/evidenceReference" } },
    capability_state: {
      type: "object",
      additionalProperties: false,
      required: [
        "described",
        "accepted",
        "validated",
        "lowered",
        "executed",
        "observable",
        "calibrated",
        "held_out_validated",
        "agent_exposed",
      ],
      properties: {
        described: { $ref: "common.schema.json#/$defs/capabilityDimension" },
        accepted: { $ref: "common.schema.json#/$defs/capabilityDimension" },
        validated: { $ref: "common.schema.json#/$defs/capabilityDimension" },
        lowered: { $ref: "common.schema.json#/$defs/capabilityDimension" },
        executed: { $ref: "common.schema.json#/$defs/capabilityDimension" },
        observable: { $ref: "common.schema.json#/$defs/capabilityDimension" },
        calibrated: { $ref: "common.schema.json#/$defs/capabilityDimension" },
        held_out_validated: { $ref: "common.schema.json#/$defs/capabilityDimension" },
        agent_exposed: { $ref: "common.schema.json#/$defs/capabilityDimension" },
      },
    },
    reason_codes: {
      type: "array",
      minItems: 1,
      items: { $ref: "common.schema.json#/$defs/reasonCode" },
      uniqueItems: true,
    },
    claim_scope_ceiling: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      prefixItems: [{ const: "exploration" }, { const: "synthetic_consistency" }],
    },
    resolved_fidelity: { enum: ["Analytical", "DES", "mixed"] },
  },
};
const schema41 = {
  enum: [
    "工作负载抽象与负载描述语言模块",
    "推理引擎与服务运行时模块",
    "执行语义建模模块",
    "KV Cache 建模模块",
    "设备性能建模模块",
    "集合通信语义模块",
    "网络与硬件资源模块",
    "统一仿真内核模块",
    "场景与探索编排模块",
    "校准验证与指标归因模块",
    "基于 Agent 的仿真编排模块",
  ],
};
const schema48 = {
  enum: [
    "execution_closure_proven",
    "gap_kv_001_logical_admission_only",
    "profile_missing",
    "minimal_engine_profiles_not_catalog_published",
    "create_run_engine_selection_not_exposed",
    "calibration_missing",
    "held_out_validation_missing",
    "not_exposed_to_agent",
    "resolved_scale_out_analytical",
  ],
};
import func5 from "ajv/dist/runtime/ucs2length";
const pattern13 = new RegExp("^[0-9]+(?:\\.[0-9]+)?$", "u");
const pattern17 = new RegExp("^/", "u");
const schema45 = {
  type: "object",
  additionalProperties: false,
  required: ["repository", "revision", "path", "test_case", "evidence_class", "artifact_pointers"],
  properties: {
    repository: { enum: ["D:/tileSim", "D:/tileSim-web"] },
    revision: { $ref: "#/$defs/gitRevision" },
    path: { type: "string", minLength: 1 },
    test_case: { type: "string", minLength: 1 },
    evidence_class: { enum: ["contract", "lowering", "synthetic_deterministic_execution", "artifact_observation"] },
    artifact_pointers: { type: "array", minItems: 1, items: { type: "string", minLength: 1 }, uniqueItems: true },
  },
};
const schema46 = { type: "string", pattern: "^[0-9a-f]{40}$" };
const pattern18 = new RegExp("^[0-9a-f]{40}$", "u");
function validate23(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.repository === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "repository" },
        message: "must have required property '" + "repository" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.revision === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "revision" },
        message: "must have required property '" + "revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.path === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "path" },
        message: "must have required property '" + "path" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.test_case === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "test_case" },
        message: "must have required property '" + "test_case" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.evidence_class === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "evidence_class" },
        message: "must have required property '" + "evidence_class" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.artifact_pointers === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "artifact_pointers" },
        message: "must have required property '" + "artifact_pointers" + "'",
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
        key0 === "repository" ||
        key0 === "revision" ||
        key0 === "path" ||
        key0 === "test_case" ||
        key0 === "evidence_class" ||
        key0 === "artifact_pointers"
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
    if (data.repository !== undefined) {
      let data0 = data.repository;
      if (!(data0 === "D:/tileSim" || data0 === "D:/tileSim-web")) {
        const err7 = {
          instancePath: instancePath + "/repository",
          schemaPath: "#/properties/repository/enum",
          keyword: "enum",
          params: { allowedValues: schema45.properties.repository.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.revision !== undefined) {
      let data1 = data.revision;
      if (typeof data1 === "string") {
        if (!pattern18.test(data1)) {
          const err8 = {
            instancePath: instancePath + "/revision",
            schemaPath: "#/$defs/gitRevision/pattern",
            keyword: "pattern",
            params: { pattern: "^[0-9a-f]{40}$" },
            message: 'must match pattern "' + "^[0-9a-f]{40}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/revision",
          schemaPath: "#/$defs/gitRevision/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.path !== undefined) {
      let data2 = data.path;
      if (typeof data2 === "string") {
        if (func5(data2) < 1) {
          const err10 = {
            instancePath: instancePath + "/path",
            schemaPath: "#/properties/path/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = {
          instancePath: instancePath + "/path",
          schemaPath: "#/properties/path/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.test_case !== undefined) {
      let data3 = data.test_case;
      if (typeof data3 === "string") {
        if (func5(data3) < 1) {
          const err12 = {
            instancePath: instancePath + "/test_case",
            schemaPath: "#/properties/test_case/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/test_case",
          schemaPath: "#/properties/test_case/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.evidence_class !== undefined) {
      let data4 = data.evidence_class;
      if (!(
        data4 === "contract" ||
        data4 === "lowering" ||
        data4 === "synthetic_deterministic_execution" ||
        data4 === "artifact_observation"
      )) {
        const err14 = {
          instancePath: instancePath + "/evidence_class",
          schemaPath: "#/properties/evidence_class/enum",
          keyword: "enum",
          params: { allowedValues: schema45.properties.evidence_class.enum },
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
    if (data.artifact_pointers !== undefined) {
      let data5 = data.artifact_pointers;
      if (Array.isArray(data5)) {
        if (data5.length < 1) {
          const err15 = {
            instancePath: instancePath + "/artifact_pointers",
            schemaPath: "#/properties/artifact_pointers/minItems",
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
          if (typeof data6 === "string") {
            if (func5(data6) < 1) {
              const err16 = {
                instancePath: instancePath + "/artifact_pointers/" + i0,
                schemaPath: "#/properties/artifact_pointers/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/artifact_pointers/" + i0,
              schemaPath: "#/properties/artifact_pointers/items/type",
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
        let i1 = data5.length;
        let j0;
        if (i1 > 1) {
          const indices0 = {};
          for (; i1--;) {
            let item0 = data5[i1];
            if (typeof item0 !== "string") {
              continue;
            }
            if (typeof indices0[item0] == "number") {
              j0 = indices0[item0];
              const err18 = {
                instancePath: instancePath + "/artifact_pointers",
                schemaPath: "#/properties/artifact_pointers/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i1, j: j0 },
                message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
              break;
            }
            indices0[item0] = i1;
          }
        }
      } else {
        const err19 = {
          instancePath: instancePath + "/artifact_pointers",
          schemaPath: "#/properties/artifact_pointers/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
  } else {
    const err20 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err20];
    } else {
      vErrors.push(err20);
    }
    errors++;
  }
  validate23.errors = vErrors;
  return errors === 0;
}
validate23.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const schema47 = {
  type: "object",
  additionalProperties: false,
  required: ["state", "reason_code"],
  properties: { state: { enum: ["affirmed", "denied"] }, reason_code: { $ref: "#/$defs/reasonCode" } },
};
function validate25(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate25.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.state === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "state" },
        message: "must have required property '" + "state" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.reason_code === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "reason_code" },
        message: "must have required property '" + "reason_code" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "state" || key0 === "reason_code")) {
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
    if (data.state !== undefined) {
      let data0 = data.state;
      if (!(data0 === "affirmed" || data0 === "denied")) {
        const err3 = {
          instancePath: instancePath + "/state",
          schemaPath: "#/properties/state/enum",
          keyword: "enum",
          params: { allowedValues: schema47.properties.state.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.reason_code !== undefined) {
      let data1 = data.reason_code;
      if (!(
        data1 === "execution_closure_proven" ||
        data1 === "gap_kv_001_logical_admission_only" ||
        data1 === "profile_missing" ||
        data1 === "minimal_engine_profiles_not_catalog_published" ||
        data1 === "create_run_engine_selection_not_exposed" ||
        data1 === "calibration_missing" ||
        data1 === "held_out_validation_missing" ||
        data1 === "not_exposed_to_agent" ||
        data1 === "resolved_scale_out_analytical"
      )) {
        const err4 = {
          instancePath: instancePath + "/reason_code",
          schemaPath: "#/$defs/reasonCode/enum",
          keyword: "enum",
          params: { allowedValues: schema48.enum },
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
  } else {
    const err5 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  }
  validate25.errors = vErrors;
  return errors === 0;
}
validate25.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate22(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-capability/v1/parameter-descriptor.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
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
    if (data.owner_module === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "owner_module" },
        message: "must have required property '" + "owner_module" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.value_type === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "value_type" },
        message: "must have required property '" + "value_type" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.canonical_unit === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "canonical_unit" },
        message: "must have required property '" + "canonical_unit" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.accepted_units === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "accepted_units" },
        message: "must have required property '" + "accepted_units" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.constraints === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "constraints" },
        message: "must have required property '" + "constraints" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.applicability === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "applicability" },
        message: "must have required property '" + "applicability" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.request_identity === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "request_identity" },
        message: "must have required property '" + "request_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.request_json_pointer === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "request_json_pointer" },
        message: "must have required property '" + "request_json_pointer" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.lowering_stage === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "lowering_stage" },
        message: "must have required property '" + "lowering_stage" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.execution_evidence === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "execution_evidence" },
        message: "must have required property '" + "execution_evidence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.capability_state === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "capability_state" },
        message: "must have required property '" + "capability_state" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.reason_codes === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "reason_codes" },
        message: "must have required property '" + "reason_codes" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.claim_scope_ceiling === undefined) {
      const err13 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "claim_scope_ceiling" },
        message: "must have required property '" + "claim_scope_ceiling" + "'",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.resolved_fidelity === undefined) {
      const err14 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "resolved_fidelity" },
        message: "must have required property '" + "resolved_fidelity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema39.properties, key0)) {
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
    if (data.field_id !== undefined) {
      let data0 = data.field_id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err16 = {
            instancePath: instancePath + "/field_id",
            schemaPath: "common.schema.json#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/field_id",
          schemaPath: "common.schema.json#/$defs/stableId/type",
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
    if (data.owner_module !== undefined) {
      let data1 = data.owner_module;
      if (!(
        data1 === "工作负载抽象与负载描述语言模块" ||
        data1 === "推理引擎与服务运行时模块" ||
        data1 === "执行语义建模模块" ||
        data1 === "KV Cache 建模模块" ||
        data1 === "设备性能建模模块" ||
        data1 === "集合通信语义模块" ||
        data1 === "网络与硬件资源模块" ||
        data1 === "统一仿真内核模块" ||
        data1 === "场景与探索编排模块" ||
        data1 === "校准验证与指标归因模块" ||
        data1 === "基于 Agent 的仿真编排模块"
      )) {
        const err18 = {
          instancePath: instancePath + "/owner_module",
          schemaPath: "common.schema.json#/$defs/ownerModule/enum",
          keyword: "enum",
          params: { allowedValues: schema41.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.value_type !== undefined) {
      let data2 = data.value_type;
      if (!(data2 === "number" || data2 === "integer" || data2 === "enum")) {
        const err19 = {
          instancePath: instancePath + "/value_type",
          schemaPath: "#/properties/value_type/enum",
          keyword: "enum",
          params: { allowedValues: schema39.properties.value_type.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.canonical_unit !== undefined) {
      let data3 = data.canonical_unit;
      if (typeof data3 === "string") {
        if (!pattern4.test(data3)) {
          const err20 = {
            instancePath: instancePath + "/canonical_unit",
            schemaPath: "common.schema.json#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/canonical_unit",
          schemaPath: "common.schema.json#/$defs/stableId/type",
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
    if (data.accepted_units !== undefined) {
      let data4 = data.accepted_units;
      if (Array.isArray(data4)) {
        if (data4.length < 1) {
          const err22 = {
            instancePath: instancePath + "/accepted_units",
            schemaPath: "#/properties/accepted_units/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        const len0 = data4.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data5 = data4[i0];
          if (typeof data5 === "string") {
            if (!pattern4.test(data5)) {
              const err23 = {
                instancePath: instancePath + "/accepted_units/" + i0,
                schemaPath: "common.schema.json#/$defs/stableId/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err23];
              } else {
                vErrors.push(err23);
              }
              errors++;
            }
          } else {
            const err24 = {
              instancePath: instancePath + "/accepted_units/" + i0,
              schemaPath: "common.schema.json#/$defs/stableId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err24];
            } else {
              vErrors.push(err24);
            }
            errors++;
          }
        }
        let i1 = data4.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data4[i1], data4[j0])) {
                const err25 = {
                  instancePath: instancePath + "/accepted_units",
                  schemaPath: "#/properties/accepted_units/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err25];
                } else {
                  vErrors.push(err25);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err26 = {
          instancePath: instancePath + "/accepted_units",
          schemaPath: "#/properties/accepted_units/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.constraints !== undefined) {
      let data6 = data.constraints;
      if (data6 && typeof data6 == "object" && !Array.isArray(data6)) {
        if (Object.keys(data6).length < 1) {
          const err27 = {
            instancePath: instancePath + "/constraints",
            schemaPath: "#/properties/constraints/minProperties",
            keyword: "minProperties",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 properties",
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
        for (const key1 in data6) {
          if (!(key1 === "minimum" || key1 === "maximum" || key1 === "step" || key1 === "enum")) {
            const err28 = {
              instancePath: instancePath + "/constraints",
              schemaPath: "#/properties/constraints/additionalProperties",
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
        if (data6.minimum !== undefined) {
          let data7 = data6.minimum;
          if (typeof data7 === "string") {
            if (!pattern13.test(data7)) {
              const err29 = {
                instancePath: instancePath + "/constraints/minimum",
                schemaPath: "#/properties/constraints/properties/minimum/pattern",
                keyword: "pattern",
                params: { pattern: "^[0-9]+(?:\\.[0-9]+)?$" },
                message: 'must match pattern "' + "^[0-9]+(?:\\.[0-9]+)?$" + '"',
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
              instancePath: instancePath + "/constraints/minimum",
              schemaPath: "#/properties/constraints/properties/minimum/type",
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
        if (data6.maximum !== undefined) {
          let data8 = data6.maximum;
          if (typeof data8 === "string") {
            if (!pattern13.test(data8)) {
              const err31 = {
                instancePath: instancePath + "/constraints/maximum",
                schemaPath: "#/properties/constraints/properties/maximum/pattern",
                keyword: "pattern",
                params: { pattern: "^[0-9]+(?:\\.[0-9]+)?$" },
                message: 'must match pattern "' + "^[0-9]+(?:\\.[0-9]+)?$" + '"',
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
              instancePath: instancePath + "/constraints/maximum",
              schemaPath: "#/properties/constraints/properties/maximum/type",
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
        if (data6.step !== undefined) {
          let data9 = data6.step;
          if (typeof data9 === "string") {
            if (!pattern13.test(data9)) {
              const err33 = {
                instancePath: instancePath + "/constraints/step",
                schemaPath: "#/properties/constraints/properties/step/pattern",
                keyword: "pattern",
                params: { pattern: "^[0-9]+(?:\\.[0-9]+)?$" },
                message: 'must match pattern "' + "^[0-9]+(?:\\.[0-9]+)?$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err33];
              } else {
                vErrors.push(err33);
              }
              errors++;
            }
          } else {
            const err34 = {
              instancePath: instancePath + "/constraints/step",
              schemaPath: "#/properties/constraints/properties/step/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err34];
            } else {
              vErrors.push(err34);
            }
            errors++;
          }
        }
        if (data6.enum !== undefined) {
          let data10 = data6.enum;
          if (Array.isArray(data10)) {
            if (data10.length < 1) {
              const err35 = {
                instancePath: instancePath + "/constraints/enum",
                schemaPath: "#/properties/constraints/properties/enum/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors++;
            }
            const len1 = data10.length;
            for (let i2 = 0; i2 < len1; i2++) {
              let data11 = data10[i2];
              if (typeof data11 === "string") {
                if (!pattern4.test(data11)) {
                  const err36 = {
                    instancePath: instancePath + "/constraints/enum/" + i2,
                    schemaPath: "common.schema.json#/$defs/stableId/pattern",
                    keyword: "pattern",
                    params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                    message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
                  };
                  if (vErrors === null) {
                    vErrors = [err36];
                  } else {
                    vErrors.push(err36);
                  }
                  errors++;
                }
              } else {
                const err37 = {
                  instancePath: instancePath + "/constraints/enum/" + i2,
                  schemaPath: "common.schema.json#/$defs/stableId/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err37];
                } else {
                  vErrors.push(err37);
                }
                errors++;
              }
            }
            let i3 = data10.length;
            let j1;
            if (i3 > 1) {
              outer1: for (; i3--;) {
                for (j1 = i3; j1--;) {
                  if (func0(data10[i3], data10[j1])) {
                    const err38 = {
                      instancePath: instancePath + "/constraints/enum",
                      schemaPath: "#/properties/constraints/properties/enum/uniqueItems",
                      keyword: "uniqueItems",
                      params: { i: i3, j: j1 },
                      message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)",
                    };
                    if (vErrors === null) {
                      vErrors = [err38];
                    } else {
                      vErrors.push(err38);
                    }
                    errors++;
                    break outer1;
                  }
                }
              }
            }
          } else {
            const err39 = {
              instancePath: instancePath + "/constraints/enum",
              schemaPath: "#/properties/constraints/properties/enum/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err39];
            } else {
              vErrors.push(err39);
            }
            errors++;
          }
        }
      } else {
        const err40 = {
          instancePath: instancePath + "/constraints",
          schemaPath: "#/properties/constraints/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
    if (data.applicability !== undefined) {
      let data12 = data.applicability;
      if (data12 && typeof data12 == "object" && !Array.isArray(data12)) {
        if (data12.status === undefined) {
          const err41 = {
            instancePath: instancePath + "/applicability",
            schemaPath: "#/properties/applicability/required",
            keyword: "required",
            params: { missingProperty: "status" },
            message: "must have required property '" + "status" + "'",
          };
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
        if (data12.conditions === undefined) {
          const err42 = {
            instancePath: instancePath + "/applicability",
            schemaPath: "#/properties/applicability/required",
            keyword: "required",
            params: { missingProperty: "conditions" },
            message: "must have required property '" + "conditions" + "'",
          };
          if (vErrors === null) {
            vErrors = [err42];
          } else {
            vErrors.push(err42);
          }
          errors++;
        }
        for (const key2 in data12) {
          if (!(key2 === "status" || key2 === "conditions")) {
            const err43 = {
              instancePath: instancePath + "/applicability",
              schemaPath: "#/properties/applicability/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err43];
            } else {
              vErrors.push(err43);
            }
            errors++;
          }
        }
        if (data12.status !== undefined) {
          let data13 = data12.status;
          if (!(data13 === "available" || data13 === "conditional")) {
            const err44 = {
              instancePath: instancePath + "/applicability/status",
              schemaPath: "#/properties/applicability/properties/status/enum",
              keyword: "enum",
              params: { allowedValues: schema39.properties.applicability.properties.status.enum },
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
        if (data12.conditions !== undefined) {
          let data14 = data12.conditions;
          if (Array.isArray(data14)) {
            if (data14.length < 1) {
              const err45 = {
                instancePath: instancePath + "/applicability/conditions",
                schemaPath: "#/properties/applicability/properties/conditions/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              if (vErrors === null) {
                vErrors = [err45];
              } else {
                vErrors.push(err45);
              }
              errors++;
            }
            const len2 = data14.length;
            for (let i4 = 0; i4 < len2; i4++) {
              let data15 = data14[i4];
              if (typeof data15 === "string") {
                if (func5(data15) < 1) {
                  const err46 = {
                    instancePath: instancePath + "/applicability/conditions/" + i4,
                    schemaPath: "#/properties/applicability/properties/conditions/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err46];
                  } else {
                    vErrors.push(err46);
                  }
                  errors++;
                }
              } else {
                const err47 = {
                  instancePath: instancePath + "/applicability/conditions/" + i4,
                  schemaPath: "#/properties/applicability/properties/conditions/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err47];
                } else {
                  vErrors.push(err47);
                }
                errors++;
              }
            }
            let i5 = data14.length;
            let j2;
            if (i5 > 1) {
              const indices0 = {};
              for (; i5--;) {
                let item0 = data14[i5];
                if (typeof item0 !== "string") {
                  continue;
                }
                if (typeof indices0[item0] == "number") {
                  j2 = indices0[item0];
                  const err48 = {
                    instancePath: instancePath + "/applicability/conditions",
                    schemaPath: "#/properties/applicability/properties/conditions/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i5, j: j2 },
                    message: "must NOT have duplicate items (items ## " + j2 + " and " + i5 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err48];
                  } else {
                    vErrors.push(err48);
                  }
                  errors++;
                  break;
                }
                indices0[item0] = i5;
              }
            }
          } else {
            const err49 = {
              instancePath: instancePath + "/applicability/conditions",
              schemaPath: "#/properties/applicability/properties/conditions/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err49];
            } else {
              vErrors.push(err49);
            }
            errors++;
          }
        }
      } else {
        const err50 = {
          instancePath: instancePath + "/applicability",
          schemaPath: "#/properties/applicability/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err50];
        } else {
          vErrors.push(err50);
        }
        errors++;
      }
    }
    if (data.request_identity !== undefined) {
      if ("tilesim.bridge.create_run_request.v1" !== data.request_identity) {
        const err51 = {
          instancePath: instancePath + "/request_identity",
          schemaPath: "#/properties/request_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.create_run_request.v1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err51];
        } else {
          vErrors.push(err51);
        }
        errors++;
      }
    }
    if (data.request_json_pointer !== undefined) {
      let data17 = data.request_json_pointer;
      if (typeof data17 === "string") {
        if (!pattern17.test(data17)) {
          const err52 = {
            instancePath: instancePath + "/request_json_pointer",
            schemaPath: "#/properties/request_json_pointer/pattern",
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
          instancePath: instancePath + "/request_json_pointer",
          schemaPath: "#/properties/request_json_pointer/type",
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
    if (data.lowering_stage !== undefined) {
      let data18 = data.lowering_stage;
      if (typeof data18 === "string") {
        if (func5(data18) < 1) {
          const err54 = {
            instancePath: instancePath + "/lowering_stage",
            schemaPath: "#/properties/lowering_stage/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err54];
          } else {
            vErrors.push(err54);
          }
          errors++;
        }
      } else {
        const err55 = {
          instancePath: instancePath + "/lowering_stage",
          schemaPath: "#/properties/lowering_stage/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err55];
        } else {
          vErrors.push(err55);
        }
        errors++;
      }
    }
    if (data.execution_evidence !== undefined) {
      let data19 = data.execution_evidence;
      if (Array.isArray(data19)) {
        if (data19.length < 1) {
          const err56 = {
            instancePath: instancePath + "/execution_evidence",
            schemaPath: "#/properties/execution_evidence/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err56];
          } else {
            vErrors.push(err56);
          }
          errors++;
        }
        const len3 = data19.length;
        for (let i6 = 0; i6 < len3; i6++) {
          if (
            !validate23(data19[i6], {
              instancePath: instancePath + "/execution_evidence/" + i6,
              parentData: data19,
              parentDataProperty: i6,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err57 = {
          instancePath: instancePath + "/execution_evidence",
          schemaPath: "#/properties/execution_evidence/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err57];
        } else {
          vErrors.push(err57);
        }
        errors++;
      }
    }
    if (data.capability_state !== undefined) {
      let data21 = data.capability_state;
      if (data21 && typeof data21 == "object" && !Array.isArray(data21)) {
        if (data21.described === undefined) {
          const err58 = {
            instancePath: instancePath + "/capability_state",
            schemaPath: "#/properties/capability_state/required",
            keyword: "required",
            params: { missingProperty: "described" },
            message: "must have required property '" + "described" + "'",
          };
          if (vErrors === null) {
            vErrors = [err58];
          } else {
            vErrors.push(err58);
          }
          errors++;
        }
        if (data21.accepted === undefined) {
          const err59 = {
            instancePath: instancePath + "/capability_state",
            schemaPath: "#/properties/capability_state/required",
            keyword: "required",
            params: { missingProperty: "accepted" },
            message: "must have required property '" + "accepted" + "'",
          };
          if (vErrors === null) {
            vErrors = [err59];
          } else {
            vErrors.push(err59);
          }
          errors++;
        }
        if (data21.validated === undefined) {
          const err60 = {
            instancePath: instancePath + "/capability_state",
            schemaPath: "#/properties/capability_state/required",
            keyword: "required",
            params: { missingProperty: "validated" },
            message: "must have required property '" + "validated" + "'",
          };
          if (vErrors === null) {
            vErrors = [err60];
          } else {
            vErrors.push(err60);
          }
          errors++;
        }
        if (data21.lowered === undefined) {
          const err61 = {
            instancePath: instancePath + "/capability_state",
            schemaPath: "#/properties/capability_state/required",
            keyword: "required",
            params: { missingProperty: "lowered" },
            message: "must have required property '" + "lowered" + "'",
          };
          if (vErrors === null) {
            vErrors = [err61];
          } else {
            vErrors.push(err61);
          }
          errors++;
        }
        if (data21.executed === undefined) {
          const err62 = {
            instancePath: instancePath + "/capability_state",
            schemaPath: "#/properties/capability_state/required",
            keyword: "required",
            params: { missingProperty: "executed" },
            message: "must have required property '" + "executed" + "'",
          };
          if (vErrors === null) {
            vErrors = [err62];
          } else {
            vErrors.push(err62);
          }
          errors++;
        }
        if (data21.observable === undefined) {
          const err63 = {
            instancePath: instancePath + "/capability_state",
            schemaPath: "#/properties/capability_state/required",
            keyword: "required",
            params: { missingProperty: "observable" },
            message: "must have required property '" + "observable" + "'",
          };
          if (vErrors === null) {
            vErrors = [err63];
          } else {
            vErrors.push(err63);
          }
          errors++;
        }
        if (data21.calibrated === undefined) {
          const err64 = {
            instancePath: instancePath + "/capability_state",
            schemaPath: "#/properties/capability_state/required",
            keyword: "required",
            params: { missingProperty: "calibrated" },
            message: "must have required property '" + "calibrated" + "'",
          };
          if (vErrors === null) {
            vErrors = [err64];
          } else {
            vErrors.push(err64);
          }
          errors++;
        }
        if (data21.held_out_validated === undefined) {
          const err65 = {
            instancePath: instancePath + "/capability_state",
            schemaPath: "#/properties/capability_state/required",
            keyword: "required",
            params: { missingProperty: "held_out_validated" },
            message: "must have required property '" + "held_out_validated" + "'",
          };
          if (vErrors === null) {
            vErrors = [err65];
          } else {
            vErrors.push(err65);
          }
          errors++;
        }
        if (data21.agent_exposed === undefined) {
          const err66 = {
            instancePath: instancePath + "/capability_state",
            schemaPath: "#/properties/capability_state/required",
            keyword: "required",
            params: { missingProperty: "agent_exposed" },
            message: "must have required property '" + "agent_exposed" + "'",
          };
          if (vErrors === null) {
            vErrors = [err66];
          } else {
            vErrors.push(err66);
          }
          errors++;
        }
        for (const key3 in data21) {
          if (!func1.call(schema39.properties.capability_state.properties, key3)) {
            const err67 = {
              instancePath: instancePath + "/capability_state",
              schemaPath: "#/properties/capability_state/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key3 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err67];
            } else {
              vErrors.push(err67);
            }
            errors++;
          }
        }
        if (data21.described !== undefined) {
          if (
            !validate25(data21.described, {
              instancePath: instancePath + "/capability_state/described",
              parentData: data21,
              parentDataProperty: "described",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
            errors = vErrors.length;
          }
        }
        if (data21.accepted !== undefined) {
          if (
            !validate25(data21.accepted, {
              instancePath: instancePath + "/capability_state/accepted",
              parentData: data21,
              parentDataProperty: "accepted",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
            errors = vErrors.length;
          }
        }
        if (data21.validated !== undefined) {
          if (
            !validate25(data21.validated, {
              instancePath: instancePath + "/capability_state/validated",
              parentData: data21,
              parentDataProperty: "validated",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
            errors = vErrors.length;
          }
        }
        if (data21.lowered !== undefined) {
          if (
            !validate25(data21.lowered, {
              instancePath: instancePath + "/capability_state/lowered",
              parentData: data21,
              parentDataProperty: "lowered",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
            errors = vErrors.length;
          }
        }
        if (data21.executed !== undefined) {
          if (
            !validate25(data21.executed, {
              instancePath: instancePath + "/capability_state/executed",
              parentData: data21,
              parentDataProperty: "executed",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
            errors = vErrors.length;
          }
        }
        if (data21.observable !== undefined) {
          if (
            !validate25(data21.observable, {
              instancePath: instancePath + "/capability_state/observable",
              parentData: data21,
              parentDataProperty: "observable",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
            errors = vErrors.length;
          }
        }
        if (data21.calibrated !== undefined) {
          if (
            !validate25(data21.calibrated, {
              instancePath: instancePath + "/capability_state/calibrated",
              parentData: data21,
              parentDataProperty: "calibrated",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
            errors = vErrors.length;
          }
        }
        if (data21.held_out_validated !== undefined) {
          if (
            !validate25(data21.held_out_validated, {
              instancePath: instancePath + "/capability_state/held_out_validated",
              parentData: data21,
              parentDataProperty: "held_out_validated",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
            errors = vErrors.length;
          }
        }
        if (data21.agent_exposed !== undefined) {
          if (
            !validate25(data21.agent_exposed, {
              instancePath: instancePath + "/capability_state/agent_exposed",
              parentData: data21,
              parentDataProperty: "agent_exposed",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate25.errors : vErrors.concat(validate25.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err68 = {
          instancePath: instancePath + "/capability_state",
          schemaPath: "#/properties/capability_state/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err68];
        } else {
          vErrors.push(err68);
        }
        errors++;
      }
    }
    if (data.reason_codes !== undefined) {
      let data31 = data.reason_codes;
      if (Array.isArray(data31)) {
        if (data31.length < 1) {
          const err69 = {
            instancePath: instancePath + "/reason_codes",
            schemaPath: "#/properties/reason_codes/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err69];
          } else {
            vErrors.push(err69);
          }
          errors++;
        }
        const len4 = data31.length;
        for (let i7 = 0; i7 < len4; i7++) {
          let data32 = data31[i7];
          if (!(
            data32 === "execution_closure_proven" ||
            data32 === "gap_kv_001_logical_admission_only" ||
            data32 === "profile_missing" ||
            data32 === "minimal_engine_profiles_not_catalog_published" ||
            data32 === "create_run_engine_selection_not_exposed" ||
            data32 === "calibration_missing" ||
            data32 === "held_out_validation_missing" ||
            data32 === "not_exposed_to_agent" ||
            data32 === "resolved_scale_out_analytical"
          )) {
            const err70 = {
              instancePath: instancePath + "/reason_codes/" + i7,
              schemaPath: "common.schema.json#/$defs/reasonCode/enum",
              keyword: "enum",
              params: { allowedValues: schema48.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err70];
            } else {
              vErrors.push(err70);
            }
            errors++;
          }
        }
        let i8 = data31.length;
        let j3;
        if (i8 > 1) {
          outer2: for (; i8--;) {
            for (j3 = i8; j3--;) {
              if (func0(data31[i8], data31[j3])) {
                const err71 = {
                  instancePath: instancePath + "/reason_codes",
                  schemaPath: "#/properties/reason_codes/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i8, j: j3 },
                  message: "must NOT have duplicate items (items ## " + j3 + " and " + i8 + " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err71];
                } else {
                  vErrors.push(err71);
                }
                errors++;
                break outer2;
              }
            }
          }
        }
      } else {
        const err72 = {
          instancePath: instancePath + "/reason_codes",
          schemaPath: "#/properties/reason_codes/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err72];
        } else {
          vErrors.push(err72);
        }
        errors++;
      }
    }
    if (data.claim_scope_ceiling !== undefined) {
      let data33 = data.claim_scope_ceiling;
      if (Array.isArray(data33)) {
        if (data33.length > 2) {
          const err73 = {
            instancePath: instancePath + "/claim_scope_ceiling",
            schemaPath: "#/properties/claim_scope_ceiling/maxItems",
            keyword: "maxItems",
            params: { limit: 2 },
            message: "must NOT have more than 2 items",
          };
          if (vErrors === null) {
            vErrors = [err73];
          } else {
            vErrors.push(err73);
          }
          errors++;
        }
        if (data33.length < 2) {
          const err74 = {
            instancePath: instancePath + "/claim_scope_ceiling",
            schemaPath: "#/properties/claim_scope_ceiling/minItems",
            keyword: "minItems",
            params: { limit: 2 },
            message: "must NOT have fewer than 2 items",
          };
          if (vErrors === null) {
            vErrors = [err74];
          } else {
            vErrors.push(err74);
          }
          errors++;
        }
        const len5 = data33.length;
        if (len5 > 0) {
          if ("exploration" !== data33[0]) {
            const err75 = {
              instancePath: instancePath + "/claim_scope_ceiling/0",
              schemaPath: "#/properties/claim_scope_ceiling/prefixItems/0/const",
              keyword: "const",
              params: { allowedValue: "exploration" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err75];
            } else {
              vErrors.push(err75);
            }
            errors++;
          }
        }
        if (len5 > 1) {
          if ("synthetic_consistency" !== data33[1]) {
            const err76 = {
              instancePath: instancePath + "/claim_scope_ceiling/1",
              schemaPath: "#/properties/claim_scope_ceiling/prefixItems/1/const",
              keyword: "const",
              params: { allowedValue: "synthetic_consistency" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err76];
            } else {
              vErrors.push(err76);
            }
            errors++;
          }
        }
      } else {
        const err77 = {
          instancePath: instancePath + "/claim_scope_ceiling",
          schemaPath: "#/properties/claim_scope_ceiling/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err77];
        } else {
          vErrors.push(err77);
        }
        errors++;
      }
    }
    if (data.resolved_fidelity !== undefined) {
      let data36 = data.resolved_fidelity;
      if (!(data36 === "Analytical" || data36 === "DES" || data36 === "mixed")) {
        const err78 = {
          instancePath: instancePath + "/resolved_fidelity",
          schemaPath: "#/properties/resolved_fidelity/enum",
          keyword: "enum",
          params: { allowedValues: schema39.properties.resolved_fidelity.enum },
          message: "must be equal to one of the allowed values",
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
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err79];
    } else {
      vErrors.push(err79);
    }
    errors++;
  }
  validate22.errors = vErrors;
  return errors === 0;
}
validate22.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const schema50 = {
  type: "object",
  additionalProperties: false,
  required: [
    "family",
    "schema_identity",
    "schema_revision",
    "schema_digest",
    "schema_status",
    "actual_profile_count",
    "data_status",
    "runtime_availability",
    "reason_codes",
    "calibration_status",
    "held_out_validation_status",
  ],
  properties: {
    family: { enum: ["model", "engine", "device", "topology", "workload"] },
    schema_identity: { $ref: "#/$defs/stableId" },
    schema_revision: { $ref: "#/$defs/sha256" },
    schema_digest: { $ref: "#/$defs/sha256" },
    schema_status: { const: "published" },
    actual_profile_count: { const: 0 },
    data_status: { enum: ["profile_missing", "conditional"] },
    runtime_availability: { const: "unavailable" },
    reason_codes: {
      type: "array",
      minItems: 1,
      contains: { const: "profile_missing" },
      items: { $ref: "#/$defs/reasonCode" },
      uniqueItems: true,
    },
    calibration_status: { const: "calibration_missing" },
    held_out_validation_status: { const: "held_out_validation_missing" },
  },
};
function validate36(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate36.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.family === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "family" },
        message: "must have required property '" + "family" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.schema_identity === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_identity" },
        message: "must have required property '" + "schema_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.schema_revision === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_revision" },
        message: "must have required property '" + "schema_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.schema_digest === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_digest" },
        message: "must have required property '" + "schema_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.schema_status === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_status" },
        message: "must have required property '" + "schema_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.actual_profile_count === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "actual_profile_count" },
        message: "must have required property '" + "actual_profile_count" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.data_status === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "data_status" },
        message: "must have required property '" + "data_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.runtime_availability === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "runtime_availability" },
        message: "must have required property '" + "runtime_availability" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.reason_codes === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "reason_codes" },
        message: "must have required property '" + "reason_codes" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.calibration_status === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calibration_status" },
        message: "must have required property '" + "calibration_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.held_out_validation_status === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "held_out_validation_status" },
        message: "must have required property '" + "held_out_validation_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema50.properties, key0)) {
        const err11 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.family !== undefined) {
      let data0 = data.family;
      if (!(
        data0 === "model" ||
        data0 === "engine" ||
        data0 === "device" ||
        data0 === "topology" ||
        data0 === "workload"
      )) {
        const err12 = {
          instancePath: instancePath + "/family",
          schemaPath: "#/properties/family/enum",
          keyword: "enum",
          params: { allowedValues: schema50.properties.family.enum },
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
    if (data.schema_identity !== undefined) {
      let data1 = data.schema_identity;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err13 = {
            instancePath: instancePath + "/schema_identity",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/$defs/stableId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.schema_revision !== undefined) {
      let data2 = data.schema_revision;
      if (typeof data2 === "string") {
        if (!pattern5.test(data2)) {
          const err15 = {
            instancePath: instancePath + "/schema_revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/schema_revision",
          schemaPath: "#/$defs/sha256/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.schema_digest !== undefined) {
      let data3 = data.schema_digest;
      if (typeof data3 === "string") {
        if (!pattern5.test(data3)) {
          const err17 = {
            instancePath: instancePath + "/schema_digest",
            schemaPath: "#/$defs/sha256/pattern",
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
          instancePath: instancePath + "/schema_digest",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.schema_status !== undefined) {
      if ("published" !== data.schema_status) {
        const err19 = {
          instancePath: instancePath + "/schema_status",
          schemaPath: "#/properties/schema_status/const",
          keyword: "const",
          params: { allowedValue: "published" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.actual_profile_count !== undefined) {
      if (0 !== data.actual_profile_count) {
        const err20 = {
          instancePath: instancePath + "/actual_profile_count",
          schemaPath: "#/properties/actual_profile_count/const",
          keyword: "const",
          params: { allowedValue: 0 },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.data_status !== undefined) {
      let data6 = data.data_status;
      if (!(data6 === "profile_missing" || data6 === "conditional")) {
        const err21 = {
          instancePath: instancePath + "/data_status",
          schemaPath: "#/properties/data_status/enum",
          keyword: "enum",
          params: { allowedValues: schema50.properties.data_status.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.runtime_availability !== undefined) {
      if ("unavailable" !== data.runtime_availability) {
        const err22 = {
          instancePath: instancePath + "/runtime_availability",
          schemaPath: "#/properties/runtime_availability/const",
          keyword: "const",
          params: { allowedValue: "unavailable" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.reason_codes !== undefined) {
      let data8 = data.reason_codes;
      if (Array.isArray(data8)) {
        if (data8.length < 1) {
          const err23 = {
            instancePath: instancePath + "/reason_codes",
            schemaPath: "#/properties/reason_codes/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
        const len0 = data8.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data9 = data8[i0];
          if (!(
            data9 === "execution_closure_proven" ||
            data9 === "gap_kv_001_logical_admission_only" ||
            data9 === "profile_missing" ||
            data9 === "minimal_engine_profiles_not_catalog_published" ||
            data9 === "create_run_engine_selection_not_exposed" ||
            data9 === "calibration_missing" ||
            data9 === "held_out_validation_missing" ||
            data9 === "not_exposed_to_agent" ||
            data9 === "resolved_scale_out_analytical"
          )) {
            const err24 = {
              instancePath: instancePath + "/reason_codes/" + i0,
              schemaPath: "#/$defs/reasonCode/enum",
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
        const _errs20 = errors;
        const len1 = data8.length;
        for (let i1 = 0; i1 < len1; i1++) {
          const _errs21 = errors;
          if ("profile_missing" !== data8[i1]) {
            const err25 = {
              instancePath: instancePath + "/reason_codes/" + i1,
              schemaPath: "#/properties/reason_codes/contains/const",
              keyword: "const",
              params: { allowedValue: "profile_missing" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
          var valid7 = _errs21 === errors;
          if (valid7) {
            break;
          }
        }
        if (!valid7) {
          const err26 = {
            instancePath: instancePath + "/reason_codes",
            schemaPath: "#/properties/reason_codes/contains",
            keyword: "contains",
            params: { minContains: 1 },
            message: "must contain at least 1 valid item(s)",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        } else {
          errors = _errs20;
          if (vErrors !== null) {
            if (_errs20) {
              vErrors.length = _errs20;
            } else {
              vErrors = null;
            }
          }
        }
        let i2 = data8.length;
        let j0;
        if (i2 > 1) {
          outer0: for (; i2--;) {
            for (j0 = i2; j0--;) {
              if (func0(data8[i2], data8[j0])) {
                const err27 = {
                  instancePath: instancePath + "/reason_codes",
                  schemaPath: "#/properties/reason_codes/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i2, j: j0 },
                  message: "must NOT have duplicate items (items ## " + j0 + " and " + i2 + " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err27];
                } else {
                  vErrors.push(err27);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err28 = {
          instancePath: instancePath + "/reason_codes",
          schemaPath: "#/properties/reason_codes/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.calibration_status !== undefined) {
      if ("calibration_missing" !== data.calibration_status) {
        const err29 = {
          instancePath: instancePath + "/calibration_status",
          schemaPath: "#/properties/calibration_status/const",
          keyword: "const",
          params: { allowedValue: "calibration_missing" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.held_out_validation_status !== undefined) {
      if ("held_out_validation_missing" !== data.held_out_validation_status) {
        const err30 = {
          instancePath: instancePath + "/held_out_validation_status",
          schemaPath: "#/properties/held_out_validation_status/const",
          keyword: "const",
          params: { allowedValue: "held_out_validation_missing" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
    }
  } else {
    const err31 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err31];
    } else {
      vErrors.push(err31);
    }
    errors++;
  }
  validate36.errors = vErrors;
  return errors === 0;
}
validate36.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate20(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-capability/v1/capability-catalog.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_identity" },
        message: "must have required property '" + "schema_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.publication_status === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "publication_status" },
        message: "must have required property '" + "publication_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.catalog_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "catalog_id" },
        message: "must have required property '" + "catalog_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.catalog_revision === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "catalog_revision" },
        message: "must have required property '" + "catalog_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.catalog_digest === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "catalog_digest" },
        message: "must have required property '" + "catalog_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.contract_package_revision === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "contract_package_revision" },
        message: "must have required property '" + "contract_package_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.parameter_descriptor_schema_identity === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "parameter_descriptor_schema_identity" },
        message: "must have required property '" + "parameter_descriptor_schema_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.parameter_descriptor_schema_revision === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "parameter_descriptor_schema_revision" },
        message: "must have required property '" + "parameter_descriptor_schema_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.parameter_descriptor_schema_digest === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "parameter_descriptor_schema_digest" },
        message: "must have required property '" + "parameter_descriptor_schema_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.parameter_descriptors === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "parameter_descriptors" },
        message: "must have required property '" + "parameter_descriptors" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.profile_families === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_families" },
        message: "must have required property '" + "profile_families" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.profile_records === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_records" },
        message: "must have required property '" + "profile_records" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.agent_exposed_field_ids === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "agent_exposed_field_ids" },
        message: "must have required property '" + "agent_exposed_field_ids" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.not_exposed_capabilities === undefined) {
      const err13 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "not_exposed_capabilities" },
        message: "must have required property '" + "not_exposed_capabilities" + "'",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.claim_scope_ceiling === undefined) {
      const err14 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "claim_scope_ceiling" },
        message: "must have required property '" + "claim_scope_ceiling" + "'",
      };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema31.properties, key0)) {
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
    if (data.schema_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_capability_catalog.v1" !== data.schema_identity) {
        const err16 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_capability_catalog.v1" },
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
    if (data.publication_status !== undefined) {
      if ("published" !== data.publication_status) {
        const err17 = {
          instancePath: instancePath + "/publication_status",
          schemaPath: "#/properties/publication_status/const",
          keyword: "const",
          params: { allowedValue: "published" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.catalog_id !== undefined) {
      let data2 = data.catalog_id;
      if (typeof data2 === "string") {
        if (!pattern4.test(data2)) {
          const err18 = {
            instancePath: instancePath + "/catalog_id",
            schemaPath: "common.schema.json#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/catalog_id",
          schemaPath: "common.schema.json#/$defs/stableId/type",
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
    if (data.catalog_revision !== undefined) {
      let data3 = data.catalog_revision;
      if (typeof data3 === "string") {
        if (!pattern5.test(data3)) {
          const err20 = {
            instancePath: instancePath + "/catalog_revision",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/catalog_revision",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.catalog_digest !== undefined) {
      let data4 = data.catalog_digest;
      if (typeof data4 === "string") {
        if (!pattern5.test(data4)) {
          const err22 = {
            instancePath: instancePath + "/catalog_digest",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/catalog_digest",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.contract_package_revision !== undefined) {
      let data5 = data.contract_package_revision;
      if (typeof data5 === "string") {
        if (!pattern5.test(data5)) {
          const err24 = {
            instancePath: instancePath + "/contract_package_revision",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/contract_package_revision",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.parameter_descriptor_schema_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_parameter_descriptor.v1" !== data.parameter_descriptor_schema_identity) {
        const err26 = {
          instancePath: instancePath + "/parameter_descriptor_schema_identity",
          schemaPath: "#/properties/parameter_descriptor_schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_parameter_descriptor.v1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.parameter_descriptor_schema_revision !== undefined) {
      let data7 = data.parameter_descriptor_schema_revision;
      if (typeof data7 === "string") {
        if (!pattern5.test(data7)) {
          const err27 = {
            instancePath: instancePath + "/parameter_descriptor_schema_revision",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/parameter_descriptor_schema_revision",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.parameter_descriptor_schema_digest !== undefined) {
      let data8 = data.parameter_descriptor_schema_digest;
      if (typeof data8 === "string") {
        if (!pattern5.test(data8)) {
          const err29 = {
            instancePath: instancePath + "/parameter_descriptor_schema_digest",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/parameter_descriptor_schema_digest",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.parameter_descriptors !== undefined) {
      let data9 = data.parameter_descriptors;
      if (Array.isArray(data9)) {
        if (data9.length > 8) {
          const err31 = {
            instancePath: instancePath + "/parameter_descriptors",
            schemaPath: "#/properties/parameter_descriptors/maxItems",
            keyword: "maxItems",
            params: { limit: 8 },
            message: "must NOT have more than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        if (data9.length < 8) {
          const err32 = {
            instancePath: instancePath + "/parameter_descriptors",
            schemaPath: "#/properties/parameter_descriptors/minItems",
            keyword: "minItems",
            params: { limit: 8 },
            message: "must NOT have fewer than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
        const len0 = data9.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate22(data9[i0], {
              instancePath: instancePath + "/parameter_descriptors/" + i0,
              parentData: data9,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err33 = {
          instancePath: instancePath + "/parameter_descriptors",
          schemaPath: "#/properties/parameter_descriptors/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err33];
        } else {
          vErrors.push(err33);
        }
        errors++;
      }
    }
    if (data.profile_families !== undefined) {
      let data11 = data.profile_families;
      if (Array.isArray(data11)) {
        if (data11.length > 5) {
          const err34 = {
            instancePath: instancePath + "/profile_families",
            schemaPath: "#/properties/profile_families/maxItems",
            keyword: "maxItems",
            params: { limit: 5 },
            message: "must NOT have more than 5 items",
          };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
        if (data11.length < 5) {
          const err35 = {
            instancePath: instancePath + "/profile_families",
            schemaPath: "#/properties/profile_families/minItems",
            keyword: "minItems",
            params: { limit: 5 },
            message: "must NOT have fewer than 5 items",
          };
          if (vErrors === null) {
            vErrors = [err35];
          } else {
            vErrors.push(err35);
          }
          errors++;
        }
        const len1 = data11.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (
            !validate36(data11[i1], {
              instancePath: instancePath + "/profile_families/" + i1,
              parentData: data11,
              parentDataProperty: i1,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate36.errors : vErrors.concat(validate36.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err36 = {
          instancePath: instancePath + "/profile_families",
          schemaPath: "#/properties/profile_families/type",
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
    if (data.profile_records !== undefined) {
      let data13 = data.profile_records;
      if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
        if (data13.model === undefined) {
          const err37 = {
            instancePath: instancePath + "/profile_records",
            schemaPath: "#/properties/profile_records/required",
            keyword: "required",
            params: { missingProperty: "model" },
            message: "must have required property '" + "model" + "'",
          };
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
        if (data13.engine === undefined) {
          const err38 = {
            instancePath: instancePath + "/profile_records",
            schemaPath: "#/properties/profile_records/required",
            keyword: "required",
            params: { missingProperty: "engine" },
            message: "must have required property '" + "engine" + "'",
          };
          if (vErrors === null) {
            vErrors = [err38];
          } else {
            vErrors.push(err38);
          }
          errors++;
        }
        if (data13.device === undefined) {
          const err39 = {
            instancePath: instancePath + "/profile_records",
            schemaPath: "#/properties/profile_records/required",
            keyword: "required",
            params: { missingProperty: "device" },
            message: "must have required property '" + "device" + "'",
          };
          if (vErrors === null) {
            vErrors = [err39];
          } else {
            vErrors.push(err39);
          }
          errors++;
        }
        if (data13.topology === undefined) {
          const err40 = {
            instancePath: instancePath + "/profile_records",
            schemaPath: "#/properties/profile_records/required",
            keyword: "required",
            params: { missingProperty: "topology" },
            message: "must have required property '" + "topology" + "'",
          };
          if (vErrors === null) {
            vErrors = [err40];
          } else {
            vErrors.push(err40);
          }
          errors++;
        }
        if (data13.workload === undefined) {
          const err41 = {
            instancePath: instancePath + "/profile_records",
            schemaPath: "#/properties/profile_records/required",
            keyword: "required",
            params: { missingProperty: "workload" },
            message: "must have required property '" + "workload" + "'",
          };
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
        for (const key1 in data13) {
          if (!(
            key1 === "model" ||
            key1 === "engine" ||
            key1 === "device" ||
            key1 === "topology" ||
            key1 === "workload"
          )) {
            const err42 = {
              instancePath: instancePath + "/profile_records",
              schemaPath: "#/properties/profile_records/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
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
        if (data13.model !== undefined) {
          let data14 = data13.model;
          if (Array.isArray(data14)) {
            if (data14.length > 0) {
              const err43 = {
                instancePath: instancePath + "/profile_records/model",
                schemaPath: "#/properties/profile_records/properties/model/maxItems",
                keyword: "maxItems",
                params: { limit: 0 },
                message: "must NOT have more than 0 items",
              };
              if (vErrors === null) {
                vErrors = [err43];
              } else {
                vErrors.push(err43);
              }
              errors++;
            }
          } else {
            const err44 = {
              instancePath: instancePath + "/profile_records/model",
              schemaPath: "#/properties/profile_records/properties/model/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err44];
            } else {
              vErrors.push(err44);
            }
            errors++;
          }
        }
        if (data13.engine !== undefined) {
          let data15 = data13.engine;
          if (Array.isArray(data15)) {
            if (data15.length > 0) {
              const err45 = {
                instancePath: instancePath + "/profile_records/engine",
                schemaPath: "#/properties/profile_records/properties/engine/maxItems",
                keyword: "maxItems",
                params: { limit: 0 },
                message: "must NOT have more than 0 items",
              };
              if (vErrors === null) {
                vErrors = [err45];
              } else {
                vErrors.push(err45);
              }
              errors++;
            }
          } else {
            const err46 = {
              instancePath: instancePath + "/profile_records/engine",
              schemaPath: "#/properties/profile_records/properties/engine/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err46];
            } else {
              vErrors.push(err46);
            }
            errors++;
          }
        }
        if (data13.device !== undefined) {
          let data16 = data13.device;
          if (Array.isArray(data16)) {
            if (data16.length > 0) {
              const err47 = {
                instancePath: instancePath + "/profile_records/device",
                schemaPath: "#/properties/profile_records/properties/device/maxItems",
                keyword: "maxItems",
                params: { limit: 0 },
                message: "must NOT have more than 0 items",
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
              instancePath: instancePath + "/profile_records/device",
              schemaPath: "#/properties/profile_records/properties/device/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err48];
            } else {
              vErrors.push(err48);
            }
            errors++;
          }
        }
        if (data13.topology !== undefined) {
          let data17 = data13.topology;
          if (Array.isArray(data17)) {
            if (data17.length > 0) {
              const err49 = {
                instancePath: instancePath + "/profile_records/topology",
                schemaPath: "#/properties/profile_records/properties/topology/maxItems",
                keyword: "maxItems",
                params: { limit: 0 },
                message: "must NOT have more than 0 items",
              };
              if (vErrors === null) {
                vErrors = [err49];
              } else {
                vErrors.push(err49);
              }
              errors++;
            }
          } else {
            const err50 = {
              instancePath: instancePath + "/profile_records/topology",
              schemaPath: "#/properties/profile_records/properties/topology/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err50];
            } else {
              vErrors.push(err50);
            }
            errors++;
          }
        }
        if (data13.workload !== undefined) {
          let data18 = data13.workload;
          if (Array.isArray(data18)) {
            if (data18.length > 0) {
              const err51 = {
                instancePath: instancePath + "/profile_records/workload",
                schemaPath: "#/properties/profile_records/properties/workload/maxItems",
                keyword: "maxItems",
                params: { limit: 0 },
                message: "must NOT have more than 0 items",
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
              instancePath: instancePath + "/profile_records/workload",
              schemaPath: "#/properties/profile_records/properties/workload/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err52];
            } else {
              vErrors.push(err52);
            }
            errors++;
          }
        }
      } else {
        const err53 = {
          instancePath: instancePath + "/profile_records",
          schemaPath: "#/properties/profile_records/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err53];
        } else {
          vErrors.push(err53);
        }
        errors++;
      }
    }
    if (data.agent_exposed_field_ids !== undefined) {
      let data19 = data.agent_exposed_field_ids;
      if (Array.isArray(data19)) {
        if (data19.length > 8) {
          const err54 = {
            instancePath: instancePath + "/agent_exposed_field_ids",
            schemaPath: "#/properties/agent_exposed_field_ids/maxItems",
            keyword: "maxItems",
            params: { limit: 8 },
            message: "must NOT have more than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err54];
          } else {
            vErrors.push(err54);
          }
          errors++;
        }
        if (data19.length < 8) {
          const err55 = {
            instancePath: instancePath + "/agent_exposed_field_ids",
            schemaPath: "#/properties/agent_exposed_field_ids/minItems",
            keyword: "minItems",
            params: { limit: 8 },
            message: "must NOT have fewer than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err55];
          } else {
            vErrors.push(err55);
          }
          errors++;
        }
        const len2 = data19.length;
        for (let i2 = 0; i2 < len2; i2++) {
          let data20 = data19[i2];
          if (typeof data20 === "string") {
            if (!pattern4.test(data20)) {
              const err56 = {
                instancePath: instancePath + "/agent_exposed_field_ids/" + i2,
                schemaPath: "common.schema.json#/$defs/stableId/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
              instancePath: instancePath + "/agent_exposed_field_ids/" + i2,
              schemaPath: "common.schema.json#/$defs/stableId/type",
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
        let i3 = data19.length;
        let j0;
        if (i3 > 1) {
          outer0: for (; i3--;) {
            for (j0 = i3; j0--;) {
              if (func0(data19[i3], data19[j0])) {
                const err58 = {
                  instancePath: instancePath + "/agent_exposed_field_ids",
                  schemaPath: "#/properties/agent_exposed_field_ids/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i3, j: j0 },
                  message: "must NOT have duplicate items (items ## " + j0 + " and " + i3 + " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err58];
                } else {
                  vErrors.push(err58);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err59 = {
          instancePath: instancePath + "/agent_exposed_field_ids",
          schemaPath: "#/properties/agent_exposed_field_ids/type",
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
    if (data.not_exposed_capabilities !== undefined) {
      let data21 = data.not_exposed_capabilities;
      if (Array.isArray(data21)) {
        if (data21.length > 9) {
          const err60 = {
            instancePath: instancePath + "/not_exposed_capabilities",
            schemaPath: "#/properties/not_exposed_capabilities/maxItems",
            keyword: "maxItems",
            params: { limit: 9 },
            message: "must NOT have more than 9 items",
          };
          if (vErrors === null) {
            vErrors = [err60];
          } else {
            vErrors.push(err60);
          }
          errors++;
        }
        if (data21.length < 9) {
          const err61 = {
            instancePath: instancePath + "/not_exposed_capabilities",
            schemaPath: "#/properties/not_exposed_capabilities/minItems",
            keyword: "minItems",
            params: { limit: 9 },
            message: "must NOT have fewer than 9 items",
          };
          if (vErrors === null) {
            vErrors = [err61];
          } else {
            vErrors.push(err61);
          }
          errors++;
        }
        const len3 = data21.length;
        for (let i4 = 0; i4 < len3; i4++) {
          let data22 = data21[i4];
          if (data22 && typeof data22 == "object" && !Array.isArray(data22)) {
            if (data22.capability_id === undefined) {
              const err62 = {
                instancePath: instancePath + "/not_exposed_capabilities/" + i4,
                schemaPath: "common.schema.json#/$defs/notExposedCapability/required",
                keyword: "required",
                params: { missingProperty: "capability_id" },
                message: "must have required property '" + "capability_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err62];
              } else {
                vErrors.push(err62);
              }
              errors++;
            }
            if (data22.state === undefined) {
              const err63 = {
                instancePath: instancePath + "/not_exposed_capabilities/" + i4,
                schemaPath: "common.schema.json#/$defs/notExposedCapability/required",
                keyword: "required",
                params: { missingProperty: "state" },
                message: "must have required property '" + "state" + "'",
              };
              if (vErrors === null) {
                vErrors = [err63];
              } else {
                vErrors.push(err63);
              }
              errors++;
            }
            if (data22.reason_code === undefined) {
              const err64 = {
                instancePath: instancePath + "/not_exposed_capabilities/" + i4,
                schemaPath: "common.schema.json#/$defs/notExposedCapability/required",
                keyword: "required",
                params: { missingProperty: "reason_code" },
                message: "must have required property '" + "reason_code" + "'",
              };
              if (vErrors === null) {
                vErrors = [err64];
              } else {
                vErrors.push(err64);
              }
              errors++;
            }
            for (const key2 in data22) {
              if (!(key2 === "capability_id" || key2 === "state" || key2 === "reason_code")) {
                const err65 = {
                  instancePath: instancePath + "/not_exposed_capabilities/" + i4,
                  schemaPath: "common.schema.json#/$defs/notExposedCapability/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key2 },
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
            if (data22.capability_id !== undefined) {
              let data23 = data22.capability_id;
              if (!(
                data23 === "model_selection" ||
                data23 === "device_selection" ||
                data23 === "engine_selection" ||
                data23 === "tensor_parallel_degree" ||
                data23 === "pipeline_parallel_degree" ||
                data23 === "expert_parallel_degree" ||
                data23 === "physical_kv_policy" ||
                data23 === "collective_algorithm" ||
                data23 === "slo"
              )) {
                const err66 = {
                  instancePath: instancePath + "/not_exposed_capabilities/" + i4 + "/capability_id",
                  schemaPath: "common.schema.json#/$defs/notExposedCapability/properties/capability_id/enum",
                  keyword: "enum",
                  params: { allowedValues: schema56.properties.capability_id.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err66];
                } else {
                  vErrors.push(err66);
                }
                errors++;
              }
            }
            if (data22.state !== undefined) {
              if ("not_exposed" !== data22.state) {
                const err67 = {
                  instancePath: instancePath + "/not_exposed_capabilities/" + i4 + "/state",
                  schemaPath: "common.schema.json#/$defs/notExposedCapability/properties/state/const",
                  keyword: "const",
                  params: { allowedValue: "not_exposed" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err67];
                } else {
                  vErrors.push(err67);
                }
                errors++;
              }
            }
            if (data22.reason_code !== undefined) {
              if ("not_exposed_to_agent" !== data22.reason_code) {
                const err68 = {
                  instancePath: instancePath + "/not_exposed_capabilities/" + i4 + "/reason_code",
                  schemaPath: "common.schema.json#/$defs/notExposedCapability/properties/reason_code/const",
                  keyword: "const",
                  params: { allowedValue: "not_exposed_to_agent" },
                  message: "must be equal to constant",
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
              instancePath: instancePath + "/not_exposed_capabilities/" + i4,
              schemaPath: "common.schema.json#/$defs/notExposedCapability/type",
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
          instancePath: instancePath + "/not_exposed_capabilities",
          schemaPath: "#/properties/not_exposed_capabilities/type",
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
    if (data.claim_scope_ceiling !== undefined) {
      let data26 = data.claim_scope_ceiling;
      if (Array.isArray(data26)) {
        if (data26.length > 2) {
          const err71 = {
            instancePath: instancePath + "/claim_scope_ceiling",
            schemaPath: "#/properties/claim_scope_ceiling/maxItems",
            keyword: "maxItems",
            params: { limit: 2 },
            message: "must NOT have more than 2 items",
          };
          if (vErrors === null) {
            vErrors = [err71];
          } else {
            vErrors.push(err71);
          }
          errors++;
        }
        if (data26.length < 2) {
          const err72 = {
            instancePath: instancePath + "/claim_scope_ceiling",
            schemaPath: "#/properties/claim_scope_ceiling/minItems",
            keyword: "minItems",
            params: { limit: 2 },
            message: "must NOT have fewer than 2 items",
          };
          if (vErrors === null) {
            vErrors = [err72];
          } else {
            vErrors.push(err72);
          }
          errors++;
        }
        const len4 = data26.length;
        if (len4 > 0) {
          if ("exploration" !== data26[0]) {
            const err73 = {
              instancePath: instancePath + "/claim_scope_ceiling/0",
              schemaPath: "#/properties/claim_scope_ceiling/prefixItems/0/const",
              keyword: "const",
              params: { allowedValue: "exploration" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err73];
            } else {
              vErrors.push(err73);
            }
            errors++;
          }
        }
        if (len4 > 1) {
          if ("synthetic_consistency" !== data26[1]) {
            const err74 = {
              instancePath: instancePath + "/claim_scope_ceiling/1",
              schemaPath: "#/properties/claim_scope_ceiling/prefixItems/1/const",
              keyword: "const",
              params: { allowedValue: "synthetic_consistency" },
              message: "must be equal to constant",
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
          instancePath: instancePath + "/claim_scope_ceiling",
          schemaPath: "#/properties/claim_scope_ceiling/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err75];
        } else {
          vErrors.push(err75);
        }
        errors++;
      }
    }
  } else {
    const err76 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err76];
    } else {
      vErrors.push(err76);
    }
    errors++;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const agentOrchestrationCapabilitySnapshot = validate38;
const schema57 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-capability/v1/capability-snapshot.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_capability_snapshot.v1",
  title: "AgentOrchestrationCapabilitySnapshot",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "publication_status",
    "snapshot_id",
    "snapshot_revision",
    "snapshot_digest",
    "canonicalization_identity",
    "catalog",
    "release_binding",
    "drift_policy",
  ],
  properties: {
    schema_identity: { const: "tilesim.bridge.agent_orchestration_capability_snapshot.v1" },
    publication_status: { const: "published" },
    snapshot_id: { $ref: "common.schema.json#/$defs/stableId" },
    snapshot_revision: { $ref: "common.schema.json#/$defs/sha256" },
    snapshot_digest: { $ref: "common.schema.json#/$defs/sha256" },
    canonicalization_identity: { const: "tilesim.bridge.canonical_json.v1" },
    catalog: { $ref: "capability-catalog.schema.json" },
    release_binding: {
      type: "object",
      additionalProperties: false,
      required: [
        "web_source_identity",
        "web_source_revision",
        "web_build_revision",
        "backend_identity",
        "backend_revision",
        "schema_set_revision",
        "experiment_descriptor_identity",
        "experiment_descriptor_revision",
        "create_run_identity",
        "catalog_revision",
        "contract_package_revision",
        "nested_design_space_identities",
        "default_nested_design_space_identity",
      ],
      properties: {
        web_source_identity: { const: "tilesim.web.git" },
        web_source_revision: { $ref: "common.schema.json#/$defs/gitRevision" },
        web_build_revision: { $ref: "common.schema.json#/$defs/gitRevision" },
        backend_identity: { const: "tilesim.backend.git" },
        backend_revision: { $ref: "common.schema.json#/$defs/gitRevision" },
        schema_set_revision: { $ref: "common.schema.json#/$defs/sha256" },
        experiment_descriptor_identity: { const: "tilesim.bridge.experiment_descriptor.v1" },
        experiment_descriptor_revision: { $ref: "common.schema.json#/$defs/sha256" },
        create_run_identity: { const: "tilesim.bridge.create_run_request.v1" },
        catalog_revision: { $ref: "common.schema.json#/$defs/sha256" },
        contract_package_revision: { $ref: "common.schema.json#/$defs/sha256" },
        nested_design_space_identities: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          prefixItems: [
            { const: "tilesim.design_space.s6_candidates.v1" },
            { const: "tilesim.design_space.s6_candidates.v2" },
          ],
        },
        default_nested_design_space_identity: {
          enum: ["tilesim.design_space.s6_candidates.v1", "tilesim.design_space.s6_candidates.v2"],
        },
      },
    },
    drift_policy: {
      type: "object",
      additionalProperties: false,
      required: ["release_binding_mismatch", "catalog_revision_mismatch", "unknown_identity_or_status"],
      properties: {
        release_binding_mismatch: { const: "fail_closed" },
        catalog_revision_mismatch: { const: "fail_closed" },
        unknown_identity_or_status: { const: "fail_closed" },
      },
    },
  },
};
function validate38(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-capability/v1/capability-snapshot.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate38.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_identity" },
        message: "must have required property '" + "schema_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.publication_status === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "publication_status" },
        message: "must have required property '" + "publication_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.snapshot_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "snapshot_id" },
        message: "must have required property '" + "snapshot_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.snapshot_revision === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "snapshot_revision" },
        message: "must have required property '" + "snapshot_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.snapshot_digest === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "snapshot_digest" },
        message: "must have required property '" + "snapshot_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.canonicalization_identity === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "canonicalization_identity" },
        message: "must have required property '" + "canonicalization_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.catalog === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "catalog" },
        message: "must have required property '" + "catalog" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.release_binding === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "release_binding" },
        message: "must have required property '" + "release_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.drift_policy === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "drift_policy" },
        message: "must have required property '" + "drift_policy" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema57.properties, key0)) {
        const err9 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.schema_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_capability_snapshot.v1" !== data.schema_identity) {
        const err10 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_capability_snapshot.v1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.publication_status !== undefined) {
      if ("published" !== data.publication_status) {
        const err11 = {
          instancePath: instancePath + "/publication_status",
          schemaPath: "#/properties/publication_status/const",
          keyword: "const",
          params: { allowedValue: "published" },
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
    if (data.snapshot_id !== undefined) {
      let data2 = data.snapshot_id;
      if (typeof data2 === "string") {
        if (!pattern4.test(data2)) {
          const err12 = {
            instancePath: instancePath + "/snapshot_id",
            schemaPath: "common.schema.json#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/snapshot_id",
          schemaPath: "common.schema.json#/$defs/stableId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.snapshot_revision !== undefined) {
      let data3 = data.snapshot_revision;
      if (typeof data3 === "string") {
        if (!pattern5.test(data3)) {
          const err14 = {
            instancePath: instancePath + "/snapshot_revision",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      } else {
        const err15 = {
          instancePath: instancePath + "/snapshot_revision",
          schemaPath: "common.schema.json#/$defs/sha256/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.snapshot_digest !== undefined) {
      let data4 = data.snapshot_digest;
      if (typeof data4 === "string") {
        if (!pattern5.test(data4)) {
          const err16 = {
            instancePath: instancePath + "/snapshot_digest",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/snapshot_digest",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.canonicalization_identity !== undefined) {
      if ("tilesim.bridge.canonical_json.v1" !== data.canonicalization_identity) {
        const err18 = {
          instancePath: instancePath + "/canonicalization_identity",
          schemaPath: "#/properties/canonicalization_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.canonical_json.v1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.catalog !== undefined) {
      if (
        !validate20(data.catalog, {
          instancePath: instancePath + "/catalog",
          parentData: data,
          parentDataProperty: "catalog",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate20.errors : vErrors.concat(validate20.errors);
        errors = vErrors.length;
      }
    }
    if (data.release_binding !== undefined) {
      let data7 = data.release_binding;
      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
        if (data7.web_source_identity === undefined) {
          const err19 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "web_source_identity" },
            message: "must have required property '" + "web_source_identity" + "'",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (data7.web_source_revision === undefined) {
          const err20 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "web_source_revision" },
            message: "must have required property '" + "web_source_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        if (data7.web_build_revision === undefined) {
          const err21 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "web_build_revision" },
            message: "must have required property '" + "web_build_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (data7.backend_identity === undefined) {
          const err22 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "backend_identity" },
            message: "must have required property '" + "backend_identity" + "'",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (data7.backend_revision === undefined) {
          const err23 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "backend_revision" },
            message: "must have required property '" + "backend_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
        if (data7.schema_set_revision === undefined) {
          const err24 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "schema_set_revision" },
            message: "must have required property '" + "schema_set_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (data7.experiment_descriptor_identity === undefined) {
          const err25 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "experiment_descriptor_identity" },
            message: "must have required property '" + "experiment_descriptor_identity" + "'",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (data7.experiment_descriptor_revision === undefined) {
          const err26 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "experiment_descriptor_revision" },
            message: "must have required property '" + "experiment_descriptor_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        if (data7.create_run_identity === undefined) {
          const err27 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "create_run_identity" },
            message: "must have required property '" + "create_run_identity" + "'",
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
        if (data7.catalog_revision === undefined) {
          const err28 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "catalog_revision" },
            message: "must have required property '" + "catalog_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
        if (data7.contract_package_revision === undefined) {
          const err29 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "contract_package_revision" },
            message: "must have required property '" + "contract_package_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
        if (data7.nested_design_space_identities === undefined) {
          const err30 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "nested_design_space_identities" },
            message: "must have required property '" + "nested_design_space_identities" + "'",
          };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        if (data7.default_nested_design_space_identity === undefined) {
          const err31 = {
            instancePath: instancePath + "/release_binding",
            schemaPath: "#/properties/release_binding/required",
            keyword: "required",
            params: { missingProperty: "default_nested_design_space_identity" },
            message: "must have required property '" + "default_nested_design_space_identity" + "'",
          };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        for (const key1 in data7) {
          if (!func1.call(schema57.properties.release_binding.properties, key1)) {
            const err32 = {
              instancePath: instancePath + "/release_binding",
              schemaPath: "#/properties/release_binding/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
        }
        if (data7.web_source_identity !== undefined) {
          if ("tilesim.web.git" !== data7.web_source_identity) {
            const err33 = {
              instancePath: instancePath + "/release_binding/web_source_identity",
              schemaPath: "#/properties/release_binding/properties/web_source_identity/const",
              keyword: "const",
              params: { allowedValue: "tilesim.web.git" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
        }
        if (data7.web_source_revision !== undefined) {
          let data9 = data7.web_source_revision;
          if (typeof data9 === "string") {
            if (!pattern18.test(data9)) {
              const err34 = {
                instancePath: instancePath + "/release_binding/web_source_revision",
                schemaPath: "common.schema.json#/$defs/gitRevision/pattern",
                keyword: "pattern",
                params: { pattern: "^[0-9a-f]{40}$" },
                message: 'must match pattern "' + "^[0-9a-f]{40}$" + '"',
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
              instancePath: instancePath + "/release_binding/web_source_revision",
              schemaPath: "common.schema.json#/$defs/gitRevision/type",
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
        if (data7.web_build_revision !== undefined) {
          let data10 = data7.web_build_revision;
          if (typeof data10 === "string") {
            if (!pattern18.test(data10)) {
              const err36 = {
                instancePath: instancePath + "/release_binding/web_build_revision",
                schemaPath: "common.schema.json#/$defs/gitRevision/pattern",
                keyword: "pattern",
                params: { pattern: "^[0-9a-f]{40}$" },
                message: 'must match pattern "' + "^[0-9a-f]{40}$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
            }
          } else {
            const err37 = {
              instancePath: instancePath + "/release_binding/web_build_revision",
              schemaPath: "common.schema.json#/$defs/gitRevision/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err37];
            } else {
              vErrors.push(err37);
            }
            errors++;
          }
        }
        if (data7.backend_identity !== undefined) {
          if ("tilesim.backend.git" !== data7.backend_identity) {
            const err38 = {
              instancePath: instancePath + "/release_binding/backend_identity",
              schemaPath: "#/properties/release_binding/properties/backend_identity/const",
              keyword: "const",
              params: { allowedValue: "tilesim.backend.git" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err38];
            } else {
              vErrors.push(err38);
            }
            errors++;
          }
        }
        if (data7.backend_revision !== undefined) {
          let data12 = data7.backend_revision;
          if (typeof data12 === "string") {
            if (!pattern18.test(data12)) {
              const err39 = {
                instancePath: instancePath + "/release_binding/backend_revision",
                schemaPath: "common.schema.json#/$defs/gitRevision/pattern",
                keyword: "pattern",
                params: { pattern: "^[0-9a-f]{40}$" },
                message: 'must match pattern "' + "^[0-9a-f]{40}$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err39];
              } else {
                vErrors.push(err39);
              }
              errors++;
            }
          } else {
            const err40 = {
              instancePath: instancePath + "/release_binding/backend_revision",
              schemaPath: "common.schema.json#/$defs/gitRevision/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err40];
            } else {
              vErrors.push(err40);
            }
            errors++;
          }
        }
        if (data7.schema_set_revision !== undefined) {
          let data13 = data7.schema_set_revision;
          if (typeof data13 === "string") {
            if (!pattern5.test(data13)) {
              const err41 = {
                instancePath: instancePath + "/release_binding/schema_set_revision",
                schemaPath: "common.schema.json#/$defs/sha256/pattern",
                keyword: "pattern",
                params: { pattern: "^sha256:[0-9a-f]{64}$" },
                message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
              instancePath: instancePath + "/release_binding/schema_set_revision",
              schemaPath: "common.schema.json#/$defs/sha256/type",
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
        if (data7.experiment_descriptor_identity !== undefined) {
          if ("tilesim.bridge.experiment_descriptor.v1" !== data7.experiment_descriptor_identity) {
            const err43 = {
              instancePath: instancePath + "/release_binding/experiment_descriptor_identity",
              schemaPath: "#/properties/release_binding/properties/experiment_descriptor_identity/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.experiment_descriptor.v1" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err43];
            } else {
              vErrors.push(err43);
            }
            errors++;
          }
        }
        if (data7.experiment_descriptor_revision !== undefined) {
          let data15 = data7.experiment_descriptor_revision;
          if (typeof data15 === "string") {
            if (!pattern5.test(data15)) {
              const err44 = {
                instancePath: instancePath + "/release_binding/experiment_descriptor_revision",
                schemaPath: "common.schema.json#/$defs/sha256/pattern",
                keyword: "pattern",
                params: { pattern: "^sha256:[0-9a-f]{64}$" },
                message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
              instancePath: instancePath + "/release_binding/experiment_descriptor_revision",
              schemaPath: "common.schema.json#/$defs/sha256/type",
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
        if (data7.create_run_identity !== undefined) {
          if ("tilesim.bridge.create_run_request.v1" !== data7.create_run_identity) {
            const err46 = {
              instancePath: instancePath + "/release_binding/create_run_identity",
              schemaPath: "#/properties/release_binding/properties/create_run_identity/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.create_run_request.v1" },
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
        if (data7.catalog_revision !== undefined) {
          let data17 = data7.catalog_revision;
          if (typeof data17 === "string") {
            if (!pattern5.test(data17)) {
              const err47 = {
                instancePath: instancePath + "/release_binding/catalog_revision",
                schemaPath: "common.schema.json#/$defs/sha256/pattern",
                keyword: "pattern",
                params: { pattern: "^sha256:[0-9a-f]{64}$" },
                message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
              instancePath: instancePath + "/release_binding/catalog_revision",
              schemaPath: "common.schema.json#/$defs/sha256/type",
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
        if (data7.contract_package_revision !== undefined) {
          let data18 = data7.contract_package_revision;
          if (typeof data18 === "string") {
            if (!pattern5.test(data18)) {
              const err49 = {
                instancePath: instancePath + "/release_binding/contract_package_revision",
                schemaPath: "common.schema.json#/$defs/sha256/pattern",
                keyword: "pattern",
                params: { pattern: "^sha256:[0-9a-f]{64}$" },
                message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err49];
              } else {
                vErrors.push(err49);
              }
              errors++;
            }
          } else {
            const err50 = {
              instancePath: instancePath + "/release_binding/contract_package_revision",
              schemaPath: "common.schema.json#/$defs/sha256/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err50];
            } else {
              vErrors.push(err50);
            }
            errors++;
          }
        }
        if (data7.nested_design_space_identities !== undefined) {
          let data19 = data7.nested_design_space_identities;
          if (Array.isArray(data19)) {
            if (data19.length > 2) {
              const err51 = {
                instancePath: instancePath + "/release_binding/nested_design_space_identities",
                schemaPath: "#/properties/release_binding/properties/nested_design_space_identities/maxItems",
                keyword: "maxItems",
                params: { limit: 2 },
                message: "must NOT have more than 2 items",
              };
              if (vErrors === null) {
                vErrors = [err51];
              } else {
                vErrors.push(err51);
              }
              errors++;
            }
            if (data19.length < 2) {
              const err52 = {
                instancePath: instancePath + "/release_binding/nested_design_space_identities",
                schemaPath: "#/properties/release_binding/properties/nested_design_space_identities/minItems",
                keyword: "minItems",
                params: { limit: 2 },
                message: "must NOT have fewer than 2 items",
              };
              if (vErrors === null) {
                vErrors = [err52];
              } else {
                vErrors.push(err52);
              }
              errors++;
            }
            const len0 = data19.length;
            if (len0 > 0) {
              if ("tilesim.design_space.s6_candidates.v1" !== data19[0]) {
                const err53 = {
                  instancePath: instancePath + "/release_binding/nested_design_space_identities/0",
                  schemaPath:
                    "#/properties/release_binding/properties/nested_design_space_identities/prefixItems/0/const",
                  keyword: "const",
                  params: { allowedValue: "tilesim.design_space.s6_candidates.v1" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err53];
                } else {
                  vErrors.push(err53);
                }
                errors++;
              }
            }
            if (len0 > 1) {
              if ("tilesim.design_space.s6_candidates.v2" !== data19[1]) {
                const err54 = {
                  instancePath: instancePath + "/release_binding/nested_design_space_identities/1",
                  schemaPath:
                    "#/properties/release_binding/properties/nested_design_space_identities/prefixItems/1/const",
                  keyword: "const",
                  params: { allowedValue: "tilesim.design_space.s6_candidates.v2" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err54];
                } else {
                  vErrors.push(err54);
                }
                errors++;
              }
            }
          } else {
            const err55 = {
              instancePath: instancePath + "/release_binding/nested_design_space_identities",
              schemaPath: "#/properties/release_binding/properties/nested_design_space_identities/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err55];
            } else {
              vErrors.push(err55);
            }
            errors++;
          }
        }
        if (data7.default_nested_design_space_identity !== undefined) {
          let data22 = data7.default_nested_design_space_identity;
          if (!(
            data22 === "tilesim.design_space.s6_candidates.v1" || data22 === "tilesim.design_space.s6_candidates.v2"
          )) {
            const err56 = {
              instancePath: instancePath + "/release_binding/default_nested_design_space_identity",
              schemaPath: "#/properties/release_binding/properties/default_nested_design_space_identity/enum",
              keyword: "enum",
              params: {
                allowedValues: schema57.properties.release_binding.properties.default_nested_design_space_identity.enum,
              },
              message: "must be equal to one of the allowed values",
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
          instancePath: instancePath + "/release_binding",
          schemaPath: "#/properties/release_binding/type",
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
    }
    if (data.drift_policy !== undefined) {
      let data23 = data.drift_policy;
      if (data23 && typeof data23 == "object" && !Array.isArray(data23)) {
        if (data23.release_binding_mismatch === undefined) {
          const err58 = {
            instancePath: instancePath + "/drift_policy",
            schemaPath: "#/properties/drift_policy/required",
            keyword: "required",
            params: { missingProperty: "release_binding_mismatch" },
            message: "must have required property '" + "release_binding_mismatch" + "'",
          };
          if (vErrors === null) {
            vErrors = [err58];
          } else {
            vErrors.push(err58);
          }
          errors++;
        }
        if (data23.catalog_revision_mismatch === undefined) {
          const err59 = {
            instancePath: instancePath + "/drift_policy",
            schemaPath: "#/properties/drift_policy/required",
            keyword: "required",
            params: { missingProperty: "catalog_revision_mismatch" },
            message: "must have required property '" + "catalog_revision_mismatch" + "'",
          };
          if (vErrors === null) {
            vErrors = [err59];
          } else {
            vErrors.push(err59);
          }
          errors++;
        }
        if (data23.unknown_identity_or_status === undefined) {
          const err60 = {
            instancePath: instancePath + "/drift_policy",
            schemaPath: "#/properties/drift_policy/required",
            keyword: "required",
            params: { missingProperty: "unknown_identity_or_status" },
            message: "must have required property '" + "unknown_identity_or_status" + "'",
          };
          if (vErrors === null) {
            vErrors = [err60];
          } else {
            vErrors.push(err60);
          }
          errors++;
        }
        for (const key2 in data23) {
          if (!(
            key2 === "release_binding_mismatch" ||
            key2 === "catalog_revision_mismatch" ||
            key2 === "unknown_identity_or_status"
          )) {
            const err61 = {
              instancePath: instancePath + "/drift_policy",
              schemaPath: "#/properties/drift_policy/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err61];
            } else {
              vErrors.push(err61);
            }
            errors++;
          }
        }
        if (data23.release_binding_mismatch !== undefined) {
          if ("fail_closed" !== data23.release_binding_mismatch) {
            const err62 = {
              instancePath: instancePath + "/drift_policy/release_binding_mismatch",
              schemaPath: "#/properties/drift_policy/properties/release_binding_mismatch/const",
              keyword: "const",
              params: { allowedValue: "fail_closed" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err62];
            } else {
              vErrors.push(err62);
            }
            errors++;
          }
        }
        if (data23.catalog_revision_mismatch !== undefined) {
          if ("fail_closed" !== data23.catalog_revision_mismatch) {
            const err63 = {
              instancePath: instancePath + "/drift_policy/catalog_revision_mismatch",
              schemaPath: "#/properties/drift_policy/properties/catalog_revision_mismatch/const",
              keyword: "const",
              params: { allowedValue: "fail_closed" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err63];
            } else {
              vErrors.push(err63);
            }
            errors++;
          }
        }
        if (data23.unknown_identity_or_status !== undefined) {
          if ("fail_closed" !== data23.unknown_identity_or_status) {
            const err64 = {
              instancePath: instancePath + "/drift_policy/unknown_identity_or_status",
              schemaPath: "#/properties/drift_policy/properties/unknown_identity_or_status/const",
              keyword: "const",
              params: { allowedValue: "fail_closed" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err64];
            } else {
              vErrors.push(err64);
            }
            errors++;
          }
        }
      } else {
        const err65 = {
          instancePath: instancePath + "/drift_policy",
          schemaPath: "#/properties/drift_policy/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
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
  validate38.errors = vErrors;
  return errors === 0;
}
validate38.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
