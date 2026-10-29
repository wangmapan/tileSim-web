// Generated standalone Agent Flow validators. Do not edit by hand.
/* eslint-disable */
"use strict";
export const agentFlowStartRequest = validate20;
const schema31 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.start_request.v1",
  title: "AgentFlowStartRequest",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "contract_revision",
    "session_id",
    "user_goal",
    "intent",
    "run_id",
    "run_context_revision",
    "backend_identity",
    "schema_set_revision",
    "input_snapshot_digest",
    "artifact_bindings",
  ],
  properties: {
    schema_identity: { const: "tilesim.agent_flow.start_request.v1" },
    contract_revision: { const: "2026-10-28.flow.v2" },
    session_id: { type: "string", minLength: 1, maxLength: 128 },
    user_goal: { type: "string", minLength: 1, maxLength: 20000 },
    intent: {
      enum: [
        "explain",
        "existing_run_analysis",
        "user_report",
        "configuration_draft",
        "navigation",
        "unsupported_execution",
      ],
    },
    run_id: { type: ["string", "null"], minLength: 1, maxLength: 128 },
    run_context_revision: { type: ["string", "null"], minLength: 1, maxLength: 256 },
    backend_identity: { type: "object", additionalProperties: true },
    schema_set_revision: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    input_snapshot_digest: { type: ["string", "null"], pattern: "^sha256:[0-9a-f]{64}$" },
    evidence_status: {
      enum: ["validated", "deterministic_fallback", "partial", "truncated", "missing", "provider_unavailable"],
    },
    artifact_bindings: { type: "array", maxItems: 256, items: { $ref: "artifact-binding.schema.json" } },
    current_page: { type: ["string", "null"], maxLength: 128 },
    current_page_capabilities: {
      type: "array",
      maxItems: 32,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    current_context_revision: { type: ["string", "null"], maxLength: 256 },
    required_capabilities: {
      type: "array",
      maxItems: 32,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    allowed_pages: {
      type: "array",
      maxItems: 32,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    allowed_actions: {
      type: "array",
      maxItems: 32,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    navigation_attempts: { type: "integer", minimum: 0, maximum: 8 },
    max_navigation_attempts: { type: "integer", minimum: 0, maximum: 8 },
    authorization_id: { type: "string", pattern: "^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" },
    authorization_digest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    authorization_budget: {
      type: "object",
      additionalProperties: false,
      required: [
        "max_navigation_attempts",
        "max_model_calls",
        "max_tool_calls_per_round",
        "max_run_creations",
        "max_execution_time_ms",
      ],
      properties: {
        max_navigation_attempts: { type: "integer", minimum: 1, maximum: 8 },
        max_model_calls: { type: "integer", minimum: 1, maximum: 60 },
        max_tool_calls_per_round: { type: "integer", minimum: 1, maximum: 4 },
        max_run_creations: { type: "integer", minimum: 1, maximum: 1 },
        max_execution_time_ms: { type: "integer", minimum: 1, maximum: 3600000 },
      },
    },
    principal: { type: "string", minLength: 1, maxLength: 128 },
    workspace_id: { type: "string", minLength: 1, maxLength: 128 },
  },
};
const schema32 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.artifact_binding.v1",
  title: "AgentFlowArtifactBinding",
  type: "object",
  additionalProperties: false,
  required: ["artifact_id", "schema_identity", "sha256", "bytes"],
  properties: {
    artifact_id: { type: "string", minLength: 1, maxLength: 256 },
    schema_identity: { type: "string", minLength: 1, maxLength: 256 },
    sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
    bytes: { type: "string", pattern: "^(?:0|[1-9][0-9]*)$" },
  },
};
const func1 = Object.prototype.hasOwnProperty;
import * as func2Module from "ajv/dist/runtime/ucs2length.js";
const func2 = func2Module.default?.default ?? func2Module.default ?? func2Module;
const pattern4 = new RegExp("^sha256:[0-9a-f]{64}$", "u");
const pattern6 = new RegExp("^[0-9a-f]{64}$", "u");
const pattern7 = new RegExp("^(?:0|[1-9][0-9]*)$", "u");
const pattern8 = new RegExp("^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$", "u");
function validate20(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_flow.start_request.v1" */ let vErrors = null;
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
    if (data.contract_revision === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "contract_revision" },
        message: "must have required property '" + "contract_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.session_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "session_id" },
        message: "must have required property '" + "session_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.user_goal === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "user_goal" },
        message: "must have required property '" + "user_goal" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.intent === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "intent" },
        message: "must have required property '" + "intent" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.run_id === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "run_id" },
        message: "must have required property '" + "run_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.run_context_revision === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "run_context_revision" },
        message: "must have required property '" + "run_context_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.backend_identity === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "backend_identity" },
        message: "must have required property '" + "backend_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.schema_set_revision === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_set_revision" },
        message: "must have required property '" + "schema_set_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.input_snapshot_digest === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "input_snapshot_digest" },
        message: "must have required property '" + "input_snapshot_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.artifact_bindings === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "artifact_bindings" },
        message: "must have required property '" + "artifact_bindings" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema31.properties, key0)) {
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
    if (data.schema_identity !== undefined) {
      if ("tilesim.agent_flow.start_request.v1" !== data.schema_identity) {
        const err12 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.agent_flow.start_request.v1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.contract_revision !== undefined) {
      if ("2026-10-28.flow.v2" !== data.contract_revision) {
        const err13 = {
          instancePath: instancePath + "/contract_revision",
          schemaPath: "#/properties/contract_revision/const",
          keyword: "const",
          params: { allowedValue: "2026-10-28.flow.v2" },
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
    if (data.session_id !== undefined) {
      let data2 = data.session_id;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err14 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err15 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/minLength",
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
          instancePath: instancePath + "/session_id",
          schemaPath: "#/properties/session_id/type",
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
    if (data.user_goal !== undefined) {
      let data3 = data.user_goal;
      if (typeof data3 === "string") {
        if (func2(data3) > 20000) {
          const err17 = {
            instancePath: instancePath + "/user_goal",
            schemaPath: "#/properties/user_goal/maxLength",
            keyword: "maxLength",
            params: { limit: 20000 },
            message: "must NOT have more than 20000 characters",
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err18 = {
            instancePath: instancePath + "/user_goal",
            schemaPath: "#/properties/user_goal/minLength",
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
          instancePath: instancePath + "/user_goal",
          schemaPath: "#/properties/user_goal/type",
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
    if (data.intent !== undefined) {
      let data4 = data.intent;
      if (!(
        data4 === "explain" ||
        data4 === "existing_run_analysis" ||
        data4 === "user_report" ||
        data4 === "configuration_draft" ||
        data4 === "navigation" ||
        data4 === "unsupported_execution"
      )) {
        const err20 = {
          instancePath: instancePath + "/intent",
          schemaPath: "#/properties/intent/enum",
          keyword: "enum",
          params: { allowedValues: schema31.properties.intent.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.run_id !== undefined) {
      let data5 = data.run_id;
      if (typeof data5 !== "string" && data5 !== null) {
        const err21 = {
          instancePath: instancePath + "/run_id",
          schemaPath: "#/properties/run_id/type",
          keyword: "type",
          params: { type: schema31.properties.run_id.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
      if (typeof data5 === "string") {
        if (func2(data5) > 128) {
          const err22 = {
            instancePath: instancePath + "/run_id",
            schemaPath: "#/properties/run_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (func2(data5) < 1) {
          const err23 = {
            instancePath: instancePath + "/run_id",
            schemaPath: "#/properties/run_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      }
    }
    if (data.run_context_revision !== undefined) {
      let data6 = data.run_context_revision;
      if (typeof data6 !== "string" && data6 !== null) {
        const err24 = {
          instancePath: instancePath + "/run_context_revision",
          schemaPath: "#/properties/run_context_revision/type",
          keyword: "type",
          params: { type: schema31.properties.run_context_revision.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
      if (typeof data6 === "string") {
        if (func2(data6) > 256) {
          const err25 = {
            instancePath: instancePath + "/run_context_revision",
            schemaPath: "#/properties/run_context_revision/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (func2(data6) < 1) {
          const err26 = {
            instancePath: instancePath + "/run_context_revision",
            schemaPath: "#/properties/run_context_revision/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
      }
    }
    if (data.backend_identity !== undefined) {
      let data7 = data.backend_identity;
      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
      } else {
        const err27 = {
          instancePath: instancePath + "/backend_identity",
          schemaPath: "#/properties/backend_identity/type",
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
    if (data.schema_set_revision !== undefined) {
      let data8 = data.schema_set_revision;
      if (typeof data8 === "string") {
        if (!pattern4.test(data8)) {
          const err28 = {
            instancePath: instancePath + "/schema_set_revision",
            schemaPath: "#/properties/schema_set_revision/pattern",
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
          instancePath: instancePath + "/schema_set_revision",
          schemaPath: "#/properties/schema_set_revision/type",
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
    if (data.input_snapshot_digest !== undefined) {
      let data9 = data.input_snapshot_digest;
      if (typeof data9 !== "string" && data9 !== null) {
        const err30 = {
          instancePath: instancePath + "/input_snapshot_digest",
          schemaPath: "#/properties/input_snapshot_digest/type",
          keyword: "type",
          params: { type: schema31.properties.input_snapshot_digest.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
      if (typeof data9 === "string") {
        if (!pattern4.test(data9)) {
          const err31 = {
            instancePath: instancePath + "/input_snapshot_digest",
            schemaPath: "#/properties/input_snapshot_digest/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
      }
    }
    if (data.evidence_status !== undefined) {
      let data10 = data.evidence_status;
      if (!(
        data10 === "validated" ||
        data10 === "deterministic_fallback" ||
        data10 === "partial" ||
        data10 === "truncated" ||
        data10 === "missing" ||
        data10 === "provider_unavailable"
      )) {
        const err32 = {
          instancePath: instancePath + "/evidence_status",
          schemaPath: "#/properties/evidence_status/enum",
          keyword: "enum",
          params: { allowedValues: schema31.properties.evidence_status.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err32];
        } else {
          vErrors.push(err32);
        }
        errors++;
      }
    }
    if (data.artifact_bindings !== undefined) {
      let data11 = data.artifact_bindings;
      if (Array.isArray(data11)) {
        if (data11.length > 256) {
          const err33 = {
            instancePath: instancePath + "/artifact_bindings",
            schemaPath: "#/properties/artifact_bindings/maxItems",
            keyword: "maxItems",
            params: { limit: 256 },
            message: "must NOT have more than 256 items",
          };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
        const len0 = data11.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data12 = data11[i0];
          if (data12 && typeof data12 == "object" && !Array.isArray(data12)) {
            if (data12.artifact_id === undefined) {
              const err34 = {
                instancePath: instancePath + "/artifact_bindings/" + i0,
                schemaPath: "artifact-binding.schema.json/required",
                keyword: "required",
                params: { missingProperty: "artifact_id" },
                message: "must have required property '" + "artifact_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err34];
              } else {
                vErrors.push(err34);
              }
              errors++;
            }
            if (data12.schema_identity === undefined) {
              const err35 = {
                instancePath: instancePath + "/artifact_bindings/" + i0,
                schemaPath: "artifact-binding.schema.json/required",
                keyword: "required",
                params: { missingProperty: "schema_identity" },
                message: "must have required property '" + "schema_identity" + "'",
              };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors++;
            }
            if (data12.sha256 === undefined) {
              const err36 = {
                instancePath: instancePath + "/artifact_bindings/" + i0,
                schemaPath: "artifact-binding.schema.json/required",
                keyword: "required",
                params: { missingProperty: "sha256" },
                message: "must have required property '" + "sha256" + "'",
              };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
            }
            if (data12.bytes === undefined) {
              const err37 = {
                instancePath: instancePath + "/artifact_bindings/" + i0,
                schemaPath: "artifact-binding.schema.json/required",
                keyword: "required",
                params: { missingProperty: "bytes" },
                message: "must have required property '" + "bytes" + "'",
              };
              if (vErrors === null) {
                vErrors = [err37];
              } else {
                vErrors.push(err37);
              }
              errors++;
            }
            for (const key1 in data12) {
              if (!(key1 === "artifact_id" || key1 === "schema_identity" || key1 === "sha256" || key1 === "bytes")) {
                const err38 = {
                  instancePath: instancePath + "/artifact_bindings/" + i0,
                  schemaPath: "artifact-binding.schema.json/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key1 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err38];
                } else {
                  vErrors.push(err38);
                }
                errors++;
              }
            }
            if (data12.artifact_id !== undefined) {
              let data13 = data12.artifact_id;
              if (typeof data13 === "string") {
                if (func2(data13) > 256) {
                  const err39 = {
                    instancePath: instancePath + "/artifact_bindings/" + i0 + "/artifact_id",
                    schemaPath: "artifact-binding.schema.json/properties/artifact_id/maxLength",
                    keyword: "maxLength",
                    params: { limit: 256 },
                    message: "must NOT have more than 256 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err39];
                  } else {
                    vErrors.push(err39);
                  }
                  errors++;
                }
                if (func2(data13) < 1) {
                  const err40 = {
                    instancePath: instancePath + "/artifact_bindings/" + i0 + "/artifact_id",
                    schemaPath: "artifact-binding.schema.json/properties/artifact_id/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err40];
                  } else {
                    vErrors.push(err40);
                  }
                  errors++;
                }
              } else {
                const err41 = {
                  instancePath: instancePath + "/artifact_bindings/" + i0 + "/artifact_id",
                  schemaPath: "artifact-binding.schema.json/properties/artifact_id/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err41];
                } else {
                  vErrors.push(err41);
                }
                errors++;
              }
            }
            if (data12.schema_identity !== undefined) {
              let data14 = data12.schema_identity;
              if (typeof data14 === "string") {
                if (func2(data14) > 256) {
                  const err42 = {
                    instancePath: instancePath + "/artifact_bindings/" + i0 + "/schema_identity",
                    schemaPath: "artifact-binding.schema.json/properties/schema_identity/maxLength",
                    keyword: "maxLength",
                    params: { limit: 256 },
                    message: "must NOT have more than 256 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err42];
                  } else {
                    vErrors.push(err42);
                  }
                  errors++;
                }
                if (func2(data14) < 1) {
                  const err43 = {
                    instancePath: instancePath + "/artifact_bindings/" + i0 + "/schema_identity",
                    schemaPath: "artifact-binding.schema.json/properties/schema_identity/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
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
                  instancePath: instancePath + "/artifact_bindings/" + i0 + "/schema_identity",
                  schemaPath: "artifact-binding.schema.json/properties/schema_identity/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err44];
                } else {
                  vErrors.push(err44);
                }
                errors++;
              }
            }
            if (data12.sha256 !== undefined) {
              let data15 = data12.sha256;
              if (typeof data15 === "string") {
                if (!pattern6.test(data15)) {
                  const err45 = {
                    instancePath: instancePath + "/artifact_bindings/" + i0 + "/sha256",
                    schemaPath: "artifact-binding.schema.json/properties/sha256/pattern",
                    keyword: "pattern",
                    params: { pattern: "^[0-9a-f]{64}$" },
                    message: 'must match pattern "' + "^[0-9a-f]{64}$" + '"',
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
                  instancePath: instancePath + "/artifact_bindings/" + i0 + "/sha256",
                  schemaPath: "artifact-binding.schema.json/properties/sha256/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err46];
                } else {
                  vErrors.push(err46);
                }
                errors++;
              }
            }
            if (data12.bytes !== undefined) {
              let data16 = data12.bytes;
              if (typeof data16 === "string") {
                if (!pattern7.test(data16)) {
                  const err47 = {
                    instancePath: instancePath + "/artifact_bindings/" + i0 + "/bytes",
                    schemaPath: "artifact-binding.schema.json/properties/bytes/pattern",
                    keyword: "pattern",
                    params: { pattern: "^(?:0|[1-9][0-9]*)$" },
                    message: 'must match pattern "' + "^(?:0|[1-9][0-9]*)$" + '"',
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
                  instancePath: instancePath + "/artifact_bindings/" + i0 + "/bytes",
                  schemaPath: "artifact-binding.schema.json/properties/bytes/type",
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
          } else {
            const err49 = {
              instancePath: instancePath + "/artifact_bindings/" + i0,
              schemaPath: "artifact-binding.schema.json/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
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
          instancePath: instancePath + "/artifact_bindings",
          schemaPath: "#/properties/artifact_bindings/type",
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
    if (data.current_page !== undefined) {
      let data17 = data.current_page;
      if (typeof data17 !== "string" && data17 !== null) {
        const err51 = {
          instancePath: instancePath + "/current_page",
          schemaPath: "#/properties/current_page/type",
          keyword: "type",
          params: { type: schema31.properties.current_page.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err51];
        } else {
          vErrors.push(err51);
        }
        errors++;
      }
      if (typeof data17 === "string") {
        if (func2(data17) > 128) {
          const err52 = {
            instancePath: instancePath + "/current_page",
            schemaPath: "#/properties/current_page/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err52];
          } else {
            vErrors.push(err52);
          }
          errors++;
        }
      }
    }
    if (data.current_page_capabilities !== undefined) {
      let data18 = data.current_page_capabilities;
      if (Array.isArray(data18)) {
        if (data18.length > 32) {
          const err53 = {
            instancePath: instancePath + "/current_page_capabilities",
            schemaPath: "#/properties/current_page_capabilities/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err53];
          } else {
            vErrors.push(err53);
          }
          errors++;
        }
        const len1 = data18.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data19 = data18[i1];
          if (typeof data19 === "string") {
            if (func2(data19) > 128) {
              const err54 = {
                instancePath: instancePath + "/current_page_capabilities/" + i1,
                schemaPath: "#/properties/current_page_capabilities/items/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err54];
              } else {
                vErrors.push(err54);
              }
              errors++;
            }
            if (func2(data19) < 1) {
              const err55 = {
                instancePath: instancePath + "/current_page_capabilities/" + i1,
                schemaPath: "#/properties/current_page_capabilities/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err55];
              } else {
                vErrors.push(err55);
              }
              errors++;
            }
          } else {
            const err56 = {
              instancePath: instancePath + "/current_page_capabilities/" + i1,
              schemaPath: "#/properties/current_page_capabilities/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err56];
            } else {
              vErrors.push(err56);
            }
            errors++;
          }
        }
        let i2 = data18.length;
        let j0;
        if (i2 > 1) {
          const indices0 = {};
          for (; i2--;) {
            let item0 = data18[i2];
            if (typeof item0 !== "string") {
              continue;
            }
            if (typeof indices0[item0] == "number") {
              j0 = indices0[item0];
              const err57 = {
                instancePath: instancePath + "/current_page_capabilities",
                schemaPath: "#/properties/current_page_capabilities/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i2, j: j0 },
                message: "must NOT have duplicate items (items ## " + j0 + " and " + i2 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err57];
              } else {
                vErrors.push(err57);
              }
              errors++;
              break;
            }
            indices0[item0] = i2;
          }
        }
      } else {
        const err58 = {
          instancePath: instancePath + "/current_page_capabilities",
          schemaPath: "#/properties/current_page_capabilities/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err58];
        } else {
          vErrors.push(err58);
        }
        errors++;
      }
    }
    if (data.current_context_revision !== undefined) {
      let data20 = data.current_context_revision;
      if (typeof data20 !== "string" && data20 !== null) {
        const err59 = {
          instancePath: instancePath + "/current_context_revision",
          schemaPath: "#/properties/current_context_revision/type",
          keyword: "type",
          params: { type: schema31.properties.current_context_revision.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err59];
        } else {
          vErrors.push(err59);
        }
        errors++;
      }
      if (typeof data20 === "string") {
        if (func2(data20) > 256) {
          const err60 = {
            instancePath: instancePath + "/current_context_revision",
            schemaPath: "#/properties/current_context_revision/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err60];
          } else {
            vErrors.push(err60);
          }
          errors++;
        }
      }
    }
    if (data.required_capabilities !== undefined) {
      let data21 = data.required_capabilities;
      if (Array.isArray(data21)) {
        if (data21.length > 32) {
          const err61 = {
            instancePath: instancePath + "/required_capabilities",
            schemaPath: "#/properties/required_capabilities/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err61];
          } else {
            vErrors.push(err61);
          }
          errors++;
        }
        const len2 = data21.length;
        for (let i3 = 0; i3 < len2; i3++) {
          let data22 = data21[i3];
          if (typeof data22 === "string") {
            if (func2(data22) > 128) {
              const err62 = {
                instancePath: instancePath + "/required_capabilities/" + i3,
                schemaPath: "#/properties/required_capabilities/items/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err62];
              } else {
                vErrors.push(err62);
              }
              errors++;
            }
            if (func2(data22) < 1) {
              const err63 = {
                instancePath: instancePath + "/required_capabilities/" + i3,
                schemaPath: "#/properties/required_capabilities/items/minLength",
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
              instancePath: instancePath + "/required_capabilities/" + i3,
              schemaPath: "#/properties/required_capabilities/items/type",
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
        let i4 = data21.length;
        let j1;
        if (i4 > 1) {
          const indices1 = {};
          for (; i4--;) {
            let item1 = data21[i4];
            if (typeof item1 !== "string") {
              continue;
            }
            if (typeof indices1[item1] == "number") {
              j1 = indices1[item1];
              const err65 = {
                instancePath: instancePath + "/required_capabilities",
                schemaPath: "#/properties/required_capabilities/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i4, j: j1 },
                message: "must NOT have duplicate items (items ## " + j1 + " and " + i4 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err65];
              } else {
                vErrors.push(err65);
              }
              errors++;
              break;
            }
            indices1[item1] = i4;
          }
        }
      } else {
        const err66 = {
          instancePath: instancePath + "/required_capabilities",
          schemaPath: "#/properties/required_capabilities/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err66];
        } else {
          vErrors.push(err66);
        }
        errors++;
      }
    }
    if (data.allowed_pages !== undefined) {
      let data23 = data.allowed_pages;
      if (Array.isArray(data23)) {
        if (data23.length > 32) {
          const err67 = {
            instancePath: instancePath + "/allowed_pages",
            schemaPath: "#/properties/allowed_pages/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err67];
          } else {
            vErrors.push(err67);
          }
          errors++;
        }
        const len3 = data23.length;
        for (let i5 = 0; i5 < len3; i5++) {
          let data24 = data23[i5];
          if (typeof data24 === "string") {
            if (func2(data24) > 128) {
              const err68 = {
                instancePath: instancePath + "/allowed_pages/" + i5,
                schemaPath: "#/properties/allowed_pages/items/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err68];
              } else {
                vErrors.push(err68);
              }
              errors++;
            }
            if (func2(data24) < 1) {
              const err69 = {
                instancePath: instancePath + "/allowed_pages/" + i5,
                schemaPath: "#/properties/allowed_pages/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err69];
              } else {
                vErrors.push(err69);
              }
              errors++;
            }
          } else {
            const err70 = {
              instancePath: instancePath + "/allowed_pages/" + i5,
              schemaPath: "#/properties/allowed_pages/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err70];
            } else {
              vErrors.push(err70);
            }
            errors++;
          }
        }
        let i6 = data23.length;
        let j2;
        if (i6 > 1) {
          const indices2 = {};
          for (; i6--;) {
            let item2 = data23[i6];
            if (typeof item2 !== "string") {
              continue;
            }
            if (typeof indices2[item2] == "number") {
              j2 = indices2[item2];
              const err71 = {
                instancePath: instancePath + "/allowed_pages",
                schemaPath: "#/properties/allowed_pages/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i6, j: j2 },
                message: "must NOT have duplicate items (items ## " + j2 + " and " + i6 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err71];
              } else {
                vErrors.push(err71);
              }
              errors++;
              break;
            }
            indices2[item2] = i6;
          }
        }
      } else {
        const err72 = {
          instancePath: instancePath + "/allowed_pages",
          schemaPath: "#/properties/allowed_pages/type",
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
    if (data.allowed_actions !== undefined) {
      let data25 = data.allowed_actions;
      if (Array.isArray(data25)) {
        if (data25.length > 32) {
          const err73 = {
            instancePath: instancePath + "/allowed_actions",
            schemaPath: "#/properties/allowed_actions/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err73];
          } else {
            vErrors.push(err73);
          }
          errors++;
        }
        const len4 = data25.length;
        for (let i7 = 0; i7 < len4; i7++) {
          let data26 = data25[i7];
          if (typeof data26 === "string") {
            if (func2(data26) > 128) {
              const err74 = {
                instancePath: instancePath + "/allowed_actions/" + i7,
                schemaPath: "#/properties/allowed_actions/items/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err74];
              } else {
                vErrors.push(err74);
              }
              errors++;
            }
            if (func2(data26) < 1) {
              const err75 = {
                instancePath: instancePath + "/allowed_actions/" + i7,
                schemaPath: "#/properties/allowed_actions/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err75];
              } else {
                vErrors.push(err75);
              }
              errors++;
            }
          } else {
            const err76 = {
              instancePath: instancePath + "/allowed_actions/" + i7,
              schemaPath: "#/properties/allowed_actions/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err76];
            } else {
              vErrors.push(err76);
            }
            errors++;
          }
        }
        let i8 = data25.length;
        let j3;
        if (i8 > 1) {
          const indices3 = {};
          for (; i8--;) {
            let item3 = data25[i8];
            if (typeof item3 !== "string") {
              continue;
            }
            if (typeof indices3[item3] == "number") {
              j3 = indices3[item3];
              const err77 = {
                instancePath: instancePath + "/allowed_actions",
                schemaPath: "#/properties/allowed_actions/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i8, j: j3 },
                message: "must NOT have duplicate items (items ## " + j3 + " and " + i8 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err77];
              } else {
                vErrors.push(err77);
              }
              errors++;
              break;
            }
            indices3[item3] = i8;
          }
        }
      } else {
        const err78 = {
          instancePath: instancePath + "/allowed_actions",
          schemaPath: "#/properties/allowed_actions/type",
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
    if (data.navigation_attempts !== undefined) {
      let data27 = data.navigation_attempts;
      if (!(typeof data27 == "number" && !(data27 % 1) && !isNaN(data27))) {
        const err79 = {
          instancePath: instancePath + "/navigation_attempts",
          schemaPath: "#/properties/navigation_attempts/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err79];
        } else {
          vErrors.push(err79);
        }
        errors++;
      }
      if (typeof data27 == "number") {
        if (data27 > 8 || isNaN(data27)) {
          const err80 = {
            instancePath: instancePath + "/navigation_attempts",
            schemaPath: "#/properties/navigation_attempts/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 8 },
            message: "must be <= 8",
          };
          if (vErrors === null) {
            vErrors = [err80];
          } else {
            vErrors.push(err80);
          }
          errors++;
        }
        if (data27 < 0 || isNaN(data27)) {
          const err81 = {
            instancePath: instancePath + "/navigation_attempts",
            schemaPath: "#/properties/navigation_attempts/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err81];
          } else {
            vErrors.push(err81);
          }
          errors++;
        }
      }
    }
    if (data.max_navigation_attempts !== undefined) {
      let data28 = data.max_navigation_attempts;
      if (!(typeof data28 == "number" && !(data28 % 1) && !isNaN(data28))) {
        const err82 = {
          instancePath: instancePath + "/max_navigation_attempts",
          schemaPath: "#/properties/max_navigation_attempts/type",
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
      if (typeof data28 == "number") {
        if (data28 > 8 || isNaN(data28)) {
          const err83 = {
            instancePath: instancePath + "/max_navigation_attempts",
            schemaPath: "#/properties/max_navigation_attempts/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 8 },
            message: "must be <= 8",
          };
          if (vErrors === null) {
            vErrors = [err83];
          } else {
            vErrors.push(err83);
          }
          errors++;
        }
        if (data28 < 0 || isNaN(data28)) {
          const err84 = {
            instancePath: instancePath + "/max_navigation_attempts",
            schemaPath: "#/properties/max_navigation_attempts/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
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
    if (data.authorization_id !== undefined) {
      let data29 = data.authorization_id;
      if (typeof data29 === "string") {
        if (!pattern8.test(data29)) {
          const err85 = {
            instancePath: instancePath + "/authorization_id",
            schemaPath: "#/properties/authorization_id/pattern",
            keyword: "pattern",
            params: { pattern: "^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" },
            message: 'must match pattern "' + "^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err85];
          } else {
            vErrors.push(err85);
          }
          errors++;
        }
      } else {
        const err86 = {
          instancePath: instancePath + "/authorization_id",
          schemaPath: "#/properties/authorization_id/type",
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
    if (data.authorization_digest !== undefined) {
      let data30 = data.authorization_digest;
      if (typeof data30 === "string") {
        if (!pattern4.test(data30)) {
          const err87 = {
            instancePath: instancePath + "/authorization_digest",
            schemaPath: "#/properties/authorization_digest/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err87];
          } else {
            vErrors.push(err87);
          }
          errors++;
        }
      } else {
        const err88 = {
          instancePath: instancePath + "/authorization_digest",
          schemaPath: "#/properties/authorization_digest/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err88];
        } else {
          vErrors.push(err88);
        }
        errors++;
      }
    }
    if (data.authorization_budget !== undefined) {
      let data31 = data.authorization_budget;
      if (data31 && typeof data31 == "object" && !Array.isArray(data31)) {
        if (data31.max_navigation_attempts === undefined) {
          const err89 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_navigation_attempts" },
            message: "must have required property '" + "max_navigation_attempts" + "'",
          };
          if (vErrors === null) {
            vErrors = [err89];
          } else {
            vErrors.push(err89);
          }
          errors++;
        }
        if (data31.max_model_calls === undefined) {
          const err90 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_model_calls" },
            message: "must have required property '" + "max_model_calls" + "'",
          };
          if (vErrors === null) {
            vErrors = [err90];
          } else {
            vErrors.push(err90);
          }
          errors++;
        }
        if (data31.max_tool_calls_per_round === undefined) {
          const err91 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_tool_calls_per_round" },
            message: "must have required property '" + "max_tool_calls_per_round" + "'",
          };
          if (vErrors === null) {
            vErrors = [err91];
          } else {
            vErrors.push(err91);
          }
          errors++;
        }
        if (data31.max_run_creations === undefined) {
          const err92 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_run_creations" },
            message: "must have required property '" + "max_run_creations" + "'",
          };
          if (vErrors === null) {
            vErrors = [err92];
          } else {
            vErrors.push(err92);
          }
          errors++;
        }
        if (data31.max_execution_time_ms === undefined) {
          const err93 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_execution_time_ms" },
            message: "must have required property '" + "max_execution_time_ms" + "'",
          };
          if (vErrors === null) {
            vErrors = [err93];
          } else {
            vErrors.push(err93);
          }
          errors++;
        }
        for (const key2 in data31) {
          if (!(
            key2 === "max_navigation_attempts" ||
            key2 === "max_model_calls" ||
            key2 === "max_tool_calls_per_round" ||
            key2 === "max_run_creations" ||
            key2 === "max_execution_time_ms"
          )) {
            const err94 = {
              instancePath: instancePath + "/authorization_budget",
              schemaPath: "#/properties/authorization_budget/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err94];
            } else {
              vErrors.push(err94);
            }
            errors++;
          }
        }
        if (data31.max_navigation_attempts !== undefined) {
          let data32 = data31.max_navigation_attempts;
          if (!(typeof data32 == "number" && !(data32 % 1) && !isNaN(data32))) {
            const err95 = {
              instancePath: instancePath + "/authorization_budget/max_navigation_attempts",
              schemaPath: "#/properties/authorization_budget/properties/max_navigation_attempts/type",
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
          if (typeof data32 == "number") {
            if (data32 > 8 || isNaN(data32)) {
              const err96 = {
                instancePath: instancePath + "/authorization_budget/max_navigation_attempts",
                schemaPath: "#/properties/authorization_budget/properties/max_navigation_attempts/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 8 },
                message: "must be <= 8",
              };
              if (vErrors === null) {
                vErrors = [err96];
              } else {
                vErrors.push(err96);
              }
              errors++;
            }
            if (data32 < 1 || isNaN(data32)) {
              const err97 = {
                instancePath: instancePath + "/authorization_budget/max_navigation_attempts",
                schemaPath: "#/properties/authorization_budget/properties/max_navigation_attempts/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
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
        if (data31.max_model_calls !== undefined) {
          let data33 = data31.max_model_calls;
          if (!(typeof data33 == "number" && !(data33 % 1) && !isNaN(data33))) {
            const err98 = {
              instancePath: instancePath + "/authorization_budget/max_model_calls",
              schemaPath: "#/properties/authorization_budget/properties/max_model_calls/type",
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
          if (typeof data33 == "number") {
            if (data33 > 60 || isNaN(data33)) {
              const err99 = {
                instancePath: instancePath + "/authorization_budget/max_model_calls",
                schemaPath: "#/properties/authorization_budget/properties/max_model_calls/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 60 },
                message: "must be <= 60",
              };
              if (vErrors === null) {
                vErrors = [err99];
              } else {
                vErrors.push(err99);
              }
              errors++;
            }
            if (data33 < 1 || isNaN(data33)) {
              const err100 = {
                instancePath: instancePath + "/authorization_budget/max_model_calls",
                schemaPath: "#/properties/authorization_budget/properties/max_model_calls/minimum",
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
        if (data31.max_tool_calls_per_round !== undefined) {
          let data34 = data31.max_tool_calls_per_round;
          if (!(typeof data34 == "number" && !(data34 % 1) && !isNaN(data34))) {
            const err101 = {
              instancePath: instancePath + "/authorization_budget/max_tool_calls_per_round",
              schemaPath: "#/properties/authorization_budget/properties/max_tool_calls_per_round/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err101];
            } else {
              vErrors.push(err101);
            }
            errors++;
          }
          if (typeof data34 == "number") {
            if (data34 > 4 || isNaN(data34)) {
              const err102 = {
                instancePath: instancePath + "/authorization_budget/max_tool_calls_per_round",
                schemaPath: "#/properties/authorization_budget/properties/max_tool_calls_per_round/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 4 },
                message: "must be <= 4",
              };
              if (vErrors === null) {
                vErrors = [err102];
              } else {
                vErrors.push(err102);
              }
              errors++;
            }
            if (data34 < 1 || isNaN(data34)) {
              const err103 = {
                instancePath: instancePath + "/authorization_budget/max_tool_calls_per_round",
                schemaPath: "#/properties/authorization_budget/properties/max_tool_calls_per_round/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err103];
              } else {
                vErrors.push(err103);
              }
              errors++;
            }
          }
        }
        if (data31.max_run_creations !== undefined) {
          let data35 = data31.max_run_creations;
          if (!(typeof data35 == "number" && !(data35 % 1) && !isNaN(data35))) {
            const err104 = {
              instancePath: instancePath + "/authorization_budget/max_run_creations",
              schemaPath: "#/properties/authorization_budget/properties/max_run_creations/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err104];
            } else {
              vErrors.push(err104);
            }
            errors++;
          }
          if (typeof data35 == "number") {
            if (data35 > 1 || isNaN(data35)) {
              const err105 = {
                instancePath: instancePath + "/authorization_budget/max_run_creations",
                schemaPath: "#/properties/authorization_budget/properties/max_run_creations/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 1 },
                message: "must be <= 1",
              };
              if (vErrors === null) {
                vErrors = [err105];
              } else {
                vErrors.push(err105);
              }
              errors++;
            }
            if (data35 < 1 || isNaN(data35)) {
              const err106 = {
                instancePath: instancePath + "/authorization_budget/max_run_creations",
                schemaPath: "#/properties/authorization_budget/properties/max_run_creations/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err106];
              } else {
                vErrors.push(err106);
              }
              errors++;
            }
          }
        }
        if (data31.max_execution_time_ms !== undefined) {
          let data36 = data31.max_execution_time_ms;
          if (!(typeof data36 == "number" && !(data36 % 1) && !isNaN(data36))) {
            const err107 = {
              instancePath: instancePath + "/authorization_budget/max_execution_time_ms",
              schemaPath: "#/properties/authorization_budget/properties/max_execution_time_ms/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err107];
            } else {
              vErrors.push(err107);
            }
            errors++;
          }
          if (typeof data36 == "number") {
            if (data36 > 3600000 || isNaN(data36)) {
              const err108 = {
                instancePath: instancePath + "/authorization_budget/max_execution_time_ms",
                schemaPath: "#/properties/authorization_budget/properties/max_execution_time_ms/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 3600000 },
                message: "must be <= 3600000",
              };
              if (vErrors === null) {
                vErrors = [err108];
              } else {
                vErrors.push(err108);
              }
              errors++;
            }
            if (data36 < 1 || isNaN(data36)) {
              const err109 = {
                instancePath: instancePath + "/authorization_budget/max_execution_time_ms",
                schemaPath: "#/properties/authorization_budget/properties/max_execution_time_ms/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err109];
              } else {
                vErrors.push(err109);
              }
              errors++;
            }
          }
        }
      } else {
        const err110 = {
          instancePath: instancePath + "/authorization_budget",
          schemaPath: "#/properties/authorization_budget/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err110];
        } else {
          vErrors.push(err110);
        }
        errors++;
      }
    }
    if (data.principal !== undefined) {
      let data37 = data.principal;
      if (typeof data37 === "string") {
        if (func2(data37) > 128) {
          const err111 = {
            instancePath: instancePath + "/principal",
            schemaPath: "#/properties/principal/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err111];
          } else {
            vErrors.push(err111);
          }
          errors++;
        }
        if (func2(data37) < 1) {
          const err112 = {
            instancePath: instancePath + "/principal",
            schemaPath: "#/properties/principal/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err112];
          } else {
            vErrors.push(err112);
          }
          errors++;
        }
      } else {
        const err113 = {
          instancePath: instancePath + "/principal",
          schemaPath: "#/properties/principal/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err113];
        } else {
          vErrors.push(err113);
        }
        errors++;
      }
    }
    if (data.workspace_id !== undefined) {
      let data38 = data.workspace_id;
      if (typeof data38 === "string") {
        if (func2(data38) > 128) {
          const err114 = {
            instancePath: instancePath + "/workspace_id",
            schemaPath: "#/properties/workspace_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err114];
          } else {
            vErrors.push(err114);
          }
          errors++;
        }
        if (func2(data38) < 1) {
          const err115 = {
            instancePath: instancePath + "/workspace_id",
            schemaPath: "#/properties/workspace_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
          instancePath: instancePath + "/workspace_id",
          schemaPath: "#/properties/workspace_id/type",
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
      instancePath,
      schemaPath: "#/type",
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
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const agentFlowResumeRequest = validate21;
const schema33 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.resume_request.v1",
  title: "AgentFlowResumeRequest",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "contract_revision",
    "flow_id",
    "session_id",
    "action",
    "pending_action",
    "current_binding",
    "current_event_sequence",
  ],
  properties: {
    schema_identity: { const: "tilesim.agent_flow.resume_request.v1" },
    contract_revision: { const: "2026-10-28.flow.v2" },
    flow_id: { type: "string", minLength: 1, maxLength: 128 },
    session_id: { type: "string", minLength: 1, maxLength: 128 },
    action: { enum: ["clarify_intent", "confirm_report", "confirm_draft", "confirm_navigation", "cancel", "reject"] },
    intent: {
      enum: [
        "explain",
        "existing_run_analysis",
        "user_report",
        "configuration_draft",
        "navigation",
        "unsupported_execution",
      ],
    },
    pending_action: { enum: ["clarify_intent", "confirm_report", "confirm_draft", "confirm_navigation", null] },
    navigation_observation: { $ref: "navigation-observation.schema.json" },
    current_binding: { $ref: "identity-binding.schema.json" },
    current_event_sequence: { type: "integer", minimum: 0 },
    clarification: { type: ["string", "null"], maxLength: 20000 },
    reason: { type: ["string", "null"], maxLength: 2000 },
    approval_digest: { type: ["string", "null"], minLength: 1, maxLength: 256 },
    authorization_id: { type: "string", pattern: "^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" },
    authorization_digest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    authorization_budget: {
      type: "object",
      additionalProperties: false,
      required: [
        "max_navigation_attempts",
        "max_model_calls",
        "max_tool_calls_per_round",
        "max_run_creations",
        "max_execution_time_ms",
      ],
      properties: {
        max_navigation_attempts: { type: "integer", minimum: 1, maximum: 8 },
        max_model_calls: { type: "integer", minimum: 1, maximum: 60 },
        max_tool_calls_per_round: { type: "integer", minimum: 1, maximum: 4 },
        max_run_creations: { type: "integer", minimum: 1, maximum: 1 },
        max_execution_time_ms: { type: "integer", minimum: 1, maximum: 3600000 },
      },
    },
    principal: { type: "string", minLength: 1, maxLength: 128 },
    workspace_id: { type: "string", minLength: 1, maxLength: 128 },
  },
};
const schema34 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.navigation_observation.v1",
  title: "AgentFlowNavigationObservation",
  type: "object",
  additionalProperties: false,
  required: [
    "target_page",
    "actual_page",
    "page_correct",
    "current_page_capabilities",
    "current_run_id",
    "current_context_revision",
    "failure_type",
    "retry_allowed",
    "visited_pages",
    "navigation_attempts",
  ],
  properties: {
    target_page: { type: "string", minLength: 1, maxLength: 128 },
    actual_page: { type: ["string", "null"], maxLength: 128 },
    page_correct: { type: "boolean" },
    current_page_capabilities: {
      type: "array",
      maxItems: 32,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    current_run_id: { type: ["string", "null"], maxLength: 128 },
    current_context_revision: { type: ["string", "null"], maxLength: 256 },
    failure_type: {
      enum: [
        "navigation_error",
        "context_unavailable",
        "context_invalid",
        "page_mismatch",
        "capability_missing",
        "stale_identity",
        null,
      ],
    },
    retry_allowed: { type: "boolean" },
    visited_pages: {
      type: "array",
      maxItems: 8,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    navigation_attempts: { type: "integer", minimum: 0, maximum: 8 },
  },
};
const schema35 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.identity_binding.v1",
  title: "AgentFlowIdentityBinding",
  type: "object",
  additionalProperties: false,
  required: [
    "session_id",
    "flow_id",
    "run_id",
    "run_context_revision",
    "backend_identity",
    "schema_set_revision",
    "input_snapshot_digest",
    "artifact_bindings",
  ],
  properties: {
    session_id: { type: "string", minLength: 1, maxLength: 128 },
    flow_id: { type: ["string", "null"], minLength: 1, maxLength: 128 },
    run_id: { type: ["string", "null"], minLength: 1, maxLength: 128 },
    run_context_revision: { type: ["string", "null"], minLength: 1, maxLength: 256 },
    backend_identity: { type: "object", additionalProperties: true },
    schema_set_revision: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    input_snapshot_digest: { type: ["string", "null"], pattern: "^sha256:[0-9a-f]{64}$" },
    artifact_bindings: { type: "array", maxItems: 256, items: { $ref: "artifact-binding.schema.json" } },
  },
};
function validate22(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_flow.identity_binding.v1" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.session_id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "session_id" },
        message: "must have required property '" + "session_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.flow_id === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "flow_id" },
        message: "must have required property '" + "flow_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.run_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "run_id" },
        message: "must have required property '" + "run_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.run_context_revision === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "run_context_revision" },
        message: "must have required property '" + "run_context_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.backend_identity === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "backend_identity" },
        message: "must have required property '" + "backend_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.schema_set_revision === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_set_revision" },
        message: "must have required property '" + "schema_set_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.input_snapshot_digest === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "input_snapshot_digest" },
        message: "must have required property '" + "input_snapshot_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.artifact_bindings === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "artifact_bindings" },
        message: "must have required property '" + "artifact_bindings" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "session_id" ||
        key0 === "flow_id" ||
        key0 === "run_id" ||
        key0 === "run_context_revision" ||
        key0 === "backend_identity" ||
        key0 === "schema_set_revision" ||
        key0 === "input_snapshot_digest" ||
        key0 === "artifact_bindings"
      )) {
        const err8 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.session_id !== undefined) {
      let data0 = data.session_id;
      if (typeof data0 === "string") {
        if (func2(data0) > 128) {
          const err9 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err10 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/minLength",
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
          instancePath: instancePath + "/session_id",
          schemaPath: "#/properties/session_id/type",
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
    if (data.flow_id !== undefined) {
      let data1 = data.flow_id;
      if (typeof data1 !== "string" && data1 !== null) {
        const err12 = {
          instancePath: instancePath + "/flow_id",
          schemaPath: "#/properties/flow_id/type",
          keyword: "type",
          params: { type: schema35.properties.flow_id.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
      if (typeof data1 === "string") {
        if (func2(data1) > 128) {
          const err13 = {
            instancePath: instancePath + "/flow_id",
            schemaPath: "#/properties/flow_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err14 = {
            instancePath: instancePath + "/flow_id",
            schemaPath: "#/properties/flow_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
    if (data.run_id !== undefined) {
      let data2 = data.run_id;
      if (typeof data2 !== "string" && data2 !== null) {
        const err15 = {
          instancePath: instancePath + "/run_id",
          schemaPath: "#/properties/run_id/type",
          keyword: "type",
          params: { type: schema35.properties.run_id.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err16 = {
            instancePath: instancePath + "/run_id",
            schemaPath: "#/properties/run_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err17 = {
            instancePath: instancePath + "/run_id",
            schemaPath: "#/properties/run_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
    if (data.run_context_revision !== undefined) {
      let data3 = data.run_context_revision;
      if (typeof data3 !== "string" && data3 !== null) {
        const err18 = {
          instancePath: instancePath + "/run_context_revision",
          schemaPath: "#/properties/run_context_revision/type",
          keyword: "type",
          params: { type: schema35.properties.run_context_revision.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
      if (typeof data3 === "string") {
        if (func2(data3) > 256) {
          const err19 = {
            instancePath: instancePath + "/run_context_revision",
            schemaPath: "#/properties/run_context_revision/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err20 = {
            instancePath: instancePath + "/run_context_revision",
            schemaPath: "#/properties/run_context_revision/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      }
    }
    if (data.backend_identity !== undefined) {
      let data4 = data.backend_identity;
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
      } else {
        const err21 = {
          instancePath: instancePath + "/backend_identity",
          schemaPath: "#/properties/backend_identity/type",
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
    if (data.schema_set_revision !== undefined) {
      let data5 = data.schema_set_revision;
      if (typeof data5 === "string") {
        if (!pattern4.test(data5)) {
          const err22 = {
            instancePath: instancePath + "/schema_set_revision",
            schemaPath: "#/properties/schema_set_revision/pattern",
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
          instancePath: instancePath + "/schema_set_revision",
          schemaPath: "#/properties/schema_set_revision/type",
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
    if (data.input_snapshot_digest !== undefined) {
      let data6 = data.input_snapshot_digest;
      if (typeof data6 !== "string" && data6 !== null) {
        const err24 = {
          instancePath: instancePath + "/input_snapshot_digest",
          schemaPath: "#/properties/input_snapshot_digest/type",
          keyword: "type",
          params: { type: schema35.properties.input_snapshot_digest.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
      if (typeof data6 === "string") {
        if (!pattern4.test(data6)) {
          const err25 = {
            instancePath: instancePath + "/input_snapshot_digest",
            schemaPath: "#/properties/input_snapshot_digest/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
      }
    }
    if (data.artifact_bindings !== undefined) {
      let data7 = data.artifact_bindings;
      if (Array.isArray(data7)) {
        if (data7.length > 256) {
          const err26 = {
            instancePath: instancePath + "/artifact_bindings",
            schemaPath: "#/properties/artifact_bindings/maxItems",
            keyword: "maxItems",
            params: { limit: 256 },
            message: "must NOT have more than 256 items",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        const len0 = data7.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data8 = data7[i0];
          if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
            if (data8.artifact_id === undefined) {
              const err27 = {
                instancePath: instancePath + "/artifact_bindings/" + i0,
                schemaPath: "artifact-binding.schema.json/required",
                keyword: "required",
                params: { missingProperty: "artifact_id" },
                message: "must have required property '" + "artifact_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err27];
              } else {
                vErrors.push(err27);
              }
              errors++;
            }
            if (data8.schema_identity === undefined) {
              const err28 = {
                instancePath: instancePath + "/artifact_bindings/" + i0,
                schemaPath: "artifact-binding.schema.json/required",
                keyword: "required",
                params: { missingProperty: "schema_identity" },
                message: "must have required property '" + "schema_identity" + "'",
              };
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            }
            if (data8.sha256 === undefined) {
              const err29 = {
                instancePath: instancePath + "/artifact_bindings/" + i0,
                schemaPath: "artifact-binding.schema.json/required",
                keyword: "required",
                params: { missingProperty: "sha256" },
                message: "must have required property '" + "sha256" + "'",
              };
              if (vErrors === null) {
                vErrors = [err29];
              } else {
                vErrors.push(err29);
              }
              errors++;
            }
            if (data8.bytes === undefined) {
              const err30 = {
                instancePath: instancePath + "/artifact_bindings/" + i0,
                schemaPath: "artifact-binding.schema.json/required",
                keyword: "required",
                params: { missingProperty: "bytes" },
                message: "must have required property '" + "bytes" + "'",
              };
              if (vErrors === null) {
                vErrors = [err30];
              } else {
                vErrors.push(err30);
              }
              errors++;
            }
            for (const key1 in data8) {
              if (!(key1 === "artifact_id" || key1 === "schema_identity" || key1 === "sha256" || key1 === "bytes")) {
                const err31 = {
                  instancePath: instancePath + "/artifact_bindings/" + i0,
                  schemaPath: "artifact-binding.schema.json/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key1 },
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
            if (data8.artifact_id !== undefined) {
              let data9 = data8.artifact_id;
              if (typeof data9 === "string") {
                if (func2(data9) > 256) {
                  const err32 = {
                    instancePath: instancePath + "/artifact_bindings/" + i0 + "/artifact_id",
                    schemaPath: "artifact-binding.schema.json/properties/artifact_id/maxLength",
                    keyword: "maxLength",
                    params: { limit: 256 },
                    message: "must NOT have more than 256 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err32];
                  } else {
                    vErrors.push(err32);
                  }
                  errors++;
                }
                if (func2(data9) < 1) {
                  const err33 = {
                    instancePath: instancePath + "/artifact_bindings/" + i0 + "/artifact_id",
                    schemaPath: "artifact-binding.schema.json/properties/artifact_id/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
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
                  instancePath: instancePath + "/artifact_bindings/" + i0 + "/artifact_id",
                  schemaPath: "artifact-binding.schema.json/properties/artifact_id/type",
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
            if (data8.schema_identity !== undefined) {
              let data10 = data8.schema_identity;
              if (typeof data10 === "string") {
                if (func2(data10) > 256) {
                  const err35 = {
                    instancePath: instancePath + "/artifact_bindings/" + i0 + "/schema_identity",
                    schemaPath: "artifact-binding.schema.json/properties/schema_identity/maxLength",
                    keyword: "maxLength",
                    params: { limit: 256 },
                    message: "must NOT have more than 256 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err35];
                  } else {
                    vErrors.push(err35);
                  }
                  errors++;
                }
                if (func2(data10) < 1) {
                  const err36 = {
                    instancePath: instancePath + "/artifact_bindings/" + i0 + "/schema_identity",
                    schemaPath: "artifact-binding.schema.json/properties/schema_identity/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
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
                  instancePath: instancePath + "/artifact_bindings/" + i0 + "/schema_identity",
                  schemaPath: "artifact-binding.schema.json/properties/schema_identity/type",
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
            if (data8.sha256 !== undefined) {
              let data11 = data8.sha256;
              if (typeof data11 === "string") {
                if (!pattern6.test(data11)) {
                  const err38 = {
                    instancePath: instancePath + "/artifact_bindings/" + i0 + "/sha256",
                    schemaPath: "artifact-binding.schema.json/properties/sha256/pattern",
                    keyword: "pattern",
                    params: { pattern: "^[0-9a-f]{64}$" },
                    message: 'must match pattern "' + "^[0-9a-f]{64}$" + '"',
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
                  instancePath: instancePath + "/artifact_bindings/" + i0 + "/sha256",
                  schemaPath: "artifact-binding.schema.json/properties/sha256/type",
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
            if (data8.bytes !== undefined) {
              let data12 = data8.bytes;
              if (typeof data12 === "string") {
                if (!pattern7.test(data12)) {
                  const err40 = {
                    instancePath: instancePath + "/artifact_bindings/" + i0 + "/bytes",
                    schemaPath: "artifact-binding.schema.json/properties/bytes/pattern",
                    keyword: "pattern",
                    params: { pattern: "^(?:0|[1-9][0-9]*)$" },
                    message: 'must match pattern "' + "^(?:0|[1-9][0-9]*)$" + '"',
                  };
                  if (vErrors === null) {
                    vErrors = [err40];
                  } else {
                    vErrors.push(err40);
                  }
                  errors++;
                }
              } else {
                const err41 = {
                  instancePath: instancePath + "/artifact_bindings/" + i0 + "/bytes",
                  schemaPath: "artifact-binding.schema.json/properties/bytes/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
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
              instancePath: instancePath + "/artifact_bindings/" + i0,
              schemaPath: "artifact-binding.schema.json/type",
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
          instancePath: instancePath + "/artifact_bindings",
          schemaPath: "#/properties/artifact_bindings/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err43];
        } else {
          vErrors.push(err43);
        }
        errors++;
      }
    }
  } else {
    const err44 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err44];
    } else {
      vErrors.push(err44);
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
  /*# sourceURL="tilesim.agent_flow.resume_request.v1" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate21.evaluated;
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
    if (data.contract_revision === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "contract_revision" },
        message: "must have required property '" + "contract_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.flow_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "flow_id" },
        message: "must have required property '" + "flow_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.session_id === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "session_id" },
        message: "must have required property '" + "session_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.action === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "action" },
        message: "must have required property '" + "action" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.pending_action === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "pending_action" },
        message: "must have required property '" + "pending_action" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.current_binding === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "current_binding" },
        message: "must have required property '" + "current_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.current_event_sequence === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "current_event_sequence" },
        message: "must have required property '" + "current_event_sequence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema33.properties, key0)) {
        const err8 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.schema_identity !== undefined) {
      if ("tilesim.agent_flow.resume_request.v1" !== data.schema_identity) {
        const err9 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.agent_flow.resume_request.v1" },
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
    if (data.contract_revision !== undefined) {
      if ("2026-10-28.flow.v2" !== data.contract_revision) {
        const err10 = {
          instancePath: instancePath + "/contract_revision",
          schemaPath: "#/properties/contract_revision/const",
          keyword: "const",
          params: { allowedValue: "2026-10-28.flow.v2" },
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
    if (data.flow_id !== undefined) {
      let data2 = data.flow_id;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err11 = {
            instancePath: instancePath + "/flow_id",
            schemaPath: "#/properties/flow_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err12 = {
            instancePath: instancePath + "/flow_id",
            schemaPath: "#/properties/flow_id/minLength",
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
          instancePath: instancePath + "/flow_id",
          schemaPath: "#/properties/flow_id/type",
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
    if (data.session_id !== undefined) {
      let data3 = data.session_id;
      if (typeof data3 === "string") {
        if (func2(data3) > 128) {
          const err14 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err15 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/minLength",
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
          instancePath: instancePath + "/session_id",
          schemaPath: "#/properties/session_id/type",
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
    if (data.action !== undefined) {
      let data4 = data.action;
      if (!(
        data4 === "clarify_intent" ||
        data4 === "confirm_report" ||
        data4 === "confirm_draft" ||
        data4 === "confirm_navigation" ||
        data4 === "cancel" ||
        data4 === "reject"
      )) {
        const err17 = {
          instancePath: instancePath + "/action",
          schemaPath: "#/properties/action/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.action.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.intent !== undefined) {
      let data5 = data.intent;
      if (!(
        data5 === "explain" ||
        data5 === "existing_run_analysis" ||
        data5 === "user_report" ||
        data5 === "configuration_draft" ||
        data5 === "navigation" ||
        data5 === "unsupported_execution"
      )) {
        const err18 = {
          instancePath: instancePath + "/intent",
          schemaPath: "#/properties/intent/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.intent.enum },
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
    if (data.pending_action !== undefined) {
      let data6 = data.pending_action;
      if (!(
        data6 === "clarify_intent" ||
        data6 === "confirm_report" ||
        data6 === "confirm_draft" ||
        data6 === "confirm_navigation" ||
        data6 === null
      )) {
        const err19 = {
          instancePath: instancePath + "/pending_action",
          schemaPath: "#/properties/pending_action/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.pending_action.enum },
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
    if (data.navigation_observation !== undefined) {
      let data7 = data.navigation_observation;
      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
        if (data7.target_page === undefined) {
          const err20 = {
            instancePath: instancePath + "/navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "target_page" },
            message: "must have required property '" + "target_page" + "'",
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        if (data7.actual_page === undefined) {
          const err21 = {
            instancePath: instancePath + "/navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "actual_page" },
            message: "must have required property '" + "actual_page" + "'",
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (data7.page_correct === undefined) {
          const err22 = {
            instancePath: instancePath + "/navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "page_correct" },
            message: "must have required property '" + "page_correct" + "'",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (data7.current_page_capabilities === undefined) {
          const err23 = {
            instancePath: instancePath + "/navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "current_page_capabilities" },
            message: "must have required property '" + "current_page_capabilities" + "'",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
        if (data7.current_run_id === undefined) {
          const err24 = {
            instancePath: instancePath + "/navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "current_run_id" },
            message: "must have required property '" + "current_run_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (data7.current_context_revision === undefined) {
          const err25 = {
            instancePath: instancePath + "/navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "current_context_revision" },
            message: "must have required property '" + "current_context_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (data7.failure_type === undefined) {
          const err26 = {
            instancePath: instancePath + "/navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "failure_type" },
            message: "must have required property '" + "failure_type" + "'",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        if (data7.retry_allowed === undefined) {
          const err27 = {
            instancePath: instancePath + "/navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "retry_allowed" },
            message: "must have required property '" + "retry_allowed" + "'",
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
        if (data7.visited_pages === undefined) {
          const err28 = {
            instancePath: instancePath + "/navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "visited_pages" },
            message: "must have required property '" + "visited_pages" + "'",
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
        if (data7.navigation_attempts === undefined) {
          const err29 = {
            instancePath: instancePath + "/navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "navigation_attempts" },
            message: "must have required property '" + "navigation_attempts" + "'",
          };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
        for (const key1 in data7) {
          if (!func1.call(schema34.properties, key1)) {
            const err30 = {
              instancePath: instancePath + "/navigation_observation",
              schemaPath: "navigation-observation.schema.json/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err30];
            } else {
              vErrors.push(err30);
            }
            errors++;
          }
        }
        if (data7.target_page !== undefined) {
          let data8 = data7.target_page;
          if (typeof data8 === "string") {
            if (func2(data8) > 128) {
              const err31 = {
                instancePath: instancePath + "/navigation_observation/target_page",
                schemaPath: "navigation-observation.schema.json/properties/target_page/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err31];
              } else {
                vErrors.push(err31);
              }
              errors++;
            }
            if (func2(data8) < 1) {
              const err32 = {
                instancePath: instancePath + "/navigation_observation/target_page",
                schemaPath: "navigation-observation.schema.json/properties/target_page/minLength",
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
              instancePath: instancePath + "/navigation_observation/target_page",
              schemaPath: "navigation-observation.schema.json/properties/target_page/type",
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
        if (data7.actual_page !== undefined) {
          let data9 = data7.actual_page;
          if (typeof data9 !== "string" && data9 !== null) {
            const err34 = {
              instancePath: instancePath + "/navigation_observation/actual_page",
              schemaPath: "navigation-observation.schema.json/properties/actual_page/type",
              keyword: "type",
              params: { type: schema34.properties.actual_page.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err34];
            } else {
              vErrors.push(err34);
            }
            errors++;
          }
          if (typeof data9 === "string") {
            if (func2(data9) > 128) {
              const err35 = {
                instancePath: instancePath + "/navigation_observation/actual_page",
                schemaPath: "navigation-observation.schema.json/properties/actual_page/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors++;
            }
          }
        }
        if (data7.page_correct !== undefined) {
          if (typeof data7.page_correct !== "boolean") {
            const err36 = {
              instancePath: instancePath + "/navigation_observation/page_correct",
              schemaPath: "navigation-observation.schema.json/properties/page_correct/type",
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
        if (data7.current_page_capabilities !== undefined) {
          let data11 = data7.current_page_capabilities;
          if (Array.isArray(data11)) {
            if (data11.length > 32) {
              const err37 = {
                instancePath: instancePath + "/navigation_observation/current_page_capabilities",
                schemaPath: "navigation-observation.schema.json/properties/current_page_capabilities/maxItems",
                keyword: "maxItems",
                params: { limit: 32 },
                message: "must NOT have more than 32 items",
              };
              if (vErrors === null) {
                vErrors = [err37];
              } else {
                vErrors.push(err37);
              }
              errors++;
            }
            const len0 = data11.length;
            for (let i0 = 0; i0 < len0; i0++) {
              let data12 = data11[i0];
              if (typeof data12 === "string") {
                if (func2(data12) > 128) {
                  const err38 = {
                    instancePath: instancePath + "/navigation_observation/current_page_capabilities/" + i0,
                    schemaPath:
                      "navigation-observation.schema.json/properties/current_page_capabilities/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 128 },
                    message: "must NOT have more than 128 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err38];
                  } else {
                    vErrors.push(err38);
                  }
                  errors++;
                }
                if (func2(data12) < 1) {
                  const err39 = {
                    instancePath: instancePath + "/navigation_observation/current_page_capabilities/" + i0,
                    schemaPath:
                      "navigation-observation.schema.json/properties/current_page_capabilities/items/minLength",
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
                  instancePath: instancePath + "/navigation_observation/current_page_capabilities/" + i0,
                  schemaPath: "navigation-observation.schema.json/properties/current_page_capabilities/items/type",
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
            let i1 = data11.length;
            let j0;
            if (i1 > 1) {
              const indices0 = {};
              for (; i1--;) {
                let item0 = data11[i1];
                if (typeof item0 !== "string") {
                  continue;
                }
                if (typeof indices0[item0] == "number") {
                  j0 = indices0[item0];
                  const err41 = {
                    instancePath: instancePath + "/navigation_observation/current_page_capabilities",
                    schemaPath: "navigation-observation.schema.json/properties/current_page_capabilities/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i1, j: j0 },
                    message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err41];
                  } else {
                    vErrors.push(err41);
                  }
                  errors++;
                  break;
                }
                indices0[item0] = i1;
              }
            }
          } else {
            const err42 = {
              instancePath: instancePath + "/navigation_observation/current_page_capabilities",
              schemaPath: "navigation-observation.schema.json/properties/current_page_capabilities/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err42];
            } else {
              vErrors.push(err42);
            }
            errors++;
          }
        }
        if (data7.current_run_id !== undefined) {
          let data13 = data7.current_run_id;
          if (typeof data13 !== "string" && data13 !== null) {
            const err43 = {
              instancePath: instancePath + "/navigation_observation/current_run_id",
              schemaPath: "navigation-observation.schema.json/properties/current_run_id/type",
              keyword: "type",
              params: { type: schema34.properties.current_run_id.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err43];
            } else {
              vErrors.push(err43);
            }
            errors++;
          }
          if (typeof data13 === "string") {
            if (func2(data13) > 128) {
              const err44 = {
                instancePath: instancePath + "/navigation_observation/current_run_id",
                schemaPath: "navigation-observation.schema.json/properties/current_run_id/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err44];
              } else {
                vErrors.push(err44);
              }
              errors++;
            }
          }
        }
        if (data7.current_context_revision !== undefined) {
          let data14 = data7.current_context_revision;
          if (typeof data14 !== "string" && data14 !== null) {
            const err45 = {
              instancePath: instancePath + "/navigation_observation/current_context_revision",
              schemaPath: "navigation-observation.schema.json/properties/current_context_revision/type",
              keyword: "type",
              params: { type: schema34.properties.current_context_revision.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err45];
            } else {
              vErrors.push(err45);
            }
            errors++;
          }
          if (typeof data14 === "string") {
            if (func2(data14) > 256) {
              const err46 = {
                instancePath: instancePath + "/navigation_observation/current_context_revision",
                schemaPath: "navigation-observation.schema.json/properties/current_context_revision/maxLength",
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
          }
        }
        if (data7.failure_type !== undefined) {
          let data15 = data7.failure_type;
          if (!(
            data15 === "navigation_error" ||
            data15 === "context_unavailable" ||
            data15 === "context_invalid" ||
            data15 === "page_mismatch" ||
            data15 === "capability_missing" ||
            data15 === "stale_identity" ||
            data15 === null
          )) {
            const err47 = {
              instancePath: instancePath + "/navigation_observation/failure_type",
              schemaPath: "navigation-observation.schema.json/properties/failure_type/enum",
              keyword: "enum",
              params: { allowedValues: schema34.properties.failure_type.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err47];
            } else {
              vErrors.push(err47);
            }
            errors++;
          }
        }
        if (data7.retry_allowed !== undefined) {
          if (typeof data7.retry_allowed !== "boolean") {
            const err48 = {
              instancePath: instancePath + "/navigation_observation/retry_allowed",
              schemaPath: "navigation-observation.schema.json/properties/retry_allowed/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err48];
            } else {
              vErrors.push(err48);
            }
            errors++;
          }
        }
        if (data7.visited_pages !== undefined) {
          let data17 = data7.visited_pages;
          if (Array.isArray(data17)) {
            if (data17.length > 8) {
              const err49 = {
                instancePath: instancePath + "/navigation_observation/visited_pages",
                schemaPath: "navigation-observation.schema.json/properties/visited_pages/maxItems",
                keyword: "maxItems",
                params: { limit: 8 },
                message: "must NOT have more than 8 items",
              };
              if (vErrors === null) {
                vErrors = [err49];
              } else {
                vErrors.push(err49);
              }
              errors++;
            }
            const len1 = data17.length;
            for (let i2 = 0; i2 < len1; i2++) {
              let data18 = data17[i2];
              if (typeof data18 === "string") {
                if (func2(data18) > 128) {
                  const err50 = {
                    instancePath: instancePath + "/navigation_observation/visited_pages/" + i2,
                    schemaPath: "navigation-observation.schema.json/properties/visited_pages/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 128 },
                    message: "must NOT have more than 128 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err50];
                  } else {
                    vErrors.push(err50);
                  }
                  errors++;
                }
                if (func2(data18) < 1) {
                  const err51 = {
                    instancePath: instancePath + "/navigation_observation/visited_pages/" + i2,
                    schemaPath: "navigation-observation.schema.json/properties/visited_pages/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
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
                  instancePath: instancePath + "/navigation_observation/visited_pages/" + i2,
                  schemaPath: "navigation-observation.schema.json/properties/visited_pages/items/type",
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
            let i3 = data17.length;
            let j1;
            if (i3 > 1) {
              const indices1 = {};
              for (; i3--;) {
                let item1 = data17[i3];
                if (typeof item1 !== "string") {
                  continue;
                }
                if (typeof indices1[item1] == "number") {
                  j1 = indices1[item1];
                  const err53 = {
                    instancePath: instancePath + "/navigation_observation/visited_pages",
                    schemaPath: "navigation-observation.schema.json/properties/visited_pages/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i3, j: j1 },
                    message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err53];
                  } else {
                    vErrors.push(err53);
                  }
                  errors++;
                  break;
                }
                indices1[item1] = i3;
              }
            }
          } else {
            const err54 = {
              instancePath: instancePath + "/navigation_observation/visited_pages",
              schemaPath: "navigation-observation.schema.json/properties/visited_pages/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err54];
            } else {
              vErrors.push(err54);
            }
            errors++;
          }
        }
        if (data7.navigation_attempts !== undefined) {
          let data19 = data7.navigation_attempts;
          if (!(typeof data19 == "number" && !(data19 % 1) && !isNaN(data19))) {
            const err55 = {
              instancePath: instancePath + "/navigation_observation/navigation_attempts",
              schemaPath: "navigation-observation.schema.json/properties/navigation_attempts/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err55];
            } else {
              vErrors.push(err55);
            }
            errors++;
          }
          if (typeof data19 == "number") {
            if (data19 > 8 || isNaN(data19)) {
              const err56 = {
                instancePath: instancePath + "/navigation_observation/navigation_attempts",
                schemaPath: "navigation-observation.schema.json/properties/navigation_attempts/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 8 },
                message: "must be <= 8",
              };
              if (vErrors === null) {
                vErrors = [err56];
              } else {
                vErrors.push(err56);
              }
              errors++;
            }
            if (data19 < 0 || isNaN(data19)) {
              const err57 = {
                instancePath: instancePath + "/navigation_observation/navigation_attempts",
                schemaPath: "navigation-observation.schema.json/properties/navigation_attempts/minimum",
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
          }
        }
      } else {
        const err58 = {
          instancePath: instancePath + "/navigation_observation",
          schemaPath: "navigation-observation.schema.json/type",
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
    if (data.current_binding !== undefined) {
      if (
        !validate22(data.current_binding, {
          instancePath: instancePath + "/current_binding",
          parentData: data,
          parentDataProperty: "current_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
        errors = vErrors.length;
      }
    }
    if (data.current_event_sequence !== undefined) {
      let data21 = data.current_event_sequence;
      if (!(typeof data21 == "number" && !(data21 % 1) && !isNaN(data21))) {
        const err59 = {
          instancePath: instancePath + "/current_event_sequence",
          schemaPath: "#/properties/current_event_sequence/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err59];
        } else {
          vErrors.push(err59);
        }
        errors++;
      }
      if (typeof data21 == "number") {
        if (data21 < 0 || isNaN(data21)) {
          const err60 = {
            instancePath: instancePath + "/current_event_sequence",
            schemaPath: "#/properties/current_event_sequence/minimum",
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
      }
    }
    if (data.clarification !== undefined) {
      let data22 = data.clarification;
      if (typeof data22 !== "string" && data22 !== null) {
        const err61 = {
          instancePath: instancePath + "/clarification",
          schemaPath: "#/properties/clarification/type",
          keyword: "type",
          params: { type: schema33.properties.clarification.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err61];
        } else {
          vErrors.push(err61);
        }
        errors++;
      }
      if (typeof data22 === "string") {
        if (func2(data22) > 20000) {
          const err62 = {
            instancePath: instancePath + "/clarification",
            schemaPath: "#/properties/clarification/maxLength",
            keyword: "maxLength",
            params: { limit: 20000 },
            message: "must NOT have more than 20000 characters",
          };
          if (vErrors === null) {
            vErrors = [err62];
          } else {
            vErrors.push(err62);
          }
          errors++;
        }
      }
    }
    if (data.reason !== undefined) {
      let data23 = data.reason;
      if (typeof data23 !== "string" && data23 !== null) {
        const err63 = {
          instancePath: instancePath + "/reason",
          schemaPath: "#/properties/reason/type",
          keyword: "type",
          params: { type: schema33.properties.reason.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err63];
        } else {
          vErrors.push(err63);
        }
        errors++;
      }
      if (typeof data23 === "string") {
        if (func2(data23) > 2000) {
          const err64 = {
            instancePath: instancePath + "/reason",
            schemaPath: "#/properties/reason/maxLength",
            keyword: "maxLength",
            params: { limit: 2000 },
            message: "must NOT have more than 2000 characters",
          };
          if (vErrors === null) {
            vErrors = [err64];
          } else {
            vErrors.push(err64);
          }
          errors++;
        }
      }
    }
    if (data.approval_digest !== undefined) {
      let data24 = data.approval_digest;
      if (typeof data24 !== "string" && data24 !== null) {
        const err65 = {
          instancePath: instancePath + "/approval_digest",
          schemaPath: "#/properties/approval_digest/type",
          keyword: "type",
          params: { type: schema33.properties.approval_digest.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err65];
        } else {
          vErrors.push(err65);
        }
        errors++;
      }
      if (typeof data24 === "string") {
        if (func2(data24) > 256) {
          const err66 = {
            instancePath: instancePath + "/approval_digest",
            schemaPath: "#/properties/approval_digest/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err66];
          } else {
            vErrors.push(err66);
          }
          errors++;
        }
        if (func2(data24) < 1) {
          const err67 = {
            instancePath: instancePath + "/approval_digest",
            schemaPath: "#/properties/approval_digest/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err67];
          } else {
            vErrors.push(err67);
          }
          errors++;
        }
      }
    }
    if (data.authorization_id !== undefined) {
      let data25 = data.authorization_id;
      if (typeof data25 === "string") {
        if (!pattern8.test(data25)) {
          const err68 = {
            instancePath: instancePath + "/authorization_id",
            schemaPath: "#/properties/authorization_id/pattern",
            keyword: "pattern",
            params: { pattern: "^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" },
            message: 'must match pattern "' + "^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" + '"',
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
          instancePath: instancePath + "/authorization_id",
          schemaPath: "#/properties/authorization_id/type",
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
    if (data.authorization_digest !== undefined) {
      let data26 = data.authorization_digest;
      if (typeof data26 === "string") {
        if (!pattern4.test(data26)) {
          const err70 = {
            instancePath: instancePath + "/authorization_digest",
            schemaPath: "#/properties/authorization_digest/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/authorization_digest",
          schemaPath: "#/properties/authorization_digest/type",
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
    if (data.authorization_budget !== undefined) {
      let data27 = data.authorization_budget;
      if (data27 && typeof data27 == "object" && !Array.isArray(data27)) {
        if (data27.max_navigation_attempts === undefined) {
          const err72 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_navigation_attempts" },
            message: "must have required property '" + "max_navigation_attempts" + "'",
          };
          if (vErrors === null) {
            vErrors = [err72];
          } else {
            vErrors.push(err72);
          }
          errors++;
        }
        if (data27.max_model_calls === undefined) {
          const err73 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_model_calls" },
            message: "must have required property '" + "max_model_calls" + "'",
          };
          if (vErrors === null) {
            vErrors = [err73];
          } else {
            vErrors.push(err73);
          }
          errors++;
        }
        if (data27.max_tool_calls_per_round === undefined) {
          const err74 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_tool_calls_per_round" },
            message: "must have required property '" + "max_tool_calls_per_round" + "'",
          };
          if (vErrors === null) {
            vErrors = [err74];
          } else {
            vErrors.push(err74);
          }
          errors++;
        }
        if (data27.max_run_creations === undefined) {
          const err75 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_run_creations" },
            message: "must have required property '" + "max_run_creations" + "'",
          };
          if (vErrors === null) {
            vErrors = [err75];
          } else {
            vErrors.push(err75);
          }
          errors++;
        }
        if (data27.max_execution_time_ms === undefined) {
          const err76 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_execution_time_ms" },
            message: "must have required property '" + "max_execution_time_ms" + "'",
          };
          if (vErrors === null) {
            vErrors = [err76];
          } else {
            vErrors.push(err76);
          }
          errors++;
        }
        for (const key2 in data27) {
          if (!(
            key2 === "max_navigation_attempts" ||
            key2 === "max_model_calls" ||
            key2 === "max_tool_calls_per_round" ||
            key2 === "max_run_creations" ||
            key2 === "max_execution_time_ms"
          )) {
            const err77 = {
              instancePath: instancePath + "/authorization_budget",
              schemaPath: "#/properties/authorization_budget/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err77];
            } else {
              vErrors.push(err77);
            }
            errors++;
          }
        }
        if (data27.max_navigation_attempts !== undefined) {
          let data28 = data27.max_navigation_attempts;
          if (!(typeof data28 == "number" && !(data28 % 1) && !isNaN(data28))) {
            const err78 = {
              instancePath: instancePath + "/authorization_budget/max_navigation_attempts",
              schemaPath: "#/properties/authorization_budget/properties/max_navigation_attempts/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err78];
            } else {
              vErrors.push(err78);
            }
            errors++;
          }
          if (typeof data28 == "number") {
            if (data28 > 8 || isNaN(data28)) {
              const err79 = {
                instancePath: instancePath + "/authorization_budget/max_navigation_attempts",
                schemaPath: "#/properties/authorization_budget/properties/max_navigation_attempts/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 8 },
                message: "must be <= 8",
              };
              if (vErrors === null) {
                vErrors = [err79];
              } else {
                vErrors.push(err79);
              }
              errors++;
            }
            if (data28 < 1 || isNaN(data28)) {
              const err80 = {
                instancePath: instancePath + "/authorization_budget/max_navigation_attempts",
                schemaPath: "#/properties/authorization_budget/properties/max_navigation_attempts/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err80];
              } else {
                vErrors.push(err80);
              }
              errors++;
            }
          }
        }
        if (data27.max_model_calls !== undefined) {
          let data29 = data27.max_model_calls;
          if (!(typeof data29 == "number" && !(data29 % 1) && !isNaN(data29))) {
            const err81 = {
              instancePath: instancePath + "/authorization_budget/max_model_calls",
              schemaPath: "#/properties/authorization_budget/properties/max_model_calls/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err81];
            } else {
              vErrors.push(err81);
            }
            errors++;
          }
          if (typeof data29 == "number") {
            if (data29 > 60 || isNaN(data29)) {
              const err82 = {
                instancePath: instancePath + "/authorization_budget/max_model_calls",
                schemaPath: "#/properties/authorization_budget/properties/max_model_calls/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 60 },
                message: "must be <= 60",
              };
              if (vErrors === null) {
                vErrors = [err82];
              } else {
                vErrors.push(err82);
              }
              errors++;
            }
            if (data29 < 1 || isNaN(data29)) {
              const err83 = {
                instancePath: instancePath + "/authorization_budget/max_model_calls",
                schemaPath: "#/properties/authorization_budget/properties/max_model_calls/minimum",
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
          }
        }
        if (data27.max_tool_calls_per_round !== undefined) {
          let data30 = data27.max_tool_calls_per_round;
          if (!(typeof data30 == "number" && !(data30 % 1) && !isNaN(data30))) {
            const err84 = {
              instancePath: instancePath + "/authorization_budget/max_tool_calls_per_round",
              schemaPath: "#/properties/authorization_budget/properties/max_tool_calls_per_round/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err84];
            } else {
              vErrors.push(err84);
            }
            errors++;
          }
          if (typeof data30 == "number") {
            if (data30 > 4 || isNaN(data30)) {
              const err85 = {
                instancePath: instancePath + "/authorization_budget/max_tool_calls_per_round",
                schemaPath: "#/properties/authorization_budget/properties/max_tool_calls_per_round/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 4 },
                message: "must be <= 4",
              };
              if (vErrors === null) {
                vErrors = [err85];
              } else {
                vErrors.push(err85);
              }
              errors++;
            }
            if (data30 < 1 || isNaN(data30)) {
              const err86 = {
                instancePath: instancePath + "/authorization_budget/max_tool_calls_per_round",
                schemaPath: "#/properties/authorization_budget/properties/max_tool_calls_per_round/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err86];
              } else {
                vErrors.push(err86);
              }
              errors++;
            }
          }
        }
        if (data27.max_run_creations !== undefined) {
          let data31 = data27.max_run_creations;
          if (!(typeof data31 == "number" && !(data31 % 1) && !isNaN(data31))) {
            const err87 = {
              instancePath: instancePath + "/authorization_budget/max_run_creations",
              schemaPath: "#/properties/authorization_budget/properties/max_run_creations/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err87];
            } else {
              vErrors.push(err87);
            }
            errors++;
          }
          if (typeof data31 == "number") {
            if (data31 > 1 || isNaN(data31)) {
              const err88 = {
                instancePath: instancePath + "/authorization_budget/max_run_creations",
                schemaPath: "#/properties/authorization_budget/properties/max_run_creations/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 1 },
                message: "must be <= 1",
              };
              if (vErrors === null) {
                vErrors = [err88];
              } else {
                vErrors.push(err88);
              }
              errors++;
            }
            if (data31 < 1 || isNaN(data31)) {
              const err89 = {
                instancePath: instancePath + "/authorization_budget/max_run_creations",
                schemaPath: "#/properties/authorization_budget/properties/max_run_creations/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err89];
              } else {
                vErrors.push(err89);
              }
              errors++;
            }
          }
        }
        if (data27.max_execution_time_ms !== undefined) {
          let data32 = data27.max_execution_time_ms;
          if (!(typeof data32 == "number" && !(data32 % 1) && !isNaN(data32))) {
            const err90 = {
              instancePath: instancePath + "/authorization_budget/max_execution_time_ms",
              schemaPath: "#/properties/authorization_budget/properties/max_execution_time_ms/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err90];
            } else {
              vErrors.push(err90);
            }
            errors++;
          }
          if (typeof data32 == "number") {
            if (data32 > 3600000 || isNaN(data32)) {
              const err91 = {
                instancePath: instancePath + "/authorization_budget/max_execution_time_ms",
                schemaPath: "#/properties/authorization_budget/properties/max_execution_time_ms/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 3600000 },
                message: "must be <= 3600000",
              };
              if (vErrors === null) {
                vErrors = [err91];
              } else {
                vErrors.push(err91);
              }
              errors++;
            }
            if (data32 < 1 || isNaN(data32)) {
              const err92 = {
                instancePath: instancePath + "/authorization_budget/max_execution_time_ms",
                schemaPath: "#/properties/authorization_budget/properties/max_execution_time_ms/minimum",
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
      } else {
        const err93 = {
          instancePath: instancePath + "/authorization_budget",
          schemaPath: "#/properties/authorization_budget/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err93];
        } else {
          vErrors.push(err93);
        }
        errors++;
      }
    }
    if (data.principal !== undefined) {
      let data33 = data.principal;
      if (typeof data33 === "string") {
        if (func2(data33) > 128) {
          const err94 = {
            instancePath: instancePath + "/principal",
            schemaPath: "#/properties/principal/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err94];
          } else {
            vErrors.push(err94);
          }
          errors++;
        }
        if (func2(data33) < 1) {
          const err95 = {
            instancePath: instancePath + "/principal",
            schemaPath: "#/properties/principal/minLength",
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
          instancePath: instancePath + "/principal",
          schemaPath: "#/properties/principal/type",
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
    if (data.workspace_id !== undefined) {
      let data34 = data.workspace_id;
      if (typeof data34 === "string") {
        if (func2(data34) > 128) {
          const err97 = {
            instancePath: instancePath + "/workspace_id",
            schemaPath: "#/properties/workspace_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err97];
          } else {
            vErrors.push(err97);
          }
          errors++;
        }
        if (func2(data34) < 1) {
          const err98 = {
            instancePath: instancePath + "/workspace_id",
            schemaPath: "#/properties/workspace_id/minLength",
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
          instancePath: instancePath + "/workspace_id",
          schemaPath: "#/properties/workspace_id/type",
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
      instancePath,
      schemaPath: "#/type",
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
  validate21.errors = vErrors;
  return errors === 0;
}
validate21.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const agentFlowState = validate24;
const schema37 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.state.v1",
  title: "AgentFlowState",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "contract_revision",
    "flow_id",
    "session_id",
    "principal",
    "workspace_id",
    "intent",
    "status",
    "node",
    "event_sequence",
    "binding",
    "pending_action",
    "approval",
    "authorization",
    "validation",
    "evidence",
    "report",
    "terminal_reason",
    "checkpoint_id",
    "created_at",
    "updated_at",
  ],
  properties: {
    schema_identity: { const: "tilesim.agent_flow.state.v1" },
    contract_revision: { const: "2026-10-28.flow.v2" },
    flow_id: { type: "string", minLength: 1, maxLength: 128 },
    session_id: { type: "string", minLength: 1, maxLength: 128 },
    principal: { type: "string", minLength: 1, maxLength: 128 },
    workspace_id: { type: "string", minLength: 1, maxLength: 128 },
    intent: {
      enum: [
        "explain",
        "existing_run_analysis",
        "user_report",
        "configuration_draft",
        "navigation",
        "unsupported_execution",
      ],
    },
    status: {
      enum: [
        "created",
        "running",
        "waiting_user",
        "completed",
        "draft_ready",
        "stale",
        "refused",
        "cancelled",
        "failed",
      ],
    },
    node: { type: "string", minLength: 1, maxLength: 128 },
    event_sequence: { type: "integer", minimum: 0 },
    binding: { $ref: "identity-binding.schema.json" },
    pending_action: { enum: ["clarify_intent", "confirm_report", "confirm_draft", "confirm_navigation", null] },
    approval: { type: ["object", "null"], additionalProperties: true },
    authorization: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["status", "authorization_id", "authorization_digest", "budget", "usage", "remaining"],
      properties: {
        status: { enum: ["active", "revoked", "expired", "exhausted"] },
        authorization_id: { type: "string", pattern: "^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" },
        authorization_digest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
        budget: { $ref: "start-request.schema.json#/properties/authorization_budget" },
        usage: {
          type: "object",
          additionalProperties: false,
          required: [
            "navigation_attempts",
            "model_calls",
            "tool_calls_per_round",
            "run_creations",
            "execution_time_ms",
          ],
          properties: {
            navigation_attempts: { type: "integer", minimum: 0 },
            model_calls: { type: "integer", minimum: 0 },
            tool_calls_per_round: { type: "integer", minimum: 0 },
            run_creations: { type: "integer", minimum: 0 },
            execution_time_ms: { type: "integer", minimum: 0 },
          },
        },
        remaining: {
          type: "object",
          additionalProperties: false,
          required: [
            "max_navigation_attempts",
            "max_model_calls",
            "max_tool_calls_per_round",
            "max_run_creations",
            "max_execution_time_ms",
          ],
          properties: {
            max_navigation_attempts: { type: "integer", minimum: 0 },
            max_model_calls: { type: "integer", minimum: 0 },
            max_tool_calls_per_round: { type: "integer", minimum: 0 },
            max_run_creations: { type: "integer", minimum: 0 },
            max_execution_time_ms: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    validation: { type: ["object", "null"], additionalProperties: true },
    evidence: { type: ["object", "null"], additionalProperties: true },
    report: { type: ["object", "null"], additionalProperties: true },
    terminal_reason: { type: ["string", "null"], maxLength: 256 },
    checkpoint_id: { type: ["string", "null"], maxLength: 256 },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    current_page: { type: ["string", "null"], maxLength: 128 },
    current_page_capabilities: {
      type: "array",
      maxItems: 32,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    current_context_revision: { type: ["string", "null"], maxLength: 256 },
    required_capabilities: {
      type: "array",
      maxItems: 32,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    allowed_pages: {
      type: "array",
      maxItems: 32,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    allowed_actions: {
      type: "array",
      maxItems: 32,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    visited_pages: {
      type: "array",
      maxItems: 8,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
    navigation_attempts: { type: "integer", minimum: 0, maximum: 8 },
    max_navigation_attempts: { type: "integer", minimum: 0, maximum: 8 },
    navigation_failures: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["page", "type"],
        properties: {
          page: { type: "string", minLength: 1, maxLength: 128 },
          type: { type: "string", minLength: 1, maxLength: 64 },
          detail: { type: "string", maxLength: 160 },
        },
      },
    },
    last_navigation_observation: { anyOf: [{ $ref: "navigation-observation.schema.json" }, { type: "null" }] },
    navigation_target: { type: ["string", "null"], maxLength: 128 },
  },
};
const schema38 = {
  type: "object",
  additionalProperties: false,
  required: [
    "max_navigation_attempts",
    "max_model_calls",
    "max_tool_calls_per_round",
    "max_run_creations",
    "max_execution_time_ms",
  ],
  properties: {
    max_navigation_attempts: { type: "integer", minimum: 1, maximum: 8 },
    max_model_calls: { type: "integer", minimum: 1, maximum: 60 },
    max_tool_calls_per_round: { type: "integer", minimum: 1, maximum: 4 },
    max_run_creations: { type: "integer", minimum: 1, maximum: 1 },
    max_execution_time_ms: { type: "integer", minimum: 1, maximum: 3600000 },
  },
};
function validate24(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_flow.state.v1" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate24.evaluated;
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
    if (data.contract_revision === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "contract_revision" },
        message: "must have required property '" + "contract_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.flow_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "flow_id" },
        message: "must have required property '" + "flow_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.session_id === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "session_id" },
        message: "must have required property '" + "session_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.principal === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "principal" },
        message: "must have required property '" + "principal" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.workspace_id === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "workspace_id" },
        message: "must have required property '" + "workspace_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.intent === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "intent" },
        message: "must have required property '" + "intent" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.status === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "status" },
        message: "must have required property '" + "status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.node === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "node" },
        message: "must have required property '" + "node" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.event_sequence === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "event_sequence" },
        message: "must have required property '" + "event_sequence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.binding === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "binding" },
        message: "must have required property '" + "binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.pending_action === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "pending_action" },
        message: "must have required property '" + "pending_action" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.approval === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "approval" },
        message: "must have required property '" + "approval" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.authorization === undefined) {
      const err13 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "authorization" },
        message: "must have required property '" + "authorization" + "'",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.validation === undefined) {
      const err14 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "validation" },
        message: "must have required property '" + "validation" + "'",
      };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    if (data.evidence === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "evidence" },
        message: "must have required property '" + "evidence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.report === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "report" },
        message: "must have required property '" + "report" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    if (data.terminal_reason === undefined) {
      const err17 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "terminal_reason" },
        message: "must have required property '" + "terminal_reason" + "'",
      };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    if (data.checkpoint_id === undefined) {
      const err18 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "checkpoint_id" },
        message: "must have required property '" + "checkpoint_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    if (data.created_at === undefined) {
      const err19 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "created_at" },
        message: "must have required property '" + "created_at" + "'",
      };
      if (vErrors === null) {
        vErrors = [err19];
      } else {
        vErrors.push(err19);
      }
      errors++;
    }
    if (data.updated_at === undefined) {
      const err20 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "updated_at" },
        message: "must have required property '" + "updated_at" + "'",
      };
      if (vErrors === null) {
        vErrors = [err20];
      } else {
        vErrors.push(err20);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema37.properties, key0)) {
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
    if (data.schema_identity !== undefined) {
      if ("tilesim.agent_flow.state.v1" !== data.schema_identity) {
        const err22 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.agent_flow.state.v1" },
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
    if (data.contract_revision !== undefined) {
      if ("2026-10-28.flow.v2" !== data.contract_revision) {
        const err23 = {
          instancePath: instancePath + "/contract_revision",
          schemaPath: "#/properties/contract_revision/const",
          keyword: "const",
          params: { allowedValue: "2026-10-28.flow.v2" },
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
    if (data.flow_id !== undefined) {
      let data2 = data.flow_id;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err24 = {
            instancePath: instancePath + "/flow_id",
            schemaPath: "#/properties/flow_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err25 = {
            instancePath: instancePath + "/flow_id",
            schemaPath: "#/properties/flow_id/minLength",
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
          instancePath: instancePath + "/flow_id",
          schemaPath: "#/properties/flow_id/type",
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
    if (data.session_id !== undefined) {
      let data3 = data.session_id;
      if (typeof data3 === "string") {
        if (func2(data3) > 128) {
          const err27 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err28 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
          instancePath: instancePath + "/session_id",
          schemaPath: "#/properties/session_id/type",
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
    if (data.principal !== undefined) {
      let data4 = data.principal;
      if (typeof data4 === "string") {
        if (func2(data4) > 128) {
          const err30 = {
            instancePath: instancePath + "/principal",
            schemaPath: "#/properties/principal/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        if (func2(data4) < 1) {
          const err31 = {
            instancePath: instancePath + "/principal",
            schemaPath: "#/properties/principal/minLength",
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
          instancePath: instancePath + "/principal",
          schemaPath: "#/properties/principal/type",
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
    if (data.workspace_id !== undefined) {
      let data5 = data.workspace_id;
      if (typeof data5 === "string") {
        if (func2(data5) > 128) {
          const err33 = {
            instancePath: instancePath + "/workspace_id",
            schemaPath: "#/properties/workspace_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
        if (func2(data5) < 1) {
          const err34 = {
            instancePath: instancePath + "/workspace_id",
            schemaPath: "#/properties/workspace_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
          instancePath: instancePath + "/workspace_id",
          schemaPath: "#/properties/workspace_id/type",
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
    if (data.intent !== undefined) {
      let data6 = data.intent;
      if (!(
        data6 === "explain" ||
        data6 === "existing_run_analysis" ||
        data6 === "user_report" ||
        data6 === "configuration_draft" ||
        data6 === "navigation" ||
        data6 === "unsupported_execution"
      )) {
        const err36 = {
          instancePath: instancePath + "/intent",
          schemaPath: "#/properties/intent/enum",
          keyword: "enum",
          params: { allowedValues: schema37.properties.intent.enum },
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
    if (data.status !== undefined) {
      let data7 = data.status;
      if (!(
        data7 === "created" ||
        data7 === "running" ||
        data7 === "waiting_user" ||
        data7 === "completed" ||
        data7 === "draft_ready" ||
        data7 === "stale" ||
        data7 === "refused" ||
        data7 === "cancelled" ||
        data7 === "failed"
      )) {
        const err37 = {
          instancePath: instancePath + "/status",
          schemaPath: "#/properties/status/enum",
          keyword: "enum",
          params: { allowedValues: schema37.properties.status.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
    }
    if (data.node !== undefined) {
      let data8 = data.node;
      if (typeof data8 === "string") {
        if (func2(data8) > 128) {
          const err38 = {
            instancePath: instancePath + "/node",
            schemaPath: "#/properties/node/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err38];
          } else {
            vErrors.push(err38);
          }
          errors++;
        }
        if (func2(data8) < 1) {
          const err39 = {
            instancePath: instancePath + "/node",
            schemaPath: "#/properties/node/minLength",
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
          instancePath: instancePath + "/node",
          schemaPath: "#/properties/node/type",
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
    if (data.event_sequence !== undefined) {
      let data9 = data.event_sequence;
      if (!(typeof data9 == "number" && !(data9 % 1) && !isNaN(data9))) {
        const err41 = {
          instancePath: instancePath + "/event_sequence",
          schemaPath: "#/properties/event_sequence/type",
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
      if (typeof data9 == "number") {
        if (data9 < 0 || isNaN(data9)) {
          const err42 = {
            instancePath: instancePath + "/event_sequence",
            schemaPath: "#/properties/event_sequence/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err42];
          } else {
            vErrors.push(err42);
          }
          errors++;
        }
      }
    }
    if (data.binding !== undefined) {
      if (
        !validate22(data.binding, {
          instancePath: instancePath + "/binding",
          parentData: data,
          parentDataProperty: "binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
        errors = vErrors.length;
      }
    }
    if (data.pending_action !== undefined) {
      let data11 = data.pending_action;
      if (!(
        data11 === "clarify_intent" ||
        data11 === "confirm_report" ||
        data11 === "confirm_draft" ||
        data11 === "confirm_navigation" ||
        data11 === null
      )) {
        const err43 = {
          instancePath: instancePath + "/pending_action",
          schemaPath: "#/properties/pending_action/enum",
          keyword: "enum",
          params: { allowedValues: schema37.properties.pending_action.enum },
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
    if (data.approval !== undefined) {
      let data12 = data.approval;
      if (!(data12 && typeof data12 == "object" && !Array.isArray(data12)) && data12 !== null) {
        const err44 = {
          instancePath: instancePath + "/approval",
          schemaPath: "#/properties/approval/type",
          keyword: "type",
          params: { type: schema37.properties.approval.type },
          message: "must be object,null",
        };
        if (vErrors === null) {
          vErrors = [err44];
        } else {
          vErrors.push(err44);
        }
        errors++;
      }
    }
    if (data.authorization !== undefined) {
      let data13 = data.authorization;
      if (!(data13 && typeof data13 == "object" && !Array.isArray(data13)) && data13 !== null) {
        const err45 = {
          instancePath: instancePath + "/authorization",
          schemaPath: "#/properties/authorization/type",
          keyword: "type",
          params: { type: schema37.properties.authorization.type },
          message: "must be object,null",
        };
        if (vErrors === null) {
          vErrors = [err45];
        } else {
          vErrors.push(err45);
        }
        errors++;
      }
      if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
        if (data13.status === undefined) {
          const err46 = {
            instancePath: instancePath + "/authorization",
            schemaPath: "#/properties/authorization/required",
            keyword: "required",
            params: { missingProperty: "status" },
            message: "must have required property '" + "status" + "'",
          };
          if (vErrors === null) {
            vErrors = [err46];
          } else {
            vErrors.push(err46);
          }
          errors++;
        }
        if (data13.authorization_id === undefined) {
          const err47 = {
            instancePath: instancePath + "/authorization",
            schemaPath: "#/properties/authorization/required",
            keyword: "required",
            params: { missingProperty: "authorization_id" },
            message: "must have required property '" + "authorization_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
        if (data13.authorization_digest === undefined) {
          const err48 = {
            instancePath: instancePath + "/authorization",
            schemaPath: "#/properties/authorization/required",
            keyword: "required",
            params: { missingProperty: "authorization_digest" },
            message: "must have required property '" + "authorization_digest" + "'",
          };
          if (vErrors === null) {
            vErrors = [err48];
          } else {
            vErrors.push(err48);
          }
          errors++;
        }
        if (data13.budget === undefined) {
          const err49 = {
            instancePath: instancePath + "/authorization",
            schemaPath: "#/properties/authorization/required",
            keyword: "required",
            params: { missingProperty: "budget" },
            message: "must have required property '" + "budget" + "'",
          };
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        if (data13.usage === undefined) {
          const err50 = {
            instancePath: instancePath + "/authorization",
            schemaPath: "#/properties/authorization/required",
            keyword: "required",
            params: { missingProperty: "usage" },
            message: "must have required property '" + "usage" + "'",
          };
          if (vErrors === null) {
            vErrors = [err50];
          } else {
            vErrors.push(err50);
          }
          errors++;
        }
        if (data13.remaining === undefined) {
          const err51 = {
            instancePath: instancePath + "/authorization",
            schemaPath: "#/properties/authorization/required",
            keyword: "required",
            params: { missingProperty: "remaining" },
            message: "must have required property '" + "remaining" + "'",
          };
          if (vErrors === null) {
            vErrors = [err51];
          } else {
            vErrors.push(err51);
          }
          errors++;
        }
        for (const key1 in data13) {
          if (!(
            key1 === "status" ||
            key1 === "authorization_id" ||
            key1 === "authorization_digest" ||
            key1 === "budget" ||
            key1 === "usage" ||
            key1 === "remaining"
          )) {
            const err52 = {
              instancePath: instancePath + "/authorization",
              schemaPath: "#/properties/authorization/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err52];
            } else {
              vErrors.push(err52);
            }
            errors++;
          }
        }
        if (data13.status !== undefined) {
          let data14 = data13.status;
          if (!(data14 === "active" || data14 === "revoked" || data14 === "expired" || data14 === "exhausted")) {
            const err53 = {
              instancePath: instancePath + "/authorization/status",
              schemaPath: "#/properties/authorization/properties/status/enum",
              keyword: "enum",
              params: { allowedValues: schema37.properties.authorization.properties.status.enum },
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
        if (data13.authorization_id !== undefined) {
          let data15 = data13.authorization_id;
          if (typeof data15 === "string") {
            if (!pattern8.test(data15)) {
              const err54 = {
                instancePath: instancePath + "/authorization/authorization_id",
                schemaPath: "#/properties/authorization/properties/authorization_id/pattern",
                keyword: "pattern",
                params: { pattern: "^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" },
                message: 'must match pattern "' + "^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" + '"',
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
              instancePath: instancePath + "/authorization/authorization_id",
              schemaPath: "#/properties/authorization/properties/authorization_id/type",
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
        if (data13.authorization_digest !== undefined) {
          let data16 = data13.authorization_digest;
          if (typeof data16 === "string") {
            if (!pattern4.test(data16)) {
              const err56 = {
                instancePath: instancePath + "/authorization/authorization_digest",
                schemaPath: "#/properties/authorization/properties/authorization_digest/pattern",
                keyword: "pattern",
                params: { pattern: "^sha256:[0-9a-f]{64}$" },
                message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
              instancePath: instancePath + "/authorization/authorization_digest",
              schemaPath: "#/properties/authorization/properties/authorization_digest/type",
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
        if (data13.budget !== undefined) {
          let data17 = data13.budget;
          if (data17 && typeof data17 == "object" && !Array.isArray(data17)) {
            if (data17.max_navigation_attempts === undefined) {
              const err58 = {
                instancePath: instancePath + "/authorization/budget",
                schemaPath: "start-request.schema.json#/properties/authorization_budget/required",
                keyword: "required",
                params: { missingProperty: "max_navigation_attempts" },
                message: "must have required property '" + "max_navigation_attempts" + "'",
              };
              if (vErrors === null) {
                vErrors = [err58];
              } else {
                vErrors.push(err58);
              }
              errors++;
            }
            if (data17.max_model_calls === undefined) {
              const err59 = {
                instancePath: instancePath + "/authorization/budget",
                schemaPath: "start-request.schema.json#/properties/authorization_budget/required",
                keyword: "required",
                params: { missingProperty: "max_model_calls" },
                message: "must have required property '" + "max_model_calls" + "'",
              };
              if (vErrors === null) {
                vErrors = [err59];
              } else {
                vErrors.push(err59);
              }
              errors++;
            }
            if (data17.max_tool_calls_per_round === undefined) {
              const err60 = {
                instancePath: instancePath + "/authorization/budget",
                schemaPath: "start-request.schema.json#/properties/authorization_budget/required",
                keyword: "required",
                params: { missingProperty: "max_tool_calls_per_round" },
                message: "must have required property '" + "max_tool_calls_per_round" + "'",
              };
              if (vErrors === null) {
                vErrors = [err60];
              } else {
                vErrors.push(err60);
              }
              errors++;
            }
            if (data17.max_run_creations === undefined) {
              const err61 = {
                instancePath: instancePath + "/authorization/budget",
                schemaPath: "start-request.schema.json#/properties/authorization_budget/required",
                keyword: "required",
                params: { missingProperty: "max_run_creations" },
                message: "must have required property '" + "max_run_creations" + "'",
              };
              if (vErrors === null) {
                vErrors = [err61];
              } else {
                vErrors.push(err61);
              }
              errors++;
            }
            if (data17.max_execution_time_ms === undefined) {
              const err62 = {
                instancePath: instancePath + "/authorization/budget",
                schemaPath: "start-request.schema.json#/properties/authorization_budget/required",
                keyword: "required",
                params: { missingProperty: "max_execution_time_ms" },
                message: "must have required property '" + "max_execution_time_ms" + "'",
              };
              if (vErrors === null) {
                vErrors = [err62];
              } else {
                vErrors.push(err62);
              }
              errors++;
            }
            for (const key2 in data17) {
              if (!(
                key2 === "max_navigation_attempts" ||
                key2 === "max_model_calls" ||
                key2 === "max_tool_calls_per_round" ||
                key2 === "max_run_creations" ||
                key2 === "max_execution_time_ms"
              )) {
                const err63 = {
                  instancePath: instancePath + "/authorization/budget",
                  schemaPath: "start-request.schema.json#/properties/authorization_budget/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key2 },
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
            if (data17.max_navigation_attempts !== undefined) {
              let data18 = data17.max_navigation_attempts;
              if (!(typeof data18 == "number" && !(data18 % 1) && !isNaN(data18))) {
                const err64 = {
                  instancePath: instancePath + "/authorization/budget/max_navigation_attempts",
                  schemaPath:
                    "start-request.schema.json#/properties/authorization_budget/properties/max_navigation_attempts/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err64];
                } else {
                  vErrors.push(err64);
                }
                errors++;
              }
              if (typeof data18 == "number") {
                if (data18 > 8 || isNaN(data18)) {
                  const err65 = {
                    instancePath: instancePath + "/authorization/budget/max_navigation_attempts",
                    schemaPath:
                      "start-request.schema.json#/properties/authorization_budget/properties/max_navigation_attempts/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 8 },
                    message: "must be <= 8",
                  };
                  if (vErrors === null) {
                    vErrors = [err65];
                  } else {
                    vErrors.push(err65);
                  }
                  errors++;
                }
                if (data18 < 1 || isNaN(data18)) {
                  const err66 = {
                    instancePath: instancePath + "/authorization/budget/max_navigation_attempts",
                    schemaPath:
                      "start-request.schema.json#/properties/authorization_budget/properties/max_navigation_attempts/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 1 },
                    message: "must be >= 1",
                  };
                  if (vErrors === null) {
                    vErrors = [err66];
                  } else {
                    vErrors.push(err66);
                  }
                  errors++;
                }
              }
            }
            if (data17.max_model_calls !== undefined) {
              let data19 = data17.max_model_calls;
              if (!(typeof data19 == "number" && !(data19 % 1) && !isNaN(data19))) {
                const err67 = {
                  instancePath: instancePath + "/authorization/budget/max_model_calls",
                  schemaPath:
                    "start-request.schema.json#/properties/authorization_budget/properties/max_model_calls/type",
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
              if (typeof data19 == "number") {
                if (data19 > 60 || isNaN(data19)) {
                  const err68 = {
                    instancePath: instancePath + "/authorization/budget/max_model_calls",
                    schemaPath:
                      "start-request.schema.json#/properties/authorization_budget/properties/max_model_calls/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 60 },
                    message: "must be <= 60",
                  };
                  if (vErrors === null) {
                    vErrors = [err68];
                  } else {
                    vErrors.push(err68);
                  }
                  errors++;
                }
                if (data19 < 1 || isNaN(data19)) {
                  const err69 = {
                    instancePath: instancePath + "/authorization/budget/max_model_calls",
                    schemaPath:
                      "start-request.schema.json#/properties/authorization_budget/properties/max_model_calls/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 1 },
                    message: "must be >= 1",
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
            if (data17.max_tool_calls_per_round !== undefined) {
              let data20 = data17.max_tool_calls_per_round;
              if (!(typeof data20 == "number" && !(data20 % 1) && !isNaN(data20))) {
                const err70 = {
                  instancePath: instancePath + "/authorization/budget/max_tool_calls_per_round",
                  schemaPath:
                    "start-request.schema.json#/properties/authorization_budget/properties/max_tool_calls_per_round/type",
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
              if (typeof data20 == "number") {
                if (data20 > 4 || isNaN(data20)) {
                  const err71 = {
                    instancePath: instancePath + "/authorization/budget/max_tool_calls_per_round",
                    schemaPath:
                      "start-request.schema.json#/properties/authorization_budget/properties/max_tool_calls_per_round/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 4 },
                    message: "must be <= 4",
                  };
                  if (vErrors === null) {
                    vErrors = [err71];
                  } else {
                    vErrors.push(err71);
                  }
                  errors++;
                }
                if (data20 < 1 || isNaN(data20)) {
                  const err72 = {
                    instancePath: instancePath + "/authorization/budget/max_tool_calls_per_round",
                    schemaPath:
                      "start-request.schema.json#/properties/authorization_budget/properties/max_tool_calls_per_round/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 1 },
                    message: "must be >= 1",
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
            if (data17.max_run_creations !== undefined) {
              let data21 = data17.max_run_creations;
              if (!(typeof data21 == "number" && !(data21 % 1) && !isNaN(data21))) {
                const err73 = {
                  instancePath: instancePath + "/authorization/budget/max_run_creations",
                  schemaPath:
                    "start-request.schema.json#/properties/authorization_budget/properties/max_run_creations/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err73];
                } else {
                  vErrors.push(err73);
                }
                errors++;
              }
              if (typeof data21 == "number") {
                if (data21 > 1 || isNaN(data21)) {
                  const err74 = {
                    instancePath: instancePath + "/authorization/budget/max_run_creations",
                    schemaPath:
                      "start-request.schema.json#/properties/authorization_budget/properties/max_run_creations/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 1 },
                    message: "must be <= 1",
                  };
                  if (vErrors === null) {
                    vErrors = [err74];
                  } else {
                    vErrors.push(err74);
                  }
                  errors++;
                }
                if (data21 < 1 || isNaN(data21)) {
                  const err75 = {
                    instancePath: instancePath + "/authorization/budget/max_run_creations",
                    schemaPath:
                      "start-request.schema.json#/properties/authorization_budget/properties/max_run_creations/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 1 },
                    message: "must be >= 1",
                  };
                  if (vErrors === null) {
                    vErrors = [err75];
                  } else {
                    vErrors.push(err75);
                  }
                  errors++;
                }
              }
            }
            if (data17.max_execution_time_ms !== undefined) {
              let data22 = data17.max_execution_time_ms;
              if (!(typeof data22 == "number" && !(data22 % 1) && !isNaN(data22))) {
                const err76 = {
                  instancePath: instancePath + "/authorization/budget/max_execution_time_ms",
                  schemaPath:
                    "start-request.schema.json#/properties/authorization_budget/properties/max_execution_time_ms/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err76];
                } else {
                  vErrors.push(err76);
                }
                errors++;
              }
              if (typeof data22 == "number") {
                if (data22 > 3600000 || isNaN(data22)) {
                  const err77 = {
                    instancePath: instancePath + "/authorization/budget/max_execution_time_ms",
                    schemaPath:
                      "start-request.schema.json#/properties/authorization_budget/properties/max_execution_time_ms/maximum",
                    keyword: "maximum",
                    params: { comparison: "<=", limit: 3600000 },
                    message: "must be <= 3600000",
                  };
                  if (vErrors === null) {
                    vErrors = [err77];
                  } else {
                    vErrors.push(err77);
                  }
                  errors++;
                }
                if (data22 < 1 || isNaN(data22)) {
                  const err78 = {
                    instancePath: instancePath + "/authorization/budget/max_execution_time_ms",
                    schemaPath:
                      "start-request.schema.json#/properties/authorization_budget/properties/max_execution_time_ms/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 1 },
                    message: "must be >= 1",
                  };
                  if (vErrors === null) {
                    vErrors = [err78];
                  } else {
                    vErrors.push(err78);
                  }
                  errors++;
                }
              }
            }
          } else {
            const err79 = {
              instancePath: instancePath + "/authorization/budget",
              schemaPath: "start-request.schema.json#/properties/authorization_budget/type",
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
        }
        if (data13.usage !== undefined) {
          let data23 = data13.usage;
          if (data23 && typeof data23 == "object" && !Array.isArray(data23)) {
            if (data23.navigation_attempts === undefined) {
              const err80 = {
                instancePath: instancePath + "/authorization/usage",
                schemaPath: "#/properties/authorization/properties/usage/required",
                keyword: "required",
                params: { missingProperty: "navigation_attempts" },
                message: "must have required property '" + "navigation_attempts" + "'",
              };
              if (vErrors === null) {
                vErrors = [err80];
              } else {
                vErrors.push(err80);
              }
              errors++;
            }
            if (data23.model_calls === undefined) {
              const err81 = {
                instancePath: instancePath + "/authorization/usage",
                schemaPath: "#/properties/authorization/properties/usage/required",
                keyword: "required",
                params: { missingProperty: "model_calls" },
                message: "must have required property '" + "model_calls" + "'",
              };
              if (vErrors === null) {
                vErrors = [err81];
              } else {
                vErrors.push(err81);
              }
              errors++;
            }
            if (data23.tool_calls_per_round === undefined) {
              const err82 = {
                instancePath: instancePath + "/authorization/usage",
                schemaPath: "#/properties/authorization/properties/usage/required",
                keyword: "required",
                params: { missingProperty: "tool_calls_per_round" },
                message: "must have required property '" + "tool_calls_per_round" + "'",
              };
              if (vErrors === null) {
                vErrors = [err82];
              } else {
                vErrors.push(err82);
              }
              errors++;
            }
            if (data23.run_creations === undefined) {
              const err83 = {
                instancePath: instancePath + "/authorization/usage",
                schemaPath: "#/properties/authorization/properties/usage/required",
                keyword: "required",
                params: { missingProperty: "run_creations" },
                message: "must have required property '" + "run_creations" + "'",
              };
              if (vErrors === null) {
                vErrors = [err83];
              } else {
                vErrors.push(err83);
              }
              errors++;
            }
            if (data23.execution_time_ms === undefined) {
              const err84 = {
                instancePath: instancePath + "/authorization/usage",
                schemaPath: "#/properties/authorization/properties/usage/required",
                keyword: "required",
                params: { missingProperty: "execution_time_ms" },
                message: "must have required property '" + "execution_time_ms" + "'",
              };
              if (vErrors === null) {
                vErrors = [err84];
              } else {
                vErrors.push(err84);
              }
              errors++;
            }
            for (const key3 in data23) {
              if (!(
                key3 === "navigation_attempts" ||
                key3 === "model_calls" ||
                key3 === "tool_calls_per_round" ||
                key3 === "run_creations" ||
                key3 === "execution_time_ms"
              )) {
                const err85 = {
                  instancePath: instancePath + "/authorization/usage",
                  schemaPath: "#/properties/authorization/properties/usage/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key3 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err85];
                } else {
                  vErrors.push(err85);
                }
                errors++;
              }
            }
            if (data23.navigation_attempts !== undefined) {
              let data24 = data23.navigation_attempts;
              if (!(typeof data24 == "number" && !(data24 % 1) && !isNaN(data24))) {
                const err86 = {
                  instancePath: instancePath + "/authorization/usage/navigation_attempts",
                  schemaPath: "#/properties/authorization/properties/usage/properties/navigation_attempts/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err86];
                } else {
                  vErrors.push(err86);
                }
                errors++;
              }
              if (typeof data24 == "number") {
                if (data24 < 0 || isNaN(data24)) {
                  const err87 = {
                    instancePath: instancePath + "/authorization/usage/navigation_attempts",
                    schemaPath: "#/properties/authorization/properties/usage/properties/navigation_attempts/minimum",
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
            if (data23.model_calls !== undefined) {
              let data25 = data23.model_calls;
              if (!(typeof data25 == "number" && !(data25 % 1) && !isNaN(data25))) {
                const err88 = {
                  instancePath: instancePath + "/authorization/usage/model_calls",
                  schemaPath: "#/properties/authorization/properties/usage/properties/model_calls/type",
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
              if (typeof data25 == "number") {
                if (data25 < 0 || isNaN(data25)) {
                  const err89 = {
                    instancePath: instancePath + "/authorization/usage/model_calls",
                    schemaPath: "#/properties/authorization/properties/usage/properties/model_calls/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err89];
                  } else {
                    vErrors.push(err89);
                  }
                  errors++;
                }
              }
            }
            if (data23.tool_calls_per_round !== undefined) {
              let data26 = data23.tool_calls_per_round;
              if (!(typeof data26 == "number" && !(data26 % 1) && !isNaN(data26))) {
                const err90 = {
                  instancePath: instancePath + "/authorization/usage/tool_calls_per_round",
                  schemaPath: "#/properties/authorization/properties/usage/properties/tool_calls_per_round/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err90];
                } else {
                  vErrors.push(err90);
                }
                errors++;
              }
              if (typeof data26 == "number") {
                if (data26 < 0 || isNaN(data26)) {
                  const err91 = {
                    instancePath: instancePath + "/authorization/usage/tool_calls_per_round",
                    schemaPath: "#/properties/authorization/properties/usage/properties/tool_calls_per_round/minimum",
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
            if (data23.run_creations !== undefined) {
              let data27 = data23.run_creations;
              if (!(typeof data27 == "number" && !(data27 % 1) && !isNaN(data27))) {
                const err92 = {
                  instancePath: instancePath + "/authorization/usage/run_creations",
                  schemaPath: "#/properties/authorization/properties/usage/properties/run_creations/type",
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
              if (typeof data27 == "number") {
                if (data27 < 0 || isNaN(data27)) {
                  const err93 = {
                    instancePath: instancePath + "/authorization/usage/run_creations",
                    schemaPath: "#/properties/authorization/properties/usage/properties/run_creations/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err93];
                  } else {
                    vErrors.push(err93);
                  }
                  errors++;
                }
              }
            }
            if (data23.execution_time_ms !== undefined) {
              let data28 = data23.execution_time_ms;
              if (!(typeof data28 == "number" && !(data28 % 1) && !isNaN(data28))) {
                const err94 = {
                  instancePath: instancePath + "/authorization/usage/execution_time_ms",
                  schemaPath: "#/properties/authorization/properties/usage/properties/execution_time_ms/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err94];
                } else {
                  vErrors.push(err94);
                }
                errors++;
              }
              if (typeof data28 == "number") {
                if (data28 < 0 || isNaN(data28)) {
                  const err95 = {
                    instancePath: instancePath + "/authorization/usage/execution_time_ms",
                    schemaPath: "#/properties/authorization/properties/usage/properties/execution_time_ms/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err95];
                  } else {
                    vErrors.push(err95);
                  }
                  errors++;
                }
              }
            }
          } else {
            const err96 = {
              instancePath: instancePath + "/authorization/usage",
              schemaPath: "#/properties/authorization/properties/usage/type",
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
        if (data13.remaining !== undefined) {
          let data29 = data13.remaining;
          if (data29 && typeof data29 == "object" && !Array.isArray(data29)) {
            if (data29.max_navigation_attempts === undefined) {
              const err97 = {
                instancePath: instancePath + "/authorization/remaining",
                schemaPath: "#/properties/authorization/properties/remaining/required",
                keyword: "required",
                params: { missingProperty: "max_navigation_attempts" },
                message: "must have required property '" + "max_navigation_attempts" + "'",
              };
              if (vErrors === null) {
                vErrors = [err97];
              } else {
                vErrors.push(err97);
              }
              errors++;
            }
            if (data29.max_model_calls === undefined) {
              const err98 = {
                instancePath: instancePath + "/authorization/remaining",
                schemaPath: "#/properties/authorization/properties/remaining/required",
                keyword: "required",
                params: { missingProperty: "max_model_calls" },
                message: "must have required property '" + "max_model_calls" + "'",
              };
              if (vErrors === null) {
                vErrors = [err98];
              } else {
                vErrors.push(err98);
              }
              errors++;
            }
            if (data29.max_tool_calls_per_round === undefined) {
              const err99 = {
                instancePath: instancePath + "/authorization/remaining",
                schemaPath: "#/properties/authorization/properties/remaining/required",
                keyword: "required",
                params: { missingProperty: "max_tool_calls_per_round" },
                message: "must have required property '" + "max_tool_calls_per_round" + "'",
              };
              if (vErrors === null) {
                vErrors = [err99];
              } else {
                vErrors.push(err99);
              }
              errors++;
            }
            if (data29.max_run_creations === undefined) {
              const err100 = {
                instancePath: instancePath + "/authorization/remaining",
                schemaPath: "#/properties/authorization/properties/remaining/required",
                keyword: "required",
                params: { missingProperty: "max_run_creations" },
                message: "must have required property '" + "max_run_creations" + "'",
              };
              if (vErrors === null) {
                vErrors = [err100];
              } else {
                vErrors.push(err100);
              }
              errors++;
            }
            if (data29.max_execution_time_ms === undefined) {
              const err101 = {
                instancePath: instancePath + "/authorization/remaining",
                schemaPath: "#/properties/authorization/properties/remaining/required",
                keyword: "required",
                params: { missingProperty: "max_execution_time_ms" },
                message: "must have required property '" + "max_execution_time_ms" + "'",
              };
              if (vErrors === null) {
                vErrors = [err101];
              } else {
                vErrors.push(err101);
              }
              errors++;
            }
            for (const key4 in data29) {
              if (!(
                key4 === "max_navigation_attempts" ||
                key4 === "max_model_calls" ||
                key4 === "max_tool_calls_per_round" ||
                key4 === "max_run_creations" ||
                key4 === "max_execution_time_ms"
              )) {
                const err102 = {
                  instancePath: instancePath + "/authorization/remaining",
                  schemaPath: "#/properties/authorization/properties/remaining/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key4 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err102];
                } else {
                  vErrors.push(err102);
                }
                errors++;
              }
            }
            if (data29.max_navigation_attempts !== undefined) {
              let data30 = data29.max_navigation_attempts;
              if (!(typeof data30 == "number" && !(data30 % 1) && !isNaN(data30))) {
                const err103 = {
                  instancePath: instancePath + "/authorization/remaining/max_navigation_attempts",
                  schemaPath: "#/properties/authorization/properties/remaining/properties/max_navigation_attempts/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err103];
                } else {
                  vErrors.push(err103);
                }
                errors++;
              }
              if (typeof data30 == "number") {
                if (data30 < 0 || isNaN(data30)) {
                  const err104 = {
                    instancePath: instancePath + "/authorization/remaining/max_navigation_attempts",
                    schemaPath:
                      "#/properties/authorization/properties/remaining/properties/max_navigation_attempts/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err104];
                  } else {
                    vErrors.push(err104);
                  }
                  errors++;
                }
              }
            }
            if (data29.max_model_calls !== undefined) {
              let data31 = data29.max_model_calls;
              if (!(typeof data31 == "number" && !(data31 % 1) && !isNaN(data31))) {
                const err105 = {
                  instancePath: instancePath + "/authorization/remaining/max_model_calls",
                  schemaPath: "#/properties/authorization/properties/remaining/properties/max_model_calls/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err105];
                } else {
                  vErrors.push(err105);
                }
                errors++;
              }
              if (typeof data31 == "number") {
                if (data31 < 0 || isNaN(data31)) {
                  const err106 = {
                    instancePath: instancePath + "/authorization/remaining/max_model_calls",
                    schemaPath: "#/properties/authorization/properties/remaining/properties/max_model_calls/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err106];
                  } else {
                    vErrors.push(err106);
                  }
                  errors++;
                }
              }
            }
            if (data29.max_tool_calls_per_round !== undefined) {
              let data32 = data29.max_tool_calls_per_round;
              if (!(typeof data32 == "number" && !(data32 % 1) && !isNaN(data32))) {
                const err107 = {
                  instancePath: instancePath + "/authorization/remaining/max_tool_calls_per_round",
                  schemaPath:
                    "#/properties/authorization/properties/remaining/properties/max_tool_calls_per_round/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err107];
                } else {
                  vErrors.push(err107);
                }
                errors++;
              }
              if (typeof data32 == "number") {
                if (data32 < 0 || isNaN(data32)) {
                  const err108 = {
                    instancePath: instancePath + "/authorization/remaining/max_tool_calls_per_round",
                    schemaPath:
                      "#/properties/authorization/properties/remaining/properties/max_tool_calls_per_round/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err108];
                  } else {
                    vErrors.push(err108);
                  }
                  errors++;
                }
              }
            }
            if (data29.max_run_creations !== undefined) {
              let data33 = data29.max_run_creations;
              if (!(typeof data33 == "number" && !(data33 % 1) && !isNaN(data33))) {
                const err109 = {
                  instancePath: instancePath + "/authorization/remaining/max_run_creations",
                  schemaPath: "#/properties/authorization/properties/remaining/properties/max_run_creations/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err109];
                } else {
                  vErrors.push(err109);
                }
                errors++;
              }
              if (typeof data33 == "number") {
                if (data33 < 0 || isNaN(data33)) {
                  const err110 = {
                    instancePath: instancePath + "/authorization/remaining/max_run_creations",
                    schemaPath: "#/properties/authorization/properties/remaining/properties/max_run_creations/minimum",
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
            if (data29.max_execution_time_ms !== undefined) {
              let data34 = data29.max_execution_time_ms;
              if (!(typeof data34 == "number" && !(data34 % 1) && !isNaN(data34))) {
                const err111 = {
                  instancePath: instancePath + "/authorization/remaining/max_execution_time_ms",
                  schemaPath: "#/properties/authorization/properties/remaining/properties/max_execution_time_ms/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                if (vErrors === null) {
                  vErrors = [err111];
                } else {
                  vErrors.push(err111);
                }
                errors++;
              }
              if (typeof data34 == "number") {
                if (data34 < 0 || isNaN(data34)) {
                  const err112 = {
                    instancePath: instancePath + "/authorization/remaining/max_execution_time_ms",
                    schemaPath:
                      "#/properties/authorization/properties/remaining/properties/max_execution_time_ms/minimum",
                    keyword: "minimum",
                    params: { comparison: ">=", limit: 0 },
                    message: "must be >= 0",
                  };
                  if (vErrors === null) {
                    vErrors = [err112];
                  } else {
                    vErrors.push(err112);
                  }
                  errors++;
                }
              }
            }
          } else {
            const err113 = {
              instancePath: instancePath + "/authorization/remaining",
              schemaPath: "#/properties/authorization/properties/remaining/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err113];
            } else {
              vErrors.push(err113);
            }
            errors++;
          }
        }
      }
    }
    if (data.validation !== undefined) {
      let data35 = data.validation;
      if (!(data35 && typeof data35 == "object" && !Array.isArray(data35)) && data35 !== null) {
        const err114 = {
          instancePath: instancePath + "/validation",
          schemaPath: "#/properties/validation/type",
          keyword: "type",
          params: { type: schema37.properties.validation.type },
          message: "must be object,null",
        };
        if (vErrors === null) {
          vErrors = [err114];
        } else {
          vErrors.push(err114);
        }
        errors++;
      }
    }
    if (data.evidence !== undefined) {
      let data36 = data.evidence;
      if (!(data36 && typeof data36 == "object" && !Array.isArray(data36)) && data36 !== null) {
        const err115 = {
          instancePath: instancePath + "/evidence",
          schemaPath: "#/properties/evidence/type",
          keyword: "type",
          params: { type: schema37.properties.evidence.type },
          message: "must be object,null",
        };
        if (vErrors === null) {
          vErrors = [err115];
        } else {
          vErrors.push(err115);
        }
        errors++;
      }
    }
    if (data.report !== undefined) {
      let data37 = data.report;
      if (!(data37 && typeof data37 == "object" && !Array.isArray(data37)) && data37 !== null) {
        const err116 = {
          instancePath: instancePath + "/report",
          schemaPath: "#/properties/report/type",
          keyword: "type",
          params: { type: schema37.properties.report.type },
          message: "must be object,null",
        };
        if (vErrors === null) {
          vErrors = [err116];
        } else {
          vErrors.push(err116);
        }
        errors++;
      }
    }
    if (data.terminal_reason !== undefined) {
      let data38 = data.terminal_reason;
      if (typeof data38 !== "string" && data38 !== null) {
        const err117 = {
          instancePath: instancePath + "/terminal_reason",
          schemaPath: "#/properties/terminal_reason/type",
          keyword: "type",
          params: { type: schema37.properties.terminal_reason.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err117];
        } else {
          vErrors.push(err117);
        }
        errors++;
      }
      if (typeof data38 === "string") {
        if (func2(data38) > 256) {
          const err118 = {
            instancePath: instancePath + "/terminal_reason",
            schemaPath: "#/properties/terminal_reason/maxLength",
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
      }
    }
    if (data.checkpoint_id !== undefined) {
      let data39 = data.checkpoint_id;
      if (typeof data39 !== "string" && data39 !== null) {
        const err119 = {
          instancePath: instancePath + "/checkpoint_id",
          schemaPath: "#/properties/checkpoint_id/type",
          keyword: "type",
          params: { type: schema37.properties.checkpoint_id.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err119];
        } else {
          vErrors.push(err119);
        }
        errors++;
      }
      if (typeof data39 === "string") {
        if (func2(data39) > 256) {
          const err120 = {
            instancePath: instancePath + "/checkpoint_id",
            schemaPath: "#/properties/checkpoint_id/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err120];
          } else {
            vErrors.push(err120);
          }
          errors++;
        }
      }
    }
    if (data.created_at !== undefined) {
      if (!(typeof data.created_at === "string")) {
        const err121 = {
          instancePath: instancePath + "/created_at",
          schemaPath: "#/properties/created_at/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err121];
        } else {
          vErrors.push(err121);
        }
        errors++;
      }
    }
    if (data.updated_at !== undefined) {
      if (!(typeof data.updated_at === "string")) {
        const err122 = {
          instancePath: instancePath + "/updated_at",
          schemaPath: "#/properties/updated_at/type",
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
    if (data.current_page !== undefined) {
      let data42 = data.current_page;
      if (typeof data42 !== "string" && data42 !== null) {
        const err123 = {
          instancePath: instancePath + "/current_page",
          schemaPath: "#/properties/current_page/type",
          keyword: "type",
          params: { type: schema37.properties.current_page.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err123];
        } else {
          vErrors.push(err123);
        }
        errors++;
      }
      if (typeof data42 === "string") {
        if (func2(data42) > 128) {
          const err124 = {
            instancePath: instancePath + "/current_page",
            schemaPath: "#/properties/current_page/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err124];
          } else {
            vErrors.push(err124);
          }
          errors++;
        }
      }
    }
    if (data.current_page_capabilities !== undefined) {
      let data43 = data.current_page_capabilities;
      if (Array.isArray(data43)) {
        if (data43.length > 32) {
          const err125 = {
            instancePath: instancePath + "/current_page_capabilities",
            schemaPath: "#/properties/current_page_capabilities/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err125];
          } else {
            vErrors.push(err125);
          }
          errors++;
        }
        const len0 = data43.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data44 = data43[i0];
          if (typeof data44 === "string") {
            if (func2(data44) > 128) {
              const err126 = {
                instancePath: instancePath + "/current_page_capabilities/" + i0,
                schemaPath: "#/properties/current_page_capabilities/items/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err126];
              } else {
                vErrors.push(err126);
              }
              errors++;
            }
            if (func2(data44) < 1) {
              const err127 = {
                instancePath: instancePath + "/current_page_capabilities/" + i0,
                schemaPath: "#/properties/current_page_capabilities/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err127];
              } else {
                vErrors.push(err127);
              }
              errors++;
            }
          } else {
            const err128 = {
              instancePath: instancePath + "/current_page_capabilities/" + i0,
              schemaPath: "#/properties/current_page_capabilities/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err128];
            } else {
              vErrors.push(err128);
            }
            errors++;
          }
        }
        let i1 = data43.length;
        let j0;
        if (i1 > 1) {
          const indices0 = {};
          for (; i1--;) {
            let item0 = data43[i1];
            if (typeof item0 !== "string") {
              continue;
            }
            if (typeof indices0[item0] == "number") {
              j0 = indices0[item0];
              const err129 = {
                instancePath: instancePath + "/current_page_capabilities",
                schemaPath: "#/properties/current_page_capabilities/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i1, j: j0 },
                message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err129];
              } else {
                vErrors.push(err129);
              }
              errors++;
              break;
            }
            indices0[item0] = i1;
          }
        }
      } else {
        const err130 = {
          instancePath: instancePath + "/current_page_capabilities",
          schemaPath: "#/properties/current_page_capabilities/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err130];
        } else {
          vErrors.push(err130);
        }
        errors++;
      }
    }
    if (data.current_context_revision !== undefined) {
      let data45 = data.current_context_revision;
      if (typeof data45 !== "string" && data45 !== null) {
        const err131 = {
          instancePath: instancePath + "/current_context_revision",
          schemaPath: "#/properties/current_context_revision/type",
          keyword: "type",
          params: { type: schema37.properties.current_context_revision.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err131];
        } else {
          vErrors.push(err131);
        }
        errors++;
      }
      if (typeof data45 === "string") {
        if (func2(data45) > 256) {
          const err132 = {
            instancePath: instancePath + "/current_context_revision",
            schemaPath: "#/properties/current_context_revision/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err132];
          } else {
            vErrors.push(err132);
          }
          errors++;
        }
      }
    }
    if (data.required_capabilities !== undefined) {
      let data46 = data.required_capabilities;
      if (Array.isArray(data46)) {
        if (data46.length > 32) {
          const err133 = {
            instancePath: instancePath + "/required_capabilities",
            schemaPath: "#/properties/required_capabilities/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err133];
          } else {
            vErrors.push(err133);
          }
          errors++;
        }
        const len1 = data46.length;
        for (let i2 = 0; i2 < len1; i2++) {
          let data47 = data46[i2];
          if (typeof data47 === "string") {
            if (func2(data47) > 128) {
              const err134 = {
                instancePath: instancePath + "/required_capabilities/" + i2,
                schemaPath: "#/properties/required_capabilities/items/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err134];
              } else {
                vErrors.push(err134);
              }
              errors++;
            }
            if (func2(data47) < 1) {
              const err135 = {
                instancePath: instancePath + "/required_capabilities/" + i2,
                schemaPath: "#/properties/required_capabilities/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/required_capabilities/" + i2,
              schemaPath: "#/properties/required_capabilities/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err136];
            } else {
              vErrors.push(err136);
            }
            errors++;
          }
        }
        let i3 = data46.length;
        let j1;
        if (i3 > 1) {
          const indices1 = {};
          for (; i3--;) {
            let item1 = data46[i3];
            if (typeof item1 !== "string") {
              continue;
            }
            if (typeof indices1[item1] == "number") {
              j1 = indices1[item1];
              const err137 = {
                instancePath: instancePath + "/required_capabilities",
                schemaPath: "#/properties/required_capabilities/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i3, j: j1 },
                message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err137];
              } else {
                vErrors.push(err137);
              }
              errors++;
              break;
            }
            indices1[item1] = i3;
          }
        }
      } else {
        const err138 = {
          instancePath: instancePath + "/required_capabilities",
          schemaPath: "#/properties/required_capabilities/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err138];
        } else {
          vErrors.push(err138);
        }
        errors++;
      }
    }
    if (data.allowed_pages !== undefined) {
      let data48 = data.allowed_pages;
      if (Array.isArray(data48)) {
        if (data48.length > 32) {
          const err139 = {
            instancePath: instancePath + "/allowed_pages",
            schemaPath: "#/properties/allowed_pages/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err139];
          } else {
            vErrors.push(err139);
          }
          errors++;
        }
        const len2 = data48.length;
        for (let i4 = 0; i4 < len2; i4++) {
          let data49 = data48[i4];
          if (typeof data49 === "string") {
            if (func2(data49) > 128) {
              const err140 = {
                instancePath: instancePath + "/allowed_pages/" + i4,
                schemaPath: "#/properties/allowed_pages/items/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err140];
              } else {
                vErrors.push(err140);
              }
              errors++;
            }
            if (func2(data49) < 1) {
              const err141 = {
                instancePath: instancePath + "/allowed_pages/" + i4,
                schemaPath: "#/properties/allowed_pages/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err141];
              } else {
                vErrors.push(err141);
              }
              errors++;
            }
          } else {
            const err142 = {
              instancePath: instancePath + "/allowed_pages/" + i4,
              schemaPath: "#/properties/allowed_pages/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err142];
            } else {
              vErrors.push(err142);
            }
            errors++;
          }
        }
        let i5 = data48.length;
        let j2;
        if (i5 > 1) {
          const indices2 = {};
          for (; i5--;) {
            let item2 = data48[i5];
            if (typeof item2 !== "string") {
              continue;
            }
            if (typeof indices2[item2] == "number") {
              j2 = indices2[item2];
              const err143 = {
                instancePath: instancePath + "/allowed_pages",
                schemaPath: "#/properties/allowed_pages/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i5, j: j2 },
                message: "must NOT have duplicate items (items ## " + j2 + " and " + i5 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err143];
              } else {
                vErrors.push(err143);
              }
              errors++;
              break;
            }
            indices2[item2] = i5;
          }
        }
      } else {
        const err144 = {
          instancePath: instancePath + "/allowed_pages",
          schemaPath: "#/properties/allowed_pages/type",
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
    if (data.allowed_actions !== undefined) {
      let data50 = data.allowed_actions;
      if (Array.isArray(data50)) {
        if (data50.length > 32) {
          const err145 = {
            instancePath: instancePath + "/allowed_actions",
            schemaPath: "#/properties/allowed_actions/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err145];
          } else {
            vErrors.push(err145);
          }
          errors++;
        }
        const len3 = data50.length;
        for (let i6 = 0; i6 < len3; i6++) {
          let data51 = data50[i6];
          if (typeof data51 === "string") {
            if (func2(data51) > 128) {
              const err146 = {
                instancePath: instancePath + "/allowed_actions/" + i6,
                schemaPath: "#/properties/allowed_actions/items/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err146];
              } else {
                vErrors.push(err146);
              }
              errors++;
            }
            if (func2(data51) < 1) {
              const err147 = {
                instancePath: instancePath + "/allowed_actions/" + i6,
                schemaPath: "#/properties/allowed_actions/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err147];
              } else {
                vErrors.push(err147);
              }
              errors++;
            }
          } else {
            const err148 = {
              instancePath: instancePath + "/allowed_actions/" + i6,
              schemaPath: "#/properties/allowed_actions/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err148];
            } else {
              vErrors.push(err148);
            }
            errors++;
          }
        }
        let i7 = data50.length;
        let j3;
        if (i7 > 1) {
          const indices3 = {};
          for (; i7--;) {
            let item3 = data50[i7];
            if (typeof item3 !== "string") {
              continue;
            }
            if (typeof indices3[item3] == "number") {
              j3 = indices3[item3];
              const err149 = {
                instancePath: instancePath + "/allowed_actions",
                schemaPath: "#/properties/allowed_actions/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i7, j: j3 },
                message: "must NOT have duplicate items (items ## " + j3 + " and " + i7 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err149];
              } else {
                vErrors.push(err149);
              }
              errors++;
              break;
            }
            indices3[item3] = i7;
          }
        }
      } else {
        const err150 = {
          instancePath: instancePath + "/allowed_actions",
          schemaPath: "#/properties/allowed_actions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err150];
        } else {
          vErrors.push(err150);
        }
        errors++;
      }
    }
    if (data.visited_pages !== undefined) {
      let data52 = data.visited_pages;
      if (Array.isArray(data52)) {
        if (data52.length > 8) {
          const err151 = {
            instancePath: instancePath + "/visited_pages",
            schemaPath: "#/properties/visited_pages/maxItems",
            keyword: "maxItems",
            params: { limit: 8 },
            message: "must NOT have more than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err151];
          } else {
            vErrors.push(err151);
          }
          errors++;
        }
        const len4 = data52.length;
        for (let i8 = 0; i8 < len4; i8++) {
          let data53 = data52[i8];
          if (typeof data53 === "string") {
            if (func2(data53) > 128) {
              const err152 = {
                instancePath: instancePath + "/visited_pages/" + i8,
                schemaPath: "#/properties/visited_pages/items/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err152];
              } else {
                vErrors.push(err152);
              }
              errors++;
            }
            if (func2(data53) < 1) {
              const err153 = {
                instancePath: instancePath + "/visited_pages/" + i8,
                schemaPath: "#/properties/visited_pages/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err153];
              } else {
                vErrors.push(err153);
              }
              errors++;
            }
          } else {
            const err154 = {
              instancePath: instancePath + "/visited_pages/" + i8,
              schemaPath: "#/properties/visited_pages/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err154];
            } else {
              vErrors.push(err154);
            }
            errors++;
          }
        }
        let i9 = data52.length;
        let j4;
        if (i9 > 1) {
          const indices4 = {};
          for (; i9--;) {
            let item4 = data52[i9];
            if (typeof item4 !== "string") {
              continue;
            }
            if (typeof indices4[item4] == "number") {
              j4 = indices4[item4];
              const err155 = {
                instancePath: instancePath + "/visited_pages",
                schemaPath: "#/properties/visited_pages/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i9, j: j4 },
                message: "must NOT have duplicate items (items ## " + j4 + " and " + i9 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err155];
              } else {
                vErrors.push(err155);
              }
              errors++;
              break;
            }
            indices4[item4] = i9;
          }
        }
      } else {
        const err156 = {
          instancePath: instancePath + "/visited_pages",
          schemaPath: "#/properties/visited_pages/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err156];
        } else {
          vErrors.push(err156);
        }
        errors++;
      }
    }
    if (data.navigation_attempts !== undefined) {
      let data54 = data.navigation_attempts;
      if (!(typeof data54 == "number" && !(data54 % 1) && !isNaN(data54))) {
        const err157 = {
          instancePath: instancePath + "/navigation_attempts",
          schemaPath: "#/properties/navigation_attempts/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err157];
        } else {
          vErrors.push(err157);
        }
        errors++;
      }
      if (typeof data54 == "number") {
        if (data54 > 8 || isNaN(data54)) {
          const err158 = {
            instancePath: instancePath + "/navigation_attempts",
            schemaPath: "#/properties/navigation_attempts/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 8 },
            message: "must be <= 8",
          };
          if (vErrors === null) {
            vErrors = [err158];
          } else {
            vErrors.push(err158);
          }
          errors++;
        }
        if (data54 < 0 || isNaN(data54)) {
          const err159 = {
            instancePath: instancePath + "/navigation_attempts",
            schemaPath: "#/properties/navigation_attempts/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err159];
          } else {
            vErrors.push(err159);
          }
          errors++;
        }
      }
    }
    if (data.max_navigation_attempts !== undefined) {
      let data55 = data.max_navigation_attempts;
      if (!(typeof data55 == "number" && !(data55 % 1) && !isNaN(data55))) {
        const err160 = {
          instancePath: instancePath + "/max_navigation_attempts",
          schemaPath: "#/properties/max_navigation_attempts/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err160];
        } else {
          vErrors.push(err160);
        }
        errors++;
      }
      if (typeof data55 == "number") {
        if (data55 > 8 || isNaN(data55)) {
          const err161 = {
            instancePath: instancePath + "/max_navigation_attempts",
            schemaPath: "#/properties/max_navigation_attempts/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 8 },
            message: "must be <= 8",
          };
          if (vErrors === null) {
            vErrors = [err161];
          } else {
            vErrors.push(err161);
          }
          errors++;
        }
        if (data55 < 0 || isNaN(data55)) {
          const err162 = {
            instancePath: instancePath + "/max_navigation_attempts",
            schemaPath: "#/properties/max_navigation_attempts/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err162];
          } else {
            vErrors.push(err162);
          }
          errors++;
        }
      }
    }
    if (data.navigation_failures !== undefined) {
      let data56 = data.navigation_failures;
      if (Array.isArray(data56)) {
        if (data56.length > 8) {
          const err163 = {
            instancePath: instancePath + "/navigation_failures",
            schemaPath: "#/properties/navigation_failures/maxItems",
            keyword: "maxItems",
            params: { limit: 8 },
            message: "must NOT have more than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err163];
          } else {
            vErrors.push(err163);
          }
          errors++;
        }
        const len5 = data56.length;
        for (let i10 = 0; i10 < len5; i10++) {
          let data57 = data56[i10];
          if (data57 && typeof data57 == "object" && !Array.isArray(data57)) {
            if (data57.page === undefined) {
              const err164 = {
                instancePath: instancePath + "/navigation_failures/" + i10,
                schemaPath: "#/properties/navigation_failures/items/required",
                keyword: "required",
                params: { missingProperty: "page" },
                message: "must have required property '" + "page" + "'",
              };
              if (vErrors === null) {
                vErrors = [err164];
              } else {
                vErrors.push(err164);
              }
              errors++;
            }
            if (data57.type === undefined) {
              const err165 = {
                instancePath: instancePath + "/navigation_failures/" + i10,
                schemaPath: "#/properties/navigation_failures/items/required",
                keyword: "required",
                params: { missingProperty: "type" },
                message: "must have required property '" + "type" + "'",
              };
              if (vErrors === null) {
                vErrors = [err165];
              } else {
                vErrors.push(err165);
              }
              errors++;
            }
            for (const key5 in data57) {
              if (!(key5 === "page" || key5 === "type" || key5 === "detail")) {
                const err166 = {
                  instancePath: instancePath + "/navigation_failures/" + i10,
                  schemaPath: "#/properties/navigation_failures/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key5 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err166];
                } else {
                  vErrors.push(err166);
                }
                errors++;
              }
            }
            if (data57.page !== undefined) {
              let data58 = data57.page;
              if (typeof data58 === "string") {
                if (func2(data58) > 128) {
                  const err167 = {
                    instancePath: instancePath + "/navigation_failures/" + i10 + "/page",
                    schemaPath: "#/properties/navigation_failures/items/properties/page/maxLength",
                    keyword: "maxLength",
                    params: { limit: 128 },
                    message: "must NOT have more than 128 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err167];
                  } else {
                    vErrors.push(err167);
                  }
                  errors++;
                }
                if (func2(data58) < 1) {
                  const err168 = {
                    instancePath: instancePath + "/navigation_failures/" + i10 + "/page",
                    schemaPath: "#/properties/navigation_failures/items/properties/page/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err168];
                  } else {
                    vErrors.push(err168);
                  }
                  errors++;
                }
              } else {
                const err169 = {
                  instancePath: instancePath + "/navigation_failures/" + i10 + "/page",
                  schemaPath: "#/properties/navigation_failures/items/properties/page/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err169];
                } else {
                  vErrors.push(err169);
                }
                errors++;
              }
            }
            if (data57.type !== undefined) {
              let data59 = data57.type;
              if (typeof data59 === "string") {
                if (func2(data59) > 64) {
                  const err170 = {
                    instancePath: instancePath + "/navigation_failures/" + i10 + "/type",
                    schemaPath: "#/properties/navigation_failures/items/properties/type/maxLength",
                    keyword: "maxLength",
                    params: { limit: 64 },
                    message: "must NOT have more than 64 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err170];
                  } else {
                    vErrors.push(err170);
                  }
                  errors++;
                }
                if (func2(data59) < 1) {
                  const err171 = {
                    instancePath: instancePath + "/navigation_failures/" + i10 + "/type",
                    schemaPath: "#/properties/navigation_failures/items/properties/type/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err171];
                  } else {
                    vErrors.push(err171);
                  }
                  errors++;
                }
              } else {
                const err172 = {
                  instancePath: instancePath + "/navigation_failures/" + i10 + "/type",
                  schemaPath: "#/properties/navigation_failures/items/properties/type/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err172];
                } else {
                  vErrors.push(err172);
                }
                errors++;
              }
            }
            if (data57.detail !== undefined) {
              let data60 = data57.detail;
              if (typeof data60 === "string") {
                if (func2(data60) > 160) {
                  const err173 = {
                    instancePath: instancePath + "/navigation_failures/" + i10 + "/detail",
                    schemaPath: "#/properties/navigation_failures/items/properties/detail/maxLength",
                    keyword: "maxLength",
                    params: { limit: 160 },
                    message: "must NOT have more than 160 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err173];
                  } else {
                    vErrors.push(err173);
                  }
                  errors++;
                }
              } else {
                const err174 = {
                  instancePath: instancePath + "/navigation_failures/" + i10 + "/detail",
                  schemaPath: "#/properties/navigation_failures/items/properties/detail/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err174];
                } else {
                  vErrors.push(err174);
                }
                errors++;
              }
            }
          } else {
            const err175 = {
              instancePath: instancePath + "/navigation_failures/" + i10,
              schemaPath: "#/properties/navigation_failures/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err175];
            } else {
              vErrors.push(err175);
            }
            errors++;
          }
        }
      } else {
        const err176 = {
          instancePath: instancePath + "/navigation_failures",
          schemaPath: "#/properties/navigation_failures/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err176];
        } else {
          vErrors.push(err176);
        }
        errors++;
      }
    }
    if (data.last_navigation_observation !== undefined) {
      let data61 = data.last_navigation_observation;
      const _errs128 = errors;
      let valid24 = false;
      const _errs129 = errors;
      if (data61 && typeof data61 == "object" && !Array.isArray(data61)) {
        if (data61.target_page === undefined) {
          const err177 = {
            instancePath: instancePath + "/last_navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "target_page" },
            message: "must have required property '" + "target_page" + "'",
          };
          if (vErrors === null) {
            vErrors = [err177];
          } else {
            vErrors.push(err177);
          }
          errors++;
        }
        if (data61.actual_page === undefined) {
          const err178 = {
            instancePath: instancePath + "/last_navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "actual_page" },
            message: "must have required property '" + "actual_page" + "'",
          };
          if (vErrors === null) {
            vErrors = [err178];
          } else {
            vErrors.push(err178);
          }
          errors++;
        }
        if (data61.page_correct === undefined) {
          const err179 = {
            instancePath: instancePath + "/last_navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "page_correct" },
            message: "must have required property '" + "page_correct" + "'",
          };
          if (vErrors === null) {
            vErrors = [err179];
          } else {
            vErrors.push(err179);
          }
          errors++;
        }
        if (data61.current_page_capabilities === undefined) {
          const err180 = {
            instancePath: instancePath + "/last_navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "current_page_capabilities" },
            message: "must have required property '" + "current_page_capabilities" + "'",
          };
          if (vErrors === null) {
            vErrors = [err180];
          } else {
            vErrors.push(err180);
          }
          errors++;
        }
        if (data61.current_run_id === undefined) {
          const err181 = {
            instancePath: instancePath + "/last_navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "current_run_id" },
            message: "must have required property '" + "current_run_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err181];
          } else {
            vErrors.push(err181);
          }
          errors++;
        }
        if (data61.current_context_revision === undefined) {
          const err182 = {
            instancePath: instancePath + "/last_navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "current_context_revision" },
            message: "must have required property '" + "current_context_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err182];
          } else {
            vErrors.push(err182);
          }
          errors++;
        }
        if (data61.failure_type === undefined) {
          const err183 = {
            instancePath: instancePath + "/last_navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "failure_type" },
            message: "must have required property '" + "failure_type" + "'",
          };
          if (vErrors === null) {
            vErrors = [err183];
          } else {
            vErrors.push(err183);
          }
          errors++;
        }
        if (data61.retry_allowed === undefined) {
          const err184 = {
            instancePath: instancePath + "/last_navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "retry_allowed" },
            message: "must have required property '" + "retry_allowed" + "'",
          };
          if (vErrors === null) {
            vErrors = [err184];
          } else {
            vErrors.push(err184);
          }
          errors++;
        }
        if (data61.visited_pages === undefined) {
          const err185 = {
            instancePath: instancePath + "/last_navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "visited_pages" },
            message: "must have required property '" + "visited_pages" + "'",
          };
          if (vErrors === null) {
            vErrors = [err185];
          } else {
            vErrors.push(err185);
          }
          errors++;
        }
        if (data61.navigation_attempts === undefined) {
          const err186 = {
            instancePath: instancePath + "/last_navigation_observation",
            schemaPath: "navigation-observation.schema.json/required",
            keyword: "required",
            params: { missingProperty: "navigation_attempts" },
            message: "must have required property '" + "navigation_attempts" + "'",
          };
          if (vErrors === null) {
            vErrors = [err186];
          } else {
            vErrors.push(err186);
          }
          errors++;
        }
        for (const key6 in data61) {
          if (!func1.call(schema34.properties, key6)) {
            const err187 = {
              instancePath: instancePath + "/last_navigation_observation",
              schemaPath: "navigation-observation.schema.json/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key6 },
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
        if (data61.target_page !== undefined) {
          let data62 = data61.target_page;
          if (typeof data62 === "string") {
            if (func2(data62) > 128) {
              const err188 = {
                instancePath: instancePath + "/last_navigation_observation/target_page",
                schemaPath: "navigation-observation.schema.json/properties/target_page/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err188];
              } else {
                vErrors.push(err188);
              }
              errors++;
            }
            if (func2(data62) < 1) {
              const err189 = {
                instancePath: instancePath + "/last_navigation_observation/target_page",
                schemaPath: "navigation-observation.schema.json/properties/target_page/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err189];
              } else {
                vErrors.push(err189);
              }
              errors++;
            }
          } else {
            const err190 = {
              instancePath: instancePath + "/last_navigation_observation/target_page",
              schemaPath: "navigation-observation.schema.json/properties/target_page/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err190];
            } else {
              vErrors.push(err190);
            }
            errors++;
          }
        }
        if (data61.actual_page !== undefined) {
          let data63 = data61.actual_page;
          if (typeof data63 !== "string" && data63 !== null) {
            const err191 = {
              instancePath: instancePath + "/last_navigation_observation/actual_page",
              schemaPath: "navigation-observation.schema.json/properties/actual_page/type",
              keyword: "type",
              params: { type: schema34.properties.actual_page.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err191];
            } else {
              vErrors.push(err191);
            }
            errors++;
          }
          if (typeof data63 === "string") {
            if (func2(data63) > 128) {
              const err192 = {
                instancePath: instancePath + "/last_navigation_observation/actual_page",
                schemaPath: "navigation-observation.schema.json/properties/actual_page/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err192];
              } else {
                vErrors.push(err192);
              }
              errors++;
            }
          }
        }
        if (data61.page_correct !== undefined) {
          if (typeof data61.page_correct !== "boolean") {
            const err193 = {
              instancePath: instancePath + "/last_navigation_observation/page_correct",
              schemaPath: "navigation-observation.schema.json/properties/page_correct/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err193];
            } else {
              vErrors.push(err193);
            }
            errors++;
          }
        }
        if (data61.current_page_capabilities !== undefined) {
          let data65 = data61.current_page_capabilities;
          if (Array.isArray(data65)) {
            if (data65.length > 32) {
              const err194 = {
                instancePath: instancePath + "/last_navigation_observation/current_page_capabilities",
                schemaPath: "navigation-observation.schema.json/properties/current_page_capabilities/maxItems",
                keyword: "maxItems",
                params: { limit: 32 },
                message: "must NOT have more than 32 items",
              };
              if (vErrors === null) {
                vErrors = [err194];
              } else {
                vErrors.push(err194);
              }
              errors++;
            }
            const len6 = data65.length;
            for (let i11 = 0; i11 < len6; i11++) {
              let data66 = data65[i11];
              if (typeof data66 === "string") {
                if (func2(data66) > 128) {
                  const err195 = {
                    instancePath: instancePath + "/last_navigation_observation/current_page_capabilities/" + i11,
                    schemaPath:
                      "navigation-observation.schema.json/properties/current_page_capabilities/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 128 },
                    message: "must NOT have more than 128 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err195];
                  } else {
                    vErrors.push(err195);
                  }
                  errors++;
                }
                if (func2(data66) < 1) {
                  const err196 = {
                    instancePath: instancePath + "/last_navigation_observation/current_page_capabilities/" + i11,
                    schemaPath:
                      "navigation-observation.schema.json/properties/current_page_capabilities/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err196];
                  } else {
                    vErrors.push(err196);
                  }
                  errors++;
                }
              } else {
                const err197 = {
                  instancePath: instancePath + "/last_navigation_observation/current_page_capabilities/" + i11,
                  schemaPath: "navigation-observation.schema.json/properties/current_page_capabilities/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err197];
                } else {
                  vErrors.push(err197);
                }
                errors++;
              }
            }
            let i12 = data65.length;
            let j5;
            if (i12 > 1) {
              const indices5 = {};
              for (; i12--;) {
                let item5 = data65[i12];
                if (typeof item5 !== "string") {
                  continue;
                }
                if (typeof indices5[item5] == "number") {
                  j5 = indices5[item5];
                  const err198 = {
                    instancePath: instancePath + "/last_navigation_observation/current_page_capabilities",
                    schemaPath: "navigation-observation.schema.json/properties/current_page_capabilities/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i12, j: j5 },
                    message: "must NOT have duplicate items (items ## " + j5 + " and " + i12 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err198];
                  } else {
                    vErrors.push(err198);
                  }
                  errors++;
                  break;
                }
                indices5[item5] = i12;
              }
            }
          } else {
            const err199 = {
              instancePath: instancePath + "/last_navigation_observation/current_page_capabilities",
              schemaPath: "navigation-observation.schema.json/properties/current_page_capabilities/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err199];
            } else {
              vErrors.push(err199);
            }
            errors++;
          }
        }
        if (data61.current_run_id !== undefined) {
          let data67 = data61.current_run_id;
          if (typeof data67 !== "string" && data67 !== null) {
            const err200 = {
              instancePath: instancePath + "/last_navigation_observation/current_run_id",
              schemaPath: "navigation-observation.schema.json/properties/current_run_id/type",
              keyword: "type",
              params: { type: schema34.properties.current_run_id.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err200];
            } else {
              vErrors.push(err200);
            }
            errors++;
          }
          if (typeof data67 === "string") {
            if (func2(data67) > 128) {
              const err201 = {
                instancePath: instancePath + "/last_navigation_observation/current_run_id",
                schemaPath: "navigation-observation.schema.json/properties/current_run_id/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err201];
              } else {
                vErrors.push(err201);
              }
              errors++;
            }
          }
        }
        if (data61.current_context_revision !== undefined) {
          let data68 = data61.current_context_revision;
          if (typeof data68 !== "string" && data68 !== null) {
            const err202 = {
              instancePath: instancePath + "/last_navigation_observation/current_context_revision",
              schemaPath: "navigation-observation.schema.json/properties/current_context_revision/type",
              keyword: "type",
              params: { type: schema34.properties.current_context_revision.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err202];
            } else {
              vErrors.push(err202);
            }
            errors++;
          }
          if (typeof data68 === "string") {
            if (func2(data68) > 256) {
              const err203 = {
                instancePath: instancePath + "/last_navigation_observation/current_context_revision",
                schemaPath: "navigation-observation.schema.json/properties/current_context_revision/maxLength",
                keyword: "maxLength",
                params: { limit: 256 },
                message: "must NOT have more than 256 characters",
              };
              if (vErrors === null) {
                vErrors = [err203];
              } else {
                vErrors.push(err203);
              }
              errors++;
            }
          }
        }
        if (data61.failure_type !== undefined) {
          let data69 = data61.failure_type;
          if (!(
            data69 === "navigation_error" ||
            data69 === "context_unavailable" ||
            data69 === "context_invalid" ||
            data69 === "page_mismatch" ||
            data69 === "capability_missing" ||
            data69 === "stale_identity" ||
            data69 === null
          )) {
            const err204 = {
              instancePath: instancePath + "/last_navigation_observation/failure_type",
              schemaPath: "navigation-observation.schema.json/properties/failure_type/enum",
              keyword: "enum",
              params: { allowedValues: schema34.properties.failure_type.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err204];
            } else {
              vErrors.push(err204);
            }
            errors++;
          }
        }
        if (data61.retry_allowed !== undefined) {
          if (typeof data61.retry_allowed !== "boolean") {
            const err205 = {
              instancePath: instancePath + "/last_navigation_observation/retry_allowed",
              schemaPath: "navigation-observation.schema.json/properties/retry_allowed/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err205];
            } else {
              vErrors.push(err205);
            }
            errors++;
          }
        }
        if (data61.visited_pages !== undefined) {
          let data71 = data61.visited_pages;
          if (Array.isArray(data71)) {
            if (data71.length > 8) {
              const err206 = {
                instancePath: instancePath + "/last_navigation_observation/visited_pages",
                schemaPath: "navigation-observation.schema.json/properties/visited_pages/maxItems",
                keyword: "maxItems",
                params: { limit: 8 },
                message: "must NOT have more than 8 items",
              };
              if (vErrors === null) {
                vErrors = [err206];
              } else {
                vErrors.push(err206);
              }
              errors++;
            }
            const len7 = data71.length;
            for (let i13 = 0; i13 < len7; i13++) {
              let data72 = data71[i13];
              if (typeof data72 === "string") {
                if (func2(data72) > 128) {
                  const err207 = {
                    instancePath: instancePath + "/last_navigation_observation/visited_pages/" + i13,
                    schemaPath: "navigation-observation.schema.json/properties/visited_pages/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 128 },
                    message: "must NOT have more than 128 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err207];
                  } else {
                    vErrors.push(err207);
                  }
                  errors++;
                }
                if (func2(data72) < 1) {
                  const err208 = {
                    instancePath: instancePath + "/last_navigation_observation/visited_pages/" + i13,
                    schemaPath: "navigation-observation.schema.json/properties/visited_pages/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err208];
                  } else {
                    vErrors.push(err208);
                  }
                  errors++;
                }
              } else {
                const err209 = {
                  instancePath: instancePath + "/last_navigation_observation/visited_pages/" + i13,
                  schemaPath: "navigation-observation.schema.json/properties/visited_pages/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err209];
                } else {
                  vErrors.push(err209);
                }
                errors++;
              }
            }
            let i14 = data71.length;
            let j6;
            if (i14 > 1) {
              const indices6 = {};
              for (; i14--;) {
                let item6 = data71[i14];
                if (typeof item6 !== "string") {
                  continue;
                }
                if (typeof indices6[item6] == "number") {
                  j6 = indices6[item6];
                  const err210 = {
                    instancePath: instancePath + "/last_navigation_observation/visited_pages",
                    schemaPath: "navigation-observation.schema.json/properties/visited_pages/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i14, j: j6 },
                    message: "must NOT have duplicate items (items ## " + j6 + " and " + i14 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err210];
                  } else {
                    vErrors.push(err210);
                  }
                  errors++;
                  break;
                }
                indices6[item6] = i14;
              }
            }
          } else {
            const err211 = {
              instancePath: instancePath + "/last_navigation_observation/visited_pages",
              schemaPath: "navigation-observation.schema.json/properties/visited_pages/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err211];
            } else {
              vErrors.push(err211);
            }
            errors++;
          }
        }
        if (data61.navigation_attempts !== undefined) {
          let data73 = data61.navigation_attempts;
          if (!(typeof data73 == "number" && !(data73 % 1) && !isNaN(data73))) {
            const err212 = {
              instancePath: instancePath + "/last_navigation_observation/navigation_attempts",
              schemaPath: "navigation-observation.schema.json/properties/navigation_attempts/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err212];
            } else {
              vErrors.push(err212);
            }
            errors++;
          }
          if (typeof data73 == "number") {
            if (data73 > 8 || isNaN(data73)) {
              const err213 = {
                instancePath: instancePath + "/last_navigation_observation/navigation_attempts",
                schemaPath: "navigation-observation.schema.json/properties/navigation_attempts/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 8 },
                message: "must be <= 8",
              };
              if (vErrors === null) {
                vErrors = [err213];
              } else {
                vErrors.push(err213);
              }
              errors++;
            }
            if (data73 < 0 || isNaN(data73)) {
              const err214 = {
                instancePath: instancePath + "/last_navigation_observation/navigation_attempts",
                schemaPath: "navigation-observation.schema.json/properties/navigation_attempts/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err214];
              } else {
                vErrors.push(err214);
              }
              errors++;
            }
          }
        }
      } else {
        const err215 = {
          instancePath: instancePath + "/last_navigation_observation",
          schemaPath: "navigation-observation.schema.json/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err215];
        } else {
          vErrors.push(err215);
        }
        errors++;
      }
      var _valid0 = _errs129 === errors;
      valid24 = valid24 || _valid0;
      const _errs156 = errors;
      if (data61 !== null) {
        const err216 = {
          instancePath: instancePath + "/last_navigation_observation",
          schemaPath: "#/properties/last_navigation_observation/anyOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err216];
        } else {
          vErrors.push(err216);
        }
        errors++;
      }
      var _valid0 = _errs156 === errors;
      valid24 = valid24 || _valid0;
      if (!valid24) {
        const err217 = {
          instancePath: instancePath + "/last_navigation_observation",
          schemaPath: "#/properties/last_navigation_observation/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err217];
        } else {
          vErrors.push(err217);
        }
        errors++;
      } else {
        errors = _errs128;
        if (vErrors !== null) {
          if (_errs128) {
            vErrors.length = _errs128;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.navigation_target !== undefined) {
      let data74 = data.navigation_target;
      if (typeof data74 !== "string" && data74 !== null) {
        const err218 = {
          instancePath: instancePath + "/navigation_target",
          schemaPath: "#/properties/navigation_target/type",
          keyword: "type",
          params: { type: schema37.properties.navigation_target.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err218];
        } else {
          vErrors.push(err218);
        }
        errors++;
      }
      if (typeof data74 === "string") {
        if (func2(data74) > 128) {
          const err219 = {
            instancePath: instancePath + "/navigation_target",
            schemaPath: "#/properties/navigation_target/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err219];
          } else {
            vErrors.push(err219);
          }
          errors++;
        }
      }
    }
  } else {
    const err220 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err220];
    } else {
      vErrors.push(err220);
    }
    errors++;
  }
  validate24.errors = vErrors;
  return errors === 0;
}
validate24.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const agentFlowEvent = validate26;
const schema40 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.event.v1",
  title: "AgentFlowEvent",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "contract_revision",
    "event_id",
    "sequence",
    "flow_id",
    "session_id",
    "node",
    "event_type",
    "state",
    "binding",
    "pending_action",
    "payload",
    "created_at",
  ],
  properties: {
    schema_identity: { const: "tilesim.agent_flow.event.v1" },
    contract_revision: { const: "2026-10-28.flow.v2" },
    event_id: { type: "string", minLength: 1, maxLength: 256 },
    sequence: { type: "integer", minimum: 1 },
    flow_id: { type: "string", minLength: 1, maxLength: 128 },
    session_id: { type: "string", minLength: 1, maxLength: 128 },
    node: { type: "string", minLength: 1, maxLength: 128 },
    event_type: {
      enum: [
        "flow_started",
        "node_started",
        "node_completed",
        "interrupt",
        "approval_required",
        "state_changed",
        "terminal",
        "error",
      ],
    },
    state: { $ref: "state.schema.json" },
    binding: { $ref: "identity-binding.schema.json" },
    pending_action: { enum: ["clarify_intent", "confirm_report", "confirm_draft", "confirm_navigation", null] },
    payload: { type: "object", additionalProperties: true },
    created_at: { type: "string", format: "date-time" },
  },
};
function validate26(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_flow.event.v1" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate26.evaluated;
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
    if (data.contract_revision === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "contract_revision" },
        message: "must have required property '" + "contract_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.event_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "event_id" },
        message: "must have required property '" + "event_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.sequence === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "sequence" },
        message: "must have required property '" + "sequence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.flow_id === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "flow_id" },
        message: "must have required property '" + "flow_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.session_id === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "session_id" },
        message: "must have required property '" + "session_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.node === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "node" },
        message: "must have required property '" + "node" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.event_type === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "event_type" },
        message: "must have required property '" + "event_type" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.state === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "state" },
        message: "must have required property '" + "state" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.binding === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "binding" },
        message: "must have required property '" + "binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.pending_action === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "pending_action" },
        message: "must have required property '" + "pending_action" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.payload === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "payload" },
        message: "must have required property '" + "payload" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.created_at === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "created_at" },
        message: "must have required property '" + "created_at" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema40.properties, key0)) {
        const err13 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.schema_identity !== undefined) {
      if ("tilesim.agent_flow.event.v1" !== data.schema_identity) {
        const err14 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.agent_flow.event.v1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.contract_revision !== undefined) {
      if ("2026-10-28.flow.v2" !== data.contract_revision) {
        const err15 = {
          instancePath: instancePath + "/contract_revision",
          schemaPath: "#/properties/contract_revision/const",
          keyword: "const",
          params: { allowedValue: "2026-10-28.flow.v2" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.event_id !== undefined) {
      let data2 = data.event_id;
      if (typeof data2 === "string") {
        if (func2(data2) > 256) {
          const err16 = {
            instancePath: instancePath + "/event_id",
            schemaPath: "#/properties/event_id/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err17 = {
            instancePath: instancePath + "/event_id",
            schemaPath: "#/properties/event_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
          instancePath: instancePath + "/event_id",
          schemaPath: "#/properties/event_id/type",
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
    if (data.sequence !== undefined) {
      let data3 = data.sequence;
      if (!(typeof data3 == "number" && !(data3 % 1) && !isNaN(data3))) {
        const err19 = {
          instancePath: instancePath + "/sequence",
          schemaPath: "#/properties/sequence/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
      if (typeof data3 == "number") {
        if (data3 < 1 || isNaN(data3)) {
          const err20 = {
            instancePath: instancePath + "/sequence",
            schemaPath: "#/properties/sequence/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 1 },
            message: "must be >= 1",
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      }
    }
    if (data.flow_id !== undefined) {
      let data4 = data.flow_id;
      if (typeof data4 === "string") {
        if (func2(data4) > 128) {
          const err21 = {
            instancePath: instancePath + "/flow_id",
            schemaPath: "#/properties/flow_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (func2(data4) < 1) {
          const err22 = {
            instancePath: instancePath + "/flow_id",
            schemaPath: "#/properties/flow_id/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
          instancePath: instancePath + "/flow_id",
          schemaPath: "#/properties/flow_id/type",
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
    if (data.session_id !== undefined) {
      let data5 = data.session_id;
      if (typeof data5 === "string") {
        if (func2(data5) > 128) {
          const err24 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (func2(data5) < 1) {
          const err25 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/minLength",
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
          instancePath: instancePath + "/session_id",
          schemaPath: "#/properties/session_id/type",
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
    if (data.node !== undefined) {
      let data6 = data.node;
      if (typeof data6 === "string") {
        if (func2(data6) > 128) {
          const err27 = {
            instancePath: instancePath + "/node",
            schemaPath: "#/properties/node/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
        if (func2(data6) < 1) {
          const err28 = {
            instancePath: instancePath + "/node",
            schemaPath: "#/properties/node/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
          instancePath: instancePath + "/node",
          schemaPath: "#/properties/node/type",
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
    if (data.event_type !== undefined) {
      let data7 = data.event_type;
      if (!(
        data7 === "flow_started" ||
        data7 === "node_started" ||
        data7 === "node_completed" ||
        data7 === "interrupt" ||
        data7 === "approval_required" ||
        data7 === "state_changed" ||
        data7 === "terminal" ||
        data7 === "error"
      )) {
        const err30 = {
          instancePath: instancePath + "/event_type",
          schemaPath: "#/properties/event_type/enum",
          keyword: "enum",
          params: { allowedValues: schema40.properties.event_type.enum },
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
    if (data.state !== undefined) {
      if (
        !validate24(data.state, {
          instancePath: instancePath + "/state",
          parentData: data,
          parentDataProperty: "state",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
        errors = vErrors.length;
      }
    }
    if (data.binding !== undefined) {
      if (
        !validate22(data.binding, {
          instancePath: instancePath + "/binding",
          parentData: data,
          parentDataProperty: "binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
        errors = vErrors.length;
      }
    }
    if (data.pending_action !== undefined) {
      let data10 = data.pending_action;
      if (!(
        data10 === "clarify_intent" ||
        data10 === "confirm_report" ||
        data10 === "confirm_draft" ||
        data10 === "confirm_navigation" ||
        data10 === null
      )) {
        const err31 = {
          instancePath: instancePath + "/pending_action",
          schemaPath: "#/properties/pending_action/enum",
          keyword: "enum",
          params: { allowedValues: schema40.properties.pending_action.enum },
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
    if (data.payload !== undefined) {
      let data11 = data.payload;
      if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
      } else {
        const err32 = {
          instancePath: instancePath + "/payload",
          schemaPath: "#/properties/payload/type",
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
    if (data.created_at !== undefined) {
      if (!(typeof data.created_at === "string")) {
        const err33 = {
          instancePath: instancePath + "/created_at",
          schemaPath: "#/properties/created_at/type",
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
  } else {
    const err34 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err34];
    } else {
      vErrors.push(err34);
    }
    errors++;
  }
  validate26.errors = vErrors;
  return errors === 0;
}
validate26.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const agentFlowStartResponse = validate29;
const schema41 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.start_response.v1",
  title: "AgentFlowStartResponse",
  type: "object",
  additionalProperties: false,
  required: ["flow", "idempotent_replay"],
  properties: { flow: { $ref: "state.schema.json" }, idempotent_replay: { type: "boolean" } },
};
function validate29(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_flow.start_response.v1" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate29.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.flow === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "flow" },
        message: "must have required property '" + "flow" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.idempotent_replay === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "idempotent_replay" },
        message: "must have required property '" + "idempotent_replay" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "flow" || key0 === "idempotent_replay")) {
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
    if (data.flow !== undefined) {
      if (
        !validate24(data.flow, {
          instancePath: instancePath + "/flow",
          parentData: data,
          parentDataProperty: "flow",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
        errors = vErrors.length;
      }
    }
    if (data.idempotent_replay !== undefined) {
      if (typeof data.idempotent_replay !== "boolean") {
        const err3 = {
          instancePath: instancePath + "/idempotent_replay",
          schemaPath: "#/properties/idempotent_replay/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
  } else {
    const err4 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  validate29.errors = vErrors;
  return errors === 0;
}
validate29.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const agentFlowStatusResponse = validate31;
const schema42 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.status_response.v1",
  title: "AgentFlowStatusResponse",
  type: "object",
  additionalProperties: false,
  required: ["flow"],
  properties: { flow: { $ref: "state.schema.json" } },
};
function validate31(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_flow.status_response.v1" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate31.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.flow === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "flow" },
        message: "must have required property '" + "flow" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "flow")) {
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
    if (data.flow !== undefined) {
      if (
        !validate24(data.flow, {
          instancePath: instancePath + "/flow",
          parentData: data,
          parentDataProperty: "flow",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err2 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  validate31.errors = vErrors;
  return errors === 0;
}
validate31.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const agentFlowEventsResponse = validate33;
const schema43 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.events_response.v1",
  title: "AgentFlowEventsResponse",
  type: "object",
  additionalProperties: false,
  required: ["flow", "events", "after_sequence", "terminal"],
  properties: {
    flow: { $ref: "state.schema.json" },
    events: { type: "array", items: { $ref: "event.schema.json" } },
    after_sequence: { type: "integer", minimum: 0 },
    terminal: { type: "boolean" },
  },
};
function validate33(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_flow.events_response.v1" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate33.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.flow === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "flow" },
        message: "must have required property '" + "flow" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.events === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "events" },
        message: "must have required property '" + "events" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.after_sequence === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "after_sequence" },
        message: "must have required property '" + "after_sequence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.terminal === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "terminal" },
        message: "must have required property '" + "terminal" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "flow" || key0 === "events" || key0 === "after_sequence" || key0 === "terminal")) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.flow !== undefined) {
      if (
        !validate24(data.flow, {
          instancePath: instancePath + "/flow",
          parentData: data,
          parentDataProperty: "flow",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
        errors = vErrors.length;
      }
    }
    if (data.events !== undefined) {
      let data1 = data.events;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate26(data1[i0], {
              instancePath: instancePath + "/events/" + i0,
              parentData: data1,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/events",
          schemaPath: "#/properties/events/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.after_sequence !== undefined) {
      let data3 = data.after_sequence;
      if (!(typeof data3 == "number" && !(data3 % 1) && !isNaN(data3))) {
        const err6 = {
          instancePath: instancePath + "/after_sequence",
          schemaPath: "#/properties/after_sequence/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
      if (typeof data3 == "number") {
        if (data3 < 0 || isNaN(data3)) {
          const err7 = {
            instancePath: instancePath + "/after_sequence",
            schemaPath: "#/properties/after_sequence/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      }
    }
    if (data.terminal !== undefined) {
      if (typeof data.terminal !== "boolean") {
        const err8 = {
          instancePath: instancePath + "/terminal",
          schemaPath: "#/properties/terminal/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate33.errors = vErrors;
  return errors === 0;
}
validate33.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const agentFlowResumeResponse = validate36;
const schema44 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.resume_response.v1",
  title: "AgentFlowResumeResponse",
  type: "object",
  additionalProperties: false,
  required: ["flow", "events", "idempotent_replay", "action"],
  properties: {
    flow: { $ref: "state.schema.json" },
    events: { type: "array", items: { $ref: "event.schema.json" } },
    idempotent_replay: { type: "boolean" },
    action: { type: "string", minLength: 1, maxLength: 64 },
  },
};
function validate36(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_flow.resume_response.v1" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate36.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.flow === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "flow" },
        message: "must have required property '" + "flow" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.events === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "events" },
        message: "must have required property '" + "events" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.idempotent_replay === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "idempotent_replay" },
        message: "must have required property '" + "idempotent_replay" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.action === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "action" },
        message: "must have required property '" + "action" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "flow" || key0 === "events" || key0 === "idempotent_replay" || key0 === "action")) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.flow !== undefined) {
      if (
        !validate24(data.flow, {
          instancePath: instancePath + "/flow",
          parentData: data,
          parentDataProperty: "flow",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
        errors = vErrors.length;
      }
    }
    if (data.events !== undefined) {
      let data1 = data.events;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate26(data1[i0], {
              instancePath: instancePath + "/events/" + i0,
              parentData: data1,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/events",
          schemaPath: "#/properties/events/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.idempotent_replay !== undefined) {
      if (typeof data.idempotent_replay !== "boolean") {
        const err6 = {
          instancePath: instancePath + "/idempotent_replay",
          schemaPath: "#/properties/idempotent_replay/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.action !== undefined) {
      let data4 = data.action;
      if (typeof data4 === "string") {
        if (func2(data4) > 64) {
          const err7 = {
            instancePath: instancePath + "/action",
            schemaPath: "#/properties/action/maxLength",
            keyword: "maxLength",
            params: { limit: 64 },
            message: "must NOT have more than 64 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (func2(data4) < 1) {
          const err8 = {
            instancePath: instancePath + "/action",
            schemaPath: "#/properties/action/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
          instancePath: instancePath + "/action",
          schemaPath: "#/properties/action/type",
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
  } else {
    const err10 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  validate36.errors = vErrors;
  return errors === 0;
}
validate36.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const agentFlowRevokeRequest = validate39;
const schema45 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.revoke_request.v1",
  title: "AgentFlowAuthorizationRevokeRequest",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "contract_revision",
    "flow_id",
    "session_id",
    "current_binding",
    "current_event_sequence",
    "authorization_id",
    "authorization_digest",
    "authorization_budget",
  ],
  properties: {
    schema_identity: { const: "tilesim.agent_flow.revoke_request.v1" },
    contract_revision: { const: "2026-10-28.flow.v2" },
    flow_id: { type: "string", pattern: "^flow-[A-Za-z0-9]+$", maxLength: 128 },
    session_id: { type: "string", minLength: 1, maxLength: 128 },
    current_binding: { $ref: "identity-binding.schema.json" },
    current_event_sequence: { type: "integer", minimum: 0 },
    authorization_id: { type: "string", pattern: "^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" },
    authorization_digest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    authorization_budget: { $ref: "start-request.schema.json#/properties/authorization_budget" },
    principal: { type: "string", minLength: 1, maxLength: 128 },
    workspace_id: { type: "string", minLength: 1, maxLength: 128 },
  },
};
const pattern18 = new RegExp("^flow-[A-Za-z0-9]+$", "u");
function validate39(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_flow.revoke_request.v1" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate39.evaluated;
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
    if (data.contract_revision === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "contract_revision" },
        message: "must have required property '" + "contract_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.flow_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "flow_id" },
        message: "must have required property '" + "flow_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.session_id === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "session_id" },
        message: "must have required property '" + "session_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.current_binding === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "current_binding" },
        message: "must have required property '" + "current_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.current_event_sequence === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "current_event_sequence" },
        message: "must have required property '" + "current_event_sequence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.authorization_id === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "authorization_id" },
        message: "must have required property '" + "authorization_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.authorization_digest === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "authorization_digest" },
        message: "must have required property '" + "authorization_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.authorization_budget === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "authorization_budget" },
        message: "must have required property '" + "authorization_budget" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema45.properties, key0)) {
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
      if ("tilesim.agent_flow.revoke_request.v1" !== data.schema_identity) {
        const err10 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.agent_flow.revoke_request.v1" },
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
    if (data.contract_revision !== undefined) {
      if ("2026-10-28.flow.v2" !== data.contract_revision) {
        const err11 = {
          instancePath: instancePath + "/contract_revision",
          schemaPath: "#/properties/contract_revision/const",
          keyword: "const",
          params: { allowedValue: "2026-10-28.flow.v2" },
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
    if (data.flow_id !== undefined) {
      let data2 = data.flow_id;
      if (typeof data2 === "string") {
        if (func2(data2) > 128) {
          const err12 = {
            instancePath: instancePath + "/flow_id",
            schemaPath: "#/properties/flow_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        if (!pattern18.test(data2)) {
          const err13 = {
            instancePath: instancePath + "/flow_id",
            schemaPath: "#/properties/flow_id/pattern",
            keyword: "pattern",
            params: { pattern: "^flow-[A-Za-z0-9]+$" },
            message: 'must match pattern "' + "^flow-[A-Za-z0-9]+$" + '"',
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
          instancePath: instancePath + "/flow_id",
          schemaPath: "#/properties/flow_id/type",
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
    if (data.session_id !== undefined) {
      let data3 = data.session_id;
      if (typeof data3 === "string") {
        if (func2(data3) > 128) {
          const err15 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err16 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/minLength",
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
          instancePath: instancePath + "/session_id",
          schemaPath: "#/properties/session_id/type",
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
    if (data.current_binding !== undefined) {
      if (
        !validate22(data.current_binding, {
          instancePath: instancePath + "/current_binding",
          parentData: data,
          parentDataProperty: "current_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
        errors = vErrors.length;
      }
    }
    if (data.current_event_sequence !== undefined) {
      let data5 = data.current_event_sequence;
      if (!(typeof data5 == "number" && !(data5 % 1) && !isNaN(data5))) {
        const err18 = {
          instancePath: instancePath + "/current_event_sequence",
          schemaPath: "#/properties/current_event_sequence/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
      if (typeof data5 == "number") {
        if (data5 < 0 || isNaN(data5)) {
          const err19 = {
            instancePath: instancePath + "/current_event_sequence",
            schemaPath: "#/properties/current_event_sequence/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      }
    }
    if (data.authorization_id !== undefined) {
      let data6 = data.authorization_id;
      if (typeof data6 === "string") {
        if (!pattern8.test(data6)) {
          const err20 = {
            instancePath: instancePath + "/authorization_id",
            schemaPath: "#/properties/authorization_id/pattern",
            keyword: "pattern",
            params: { pattern: "^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" },
            message: 'must match pattern "' + "^authz-[A-Za-z0-9][A-Za-z0-9._-]{0,127}$" + '"',
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
          instancePath: instancePath + "/authorization_id",
          schemaPath: "#/properties/authorization_id/type",
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
    if (data.authorization_digest !== undefined) {
      let data7 = data.authorization_digest;
      if (typeof data7 === "string") {
        if (!pattern4.test(data7)) {
          const err22 = {
            instancePath: instancePath + "/authorization_digest",
            schemaPath: "#/properties/authorization_digest/pattern",
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
          instancePath: instancePath + "/authorization_digest",
          schemaPath: "#/properties/authorization_digest/type",
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
    if (data.authorization_budget !== undefined) {
      let data8 = data.authorization_budget;
      if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
        if (data8.max_navigation_attempts === undefined) {
          const err24 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "start-request.schema.json#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_navigation_attempts" },
            message: "must have required property '" + "max_navigation_attempts" + "'",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (data8.max_model_calls === undefined) {
          const err25 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "start-request.schema.json#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_model_calls" },
            message: "must have required property '" + "max_model_calls" + "'",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (data8.max_tool_calls_per_round === undefined) {
          const err26 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "start-request.schema.json#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_tool_calls_per_round" },
            message: "must have required property '" + "max_tool_calls_per_round" + "'",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        if (data8.max_run_creations === undefined) {
          const err27 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "start-request.schema.json#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_run_creations" },
            message: "must have required property '" + "max_run_creations" + "'",
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
        if (data8.max_execution_time_ms === undefined) {
          const err28 = {
            instancePath: instancePath + "/authorization_budget",
            schemaPath: "start-request.schema.json#/properties/authorization_budget/required",
            keyword: "required",
            params: { missingProperty: "max_execution_time_ms" },
            message: "must have required property '" + "max_execution_time_ms" + "'",
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
        for (const key1 in data8) {
          if (!(
            key1 === "max_navigation_attempts" ||
            key1 === "max_model_calls" ||
            key1 === "max_tool_calls_per_round" ||
            key1 === "max_run_creations" ||
            key1 === "max_execution_time_ms"
          )) {
            const err29 = {
              instancePath: instancePath + "/authorization_budget",
              schemaPath: "start-request.schema.json#/properties/authorization_budget/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err29];
            } else {
              vErrors.push(err29);
            }
            errors++;
          }
        }
        if (data8.max_navigation_attempts !== undefined) {
          let data9 = data8.max_navigation_attempts;
          if (!(typeof data9 == "number" && !(data9 % 1) && !isNaN(data9))) {
            const err30 = {
              instancePath: instancePath + "/authorization_budget/max_navigation_attempts",
              schemaPath:
                "start-request.schema.json#/properties/authorization_budget/properties/max_navigation_attempts/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err30];
            } else {
              vErrors.push(err30);
            }
            errors++;
          }
          if (typeof data9 == "number") {
            if (data9 > 8 || isNaN(data9)) {
              const err31 = {
                instancePath: instancePath + "/authorization_budget/max_navigation_attempts",
                schemaPath:
                  "start-request.schema.json#/properties/authorization_budget/properties/max_navigation_attempts/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 8 },
                message: "must be <= 8",
              };
              if (vErrors === null) {
                vErrors = [err31];
              } else {
                vErrors.push(err31);
              }
              errors++;
            }
            if (data9 < 1 || isNaN(data9)) {
              const err32 = {
                instancePath: instancePath + "/authorization_budget/max_navigation_attempts",
                schemaPath:
                  "start-request.schema.json#/properties/authorization_budget/properties/max_navigation_attempts/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err32];
              } else {
                vErrors.push(err32);
              }
              errors++;
            }
          }
        }
        if (data8.max_model_calls !== undefined) {
          let data10 = data8.max_model_calls;
          if (!(typeof data10 == "number" && !(data10 % 1) && !isNaN(data10))) {
            const err33 = {
              instancePath: instancePath + "/authorization_budget/max_model_calls",
              schemaPath: "start-request.schema.json#/properties/authorization_budget/properties/max_model_calls/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
          if (typeof data10 == "number") {
            if (data10 > 60 || isNaN(data10)) {
              const err34 = {
                instancePath: instancePath + "/authorization_budget/max_model_calls",
                schemaPath:
                  "start-request.schema.json#/properties/authorization_budget/properties/max_model_calls/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 60 },
                message: "must be <= 60",
              };
              if (vErrors === null) {
                vErrors = [err34];
              } else {
                vErrors.push(err34);
              }
              errors++;
            }
            if (data10 < 1 || isNaN(data10)) {
              const err35 = {
                instancePath: instancePath + "/authorization_budget/max_model_calls",
                schemaPath:
                  "start-request.schema.json#/properties/authorization_budget/properties/max_model_calls/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors++;
            }
          }
        }
        if (data8.max_tool_calls_per_round !== undefined) {
          let data11 = data8.max_tool_calls_per_round;
          if (!(typeof data11 == "number" && !(data11 % 1) && !isNaN(data11))) {
            const err36 = {
              instancePath: instancePath + "/authorization_budget/max_tool_calls_per_round",
              schemaPath:
                "start-request.schema.json#/properties/authorization_budget/properties/max_tool_calls_per_round/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err36];
            } else {
              vErrors.push(err36);
            }
            errors++;
          }
          if (typeof data11 == "number") {
            if (data11 > 4 || isNaN(data11)) {
              const err37 = {
                instancePath: instancePath + "/authorization_budget/max_tool_calls_per_round",
                schemaPath:
                  "start-request.schema.json#/properties/authorization_budget/properties/max_tool_calls_per_round/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 4 },
                message: "must be <= 4",
              };
              if (vErrors === null) {
                vErrors = [err37];
              } else {
                vErrors.push(err37);
              }
              errors++;
            }
            if (data11 < 1 || isNaN(data11)) {
              const err38 = {
                instancePath: instancePath + "/authorization_budget/max_tool_calls_per_round",
                schemaPath:
                  "start-request.schema.json#/properties/authorization_budget/properties/max_tool_calls_per_round/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err38];
              } else {
                vErrors.push(err38);
              }
              errors++;
            }
          }
        }
        if (data8.max_run_creations !== undefined) {
          let data12 = data8.max_run_creations;
          if (!(typeof data12 == "number" && !(data12 % 1) && !isNaN(data12))) {
            const err39 = {
              instancePath: instancePath + "/authorization_budget/max_run_creations",
              schemaPath:
                "start-request.schema.json#/properties/authorization_budget/properties/max_run_creations/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err39];
            } else {
              vErrors.push(err39);
            }
            errors++;
          }
          if (typeof data12 == "number") {
            if (data12 > 1 || isNaN(data12)) {
              const err40 = {
                instancePath: instancePath + "/authorization_budget/max_run_creations",
                schemaPath:
                  "start-request.schema.json#/properties/authorization_budget/properties/max_run_creations/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 1 },
                message: "must be <= 1",
              };
              if (vErrors === null) {
                vErrors = [err40];
              } else {
                vErrors.push(err40);
              }
              errors++;
            }
            if (data12 < 1 || isNaN(data12)) {
              const err41 = {
                instancePath: instancePath + "/authorization_budget/max_run_creations",
                schemaPath:
                  "start-request.schema.json#/properties/authorization_budget/properties/max_run_creations/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err41];
              } else {
                vErrors.push(err41);
              }
              errors++;
            }
          }
        }
        if (data8.max_execution_time_ms !== undefined) {
          let data13 = data8.max_execution_time_ms;
          if (!(typeof data13 == "number" && !(data13 % 1) && !isNaN(data13))) {
            const err42 = {
              instancePath: instancePath + "/authorization_budget/max_execution_time_ms",
              schemaPath:
                "start-request.schema.json#/properties/authorization_budget/properties/max_execution_time_ms/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err42];
            } else {
              vErrors.push(err42);
            }
            errors++;
          }
          if (typeof data13 == "number") {
            if (data13 > 3600000 || isNaN(data13)) {
              const err43 = {
                instancePath: instancePath + "/authorization_budget/max_execution_time_ms",
                schemaPath:
                  "start-request.schema.json#/properties/authorization_budget/properties/max_execution_time_ms/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 3600000 },
                message: "must be <= 3600000",
              };
              if (vErrors === null) {
                vErrors = [err43];
              } else {
                vErrors.push(err43);
              }
              errors++;
            }
            if (data13 < 1 || isNaN(data13)) {
              const err44 = {
                instancePath: instancePath + "/authorization_budget/max_execution_time_ms",
                schemaPath:
                  "start-request.schema.json#/properties/authorization_budget/properties/max_execution_time_ms/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err44];
              } else {
                vErrors.push(err44);
              }
              errors++;
            }
          }
        }
      } else {
        const err45 = {
          instancePath: instancePath + "/authorization_budget",
          schemaPath: "start-request.schema.json#/properties/authorization_budget/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err45];
        } else {
          vErrors.push(err45);
        }
        errors++;
      }
    }
    if (data.principal !== undefined) {
      let data14 = data.principal;
      if (typeof data14 === "string") {
        if (func2(data14) > 128) {
          const err46 = {
            instancePath: instancePath + "/principal",
            schemaPath: "#/properties/principal/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err46];
          } else {
            vErrors.push(err46);
          }
          errors++;
        }
        if (func2(data14) < 1) {
          const err47 = {
            instancePath: instancePath + "/principal",
            schemaPath: "#/properties/principal/minLength",
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
          instancePath: instancePath + "/principal",
          schemaPath: "#/properties/principal/type",
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
    if (data.workspace_id !== undefined) {
      let data15 = data.workspace_id;
      if (typeof data15 === "string") {
        if (func2(data15) > 128) {
          const err49 = {
            instancePath: instancePath + "/workspace_id",
            schemaPath: "#/properties/workspace_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        if (func2(data15) < 1) {
          const err50 = {
            instancePath: instancePath + "/workspace_id",
            schemaPath: "#/properties/workspace_id/minLength",
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
          instancePath: instancePath + "/workspace_id",
          schemaPath: "#/properties/workspace_id/type",
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
  } else {
    const err52 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err52];
    } else {
      vErrors.push(err52);
    }
    errors++;
  }
  validate39.errors = vErrors;
  return errors === 0;
}
validate39.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const agentFlowRevokeResponse = validate41;
const schema47 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_flow.revoke_response.v1",
  title: "AgentFlowAuthorizationRevokeResponse",
  type: "object",
  additionalProperties: false,
  required: ["flow", "events", "idempotent_replay", "action"],
  properties: {
    flow: { $ref: "state.schema.json" },
    events: { type: "array", items: { $ref: "event.schema.json" } },
    idempotent_replay: { type: "boolean" },
    action: { const: "revoke_authorization" },
  },
};
function validate41(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_flow.revoke_response.v1" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate41.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.flow === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "flow" },
        message: "must have required property '" + "flow" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.events === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "events" },
        message: "must have required property '" + "events" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.idempotent_replay === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "idempotent_replay" },
        message: "must have required property '" + "idempotent_replay" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.action === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "action" },
        message: "must have required property '" + "action" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "flow" || key0 === "events" || key0 === "idempotent_replay" || key0 === "action")) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.flow !== undefined) {
      if (
        !validate24(data.flow, {
          instancePath: instancePath + "/flow",
          parentData: data,
          parentDataProperty: "flow",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
        errors = vErrors.length;
      }
    }
    if (data.events !== undefined) {
      let data1 = data.events;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate26(data1[i0], {
              instancePath: instancePath + "/events/" + i0,
              parentData: data1,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/events",
          schemaPath: "#/properties/events/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.idempotent_replay !== undefined) {
      if (typeof data.idempotent_replay !== "boolean") {
        const err6 = {
          instancePath: instancePath + "/idempotent_replay",
          schemaPath: "#/properties/idempotent_replay/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.action !== undefined) {
      if ("revoke_authorization" !== data.action) {
        const err7 = {
          instancePath: instancePath + "/action",
          schemaPath: "#/properties/action/const",
          keyword: "const",
          params: { allowedValue: "revoke_authorization" },
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
  } else {
    const err8 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  validate41.errors = vErrors;
  return errors === 0;
}
validate41.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
