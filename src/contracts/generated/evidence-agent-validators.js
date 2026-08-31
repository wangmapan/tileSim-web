// Generated Ajv standalone F9 validators. Do not edit by hand.
"use strict";
export const evidenceAgentDescriptor = validate20;
const schema31 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/evidence-agent-descriptor.schema.json",
  "x-tilesim-schema-identity": "tilesim.bridge.evidence_agent_descriptor.v1",
  title: "EvidenceAgentDescriptor",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "schema_set_revision",
    "descriptor_revision",
    "availability",
    "degradation",
    "availability_predicate",
    "schema_identities",
    "provider",
    "revisions",
    "supported_locales",
    "supported_task_kinds",
    "limits",
    "digest_contract",
    "tools",
    "persistence",
    "redaction",
    "execution",
  ],
  properties: {
    schema_version: { const: "tilesim.bridge.evidence_agent_descriptor.v1" },
    schema_set_revision: { $ref: "#/$defs/revision" },
    descriptor_revision: { $ref: "#/$defs/revision" },
    availability: { enum: ["available", "degraded", "unavailable", "disabled"] },
    degradation: {
      type: "object",
      additionalProperties: false,
      required: ["state", "reason_code", "detail"],
      properties: {
        state: { enum: ["none", "not_configured", "temporarily_unavailable", "disabled_by_policy"] },
        reason_code: { enum: ["none", "provider_unavailable", "provider_disabled"] },
        detail: { type: "string", minLength: 1 },
      },
    },
    availability_predicate: {
      type: "object",
      additionalProperties: false,
      required: ["capability_path", "operator", "expected_value", "evaluated_available"],
      properties: {
        capability_path: { const: "/provider/configured" },
        operator: { const: "equals" },
        expected_value: { const: true },
        evaluated_available: { type: "boolean" },
      },
    },
    schema_identities: {
      type: "object",
      additionalProperties: false,
      required: ["request", "response", "citation", "snapshot_reference", "structured_report"],
      properties: {
        request: { const: "tilesim.bridge.evidence_agent_request.v1" },
        response: { const: "tilesim.bridge.evidence_agent_response.v1" },
        citation: { const: "tilesim.bridge.evidence_agent_citation.v1" },
        snapshot_reference: { const: "tilesim.bridge.evidence_snapshot_reference.v1" },
        structured_report: { const: "tilesim.web.structured-performance-report.v2" },
      },
    },
    provider: { $ref: "#/$defs/provider" },
    revisions: { $ref: "#/$defs/revisions" },
    supported_locales: { type: "array", items: { enum: ["en-US", "zh-CN"] }, uniqueItems: true },
    supported_task_kinds: {
      type: "array",
      uniqueItems: true,
      items: { enum: ["explain_p99", "explain_tail", "summarize_validation", "draft_conditional_recommendations"] },
    },
    limits: {
      type: "object",
      additionalProperties: false,
      required: [
        "maximum_request_bytes",
        "maximum_question_characters",
        "maximum_artifacts",
        "maximum_records_per_artifact",
        "maximum_claims",
        "maximum_output_characters",
      ],
      properties: {
        maximum_request_bytes: { type: "integer", minimum: 1 },
        maximum_question_characters: { type: "integer", minimum: 1 },
        maximum_artifacts: { type: "integer", minimum: 1 },
        maximum_records_per_artifact: { type: "integer", minimum: 1 },
        maximum_claims: { type: "integer", minimum: 1 },
        maximum_output_characters: { type: "integer", minimum: 1 },
      },
    },
    digest_contract: {
      type: "object",
      additionalProperties: false,
      required: [
        "algorithm",
        "output_encoding",
        "canonicalization",
        "text_encoding",
        "object_key_order",
        "array_order",
        "separators",
        "non_ascii_escaping",
        "integer_encoding",
        "non_finite_numbers",
        "artifact_manifest_material",
        "input_snapshot_material_fields",
        "excluded_untrusted_fields",
      ],
      properties: {
        algorithm: { const: "sha256" },
        output_encoding: { const: "lowercase_hex_with_sha256_prefix" },
        canonicalization: { const: "tilesim.bridge.canonical_json.v1" },
        text_encoding: { const: "utf-8" },
        object_key_order: { const: "unicode_code_point_ascending" },
        array_order: { const: "preserved" },
        separators: { const: "comma_colon_no_whitespace" },
        non_ascii_escaping: { const: "preserve_utf8" },
        integer_encoding: { const: "canonical_decimal_json_token_lossless" },
        non_finite_numbers: { const: "forbidden" },
        artifact_manifest_material: { const: "entire_verified_manifest_object" },
        input_snapshot_material_fields: {
          type: "array",
          minItems: 6,
          maxItems: 6,
          prefixItems: [
            { const: "schema_version" },
            { const: "schema_set_revision" },
            { const: "run_id" },
            { const: "structured_report_schema_identity" },
            { const: "snapshot_reference" },
            { const: "artifact_allow_list" },
          ],
          items: false,
        },
        excluded_untrusted_fields: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          prefixItems: [
            { const: "locale" },
            { const: "task_kind" },
            { const: "client_request_id" },
            { const: "user_question" },
          ],
          items: false,
        },
      },
    },
    tools: {
      type: "object",
      additionalProperties: false,
      required: ["allowed", "forbidden", "allow_list_expansion"],
      properties: {
        allowed: {
          type: "array",
          items: { enum: ["verified_snapshot_read", "citation_resolution"] },
          uniqueItems: true,
        },
        forbidden: { type: "array", items: { type: "string" }, uniqueItems: true },
        allow_list_expansion: { const: false },
      },
    },
    persistence: { $ref: "#/$defs/persistencePolicy" },
    redaction: {
      type: "object",
      additionalProperties: false,
      required: ["user_question", "artifact_content", "credentials", "hidden_chain_of_thought"],
      properties: {
        user_question: { const: "digest_only" },
        artifact_content: { const: "not_retained" },
        credentials: { const: "never_retained" },
        hidden_chain_of_thought: { const: "never_returned_or_retained" },
      },
    },
    execution: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "timeout_ms", "cancellation", "maximum_concurrent_operations", "retry", "terminal_recovery"],
      properties: {
        mode: { const: "synchronous_terminal" },
        timeout_ms: { type: "integer", minimum: 1 },
        cancellation: { const: "not_applicable_after_synchronous_terminal_response" },
        maximum_concurrent_operations: { const: 1 },
        retry: { const: "same_idempotency_key_and_same_payload_replays_terminal_result" },
        terminal_recovery: { const: "run_local_redacted_terminal_record" },
      },
    },
  },
  $defs: {
    revision: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    provider: {
      type: "object",
      additionalProperties: false,
      required: ["configured", "provider_id", "model_id", "model_revision"],
      properties: {
        configured: { type: "boolean" },
        provider_id: { type: "string", minLength: 1 },
        model_id: { type: "string", minLength: 1 },
        model_revision: { type: "string", minLength: 1 },
      },
    },
    revisions: {
      type: "object",
      additionalProperties: false,
      required: ["prompt_template_revision", "policy_revision"],
      properties: {
        prompt_template_revision: { type: "string", minLength: 1 },
        policy_revision: { type: "string", minLength: 1 },
      },
    },
    persistencePolicy: {
      type: "object",
      additionalProperties: false,
      required: [
        "mode",
        "retention_seconds",
        "snapshot_payload_retained",
        "user_question_retained",
        "hidden_reasoning_retained",
      ],
      properties: {
        mode: { const: "run_local_terminal_metadata_only" },
        retention_seconds: { type: "integer", minimum: 0 },
        snapshot_payload_retained: { const: false },
        user_question_retained: { const: false },
        hidden_reasoning_retained: { const: false },
      },
    },
  },
};
const schema32 = { type: "string", pattern: "^sha256:[0-9a-f]{64}$" };
const schema34 = {
  type: "object",
  additionalProperties: false,
  required: ["configured", "provider_id", "model_id", "model_revision"],
  properties: {
    configured: { type: "boolean" },
    provider_id: { type: "string", minLength: 1 },
    model_id: { type: "string", minLength: 1 },
    model_revision: { type: "string", minLength: 1 },
  },
};
const schema35 = {
  type: "object",
  additionalProperties: false,
  required: ["prompt_template_revision", "policy_revision"],
  properties: {
    prompt_template_revision: { type: "string", minLength: 1 },
    policy_revision: { type: "string", minLength: 1 },
  },
};
const schema36 = {
  type: "object",
  additionalProperties: false,
  required: [
    "mode",
    "retention_seconds",
    "snapshot_payload_retained",
    "user_question_retained",
    "hidden_reasoning_retained",
  ],
  properties: {
    mode: { const: "run_local_terminal_metadata_only" },
    retention_seconds: { type: "integer", minimum: 0 },
    snapshot_payload_retained: { const: false },
    user_question_retained: { const: false },
    hidden_reasoning_retained: { const: false },
  },
};
const func1 = Object.prototype.hasOwnProperty;
import func2 from "ajv/dist/runtime/ucs2length";
import func0 from "ajv/dist/runtime/equal";
const pattern4 = new RegExp("^sha256:[0-9a-f]{64}$", "u");
function validate20(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/evidence-agent-descriptor.schema.json" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
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
    if (data.descriptor_revision === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "descriptor_revision" },
        message: "must have required property '" + "descriptor_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.availability === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "availability" },
        message: "must have required property '" + "availability" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.degradation === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "degradation" },
        message: "must have required property '" + "degradation" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.availability_predicate === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "availability_predicate" },
        message: "must have required property '" + "availability_predicate" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.schema_identities === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_identities" },
        message: "must have required property '" + "schema_identities" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.provider === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "provider" },
        message: "must have required property '" + "provider" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.revisions === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "revisions" },
        message: "must have required property '" + "revisions" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.supported_locales === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "supported_locales" },
        message: "must have required property '" + "supported_locales" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.supported_task_kinds === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "supported_task_kinds" },
        message: "must have required property '" + "supported_task_kinds" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.limits === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "limits" },
        message: "must have required property '" + "limits" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.digest_contract === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "digest_contract" },
        message: "must have required property '" + "digest_contract" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.tools === undefined) {
      const err13 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "tools" },
        message: "must have required property '" + "tools" + "'",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.persistence === undefined) {
      const err14 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "persistence" },
        message: "must have required property '" + "persistence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    if (data.redaction === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "redaction" },
        message: "must have required property '" + "redaction" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.execution === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "execution" },
        message: "must have required property '" + "execution" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema31.properties, key0)) {
        const err17 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.schema_version !== undefined) {
      if ("tilesim.bridge.evidence_agent_descriptor.v1" !== data.schema_version) {
        const err18 = {
          instancePath: instancePath + "/schema_version",
          schemaPath: "#/properties/schema_version/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.evidence_agent_descriptor.v1" },
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
    if (data.schema_set_revision !== undefined) {
      let data1 = data.schema_set_revision;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err19 = {
            instancePath: instancePath + "/schema_set_revision",
            schemaPath: "#/$defs/revision/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/schema_set_revision",
          schemaPath: "#/$defs/revision/type",
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
      let data2 = data.descriptor_revision;
      if (typeof data2 === "string") {
        if (!pattern4.test(data2)) {
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
    if (data.availability !== undefined) {
      let data3 = data.availability;
      if (!(data3 === "available" || data3 === "degraded" || data3 === "unavailable" || data3 === "disabled")) {
        const err23 = {
          instancePath: instancePath + "/availability",
          schemaPath: "#/properties/availability/enum",
          keyword: "enum",
          params: { allowedValues: schema31.properties.availability.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.degradation !== undefined) {
      let data4 = data.degradation;
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
        if (data4.state === undefined) {
          const err24 = {
            instancePath: instancePath + "/degradation",
            schemaPath: "#/properties/degradation/required",
            keyword: "required",
            params: { missingProperty: "state" },
            message: "must have required property '" + "state" + "'",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (data4.reason_code === undefined) {
          const err25 = {
            instancePath: instancePath + "/degradation",
            schemaPath: "#/properties/degradation/required",
            keyword: "required",
            params: { missingProperty: "reason_code" },
            message: "must have required property '" + "reason_code" + "'",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (data4.detail === undefined) {
          const err26 = {
            instancePath: instancePath + "/degradation",
            schemaPath: "#/properties/degradation/required",
            keyword: "required",
            params: { missingProperty: "detail" },
            message: "must have required property '" + "detail" + "'",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        for (const key1 in data4) {
          if (!(key1 === "state" || key1 === "reason_code" || key1 === "detail")) {
            const err27 = {
              instancePath: instancePath + "/degradation",
              schemaPath: "#/properties/degradation/additionalProperties",
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
        if (data4.state !== undefined) {
          let data5 = data4.state;
          if (!(
            data5 === "none" ||
            data5 === "not_configured" ||
            data5 === "temporarily_unavailable" ||
            data5 === "disabled_by_policy"
          )) {
            const err28 = {
              instancePath: instancePath + "/degradation/state",
              schemaPath: "#/properties/degradation/properties/state/enum",
              keyword: "enum",
              params: { allowedValues: schema31.properties.degradation.properties.state.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err28];
            } else {
              vErrors.push(err28);
            }
            errors++;
          }
        }
        if (data4.reason_code !== undefined) {
          let data6 = data4.reason_code;
          if (!(data6 === "none" || data6 === "provider_unavailable" || data6 === "provider_disabled")) {
            const err29 = {
              instancePath: instancePath + "/degradation/reason_code",
              schemaPath: "#/properties/degradation/properties/reason_code/enum",
              keyword: "enum",
              params: { allowedValues: schema31.properties.degradation.properties.reason_code.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err29];
            } else {
              vErrors.push(err29);
            }
            errors++;
          }
        }
        if (data4.detail !== undefined) {
          let data7 = data4.detail;
          if (typeof data7 === "string") {
            if (func2(data7) < 1) {
              const err30 = {
                instancePath: instancePath + "/degradation/detail",
                schemaPath: "#/properties/degradation/properties/detail/minLength",
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
              instancePath: instancePath + "/degradation/detail",
              schemaPath: "#/properties/degradation/properties/detail/type",
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
      } else {
        const err32 = {
          instancePath: instancePath + "/degradation",
          schemaPath: "#/properties/degradation/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err32];
        } else {
          vErrors.push(err32);
        }
        errors++;
      }
    }
    if (data.availability_predicate !== undefined) {
      let data8 = data.availability_predicate;
      if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
        if (data8.capability_path === undefined) {
          const err33 = {
            instancePath: instancePath + "/availability_predicate",
            schemaPath: "#/properties/availability_predicate/required",
            keyword: "required",
            params: { missingProperty: "capability_path" },
            message: "must have required property '" + "capability_path" + "'",
          };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
        if (data8.operator === undefined) {
          const err34 = {
            instancePath: instancePath + "/availability_predicate",
            schemaPath: "#/properties/availability_predicate/required",
            keyword: "required",
            params: { missingProperty: "operator" },
            message: "must have required property '" + "operator" + "'",
          };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
        if (data8.expected_value === undefined) {
          const err35 = {
            instancePath: instancePath + "/availability_predicate",
            schemaPath: "#/properties/availability_predicate/required",
            keyword: "required",
            params: { missingProperty: "expected_value" },
            message: "must have required property '" + "expected_value" + "'",
          };
          if (vErrors === null) {
            vErrors = [err35];
          } else {
            vErrors.push(err35);
          }
          errors++;
        }
        if (data8.evaluated_available === undefined) {
          const err36 = {
            instancePath: instancePath + "/availability_predicate",
            schemaPath: "#/properties/availability_predicate/required",
            keyword: "required",
            params: { missingProperty: "evaluated_available" },
            message: "must have required property '" + "evaluated_available" + "'",
          };
          if (vErrors === null) {
            vErrors = [err36];
          } else {
            vErrors.push(err36);
          }
          errors++;
        }
        for (const key2 in data8) {
          if (!(
            key2 === "capability_path" ||
            key2 === "operator" ||
            key2 === "expected_value" ||
            key2 === "evaluated_available"
          )) {
            const err37 = {
              instancePath: instancePath + "/availability_predicate",
              schemaPath: "#/properties/availability_predicate/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err37];
            } else {
              vErrors.push(err37);
            }
            errors++;
          }
        }
        if (data8.capability_path !== undefined) {
          if ("/provider/configured" !== data8.capability_path) {
            const err38 = {
              instancePath: instancePath + "/availability_predicate/capability_path",
              schemaPath: "#/properties/availability_predicate/properties/capability_path/const",
              keyword: "const",
              params: { allowedValue: "/provider/configured" },
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
        if (data8.operator !== undefined) {
          if ("equals" !== data8.operator) {
            const err39 = {
              instancePath: instancePath + "/availability_predicate/operator",
              schemaPath: "#/properties/availability_predicate/properties/operator/const",
              keyword: "const",
              params: { allowedValue: "equals" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err39];
            } else {
              vErrors.push(err39);
            }
            errors++;
          }
        }
        if (data8.expected_value !== undefined) {
          if (true !== data8.expected_value) {
            const err40 = {
              instancePath: instancePath + "/availability_predicate/expected_value",
              schemaPath: "#/properties/availability_predicate/properties/expected_value/const",
              keyword: "const",
              params: { allowedValue: true },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err40];
            } else {
              vErrors.push(err40);
            }
            errors++;
          }
        }
        if (data8.evaluated_available !== undefined) {
          if (typeof data8.evaluated_available !== "boolean") {
            const err41 = {
              instancePath: instancePath + "/availability_predicate/evaluated_available",
              schemaPath: "#/properties/availability_predicate/properties/evaluated_available/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err41];
            } else {
              vErrors.push(err41);
            }
            errors++;
          }
        }
      } else {
        const err42 = {
          instancePath: instancePath + "/availability_predicate",
          schemaPath: "#/properties/availability_predicate/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err42];
        } else {
          vErrors.push(err42);
        }
        errors++;
      }
    }
    if (data.schema_identities !== undefined) {
      let data13 = data.schema_identities;
      if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
        if (data13.request === undefined) {
          const err43 = {
            instancePath: instancePath + "/schema_identities",
            schemaPath: "#/properties/schema_identities/required",
            keyword: "required",
            params: { missingProperty: "request" },
            message: "must have required property '" + "request" + "'",
          };
          if (vErrors === null) {
            vErrors = [err43];
          } else {
            vErrors.push(err43);
          }
          errors++;
        }
        if (data13.response === undefined) {
          const err44 = {
            instancePath: instancePath + "/schema_identities",
            schemaPath: "#/properties/schema_identities/required",
            keyword: "required",
            params: { missingProperty: "response" },
            message: "must have required property '" + "response" + "'",
          };
          if (vErrors === null) {
            vErrors = [err44];
          } else {
            vErrors.push(err44);
          }
          errors++;
        }
        if (data13.citation === undefined) {
          const err45 = {
            instancePath: instancePath + "/schema_identities",
            schemaPath: "#/properties/schema_identities/required",
            keyword: "required",
            params: { missingProperty: "citation" },
            message: "must have required property '" + "citation" + "'",
          };
          if (vErrors === null) {
            vErrors = [err45];
          } else {
            vErrors.push(err45);
          }
          errors++;
        }
        if (data13.snapshot_reference === undefined) {
          const err46 = {
            instancePath: instancePath + "/schema_identities",
            schemaPath: "#/properties/schema_identities/required",
            keyword: "required",
            params: { missingProperty: "snapshot_reference" },
            message: "must have required property '" + "snapshot_reference" + "'",
          };
          if (vErrors === null) {
            vErrors = [err46];
          } else {
            vErrors.push(err46);
          }
          errors++;
        }
        if (data13.structured_report === undefined) {
          const err47 = {
            instancePath: instancePath + "/schema_identities",
            schemaPath: "#/properties/schema_identities/required",
            keyword: "required",
            params: { missingProperty: "structured_report" },
            message: "must have required property '" + "structured_report" + "'",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
        for (const key3 in data13) {
          if (!(
            key3 === "request" ||
            key3 === "response" ||
            key3 === "citation" ||
            key3 === "snapshot_reference" ||
            key3 === "structured_report"
          )) {
            const err48 = {
              instancePath: instancePath + "/schema_identities",
              schemaPath: "#/properties/schema_identities/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key3 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err48];
            } else {
              vErrors.push(err48);
            }
            errors++;
          }
        }
        if (data13.request !== undefined) {
          if ("tilesim.bridge.evidence_agent_request.v1" !== data13.request) {
            const err49 = {
              instancePath: instancePath + "/schema_identities/request",
              schemaPath: "#/properties/schema_identities/properties/request/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.evidence_agent_request.v1" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err49];
            } else {
              vErrors.push(err49);
            }
            errors++;
          }
        }
        if (data13.response !== undefined) {
          if ("tilesim.bridge.evidence_agent_response.v1" !== data13.response) {
            const err50 = {
              instancePath: instancePath + "/schema_identities/response",
              schemaPath: "#/properties/schema_identities/properties/response/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.evidence_agent_response.v1" },
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
        if (data13.citation !== undefined) {
          if ("tilesim.bridge.evidence_agent_citation.v1" !== data13.citation) {
            const err51 = {
              instancePath: instancePath + "/schema_identities/citation",
              schemaPath: "#/properties/schema_identities/properties/citation/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.evidence_agent_citation.v1" },
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
        if (data13.snapshot_reference !== undefined) {
          if ("tilesim.bridge.evidence_snapshot_reference.v1" !== data13.snapshot_reference) {
            const err52 = {
              instancePath: instancePath + "/schema_identities/snapshot_reference",
              schemaPath: "#/properties/schema_identities/properties/snapshot_reference/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.evidence_snapshot_reference.v1" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err52];
            } else {
              vErrors.push(err52);
            }
            errors++;
          }
        }
        if (data13.structured_report !== undefined) {
          if ("tilesim.web.structured-performance-report.v2" !== data13.structured_report) {
            const err53 = {
              instancePath: instancePath + "/schema_identities/structured_report",
              schemaPath: "#/properties/schema_identities/properties/structured_report/const",
              keyword: "const",
              params: { allowedValue: "tilesim.web.structured-performance-report.v2" },
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
      } else {
        const err54 = {
          instancePath: instancePath + "/schema_identities",
          schemaPath: "#/properties/schema_identities/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err54];
        } else {
          vErrors.push(err54);
        }
        errors++;
      }
    }
    if (data.provider !== undefined) {
      let data19 = data.provider;
      if (data19 && typeof data19 == "object" && !Array.isArray(data19)) {
        if (data19.configured === undefined) {
          const err55 = {
            instancePath: instancePath + "/provider",
            schemaPath: "#/$defs/provider/required",
            keyword: "required",
            params: { missingProperty: "configured" },
            message: "must have required property '" + "configured" + "'",
          };
          if (vErrors === null) {
            vErrors = [err55];
          } else {
            vErrors.push(err55);
          }
          errors++;
        }
        if (data19.provider_id === undefined) {
          const err56 = {
            instancePath: instancePath + "/provider",
            schemaPath: "#/$defs/provider/required",
            keyword: "required",
            params: { missingProperty: "provider_id" },
            message: "must have required property '" + "provider_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err56];
          } else {
            vErrors.push(err56);
          }
          errors++;
        }
        if (data19.model_id === undefined) {
          const err57 = {
            instancePath: instancePath + "/provider",
            schemaPath: "#/$defs/provider/required",
            keyword: "required",
            params: { missingProperty: "model_id" },
            message: "must have required property '" + "model_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err57];
          } else {
            vErrors.push(err57);
          }
          errors++;
        }
        if (data19.model_revision === undefined) {
          const err58 = {
            instancePath: instancePath + "/provider",
            schemaPath: "#/$defs/provider/required",
            keyword: "required",
            params: { missingProperty: "model_revision" },
            message: "must have required property '" + "model_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err58];
          } else {
            vErrors.push(err58);
          }
          errors++;
        }
        for (const key4 in data19) {
          if (!(key4 === "configured" || key4 === "provider_id" || key4 === "model_id" || key4 === "model_revision")) {
            const err59 = {
              instancePath: instancePath + "/provider",
              schemaPath: "#/$defs/provider/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key4 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err59];
            } else {
              vErrors.push(err59);
            }
            errors++;
          }
        }
        if (data19.configured !== undefined) {
          if (typeof data19.configured !== "boolean") {
            const err60 = {
              instancePath: instancePath + "/provider/configured",
              schemaPath: "#/$defs/provider/properties/configured/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err60];
            } else {
              vErrors.push(err60);
            }
            errors++;
          }
        }
        if (data19.provider_id !== undefined) {
          let data21 = data19.provider_id;
          if (typeof data21 === "string") {
            if (func2(data21) < 1) {
              const err61 = {
                instancePath: instancePath + "/provider/provider_id",
                schemaPath: "#/$defs/provider/properties/provider_id/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err61];
              } else {
                vErrors.push(err61);
              }
              errors++;
            }
          } else {
            const err62 = {
              instancePath: instancePath + "/provider/provider_id",
              schemaPath: "#/$defs/provider/properties/provider_id/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err62];
            } else {
              vErrors.push(err62);
            }
            errors++;
          }
        }
        if (data19.model_id !== undefined) {
          let data22 = data19.model_id;
          if (typeof data22 === "string") {
            if (func2(data22) < 1) {
              const err63 = {
                instancePath: instancePath + "/provider/model_id",
                schemaPath: "#/$defs/provider/properties/model_id/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/provider/model_id",
              schemaPath: "#/$defs/provider/properties/model_id/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err64];
            } else {
              vErrors.push(err64);
            }
            errors++;
          }
        }
        if (data19.model_revision !== undefined) {
          let data23 = data19.model_revision;
          if (typeof data23 === "string") {
            if (func2(data23) < 1) {
              const err65 = {
                instancePath: instancePath + "/provider/model_revision",
                schemaPath: "#/$defs/provider/properties/model_revision/minLength",
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
              instancePath: instancePath + "/provider/model_revision",
              schemaPath: "#/$defs/provider/properties/model_revision/type",
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
      } else {
        const err67 = {
          instancePath: instancePath + "/provider",
          schemaPath: "#/$defs/provider/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err67];
        } else {
          vErrors.push(err67);
        }
        errors++;
      }
    }
    if (data.revisions !== undefined) {
      let data24 = data.revisions;
      if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
        if (data24.prompt_template_revision === undefined) {
          const err68 = {
            instancePath: instancePath + "/revisions",
            schemaPath: "#/$defs/revisions/required",
            keyword: "required",
            params: { missingProperty: "prompt_template_revision" },
            message: "must have required property '" + "prompt_template_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err68];
          } else {
            vErrors.push(err68);
          }
          errors++;
        }
        if (data24.policy_revision === undefined) {
          const err69 = {
            instancePath: instancePath + "/revisions",
            schemaPath: "#/$defs/revisions/required",
            keyword: "required",
            params: { missingProperty: "policy_revision" },
            message: "must have required property '" + "policy_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err69];
          } else {
            vErrors.push(err69);
          }
          errors++;
        }
        for (const key5 in data24) {
          if (!(key5 === "prompt_template_revision" || key5 === "policy_revision")) {
            const err70 = {
              instancePath: instancePath + "/revisions",
              schemaPath: "#/$defs/revisions/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key5 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err70];
            } else {
              vErrors.push(err70);
            }
            errors++;
          }
        }
        if (data24.prompt_template_revision !== undefined) {
          let data25 = data24.prompt_template_revision;
          if (typeof data25 === "string") {
            if (func2(data25) < 1) {
              const err71 = {
                instancePath: instancePath + "/revisions/prompt_template_revision",
                schemaPath: "#/$defs/revisions/properties/prompt_template_revision/minLength",
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
              instancePath: instancePath + "/revisions/prompt_template_revision",
              schemaPath: "#/$defs/revisions/properties/prompt_template_revision/type",
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
        if (data24.policy_revision !== undefined) {
          let data26 = data24.policy_revision;
          if (typeof data26 === "string") {
            if (func2(data26) < 1) {
              const err73 = {
                instancePath: instancePath + "/revisions/policy_revision",
                schemaPath: "#/$defs/revisions/properties/policy_revision/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/revisions/policy_revision",
              schemaPath: "#/$defs/revisions/properties/policy_revision/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
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
          instancePath: instancePath + "/revisions",
          schemaPath: "#/$defs/revisions/type",
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
    if (data.supported_locales !== undefined) {
      let data27 = data.supported_locales;
      if (Array.isArray(data27)) {
        const len0 = data27.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data28 = data27[i0];
          if (!(data28 === "en-US" || data28 === "zh-CN")) {
            const err76 = {
              instancePath: instancePath + "/supported_locales/" + i0,
              schemaPath: "#/properties/supported_locales/items/enum",
              keyword: "enum",
              params: { allowedValues: schema31.properties.supported_locales.items.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err76];
            } else {
              vErrors.push(err76);
            }
            errors++;
          }
        }
        let i1 = data27.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data27[i1], data27[j0])) {
                const err77 = {
                  instancePath: instancePath + "/supported_locales",
                  schemaPath: "#/properties/supported_locales/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err77];
                } else {
                  vErrors.push(err77);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err78 = {
          instancePath: instancePath + "/supported_locales",
          schemaPath: "#/properties/supported_locales/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err78];
        } else {
          vErrors.push(err78);
        }
        errors++;
      }
    }
    if (data.supported_task_kinds !== undefined) {
      let data29 = data.supported_task_kinds;
      if (Array.isArray(data29)) {
        const len1 = data29.length;
        for (let i2 = 0; i2 < len1; i2++) {
          let data30 = data29[i2];
          if (!(
            data30 === "explain_p99" ||
            data30 === "explain_tail" ||
            data30 === "summarize_validation" ||
            data30 === "draft_conditional_recommendations"
          )) {
            const err79 = {
              instancePath: instancePath + "/supported_task_kinds/" + i2,
              schemaPath: "#/properties/supported_task_kinds/items/enum",
              keyword: "enum",
              params: { allowedValues: schema31.properties.supported_task_kinds.items.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err79];
            } else {
              vErrors.push(err79);
            }
            errors++;
          }
        }
        let i3 = data29.length;
        let j1;
        if (i3 > 1) {
          outer1: for (; i3--;) {
            for (j1 = i3; j1--;) {
              if (func0(data29[i3], data29[j1])) {
                const err80 = {
                  instancePath: instancePath + "/supported_task_kinds",
                  schemaPath: "#/properties/supported_task_kinds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i3, j: j1 },
                  message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err80];
                } else {
                  vErrors.push(err80);
                }
                errors++;
                break outer1;
              }
            }
          }
        }
      } else {
        const err81 = {
          instancePath: instancePath + "/supported_task_kinds",
          schemaPath: "#/properties/supported_task_kinds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err81];
        } else {
          vErrors.push(err81);
        }
        errors++;
      }
    }
    if (data.limits !== undefined) {
      let data31 = data.limits;
      if (data31 && typeof data31 == "object" && !Array.isArray(data31)) {
        if (data31.maximum_request_bytes === undefined) {
          const err82 = {
            instancePath: instancePath + "/limits",
            schemaPath: "#/properties/limits/required",
            keyword: "required",
            params: { missingProperty: "maximum_request_bytes" },
            message: "must have required property '" + "maximum_request_bytes" + "'",
          };
          if (vErrors === null) {
            vErrors = [err82];
          } else {
            vErrors.push(err82);
          }
          errors++;
        }
        if (data31.maximum_question_characters === undefined) {
          const err83 = {
            instancePath: instancePath + "/limits",
            schemaPath: "#/properties/limits/required",
            keyword: "required",
            params: { missingProperty: "maximum_question_characters" },
            message: "must have required property '" + "maximum_question_characters" + "'",
          };
          if (vErrors === null) {
            vErrors = [err83];
          } else {
            vErrors.push(err83);
          }
          errors++;
        }
        if (data31.maximum_artifacts === undefined) {
          const err84 = {
            instancePath: instancePath + "/limits",
            schemaPath: "#/properties/limits/required",
            keyword: "required",
            params: { missingProperty: "maximum_artifacts" },
            message: "must have required property '" + "maximum_artifacts" + "'",
          };
          if (vErrors === null) {
            vErrors = [err84];
          } else {
            vErrors.push(err84);
          }
          errors++;
        }
        if (data31.maximum_records_per_artifact === undefined) {
          const err85 = {
            instancePath: instancePath + "/limits",
            schemaPath: "#/properties/limits/required",
            keyword: "required",
            params: { missingProperty: "maximum_records_per_artifact" },
            message: "must have required property '" + "maximum_records_per_artifact" + "'",
          };
          if (vErrors === null) {
            vErrors = [err85];
          } else {
            vErrors.push(err85);
          }
          errors++;
        }
        if (data31.maximum_claims === undefined) {
          const err86 = {
            instancePath: instancePath + "/limits",
            schemaPath: "#/properties/limits/required",
            keyword: "required",
            params: { missingProperty: "maximum_claims" },
            message: "must have required property '" + "maximum_claims" + "'",
          };
          if (vErrors === null) {
            vErrors = [err86];
          } else {
            vErrors.push(err86);
          }
          errors++;
        }
        if (data31.maximum_output_characters === undefined) {
          const err87 = {
            instancePath: instancePath + "/limits",
            schemaPath: "#/properties/limits/required",
            keyword: "required",
            params: { missingProperty: "maximum_output_characters" },
            message: "must have required property '" + "maximum_output_characters" + "'",
          };
          if (vErrors === null) {
            vErrors = [err87];
          } else {
            vErrors.push(err87);
          }
          errors++;
        }
        for (const key6 in data31) {
          if (!(
            key6 === "maximum_request_bytes" ||
            key6 === "maximum_question_characters" ||
            key6 === "maximum_artifacts" ||
            key6 === "maximum_records_per_artifact" ||
            key6 === "maximum_claims" ||
            key6 === "maximum_output_characters"
          )) {
            const err88 = {
              instancePath: instancePath + "/limits",
              schemaPath: "#/properties/limits/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key6 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err88];
            } else {
              vErrors.push(err88);
            }
            errors++;
          }
        }
        if (data31.maximum_request_bytes !== undefined) {
          let data32 = data31.maximum_request_bytes;
          if (!(typeof data32 == "number" && !(data32 % 1) && !isNaN(data32))) {
            const err89 = {
              instancePath: instancePath + "/limits/maximum_request_bytes",
              schemaPath: "#/properties/limits/properties/maximum_request_bytes/type",
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
          if (typeof data32 == "number") {
            if (data32 < 1 || isNaN(data32)) {
              const err90 = {
                instancePath: instancePath + "/limits/maximum_request_bytes",
                schemaPath: "#/properties/limits/properties/maximum_request_bytes/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
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
        if (data31.maximum_question_characters !== undefined) {
          let data33 = data31.maximum_question_characters;
          if (!(typeof data33 == "number" && !(data33 % 1) && !isNaN(data33))) {
            const err91 = {
              instancePath: instancePath + "/limits/maximum_question_characters",
              schemaPath: "#/properties/limits/properties/maximum_question_characters/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err91];
            } else {
              vErrors.push(err91);
            }
            errors++;
          }
          if (typeof data33 == "number") {
            if (data33 < 1 || isNaN(data33)) {
              const err92 = {
                instancePath: instancePath + "/limits/maximum_question_characters",
                schemaPath: "#/properties/limits/properties/maximum_question_characters/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err92];
              } else {
                vErrors.push(err92);
              }
              errors++;
            }
          }
        }
        if (data31.maximum_artifacts !== undefined) {
          let data34 = data31.maximum_artifacts;
          if (!(typeof data34 == "number" && !(data34 % 1) && !isNaN(data34))) {
            const err93 = {
              instancePath: instancePath + "/limits/maximum_artifacts",
              schemaPath: "#/properties/limits/properties/maximum_artifacts/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err93];
            } else {
              vErrors.push(err93);
            }
            errors++;
          }
          if (typeof data34 == "number") {
            if (data34 < 1 || isNaN(data34)) {
              const err94 = {
                instancePath: instancePath + "/limits/maximum_artifacts",
                schemaPath: "#/properties/limits/properties/maximum_artifacts/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
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
        if (data31.maximum_records_per_artifact !== undefined) {
          let data35 = data31.maximum_records_per_artifact;
          if (!(typeof data35 == "number" && !(data35 % 1) && !isNaN(data35))) {
            const err95 = {
              instancePath: instancePath + "/limits/maximum_records_per_artifact",
              schemaPath: "#/properties/limits/properties/maximum_records_per_artifact/type",
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
          if (typeof data35 == "number") {
            if (data35 < 1 || isNaN(data35)) {
              const err96 = {
                instancePath: instancePath + "/limits/maximum_records_per_artifact",
                schemaPath: "#/properties/limits/properties/maximum_records_per_artifact/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err96];
              } else {
                vErrors.push(err96);
              }
              errors++;
            }
          }
        }
        if (data31.maximum_claims !== undefined) {
          let data36 = data31.maximum_claims;
          if (!(typeof data36 == "number" && !(data36 % 1) && !isNaN(data36))) {
            const err97 = {
              instancePath: instancePath + "/limits/maximum_claims",
              schemaPath: "#/properties/limits/properties/maximum_claims/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err97];
            } else {
              vErrors.push(err97);
            }
            errors++;
          }
          if (typeof data36 == "number") {
            if (data36 < 1 || isNaN(data36)) {
              const err98 = {
                instancePath: instancePath + "/limits/maximum_claims",
                schemaPath: "#/properties/limits/properties/maximum_claims/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err98];
              } else {
                vErrors.push(err98);
              }
              errors++;
            }
          }
        }
        if (data31.maximum_output_characters !== undefined) {
          let data37 = data31.maximum_output_characters;
          if (!(typeof data37 == "number" && !(data37 % 1) && !isNaN(data37))) {
            const err99 = {
              instancePath: instancePath + "/limits/maximum_output_characters",
              schemaPath: "#/properties/limits/properties/maximum_output_characters/type",
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
          if (typeof data37 == "number") {
            if (data37 < 1 || isNaN(data37)) {
              const err100 = {
                instancePath: instancePath + "/limits/maximum_output_characters",
                schemaPath: "#/properties/limits/properties/maximum_output_characters/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err100];
              } else {
                vErrors.push(err100);
              }
              errors++;
            }
          }
        }
      } else {
        const err101 = {
          instancePath: instancePath + "/limits",
          schemaPath: "#/properties/limits/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err101];
        } else {
          vErrors.push(err101);
        }
        errors++;
      }
    }
    if (data.digest_contract !== undefined) {
      let data38 = data.digest_contract;
      if (data38 && typeof data38 == "object" && !Array.isArray(data38)) {
        if (data38.algorithm === undefined) {
          const err102 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "algorithm" },
            message: "must have required property '" + "algorithm" + "'",
          };
          if (vErrors === null) {
            vErrors = [err102];
          } else {
            vErrors.push(err102);
          }
          errors++;
        }
        if (data38.output_encoding === undefined) {
          const err103 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "output_encoding" },
            message: "must have required property '" + "output_encoding" + "'",
          };
          if (vErrors === null) {
            vErrors = [err103];
          } else {
            vErrors.push(err103);
          }
          errors++;
        }
        if (data38.canonicalization === undefined) {
          const err104 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "canonicalization" },
            message: "must have required property '" + "canonicalization" + "'",
          };
          if (vErrors === null) {
            vErrors = [err104];
          } else {
            vErrors.push(err104);
          }
          errors++;
        }
        if (data38.text_encoding === undefined) {
          const err105 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "text_encoding" },
            message: "must have required property '" + "text_encoding" + "'",
          };
          if (vErrors === null) {
            vErrors = [err105];
          } else {
            vErrors.push(err105);
          }
          errors++;
        }
        if (data38.object_key_order === undefined) {
          const err106 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "object_key_order" },
            message: "must have required property '" + "object_key_order" + "'",
          };
          if (vErrors === null) {
            vErrors = [err106];
          } else {
            vErrors.push(err106);
          }
          errors++;
        }
        if (data38.array_order === undefined) {
          const err107 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "array_order" },
            message: "must have required property '" + "array_order" + "'",
          };
          if (vErrors === null) {
            vErrors = [err107];
          } else {
            vErrors.push(err107);
          }
          errors++;
        }
        if (data38.separators === undefined) {
          const err108 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "separators" },
            message: "must have required property '" + "separators" + "'",
          };
          if (vErrors === null) {
            vErrors = [err108];
          } else {
            vErrors.push(err108);
          }
          errors++;
        }
        if (data38.non_ascii_escaping === undefined) {
          const err109 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "non_ascii_escaping" },
            message: "must have required property '" + "non_ascii_escaping" + "'",
          };
          if (vErrors === null) {
            vErrors = [err109];
          } else {
            vErrors.push(err109);
          }
          errors++;
        }
        if (data38.integer_encoding === undefined) {
          const err110 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "integer_encoding" },
            message: "must have required property '" + "integer_encoding" + "'",
          };
          if (vErrors === null) {
            vErrors = [err110];
          } else {
            vErrors.push(err110);
          }
          errors++;
        }
        if (data38.non_finite_numbers === undefined) {
          const err111 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "non_finite_numbers" },
            message: "must have required property '" + "non_finite_numbers" + "'",
          };
          if (vErrors === null) {
            vErrors = [err111];
          } else {
            vErrors.push(err111);
          }
          errors++;
        }
        if (data38.artifact_manifest_material === undefined) {
          const err112 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "artifact_manifest_material" },
            message: "must have required property '" + "artifact_manifest_material" + "'",
          };
          if (vErrors === null) {
            vErrors = [err112];
          } else {
            vErrors.push(err112);
          }
          errors++;
        }
        if (data38.input_snapshot_material_fields === undefined) {
          const err113 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "input_snapshot_material_fields" },
            message: "must have required property '" + "input_snapshot_material_fields" + "'",
          };
          if (vErrors === null) {
            vErrors = [err113];
          } else {
            vErrors.push(err113);
          }
          errors++;
        }
        if (data38.excluded_untrusted_fields === undefined) {
          const err114 = {
            instancePath: instancePath + "/digest_contract",
            schemaPath: "#/properties/digest_contract/required",
            keyword: "required",
            params: { missingProperty: "excluded_untrusted_fields" },
            message: "must have required property '" + "excluded_untrusted_fields" + "'",
          };
          if (vErrors === null) {
            vErrors = [err114];
          } else {
            vErrors.push(err114);
          }
          errors++;
        }
        for (const key7 in data38) {
          if (!func1.call(schema31.properties.digest_contract.properties, key7)) {
            const err115 = {
              instancePath: instancePath + "/digest_contract",
              schemaPath: "#/properties/digest_contract/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key7 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err115];
            } else {
              vErrors.push(err115);
            }
            errors++;
          }
        }
        if (data38.algorithm !== undefined) {
          if ("sha256" !== data38.algorithm) {
            const err116 = {
              instancePath: instancePath + "/digest_contract/algorithm",
              schemaPath: "#/properties/digest_contract/properties/algorithm/const",
              keyword: "const",
              params: { allowedValue: "sha256" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err116];
            } else {
              vErrors.push(err116);
            }
            errors++;
          }
        }
        if (data38.output_encoding !== undefined) {
          if ("lowercase_hex_with_sha256_prefix" !== data38.output_encoding) {
            const err117 = {
              instancePath: instancePath + "/digest_contract/output_encoding",
              schemaPath: "#/properties/digest_contract/properties/output_encoding/const",
              keyword: "const",
              params: { allowedValue: "lowercase_hex_with_sha256_prefix" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err117];
            } else {
              vErrors.push(err117);
            }
            errors++;
          }
        }
        if (data38.canonicalization !== undefined) {
          if ("tilesim.bridge.canonical_json.v1" !== data38.canonicalization) {
            const err118 = {
              instancePath: instancePath + "/digest_contract/canonicalization",
              schemaPath: "#/properties/digest_contract/properties/canonicalization/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.canonical_json.v1" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err118];
            } else {
              vErrors.push(err118);
            }
            errors++;
          }
        }
        if (data38.text_encoding !== undefined) {
          if ("utf-8" !== data38.text_encoding) {
            const err119 = {
              instancePath: instancePath + "/digest_contract/text_encoding",
              schemaPath: "#/properties/digest_contract/properties/text_encoding/const",
              keyword: "const",
              params: { allowedValue: "utf-8" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err119];
            } else {
              vErrors.push(err119);
            }
            errors++;
          }
        }
        if (data38.object_key_order !== undefined) {
          if ("unicode_code_point_ascending" !== data38.object_key_order) {
            const err120 = {
              instancePath: instancePath + "/digest_contract/object_key_order",
              schemaPath: "#/properties/digest_contract/properties/object_key_order/const",
              keyword: "const",
              params: { allowedValue: "unicode_code_point_ascending" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err120];
            } else {
              vErrors.push(err120);
            }
            errors++;
          }
        }
        if (data38.array_order !== undefined) {
          if ("preserved" !== data38.array_order) {
            const err121 = {
              instancePath: instancePath + "/digest_contract/array_order",
              schemaPath: "#/properties/digest_contract/properties/array_order/const",
              keyword: "const",
              params: { allowedValue: "preserved" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err121];
            } else {
              vErrors.push(err121);
            }
            errors++;
          }
        }
        if (data38.separators !== undefined) {
          if ("comma_colon_no_whitespace" !== data38.separators) {
            const err122 = {
              instancePath: instancePath + "/digest_contract/separators",
              schemaPath: "#/properties/digest_contract/properties/separators/const",
              keyword: "const",
              params: { allowedValue: "comma_colon_no_whitespace" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err122];
            } else {
              vErrors.push(err122);
            }
            errors++;
          }
        }
        if (data38.non_ascii_escaping !== undefined) {
          if ("preserve_utf8" !== data38.non_ascii_escaping) {
            const err123 = {
              instancePath: instancePath + "/digest_contract/non_ascii_escaping",
              schemaPath: "#/properties/digest_contract/properties/non_ascii_escaping/const",
              keyword: "const",
              params: { allowedValue: "preserve_utf8" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err123];
            } else {
              vErrors.push(err123);
            }
            errors++;
          }
        }
        if (data38.integer_encoding !== undefined) {
          if ("canonical_decimal_json_token_lossless" !== data38.integer_encoding) {
            const err124 = {
              instancePath: instancePath + "/digest_contract/integer_encoding",
              schemaPath: "#/properties/digest_contract/properties/integer_encoding/const",
              keyword: "const",
              params: { allowedValue: "canonical_decimal_json_token_lossless" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err124];
            } else {
              vErrors.push(err124);
            }
            errors++;
          }
        }
        if (data38.non_finite_numbers !== undefined) {
          if ("forbidden" !== data38.non_finite_numbers) {
            const err125 = {
              instancePath: instancePath + "/digest_contract/non_finite_numbers",
              schemaPath: "#/properties/digest_contract/properties/non_finite_numbers/const",
              keyword: "const",
              params: { allowedValue: "forbidden" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err125];
            } else {
              vErrors.push(err125);
            }
            errors++;
          }
        }
        if (data38.artifact_manifest_material !== undefined) {
          if ("entire_verified_manifest_object" !== data38.artifact_manifest_material) {
            const err126 = {
              instancePath: instancePath + "/digest_contract/artifact_manifest_material",
              schemaPath: "#/properties/digest_contract/properties/artifact_manifest_material/const",
              keyword: "const",
              params: { allowedValue: "entire_verified_manifest_object" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err126];
            } else {
              vErrors.push(err126);
            }
            errors++;
          }
        }
        if (data38.input_snapshot_material_fields !== undefined) {
          let data50 = data38.input_snapshot_material_fields;
          if (Array.isArray(data50)) {
            if (data50.length > 6) {
              const err127 = {
                instancePath: instancePath + "/digest_contract/input_snapshot_material_fields",
                schemaPath: "#/properties/digest_contract/properties/input_snapshot_material_fields/maxItems",
                keyword: "maxItems",
                params: { limit: 6 },
                message: "must NOT have more than 6 items",
              };
              if (vErrors === null) {
                vErrors = [err127];
              } else {
                vErrors.push(err127);
              }
              errors++;
            }
            if (data50.length < 6) {
              const err128 = {
                instancePath: instancePath + "/digest_contract/input_snapshot_material_fields",
                schemaPath: "#/properties/digest_contract/properties/input_snapshot_material_fields/minItems",
                keyword: "minItems",
                params: { limit: 6 },
                message: "must NOT have fewer than 6 items",
              };
              if (vErrors === null) {
                vErrors = [err128];
              } else {
                vErrors.push(err128);
              }
              errors++;
            }
            const len2 = data50.length;
            if (len2 > 0) {
              if ("schema_version" !== data50[0]) {
                const err129 = {
                  instancePath: instancePath + "/digest_contract/input_snapshot_material_fields/0",
                  schemaPath:
                    "#/properties/digest_contract/properties/input_snapshot_material_fields/prefixItems/0/const",
                  keyword: "const",
                  params: { allowedValue: "schema_version" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err129];
                } else {
                  vErrors.push(err129);
                }
                errors++;
              }
            }
            if (len2 > 1) {
              if ("schema_set_revision" !== data50[1]) {
                const err130 = {
                  instancePath: instancePath + "/digest_contract/input_snapshot_material_fields/1",
                  schemaPath:
                    "#/properties/digest_contract/properties/input_snapshot_material_fields/prefixItems/1/const",
                  keyword: "const",
                  params: { allowedValue: "schema_set_revision" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err130];
                } else {
                  vErrors.push(err130);
                }
                errors++;
              }
            }
            if (len2 > 2) {
              if ("run_id" !== data50[2]) {
                const err131 = {
                  instancePath: instancePath + "/digest_contract/input_snapshot_material_fields/2",
                  schemaPath:
                    "#/properties/digest_contract/properties/input_snapshot_material_fields/prefixItems/2/const",
                  keyword: "const",
                  params: { allowedValue: "run_id" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err131];
                } else {
                  vErrors.push(err131);
                }
                errors++;
              }
            }
            if (len2 > 3) {
              if ("structured_report_schema_identity" !== data50[3]) {
                const err132 = {
                  instancePath: instancePath + "/digest_contract/input_snapshot_material_fields/3",
                  schemaPath:
                    "#/properties/digest_contract/properties/input_snapshot_material_fields/prefixItems/3/const",
                  keyword: "const",
                  params: { allowedValue: "structured_report_schema_identity" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err132];
                } else {
                  vErrors.push(err132);
                }
                errors++;
              }
            }
            if (len2 > 4) {
              if ("snapshot_reference" !== data50[4]) {
                const err133 = {
                  instancePath: instancePath + "/digest_contract/input_snapshot_material_fields/4",
                  schemaPath:
                    "#/properties/digest_contract/properties/input_snapshot_material_fields/prefixItems/4/const",
                  keyword: "const",
                  params: { allowedValue: "snapshot_reference" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err133];
                } else {
                  vErrors.push(err133);
                }
                errors++;
              }
            }
            if (len2 > 5) {
              if ("artifact_allow_list" !== data50[5]) {
                const err134 = {
                  instancePath: instancePath + "/digest_contract/input_snapshot_material_fields/5",
                  schemaPath:
                    "#/properties/digest_contract/properties/input_snapshot_material_fields/prefixItems/5/const",
                  keyword: "const",
                  params: { allowedValue: "artifact_allow_list" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err134];
                } else {
                  vErrors.push(err134);
                }
                errors++;
              }
            }
            const len3 = data50.length;
            if (!(len3 <= 6)) {
              const err135 = {
                instancePath: instancePath + "/digest_contract/input_snapshot_material_fields",
                schemaPath: "#/properties/digest_contract/properties/input_snapshot_material_fields/items",
                keyword: "items",
                params: { limit: 6 },
                message: "must NOT have more than 6 items",
              };
              if (vErrors === null) {
                vErrors = [err135];
              } else {
                vErrors.push(err135);
              }
              errors++;
            }
          } else {
            const err136 = {
              instancePath: instancePath + "/digest_contract/input_snapshot_material_fields",
              schemaPath: "#/properties/digest_contract/properties/input_snapshot_material_fields/type",
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
        if (data38.excluded_untrusted_fields !== undefined) {
          let data57 = data38.excluded_untrusted_fields;
          if (Array.isArray(data57)) {
            if (data57.length > 4) {
              const err137 = {
                instancePath: instancePath + "/digest_contract/excluded_untrusted_fields",
                schemaPath: "#/properties/digest_contract/properties/excluded_untrusted_fields/maxItems",
                keyword: "maxItems",
                params: { limit: 4 },
                message: "must NOT have more than 4 items",
              };
              if (vErrors === null) {
                vErrors = [err137];
              } else {
                vErrors.push(err137);
              }
              errors++;
            }
            if (data57.length < 4) {
              const err138 = {
                instancePath: instancePath + "/digest_contract/excluded_untrusted_fields",
                schemaPath: "#/properties/digest_contract/properties/excluded_untrusted_fields/minItems",
                keyword: "minItems",
                params: { limit: 4 },
                message: "must NOT have fewer than 4 items",
              };
              if (vErrors === null) {
                vErrors = [err138];
              } else {
                vErrors.push(err138);
              }
              errors++;
            }
            const len4 = data57.length;
            if (len4 > 0) {
              if ("locale" !== data57[0]) {
                const err139 = {
                  instancePath: instancePath + "/digest_contract/excluded_untrusted_fields/0",
                  schemaPath: "#/properties/digest_contract/properties/excluded_untrusted_fields/prefixItems/0/const",
                  keyword: "const",
                  params: { allowedValue: "locale" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err139];
                } else {
                  vErrors.push(err139);
                }
                errors++;
              }
            }
            if (len4 > 1) {
              if ("task_kind" !== data57[1]) {
                const err140 = {
                  instancePath: instancePath + "/digest_contract/excluded_untrusted_fields/1",
                  schemaPath: "#/properties/digest_contract/properties/excluded_untrusted_fields/prefixItems/1/const",
                  keyword: "const",
                  params: { allowedValue: "task_kind" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err140];
                } else {
                  vErrors.push(err140);
                }
                errors++;
              }
            }
            if (len4 > 2) {
              if ("client_request_id" !== data57[2]) {
                const err141 = {
                  instancePath: instancePath + "/digest_contract/excluded_untrusted_fields/2",
                  schemaPath: "#/properties/digest_contract/properties/excluded_untrusted_fields/prefixItems/2/const",
                  keyword: "const",
                  params: { allowedValue: "client_request_id" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err141];
                } else {
                  vErrors.push(err141);
                }
                errors++;
              }
            }
            if (len4 > 3) {
              if ("user_question" !== data57[3]) {
                const err142 = {
                  instancePath: instancePath + "/digest_contract/excluded_untrusted_fields/3",
                  schemaPath: "#/properties/digest_contract/properties/excluded_untrusted_fields/prefixItems/3/const",
                  keyword: "const",
                  params: { allowedValue: "user_question" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err142];
                } else {
                  vErrors.push(err142);
                }
                errors++;
              }
            }
            const len5 = data57.length;
            if (!(len5 <= 4)) {
              const err143 = {
                instancePath: instancePath + "/digest_contract/excluded_untrusted_fields",
                schemaPath: "#/properties/digest_contract/properties/excluded_untrusted_fields/items",
                keyword: "items",
                params: { limit: 4 },
                message: "must NOT have more than 4 items",
              };
              if (vErrors === null) {
                vErrors = [err143];
              } else {
                vErrors.push(err143);
              }
              errors++;
            }
          } else {
            const err144 = {
              instancePath: instancePath + "/digest_contract/excluded_untrusted_fields",
              schemaPath: "#/properties/digest_contract/properties/excluded_untrusted_fields/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
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
          instancePath: instancePath + "/digest_contract",
          schemaPath: "#/properties/digest_contract/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err145];
        } else {
          vErrors.push(err145);
        }
        errors++;
      }
    }
    if (data.tools !== undefined) {
      let data62 = data.tools;
      if (data62 && typeof data62 == "object" && !Array.isArray(data62)) {
        if (data62.allowed === undefined) {
          const err146 = {
            instancePath: instancePath + "/tools",
            schemaPath: "#/properties/tools/required",
            keyword: "required",
            params: { missingProperty: "allowed" },
            message: "must have required property '" + "allowed" + "'",
          };
          if (vErrors === null) {
            vErrors = [err146];
          } else {
            vErrors.push(err146);
          }
          errors++;
        }
        if (data62.forbidden === undefined) {
          const err147 = {
            instancePath: instancePath + "/tools",
            schemaPath: "#/properties/tools/required",
            keyword: "required",
            params: { missingProperty: "forbidden" },
            message: "must have required property '" + "forbidden" + "'",
          };
          if (vErrors === null) {
            vErrors = [err147];
          } else {
            vErrors.push(err147);
          }
          errors++;
        }
        if (data62.allow_list_expansion === undefined) {
          const err148 = {
            instancePath: instancePath + "/tools",
            schemaPath: "#/properties/tools/required",
            keyword: "required",
            params: { missingProperty: "allow_list_expansion" },
            message: "must have required property '" + "allow_list_expansion" + "'",
          };
          if (vErrors === null) {
            vErrors = [err148];
          } else {
            vErrors.push(err148);
          }
          errors++;
        }
        for (const key8 in data62) {
          if (!(key8 === "allowed" || key8 === "forbidden" || key8 === "allow_list_expansion")) {
            const err149 = {
              instancePath: instancePath + "/tools",
              schemaPath: "#/properties/tools/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key8 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err149];
            } else {
              vErrors.push(err149);
            }
            errors++;
          }
        }
        if (data62.allowed !== undefined) {
          let data63 = data62.allowed;
          if (Array.isArray(data63)) {
            const len6 = data63.length;
            for (let i4 = 0; i4 < len6; i4++) {
              let data64 = data63[i4];
              if (!(data64 === "verified_snapshot_read" || data64 === "citation_resolution")) {
                const err150 = {
                  instancePath: instancePath + "/tools/allowed/" + i4,
                  schemaPath: "#/properties/tools/properties/allowed/items/enum",
                  keyword: "enum",
                  params: { allowedValues: schema31.properties.tools.properties.allowed.items.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err150];
                } else {
                  vErrors.push(err150);
                }
                errors++;
              }
            }
            let i5 = data63.length;
            let j2;
            if (i5 > 1) {
              outer2: for (; i5--;) {
                for (j2 = i5; j2--;) {
                  if (func0(data63[i5], data63[j2])) {
                    const err151 = {
                      instancePath: instancePath + "/tools/allowed",
                      schemaPath: "#/properties/tools/properties/allowed/uniqueItems",
                      keyword: "uniqueItems",
                      params: { i: i5, j: j2 },
                      message: "must NOT have duplicate items (items ## " + j2 + " and " + i5 + " are identical)",
                    };
                    if (vErrors === null) {
                      vErrors = [err151];
                    } else {
                      vErrors.push(err151);
                    }
                    errors++;
                    break outer2;
                  }
                }
              }
            }
          } else {
            const err152 = {
              instancePath: instancePath + "/tools/allowed",
              schemaPath: "#/properties/tools/properties/allowed/type",
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
        if (data62.forbidden !== undefined) {
          let data65 = data62.forbidden;
          if (Array.isArray(data65)) {
            const len7 = data65.length;
            for (let i6 = 0; i6 < len7; i6++) {
              if (typeof data65[i6] !== "string") {
                const err153 = {
                  instancePath: instancePath + "/tools/forbidden/" + i6,
                  schemaPath: "#/properties/tools/properties/forbidden/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err153];
                } else {
                  vErrors.push(err153);
                }
                errors++;
              }
            }
            let i7 = data65.length;
            let j3;
            if (i7 > 1) {
              const indices0 = {};
              for (; i7--;) {
                let item0 = data65[i7];
                if (typeof item0 !== "string") {
                  continue;
                }
                if (typeof indices0[item0] == "number") {
                  j3 = indices0[item0];
                  const err154 = {
                    instancePath: instancePath + "/tools/forbidden",
                    schemaPath: "#/properties/tools/properties/forbidden/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i7, j: j3 },
                    message: "must NOT have duplicate items (items ## " + j3 + " and " + i7 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err154];
                  } else {
                    vErrors.push(err154);
                  }
                  errors++;
                  break;
                }
                indices0[item0] = i7;
              }
            }
          } else {
            const err155 = {
              instancePath: instancePath + "/tools/forbidden",
              schemaPath: "#/properties/tools/properties/forbidden/type",
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
        if (data62.allow_list_expansion !== undefined) {
          if (false !== data62.allow_list_expansion) {
            const err156 = {
              instancePath: instancePath + "/tools/allow_list_expansion",
              schemaPath: "#/properties/tools/properties/allow_list_expansion/const",
              keyword: "const",
              params: { allowedValue: false },
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
          instancePath: instancePath + "/tools",
          schemaPath: "#/properties/tools/type",
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
    }
    if (data.persistence !== undefined) {
      let data68 = data.persistence;
      if (data68 && typeof data68 == "object" && !Array.isArray(data68)) {
        if (data68.mode === undefined) {
          const err158 = {
            instancePath: instancePath + "/persistence",
            schemaPath: "#/$defs/persistencePolicy/required",
            keyword: "required",
            params: { missingProperty: "mode" },
            message: "must have required property '" + "mode" + "'",
          };
          if (vErrors === null) {
            vErrors = [err158];
          } else {
            vErrors.push(err158);
          }
          errors++;
        }
        if (data68.retention_seconds === undefined) {
          const err159 = {
            instancePath: instancePath + "/persistence",
            schemaPath: "#/$defs/persistencePolicy/required",
            keyword: "required",
            params: { missingProperty: "retention_seconds" },
            message: "must have required property '" + "retention_seconds" + "'",
          };
          if (vErrors === null) {
            vErrors = [err159];
          } else {
            vErrors.push(err159);
          }
          errors++;
        }
        if (data68.snapshot_payload_retained === undefined) {
          const err160 = {
            instancePath: instancePath + "/persistence",
            schemaPath: "#/$defs/persistencePolicy/required",
            keyword: "required",
            params: { missingProperty: "snapshot_payload_retained" },
            message: "must have required property '" + "snapshot_payload_retained" + "'",
          };
          if (vErrors === null) {
            vErrors = [err160];
          } else {
            vErrors.push(err160);
          }
          errors++;
        }
        if (data68.user_question_retained === undefined) {
          const err161 = {
            instancePath: instancePath + "/persistence",
            schemaPath: "#/$defs/persistencePolicy/required",
            keyword: "required",
            params: { missingProperty: "user_question_retained" },
            message: "must have required property '" + "user_question_retained" + "'",
          };
          if (vErrors === null) {
            vErrors = [err161];
          } else {
            vErrors.push(err161);
          }
          errors++;
        }
        if (data68.hidden_reasoning_retained === undefined) {
          const err162 = {
            instancePath: instancePath + "/persistence",
            schemaPath: "#/$defs/persistencePolicy/required",
            keyword: "required",
            params: { missingProperty: "hidden_reasoning_retained" },
            message: "must have required property '" + "hidden_reasoning_retained" + "'",
          };
          if (vErrors === null) {
            vErrors = [err162];
          } else {
            vErrors.push(err162);
          }
          errors++;
        }
        for (const key9 in data68) {
          if (!(
            key9 === "mode" ||
            key9 === "retention_seconds" ||
            key9 === "snapshot_payload_retained" ||
            key9 === "user_question_retained" ||
            key9 === "hidden_reasoning_retained"
          )) {
            const err163 = {
              instancePath: instancePath + "/persistence",
              schemaPath: "#/$defs/persistencePolicy/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key9 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err163];
            } else {
              vErrors.push(err163);
            }
            errors++;
          }
        }
        if (data68.mode !== undefined) {
          if ("run_local_terminal_metadata_only" !== data68.mode) {
            const err164 = {
              instancePath: instancePath + "/persistence/mode",
              schemaPath: "#/$defs/persistencePolicy/properties/mode/const",
              keyword: "const",
              params: { allowedValue: "run_local_terminal_metadata_only" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err164];
            } else {
              vErrors.push(err164);
            }
            errors++;
          }
        }
        if (data68.retention_seconds !== undefined) {
          let data70 = data68.retention_seconds;
          if (!(typeof data70 == "number" && !(data70 % 1) && !isNaN(data70))) {
            const err165 = {
              instancePath: instancePath + "/persistence/retention_seconds",
              schemaPath: "#/$defs/persistencePolicy/properties/retention_seconds/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err165];
            } else {
              vErrors.push(err165);
            }
            errors++;
          }
          if (typeof data70 == "number") {
            if (data70 < 0 || isNaN(data70)) {
              const err166 = {
                instancePath: instancePath + "/persistence/retention_seconds",
                schemaPath: "#/$defs/persistencePolicy/properties/retention_seconds/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err166];
              } else {
                vErrors.push(err166);
              }
              errors++;
            }
          }
        }
        if (data68.snapshot_payload_retained !== undefined) {
          if (false !== data68.snapshot_payload_retained) {
            const err167 = {
              instancePath: instancePath + "/persistence/snapshot_payload_retained",
              schemaPath: "#/$defs/persistencePolicy/properties/snapshot_payload_retained/const",
              keyword: "const",
              params: { allowedValue: false },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err167];
            } else {
              vErrors.push(err167);
            }
            errors++;
          }
        }
        if (data68.user_question_retained !== undefined) {
          if (false !== data68.user_question_retained) {
            const err168 = {
              instancePath: instancePath + "/persistence/user_question_retained",
              schemaPath: "#/$defs/persistencePolicy/properties/user_question_retained/const",
              keyword: "const",
              params: { allowedValue: false },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err168];
            } else {
              vErrors.push(err168);
            }
            errors++;
          }
        }
        if (data68.hidden_reasoning_retained !== undefined) {
          if (false !== data68.hidden_reasoning_retained) {
            const err169 = {
              instancePath: instancePath + "/persistence/hidden_reasoning_retained",
              schemaPath: "#/$defs/persistencePolicy/properties/hidden_reasoning_retained/const",
              keyword: "const",
              params: { allowedValue: false },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err169];
            } else {
              vErrors.push(err169);
            }
            errors++;
          }
        }
      } else {
        const err170 = {
          instancePath: instancePath + "/persistence",
          schemaPath: "#/$defs/persistencePolicy/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err170];
        } else {
          vErrors.push(err170);
        }
        errors++;
      }
    }
    if (data.redaction !== undefined) {
      let data74 = data.redaction;
      if (data74 && typeof data74 == "object" && !Array.isArray(data74)) {
        if (data74.user_question === undefined) {
          const err171 = {
            instancePath: instancePath + "/redaction",
            schemaPath: "#/properties/redaction/required",
            keyword: "required",
            params: { missingProperty: "user_question" },
            message: "must have required property '" + "user_question" + "'",
          };
          if (vErrors === null) {
            vErrors = [err171];
          } else {
            vErrors.push(err171);
          }
          errors++;
        }
        if (data74.artifact_content === undefined) {
          const err172 = {
            instancePath: instancePath + "/redaction",
            schemaPath: "#/properties/redaction/required",
            keyword: "required",
            params: { missingProperty: "artifact_content" },
            message: "must have required property '" + "artifact_content" + "'",
          };
          if (vErrors === null) {
            vErrors = [err172];
          } else {
            vErrors.push(err172);
          }
          errors++;
        }
        if (data74.credentials === undefined) {
          const err173 = {
            instancePath: instancePath + "/redaction",
            schemaPath: "#/properties/redaction/required",
            keyword: "required",
            params: { missingProperty: "credentials" },
            message: "must have required property '" + "credentials" + "'",
          };
          if (vErrors === null) {
            vErrors = [err173];
          } else {
            vErrors.push(err173);
          }
          errors++;
        }
        if (data74.hidden_chain_of_thought === undefined) {
          const err174 = {
            instancePath: instancePath + "/redaction",
            schemaPath: "#/properties/redaction/required",
            keyword: "required",
            params: { missingProperty: "hidden_chain_of_thought" },
            message: "must have required property '" + "hidden_chain_of_thought" + "'",
          };
          if (vErrors === null) {
            vErrors = [err174];
          } else {
            vErrors.push(err174);
          }
          errors++;
        }
        for (const key10 in data74) {
          if (!(
            key10 === "user_question" ||
            key10 === "artifact_content" ||
            key10 === "credentials" ||
            key10 === "hidden_chain_of_thought"
          )) {
            const err175 = {
              instancePath: instancePath + "/redaction",
              schemaPath: "#/properties/redaction/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key10 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err175];
            } else {
              vErrors.push(err175);
            }
            errors++;
          }
        }
        if (data74.user_question !== undefined) {
          if ("digest_only" !== data74.user_question) {
            const err176 = {
              instancePath: instancePath + "/redaction/user_question",
              schemaPath: "#/properties/redaction/properties/user_question/const",
              keyword: "const",
              params: { allowedValue: "digest_only" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err176];
            } else {
              vErrors.push(err176);
            }
            errors++;
          }
        }
        if (data74.artifact_content !== undefined) {
          if ("not_retained" !== data74.artifact_content) {
            const err177 = {
              instancePath: instancePath + "/redaction/artifact_content",
              schemaPath: "#/properties/redaction/properties/artifact_content/const",
              keyword: "const",
              params: { allowedValue: "not_retained" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err177];
            } else {
              vErrors.push(err177);
            }
            errors++;
          }
        }
        if (data74.credentials !== undefined) {
          if ("never_retained" !== data74.credentials) {
            const err178 = {
              instancePath: instancePath + "/redaction/credentials",
              schemaPath: "#/properties/redaction/properties/credentials/const",
              keyword: "const",
              params: { allowedValue: "never_retained" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err178];
            } else {
              vErrors.push(err178);
            }
            errors++;
          }
        }
        if (data74.hidden_chain_of_thought !== undefined) {
          if ("never_returned_or_retained" !== data74.hidden_chain_of_thought) {
            const err179 = {
              instancePath: instancePath + "/redaction/hidden_chain_of_thought",
              schemaPath: "#/properties/redaction/properties/hidden_chain_of_thought/const",
              keyword: "const",
              params: { allowedValue: "never_returned_or_retained" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err179];
            } else {
              vErrors.push(err179);
            }
            errors++;
          }
        }
      } else {
        const err180 = {
          instancePath: instancePath + "/redaction",
          schemaPath: "#/properties/redaction/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err180];
        } else {
          vErrors.push(err180);
        }
        errors++;
      }
    }
    if (data.execution !== undefined) {
      let data79 = data.execution;
      if (data79 && typeof data79 == "object" && !Array.isArray(data79)) {
        if (data79.mode === undefined) {
          const err181 = {
            instancePath: instancePath + "/execution",
            schemaPath: "#/properties/execution/required",
            keyword: "required",
            params: { missingProperty: "mode" },
            message: "must have required property '" + "mode" + "'",
          };
          if (vErrors === null) {
            vErrors = [err181];
          } else {
            vErrors.push(err181);
          }
          errors++;
        }
        if (data79.timeout_ms === undefined) {
          const err182 = {
            instancePath: instancePath + "/execution",
            schemaPath: "#/properties/execution/required",
            keyword: "required",
            params: { missingProperty: "timeout_ms" },
            message: "must have required property '" + "timeout_ms" + "'",
          };
          if (vErrors === null) {
            vErrors = [err182];
          } else {
            vErrors.push(err182);
          }
          errors++;
        }
        if (data79.cancellation === undefined) {
          const err183 = {
            instancePath: instancePath + "/execution",
            schemaPath: "#/properties/execution/required",
            keyword: "required",
            params: { missingProperty: "cancellation" },
            message: "must have required property '" + "cancellation" + "'",
          };
          if (vErrors === null) {
            vErrors = [err183];
          } else {
            vErrors.push(err183);
          }
          errors++;
        }
        if (data79.maximum_concurrent_operations === undefined) {
          const err184 = {
            instancePath: instancePath + "/execution",
            schemaPath: "#/properties/execution/required",
            keyword: "required",
            params: { missingProperty: "maximum_concurrent_operations" },
            message: "must have required property '" + "maximum_concurrent_operations" + "'",
          };
          if (vErrors === null) {
            vErrors = [err184];
          } else {
            vErrors.push(err184);
          }
          errors++;
        }
        if (data79.retry === undefined) {
          const err185 = {
            instancePath: instancePath + "/execution",
            schemaPath: "#/properties/execution/required",
            keyword: "required",
            params: { missingProperty: "retry" },
            message: "must have required property '" + "retry" + "'",
          };
          if (vErrors === null) {
            vErrors = [err185];
          } else {
            vErrors.push(err185);
          }
          errors++;
        }
        if (data79.terminal_recovery === undefined) {
          const err186 = {
            instancePath: instancePath + "/execution",
            schemaPath: "#/properties/execution/required",
            keyword: "required",
            params: { missingProperty: "terminal_recovery" },
            message: "must have required property '" + "terminal_recovery" + "'",
          };
          if (vErrors === null) {
            vErrors = [err186];
          } else {
            vErrors.push(err186);
          }
          errors++;
        }
        for (const key11 in data79) {
          if (!(
            key11 === "mode" ||
            key11 === "timeout_ms" ||
            key11 === "cancellation" ||
            key11 === "maximum_concurrent_operations" ||
            key11 === "retry" ||
            key11 === "terminal_recovery"
          )) {
            const err187 = {
              instancePath: instancePath + "/execution",
              schemaPath: "#/properties/execution/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key11 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err187];
            } else {
              vErrors.push(err187);
            }
            errors++;
          }
        }
        if (data79.mode !== undefined) {
          if ("synchronous_terminal" !== data79.mode) {
            const err188 = {
              instancePath: instancePath + "/execution/mode",
              schemaPath: "#/properties/execution/properties/mode/const",
              keyword: "const",
              params: { allowedValue: "synchronous_terminal" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err188];
            } else {
              vErrors.push(err188);
            }
            errors++;
          }
        }
        if (data79.timeout_ms !== undefined) {
          let data81 = data79.timeout_ms;
          if (!(typeof data81 == "number" && !(data81 % 1) && !isNaN(data81))) {
            const err189 = {
              instancePath: instancePath + "/execution/timeout_ms",
              schemaPath: "#/properties/execution/properties/timeout_ms/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err189];
            } else {
              vErrors.push(err189);
            }
            errors++;
          }
          if (typeof data81 == "number") {
            if (data81 < 1 || isNaN(data81)) {
              const err190 = {
                instancePath: instancePath + "/execution/timeout_ms",
                schemaPath: "#/properties/execution/properties/timeout_ms/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err190];
              } else {
                vErrors.push(err190);
              }
              errors++;
            }
          }
        }
        if (data79.cancellation !== undefined) {
          if ("not_applicable_after_synchronous_terminal_response" !== data79.cancellation) {
            const err191 = {
              instancePath: instancePath + "/execution/cancellation",
              schemaPath: "#/properties/execution/properties/cancellation/const",
              keyword: "const",
              params: { allowedValue: "not_applicable_after_synchronous_terminal_response" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err191];
            } else {
              vErrors.push(err191);
            }
            errors++;
          }
        }
        if (data79.maximum_concurrent_operations !== undefined) {
          if (1 !== data79.maximum_concurrent_operations) {
            const err192 = {
              instancePath: instancePath + "/execution/maximum_concurrent_operations",
              schemaPath: "#/properties/execution/properties/maximum_concurrent_operations/const",
              keyword: "const",
              params: { allowedValue: 1 },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err192];
            } else {
              vErrors.push(err192);
            }
            errors++;
          }
        }
        if (data79.retry !== undefined) {
          if ("same_idempotency_key_and_same_payload_replays_terminal_result" !== data79.retry) {
            const err193 = {
              instancePath: instancePath + "/execution/retry",
              schemaPath: "#/properties/execution/properties/retry/const",
              keyword: "const",
              params: { allowedValue: "same_idempotency_key_and_same_payload_replays_terminal_result" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err193];
            } else {
              vErrors.push(err193);
            }
            errors++;
          }
        }
        if (data79.terminal_recovery !== undefined) {
          if ("run_local_redacted_terminal_record" !== data79.terminal_recovery) {
            const err194 = {
              instancePath: instancePath + "/execution/terminal_recovery",
              schemaPath: "#/properties/execution/properties/terminal_recovery/const",
              keyword: "const",
              params: { allowedValue: "run_local_redacted_terminal_record" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err194];
            } else {
              vErrors.push(err194);
            }
            errors++;
          }
        }
      } else {
        const err195 = {
          instancePath: instancePath + "/execution",
          schemaPath: "#/properties/execution/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err195];
        } else {
          vErrors.push(err195);
        }
        errors++;
      }
    }
  } else {
    const err196 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err196];
    } else {
      vErrors.push(err196);
    }
    errors++;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const evidenceAgentResponse = validate21;
const schema37 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/evidence-agent-response.schema.json",
  "x-tilesim-schema-identity": "tilesim.bridge.evidence_agent_response.v1",
  title: "EvidenceAgentResponse",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "schema_set_revision",
    "request_id",
    "client_request_id",
    "run_id",
    "input_snapshot_digest",
    "completion_state",
    "provider",
    "revisions",
    "claims",
    "refusal",
    "partial",
    "truncated",
    "degradation",
    "audit_summary",
    "generated_at",
    "persistence",
    "staleness",
  ],
  properties: {
    schema_version: { const: "tilesim.bridge.evidence_agent_response.v1" },
    schema_set_revision: { $ref: "#/$defs/revision" },
    request_id: { type: "string", pattern: "^agent-[A-Za-z0-9._:-]+$" },
    client_request_id: { type: "string", pattern: "^[A-Za-z0-9._:-]{8,128}$" },
    run_id: { type: "string", pattern: "^run-[A-Za-z0-9._-]+$" },
    input_snapshot_digest: { $ref: "#/$defs/revision" },
    completion_state: { enum: ["completed", "refused", "partial", "truncated", "failed", "timeout", "cancelled"] },
    provider: { $ref: "#/$defs/provider" },
    revisions: {
      type: "object",
      additionalProperties: false,
      required: ["prompt_template_revision", "policy_revision"],
      properties: {
        prompt_template_revision: { type: "string", minLength: 1 },
        policy_revision: { type: "string", minLength: 1 },
      },
    },
    claims: { type: "array", maxItems: 128, items: { $ref: "#/$defs/claim" } },
    refusal: { oneOf: [{ type: "null" }, { $ref: "#/$defs/refusal" }] },
    partial: { type: "boolean" },
    truncated: { type: "boolean" },
    degradation: {
      type: "object",
      additionalProperties: false,
      required: ["state", "reason_code"],
      properties: { state: { type: "string", minLength: 1 }, reason_code: { type: "string", minLength: 1 } },
    },
    audit_summary: {
      type: "object",
      additionalProperties: false,
      required: ["operations", "tool_invocation_count", "hidden_reasoning_returned"],
      properties: {
        operations: {
          type: "array",
          items: { enum: ["verified_snapshot_read", "citation_resolution"] },
          uniqueItems: true,
        },
        tool_invocation_count: { type: "integer", minimum: 0 },
        hidden_reasoning_returned: { const: false },
      },
    },
    generated_at: { type: "string", format: "date-time" },
    persistence: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "retained_until", "snapshot_payload_retained", "user_question_retained"],
      properties: {
        mode: { const: "run_local_terminal_metadata_only" },
        retained_until: { type: ["string", "null"], format: "date-time" },
        snapshot_payload_retained: { const: false },
        user_question_retained: { const: false },
      },
    },
    staleness: {
      type: "object",
      additionalProperties: false,
      required: ["state", "binding_fields"],
      properties: {
        state: { enum: ["current_at_generation", "stale"] },
        binding_fields: {
          type: "array",
          items: { enum: ["run_id", "input_snapshot_digest", "schema_set_revision", "backend_identity"] },
          uniqueItems: true,
        },
      },
    },
  },
  $defs: {
    revision: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    provider: {
      type: "object",
      additionalProperties: false,
      required: ["configured", "provider_id", "model_id", "model_revision"],
      properties: {
        configured: { type: "boolean" },
        provider_id: { type: "string", minLength: 1 },
        model_id: { type: "string", minLength: 1 },
        model_revision: { type: "string", minLength: 1 },
      },
    },
    scope: {
      type: "object",
      additionalProperties: false,
      required: [
        "source_mode",
        "requested_fidelity",
        "resolved_fidelity",
        "execution_mode",
        "resource_semantics_relation",
        "causal_subsystems",
        "attribution_semantics",
        "recommendation_semantics",
      ],
      properties: {
        source_mode: { enum: ["real_trace", "synthetic_trace", "compatibility_harness_trace"] },
        requested_fidelity: { enum: ["policy_default", "analytical", "des"] },
        resolved_fidelity: { enum: ["analytical", "des", "mixed", "not_applicable"] },
        execution_mode: {
          enum: ["analytical", "des", "partitioned_des", "single_process_fallback", "mixed", "not_applicable"],
        },
        resource_semantics_relation: { const: "S3_S4_S5_peer" },
        causal_subsystems: {
          type: "array",
          items: { enum: ["S0", "S1", "S2", "S3", "S4", "S5", "S6"] },
          uniqueItems: true,
        },
        attribution_semantics: { enum: ["not_applicable", "reported_attribution_only"] },
        recommendation_semantics: { enum: ["not_applicable", "conditional_not_executed"] },
      },
    },
    percentileSubject: {
      type: "object",
      additionalProperties: false,
      required: ["selection_semantics", "selected_request_id", "member_request_ids"],
      properties: {
        selection_semantics: { enum: ["single_request", "tie_no_single_request", "not_applicable", "missing"] },
        selected_request_id: { type: ["string", "null"] },
        member_request_ids: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
      },
    },
    claim: {
      type: "object",
      additionalProperties: false,
      required: ["claim_id", "claim_kind", "text", "citations", "scope"],
      properties: {
        claim_id: { type: "string", minLength: 1 },
        claim_kind: {
          enum: [
            "numeric_fact",
            "comparative_fact",
            "reported_attribution",
            "validation_boundary",
            "provenance_boundary",
            "fidelity_boundary",
            "conditional_recommendation",
            "architecture_correction",
            "help_text",
          ],
        },
        text: { type: "string", minLength: 1 },
        citations: { type: "array", items: { $ref: "evidence-agent-citation.schema.json" } },
        scope: { $ref: "#/$defs/scope" },
        percentile_subject: { $ref: "#/$defs/percentileSubject" },
      },
    },
    refusal: {
      type: "object",
      additionalProperties: false,
      required: ["reason_code", "detail", "retryable"],
      properties: {
        reason_code: {
          enum: [
            "insufficient_evidence",
            "citation_not_allowed",
            "citation_not_resolvable",
            "unsupported_schema",
            "stale_schema_revision",
            "run_binding_mismatch",
            "ambiguous_reference",
            "provenance_scope_violation",
            "fidelity_scope_violation",
            "unsafe_tool_request",
            "prompt_injection",
            "input_too_large",
            "output_truncated",
            "provider_unavailable",
            "timeout",
            "cancelled",
            "concurrency_limit",
          ],
        },
        detail: { type: "string", minLength: 1 },
        retryable: { type: "boolean" },
      },
    },
  },
};
const schema38 = { type: "string", pattern: "^sha256:[0-9a-f]{64}$" };
const schema40 = {
  type: "object",
  additionalProperties: false,
  required: ["configured", "provider_id", "model_id", "model_revision"],
  properties: {
    configured: { type: "boolean" },
    provider_id: { type: "string", minLength: 1 },
    model_id: { type: "string", minLength: 1 },
    model_revision: { type: "string", minLength: 1 },
  },
};
const schema47 = {
  type: "object",
  additionalProperties: false,
  required: ["reason_code", "detail", "retryable"],
  properties: {
    reason_code: {
      enum: [
        "insufficient_evidence",
        "citation_not_allowed",
        "citation_not_resolvable",
        "unsupported_schema",
        "stale_schema_revision",
        "run_binding_mismatch",
        "ambiguous_reference",
        "provenance_scope_violation",
        "fidelity_scope_violation",
        "unsafe_tool_request",
        "prompt_injection",
        "input_too_large",
        "output_truncated",
        "provider_unavailable",
        "timeout",
        "cancelled",
        "concurrency_limit",
      ],
    },
    detail: { type: "string", minLength: 1 },
    retryable: { type: "boolean" },
  },
};
const pattern7 = new RegExp("^agent-[A-Za-z0-9._:-]+$", "u");
const pattern8 = new RegExp("^[A-Za-z0-9._:-]{8,128}$", "u");
const pattern9 = new RegExp("^run-[A-Za-z0-9._-]+$", "u");
const schema41 = {
  type: "object",
  additionalProperties: false,
  required: ["claim_id", "claim_kind", "text", "citations", "scope"],
  properties: {
    claim_id: { type: "string", minLength: 1 },
    claim_kind: {
      enum: [
        "numeric_fact",
        "comparative_fact",
        "reported_attribution",
        "validation_boundary",
        "provenance_boundary",
        "fidelity_boundary",
        "conditional_recommendation",
        "architecture_correction",
        "help_text",
      ],
    },
    text: { type: "string", minLength: 1 },
    citations: { type: "array", items: { $ref: "evidence-agent-citation.schema.json" } },
    scope: { $ref: "#/$defs/scope" },
    percentile_subject: { $ref: "#/$defs/percentileSubject" },
  },
};
const schema45 = {
  type: "object",
  additionalProperties: false,
  required: [
    "source_mode",
    "requested_fidelity",
    "resolved_fidelity",
    "execution_mode",
    "resource_semantics_relation",
    "causal_subsystems",
    "attribution_semantics",
    "recommendation_semantics",
  ],
  properties: {
    source_mode: { enum: ["real_trace", "synthetic_trace", "compatibility_harness_trace"] },
    requested_fidelity: { enum: ["policy_default", "analytical", "des"] },
    resolved_fidelity: { enum: ["analytical", "des", "mixed", "not_applicable"] },
    execution_mode: {
      enum: ["analytical", "des", "partitioned_des", "single_process_fallback", "mixed", "not_applicable"],
    },
    resource_semantics_relation: { const: "S3_S4_S5_peer" },
    causal_subsystems: {
      type: "array",
      items: { enum: ["S0", "S1", "S2", "S3", "S4", "S5", "S6"] },
      uniqueItems: true,
    },
    attribution_semantics: { enum: ["not_applicable", "reported_attribution_only"] },
    recommendation_semantics: { enum: ["not_applicable", "conditional_not_executed"] },
  },
};
const schema46 = {
  type: "object",
  additionalProperties: false,
  required: ["selection_semantics", "selected_request_id", "member_request_ids"],
  properties: {
    selection_semantics: { enum: ["single_request", "tie_no_single_request", "not_applicable", "missing"] },
    selected_request_id: { type: ["string", "null"] },
    member_request_ids: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
  },
};
const schema42 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/evidence-agent-citation.schema.json",
  "x-tilesim-schema-identity": "tilesim.bridge.evidence_agent_citation.v1",
  title: "EvidenceAgentCitation",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "run_id",
    "artifact_id",
    "schema_identity",
    "sha256",
    "json_pointer",
    "subject",
    "citation_role",
    "availability",
  ],
  properties: {
    schema_version: { const: "tilesim.bridge.evidence_agent_citation.v1" },
    run_id: { type: "string", pattern: "^run-[A-Za-z0-9._-]+$" },
    artifact_id: { type: "string", minLength: 1 },
    schema_identity: { type: "string", minLength: 1 },
    sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
    json_pointer: { type: "string", pattern: "^/" },
    subject: { $ref: "#/$defs/subject" },
    citation_role: {
      enum: [
        "direct_fact",
        "reported_attribution",
        "validation_boundary",
        "provenance_constraint",
        "fidelity_constraint",
        "conditional_recommendation_basis",
      ],
    },
    availability: {
      enum: ["available", "missing", "expected_absence", "not_covered", "unsupported_schema", "not_applicable"],
    },
    value: { $ref: "#/$defs/losslessNumber" },
    unit: { type: "string", minLength: 1 },
  },
  dependentRequired: { value: ["unit"], unit: ["value"] },
  $defs: {
    subject: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "id"],
      properties: {
        kind: {
          enum: [
            "run",
            "request",
            "fabric_phase",
            "memory_event",
            "device_task",
            "collective",
            "cause",
            "attribution",
            "stage",
            "check",
            "candidate",
            "fabric_domain",
            "objective",
            "executed_s6_knob",
          ],
        },
        id: { type: "string", minLength: 1 },
      },
    },
    losslessNumber: {
      type: "object",
      additionalProperties: false,
      required: ["encoding", "numeric_kind", "decimal"],
      properties: {
        encoding: { const: "decimal_string" },
        numeric_kind: { enum: ["uint64", "sint64", "decimal"] },
        decimal: { type: "string", pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" },
      },
    },
  },
};
const schema43 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "id"],
  properties: {
    kind: {
      enum: [
        "run",
        "request",
        "fabric_phase",
        "memory_event",
        "device_task",
        "collective",
        "cause",
        "attribution",
        "stage",
        "check",
        "candidate",
        "fabric_domain",
        "objective",
        "executed_s6_knob",
      ],
    },
    id: { type: "string", minLength: 1 },
  },
};
const schema44 = {
  type: "object",
  additionalProperties: false,
  required: ["encoding", "numeric_kind", "decimal"],
  properties: {
    encoding: { const: "decimal_string" },
    numeric_kind: { enum: ["uint64", "sint64", "decimal"] },
    decimal: { type: "string", pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" },
  },
};
const pattern12 = new RegExp("^[0-9a-f]{64}$", "u");
const pattern13 = new RegExp("^/", "u");
const pattern14 = new RegExp("^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$", "u");
function validate23(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/evidence-agent-citation.schema.json" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate23.evaluated;
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
    if (data.run_id === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "run_id" },
        message: "must have required property '" + "run_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.artifact_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "artifact_id" },
        message: "must have required property '" + "artifact_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.schema_identity === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_identity" },
        message: "must have required property '" + "schema_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.sha256 === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "sha256" },
        message: "must have required property '" + "sha256" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.json_pointer === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "json_pointer" },
        message: "must have required property '" + "json_pointer" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.subject === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "subject" },
        message: "must have required property '" + "subject" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.citation_role === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "citation_role" },
        message: "must have required property '" + "citation_role" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.availability === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "availability" },
        message: "must have required property '" + "availability" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema42.properties, key0)) {
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
    if (data.schema_version !== undefined) {
      if ("tilesim.bridge.evidence_agent_citation.v1" !== data.schema_version) {
        const err10 = {
          instancePath: instancePath + "/schema_version",
          schemaPath: "#/properties/schema_version/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.evidence_agent_citation.v1" },
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
    if (data.run_id !== undefined) {
      let data1 = data.run_id;
      if (typeof data1 === "string") {
        if (!pattern9.test(data1)) {
          const err11 = {
            instancePath: instancePath + "/run_id",
            schemaPath: "#/properties/run_id/pattern",
            keyword: "pattern",
            params: { pattern: "^run-[A-Za-z0-9._-]+$" },
            message: 'must match pattern "' + "^run-[A-Za-z0-9._-]+$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/run_id",
          schemaPath: "#/properties/run_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.artifact_id !== undefined) {
      let data2 = data.artifact_id;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err13 = {
            instancePath: instancePath + "/artifact_id",
            schemaPath: "#/properties/artifact_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
          instancePath: instancePath + "/artifact_id",
          schemaPath: "#/properties/artifact_id/type",
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
    if (data.schema_identity !== undefined) {
      let data3 = data.schema_identity;
      if (typeof data3 === "string") {
        if (func2(data3) < 1) {
          const err15 = {
            instancePath: instancePath + "/schema_identity",
            schemaPath: "#/properties/schema_identity/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/type",
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
    if (data.sha256 !== undefined) {
      let data4 = data.sha256;
      if (typeof data4 === "string") {
        if (!pattern12.test(data4)) {
          const err17 = {
            instancePath: instancePath + "/sha256",
            schemaPath: "#/properties/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/sha256",
          schemaPath: "#/properties/sha256/type",
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
    if (data.json_pointer !== undefined) {
      let data5 = data.json_pointer;
      if (typeof data5 === "string") {
        if (!pattern13.test(data5)) {
          const err19 = {
            instancePath: instancePath + "/json_pointer",
            schemaPath: "#/properties/json_pointer/pattern",
            keyword: "pattern",
            params: { pattern: "^/" },
            message: 'must match pattern "' + "^/" + '"',
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
          instancePath: instancePath + "/json_pointer",
          schemaPath: "#/properties/json_pointer/type",
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
    if (data.subject !== undefined) {
      let data6 = data.subject;
      if (data6 && typeof data6 == "object" && !Array.isArray(data6)) {
        if (data6.kind === undefined) {
          const err21 = {
            instancePath: instancePath + "/subject",
            schemaPath: "#/$defs/subject/required",
            keyword: "required",
            params: { missingProperty: "kind" },
            message: "must have required property '" + "kind" + "'",
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (data6.id === undefined) {
          const err22 = {
            instancePath: instancePath + "/subject",
            schemaPath: "#/$defs/subject/required",
            keyword: "required",
            params: { missingProperty: "id" },
            message: "must have required property '" + "id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        for (const key1 in data6) {
          if (!(key1 === "kind" || key1 === "id")) {
            const err23 = {
              instancePath: instancePath + "/subject",
              schemaPath: "#/$defs/subject/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
        if (data6.kind !== undefined) {
          let data7 = data6.kind;
          if (!(
            data7 === "run" ||
            data7 === "request" ||
            data7 === "fabric_phase" ||
            data7 === "memory_event" ||
            data7 === "device_task" ||
            data7 === "collective" ||
            data7 === "cause" ||
            data7 === "attribution" ||
            data7 === "stage" ||
            data7 === "check" ||
            data7 === "candidate" ||
            data7 === "fabric_domain" ||
            data7 === "objective" ||
            data7 === "executed_s6_knob"
          )) {
            const err24 = {
              instancePath: instancePath + "/subject/kind",
              schemaPath: "#/$defs/subject/properties/kind/enum",
              keyword: "enum",
              params: { allowedValues: schema43.properties.kind.enum },
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
        if (data6.id !== undefined) {
          let data8 = data6.id;
          if (typeof data8 === "string") {
            if (func2(data8) < 1) {
              const err25 = {
                instancePath: instancePath + "/subject/id",
                schemaPath: "#/$defs/subject/properties/id/minLength",
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
              instancePath: instancePath + "/subject/id",
              schemaPath: "#/$defs/subject/properties/id/type",
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
      } else {
        const err27 = {
          instancePath: instancePath + "/subject",
          schemaPath: "#/$defs/subject/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.citation_role !== undefined) {
      let data9 = data.citation_role;
      if (!(
        data9 === "direct_fact" ||
        data9 === "reported_attribution" ||
        data9 === "validation_boundary" ||
        data9 === "provenance_constraint" ||
        data9 === "fidelity_constraint" ||
        data9 === "conditional_recommendation_basis"
      )) {
        const err28 = {
          instancePath: instancePath + "/citation_role",
          schemaPath: "#/properties/citation_role/enum",
          keyword: "enum",
          params: { allowedValues: schema42.properties.citation_role.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.availability !== undefined) {
      let data10 = data.availability;
      if (!(
        data10 === "available" ||
        data10 === "missing" ||
        data10 === "expected_absence" ||
        data10 === "not_covered" ||
        data10 === "unsupported_schema" ||
        data10 === "not_applicable"
      )) {
        const err29 = {
          instancePath: instancePath + "/availability",
          schemaPath: "#/properties/availability/enum",
          keyword: "enum",
          params: { allowedValues: schema42.properties.availability.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.value !== undefined) {
      let data11 = data.value;
      if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
        if (data11.encoding === undefined) {
          const err30 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/$defs/losslessNumber/required",
            keyword: "required",
            params: { missingProperty: "encoding" },
            message: "must have required property '" + "encoding" + "'",
          };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        if (data11.numeric_kind === undefined) {
          const err31 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/$defs/losslessNumber/required",
            keyword: "required",
            params: { missingProperty: "numeric_kind" },
            message: "must have required property '" + "numeric_kind" + "'",
          };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        if (data11.decimal === undefined) {
          const err32 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/$defs/losslessNumber/required",
            keyword: "required",
            params: { missingProperty: "decimal" },
            message: "must have required property '" + "decimal" + "'",
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
        for (const key2 in data11) {
          if (!(key2 === "encoding" || key2 === "numeric_kind" || key2 === "decimal")) {
            const err33 = {
              instancePath: instancePath + "/value",
              schemaPath: "#/$defs/losslessNumber/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
        }
        if (data11.encoding !== undefined) {
          if ("decimal_string" !== data11.encoding) {
            const err34 = {
              instancePath: instancePath + "/value/encoding",
              schemaPath: "#/$defs/losslessNumber/properties/encoding/const",
              keyword: "const",
              params: { allowedValue: "decimal_string" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err34];
            } else {
              vErrors.push(err34);
            }
            errors++;
          }
        }
        if (data11.numeric_kind !== undefined) {
          let data13 = data11.numeric_kind;
          if (!(data13 === "uint64" || data13 === "sint64" || data13 === "decimal")) {
            const err35 = {
              instancePath: instancePath + "/value/numeric_kind",
              schemaPath: "#/$defs/losslessNumber/properties/numeric_kind/enum",
              keyword: "enum",
              params: { allowedValues: schema44.properties.numeric_kind.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err35];
            } else {
              vErrors.push(err35);
            }
            errors++;
          }
        }
        if (data11.decimal !== undefined) {
          let data14 = data11.decimal;
          if (typeof data14 === "string") {
            if (!pattern14.test(data14)) {
              const err36 = {
                instancePath: instancePath + "/value/decimal",
                schemaPath: "#/$defs/losslessNumber/properties/decimal/pattern",
                keyword: "pattern",
                params: { pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" },
                message: 'must match pattern "' + "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" + '"',
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
              instancePath: instancePath + "/value/decimal",
              schemaPath: "#/$defs/losslessNumber/properties/decimal/type",
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
      } else {
        const err38 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/$defs/losslessNumber/type",
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
    if (data.unit !== undefined) {
      let data15 = data.unit;
      if (typeof data15 === "string") {
        if (func2(data15) < 1) {
          const err39 = {
            instancePath: instancePath + "/unit",
            schemaPath: "#/properties/unit/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
          instancePath: instancePath + "/unit",
          schemaPath: "#/properties/unit/type",
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
    if (data.value !== undefined) {
      if (data.unit === undefined) {
        const err41 = {
          instancePath,
          schemaPath: "#/dependentRequired",
          keyword: "dependentRequired",
          params: { property: "value", missingProperty: "unit", depsCount: 1, deps: "unit" },
          message: "must have property unit when property value is present",
        };
        if (vErrors === null) {
          vErrors = [err41];
        } else {
          vErrors.push(err41);
        }
        errors++;
      }
    }
    if (data.unit !== undefined) {
      if (data.value === undefined) {
        const err42 = {
          instancePath,
          schemaPath: "#/dependentRequired",
          keyword: "dependentRequired",
          params: { property: "unit", missingProperty: "value", depsCount: 1, deps: "value" },
          message: "must have property value when property unit is present",
        };
        if (vErrors === null) {
          vErrors = [err42];
        } else {
          vErrors.push(err42);
        }
        errors++;
      }
    }
  } else {
    const err43 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err43];
    } else {
      vErrors.push(err43);
    }
    errors++;
  }
  validate23.errors = vErrors;
  return errors === 0;
}
validate23.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate22(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.claim_id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "claim_id" },
        message: "must have required property '" + "claim_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.claim_kind === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "claim_kind" },
        message: "must have required property '" + "claim_kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.text === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "text" },
        message: "must have required property '" + "text" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.citations === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "citations" },
        message: "must have required property '" + "citations" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.scope === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "scope" },
        message: "must have required property '" + "scope" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "claim_id" ||
        key0 === "claim_kind" ||
        key0 === "text" ||
        key0 === "citations" ||
        key0 === "scope" ||
        key0 === "percentile_subject"
      )) {
        const err5 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.claim_id !== undefined) {
      let data0 = data.claim_id;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err6 = {
            instancePath: instancePath + "/claim_id",
            schemaPath: "#/properties/claim_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = {
          instancePath: instancePath + "/claim_id",
          schemaPath: "#/properties/claim_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.claim_kind !== undefined) {
      let data1 = data.claim_kind;
      if (!(
        data1 === "numeric_fact" ||
        data1 === "comparative_fact" ||
        data1 === "reported_attribution" ||
        data1 === "validation_boundary" ||
        data1 === "provenance_boundary" ||
        data1 === "fidelity_boundary" ||
        data1 === "conditional_recommendation" ||
        data1 === "architecture_correction" ||
        data1 === "help_text"
      )) {
        const err8 = {
          instancePath: instancePath + "/claim_kind",
          schemaPath: "#/properties/claim_kind/enum",
          keyword: "enum",
          params: { allowedValues: schema41.properties.claim_kind.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.text !== undefined) {
      let data2 = data.text;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err9 = {
            instancePath: instancePath + "/text",
            schemaPath: "#/properties/text/minLength",
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
          instancePath: instancePath + "/text",
          schemaPath: "#/properties/text/type",
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
    if (data.citations !== undefined) {
      let data3 = data.citations;
      if (Array.isArray(data3)) {
        const len0 = data3.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate23(data3[i0], {
              instancePath: instancePath + "/citations/" + i0,
              parentData: data3,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err11 = {
          instancePath: instancePath + "/citations",
          schemaPath: "#/properties/citations/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.scope !== undefined) {
      let data5 = data.scope;
      if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
        if (data5.source_mode === undefined) {
          const err12 = {
            instancePath: instancePath + "/scope",
            schemaPath: "#/$defs/scope/required",
            keyword: "required",
            params: { missingProperty: "source_mode" },
            message: "must have required property '" + "source_mode" + "'",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        if (data5.requested_fidelity === undefined) {
          const err13 = {
            instancePath: instancePath + "/scope",
            schemaPath: "#/$defs/scope/required",
            keyword: "required",
            params: { missingProperty: "requested_fidelity" },
            message: "must have required property '" + "requested_fidelity" + "'",
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (data5.resolved_fidelity === undefined) {
          const err14 = {
            instancePath: instancePath + "/scope",
            schemaPath: "#/$defs/scope/required",
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
        if (data5.execution_mode === undefined) {
          const err15 = {
            instancePath: instancePath + "/scope",
            schemaPath: "#/$defs/scope/required",
            keyword: "required",
            params: { missingProperty: "execution_mode" },
            message: "must have required property '" + "execution_mode" + "'",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (data5.resource_semantics_relation === undefined) {
          const err16 = {
            instancePath: instancePath + "/scope",
            schemaPath: "#/$defs/scope/required",
            keyword: "required",
            params: { missingProperty: "resource_semantics_relation" },
            message: "must have required property '" + "resource_semantics_relation" + "'",
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (data5.causal_subsystems === undefined) {
          const err17 = {
            instancePath: instancePath + "/scope",
            schemaPath: "#/$defs/scope/required",
            keyword: "required",
            params: { missingProperty: "causal_subsystems" },
            message: "must have required property '" + "causal_subsystems" + "'",
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (data5.attribution_semantics === undefined) {
          const err18 = {
            instancePath: instancePath + "/scope",
            schemaPath: "#/$defs/scope/required",
            keyword: "required",
            params: { missingProperty: "attribution_semantics" },
            message: "must have required property '" + "attribution_semantics" + "'",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (data5.recommendation_semantics === undefined) {
          const err19 = {
            instancePath: instancePath + "/scope",
            schemaPath: "#/$defs/scope/required",
            keyword: "required",
            params: { missingProperty: "recommendation_semantics" },
            message: "must have required property '" + "recommendation_semantics" + "'",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        for (const key1 in data5) {
          if (!(
            key1 === "source_mode" ||
            key1 === "requested_fidelity" ||
            key1 === "resolved_fidelity" ||
            key1 === "execution_mode" ||
            key1 === "resource_semantics_relation" ||
            key1 === "causal_subsystems" ||
            key1 === "attribution_semantics" ||
            key1 === "recommendation_semantics"
          )) {
            const err20 = {
              instancePath: instancePath + "/scope",
              schemaPath: "#/$defs/scope/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        }
        if (data5.source_mode !== undefined) {
          let data6 = data5.source_mode;
          if (!(data6 === "real_trace" || data6 === "synthetic_trace" || data6 === "compatibility_harness_trace")) {
            const err21 = {
              instancePath: instancePath + "/scope/source_mode",
              schemaPath: "#/$defs/scope/properties/source_mode/enum",
              keyword: "enum",
              params: { allowedValues: schema45.properties.source_mode.enum },
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
        if (data5.requested_fidelity !== undefined) {
          let data7 = data5.requested_fidelity;
          if (!(data7 === "policy_default" || data7 === "analytical" || data7 === "des")) {
            const err22 = {
              instancePath: instancePath + "/scope/requested_fidelity",
              schemaPath: "#/$defs/scope/properties/requested_fidelity/enum",
              keyword: "enum",
              params: { allowedValues: schema45.properties.requested_fidelity.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err22];
            } else {
              vErrors.push(err22);
            }
            errors++;
          }
        }
        if (data5.resolved_fidelity !== undefined) {
          let data8 = data5.resolved_fidelity;
          if (!(data8 === "analytical" || data8 === "des" || data8 === "mixed" || data8 === "not_applicable")) {
            const err23 = {
              instancePath: instancePath + "/scope/resolved_fidelity",
              schemaPath: "#/$defs/scope/properties/resolved_fidelity/enum",
              keyword: "enum",
              params: { allowedValues: schema45.properties.resolved_fidelity.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
        if (data5.execution_mode !== undefined) {
          let data9 = data5.execution_mode;
          if (!(
            data9 === "analytical" ||
            data9 === "des" ||
            data9 === "partitioned_des" ||
            data9 === "single_process_fallback" ||
            data9 === "mixed" ||
            data9 === "not_applicable"
          )) {
            const err24 = {
              instancePath: instancePath + "/scope/execution_mode",
              schemaPath: "#/$defs/scope/properties/execution_mode/enum",
              keyword: "enum",
              params: { allowedValues: schema45.properties.execution_mode.enum },
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
        if (data5.resource_semantics_relation !== undefined) {
          if ("S3_S4_S5_peer" !== data5.resource_semantics_relation) {
            const err25 = {
              instancePath: instancePath + "/scope/resource_semantics_relation",
              schemaPath: "#/$defs/scope/properties/resource_semantics_relation/const",
              keyword: "const",
              params: { allowedValue: "S3_S4_S5_peer" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
        }
        if (data5.causal_subsystems !== undefined) {
          let data11 = data5.causal_subsystems;
          if (Array.isArray(data11)) {
            const len1 = data11.length;
            for (let i1 = 0; i1 < len1; i1++) {
              let data12 = data11[i1];
              if (!(
                data12 === "S0" ||
                data12 === "S1" ||
                data12 === "S2" ||
                data12 === "S3" ||
                data12 === "S4" ||
                data12 === "S5" ||
                data12 === "S6"
              )) {
                const err26 = {
                  instancePath: instancePath + "/scope/causal_subsystems/" + i1,
                  schemaPath: "#/$defs/scope/properties/causal_subsystems/items/enum",
                  keyword: "enum",
                  params: { allowedValues: schema45.properties.causal_subsystems.items.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err26];
                } else {
                  vErrors.push(err26);
                }
                errors++;
              }
            }
            let i2 = data11.length;
            let j0;
            if (i2 > 1) {
              outer0: for (; i2--;) {
                for (j0 = i2; j0--;) {
                  if (func0(data11[i2], data11[j0])) {
                    const err27 = {
                      instancePath: instancePath + "/scope/causal_subsystems",
                      schemaPath: "#/$defs/scope/properties/causal_subsystems/uniqueItems",
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
              instancePath: instancePath + "/scope/causal_subsystems",
              schemaPath: "#/$defs/scope/properties/causal_subsystems/type",
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
        if (data5.attribution_semantics !== undefined) {
          let data13 = data5.attribution_semantics;
          if (!(data13 === "not_applicable" || data13 === "reported_attribution_only")) {
            const err29 = {
              instancePath: instancePath + "/scope/attribution_semantics",
              schemaPath: "#/$defs/scope/properties/attribution_semantics/enum",
              keyword: "enum",
              params: { allowedValues: schema45.properties.attribution_semantics.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err29];
            } else {
              vErrors.push(err29);
            }
            errors++;
          }
        }
        if (data5.recommendation_semantics !== undefined) {
          let data14 = data5.recommendation_semantics;
          if (!(data14 === "not_applicable" || data14 === "conditional_not_executed")) {
            const err30 = {
              instancePath: instancePath + "/scope/recommendation_semantics",
              schemaPath: "#/$defs/scope/properties/recommendation_semantics/enum",
              keyword: "enum",
              params: { allowedValues: schema45.properties.recommendation_semantics.enum },
              message: "must be equal to one of the allowed values",
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
          instancePath: instancePath + "/scope",
          schemaPath: "#/$defs/scope/type",
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
    }
    if (data.percentile_subject !== undefined) {
      let data15 = data.percentile_subject;
      if (data15 && typeof data15 == "object" && !Array.isArray(data15)) {
        if (data15.selection_semantics === undefined) {
          const err32 = {
            instancePath: instancePath + "/percentile_subject",
            schemaPath: "#/$defs/percentileSubject/required",
            keyword: "required",
            params: { missingProperty: "selection_semantics" },
            message: "must have required property '" + "selection_semantics" + "'",
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
        if (data15.selected_request_id === undefined) {
          const err33 = {
            instancePath: instancePath + "/percentile_subject",
            schemaPath: "#/$defs/percentileSubject/required",
            keyword: "required",
            params: { missingProperty: "selected_request_id" },
            message: "must have required property '" + "selected_request_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
        if (data15.member_request_ids === undefined) {
          const err34 = {
            instancePath: instancePath + "/percentile_subject",
            schemaPath: "#/$defs/percentileSubject/required",
            keyword: "required",
            params: { missingProperty: "member_request_ids" },
            message: "must have required property '" + "member_request_ids" + "'",
          };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
        for (const key2 in data15) {
          if (!(key2 === "selection_semantics" || key2 === "selected_request_id" || key2 === "member_request_ids")) {
            const err35 = {
              instancePath: instancePath + "/percentile_subject",
              schemaPath: "#/$defs/percentileSubject/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err35];
            } else {
              vErrors.push(err35);
            }
            errors++;
          }
        }
        if (data15.selection_semantics !== undefined) {
          let data16 = data15.selection_semantics;
          if (!(
            data16 === "single_request" ||
            data16 === "tie_no_single_request" ||
            data16 === "not_applicable" ||
            data16 === "missing"
          )) {
            const err36 = {
              instancePath: instancePath + "/percentile_subject/selection_semantics",
              schemaPath: "#/$defs/percentileSubject/properties/selection_semantics/enum",
              keyword: "enum",
              params: { allowedValues: schema46.properties.selection_semantics.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err36];
            } else {
              vErrors.push(err36);
            }
            errors++;
          }
        }
        if (data15.selected_request_id !== undefined) {
          let data17 = data15.selected_request_id;
          if (typeof data17 !== "string" && data17 !== null) {
            const err37 = {
              instancePath: instancePath + "/percentile_subject/selected_request_id",
              schemaPath: "#/$defs/percentileSubject/properties/selected_request_id/type",
              keyword: "type",
              params: { type: schema46.properties.selected_request_id.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err37];
            } else {
              vErrors.push(err37);
            }
            errors++;
          }
        }
        if (data15.member_request_ids !== undefined) {
          let data18 = data15.member_request_ids;
          if (Array.isArray(data18)) {
            const len2 = data18.length;
            for (let i3 = 0; i3 < len2; i3++) {
              let data19 = data18[i3];
              if (typeof data19 === "string") {
                if (func2(data19) < 1) {
                  const err38 = {
                    instancePath: instancePath + "/percentile_subject/member_request_ids/" + i3,
                    schemaPath: "#/$defs/percentileSubject/properties/member_request_ids/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
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
                  instancePath: instancePath + "/percentile_subject/member_request_ids/" + i3,
                  schemaPath: "#/$defs/percentileSubject/properties/member_request_ids/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err39];
                } else {
                  vErrors.push(err39);
                }
                errors++;
              }
            }
            let i4 = data18.length;
            let j1;
            if (i4 > 1) {
              const indices0 = {};
              for (; i4--;) {
                let item0 = data18[i4];
                if (typeof item0 !== "string") {
                  continue;
                }
                if (typeof indices0[item0] == "number") {
                  j1 = indices0[item0];
                  const err40 = {
                    instancePath: instancePath + "/percentile_subject/member_request_ids",
                    schemaPath: "#/$defs/percentileSubject/properties/member_request_ids/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i4, j: j1 },
                    message: "must NOT have duplicate items (items ## " + j1 + " and " + i4 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err40];
                  } else {
                    vErrors.push(err40);
                  }
                  errors++;
                  break;
                }
                indices0[item0] = i4;
              }
            }
          } else {
            const err41 = {
              instancePath: instancePath + "/percentile_subject/member_request_ids",
              schemaPath: "#/$defs/percentileSubject/properties/member_request_ids/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err41];
            } else {
              vErrors.push(err41);
            }
            errors++;
          }
        }
      } else {
        const err42 = {
          instancePath: instancePath + "/percentile_subject",
          schemaPath: "#/$defs/percentileSubject/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err42];
        } else {
          vErrors.push(err42);
        }
        errors++;
      }
    }
  } else {
    const err43 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err43];
    } else {
      vErrors.push(err43);
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
  /*# sourceURL="https://tilesim.local/contracts/evidence-agent-response.schema.json" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate21.evaluated;
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
    if (data.request_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "request_id" },
        message: "must have required property '" + "request_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.client_request_id === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "client_request_id" },
        message: "must have required property '" + "client_request_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.run_id === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "run_id" },
        message: "must have required property '" + "run_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.input_snapshot_digest === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "input_snapshot_digest" },
        message: "must have required property '" + "input_snapshot_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.completion_state === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "completion_state" },
        message: "must have required property '" + "completion_state" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.provider === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "provider" },
        message: "must have required property '" + "provider" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.revisions === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "revisions" },
        message: "must have required property '" + "revisions" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.claims === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "claims" },
        message: "must have required property '" + "claims" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.refusal === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "refusal" },
        message: "must have required property '" + "refusal" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.partial === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "partial" },
        message: "must have required property '" + "partial" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.truncated === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "truncated" },
        message: "must have required property '" + "truncated" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.degradation === undefined) {
      const err13 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "degradation" },
        message: "must have required property '" + "degradation" + "'",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.audit_summary === undefined) {
      const err14 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "audit_summary" },
        message: "must have required property '" + "audit_summary" + "'",
      };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    if (data.generated_at === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "generated_at" },
        message: "must have required property '" + "generated_at" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.persistence === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "persistence" },
        message: "must have required property '" + "persistence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    if (data.staleness === undefined) {
      const err17 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "staleness" },
        message: "must have required property '" + "staleness" + "'",
      };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema37.properties, key0)) {
        const err18 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.schema_version !== undefined) {
      if ("tilesim.bridge.evidence_agent_response.v1" !== data.schema_version) {
        const err19 = {
          instancePath: instancePath + "/schema_version",
          schemaPath: "#/properties/schema_version/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.evidence_agent_response.v1" },
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
    if (data.schema_set_revision !== undefined) {
      let data1 = data.schema_set_revision;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err20 = {
            instancePath: instancePath + "/schema_set_revision",
            schemaPath: "#/$defs/revision/pattern",
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
          instancePath: instancePath + "/schema_set_revision",
          schemaPath: "#/$defs/revision/type",
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
    if (data.request_id !== undefined) {
      let data2 = data.request_id;
      if (typeof data2 === "string") {
        if (!pattern7.test(data2)) {
          const err22 = {
            instancePath: instancePath + "/request_id",
            schemaPath: "#/properties/request_id/pattern",
            keyword: "pattern",
            params: { pattern: "^agent-[A-Za-z0-9._:-]+$" },
            message: 'must match pattern "' + "^agent-[A-Za-z0-9._:-]+$" + '"',
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
          instancePath: instancePath + "/request_id",
          schemaPath: "#/properties/request_id/type",
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
    if (data.client_request_id !== undefined) {
      let data3 = data.client_request_id;
      if (typeof data3 === "string") {
        if (!pattern8.test(data3)) {
          const err24 = {
            instancePath: instancePath + "/client_request_id",
            schemaPath: "#/properties/client_request_id/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9._:-]{8,128}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9._:-]{8,128}$" + '"',
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
          instancePath: instancePath + "/client_request_id",
          schemaPath: "#/properties/client_request_id/type",
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
    if (data.run_id !== undefined) {
      let data4 = data.run_id;
      if (typeof data4 === "string") {
        if (!pattern9.test(data4)) {
          const err26 = {
            instancePath: instancePath + "/run_id",
            schemaPath: "#/properties/run_id/pattern",
            keyword: "pattern",
            params: { pattern: "^run-[A-Za-z0-9._-]+$" },
            message: 'must match pattern "' + "^run-[A-Za-z0-9._-]+$" + '"',
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
          instancePath: instancePath + "/run_id",
          schemaPath: "#/properties/run_id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.input_snapshot_digest !== undefined) {
      let data5 = data.input_snapshot_digest;
      if (typeof data5 === "string") {
        if (!pattern4.test(data5)) {
          const err28 = {
            instancePath: instancePath + "/input_snapshot_digest",
            schemaPath: "#/$defs/revision/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
      } else {
        const err29 = {
          instancePath: instancePath + "/input_snapshot_digest",
          schemaPath: "#/$defs/revision/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.completion_state !== undefined) {
      let data6 = data.completion_state;
      if (!(
        data6 === "completed" ||
        data6 === "refused" ||
        data6 === "partial" ||
        data6 === "truncated" ||
        data6 === "failed" ||
        data6 === "timeout" ||
        data6 === "cancelled"
      )) {
        const err30 = {
          instancePath: instancePath + "/completion_state",
          schemaPath: "#/properties/completion_state/enum",
          keyword: "enum",
          params: { allowedValues: schema37.properties.completion_state.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
    }
    if (data.provider !== undefined) {
      let data7 = data.provider;
      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
        if (data7.configured === undefined) {
          const err31 = {
            instancePath: instancePath + "/provider",
            schemaPath: "#/$defs/provider/required",
            keyword: "required",
            params: { missingProperty: "configured" },
            message: "must have required property '" + "configured" + "'",
          };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        if (data7.provider_id === undefined) {
          const err32 = {
            instancePath: instancePath + "/provider",
            schemaPath: "#/$defs/provider/required",
            keyword: "required",
            params: { missingProperty: "provider_id" },
            message: "must have required property '" + "provider_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
        if (data7.model_id === undefined) {
          const err33 = {
            instancePath: instancePath + "/provider",
            schemaPath: "#/$defs/provider/required",
            keyword: "required",
            params: { missingProperty: "model_id" },
            message: "must have required property '" + "model_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
        if (data7.model_revision === undefined) {
          const err34 = {
            instancePath: instancePath + "/provider",
            schemaPath: "#/$defs/provider/required",
            keyword: "required",
            params: { missingProperty: "model_revision" },
            message: "must have required property '" + "model_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
        for (const key1 in data7) {
          if (!(key1 === "configured" || key1 === "provider_id" || key1 === "model_id" || key1 === "model_revision")) {
            const err35 = {
              instancePath: instancePath + "/provider",
              schemaPath: "#/$defs/provider/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err35];
            } else {
              vErrors.push(err35);
            }
            errors++;
          }
        }
        if (data7.configured !== undefined) {
          if (typeof data7.configured !== "boolean") {
            const err36 = {
              instancePath: instancePath + "/provider/configured",
              schemaPath: "#/$defs/provider/properties/configured/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err36];
            } else {
              vErrors.push(err36);
            }
            errors++;
          }
        }
        if (data7.provider_id !== undefined) {
          let data9 = data7.provider_id;
          if (typeof data9 === "string") {
            if (func2(data9) < 1) {
              const err37 = {
                instancePath: instancePath + "/provider/provider_id",
                schemaPath: "#/$defs/provider/properties/provider_id/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err37];
              } else {
                vErrors.push(err37);
              }
              errors++;
            }
          } else {
            const err38 = {
              instancePath: instancePath + "/provider/provider_id",
              schemaPath: "#/$defs/provider/properties/provider_id/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err38];
            } else {
              vErrors.push(err38);
            }
            errors++;
          }
        }
        if (data7.model_id !== undefined) {
          let data10 = data7.model_id;
          if (typeof data10 === "string") {
            if (func2(data10) < 1) {
              const err39 = {
                instancePath: instancePath + "/provider/model_id",
                schemaPath: "#/$defs/provider/properties/model_id/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/provider/model_id",
              schemaPath: "#/$defs/provider/properties/model_id/type",
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
        if (data7.model_revision !== undefined) {
          let data11 = data7.model_revision;
          if (typeof data11 === "string") {
            if (func2(data11) < 1) {
              const err41 = {
                instancePath: instancePath + "/provider/model_revision",
                schemaPath: "#/$defs/provider/properties/model_revision/minLength",
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
              instancePath: instancePath + "/provider/model_revision",
              schemaPath: "#/$defs/provider/properties/model_revision/type",
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
      } else {
        const err43 = {
          instancePath: instancePath + "/provider",
          schemaPath: "#/$defs/provider/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err43];
        } else {
          vErrors.push(err43);
        }
        errors++;
      }
    }
    if (data.revisions !== undefined) {
      let data12 = data.revisions;
      if (data12 && typeof data12 == "object" && !Array.isArray(data12)) {
        if (data12.prompt_template_revision === undefined) {
          const err44 = {
            instancePath: instancePath + "/revisions",
            schemaPath: "#/properties/revisions/required",
            keyword: "required",
            params: { missingProperty: "prompt_template_revision" },
            message: "must have required property '" + "prompt_template_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err44];
          } else {
            vErrors.push(err44);
          }
          errors++;
        }
        if (data12.policy_revision === undefined) {
          const err45 = {
            instancePath: instancePath + "/revisions",
            schemaPath: "#/properties/revisions/required",
            keyword: "required",
            params: { missingProperty: "policy_revision" },
            message: "must have required property '" + "policy_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err45];
          } else {
            vErrors.push(err45);
          }
          errors++;
        }
        for (const key2 in data12) {
          if (!(key2 === "prompt_template_revision" || key2 === "policy_revision")) {
            const err46 = {
              instancePath: instancePath + "/revisions",
              schemaPath: "#/properties/revisions/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err46];
            } else {
              vErrors.push(err46);
            }
            errors++;
          }
        }
        if (data12.prompt_template_revision !== undefined) {
          let data13 = data12.prompt_template_revision;
          if (typeof data13 === "string") {
            if (func2(data13) < 1) {
              const err47 = {
                instancePath: instancePath + "/revisions/prompt_template_revision",
                schemaPath: "#/properties/revisions/properties/prompt_template_revision/minLength",
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
              instancePath: instancePath + "/revisions/prompt_template_revision",
              schemaPath: "#/properties/revisions/properties/prompt_template_revision/type",
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
        if (data12.policy_revision !== undefined) {
          let data14 = data12.policy_revision;
          if (typeof data14 === "string") {
            if (func2(data14) < 1) {
              const err49 = {
                instancePath: instancePath + "/revisions/policy_revision",
                schemaPath: "#/properties/revisions/properties/policy_revision/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/revisions/policy_revision",
              schemaPath: "#/properties/revisions/properties/policy_revision/type",
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
      } else {
        const err51 = {
          instancePath: instancePath + "/revisions",
          schemaPath: "#/properties/revisions/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err51];
        } else {
          vErrors.push(err51);
        }
        errors++;
      }
    }
    if (data.claims !== undefined) {
      let data15 = data.claims;
      if (Array.isArray(data15)) {
        if (data15.length > 128) {
          const err52 = {
            instancePath: instancePath + "/claims",
            schemaPath: "#/properties/claims/maxItems",
            keyword: "maxItems",
            params: { limit: 128 },
            message: "must NOT have more than 128 items",
          };
          if (vErrors === null) {
            vErrors = [err52];
          } else {
            vErrors.push(err52);
          }
          errors++;
        }
        const len0 = data15.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate22(data15[i0], {
              instancePath: instancePath + "/claims/" + i0,
              parentData: data15,
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
        const err53 = {
          instancePath: instancePath + "/claims",
          schemaPath: "#/properties/claims/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err53];
        } else {
          vErrors.push(err53);
        }
        errors++;
      }
    }
    if (data.refusal !== undefined) {
      let data17 = data.refusal;
      const _errs39 = errors;
      let valid8 = false;
      let passing0 = null;
      const _errs40 = errors;
      if (data17 !== null) {
        const err54 = {
          instancePath: instancePath + "/refusal",
          schemaPath: "#/properties/refusal/oneOf/0/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err54];
        } else {
          vErrors.push(err54);
        }
        errors++;
      }
      var _valid0 = _errs40 === errors;
      if (_valid0) {
        valid8 = true;
        passing0 = 0;
      }
      const _errs42 = errors;
      if (data17 && typeof data17 == "object" && !Array.isArray(data17)) {
        if (data17.reason_code === undefined) {
          const err55 = {
            instancePath: instancePath + "/refusal",
            schemaPath: "#/$defs/refusal/required",
            keyword: "required",
            params: { missingProperty: "reason_code" },
            message: "must have required property '" + "reason_code" + "'",
          };
          if (vErrors === null) {
            vErrors = [err55];
          } else {
            vErrors.push(err55);
          }
          errors++;
        }
        if (data17.detail === undefined) {
          const err56 = {
            instancePath: instancePath + "/refusal",
            schemaPath: "#/$defs/refusal/required",
            keyword: "required",
            params: { missingProperty: "detail" },
            message: "must have required property '" + "detail" + "'",
          };
          if (vErrors === null) {
            vErrors = [err56];
          } else {
            vErrors.push(err56);
          }
          errors++;
        }
        if (data17.retryable === undefined) {
          const err57 = {
            instancePath: instancePath + "/refusal",
            schemaPath: "#/$defs/refusal/required",
            keyword: "required",
            params: { missingProperty: "retryable" },
            message: "must have required property '" + "retryable" + "'",
          };
          if (vErrors === null) {
            vErrors = [err57];
          } else {
            vErrors.push(err57);
          }
          errors++;
        }
        for (const key3 in data17) {
          if (!(key3 === "reason_code" || key3 === "detail" || key3 === "retryable")) {
            const err58 = {
              instancePath: instancePath + "/refusal",
              schemaPath: "#/$defs/refusal/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key3 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err58];
            } else {
              vErrors.push(err58);
            }
            errors++;
          }
        }
        if (data17.reason_code !== undefined) {
          let data18 = data17.reason_code;
          if (!(
            data18 === "insufficient_evidence" ||
            data18 === "citation_not_allowed" ||
            data18 === "citation_not_resolvable" ||
            data18 === "unsupported_schema" ||
            data18 === "stale_schema_revision" ||
            data18 === "run_binding_mismatch" ||
            data18 === "ambiguous_reference" ||
            data18 === "provenance_scope_violation" ||
            data18 === "fidelity_scope_violation" ||
            data18 === "unsafe_tool_request" ||
            data18 === "prompt_injection" ||
            data18 === "input_too_large" ||
            data18 === "output_truncated" ||
            data18 === "provider_unavailable" ||
            data18 === "timeout" ||
            data18 === "cancelled" ||
            data18 === "concurrency_limit"
          )) {
            const err59 = {
              instancePath: instancePath + "/refusal/reason_code",
              schemaPath: "#/$defs/refusal/properties/reason_code/enum",
              keyword: "enum",
              params: { allowedValues: schema47.properties.reason_code.enum },
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
        if (data17.detail !== undefined) {
          let data19 = data17.detail;
          if (typeof data19 === "string") {
            if (func2(data19) < 1) {
              const err60 = {
                instancePath: instancePath + "/refusal/detail",
                schemaPath: "#/$defs/refusal/properties/detail/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/refusal/detail",
              schemaPath: "#/$defs/refusal/properties/detail/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err61];
            } else {
              vErrors.push(err61);
            }
            errors++;
          }
        }
        if (data17.retryable !== undefined) {
          if (typeof data17.retryable !== "boolean") {
            const err62 = {
              instancePath: instancePath + "/refusal/retryable",
              schemaPath: "#/$defs/refusal/properties/retryable/type",
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
      } else {
        const err63 = {
          instancePath: instancePath + "/refusal",
          schemaPath: "#/$defs/refusal/type",
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
      var _valid0 = _errs42 === errors;
      if (_valid0 && valid8) {
        valid8 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid8 = true;
          passing0 = 1;
        }
      }
      if (!valid8) {
        const err64 = {
          instancePath: instancePath + "/refusal",
          schemaPath: "#/properties/refusal/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing0 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err64];
        } else {
          vErrors.push(err64);
        }
        errors++;
      } else {
        errors = _errs39;
        if (vErrors !== null) {
          if (_errs39) {
            vErrors.length = _errs39;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.partial !== undefined) {
      if (typeof data.partial !== "boolean") {
        const err65 = {
          instancePath: instancePath + "/partial",
          schemaPath: "#/properties/partial/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err65];
        } else {
          vErrors.push(err65);
        }
        errors++;
      }
    }
    if (data.truncated !== undefined) {
      if (typeof data.truncated !== "boolean") {
        const err66 = {
          instancePath: instancePath + "/truncated",
          schemaPath: "#/properties/truncated/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err66];
        } else {
          vErrors.push(err66);
        }
        errors++;
      }
    }
    if (data.degradation !== undefined) {
      let data23 = data.degradation;
      if (data23 && typeof data23 == "object" && !Array.isArray(data23)) {
        if (data23.state === undefined) {
          const err67 = {
            instancePath: instancePath + "/degradation",
            schemaPath: "#/properties/degradation/required",
            keyword: "required",
            params: { missingProperty: "state" },
            message: "must have required property '" + "state" + "'",
          };
          if (vErrors === null) {
            vErrors = [err67];
          } else {
            vErrors.push(err67);
          }
          errors++;
        }
        if (data23.reason_code === undefined) {
          const err68 = {
            instancePath: instancePath + "/degradation",
            schemaPath: "#/properties/degradation/required",
            keyword: "required",
            params: { missingProperty: "reason_code" },
            message: "must have required property '" + "reason_code" + "'",
          };
          if (vErrors === null) {
            vErrors = [err68];
          } else {
            vErrors.push(err68);
          }
          errors++;
        }
        for (const key4 in data23) {
          if (!(key4 === "state" || key4 === "reason_code")) {
            const err69 = {
              instancePath: instancePath + "/degradation",
              schemaPath: "#/properties/degradation/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key4 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err69];
            } else {
              vErrors.push(err69);
            }
            errors++;
          }
        }
        if (data23.state !== undefined) {
          let data24 = data23.state;
          if (typeof data24 === "string") {
            if (func2(data24) < 1) {
              const err70 = {
                instancePath: instancePath + "/degradation/state",
                schemaPath: "#/properties/degradation/properties/state/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/degradation/state",
              schemaPath: "#/properties/degradation/properties/state/type",
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
        if (data23.reason_code !== undefined) {
          let data25 = data23.reason_code;
          if (typeof data25 === "string") {
            if (func2(data25) < 1) {
              const err72 = {
                instancePath: instancePath + "/degradation/reason_code",
                schemaPath: "#/properties/degradation/properties/reason_code/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err72];
              } else {
                vErrors.push(err72);
              }
              errors++;
            }
          } else {
            const err73 = {
              instancePath: instancePath + "/degradation/reason_code",
              schemaPath: "#/properties/degradation/properties/reason_code/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err73];
            } else {
              vErrors.push(err73);
            }
            errors++;
          }
        }
      } else {
        const err74 = {
          instancePath: instancePath + "/degradation",
          schemaPath: "#/properties/degradation/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err74];
        } else {
          vErrors.push(err74);
        }
        errors++;
      }
    }
    if (data.audit_summary !== undefined) {
      let data26 = data.audit_summary;
      if (data26 && typeof data26 == "object" && !Array.isArray(data26)) {
        if (data26.operations === undefined) {
          const err75 = {
            instancePath: instancePath + "/audit_summary",
            schemaPath: "#/properties/audit_summary/required",
            keyword: "required",
            params: { missingProperty: "operations" },
            message: "must have required property '" + "operations" + "'",
          };
          if (vErrors === null) {
            vErrors = [err75];
          } else {
            vErrors.push(err75);
          }
          errors++;
        }
        if (data26.tool_invocation_count === undefined) {
          const err76 = {
            instancePath: instancePath + "/audit_summary",
            schemaPath: "#/properties/audit_summary/required",
            keyword: "required",
            params: { missingProperty: "tool_invocation_count" },
            message: "must have required property '" + "tool_invocation_count" + "'",
          };
          if (vErrors === null) {
            vErrors = [err76];
          } else {
            vErrors.push(err76);
          }
          errors++;
        }
        if (data26.hidden_reasoning_returned === undefined) {
          const err77 = {
            instancePath: instancePath + "/audit_summary",
            schemaPath: "#/properties/audit_summary/required",
            keyword: "required",
            params: { missingProperty: "hidden_reasoning_returned" },
            message: "must have required property '" + "hidden_reasoning_returned" + "'",
          };
          if (vErrors === null) {
            vErrors = [err77];
          } else {
            vErrors.push(err77);
          }
          errors++;
        }
        for (const key5 in data26) {
          if (!(key5 === "operations" || key5 === "tool_invocation_count" || key5 === "hidden_reasoning_returned")) {
            const err78 = {
              instancePath: instancePath + "/audit_summary",
              schemaPath: "#/properties/audit_summary/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key5 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err78];
            } else {
              vErrors.push(err78);
            }
            errors++;
          }
        }
        if (data26.operations !== undefined) {
          let data27 = data26.operations;
          if (Array.isArray(data27)) {
            const len1 = data27.length;
            for (let i1 = 0; i1 < len1; i1++) {
              let data28 = data27[i1];
              if (!(data28 === "verified_snapshot_read" || data28 === "citation_resolution")) {
                const err79 = {
                  instancePath: instancePath + "/audit_summary/operations/" + i1,
                  schemaPath: "#/properties/audit_summary/properties/operations/items/enum",
                  keyword: "enum",
                  params: { allowedValues: schema37.properties.audit_summary.properties.operations.items.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err79];
                } else {
                  vErrors.push(err79);
                }
                errors++;
              }
            }
            let i2 = data27.length;
            let j0;
            if (i2 > 1) {
              outer0: for (; i2--;) {
                for (j0 = i2; j0--;) {
                  if (func0(data27[i2], data27[j0])) {
                    const err80 = {
                      instancePath: instancePath + "/audit_summary/operations",
                      schemaPath: "#/properties/audit_summary/properties/operations/uniqueItems",
                      keyword: "uniqueItems",
                      params: { i: i2, j: j0 },
                      message: "must NOT have duplicate items (items ## " + j0 + " and " + i2 + " are identical)",
                    };
                    if (vErrors === null) {
                      vErrors = [err80];
                    } else {
                      vErrors.push(err80);
                    }
                    errors++;
                    break outer0;
                  }
                }
              }
            }
          } else {
            const err81 = {
              instancePath: instancePath + "/audit_summary/operations",
              schemaPath: "#/properties/audit_summary/properties/operations/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err81];
            } else {
              vErrors.push(err81);
            }
            errors++;
          }
        }
        if (data26.tool_invocation_count !== undefined) {
          let data29 = data26.tool_invocation_count;
          if (!(typeof data29 == "number" && !(data29 % 1) && !isNaN(data29))) {
            const err82 = {
              instancePath: instancePath + "/audit_summary/tool_invocation_count",
              schemaPath: "#/properties/audit_summary/properties/tool_invocation_count/type",
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
          if (typeof data29 == "number") {
            if (data29 < 0 || isNaN(data29)) {
              const err83 = {
                instancePath: instancePath + "/audit_summary/tool_invocation_count",
                schemaPath: "#/properties/audit_summary/properties/tool_invocation_count/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err83];
              } else {
                vErrors.push(err83);
              }
              errors++;
            }
          }
        }
        if (data26.hidden_reasoning_returned !== undefined) {
          if (false !== data26.hidden_reasoning_returned) {
            const err84 = {
              instancePath: instancePath + "/audit_summary/hidden_reasoning_returned",
              schemaPath: "#/properties/audit_summary/properties/hidden_reasoning_returned/const",
              keyword: "const",
              params: { allowedValue: false },
              message: "must be equal to constant",
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
          instancePath: instancePath + "/audit_summary",
          schemaPath: "#/properties/audit_summary/type",
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
    if (data.generated_at !== undefined) {
      if (!(typeof data.generated_at === "string")) {
        const err86 = {
          instancePath: instancePath + "/generated_at",
          schemaPath: "#/properties/generated_at/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err86];
        } else {
          vErrors.push(err86);
        }
        errors++;
      }
    }
    if (data.persistence !== undefined) {
      let data32 = data.persistence;
      if (data32 && typeof data32 == "object" && !Array.isArray(data32)) {
        if (data32.mode === undefined) {
          const err87 = {
            instancePath: instancePath + "/persistence",
            schemaPath: "#/properties/persistence/required",
            keyword: "required",
            params: { missingProperty: "mode" },
            message: "must have required property '" + "mode" + "'",
          };
          if (vErrors === null) {
            vErrors = [err87];
          } else {
            vErrors.push(err87);
          }
          errors++;
        }
        if (data32.retained_until === undefined) {
          const err88 = {
            instancePath: instancePath + "/persistence",
            schemaPath: "#/properties/persistence/required",
            keyword: "required",
            params: { missingProperty: "retained_until" },
            message: "must have required property '" + "retained_until" + "'",
          };
          if (vErrors === null) {
            vErrors = [err88];
          } else {
            vErrors.push(err88);
          }
          errors++;
        }
        if (data32.snapshot_payload_retained === undefined) {
          const err89 = {
            instancePath: instancePath + "/persistence",
            schemaPath: "#/properties/persistence/required",
            keyword: "required",
            params: { missingProperty: "snapshot_payload_retained" },
            message: "must have required property '" + "snapshot_payload_retained" + "'",
          };
          if (vErrors === null) {
            vErrors = [err89];
          } else {
            vErrors.push(err89);
          }
          errors++;
        }
        if (data32.user_question_retained === undefined) {
          const err90 = {
            instancePath: instancePath + "/persistence",
            schemaPath: "#/properties/persistence/required",
            keyword: "required",
            params: { missingProperty: "user_question_retained" },
            message: "must have required property '" + "user_question_retained" + "'",
          };
          if (vErrors === null) {
            vErrors = [err90];
          } else {
            vErrors.push(err90);
          }
          errors++;
        }
        for (const key6 in data32) {
          if (!(
            key6 === "mode" ||
            key6 === "retained_until" ||
            key6 === "snapshot_payload_retained" ||
            key6 === "user_question_retained"
          )) {
            const err91 = {
              instancePath: instancePath + "/persistence",
              schemaPath: "#/properties/persistence/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key6 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err91];
            } else {
              vErrors.push(err91);
            }
            errors++;
          }
        }
        if (data32.mode !== undefined) {
          if ("run_local_terminal_metadata_only" !== data32.mode) {
            const err92 = {
              instancePath: instancePath + "/persistence/mode",
              schemaPath: "#/properties/persistence/properties/mode/const",
              keyword: "const",
              params: { allowedValue: "run_local_terminal_metadata_only" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err92];
            } else {
              vErrors.push(err92);
            }
            errors++;
          }
        }
        if (data32.retained_until !== undefined) {
          let data34 = data32.retained_until;
          if (typeof data34 !== "string" && data34 !== null) {
            const err93 = {
              instancePath: instancePath + "/persistence/retained_until",
              schemaPath: "#/properties/persistence/properties/retained_until/type",
              keyword: "type",
              params: { type: schema37.properties.persistence.properties.retained_until.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err93];
            } else {
              vErrors.push(err93);
            }
            errors++;
          }
        }
        if (data32.snapshot_payload_retained !== undefined) {
          if (false !== data32.snapshot_payload_retained) {
            const err94 = {
              instancePath: instancePath + "/persistence/snapshot_payload_retained",
              schemaPath: "#/properties/persistence/properties/snapshot_payload_retained/const",
              keyword: "const",
              params: { allowedValue: false },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err94];
            } else {
              vErrors.push(err94);
            }
            errors++;
          }
        }
        if (data32.user_question_retained !== undefined) {
          if (false !== data32.user_question_retained) {
            const err95 = {
              instancePath: instancePath + "/persistence/user_question_retained",
              schemaPath: "#/properties/persistence/properties/user_question_retained/const",
              keyword: "const",
              params: { allowedValue: false },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err95];
            } else {
              vErrors.push(err95);
            }
            errors++;
          }
        }
      } else {
        const err96 = {
          instancePath: instancePath + "/persistence",
          schemaPath: "#/properties/persistence/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err96];
        } else {
          vErrors.push(err96);
        }
        errors++;
      }
    }
    if (data.staleness !== undefined) {
      let data37 = data.staleness;
      if (data37 && typeof data37 == "object" && !Array.isArray(data37)) {
        if (data37.state === undefined) {
          const err97 = {
            instancePath: instancePath + "/staleness",
            schemaPath: "#/properties/staleness/required",
            keyword: "required",
            params: { missingProperty: "state" },
            message: "must have required property '" + "state" + "'",
          };
          if (vErrors === null) {
            vErrors = [err97];
          } else {
            vErrors.push(err97);
          }
          errors++;
        }
        if (data37.binding_fields === undefined) {
          const err98 = {
            instancePath: instancePath + "/staleness",
            schemaPath: "#/properties/staleness/required",
            keyword: "required",
            params: { missingProperty: "binding_fields" },
            message: "must have required property '" + "binding_fields" + "'",
          };
          if (vErrors === null) {
            vErrors = [err98];
          } else {
            vErrors.push(err98);
          }
          errors++;
        }
        for (const key7 in data37) {
          if (!(key7 === "state" || key7 === "binding_fields")) {
            const err99 = {
              instancePath: instancePath + "/staleness",
              schemaPath: "#/properties/staleness/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key7 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err99];
            } else {
              vErrors.push(err99);
            }
            errors++;
          }
        }
        if (data37.state !== undefined) {
          let data38 = data37.state;
          if (!(data38 === "current_at_generation" || data38 === "stale")) {
            const err100 = {
              instancePath: instancePath + "/staleness/state",
              schemaPath: "#/properties/staleness/properties/state/enum",
              keyword: "enum",
              params: { allowedValues: schema37.properties.staleness.properties.state.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err100];
            } else {
              vErrors.push(err100);
            }
            errors++;
          }
        }
        if (data37.binding_fields !== undefined) {
          let data39 = data37.binding_fields;
          if (Array.isArray(data39)) {
            const len2 = data39.length;
            for (let i3 = 0; i3 < len2; i3++) {
              let data40 = data39[i3];
              if (!(
                data40 === "run_id" ||
                data40 === "input_snapshot_digest" ||
                data40 === "schema_set_revision" ||
                data40 === "backend_identity"
              )) {
                const err101 = {
                  instancePath: instancePath + "/staleness/binding_fields/" + i3,
                  schemaPath: "#/properties/staleness/properties/binding_fields/items/enum",
                  keyword: "enum",
                  params: { allowedValues: schema37.properties.staleness.properties.binding_fields.items.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err101];
                } else {
                  vErrors.push(err101);
                }
                errors++;
              }
            }
            let i4 = data39.length;
            let j1;
            if (i4 > 1) {
              outer1: for (; i4--;) {
                for (j1 = i4; j1--;) {
                  if (func0(data39[i4], data39[j1])) {
                    const err102 = {
                      instancePath: instancePath + "/staleness/binding_fields",
                      schemaPath: "#/properties/staleness/properties/binding_fields/uniqueItems",
                      keyword: "uniqueItems",
                      params: { i: i4, j: j1 },
                      message: "must NOT have duplicate items (items ## " + j1 + " and " + i4 + " are identical)",
                    };
                    if (vErrors === null) {
                      vErrors = [err102];
                    } else {
                      vErrors.push(err102);
                    }
                    errors++;
                    break outer1;
                  }
                }
              }
            }
          } else {
            const err103 = {
              instancePath: instancePath + "/staleness/binding_fields",
              schemaPath: "#/properties/staleness/properties/binding_fields/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err103];
            } else {
              vErrors.push(err103);
            }
            errors++;
          }
        }
      } else {
        const err104 = {
          instancePath: instancePath + "/staleness",
          schemaPath: "#/properties/staleness/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
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
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err105];
    } else {
      vErrors.push(err105);
    }
    errors++;
  }
  validate21.errors = vErrors;
  return errors === 0;
}
validate21.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const evidenceAgentCitation = validate23;
