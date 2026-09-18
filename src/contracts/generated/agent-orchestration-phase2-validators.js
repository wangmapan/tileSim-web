// Generated Ajv standalone Phase 2B validators. Do not edit by hand.
/* eslint-disable */
"use strict";
export const modelProfileV2 = validate20;
const schema31 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-phase2/model-profile.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_model_profile.v2",
  allOf: [
    { $ref: "common.schema.json#/$defs/profileEnvelope" },
    {
      properties: {
        schema_identity: { const: "tilesim.bridge.agent_orchestration_model_profile.v2" },
        profile_family: { const: "model" },
        facts: {
          type: "object",
          additionalProperties: false,
          required: [
            "architecture",
            "parameter_count",
            "layer_count",
            "hidden_size",
            "expert_structure",
            "tensor_layout",
          ],
          properties: {
            architecture: { $ref: "common.schema.json#/$defs/stringFact" },
            parameter_count: { $ref: "common.schema.json#/$defs/uint64Fact" },
            layer_count: { $ref: "common.schema.json#/$defs/uint64Fact" },
            hidden_size: { $ref: "common.schema.json#/$defs/uint64Fact" },
            expert_structure: { $ref: "common.schema.json#/$defs/stringFact" },
            tensor_layout: { $ref: "common.schema.json#/$defs/stringFact" },
          },
        },
      },
    },
  ],
};
const schema33 = {
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "schema_revision",
    "profile_family",
    "profile_id",
    "profile_revision",
    "canonical_digest",
    "display",
    "source_reference",
    "source_kind",
    "license",
    "valid_regime",
    "lifecycle",
    "calibration_status",
    "calibration_binding",
    "held_out_validation_status",
    "held_out_validation_binding",
    "allowed_claim_scope",
    "sensitivity",
    "visibility",
    "facts",
  ],
  properties: {
    schema_identity: { $ref: "#/$defs/stableId" },
    schema_revision: { $ref: "#/$defs/sha256" },
    profile_family: { enum: ["model", "engine", "device", "topology", "workload"] },
    profile_id: { $ref: "#/$defs/stableId" },
    profile_revision: { $ref: "#/$defs/sha256" },
    canonical_digest: { $ref: "#/$defs/sha256" },
    display: {
      type: "object",
      additionalProperties: false,
      required: ["name", "description", "labels"],
      properties: {
        name: { type: "string", minLength: 1, maxLength: 160 },
        description: { type: "string", minLength: 1, maxLength: 1000 },
        labels: { type: "array", items: { type: "string", minLength: 1, maxLength: 80 }, uniqueItems: true },
      },
    },
    source_reference: { $ref: "#/$defs/stableId" },
    source_kind: { $ref: "#/$defs/sourceKind" },
    license: {
      type: "object",
      additionalProperties: false,
      required: ["spdx_id", "redistribution_allowed"],
      properties: {
        spdx_id: { type: "string", minLength: 1, maxLength: 80 },
        redistribution_allowed: { type: "boolean" },
        notice_reference: { type: ["string", "null"], maxLength: 512 },
      },
    },
    valid_regime: {
      type: "object",
      additionalProperties: false,
      required: ["description", "constraints"],
      properties: {
        description: { type: "string", minLength: 1, maxLength: 1000 },
        constraints: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1, maxLength: 300 },
          uniqueItems: true,
        },
      },
    },
    lifecycle: {
      type: "object",
      additionalProperties: false,
      required: ["introduced_at", "updated_at", "expires_at", "status"],
      properties: {
        introduced_at: { type: "string", format: "date-time" },
        updated_at: { type: "string", format: "date-time" },
        expires_at: { type: ["string", "null"], format: "date-time" },
        status: { enum: ["available", "deprecated", "expired", "revoked", "unavailable"] },
      },
    },
    calibration_status: { enum: ["not_applicable", "missing", "fixture_consistency_only", "calibrated"] },
    calibration_binding: { oneOf: [{ $ref: "#/$defs/stableReference" }, { type: "null" }] },
    held_out_validation_status: { enum: ["missing", "fixture_consistency_only", "validated"] },
    held_out_validation_binding: { oneOf: [{ $ref: "#/$defs/stableReference" }, { type: "null" }] },
    allowed_claim_scope: { $ref: "#/$defs/claimScope" },
    sensitivity: { enum: ["public", "internal", "restricted"] },
    visibility: { enum: ["catalog", "project", "private"] },
    facts: { type: "object", minProperties: 1 },
  },
  allOf: [
    {
      if: { properties: { source_kind: { enum: ["synthetic_trace", "compatibility_harness_trace", "user_input"] } } },
      then: {
        properties: {
          calibration_status: { not: { const: "calibrated" } },
          calibration_binding: { type: "null" },
          held_out_validation_status: { not: { const: "validated" } },
          held_out_validation_binding: { type: "null" },
          allowed_claim_scope: { enum: ["exploration", "synthetic_consistency"] },
        },
      },
    },
    {
      if: { properties: { calibration_status: { const: "calibrated" } }, required: ["calibration_status"] },
      then: { properties: { calibration_binding: { $ref: "#/$defs/stableReference" } } },
    },
    {
      if: {
        properties: { held_out_validation_status: { const: "validated" } },
        required: ["held_out_validation_status"],
      },
      then: { properties: { held_out_validation_binding: { $ref: "#/$defs/stableReference" } } },
    },
  ],
};
const schema35 = { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" };
const schema36 = { type: "string", pattern: "^sha256:[0-9a-f]{64}$" };
const schema44 = {
  enum: [
    "real_trace",
    "synthetic_trace",
    "compatibility_harness_trace",
    "reviewed_registry",
    "vendor_specification",
    "user_input",
  ],
};
const schema45 = {
  enum: [
    "exploration",
    "synthetic_consistency",
    "limited_extrapolation",
    "similar_regime_conditional_prediction",
    "real_calibrated_validation",
  ],
};
const schema34 = {
  type: "object",
  additionalProperties: false,
  required: ["identity", "revision", "digest"],
  properties: {
    identity: { $ref: "#/$defs/stableId" },
    revision: { $ref: "#/$defs/sha256" },
    digest: { $ref: "#/$defs/sha256" },
  },
};
const pattern4 = new RegExp("^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$", "u");
const pattern5 = new RegExp("^sha256:[0-9a-f]{64}$", "u");
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
    if (data.identity === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "identity" },
        message: "must have required property '" + "identity" + "'",
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
    if (data.digest === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "digest" },
        message: "must have required property '" + "digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "identity" || key0 === "revision" || key0 === "digest")) {
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
    if (data.identity !== undefined) {
      let data0 = data.identity;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err4 = {
            instancePath: instancePath + "/identity",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/identity",
          schemaPath: "#/$defs/stableId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.revision !== undefined) {
      let data1 = data.revision;
      if (typeof data1 === "string") {
        if (!pattern5.test(data1)) {
          const err6 = {
            instancePath: instancePath + "/revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.digest !== undefined) {
      let data2 = data.digest;
      if (typeof data2 === "string") {
        if (!pattern5.test(data2)) {
          const err8 = {
            instancePath: instancePath + "/digest",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/digest",
          schemaPath: "#/$defs/sha256/type",
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
  validate23.errors = vErrors;
  return errors === 0;
}
validate23.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const func1 = Object.prototype.hasOwnProperty;
import func2 from "ajv/dist/runtime/ucs2length";
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
  const _errs2 = errors;
  let valid1 = true;
  const _errs3 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.source_kind !== undefined) {
      let data0 = data.source_kind;
      if (!(data0 === "synthetic_trace" || data0 === "compatibility_harness_trace" || data0 === "user_input")) {
        const err0 = {};
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
  }
  var _valid0 = _errs3 === errors;
  errors = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs5 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.calibration_status !== undefined) {
        const _errs7 = errors;
        const _errs8 = errors;
        if ("calibrated" !== data.calibration_status) {
          const err1 = {};
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
        var valid4 = _errs8 === errors;
        if (valid4) {
          const err2 = {
            instancePath: instancePath + "/calibration_status",
            schemaPath: "#/allOf/0/then/properties/calibration_status/not",
            keyword: "not",
            params: {},
            message: "must NOT be valid",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        } else {
          errors = _errs7;
          if (vErrors !== null) {
            if (_errs7) {
              vErrors.length = _errs7;
            } else {
              vErrors = null;
            }
          }
        }
      }
      if (data.calibration_binding !== undefined) {
        if (data.calibration_binding !== null) {
          const err3 = {
            instancePath: instancePath + "/calibration_binding",
            schemaPath: "#/allOf/0/then/properties/calibration_binding/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      }
      if (data.held_out_validation_status !== undefined) {
        const _errs12 = errors;
        const _errs13 = errors;
        if ("validated" !== data.held_out_validation_status) {
          const err4 = {};
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        var valid5 = _errs13 === errors;
        if (valid5) {
          const err5 = {
            instancePath: instancePath + "/held_out_validation_status",
            schemaPath: "#/allOf/0/then/properties/held_out_validation_status/not",
            keyword: "not",
            params: {},
            message: "must NOT be valid",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        } else {
          errors = _errs12;
          if (vErrors !== null) {
            if (_errs12) {
              vErrors.length = _errs12;
            } else {
              vErrors = null;
            }
          }
        }
      }
      if (data.held_out_validation_binding !== undefined) {
        if (data.held_out_validation_binding !== null) {
          const err6 = {
            instancePath: instancePath + "/held_out_validation_binding",
            schemaPath: "#/allOf/0/then/properties/held_out_validation_binding/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
      if (data.allowed_claim_scope !== undefined) {
        let data5 = data.allowed_claim_scope;
        if (!(data5 === "exploration" || data5 === "synthetic_consistency")) {
          const err7 = {
            instancePath: instancePath + "/allowed_claim_scope",
            schemaPath: "#/allOf/0/then/properties/allowed_claim_scope/enum",
            keyword: "enum",
            params: { allowedValues: schema33.allOf[0].then.properties.allowed_claim_scope.enum },
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
    }
    var _valid0 = _errs5 === errors;
    valid1 = _valid0;
    if (valid1) {
      var props0 = {};
      props0.calibration_status = true;
      props0.calibration_binding = true;
      props0.held_out_validation_status = true;
      props0.held_out_validation_binding = true;
      props0.allowed_claim_scope = true;
      props0.source_kind = true;
    }
  }
  if (!valid1) {
    const err8 = {
      instancePath,
      schemaPath: "#/allOf/0/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  const _errs18 = errors;
  let valid6 = true;
  const _errs19 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (data.calibration_status === undefined && (missing0 = "calibration_status")) {
      const err9 = {};
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    } else {
      if (data.calibration_status !== undefined) {
        if ("calibrated" !== data.calibration_status) {
          const err10 = {};
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      }
    }
  }
  var _valid1 = _errs19 === errors;
  errors = _errs18;
  if (vErrors !== null) {
    if (_errs18) {
      vErrors.length = _errs18;
    } else {
      vErrors = null;
    }
  }
  if (_valid1) {
    const _errs21 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.calibration_binding !== undefined) {
        if (
          !validate23(data.calibration_binding, {
            instancePath: instancePath + "/calibration_binding",
            parentData: data,
            parentDataProperty: "calibration_binding",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid1 = _errs21 === errors;
    valid6 = _valid1;
    if (valid6) {
      var props1 = {};
      props1.calibration_binding = true;
      props1.calibration_status = true;
    }
  }
  if (!valid6) {
    const err11 = {
      instancePath,
      schemaPath: "#/allOf/1/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  if (props0 !== true && props1 !== undefined) {
    if (props1 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props1);
    }
  }
  const _errs24 = errors;
  let valid9 = true;
  const _errs25 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing1;
    if (data.held_out_validation_status === undefined && (missing1 = "held_out_validation_status")) {
      const err12 = {};
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    } else {
      if (data.held_out_validation_status !== undefined) {
        if ("validated" !== data.held_out_validation_status) {
          const err13 = {};
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      }
    }
  }
  var _valid2 = _errs25 === errors;
  errors = _errs24;
  if (vErrors !== null) {
    if (_errs24) {
      vErrors.length = _errs24;
    } else {
      vErrors = null;
    }
  }
  if (_valid2) {
    const _errs27 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.held_out_validation_binding !== undefined) {
        if (
          !validate23(data.held_out_validation_binding, {
            instancePath: instancePath + "/held_out_validation_binding",
            parentData: data,
            parentDataProperty: "held_out_validation_binding",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid2 = _errs27 === errors;
    valid9 = _valid2;
    if (valid9) {
      var props2 = {};
      props2.held_out_validation_binding = true;
      props2.held_out_validation_status = true;
    }
  }
  if (!valid9) {
    const err14 = {
      instancePath,
      schemaPath: "#/allOf/2/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  if (props0 !== true && props2 !== undefined) {
    if (props2 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props2);
    }
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_identity" },
        message: "must have required property '" + "schema_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.schema_revision === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_revision" },
        message: "must have required property '" + "schema_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    if (data.profile_family === undefined) {
      const err17 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_family" },
        message: "must have required property '" + "profile_family" + "'",
      };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    if (data.profile_id === undefined) {
      const err18 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_id" },
        message: "must have required property '" + "profile_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    if (data.profile_revision === undefined) {
      const err19 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_revision" },
        message: "must have required property '" + "profile_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err19];
      } else {
        vErrors.push(err19);
      }
      errors++;
    }
    if (data.canonical_digest === undefined) {
      const err20 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "canonical_digest" },
        message: "must have required property '" + "canonical_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err20];
      } else {
        vErrors.push(err20);
      }
      errors++;
    }
    if (data.display === undefined) {
      const err21 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "display" },
        message: "must have required property '" + "display" + "'",
      };
      if (vErrors === null) {
        vErrors = [err21];
      } else {
        vErrors.push(err21);
      }
      errors++;
    }
    if (data.source_reference === undefined) {
      const err22 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_reference" },
        message: "must have required property '" + "source_reference" + "'",
      };
      if (vErrors === null) {
        vErrors = [err22];
      } else {
        vErrors.push(err22);
      }
      errors++;
    }
    if (data.source_kind === undefined) {
      const err23 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_kind" },
        message: "must have required property '" + "source_kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err23];
      } else {
        vErrors.push(err23);
      }
      errors++;
    }
    if (data.license === undefined) {
      const err24 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "license" },
        message: "must have required property '" + "license" + "'",
      };
      if (vErrors === null) {
        vErrors = [err24];
      } else {
        vErrors.push(err24);
      }
      errors++;
    }
    if (data.valid_regime === undefined) {
      const err25 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "valid_regime" },
        message: "must have required property '" + "valid_regime" + "'",
      };
      if (vErrors === null) {
        vErrors = [err25];
      } else {
        vErrors.push(err25);
      }
      errors++;
    }
    if (data.lifecycle === undefined) {
      const err26 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "lifecycle" },
        message: "must have required property '" + "lifecycle" + "'",
      };
      if (vErrors === null) {
        vErrors = [err26];
      } else {
        vErrors.push(err26);
      }
      errors++;
    }
    if (data.calibration_status === undefined) {
      const err27 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calibration_status" },
        message: "must have required property '" + "calibration_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err27];
      } else {
        vErrors.push(err27);
      }
      errors++;
    }
    if (data.calibration_binding === undefined) {
      const err28 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calibration_binding" },
        message: "must have required property '" + "calibration_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err28];
      } else {
        vErrors.push(err28);
      }
      errors++;
    }
    if (data.held_out_validation_status === undefined) {
      const err29 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "held_out_validation_status" },
        message: "must have required property '" + "held_out_validation_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err29];
      } else {
        vErrors.push(err29);
      }
      errors++;
    }
    if (data.held_out_validation_binding === undefined) {
      const err30 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "held_out_validation_binding" },
        message: "must have required property '" + "held_out_validation_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err30];
      } else {
        vErrors.push(err30);
      }
      errors++;
    }
    if (data.allowed_claim_scope === undefined) {
      const err31 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "allowed_claim_scope" },
        message: "must have required property '" + "allowed_claim_scope" + "'",
      };
      if (vErrors === null) {
        vErrors = [err31];
      } else {
        vErrors.push(err31);
      }
      errors++;
    }
    if (data.sensitivity === undefined) {
      const err32 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "sensitivity" },
        message: "must have required property '" + "sensitivity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err32];
      } else {
        vErrors.push(err32);
      }
      errors++;
    }
    if (data.visibility === undefined) {
      const err33 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "visibility" },
        message: "must have required property '" + "visibility" + "'",
      };
      if (vErrors === null) {
        vErrors = [err33];
      } else {
        vErrors.push(err33);
      }
      errors++;
    }
    if (data.facts === undefined) {
      const err34 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "facts" },
        message: "must have required property '" + "facts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err34];
      } else {
        vErrors.push(err34);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema33.properties, key0)) {
        const err35 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.schema_identity !== undefined) {
      let data10 = data.schema_identity;
      if (typeof data10 === "string") {
        if (!pattern4.test(data10)) {
          const err36 = {
            instancePath: instancePath + "/schema_identity",
            schemaPath: "#/$defs/stableId/pattern",
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
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.schema_revision !== undefined) {
      let data11 = data.schema_revision;
      if (typeof data11 === "string") {
        if (!pattern5.test(data11)) {
          const err38 = {
            instancePath: instancePath + "/schema_revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/schema_revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.profile_family !== undefined) {
      let data12 = data.profile_family;
      if (!(
        data12 === "model" ||
        data12 === "engine" ||
        data12 === "device" ||
        data12 === "topology" ||
        data12 === "workload"
      )) {
        const err40 = {
          instancePath: instancePath + "/profile_family",
          schemaPath: "#/properties/profile_family/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.profile_family.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
    if (data.profile_id !== undefined) {
      let data13 = data.profile_id;
      if (typeof data13 === "string") {
        if (!pattern4.test(data13)) {
          const err41 = {
            instancePath: instancePath + "/profile_id",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/profile_id",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.profile_revision !== undefined) {
      let data14 = data.profile_revision;
      if (typeof data14 === "string") {
        if (!pattern5.test(data14)) {
          const err43 = {
            instancePath: instancePath + "/profile_revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/profile_revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.canonical_digest !== undefined) {
      let data15 = data.canonical_digest;
      if (typeof data15 === "string") {
        if (!pattern5.test(data15)) {
          const err45 = {
            instancePath: instancePath + "/canonical_digest",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/canonical_digest",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.display !== undefined) {
      let data16 = data.display;
      if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
        if (data16.name === undefined) {
          const err47 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "name" },
            message: "must have required property '" + "name" + "'",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
        if (data16.description === undefined) {
          const err48 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "description" },
            message: "must have required property '" + "description" + "'",
          };
          if (vErrors === null) {
            vErrors = [err48];
          } else {
            vErrors.push(err48);
          }
          errors++;
        }
        if (data16.labels === undefined) {
          const err49 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "labels" },
            message: "must have required property '" + "labels" + "'",
          };
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        for (const key1 in data16) {
          if (!(key1 === "name" || key1 === "description" || key1 === "labels")) {
            const err50 = {
              instancePath: instancePath + "/display",
              schemaPath: "#/properties/display/additionalProperties",
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
        if (data16.name !== undefined) {
          let data17 = data16.name;
          if (typeof data17 === "string") {
            if (func2(data17) > 160) {
              const err51 = {
                instancePath: instancePath + "/display/name",
                schemaPath: "#/properties/display/properties/name/maxLength",
                keyword: "maxLength",
                params: { limit: 160 },
                message: "must NOT have more than 160 characters",
              };
              if (vErrors === null) {
                vErrors = [err51];
              } else {
                vErrors.push(err51);
              }
              errors++;
            }
            if (func2(data17) < 1) {
              const err52 = {
                instancePath: instancePath + "/display/name",
                schemaPath: "#/properties/display/properties/name/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/display/name",
              schemaPath: "#/properties/display/properties/name/type",
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
        if (data16.description !== undefined) {
          let data18 = data16.description;
          if (typeof data18 === "string") {
            if (func2(data18) > 1000) {
              const err54 = {
                instancePath: instancePath + "/display/description",
                schemaPath: "#/properties/display/properties/description/maxLength",
                keyword: "maxLength",
                params: { limit: 1000 },
                message: "must NOT have more than 1000 characters",
              };
              if (vErrors === null) {
                vErrors = [err54];
              } else {
                vErrors.push(err54);
              }
              errors++;
            }
            if (func2(data18) < 1) {
              const err55 = {
                instancePath: instancePath + "/display/description",
                schemaPath: "#/properties/display/properties/description/minLength",
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
              instancePath: instancePath + "/display/description",
              schemaPath: "#/properties/display/properties/description/type",
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
        if (data16.labels !== undefined) {
          let data19 = data16.labels;
          if (Array.isArray(data19)) {
            const len0 = data19.length;
            for (let i0 = 0; i0 < len0; i0++) {
              let data20 = data19[i0];
              if (typeof data20 === "string") {
                if (func2(data20) > 80) {
                  const err57 = {
                    instancePath: instancePath + "/display/labels/" + i0,
                    schemaPath: "#/properties/display/properties/labels/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 80 },
                    message: "must NOT have more than 80 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err57];
                  } else {
                    vErrors.push(err57);
                  }
                  errors++;
                }
                if (func2(data20) < 1) {
                  const err58 = {
                    instancePath: instancePath + "/display/labels/" + i0,
                    schemaPath: "#/properties/display/properties/labels/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err58];
                  } else {
                    vErrors.push(err58);
                  }
                  errors++;
                }
              } else {
                const err59 = {
                  instancePath: instancePath + "/display/labels/" + i0,
                  schemaPath: "#/properties/display/properties/labels/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err59];
                } else {
                  vErrors.push(err59);
                }
                errors++;
              }
            }
            let i1 = data19.length;
            let j0;
            if (i1 > 1) {
              const indices0 = {};
              for (; i1--;) {
                let item0 = data19[i1];
                if (typeof item0 !== "string") {
                  continue;
                }
                if (typeof indices0[item0] == "number") {
                  j0 = indices0[item0];
                  const err60 = {
                    instancePath: instancePath + "/display/labels",
                    schemaPath: "#/properties/display/properties/labels/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i1, j: j0 },
                    message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err60];
                  } else {
                    vErrors.push(err60);
                  }
                  errors++;
                  break;
                }
                indices0[item0] = i1;
              }
            }
          } else {
            const err61 = {
              instancePath: instancePath + "/display/labels",
              schemaPath: "#/properties/display/properties/labels/type",
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
      } else {
        const err62 = {
          instancePath: instancePath + "/display",
          schemaPath: "#/properties/display/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err62];
        } else {
          vErrors.push(err62);
        }
        errors++;
      }
    }
    if (data.source_reference !== undefined) {
      let data21 = data.source_reference;
      if (typeof data21 === "string") {
        if (!pattern4.test(data21)) {
          const err63 = {
            instancePath: instancePath + "/source_reference",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/source_reference",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.source_kind !== undefined) {
      let data22 = data.source_kind;
      if (!(
        data22 === "real_trace" ||
        data22 === "synthetic_trace" ||
        data22 === "compatibility_harness_trace" ||
        data22 === "reviewed_registry" ||
        data22 === "vendor_specification" ||
        data22 === "user_input"
      )) {
        const err65 = {
          instancePath: instancePath + "/source_kind",
          schemaPath: "#/$defs/sourceKind/enum",
          keyword: "enum",
          params: { allowedValues: schema44.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err65];
        } else {
          vErrors.push(err65);
        }
        errors++;
      }
    }
    if (data.license !== undefined) {
      let data23 = data.license;
      if (data23 && typeof data23 == "object" && !Array.isArray(data23)) {
        if (data23.spdx_id === undefined) {
          const err66 = {
            instancePath: instancePath + "/license",
            schemaPath: "#/properties/license/required",
            keyword: "required",
            params: { missingProperty: "spdx_id" },
            message: "must have required property '" + "spdx_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err66];
          } else {
            vErrors.push(err66);
          }
          errors++;
        }
        if (data23.redistribution_allowed === undefined) {
          const err67 = {
            instancePath: instancePath + "/license",
            schemaPath: "#/properties/license/required",
            keyword: "required",
            params: { missingProperty: "redistribution_allowed" },
            message: "must have required property '" + "redistribution_allowed" + "'",
          };
          if (vErrors === null) {
            vErrors = [err67];
          } else {
            vErrors.push(err67);
          }
          errors++;
        }
        for (const key2 in data23) {
          if (!(key2 === "spdx_id" || key2 === "redistribution_allowed" || key2 === "notice_reference")) {
            const err68 = {
              instancePath: instancePath + "/license",
              schemaPath: "#/properties/license/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err68];
            } else {
              vErrors.push(err68);
            }
            errors++;
          }
        }
        if (data23.spdx_id !== undefined) {
          let data24 = data23.spdx_id;
          if (typeof data24 === "string") {
            if (func2(data24) > 80) {
              const err69 = {
                instancePath: instancePath + "/license/spdx_id",
                schemaPath: "#/properties/license/properties/spdx_id/maxLength",
                keyword: "maxLength",
                params: { limit: 80 },
                message: "must NOT have more than 80 characters",
              };
              if (vErrors === null) {
                vErrors = [err69];
              } else {
                vErrors.push(err69);
              }
              errors++;
            }
            if (func2(data24) < 1) {
              const err70 = {
                instancePath: instancePath + "/license/spdx_id",
                schemaPath: "#/properties/license/properties/spdx_id/minLength",
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
              instancePath: instancePath + "/license/spdx_id",
              schemaPath: "#/properties/license/properties/spdx_id/type",
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
        if (data23.redistribution_allowed !== undefined) {
          if (typeof data23.redistribution_allowed !== "boolean") {
            const err72 = {
              instancePath: instancePath + "/license/redistribution_allowed",
              schemaPath: "#/properties/license/properties/redistribution_allowed/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err72];
            } else {
              vErrors.push(err72);
            }
            errors++;
          }
        }
        if (data23.notice_reference !== undefined) {
          let data26 = data23.notice_reference;
          if (typeof data26 !== "string" && data26 !== null) {
            const err73 = {
              instancePath: instancePath + "/license/notice_reference",
              schemaPath: "#/properties/license/properties/notice_reference/type",
              keyword: "type",
              params: { type: schema33.properties.license.properties.notice_reference.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err73];
            } else {
              vErrors.push(err73);
            }
            errors++;
          }
          if (typeof data26 === "string") {
            if (func2(data26) > 512) {
              const err74 = {
                instancePath: instancePath + "/license/notice_reference",
                schemaPath: "#/properties/license/properties/notice_reference/maxLength",
                keyword: "maxLength",
                params: { limit: 512 },
                message: "must NOT have more than 512 characters",
              };
              if (vErrors === null) {
                vErrors = [err74];
              } else {
                vErrors.push(err74);
              }
              errors++;
            }
          }
        }
      } else {
        const err75 = {
          instancePath: instancePath + "/license",
          schemaPath: "#/properties/license/type",
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
    if (data.valid_regime !== undefined) {
      let data27 = data.valid_regime;
      if (data27 && typeof data27 == "object" && !Array.isArray(data27)) {
        if (data27.description === undefined) {
          const err76 = {
            instancePath: instancePath + "/valid_regime",
            schemaPath: "#/properties/valid_regime/required",
            keyword: "required",
            params: { missingProperty: "description" },
            message: "must have required property '" + "description" + "'",
          };
          if (vErrors === null) {
            vErrors = [err76];
          } else {
            vErrors.push(err76);
          }
          errors++;
        }
        if (data27.constraints === undefined) {
          const err77 = {
            instancePath: instancePath + "/valid_regime",
            schemaPath: "#/properties/valid_regime/required",
            keyword: "required",
            params: { missingProperty: "constraints" },
            message: "must have required property '" + "constraints" + "'",
          };
          if (vErrors === null) {
            vErrors = [err77];
          } else {
            vErrors.push(err77);
          }
          errors++;
        }
        for (const key3 in data27) {
          if (!(key3 === "description" || key3 === "constraints")) {
            const err78 = {
              instancePath: instancePath + "/valid_regime",
              schemaPath: "#/properties/valid_regime/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key3 },
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
        if (data27.description !== undefined) {
          let data28 = data27.description;
          if (typeof data28 === "string") {
            if (func2(data28) > 1000) {
              const err79 = {
                instancePath: instancePath + "/valid_regime/description",
                schemaPath: "#/properties/valid_regime/properties/description/maxLength",
                keyword: "maxLength",
                params: { limit: 1000 },
                message: "must NOT have more than 1000 characters",
              };
              if (vErrors === null) {
                vErrors = [err79];
              } else {
                vErrors.push(err79);
              }
              errors++;
            }
            if (func2(data28) < 1) {
              const err80 = {
                instancePath: instancePath + "/valid_regime/description",
                schemaPath: "#/properties/valid_regime/properties/description/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/valid_regime/description",
              schemaPath: "#/properties/valid_regime/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err81];
            } else {
              vErrors.push(err81);
            }
            errors++;
          }
        }
        if (data27.constraints !== undefined) {
          let data29 = data27.constraints;
          if (Array.isArray(data29)) {
            if (data29.length < 1) {
              const err82 = {
                instancePath: instancePath + "/valid_regime/constraints",
                schemaPath: "#/properties/valid_regime/properties/constraints/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              if (vErrors === null) {
                vErrors = [err82];
              } else {
                vErrors.push(err82);
              }
              errors++;
            }
            const len1 = data29.length;
            for (let i2 = 0; i2 < len1; i2++) {
              let data30 = data29[i2];
              if (typeof data30 === "string") {
                if (func2(data30) > 300) {
                  const err83 = {
                    instancePath: instancePath + "/valid_regime/constraints/" + i2,
                    schemaPath: "#/properties/valid_regime/properties/constraints/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 300 },
                    message: "must NOT have more than 300 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err83];
                  } else {
                    vErrors.push(err83);
                  }
                  errors++;
                }
                if (func2(data30) < 1) {
                  const err84 = {
                    instancePath: instancePath + "/valid_regime/constraints/" + i2,
                    schemaPath: "#/properties/valid_regime/properties/constraints/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err84];
                  } else {
                    vErrors.push(err84);
                  }
                  errors++;
                }
              } else {
                const err85 = {
                  instancePath: instancePath + "/valid_regime/constraints/" + i2,
                  schemaPath: "#/properties/valid_regime/properties/constraints/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err85];
                } else {
                  vErrors.push(err85);
                }
                errors++;
              }
            }
            let i3 = data29.length;
            let j1;
            if (i3 > 1) {
              const indices1 = {};
              for (; i3--;) {
                let item1 = data29[i3];
                if (typeof item1 !== "string") {
                  continue;
                }
                if (typeof indices1[item1] == "number") {
                  j1 = indices1[item1];
                  const err86 = {
                    instancePath: instancePath + "/valid_regime/constraints",
                    schemaPath: "#/properties/valid_regime/properties/constraints/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i3, j: j1 },
                    message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err86];
                  } else {
                    vErrors.push(err86);
                  }
                  errors++;
                  break;
                }
                indices1[item1] = i3;
              }
            }
          } else {
            const err87 = {
              instancePath: instancePath + "/valid_regime/constraints",
              schemaPath: "#/properties/valid_regime/properties/constraints/type",
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
      } else {
        const err88 = {
          instancePath: instancePath + "/valid_regime",
          schemaPath: "#/properties/valid_regime/type",
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
    if (data.lifecycle !== undefined) {
      let data31 = data.lifecycle;
      if (data31 && typeof data31 == "object" && !Array.isArray(data31)) {
        if (data31.introduced_at === undefined) {
          const err89 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "introduced_at" },
            message: "must have required property '" + "introduced_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err89];
          } else {
            vErrors.push(err89);
          }
          errors++;
        }
        if (data31.updated_at === undefined) {
          const err90 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "updated_at" },
            message: "must have required property '" + "updated_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err90];
          } else {
            vErrors.push(err90);
          }
          errors++;
        }
        if (data31.expires_at === undefined) {
          const err91 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "expires_at" },
            message: "must have required property '" + "expires_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err91];
          } else {
            vErrors.push(err91);
          }
          errors++;
        }
        if (data31.status === undefined) {
          const err92 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "status" },
            message: "must have required property '" + "status" + "'",
          };
          if (vErrors === null) {
            vErrors = [err92];
          } else {
            vErrors.push(err92);
          }
          errors++;
        }
        for (const key4 in data31) {
          if (!(key4 === "introduced_at" || key4 === "updated_at" || key4 === "expires_at" || key4 === "status")) {
            const err93 = {
              instancePath: instancePath + "/lifecycle",
              schemaPath: "#/properties/lifecycle/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key4 },
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
        if (data31.introduced_at !== undefined) {
          if (!(typeof data31.introduced_at === "string")) {
            const err94 = {
              instancePath: instancePath + "/lifecycle/introduced_at",
              schemaPath: "#/properties/lifecycle/properties/introduced_at/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err94];
            } else {
              vErrors.push(err94);
            }
            errors++;
          }
        }
        if (data31.updated_at !== undefined) {
          if (!(typeof data31.updated_at === "string")) {
            const err95 = {
              instancePath: instancePath + "/lifecycle/updated_at",
              schemaPath: "#/properties/lifecycle/properties/updated_at/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err95];
            } else {
              vErrors.push(err95);
            }
            errors++;
          }
        }
        if (data31.expires_at !== undefined) {
          let data34 = data31.expires_at;
          if (typeof data34 !== "string" && data34 !== null) {
            const err96 = {
              instancePath: instancePath + "/lifecycle/expires_at",
              schemaPath: "#/properties/lifecycle/properties/expires_at/type",
              keyword: "type",
              params: { type: schema33.properties.lifecycle.properties.expires_at.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err96];
            } else {
              vErrors.push(err96);
            }
            errors++;
          }
        }
        if (data31.status !== undefined) {
          let data35 = data31.status;
          if (!(
            data35 === "available" ||
            data35 === "deprecated" ||
            data35 === "expired" ||
            data35 === "revoked" ||
            data35 === "unavailable"
          )) {
            const err97 = {
              instancePath: instancePath + "/lifecycle/status",
              schemaPath: "#/properties/lifecycle/properties/status/enum",
              keyword: "enum",
              params: { allowedValues: schema33.properties.lifecycle.properties.status.enum },
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
      } else {
        const err98 = {
          instancePath: instancePath + "/lifecycle",
          schemaPath: "#/properties/lifecycle/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err98];
        } else {
          vErrors.push(err98);
        }
        errors++;
      }
    }
    if (data.calibration_status !== undefined) {
      let data36 = data.calibration_status;
      if (!(
        data36 === "not_applicable" ||
        data36 === "missing" ||
        data36 === "fixture_consistency_only" ||
        data36 === "calibrated"
      )) {
        const err99 = {
          instancePath: instancePath + "/calibration_status",
          schemaPath: "#/properties/calibration_status/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.calibration_status.enum },
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
    if (data.calibration_binding !== undefined) {
      let data37 = data.calibration_binding;
      const _errs92 = errors;
      let valid30 = false;
      let passing0 = null;
      const _errs93 = errors;
      if (
        !validate23(data37, {
          instancePath: instancePath + "/calibration_binding",
          parentData: data,
          parentDataProperty: "calibration_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
      var _valid3 = _errs93 === errors;
      if (_valid3) {
        valid30 = true;
        passing0 = 0;
      }
      const _errs94 = errors;
      if (data37 !== null) {
        const err100 = {
          instancePath: instancePath + "/calibration_binding",
          schemaPath: "#/properties/calibration_binding/oneOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err100];
        } else {
          vErrors.push(err100);
        }
        errors++;
      }
      var _valid3 = _errs94 === errors;
      if (_valid3 && valid30) {
        valid30 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid3) {
          valid30 = true;
          passing0 = 1;
        }
      }
      if (!valid30) {
        const err101 = {
          instancePath: instancePath + "/calibration_binding",
          schemaPath: "#/properties/calibration_binding/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing0 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err101];
        } else {
          vErrors.push(err101);
        }
        errors++;
      } else {
        errors = _errs92;
        if (vErrors !== null) {
          if (_errs92) {
            vErrors.length = _errs92;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.held_out_validation_status !== undefined) {
      let data38 = data.held_out_validation_status;
      if (!(data38 === "missing" || data38 === "fixture_consistency_only" || data38 === "validated")) {
        const err102 = {
          instancePath: instancePath + "/held_out_validation_status",
          schemaPath: "#/properties/held_out_validation_status/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.held_out_validation_status.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err102];
        } else {
          vErrors.push(err102);
        }
        errors++;
      }
    }
    if (data.held_out_validation_binding !== undefined) {
      let data39 = data.held_out_validation_binding;
      const _errs98 = errors;
      let valid31 = false;
      let passing1 = null;
      const _errs99 = errors;
      if (
        !validate23(data39, {
          instancePath: instancePath + "/held_out_validation_binding",
          parentData: data,
          parentDataProperty: "held_out_validation_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
      var _valid4 = _errs99 === errors;
      if (_valid4) {
        valid31 = true;
        passing1 = 0;
      }
      const _errs100 = errors;
      if (data39 !== null) {
        const err103 = {
          instancePath: instancePath + "/held_out_validation_binding",
          schemaPath: "#/properties/held_out_validation_binding/oneOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err103];
        } else {
          vErrors.push(err103);
        }
        errors++;
      }
      var _valid4 = _errs100 === errors;
      if (_valid4 && valid31) {
        valid31 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid4) {
          valid31 = true;
          passing1 = 1;
        }
      }
      if (!valid31) {
        const err104 = {
          instancePath: instancePath + "/held_out_validation_binding",
          schemaPath: "#/properties/held_out_validation_binding/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing1 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err104];
        } else {
          vErrors.push(err104);
        }
        errors++;
      } else {
        errors = _errs98;
        if (vErrors !== null) {
          if (_errs98) {
            vErrors.length = _errs98;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.allowed_claim_scope !== undefined) {
      let data40 = data.allowed_claim_scope;
      if (!(
        data40 === "exploration" ||
        data40 === "synthetic_consistency" ||
        data40 === "limited_extrapolation" ||
        data40 === "similar_regime_conditional_prediction" ||
        data40 === "real_calibrated_validation"
      )) {
        const err105 = {
          instancePath: instancePath + "/allowed_claim_scope",
          schemaPath: "#/$defs/claimScope/enum",
          keyword: "enum",
          params: { allowedValues: schema45.enum },
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
    if (data.sensitivity !== undefined) {
      let data41 = data.sensitivity;
      if (!(data41 === "public" || data41 === "internal" || data41 === "restricted")) {
        const err106 = {
          instancePath: instancePath + "/sensitivity",
          schemaPath: "#/properties/sensitivity/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.sensitivity.enum },
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
    if (data.visibility !== undefined) {
      let data42 = data.visibility;
      if (!(data42 === "catalog" || data42 === "project" || data42 === "private")) {
        const err107 = {
          instancePath: instancePath + "/visibility",
          schemaPath: "#/properties/visibility/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.visibility.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err107];
        } else {
          vErrors.push(err107);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data43 = data.facts;
      if (data43 && typeof data43 == "object" && !Array.isArray(data43)) {
        if (Object.keys(data43).length < 1) {
          const err108 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/properties/facts/minProperties",
            keyword: "minProperties",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 properties",
          };
          if (vErrors === null) {
            vErrors = [err108];
          } else {
            vErrors.push(err108);
          }
          errors++;
        }
      } else {
        const err109 = {
          instancePath: instancePath + "/facts",
          schemaPath: "#/properties/facts/type",
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
  } else {
    const err110 = {
      instancePath,
      schemaPath: "#/type",
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
  validate22.errors = vErrors;
  return errors === 0;
}
validate22.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const schema46 = { allOf: [{ $ref: "#/$defs/fact" }, { properties: { value: { type: "string", minLength: 1 } } }] };
const schema47 = {
  type: "object",
  additionalProperties: false,
  required: ["value", "unit", "provenance"],
  properties: {
    value: {},
    unit: { type: ["string", "null"], maxLength: 64 },
    provenance: { $ref: "#/$defs/fieldProvenance" },
  },
};
const schema48 = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "source_reference", "source_field", "evidence_scope"],
  properties: {
    kind: { enum: ["observed", "externally_specified", "inferred", "modelled", "user_supplied"] },
    source_reference: { $ref: "#/$defs/stableId" },
    source_field: { type: "string", minLength: 1, maxLength: 512 },
    observed_at: { type: ["string", "null"], format: "date-time" },
    confidence: { $ref: "#/$defs/decimal" },
    evidence_scope: { $ref: "#/$defs/claimScope" },
  },
};
const schema50 = { type: "string", pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$", not: { pattern: "^-0(?:\\.0+)?$" } };
const pattern14 = new RegExp("^-0(?:\\.0+)?$", "u");
const pattern15 = new RegExp("^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$", "u");
function validate31(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate31.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.source_reference === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_reference" },
        message: "must have required property '" + "source_reference" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.source_field === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_field" },
        message: "must have required property '" + "source_field" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.evidence_scope === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "evidence_scope" },
        message: "must have required property '" + "evidence_scope" + "'",
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
        key0 === "kind" ||
        key0 === "source_reference" ||
        key0 === "source_field" ||
        key0 === "observed_at" ||
        key0 === "confidence" ||
        key0 === "evidence_scope"
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
    if (data.kind !== undefined) {
      let data0 = data.kind;
      if (!(
        data0 === "observed" ||
        data0 === "externally_specified" ||
        data0 === "inferred" ||
        data0 === "modelled" ||
        data0 === "user_supplied"
      )) {
        const err5 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/enum",
          keyword: "enum",
          params: { allowedValues: schema48.properties.kind.enum },
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
    if (data.source_reference !== undefined) {
      let data1 = data.source_reference;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err6 = {
            instancePath: instancePath + "/source_reference",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/source_reference",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.source_field !== undefined) {
      let data2 = data.source_field;
      if (typeof data2 === "string") {
        if (func2(data2) > 512) {
          const err8 = {
            instancePath: instancePath + "/source_field",
            schemaPath: "#/properties/source_field/maxLength",
            keyword: "maxLength",
            params: { limit: 512 },
            message: "must NOT have more than 512 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err9 = {
            instancePath: instancePath + "/source_field",
            schemaPath: "#/properties/source_field/minLength",
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
          instancePath: instancePath + "/source_field",
          schemaPath: "#/properties/source_field/type",
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
    if (data.observed_at !== undefined) {
      let data3 = data.observed_at;
      if (typeof data3 !== "string" && data3 !== null) {
        const err11 = {
          instancePath: instancePath + "/observed_at",
          schemaPath: "#/properties/observed_at/type",
          keyword: "type",
          params: { type: schema48.properties.observed_at.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.confidence !== undefined) {
      let data4 = data.confidence;
      const _errs13 = errors;
      const _errs14 = errors;
      if (typeof data4 === "string") {
        if (!pattern14.test(data4)) {
          const err12 = {};
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      }
      var valid3 = _errs14 === errors;
      if (valid3) {
        const err13 = {
          instancePath: instancePath + "/confidence",
          schemaPath: "#/$defs/decimal/not",
          keyword: "not",
          params: {},
          message: "must NOT be valid",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      } else {
        errors = _errs13;
        if (vErrors !== null) {
          if (_errs13) {
            vErrors.length = _errs13;
          } else {
            vErrors = null;
          }
        }
      }
      if (typeof data4 === "string") {
        if (!pattern15.test(data4)) {
          const err14 = {
            instancePath: instancePath + "/confidence",
            schemaPath: "#/$defs/decimal/pattern",
            keyword: "pattern",
            params: { pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" },
            message: 'must match pattern "' + "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" + '"',
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
          instancePath: instancePath + "/confidence",
          schemaPath: "#/$defs/decimal/type",
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
    if (data.evidence_scope !== undefined) {
      let data5 = data.evidence_scope;
      if (!(
        data5 === "exploration" ||
        data5 === "synthetic_consistency" ||
        data5 === "limited_extrapolation" ||
        data5 === "similar_regime_conditional_prediction" ||
        data5 === "real_calibrated_validation"
      )) {
        const err16 = {
          instancePath: instancePath + "/evidence_scope",
          schemaPath: "#/$defs/claimScope/enum",
          keyword: "enum",
          params: { allowedValues: schema45.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
  } else {
    const err17 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err17];
    } else {
      vErrors.push(err17);
    }
    errors++;
  }
  validate31.errors = vErrors;
  return errors === 0;
}
validate31.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate30(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate30.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "value" },
        message: "must have required property '" + "value" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.unit === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "unit" },
        message: "must have required property '" + "unit" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.provenance === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "provenance" },
        message: "must have required property '" + "provenance" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "value" || key0 === "unit" || key0 === "provenance")) {
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
    if (data.unit !== undefined) {
      let data0 = data.unit;
      if (typeof data0 !== "string" && data0 !== null) {
        const err4 = {
          instancePath: instancePath + "/unit",
          schemaPath: "#/properties/unit/type",
          keyword: "type",
          params: { type: schema47.properties.unit.type },
          message: "must be string,null",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
      if (typeof data0 === "string") {
        if (func2(data0) > 64) {
          const err5 = {
            instancePath: instancePath + "/unit",
            schemaPath: "#/properties/unit/maxLength",
            keyword: "maxLength",
            params: { limit: 64 },
            message: "must NOT have more than 64 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      }
    }
    if (data.provenance !== undefined) {
      if (
        !validate31(data.provenance, {
          instancePath: instancePath + "/provenance",
          parentData: data,
          parentDataProperty: "provenance",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err6 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err6];
    } else {
      vErrors.push(err6);
    }
    errors++;
  }
  validate30.errors = vErrors;
  return errors === 0;
}
validate30.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate29(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate29.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value !== undefined) {
      let data0 = data.value;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err0 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/allOf/1/properties/value/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
      } else {
        const err1 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/allOf/1/properties/value/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
  }
  validate29.errors = vErrors;
  return errors === 0;
}
validate29.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const schema52 = { allOf: [{ $ref: "#/$defs/fact" }, { properties: { value: { $ref: "#/$defs/uint64" } } }] };
const schema53 = { type: "string", pattern: "^(0|[1-9][0-9]{0,19})$", "x-tilesim-maximum": "18446744073709551615" };
const pattern16 = new RegExp("^(0|[1-9][0-9]{0,19})$", "u");
function validate35(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate35.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value !== undefined) {
      let data0 = data.value;
      if (typeof data0 === "string") {
        if (!pattern16.test(data0)) {
          const err0 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/$defs/uint64/pattern",
            keyword: "pattern",
            params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
            message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
      } else {
        const err1 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/$defs/uint64/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
  }
  validate35.errors = vErrors;
  return errors === 0;
}
validate35.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate20(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-phase2/model-profile.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate22(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_model_profile.v2" !== data.schema_identity) {
        const err0 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/allOf/1/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_model_profile.v2" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.profile_family !== undefined) {
      if ("model" !== data.profile_family) {
        const err1 = {
          instancePath: instancePath + "/profile_family",
          schemaPath: "#/allOf/1/properties/profile_family/const",
          keyword: "const",
          params: { allowedValue: "model" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data2 = data.facts;
      if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
        if (data2.architecture === undefined) {
          const err2 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "architecture" },
            message: "must have required property '" + "architecture" + "'",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (data2.parameter_count === undefined) {
          const err3 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "parameter_count" },
            message: "must have required property '" + "parameter_count" + "'",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (data2.layer_count === undefined) {
          const err4 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "layer_count" },
            message: "must have required property '" + "layer_count" + "'",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (data2.hidden_size === undefined) {
          const err5 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "hidden_size" },
            message: "must have required property '" + "hidden_size" + "'",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (data2.expert_structure === undefined) {
          const err6 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "expert_structure" },
            message: "must have required property '" + "expert_structure" + "'",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (data2.tensor_layout === undefined) {
          const err7 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "tensor_layout" },
            message: "must have required property '" + "tensor_layout" + "'",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        for (const key0 in data2) {
          if (!(
            key0 === "architecture" ||
            key0 === "parameter_count" ||
            key0 === "layer_count" ||
            key0 === "hidden_size" ||
            key0 === "expert_structure" ||
            key0 === "tensor_layout"
          )) {
            const err8 = {
              instancePath: instancePath + "/facts",
              schemaPath: "#/allOf/1/properties/facts/additionalProperties",
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
        if (data2.architecture !== undefined) {
          if (
            !validate29(data2.architecture, {
              instancePath: instancePath + "/facts/architecture",
              parentData: data2,
              parentDataProperty: "architecture",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate29.errors : vErrors.concat(validate29.errors);
            errors = vErrors.length;
          }
        }
        if (data2.parameter_count !== undefined) {
          if (
            !validate35(data2.parameter_count, {
              instancePath: instancePath + "/facts/parameter_count",
              parentData: data2,
              parentDataProperty: "parameter_count",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
            errors = vErrors.length;
          }
        }
        if (data2.layer_count !== undefined) {
          if (
            !validate35(data2.layer_count, {
              instancePath: instancePath + "/facts/layer_count",
              parentData: data2,
              parentDataProperty: "layer_count",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
            errors = vErrors.length;
          }
        }
        if (data2.hidden_size !== undefined) {
          if (
            !validate35(data2.hidden_size, {
              instancePath: instancePath + "/facts/hidden_size",
              parentData: data2,
              parentDataProperty: "hidden_size",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate35.errors : vErrors.concat(validate35.errors);
            errors = vErrors.length;
          }
        }
        if (data2.expert_structure !== undefined) {
          if (
            !validate29(data2.expert_structure, {
              instancePath: instancePath + "/facts/expert_structure",
              parentData: data2,
              parentDataProperty: "expert_structure",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate29.errors : vErrors.concat(validate29.errors);
            errors = vErrors.length;
          }
        }
        if (data2.tensor_layout !== undefined) {
          if (
            !validate29(data2.tensor_layout, {
              instancePath: instancePath + "/facts/tensor_layout",
              parentData: data2,
              parentDataProperty: "tensor_layout",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate29.errors : vErrors.concat(validate29.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/facts",
          schemaPath: "#/allOf/1/properties/facts/type",
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
    }
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const engineProfileV2 = validate42;
const schema54 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-phase2/engine-profile.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_engine_profile.v2",
  allOf: [
    { $ref: "common.schema.json#/$defs/profileEnvelope" },
    {
      properties: {
        schema_identity: { const: "tilesim.bridge.agent_orchestration_engine_profile.v2" },
        profile_family: { const: "engine" },
        facts: {
          type: "object",
          additionalProperties: false,
          required: ["engine_name", "engine_version", "semantic_profile", "batching_policy", "supported_features"],
          properties: {
            engine_name: { $ref: "common.schema.json#/$defs/stringFact" },
            engine_version: { $ref: "common.schema.json#/$defs/stringFact" },
            semantic_profile: { $ref: "common.schema.json#/$defs/stringFact" },
            batching_policy: { $ref: "common.schema.json#/$defs/stringFact" },
            supported_features: { $ref: "common.schema.json#/$defs/stringArrayFact" },
          },
        },
      },
    },
  ],
};
function validate43(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate43.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs2 = errors;
  let valid1 = true;
  const _errs3 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.source_kind !== undefined) {
      let data0 = data.source_kind;
      if (!(data0 === "synthetic_trace" || data0 === "compatibility_harness_trace" || data0 === "user_input")) {
        const err0 = {};
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
  }
  var _valid0 = _errs3 === errors;
  errors = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs5 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.calibration_status !== undefined) {
        const _errs7 = errors;
        const _errs8 = errors;
        if ("calibrated" !== data.calibration_status) {
          const err1 = {};
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
        var valid4 = _errs8 === errors;
        if (valid4) {
          const err2 = {
            instancePath: instancePath + "/calibration_status",
            schemaPath: "#/allOf/0/then/properties/calibration_status/not",
            keyword: "not",
            params: {},
            message: "must NOT be valid",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        } else {
          errors = _errs7;
          if (vErrors !== null) {
            if (_errs7) {
              vErrors.length = _errs7;
            } else {
              vErrors = null;
            }
          }
        }
      }
      if (data.calibration_binding !== undefined) {
        if (data.calibration_binding !== null) {
          const err3 = {
            instancePath: instancePath + "/calibration_binding",
            schemaPath: "#/allOf/0/then/properties/calibration_binding/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      }
      if (data.held_out_validation_status !== undefined) {
        const _errs12 = errors;
        const _errs13 = errors;
        if ("validated" !== data.held_out_validation_status) {
          const err4 = {};
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        var valid5 = _errs13 === errors;
        if (valid5) {
          const err5 = {
            instancePath: instancePath + "/held_out_validation_status",
            schemaPath: "#/allOf/0/then/properties/held_out_validation_status/not",
            keyword: "not",
            params: {},
            message: "must NOT be valid",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        } else {
          errors = _errs12;
          if (vErrors !== null) {
            if (_errs12) {
              vErrors.length = _errs12;
            } else {
              vErrors = null;
            }
          }
        }
      }
      if (data.held_out_validation_binding !== undefined) {
        if (data.held_out_validation_binding !== null) {
          const err6 = {
            instancePath: instancePath + "/held_out_validation_binding",
            schemaPath: "#/allOf/0/then/properties/held_out_validation_binding/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
      if (data.allowed_claim_scope !== undefined) {
        let data5 = data.allowed_claim_scope;
        if (!(data5 === "exploration" || data5 === "synthetic_consistency")) {
          const err7 = {
            instancePath: instancePath + "/allowed_claim_scope",
            schemaPath: "#/allOf/0/then/properties/allowed_claim_scope/enum",
            keyword: "enum",
            params: { allowedValues: schema33.allOf[0].then.properties.allowed_claim_scope.enum },
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
    }
    var _valid0 = _errs5 === errors;
    valid1 = _valid0;
    if (valid1) {
      var props0 = {};
      props0.calibration_status = true;
      props0.calibration_binding = true;
      props0.held_out_validation_status = true;
      props0.held_out_validation_binding = true;
      props0.allowed_claim_scope = true;
      props0.source_kind = true;
    }
  }
  if (!valid1) {
    const err8 = {
      instancePath,
      schemaPath: "#/allOf/0/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  const _errs18 = errors;
  let valid6 = true;
  const _errs19 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (data.calibration_status === undefined && (missing0 = "calibration_status")) {
      const err9 = {};
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    } else {
      if (data.calibration_status !== undefined) {
        if ("calibrated" !== data.calibration_status) {
          const err10 = {};
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      }
    }
  }
  var _valid1 = _errs19 === errors;
  errors = _errs18;
  if (vErrors !== null) {
    if (_errs18) {
      vErrors.length = _errs18;
    } else {
      vErrors = null;
    }
  }
  if (_valid1) {
    const _errs21 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.calibration_binding !== undefined) {
        if (
          !validate23(data.calibration_binding, {
            instancePath: instancePath + "/calibration_binding",
            parentData: data,
            parentDataProperty: "calibration_binding",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid1 = _errs21 === errors;
    valid6 = _valid1;
    if (valid6) {
      var props1 = {};
      props1.calibration_binding = true;
      props1.calibration_status = true;
    }
  }
  if (!valid6) {
    const err11 = {
      instancePath,
      schemaPath: "#/allOf/1/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  if (props0 !== true && props1 !== undefined) {
    if (props1 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props1);
    }
  }
  const _errs24 = errors;
  let valid9 = true;
  const _errs25 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing1;
    if (data.held_out_validation_status === undefined && (missing1 = "held_out_validation_status")) {
      const err12 = {};
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    } else {
      if (data.held_out_validation_status !== undefined) {
        if ("validated" !== data.held_out_validation_status) {
          const err13 = {};
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      }
    }
  }
  var _valid2 = _errs25 === errors;
  errors = _errs24;
  if (vErrors !== null) {
    if (_errs24) {
      vErrors.length = _errs24;
    } else {
      vErrors = null;
    }
  }
  if (_valid2) {
    const _errs27 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.held_out_validation_binding !== undefined) {
        if (
          !validate23(data.held_out_validation_binding, {
            instancePath: instancePath + "/held_out_validation_binding",
            parentData: data,
            parentDataProperty: "held_out_validation_binding",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid2 = _errs27 === errors;
    valid9 = _valid2;
    if (valid9) {
      var props2 = {};
      props2.held_out_validation_binding = true;
      props2.held_out_validation_status = true;
    }
  }
  if (!valid9) {
    const err14 = {
      instancePath,
      schemaPath: "#/allOf/2/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  if (props0 !== true && props2 !== undefined) {
    if (props2 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props2);
    }
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_identity" },
        message: "must have required property '" + "schema_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.schema_revision === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_revision" },
        message: "must have required property '" + "schema_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    if (data.profile_family === undefined) {
      const err17 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_family" },
        message: "must have required property '" + "profile_family" + "'",
      };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    if (data.profile_id === undefined) {
      const err18 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_id" },
        message: "must have required property '" + "profile_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    if (data.profile_revision === undefined) {
      const err19 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_revision" },
        message: "must have required property '" + "profile_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err19];
      } else {
        vErrors.push(err19);
      }
      errors++;
    }
    if (data.canonical_digest === undefined) {
      const err20 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "canonical_digest" },
        message: "must have required property '" + "canonical_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err20];
      } else {
        vErrors.push(err20);
      }
      errors++;
    }
    if (data.display === undefined) {
      const err21 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "display" },
        message: "must have required property '" + "display" + "'",
      };
      if (vErrors === null) {
        vErrors = [err21];
      } else {
        vErrors.push(err21);
      }
      errors++;
    }
    if (data.source_reference === undefined) {
      const err22 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_reference" },
        message: "must have required property '" + "source_reference" + "'",
      };
      if (vErrors === null) {
        vErrors = [err22];
      } else {
        vErrors.push(err22);
      }
      errors++;
    }
    if (data.source_kind === undefined) {
      const err23 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_kind" },
        message: "must have required property '" + "source_kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err23];
      } else {
        vErrors.push(err23);
      }
      errors++;
    }
    if (data.license === undefined) {
      const err24 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "license" },
        message: "must have required property '" + "license" + "'",
      };
      if (vErrors === null) {
        vErrors = [err24];
      } else {
        vErrors.push(err24);
      }
      errors++;
    }
    if (data.valid_regime === undefined) {
      const err25 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "valid_regime" },
        message: "must have required property '" + "valid_regime" + "'",
      };
      if (vErrors === null) {
        vErrors = [err25];
      } else {
        vErrors.push(err25);
      }
      errors++;
    }
    if (data.lifecycle === undefined) {
      const err26 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "lifecycle" },
        message: "must have required property '" + "lifecycle" + "'",
      };
      if (vErrors === null) {
        vErrors = [err26];
      } else {
        vErrors.push(err26);
      }
      errors++;
    }
    if (data.calibration_status === undefined) {
      const err27 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calibration_status" },
        message: "must have required property '" + "calibration_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err27];
      } else {
        vErrors.push(err27);
      }
      errors++;
    }
    if (data.calibration_binding === undefined) {
      const err28 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calibration_binding" },
        message: "must have required property '" + "calibration_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err28];
      } else {
        vErrors.push(err28);
      }
      errors++;
    }
    if (data.held_out_validation_status === undefined) {
      const err29 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "held_out_validation_status" },
        message: "must have required property '" + "held_out_validation_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err29];
      } else {
        vErrors.push(err29);
      }
      errors++;
    }
    if (data.held_out_validation_binding === undefined) {
      const err30 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "held_out_validation_binding" },
        message: "must have required property '" + "held_out_validation_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err30];
      } else {
        vErrors.push(err30);
      }
      errors++;
    }
    if (data.allowed_claim_scope === undefined) {
      const err31 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "allowed_claim_scope" },
        message: "must have required property '" + "allowed_claim_scope" + "'",
      };
      if (vErrors === null) {
        vErrors = [err31];
      } else {
        vErrors.push(err31);
      }
      errors++;
    }
    if (data.sensitivity === undefined) {
      const err32 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "sensitivity" },
        message: "must have required property '" + "sensitivity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err32];
      } else {
        vErrors.push(err32);
      }
      errors++;
    }
    if (data.visibility === undefined) {
      const err33 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "visibility" },
        message: "must have required property '" + "visibility" + "'",
      };
      if (vErrors === null) {
        vErrors = [err33];
      } else {
        vErrors.push(err33);
      }
      errors++;
    }
    if (data.facts === undefined) {
      const err34 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "facts" },
        message: "must have required property '" + "facts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err34];
      } else {
        vErrors.push(err34);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema33.properties, key0)) {
        const err35 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.schema_identity !== undefined) {
      let data10 = data.schema_identity;
      if (typeof data10 === "string") {
        if (!pattern4.test(data10)) {
          const err36 = {
            instancePath: instancePath + "/schema_identity",
            schemaPath: "#/$defs/stableId/pattern",
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
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.schema_revision !== undefined) {
      let data11 = data.schema_revision;
      if (typeof data11 === "string") {
        if (!pattern5.test(data11)) {
          const err38 = {
            instancePath: instancePath + "/schema_revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/schema_revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.profile_family !== undefined) {
      let data12 = data.profile_family;
      if (!(
        data12 === "model" ||
        data12 === "engine" ||
        data12 === "device" ||
        data12 === "topology" ||
        data12 === "workload"
      )) {
        const err40 = {
          instancePath: instancePath + "/profile_family",
          schemaPath: "#/properties/profile_family/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.profile_family.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
    if (data.profile_id !== undefined) {
      let data13 = data.profile_id;
      if (typeof data13 === "string") {
        if (!pattern4.test(data13)) {
          const err41 = {
            instancePath: instancePath + "/profile_id",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/profile_id",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.profile_revision !== undefined) {
      let data14 = data.profile_revision;
      if (typeof data14 === "string") {
        if (!pattern5.test(data14)) {
          const err43 = {
            instancePath: instancePath + "/profile_revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/profile_revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.canonical_digest !== undefined) {
      let data15 = data.canonical_digest;
      if (typeof data15 === "string") {
        if (!pattern5.test(data15)) {
          const err45 = {
            instancePath: instancePath + "/canonical_digest",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/canonical_digest",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.display !== undefined) {
      let data16 = data.display;
      if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
        if (data16.name === undefined) {
          const err47 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "name" },
            message: "must have required property '" + "name" + "'",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
        if (data16.description === undefined) {
          const err48 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "description" },
            message: "must have required property '" + "description" + "'",
          };
          if (vErrors === null) {
            vErrors = [err48];
          } else {
            vErrors.push(err48);
          }
          errors++;
        }
        if (data16.labels === undefined) {
          const err49 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "labels" },
            message: "must have required property '" + "labels" + "'",
          };
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        for (const key1 in data16) {
          if (!(key1 === "name" || key1 === "description" || key1 === "labels")) {
            const err50 = {
              instancePath: instancePath + "/display",
              schemaPath: "#/properties/display/additionalProperties",
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
        if (data16.name !== undefined) {
          let data17 = data16.name;
          if (typeof data17 === "string") {
            if (func2(data17) > 160) {
              const err51 = {
                instancePath: instancePath + "/display/name",
                schemaPath: "#/properties/display/properties/name/maxLength",
                keyword: "maxLength",
                params: { limit: 160 },
                message: "must NOT have more than 160 characters",
              };
              if (vErrors === null) {
                vErrors = [err51];
              } else {
                vErrors.push(err51);
              }
              errors++;
            }
            if (func2(data17) < 1) {
              const err52 = {
                instancePath: instancePath + "/display/name",
                schemaPath: "#/properties/display/properties/name/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/display/name",
              schemaPath: "#/properties/display/properties/name/type",
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
        if (data16.description !== undefined) {
          let data18 = data16.description;
          if (typeof data18 === "string") {
            if (func2(data18) > 1000) {
              const err54 = {
                instancePath: instancePath + "/display/description",
                schemaPath: "#/properties/display/properties/description/maxLength",
                keyword: "maxLength",
                params: { limit: 1000 },
                message: "must NOT have more than 1000 characters",
              };
              if (vErrors === null) {
                vErrors = [err54];
              } else {
                vErrors.push(err54);
              }
              errors++;
            }
            if (func2(data18) < 1) {
              const err55 = {
                instancePath: instancePath + "/display/description",
                schemaPath: "#/properties/display/properties/description/minLength",
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
              instancePath: instancePath + "/display/description",
              schemaPath: "#/properties/display/properties/description/type",
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
        if (data16.labels !== undefined) {
          let data19 = data16.labels;
          if (Array.isArray(data19)) {
            const len0 = data19.length;
            for (let i0 = 0; i0 < len0; i0++) {
              let data20 = data19[i0];
              if (typeof data20 === "string") {
                if (func2(data20) > 80) {
                  const err57 = {
                    instancePath: instancePath + "/display/labels/" + i0,
                    schemaPath: "#/properties/display/properties/labels/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 80 },
                    message: "must NOT have more than 80 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err57];
                  } else {
                    vErrors.push(err57);
                  }
                  errors++;
                }
                if (func2(data20) < 1) {
                  const err58 = {
                    instancePath: instancePath + "/display/labels/" + i0,
                    schemaPath: "#/properties/display/properties/labels/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err58];
                  } else {
                    vErrors.push(err58);
                  }
                  errors++;
                }
              } else {
                const err59 = {
                  instancePath: instancePath + "/display/labels/" + i0,
                  schemaPath: "#/properties/display/properties/labels/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err59];
                } else {
                  vErrors.push(err59);
                }
                errors++;
              }
            }
            let i1 = data19.length;
            let j0;
            if (i1 > 1) {
              const indices0 = {};
              for (; i1--;) {
                let item0 = data19[i1];
                if (typeof item0 !== "string") {
                  continue;
                }
                if (typeof indices0[item0] == "number") {
                  j0 = indices0[item0];
                  const err60 = {
                    instancePath: instancePath + "/display/labels",
                    schemaPath: "#/properties/display/properties/labels/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i1, j: j0 },
                    message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err60];
                  } else {
                    vErrors.push(err60);
                  }
                  errors++;
                  break;
                }
                indices0[item0] = i1;
              }
            }
          } else {
            const err61 = {
              instancePath: instancePath + "/display/labels",
              schemaPath: "#/properties/display/properties/labels/type",
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
      } else {
        const err62 = {
          instancePath: instancePath + "/display",
          schemaPath: "#/properties/display/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err62];
        } else {
          vErrors.push(err62);
        }
        errors++;
      }
    }
    if (data.source_reference !== undefined) {
      let data21 = data.source_reference;
      if (typeof data21 === "string") {
        if (!pattern4.test(data21)) {
          const err63 = {
            instancePath: instancePath + "/source_reference",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/source_reference",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.source_kind !== undefined) {
      let data22 = data.source_kind;
      if (!(
        data22 === "real_trace" ||
        data22 === "synthetic_trace" ||
        data22 === "compatibility_harness_trace" ||
        data22 === "reviewed_registry" ||
        data22 === "vendor_specification" ||
        data22 === "user_input"
      )) {
        const err65 = {
          instancePath: instancePath + "/source_kind",
          schemaPath: "#/$defs/sourceKind/enum",
          keyword: "enum",
          params: { allowedValues: schema44.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err65];
        } else {
          vErrors.push(err65);
        }
        errors++;
      }
    }
    if (data.license !== undefined) {
      let data23 = data.license;
      if (data23 && typeof data23 == "object" && !Array.isArray(data23)) {
        if (data23.spdx_id === undefined) {
          const err66 = {
            instancePath: instancePath + "/license",
            schemaPath: "#/properties/license/required",
            keyword: "required",
            params: { missingProperty: "spdx_id" },
            message: "must have required property '" + "spdx_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err66];
          } else {
            vErrors.push(err66);
          }
          errors++;
        }
        if (data23.redistribution_allowed === undefined) {
          const err67 = {
            instancePath: instancePath + "/license",
            schemaPath: "#/properties/license/required",
            keyword: "required",
            params: { missingProperty: "redistribution_allowed" },
            message: "must have required property '" + "redistribution_allowed" + "'",
          };
          if (vErrors === null) {
            vErrors = [err67];
          } else {
            vErrors.push(err67);
          }
          errors++;
        }
        for (const key2 in data23) {
          if (!(key2 === "spdx_id" || key2 === "redistribution_allowed" || key2 === "notice_reference")) {
            const err68 = {
              instancePath: instancePath + "/license",
              schemaPath: "#/properties/license/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err68];
            } else {
              vErrors.push(err68);
            }
            errors++;
          }
        }
        if (data23.spdx_id !== undefined) {
          let data24 = data23.spdx_id;
          if (typeof data24 === "string") {
            if (func2(data24) > 80) {
              const err69 = {
                instancePath: instancePath + "/license/spdx_id",
                schemaPath: "#/properties/license/properties/spdx_id/maxLength",
                keyword: "maxLength",
                params: { limit: 80 },
                message: "must NOT have more than 80 characters",
              };
              if (vErrors === null) {
                vErrors = [err69];
              } else {
                vErrors.push(err69);
              }
              errors++;
            }
            if (func2(data24) < 1) {
              const err70 = {
                instancePath: instancePath + "/license/spdx_id",
                schemaPath: "#/properties/license/properties/spdx_id/minLength",
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
              instancePath: instancePath + "/license/spdx_id",
              schemaPath: "#/properties/license/properties/spdx_id/type",
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
        if (data23.redistribution_allowed !== undefined) {
          if (typeof data23.redistribution_allowed !== "boolean") {
            const err72 = {
              instancePath: instancePath + "/license/redistribution_allowed",
              schemaPath: "#/properties/license/properties/redistribution_allowed/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err72];
            } else {
              vErrors.push(err72);
            }
            errors++;
          }
        }
        if (data23.notice_reference !== undefined) {
          let data26 = data23.notice_reference;
          if (typeof data26 !== "string" && data26 !== null) {
            const err73 = {
              instancePath: instancePath + "/license/notice_reference",
              schemaPath: "#/properties/license/properties/notice_reference/type",
              keyword: "type",
              params: { type: schema33.properties.license.properties.notice_reference.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err73];
            } else {
              vErrors.push(err73);
            }
            errors++;
          }
          if (typeof data26 === "string") {
            if (func2(data26) > 512) {
              const err74 = {
                instancePath: instancePath + "/license/notice_reference",
                schemaPath: "#/properties/license/properties/notice_reference/maxLength",
                keyword: "maxLength",
                params: { limit: 512 },
                message: "must NOT have more than 512 characters",
              };
              if (vErrors === null) {
                vErrors = [err74];
              } else {
                vErrors.push(err74);
              }
              errors++;
            }
          }
        }
      } else {
        const err75 = {
          instancePath: instancePath + "/license",
          schemaPath: "#/properties/license/type",
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
    if (data.valid_regime !== undefined) {
      let data27 = data.valid_regime;
      if (data27 && typeof data27 == "object" && !Array.isArray(data27)) {
        if (data27.description === undefined) {
          const err76 = {
            instancePath: instancePath + "/valid_regime",
            schemaPath: "#/properties/valid_regime/required",
            keyword: "required",
            params: { missingProperty: "description" },
            message: "must have required property '" + "description" + "'",
          };
          if (vErrors === null) {
            vErrors = [err76];
          } else {
            vErrors.push(err76);
          }
          errors++;
        }
        if (data27.constraints === undefined) {
          const err77 = {
            instancePath: instancePath + "/valid_regime",
            schemaPath: "#/properties/valid_regime/required",
            keyword: "required",
            params: { missingProperty: "constraints" },
            message: "must have required property '" + "constraints" + "'",
          };
          if (vErrors === null) {
            vErrors = [err77];
          } else {
            vErrors.push(err77);
          }
          errors++;
        }
        for (const key3 in data27) {
          if (!(key3 === "description" || key3 === "constraints")) {
            const err78 = {
              instancePath: instancePath + "/valid_regime",
              schemaPath: "#/properties/valid_regime/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key3 },
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
        if (data27.description !== undefined) {
          let data28 = data27.description;
          if (typeof data28 === "string") {
            if (func2(data28) > 1000) {
              const err79 = {
                instancePath: instancePath + "/valid_regime/description",
                schemaPath: "#/properties/valid_regime/properties/description/maxLength",
                keyword: "maxLength",
                params: { limit: 1000 },
                message: "must NOT have more than 1000 characters",
              };
              if (vErrors === null) {
                vErrors = [err79];
              } else {
                vErrors.push(err79);
              }
              errors++;
            }
            if (func2(data28) < 1) {
              const err80 = {
                instancePath: instancePath + "/valid_regime/description",
                schemaPath: "#/properties/valid_regime/properties/description/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/valid_regime/description",
              schemaPath: "#/properties/valid_regime/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err81];
            } else {
              vErrors.push(err81);
            }
            errors++;
          }
        }
        if (data27.constraints !== undefined) {
          let data29 = data27.constraints;
          if (Array.isArray(data29)) {
            if (data29.length < 1) {
              const err82 = {
                instancePath: instancePath + "/valid_regime/constraints",
                schemaPath: "#/properties/valid_regime/properties/constraints/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              if (vErrors === null) {
                vErrors = [err82];
              } else {
                vErrors.push(err82);
              }
              errors++;
            }
            const len1 = data29.length;
            for (let i2 = 0; i2 < len1; i2++) {
              let data30 = data29[i2];
              if (typeof data30 === "string") {
                if (func2(data30) > 300) {
                  const err83 = {
                    instancePath: instancePath + "/valid_regime/constraints/" + i2,
                    schemaPath: "#/properties/valid_regime/properties/constraints/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 300 },
                    message: "must NOT have more than 300 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err83];
                  } else {
                    vErrors.push(err83);
                  }
                  errors++;
                }
                if (func2(data30) < 1) {
                  const err84 = {
                    instancePath: instancePath + "/valid_regime/constraints/" + i2,
                    schemaPath: "#/properties/valid_regime/properties/constraints/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err84];
                  } else {
                    vErrors.push(err84);
                  }
                  errors++;
                }
              } else {
                const err85 = {
                  instancePath: instancePath + "/valid_regime/constraints/" + i2,
                  schemaPath: "#/properties/valid_regime/properties/constraints/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err85];
                } else {
                  vErrors.push(err85);
                }
                errors++;
              }
            }
            let i3 = data29.length;
            let j1;
            if (i3 > 1) {
              const indices1 = {};
              for (; i3--;) {
                let item1 = data29[i3];
                if (typeof item1 !== "string") {
                  continue;
                }
                if (typeof indices1[item1] == "number") {
                  j1 = indices1[item1];
                  const err86 = {
                    instancePath: instancePath + "/valid_regime/constraints",
                    schemaPath: "#/properties/valid_regime/properties/constraints/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i3, j: j1 },
                    message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err86];
                  } else {
                    vErrors.push(err86);
                  }
                  errors++;
                  break;
                }
                indices1[item1] = i3;
              }
            }
          } else {
            const err87 = {
              instancePath: instancePath + "/valid_regime/constraints",
              schemaPath: "#/properties/valid_regime/properties/constraints/type",
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
      } else {
        const err88 = {
          instancePath: instancePath + "/valid_regime",
          schemaPath: "#/properties/valid_regime/type",
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
    if (data.lifecycle !== undefined) {
      let data31 = data.lifecycle;
      if (data31 && typeof data31 == "object" && !Array.isArray(data31)) {
        if (data31.introduced_at === undefined) {
          const err89 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "introduced_at" },
            message: "must have required property '" + "introduced_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err89];
          } else {
            vErrors.push(err89);
          }
          errors++;
        }
        if (data31.updated_at === undefined) {
          const err90 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "updated_at" },
            message: "must have required property '" + "updated_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err90];
          } else {
            vErrors.push(err90);
          }
          errors++;
        }
        if (data31.expires_at === undefined) {
          const err91 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "expires_at" },
            message: "must have required property '" + "expires_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err91];
          } else {
            vErrors.push(err91);
          }
          errors++;
        }
        if (data31.status === undefined) {
          const err92 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "status" },
            message: "must have required property '" + "status" + "'",
          };
          if (vErrors === null) {
            vErrors = [err92];
          } else {
            vErrors.push(err92);
          }
          errors++;
        }
        for (const key4 in data31) {
          if (!(key4 === "introduced_at" || key4 === "updated_at" || key4 === "expires_at" || key4 === "status")) {
            const err93 = {
              instancePath: instancePath + "/lifecycle",
              schemaPath: "#/properties/lifecycle/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key4 },
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
        if (data31.introduced_at !== undefined) {
          if (!(typeof data31.introduced_at === "string")) {
            const err94 = {
              instancePath: instancePath + "/lifecycle/introduced_at",
              schemaPath: "#/properties/lifecycle/properties/introduced_at/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err94];
            } else {
              vErrors.push(err94);
            }
            errors++;
          }
        }
        if (data31.updated_at !== undefined) {
          if (!(typeof data31.updated_at === "string")) {
            const err95 = {
              instancePath: instancePath + "/lifecycle/updated_at",
              schemaPath: "#/properties/lifecycle/properties/updated_at/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err95];
            } else {
              vErrors.push(err95);
            }
            errors++;
          }
        }
        if (data31.expires_at !== undefined) {
          let data34 = data31.expires_at;
          if (typeof data34 !== "string" && data34 !== null) {
            const err96 = {
              instancePath: instancePath + "/lifecycle/expires_at",
              schemaPath: "#/properties/lifecycle/properties/expires_at/type",
              keyword: "type",
              params: { type: schema33.properties.lifecycle.properties.expires_at.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err96];
            } else {
              vErrors.push(err96);
            }
            errors++;
          }
        }
        if (data31.status !== undefined) {
          let data35 = data31.status;
          if (!(
            data35 === "available" ||
            data35 === "deprecated" ||
            data35 === "expired" ||
            data35 === "revoked" ||
            data35 === "unavailable"
          )) {
            const err97 = {
              instancePath: instancePath + "/lifecycle/status",
              schemaPath: "#/properties/lifecycle/properties/status/enum",
              keyword: "enum",
              params: { allowedValues: schema33.properties.lifecycle.properties.status.enum },
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
      } else {
        const err98 = {
          instancePath: instancePath + "/lifecycle",
          schemaPath: "#/properties/lifecycle/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err98];
        } else {
          vErrors.push(err98);
        }
        errors++;
      }
    }
    if (data.calibration_status !== undefined) {
      let data36 = data.calibration_status;
      if (!(
        data36 === "not_applicable" ||
        data36 === "missing" ||
        data36 === "fixture_consistency_only" ||
        data36 === "calibrated"
      )) {
        const err99 = {
          instancePath: instancePath + "/calibration_status",
          schemaPath: "#/properties/calibration_status/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.calibration_status.enum },
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
    if (data.calibration_binding !== undefined) {
      let data37 = data.calibration_binding;
      const _errs92 = errors;
      let valid30 = false;
      let passing0 = null;
      const _errs93 = errors;
      if (
        !validate23(data37, {
          instancePath: instancePath + "/calibration_binding",
          parentData: data,
          parentDataProperty: "calibration_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
      var _valid3 = _errs93 === errors;
      if (_valid3) {
        valid30 = true;
        passing0 = 0;
      }
      const _errs94 = errors;
      if (data37 !== null) {
        const err100 = {
          instancePath: instancePath + "/calibration_binding",
          schemaPath: "#/properties/calibration_binding/oneOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err100];
        } else {
          vErrors.push(err100);
        }
        errors++;
      }
      var _valid3 = _errs94 === errors;
      if (_valid3 && valid30) {
        valid30 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid3) {
          valid30 = true;
          passing0 = 1;
        }
      }
      if (!valid30) {
        const err101 = {
          instancePath: instancePath + "/calibration_binding",
          schemaPath: "#/properties/calibration_binding/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing0 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err101];
        } else {
          vErrors.push(err101);
        }
        errors++;
      } else {
        errors = _errs92;
        if (vErrors !== null) {
          if (_errs92) {
            vErrors.length = _errs92;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.held_out_validation_status !== undefined) {
      let data38 = data.held_out_validation_status;
      if (!(data38 === "missing" || data38 === "fixture_consistency_only" || data38 === "validated")) {
        const err102 = {
          instancePath: instancePath + "/held_out_validation_status",
          schemaPath: "#/properties/held_out_validation_status/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.held_out_validation_status.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err102];
        } else {
          vErrors.push(err102);
        }
        errors++;
      }
    }
    if (data.held_out_validation_binding !== undefined) {
      let data39 = data.held_out_validation_binding;
      const _errs98 = errors;
      let valid31 = false;
      let passing1 = null;
      const _errs99 = errors;
      if (
        !validate23(data39, {
          instancePath: instancePath + "/held_out_validation_binding",
          parentData: data,
          parentDataProperty: "held_out_validation_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
      var _valid4 = _errs99 === errors;
      if (_valid4) {
        valid31 = true;
        passing1 = 0;
      }
      const _errs100 = errors;
      if (data39 !== null) {
        const err103 = {
          instancePath: instancePath + "/held_out_validation_binding",
          schemaPath: "#/properties/held_out_validation_binding/oneOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err103];
        } else {
          vErrors.push(err103);
        }
        errors++;
      }
      var _valid4 = _errs100 === errors;
      if (_valid4 && valid31) {
        valid31 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid4) {
          valid31 = true;
          passing1 = 1;
        }
      }
      if (!valid31) {
        const err104 = {
          instancePath: instancePath + "/held_out_validation_binding",
          schemaPath: "#/properties/held_out_validation_binding/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing1 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err104];
        } else {
          vErrors.push(err104);
        }
        errors++;
      } else {
        errors = _errs98;
        if (vErrors !== null) {
          if (_errs98) {
            vErrors.length = _errs98;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.allowed_claim_scope !== undefined) {
      let data40 = data.allowed_claim_scope;
      if (!(
        data40 === "exploration" ||
        data40 === "synthetic_consistency" ||
        data40 === "limited_extrapolation" ||
        data40 === "similar_regime_conditional_prediction" ||
        data40 === "real_calibrated_validation"
      )) {
        const err105 = {
          instancePath: instancePath + "/allowed_claim_scope",
          schemaPath: "#/$defs/claimScope/enum",
          keyword: "enum",
          params: { allowedValues: schema45.enum },
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
    if (data.sensitivity !== undefined) {
      let data41 = data.sensitivity;
      if (!(data41 === "public" || data41 === "internal" || data41 === "restricted")) {
        const err106 = {
          instancePath: instancePath + "/sensitivity",
          schemaPath: "#/properties/sensitivity/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.sensitivity.enum },
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
    if (data.visibility !== undefined) {
      let data42 = data.visibility;
      if (!(data42 === "catalog" || data42 === "project" || data42 === "private")) {
        const err107 = {
          instancePath: instancePath + "/visibility",
          schemaPath: "#/properties/visibility/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.visibility.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err107];
        } else {
          vErrors.push(err107);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data43 = data.facts;
      if (data43 && typeof data43 == "object" && !Array.isArray(data43)) {
        if (Object.keys(data43).length < 1) {
          const err108 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/properties/facts/minProperties",
            keyword: "minProperties",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 properties",
          };
          if (vErrors === null) {
            vErrors = [err108];
          } else {
            vErrors.push(err108);
          }
          errors++;
        }
      } else {
        const err109 = {
          instancePath: instancePath + "/facts",
          schemaPath: "#/properties/facts/type",
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
  } else {
    const err110 = {
      instancePath,
      schemaPath: "#/type",
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
  validate43.errors = vErrors;
  return errors === 0;
}
validate43.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate49(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate49.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value !== undefined) {
      let data0 = data.value;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err0 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/allOf/1/properties/value/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
      } else {
        const err1 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/allOf/1/properties/value/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
  }
  validate49.errors = vErrors;
  return errors === 0;
}
validate49.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const schema65 = {
  allOf: [
    { $ref: "#/$defs/fact" },
    { properties: { value: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true } } },
  ],
};
function validate55(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate55.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value !== undefined) {
      let data0 = data.value;
      if (Array.isArray(data0)) {
        const len0 = data0.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data1 = data0[i0];
          if (typeof data1 === "string") {
            if (func2(data1) < 1) {
              const err0 = {
                instancePath: instancePath + "/value/" + i0,
                schemaPath: "#/allOf/1/properties/value/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err0];
              } else {
                vErrors.push(err0);
              }
              errors++;
            }
          } else {
            const err1 = {
              instancePath: instancePath + "/value/" + i0,
              schemaPath: "#/allOf/1/properties/value/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
          }
        }
        let i1 = data0.length;
        let j0;
        if (i1 > 1) {
          const indices0 = {};
          for (; i1--;) {
            let item0 = data0[i1];
            if (typeof item0 !== "string") {
              continue;
            }
            if (typeof indices0[item0] == "number") {
              j0 = indices0[item0];
              const err2 = {
                instancePath: instancePath + "/value",
                schemaPath: "#/allOf/1/properties/value/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i1, j: j0 },
                message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors++;
              break;
            }
            indices0[item0] = i1;
          }
        }
      } else {
        const err3 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/allOf/1/properties/value/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
  }
  validate55.errors = vErrors;
  return errors === 0;
}
validate55.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate42(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-phase2/engine-profile.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate42.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate43(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate43.errors : vErrors.concat(validate43.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_engine_profile.v2" !== data.schema_identity) {
        const err0 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/allOf/1/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_engine_profile.v2" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.profile_family !== undefined) {
      if ("engine" !== data.profile_family) {
        const err1 = {
          instancePath: instancePath + "/profile_family",
          schemaPath: "#/allOf/1/properties/profile_family/const",
          keyword: "const",
          params: { allowedValue: "engine" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data2 = data.facts;
      if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
        if (data2.engine_name === undefined) {
          const err2 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "engine_name" },
            message: "must have required property '" + "engine_name" + "'",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (data2.engine_version === undefined) {
          const err3 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "engine_version" },
            message: "must have required property '" + "engine_version" + "'",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (data2.semantic_profile === undefined) {
          const err4 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "semantic_profile" },
            message: "must have required property '" + "semantic_profile" + "'",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (data2.batching_policy === undefined) {
          const err5 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "batching_policy" },
            message: "must have required property '" + "batching_policy" + "'",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (data2.supported_features === undefined) {
          const err6 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "supported_features" },
            message: "must have required property '" + "supported_features" + "'",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        for (const key0 in data2) {
          if (!(
            key0 === "engine_name" ||
            key0 === "engine_version" ||
            key0 === "semantic_profile" ||
            key0 === "batching_policy" ||
            key0 === "supported_features"
          )) {
            const err7 = {
              instancePath: instancePath + "/facts",
              schemaPath: "#/allOf/1/properties/facts/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key0 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
        if (data2.engine_name !== undefined) {
          if (
            !validate49(data2.engine_name, {
              instancePath: instancePath + "/facts/engine_name",
              parentData: data2,
              parentDataProperty: "engine_name",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate49.errors : vErrors.concat(validate49.errors);
            errors = vErrors.length;
          }
        }
        if (data2.engine_version !== undefined) {
          if (
            !validate49(data2.engine_version, {
              instancePath: instancePath + "/facts/engine_version",
              parentData: data2,
              parentDataProperty: "engine_version",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate49.errors : vErrors.concat(validate49.errors);
            errors = vErrors.length;
          }
        }
        if (data2.semantic_profile !== undefined) {
          if (
            !validate49(data2.semantic_profile, {
              instancePath: instancePath + "/facts/semantic_profile",
              parentData: data2,
              parentDataProperty: "semantic_profile",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate49.errors : vErrors.concat(validate49.errors);
            errors = vErrors.length;
          }
        }
        if (data2.batching_policy !== undefined) {
          if (
            !validate49(data2.batching_policy, {
              instancePath: instancePath + "/facts/batching_policy",
              parentData: data2,
              parentDataProperty: "batching_policy",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate49.errors : vErrors.concat(validate49.errors);
            errors = vErrors.length;
          }
        }
        if (data2.supported_features !== undefined) {
          if (
            !validate55(data2.supported_features, {
              instancePath: instancePath + "/facts/supported_features",
              parentData: data2,
              parentDataProperty: "supported_features",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate55.errors : vErrors.concat(validate55.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/facts",
          schemaPath: "#/allOf/1/properties/facts/type",
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
    }
  }
  validate42.errors = vErrors;
  return errors === 0;
}
validate42.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const deviceProfileV2 = validate58;
const schema66 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-phase2/device-profile.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_device_profile.v2",
  allOf: [
    { $ref: "common.schema.json#/$defs/profileEnvelope" },
    {
      properties: {
        schema_identity: { const: "tilesim.bridge.agent_orchestration_device_profile.v2" },
        profile_family: { const: "device" },
        facts: {
          type: "object",
          additionalProperties: false,
          required: ["device_model", "memory_capacity_bytes", "compute_profile_reference", "interconnect_endpoints"],
          properties: {
            device_model: { $ref: "common.schema.json#/$defs/stringFact" },
            memory_capacity_bytes: { $ref: "common.schema.json#/$defs/uint64Fact" },
            compute_profile_reference: { $ref: "common.schema.json#/$defs/stringFact" },
            interconnect_endpoints: { $ref: "common.schema.json#/$defs/uint64Fact" },
          },
        },
      },
    },
  ],
};
function validate59(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate59.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs2 = errors;
  let valid1 = true;
  const _errs3 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.source_kind !== undefined) {
      let data0 = data.source_kind;
      if (!(data0 === "synthetic_trace" || data0 === "compatibility_harness_trace" || data0 === "user_input")) {
        const err0 = {};
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
  }
  var _valid0 = _errs3 === errors;
  errors = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs5 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.calibration_status !== undefined) {
        const _errs7 = errors;
        const _errs8 = errors;
        if ("calibrated" !== data.calibration_status) {
          const err1 = {};
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
        var valid4 = _errs8 === errors;
        if (valid4) {
          const err2 = {
            instancePath: instancePath + "/calibration_status",
            schemaPath: "#/allOf/0/then/properties/calibration_status/not",
            keyword: "not",
            params: {},
            message: "must NOT be valid",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        } else {
          errors = _errs7;
          if (vErrors !== null) {
            if (_errs7) {
              vErrors.length = _errs7;
            } else {
              vErrors = null;
            }
          }
        }
      }
      if (data.calibration_binding !== undefined) {
        if (data.calibration_binding !== null) {
          const err3 = {
            instancePath: instancePath + "/calibration_binding",
            schemaPath: "#/allOf/0/then/properties/calibration_binding/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      }
      if (data.held_out_validation_status !== undefined) {
        const _errs12 = errors;
        const _errs13 = errors;
        if ("validated" !== data.held_out_validation_status) {
          const err4 = {};
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        var valid5 = _errs13 === errors;
        if (valid5) {
          const err5 = {
            instancePath: instancePath + "/held_out_validation_status",
            schemaPath: "#/allOf/0/then/properties/held_out_validation_status/not",
            keyword: "not",
            params: {},
            message: "must NOT be valid",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        } else {
          errors = _errs12;
          if (vErrors !== null) {
            if (_errs12) {
              vErrors.length = _errs12;
            } else {
              vErrors = null;
            }
          }
        }
      }
      if (data.held_out_validation_binding !== undefined) {
        if (data.held_out_validation_binding !== null) {
          const err6 = {
            instancePath: instancePath + "/held_out_validation_binding",
            schemaPath: "#/allOf/0/then/properties/held_out_validation_binding/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
      if (data.allowed_claim_scope !== undefined) {
        let data5 = data.allowed_claim_scope;
        if (!(data5 === "exploration" || data5 === "synthetic_consistency")) {
          const err7 = {
            instancePath: instancePath + "/allowed_claim_scope",
            schemaPath: "#/allOf/0/then/properties/allowed_claim_scope/enum",
            keyword: "enum",
            params: { allowedValues: schema33.allOf[0].then.properties.allowed_claim_scope.enum },
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
    }
    var _valid0 = _errs5 === errors;
    valid1 = _valid0;
    if (valid1) {
      var props0 = {};
      props0.calibration_status = true;
      props0.calibration_binding = true;
      props0.held_out_validation_status = true;
      props0.held_out_validation_binding = true;
      props0.allowed_claim_scope = true;
      props0.source_kind = true;
    }
  }
  if (!valid1) {
    const err8 = {
      instancePath,
      schemaPath: "#/allOf/0/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  const _errs18 = errors;
  let valid6 = true;
  const _errs19 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (data.calibration_status === undefined && (missing0 = "calibration_status")) {
      const err9 = {};
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    } else {
      if (data.calibration_status !== undefined) {
        if ("calibrated" !== data.calibration_status) {
          const err10 = {};
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      }
    }
  }
  var _valid1 = _errs19 === errors;
  errors = _errs18;
  if (vErrors !== null) {
    if (_errs18) {
      vErrors.length = _errs18;
    } else {
      vErrors = null;
    }
  }
  if (_valid1) {
    const _errs21 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.calibration_binding !== undefined) {
        if (
          !validate23(data.calibration_binding, {
            instancePath: instancePath + "/calibration_binding",
            parentData: data,
            parentDataProperty: "calibration_binding",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid1 = _errs21 === errors;
    valid6 = _valid1;
    if (valid6) {
      var props1 = {};
      props1.calibration_binding = true;
      props1.calibration_status = true;
    }
  }
  if (!valid6) {
    const err11 = {
      instancePath,
      schemaPath: "#/allOf/1/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  if (props0 !== true && props1 !== undefined) {
    if (props1 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props1);
    }
  }
  const _errs24 = errors;
  let valid9 = true;
  const _errs25 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing1;
    if (data.held_out_validation_status === undefined && (missing1 = "held_out_validation_status")) {
      const err12 = {};
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    } else {
      if (data.held_out_validation_status !== undefined) {
        if ("validated" !== data.held_out_validation_status) {
          const err13 = {};
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      }
    }
  }
  var _valid2 = _errs25 === errors;
  errors = _errs24;
  if (vErrors !== null) {
    if (_errs24) {
      vErrors.length = _errs24;
    } else {
      vErrors = null;
    }
  }
  if (_valid2) {
    const _errs27 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.held_out_validation_binding !== undefined) {
        if (
          !validate23(data.held_out_validation_binding, {
            instancePath: instancePath + "/held_out_validation_binding",
            parentData: data,
            parentDataProperty: "held_out_validation_binding",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid2 = _errs27 === errors;
    valid9 = _valid2;
    if (valid9) {
      var props2 = {};
      props2.held_out_validation_binding = true;
      props2.held_out_validation_status = true;
    }
  }
  if (!valid9) {
    const err14 = {
      instancePath,
      schemaPath: "#/allOf/2/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  if (props0 !== true && props2 !== undefined) {
    if (props2 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props2);
    }
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_identity" },
        message: "must have required property '" + "schema_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.schema_revision === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_revision" },
        message: "must have required property '" + "schema_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    if (data.profile_family === undefined) {
      const err17 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_family" },
        message: "must have required property '" + "profile_family" + "'",
      };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    if (data.profile_id === undefined) {
      const err18 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_id" },
        message: "must have required property '" + "profile_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    if (data.profile_revision === undefined) {
      const err19 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_revision" },
        message: "must have required property '" + "profile_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err19];
      } else {
        vErrors.push(err19);
      }
      errors++;
    }
    if (data.canonical_digest === undefined) {
      const err20 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "canonical_digest" },
        message: "must have required property '" + "canonical_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err20];
      } else {
        vErrors.push(err20);
      }
      errors++;
    }
    if (data.display === undefined) {
      const err21 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "display" },
        message: "must have required property '" + "display" + "'",
      };
      if (vErrors === null) {
        vErrors = [err21];
      } else {
        vErrors.push(err21);
      }
      errors++;
    }
    if (data.source_reference === undefined) {
      const err22 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_reference" },
        message: "must have required property '" + "source_reference" + "'",
      };
      if (vErrors === null) {
        vErrors = [err22];
      } else {
        vErrors.push(err22);
      }
      errors++;
    }
    if (data.source_kind === undefined) {
      const err23 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_kind" },
        message: "must have required property '" + "source_kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err23];
      } else {
        vErrors.push(err23);
      }
      errors++;
    }
    if (data.license === undefined) {
      const err24 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "license" },
        message: "must have required property '" + "license" + "'",
      };
      if (vErrors === null) {
        vErrors = [err24];
      } else {
        vErrors.push(err24);
      }
      errors++;
    }
    if (data.valid_regime === undefined) {
      const err25 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "valid_regime" },
        message: "must have required property '" + "valid_regime" + "'",
      };
      if (vErrors === null) {
        vErrors = [err25];
      } else {
        vErrors.push(err25);
      }
      errors++;
    }
    if (data.lifecycle === undefined) {
      const err26 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "lifecycle" },
        message: "must have required property '" + "lifecycle" + "'",
      };
      if (vErrors === null) {
        vErrors = [err26];
      } else {
        vErrors.push(err26);
      }
      errors++;
    }
    if (data.calibration_status === undefined) {
      const err27 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calibration_status" },
        message: "must have required property '" + "calibration_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err27];
      } else {
        vErrors.push(err27);
      }
      errors++;
    }
    if (data.calibration_binding === undefined) {
      const err28 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calibration_binding" },
        message: "must have required property '" + "calibration_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err28];
      } else {
        vErrors.push(err28);
      }
      errors++;
    }
    if (data.held_out_validation_status === undefined) {
      const err29 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "held_out_validation_status" },
        message: "must have required property '" + "held_out_validation_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err29];
      } else {
        vErrors.push(err29);
      }
      errors++;
    }
    if (data.held_out_validation_binding === undefined) {
      const err30 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "held_out_validation_binding" },
        message: "must have required property '" + "held_out_validation_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err30];
      } else {
        vErrors.push(err30);
      }
      errors++;
    }
    if (data.allowed_claim_scope === undefined) {
      const err31 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "allowed_claim_scope" },
        message: "must have required property '" + "allowed_claim_scope" + "'",
      };
      if (vErrors === null) {
        vErrors = [err31];
      } else {
        vErrors.push(err31);
      }
      errors++;
    }
    if (data.sensitivity === undefined) {
      const err32 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "sensitivity" },
        message: "must have required property '" + "sensitivity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err32];
      } else {
        vErrors.push(err32);
      }
      errors++;
    }
    if (data.visibility === undefined) {
      const err33 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "visibility" },
        message: "must have required property '" + "visibility" + "'",
      };
      if (vErrors === null) {
        vErrors = [err33];
      } else {
        vErrors.push(err33);
      }
      errors++;
    }
    if (data.facts === undefined) {
      const err34 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "facts" },
        message: "must have required property '" + "facts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err34];
      } else {
        vErrors.push(err34);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema33.properties, key0)) {
        const err35 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.schema_identity !== undefined) {
      let data10 = data.schema_identity;
      if (typeof data10 === "string") {
        if (!pattern4.test(data10)) {
          const err36 = {
            instancePath: instancePath + "/schema_identity",
            schemaPath: "#/$defs/stableId/pattern",
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
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.schema_revision !== undefined) {
      let data11 = data.schema_revision;
      if (typeof data11 === "string") {
        if (!pattern5.test(data11)) {
          const err38 = {
            instancePath: instancePath + "/schema_revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/schema_revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.profile_family !== undefined) {
      let data12 = data.profile_family;
      if (!(
        data12 === "model" ||
        data12 === "engine" ||
        data12 === "device" ||
        data12 === "topology" ||
        data12 === "workload"
      )) {
        const err40 = {
          instancePath: instancePath + "/profile_family",
          schemaPath: "#/properties/profile_family/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.profile_family.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
    if (data.profile_id !== undefined) {
      let data13 = data.profile_id;
      if (typeof data13 === "string") {
        if (!pattern4.test(data13)) {
          const err41 = {
            instancePath: instancePath + "/profile_id",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/profile_id",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.profile_revision !== undefined) {
      let data14 = data.profile_revision;
      if (typeof data14 === "string") {
        if (!pattern5.test(data14)) {
          const err43 = {
            instancePath: instancePath + "/profile_revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/profile_revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.canonical_digest !== undefined) {
      let data15 = data.canonical_digest;
      if (typeof data15 === "string") {
        if (!pattern5.test(data15)) {
          const err45 = {
            instancePath: instancePath + "/canonical_digest",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/canonical_digest",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.display !== undefined) {
      let data16 = data.display;
      if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
        if (data16.name === undefined) {
          const err47 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "name" },
            message: "must have required property '" + "name" + "'",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
        if (data16.description === undefined) {
          const err48 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "description" },
            message: "must have required property '" + "description" + "'",
          };
          if (vErrors === null) {
            vErrors = [err48];
          } else {
            vErrors.push(err48);
          }
          errors++;
        }
        if (data16.labels === undefined) {
          const err49 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "labels" },
            message: "must have required property '" + "labels" + "'",
          };
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        for (const key1 in data16) {
          if (!(key1 === "name" || key1 === "description" || key1 === "labels")) {
            const err50 = {
              instancePath: instancePath + "/display",
              schemaPath: "#/properties/display/additionalProperties",
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
        if (data16.name !== undefined) {
          let data17 = data16.name;
          if (typeof data17 === "string") {
            if (func2(data17) > 160) {
              const err51 = {
                instancePath: instancePath + "/display/name",
                schemaPath: "#/properties/display/properties/name/maxLength",
                keyword: "maxLength",
                params: { limit: 160 },
                message: "must NOT have more than 160 characters",
              };
              if (vErrors === null) {
                vErrors = [err51];
              } else {
                vErrors.push(err51);
              }
              errors++;
            }
            if (func2(data17) < 1) {
              const err52 = {
                instancePath: instancePath + "/display/name",
                schemaPath: "#/properties/display/properties/name/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/display/name",
              schemaPath: "#/properties/display/properties/name/type",
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
        if (data16.description !== undefined) {
          let data18 = data16.description;
          if (typeof data18 === "string") {
            if (func2(data18) > 1000) {
              const err54 = {
                instancePath: instancePath + "/display/description",
                schemaPath: "#/properties/display/properties/description/maxLength",
                keyword: "maxLength",
                params: { limit: 1000 },
                message: "must NOT have more than 1000 characters",
              };
              if (vErrors === null) {
                vErrors = [err54];
              } else {
                vErrors.push(err54);
              }
              errors++;
            }
            if (func2(data18) < 1) {
              const err55 = {
                instancePath: instancePath + "/display/description",
                schemaPath: "#/properties/display/properties/description/minLength",
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
              instancePath: instancePath + "/display/description",
              schemaPath: "#/properties/display/properties/description/type",
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
        if (data16.labels !== undefined) {
          let data19 = data16.labels;
          if (Array.isArray(data19)) {
            const len0 = data19.length;
            for (let i0 = 0; i0 < len0; i0++) {
              let data20 = data19[i0];
              if (typeof data20 === "string") {
                if (func2(data20) > 80) {
                  const err57 = {
                    instancePath: instancePath + "/display/labels/" + i0,
                    schemaPath: "#/properties/display/properties/labels/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 80 },
                    message: "must NOT have more than 80 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err57];
                  } else {
                    vErrors.push(err57);
                  }
                  errors++;
                }
                if (func2(data20) < 1) {
                  const err58 = {
                    instancePath: instancePath + "/display/labels/" + i0,
                    schemaPath: "#/properties/display/properties/labels/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err58];
                  } else {
                    vErrors.push(err58);
                  }
                  errors++;
                }
              } else {
                const err59 = {
                  instancePath: instancePath + "/display/labels/" + i0,
                  schemaPath: "#/properties/display/properties/labels/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err59];
                } else {
                  vErrors.push(err59);
                }
                errors++;
              }
            }
            let i1 = data19.length;
            let j0;
            if (i1 > 1) {
              const indices0 = {};
              for (; i1--;) {
                let item0 = data19[i1];
                if (typeof item0 !== "string") {
                  continue;
                }
                if (typeof indices0[item0] == "number") {
                  j0 = indices0[item0];
                  const err60 = {
                    instancePath: instancePath + "/display/labels",
                    schemaPath: "#/properties/display/properties/labels/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i1, j: j0 },
                    message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err60];
                  } else {
                    vErrors.push(err60);
                  }
                  errors++;
                  break;
                }
                indices0[item0] = i1;
              }
            }
          } else {
            const err61 = {
              instancePath: instancePath + "/display/labels",
              schemaPath: "#/properties/display/properties/labels/type",
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
      } else {
        const err62 = {
          instancePath: instancePath + "/display",
          schemaPath: "#/properties/display/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err62];
        } else {
          vErrors.push(err62);
        }
        errors++;
      }
    }
    if (data.source_reference !== undefined) {
      let data21 = data.source_reference;
      if (typeof data21 === "string") {
        if (!pattern4.test(data21)) {
          const err63 = {
            instancePath: instancePath + "/source_reference",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/source_reference",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.source_kind !== undefined) {
      let data22 = data.source_kind;
      if (!(
        data22 === "real_trace" ||
        data22 === "synthetic_trace" ||
        data22 === "compatibility_harness_trace" ||
        data22 === "reviewed_registry" ||
        data22 === "vendor_specification" ||
        data22 === "user_input"
      )) {
        const err65 = {
          instancePath: instancePath + "/source_kind",
          schemaPath: "#/$defs/sourceKind/enum",
          keyword: "enum",
          params: { allowedValues: schema44.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err65];
        } else {
          vErrors.push(err65);
        }
        errors++;
      }
    }
    if (data.license !== undefined) {
      let data23 = data.license;
      if (data23 && typeof data23 == "object" && !Array.isArray(data23)) {
        if (data23.spdx_id === undefined) {
          const err66 = {
            instancePath: instancePath + "/license",
            schemaPath: "#/properties/license/required",
            keyword: "required",
            params: { missingProperty: "spdx_id" },
            message: "must have required property '" + "spdx_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err66];
          } else {
            vErrors.push(err66);
          }
          errors++;
        }
        if (data23.redistribution_allowed === undefined) {
          const err67 = {
            instancePath: instancePath + "/license",
            schemaPath: "#/properties/license/required",
            keyword: "required",
            params: { missingProperty: "redistribution_allowed" },
            message: "must have required property '" + "redistribution_allowed" + "'",
          };
          if (vErrors === null) {
            vErrors = [err67];
          } else {
            vErrors.push(err67);
          }
          errors++;
        }
        for (const key2 in data23) {
          if (!(key2 === "spdx_id" || key2 === "redistribution_allowed" || key2 === "notice_reference")) {
            const err68 = {
              instancePath: instancePath + "/license",
              schemaPath: "#/properties/license/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err68];
            } else {
              vErrors.push(err68);
            }
            errors++;
          }
        }
        if (data23.spdx_id !== undefined) {
          let data24 = data23.spdx_id;
          if (typeof data24 === "string") {
            if (func2(data24) > 80) {
              const err69 = {
                instancePath: instancePath + "/license/spdx_id",
                schemaPath: "#/properties/license/properties/spdx_id/maxLength",
                keyword: "maxLength",
                params: { limit: 80 },
                message: "must NOT have more than 80 characters",
              };
              if (vErrors === null) {
                vErrors = [err69];
              } else {
                vErrors.push(err69);
              }
              errors++;
            }
            if (func2(data24) < 1) {
              const err70 = {
                instancePath: instancePath + "/license/spdx_id",
                schemaPath: "#/properties/license/properties/spdx_id/minLength",
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
              instancePath: instancePath + "/license/spdx_id",
              schemaPath: "#/properties/license/properties/spdx_id/type",
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
        if (data23.redistribution_allowed !== undefined) {
          if (typeof data23.redistribution_allowed !== "boolean") {
            const err72 = {
              instancePath: instancePath + "/license/redistribution_allowed",
              schemaPath: "#/properties/license/properties/redistribution_allowed/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err72];
            } else {
              vErrors.push(err72);
            }
            errors++;
          }
        }
        if (data23.notice_reference !== undefined) {
          let data26 = data23.notice_reference;
          if (typeof data26 !== "string" && data26 !== null) {
            const err73 = {
              instancePath: instancePath + "/license/notice_reference",
              schemaPath: "#/properties/license/properties/notice_reference/type",
              keyword: "type",
              params: { type: schema33.properties.license.properties.notice_reference.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err73];
            } else {
              vErrors.push(err73);
            }
            errors++;
          }
          if (typeof data26 === "string") {
            if (func2(data26) > 512) {
              const err74 = {
                instancePath: instancePath + "/license/notice_reference",
                schemaPath: "#/properties/license/properties/notice_reference/maxLength",
                keyword: "maxLength",
                params: { limit: 512 },
                message: "must NOT have more than 512 characters",
              };
              if (vErrors === null) {
                vErrors = [err74];
              } else {
                vErrors.push(err74);
              }
              errors++;
            }
          }
        }
      } else {
        const err75 = {
          instancePath: instancePath + "/license",
          schemaPath: "#/properties/license/type",
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
    if (data.valid_regime !== undefined) {
      let data27 = data.valid_regime;
      if (data27 && typeof data27 == "object" && !Array.isArray(data27)) {
        if (data27.description === undefined) {
          const err76 = {
            instancePath: instancePath + "/valid_regime",
            schemaPath: "#/properties/valid_regime/required",
            keyword: "required",
            params: { missingProperty: "description" },
            message: "must have required property '" + "description" + "'",
          };
          if (vErrors === null) {
            vErrors = [err76];
          } else {
            vErrors.push(err76);
          }
          errors++;
        }
        if (data27.constraints === undefined) {
          const err77 = {
            instancePath: instancePath + "/valid_regime",
            schemaPath: "#/properties/valid_regime/required",
            keyword: "required",
            params: { missingProperty: "constraints" },
            message: "must have required property '" + "constraints" + "'",
          };
          if (vErrors === null) {
            vErrors = [err77];
          } else {
            vErrors.push(err77);
          }
          errors++;
        }
        for (const key3 in data27) {
          if (!(key3 === "description" || key3 === "constraints")) {
            const err78 = {
              instancePath: instancePath + "/valid_regime",
              schemaPath: "#/properties/valid_regime/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key3 },
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
        if (data27.description !== undefined) {
          let data28 = data27.description;
          if (typeof data28 === "string") {
            if (func2(data28) > 1000) {
              const err79 = {
                instancePath: instancePath + "/valid_regime/description",
                schemaPath: "#/properties/valid_regime/properties/description/maxLength",
                keyword: "maxLength",
                params: { limit: 1000 },
                message: "must NOT have more than 1000 characters",
              };
              if (vErrors === null) {
                vErrors = [err79];
              } else {
                vErrors.push(err79);
              }
              errors++;
            }
            if (func2(data28) < 1) {
              const err80 = {
                instancePath: instancePath + "/valid_regime/description",
                schemaPath: "#/properties/valid_regime/properties/description/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/valid_regime/description",
              schemaPath: "#/properties/valid_regime/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err81];
            } else {
              vErrors.push(err81);
            }
            errors++;
          }
        }
        if (data27.constraints !== undefined) {
          let data29 = data27.constraints;
          if (Array.isArray(data29)) {
            if (data29.length < 1) {
              const err82 = {
                instancePath: instancePath + "/valid_regime/constraints",
                schemaPath: "#/properties/valid_regime/properties/constraints/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              if (vErrors === null) {
                vErrors = [err82];
              } else {
                vErrors.push(err82);
              }
              errors++;
            }
            const len1 = data29.length;
            for (let i2 = 0; i2 < len1; i2++) {
              let data30 = data29[i2];
              if (typeof data30 === "string") {
                if (func2(data30) > 300) {
                  const err83 = {
                    instancePath: instancePath + "/valid_regime/constraints/" + i2,
                    schemaPath: "#/properties/valid_regime/properties/constraints/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 300 },
                    message: "must NOT have more than 300 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err83];
                  } else {
                    vErrors.push(err83);
                  }
                  errors++;
                }
                if (func2(data30) < 1) {
                  const err84 = {
                    instancePath: instancePath + "/valid_regime/constraints/" + i2,
                    schemaPath: "#/properties/valid_regime/properties/constraints/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err84];
                  } else {
                    vErrors.push(err84);
                  }
                  errors++;
                }
              } else {
                const err85 = {
                  instancePath: instancePath + "/valid_regime/constraints/" + i2,
                  schemaPath: "#/properties/valid_regime/properties/constraints/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err85];
                } else {
                  vErrors.push(err85);
                }
                errors++;
              }
            }
            let i3 = data29.length;
            let j1;
            if (i3 > 1) {
              const indices1 = {};
              for (; i3--;) {
                let item1 = data29[i3];
                if (typeof item1 !== "string") {
                  continue;
                }
                if (typeof indices1[item1] == "number") {
                  j1 = indices1[item1];
                  const err86 = {
                    instancePath: instancePath + "/valid_regime/constraints",
                    schemaPath: "#/properties/valid_regime/properties/constraints/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i3, j: j1 },
                    message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err86];
                  } else {
                    vErrors.push(err86);
                  }
                  errors++;
                  break;
                }
                indices1[item1] = i3;
              }
            }
          } else {
            const err87 = {
              instancePath: instancePath + "/valid_regime/constraints",
              schemaPath: "#/properties/valid_regime/properties/constraints/type",
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
      } else {
        const err88 = {
          instancePath: instancePath + "/valid_regime",
          schemaPath: "#/properties/valid_regime/type",
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
    if (data.lifecycle !== undefined) {
      let data31 = data.lifecycle;
      if (data31 && typeof data31 == "object" && !Array.isArray(data31)) {
        if (data31.introduced_at === undefined) {
          const err89 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "introduced_at" },
            message: "must have required property '" + "introduced_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err89];
          } else {
            vErrors.push(err89);
          }
          errors++;
        }
        if (data31.updated_at === undefined) {
          const err90 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "updated_at" },
            message: "must have required property '" + "updated_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err90];
          } else {
            vErrors.push(err90);
          }
          errors++;
        }
        if (data31.expires_at === undefined) {
          const err91 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "expires_at" },
            message: "must have required property '" + "expires_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err91];
          } else {
            vErrors.push(err91);
          }
          errors++;
        }
        if (data31.status === undefined) {
          const err92 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "status" },
            message: "must have required property '" + "status" + "'",
          };
          if (vErrors === null) {
            vErrors = [err92];
          } else {
            vErrors.push(err92);
          }
          errors++;
        }
        for (const key4 in data31) {
          if (!(key4 === "introduced_at" || key4 === "updated_at" || key4 === "expires_at" || key4 === "status")) {
            const err93 = {
              instancePath: instancePath + "/lifecycle",
              schemaPath: "#/properties/lifecycle/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key4 },
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
        if (data31.introduced_at !== undefined) {
          if (!(typeof data31.introduced_at === "string")) {
            const err94 = {
              instancePath: instancePath + "/lifecycle/introduced_at",
              schemaPath: "#/properties/lifecycle/properties/introduced_at/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err94];
            } else {
              vErrors.push(err94);
            }
            errors++;
          }
        }
        if (data31.updated_at !== undefined) {
          if (!(typeof data31.updated_at === "string")) {
            const err95 = {
              instancePath: instancePath + "/lifecycle/updated_at",
              schemaPath: "#/properties/lifecycle/properties/updated_at/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err95];
            } else {
              vErrors.push(err95);
            }
            errors++;
          }
        }
        if (data31.expires_at !== undefined) {
          let data34 = data31.expires_at;
          if (typeof data34 !== "string" && data34 !== null) {
            const err96 = {
              instancePath: instancePath + "/lifecycle/expires_at",
              schemaPath: "#/properties/lifecycle/properties/expires_at/type",
              keyword: "type",
              params: { type: schema33.properties.lifecycle.properties.expires_at.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err96];
            } else {
              vErrors.push(err96);
            }
            errors++;
          }
        }
        if (data31.status !== undefined) {
          let data35 = data31.status;
          if (!(
            data35 === "available" ||
            data35 === "deprecated" ||
            data35 === "expired" ||
            data35 === "revoked" ||
            data35 === "unavailable"
          )) {
            const err97 = {
              instancePath: instancePath + "/lifecycle/status",
              schemaPath: "#/properties/lifecycle/properties/status/enum",
              keyword: "enum",
              params: { allowedValues: schema33.properties.lifecycle.properties.status.enum },
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
      } else {
        const err98 = {
          instancePath: instancePath + "/lifecycle",
          schemaPath: "#/properties/lifecycle/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err98];
        } else {
          vErrors.push(err98);
        }
        errors++;
      }
    }
    if (data.calibration_status !== undefined) {
      let data36 = data.calibration_status;
      if (!(
        data36 === "not_applicable" ||
        data36 === "missing" ||
        data36 === "fixture_consistency_only" ||
        data36 === "calibrated"
      )) {
        const err99 = {
          instancePath: instancePath + "/calibration_status",
          schemaPath: "#/properties/calibration_status/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.calibration_status.enum },
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
    if (data.calibration_binding !== undefined) {
      let data37 = data.calibration_binding;
      const _errs92 = errors;
      let valid30 = false;
      let passing0 = null;
      const _errs93 = errors;
      if (
        !validate23(data37, {
          instancePath: instancePath + "/calibration_binding",
          parentData: data,
          parentDataProperty: "calibration_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
      var _valid3 = _errs93 === errors;
      if (_valid3) {
        valid30 = true;
        passing0 = 0;
      }
      const _errs94 = errors;
      if (data37 !== null) {
        const err100 = {
          instancePath: instancePath + "/calibration_binding",
          schemaPath: "#/properties/calibration_binding/oneOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err100];
        } else {
          vErrors.push(err100);
        }
        errors++;
      }
      var _valid3 = _errs94 === errors;
      if (_valid3 && valid30) {
        valid30 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid3) {
          valid30 = true;
          passing0 = 1;
        }
      }
      if (!valid30) {
        const err101 = {
          instancePath: instancePath + "/calibration_binding",
          schemaPath: "#/properties/calibration_binding/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing0 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err101];
        } else {
          vErrors.push(err101);
        }
        errors++;
      } else {
        errors = _errs92;
        if (vErrors !== null) {
          if (_errs92) {
            vErrors.length = _errs92;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.held_out_validation_status !== undefined) {
      let data38 = data.held_out_validation_status;
      if (!(data38 === "missing" || data38 === "fixture_consistency_only" || data38 === "validated")) {
        const err102 = {
          instancePath: instancePath + "/held_out_validation_status",
          schemaPath: "#/properties/held_out_validation_status/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.held_out_validation_status.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err102];
        } else {
          vErrors.push(err102);
        }
        errors++;
      }
    }
    if (data.held_out_validation_binding !== undefined) {
      let data39 = data.held_out_validation_binding;
      const _errs98 = errors;
      let valid31 = false;
      let passing1 = null;
      const _errs99 = errors;
      if (
        !validate23(data39, {
          instancePath: instancePath + "/held_out_validation_binding",
          parentData: data,
          parentDataProperty: "held_out_validation_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
      var _valid4 = _errs99 === errors;
      if (_valid4) {
        valid31 = true;
        passing1 = 0;
      }
      const _errs100 = errors;
      if (data39 !== null) {
        const err103 = {
          instancePath: instancePath + "/held_out_validation_binding",
          schemaPath: "#/properties/held_out_validation_binding/oneOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err103];
        } else {
          vErrors.push(err103);
        }
        errors++;
      }
      var _valid4 = _errs100 === errors;
      if (_valid4 && valid31) {
        valid31 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid4) {
          valid31 = true;
          passing1 = 1;
        }
      }
      if (!valid31) {
        const err104 = {
          instancePath: instancePath + "/held_out_validation_binding",
          schemaPath: "#/properties/held_out_validation_binding/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing1 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err104];
        } else {
          vErrors.push(err104);
        }
        errors++;
      } else {
        errors = _errs98;
        if (vErrors !== null) {
          if (_errs98) {
            vErrors.length = _errs98;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.allowed_claim_scope !== undefined) {
      let data40 = data.allowed_claim_scope;
      if (!(
        data40 === "exploration" ||
        data40 === "synthetic_consistency" ||
        data40 === "limited_extrapolation" ||
        data40 === "similar_regime_conditional_prediction" ||
        data40 === "real_calibrated_validation"
      )) {
        const err105 = {
          instancePath: instancePath + "/allowed_claim_scope",
          schemaPath: "#/$defs/claimScope/enum",
          keyword: "enum",
          params: { allowedValues: schema45.enum },
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
    if (data.sensitivity !== undefined) {
      let data41 = data.sensitivity;
      if (!(data41 === "public" || data41 === "internal" || data41 === "restricted")) {
        const err106 = {
          instancePath: instancePath + "/sensitivity",
          schemaPath: "#/properties/sensitivity/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.sensitivity.enum },
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
    if (data.visibility !== undefined) {
      let data42 = data.visibility;
      if (!(data42 === "catalog" || data42 === "project" || data42 === "private")) {
        const err107 = {
          instancePath: instancePath + "/visibility",
          schemaPath: "#/properties/visibility/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.visibility.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err107];
        } else {
          vErrors.push(err107);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data43 = data.facts;
      if (data43 && typeof data43 == "object" && !Array.isArray(data43)) {
        if (Object.keys(data43).length < 1) {
          const err108 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/properties/facts/minProperties",
            keyword: "minProperties",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 properties",
          };
          if (vErrors === null) {
            vErrors = [err108];
          } else {
            vErrors.push(err108);
          }
          errors++;
        }
      } else {
        const err109 = {
          instancePath: instancePath + "/facts",
          schemaPath: "#/properties/facts/type",
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
  } else {
    const err110 = {
      instancePath,
      schemaPath: "#/type",
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
  validate59.errors = vErrors;
  return errors === 0;
}
validate59.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate65(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate65.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value !== undefined) {
      let data0 = data.value;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err0 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/allOf/1/properties/value/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
      } else {
        const err1 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/allOf/1/properties/value/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
  }
  validate65.errors = vErrors;
  return errors === 0;
}
validate65.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate68(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate68.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value !== undefined) {
      let data0 = data.value;
      if (typeof data0 === "string") {
        if (!pattern16.test(data0)) {
          const err0 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/$defs/uint64/pattern",
            keyword: "pattern",
            params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
            message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
      } else {
        const err1 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/$defs/uint64/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
  }
  validate68.errors = vErrors;
  return errors === 0;
}
validate68.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate58(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-phase2/device-profile.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate58.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate59(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate59.errors : vErrors.concat(validate59.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_device_profile.v2" !== data.schema_identity) {
        const err0 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/allOf/1/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_device_profile.v2" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.profile_family !== undefined) {
      if ("device" !== data.profile_family) {
        const err1 = {
          instancePath: instancePath + "/profile_family",
          schemaPath: "#/allOf/1/properties/profile_family/const",
          keyword: "const",
          params: { allowedValue: "device" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data2 = data.facts;
      if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
        if (data2.device_model === undefined) {
          const err2 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "device_model" },
            message: "must have required property '" + "device_model" + "'",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (data2.memory_capacity_bytes === undefined) {
          const err3 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "memory_capacity_bytes" },
            message: "must have required property '" + "memory_capacity_bytes" + "'",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (data2.compute_profile_reference === undefined) {
          const err4 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "compute_profile_reference" },
            message: "must have required property '" + "compute_profile_reference" + "'",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (data2.interconnect_endpoints === undefined) {
          const err5 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "interconnect_endpoints" },
            message: "must have required property '" + "interconnect_endpoints" + "'",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        for (const key0 in data2) {
          if (!(
            key0 === "device_model" ||
            key0 === "memory_capacity_bytes" ||
            key0 === "compute_profile_reference" ||
            key0 === "interconnect_endpoints"
          )) {
            const err6 = {
              instancePath: instancePath + "/facts",
              schemaPath: "#/allOf/1/properties/facts/additionalProperties",
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
        if (data2.device_model !== undefined) {
          if (
            !validate65(data2.device_model, {
              instancePath: instancePath + "/facts/device_model",
              parentData: data2,
              parentDataProperty: "device_model",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate65.errors : vErrors.concat(validate65.errors);
            errors = vErrors.length;
          }
        }
        if (data2.memory_capacity_bytes !== undefined) {
          if (
            !validate68(data2.memory_capacity_bytes, {
              instancePath: instancePath + "/facts/memory_capacity_bytes",
              parentData: data2,
              parentDataProperty: "memory_capacity_bytes",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate68.errors : vErrors.concat(validate68.errors);
            errors = vErrors.length;
          }
        }
        if (data2.compute_profile_reference !== undefined) {
          if (
            !validate65(data2.compute_profile_reference, {
              instancePath: instancePath + "/facts/compute_profile_reference",
              parentData: data2,
              parentDataProperty: "compute_profile_reference",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate65.errors : vErrors.concat(validate65.errors);
            errors = vErrors.length;
          }
        }
        if (data2.interconnect_endpoints !== undefined) {
          if (
            !validate68(data2.interconnect_endpoints, {
              instancePath: instancePath + "/facts/interconnect_endpoints",
              parentData: data2,
              parentDataProperty: "interconnect_endpoints",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate68.errors : vErrors.concat(validate68.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err7 = {
          instancePath: instancePath + "/facts",
          schemaPath: "#/allOf/1/properties/facts/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
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
  validate58.errors = vErrors;
  return errors === 0;
}
validate58.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const topologyProfileV2 = validate73;
const schema79 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-phase2/topology-profile.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_topology_profile.v2",
  allOf: [
    { $ref: "common.schema.json#/$defs/profileEnvelope" },
    {
      properties: {
        schema_identity: { const: "tilesim.bridge.agent_orchestration_topology_profile.v2" },
        profile_family: { const: "topology" },
        facts: {
          type: "object",
          additionalProperties: false,
          required: ["topology_kind", "endpoint_count", "link_bandwidth_gbps", "link_latency_ps", "routing_policy"],
          properties: {
            topology_kind: { $ref: "common.schema.json#/$defs/stringFact" },
            endpoint_count: { $ref: "common.schema.json#/$defs/uint64Fact" },
            link_bandwidth_gbps: { $ref: "common.schema.json#/$defs/decimalFact" },
            link_latency_ps: { $ref: "common.schema.json#/$defs/uint64Fact" },
            routing_policy: { $ref: "common.schema.json#/$defs/stringFact" },
          },
        },
      },
    },
  ],
};
function validate74(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate74.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs2 = errors;
  let valid1 = true;
  const _errs3 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.source_kind !== undefined) {
      let data0 = data.source_kind;
      if (!(data0 === "synthetic_trace" || data0 === "compatibility_harness_trace" || data0 === "user_input")) {
        const err0 = {};
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
  }
  var _valid0 = _errs3 === errors;
  errors = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs5 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.calibration_status !== undefined) {
        const _errs7 = errors;
        const _errs8 = errors;
        if ("calibrated" !== data.calibration_status) {
          const err1 = {};
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
        var valid4 = _errs8 === errors;
        if (valid4) {
          const err2 = {
            instancePath: instancePath + "/calibration_status",
            schemaPath: "#/allOf/0/then/properties/calibration_status/not",
            keyword: "not",
            params: {},
            message: "must NOT be valid",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        } else {
          errors = _errs7;
          if (vErrors !== null) {
            if (_errs7) {
              vErrors.length = _errs7;
            } else {
              vErrors = null;
            }
          }
        }
      }
      if (data.calibration_binding !== undefined) {
        if (data.calibration_binding !== null) {
          const err3 = {
            instancePath: instancePath + "/calibration_binding",
            schemaPath: "#/allOf/0/then/properties/calibration_binding/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      }
      if (data.held_out_validation_status !== undefined) {
        const _errs12 = errors;
        const _errs13 = errors;
        if ("validated" !== data.held_out_validation_status) {
          const err4 = {};
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        var valid5 = _errs13 === errors;
        if (valid5) {
          const err5 = {
            instancePath: instancePath + "/held_out_validation_status",
            schemaPath: "#/allOf/0/then/properties/held_out_validation_status/not",
            keyword: "not",
            params: {},
            message: "must NOT be valid",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        } else {
          errors = _errs12;
          if (vErrors !== null) {
            if (_errs12) {
              vErrors.length = _errs12;
            } else {
              vErrors = null;
            }
          }
        }
      }
      if (data.held_out_validation_binding !== undefined) {
        if (data.held_out_validation_binding !== null) {
          const err6 = {
            instancePath: instancePath + "/held_out_validation_binding",
            schemaPath: "#/allOf/0/then/properties/held_out_validation_binding/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
      if (data.allowed_claim_scope !== undefined) {
        let data5 = data.allowed_claim_scope;
        if (!(data5 === "exploration" || data5 === "synthetic_consistency")) {
          const err7 = {
            instancePath: instancePath + "/allowed_claim_scope",
            schemaPath: "#/allOf/0/then/properties/allowed_claim_scope/enum",
            keyword: "enum",
            params: { allowedValues: schema33.allOf[0].then.properties.allowed_claim_scope.enum },
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
    }
    var _valid0 = _errs5 === errors;
    valid1 = _valid0;
    if (valid1) {
      var props0 = {};
      props0.calibration_status = true;
      props0.calibration_binding = true;
      props0.held_out_validation_status = true;
      props0.held_out_validation_binding = true;
      props0.allowed_claim_scope = true;
      props0.source_kind = true;
    }
  }
  if (!valid1) {
    const err8 = {
      instancePath,
      schemaPath: "#/allOf/0/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  const _errs18 = errors;
  let valid6 = true;
  const _errs19 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (data.calibration_status === undefined && (missing0 = "calibration_status")) {
      const err9 = {};
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    } else {
      if (data.calibration_status !== undefined) {
        if ("calibrated" !== data.calibration_status) {
          const err10 = {};
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      }
    }
  }
  var _valid1 = _errs19 === errors;
  errors = _errs18;
  if (vErrors !== null) {
    if (_errs18) {
      vErrors.length = _errs18;
    } else {
      vErrors = null;
    }
  }
  if (_valid1) {
    const _errs21 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.calibration_binding !== undefined) {
        if (
          !validate23(data.calibration_binding, {
            instancePath: instancePath + "/calibration_binding",
            parentData: data,
            parentDataProperty: "calibration_binding",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid1 = _errs21 === errors;
    valid6 = _valid1;
    if (valid6) {
      var props1 = {};
      props1.calibration_binding = true;
      props1.calibration_status = true;
    }
  }
  if (!valid6) {
    const err11 = {
      instancePath,
      schemaPath: "#/allOf/1/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  if (props0 !== true && props1 !== undefined) {
    if (props1 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props1);
    }
  }
  const _errs24 = errors;
  let valid9 = true;
  const _errs25 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing1;
    if (data.held_out_validation_status === undefined && (missing1 = "held_out_validation_status")) {
      const err12 = {};
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    } else {
      if (data.held_out_validation_status !== undefined) {
        if ("validated" !== data.held_out_validation_status) {
          const err13 = {};
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      }
    }
  }
  var _valid2 = _errs25 === errors;
  errors = _errs24;
  if (vErrors !== null) {
    if (_errs24) {
      vErrors.length = _errs24;
    } else {
      vErrors = null;
    }
  }
  if (_valid2) {
    const _errs27 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.held_out_validation_binding !== undefined) {
        if (
          !validate23(data.held_out_validation_binding, {
            instancePath: instancePath + "/held_out_validation_binding",
            parentData: data,
            parentDataProperty: "held_out_validation_binding",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid2 = _errs27 === errors;
    valid9 = _valid2;
    if (valid9) {
      var props2 = {};
      props2.held_out_validation_binding = true;
      props2.held_out_validation_status = true;
    }
  }
  if (!valid9) {
    const err14 = {
      instancePath,
      schemaPath: "#/allOf/2/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  if (props0 !== true && props2 !== undefined) {
    if (props2 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props2);
    }
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_identity" },
        message: "must have required property '" + "schema_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.schema_revision === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_revision" },
        message: "must have required property '" + "schema_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    if (data.profile_family === undefined) {
      const err17 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_family" },
        message: "must have required property '" + "profile_family" + "'",
      };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    if (data.profile_id === undefined) {
      const err18 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_id" },
        message: "must have required property '" + "profile_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    if (data.profile_revision === undefined) {
      const err19 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_revision" },
        message: "must have required property '" + "profile_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err19];
      } else {
        vErrors.push(err19);
      }
      errors++;
    }
    if (data.canonical_digest === undefined) {
      const err20 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "canonical_digest" },
        message: "must have required property '" + "canonical_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err20];
      } else {
        vErrors.push(err20);
      }
      errors++;
    }
    if (data.display === undefined) {
      const err21 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "display" },
        message: "must have required property '" + "display" + "'",
      };
      if (vErrors === null) {
        vErrors = [err21];
      } else {
        vErrors.push(err21);
      }
      errors++;
    }
    if (data.source_reference === undefined) {
      const err22 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_reference" },
        message: "must have required property '" + "source_reference" + "'",
      };
      if (vErrors === null) {
        vErrors = [err22];
      } else {
        vErrors.push(err22);
      }
      errors++;
    }
    if (data.source_kind === undefined) {
      const err23 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_kind" },
        message: "must have required property '" + "source_kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err23];
      } else {
        vErrors.push(err23);
      }
      errors++;
    }
    if (data.license === undefined) {
      const err24 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "license" },
        message: "must have required property '" + "license" + "'",
      };
      if (vErrors === null) {
        vErrors = [err24];
      } else {
        vErrors.push(err24);
      }
      errors++;
    }
    if (data.valid_regime === undefined) {
      const err25 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "valid_regime" },
        message: "must have required property '" + "valid_regime" + "'",
      };
      if (vErrors === null) {
        vErrors = [err25];
      } else {
        vErrors.push(err25);
      }
      errors++;
    }
    if (data.lifecycle === undefined) {
      const err26 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "lifecycle" },
        message: "must have required property '" + "lifecycle" + "'",
      };
      if (vErrors === null) {
        vErrors = [err26];
      } else {
        vErrors.push(err26);
      }
      errors++;
    }
    if (data.calibration_status === undefined) {
      const err27 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calibration_status" },
        message: "must have required property '" + "calibration_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err27];
      } else {
        vErrors.push(err27);
      }
      errors++;
    }
    if (data.calibration_binding === undefined) {
      const err28 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calibration_binding" },
        message: "must have required property '" + "calibration_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err28];
      } else {
        vErrors.push(err28);
      }
      errors++;
    }
    if (data.held_out_validation_status === undefined) {
      const err29 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "held_out_validation_status" },
        message: "must have required property '" + "held_out_validation_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err29];
      } else {
        vErrors.push(err29);
      }
      errors++;
    }
    if (data.held_out_validation_binding === undefined) {
      const err30 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "held_out_validation_binding" },
        message: "must have required property '" + "held_out_validation_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err30];
      } else {
        vErrors.push(err30);
      }
      errors++;
    }
    if (data.allowed_claim_scope === undefined) {
      const err31 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "allowed_claim_scope" },
        message: "must have required property '" + "allowed_claim_scope" + "'",
      };
      if (vErrors === null) {
        vErrors = [err31];
      } else {
        vErrors.push(err31);
      }
      errors++;
    }
    if (data.sensitivity === undefined) {
      const err32 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "sensitivity" },
        message: "must have required property '" + "sensitivity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err32];
      } else {
        vErrors.push(err32);
      }
      errors++;
    }
    if (data.visibility === undefined) {
      const err33 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "visibility" },
        message: "must have required property '" + "visibility" + "'",
      };
      if (vErrors === null) {
        vErrors = [err33];
      } else {
        vErrors.push(err33);
      }
      errors++;
    }
    if (data.facts === undefined) {
      const err34 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "facts" },
        message: "must have required property '" + "facts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err34];
      } else {
        vErrors.push(err34);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema33.properties, key0)) {
        const err35 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.schema_identity !== undefined) {
      let data10 = data.schema_identity;
      if (typeof data10 === "string") {
        if (!pattern4.test(data10)) {
          const err36 = {
            instancePath: instancePath + "/schema_identity",
            schemaPath: "#/$defs/stableId/pattern",
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
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.schema_revision !== undefined) {
      let data11 = data.schema_revision;
      if (typeof data11 === "string") {
        if (!pattern5.test(data11)) {
          const err38 = {
            instancePath: instancePath + "/schema_revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/schema_revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.profile_family !== undefined) {
      let data12 = data.profile_family;
      if (!(
        data12 === "model" ||
        data12 === "engine" ||
        data12 === "device" ||
        data12 === "topology" ||
        data12 === "workload"
      )) {
        const err40 = {
          instancePath: instancePath + "/profile_family",
          schemaPath: "#/properties/profile_family/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.profile_family.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
    if (data.profile_id !== undefined) {
      let data13 = data.profile_id;
      if (typeof data13 === "string") {
        if (!pattern4.test(data13)) {
          const err41 = {
            instancePath: instancePath + "/profile_id",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/profile_id",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.profile_revision !== undefined) {
      let data14 = data.profile_revision;
      if (typeof data14 === "string") {
        if (!pattern5.test(data14)) {
          const err43 = {
            instancePath: instancePath + "/profile_revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/profile_revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.canonical_digest !== undefined) {
      let data15 = data.canonical_digest;
      if (typeof data15 === "string") {
        if (!pattern5.test(data15)) {
          const err45 = {
            instancePath: instancePath + "/canonical_digest",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/canonical_digest",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.display !== undefined) {
      let data16 = data.display;
      if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
        if (data16.name === undefined) {
          const err47 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "name" },
            message: "must have required property '" + "name" + "'",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
        if (data16.description === undefined) {
          const err48 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "description" },
            message: "must have required property '" + "description" + "'",
          };
          if (vErrors === null) {
            vErrors = [err48];
          } else {
            vErrors.push(err48);
          }
          errors++;
        }
        if (data16.labels === undefined) {
          const err49 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "labels" },
            message: "must have required property '" + "labels" + "'",
          };
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        for (const key1 in data16) {
          if (!(key1 === "name" || key1 === "description" || key1 === "labels")) {
            const err50 = {
              instancePath: instancePath + "/display",
              schemaPath: "#/properties/display/additionalProperties",
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
        if (data16.name !== undefined) {
          let data17 = data16.name;
          if (typeof data17 === "string") {
            if (func2(data17) > 160) {
              const err51 = {
                instancePath: instancePath + "/display/name",
                schemaPath: "#/properties/display/properties/name/maxLength",
                keyword: "maxLength",
                params: { limit: 160 },
                message: "must NOT have more than 160 characters",
              };
              if (vErrors === null) {
                vErrors = [err51];
              } else {
                vErrors.push(err51);
              }
              errors++;
            }
            if (func2(data17) < 1) {
              const err52 = {
                instancePath: instancePath + "/display/name",
                schemaPath: "#/properties/display/properties/name/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/display/name",
              schemaPath: "#/properties/display/properties/name/type",
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
        if (data16.description !== undefined) {
          let data18 = data16.description;
          if (typeof data18 === "string") {
            if (func2(data18) > 1000) {
              const err54 = {
                instancePath: instancePath + "/display/description",
                schemaPath: "#/properties/display/properties/description/maxLength",
                keyword: "maxLength",
                params: { limit: 1000 },
                message: "must NOT have more than 1000 characters",
              };
              if (vErrors === null) {
                vErrors = [err54];
              } else {
                vErrors.push(err54);
              }
              errors++;
            }
            if (func2(data18) < 1) {
              const err55 = {
                instancePath: instancePath + "/display/description",
                schemaPath: "#/properties/display/properties/description/minLength",
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
              instancePath: instancePath + "/display/description",
              schemaPath: "#/properties/display/properties/description/type",
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
        if (data16.labels !== undefined) {
          let data19 = data16.labels;
          if (Array.isArray(data19)) {
            const len0 = data19.length;
            for (let i0 = 0; i0 < len0; i0++) {
              let data20 = data19[i0];
              if (typeof data20 === "string") {
                if (func2(data20) > 80) {
                  const err57 = {
                    instancePath: instancePath + "/display/labels/" + i0,
                    schemaPath: "#/properties/display/properties/labels/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 80 },
                    message: "must NOT have more than 80 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err57];
                  } else {
                    vErrors.push(err57);
                  }
                  errors++;
                }
                if (func2(data20) < 1) {
                  const err58 = {
                    instancePath: instancePath + "/display/labels/" + i0,
                    schemaPath: "#/properties/display/properties/labels/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err58];
                  } else {
                    vErrors.push(err58);
                  }
                  errors++;
                }
              } else {
                const err59 = {
                  instancePath: instancePath + "/display/labels/" + i0,
                  schemaPath: "#/properties/display/properties/labels/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err59];
                } else {
                  vErrors.push(err59);
                }
                errors++;
              }
            }
            let i1 = data19.length;
            let j0;
            if (i1 > 1) {
              const indices0 = {};
              for (; i1--;) {
                let item0 = data19[i1];
                if (typeof item0 !== "string") {
                  continue;
                }
                if (typeof indices0[item0] == "number") {
                  j0 = indices0[item0];
                  const err60 = {
                    instancePath: instancePath + "/display/labels",
                    schemaPath: "#/properties/display/properties/labels/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i1, j: j0 },
                    message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err60];
                  } else {
                    vErrors.push(err60);
                  }
                  errors++;
                  break;
                }
                indices0[item0] = i1;
              }
            }
          } else {
            const err61 = {
              instancePath: instancePath + "/display/labels",
              schemaPath: "#/properties/display/properties/labels/type",
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
      } else {
        const err62 = {
          instancePath: instancePath + "/display",
          schemaPath: "#/properties/display/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err62];
        } else {
          vErrors.push(err62);
        }
        errors++;
      }
    }
    if (data.source_reference !== undefined) {
      let data21 = data.source_reference;
      if (typeof data21 === "string") {
        if (!pattern4.test(data21)) {
          const err63 = {
            instancePath: instancePath + "/source_reference",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/source_reference",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.source_kind !== undefined) {
      let data22 = data.source_kind;
      if (!(
        data22 === "real_trace" ||
        data22 === "synthetic_trace" ||
        data22 === "compatibility_harness_trace" ||
        data22 === "reviewed_registry" ||
        data22 === "vendor_specification" ||
        data22 === "user_input"
      )) {
        const err65 = {
          instancePath: instancePath + "/source_kind",
          schemaPath: "#/$defs/sourceKind/enum",
          keyword: "enum",
          params: { allowedValues: schema44.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err65];
        } else {
          vErrors.push(err65);
        }
        errors++;
      }
    }
    if (data.license !== undefined) {
      let data23 = data.license;
      if (data23 && typeof data23 == "object" && !Array.isArray(data23)) {
        if (data23.spdx_id === undefined) {
          const err66 = {
            instancePath: instancePath + "/license",
            schemaPath: "#/properties/license/required",
            keyword: "required",
            params: { missingProperty: "spdx_id" },
            message: "must have required property '" + "spdx_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err66];
          } else {
            vErrors.push(err66);
          }
          errors++;
        }
        if (data23.redistribution_allowed === undefined) {
          const err67 = {
            instancePath: instancePath + "/license",
            schemaPath: "#/properties/license/required",
            keyword: "required",
            params: { missingProperty: "redistribution_allowed" },
            message: "must have required property '" + "redistribution_allowed" + "'",
          };
          if (vErrors === null) {
            vErrors = [err67];
          } else {
            vErrors.push(err67);
          }
          errors++;
        }
        for (const key2 in data23) {
          if (!(key2 === "spdx_id" || key2 === "redistribution_allowed" || key2 === "notice_reference")) {
            const err68 = {
              instancePath: instancePath + "/license",
              schemaPath: "#/properties/license/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err68];
            } else {
              vErrors.push(err68);
            }
            errors++;
          }
        }
        if (data23.spdx_id !== undefined) {
          let data24 = data23.spdx_id;
          if (typeof data24 === "string") {
            if (func2(data24) > 80) {
              const err69 = {
                instancePath: instancePath + "/license/spdx_id",
                schemaPath: "#/properties/license/properties/spdx_id/maxLength",
                keyword: "maxLength",
                params: { limit: 80 },
                message: "must NOT have more than 80 characters",
              };
              if (vErrors === null) {
                vErrors = [err69];
              } else {
                vErrors.push(err69);
              }
              errors++;
            }
            if (func2(data24) < 1) {
              const err70 = {
                instancePath: instancePath + "/license/spdx_id",
                schemaPath: "#/properties/license/properties/spdx_id/minLength",
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
              instancePath: instancePath + "/license/spdx_id",
              schemaPath: "#/properties/license/properties/spdx_id/type",
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
        if (data23.redistribution_allowed !== undefined) {
          if (typeof data23.redistribution_allowed !== "boolean") {
            const err72 = {
              instancePath: instancePath + "/license/redistribution_allowed",
              schemaPath: "#/properties/license/properties/redistribution_allowed/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err72];
            } else {
              vErrors.push(err72);
            }
            errors++;
          }
        }
        if (data23.notice_reference !== undefined) {
          let data26 = data23.notice_reference;
          if (typeof data26 !== "string" && data26 !== null) {
            const err73 = {
              instancePath: instancePath + "/license/notice_reference",
              schemaPath: "#/properties/license/properties/notice_reference/type",
              keyword: "type",
              params: { type: schema33.properties.license.properties.notice_reference.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err73];
            } else {
              vErrors.push(err73);
            }
            errors++;
          }
          if (typeof data26 === "string") {
            if (func2(data26) > 512) {
              const err74 = {
                instancePath: instancePath + "/license/notice_reference",
                schemaPath: "#/properties/license/properties/notice_reference/maxLength",
                keyword: "maxLength",
                params: { limit: 512 },
                message: "must NOT have more than 512 characters",
              };
              if (vErrors === null) {
                vErrors = [err74];
              } else {
                vErrors.push(err74);
              }
              errors++;
            }
          }
        }
      } else {
        const err75 = {
          instancePath: instancePath + "/license",
          schemaPath: "#/properties/license/type",
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
    if (data.valid_regime !== undefined) {
      let data27 = data.valid_regime;
      if (data27 && typeof data27 == "object" && !Array.isArray(data27)) {
        if (data27.description === undefined) {
          const err76 = {
            instancePath: instancePath + "/valid_regime",
            schemaPath: "#/properties/valid_regime/required",
            keyword: "required",
            params: { missingProperty: "description" },
            message: "must have required property '" + "description" + "'",
          };
          if (vErrors === null) {
            vErrors = [err76];
          } else {
            vErrors.push(err76);
          }
          errors++;
        }
        if (data27.constraints === undefined) {
          const err77 = {
            instancePath: instancePath + "/valid_regime",
            schemaPath: "#/properties/valid_regime/required",
            keyword: "required",
            params: { missingProperty: "constraints" },
            message: "must have required property '" + "constraints" + "'",
          };
          if (vErrors === null) {
            vErrors = [err77];
          } else {
            vErrors.push(err77);
          }
          errors++;
        }
        for (const key3 in data27) {
          if (!(key3 === "description" || key3 === "constraints")) {
            const err78 = {
              instancePath: instancePath + "/valid_regime",
              schemaPath: "#/properties/valid_regime/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key3 },
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
        if (data27.description !== undefined) {
          let data28 = data27.description;
          if (typeof data28 === "string") {
            if (func2(data28) > 1000) {
              const err79 = {
                instancePath: instancePath + "/valid_regime/description",
                schemaPath: "#/properties/valid_regime/properties/description/maxLength",
                keyword: "maxLength",
                params: { limit: 1000 },
                message: "must NOT have more than 1000 characters",
              };
              if (vErrors === null) {
                vErrors = [err79];
              } else {
                vErrors.push(err79);
              }
              errors++;
            }
            if (func2(data28) < 1) {
              const err80 = {
                instancePath: instancePath + "/valid_regime/description",
                schemaPath: "#/properties/valid_regime/properties/description/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/valid_regime/description",
              schemaPath: "#/properties/valid_regime/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err81];
            } else {
              vErrors.push(err81);
            }
            errors++;
          }
        }
        if (data27.constraints !== undefined) {
          let data29 = data27.constraints;
          if (Array.isArray(data29)) {
            if (data29.length < 1) {
              const err82 = {
                instancePath: instancePath + "/valid_regime/constraints",
                schemaPath: "#/properties/valid_regime/properties/constraints/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              if (vErrors === null) {
                vErrors = [err82];
              } else {
                vErrors.push(err82);
              }
              errors++;
            }
            const len1 = data29.length;
            for (let i2 = 0; i2 < len1; i2++) {
              let data30 = data29[i2];
              if (typeof data30 === "string") {
                if (func2(data30) > 300) {
                  const err83 = {
                    instancePath: instancePath + "/valid_regime/constraints/" + i2,
                    schemaPath: "#/properties/valid_regime/properties/constraints/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 300 },
                    message: "must NOT have more than 300 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err83];
                  } else {
                    vErrors.push(err83);
                  }
                  errors++;
                }
                if (func2(data30) < 1) {
                  const err84 = {
                    instancePath: instancePath + "/valid_regime/constraints/" + i2,
                    schemaPath: "#/properties/valid_regime/properties/constraints/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err84];
                  } else {
                    vErrors.push(err84);
                  }
                  errors++;
                }
              } else {
                const err85 = {
                  instancePath: instancePath + "/valid_regime/constraints/" + i2,
                  schemaPath: "#/properties/valid_regime/properties/constraints/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err85];
                } else {
                  vErrors.push(err85);
                }
                errors++;
              }
            }
            let i3 = data29.length;
            let j1;
            if (i3 > 1) {
              const indices1 = {};
              for (; i3--;) {
                let item1 = data29[i3];
                if (typeof item1 !== "string") {
                  continue;
                }
                if (typeof indices1[item1] == "number") {
                  j1 = indices1[item1];
                  const err86 = {
                    instancePath: instancePath + "/valid_regime/constraints",
                    schemaPath: "#/properties/valid_regime/properties/constraints/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i3, j: j1 },
                    message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err86];
                  } else {
                    vErrors.push(err86);
                  }
                  errors++;
                  break;
                }
                indices1[item1] = i3;
              }
            }
          } else {
            const err87 = {
              instancePath: instancePath + "/valid_regime/constraints",
              schemaPath: "#/properties/valid_regime/properties/constraints/type",
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
      } else {
        const err88 = {
          instancePath: instancePath + "/valid_regime",
          schemaPath: "#/properties/valid_regime/type",
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
    if (data.lifecycle !== undefined) {
      let data31 = data.lifecycle;
      if (data31 && typeof data31 == "object" && !Array.isArray(data31)) {
        if (data31.introduced_at === undefined) {
          const err89 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "introduced_at" },
            message: "must have required property '" + "introduced_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err89];
          } else {
            vErrors.push(err89);
          }
          errors++;
        }
        if (data31.updated_at === undefined) {
          const err90 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "updated_at" },
            message: "must have required property '" + "updated_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err90];
          } else {
            vErrors.push(err90);
          }
          errors++;
        }
        if (data31.expires_at === undefined) {
          const err91 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "expires_at" },
            message: "must have required property '" + "expires_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err91];
          } else {
            vErrors.push(err91);
          }
          errors++;
        }
        if (data31.status === undefined) {
          const err92 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "status" },
            message: "must have required property '" + "status" + "'",
          };
          if (vErrors === null) {
            vErrors = [err92];
          } else {
            vErrors.push(err92);
          }
          errors++;
        }
        for (const key4 in data31) {
          if (!(key4 === "introduced_at" || key4 === "updated_at" || key4 === "expires_at" || key4 === "status")) {
            const err93 = {
              instancePath: instancePath + "/lifecycle",
              schemaPath: "#/properties/lifecycle/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key4 },
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
        if (data31.introduced_at !== undefined) {
          if (!(typeof data31.introduced_at === "string")) {
            const err94 = {
              instancePath: instancePath + "/lifecycle/introduced_at",
              schemaPath: "#/properties/lifecycle/properties/introduced_at/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err94];
            } else {
              vErrors.push(err94);
            }
            errors++;
          }
        }
        if (data31.updated_at !== undefined) {
          if (!(typeof data31.updated_at === "string")) {
            const err95 = {
              instancePath: instancePath + "/lifecycle/updated_at",
              schemaPath: "#/properties/lifecycle/properties/updated_at/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err95];
            } else {
              vErrors.push(err95);
            }
            errors++;
          }
        }
        if (data31.expires_at !== undefined) {
          let data34 = data31.expires_at;
          if (typeof data34 !== "string" && data34 !== null) {
            const err96 = {
              instancePath: instancePath + "/lifecycle/expires_at",
              schemaPath: "#/properties/lifecycle/properties/expires_at/type",
              keyword: "type",
              params: { type: schema33.properties.lifecycle.properties.expires_at.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err96];
            } else {
              vErrors.push(err96);
            }
            errors++;
          }
        }
        if (data31.status !== undefined) {
          let data35 = data31.status;
          if (!(
            data35 === "available" ||
            data35 === "deprecated" ||
            data35 === "expired" ||
            data35 === "revoked" ||
            data35 === "unavailable"
          )) {
            const err97 = {
              instancePath: instancePath + "/lifecycle/status",
              schemaPath: "#/properties/lifecycle/properties/status/enum",
              keyword: "enum",
              params: { allowedValues: schema33.properties.lifecycle.properties.status.enum },
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
      } else {
        const err98 = {
          instancePath: instancePath + "/lifecycle",
          schemaPath: "#/properties/lifecycle/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err98];
        } else {
          vErrors.push(err98);
        }
        errors++;
      }
    }
    if (data.calibration_status !== undefined) {
      let data36 = data.calibration_status;
      if (!(
        data36 === "not_applicable" ||
        data36 === "missing" ||
        data36 === "fixture_consistency_only" ||
        data36 === "calibrated"
      )) {
        const err99 = {
          instancePath: instancePath + "/calibration_status",
          schemaPath: "#/properties/calibration_status/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.calibration_status.enum },
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
    if (data.calibration_binding !== undefined) {
      let data37 = data.calibration_binding;
      const _errs92 = errors;
      let valid30 = false;
      let passing0 = null;
      const _errs93 = errors;
      if (
        !validate23(data37, {
          instancePath: instancePath + "/calibration_binding",
          parentData: data,
          parentDataProperty: "calibration_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
      var _valid3 = _errs93 === errors;
      if (_valid3) {
        valid30 = true;
        passing0 = 0;
      }
      const _errs94 = errors;
      if (data37 !== null) {
        const err100 = {
          instancePath: instancePath + "/calibration_binding",
          schemaPath: "#/properties/calibration_binding/oneOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err100];
        } else {
          vErrors.push(err100);
        }
        errors++;
      }
      var _valid3 = _errs94 === errors;
      if (_valid3 && valid30) {
        valid30 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid3) {
          valid30 = true;
          passing0 = 1;
        }
      }
      if (!valid30) {
        const err101 = {
          instancePath: instancePath + "/calibration_binding",
          schemaPath: "#/properties/calibration_binding/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing0 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err101];
        } else {
          vErrors.push(err101);
        }
        errors++;
      } else {
        errors = _errs92;
        if (vErrors !== null) {
          if (_errs92) {
            vErrors.length = _errs92;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.held_out_validation_status !== undefined) {
      let data38 = data.held_out_validation_status;
      if (!(data38 === "missing" || data38 === "fixture_consistency_only" || data38 === "validated")) {
        const err102 = {
          instancePath: instancePath + "/held_out_validation_status",
          schemaPath: "#/properties/held_out_validation_status/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.held_out_validation_status.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err102];
        } else {
          vErrors.push(err102);
        }
        errors++;
      }
    }
    if (data.held_out_validation_binding !== undefined) {
      let data39 = data.held_out_validation_binding;
      const _errs98 = errors;
      let valid31 = false;
      let passing1 = null;
      const _errs99 = errors;
      if (
        !validate23(data39, {
          instancePath: instancePath + "/held_out_validation_binding",
          parentData: data,
          parentDataProperty: "held_out_validation_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
      var _valid4 = _errs99 === errors;
      if (_valid4) {
        valid31 = true;
        passing1 = 0;
      }
      const _errs100 = errors;
      if (data39 !== null) {
        const err103 = {
          instancePath: instancePath + "/held_out_validation_binding",
          schemaPath: "#/properties/held_out_validation_binding/oneOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err103];
        } else {
          vErrors.push(err103);
        }
        errors++;
      }
      var _valid4 = _errs100 === errors;
      if (_valid4 && valid31) {
        valid31 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid4) {
          valid31 = true;
          passing1 = 1;
        }
      }
      if (!valid31) {
        const err104 = {
          instancePath: instancePath + "/held_out_validation_binding",
          schemaPath: "#/properties/held_out_validation_binding/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing1 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err104];
        } else {
          vErrors.push(err104);
        }
        errors++;
      } else {
        errors = _errs98;
        if (vErrors !== null) {
          if (_errs98) {
            vErrors.length = _errs98;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.allowed_claim_scope !== undefined) {
      let data40 = data.allowed_claim_scope;
      if (!(
        data40 === "exploration" ||
        data40 === "synthetic_consistency" ||
        data40 === "limited_extrapolation" ||
        data40 === "similar_regime_conditional_prediction" ||
        data40 === "real_calibrated_validation"
      )) {
        const err105 = {
          instancePath: instancePath + "/allowed_claim_scope",
          schemaPath: "#/$defs/claimScope/enum",
          keyword: "enum",
          params: { allowedValues: schema45.enum },
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
    if (data.sensitivity !== undefined) {
      let data41 = data.sensitivity;
      if (!(data41 === "public" || data41 === "internal" || data41 === "restricted")) {
        const err106 = {
          instancePath: instancePath + "/sensitivity",
          schemaPath: "#/properties/sensitivity/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.sensitivity.enum },
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
    if (data.visibility !== undefined) {
      let data42 = data.visibility;
      if (!(data42 === "catalog" || data42 === "project" || data42 === "private")) {
        const err107 = {
          instancePath: instancePath + "/visibility",
          schemaPath: "#/properties/visibility/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.visibility.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err107];
        } else {
          vErrors.push(err107);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data43 = data.facts;
      if (data43 && typeof data43 == "object" && !Array.isArray(data43)) {
        if (Object.keys(data43).length < 1) {
          const err108 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/properties/facts/minProperties",
            keyword: "minProperties",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 properties",
          };
          if (vErrors === null) {
            vErrors = [err108];
          } else {
            vErrors.push(err108);
          }
          errors++;
        }
      } else {
        const err109 = {
          instancePath: instancePath + "/facts",
          schemaPath: "#/properties/facts/type",
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
  } else {
    const err110 = {
      instancePath,
      schemaPath: "#/type",
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
  validate74.errors = vErrors;
  return errors === 0;
}
validate74.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate80(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate80.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value !== undefined) {
      let data0 = data.value;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err0 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/allOf/1/properties/value/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
      } else {
        const err1 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/allOf/1/properties/value/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
  }
  validate80.errors = vErrors;
  return errors === 0;
}
validate80.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate83(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate83.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value !== undefined) {
      let data0 = data.value;
      if (typeof data0 === "string") {
        if (!pattern16.test(data0)) {
          const err0 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/$defs/uint64/pattern",
            keyword: "pattern",
            params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
            message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
      } else {
        const err1 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/$defs/uint64/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
  }
  validate83.errors = vErrors;
  return errors === 0;
}
validate83.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const schema92 = { allOf: [{ $ref: "#/$defs/fact" }, { properties: { value: { $ref: "#/$defs/decimal" } } }] };
function validate86(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate86.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value !== undefined) {
      let data0 = data.value;
      const _errs5 = errors;
      const _errs6 = errors;
      if (typeof data0 === "string") {
        if (!pattern14.test(data0)) {
          const err0 = {};
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
      }
      var valid3 = _errs6 === errors;
      if (valid3) {
        const err1 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/$defs/decimal/not",
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
        errors = _errs5;
        if (vErrors !== null) {
          if (_errs5) {
            vErrors.length = _errs5;
          } else {
            vErrors = null;
          }
        }
      }
      if (typeof data0 === "string") {
        if (!pattern15.test(data0)) {
          const err2 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/$defs/decimal/pattern",
            keyword: "pattern",
            params: { pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" },
            message: 'must match pattern "' + "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
      } else {
        const err3 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/$defs/decimal/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
  }
  validate86.errors = vErrors;
  return errors === 0;
}
validate86.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate73(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-phase2/topology-profile.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate73.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate74(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate74.errors : vErrors.concat(validate74.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_topology_profile.v2" !== data.schema_identity) {
        const err0 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/allOf/1/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_topology_profile.v2" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.profile_family !== undefined) {
      if ("topology" !== data.profile_family) {
        const err1 = {
          instancePath: instancePath + "/profile_family",
          schemaPath: "#/allOf/1/properties/profile_family/const",
          keyword: "const",
          params: { allowedValue: "topology" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data2 = data.facts;
      if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
        if (data2.topology_kind === undefined) {
          const err2 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "topology_kind" },
            message: "must have required property '" + "topology_kind" + "'",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (data2.endpoint_count === undefined) {
          const err3 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "endpoint_count" },
            message: "must have required property '" + "endpoint_count" + "'",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (data2.link_bandwidth_gbps === undefined) {
          const err4 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "link_bandwidth_gbps" },
            message: "must have required property '" + "link_bandwidth_gbps" + "'",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (data2.link_latency_ps === undefined) {
          const err5 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "link_latency_ps" },
            message: "must have required property '" + "link_latency_ps" + "'",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (data2.routing_policy === undefined) {
          const err6 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "routing_policy" },
            message: "must have required property '" + "routing_policy" + "'",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        for (const key0 in data2) {
          if (!(
            key0 === "topology_kind" ||
            key0 === "endpoint_count" ||
            key0 === "link_bandwidth_gbps" ||
            key0 === "link_latency_ps" ||
            key0 === "routing_policy"
          )) {
            const err7 = {
              instancePath: instancePath + "/facts",
              schemaPath: "#/allOf/1/properties/facts/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key0 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
        if (data2.topology_kind !== undefined) {
          if (
            !validate80(data2.topology_kind, {
              instancePath: instancePath + "/facts/topology_kind",
              parentData: data2,
              parentDataProperty: "topology_kind",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate80.errors : vErrors.concat(validate80.errors);
            errors = vErrors.length;
          }
        }
        if (data2.endpoint_count !== undefined) {
          if (
            !validate83(data2.endpoint_count, {
              instancePath: instancePath + "/facts/endpoint_count",
              parentData: data2,
              parentDataProperty: "endpoint_count",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate83.errors : vErrors.concat(validate83.errors);
            errors = vErrors.length;
          }
        }
        if (data2.link_bandwidth_gbps !== undefined) {
          if (
            !validate86(data2.link_bandwidth_gbps, {
              instancePath: instancePath + "/facts/link_bandwidth_gbps",
              parentData: data2,
              parentDataProperty: "link_bandwidth_gbps",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate86.errors : vErrors.concat(validate86.errors);
            errors = vErrors.length;
          }
        }
        if (data2.link_latency_ps !== undefined) {
          if (
            !validate83(data2.link_latency_ps, {
              instancePath: instancePath + "/facts/link_latency_ps",
              parentData: data2,
              parentDataProperty: "link_latency_ps",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate83.errors : vErrors.concat(validate83.errors);
            errors = vErrors.length;
          }
        }
        if (data2.routing_policy !== undefined) {
          if (
            !validate80(data2.routing_policy, {
              instancePath: instancePath + "/facts/routing_policy",
              parentData: data2,
              parentDataProperty: "routing_policy",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate80.errors : vErrors.concat(validate80.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/facts",
          schemaPath: "#/allOf/1/properties/facts/type",
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
    }
  }
  validate73.errors = vErrors;
  return errors === 0;
}
validate73.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const workloadProfileV2 = validate91;
const schema94 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-phase2/workload-profile.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_workload_profile.v2",
  allOf: [
    { $ref: "common.schema.json#/$defs/profileEnvelope" },
    {
      properties: {
        schema_identity: { const: "tilesim.bridge.agent_orchestration_workload_profile.v2" },
        profile_family: { const: "workload" },
        facts: {
          type: "object",
          additionalProperties: false,
          required: ["template_kind", "request_count", "input_tokens", "output_tokens", "arrival_process"],
          properties: {
            template_kind: { $ref: "common.schema.json#/$defs/stringFact" },
            request_count: { $ref: "common.schema.json#/$defs/uint64Fact" },
            input_tokens: { $ref: "common.schema.json#/$defs/stringFact" },
            output_tokens: { $ref: "common.schema.json#/$defs/stringFact" },
            arrival_process: { $ref: "common.schema.json#/$defs/stringFact" },
          },
        },
      },
    },
  ],
};
function validate92(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate92.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs2 = errors;
  let valid1 = true;
  const _errs3 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.source_kind !== undefined) {
      let data0 = data.source_kind;
      if (!(data0 === "synthetic_trace" || data0 === "compatibility_harness_trace" || data0 === "user_input")) {
        const err0 = {};
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
  }
  var _valid0 = _errs3 === errors;
  errors = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs5 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.calibration_status !== undefined) {
        const _errs7 = errors;
        const _errs8 = errors;
        if ("calibrated" !== data.calibration_status) {
          const err1 = {};
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
        var valid4 = _errs8 === errors;
        if (valid4) {
          const err2 = {
            instancePath: instancePath + "/calibration_status",
            schemaPath: "#/allOf/0/then/properties/calibration_status/not",
            keyword: "not",
            params: {},
            message: "must NOT be valid",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        } else {
          errors = _errs7;
          if (vErrors !== null) {
            if (_errs7) {
              vErrors.length = _errs7;
            } else {
              vErrors = null;
            }
          }
        }
      }
      if (data.calibration_binding !== undefined) {
        if (data.calibration_binding !== null) {
          const err3 = {
            instancePath: instancePath + "/calibration_binding",
            schemaPath: "#/allOf/0/then/properties/calibration_binding/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      }
      if (data.held_out_validation_status !== undefined) {
        const _errs12 = errors;
        const _errs13 = errors;
        if ("validated" !== data.held_out_validation_status) {
          const err4 = {};
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        var valid5 = _errs13 === errors;
        if (valid5) {
          const err5 = {
            instancePath: instancePath + "/held_out_validation_status",
            schemaPath: "#/allOf/0/then/properties/held_out_validation_status/not",
            keyword: "not",
            params: {},
            message: "must NOT be valid",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        } else {
          errors = _errs12;
          if (vErrors !== null) {
            if (_errs12) {
              vErrors.length = _errs12;
            } else {
              vErrors = null;
            }
          }
        }
      }
      if (data.held_out_validation_binding !== undefined) {
        if (data.held_out_validation_binding !== null) {
          const err6 = {
            instancePath: instancePath + "/held_out_validation_binding",
            schemaPath: "#/allOf/0/then/properties/held_out_validation_binding/type",
            keyword: "type",
            params: { type: "null" },
            message: "must be null",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
      if (data.allowed_claim_scope !== undefined) {
        let data5 = data.allowed_claim_scope;
        if (!(data5 === "exploration" || data5 === "synthetic_consistency")) {
          const err7 = {
            instancePath: instancePath + "/allowed_claim_scope",
            schemaPath: "#/allOf/0/then/properties/allowed_claim_scope/enum",
            keyword: "enum",
            params: { allowedValues: schema33.allOf[0].then.properties.allowed_claim_scope.enum },
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
    }
    var _valid0 = _errs5 === errors;
    valid1 = _valid0;
    if (valid1) {
      var props0 = {};
      props0.calibration_status = true;
      props0.calibration_binding = true;
      props0.held_out_validation_status = true;
      props0.held_out_validation_binding = true;
      props0.allowed_claim_scope = true;
      props0.source_kind = true;
    }
  }
  if (!valid1) {
    const err8 = {
      instancePath,
      schemaPath: "#/allOf/0/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  const _errs18 = errors;
  let valid6 = true;
  const _errs19 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (data.calibration_status === undefined && (missing0 = "calibration_status")) {
      const err9 = {};
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    } else {
      if (data.calibration_status !== undefined) {
        if ("calibrated" !== data.calibration_status) {
          const err10 = {};
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      }
    }
  }
  var _valid1 = _errs19 === errors;
  errors = _errs18;
  if (vErrors !== null) {
    if (_errs18) {
      vErrors.length = _errs18;
    } else {
      vErrors = null;
    }
  }
  if (_valid1) {
    const _errs21 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.calibration_binding !== undefined) {
        if (
          !validate23(data.calibration_binding, {
            instancePath: instancePath + "/calibration_binding",
            parentData: data,
            parentDataProperty: "calibration_binding",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid1 = _errs21 === errors;
    valid6 = _valid1;
    if (valid6) {
      var props1 = {};
      props1.calibration_binding = true;
      props1.calibration_status = true;
    }
  }
  if (!valid6) {
    const err11 = {
      instancePath,
      schemaPath: "#/allOf/1/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  if (props0 !== true && props1 !== undefined) {
    if (props1 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props1);
    }
  }
  const _errs24 = errors;
  let valid9 = true;
  const _errs25 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing1;
    if (data.held_out_validation_status === undefined && (missing1 = "held_out_validation_status")) {
      const err12 = {};
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    } else {
      if (data.held_out_validation_status !== undefined) {
        if ("validated" !== data.held_out_validation_status) {
          const err13 = {};
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      }
    }
  }
  var _valid2 = _errs25 === errors;
  errors = _errs24;
  if (vErrors !== null) {
    if (_errs24) {
      vErrors.length = _errs24;
    } else {
      vErrors = null;
    }
  }
  if (_valid2) {
    const _errs27 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.held_out_validation_binding !== undefined) {
        if (
          !validate23(data.held_out_validation_binding, {
            instancePath: instancePath + "/held_out_validation_binding",
            parentData: data,
            parentDataProperty: "held_out_validation_binding",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid2 = _errs27 === errors;
    valid9 = _valid2;
    if (valid9) {
      var props2 = {};
      props2.held_out_validation_binding = true;
      props2.held_out_validation_status = true;
    }
  }
  if (!valid9) {
    const err14 = {
      instancePath,
      schemaPath: "#/allOf/2/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  if (props0 !== true && props2 !== undefined) {
    if (props2 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props2);
    }
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_identity" },
        message: "must have required property '" + "schema_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.schema_revision === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_revision" },
        message: "must have required property '" + "schema_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    if (data.profile_family === undefined) {
      const err17 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_family" },
        message: "must have required property '" + "profile_family" + "'",
      };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    if (data.profile_id === undefined) {
      const err18 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_id" },
        message: "must have required property '" + "profile_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    if (data.profile_revision === undefined) {
      const err19 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_revision" },
        message: "must have required property '" + "profile_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err19];
      } else {
        vErrors.push(err19);
      }
      errors++;
    }
    if (data.canonical_digest === undefined) {
      const err20 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "canonical_digest" },
        message: "must have required property '" + "canonical_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err20];
      } else {
        vErrors.push(err20);
      }
      errors++;
    }
    if (data.display === undefined) {
      const err21 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "display" },
        message: "must have required property '" + "display" + "'",
      };
      if (vErrors === null) {
        vErrors = [err21];
      } else {
        vErrors.push(err21);
      }
      errors++;
    }
    if (data.source_reference === undefined) {
      const err22 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_reference" },
        message: "must have required property '" + "source_reference" + "'",
      };
      if (vErrors === null) {
        vErrors = [err22];
      } else {
        vErrors.push(err22);
      }
      errors++;
    }
    if (data.source_kind === undefined) {
      const err23 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source_kind" },
        message: "must have required property '" + "source_kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err23];
      } else {
        vErrors.push(err23);
      }
      errors++;
    }
    if (data.license === undefined) {
      const err24 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "license" },
        message: "must have required property '" + "license" + "'",
      };
      if (vErrors === null) {
        vErrors = [err24];
      } else {
        vErrors.push(err24);
      }
      errors++;
    }
    if (data.valid_regime === undefined) {
      const err25 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "valid_regime" },
        message: "must have required property '" + "valid_regime" + "'",
      };
      if (vErrors === null) {
        vErrors = [err25];
      } else {
        vErrors.push(err25);
      }
      errors++;
    }
    if (data.lifecycle === undefined) {
      const err26 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "lifecycle" },
        message: "must have required property '" + "lifecycle" + "'",
      };
      if (vErrors === null) {
        vErrors = [err26];
      } else {
        vErrors.push(err26);
      }
      errors++;
    }
    if (data.calibration_status === undefined) {
      const err27 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calibration_status" },
        message: "must have required property '" + "calibration_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err27];
      } else {
        vErrors.push(err27);
      }
      errors++;
    }
    if (data.calibration_binding === undefined) {
      const err28 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calibration_binding" },
        message: "must have required property '" + "calibration_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err28];
      } else {
        vErrors.push(err28);
      }
      errors++;
    }
    if (data.held_out_validation_status === undefined) {
      const err29 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "held_out_validation_status" },
        message: "must have required property '" + "held_out_validation_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err29];
      } else {
        vErrors.push(err29);
      }
      errors++;
    }
    if (data.held_out_validation_binding === undefined) {
      const err30 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "held_out_validation_binding" },
        message: "must have required property '" + "held_out_validation_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err30];
      } else {
        vErrors.push(err30);
      }
      errors++;
    }
    if (data.allowed_claim_scope === undefined) {
      const err31 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "allowed_claim_scope" },
        message: "must have required property '" + "allowed_claim_scope" + "'",
      };
      if (vErrors === null) {
        vErrors = [err31];
      } else {
        vErrors.push(err31);
      }
      errors++;
    }
    if (data.sensitivity === undefined) {
      const err32 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "sensitivity" },
        message: "must have required property '" + "sensitivity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err32];
      } else {
        vErrors.push(err32);
      }
      errors++;
    }
    if (data.visibility === undefined) {
      const err33 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "visibility" },
        message: "must have required property '" + "visibility" + "'",
      };
      if (vErrors === null) {
        vErrors = [err33];
      } else {
        vErrors.push(err33);
      }
      errors++;
    }
    if (data.facts === undefined) {
      const err34 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "facts" },
        message: "must have required property '" + "facts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err34];
      } else {
        vErrors.push(err34);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema33.properties, key0)) {
        const err35 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.schema_identity !== undefined) {
      let data10 = data.schema_identity;
      if (typeof data10 === "string") {
        if (!pattern4.test(data10)) {
          const err36 = {
            instancePath: instancePath + "/schema_identity",
            schemaPath: "#/$defs/stableId/pattern",
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
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.schema_revision !== undefined) {
      let data11 = data.schema_revision;
      if (typeof data11 === "string") {
        if (!pattern5.test(data11)) {
          const err38 = {
            instancePath: instancePath + "/schema_revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/schema_revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.profile_family !== undefined) {
      let data12 = data.profile_family;
      if (!(
        data12 === "model" ||
        data12 === "engine" ||
        data12 === "device" ||
        data12 === "topology" ||
        data12 === "workload"
      )) {
        const err40 = {
          instancePath: instancePath + "/profile_family",
          schemaPath: "#/properties/profile_family/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.profile_family.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
    if (data.profile_id !== undefined) {
      let data13 = data.profile_id;
      if (typeof data13 === "string") {
        if (!pattern4.test(data13)) {
          const err41 = {
            instancePath: instancePath + "/profile_id",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/profile_id",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.profile_revision !== undefined) {
      let data14 = data.profile_revision;
      if (typeof data14 === "string") {
        if (!pattern5.test(data14)) {
          const err43 = {
            instancePath: instancePath + "/profile_revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/profile_revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.canonical_digest !== undefined) {
      let data15 = data.canonical_digest;
      if (typeof data15 === "string") {
        if (!pattern5.test(data15)) {
          const err45 = {
            instancePath: instancePath + "/canonical_digest",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/canonical_digest",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.display !== undefined) {
      let data16 = data.display;
      if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
        if (data16.name === undefined) {
          const err47 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "name" },
            message: "must have required property '" + "name" + "'",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
        if (data16.description === undefined) {
          const err48 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "description" },
            message: "must have required property '" + "description" + "'",
          };
          if (vErrors === null) {
            vErrors = [err48];
          } else {
            vErrors.push(err48);
          }
          errors++;
        }
        if (data16.labels === undefined) {
          const err49 = {
            instancePath: instancePath + "/display",
            schemaPath: "#/properties/display/required",
            keyword: "required",
            params: { missingProperty: "labels" },
            message: "must have required property '" + "labels" + "'",
          };
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        for (const key1 in data16) {
          if (!(key1 === "name" || key1 === "description" || key1 === "labels")) {
            const err50 = {
              instancePath: instancePath + "/display",
              schemaPath: "#/properties/display/additionalProperties",
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
        if (data16.name !== undefined) {
          let data17 = data16.name;
          if (typeof data17 === "string") {
            if (func2(data17) > 160) {
              const err51 = {
                instancePath: instancePath + "/display/name",
                schemaPath: "#/properties/display/properties/name/maxLength",
                keyword: "maxLength",
                params: { limit: 160 },
                message: "must NOT have more than 160 characters",
              };
              if (vErrors === null) {
                vErrors = [err51];
              } else {
                vErrors.push(err51);
              }
              errors++;
            }
            if (func2(data17) < 1) {
              const err52 = {
                instancePath: instancePath + "/display/name",
                schemaPath: "#/properties/display/properties/name/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/display/name",
              schemaPath: "#/properties/display/properties/name/type",
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
        if (data16.description !== undefined) {
          let data18 = data16.description;
          if (typeof data18 === "string") {
            if (func2(data18) > 1000) {
              const err54 = {
                instancePath: instancePath + "/display/description",
                schemaPath: "#/properties/display/properties/description/maxLength",
                keyword: "maxLength",
                params: { limit: 1000 },
                message: "must NOT have more than 1000 characters",
              };
              if (vErrors === null) {
                vErrors = [err54];
              } else {
                vErrors.push(err54);
              }
              errors++;
            }
            if (func2(data18) < 1) {
              const err55 = {
                instancePath: instancePath + "/display/description",
                schemaPath: "#/properties/display/properties/description/minLength",
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
              instancePath: instancePath + "/display/description",
              schemaPath: "#/properties/display/properties/description/type",
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
        if (data16.labels !== undefined) {
          let data19 = data16.labels;
          if (Array.isArray(data19)) {
            const len0 = data19.length;
            for (let i0 = 0; i0 < len0; i0++) {
              let data20 = data19[i0];
              if (typeof data20 === "string") {
                if (func2(data20) > 80) {
                  const err57 = {
                    instancePath: instancePath + "/display/labels/" + i0,
                    schemaPath: "#/properties/display/properties/labels/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 80 },
                    message: "must NOT have more than 80 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err57];
                  } else {
                    vErrors.push(err57);
                  }
                  errors++;
                }
                if (func2(data20) < 1) {
                  const err58 = {
                    instancePath: instancePath + "/display/labels/" + i0,
                    schemaPath: "#/properties/display/properties/labels/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err58];
                  } else {
                    vErrors.push(err58);
                  }
                  errors++;
                }
              } else {
                const err59 = {
                  instancePath: instancePath + "/display/labels/" + i0,
                  schemaPath: "#/properties/display/properties/labels/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err59];
                } else {
                  vErrors.push(err59);
                }
                errors++;
              }
            }
            let i1 = data19.length;
            let j0;
            if (i1 > 1) {
              const indices0 = {};
              for (; i1--;) {
                let item0 = data19[i1];
                if (typeof item0 !== "string") {
                  continue;
                }
                if (typeof indices0[item0] == "number") {
                  j0 = indices0[item0];
                  const err60 = {
                    instancePath: instancePath + "/display/labels",
                    schemaPath: "#/properties/display/properties/labels/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i1, j: j0 },
                    message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err60];
                  } else {
                    vErrors.push(err60);
                  }
                  errors++;
                  break;
                }
                indices0[item0] = i1;
              }
            }
          } else {
            const err61 = {
              instancePath: instancePath + "/display/labels",
              schemaPath: "#/properties/display/properties/labels/type",
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
      } else {
        const err62 = {
          instancePath: instancePath + "/display",
          schemaPath: "#/properties/display/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err62];
        } else {
          vErrors.push(err62);
        }
        errors++;
      }
    }
    if (data.source_reference !== undefined) {
      let data21 = data.source_reference;
      if (typeof data21 === "string") {
        if (!pattern4.test(data21)) {
          const err63 = {
            instancePath: instancePath + "/source_reference",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/source_reference",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.source_kind !== undefined) {
      let data22 = data.source_kind;
      if (!(
        data22 === "real_trace" ||
        data22 === "synthetic_trace" ||
        data22 === "compatibility_harness_trace" ||
        data22 === "reviewed_registry" ||
        data22 === "vendor_specification" ||
        data22 === "user_input"
      )) {
        const err65 = {
          instancePath: instancePath + "/source_kind",
          schemaPath: "#/$defs/sourceKind/enum",
          keyword: "enum",
          params: { allowedValues: schema44.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err65];
        } else {
          vErrors.push(err65);
        }
        errors++;
      }
    }
    if (data.license !== undefined) {
      let data23 = data.license;
      if (data23 && typeof data23 == "object" && !Array.isArray(data23)) {
        if (data23.spdx_id === undefined) {
          const err66 = {
            instancePath: instancePath + "/license",
            schemaPath: "#/properties/license/required",
            keyword: "required",
            params: { missingProperty: "spdx_id" },
            message: "must have required property '" + "spdx_id" + "'",
          };
          if (vErrors === null) {
            vErrors = [err66];
          } else {
            vErrors.push(err66);
          }
          errors++;
        }
        if (data23.redistribution_allowed === undefined) {
          const err67 = {
            instancePath: instancePath + "/license",
            schemaPath: "#/properties/license/required",
            keyword: "required",
            params: { missingProperty: "redistribution_allowed" },
            message: "must have required property '" + "redistribution_allowed" + "'",
          };
          if (vErrors === null) {
            vErrors = [err67];
          } else {
            vErrors.push(err67);
          }
          errors++;
        }
        for (const key2 in data23) {
          if (!(key2 === "spdx_id" || key2 === "redistribution_allowed" || key2 === "notice_reference")) {
            const err68 = {
              instancePath: instancePath + "/license",
              schemaPath: "#/properties/license/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err68];
            } else {
              vErrors.push(err68);
            }
            errors++;
          }
        }
        if (data23.spdx_id !== undefined) {
          let data24 = data23.spdx_id;
          if (typeof data24 === "string") {
            if (func2(data24) > 80) {
              const err69 = {
                instancePath: instancePath + "/license/spdx_id",
                schemaPath: "#/properties/license/properties/spdx_id/maxLength",
                keyword: "maxLength",
                params: { limit: 80 },
                message: "must NOT have more than 80 characters",
              };
              if (vErrors === null) {
                vErrors = [err69];
              } else {
                vErrors.push(err69);
              }
              errors++;
            }
            if (func2(data24) < 1) {
              const err70 = {
                instancePath: instancePath + "/license/spdx_id",
                schemaPath: "#/properties/license/properties/spdx_id/minLength",
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
              instancePath: instancePath + "/license/spdx_id",
              schemaPath: "#/properties/license/properties/spdx_id/type",
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
        if (data23.redistribution_allowed !== undefined) {
          if (typeof data23.redistribution_allowed !== "boolean") {
            const err72 = {
              instancePath: instancePath + "/license/redistribution_allowed",
              schemaPath: "#/properties/license/properties/redistribution_allowed/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err72];
            } else {
              vErrors.push(err72);
            }
            errors++;
          }
        }
        if (data23.notice_reference !== undefined) {
          let data26 = data23.notice_reference;
          if (typeof data26 !== "string" && data26 !== null) {
            const err73 = {
              instancePath: instancePath + "/license/notice_reference",
              schemaPath: "#/properties/license/properties/notice_reference/type",
              keyword: "type",
              params: { type: schema33.properties.license.properties.notice_reference.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err73];
            } else {
              vErrors.push(err73);
            }
            errors++;
          }
          if (typeof data26 === "string") {
            if (func2(data26) > 512) {
              const err74 = {
                instancePath: instancePath + "/license/notice_reference",
                schemaPath: "#/properties/license/properties/notice_reference/maxLength",
                keyword: "maxLength",
                params: { limit: 512 },
                message: "must NOT have more than 512 characters",
              };
              if (vErrors === null) {
                vErrors = [err74];
              } else {
                vErrors.push(err74);
              }
              errors++;
            }
          }
        }
      } else {
        const err75 = {
          instancePath: instancePath + "/license",
          schemaPath: "#/properties/license/type",
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
    if (data.valid_regime !== undefined) {
      let data27 = data.valid_regime;
      if (data27 && typeof data27 == "object" && !Array.isArray(data27)) {
        if (data27.description === undefined) {
          const err76 = {
            instancePath: instancePath + "/valid_regime",
            schemaPath: "#/properties/valid_regime/required",
            keyword: "required",
            params: { missingProperty: "description" },
            message: "must have required property '" + "description" + "'",
          };
          if (vErrors === null) {
            vErrors = [err76];
          } else {
            vErrors.push(err76);
          }
          errors++;
        }
        if (data27.constraints === undefined) {
          const err77 = {
            instancePath: instancePath + "/valid_regime",
            schemaPath: "#/properties/valid_regime/required",
            keyword: "required",
            params: { missingProperty: "constraints" },
            message: "must have required property '" + "constraints" + "'",
          };
          if (vErrors === null) {
            vErrors = [err77];
          } else {
            vErrors.push(err77);
          }
          errors++;
        }
        for (const key3 in data27) {
          if (!(key3 === "description" || key3 === "constraints")) {
            const err78 = {
              instancePath: instancePath + "/valid_regime",
              schemaPath: "#/properties/valid_regime/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key3 },
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
        if (data27.description !== undefined) {
          let data28 = data27.description;
          if (typeof data28 === "string") {
            if (func2(data28) > 1000) {
              const err79 = {
                instancePath: instancePath + "/valid_regime/description",
                schemaPath: "#/properties/valid_regime/properties/description/maxLength",
                keyword: "maxLength",
                params: { limit: 1000 },
                message: "must NOT have more than 1000 characters",
              };
              if (vErrors === null) {
                vErrors = [err79];
              } else {
                vErrors.push(err79);
              }
              errors++;
            }
            if (func2(data28) < 1) {
              const err80 = {
                instancePath: instancePath + "/valid_regime/description",
                schemaPath: "#/properties/valid_regime/properties/description/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
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
              instancePath: instancePath + "/valid_regime/description",
              schemaPath: "#/properties/valid_regime/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err81];
            } else {
              vErrors.push(err81);
            }
            errors++;
          }
        }
        if (data27.constraints !== undefined) {
          let data29 = data27.constraints;
          if (Array.isArray(data29)) {
            if (data29.length < 1) {
              const err82 = {
                instancePath: instancePath + "/valid_regime/constraints",
                schemaPath: "#/properties/valid_regime/properties/constraints/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              if (vErrors === null) {
                vErrors = [err82];
              } else {
                vErrors.push(err82);
              }
              errors++;
            }
            const len1 = data29.length;
            for (let i2 = 0; i2 < len1; i2++) {
              let data30 = data29[i2];
              if (typeof data30 === "string") {
                if (func2(data30) > 300) {
                  const err83 = {
                    instancePath: instancePath + "/valid_regime/constraints/" + i2,
                    schemaPath: "#/properties/valid_regime/properties/constraints/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 300 },
                    message: "must NOT have more than 300 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err83];
                  } else {
                    vErrors.push(err83);
                  }
                  errors++;
                }
                if (func2(data30) < 1) {
                  const err84 = {
                    instancePath: instancePath + "/valid_regime/constraints/" + i2,
                    schemaPath: "#/properties/valid_regime/properties/constraints/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err84];
                  } else {
                    vErrors.push(err84);
                  }
                  errors++;
                }
              } else {
                const err85 = {
                  instancePath: instancePath + "/valid_regime/constraints/" + i2,
                  schemaPath: "#/properties/valid_regime/properties/constraints/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err85];
                } else {
                  vErrors.push(err85);
                }
                errors++;
              }
            }
            let i3 = data29.length;
            let j1;
            if (i3 > 1) {
              const indices1 = {};
              for (; i3--;) {
                let item1 = data29[i3];
                if (typeof item1 !== "string") {
                  continue;
                }
                if (typeof indices1[item1] == "number") {
                  j1 = indices1[item1];
                  const err86 = {
                    instancePath: instancePath + "/valid_regime/constraints",
                    schemaPath: "#/properties/valid_regime/properties/constraints/uniqueItems",
                    keyword: "uniqueItems",
                    params: { i: i3, j: j1 },
                    message: "must NOT have duplicate items (items ## " + j1 + " and " + i3 + " are identical)",
                  };
                  if (vErrors === null) {
                    vErrors = [err86];
                  } else {
                    vErrors.push(err86);
                  }
                  errors++;
                  break;
                }
                indices1[item1] = i3;
              }
            }
          } else {
            const err87 = {
              instancePath: instancePath + "/valid_regime/constraints",
              schemaPath: "#/properties/valid_regime/properties/constraints/type",
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
      } else {
        const err88 = {
          instancePath: instancePath + "/valid_regime",
          schemaPath: "#/properties/valid_regime/type",
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
    if (data.lifecycle !== undefined) {
      let data31 = data.lifecycle;
      if (data31 && typeof data31 == "object" && !Array.isArray(data31)) {
        if (data31.introduced_at === undefined) {
          const err89 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "introduced_at" },
            message: "must have required property '" + "introduced_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err89];
          } else {
            vErrors.push(err89);
          }
          errors++;
        }
        if (data31.updated_at === undefined) {
          const err90 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "updated_at" },
            message: "must have required property '" + "updated_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err90];
          } else {
            vErrors.push(err90);
          }
          errors++;
        }
        if (data31.expires_at === undefined) {
          const err91 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "expires_at" },
            message: "must have required property '" + "expires_at" + "'",
          };
          if (vErrors === null) {
            vErrors = [err91];
          } else {
            vErrors.push(err91);
          }
          errors++;
        }
        if (data31.status === undefined) {
          const err92 = {
            instancePath: instancePath + "/lifecycle",
            schemaPath: "#/properties/lifecycle/required",
            keyword: "required",
            params: { missingProperty: "status" },
            message: "must have required property '" + "status" + "'",
          };
          if (vErrors === null) {
            vErrors = [err92];
          } else {
            vErrors.push(err92);
          }
          errors++;
        }
        for (const key4 in data31) {
          if (!(key4 === "introduced_at" || key4 === "updated_at" || key4 === "expires_at" || key4 === "status")) {
            const err93 = {
              instancePath: instancePath + "/lifecycle",
              schemaPath: "#/properties/lifecycle/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key4 },
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
        if (data31.introduced_at !== undefined) {
          if (!(typeof data31.introduced_at === "string")) {
            const err94 = {
              instancePath: instancePath + "/lifecycle/introduced_at",
              schemaPath: "#/properties/lifecycle/properties/introduced_at/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err94];
            } else {
              vErrors.push(err94);
            }
            errors++;
          }
        }
        if (data31.updated_at !== undefined) {
          if (!(typeof data31.updated_at === "string")) {
            const err95 = {
              instancePath: instancePath + "/lifecycle/updated_at",
              schemaPath: "#/properties/lifecycle/properties/updated_at/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err95];
            } else {
              vErrors.push(err95);
            }
            errors++;
          }
        }
        if (data31.expires_at !== undefined) {
          let data34 = data31.expires_at;
          if (typeof data34 !== "string" && data34 !== null) {
            const err96 = {
              instancePath: instancePath + "/lifecycle/expires_at",
              schemaPath: "#/properties/lifecycle/properties/expires_at/type",
              keyword: "type",
              params: { type: schema33.properties.lifecycle.properties.expires_at.type },
              message: "must be string,null",
            };
            if (vErrors === null) {
              vErrors = [err96];
            } else {
              vErrors.push(err96);
            }
            errors++;
          }
        }
        if (data31.status !== undefined) {
          let data35 = data31.status;
          if (!(
            data35 === "available" ||
            data35 === "deprecated" ||
            data35 === "expired" ||
            data35 === "revoked" ||
            data35 === "unavailable"
          )) {
            const err97 = {
              instancePath: instancePath + "/lifecycle/status",
              schemaPath: "#/properties/lifecycle/properties/status/enum",
              keyword: "enum",
              params: { allowedValues: schema33.properties.lifecycle.properties.status.enum },
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
      } else {
        const err98 = {
          instancePath: instancePath + "/lifecycle",
          schemaPath: "#/properties/lifecycle/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err98];
        } else {
          vErrors.push(err98);
        }
        errors++;
      }
    }
    if (data.calibration_status !== undefined) {
      let data36 = data.calibration_status;
      if (!(
        data36 === "not_applicable" ||
        data36 === "missing" ||
        data36 === "fixture_consistency_only" ||
        data36 === "calibrated"
      )) {
        const err99 = {
          instancePath: instancePath + "/calibration_status",
          schemaPath: "#/properties/calibration_status/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.calibration_status.enum },
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
    if (data.calibration_binding !== undefined) {
      let data37 = data.calibration_binding;
      const _errs92 = errors;
      let valid30 = false;
      let passing0 = null;
      const _errs93 = errors;
      if (
        !validate23(data37, {
          instancePath: instancePath + "/calibration_binding",
          parentData: data,
          parentDataProperty: "calibration_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
      var _valid3 = _errs93 === errors;
      if (_valid3) {
        valid30 = true;
        passing0 = 0;
      }
      const _errs94 = errors;
      if (data37 !== null) {
        const err100 = {
          instancePath: instancePath + "/calibration_binding",
          schemaPath: "#/properties/calibration_binding/oneOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err100];
        } else {
          vErrors.push(err100);
        }
        errors++;
      }
      var _valid3 = _errs94 === errors;
      if (_valid3 && valid30) {
        valid30 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid3) {
          valid30 = true;
          passing0 = 1;
        }
      }
      if (!valid30) {
        const err101 = {
          instancePath: instancePath + "/calibration_binding",
          schemaPath: "#/properties/calibration_binding/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing0 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err101];
        } else {
          vErrors.push(err101);
        }
        errors++;
      } else {
        errors = _errs92;
        if (vErrors !== null) {
          if (_errs92) {
            vErrors.length = _errs92;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.held_out_validation_status !== undefined) {
      let data38 = data.held_out_validation_status;
      if (!(data38 === "missing" || data38 === "fixture_consistency_only" || data38 === "validated")) {
        const err102 = {
          instancePath: instancePath + "/held_out_validation_status",
          schemaPath: "#/properties/held_out_validation_status/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.held_out_validation_status.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err102];
        } else {
          vErrors.push(err102);
        }
        errors++;
      }
    }
    if (data.held_out_validation_binding !== undefined) {
      let data39 = data.held_out_validation_binding;
      const _errs98 = errors;
      let valid31 = false;
      let passing1 = null;
      const _errs99 = errors;
      if (
        !validate23(data39, {
          instancePath: instancePath + "/held_out_validation_binding",
          parentData: data,
          parentDataProperty: "held_out_validation_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
      var _valid4 = _errs99 === errors;
      if (_valid4) {
        valid31 = true;
        passing1 = 0;
      }
      const _errs100 = errors;
      if (data39 !== null) {
        const err103 = {
          instancePath: instancePath + "/held_out_validation_binding",
          schemaPath: "#/properties/held_out_validation_binding/oneOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err103];
        } else {
          vErrors.push(err103);
        }
        errors++;
      }
      var _valid4 = _errs100 === errors;
      if (_valid4 && valid31) {
        valid31 = false;
        passing1 = [passing1, 1];
      } else {
        if (_valid4) {
          valid31 = true;
          passing1 = 1;
        }
      }
      if (!valid31) {
        const err104 = {
          instancePath: instancePath + "/held_out_validation_binding",
          schemaPath: "#/properties/held_out_validation_binding/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing1 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err104];
        } else {
          vErrors.push(err104);
        }
        errors++;
      } else {
        errors = _errs98;
        if (vErrors !== null) {
          if (_errs98) {
            vErrors.length = _errs98;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.allowed_claim_scope !== undefined) {
      let data40 = data.allowed_claim_scope;
      if (!(
        data40 === "exploration" ||
        data40 === "synthetic_consistency" ||
        data40 === "limited_extrapolation" ||
        data40 === "similar_regime_conditional_prediction" ||
        data40 === "real_calibrated_validation"
      )) {
        const err105 = {
          instancePath: instancePath + "/allowed_claim_scope",
          schemaPath: "#/$defs/claimScope/enum",
          keyword: "enum",
          params: { allowedValues: schema45.enum },
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
    if (data.sensitivity !== undefined) {
      let data41 = data.sensitivity;
      if (!(data41 === "public" || data41 === "internal" || data41 === "restricted")) {
        const err106 = {
          instancePath: instancePath + "/sensitivity",
          schemaPath: "#/properties/sensitivity/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.sensitivity.enum },
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
    if (data.visibility !== undefined) {
      let data42 = data.visibility;
      if (!(data42 === "catalog" || data42 === "project" || data42 === "private")) {
        const err107 = {
          instancePath: instancePath + "/visibility",
          schemaPath: "#/properties/visibility/enum",
          keyword: "enum",
          params: { allowedValues: schema33.properties.visibility.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err107];
        } else {
          vErrors.push(err107);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data43 = data.facts;
      if (data43 && typeof data43 == "object" && !Array.isArray(data43)) {
        if (Object.keys(data43).length < 1) {
          const err108 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/properties/facts/minProperties",
            keyword: "minProperties",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 properties",
          };
          if (vErrors === null) {
            vErrors = [err108];
          } else {
            vErrors.push(err108);
          }
          errors++;
        }
      } else {
        const err109 = {
          instancePath: instancePath + "/facts",
          schemaPath: "#/properties/facts/type",
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
  } else {
    const err110 = {
      instancePath,
      schemaPath: "#/type",
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
  validate92.errors = vErrors;
  return errors === 0;
}
validate92.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate98(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate98.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value !== undefined) {
      let data0 = data.value;
      if (typeof data0 === "string") {
        if (func2(data0) < 1) {
          const err0 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/allOf/1/properties/value/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
      } else {
        const err1 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/allOf/1/properties/value/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
  }
  validate98.errors = vErrors;
  return errors === 0;
}
validate98.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate101(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate101.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate30(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.value !== undefined) {
      let data0 = data.value;
      if (typeof data0 === "string") {
        if (!pattern16.test(data0)) {
          const err0 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/$defs/uint64/pattern",
            keyword: "pattern",
            params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
            message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
      } else {
        const err1 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/$defs/uint64/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
  }
  validate101.errors = vErrors;
  return errors === 0;
}
validate101.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate91(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-phase2/workload-profile.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate91.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (!validate92(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
    vErrors = vErrors === null ? validate92.errors : vErrors.concat(validate92.errors);
    errors = vErrors.length;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_workload_profile.v2" !== data.schema_identity) {
        const err0 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/allOf/1/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_workload_profile.v2" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.profile_family !== undefined) {
      if ("workload" !== data.profile_family) {
        const err1 = {
          instancePath: instancePath + "/profile_family",
          schemaPath: "#/allOf/1/properties/profile_family/const",
          keyword: "const",
          params: { allowedValue: "workload" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data2 = data.facts;
      if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
        if (data2.template_kind === undefined) {
          const err2 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "template_kind" },
            message: "must have required property '" + "template_kind" + "'",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (data2.request_count === undefined) {
          const err3 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "request_count" },
            message: "must have required property '" + "request_count" + "'",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (data2.input_tokens === undefined) {
          const err4 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "input_tokens" },
            message: "must have required property '" + "input_tokens" + "'",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (data2.output_tokens === undefined) {
          const err5 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "output_tokens" },
            message: "must have required property '" + "output_tokens" + "'",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (data2.arrival_process === undefined) {
          const err6 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/allOf/1/properties/facts/required",
            keyword: "required",
            params: { missingProperty: "arrival_process" },
            message: "must have required property '" + "arrival_process" + "'",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        for (const key0 in data2) {
          if (!(
            key0 === "template_kind" ||
            key0 === "request_count" ||
            key0 === "input_tokens" ||
            key0 === "output_tokens" ||
            key0 === "arrival_process"
          )) {
            const err7 = {
              instancePath: instancePath + "/facts",
              schemaPath: "#/allOf/1/properties/facts/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key0 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
        if (data2.template_kind !== undefined) {
          if (
            !validate98(data2.template_kind, {
              instancePath: instancePath + "/facts/template_kind",
              parentData: data2,
              parentDataProperty: "template_kind",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate98.errors : vErrors.concat(validate98.errors);
            errors = vErrors.length;
          }
        }
        if (data2.request_count !== undefined) {
          if (
            !validate101(data2.request_count, {
              instancePath: instancePath + "/facts/request_count",
              parentData: data2,
              parentDataProperty: "request_count",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate101.errors : vErrors.concat(validate101.errors);
            errors = vErrors.length;
          }
        }
        if (data2.input_tokens !== undefined) {
          if (
            !validate98(data2.input_tokens, {
              instancePath: instancePath + "/facts/input_tokens",
              parentData: data2,
              parentDataProperty: "input_tokens",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate98.errors : vErrors.concat(validate98.errors);
            errors = vErrors.length;
          }
        }
        if (data2.output_tokens !== undefined) {
          if (
            !validate98(data2.output_tokens, {
              instancePath: instancePath + "/facts/output_tokens",
              parentData: data2,
              parentDataProperty: "output_tokens",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate98.errors : vErrors.concat(validate98.errors);
            errors = vErrors.length;
          }
        }
        if (data2.arrival_process !== undefined) {
          if (
            !validate98(data2.arrival_process, {
              instancePath: instancePath + "/facts/arrival_process",
              parentData: data2,
              parentDataProperty: "arrival_process",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate98.errors : vErrors.concat(validate98.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/facts",
          schemaPath: "#/allOf/1/properties/facts/type",
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
    }
  }
  validate91.errors = vErrors;
  return errors === 0;
}
validate91.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const profileBindingV1 = validate107;
const schema107 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-phase2/profile-binding.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_profile_binding.v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "schema_revision",
    "binding_id",
    "binding_digest",
    "model",
    "engine",
    "device",
    "topology",
    "workload",
    "fidelity",
    "gpu_participation_mode",
  ],
  properties: {
    schema_identity: { const: "tilesim.bridge.agent_orchestration_profile_binding.v1" },
    schema_revision: { $ref: "common.schema.json#/$defs/sha256" },
    binding_id: { $ref: "common.schema.json#/$defs/stableId" },
    binding_digest: { $ref: "common.schema.json#/$defs/sha256" },
    model: {
      allOf: [
        { $ref: "common.schema.json#/$defs/profileReference" },
        {
          properties: {
            family: { const: "model" },
            identity: { const: "tilesim.bridge.agent_orchestration_model_profile.v2" },
          },
        },
      ],
    },
    engine: {
      allOf: [
        { $ref: "common.schema.json#/$defs/profileReference" },
        {
          properties: {
            family: { const: "engine" },
            identity: { const: "tilesim.bridge.agent_orchestration_engine_profile.v2" },
          },
        },
      ],
    },
    device: {
      allOf: [
        { $ref: "common.schema.json#/$defs/profileReference" },
        {
          properties: {
            family: { const: "device" },
            identity: { const: "tilesim.bridge.agent_orchestration_device_profile.v2" },
          },
        },
      ],
    },
    topology: {
      allOf: [
        { $ref: "common.schema.json#/$defs/profileReference" },
        {
          properties: {
            family: { const: "topology" },
            identity: { const: "tilesim.bridge.agent_orchestration_topology_profile.v2" },
          },
        },
      ],
    },
    workload: {
      allOf: [
        { $ref: "common.schema.json#/$defs/profileReference" },
        {
          properties: {
            family: { const: "workload" },
            identity: { const: "tilesim.bridge.agent_orchestration_workload_profile.v2" },
          },
        },
      ],
    },
    fidelity: { enum: ["Analytical", "DES", "Cycle"] },
    gpu_participation_mode: { enum: ["gpu_free", "gpu_assisted_trace", "gpu_in_loop"] },
  },
};
const schema111 = {
  type: "object",
  additionalProperties: false,
  required: ["family", "profile_id", "identity", "revision", "digest"],
  properties: {
    family: { enum: ["model", "engine", "device", "topology", "workload"] },
    profile_id: { $ref: "#/$defs/stableId" },
    identity: { $ref: "#/$defs/stableId" },
    revision: { $ref: "#/$defs/sha256" },
    digest: { $ref: "#/$defs/sha256" },
  },
};
function validate108(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate108.evaluated;
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
    if (data.profile_id === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_id" },
        message: "must have required property '" + "profile_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.identity === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "identity" },
        message: "must have required property '" + "identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.revision === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "revision" },
        message: "must have required property '" + "revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.digest === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "digest" },
        message: "must have required property '" + "digest" + "'",
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
        key0 === "family" ||
        key0 === "profile_id" ||
        key0 === "identity" ||
        key0 === "revision" ||
        key0 === "digest"
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
    if (data.family !== undefined) {
      let data0 = data.family;
      if (!(
        data0 === "model" ||
        data0 === "engine" ||
        data0 === "device" ||
        data0 === "topology" ||
        data0 === "workload"
      )) {
        const err6 = {
          instancePath: instancePath + "/family",
          schemaPath: "#/properties/family/enum",
          keyword: "enum",
          params: { allowedValues: schema111.properties.family.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.profile_id !== undefined) {
      let data1 = data.profile_id;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err7 = {
            instancePath: instancePath + "/profile_id",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/profile_id",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.identity !== undefined) {
      let data2 = data.identity;
      if (typeof data2 === "string") {
        if (!pattern4.test(data2)) {
          const err9 = {
            instancePath: instancePath + "/identity",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/identity",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.revision !== undefined) {
      let data3 = data.revision;
      if (typeof data3 === "string") {
        if (!pattern5.test(data3)) {
          const err11 = {
            instancePath: instancePath + "/revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.digest !== undefined) {
      let data4 = data.digest;
      if (typeof data4 === "string") {
        if (!pattern5.test(data4)) {
          const err13 = {
            instancePath: instancePath + "/digest",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/digest",
          schemaPath: "#/$defs/sha256/type",
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
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err15];
    } else {
      vErrors.push(err15);
    }
    errors++;
  }
  validate108.errors = vErrors;
  return errors === 0;
}
validate108.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate107(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-phase2/profile-binding.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate107.evaluated;
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
    if (data.schema_revision === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_revision" },
        message: "must have required property '" + "schema_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.binding_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "binding_id" },
        message: "must have required property '" + "binding_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.binding_digest === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "binding_digest" },
        message: "must have required property '" + "binding_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.model === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "model" },
        message: "must have required property '" + "model" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.engine === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "engine" },
        message: "must have required property '" + "engine" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.device === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "device" },
        message: "must have required property '" + "device" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.topology === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "topology" },
        message: "must have required property '" + "topology" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.workload === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "workload" },
        message: "must have required property '" + "workload" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.fidelity === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "fidelity" },
        message: "must have required property '" + "fidelity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.gpu_participation_mode === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "gpu_participation_mode" },
        message: "must have required property '" + "gpu_participation_mode" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema107.properties, key0)) {
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
      if ("tilesim.bridge.agent_orchestration_profile_binding.v1" !== data.schema_identity) {
        const err12 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_profile_binding.v1" },
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
    if (data.schema_revision !== undefined) {
      let data1 = data.schema_revision;
      if (typeof data1 === "string") {
        if (!pattern5.test(data1)) {
          const err13 = {
            instancePath: instancePath + "/schema_revision",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/schema_revision",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.binding_id !== undefined) {
      let data2 = data.binding_id;
      if (typeof data2 === "string") {
        if (!pattern4.test(data2)) {
          const err15 = {
            instancePath: instancePath + "/binding_id",
            schemaPath: "common.schema.json#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/binding_id",
          schemaPath: "common.schema.json#/$defs/stableId/type",
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
    if (data.binding_digest !== undefined) {
      let data3 = data.binding_digest;
      if (typeof data3 === "string") {
        if (!pattern5.test(data3)) {
          const err17 = {
            instancePath: instancePath + "/binding_digest",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
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
          instancePath: instancePath + "/binding_digest",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.model !== undefined) {
      let data4 = data.model;
      if (
        !validate108(data4, {
          instancePath: instancePath + "/model",
          parentData: data,
          parentDataProperty: "model",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate108.errors : vErrors.concat(validate108.errors);
        errors = vErrors.length;
      }
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
        if (data4.family !== undefined) {
          if ("model" !== data4.family) {
            const err19 = {
              instancePath: instancePath + "/model/family",
              schemaPath: "#/properties/model/allOf/1/properties/family/const",
              keyword: "const",
              params: { allowedValue: "model" },
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
        if (data4.identity !== undefined) {
          if ("tilesim.bridge.agent_orchestration_model_profile.v2" !== data4.identity) {
            const err20 = {
              instancePath: instancePath + "/model/identity",
              schemaPath: "#/properties/model/allOf/1/properties/identity/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.agent_orchestration_model_profile.v2" },
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
      }
    }
    if (data.engine !== undefined) {
      let data7 = data.engine;
      if (
        !validate108(data7, {
          instancePath: instancePath + "/engine",
          parentData: data,
          parentDataProperty: "engine",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate108.errors : vErrors.concat(validate108.errors);
        errors = vErrors.length;
      }
      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
        if (data7.family !== undefined) {
          if ("engine" !== data7.family) {
            const err21 = {
              instancePath: instancePath + "/engine/family",
              schemaPath: "#/properties/engine/allOf/1/properties/family/const",
              keyword: "const",
              params: { allowedValue: "engine" },
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
        if (data7.identity !== undefined) {
          if ("tilesim.bridge.agent_orchestration_engine_profile.v2" !== data7.identity) {
            const err22 = {
              instancePath: instancePath + "/engine/identity",
              schemaPath: "#/properties/engine/allOf/1/properties/identity/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.agent_orchestration_engine_profile.v2" },
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
      }
    }
    if (data.device !== undefined) {
      let data10 = data.device;
      if (
        !validate108(data10, {
          instancePath: instancePath + "/device",
          parentData: data,
          parentDataProperty: "device",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate108.errors : vErrors.concat(validate108.errors);
        errors = vErrors.length;
      }
      if (data10 && typeof data10 == "object" && !Array.isArray(data10)) {
        if (data10.family !== undefined) {
          if ("device" !== data10.family) {
            const err23 = {
              instancePath: instancePath + "/device/family",
              schemaPath: "#/properties/device/allOf/1/properties/family/const",
              keyword: "const",
              params: { allowedValue: "device" },
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
        if (data10.identity !== undefined) {
          if ("tilesim.bridge.agent_orchestration_device_profile.v2" !== data10.identity) {
            const err24 = {
              instancePath: instancePath + "/device/identity",
              schemaPath: "#/properties/device/allOf/1/properties/identity/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.agent_orchestration_device_profile.v2" },
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
      }
    }
    if (data.topology !== undefined) {
      let data13 = data.topology;
      if (
        !validate108(data13, {
          instancePath: instancePath + "/topology",
          parentData: data,
          parentDataProperty: "topology",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate108.errors : vErrors.concat(validate108.errors);
        errors = vErrors.length;
      }
      if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
        if (data13.family !== undefined) {
          if ("topology" !== data13.family) {
            const err25 = {
              instancePath: instancePath + "/topology/family",
              schemaPath: "#/properties/topology/allOf/1/properties/family/const",
              keyword: "const",
              params: { allowedValue: "topology" },
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
        if (data13.identity !== undefined) {
          if ("tilesim.bridge.agent_orchestration_topology_profile.v2" !== data13.identity) {
            const err26 = {
              instancePath: instancePath + "/topology/identity",
              schemaPath: "#/properties/topology/allOf/1/properties/identity/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.agent_orchestration_topology_profile.v2" },
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
      }
    }
    if (data.workload !== undefined) {
      let data16 = data.workload;
      if (
        !validate108(data16, {
          instancePath: instancePath + "/workload",
          parentData: data,
          parentDataProperty: "workload",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate108.errors : vErrors.concat(validate108.errors);
        errors = vErrors.length;
      }
      if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
        if (data16.family !== undefined) {
          if ("workload" !== data16.family) {
            const err27 = {
              instancePath: instancePath + "/workload/family",
              schemaPath: "#/properties/workload/allOf/1/properties/family/const",
              keyword: "const",
              params: { allowedValue: "workload" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err27];
            } else {
              vErrors.push(err27);
            }
            errors++;
          }
        }
        if (data16.identity !== undefined) {
          if ("tilesim.bridge.agent_orchestration_workload_profile.v2" !== data16.identity) {
            const err28 = {
              instancePath: instancePath + "/workload/identity",
              schemaPath: "#/properties/workload/allOf/1/properties/identity/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.agent_orchestration_workload_profile.v2" },
              message: "must be equal to constant",
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
    }
    if (data.fidelity !== undefined) {
      let data19 = data.fidelity;
      if (!(data19 === "Analytical" || data19 === "DES" || data19 === "Cycle")) {
        const err29 = {
          instancePath: instancePath + "/fidelity",
          schemaPath: "#/properties/fidelity/enum",
          keyword: "enum",
          params: { allowedValues: schema107.properties.fidelity.enum },
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
    if (data.gpu_participation_mode !== undefined) {
      let data20 = data.gpu_participation_mode;
      if (!(data20 === "gpu_free" || data20 === "gpu_assisted_trace" || data20 === "gpu_in_loop")) {
        const err30 = {
          instancePath: instancePath + "/gpu_participation_mode",
          schemaPath: "#/properties/gpu_participation_mode/enum",
          keyword: "enum",
          params: { allowedValues: schema107.properties.gpu_participation_mode.enum },
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
  validate107.errors = vErrors;
  return errors === 0;
}
validate107.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const runIntakeV2 = validate114;
const schema116 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-phase2/run-intake.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_run_intake.v2",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "schema_revision",
    "intake_id",
    "canonical_digest",
    "profile_binding",
    "device_count",
    "parallelism",
    "placement",
    "kv_cache",
    "collective_policy",
    "workload",
    "topology_network_binding",
    "requested_fidelity",
    "gpu_participation_mode",
    "trace_source",
    "slos",
    "budget",
  ],
  properties: {
    schema_identity: { const: "tilesim.bridge.agent_orchestration_run_intake.v2" },
    schema_revision: { $ref: "common.schema.json#/$defs/sha256" },
    intake_id: { $ref: "common.schema.json#/$defs/stableId" },
    canonical_digest: { $ref: "common.schema.json#/$defs/sha256" },
    profile_binding: { $ref: "profile-binding.schema.json" },
    device_count: { $ref: "common.schema.json#/$defs/positiveUint64" },
    parallelism: {
      type: "object",
      additionalProperties: false,
      required: ["tensor", "pipeline", "expert"],
      properties: {
        tensor: { $ref: "common.schema.json#/$defs/positiveUint64" },
        pipeline: { $ref: "common.schema.json#/$defs/positiveUint64" },
        expert: { $ref: "common.schema.json#/$defs/positiveUint64" },
      },
    },
    placement: {
      type: "object",
      additionalProperties: false,
      required: ["policy_identity", "policy_revision", "assignments"],
      properties: {
        policy_identity: { $ref: "common.schema.json#/$defs/stableId" },
        policy_revision: { $ref: "common.schema.json#/$defs/sha256" },
        assignments: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["rank", "device_id", "endpoint_id"],
            properties: {
              rank: { $ref: "common.schema.json#/$defs/uint64" },
              device_id: { $ref: "common.schema.json#/$defs/stableId" },
              endpoint_id: { $ref: "common.schema.json#/$defs/stableId" },
            },
          },
        },
      },
    },
    kv_cache: {
      type: "object",
      additionalProperties: false,
      required: ["policy_reference", "capacity_bytes"],
      properties: {
        policy_reference: { $ref: "common.schema.json#/$defs/stableReference" },
        capacity_bytes: { $ref: "common.schema.json#/$defs/uint64" },
      },
    },
    collective_policy: { $ref: "common.schema.json#/$defs/stableReference" },
    workload: {
      type: "object",
      additionalProperties: false,
      required: ["template_reference", "allowed_overrides"],
      properties: {
        template_reference: {
          allOf: [
            { $ref: "common.schema.json#/$defs/profileReference" },
            {
              properties: {
                family: { const: "workload" },
                identity: { const: "tilesim.bridge.agent_orchestration_workload_profile.v2" },
              },
            },
          ],
        },
        allowed_overrides: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["pointer", "value", "unit", "provenance_kind"],
            properties: {
              pointer: { type: "string", pattern: "^/" },
              value: { type: "string", minLength: 1 },
              unit: { type: ["string", "null"] },
              provenance_kind: { const: "user_supplied" },
            },
          },
        },
      },
    },
    topology_network_binding: {
      type: "object",
      additionalProperties: false,
      required: ["topology_reference", "network_policy_reference"],
      properties: {
        topology_reference: {
          allOf: [
            { $ref: "common.schema.json#/$defs/profileReference" },
            {
              properties: {
                family: { const: "topology" },
                identity: { const: "tilesim.bridge.agent_orchestration_topology_profile.v2" },
              },
            },
          ],
        },
        network_policy_reference: { $ref: "common.schema.json#/$defs/stableReference" },
      },
    },
    requested_fidelity: { enum: ["Analytical", "DES", "Cycle"] },
    gpu_participation_mode: { enum: ["gpu_free", "gpu_assisted_trace", "gpu_in_loop"] },
    trace_source: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "reference", "allowed_claim_scope"],
      properties: {
        mode: { enum: ["real_trace", "synthetic_trace", "compatibility_harness_trace"] },
        reference: { $ref: "common.schema.json#/$defs/stableReference" },
        allowed_claim_scope: { $ref: "common.schema.json#/$defs/claimScope" },
      },
    },
    slos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["metric_identity", "scope", "operator", "target", "unit", "window"],
        properties: {
          metric_identity: { $ref: "common.schema.json#/$defs/stableId" },
          scope: { enum: ["request", "run", "network"] },
          operator: { enum: ["lte", "gte"] },
          target: { $ref: "common.schema.json#/$defs/decimal" },
          unit: { type: "string", minLength: 1, maxLength: 64 },
          window: { type: "string", minLength: 1, maxLength: 160 },
        },
      },
    },
    budget: {
      type: "object",
      additionalProperties: false,
      required: ["candidate_count", "run_count", "simulation_time_ps", "wall_time_ps"],
      properties: {
        candidate_count: { $ref: "common.schema.json#/$defs/uint64" },
        run_count: { $ref: "common.schema.json#/$defs/uint64" },
        simulation_time_ps: { $ref: "common.schema.json#/$defs/uint64" },
        wall_time_ps: { $ref: "common.schema.json#/$defs/uint64" },
      },
    },
  },
  allOf: [
    {
      if: {
        properties: {
          trace_source: { properties: { mode: { enum: ["synthetic_trace", "compatibility_harness_trace"] } } },
        },
      },
      then: {
        properties: {
          trace_source: { properties: { allowed_claim_scope: { enum: ["exploration", "synthetic_consistency"] } } },
        },
      },
    },
  ],
};
const schema120 = { type: "string", pattern: "^[1-9][0-9]{0,19}$", "x-tilesim-maximum": "18446744073709551615" };
const pattern56 = new RegExp("^[1-9][0-9]{0,19}$", "u");
const pattern73 = new RegExp("^/", "u");
function validate116(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate116.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.identity === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "identity" },
        message: "must have required property '" + "identity" + "'",
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
    if (data.digest === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "digest" },
        message: "must have required property '" + "digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "identity" || key0 === "revision" || key0 === "digest")) {
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
    if (data.identity !== undefined) {
      let data0 = data.identity;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err4 = {
            instancePath: instancePath + "/identity",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/identity",
          schemaPath: "#/$defs/stableId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.revision !== undefined) {
      let data1 = data.revision;
      if (typeof data1 === "string") {
        if (!pattern5.test(data1)) {
          const err6 = {
            instancePath: instancePath + "/revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.digest !== undefined) {
      let data2 = data.digest;
      if (typeof data2 === "string") {
        if (!pattern5.test(data2)) {
          const err8 = {
            instancePath: instancePath + "/digest",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/digest",
          schemaPath: "#/$defs/sha256/type",
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
  validate116.errors = vErrors;
  return errors === 0;
}
validate116.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate119(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate119.evaluated;
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
    if (data.profile_id === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_id" },
        message: "must have required property '" + "profile_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.identity === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "identity" },
        message: "must have required property '" + "identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.revision === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "revision" },
        message: "must have required property '" + "revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.digest === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "digest" },
        message: "must have required property '" + "digest" + "'",
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
        key0 === "family" ||
        key0 === "profile_id" ||
        key0 === "identity" ||
        key0 === "revision" ||
        key0 === "digest"
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
    if (data.family !== undefined) {
      let data0 = data.family;
      if (!(
        data0 === "model" ||
        data0 === "engine" ||
        data0 === "device" ||
        data0 === "topology" ||
        data0 === "workload"
      )) {
        const err6 = {
          instancePath: instancePath + "/family",
          schemaPath: "#/properties/family/enum",
          keyword: "enum",
          params: { allowedValues: schema111.properties.family.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.profile_id !== undefined) {
      let data1 = data.profile_id;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err7 = {
            instancePath: instancePath + "/profile_id",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/profile_id",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.identity !== undefined) {
      let data2 = data.identity;
      if (typeof data2 === "string") {
        if (!pattern4.test(data2)) {
          const err9 = {
            instancePath: instancePath + "/identity",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/identity",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.revision !== undefined) {
      let data3 = data.revision;
      if (typeof data3 === "string") {
        if (!pattern5.test(data3)) {
          const err11 = {
            instancePath: instancePath + "/revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.digest !== undefined) {
      let data4 = data.digest;
      if (typeof data4 === "string") {
        if (!pattern5.test(data4)) {
          const err13 = {
            instancePath: instancePath + "/digest",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/digest",
          schemaPath: "#/$defs/sha256/type",
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
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err15];
    } else {
      vErrors.push(err15);
    }
    errors++;
  }
  validate119.errors = vErrors;
  return errors === 0;
}
validate119.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate114(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-phase2/run-intake.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate114.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs2 = errors;
  let valid1 = true;
  const _errs3 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.trace_source !== undefined) {
      let data0 = data.trace_source;
      if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
        if (data0.mode !== undefined) {
          let data1 = data0.mode;
          if (!(data1 === "synthetic_trace" || data1 === "compatibility_harness_trace")) {
            const err0 = {};
            if (vErrors === null) {
              vErrors = [err0];
            } else {
              vErrors.push(err0);
            }
            errors++;
          }
        }
      }
    }
  }
  var _valid0 = _errs3 === errors;
  errors = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs6 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.trace_source !== undefined) {
        let data2 = data.trace_source;
        if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
          if (data2.allowed_claim_scope !== undefined) {
            let data3 = data2.allowed_claim_scope;
            if (!(data3 === "exploration" || data3 === "synthetic_consistency")) {
              const err1 = {
                instancePath: instancePath + "/trace_source/allowed_claim_scope",
                schemaPath: "#/allOf/0/then/properties/trace_source/properties/allowed_claim_scope/enum",
                keyword: "enum",
                params: {
                  allowedValues: schema116.allOf[0].then.properties.trace_source.properties.allowed_claim_scope.enum,
                },
                message: "must be equal to one of the allowed values",
              };
              if (vErrors === null) {
                vErrors = [err1];
              } else {
                vErrors.push(err1);
              }
              errors++;
            }
          }
        }
      }
    }
    var _valid0 = _errs6 === errors;
    valid1 = _valid0;
    if (valid1) {
      var props0 = {};
      props0.trace_source = true;
    }
  }
  if (!valid1) {
    const err2 = {
      instancePath,
      schemaPath: "#/allOf/0/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
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
    if (data.schema_revision === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_revision" },
        message: "must have required property '" + "schema_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.intake_id === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "intake_id" },
        message: "must have required property '" + "intake_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.canonical_digest === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "canonical_digest" },
        message: "must have required property '" + "canonical_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.profile_binding === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_binding" },
        message: "must have required property '" + "profile_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.device_count === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "device_count" },
        message: "must have required property '" + "device_count" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.parallelism === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "parallelism" },
        message: "must have required property '" + "parallelism" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.placement === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "placement" },
        message: "must have required property '" + "placement" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.kv_cache === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kv_cache" },
        message: "must have required property '" + "kv_cache" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.collective_policy === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "collective_policy" },
        message: "must have required property '" + "collective_policy" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.workload === undefined) {
      const err13 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "workload" },
        message: "must have required property '" + "workload" + "'",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.topology_network_binding === undefined) {
      const err14 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "topology_network_binding" },
        message: "must have required property '" + "topology_network_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    if (data.requested_fidelity === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "requested_fidelity" },
        message: "must have required property '" + "requested_fidelity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.gpu_participation_mode === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "gpu_participation_mode" },
        message: "must have required property '" + "gpu_participation_mode" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    if (data.trace_source === undefined) {
      const err17 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "trace_source" },
        message: "must have required property '" + "trace_source" + "'",
      };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    if (data.slos === undefined) {
      const err18 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "slos" },
        message: "must have required property '" + "slos" + "'",
      };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    if (data.budget === undefined) {
      const err19 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "budget" },
        message: "must have required property '" + "budget" + "'",
      };
      if (vErrors === null) {
        vErrors = [err19];
      } else {
        vErrors.push(err19);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema116.properties, key0)) {
        const err20 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.schema_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_run_intake.v2" !== data.schema_identity) {
        const err21 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_run_intake.v2" },
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
    if (data.schema_revision !== undefined) {
      let data5 = data.schema_revision;
      if (typeof data5 === "string") {
        if (!pattern5.test(data5)) {
          const err22 = {
            instancePath: instancePath + "/schema_revision",
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
          instancePath: instancePath + "/schema_revision",
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
    if (data.intake_id !== undefined) {
      let data6 = data.intake_id;
      if (typeof data6 === "string") {
        if (!pattern4.test(data6)) {
          const err24 = {
            instancePath: instancePath + "/intake_id",
            schemaPath: "common.schema.json#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/intake_id",
          schemaPath: "common.schema.json#/$defs/stableId/type",
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
    if (data.canonical_digest !== undefined) {
      let data7 = data.canonical_digest;
      if (typeof data7 === "string") {
        if (!pattern5.test(data7)) {
          const err26 = {
            instancePath: instancePath + "/canonical_digest",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/canonical_digest",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.profile_binding !== undefined) {
      if (
        !validate107(data.profile_binding, {
          instancePath: instancePath + "/profile_binding",
          parentData: data,
          parentDataProperty: "profile_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate107.errors : vErrors.concat(validate107.errors);
        errors = vErrors.length;
      }
    }
    if (data.device_count !== undefined) {
      let data9 = data.device_count;
      if (typeof data9 === "string") {
        if (!pattern56.test(data9)) {
          const err28 = {
            instancePath: instancePath + "/device_count",
            schemaPath: "common.schema.json#/$defs/positiveUint64/pattern",
            keyword: "pattern",
            params: { pattern: "^[1-9][0-9]{0,19}$" },
            message: 'must match pattern "' + "^[1-9][0-9]{0,19}$" + '"',
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
          instancePath: instancePath + "/device_count",
          schemaPath: "common.schema.json#/$defs/positiveUint64/type",
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
    if (data.parallelism !== undefined) {
      let data10 = data.parallelism;
      if (data10 && typeof data10 == "object" && !Array.isArray(data10)) {
        if (data10.tensor === undefined) {
          const err30 = {
            instancePath: instancePath + "/parallelism",
            schemaPath: "#/properties/parallelism/required",
            keyword: "required",
            params: { missingProperty: "tensor" },
            message: "must have required property '" + "tensor" + "'",
          };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        if (data10.pipeline === undefined) {
          const err31 = {
            instancePath: instancePath + "/parallelism",
            schemaPath: "#/properties/parallelism/required",
            keyword: "required",
            params: { missingProperty: "pipeline" },
            message: "must have required property '" + "pipeline" + "'",
          };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        if (data10.expert === undefined) {
          const err32 = {
            instancePath: instancePath + "/parallelism",
            schemaPath: "#/properties/parallelism/required",
            keyword: "required",
            params: { missingProperty: "expert" },
            message: "must have required property '" + "expert" + "'",
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
        for (const key1 in data10) {
          if (!(key1 === "tensor" || key1 === "pipeline" || key1 === "expert")) {
            const err33 = {
              instancePath: instancePath + "/parallelism",
              schemaPath: "#/properties/parallelism/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
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
        if (data10.tensor !== undefined) {
          let data11 = data10.tensor;
          if (typeof data11 === "string") {
            if (!pattern56.test(data11)) {
              const err34 = {
                instancePath: instancePath + "/parallelism/tensor",
                schemaPath: "common.schema.json#/$defs/positiveUint64/pattern",
                keyword: "pattern",
                params: { pattern: "^[1-9][0-9]{0,19}$" },
                message: 'must match pattern "' + "^[1-9][0-9]{0,19}$" + '"',
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
              instancePath: instancePath + "/parallelism/tensor",
              schemaPath: "common.schema.json#/$defs/positiveUint64/type",
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
        if (data10.pipeline !== undefined) {
          let data12 = data10.pipeline;
          if (typeof data12 === "string") {
            if (!pattern56.test(data12)) {
              const err36 = {
                instancePath: instancePath + "/parallelism/pipeline",
                schemaPath: "common.schema.json#/$defs/positiveUint64/pattern",
                keyword: "pattern",
                params: { pattern: "^[1-9][0-9]{0,19}$" },
                message: 'must match pattern "' + "^[1-9][0-9]{0,19}$" + '"',
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
              instancePath: instancePath + "/parallelism/pipeline",
              schemaPath: "common.schema.json#/$defs/positiveUint64/type",
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
        if (data10.expert !== undefined) {
          let data13 = data10.expert;
          if (typeof data13 === "string") {
            if (!pattern56.test(data13)) {
              const err38 = {
                instancePath: instancePath + "/parallelism/expert",
                schemaPath: "common.schema.json#/$defs/positiveUint64/pattern",
                keyword: "pattern",
                params: { pattern: "^[1-9][0-9]{0,19}$" },
                message: 'must match pattern "' + "^[1-9][0-9]{0,19}$" + '"',
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
              instancePath: instancePath + "/parallelism/expert",
              schemaPath: "common.schema.json#/$defs/positiveUint64/type",
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
      } else {
        const err40 = {
          instancePath: instancePath + "/parallelism",
          schemaPath: "#/properties/parallelism/type",
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
    if (data.placement !== undefined) {
      let data14 = data.placement;
      if (data14 && typeof data14 == "object" && !Array.isArray(data14)) {
        if (data14.policy_identity === undefined) {
          const err41 = {
            instancePath: instancePath + "/placement",
            schemaPath: "#/properties/placement/required",
            keyword: "required",
            params: { missingProperty: "policy_identity" },
            message: "must have required property '" + "policy_identity" + "'",
          };
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
        if (data14.policy_revision === undefined) {
          const err42 = {
            instancePath: instancePath + "/placement",
            schemaPath: "#/properties/placement/required",
            keyword: "required",
            params: { missingProperty: "policy_revision" },
            message: "must have required property '" + "policy_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err42];
          } else {
            vErrors.push(err42);
          }
          errors++;
        }
        if (data14.assignments === undefined) {
          const err43 = {
            instancePath: instancePath + "/placement",
            schemaPath: "#/properties/placement/required",
            keyword: "required",
            params: { missingProperty: "assignments" },
            message: "must have required property '" + "assignments" + "'",
          };
          if (vErrors === null) {
            vErrors = [err43];
          } else {
            vErrors.push(err43);
          }
          errors++;
        }
        for (const key2 in data14) {
          if (!(key2 === "policy_identity" || key2 === "policy_revision" || key2 === "assignments")) {
            const err44 = {
              instancePath: instancePath + "/placement",
              schemaPath: "#/properties/placement/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err44];
            } else {
              vErrors.push(err44);
            }
            errors++;
          }
        }
        if (data14.policy_identity !== undefined) {
          let data15 = data14.policy_identity;
          if (typeof data15 === "string") {
            if (!pattern4.test(data15)) {
              const err45 = {
                instancePath: instancePath + "/placement/policy_identity",
                schemaPath: "common.schema.json#/$defs/stableId/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
              instancePath: instancePath + "/placement/policy_identity",
              schemaPath: "common.schema.json#/$defs/stableId/type",
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
        if (data14.policy_revision !== undefined) {
          let data16 = data14.policy_revision;
          if (typeof data16 === "string") {
            if (!pattern5.test(data16)) {
              const err47 = {
                instancePath: instancePath + "/placement/policy_revision",
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
              instancePath: instancePath + "/placement/policy_revision",
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
        if (data14.assignments !== undefined) {
          let data17 = data14.assignments;
          if (Array.isArray(data17)) {
            if (data17.length < 1) {
              const err49 = {
                instancePath: instancePath + "/placement/assignments",
                schemaPath: "#/properties/placement/properties/assignments/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              if (vErrors === null) {
                vErrors = [err49];
              } else {
                vErrors.push(err49);
              }
              errors++;
            }
            const len0 = data17.length;
            for (let i0 = 0; i0 < len0; i0++) {
              let data18 = data17[i0];
              if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
                if (data18.rank === undefined) {
                  const err50 = {
                    instancePath: instancePath + "/placement/assignments/" + i0,
                    schemaPath: "#/properties/placement/properties/assignments/items/required",
                    keyword: "required",
                    params: { missingProperty: "rank" },
                    message: "must have required property '" + "rank" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err50];
                  } else {
                    vErrors.push(err50);
                  }
                  errors++;
                }
                if (data18.device_id === undefined) {
                  const err51 = {
                    instancePath: instancePath + "/placement/assignments/" + i0,
                    schemaPath: "#/properties/placement/properties/assignments/items/required",
                    keyword: "required",
                    params: { missingProperty: "device_id" },
                    message: "must have required property '" + "device_id" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err51];
                  } else {
                    vErrors.push(err51);
                  }
                  errors++;
                }
                if (data18.endpoint_id === undefined) {
                  const err52 = {
                    instancePath: instancePath + "/placement/assignments/" + i0,
                    schemaPath: "#/properties/placement/properties/assignments/items/required",
                    keyword: "required",
                    params: { missingProperty: "endpoint_id" },
                    message: "must have required property '" + "endpoint_id" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err52];
                  } else {
                    vErrors.push(err52);
                  }
                  errors++;
                }
                for (const key3 in data18) {
                  if (!(key3 === "rank" || key3 === "device_id" || key3 === "endpoint_id")) {
                    const err53 = {
                      instancePath: instancePath + "/placement/assignments/" + i0,
                      schemaPath: "#/properties/placement/properties/assignments/items/additionalProperties",
                      keyword: "additionalProperties",
                      params: { additionalProperty: key3 },
                      message: "must NOT have additional properties",
                    };
                    if (vErrors === null) {
                      vErrors = [err53];
                    } else {
                      vErrors.push(err53);
                    }
                    errors++;
                  }
                }
                if (data18.rank !== undefined) {
                  let data19 = data18.rank;
                  if (typeof data19 === "string") {
                    if (!pattern16.test(data19)) {
                      const err54 = {
                        instancePath: instancePath + "/placement/assignments/" + i0 + "/rank",
                        schemaPath: "common.schema.json#/$defs/uint64/pattern",
                        keyword: "pattern",
                        params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
                        message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
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
                      instancePath: instancePath + "/placement/assignments/" + i0 + "/rank",
                      schemaPath: "common.schema.json#/$defs/uint64/type",
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
                if (data18.device_id !== undefined) {
                  let data20 = data18.device_id;
                  if (typeof data20 === "string") {
                    if (!pattern4.test(data20)) {
                      const err56 = {
                        instancePath: instancePath + "/placement/assignments/" + i0 + "/device_id",
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
                      instancePath: instancePath + "/placement/assignments/" + i0 + "/device_id",
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
                if (data18.endpoint_id !== undefined) {
                  let data21 = data18.endpoint_id;
                  if (typeof data21 === "string") {
                    if (!pattern4.test(data21)) {
                      const err58 = {
                        instancePath: instancePath + "/placement/assignments/" + i0 + "/endpoint_id",
                        schemaPath: "common.schema.json#/$defs/stableId/pattern",
                        keyword: "pattern",
                        params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                        message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
                      };
                      if (vErrors === null) {
                        vErrors = [err58];
                      } else {
                        vErrors.push(err58);
                      }
                      errors++;
                    }
                  } else {
                    const err59 = {
                      instancePath: instancePath + "/placement/assignments/" + i0 + "/endpoint_id",
                      schemaPath: "common.schema.json#/$defs/stableId/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
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
                  instancePath: instancePath + "/placement/assignments/" + i0,
                  schemaPath: "#/properties/placement/properties/assignments/items/type",
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
              instancePath: instancePath + "/placement/assignments",
              schemaPath: "#/properties/placement/properties/assignments/type",
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
      } else {
        const err62 = {
          instancePath: instancePath + "/placement",
          schemaPath: "#/properties/placement/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err62];
        } else {
          vErrors.push(err62);
        }
        errors++;
      }
    }
    if (data.kv_cache !== undefined) {
      let data22 = data.kv_cache;
      if (data22 && typeof data22 == "object" && !Array.isArray(data22)) {
        if (data22.policy_reference === undefined) {
          const err63 = {
            instancePath: instancePath + "/kv_cache",
            schemaPath: "#/properties/kv_cache/required",
            keyword: "required",
            params: { missingProperty: "policy_reference" },
            message: "must have required property '" + "policy_reference" + "'",
          };
          if (vErrors === null) {
            vErrors = [err63];
          } else {
            vErrors.push(err63);
          }
          errors++;
        }
        if (data22.capacity_bytes === undefined) {
          const err64 = {
            instancePath: instancePath + "/kv_cache",
            schemaPath: "#/properties/kv_cache/required",
            keyword: "required",
            params: { missingProperty: "capacity_bytes" },
            message: "must have required property '" + "capacity_bytes" + "'",
          };
          if (vErrors === null) {
            vErrors = [err64];
          } else {
            vErrors.push(err64);
          }
          errors++;
        }
        for (const key4 in data22) {
          if (!(key4 === "policy_reference" || key4 === "capacity_bytes")) {
            const err65 = {
              instancePath: instancePath + "/kv_cache",
              schemaPath: "#/properties/kv_cache/additionalProperties",
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
        if (data22.policy_reference !== undefined) {
          if (
            !validate116(data22.policy_reference, {
              instancePath: instancePath + "/kv_cache/policy_reference",
              parentData: data22,
              parentDataProperty: "policy_reference",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate116.errors : vErrors.concat(validate116.errors);
            errors = vErrors.length;
          }
        }
        if (data22.capacity_bytes !== undefined) {
          let data24 = data22.capacity_bytes;
          if (typeof data24 === "string") {
            if (!pattern16.test(data24)) {
              const err66 = {
                instancePath: instancePath + "/kv_cache/capacity_bytes",
                schemaPath: "common.schema.json#/$defs/uint64/pattern",
                keyword: "pattern",
                params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
                message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err66];
              } else {
                vErrors.push(err66);
              }
              errors++;
            }
          } else {
            const err67 = {
              instancePath: instancePath + "/kv_cache/capacity_bytes",
              schemaPath: "common.schema.json#/$defs/uint64/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
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
          instancePath: instancePath + "/kv_cache",
          schemaPath: "#/properties/kv_cache/type",
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
    if (data.collective_policy !== undefined) {
      if (
        !validate116(data.collective_policy, {
          instancePath: instancePath + "/collective_policy",
          parentData: data,
          parentDataProperty: "collective_policy",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate116.errors : vErrors.concat(validate116.errors);
        errors = vErrors.length;
      }
    }
    if (data.workload !== undefined) {
      let data26 = data.workload;
      if (data26 && typeof data26 == "object" && !Array.isArray(data26)) {
        if (data26.template_reference === undefined) {
          const err69 = {
            instancePath: instancePath + "/workload",
            schemaPath: "#/properties/workload/required",
            keyword: "required",
            params: { missingProperty: "template_reference" },
            message: "must have required property '" + "template_reference" + "'",
          };
          if (vErrors === null) {
            vErrors = [err69];
          } else {
            vErrors.push(err69);
          }
          errors++;
        }
        if (data26.allowed_overrides === undefined) {
          const err70 = {
            instancePath: instancePath + "/workload",
            schemaPath: "#/properties/workload/required",
            keyword: "required",
            params: { missingProperty: "allowed_overrides" },
            message: "must have required property '" + "allowed_overrides" + "'",
          };
          if (vErrors === null) {
            vErrors = [err70];
          } else {
            vErrors.push(err70);
          }
          errors++;
        }
        for (const key5 in data26) {
          if (!(key5 === "template_reference" || key5 === "allowed_overrides")) {
            const err71 = {
              instancePath: instancePath + "/workload",
              schemaPath: "#/properties/workload/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key5 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err71];
            } else {
              vErrors.push(err71);
            }
            errors++;
          }
        }
        if (data26.template_reference !== undefined) {
          let data27 = data26.template_reference;
          if (
            !validate119(data27, {
              instancePath: instancePath + "/workload/template_reference",
              parentData: data26,
              parentDataProperty: "template_reference",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate119.errors : vErrors.concat(validate119.errors);
            errors = vErrors.length;
          }
          if (data27 && typeof data27 == "object" && !Array.isArray(data27)) {
            if (data27.family !== undefined) {
              if ("workload" !== data27.family) {
                const err72 = {
                  instancePath: instancePath + "/workload/template_reference/family",
                  schemaPath: "#/properties/workload/properties/template_reference/allOf/1/properties/family/const",
                  keyword: "const",
                  params: { allowedValue: "workload" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err72];
                } else {
                  vErrors.push(err72);
                }
                errors++;
              }
            }
            if (data27.identity !== undefined) {
              if ("tilesim.bridge.agent_orchestration_workload_profile.v2" !== data27.identity) {
                const err73 = {
                  instancePath: instancePath + "/workload/template_reference/identity",
                  schemaPath: "#/properties/workload/properties/template_reference/allOf/1/properties/identity/const",
                  keyword: "const",
                  params: { allowedValue: "tilesim.bridge.agent_orchestration_workload_profile.v2" },
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
          }
        }
        if (data26.allowed_overrides !== undefined) {
          let data30 = data26.allowed_overrides;
          if (Array.isArray(data30)) {
            const len1 = data30.length;
            for (let i1 = 0; i1 < len1; i1++) {
              let data31 = data30[i1];
              if (data31 && typeof data31 == "object" && !Array.isArray(data31)) {
                if (data31.pointer === undefined) {
                  const err74 = {
                    instancePath: instancePath + "/workload/allowed_overrides/" + i1,
                    schemaPath: "#/properties/workload/properties/allowed_overrides/items/required",
                    keyword: "required",
                    params: { missingProperty: "pointer" },
                    message: "must have required property '" + "pointer" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err74];
                  } else {
                    vErrors.push(err74);
                  }
                  errors++;
                }
                if (data31.value === undefined) {
                  const err75 = {
                    instancePath: instancePath + "/workload/allowed_overrides/" + i1,
                    schemaPath: "#/properties/workload/properties/allowed_overrides/items/required",
                    keyword: "required",
                    params: { missingProperty: "value" },
                    message: "must have required property '" + "value" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err75];
                  } else {
                    vErrors.push(err75);
                  }
                  errors++;
                }
                if (data31.unit === undefined) {
                  const err76 = {
                    instancePath: instancePath + "/workload/allowed_overrides/" + i1,
                    schemaPath: "#/properties/workload/properties/allowed_overrides/items/required",
                    keyword: "required",
                    params: { missingProperty: "unit" },
                    message: "must have required property '" + "unit" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err76];
                  } else {
                    vErrors.push(err76);
                  }
                  errors++;
                }
                if (data31.provenance_kind === undefined) {
                  const err77 = {
                    instancePath: instancePath + "/workload/allowed_overrides/" + i1,
                    schemaPath: "#/properties/workload/properties/allowed_overrides/items/required",
                    keyword: "required",
                    params: { missingProperty: "provenance_kind" },
                    message: "must have required property '" + "provenance_kind" + "'",
                  };
                  if (vErrors === null) {
                    vErrors = [err77];
                  } else {
                    vErrors.push(err77);
                  }
                  errors++;
                }
                for (const key6 in data31) {
                  if (!(key6 === "pointer" || key6 === "value" || key6 === "unit" || key6 === "provenance_kind")) {
                    const err78 = {
                      instancePath: instancePath + "/workload/allowed_overrides/" + i1,
                      schemaPath: "#/properties/workload/properties/allowed_overrides/items/additionalProperties",
                      keyword: "additionalProperties",
                      params: { additionalProperty: key6 },
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
                if (data31.pointer !== undefined) {
                  let data32 = data31.pointer;
                  if (typeof data32 === "string") {
                    if (!pattern73.test(data32)) {
                      const err79 = {
                        instancePath: instancePath + "/workload/allowed_overrides/" + i1 + "/pointer",
                        schemaPath:
                          "#/properties/workload/properties/allowed_overrides/items/properties/pointer/pattern",
                        keyword: "pattern",
                        params: { pattern: "^/" },
                        message: 'must match pattern "' + "^/" + '"',
                      };
                      if (vErrors === null) {
                        vErrors = [err79];
                      } else {
                        vErrors.push(err79);
                      }
                      errors++;
                    }
                  } else {
                    const err80 = {
                      instancePath: instancePath + "/workload/allowed_overrides/" + i1 + "/pointer",
                      schemaPath: "#/properties/workload/properties/allowed_overrides/items/properties/pointer/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err80];
                    } else {
                      vErrors.push(err80);
                    }
                    errors++;
                  }
                }
                if (data31.value !== undefined) {
                  let data33 = data31.value;
                  if (typeof data33 === "string") {
                    if (func2(data33) < 1) {
                      const err81 = {
                        instancePath: instancePath + "/workload/allowed_overrides/" + i1 + "/value",
                        schemaPath:
                          "#/properties/workload/properties/allowed_overrides/items/properties/value/minLength",
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
                      instancePath: instancePath + "/workload/allowed_overrides/" + i1 + "/value",
                      schemaPath: "#/properties/workload/properties/allowed_overrides/items/properties/value/type",
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
                if (data31.unit !== undefined) {
                  let data34 = data31.unit;
                  if (typeof data34 !== "string" && data34 !== null) {
                    const err83 = {
                      instancePath: instancePath + "/workload/allowed_overrides/" + i1 + "/unit",
                      schemaPath: "#/properties/workload/properties/allowed_overrides/items/properties/unit/type",
                      keyword: "type",
                      params: {
                        type: schema116.properties.workload.properties.allowed_overrides.items.properties.unit.type,
                      },
                      message: "must be string,null",
                    };
                    if (vErrors === null) {
                      vErrors = [err83];
                    } else {
                      vErrors.push(err83);
                    }
                    errors++;
                  }
                }
                if (data31.provenance_kind !== undefined) {
                  if ("user_supplied" !== data31.provenance_kind) {
                    const err84 = {
                      instancePath: instancePath + "/workload/allowed_overrides/" + i1 + "/provenance_kind",
                      schemaPath:
                        "#/properties/workload/properties/allowed_overrides/items/properties/provenance_kind/const",
                      keyword: "const",
                      params: { allowedValue: "user_supplied" },
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
                  instancePath: instancePath + "/workload/allowed_overrides/" + i1,
                  schemaPath: "#/properties/workload/properties/allowed_overrides/items/type",
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
              instancePath: instancePath + "/workload/allowed_overrides",
              schemaPath: "#/properties/workload/properties/allowed_overrides/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
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
          instancePath: instancePath + "/workload",
          schemaPath: "#/properties/workload/type",
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
    if (data.topology_network_binding !== undefined) {
      let data36 = data.topology_network_binding;
      if (data36 && typeof data36 == "object" && !Array.isArray(data36)) {
        if (data36.topology_reference === undefined) {
          const err88 = {
            instancePath: instancePath + "/topology_network_binding",
            schemaPath: "#/properties/topology_network_binding/required",
            keyword: "required",
            params: { missingProperty: "topology_reference" },
            message: "must have required property '" + "topology_reference" + "'",
          };
          if (vErrors === null) {
            vErrors = [err88];
          } else {
            vErrors.push(err88);
          }
          errors++;
        }
        if (data36.network_policy_reference === undefined) {
          const err89 = {
            instancePath: instancePath + "/topology_network_binding",
            schemaPath: "#/properties/topology_network_binding/required",
            keyword: "required",
            params: { missingProperty: "network_policy_reference" },
            message: "must have required property '" + "network_policy_reference" + "'",
          };
          if (vErrors === null) {
            vErrors = [err89];
          } else {
            vErrors.push(err89);
          }
          errors++;
        }
        for (const key7 in data36) {
          if (!(key7 === "topology_reference" || key7 === "network_policy_reference")) {
            const err90 = {
              instancePath: instancePath + "/topology_network_binding",
              schemaPath: "#/properties/topology_network_binding/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key7 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err90];
            } else {
              vErrors.push(err90);
            }
            errors++;
          }
        }
        if (data36.topology_reference !== undefined) {
          let data37 = data36.topology_reference;
          if (
            !validate119(data37, {
              instancePath: instancePath + "/topology_network_binding/topology_reference",
              parentData: data36,
              parentDataProperty: "topology_reference",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate119.errors : vErrors.concat(validate119.errors);
            errors = vErrors.length;
          }
          if (data37 && typeof data37 == "object" && !Array.isArray(data37)) {
            if (data37.family !== undefined) {
              if ("topology" !== data37.family) {
                const err91 = {
                  instancePath: instancePath + "/topology_network_binding/topology_reference/family",
                  schemaPath:
                    "#/properties/topology_network_binding/properties/topology_reference/allOf/1/properties/family/const",
                  keyword: "const",
                  params: { allowedValue: "topology" },
                  message: "must be equal to constant",
                };
                if (vErrors === null) {
                  vErrors = [err91];
                } else {
                  vErrors.push(err91);
                }
                errors++;
              }
            }
            if (data37.identity !== undefined) {
              if ("tilesim.bridge.agent_orchestration_topology_profile.v2" !== data37.identity) {
                const err92 = {
                  instancePath: instancePath + "/topology_network_binding/topology_reference/identity",
                  schemaPath:
                    "#/properties/topology_network_binding/properties/topology_reference/allOf/1/properties/identity/const",
                  keyword: "const",
                  params: { allowedValue: "tilesim.bridge.agent_orchestration_topology_profile.v2" },
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
          }
        }
        if (data36.network_policy_reference !== undefined) {
          if (
            !validate116(data36.network_policy_reference, {
              instancePath: instancePath + "/topology_network_binding/network_policy_reference",
              parentData: data36,
              parentDataProperty: "network_policy_reference",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate116.errors : vErrors.concat(validate116.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err93 = {
          instancePath: instancePath + "/topology_network_binding",
          schemaPath: "#/properties/topology_network_binding/type",
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
    if (data.requested_fidelity !== undefined) {
      let data41 = data.requested_fidelity;
      if (!(data41 === "Analytical" || data41 === "DES" || data41 === "Cycle")) {
        const err94 = {
          instancePath: instancePath + "/requested_fidelity",
          schemaPath: "#/properties/requested_fidelity/enum",
          keyword: "enum",
          params: { allowedValues: schema116.properties.requested_fidelity.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err94];
        } else {
          vErrors.push(err94);
        }
        errors++;
      }
    }
    if (data.gpu_participation_mode !== undefined) {
      let data42 = data.gpu_participation_mode;
      if (!(data42 === "gpu_free" || data42 === "gpu_assisted_trace" || data42 === "gpu_in_loop")) {
        const err95 = {
          instancePath: instancePath + "/gpu_participation_mode",
          schemaPath: "#/properties/gpu_participation_mode/enum",
          keyword: "enum",
          params: { allowedValues: schema116.properties.gpu_participation_mode.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err95];
        } else {
          vErrors.push(err95);
        }
        errors++;
      }
    }
    if (data.trace_source !== undefined) {
      let data43 = data.trace_source;
      if (data43 && typeof data43 == "object" && !Array.isArray(data43)) {
        if (data43.mode === undefined) {
          const err96 = {
            instancePath: instancePath + "/trace_source",
            schemaPath: "#/properties/trace_source/required",
            keyword: "required",
            params: { missingProperty: "mode" },
            message: "must have required property '" + "mode" + "'",
          };
          if (vErrors === null) {
            vErrors = [err96];
          } else {
            vErrors.push(err96);
          }
          errors++;
        }
        if (data43.reference === undefined) {
          const err97 = {
            instancePath: instancePath + "/trace_source",
            schemaPath: "#/properties/trace_source/required",
            keyword: "required",
            params: { missingProperty: "reference" },
            message: "must have required property '" + "reference" + "'",
          };
          if (vErrors === null) {
            vErrors = [err97];
          } else {
            vErrors.push(err97);
          }
          errors++;
        }
        if (data43.allowed_claim_scope === undefined) {
          const err98 = {
            instancePath: instancePath + "/trace_source",
            schemaPath: "#/properties/trace_source/required",
            keyword: "required",
            params: { missingProperty: "allowed_claim_scope" },
            message: "must have required property '" + "allowed_claim_scope" + "'",
          };
          if (vErrors === null) {
            vErrors = [err98];
          } else {
            vErrors.push(err98);
          }
          errors++;
        }
        for (const key8 in data43) {
          if (!(key8 === "mode" || key8 === "reference" || key8 === "allowed_claim_scope")) {
            const err99 = {
              instancePath: instancePath + "/trace_source",
              schemaPath: "#/properties/trace_source/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key8 },
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
        if (data43.mode !== undefined) {
          let data44 = data43.mode;
          if (!(data44 === "real_trace" || data44 === "synthetic_trace" || data44 === "compatibility_harness_trace")) {
            const err100 = {
              instancePath: instancePath + "/trace_source/mode",
              schemaPath: "#/properties/trace_source/properties/mode/enum",
              keyword: "enum",
              params: { allowedValues: schema116.properties.trace_source.properties.mode.enum },
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
        if (data43.reference !== undefined) {
          if (
            !validate116(data43.reference, {
              instancePath: instancePath + "/trace_source/reference",
              parentData: data43,
              parentDataProperty: "reference",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate116.errors : vErrors.concat(validate116.errors);
            errors = vErrors.length;
          }
        }
        if (data43.allowed_claim_scope !== undefined) {
          let data46 = data43.allowed_claim_scope;
          if (!(
            data46 === "exploration" ||
            data46 === "synthetic_consistency" ||
            data46 === "limited_extrapolation" ||
            data46 === "similar_regime_conditional_prediction" ||
            data46 === "real_calibrated_validation"
          )) {
            const err101 = {
              instancePath: instancePath + "/trace_source/allowed_claim_scope",
              schemaPath: "common.schema.json#/$defs/claimScope/enum",
              keyword: "enum",
              params: { allowedValues: schema45.enum },
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
      } else {
        const err102 = {
          instancePath: instancePath + "/trace_source",
          schemaPath: "#/properties/trace_source/type",
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
    if (data.slos !== undefined) {
      let data47 = data.slos;
      if (Array.isArray(data47)) {
        const len2 = data47.length;
        for (let i2 = 0; i2 < len2; i2++) {
          let data48 = data47[i2];
          if (data48 && typeof data48 == "object" && !Array.isArray(data48)) {
            if (data48.metric_identity === undefined) {
              const err103 = {
                instancePath: instancePath + "/slos/" + i2,
                schemaPath: "#/properties/slos/items/required",
                keyword: "required",
                params: { missingProperty: "metric_identity" },
                message: "must have required property '" + "metric_identity" + "'",
              };
              if (vErrors === null) {
                vErrors = [err103];
              } else {
                vErrors.push(err103);
              }
              errors++;
            }
            if (data48.scope === undefined) {
              const err104 = {
                instancePath: instancePath + "/slos/" + i2,
                schemaPath: "#/properties/slos/items/required",
                keyword: "required",
                params: { missingProperty: "scope" },
                message: "must have required property '" + "scope" + "'",
              };
              if (vErrors === null) {
                vErrors = [err104];
              } else {
                vErrors.push(err104);
              }
              errors++;
            }
            if (data48.operator === undefined) {
              const err105 = {
                instancePath: instancePath + "/slos/" + i2,
                schemaPath: "#/properties/slos/items/required",
                keyword: "required",
                params: { missingProperty: "operator" },
                message: "must have required property '" + "operator" + "'",
              };
              if (vErrors === null) {
                vErrors = [err105];
              } else {
                vErrors.push(err105);
              }
              errors++;
            }
            if (data48.target === undefined) {
              const err106 = {
                instancePath: instancePath + "/slos/" + i2,
                schemaPath: "#/properties/slos/items/required",
                keyword: "required",
                params: { missingProperty: "target" },
                message: "must have required property '" + "target" + "'",
              };
              if (vErrors === null) {
                vErrors = [err106];
              } else {
                vErrors.push(err106);
              }
              errors++;
            }
            if (data48.unit === undefined) {
              const err107 = {
                instancePath: instancePath + "/slos/" + i2,
                schemaPath: "#/properties/slos/items/required",
                keyword: "required",
                params: { missingProperty: "unit" },
                message: "must have required property '" + "unit" + "'",
              };
              if (vErrors === null) {
                vErrors = [err107];
              } else {
                vErrors.push(err107);
              }
              errors++;
            }
            if (data48.window === undefined) {
              const err108 = {
                instancePath: instancePath + "/slos/" + i2,
                schemaPath: "#/properties/slos/items/required",
                keyword: "required",
                params: { missingProperty: "window" },
                message: "must have required property '" + "window" + "'",
              };
              if (vErrors === null) {
                vErrors = [err108];
              } else {
                vErrors.push(err108);
              }
              errors++;
            }
            for (const key9 in data48) {
              if (!(
                key9 === "metric_identity" ||
                key9 === "scope" ||
                key9 === "operator" ||
                key9 === "target" ||
                key9 === "unit" ||
                key9 === "window"
              )) {
                const err109 = {
                  instancePath: instancePath + "/slos/" + i2,
                  schemaPath: "#/properties/slos/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key9 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err109];
                } else {
                  vErrors.push(err109);
                }
                errors++;
              }
            }
            if (data48.metric_identity !== undefined) {
              let data49 = data48.metric_identity;
              if (typeof data49 === "string") {
                if (!pattern4.test(data49)) {
                  const err110 = {
                    instancePath: instancePath + "/slos/" + i2 + "/metric_identity",
                    schemaPath: "common.schema.json#/$defs/stableId/pattern",
                    keyword: "pattern",
                    params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                    message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
                  };
                  if (vErrors === null) {
                    vErrors = [err110];
                  } else {
                    vErrors.push(err110);
                  }
                  errors++;
                }
              } else {
                const err111 = {
                  instancePath: instancePath + "/slos/" + i2 + "/metric_identity",
                  schemaPath: "common.schema.json#/$defs/stableId/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err111];
                } else {
                  vErrors.push(err111);
                }
                errors++;
              }
            }
            if (data48.scope !== undefined) {
              let data50 = data48.scope;
              if (!(data50 === "request" || data50 === "run" || data50 === "network")) {
                const err112 = {
                  instancePath: instancePath + "/slos/" + i2 + "/scope",
                  schemaPath: "#/properties/slos/items/properties/scope/enum",
                  keyword: "enum",
                  params: { allowedValues: schema116.properties.slos.items.properties.scope.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err112];
                } else {
                  vErrors.push(err112);
                }
                errors++;
              }
            }
            if (data48.operator !== undefined) {
              let data51 = data48.operator;
              if (!(data51 === "lte" || data51 === "gte")) {
                const err113 = {
                  instancePath: instancePath + "/slos/" + i2 + "/operator",
                  schemaPath: "#/properties/slos/items/properties/operator/enum",
                  keyword: "enum",
                  params: { allowedValues: schema116.properties.slos.items.properties.operator.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err113];
                } else {
                  vErrors.push(err113);
                }
                errors++;
              }
            }
            if (data48.target !== undefined) {
              let data52 = data48.target;
              const _errs118 = errors;
              const _errs119 = errors;
              if (typeof data52 === "string") {
                if (!pattern14.test(data52)) {
                  const err114 = {};
                  if (vErrors === null) {
                    vErrors = [err114];
                  } else {
                    vErrors.push(err114);
                  }
                  errors++;
                }
              }
              var valid42 = _errs119 === errors;
              if (valid42) {
                const err115 = {
                  instancePath: instancePath + "/slos/" + i2 + "/target",
                  schemaPath: "common.schema.json#/$defs/decimal/not",
                  keyword: "not",
                  params: {},
                  message: "must NOT be valid",
                };
                if (vErrors === null) {
                  vErrors = [err115];
                } else {
                  vErrors.push(err115);
                }
                errors++;
              } else {
                errors = _errs118;
                if (vErrors !== null) {
                  if (_errs118) {
                    vErrors.length = _errs118;
                  } else {
                    vErrors = null;
                  }
                }
              }
              if (typeof data52 === "string") {
                if (!pattern15.test(data52)) {
                  const err116 = {
                    instancePath: instancePath + "/slos/" + i2 + "/target",
                    schemaPath: "common.schema.json#/$defs/decimal/pattern",
                    keyword: "pattern",
                    params: { pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" },
                    message: 'must match pattern "' + "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" + '"',
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
                  instancePath: instancePath + "/slos/" + i2 + "/target",
                  schemaPath: "common.schema.json#/$defs/decimal/type",
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
            if (data48.unit !== undefined) {
              let data53 = data48.unit;
              if (typeof data53 === "string") {
                if (func2(data53) > 64) {
                  const err118 = {
                    instancePath: instancePath + "/slos/" + i2 + "/unit",
                    schemaPath: "#/properties/slos/items/properties/unit/maxLength",
                    keyword: "maxLength",
                    params: { limit: 64 },
                    message: "must NOT have more than 64 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err118];
                  } else {
                    vErrors.push(err118);
                  }
                  errors++;
                }
                if (func2(data53) < 1) {
                  const err119 = {
                    instancePath: instancePath + "/slos/" + i2 + "/unit",
                    schemaPath: "#/properties/slos/items/properties/unit/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err119];
                  } else {
                    vErrors.push(err119);
                  }
                  errors++;
                }
              } else {
                const err120 = {
                  instancePath: instancePath + "/slos/" + i2 + "/unit",
                  schemaPath: "#/properties/slos/items/properties/unit/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err120];
                } else {
                  vErrors.push(err120);
                }
                errors++;
              }
            }
            if (data48.window !== undefined) {
              let data54 = data48.window;
              if (typeof data54 === "string") {
                if (func2(data54) > 160) {
                  const err121 = {
                    instancePath: instancePath + "/slos/" + i2 + "/window",
                    schemaPath: "#/properties/slos/items/properties/window/maxLength",
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
                if (func2(data54) < 1) {
                  const err122 = {
                    instancePath: instancePath + "/slos/" + i2 + "/window",
                    schemaPath: "#/properties/slos/items/properties/window/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err122];
                  } else {
                    vErrors.push(err122);
                  }
                  errors++;
                }
              } else {
                const err123 = {
                  instancePath: instancePath + "/slos/" + i2 + "/window",
                  schemaPath: "#/properties/slos/items/properties/window/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err123];
                } else {
                  vErrors.push(err123);
                }
                errors++;
              }
            }
          } else {
            const err124 = {
              instancePath: instancePath + "/slos/" + i2,
              schemaPath: "#/properties/slos/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err124];
            } else {
              vErrors.push(err124);
            }
            errors++;
          }
        }
      } else {
        const err125 = {
          instancePath: instancePath + "/slos",
          schemaPath: "#/properties/slos/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err125];
        } else {
          vErrors.push(err125);
        }
        errors++;
      }
    }
    if (data.budget !== undefined) {
      let data55 = data.budget;
      if (data55 && typeof data55 == "object" && !Array.isArray(data55)) {
        if (data55.candidate_count === undefined) {
          const err126 = {
            instancePath: instancePath + "/budget",
            schemaPath: "#/properties/budget/required",
            keyword: "required",
            params: { missingProperty: "candidate_count" },
            message: "must have required property '" + "candidate_count" + "'",
          };
          if (vErrors === null) {
            vErrors = [err126];
          } else {
            vErrors.push(err126);
          }
          errors++;
        }
        if (data55.run_count === undefined) {
          const err127 = {
            instancePath: instancePath + "/budget",
            schemaPath: "#/properties/budget/required",
            keyword: "required",
            params: { missingProperty: "run_count" },
            message: "must have required property '" + "run_count" + "'",
          };
          if (vErrors === null) {
            vErrors = [err127];
          } else {
            vErrors.push(err127);
          }
          errors++;
        }
        if (data55.simulation_time_ps === undefined) {
          const err128 = {
            instancePath: instancePath + "/budget",
            schemaPath: "#/properties/budget/required",
            keyword: "required",
            params: { missingProperty: "simulation_time_ps" },
            message: "must have required property '" + "simulation_time_ps" + "'",
          };
          if (vErrors === null) {
            vErrors = [err128];
          } else {
            vErrors.push(err128);
          }
          errors++;
        }
        if (data55.wall_time_ps === undefined) {
          const err129 = {
            instancePath: instancePath + "/budget",
            schemaPath: "#/properties/budget/required",
            keyword: "required",
            params: { missingProperty: "wall_time_ps" },
            message: "must have required property '" + "wall_time_ps" + "'",
          };
          if (vErrors === null) {
            vErrors = [err129];
          } else {
            vErrors.push(err129);
          }
          errors++;
        }
        for (const key10 in data55) {
          if (!(
            key10 === "candidate_count" ||
            key10 === "run_count" ||
            key10 === "simulation_time_ps" ||
            key10 === "wall_time_ps"
          )) {
            const err130 = {
              instancePath: instancePath + "/budget",
              schemaPath: "#/properties/budget/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key10 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err130];
            } else {
              vErrors.push(err130);
            }
            errors++;
          }
        }
        if (data55.candidate_count !== undefined) {
          let data56 = data55.candidate_count;
          if (typeof data56 === "string") {
            if (!pattern16.test(data56)) {
              const err131 = {
                instancePath: instancePath + "/budget/candidate_count",
                schemaPath: "common.schema.json#/$defs/uint64/pattern",
                keyword: "pattern",
                params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
                message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err131];
              } else {
                vErrors.push(err131);
              }
              errors++;
            }
          } else {
            const err132 = {
              instancePath: instancePath + "/budget/candidate_count",
              schemaPath: "common.schema.json#/$defs/uint64/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err132];
            } else {
              vErrors.push(err132);
            }
            errors++;
          }
        }
        if (data55.run_count !== undefined) {
          let data57 = data55.run_count;
          if (typeof data57 === "string") {
            if (!pattern16.test(data57)) {
              const err133 = {
                instancePath: instancePath + "/budget/run_count",
                schemaPath: "common.schema.json#/$defs/uint64/pattern",
                keyword: "pattern",
                params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
                message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err133];
              } else {
                vErrors.push(err133);
              }
              errors++;
            }
          } else {
            const err134 = {
              instancePath: instancePath + "/budget/run_count",
              schemaPath: "common.schema.json#/$defs/uint64/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err134];
            } else {
              vErrors.push(err134);
            }
            errors++;
          }
        }
        if (data55.simulation_time_ps !== undefined) {
          let data58 = data55.simulation_time_ps;
          if (typeof data58 === "string") {
            if (!pattern16.test(data58)) {
              const err135 = {
                instancePath: instancePath + "/budget/simulation_time_ps",
                schemaPath: "common.schema.json#/$defs/uint64/pattern",
                keyword: "pattern",
                params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
                message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
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
              instancePath: instancePath + "/budget/simulation_time_ps",
              schemaPath: "common.schema.json#/$defs/uint64/type",
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
        if (data55.wall_time_ps !== undefined) {
          let data59 = data55.wall_time_ps;
          if (typeof data59 === "string") {
            if (!pattern16.test(data59)) {
              const err137 = {
                instancePath: instancePath + "/budget/wall_time_ps",
                schemaPath: "common.schema.json#/$defs/uint64/pattern",
                keyword: "pattern",
                params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
                message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err137];
              } else {
                vErrors.push(err137);
              }
              errors++;
            }
          } else {
            const err138 = {
              instancePath: instancePath + "/budget/wall_time_ps",
              schemaPath: "common.schema.json#/$defs/uint64/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err138];
            } else {
              vErrors.push(err138);
            }
            errors++;
          }
        }
      } else {
        const err139 = {
          instancePath: instancePath + "/budget",
          schemaPath: "#/properties/budget/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err139];
        } else {
          vErrors.push(err139);
        }
        errors++;
      }
    }
  } else {
    const err140 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err140];
    } else {
      vErrors.push(err140);
    }
    errors++;
  }
  validate114.errors = vErrors;
  return errors === 0;
}
validate114.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const validationReportV1 = validate124;
const schema146 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-phase2/validation-report.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_validation_report.v1",
  $defs: {
    issue: {
      type: "object",
      additionalProperties: false,
      required: [
        "rule_id",
        "category",
        "severity",
        "blocking",
        "status",
        "field_references",
        "profile_references",
        "facts",
        "repair_candidates",
        "supporting_receipt",
        "retryable",
        "safe_next_action",
      ],
      properties: {
        rule_id: { $ref: "common.schema.json#/$defs/stableId" },
        category: {
          enum: [
            "invalid",
            "infeasible",
            "unsupported",
            "unknown",
            "stale",
            "profile_missing",
            "revision_mismatch",
            "calibration_missing",
            "evidence_scope_insufficient",
            "lowering_missing",
            "budget_exceeded",
            "calculator_unavailable",
            "internal_failure",
          ],
        },
        severity: { enum: ["info", "warning", "error", "fatal"] },
        blocking: { type: "boolean" },
        status: { enum: ["open", "resolved", "waived", "not_applicable"] },
        field_references: { type: "array", items: { type: "string", pattern: "^/" }, uniqueItems: true },
        profile_references: { type: "array", items: { $ref: "common.schema.json#/$defs/profileReference" } },
        facts: { type: "object", additionalProperties: { type: ["string", "boolean", "null"] } },
        repair_candidates: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["action_identity", "description", "safe"],
            properties: {
              action_identity: { $ref: "common.schema.json#/$defs/stableId" },
              description: { type: "string", minLength: 1, maxLength: 500 },
              safe: { type: "boolean" },
            },
          },
        },
        supporting_receipt: { oneOf: [{ $ref: "common.schema.json#/$defs/stableReference" }, { type: "null" }] },
        retryable: { type: "boolean" },
        safe_next_action: { type: "string", minLength: 1, maxLength: 500 },
      },
    },
  },
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "schema_revision",
    "report_id",
    "report_digest",
    "input_binding",
    "profile_snapshot_binding",
    "capability_snapshot_binding",
    "backend_binding",
    "validation_policy_revision",
    "overall_status",
    "issues",
    "calculator_receipts",
    "compiled_request_preview",
    "field_to_pointer_map",
    "candidate_plan",
    "budget",
    "claim_scope_ceiling",
    "stale_binding",
  ],
  properties: {
    schema_identity: { const: "tilesim.bridge.agent_orchestration_validation_report.v1" },
    schema_revision: { $ref: "common.schema.json#/$defs/sha256" },
    report_id: { $ref: "common.schema.json#/$defs/stableId" },
    report_digest: { $ref: "common.schema.json#/$defs/sha256" },
    input_binding: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "identity", "revision", "digest"],
      properties: {
        kind: { enum: ["draft", "run_intake"] },
        identity: { $ref: "common.schema.json#/$defs/stableId" },
        revision: { $ref: "common.schema.json#/$defs/sha256" },
        digest: { $ref: "common.schema.json#/$defs/sha256" },
      },
    },
    profile_snapshot_binding: { $ref: "common.schema.json#/$defs/stableReference" },
    capability_snapshot_binding: { $ref: "common.schema.json#/$defs/stableReference" },
    backend_binding: {
      type: "object",
      additionalProperties: false,
      required: ["backend_revision", "schema_set_revision"],
      properties: {
        backend_revision: { type: "string", pattern: "^[0-9a-f]{40}$" },
        schema_set_revision: { $ref: "common.schema.json#/$defs/sha256" },
      },
    },
    validation_policy_revision: { $ref: "common.schema.json#/$defs/sha256" },
    overall_status: { enum: ["valid", "invalid", "infeasible", "unsupported", "unknown", "stale", "internal_failure"] },
    issues: { type: "array", items: { $ref: "#/$defs/issue" } },
    calculator_receipts: { type: "array", minItems: 1, items: { $ref: "calculator-receipt.schema.json" } },
    compiled_request_preview: {
      type: "object",
      additionalProperties: false,
      required: ["target_identity", "target_revision", "canonical_payload_digest", "redacted_payload"],
      properties: {
        target_identity: { $ref: "common.schema.json#/$defs/stableId" },
        target_revision: { $ref: "common.schema.json#/$defs/sha256" },
        canonical_payload_digest: { $ref: "common.schema.json#/$defs/sha256" },
        redacted_payload: { type: "object" },
      },
    },
    field_to_pointer_map: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_field", "target_pointer"],
        properties: {
          source_field: { $ref: "common.schema.json#/$defs/stableId" },
          target_pointer: { type: "string", pattern: "^/" },
        },
      },
    },
    candidate_plan: {
      type: "object",
      additionalProperties: false,
      required: ["candidate_count", "run_count", "planning_status"],
      properties: {
        candidate_count: { $ref: "common.schema.json#/$defs/uint64" },
        run_count: { $ref: "common.schema.json#/$defs/uint64" },
        planning_status: { enum: ["ready", "blocked", "unknown"] },
      },
    },
    budget: {
      type: "object",
      additionalProperties: false,
      required: ["requested_runs", "accepted_runs", "wall_time_ps", "status"],
      properties: {
        requested_runs: { $ref: "common.schema.json#/$defs/uint64" },
        accepted_runs: { $ref: "common.schema.json#/$defs/uint64" },
        wall_time_ps: { $ref: "common.schema.json#/$defs/uint64" },
        status: { enum: ["within_budget", "exceeded", "unknown"] },
      },
    },
    claim_scope_ceiling: { $ref: "common.schema.json#/$defs/claimScope" },
    stale_binding: {
      type: "object",
      additionalProperties: false,
      required: ["is_stale", "reasons", "checked_bindings"],
      properties: {
        is_stale: { type: "boolean" },
        reasons: {
          type: "array",
          items: {
            enum: [
              "profile_revision_or_digest_changed",
              "capability_snapshot_changed",
              "backend_or_schema_revision_changed",
              "validation_policy_changed",
              "calculator_algorithm_changed",
              "workload_template_changed",
              "compiled_request_changed",
              "approval_missing_or_expired",
            ],
          },
          uniqueItems: true,
        },
        checked_bindings: {
          type: "array",
          minItems: 8,
          items: { $ref: "common.schema.json#/$defs/stableId" },
          uniqueItems: true,
        },
      },
    },
  },
};
import func0 from "ajv/dist/runtime/equal";
const pattern90 = new RegExp("^[0-9a-f]{40}$", "u");
function validate125(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate125.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.identity === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "identity" },
        message: "must have required property '" + "identity" + "'",
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
    if (data.digest === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "digest" },
        message: "must have required property '" + "digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "identity" || key0 === "revision" || key0 === "digest")) {
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
    if (data.identity !== undefined) {
      let data0 = data.identity;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err4 = {
            instancePath: instancePath + "/identity",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/identity",
          schemaPath: "#/$defs/stableId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.revision !== undefined) {
      let data1 = data.revision;
      if (typeof data1 === "string") {
        if (!pattern5.test(data1)) {
          const err6 = {
            instancePath: instancePath + "/revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.digest !== undefined) {
      let data2 = data.digest;
      if (typeof data2 === "string") {
        if (!pattern5.test(data2)) {
          const err8 = {
            instancePath: instancePath + "/digest",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/digest",
          schemaPath: "#/$defs/sha256/type",
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
  validate125.errors = vErrors;
  return errors === 0;
}
validate125.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const schema159 = {
  type: "object",
  additionalProperties: false,
  required: [
    "rule_id",
    "category",
    "severity",
    "blocking",
    "status",
    "field_references",
    "profile_references",
    "facts",
    "repair_candidates",
    "supporting_receipt",
    "retryable",
    "safe_next_action",
  ],
  properties: {
    rule_id: { $ref: "common.schema.json#/$defs/stableId" },
    category: {
      enum: [
        "invalid",
        "infeasible",
        "unsupported",
        "unknown",
        "stale",
        "profile_missing",
        "revision_mismatch",
        "calibration_missing",
        "evidence_scope_insufficient",
        "lowering_missing",
        "budget_exceeded",
        "calculator_unavailable",
        "internal_failure",
      ],
    },
    severity: { enum: ["info", "warning", "error", "fatal"] },
    blocking: { type: "boolean" },
    status: { enum: ["open", "resolved", "waived", "not_applicable"] },
    field_references: { type: "array", items: { type: "string", pattern: "^/" }, uniqueItems: true },
    profile_references: { type: "array", items: { $ref: "common.schema.json#/$defs/profileReference" } },
    facts: { type: "object", additionalProperties: { type: ["string", "boolean", "null"] } },
    repair_candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action_identity", "description", "safe"],
        properties: {
          action_identity: { $ref: "common.schema.json#/$defs/stableId" },
          description: { type: "string", minLength: 1, maxLength: 500 },
          safe: { type: "boolean" },
        },
      },
    },
    supporting_receipt: { oneOf: [{ $ref: "common.schema.json#/$defs/stableReference" }, { type: "null" }] },
    retryable: { type: "boolean" },
    safe_next_action: { type: "string", minLength: 1, maxLength: 500 },
  },
};
function validate129(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate129.evaluated;
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
    if (data.profile_id === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_id" },
        message: "must have required property '" + "profile_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.identity === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "identity" },
        message: "must have required property '" + "identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.revision === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "revision" },
        message: "must have required property '" + "revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.digest === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "digest" },
        message: "must have required property '" + "digest" + "'",
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
        key0 === "family" ||
        key0 === "profile_id" ||
        key0 === "identity" ||
        key0 === "revision" ||
        key0 === "digest"
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
    if (data.family !== undefined) {
      let data0 = data.family;
      if (!(
        data0 === "model" ||
        data0 === "engine" ||
        data0 === "device" ||
        data0 === "topology" ||
        data0 === "workload"
      )) {
        const err6 = {
          instancePath: instancePath + "/family",
          schemaPath: "#/properties/family/enum",
          keyword: "enum",
          params: { allowedValues: schema111.properties.family.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.profile_id !== undefined) {
      let data1 = data.profile_id;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err7 = {
            instancePath: instancePath + "/profile_id",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/profile_id",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.identity !== undefined) {
      let data2 = data.identity;
      if (typeof data2 === "string") {
        if (!pattern4.test(data2)) {
          const err9 = {
            instancePath: instancePath + "/identity",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/identity",
          schemaPath: "#/$defs/stableId/type",
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
    if (data.revision !== undefined) {
      let data3 = data.revision;
      if (typeof data3 === "string") {
        if (!pattern5.test(data3)) {
          const err11 = {
            instancePath: instancePath + "/revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.digest !== undefined) {
      let data4 = data.digest;
      if (typeof data4 === "string") {
        if (!pattern5.test(data4)) {
          const err13 = {
            instancePath: instancePath + "/digest",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/digest",
          schemaPath: "#/$defs/sha256/type",
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
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err15];
    } else {
      vErrors.push(err15);
    }
    errors++;
  }
  validate129.errors = vErrors;
  return errors === 0;
}
validate129.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate128(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate128.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.rule_id === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "rule_id" },
        message: "must have required property '" + "rule_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.category === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "category" },
        message: "must have required property '" + "category" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.severity === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "severity" },
        message: "must have required property '" + "severity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.blocking === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "blocking" },
        message: "must have required property '" + "blocking" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.status === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "status" },
        message: "must have required property '" + "status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.field_references === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "field_references" },
        message: "must have required property '" + "field_references" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.profile_references === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_references" },
        message: "must have required property '" + "profile_references" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.facts === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "facts" },
        message: "must have required property '" + "facts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.repair_candidates === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "repair_candidates" },
        message: "must have required property '" + "repair_candidates" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.supporting_receipt === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "supporting_receipt" },
        message: "must have required property '" + "supporting_receipt" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.retryable === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "retryable" },
        message: "must have required property '" + "retryable" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.safe_next_action === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "safe_next_action" },
        message: "must have required property '" + "safe_next_action" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema159.properties, key0)) {
        const err12 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.rule_id !== undefined) {
      let data0 = data.rule_id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err13 = {
            instancePath: instancePath + "/rule_id",
            schemaPath: "common.schema.json#/$defs/stableId/pattern",
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
          instancePath: instancePath + "/rule_id",
          schemaPath: "common.schema.json#/$defs/stableId/type",
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
    if (data.category !== undefined) {
      let data1 = data.category;
      if (!(
        data1 === "invalid" ||
        data1 === "infeasible" ||
        data1 === "unsupported" ||
        data1 === "unknown" ||
        data1 === "stale" ||
        data1 === "profile_missing" ||
        data1 === "revision_mismatch" ||
        data1 === "calibration_missing" ||
        data1 === "evidence_scope_insufficient" ||
        data1 === "lowering_missing" ||
        data1 === "budget_exceeded" ||
        data1 === "calculator_unavailable" ||
        data1 === "internal_failure"
      )) {
        const err15 = {
          instancePath: instancePath + "/category",
          schemaPath: "#/properties/category/enum",
          keyword: "enum",
          params: { allowedValues: schema159.properties.category.enum },
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
    if (data.severity !== undefined) {
      let data2 = data.severity;
      if (!(data2 === "info" || data2 === "warning" || data2 === "error" || data2 === "fatal")) {
        const err16 = {
          instancePath: instancePath + "/severity",
          schemaPath: "#/properties/severity/enum",
          keyword: "enum",
          params: { allowedValues: schema159.properties.severity.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.blocking !== undefined) {
      if (typeof data.blocking !== "boolean") {
        const err17 = {
          instancePath: instancePath + "/blocking",
          schemaPath: "#/properties/blocking/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.status !== undefined) {
      let data4 = data.status;
      if (!(data4 === "open" || data4 === "resolved" || data4 === "waived" || data4 === "not_applicable")) {
        const err18 = {
          instancePath: instancePath + "/status",
          schemaPath: "#/properties/status/enum",
          keyword: "enum",
          params: { allowedValues: schema159.properties.status.enum },
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
    if (data.field_references !== undefined) {
      let data5 = data.field_references;
      if (Array.isArray(data5)) {
        const len0 = data5.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data6 = data5[i0];
          if (typeof data6 === "string") {
            if (!pattern73.test(data6)) {
              const err19 = {
                instancePath: instancePath + "/field_references/" + i0,
                schemaPath: "#/properties/field_references/items/pattern",
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
              instancePath: instancePath + "/field_references/" + i0,
              schemaPath: "#/properties/field_references/items/type",
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
              const err21 = {
                instancePath: instancePath + "/field_references",
                schemaPath: "#/properties/field_references/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i1, j: j0 },
                message: "must NOT have duplicate items (items ## " + j0 + " and " + i1 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err21];
              } else {
                vErrors.push(err21);
              }
              errors++;
              break;
            }
            indices0[item0] = i1;
          }
        }
      } else {
        const err22 = {
          instancePath: instancePath + "/field_references",
          schemaPath: "#/properties/field_references/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.profile_references !== undefined) {
      let data7 = data.profile_references;
      if (Array.isArray(data7)) {
        const len1 = data7.length;
        for (let i2 = 0; i2 < len1; i2++) {
          if (
            !validate129(data7[i2], {
              instancePath: instancePath + "/profile_references/" + i2,
              parentData: data7,
              parentDataProperty: i2,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate129.errors : vErrors.concat(validate129.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err23 = {
          instancePath: instancePath + "/profile_references",
          schemaPath: "#/properties/profile_references/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.facts !== undefined) {
      let data9 = data.facts;
      if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
        for (const key1 in data9) {
          let data10 = data9[key1];
          if (typeof data10 !== "string" && typeof data10 !== "boolean" && data10 !== null) {
            const err24 = {
              instancePath: instancePath + "/facts/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath: "#/properties/facts/additionalProperties/type",
              keyword: "type",
              params: { type: schema159.properties.facts.additionalProperties.type },
              message: "must be string,boolean,null",
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
          instancePath: instancePath + "/facts",
          schemaPath: "#/properties/facts/type",
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
    if (data.repair_candidates !== undefined) {
      let data11 = data.repair_candidates;
      if (Array.isArray(data11)) {
        const len2 = data11.length;
        for (let i3 = 0; i3 < len2; i3++) {
          let data12 = data11[i3];
          if (data12 && typeof data12 == "object" && !Array.isArray(data12)) {
            if (data12.action_identity === undefined) {
              const err26 = {
                instancePath: instancePath + "/repair_candidates/" + i3,
                schemaPath: "#/properties/repair_candidates/items/required",
                keyword: "required",
                params: { missingProperty: "action_identity" },
                message: "must have required property '" + "action_identity" + "'",
              };
              if (vErrors === null) {
                vErrors = [err26];
              } else {
                vErrors.push(err26);
              }
              errors++;
            }
            if (data12.description === undefined) {
              const err27 = {
                instancePath: instancePath + "/repair_candidates/" + i3,
                schemaPath: "#/properties/repair_candidates/items/required",
                keyword: "required",
                params: { missingProperty: "description" },
                message: "must have required property '" + "description" + "'",
              };
              if (vErrors === null) {
                vErrors = [err27];
              } else {
                vErrors.push(err27);
              }
              errors++;
            }
            if (data12.safe === undefined) {
              const err28 = {
                instancePath: instancePath + "/repair_candidates/" + i3,
                schemaPath: "#/properties/repair_candidates/items/required",
                keyword: "required",
                params: { missingProperty: "safe" },
                message: "must have required property '" + "safe" + "'",
              };
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            }
            for (const key2 in data12) {
              if (!(key2 === "action_identity" || key2 === "description" || key2 === "safe")) {
                const err29 = {
                  instancePath: instancePath + "/repair_candidates/" + i3,
                  schemaPath: "#/properties/repair_candidates/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key2 },
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
            if (data12.action_identity !== undefined) {
              let data13 = data12.action_identity;
              if (typeof data13 === "string") {
                if (!pattern4.test(data13)) {
                  const err30 = {
                    instancePath: instancePath + "/repair_candidates/" + i3 + "/action_identity",
                    schemaPath: "common.schema.json#/$defs/stableId/pattern",
                    keyword: "pattern",
                    params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                    message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
                  instancePath: instancePath + "/repair_candidates/" + i3 + "/action_identity",
                  schemaPath: "common.schema.json#/$defs/stableId/type",
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
            if (data12.description !== undefined) {
              let data14 = data12.description;
              if (typeof data14 === "string") {
                if (func2(data14) > 500) {
                  const err32 = {
                    instancePath: instancePath + "/repair_candidates/" + i3 + "/description",
                    schemaPath: "#/properties/repair_candidates/items/properties/description/maxLength",
                    keyword: "maxLength",
                    params: { limit: 500 },
                    message: "must NOT have more than 500 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err32];
                  } else {
                    vErrors.push(err32);
                  }
                  errors++;
                }
                if (func2(data14) < 1) {
                  const err33 = {
                    instancePath: instancePath + "/repair_candidates/" + i3 + "/description",
                    schemaPath: "#/properties/repair_candidates/items/properties/description/minLength",
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
                  instancePath: instancePath + "/repair_candidates/" + i3 + "/description",
                  schemaPath: "#/properties/repair_candidates/items/properties/description/type",
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
            if (data12.safe !== undefined) {
              if (typeof data12.safe !== "boolean") {
                const err35 = {
                  instancePath: instancePath + "/repair_candidates/" + i3 + "/safe",
                  schemaPath: "#/properties/repair_candidates/items/properties/safe/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
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
              instancePath: instancePath + "/repair_candidates/" + i3,
              schemaPath: "#/properties/repair_candidates/items/type",
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
          instancePath: instancePath + "/repair_candidates",
          schemaPath: "#/properties/repair_candidates/type",
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
    if (data.supporting_receipt !== undefined) {
      let data16 = data.supporting_receipt;
      const _errs35 = errors;
      let valid12 = false;
      let passing0 = null;
      const _errs36 = errors;
      if (
        !validate125(data16, {
          instancePath: instancePath + "/supporting_receipt",
          parentData: data,
          parentDataProperty: "supporting_receipt",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate125.errors : vErrors.concat(validate125.errors);
        errors = vErrors.length;
      }
      var _valid0 = _errs36 === errors;
      if (_valid0) {
        valid12 = true;
        passing0 = 0;
      }
      const _errs37 = errors;
      if (data16 !== null) {
        const err38 = {
          instancePath: instancePath + "/supporting_receipt",
          schemaPath: "#/properties/supporting_receipt/oneOf/1/type",
          keyword: "type",
          params: { type: "null" },
          message: "must be null",
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
      var _valid0 = _errs37 === errors;
      if (_valid0 && valid12) {
        valid12 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid12 = true;
          passing0 = 1;
        }
      }
      if (!valid12) {
        const err39 = {
          instancePath: instancePath + "/supporting_receipt",
          schemaPath: "#/properties/supporting_receipt/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing0 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      } else {
        errors = _errs35;
        if (vErrors !== null) {
          if (_errs35) {
            vErrors.length = _errs35;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.retryable !== undefined) {
      if (typeof data.retryable !== "boolean") {
        const err40 = {
          instancePath: instancePath + "/retryable",
          schemaPath: "#/properties/retryable/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
    if (data.safe_next_action !== undefined) {
      let data18 = data.safe_next_action;
      if (typeof data18 === "string") {
        if (func2(data18) > 500) {
          const err41 = {
            instancePath: instancePath + "/safe_next_action",
            schemaPath: "#/properties/safe_next_action/maxLength",
            keyword: "maxLength",
            params: { limit: 500 },
            message: "must NOT have more than 500 characters",
          };
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
        if (func2(data18) < 1) {
          const err42 = {
            instancePath: instancePath + "/safe_next_action",
            schemaPath: "#/properties/safe_next_action/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err42];
          } else {
            vErrors.push(err42);
          }
          errors++;
        }
      } else {
        const err43 = {
          instancePath: instancePath + "/safe_next_action",
          schemaPath: "#/properties/safe_next_action/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
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
  validate128.errors = vErrors;
  return errors === 0;
}
validate128.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const schema167 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-phase2/calculator-receipt.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_calculator_receipt_envelope.v1",
  $defs: {
    result: {
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "value", "unit"],
          properties: {
            kind: { const: "exact" },
            value: { $ref: "common.schema.json#/$defs/decimal" },
            unit: { type: "string", minLength: 1 },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "lower", "upper", "unit", "confidence"],
          properties: {
            kind: { const: "interval" },
            lower: { $ref: "common.schema.json#/$defs/decimal" },
            upper: { $ref: "common.schema.json#/$defs/decimal" },
            unit: { type: "string", minLength: 1 },
            confidence: { $ref: "common.schema.json#/$defs/decimal" },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "reason_code"],
          properties: { kind: { const: "unknown" }, reason_code: { $ref: "common.schema.json#/$defs/stableId" } },
        },
      ],
    },
  },
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "schema_revision",
    "receipt_identity",
    "receipt_revision",
    "receipt_type",
    "calculator_identity",
    "algorithm_revision",
    "input_references",
    "units",
    "result",
    "rounding_policy",
    "assumptions",
    "uncertainty",
    "rule_ids",
    "repair_candidates",
    "claim_scope_ceiling",
    "typed_facts",
  ],
  properties: {
    schema_identity: { const: "tilesim.bridge.agent_orchestration_calculator_receipt_envelope.v1" },
    schema_revision: { $ref: "common.schema.json#/$defs/sha256" },
    receipt_identity: { $ref: "common.schema.json#/$defs/stableId" },
    receipt_revision: { $ref: "common.schema.json#/$defs/sha256" },
    receipt_type: {
      enum: [
        "model_weight_memory",
        "kv_capacity",
        "parallelism",
        "placement",
        "collective_network",
        "workload_distribution",
        "slo_budget",
      ],
    },
    calculator_identity: { $ref: "common.schema.json#/$defs/stableId" },
    algorithm_revision: { $ref: "common.schema.json#/$defs/sha256" },
    input_references: { type: "array", minItems: 1, items: { $ref: "common.schema.json#/$defs/stableReference" } },
    units: { type: "array", minItems: 1, items: { type: "string", minLength: 1, maxLength: 64 }, uniqueItems: true },
    result: { $ref: "#/$defs/result" },
    rounding_policy: { enum: ["exact", "floor", "ceiling", "half_even", "outward_interval"] },
    assumptions: { type: "array", items: { type: "string", minLength: 1, maxLength: 500 }, uniqueItems: true },
    uncertainty: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "description"],
      properties: {
        kind: { enum: ["none", "bounded", "unbounded"] },
        description: { type: "string", minLength: 1, maxLength: 500 },
      },
    },
    rule_ids: { type: "array", minItems: 1, items: { $ref: "common.schema.json#/$defs/stableId" }, uniqueItems: true },
    repair_candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action_identity", "target_pointer", "safe", "description"],
        properties: {
          action_identity: { $ref: "common.schema.json#/$defs/stableId" },
          target_pointer: { type: "string", pattern: "^/" },
          safe: { type: "boolean" },
          description: { type: "string", minLength: 1, maxLength: 500 },
        },
      },
    },
    claim_scope_ceiling: { $ref: "common.schema.json#/$defs/claimScope" },
    typed_facts: {
      type: "object",
      additionalProperties: false,
      required: ["primary_quantity", "constraint_status"],
      properties: {
        primary_quantity: { type: "string", minLength: 1 },
        constraint_status: { enum: ["satisfied", "violated", "unknown"] },
      },
    },
  },
  oneOf: [
    {
      properties: {
        receipt_type: { const: "model_weight_memory" },
        receipt_identity: { const: "tilesim.bridge.agent_orchestration_model_weight_memory_receipt.v1" },
      },
    },
    {
      properties: {
        receipt_type: { const: "kv_capacity" },
        receipt_identity: { const: "tilesim.bridge.agent_orchestration_kv_capacity_receipt.v1" },
      },
    },
    {
      properties: {
        receipt_type: { const: "parallelism" },
        receipt_identity: { const: "tilesim.bridge.agent_orchestration_parallelism_receipt.v1" },
      },
    },
    {
      properties: {
        receipt_type: { const: "placement" },
        receipt_identity: { const: "tilesim.bridge.agent_orchestration_placement_receipt.v1" },
      },
    },
    {
      properties: {
        receipt_type: { const: "collective_network" },
        receipt_identity: { const: "tilesim.bridge.agent_orchestration_collective_network_receipt.v1" },
      },
    },
    {
      properties: {
        receipt_type: { const: "workload_distribution" },
        receipt_identity: { const: "tilesim.bridge.agent_orchestration_workload_distribution_receipt.v1" },
      },
    },
    {
      properties: {
        receipt_type: { const: "slo_budget" },
        receipt_identity: { const: "tilesim.bridge.agent_orchestration_slo_budget_receipt.v1" },
      },
    },
  ],
};
function validate134(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate134.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.identity === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "identity" },
        message: "must have required property '" + "identity" + "'",
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
    if (data.digest === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "digest" },
        message: "must have required property '" + "digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "identity" || key0 === "revision" || key0 === "digest")) {
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
    if (data.identity !== undefined) {
      let data0 = data.identity;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err4 = {
            instancePath: instancePath + "/identity",
            schemaPath: "#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/identity",
          schemaPath: "#/$defs/stableId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.revision !== undefined) {
      let data1 = data.revision;
      if (typeof data1 === "string") {
        if (!pattern5.test(data1)) {
          const err6 = {
            instancePath: instancePath + "/revision",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/revision",
          schemaPath: "#/$defs/sha256/type",
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
    if (data.digest !== undefined) {
      let data2 = data.digest;
      if (typeof data2 === "string") {
        if (!pattern5.test(data2)) {
          const err8 = {
            instancePath: instancePath + "/digest",
            schemaPath: "#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/digest",
          schemaPath: "#/$defs/sha256/type",
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
  validate134.errors = vErrors;
  return errors === 0;
}
validate134.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
const schema177 = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "value", "unit"],
      properties: {
        kind: { const: "exact" },
        value: { $ref: "common.schema.json#/$defs/decimal" },
        unit: { type: "string", minLength: 1 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "lower", "upper", "unit", "confidence"],
      properties: {
        kind: { const: "interval" },
        lower: { $ref: "common.schema.json#/$defs/decimal" },
        upper: { $ref: "common.schema.json#/$defs/decimal" },
        unit: { type: "string", minLength: 1 },
        confidence: { $ref: "common.schema.json#/$defs/decimal" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "reason_code"],
      properties: { kind: { const: "unknown" }, reason_code: { $ref: "common.schema.json#/$defs/stableId" } },
    },
  ],
};
function validate136(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate136.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs1 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err0 = {
        instancePath,
        schemaPath: "#/oneOf/0/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.value === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/oneOf/0/required",
        keyword: "required",
        params: { missingProperty: "value" },
        message: "must have required property '" + "value" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.unit === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/oneOf/0/required",
        keyword: "required",
        params: { missingProperty: "unit" },
        message: "must have required property '" + "unit" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "kind" || key0 === "value" || key0 === "unit")) {
        const err3 = {
          instancePath,
          schemaPath: "#/oneOf/0/additionalProperties",
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
    if (data.kind !== undefined) {
      if ("exact" !== data.kind) {
        const err4 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/oneOf/0/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "exact" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.value !== undefined) {
      let data1 = data.value;
      const _errs8 = errors;
      const _errs9 = errors;
      if (typeof data1 === "string") {
        if (!pattern14.test(data1)) {
          const err5 = {};
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      }
      var valid3 = _errs9 === errors;
      if (valid3) {
        const err6 = {
          instancePath: instancePath + "/value",
          schemaPath: "common.schema.json#/$defs/decimal/not",
          keyword: "not",
          params: {},
          message: "must NOT be valid",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      } else {
        errors = _errs8;
        if (vErrors !== null) {
          if (_errs8) {
            vErrors.length = _errs8;
          } else {
            vErrors = null;
          }
        }
      }
      if (typeof data1 === "string") {
        if (!pattern15.test(data1)) {
          const err7 = {
            instancePath: instancePath + "/value",
            schemaPath: "common.schema.json#/$defs/decimal/pattern",
            keyword: "pattern",
            params: { pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" },
            message: 'must match pattern "' + "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" + '"',
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
          instancePath: instancePath + "/value",
          schemaPath: "common.schema.json#/$defs/decimal/type",
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
    if (data.unit !== undefined) {
      let data2 = data.unit;
      if (typeof data2 === "string") {
        if (func2(data2) < 1) {
          const err9 = {
            instancePath: instancePath + "/unit",
            schemaPath: "#/oneOf/0/properties/unit/minLength",
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
          instancePath: instancePath + "/unit",
          schemaPath: "#/oneOf/0/properties/unit/type",
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
  } else {
    const err11 = {
      instancePath,
      schemaPath: "#/oneOf/0/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  var _valid0 = _errs1 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = true;
  }
  const _errs12 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.kind === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/oneOf/1/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property '" + "kind" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.lower === undefined) {
      const err13 = {
        instancePath,
        schemaPath: "#/oneOf/1/required",
        keyword: "required",
        params: { missingProperty: "lower" },
        message: "must have required property '" + "lower" + "'",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.upper === undefined) {
      const err14 = {
        instancePath,
        schemaPath: "#/oneOf/1/required",
        keyword: "required",
        params: { missingProperty: "upper" },
        message: "must have required property '" + "upper" + "'",
      };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    if (data.unit === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/oneOf/1/required",
        keyword: "required",
        params: { missingProperty: "unit" },
        message: "must have required property '" + "unit" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.confidence === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/oneOf/1/required",
        keyword: "required",
        params: { missingProperty: "confidence" },
        message: "must have required property '" + "confidence" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    for (const key1 in data) {
      if (!(key1 === "kind" || key1 === "lower" || key1 === "upper" || key1 === "unit" || key1 === "confidence")) {
        const err17 = {
          instancePath,
          schemaPath: "#/oneOf/1/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key1 },
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
    if (data.kind !== undefined) {
      if ("interval" !== data.kind) {
        const err18 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/oneOf/1/properties/kind/const",
          keyword: "const",
          params: { allowedValue: "interval" },
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
    if (data.lower !== undefined) {
      let data4 = data.lower;
      const _errs19 = errors;
      const _errs20 = errors;
      if (typeof data4 === "string") {
        if (!pattern14.test(data4)) {
          const err19 = {};
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      }
      var valid6 = _errs20 === errors;
      if (valid6) {
        const err20 = {
          instancePath: instancePath + "/lower",
          schemaPath: "common.schema.json#/$defs/decimal/not",
          keyword: "not",
          params: {},
          message: "must NOT be valid",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      } else {
        errors = _errs19;
        if (vErrors !== null) {
          if (_errs19) {
            vErrors.length = _errs19;
          } else {
            vErrors = null;
          }
        }
      }
      if (typeof data4 === "string") {
        if (!pattern15.test(data4)) {
          const err21 = {
            instancePath: instancePath + "/lower",
            schemaPath: "common.schema.json#/$defs/decimal/pattern",
            keyword: "pattern",
            params: { pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" },
            message: 'must match pattern "' + "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" + '"',
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
          instancePath: instancePath + "/lower",
          schemaPath: "common.schema.json#/$defs/decimal/type",
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
    if (data.upper !== undefined) {
      let data5 = data.upper;
      const _errs24 = errors;
      const _errs25 = errors;
      if (typeof data5 === "string") {
        if (!pattern14.test(data5)) {
          const err23 = {};
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      }
      var valid8 = _errs25 === errors;
      if (valid8) {
        const err24 = {
          instancePath: instancePath + "/upper",
          schemaPath: "common.schema.json#/$defs/decimal/not",
          keyword: "not",
          params: {},
          message: "must NOT be valid",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      } else {
        errors = _errs24;
        if (vErrors !== null) {
          if (_errs24) {
            vErrors.length = _errs24;
          } else {
            vErrors = null;
          }
        }
      }
      if (typeof data5 === "string") {
        if (!pattern15.test(data5)) {
          const err25 = {
            instancePath: instancePath + "/upper",
            schemaPath: "common.schema.json#/$defs/decimal/pattern",
            keyword: "pattern",
            params: { pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" },
            message: 'must match pattern "' + "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" + '"',
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
          instancePath: instancePath + "/upper",
          schemaPath: "common.schema.json#/$defs/decimal/type",
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
    if (data.unit !== undefined) {
      let data6 = data.unit;
      if (typeof data6 === "string") {
        if (func2(data6) < 1) {
          const err27 = {
            instancePath: instancePath + "/unit",
            schemaPath: "#/oneOf/1/properties/unit/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
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
          instancePath: instancePath + "/unit",
          schemaPath: "#/oneOf/1/properties/unit/type",
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
    if (data.confidence !== undefined) {
      let data7 = data.confidence;
      const _errs31 = errors;
      const _errs32 = errors;
      if (typeof data7 === "string") {
        if (!pattern14.test(data7)) {
          const err29 = {};
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
      }
      var valid10 = _errs32 === errors;
      if (valid10) {
        const err30 = {
          instancePath: instancePath + "/confidence",
          schemaPath: "common.schema.json#/$defs/decimal/not",
          keyword: "not",
          params: {},
          message: "must NOT be valid",
        };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      } else {
        errors = _errs31;
        if (vErrors !== null) {
          if (_errs31) {
            vErrors.length = _errs31;
          } else {
            vErrors = null;
          }
        }
      }
      if (typeof data7 === "string") {
        if (!pattern15.test(data7)) {
          const err31 = {
            instancePath: instancePath + "/confidence",
            schemaPath: "common.schema.json#/$defs/decimal/pattern",
            keyword: "pattern",
            params: { pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" },
            message: 'must match pattern "' + "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$" + '"',
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
          instancePath: instancePath + "/confidence",
          schemaPath: "common.schema.json#/$defs/decimal/type",
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
  } else {
    const err33 = {
      instancePath,
      schemaPath: "#/oneOf/1/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err33];
    } else {
      vErrors.push(err33);
    }
    errors++;
  }
  var _valid0 = _errs12 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = true;
      }
    }
    const _errs33 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.kind === undefined) {
        const err34 = {
          instancePath,
          schemaPath: "#/oneOf/2/required",
          keyword: "required",
          params: { missingProperty: "kind" },
          message: "must have required property '" + "kind" + "'",
        };
        if (vErrors === null) {
          vErrors = [err34];
        } else {
          vErrors.push(err34);
        }
        errors++;
      }
      if (data.reason_code === undefined) {
        const err35 = {
          instancePath,
          schemaPath: "#/oneOf/2/required",
          keyword: "required",
          params: { missingProperty: "reason_code" },
          message: "must have required property '" + "reason_code" + "'",
        };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
      for (const key2 in data) {
        if (!(key2 === "kind" || key2 === "reason_code")) {
          const err36 = {
            instancePath,
            schemaPath: "#/oneOf/2/additionalProperties",
            keyword: "additionalProperties",
            params: { additionalProperty: key2 },
            message: "must NOT have additional properties",
          };
          if (vErrors === null) {
            vErrors = [err36];
          } else {
            vErrors.push(err36);
          }
          errors++;
        }
      }
      if (data.kind !== undefined) {
        if ("unknown" !== data.kind) {
          const err37 = {
            instancePath: instancePath + "/kind",
            schemaPath: "#/oneOf/2/properties/kind/const",
            keyword: "const",
            params: { allowedValue: "unknown" },
            message: "must be equal to constant",
          };
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
      }
      if (data.reason_code !== undefined) {
        let data9 = data.reason_code;
        if (typeof data9 === "string") {
          if (!pattern4.test(data9)) {
            const err38 = {
              instancePath: instancePath + "/reason_code",
              schemaPath: "common.schema.json#/$defs/stableId/pattern",
              keyword: "pattern",
              params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
              message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
            instancePath: instancePath + "/reason_code",
            schemaPath: "common.schema.json#/$defs/stableId/type",
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
    } else {
      const err40 = {
        instancePath,
        schemaPath: "#/oneOf/2/type",
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
    var _valid0 = _errs33 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = true;
        }
      }
    }
  }
  if (!valid0) {
    const err41 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err41];
    } else {
      vErrors.push(err41);
    }
    errors++;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate136.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate136.evaluated = { dynamicProps: true, dynamicItems: false };
function validate133(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-phase2/calculator-receipt.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate133.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs1 = errors;
  let valid0 = false;
  let passing0 = null;
  const _errs2 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.receipt_type !== undefined) {
      if ("model_weight_memory" !== data.receipt_type) {
        const err0 = {
          instancePath: instancePath + "/receipt_type",
          schemaPath: "#/oneOf/0/properties/receipt_type/const",
          keyword: "const",
          params: { allowedValue: "model_weight_memory" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.receipt_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_model_weight_memory_receipt.v1" !== data.receipt_identity) {
        const err1 = {
          instancePath: instancePath + "/receipt_identity",
          schemaPath: "#/oneOf/0/properties/receipt_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_model_weight_memory_receipt.v1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
  }
  var _valid0 = _errs2 === errors;
  if (_valid0) {
    valid0 = true;
    passing0 = 0;
    var props0 = {};
    props0.receipt_type = true;
    props0.receipt_identity = true;
  }
  const _errs5 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.receipt_type !== undefined) {
      if ("kv_capacity" !== data.receipt_type) {
        const err2 = {
          instancePath: instancePath + "/receipt_type",
          schemaPath: "#/oneOf/1/properties/receipt_type/const",
          keyword: "const",
          params: { allowedValue: "kv_capacity" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.receipt_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_kv_capacity_receipt.v1" !== data.receipt_identity) {
        const err3 = {
          instancePath: instancePath + "/receipt_identity",
          schemaPath: "#/oneOf/1/properties/receipt_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_kv_capacity_receipt.v1" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
  }
  var _valid0 = _errs5 === errors;
  if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
  } else {
    if (_valid0) {
      valid0 = true;
      passing0 = 1;
      if (props0 !== true) {
        props0 = props0 || {};
        props0.receipt_type = true;
        props0.receipt_identity = true;
      }
    }
    const _errs8 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.receipt_type !== undefined) {
        if ("parallelism" !== data.receipt_type) {
          const err4 = {
            instancePath: instancePath + "/receipt_type",
            schemaPath: "#/oneOf/2/properties/receipt_type/const",
            keyword: "const",
            params: { allowedValue: "parallelism" },
            message: "must be equal to constant",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      }
      if (data.receipt_identity !== undefined) {
        if ("tilesim.bridge.agent_orchestration_parallelism_receipt.v1" !== data.receipt_identity) {
          const err5 = {
            instancePath: instancePath + "/receipt_identity",
            schemaPath: "#/oneOf/2/properties/receipt_identity/const",
            keyword: "const",
            params: { allowedValue: "tilesim.bridge.agent_orchestration_parallelism_receipt.v1" },
            message: "must be equal to constant",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      }
    }
    var _valid0 = _errs8 === errors;
    if (_valid0 && valid0) {
      valid0 = false;
      passing0 = [passing0, 2];
    } else {
      if (_valid0) {
        valid0 = true;
        passing0 = 2;
        if (props0 !== true) {
          props0 = props0 || {};
          props0.receipt_type = true;
          props0.receipt_identity = true;
        }
      }
      const _errs11 = errors;
      if (data && typeof data == "object" && !Array.isArray(data)) {
        if (data.receipt_type !== undefined) {
          if ("placement" !== data.receipt_type) {
            const err6 = {
              instancePath: instancePath + "/receipt_type",
              schemaPath: "#/oneOf/3/properties/receipt_type/const",
              keyword: "const",
              params: { allowedValue: "placement" },
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
        if (data.receipt_identity !== undefined) {
          if ("tilesim.bridge.agent_orchestration_placement_receipt.v1" !== data.receipt_identity) {
            const err7 = {
              instancePath: instancePath + "/receipt_identity",
              schemaPath: "#/oneOf/3/properties/receipt_identity/const",
              keyword: "const",
              params: { allowedValue: "tilesim.bridge.agent_orchestration_placement_receipt.v1" },
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
      }
      var _valid0 = _errs11 === errors;
      if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 3];
      } else {
        if (_valid0) {
          valid0 = true;
          passing0 = 3;
          if (props0 !== true) {
            props0 = props0 || {};
            props0.receipt_type = true;
            props0.receipt_identity = true;
          }
        }
        const _errs14 = errors;
        if (data && typeof data == "object" && !Array.isArray(data)) {
          if (data.receipt_type !== undefined) {
            if ("collective_network" !== data.receipt_type) {
              const err8 = {
                instancePath: instancePath + "/receipt_type",
                schemaPath: "#/oneOf/4/properties/receipt_type/const",
                keyword: "const",
                params: { allowedValue: "collective_network" },
                message: "must be equal to constant",
              };
              if (vErrors === null) {
                vErrors = [err8];
              } else {
                vErrors.push(err8);
              }
              errors++;
            }
          }
          if (data.receipt_identity !== undefined) {
            if ("tilesim.bridge.agent_orchestration_collective_network_receipt.v1" !== data.receipt_identity) {
              const err9 = {
                instancePath: instancePath + "/receipt_identity",
                schemaPath: "#/oneOf/4/properties/receipt_identity/const",
                keyword: "const",
                params: { allowedValue: "tilesim.bridge.agent_orchestration_collective_network_receipt.v1" },
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
        }
        var _valid0 = _errs14 === errors;
        if (_valid0 && valid0) {
          valid0 = false;
          passing0 = [passing0, 4];
        } else {
          if (_valid0) {
            valid0 = true;
            passing0 = 4;
            if (props0 !== true) {
              props0 = props0 || {};
              props0.receipt_type = true;
              props0.receipt_identity = true;
            }
          }
          const _errs17 = errors;
          if (data && typeof data == "object" && !Array.isArray(data)) {
            if (data.receipt_type !== undefined) {
              if ("workload_distribution" !== data.receipt_type) {
                const err10 = {
                  instancePath: instancePath + "/receipt_type",
                  schemaPath: "#/oneOf/5/properties/receipt_type/const",
                  keyword: "const",
                  params: { allowedValue: "workload_distribution" },
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
            if (data.receipt_identity !== undefined) {
              if ("tilesim.bridge.agent_orchestration_workload_distribution_receipt.v1" !== data.receipt_identity) {
                const err11 = {
                  instancePath: instancePath + "/receipt_identity",
                  schemaPath: "#/oneOf/5/properties/receipt_identity/const",
                  keyword: "const",
                  params: { allowedValue: "tilesim.bridge.agent_orchestration_workload_distribution_receipt.v1" },
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
          }
          var _valid0 = _errs17 === errors;
          if (_valid0 && valid0) {
            valid0 = false;
            passing0 = [passing0, 5];
          } else {
            if (_valid0) {
              valid0 = true;
              passing0 = 5;
              if (props0 !== true) {
                props0 = props0 || {};
                props0.receipt_type = true;
                props0.receipt_identity = true;
              }
            }
            const _errs20 = errors;
            if (data && typeof data == "object" && !Array.isArray(data)) {
              if (data.receipt_type !== undefined) {
                if ("slo_budget" !== data.receipt_type) {
                  const err12 = {
                    instancePath: instancePath + "/receipt_type",
                    schemaPath: "#/oneOf/6/properties/receipt_type/const",
                    keyword: "const",
                    params: { allowedValue: "slo_budget" },
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
              if (data.receipt_identity !== undefined) {
                if ("tilesim.bridge.agent_orchestration_slo_budget_receipt.v1" !== data.receipt_identity) {
                  const err13 = {
                    instancePath: instancePath + "/receipt_identity",
                    schemaPath: "#/oneOf/6/properties/receipt_identity/const",
                    keyword: "const",
                    params: { allowedValue: "tilesim.bridge.agent_orchestration_slo_budget_receipt.v1" },
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
            }
            var _valid0 = _errs20 === errors;
            if (_valid0 && valid0) {
              valid0 = false;
              passing0 = [passing0, 6];
            } else {
              if (_valid0) {
                valid0 = true;
                passing0 = 6;
                if (props0 !== true) {
                  props0 = props0 || {};
                  props0.receipt_type = true;
                  props0.receipt_identity = true;
                }
              }
            }
          }
        }
      }
    }
  }
  if (!valid0) {
    const err14 = {
      instancePath,
      schemaPath: "#/oneOf",
      keyword: "oneOf",
      params: { passingSchemas: passing0 },
      message: "must match exactly one schema in oneOf",
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  } else {
    errors = _errs1;
    if (vErrors !== null) {
      if (_errs1) {
        vErrors.length = _errs1;
      } else {
        vErrors = null;
      }
    }
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schema_identity === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_identity" },
        message: "must have required property '" + "schema_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.schema_revision === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_revision" },
        message: "must have required property '" + "schema_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    if (data.receipt_identity === undefined) {
      const err17 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "receipt_identity" },
        message: "must have required property '" + "receipt_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    if (data.receipt_revision === undefined) {
      const err18 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "receipt_revision" },
        message: "must have required property '" + "receipt_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
    if (data.receipt_type === undefined) {
      const err19 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "receipt_type" },
        message: "must have required property '" + "receipt_type" + "'",
      };
      if (vErrors === null) {
        vErrors = [err19];
      } else {
        vErrors.push(err19);
      }
      errors++;
    }
    if (data.calculator_identity === undefined) {
      const err20 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calculator_identity" },
        message: "must have required property '" + "calculator_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err20];
      } else {
        vErrors.push(err20);
      }
      errors++;
    }
    if (data.algorithm_revision === undefined) {
      const err21 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "algorithm_revision" },
        message: "must have required property '" + "algorithm_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err21];
      } else {
        vErrors.push(err21);
      }
      errors++;
    }
    if (data.input_references === undefined) {
      const err22 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "input_references" },
        message: "must have required property '" + "input_references" + "'",
      };
      if (vErrors === null) {
        vErrors = [err22];
      } else {
        vErrors.push(err22);
      }
      errors++;
    }
    if (data.units === undefined) {
      const err23 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "units" },
        message: "must have required property '" + "units" + "'",
      };
      if (vErrors === null) {
        vErrors = [err23];
      } else {
        vErrors.push(err23);
      }
      errors++;
    }
    if (data.result === undefined) {
      const err24 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "result" },
        message: "must have required property '" + "result" + "'",
      };
      if (vErrors === null) {
        vErrors = [err24];
      } else {
        vErrors.push(err24);
      }
      errors++;
    }
    if (data.rounding_policy === undefined) {
      const err25 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "rounding_policy" },
        message: "must have required property '" + "rounding_policy" + "'",
      };
      if (vErrors === null) {
        vErrors = [err25];
      } else {
        vErrors.push(err25);
      }
      errors++;
    }
    if (data.assumptions === undefined) {
      const err26 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "assumptions" },
        message: "must have required property '" + "assumptions" + "'",
      };
      if (vErrors === null) {
        vErrors = [err26];
      } else {
        vErrors.push(err26);
      }
      errors++;
    }
    if (data.uncertainty === undefined) {
      const err27 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "uncertainty" },
        message: "must have required property '" + "uncertainty" + "'",
      };
      if (vErrors === null) {
        vErrors = [err27];
      } else {
        vErrors.push(err27);
      }
      errors++;
    }
    if (data.rule_ids === undefined) {
      const err28 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "rule_ids" },
        message: "must have required property '" + "rule_ids" + "'",
      };
      if (vErrors === null) {
        vErrors = [err28];
      } else {
        vErrors.push(err28);
      }
      errors++;
    }
    if (data.repair_candidates === undefined) {
      const err29 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "repair_candidates" },
        message: "must have required property '" + "repair_candidates" + "'",
      };
      if (vErrors === null) {
        vErrors = [err29];
      } else {
        vErrors.push(err29);
      }
      errors++;
    }
    if (data.claim_scope_ceiling === undefined) {
      const err30 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "claim_scope_ceiling" },
        message: "must have required property '" + "claim_scope_ceiling" + "'",
      };
      if (vErrors === null) {
        vErrors = [err30];
      } else {
        vErrors.push(err30);
      }
      errors++;
    }
    if (data.typed_facts === undefined) {
      const err31 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "typed_facts" },
        message: "must have required property '" + "typed_facts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err31];
      } else {
        vErrors.push(err31);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema167.properties, key0)) {
        const err32 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
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
    if (data.schema_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_calculator_receipt_envelope.v1" !== data.schema_identity) {
        const err33 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_calculator_receipt_envelope.v1" },
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
    if (data.schema_revision !== undefined) {
      let data15 = data.schema_revision;
      if (typeof data15 === "string") {
        if (!pattern5.test(data15)) {
          const err34 = {
            instancePath: instancePath + "/schema_revision",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/schema_revision",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.receipt_identity !== undefined) {
      let data16 = data.receipt_identity;
      if (typeof data16 === "string") {
        if (!pattern4.test(data16)) {
          const err36 = {
            instancePath: instancePath + "/receipt_identity",
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
          instancePath: instancePath + "/receipt_identity",
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
    if (data.receipt_revision !== undefined) {
      let data17 = data.receipt_revision;
      if (typeof data17 === "string") {
        if (!pattern5.test(data17)) {
          const err38 = {
            instancePath: instancePath + "/receipt_revision",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/receipt_revision",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.receipt_type !== undefined) {
      let data18 = data.receipt_type;
      if (!(
        data18 === "model_weight_memory" ||
        data18 === "kv_capacity" ||
        data18 === "parallelism" ||
        data18 === "placement" ||
        data18 === "collective_network" ||
        data18 === "workload_distribution" ||
        data18 === "slo_budget"
      )) {
        const err40 = {
          instancePath: instancePath + "/receipt_type",
          schemaPath: "#/properties/receipt_type/enum",
          keyword: "enum",
          params: { allowedValues: schema167.properties.receipt_type.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
    if (data.calculator_identity !== undefined) {
      let data19 = data.calculator_identity;
      if (typeof data19 === "string") {
        if (!pattern4.test(data19)) {
          const err41 = {
            instancePath: instancePath + "/calculator_identity",
            schemaPath: "common.schema.json#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/calculator_identity",
          schemaPath: "common.schema.json#/$defs/stableId/type",
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
    if (data.algorithm_revision !== undefined) {
      let data20 = data.algorithm_revision;
      if (typeof data20 === "string") {
        if (!pattern5.test(data20)) {
          const err43 = {
            instancePath: instancePath + "/algorithm_revision",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/algorithm_revision",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.input_references !== undefined) {
      let data21 = data.input_references;
      if (Array.isArray(data21)) {
        if (data21.length < 1) {
          const err45 = {
            instancePath: instancePath + "/input_references",
            schemaPath: "#/properties/input_references/minItems",
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
        const len0 = data21.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate134(data21[i0], {
              instancePath: instancePath + "/input_references/" + i0,
              parentData: data21,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate134.errors : vErrors.concat(validate134.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err46 = {
          instancePath: instancePath + "/input_references",
          schemaPath: "#/properties/input_references/type",
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
    if (data.units !== undefined) {
      let data23 = data.units;
      if (Array.isArray(data23)) {
        if (data23.length < 1) {
          const err47 = {
            instancePath: instancePath + "/units",
            schemaPath: "#/properties/units/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
        const len1 = data23.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data24 = data23[i1];
          if (typeof data24 === "string") {
            if (func2(data24) > 64) {
              const err48 = {
                instancePath: instancePath + "/units/" + i1,
                schemaPath: "#/properties/units/items/maxLength",
                keyword: "maxLength",
                params: { limit: 64 },
                message: "must NOT have more than 64 characters",
              };
              if (vErrors === null) {
                vErrors = [err48];
              } else {
                vErrors.push(err48);
              }
              errors++;
            }
            if (func2(data24) < 1) {
              const err49 = {
                instancePath: instancePath + "/units/" + i1,
                schemaPath: "#/properties/units/items/minLength",
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
              instancePath: instancePath + "/units/" + i1,
              schemaPath: "#/properties/units/items/type",
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
        let i2 = data23.length;
        let j0;
        if (i2 > 1) {
          const indices0 = {};
          for (; i2--;) {
            let item0 = data23[i2];
            if (typeof item0 !== "string") {
              continue;
            }
            if (typeof indices0[item0] == "number") {
              j0 = indices0[item0];
              const err51 = {
                instancePath: instancePath + "/units",
                schemaPath: "#/properties/units/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i2, j: j0 },
                message: "must NOT have duplicate items (items ## " + j0 + " and " + i2 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err51];
              } else {
                vErrors.push(err51);
              }
              errors++;
              break;
            }
            indices0[item0] = i2;
          }
        }
      } else {
        const err52 = {
          instancePath: instancePath + "/units",
          schemaPath: "#/properties/units/type",
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
    if (data.result !== undefined) {
      if (
        !validate136(data.result, {
          instancePath: instancePath + "/result",
          parentData: data,
          parentDataProperty: "result",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate136.errors : vErrors.concat(validate136.errors);
        errors = vErrors.length;
      }
    }
    if (data.rounding_policy !== undefined) {
      let data26 = data.rounding_policy;
      if (!(
        data26 === "exact" ||
        data26 === "floor" ||
        data26 === "ceiling" ||
        data26 === "half_even" ||
        data26 === "outward_interval"
      )) {
        const err53 = {
          instancePath: instancePath + "/rounding_policy",
          schemaPath: "#/properties/rounding_policy/enum",
          keyword: "enum",
          params: { allowedValues: schema167.properties.rounding_policy.enum },
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
    if (data.assumptions !== undefined) {
      let data27 = data.assumptions;
      if (Array.isArray(data27)) {
        const len2 = data27.length;
        for (let i3 = 0; i3 < len2; i3++) {
          let data28 = data27[i3];
          if (typeof data28 === "string") {
            if (func2(data28) > 500) {
              const err54 = {
                instancePath: instancePath + "/assumptions/" + i3,
                schemaPath: "#/properties/assumptions/items/maxLength",
                keyword: "maxLength",
                params: { limit: 500 },
                message: "must NOT have more than 500 characters",
              };
              if (vErrors === null) {
                vErrors = [err54];
              } else {
                vErrors.push(err54);
              }
              errors++;
            }
            if (func2(data28) < 1) {
              const err55 = {
                instancePath: instancePath + "/assumptions/" + i3,
                schemaPath: "#/properties/assumptions/items/minLength",
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
              instancePath: instancePath + "/assumptions/" + i3,
              schemaPath: "#/properties/assumptions/items/type",
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
        let i4 = data27.length;
        let j1;
        if (i4 > 1) {
          const indices1 = {};
          for (; i4--;) {
            let item1 = data27[i4];
            if (typeof item1 !== "string") {
              continue;
            }
            if (typeof indices1[item1] == "number") {
              j1 = indices1[item1];
              const err57 = {
                instancePath: instancePath + "/assumptions",
                schemaPath: "#/properties/assumptions/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i4, j: j1 },
                message: "must NOT have duplicate items (items ## " + j1 + " and " + i4 + " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err57];
              } else {
                vErrors.push(err57);
              }
              errors++;
              break;
            }
            indices1[item1] = i4;
          }
        }
      } else {
        const err58 = {
          instancePath: instancePath + "/assumptions",
          schemaPath: "#/properties/assumptions/type",
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
    if (data.uncertainty !== undefined) {
      let data29 = data.uncertainty;
      if (data29 && typeof data29 == "object" && !Array.isArray(data29)) {
        if (data29.kind === undefined) {
          const err59 = {
            instancePath: instancePath + "/uncertainty",
            schemaPath: "#/properties/uncertainty/required",
            keyword: "required",
            params: { missingProperty: "kind" },
            message: "must have required property '" + "kind" + "'",
          };
          if (vErrors === null) {
            vErrors = [err59];
          } else {
            vErrors.push(err59);
          }
          errors++;
        }
        if (data29.description === undefined) {
          const err60 = {
            instancePath: instancePath + "/uncertainty",
            schemaPath: "#/properties/uncertainty/required",
            keyword: "required",
            params: { missingProperty: "description" },
            message: "must have required property '" + "description" + "'",
          };
          if (vErrors === null) {
            vErrors = [err60];
          } else {
            vErrors.push(err60);
          }
          errors++;
        }
        for (const key1 in data29) {
          if (!(key1 === "kind" || key1 === "description")) {
            const err61 = {
              instancePath: instancePath + "/uncertainty",
              schemaPath: "#/properties/uncertainty/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
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
        if (data29.kind !== undefined) {
          let data30 = data29.kind;
          if (!(data30 === "none" || data30 === "bounded" || data30 === "unbounded")) {
            const err62 = {
              instancePath: instancePath + "/uncertainty/kind",
              schemaPath: "#/properties/uncertainty/properties/kind/enum",
              keyword: "enum",
              params: { allowedValues: schema167.properties.uncertainty.properties.kind.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err62];
            } else {
              vErrors.push(err62);
            }
            errors++;
          }
        }
        if (data29.description !== undefined) {
          let data31 = data29.description;
          if (typeof data31 === "string") {
            if (func2(data31) > 500) {
              const err63 = {
                instancePath: instancePath + "/uncertainty/description",
                schemaPath: "#/properties/uncertainty/properties/description/maxLength",
                keyword: "maxLength",
                params: { limit: 500 },
                message: "must NOT have more than 500 characters",
              };
              if (vErrors === null) {
                vErrors = [err63];
              } else {
                vErrors.push(err63);
              }
              errors++;
            }
            if (func2(data31) < 1) {
              const err64 = {
                instancePath: instancePath + "/uncertainty/description",
                schemaPath: "#/properties/uncertainty/properties/description/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err64];
              } else {
                vErrors.push(err64);
              }
              errors++;
            }
          } else {
            const err65 = {
              instancePath: instancePath + "/uncertainty/description",
              schemaPath: "#/properties/uncertainty/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
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
          instancePath: instancePath + "/uncertainty",
          schemaPath: "#/properties/uncertainty/type",
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
    }
    if (data.rule_ids !== undefined) {
      let data32 = data.rule_ids;
      if (Array.isArray(data32)) {
        if (data32.length < 1) {
          const err67 = {
            instancePath: instancePath + "/rule_ids",
            schemaPath: "#/properties/rule_ids/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err67];
          } else {
            vErrors.push(err67);
          }
          errors++;
        }
        const len3 = data32.length;
        for (let i5 = 0; i5 < len3; i5++) {
          let data33 = data32[i5];
          if (typeof data33 === "string") {
            if (!pattern4.test(data33)) {
              const err68 = {
                instancePath: instancePath + "/rule_ids/" + i5,
                schemaPath: "common.schema.json#/$defs/stableId/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
              instancePath: instancePath + "/rule_ids/" + i5,
              schemaPath: "common.schema.json#/$defs/stableId/type",
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
        let i6 = data32.length;
        let j2;
        if (i6 > 1) {
          outer0: for (; i6--;) {
            for (j2 = i6; j2--;) {
              if (func0(data32[i6], data32[j2])) {
                const err70 = {
                  instancePath: instancePath + "/rule_ids",
                  schemaPath: "#/properties/rule_ids/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i6, j: j2 },
                  message: "must NOT have duplicate items (items ## " + j2 + " and " + i6 + " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err70];
                } else {
                  vErrors.push(err70);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err71 = {
          instancePath: instancePath + "/rule_ids",
          schemaPath: "#/properties/rule_ids/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err71];
        } else {
          vErrors.push(err71);
        }
        errors++;
      }
    }
    if (data.repair_candidates !== undefined) {
      let data34 = data.repair_candidates;
      if (Array.isArray(data34)) {
        const len4 = data34.length;
        for (let i7 = 0; i7 < len4; i7++) {
          let data35 = data34[i7];
          if (data35 && typeof data35 == "object" && !Array.isArray(data35)) {
            if (data35.action_identity === undefined) {
              const err72 = {
                instancePath: instancePath + "/repair_candidates/" + i7,
                schemaPath: "#/properties/repair_candidates/items/required",
                keyword: "required",
                params: { missingProperty: "action_identity" },
                message: "must have required property '" + "action_identity" + "'",
              };
              if (vErrors === null) {
                vErrors = [err72];
              } else {
                vErrors.push(err72);
              }
              errors++;
            }
            if (data35.target_pointer === undefined) {
              const err73 = {
                instancePath: instancePath + "/repair_candidates/" + i7,
                schemaPath: "#/properties/repair_candidates/items/required",
                keyword: "required",
                params: { missingProperty: "target_pointer" },
                message: "must have required property '" + "target_pointer" + "'",
              };
              if (vErrors === null) {
                vErrors = [err73];
              } else {
                vErrors.push(err73);
              }
              errors++;
            }
            if (data35.safe === undefined) {
              const err74 = {
                instancePath: instancePath + "/repair_candidates/" + i7,
                schemaPath: "#/properties/repair_candidates/items/required",
                keyword: "required",
                params: { missingProperty: "safe" },
                message: "must have required property '" + "safe" + "'",
              };
              if (vErrors === null) {
                vErrors = [err74];
              } else {
                vErrors.push(err74);
              }
              errors++;
            }
            if (data35.description === undefined) {
              const err75 = {
                instancePath: instancePath + "/repair_candidates/" + i7,
                schemaPath: "#/properties/repair_candidates/items/required",
                keyword: "required",
                params: { missingProperty: "description" },
                message: "must have required property '" + "description" + "'",
              };
              if (vErrors === null) {
                vErrors = [err75];
              } else {
                vErrors.push(err75);
              }
              errors++;
            }
            for (const key2 in data35) {
              if (!(
                key2 === "action_identity" ||
                key2 === "target_pointer" ||
                key2 === "safe" ||
                key2 === "description"
              )) {
                const err76 = {
                  instancePath: instancePath + "/repair_candidates/" + i7,
                  schemaPath: "#/properties/repair_candidates/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key2 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err76];
                } else {
                  vErrors.push(err76);
                }
                errors++;
              }
            }
            if (data35.action_identity !== undefined) {
              let data36 = data35.action_identity;
              if (typeof data36 === "string") {
                if (!pattern4.test(data36)) {
                  const err77 = {
                    instancePath: instancePath + "/repair_candidates/" + i7 + "/action_identity",
                    schemaPath: "common.schema.json#/$defs/stableId/pattern",
                    keyword: "pattern",
                    params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                    message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
                  instancePath: instancePath + "/repair_candidates/" + i7 + "/action_identity",
                  schemaPath: "common.schema.json#/$defs/stableId/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err78];
                } else {
                  vErrors.push(err78);
                }
                errors++;
              }
            }
            if (data35.target_pointer !== undefined) {
              let data37 = data35.target_pointer;
              if (typeof data37 === "string") {
                if (!pattern73.test(data37)) {
                  const err79 = {
                    instancePath: instancePath + "/repair_candidates/" + i7 + "/target_pointer",
                    schemaPath: "#/properties/repair_candidates/items/properties/target_pointer/pattern",
                    keyword: "pattern",
                    params: { pattern: "^/" },
                    message: 'must match pattern "' + "^/" + '"',
                  };
                  if (vErrors === null) {
                    vErrors = [err79];
                  } else {
                    vErrors.push(err79);
                  }
                  errors++;
                }
              } else {
                const err80 = {
                  instancePath: instancePath + "/repair_candidates/" + i7 + "/target_pointer",
                  schemaPath: "#/properties/repair_candidates/items/properties/target_pointer/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err80];
                } else {
                  vErrors.push(err80);
                }
                errors++;
              }
            }
            if (data35.safe !== undefined) {
              if (typeof data35.safe !== "boolean") {
                const err81 = {
                  instancePath: instancePath + "/repair_candidates/" + i7 + "/safe",
                  schemaPath: "#/properties/repair_candidates/items/properties/safe/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                };
                if (vErrors === null) {
                  vErrors = [err81];
                } else {
                  vErrors.push(err81);
                }
                errors++;
              }
            }
            if (data35.description !== undefined) {
              let data39 = data35.description;
              if (typeof data39 === "string") {
                if (func2(data39) > 500) {
                  const err82 = {
                    instancePath: instancePath + "/repair_candidates/" + i7 + "/description",
                    schemaPath: "#/properties/repair_candidates/items/properties/description/maxLength",
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
                if (func2(data39) < 1) {
                  const err83 = {
                    instancePath: instancePath + "/repair_candidates/" + i7 + "/description",
                    schemaPath: "#/properties/repair_candidates/items/properties/description/minLength",
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
                  instancePath: instancePath + "/repair_candidates/" + i7 + "/description",
                  schemaPath: "#/properties/repair_candidates/items/properties/description/type",
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
          } else {
            const err85 = {
              instancePath: instancePath + "/repair_candidates/" + i7,
              schemaPath: "#/properties/repair_candidates/items/type",
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
          instancePath: instancePath + "/repair_candidates",
          schemaPath: "#/properties/repair_candidates/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err86];
        } else {
          vErrors.push(err86);
        }
        errors++;
      }
    }
    if (data.claim_scope_ceiling !== undefined) {
      let data40 = data.claim_scope_ceiling;
      if (!(
        data40 === "exploration" ||
        data40 === "synthetic_consistency" ||
        data40 === "limited_extrapolation" ||
        data40 === "similar_regime_conditional_prediction" ||
        data40 === "real_calibrated_validation"
      )) {
        const err87 = {
          instancePath: instancePath + "/claim_scope_ceiling",
          schemaPath: "common.schema.json#/$defs/claimScope/enum",
          keyword: "enum",
          params: { allowedValues: schema45.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err87];
        } else {
          vErrors.push(err87);
        }
        errors++;
      }
    }
    if (data.typed_facts !== undefined) {
      let data41 = data.typed_facts;
      if (data41 && typeof data41 == "object" && !Array.isArray(data41)) {
        if (data41.primary_quantity === undefined) {
          const err88 = {
            instancePath: instancePath + "/typed_facts",
            schemaPath: "#/properties/typed_facts/required",
            keyword: "required",
            params: { missingProperty: "primary_quantity" },
            message: "must have required property '" + "primary_quantity" + "'",
          };
          if (vErrors === null) {
            vErrors = [err88];
          } else {
            vErrors.push(err88);
          }
          errors++;
        }
        if (data41.constraint_status === undefined) {
          const err89 = {
            instancePath: instancePath + "/typed_facts",
            schemaPath: "#/properties/typed_facts/required",
            keyword: "required",
            params: { missingProperty: "constraint_status" },
            message: "must have required property '" + "constraint_status" + "'",
          };
          if (vErrors === null) {
            vErrors = [err89];
          } else {
            vErrors.push(err89);
          }
          errors++;
        }
        for (const key3 in data41) {
          if (!(key3 === "primary_quantity" || key3 === "constraint_status")) {
            const err90 = {
              instancePath: instancePath + "/typed_facts",
              schemaPath: "#/properties/typed_facts/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key3 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err90];
            } else {
              vErrors.push(err90);
            }
            errors++;
          }
        }
        if (data41.primary_quantity !== undefined) {
          let data42 = data41.primary_quantity;
          if (typeof data42 === "string") {
            if (func2(data42) < 1) {
              const err91 = {
                instancePath: instancePath + "/typed_facts/primary_quantity",
                schemaPath: "#/properties/typed_facts/properties/primary_quantity/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err91];
              } else {
                vErrors.push(err91);
              }
              errors++;
            }
          } else {
            const err92 = {
              instancePath: instancePath + "/typed_facts/primary_quantity",
              schemaPath: "#/properties/typed_facts/properties/primary_quantity/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err92];
            } else {
              vErrors.push(err92);
            }
            errors++;
          }
        }
        if (data41.constraint_status !== undefined) {
          let data43 = data41.constraint_status;
          if (!(data43 === "satisfied" || data43 === "violated" || data43 === "unknown")) {
            const err93 = {
              instancePath: instancePath + "/typed_facts/constraint_status",
              schemaPath: "#/properties/typed_facts/properties/constraint_status/enum",
              keyword: "enum",
              params: { allowedValues: schema167.properties.typed_facts.properties.constraint_status.enum },
              message: "must be equal to one of the allowed values",
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
          instancePath: instancePath + "/typed_facts",
          schemaPath: "#/properties/typed_facts/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
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
  validate133.errors = vErrors;
  return errors === 0;
}
validate133.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate124(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-phase2/validation-report.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate124.evaluated;
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
    if (data.schema_revision === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_revision" },
        message: "must have required property '" + "schema_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.report_id === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "report_id" },
        message: "must have required property '" + "report_id" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.report_digest === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "report_digest" },
        message: "must have required property '" + "report_digest" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.input_binding === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "input_binding" },
        message: "must have required property '" + "input_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.profile_snapshot_binding === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "profile_snapshot_binding" },
        message: "must have required property '" + "profile_snapshot_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.capability_snapshot_binding === undefined) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "capability_snapshot_binding" },
        message: "must have required property '" + "capability_snapshot_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.backend_binding === undefined) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "backend_binding" },
        message: "must have required property '" + "backend_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.validation_policy_revision === undefined) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "validation_policy_revision" },
        message: "must have required property '" + "validation_policy_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.overall_status === undefined) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "overall_status" },
        message: "must have required property '" + "overall_status" + "'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.issues === undefined) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "issues" },
        message: "must have required property '" + "issues" + "'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.calculator_receipts === undefined) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "calculator_receipts" },
        message: "must have required property '" + "calculator_receipts" + "'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.compiled_request_preview === undefined) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "compiled_request_preview" },
        message: "must have required property '" + "compiled_request_preview" + "'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.field_to_pointer_map === undefined) {
      const err13 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "field_to_pointer_map" },
        message: "must have required property '" + "field_to_pointer_map" + "'",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.candidate_plan === undefined) {
      const err14 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "candidate_plan" },
        message: "must have required property '" + "candidate_plan" + "'",
      };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    if (data.budget === undefined) {
      const err15 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "budget" },
        message: "must have required property '" + "budget" + "'",
      };
      if (vErrors === null) {
        vErrors = [err15];
      } else {
        vErrors.push(err15);
      }
      errors++;
    }
    if (data.claim_scope_ceiling === undefined) {
      const err16 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "claim_scope_ceiling" },
        message: "must have required property '" + "claim_scope_ceiling" + "'",
      };
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    }
    if (data.stale_binding === undefined) {
      const err17 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "stale_binding" },
        message: "must have required property '" + "stale_binding" + "'",
      };
      if (vErrors === null) {
        vErrors = [err17];
      } else {
        vErrors.push(err17);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema146.properties, key0)) {
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
    if (data.schema_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_validation_report.v1" !== data.schema_identity) {
        const err19 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_validation_report.v1" },
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
    if (data.schema_revision !== undefined) {
      let data1 = data.schema_revision;
      if (typeof data1 === "string") {
        if (!pattern5.test(data1)) {
          const err20 = {
            instancePath: instancePath + "/schema_revision",
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
          instancePath: instancePath + "/schema_revision",
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
    if (data.report_id !== undefined) {
      let data2 = data.report_id;
      if (typeof data2 === "string") {
        if (!pattern4.test(data2)) {
          const err22 = {
            instancePath: instancePath + "/report_id",
            schemaPath: "common.schema.json#/$defs/stableId/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
          instancePath: instancePath + "/report_id",
          schemaPath: "common.schema.json#/$defs/stableId/type",
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
    if (data.report_digest !== undefined) {
      let data3 = data.report_digest;
      if (typeof data3 === "string") {
        if (!pattern5.test(data3)) {
          const err24 = {
            instancePath: instancePath + "/report_digest",
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
          instancePath: instancePath + "/report_digest",
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
    if (data.input_binding !== undefined) {
      let data4 = data.input_binding;
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
        if (data4.kind === undefined) {
          const err26 = {
            instancePath: instancePath + "/input_binding",
            schemaPath: "#/properties/input_binding/required",
            keyword: "required",
            params: { missingProperty: "kind" },
            message: "must have required property '" + "kind" + "'",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        if (data4.identity === undefined) {
          const err27 = {
            instancePath: instancePath + "/input_binding",
            schemaPath: "#/properties/input_binding/required",
            keyword: "required",
            params: { missingProperty: "identity" },
            message: "must have required property '" + "identity" + "'",
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
        if (data4.revision === undefined) {
          const err28 = {
            instancePath: instancePath + "/input_binding",
            schemaPath: "#/properties/input_binding/required",
            keyword: "required",
            params: { missingProperty: "revision" },
            message: "must have required property '" + "revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
        if (data4.digest === undefined) {
          const err29 = {
            instancePath: instancePath + "/input_binding",
            schemaPath: "#/properties/input_binding/required",
            keyword: "required",
            params: { missingProperty: "digest" },
            message: "must have required property '" + "digest" + "'",
          };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
        for (const key1 in data4) {
          if (!(key1 === "kind" || key1 === "identity" || key1 === "revision" || key1 === "digest")) {
            const err30 = {
              instancePath: instancePath + "/input_binding",
              schemaPath: "#/properties/input_binding/additionalProperties",
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
        if (data4.kind !== undefined) {
          let data5 = data4.kind;
          if (!(data5 === "draft" || data5 === "run_intake")) {
            const err31 = {
              instancePath: instancePath + "/input_binding/kind",
              schemaPath: "#/properties/input_binding/properties/kind/enum",
              keyword: "enum",
              params: { allowedValues: schema146.properties.input_binding.properties.kind.enum },
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
        if (data4.identity !== undefined) {
          let data6 = data4.identity;
          if (typeof data6 === "string") {
            if (!pattern4.test(data6)) {
              const err32 = {
                instancePath: instancePath + "/input_binding/identity",
                schemaPath: "common.schema.json#/$defs/stableId/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
              instancePath: instancePath + "/input_binding/identity",
              schemaPath: "common.schema.json#/$defs/stableId/type",
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
        if (data4.revision !== undefined) {
          let data7 = data4.revision;
          if (typeof data7 === "string") {
            if (!pattern5.test(data7)) {
              const err34 = {
                instancePath: instancePath + "/input_binding/revision",
                schemaPath: "common.schema.json#/$defs/sha256/pattern",
                keyword: "pattern",
                params: { pattern: "^sha256:[0-9a-f]{64}$" },
                message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
              instancePath: instancePath + "/input_binding/revision",
              schemaPath: "common.schema.json#/$defs/sha256/type",
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
        if (data4.digest !== undefined) {
          let data8 = data4.digest;
          if (typeof data8 === "string") {
            if (!pattern5.test(data8)) {
              const err36 = {
                instancePath: instancePath + "/input_binding/digest",
                schemaPath: "common.schema.json#/$defs/sha256/pattern",
                keyword: "pattern",
                params: { pattern: "^sha256:[0-9a-f]{64}$" },
                message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
              instancePath: instancePath + "/input_binding/digest",
              schemaPath: "common.schema.json#/$defs/sha256/type",
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
          instancePath: instancePath + "/input_binding",
          schemaPath: "#/properties/input_binding/type",
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
    if (data.profile_snapshot_binding !== undefined) {
      if (
        !validate125(data.profile_snapshot_binding, {
          instancePath: instancePath + "/profile_snapshot_binding",
          parentData: data,
          parentDataProperty: "profile_snapshot_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate125.errors : vErrors.concat(validate125.errors);
        errors = vErrors.length;
      }
    }
    if (data.capability_snapshot_binding !== undefined) {
      if (
        !validate125(data.capability_snapshot_binding, {
          instancePath: instancePath + "/capability_snapshot_binding",
          parentData: data,
          parentDataProperty: "capability_snapshot_binding",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate125.errors : vErrors.concat(validate125.errors);
        errors = vErrors.length;
      }
    }
    if (data.backend_binding !== undefined) {
      let data11 = data.backend_binding;
      if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
        if (data11.backend_revision === undefined) {
          const err39 = {
            instancePath: instancePath + "/backend_binding",
            schemaPath: "#/properties/backend_binding/required",
            keyword: "required",
            params: { missingProperty: "backend_revision" },
            message: "must have required property '" + "backend_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err39];
          } else {
            vErrors.push(err39);
          }
          errors++;
        }
        if (data11.schema_set_revision === undefined) {
          const err40 = {
            instancePath: instancePath + "/backend_binding",
            schemaPath: "#/properties/backend_binding/required",
            keyword: "required",
            params: { missingProperty: "schema_set_revision" },
            message: "must have required property '" + "schema_set_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err40];
          } else {
            vErrors.push(err40);
          }
          errors++;
        }
        for (const key2 in data11) {
          if (!(key2 === "backend_revision" || key2 === "schema_set_revision")) {
            const err41 = {
              instancePath: instancePath + "/backend_binding",
              schemaPath: "#/properties/backend_binding/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err41];
            } else {
              vErrors.push(err41);
            }
            errors++;
          }
        }
        if (data11.backend_revision !== undefined) {
          let data12 = data11.backend_revision;
          if (typeof data12 === "string") {
            if (!pattern90.test(data12)) {
              const err42 = {
                instancePath: instancePath + "/backend_binding/backend_revision",
                schemaPath: "#/properties/backend_binding/properties/backend_revision/pattern",
                keyword: "pattern",
                params: { pattern: "^[0-9a-f]{40}$" },
                message: 'must match pattern "' + "^[0-9a-f]{40}$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err42];
              } else {
                vErrors.push(err42);
              }
              errors++;
            }
          } else {
            const err43 = {
              instancePath: instancePath + "/backend_binding/backend_revision",
              schemaPath: "#/properties/backend_binding/properties/backend_revision/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err43];
            } else {
              vErrors.push(err43);
            }
            errors++;
          }
        }
        if (data11.schema_set_revision !== undefined) {
          let data13 = data11.schema_set_revision;
          if (typeof data13 === "string") {
            if (!pattern5.test(data13)) {
              const err44 = {
                instancePath: instancePath + "/backend_binding/schema_set_revision",
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
              instancePath: instancePath + "/backend_binding/schema_set_revision",
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
      } else {
        const err46 = {
          instancePath: instancePath + "/backend_binding",
          schemaPath: "#/properties/backend_binding/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err46];
        } else {
          vErrors.push(err46);
        }
        errors++;
      }
    }
    if (data.validation_policy_revision !== undefined) {
      let data14 = data.validation_policy_revision;
      if (typeof data14 === "string") {
        if (!pattern5.test(data14)) {
          const err47 = {
            instancePath: instancePath + "/validation_policy_revision",
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
          instancePath: instancePath + "/validation_policy_revision",
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
    if (data.overall_status !== undefined) {
      let data15 = data.overall_status;
      if (!(
        data15 === "valid" ||
        data15 === "invalid" ||
        data15 === "infeasible" ||
        data15 === "unsupported" ||
        data15 === "unknown" ||
        data15 === "stale" ||
        data15 === "internal_failure"
      )) {
        const err49 = {
          instancePath: instancePath + "/overall_status",
          schemaPath: "#/properties/overall_status/enum",
          keyword: "enum",
          params: { allowedValues: schema146.properties.overall_status.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err49];
        } else {
          vErrors.push(err49);
        }
        errors++;
      }
    }
    if (data.issues !== undefined) {
      let data16 = data.issues;
      if (Array.isArray(data16)) {
        const len0 = data16.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate128(data16[i0], {
              instancePath: instancePath + "/issues/" + i0,
              parentData: data16,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate128.errors : vErrors.concat(validate128.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err50 = {
          instancePath: instancePath + "/issues",
          schemaPath: "#/properties/issues/type",
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
    if (data.calculator_receipts !== undefined) {
      let data18 = data.calculator_receipts;
      if (Array.isArray(data18)) {
        if (data18.length < 1) {
          const err51 = {
            instancePath: instancePath + "/calculator_receipts",
            schemaPath: "#/properties/calculator_receipts/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err51];
          } else {
            vErrors.push(err51);
          }
          errors++;
        }
        const len1 = data18.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (
            !validate133(data18[i1], {
              instancePath: instancePath + "/calculator_receipts/" + i1,
              parentData: data18,
              parentDataProperty: i1,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate133.errors : vErrors.concat(validate133.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err52 = {
          instancePath: instancePath + "/calculator_receipts",
          schemaPath: "#/properties/calculator_receipts/type",
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
    if (data.compiled_request_preview !== undefined) {
      let data20 = data.compiled_request_preview;
      if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
        if (data20.target_identity === undefined) {
          const err53 = {
            instancePath: instancePath + "/compiled_request_preview",
            schemaPath: "#/properties/compiled_request_preview/required",
            keyword: "required",
            params: { missingProperty: "target_identity" },
            message: "must have required property '" + "target_identity" + "'",
          };
          if (vErrors === null) {
            vErrors = [err53];
          } else {
            vErrors.push(err53);
          }
          errors++;
        }
        if (data20.target_revision === undefined) {
          const err54 = {
            instancePath: instancePath + "/compiled_request_preview",
            schemaPath: "#/properties/compiled_request_preview/required",
            keyword: "required",
            params: { missingProperty: "target_revision" },
            message: "must have required property '" + "target_revision" + "'",
          };
          if (vErrors === null) {
            vErrors = [err54];
          } else {
            vErrors.push(err54);
          }
          errors++;
        }
        if (data20.canonical_payload_digest === undefined) {
          const err55 = {
            instancePath: instancePath + "/compiled_request_preview",
            schemaPath: "#/properties/compiled_request_preview/required",
            keyword: "required",
            params: { missingProperty: "canonical_payload_digest" },
            message: "must have required property '" + "canonical_payload_digest" + "'",
          };
          if (vErrors === null) {
            vErrors = [err55];
          } else {
            vErrors.push(err55);
          }
          errors++;
        }
        if (data20.redacted_payload === undefined) {
          const err56 = {
            instancePath: instancePath + "/compiled_request_preview",
            schemaPath: "#/properties/compiled_request_preview/required",
            keyword: "required",
            params: { missingProperty: "redacted_payload" },
            message: "must have required property '" + "redacted_payload" + "'",
          };
          if (vErrors === null) {
            vErrors = [err56];
          } else {
            vErrors.push(err56);
          }
          errors++;
        }
        for (const key3 in data20) {
          if (!(
            key3 === "target_identity" ||
            key3 === "target_revision" ||
            key3 === "canonical_payload_digest" ||
            key3 === "redacted_payload"
          )) {
            const err57 = {
              instancePath: instancePath + "/compiled_request_preview",
              schemaPath: "#/properties/compiled_request_preview/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key3 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err57];
            } else {
              vErrors.push(err57);
            }
            errors++;
          }
        }
        if (data20.target_identity !== undefined) {
          let data21 = data20.target_identity;
          if (typeof data21 === "string") {
            if (!pattern4.test(data21)) {
              const err58 = {
                instancePath: instancePath + "/compiled_request_preview/target_identity",
                schemaPath: "common.schema.json#/$defs/stableId/pattern",
                keyword: "pattern",
                params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err58];
              } else {
                vErrors.push(err58);
              }
              errors++;
            }
          } else {
            const err59 = {
              instancePath: instancePath + "/compiled_request_preview/target_identity",
              schemaPath: "common.schema.json#/$defs/stableId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err59];
            } else {
              vErrors.push(err59);
            }
            errors++;
          }
        }
        if (data20.target_revision !== undefined) {
          let data22 = data20.target_revision;
          if (typeof data22 === "string") {
            if (!pattern5.test(data22)) {
              const err60 = {
                instancePath: instancePath + "/compiled_request_preview/target_revision",
                schemaPath: "common.schema.json#/$defs/sha256/pattern",
                keyword: "pattern",
                params: { pattern: "^sha256:[0-9a-f]{64}$" },
                message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
              instancePath: instancePath + "/compiled_request_preview/target_revision",
              schemaPath: "common.schema.json#/$defs/sha256/type",
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
        if (data20.canonical_payload_digest !== undefined) {
          let data23 = data20.canonical_payload_digest;
          if (typeof data23 === "string") {
            if (!pattern5.test(data23)) {
              const err62 = {
                instancePath: instancePath + "/compiled_request_preview/canonical_payload_digest",
                schemaPath: "common.schema.json#/$defs/sha256/pattern",
                keyword: "pattern",
                params: { pattern: "^sha256:[0-9a-f]{64}$" },
                message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
              instancePath: instancePath + "/compiled_request_preview/canonical_payload_digest",
              schemaPath: "common.schema.json#/$defs/sha256/type",
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
        if (data20.redacted_payload !== undefined) {
          let data24 = data20.redacted_payload;
          if (!(data24 && typeof data24 == "object" && !Array.isArray(data24))) {
            const err64 = {
              instancePath: instancePath + "/compiled_request_preview/redacted_payload",
              schemaPath: "#/properties/compiled_request_preview/properties/redacted_payload/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
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
          instancePath: instancePath + "/compiled_request_preview",
          schemaPath: "#/properties/compiled_request_preview/type",
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
    if (data.field_to_pointer_map !== undefined) {
      let data25 = data.field_to_pointer_map;
      if (Array.isArray(data25)) {
        const len2 = data25.length;
        for (let i2 = 0; i2 < len2; i2++) {
          let data26 = data25[i2];
          if (data26 && typeof data26 == "object" && !Array.isArray(data26)) {
            if (data26.source_field === undefined) {
              const err66 = {
                instancePath: instancePath + "/field_to_pointer_map/" + i2,
                schemaPath: "#/properties/field_to_pointer_map/items/required",
                keyword: "required",
                params: { missingProperty: "source_field" },
                message: "must have required property '" + "source_field" + "'",
              };
              if (vErrors === null) {
                vErrors = [err66];
              } else {
                vErrors.push(err66);
              }
              errors++;
            }
            if (data26.target_pointer === undefined) {
              const err67 = {
                instancePath: instancePath + "/field_to_pointer_map/" + i2,
                schemaPath: "#/properties/field_to_pointer_map/items/required",
                keyword: "required",
                params: { missingProperty: "target_pointer" },
                message: "must have required property '" + "target_pointer" + "'",
              };
              if (vErrors === null) {
                vErrors = [err67];
              } else {
                vErrors.push(err67);
              }
              errors++;
            }
            for (const key4 in data26) {
              if (!(key4 === "source_field" || key4 === "target_pointer")) {
                const err68 = {
                  instancePath: instancePath + "/field_to_pointer_map/" + i2,
                  schemaPath: "#/properties/field_to_pointer_map/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key4 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err68];
                } else {
                  vErrors.push(err68);
                }
                errors++;
              }
            }
            if (data26.source_field !== undefined) {
              let data27 = data26.source_field;
              if (typeof data27 === "string") {
                if (!pattern4.test(data27)) {
                  const err69 = {
                    instancePath: instancePath + "/field_to_pointer_map/" + i2 + "/source_field",
                    schemaPath: "common.schema.json#/$defs/stableId/pattern",
                    keyword: "pattern",
                    params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                    message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
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
                  instancePath: instancePath + "/field_to_pointer_map/" + i2 + "/source_field",
                  schemaPath: "common.schema.json#/$defs/stableId/type",
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
            if (data26.target_pointer !== undefined) {
              let data28 = data26.target_pointer;
              if (typeof data28 === "string") {
                if (!pattern73.test(data28)) {
                  const err71 = {
                    instancePath: instancePath + "/field_to_pointer_map/" + i2 + "/target_pointer",
                    schemaPath: "#/properties/field_to_pointer_map/items/properties/target_pointer/pattern",
                    keyword: "pattern",
                    params: { pattern: "^/" },
                    message: 'must match pattern "' + "^/" + '"',
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
                  instancePath: instancePath + "/field_to_pointer_map/" + i2 + "/target_pointer",
                  schemaPath: "#/properties/field_to_pointer_map/items/properties/target_pointer/type",
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
              instancePath: instancePath + "/field_to_pointer_map/" + i2,
              schemaPath: "#/properties/field_to_pointer_map/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
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
          instancePath: instancePath + "/field_to_pointer_map",
          schemaPath: "#/properties/field_to_pointer_map/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err74];
        } else {
          vErrors.push(err74);
        }
        errors++;
      }
    }
    if (data.candidate_plan !== undefined) {
      let data29 = data.candidate_plan;
      if (data29 && typeof data29 == "object" && !Array.isArray(data29)) {
        if (data29.candidate_count === undefined) {
          const err75 = {
            instancePath: instancePath + "/candidate_plan",
            schemaPath: "#/properties/candidate_plan/required",
            keyword: "required",
            params: { missingProperty: "candidate_count" },
            message: "must have required property '" + "candidate_count" + "'",
          };
          if (vErrors === null) {
            vErrors = [err75];
          } else {
            vErrors.push(err75);
          }
          errors++;
        }
        if (data29.run_count === undefined) {
          const err76 = {
            instancePath: instancePath + "/candidate_plan",
            schemaPath: "#/properties/candidate_plan/required",
            keyword: "required",
            params: { missingProperty: "run_count" },
            message: "must have required property '" + "run_count" + "'",
          };
          if (vErrors === null) {
            vErrors = [err76];
          } else {
            vErrors.push(err76);
          }
          errors++;
        }
        if (data29.planning_status === undefined) {
          const err77 = {
            instancePath: instancePath + "/candidate_plan",
            schemaPath: "#/properties/candidate_plan/required",
            keyword: "required",
            params: { missingProperty: "planning_status" },
            message: "must have required property '" + "planning_status" + "'",
          };
          if (vErrors === null) {
            vErrors = [err77];
          } else {
            vErrors.push(err77);
          }
          errors++;
        }
        for (const key5 in data29) {
          if (!(key5 === "candidate_count" || key5 === "run_count" || key5 === "planning_status")) {
            const err78 = {
              instancePath: instancePath + "/candidate_plan",
              schemaPath: "#/properties/candidate_plan/additionalProperties",
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
        if (data29.candidate_count !== undefined) {
          let data30 = data29.candidate_count;
          if (typeof data30 === "string") {
            if (!pattern16.test(data30)) {
              const err79 = {
                instancePath: instancePath + "/candidate_plan/candidate_count",
                schemaPath: "common.schema.json#/$defs/uint64/pattern",
                keyword: "pattern",
                params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
                message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err79];
              } else {
                vErrors.push(err79);
              }
              errors++;
            }
          } else {
            const err80 = {
              instancePath: instancePath + "/candidate_plan/candidate_count",
              schemaPath: "common.schema.json#/$defs/uint64/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err80];
            } else {
              vErrors.push(err80);
            }
            errors++;
          }
        }
        if (data29.run_count !== undefined) {
          let data31 = data29.run_count;
          if (typeof data31 === "string") {
            if (!pattern16.test(data31)) {
              const err81 = {
                instancePath: instancePath + "/candidate_plan/run_count",
                schemaPath: "common.schema.json#/$defs/uint64/pattern",
                keyword: "pattern",
                params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
                message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
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
              instancePath: instancePath + "/candidate_plan/run_count",
              schemaPath: "common.schema.json#/$defs/uint64/type",
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
        if (data29.planning_status !== undefined) {
          let data32 = data29.planning_status;
          if (!(data32 === "ready" || data32 === "blocked" || data32 === "unknown")) {
            const err83 = {
              instancePath: instancePath + "/candidate_plan/planning_status",
              schemaPath: "#/properties/candidate_plan/properties/planning_status/enum",
              keyword: "enum",
              params: { allowedValues: schema146.properties.candidate_plan.properties.planning_status.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err83];
            } else {
              vErrors.push(err83);
            }
            errors++;
          }
        }
      } else {
        const err84 = {
          instancePath: instancePath + "/candidate_plan",
          schemaPath: "#/properties/candidate_plan/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err84];
        } else {
          vErrors.push(err84);
        }
        errors++;
      }
    }
    if (data.budget !== undefined) {
      let data33 = data.budget;
      if (data33 && typeof data33 == "object" && !Array.isArray(data33)) {
        if (data33.requested_runs === undefined) {
          const err85 = {
            instancePath: instancePath + "/budget",
            schemaPath: "#/properties/budget/required",
            keyword: "required",
            params: { missingProperty: "requested_runs" },
            message: "must have required property '" + "requested_runs" + "'",
          };
          if (vErrors === null) {
            vErrors = [err85];
          } else {
            vErrors.push(err85);
          }
          errors++;
        }
        if (data33.accepted_runs === undefined) {
          const err86 = {
            instancePath: instancePath + "/budget",
            schemaPath: "#/properties/budget/required",
            keyword: "required",
            params: { missingProperty: "accepted_runs" },
            message: "must have required property '" + "accepted_runs" + "'",
          };
          if (vErrors === null) {
            vErrors = [err86];
          } else {
            vErrors.push(err86);
          }
          errors++;
        }
        if (data33.wall_time_ps === undefined) {
          const err87 = {
            instancePath: instancePath + "/budget",
            schemaPath: "#/properties/budget/required",
            keyword: "required",
            params: { missingProperty: "wall_time_ps" },
            message: "must have required property '" + "wall_time_ps" + "'",
          };
          if (vErrors === null) {
            vErrors = [err87];
          } else {
            vErrors.push(err87);
          }
          errors++;
        }
        if (data33.status === undefined) {
          const err88 = {
            instancePath: instancePath + "/budget",
            schemaPath: "#/properties/budget/required",
            keyword: "required",
            params: { missingProperty: "status" },
            message: "must have required property '" + "status" + "'",
          };
          if (vErrors === null) {
            vErrors = [err88];
          } else {
            vErrors.push(err88);
          }
          errors++;
        }
        for (const key6 in data33) {
          if (!(
            key6 === "requested_runs" ||
            key6 === "accepted_runs" ||
            key6 === "wall_time_ps" ||
            key6 === "status"
          )) {
            const err89 = {
              instancePath: instancePath + "/budget",
              schemaPath: "#/properties/budget/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key6 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err89];
            } else {
              vErrors.push(err89);
            }
            errors++;
          }
        }
        if (data33.requested_runs !== undefined) {
          let data34 = data33.requested_runs;
          if (typeof data34 === "string") {
            if (!pattern16.test(data34)) {
              const err90 = {
                instancePath: instancePath + "/budget/requested_runs",
                schemaPath: "common.schema.json#/$defs/uint64/pattern",
                keyword: "pattern",
                params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
                message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err90];
              } else {
                vErrors.push(err90);
              }
              errors++;
            }
          } else {
            const err91 = {
              instancePath: instancePath + "/budget/requested_runs",
              schemaPath: "common.schema.json#/$defs/uint64/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err91];
            } else {
              vErrors.push(err91);
            }
            errors++;
          }
        }
        if (data33.accepted_runs !== undefined) {
          let data35 = data33.accepted_runs;
          if (typeof data35 === "string") {
            if (!pattern16.test(data35)) {
              const err92 = {
                instancePath: instancePath + "/budget/accepted_runs",
                schemaPath: "common.schema.json#/$defs/uint64/pattern",
                keyword: "pattern",
                params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
                message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
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
              instancePath: instancePath + "/budget/accepted_runs",
              schemaPath: "common.schema.json#/$defs/uint64/type",
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
        if (data33.wall_time_ps !== undefined) {
          let data36 = data33.wall_time_ps;
          if (typeof data36 === "string") {
            if (!pattern16.test(data36)) {
              const err94 = {
                instancePath: instancePath + "/budget/wall_time_ps",
                schemaPath: "common.schema.json#/$defs/uint64/pattern",
                keyword: "pattern",
                params: { pattern: "^(0|[1-9][0-9]{0,19})$" },
                message: 'must match pattern "' + "^(0|[1-9][0-9]{0,19})$" + '"',
              };
              if (vErrors === null) {
                vErrors = [err94];
              } else {
                vErrors.push(err94);
              }
              errors++;
            }
          } else {
            const err95 = {
              instancePath: instancePath + "/budget/wall_time_ps",
              schemaPath: "common.schema.json#/$defs/uint64/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err95];
            } else {
              vErrors.push(err95);
            }
            errors++;
          }
        }
        if (data33.status !== undefined) {
          let data37 = data33.status;
          if (!(data37 === "within_budget" || data37 === "exceeded" || data37 === "unknown")) {
            const err96 = {
              instancePath: instancePath + "/budget/status",
              schemaPath: "#/properties/budget/properties/status/enum",
              keyword: "enum",
              params: { allowedValues: schema146.properties.budget.properties.status.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err96];
            } else {
              vErrors.push(err96);
            }
            errors++;
          }
        }
      } else {
        const err97 = {
          instancePath: instancePath + "/budget",
          schemaPath: "#/properties/budget/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err97];
        } else {
          vErrors.push(err97);
        }
        errors++;
      }
    }
    if (data.claim_scope_ceiling !== undefined) {
      let data38 = data.claim_scope_ceiling;
      if (!(
        data38 === "exploration" ||
        data38 === "synthetic_consistency" ||
        data38 === "limited_extrapolation" ||
        data38 === "similar_regime_conditional_prediction" ||
        data38 === "real_calibrated_validation"
      )) {
        const err98 = {
          instancePath: instancePath + "/claim_scope_ceiling",
          schemaPath: "common.schema.json#/$defs/claimScope/enum",
          keyword: "enum",
          params: { allowedValues: schema45.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err98];
        } else {
          vErrors.push(err98);
        }
        errors++;
      }
    }
    if (data.stale_binding !== undefined) {
      let data39 = data.stale_binding;
      if (data39 && typeof data39 == "object" && !Array.isArray(data39)) {
        if (data39.is_stale === undefined) {
          const err99 = {
            instancePath: instancePath + "/stale_binding",
            schemaPath: "#/properties/stale_binding/required",
            keyword: "required",
            params: { missingProperty: "is_stale" },
            message: "must have required property '" + "is_stale" + "'",
          };
          if (vErrors === null) {
            vErrors = [err99];
          } else {
            vErrors.push(err99);
          }
          errors++;
        }
        if (data39.reasons === undefined) {
          const err100 = {
            instancePath: instancePath + "/stale_binding",
            schemaPath: "#/properties/stale_binding/required",
            keyword: "required",
            params: { missingProperty: "reasons" },
            message: "must have required property '" + "reasons" + "'",
          };
          if (vErrors === null) {
            vErrors = [err100];
          } else {
            vErrors.push(err100);
          }
          errors++;
        }
        if (data39.checked_bindings === undefined) {
          const err101 = {
            instancePath: instancePath + "/stale_binding",
            schemaPath: "#/properties/stale_binding/required",
            keyword: "required",
            params: { missingProperty: "checked_bindings" },
            message: "must have required property '" + "checked_bindings" + "'",
          };
          if (vErrors === null) {
            vErrors = [err101];
          } else {
            vErrors.push(err101);
          }
          errors++;
        }
        for (const key7 in data39) {
          if (!(key7 === "is_stale" || key7 === "reasons" || key7 === "checked_bindings")) {
            const err102 = {
              instancePath: instancePath + "/stale_binding",
              schemaPath: "#/properties/stale_binding/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key7 },
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
        if (data39.is_stale !== undefined) {
          if (typeof data39.is_stale !== "boolean") {
            const err103 = {
              instancePath: instancePath + "/stale_binding/is_stale",
              schemaPath: "#/properties/stale_binding/properties/is_stale/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err103];
            } else {
              vErrors.push(err103);
            }
            errors++;
          }
        }
        if (data39.reasons !== undefined) {
          let data41 = data39.reasons;
          if (Array.isArray(data41)) {
            const len3 = data41.length;
            for (let i3 = 0; i3 < len3; i3++) {
              let data42 = data41[i3];
              if (!(
                data42 === "profile_revision_or_digest_changed" ||
                data42 === "capability_snapshot_changed" ||
                data42 === "backend_or_schema_revision_changed" ||
                data42 === "validation_policy_changed" ||
                data42 === "calculator_algorithm_changed" ||
                data42 === "workload_template_changed" ||
                data42 === "compiled_request_changed" ||
                data42 === "approval_missing_or_expired"
              )) {
                const err104 = {
                  instancePath: instancePath + "/stale_binding/reasons/" + i3,
                  schemaPath: "#/properties/stale_binding/properties/reasons/items/enum",
                  keyword: "enum",
                  params: { allowedValues: schema146.properties.stale_binding.properties.reasons.items.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err104];
                } else {
                  vErrors.push(err104);
                }
                errors++;
              }
            }
            let i4 = data41.length;
            let j0;
            if (i4 > 1) {
              outer0: for (; i4--;) {
                for (j0 = i4; j0--;) {
                  if (func0(data41[i4], data41[j0])) {
                    const err105 = {
                      instancePath: instancePath + "/stale_binding/reasons",
                      schemaPath: "#/properties/stale_binding/properties/reasons/uniqueItems",
                      keyword: "uniqueItems",
                      params: { i: i4, j: j0 },
                      message: "must NOT have duplicate items (items ## " + j0 + " and " + i4 + " are identical)",
                    };
                    if (vErrors === null) {
                      vErrors = [err105];
                    } else {
                      vErrors.push(err105);
                    }
                    errors++;
                    break outer0;
                  }
                }
              }
            }
          } else {
            const err106 = {
              instancePath: instancePath + "/stale_binding/reasons",
              schemaPath: "#/properties/stale_binding/properties/reasons/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err106];
            } else {
              vErrors.push(err106);
            }
            errors++;
          }
        }
        if (data39.checked_bindings !== undefined) {
          let data43 = data39.checked_bindings;
          if (Array.isArray(data43)) {
            if (data43.length < 8) {
              const err107 = {
                instancePath: instancePath + "/stale_binding/checked_bindings",
                schemaPath: "#/properties/stale_binding/properties/checked_bindings/minItems",
                keyword: "minItems",
                params: { limit: 8 },
                message: "must NOT have fewer than 8 items",
              };
              if (vErrors === null) {
                vErrors = [err107];
              } else {
                vErrors.push(err107);
              }
              errors++;
            }
            const len4 = data43.length;
            for (let i5 = 0; i5 < len4; i5++) {
              let data44 = data43[i5];
              if (typeof data44 === "string") {
                if (!pattern4.test(data44)) {
                  const err108 = {
                    instancePath: instancePath + "/stale_binding/checked_bindings/" + i5,
                    schemaPath: "common.schema.json#/$defs/stableId/pattern",
                    keyword: "pattern",
                    params: { pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" },
                    message: 'must match pattern "' + "^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$" + '"',
                  };
                  if (vErrors === null) {
                    vErrors = [err108];
                  } else {
                    vErrors.push(err108);
                  }
                  errors++;
                }
              } else {
                const err109 = {
                  instancePath: instancePath + "/stale_binding/checked_bindings/" + i5,
                  schemaPath: "common.schema.json#/$defs/stableId/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err109];
                } else {
                  vErrors.push(err109);
                }
                errors++;
              }
            }
            let i6 = data43.length;
            let j1;
            if (i6 > 1) {
              outer1: for (; i6--;) {
                for (j1 = i6; j1--;) {
                  if (func0(data43[i6], data43[j1])) {
                    const err110 = {
                      instancePath: instancePath + "/stale_binding/checked_bindings",
                      schemaPath: "#/properties/stale_binding/properties/checked_bindings/uniqueItems",
                      keyword: "uniqueItems",
                      params: { i: i6, j: j1 },
                      message: "must NOT have duplicate items (items ## " + j1 + " and " + i6 + " are identical)",
                    };
                    if (vErrors === null) {
                      vErrors = [err110];
                    } else {
                      vErrors.push(err110);
                    }
                    errors++;
                    break outer1;
                  }
                }
              }
            }
          } else {
            const err111 = {
              instancePath: instancePath + "/stale_binding/checked_bindings",
              schemaPath: "#/properties/stale_binding/properties/checked_bindings/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err111];
            } else {
              vErrors.push(err111);
            }
            errors++;
          }
        }
      } else {
        const err112 = {
          instancePath: instancePath + "/stale_binding",
          schemaPath: "#/properties/stale_binding/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err112];
        } else {
          vErrors.push(err112);
        }
        errors++;
      }
    }
  } else {
    const err113 = {
      instancePath,
      schemaPath: "#/type",
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
  validate124.errors = vErrors;
  return errors === 0;
}
validate124.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export const calculatorReceiptV1 = validate133;
export const idempotencyRetentionPolicyV1 = validate139;
const schema197 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://tilesim.local/contracts/agent-orchestration-phase2/idempotency-retention-policy.schema.json",
  "x-tilesim-contract-status": "published",
  "x-tilesim-schema-identity": "tilesim.bridge.agent_orchestration_idempotency_retention_policy.v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_identity",
    "schema_revision",
    "canonicalization_identity",
    "idempotency",
    "retention",
    "forbidden_persistence",
  ],
  properties: {
    schema_identity: { const: "tilesim.bridge.agent_orchestration_idempotency_retention_policy.v1" },
    schema_revision: { $ref: "common.schema.json#/$defs/sha256" },
    canonicalization_identity: { const: "tilesim.bridge.canonical_json.v1" },
    idempotency: {
      type: "object",
      additionalProperties: false,
      required: [
        "same_key_same_payload",
        "same_key_different_payload",
        "version_change",
        "profile_revision_change",
        "crash_retry",
      ],
      properties: {
        same_key_same_payload: { const: "exact_replay_or_terminal_not_retained" },
        same_key_different_payload: { const: "reject_409_idempotency_payload_mismatch" },
        version_change: { const: "different_payload_reject_same_key" },
        profile_revision_change: { const: "different_payload_reject_same_key" },
        crash_retry: { const: "resume_or_terminalize_without_duplicate_side_effect" },
      },
    },
    retention: {
      type: "object",
      additionalProperties: false,
      required: ["retained_result", "not_retained_result", "delete", "expiry"],
      properties: {
        retained_result: { const: "exact_replay_with_original_contract_identity" },
        not_retained_result: { const: "reject_terminal_not_retained" },
        delete: { const: "tombstone_key_without_payload_or_result" },
        expiry: { const: "tombstone_key_without_payload_or_result" },
      },
    },
    forbidden_persistence: {
      type: "array",
      minItems: 3,
      contains: { const: "credential" },
      items: { enum: ["credential", "hidden_reasoning", "raw_provider_response"] },
      uniqueItems: true,
    },
  },
};
function validate139(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://tilesim.local/contracts/agent-orchestration-phase2/idempotency-retention-policy.schema.json" */ let vErrors =
    null;
  let errors = 0;
  const evaluated0 = validate139.evaluated;
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
    if (data.schema_revision === undefined) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schema_revision" },
        message: "must have required property '" + "schema_revision" + "'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.canonicalization_identity === undefined) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "canonicalization_identity" },
        message: "must have required property '" + "canonicalization_identity" + "'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.idempotency === undefined) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "idempotency" },
        message: "must have required property '" + "idempotency" + "'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.retention === undefined) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "retention" },
        message: "must have required property '" + "retention" + "'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.forbidden_persistence === undefined) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "forbidden_persistence" },
        message: "must have required property '" + "forbidden_persistence" + "'",
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
        key0 === "schema_identity" ||
        key0 === "schema_revision" ||
        key0 === "canonicalization_identity" ||
        key0 === "idempotency" ||
        key0 === "retention" ||
        key0 === "forbidden_persistence"
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
    if (data.schema_identity !== undefined) {
      if ("tilesim.bridge.agent_orchestration_idempotency_retention_policy.v1" !== data.schema_identity) {
        const err7 = {
          instancePath: instancePath + "/schema_identity",
          schemaPath: "#/properties/schema_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.agent_orchestration_idempotency_retention_policy.v1" },
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
    if (data.schema_revision !== undefined) {
      let data1 = data.schema_revision;
      if (typeof data1 === "string") {
        if (!pattern5.test(data1)) {
          const err8 = {
            instancePath: instancePath + "/schema_revision",
            schemaPath: "common.schema.json#/$defs/sha256/pattern",
            keyword: "pattern",
            params: { pattern: "^sha256:[0-9a-f]{64}$" },
            message: 'must match pattern "' + "^sha256:[0-9a-f]{64}$" + '"',
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
          instancePath: instancePath + "/schema_revision",
          schemaPath: "common.schema.json#/$defs/sha256/type",
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
    if (data.canonicalization_identity !== undefined) {
      if ("tilesim.bridge.canonical_json.v1" !== data.canonicalization_identity) {
        const err10 = {
          instancePath: instancePath + "/canonicalization_identity",
          schemaPath: "#/properties/canonicalization_identity/const",
          keyword: "const",
          params: { allowedValue: "tilesim.bridge.canonical_json.v1" },
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
    if (data.idempotency !== undefined) {
      let data3 = data.idempotency;
      if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
        if (data3.same_key_same_payload === undefined) {
          const err11 = {
            instancePath: instancePath + "/idempotency",
            schemaPath: "#/properties/idempotency/required",
            keyword: "required",
            params: { missingProperty: "same_key_same_payload" },
            message: "must have required property '" + "same_key_same_payload" + "'",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (data3.same_key_different_payload === undefined) {
          const err12 = {
            instancePath: instancePath + "/idempotency",
            schemaPath: "#/properties/idempotency/required",
            keyword: "required",
            params: { missingProperty: "same_key_different_payload" },
            message: "must have required property '" + "same_key_different_payload" + "'",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        if (data3.version_change === undefined) {
          const err13 = {
            instancePath: instancePath + "/idempotency",
            schemaPath: "#/properties/idempotency/required",
            keyword: "required",
            params: { missingProperty: "version_change" },
            message: "must have required property '" + "version_change" + "'",
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (data3.profile_revision_change === undefined) {
          const err14 = {
            instancePath: instancePath + "/idempotency",
            schemaPath: "#/properties/idempotency/required",
            keyword: "required",
            params: { missingProperty: "profile_revision_change" },
            message: "must have required property '" + "profile_revision_change" + "'",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (data3.crash_retry === undefined) {
          const err15 = {
            instancePath: instancePath + "/idempotency",
            schemaPath: "#/properties/idempotency/required",
            keyword: "required",
            params: { missingProperty: "crash_retry" },
            message: "must have required property '" + "crash_retry" + "'",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        for (const key1 in data3) {
          if (!(
            key1 === "same_key_same_payload" ||
            key1 === "same_key_different_payload" ||
            key1 === "version_change" ||
            key1 === "profile_revision_change" ||
            key1 === "crash_retry"
          )) {
            const err16 = {
              instancePath: instancePath + "/idempotency",
              schemaPath: "#/properties/idempotency/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
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
        if (data3.same_key_same_payload !== undefined) {
          if ("exact_replay_or_terminal_not_retained" !== data3.same_key_same_payload) {
            const err17 = {
              instancePath: instancePath + "/idempotency/same_key_same_payload",
              schemaPath: "#/properties/idempotency/properties/same_key_same_payload/const",
              keyword: "const",
              params: { allowedValue: "exact_replay_or_terminal_not_retained" },
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
        if (data3.same_key_different_payload !== undefined) {
          if ("reject_409_idempotency_payload_mismatch" !== data3.same_key_different_payload) {
            const err18 = {
              instancePath: instancePath + "/idempotency/same_key_different_payload",
              schemaPath: "#/properties/idempotency/properties/same_key_different_payload/const",
              keyword: "const",
              params: { allowedValue: "reject_409_idempotency_payload_mismatch" },
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
        if (data3.version_change !== undefined) {
          if ("different_payload_reject_same_key" !== data3.version_change) {
            const err19 = {
              instancePath: instancePath + "/idempotency/version_change",
              schemaPath: "#/properties/idempotency/properties/version_change/const",
              keyword: "const",
              params: { allowedValue: "different_payload_reject_same_key" },
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
        if (data3.profile_revision_change !== undefined) {
          if ("different_payload_reject_same_key" !== data3.profile_revision_change) {
            const err20 = {
              instancePath: instancePath + "/idempotency/profile_revision_change",
              schemaPath: "#/properties/idempotency/properties/profile_revision_change/const",
              keyword: "const",
              params: { allowedValue: "different_payload_reject_same_key" },
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
        if (data3.crash_retry !== undefined) {
          if ("resume_or_terminalize_without_duplicate_side_effect" !== data3.crash_retry) {
            const err21 = {
              instancePath: instancePath + "/idempotency/crash_retry",
              schemaPath: "#/properties/idempotency/properties/crash_retry/const",
              keyword: "const",
              params: { allowedValue: "resume_or_terminalize_without_duplicate_side_effect" },
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
      } else {
        const err22 = {
          instancePath: instancePath + "/idempotency",
          schemaPath: "#/properties/idempotency/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.retention !== undefined) {
      let data9 = data.retention;
      if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
        if (data9.retained_result === undefined) {
          const err23 = {
            instancePath: instancePath + "/retention",
            schemaPath: "#/properties/retention/required",
            keyword: "required",
            params: { missingProperty: "retained_result" },
            message: "must have required property '" + "retained_result" + "'",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
        if (data9.not_retained_result === undefined) {
          const err24 = {
            instancePath: instancePath + "/retention",
            schemaPath: "#/properties/retention/required",
            keyword: "required",
            params: { missingProperty: "not_retained_result" },
            message: "must have required property '" + "not_retained_result" + "'",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (data9.delete === undefined) {
          const err25 = {
            instancePath: instancePath + "/retention",
            schemaPath: "#/properties/retention/required",
            keyword: "required",
            params: { missingProperty: "delete" },
            message: "must have required property '" + "delete" + "'",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (data9.expiry === undefined) {
          const err26 = {
            instancePath: instancePath + "/retention",
            schemaPath: "#/properties/retention/required",
            keyword: "required",
            params: { missingProperty: "expiry" },
            message: "must have required property '" + "expiry" + "'",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        for (const key2 in data9) {
          if (!(
            key2 === "retained_result" ||
            key2 === "not_retained_result" ||
            key2 === "delete" ||
            key2 === "expiry"
          )) {
            const err27 = {
              instancePath: instancePath + "/retention",
              schemaPath: "#/properties/retention/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
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
        if (data9.retained_result !== undefined) {
          if ("exact_replay_with_original_contract_identity" !== data9.retained_result) {
            const err28 = {
              instancePath: instancePath + "/retention/retained_result",
              schemaPath: "#/properties/retention/properties/retained_result/const",
              keyword: "const",
              params: { allowedValue: "exact_replay_with_original_contract_identity" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err28];
            } else {
              vErrors.push(err28);
            }
            errors++;
          }
        }
        if (data9.not_retained_result !== undefined) {
          if ("reject_terminal_not_retained" !== data9.not_retained_result) {
            const err29 = {
              instancePath: instancePath + "/retention/not_retained_result",
              schemaPath: "#/properties/retention/properties/not_retained_result/const",
              keyword: "const",
              params: { allowedValue: "reject_terminal_not_retained" },
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
        if (data9.delete !== undefined) {
          if ("tombstone_key_without_payload_or_result" !== data9.delete) {
            const err30 = {
              instancePath: instancePath + "/retention/delete",
              schemaPath: "#/properties/retention/properties/delete/const",
              keyword: "const",
              params: { allowedValue: "tombstone_key_without_payload_or_result" },
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
        if (data9.expiry !== undefined) {
          if ("tombstone_key_without_payload_or_result" !== data9.expiry) {
            const err31 = {
              instancePath: instancePath + "/retention/expiry",
              schemaPath: "#/properties/retention/properties/expiry/const",
              keyword: "const",
              params: { allowedValue: "tombstone_key_without_payload_or_result" },
              message: "must be equal to constant",
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
          instancePath: instancePath + "/retention",
          schemaPath: "#/properties/retention/type",
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
    if (data.forbidden_persistence !== undefined) {
      let data14 = data.forbidden_persistence;
      if (Array.isArray(data14)) {
        if (data14.length < 3) {
          const err33 = {
            instancePath: instancePath + "/forbidden_persistence",
            schemaPath: "#/properties/forbidden_persistence/minItems",
            keyword: "minItems",
            params: { limit: 3 },
            message: "must NOT have fewer than 3 items",
          };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
        const len0 = data14.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data15 = data14[i0];
          if (!(data15 === "credential" || data15 === "hidden_reasoning" || data15 === "raw_provider_response")) {
            const err34 = {
              instancePath: instancePath + "/forbidden_persistence/" + i0,
              schemaPath: "#/properties/forbidden_persistence/items/enum",
              keyword: "enum",
              params: { allowedValues: schema197.properties.forbidden_persistence.items.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err34];
            } else {
              vErrors.push(err34);
            }
            errors++;
          }
        }
        const _errs25 = errors;
        const len1 = data14.length;
        for (let i1 = 0; i1 < len1; i1++) {
          const _errs26 = errors;
          if ("credential" !== data14[i1]) {
            const err35 = {
              instancePath: instancePath + "/forbidden_persistence/" + i1,
              schemaPath: "#/properties/forbidden_persistence/contains/const",
              keyword: "const",
              params: { allowedValue: "credential" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err35];
            } else {
              vErrors.push(err35);
            }
            errors++;
          }
          var valid6 = _errs26 === errors;
          if (valid6) {
            break;
          }
        }
        if (!valid6) {
          const err36 = {
            instancePath: instancePath + "/forbidden_persistence",
            schemaPath: "#/properties/forbidden_persistence/contains",
            keyword: "contains",
            params: { minContains: 1 },
            message: "must contain at least 1 valid item(s)",
          };
          if (vErrors === null) {
            vErrors = [err36];
          } else {
            vErrors.push(err36);
          }
          errors++;
        } else {
          errors = _errs25;
          if (vErrors !== null) {
            if (_errs25) {
              vErrors.length = _errs25;
            } else {
              vErrors = null;
            }
          }
        }
        let i2 = data14.length;
        let j0;
        if (i2 > 1) {
          outer0: for (; i2--;) {
            for (j0 = i2; j0--;) {
              if (func0(data14[i2], data14[j0])) {
                const err37 = {
                  instancePath: instancePath + "/forbidden_persistence",
                  schemaPath: "#/properties/forbidden_persistence/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i2, j: j0 },
                  message: "must NOT have duplicate items (items ## " + j0 + " and " + i2 + " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err37];
                } else {
                  vErrors.push(err37);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err38 = {
          instancePath: instancePath + "/forbidden_persistence",
          schemaPath: "#/properties/forbidden_persistence/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
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
      instancePath,
      schemaPath: "#/type",
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
  validate139.errors = vErrors;
  return errors === 0;
}
validate139.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
