// Generated standalone Agent intent validators. Do not edit by hand.
/* eslint-disable */
"use strict";
export const agentIntentPageEntry = validate20;
const schema31 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_intent.page_entry.v1",
  title: "AgentIntentPageEntry",
  type: "object",
  additionalProperties: false,
  required: ["page_id", "route_name", "capability_ids", "supports_run"],
  properties: {
    page_id: { type: "string", minLength: 1, maxLength: 128 },
    route_name: { type: "string", minLength: 1, maxLength: 128 },
    capability_ids: { type: "array", maxItems: 64, items: { type: "string", minLength: 1, maxLength: 128 } },
    supports_run: { type: "boolean" },
    context_revision: { type: "string", minLength: 1, maxLength: 256 },
  },
};
import * as func1Module from "ajv/dist/runtime/ucs2length.js";
const func1 = func1Module.default?.default ?? func1Module.default ?? func1Module;
function validate20(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_intent.page_entry.v1" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.page_id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "page_id" },
        message: "must have required property '" + "page_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.route_name === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "route_name" },
        message: "must have required property '" + "route_name" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.capability_ids === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "capability_ids" },
        message: "must have required property '" + "capability_ids" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.supports_run === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "supports_run" },
        message: "must have required property '" + "supports_run" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "page_id" ||
        key0 === "route_name" ||
        key0 === "capability_ids" ||
        key0 === "supports_run" ||
        key0 === "context_revision"
      )) {
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
    if (data.page_id !== undefined) {
      let data0 = data.page_id;
      if (typeof data0 === "string") {
        if (func1(data0) > 128) {
          const err5 = {
            instancePath: instancePath + "/page_id",
            schemaPath: "#/properties/page_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (func1(data0) < 1) {
          const err6 = {
            instancePath: instancePath + "/page_id",
            schemaPath: "#/properties/page_id/minLength",
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
          instancePath: instancePath + "/page_id",
          schemaPath: "#/properties/page_id/type",
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
    if (data.route_name !== undefined) {
      let data1 = data.route_name;
      if (typeof data1 === "string") {
        if (func1(data1) > 128) {
          const err8 = {
            instancePath: instancePath + "/route_name",
            schemaPath: "#/properties/route_name/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
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
            instancePath: instancePath + "/route_name",
            schemaPath: "#/properties/route_name/minLength",
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
          instancePath: instancePath + "/route_name",
          schemaPath: "#/properties/route_name/type",
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
    if (data.capability_ids !== undefined) {
      let data2 = data.capability_ids;
      if (Array.isArray(data2)) {
        if (data2.length > 64) {
          const err11 = {
            instancePath: instancePath + "/capability_ids",
            schemaPath: "#/properties/capability_ids/maxItems",
            keyword: "maxItems",
            params: { limit: 64 },
            message: "must NOT have more than 64 items",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data3 = data2[i0];
          if (typeof data3 === "string") {
            if (func1(data3) > 128) {
              const err12 = {
                instancePath: instancePath + "/capability_ids/" + i0,
                schemaPath: "#/properties/capability_ids/items/maxLength",
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
            if (func1(data3) < 1) {
              const err13 = {
                instancePath: instancePath + "/capability_ids/" + i0,
                schemaPath: "#/properties/capability_ids/items/minLength",
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
              instancePath: instancePath + "/capability_ids/" + i0,
              schemaPath: "#/properties/capability_ids/items/type",
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
      } else {
        const err15 = {
          instancePath: instancePath + "/capability_ids",
          schemaPath: "#/properties/capability_ids/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.supports_run !== undefined) {
      if (typeof data.supports_run !== "boolean") {
        const err16 = {
          instancePath: instancePath + "/supports_run",
          schemaPath: "#/properties/supports_run/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.context_revision !== undefined) {
      let data5 = data.context_revision;
      if (typeof data5 === "string") {
        if (func1(data5) > 256) {
          const err17 = {
            instancePath: instancePath + "/context_revision",
            schemaPath: "#/properties/context_revision/maxLength",
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
        if (func1(data5) < 1) {
          const err18 = {
            instancePath: instancePath + "/context_revision",
            schemaPath: "#/properties/context_revision/minLength",
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
          instancePath: instancePath + "/context_revision",
          schemaPath: "#/properties/context_revision/type",
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
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const agentIntentRequest = validate21;
const schema32 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_intent.request.v1",
  title: "AgentIntentRequest",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "contract_revision",
    "session_id",
    "user_goal",
    "current_page",
    "page_catalog",
    "run_id",
    "run_context_revision",
    "backend_identity",
    "schema_set_revision",
    "input_snapshot_digest",
  ],
  properties: {
    schema_identity: { const: "tilesim.agent_intent.request.v1" },
    contract_revision: { const: "2026-10-28.agent-intent.v1" },
    session_id: { type: "string", minLength: 1, maxLength: 128 },
    user_goal: { type: "string", minLength: 1, maxLength: 20000 },
    current_page: {
      type: "object",
      additionalProperties: false,
      required: ["page_id", "route_name", "context_revision", "capability_ids"],
      properties: {
        page_id: { type: "string", minLength: 1, maxLength: 128 },
        route_name: { type: "string", minLength: 1, maxLength: 128 },
        capability_ids: { type: "array", maxItems: 64, items: { type: "string", minLength: 1, maxLength: 128 } },
        context_revision: { type: "string", minLength: 1, maxLength: 256 },
      },
    },
    page_catalog: {
      type: "array",
      minItems: 1,
      maxItems: 64,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["page_id", "route_name", "capability_ids", "supports_run"],
        properties: {
          page_id: { type: "string", minLength: 1, maxLength: 128 },
          route_name: { type: "string", minLength: 1, maxLength: 128 },
          capability_ids: { type: "array", maxItems: 64, items: { type: "string", minLength: 1, maxLength: 128 } },
          supports_run: { type: "boolean" },
        },
      },
    },
    run_id: { type: ["string", "null"], minLength: 1, maxLength: 128 },
    run_context_revision: { type: ["string", "null"], minLength: 1, maxLength: 256 },
    backend_identity: { type: "object", additionalProperties: true },
    schema_set_revision: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    input_snapshot_digest: { type: ["string", "null"], pattern: "^sha256:[0-9a-f]{64}$" },
  },
};
const func9 = Object.prototype.hasOwnProperty;
const pattern4 = new RegExp("^sha256:[0-9a-f]{64}$", "u");
function validate21(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_intent.request.v1" */ let vErrors = null;
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
    if (data.current_page === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "current_page" },
        message: "must have required property '" + "current_page" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.page_catalog === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "page_catalog" },
        message: "must have required property '" + "page_catalog" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.run_id === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "run_id" },
        message: "must have required property '" + "run_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.run_context_revision === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "run_context_revision" },
        message: "must have required property '" + "run_context_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.backend_identity === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "backend_identity" },
        message: "must have required property '" + "backend_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.schema_set_revision === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_set_revision" },
        message: "must have required property '" + "schema_set_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.input_snapshot_digest === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "input_snapshot_digest" },
        message: "must have required property '" + "input_snapshot_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func9.call(schema32.properties, key0)) {
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
      if ("tilesim.agent_intent.request.v1" !== data.schema_identity) {
        const err12 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.agent_intent.request.v1" },
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
      if ("2026-10-28.agent-intent.v1" !== data.contract_revision) {
        const err13 = {
          instancePath: instancePath + "/contract_revision",
          schemaPath: "#/properties/contract_revision/const",
          keyword: "const",
          params: { allowedValue: "2026-10-28.agent-intent.v1" },
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
        if (func1(data2) > 128) {
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
        if (func1(data2) < 1) {
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
        if (func1(data3) > 20000) {
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
        if (func1(data3) < 1) {
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
    if (data.current_page !== undefined) {
      let data4 = data.current_page;
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
        if (data4.page_id === undefined) {
          const err20 = {
            instancePath: instancePath + "/current_page",
            schemaPath: "#/properties/current_page/required",
            keyword: "required",
            params: { missingProperty: "page_id" },
            message: "must have required property '" + "page_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        if (data4.route_name === undefined) {
          const err21 = {
            instancePath: instancePath + "/current_page",
            schemaPath: "#/properties/current_page/required",
            keyword: "required",
            params: { missingProperty: "route_name" },
            message: "must have required property '" + "route_name" + "'",
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (data4.context_revision === undefined) {
          const err22 = {
            instancePath: instancePath + "/current_page",
            schemaPath: "#/properties/current_page/required",
            keyword: "required",
            params: { missingProperty: "context_revision" },
            message: "must have required property '" + "context_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (data4.capability_ids === undefined) {
          const err23 = {
            instancePath: instancePath + "/current_page",
            schemaPath: "#/properties/current_page/required",
            keyword: "required",
            params: { missingProperty: "capability_ids" },
            message: "must have required property '" + "capability_ids" + "'",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
        for (const key1 in data4) {
          if (!(
            key1 === "page_id" ||
            key1 === "route_name" ||
            key1 === "capability_ids" ||
            key1 === "context_revision"
          )) {
            const err24 = {
              instancePath: instancePath + "/current_page",
              schemaPath: "#/properties/current_page/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
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
        if (data4.page_id !== undefined) {
          let data5 = data4.page_id;
          if (typeof data5 === "string") {
            if (func1(data5) > 128) {
              const err25 = {
                instancePath: instancePath + "/current_page/page_id",
                schemaPath: "#/properties/current_page/properties/page_id/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err25];
              } else {
                vErrors.push(err25);
              }
              errors++;
            }
            if (func1(data5) < 1) {
              const err26 = {
                instancePath: instancePath + "/current_page/page_id",
                schemaPath: "#/properties/current_page/properties/page_id/minLength",
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
          } else {
            const err27 = {
              instancePath: instancePath + "/current_page/page_id",
              schemaPath: "#/properties/current_page/properties/page_id/type",
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
        if (data4.route_name !== undefined) {
          let data6 = data4.route_name;
          if (typeof data6 === "string") {
            if (func1(data6) > 128) {
              const err28 = {
                instancePath: instancePath + "/current_page/route_name",
                schemaPath: "#/properties/current_page/properties/route_name/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            }
            if (func1(data6) < 1) {
              const err29 = {
                instancePath: instancePath + "/current_page/route_name",
                schemaPath: "#/properties/current_page/properties/route_name/minLength",
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
              instancePath: instancePath + "/current_page/route_name",
              schemaPath: "#/properties/current_page/properties/route_name/type",
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
        if (data4.capability_ids !== undefined) {
          let data7 = data4.capability_ids;
          if (Array.isArray(data7)) {
            if (data7.length > 64) {
              const err31 = {
                instancePath: instancePath + "/current_page/capability_ids",
                schemaPath: "#/properties/current_page/properties/capability_ids/maxItems",
                keyword: "maxItems",
                params: { limit: 64 },
                message: "must NOT have more than 64 items",
              };
              if (vErrors === null) {
                vErrors = [err31];
              } else {
                vErrors.push(err31);
              }
              errors++;
            }
            const len0 = data7.length;
            for (let i0 = 0; i0 < len0; i0++) {
              let data8 = data7[i0];
              if (typeof data8 === "string") {
                if (func1(data8) > 128) {
                  const err32 = {
                    instancePath: instancePath + "/current_page/capability_ids/" + i0,
                    schemaPath: "#/properties/current_page/properties/capability_ids/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 128 },
                    message: "must NOT have more than 128 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err32];
                  } else {
                    vErrors.push(err32);
                  }
                  errors++;
                }
                if (func1(data8) < 1) {
                  const err33 = {
                    instancePath: instancePath + "/current_page/capability_ids/" + i0,
                    schemaPath: "#/properties/current_page/properties/capability_ids/items/minLength",
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
                  instancePath: instancePath + "/current_page/capability_ids/" + i0,
                  schemaPath: "#/properties/current_page/properties/capability_ids/items/type",
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
          } else {
            const err35 = {
              instancePath: instancePath + "/current_page/capability_ids",
              schemaPath: "#/properties/current_page/properties/capability_ids/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err35];
            } else {
              vErrors.push(err35);
            }
            errors++;
          }
        }
        if (data4.context_revision !== undefined) {
          let data9 = data4.context_revision;
          if (typeof data9 === "string") {
            if (func1(data9) > 256) {
              const err36 = {
                instancePath: instancePath + "/current_page/context_revision",
                schemaPath: "#/properties/current_page/properties/context_revision/maxLength",
                keyword: "maxLength",
                params: { limit: 256 },
                message: "must NOT have more than 256 characters",
              };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
            }
            if (func1(data9) < 1) {
              const err37 = {
                instancePath: instancePath + "/current_page/context_revision",
                schemaPath: "#/properties/current_page/properties/context_revision/minLength",
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
              instancePath: instancePath + "/current_page/context_revision",
              schemaPath: "#/properties/current_page/properties/context_revision/type",
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
      } else {
        const err39 = {
          instancePath: instancePath + "/current_page",
          schemaPath: "#/properties/current_page/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      }
    }
    if (data.page_catalog !== undefined) {
      let data10 = data.page_catalog;
      if (Array.isArray(data10)) {
        if (data10.length > 64) {
          const err40 = {
            instancePath: instancePath + "/page_catalog",
            schemaPath: "#/properties/page_catalog/maxItems",
            keyword: "maxItems",
            params: { limit: 64 },
            message: "must NOT have more than 64 items",
          };
          if (vErrors === null) {
            vErrors = [err40];
          } else {
            vErrors.push(err40);
          }
          errors++;
        }
        if (data10.length < 1) {
          const err41 = {
            instancePath: instancePath + "/page_catalog",
            schemaPath: "#/properties/page_catalog/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
        const len1 = data10.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data11 = data10[i1];
          if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
            if (data11.page_id === undefined) {
              const err42 = {
                instancePath: instancePath + "/page_catalog/" + i1,
                schemaPath: "#/properties/page_catalog/items/required",
                keyword: "required",
                params: { missingProperty: "page_id" },
                message: "must have required property '" + "page_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err42];
              } else {
                vErrors.push(err42);
              }
              errors++;
            }
            if (data11.route_name === undefined) {
              const err43 = {
                instancePath: instancePath + "/page_catalog/" + i1,
                schemaPath: "#/properties/page_catalog/items/required",
                keyword: "required",
                params: { missingProperty: "route_name" },
                message: "must have required property '" + "route_name" + "'",
              };
              if (vErrors === null) {
                vErrors = [err43];
              } else {
                vErrors.push(err43);
              }
              errors++;
            }
            if (data11.capability_ids === undefined) {
              const err44 = {
                instancePath: instancePath + "/page_catalog/" + i1,
                schemaPath: "#/properties/page_catalog/items/required",
                keyword: "required",
                params: { missingProperty: "capability_ids" },
                message: "must have required property '" + "capability_ids" + "'",
              };
              if (vErrors === null) {
                vErrors = [err44];
              } else {
                vErrors.push(err44);
              }
              errors++;
            }
            if (data11.supports_run === undefined) {
              const err45 = {
                instancePath: instancePath + "/page_catalog/" + i1,
                schemaPath: "#/properties/page_catalog/items/required",
                keyword: "required",
                params: { missingProperty: "supports_run" },
                message: "must have required property '" + "supports_run" + "'",
              };
              if (vErrors === null) {
                vErrors = [err45];
              } else {
                vErrors.push(err45);
              }
              errors++;
            }
            for (const key2 in data11) {
              if (!(
                key2 === "page_id" ||
                key2 === "route_name" ||
                key2 === "capability_ids" ||
                key2 === "supports_run"
              )) {
                const err46 = {
                  instancePath: instancePath + "/page_catalog/" + i1,
                  schemaPath: "#/properties/page_catalog/items/additionalProperties",
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
            if (data11.page_id !== undefined) {
              let data12 = data11.page_id;
              if (typeof data12 === "string") {
                if (func1(data12) > 128) {
                  const err47 = {
                    instancePath: instancePath + "/page_catalog/" + i1 + "/page_id",
                    schemaPath: "#/properties/page_catalog/items/properties/page_id/maxLength",
                    keyword: "maxLength",
                    params: { limit: 128 },
                    message: "must NOT have more than 128 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err47];
                  } else {
                    vErrors.push(err47);
                  }
                  errors++;
                }
                if (func1(data12) < 1) {
                  const err48 = {
                    instancePath: instancePath + "/page_catalog/" + i1 + "/page_id",
                    schemaPath: "#/properties/page_catalog/items/properties/page_id/minLength",
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
                  instancePath: instancePath + "/page_catalog/" + i1 + "/page_id",
                  schemaPath: "#/properties/page_catalog/items/properties/page_id/type",
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
            if (data11.route_name !== undefined) {
              let data13 = data11.route_name;
              if (typeof data13 === "string") {
                if (func1(data13) > 128) {
                  const err50 = {
                    instancePath: instancePath + "/page_catalog/" + i1 + "/route_name",
                    schemaPath: "#/properties/page_catalog/items/properties/route_name/maxLength",
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
                if (func1(data13) < 1) {
                  const err51 = {
                    instancePath: instancePath + "/page_catalog/" + i1 + "/route_name",
                    schemaPath: "#/properties/page_catalog/items/properties/route_name/minLength",
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
                  instancePath: instancePath + "/page_catalog/" + i1 + "/route_name",
                  schemaPath: "#/properties/page_catalog/items/properties/route_name/type",
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
            if (data11.capability_ids !== undefined) {
              let data14 = data11.capability_ids;
              if (Array.isArray(data14)) {
                if (data14.length > 64) {
                  const err53 = {
                    instancePath: instancePath + "/page_catalog/" + i1 + "/capability_ids",
                    schemaPath: "#/properties/page_catalog/items/properties/capability_ids/maxItems",
                    keyword: "maxItems",
                    params: { limit: 64 },
                    message: "must NOT have more than 64 items",
                  };
                  if (vErrors === null) {
                    vErrors = [err53];
                  } else {
                    vErrors.push(err53);
                  }
                  errors++;
                }
                const len2 = data14.length;
                for (let i2 = 0; i2 < len2; i2++) {
                  let data15 = data14[i2];
                  if (typeof data15 === "string") {
                    if (func1(data15) > 128) {
                      const err54 = {
                        instancePath: instancePath + "/page_catalog/" + i1 + "/capability_ids/" + i2,
                        schemaPath: "#/properties/page_catalog/items/properties/capability_ids/items/maxLength",
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
                    if (func1(data15) < 1) {
                      const err55 = {
                        instancePath: instancePath + "/page_catalog/" + i1 + "/capability_ids/" + i2,
                        schemaPath: "#/properties/page_catalog/items/properties/capability_ids/items/minLength",
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
                      instancePath: instancePath + "/page_catalog/" + i1 + "/capability_ids/" + i2,
                      schemaPath: "#/properties/page_catalog/items/properties/capability_ids/items/type",
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
              } else {
                const err57 = {
                  instancePath: instancePath + "/page_catalog/" + i1 + "/capability_ids",
                  schemaPath: "#/properties/page_catalog/items/properties/capability_ids/type",
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
            if (data11.supports_run !== undefined) {
              if (typeof data11.supports_run !== "boolean") {
                const err58 = {
                  instancePath: instancePath + "/page_catalog/" + i1 + "/supports_run",
                  schemaPath: "#/properties/page_catalog/items/properties/supports_run/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
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
              instancePath: instancePath + "/page_catalog/" + i1,
              schemaPath: "#/properties/page_catalog/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err59];
            } else {
              vErrors.push(err59);
            }
            errors++;
          }
        }
      } else {
        const err60 = {
          instancePath: instancePath + "/page_catalog",
          schemaPath: "#/properties/page_catalog/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err60];
        } else {
          vErrors.push(err60);
        }
        errors++;
      }
    }
    if (data.run_id !== undefined) {
      let data17 = data.run_id;
      if (typeof data17 !== "string" && data17 !== null) {
        const err61 = {
          instancePath: instancePath + "/run_id",
          schemaPath: "#/properties/run_id/type",
          keyword: "type",
          params: { type: schema32.properties.run_id.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err61];
        } else {
          vErrors.push(err61);
        }
        errors++;
      }
      if (typeof data17 === "string") {
        if (func1(data17) > 128) {
          const err62 = {
            instancePath: instancePath + "/run_id",
            schemaPath: "#/properties/run_id/maxLength",
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
        if (func1(data17) < 1) {
          const err63 = {
            instancePath: instancePath + "/run_id",
            schemaPath: "#/properties/run_id/minLength",
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
      }
    }
    if (data.run_context_revision !== undefined) {
      let data18 = data.run_context_revision;
      if (typeof data18 !== "string" && data18 !== null) {
        const err64 = {
          instancePath: instancePath + "/run_context_revision",
          schemaPath: "#/properties/run_context_revision/type",
          keyword: "type",
          params: { type: schema32.properties.run_context_revision.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err64];
        } else {
          vErrors.push(err64);
        }
        errors++;
      }
      if (typeof data18 === "string") {
        if (func1(data18) > 256) {
          const err65 = {
            instancePath: instancePath + "/run_context_revision",
            schemaPath: "#/properties/run_context_revision/maxLength",
            keyword: "maxLength",
            params: { limit: 256 },
            message: "must NOT have more than 256 characters",
          };
          if (vErrors === null) {
            vErrors = [err65];
          } else {
            vErrors.push(err65);
          }
          errors++;
        }
        if (func1(data18) < 1) {
          const err66 = {
            instancePath: instancePath + "/run_context_revision",
            schemaPath: "#/properties/run_context_revision/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
    if (data.backend_identity !== undefined) {
      let data19 = data.backend_identity;
      if (data19 && typeof data19 == "object" && !Array.isArray(data19)) {
      } else {
        const err67 = {
          instancePath: instancePath + "/backend_identity",
          schemaPath: "#/properties/backend_identity/type",
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
    if (data.schema_set_revision !== undefined) {
      let data20 = data.schema_set_revision;
      if (typeof data20 === "string") {
        if (!pattern4.test(data20)) {
          const err68 = {
            instancePath: instancePath + "/schema_set_revision",
            schemaPath: "#/properties/schema_set_revision/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/schema_set_revision",
          schemaPath: "#/properties/schema_set_revision/type",
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
    if (data.input_snapshot_digest !== undefined) {
      let data21 = data.input_snapshot_digest;
      if (typeof data21 !== "string" && data21 !== null) {
        const err70 = {
          instancePath: instancePath + "/input_snapshot_digest",
          schemaPath: "#/properties/input_snapshot_digest/type",
          keyword: "type",
          params: { type: schema32.properties.input_snapshot_digest.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err70];
        } else {
          vErrors.push(err70);
        }
        errors++;
      }
      if (typeof data21 === "string") {
        if (!pattern4.test(data21)) {
          const err71 = {
            instancePath: instancePath + "/input_snapshot_digest",
            schemaPath: "#/properties/input_snapshot_digest/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err71];
          } else {
            vErrors.push(err71);
          }
          errors++;
        }
      }
    }
  } else {
    const err72 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err72];
    } else {
      vErrors.push(err72);
    }
    errors++;
  }
  validate21.errors = vErrors;
  return errors === 0;
}
validate21.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const agentIntentResponse = validate22;
const schema33 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "tilesim.agent_intent.response.v1",
  title: "AgentIntentResponse",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "contract_revision",
    "schema_set_revision",
    "protocol",
    "session_id",
    "user_goal",
    "intent",
    "current_page_id",
    "current_context_revision",
    "run_id",
    "run_context_revision",
    "backend_identity",
    "input_snapshot_digest",
    "candidate_pages",
    "required_capabilities",
    "risk_level",
    "requires_user_confirmation",
    "suggested_steps",
    "clarification_questions",
  ],
  properties: {
    schema_identity: { const: "tilesim.agent_intent.response.v1" },
    contract_revision: { const: "2026-10-28.agent-intent.v1" },
    schema_set_revision: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    protocol: { const: "tilesim.agent_intent.v1" },
    session_id: { type: "string", minLength: 1, maxLength: 128 },
    user_goal: { type: "string", minLength: 1, maxLength: 20000 },
    intent: {
      enum: [
        "explain",
        "existing_run_analysis",
        "user_report",
        "configuration_draft",
        "navigation",
        "simulation_execution",
        "unsupported_execution",
      ],
    },
    current_page_id: { type: "string", minLength: 1, maxLength: 128 },
    current_context_revision: { type: "string", minLength: 1, maxLength: 256 },
    run_id: { type: ["string", "null"], minLength: 1, maxLength: 128 },
    run_context_revision: { type: ["string", "null"], minLength: 1, maxLength: 256 },
    backend_identity: { type: "object", additionalProperties: true },
    input_snapshot_digest: { type: ["string", "null"], pattern: "^sha256:[0-9a-f]{64}$" },
    candidate_pages: {
      type: "array",
      maxItems: 32,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["page_id", "route_name", "required_capabilities", "reason"],
        properties: {
          page_id: { type: "string", minLength: 1, maxLength: 128 },
          route_name: { type: "string", minLength: 1, maxLength: 128 },
          required_capabilities: {
            type: "array",
            maxItems: 64,
            items: { type: "string", minLength: 1, maxLength: 128 },
          },
          reason: { type: "string", minLength: 1, maxLength: 500 },
        },
      },
    },
    required_capabilities: { type: "array", maxItems: 64, items: { type: "string", minLength: 1, maxLength: 128 } },
    risk_level: { enum: ["low", "medium", "high", "critical"] },
    requires_user_confirmation: { type: "boolean" },
    suggested_steps: {
      type: "array",
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "description", "page_id"],
        properties: {
          kind: { enum: ["navigate", "observe", "clarify", "authorize", "execute", "report"] },
          description: { type: "string", minLength: 1, maxLength: 500 },
          page_id: { type: ["string", "null"], minLength: 1, maxLength: 128 },
        },
      },
    },
    clarification_questions: { type: "array", maxItems: 8, items: { type: "string", minLength: 1, maxLength: 500 } },
  },
};
function validate22(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="tilesim.agent_intent.response.v1" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
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
    if (data.schema_set_revision === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_set_revision" },
        message: "must have required property '" + "schema_set_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.protocol === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "protocol" },
        message: "must have required property '" + "protocol" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.session_id === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "session_id" },
        message: "must have required property '" + "session_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.user_goal === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "user_goal" },
        message: "must have required property '" + "user_goal" + "'",
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
    if (data.current_page_id === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "current_page_id" },
        message: "must have required property '" + "current_page_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.current_context_revision === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "current_context_revision" },
        message: "must have required property '" + "current_context_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.run_id === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "run_id" },
        message: "must have required property '" + "run_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.run_context_revision === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "run_context_revision" },
        message: "must have required property '" + "run_context_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.backend_identity === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "backend_identity" },
        message: "must have required property '" + "backend_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.input_snapshot_digest === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "input_snapshot_digest" },
        message: "must have required property '" + "input_snapshot_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.candidate_pages === undefined) {
      const err13 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "candidate_pages" },
        message: "must have required property '" + "candidate_pages" + "'",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.required_capabilities === undefined) {
      const err14 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "required_capabilities" },
        message: "must have required property '" + "required_capabilities" + "'",
      };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    if (data.risk_level === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "risk_level" },
        message: "must have required property '" + "risk_level" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.requires_user_confirmation === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "requires_user_confirmation" },
        message: "must have required property '" + "requires_user_confirmation" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    if (data.suggested_steps === undefined) {
      const err17 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "suggested_steps" },
        message: "must have required property '" + "suggested_steps" + "'",
      };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    if (data.clarification_questions === undefined) {
      const err18 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "clarification_questions" },
        message: "must have required property '" + "clarification_questions" + "'",
      };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func9.call(schema33.properties, key0)) {
        const err19 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.schema_identity !== undefined) {
      if ("tilesim.agent_intent.response.v1" !== data.schema_identity) {
        const err20 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.agent_intent.response.v1" },
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
    if (data.contract_revision !== undefined) {
      if ("2026-10-28.agent-intent.v1" !== data.contract_revision) {
        const err21 = {
          instancePath: instancePath + "/contract_revision",
          schemaPath: "#/properties/contract_revision/const",
          keyword: "const",
          params: { allowedValue: "2026-10-28.agent-intent.v1" },
          message: "must be equal to constant",
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
      let data2 = data.schema_set_revision;
      if (typeof data2 === "string") {
        if (!pattern4.test(data2)) {
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
    if (data.protocol !== undefined) {
      if ("tilesim.agent_intent.v1" !== data.protocol) {
        const err24 = {
          instancePath: instancePath + "/protocol",
          schemaPath: "#/properties/protocol/const",
          keyword: "const",
          params: { allowedValue: "tilesim.agent_intent.v1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.session_id !== undefined) {
      let data4 = data.session_id;
      if (typeof data4 === "string") {
        if (func1(data4) > 128) {
          const err25 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (func1(data4) < 1) {
          const err26 = {
            instancePath: instancePath + "/session_id",
            schemaPath: "#/properties/session_id/minLength",
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
      } else {
        const err27 = {
          instancePath: instancePath + "/session_id",
          schemaPath: "#/properties/session_id/type",
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
    if (data.user_goal !== undefined) {
      let data5 = data.user_goal;
      if (typeof data5 === "string") {
        if (func1(data5) > 20000) {
          const err28 = {
            instancePath: instancePath + "/user_goal",
            schemaPath: "#/properties/user_goal/maxLength",
            keyword: "maxLength",
            params: { limit: 20000 },
            message: "must NOT have more than 20000 characters",
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
        if (func1(data5) < 1) {
          const err29 = {
            instancePath: instancePath + "/user_goal",
            schemaPath: "#/properties/user_goal/minLength",
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
          instancePath: instancePath + "/user_goal",
          schemaPath: "#/properties/user_goal/type",
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
    if (data.intent !== undefined) {
      let data6 = data.intent;
      if (!(
        data6 === "explain" ||
        data6 === "existing_run_analysis" ||
        data6 === "user_report" ||
        data6 === "configuration_draft" ||
        data6 === "navigation" ||
        data6 === "simulation_execution" ||
        data6 === "unsupported_execution"
      )) {
        const err31 = {
          instancePath: instancePath + "/intent",
          schemaPath: "#/properties/intent/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.intent.enum },
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
    if (data.current_page_id !== undefined) {
      let data7 = data.current_page_id;
      if (typeof data7 === "string") {
        if (func1(data7) > 128) {
          const err32 = {
            instancePath: instancePath + "/current_page_id",
            schemaPath: "#/properties/current_page_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
        if (func1(data7) < 1) {
          const err33 = {
            instancePath: instancePath + "/current_page_id",
            schemaPath: "#/properties/current_page_id/minLength",
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
          instancePath: instancePath + "/current_page_id",
          schemaPath: "#/properties/current_page_id/type",
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
    if (data.current_context_revision !== undefined) {
      let data8 = data.current_context_revision;
      if (typeof data8 === "string") {
        if (func1(data8) > 256) {
          const err35 = {
            instancePath: instancePath + "/current_context_revision",
            schemaPath: "#/properties/current_context_revision/maxLength",
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
        if (func1(data8) < 1) {
          const err36 = {
            instancePath: instancePath + "/current_context_revision",
            schemaPath: "#/properties/current_context_revision/minLength",
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
          instancePath: instancePath + "/current_context_revision",
          schemaPath: "#/properties/current_context_revision/type",
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
    if (data.run_id !== undefined) {
      let data9 = data.run_id;
      if (typeof data9 !== "string" && data9 !== null) {
        const err38 = {
          instancePath: instancePath + "/run_id",
          schemaPath: "#/properties/run_id/type",
          keyword: "type",
          params: { type: schema33.properties.run_id.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
      if (typeof data9 === "string") {
        if (func1(data9) > 128) {
          const err39 = {
            instancePath: instancePath + "/run_id",
            schemaPath: "#/properties/run_id/maxLength",
            keyword: "maxLength",
            params: { limit: 128 },
            message: "must NOT have more than 128 characters",
          };
          if (vErrors === null) {
            vErrors = [err39];
          } else {
            vErrors.push(err39);
          }
          errors++;
        }
        if (func1(data9) < 1) {
          const err40 = {
            instancePath: instancePath + "/run_id",
            schemaPath: "#/properties/run_id/minLength",
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
      }
    }
    if (data.run_context_revision !== undefined) {
      let data10 = data.run_context_revision;
      if (typeof data10 !== "string" && data10 !== null) {
        const err41 = {
          instancePath: instancePath + "/run_context_revision",
          schemaPath: "#/properties/run_context_revision/type",
          keyword: "type",
          params: { type: schema33.properties.run_context_revision.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err41];
        } else {
          vErrors.push(err41);
        }
        errors++;
      }
      if (typeof data10 === "string") {
        if (func1(data10) > 256) {
          const err42 = {
            instancePath: instancePath + "/run_context_revision",
            schemaPath: "#/properties/run_context_revision/maxLength",
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
        if (func1(data10) < 1) {
          const err43 = {
            instancePath: instancePath + "/run_context_revision",
            schemaPath: "#/properties/run_context_revision/minLength",
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
      }
    }
    if (data.backend_identity !== undefined) {
      let data11 = data.backend_identity;
      if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
      } else {
        const err44 = {
          instancePath: instancePath + "/backend_identity",
          schemaPath: "#/properties/backend_identity/type",
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
    }
    if (data.input_snapshot_digest !== undefined) {
      let data12 = data.input_snapshot_digest;
      if (typeof data12 !== "string" && data12 !== null) {
        const err45 = {
          instancePath: instancePath + "/input_snapshot_digest",
          schemaPath: "#/properties/input_snapshot_digest/type",
          keyword: "type",
          params: { type: schema33.properties.input_snapshot_digest.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err45];
        } else {
          vErrors.push(err45);
        }
        errors++;
      }
      if (typeof data12 === "string") {
        if (!pattern4.test(data12)) {
          const err46 = {
            instancePath: instancePath + "/input_snapshot_digest",
            schemaPath: "#/properties/input_snapshot_digest/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
    if (data.candidate_pages !== undefined) {
      let data13 = data.candidate_pages;
      if (Array.isArray(data13)) {
        if (data13.length > 32) {
          const err47 = {
            instancePath: instancePath + "/candidate_pages",
            schemaPath: "#/properties/candidate_pages/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
        const len0 = data13.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data14 = data13[i0];
          if (data14 && typeof data14 == "object" && !Array.isArray(data14)) {
            if (data14.page_id === undefined) {
              const err48 = {
                instancePath: instancePath + "/candidate_pages/" + i0,
                schemaPath: "#/properties/candidate_pages/items/required",
                keyword: "required",
                params: { missingProperty: "page_id" },
                message: "must have required property '" + "page_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err48];
              } else {
                vErrors.push(err48);
              }
              errors++;
            }
            if (data14.route_name === undefined) {
              const err49 = {
                instancePath: instancePath + "/candidate_pages/" + i0,
                schemaPath: "#/properties/candidate_pages/items/required",
                keyword: "required",
                params: { missingProperty: "route_name" },
                message: "must have required property '" + "route_name" + "'",
              };
              if (vErrors === null) {
                vErrors = [err49];
              } else {
                vErrors.push(err49);
              }
              errors++;
            }
            if (data14.required_capabilities === undefined) {
              const err50 = {
                instancePath: instancePath + "/candidate_pages/" + i0,
                schemaPath: "#/properties/candidate_pages/items/required",
                keyword: "required",
                params: { missingProperty: "required_capabilities" },
                message: "must have required property '" + "required_capabilities" + "'",
              };
              if (vErrors === null) {
                vErrors = [err50];
              } else {
                vErrors.push(err50);
              }
              errors++;
            }
            if (data14.reason === undefined) {
              const err51 = {
                instancePath: instancePath + "/candidate_pages/" + i0,
                schemaPath: "#/properties/candidate_pages/items/required",
                keyword: "required",
                params: { missingProperty: "reason" },
                message: "must have required property '" + "reason" + "'",
              };
              if (vErrors === null) {
                vErrors = [err51];
              } else {
                vErrors.push(err51);
              }
              errors++;
            }
            for (const key1 in data14) {
              if (!(
                key1 === "page_id" ||
                key1 === "route_name" ||
                key1 === "required_capabilities" ||
                key1 === "reason"
              )) {
                const err52 = {
                  instancePath: instancePath + "/candidate_pages/" + i0,
                  schemaPath: "#/properties/candidate_pages/items/additionalProperties",
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
            if (data14.page_id !== undefined) {
              let data15 = data14.page_id;
              if (typeof data15 === "string") {
                if (func1(data15) > 128) {
                  const err53 = {
                    instancePath: instancePath + "/candidate_pages/" + i0 + "/page_id",
                    schemaPath: "#/properties/candidate_pages/items/properties/page_id/maxLength",
                    keyword: "maxLength",
                    params: { limit: 128 },
                    message: "must NOT have more than 128 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err53];
                  } else {
                    vErrors.push(err53);
                  }
                  errors++;
                }
                if (func1(data15) < 1) {
                  const err54 = {
                    instancePath: instancePath + "/candidate_pages/" + i0 + "/page_id",
                    schemaPath: "#/properties/candidate_pages/items/properties/page_id/minLength",
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
                  instancePath: instancePath + "/candidate_pages/" + i0 + "/page_id",
                  schemaPath: "#/properties/candidate_pages/items/properties/page_id/type",
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
            if (data14.route_name !== undefined) {
              let data16 = data14.route_name;
              if (typeof data16 === "string") {
                if (func1(data16) > 128) {
                  const err56 = {
                    instancePath: instancePath + "/candidate_pages/" + i0 + "/route_name",
                    schemaPath: "#/properties/candidate_pages/items/properties/route_name/maxLength",
                    keyword: "maxLength",
                    params: { limit: 128 },
                    message: "must NOT have more than 128 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err56];
                  } else {
                    vErrors.push(err56);
                  }
                  errors++;
                }
                if (func1(data16) < 1) {
                  const err57 = {
                    instancePath: instancePath + "/candidate_pages/" + i0 + "/route_name",
                    schemaPath: "#/properties/candidate_pages/items/properties/route_name/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
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
                  instancePath: instancePath + "/candidate_pages/" + i0 + "/route_name",
                  schemaPath: "#/properties/candidate_pages/items/properties/route_name/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err58];
                } else {
                  vErrors.push(err58);
                }
                errors++;
              }
            }
            if (data14.required_capabilities !== undefined) {
              let data17 = data14.required_capabilities;
              if (Array.isArray(data17)) {
                if (data17.length > 64) {
                  const err59 = {
                    instancePath: instancePath + "/candidate_pages/" + i0 + "/required_capabilities",
                    schemaPath: "#/properties/candidate_pages/items/properties/required_capabilities/maxItems",
                    keyword: "maxItems",
                    params: { limit: 64 },
                    message: "must NOT have more than 64 items",
                  };
                  if (vErrors === null) {
                    vErrors = [err59];
                  } else {
                    vErrors.push(err59);
                  }
                  errors++;
                }
                const len1 = data17.length;
                for (let i1 = 0; i1 < len1; i1++) {
                  let data18 = data17[i1];
                  if (typeof data18 === "string") {
                    if (func1(data18) > 128) {
                      const err60 = {
                        instancePath: instancePath + "/candidate_pages/" + i0 + "/required_capabilities/" + i1,
                        schemaPath:
                          "#/properties/candidate_pages/items/properties/required_capabilities/items/maxLength",
                        keyword: "maxLength",
                        params: { limit: 128 },
                        message: "must NOT have more than 128 characters",
                      };
                      if (vErrors === null) {
                        vErrors = [err60];
                      } else {
                        vErrors.push(err60);
                      }
                      errors++;
                    }
                    if (func1(data18) < 1) {
                      const err61 = {
                        instancePath: instancePath + "/candidate_pages/" + i0 + "/required_capabilities/" + i1,
                        schemaPath:
                          "#/properties/candidate_pages/items/properties/required_capabilities/items/minLength",
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
                      instancePath: instancePath + "/candidate_pages/" + i0 + "/required_capabilities/" + i1,
                      schemaPath: "#/properties/candidate_pages/items/properties/required_capabilities/items/type",
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
              } else {
                const err63 = {
                  instancePath: instancePath + "/candidate_pages/" + i0 + "/required_capabilities",
                  schemaPath: "#/properties/candidate_pages/items/properties/required_capabilities/type",
                  keyword: "type",
                  params: { type: "array" },
                  message: "must be array",
                };
                if (vErrors === null) {
                  vErrors = [err63];
                } else {
                  vErrors.push(err63);
                }
                errors++;
              }
            }
            if (data14.reason !== undefined) {
              let data19 = data14.reason;
              if (typeof data19 === "string") {
                if (func1(data19) > 500) {
                  const err64 = {
                    instancePath: instancePath + "/candidate_pages/" + i0 + "/reason",
                    schemaPath: "#/properties/candidate_pages/items/properties/reason/maxLength",
                    keyword: "maxLength",
                    params: { limit: 500 },
                    message: "must NOT have more than 500 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err64];
                  } else {
                    vErrors.push(err64);
                  }
                  errors++;
                }
                if (func1(data19) < 1) {
                  const err65 = {
                    instancePath: instancePath + "/candidate_pages/" + i0 + "/reason",
                    schemaPath: "#/properties/candidate_pages/items/properties/reason/minLength",
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
                  instancePath: instancePath + "/candidate_pages/" + i0 + "/reason",
                  schemaPath: "#/properties/candidate_pages/items/properties/reason/type",
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
              instancePath: instancePath + "/candidate_pages/" + i0,
              schemaPath: "#/properties/candidate_pages/items/type",
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
      } else {
        const err68 = {
          instancePath: instancePath + "/candidate_pages",
          schemaPath: "#/properties/candidate_pages/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err68];
        } else {
          vErrors.push(err68);
        }
        errors++;
      }
    }
    if (data.required_capabilities !== undefined) {
      let data20 = data.required_capabilities;
      if (Array.isArray(data20)) {
        if (data20.length > 64) {
          const err69 = {
            instancePath: instancePath + "/required_capabilities",
            schemaPath: "#/properties/required_capabilities/maxItems",
            keyword: "maxItems",
            params: { limit: 64 },
            message: "must NOT have more than 64 items",
          };
          if (vErrors === null) {
            vErrors = [err69];
          } else {
            vErrors.push(err69);
          }
          errors++;
        }
        const len2 = data20.length;
        for (let i2 = 0; i2 < len2; i2++) {
          let data21 = data20[i2];
          if (typeof data21 === "string") {
            if (func1(data21) > 128) {
              const err70 = {
                instancePath: instancePath + "/required_capabilities/" + i2,
                schemaPath: "#/properties/required_capabilities/items/maxLength",
                keyword: "maxLength",
                params: { limit: 128 },
                message: "must NOT have more than 128 characters",
              };
              if (vErrors === null) {
                vErrors = [err70];
              } else {
                vErrors.push(err70);
              }
              errors++;
            }
            if (func1(data21) < 1) {
              const err71 = {
                instancePath: instancePath + "/required_capabilities/" + i2,
                schemaPath: "#/properties/required_capabilities/items/minLength",
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
              instancePath: instancePath + "/required_capabilities/" + i2,
              schemaPath: "#/properties/required_capabilities/items/type",
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
      } else {
        const err73 = {
          instancePath: instancePath + "/required_capabilities",
          schemaPath: "#/properties/required_capabilities/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err73];
        } else {
          vErrors.push(err73);
        }
        errors++;
      }
    }
    if (data.risk_level !== undefined) {
      let data22 = data.risk_level;
      if (!(data22 === "low" || data22 === "medium" || data22 === "high" || data22 === "critical")) {
        const err74 = {
          instancePath: instancePath + "/risk_level",
          schemaPath: "#/properties/risk_level/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.risk_level.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err74];
        } else {
          vErrors.push(err74);
        }
        errors++;
      }
    }
    if (data.requires_user_confirmation !== undefined) {
      if (typeof data.requires_user_confirmation !== "boolean") {
        const err75 = {
          instancePath: instancePath + "/requires_user_confirmation",
          schemaPath: "#/properties/requires_user_confirmation/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err75];
        } else {
          vErrors.push(err75);
        }
        errors++;
      }
    }
    if (data.suggested_steps !== undefined) {
      let data24 = data.suggested_steps;
      if (Array.isArray(data24)) {
        if (data24.length > 16) {
          const err76 = {
            instancePath: instancePath + "/suggested_steps",
            schemaPath: "#/properties/suggested_steps/maxItems",
            keyword: "maxItems",
            params: { limit: 16 },
            message: "must NOT have more than 16 items",
          };
          if (vErrors === null) {
            vErrors = [err76];
          } else {
            vErrors.push(err76);
          }
          errors++;
        }
        const len3 = data24.length;
        for (let i3 = 0; i3 < len3; i3++) {
          let data25 = data24[i3];
          if (data25 && typeof data25 == "object" && !Array.isArray(data25)) {
            if (data25.kind === undefined) {
              const err77 = {
                instancePath: instancePath + "/suggested_steps/" + i3,
                schemaPath: "#/properties/suggested_steps/items/required",
                keyword: "required",
                params: { missingProperty: "kind" },
                message: "must have required property '" + "kind" + "'",
              };
              if (vErrors === null) {
                vErrors = [err77];
              } else {
                vErrors.push(err77);
              }
              errors++;
            }
            if (data25.description === undefined) {
              const err78 = {
                instancePath: instancePath + "/suggested_steps/" + i3,
                schemaPath: "#/properties/suggested_steps/items/required",
                keyword: "required",
                params: { missingProperty: "description" },
                message: "must have required property '" + "description" + "'",
              };
              if (vErrors === null) {
                vErrors = [err78];
              } else {
                vErrors.push(err78);
              }
              errors++;
            }
            if (data25.page_id === undefined) {
              const err79 = {
                instancePath: instancePath + "/suggested_steps/" + i3,
                schemaPath: "#/properties/suggested_steps/items/required",
                keyword: "required",
                params: { missingProperty: "page_id" },
                message: "must have required property '" + "page_id" + "'",
              };
              if (vErrors === null) {
                vErrors = [err79];
              } else {
                vErrors.push(err79);
              }
              errors++;
            }
            for (const key2 in data25) {
              if (!(key2 === "kind" || key2 === "description" || key2 === "page_id")) {
                const err80 = {
                  instancePath: instancePath + "/suggested_steps/" + i3,
                  schemaPath: "#/properties/suggested_steps/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key2 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err80];
                } else {
                  vErrors.push(err80);
                }
                errors++;
              }
            }
            if (data25.kind !== undefined) {
              let data26 = data25.kind;
              if (!(
                data26 === "navigate" ||
                data26 === "observe" ||
                data26 === "clarify" ||
                data26 === "authorize" ||
                data26 === "execute" ||
                data26 === "report"
              )) {
                const err81 = {
                  instancePath: instancePath + "/suggested_steps/" + i3 + "/kind",
                  schemaPath: "#/properties/suggested_steps/items/properties/kind/enum",
                  keyword: "enum",
                  params: { allowedValues: schema33.properties.suggested_steps.items.properties.kind.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err81];
                } else {
                  vErrors.push(err81);
                }
                errors++;
              }
            }
            if (data25.description !== undefined) {
              let data27 = data25.description;
              if (typeof data27 === "string") {
                if (func1(data27) > 500) {
                  const err82 = {
                    instancePath: instancePath + "/suggested_steps/" + i3 + "/description",
                    schemaPath: "#/properties/suggested_steps/items/properties/description/maxLength",
                    keyword: "maxLength",
                    params: { limit: 500 },
                    message: "must NOT have more than 500 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err82];
                  } else {
                    vErrors.push(err82);
                  }
                  errors++;
                }
                if (func1(data27) < 1) {
                  const err83 = {
                    instancePath: instancePath + "/suggested_steps/" + i3 + "/description",
                    schemaPath: "#/properties/suggested_steps/items/properties/description/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
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
                  instancePath: instancePath + "/suggested_steps/" + i3 + "/description",
                  schemaPath: "#/properties/suggested_steps/items/properties/description/type",
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
            if (data25.page_id !== undefined) {
              let data28 = data25.page_id;
              if (typeof data28 !== "string" && data28 !== null) {
                const err85 = {
                  instancePath: instancePath + "/suggested_steps/" + i3 + "/page_id",
                  schemaPath: "#/properties/suggested_steps/items/properties/page_id/type",
                  keyword: "type",
                  params: { type: schema33.properties.suggested_steps.items.properties.page_id.type },
                  message: "must be string,null",
                };
                if (vErrors === null) {
                  vErrors = [err85];
                } else {
                  vErrors.push(err85);
                }
                errors++;
              }
              if (typeof data28 === "string") {
                if (func1(data28) > 128) {
                  const err86 = {
                    instancePath: instancePath + "/suggested_steps/" + i3 + "/page_id",
                    schemaPath: "#/properties/suggested_steps/items/properties/page_id/maxLength",
                    keyword: "maxLength",
                    params: { limit: 128 },
                    message: "must NOT have more than 128 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err86];
                  } else {
                    vErrors.push(err86);
                  }
                  errors++;
                }
                if (func1(data28) < 1) {
                  const err87 = {
                    instancePath: instancePath + "/suggested_steps/" + i3 + "/page_id",
                    schemaPath: "#/properties/suggested_steps/items/properties/page_id/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
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
          } else {
            const err88 = {
              instancePath: instancePath + "/suggested_steps/" + i3,
              schemaPath: "#/properties/suggested_steps/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err88];
            } else {
              vErrors.push(err88);
            }
            errors++;
          }
        }
      } else {
        const err89 = {
          instancePath: instancePath + "/suggested_steps",
          schemaPath: "#/properties/suggested_steps/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err89];
        } else {
          vErrors.push(err89);
        }
        errors++;
      }
    }
    if (data.clarification_questions !== undefined) {
      let data29 = data.clarification_questions;
      if (Array.isArray(data29)) {
        if (data29.length > 8) {
          const err90 = {
            instancePath: instancePath + "/clarification_questions",
            schemaPath: "#/properties/clarification_questions/maxItems",
            keyword: "maxItems",
            params: { limit: 8 },
            message: "must NOT have more than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err90];
          } else {
            vErrors.push(err90);
          }
          errors++;
        }
        const len4 = data29.length;
        for (let i4 = 0; i4 < len4; i4++) {
          let data30 = data29[i4];
          if (typeof data30 === "string") {
            if (func1(data30) > 500) {
              const err91 = {
                instancePath: instancePath + "/clarification_questions/" + i4,
                schemaPath: "#/properties/clarification_questions/items/maxLength",
                keyword: "maxLength",
                params: { limit: 500 },
                message: "must NOT have more than 500 characters",
              };
              if (vErrors === null) {
                vErrors = [err91];
              } else {
                vErrors.push(err91);
              }
              errors++;
            }
            if (func1(data30) < 1) {
              const err92 = {
                instancePath: instancePath + "/clarification_questions/" + i4,
                schemaPath: "#/properties/clarification_questions/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/clarification_questions/" + i4,
              schemaPath: "#/properties/clarification_questions/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err93];
            } else {
              vErrors.push(err93);
            }
            errors++;
          }
        }
      } else {
        const err94 = {
          instancePath: instancePath + "/clarification_questions",
          schemaPath: "#/properties/clarification_questions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err94];
        } else {
          vErrors.push(err94);
        }
        errors++;
      }
    }
  } else {
    const err95 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err95];
    } else {
      vErrors.push(err95);
    }
    errors++;
  }
  validate22.errors = vErrors;
  return errors === 0;
}
validate22.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
